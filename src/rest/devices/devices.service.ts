import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Device, DeviceSettings, DeviceClaims } from '@/generated/prisma/client';
import { Prisma } from '@/generated/prisma/client';
import { ClaimType, DeviceType } from '@/generated/prisma/enums';
import { prisma, notifySettingsUpdate } from '@/shared/utils';
import { SignJWT } from 'jose';
import type {
  DeviceResponseDto,
  LanternSettingsDto,
  MatrxSettingsDto,
} from '@/rest/devices/dto/device-response.dto';
import type { ClaimTokenResponseDto } from '@/rest/devices/dto/claim-token-response.dto';
import type { UpdateDeviceSettingsDto } from '@/rest/devices/dto/update-device-settings.dto';

@Injectable()
export class DevicesService {
  async listDevicesForUser(userId: string): Promise<DeviceResponseDto[]> {
    const records = await prisma.device.findMany({
      where: {
        deviceClaims: {
          some: {
            userId,
            claimType: ClaimType.OWNER,
          },
        },
      },
      include: {
        settings: true,
        deviceClaims: {
          where: { userId },
        },
        currentlyDisplayingInstallation: true,
        _count: {
          select: { installations: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((record) => this.mapDevice(record, userId));
  }

  async getDeviceForUser(deviceId: string, userId: string): Promise<DeviceResponseDto> {
    const record = await prisma.device.findFirst({
      where: {
        id: deviceId,
        deviceClaims: {
          some: {
            userId,
            claimType: { in: [ClaimType.OWNER, ClaimType.SHARED] },
          },
        },
      },
      include: {
        settings: true,
        deviceClaims: {
          where: { userId },
        },
        currentlyDisplayingInstallation: true,
        _count: {
          select: { installations: true },
        },
      },
    });

    if (!record) {
      throw new NotFoundException(`Device ${deviceId} not found`);
    }

    return this.mapDevice(record, userId);
  }

  async updateSettings(
    deviceId: string,
    userId: string,
    data: UpdateDeviceSettingsDto
  ): Promise<DeviceResponseDto> {
    // Verify ownership and get device type
    const device = await prisma.device.findFirst({
      where: {
        id: deviceId,
        deviceClaims: {
          some: { userId, claimType: ClaimType.OWNER },
        },
      },
      include: { settings: true },
    });

    if (!device) {
      throw new NotFoundException(`Device ${deviceId} not found or not owned by user`);
    }

    // Validate device type matches the DTO type
    if (device.type !== data.type) {
      throw new BadRequestException(
        `Device is type ${device.type}, but settings update is for ${data.type}`
      );
    }

    // Build update data
    const updateData: Prisma.DeviceSettingsUpdateInput = {};
    const createData: Prisma.DeviceSettingsCreateInput = {
      device: { connect: { id: deviceId } },
      displayName: data.displayName ?? deviceId,
    };

    if (data.displayName !== undefined) {
      updateData.displayName = data.displayName;
      createData.displayName = data.displayName;
    }

    if (data.typeSettings !== undefined) {
      // Merge with existing typeSettings if any
      const existingTypeSettings = device.settings?.typeSettings as Record<string, unknown> | null;
      const mergedTypeSettings = {
        ...(existingTypeSettings ?? {}),
        ...data.typeSettings,
      };
      updateData.typeSettings = mergedTypeSettings;
      createData.typeSettings = mergedTypeSettings;
    }

    // Upsert settings
    await prisma.deviceSettings.upsert({
      where: { deviceId },
      create: createData,
      update: updateData,
    });

    // Notify device if typeSettings changed (device-relevant settings)
    if (data.typeSettings !== undefined) {
      await notifySettingsUpdate(deviceId);
    }

    return this.getDeviceForUser(deviceId, userId);
  }

  async deleteDevice(deviceId: string, userId: string): Promise<void> {
    // Verify ownership
    const claim = await prisma.deviceClaims.findFirst({
      where: { deviceId, userId, claimType: ClaimType.OWNER },
    });

    if (!claim) {
      throw new NotFoundException(`Device ${deviceId} not found or not owned by user`);
    }

    // Delete the device (cascade will handle related records)
    await prisma.device.delete({
      where: { id: deviceId },
    });
  }

  private mapDevice(
    record: Device & {
      settings: DeviceSettings | null;
      deviceClaims: DeviceClaims[];
      currentlyDisplayingInstallation: { id: string } | null;
      _count: { installations: number };
    },
    userId: string
  ): DeviceResponseDto {
    const userClaim = record.deviceClaims.find((claim) => claim.userId === userId);
    const accessLevel = userClaim?.claimType ?? ClaimType.OWNER;

    // Compute online status: device seen within the last 60 seconds
    const online = record.lastSeenAt
      ? Date.now() - record.lastSeenAt.getTime() < 60000
      : false;

    const baseFields = {
      id: record.id,
      online,
      accessLevel,
      currentlyDisplayingInstallation: record.currentlyDisplayingInstallation?.id ?? null,
      installationCount: record._count.installations,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };

    // Parse deviceInfo from the JSON field
    const deviceInfo = record.deviceInfo
      ? (record.deviceInfo as { width: number; height: number; hasLightSensor: boolean })
      : null;

    const settings = record.settings
      ? {
          displayName: record.settings.displayName,
          typeSettings: this.parseTypeSettings(record.settings.typeSettings),
          ...(deviceInfo && deviceInfo), // Flatten deviceInfo into settings
        }
      : deviceInfo
        ? deviceInfo // If no settings but have deviceInfo, return deviceInfo only
        : null;

    if (record.type === DeviceType.LANTERN) {
      return {
        ...baseFields,
        type: 'LANTERN' as const,
        settings: settings as
          | {
              displayName: string;
              typeSettings: LanternSettingsDto | null;
              width?: number;
              height?: number;
              hasLightSensor?: boolean;
            }
          | { width: number; height: number; hasLightSensor: boolean }
          | null,
      };
    }

    return {
      ...baseFields,
      type: 'MATRX' as const,
      settings: settings as
        | {
            displayName: string;
            typeSettings: MatrxSettingsDto | null;
            width?: number;
            height?: number;
            hasLightSensor?: boolean;
          }
        | { width: number; height: number; hasLightSensor: boolean }
        | null,
    };
  }

  async generateClaimToken(userId: string): Promise<ClaimTokenResponseDto> {
    const claimSecret = process.env.CLAIM_JWT_SECRET;
    if (!claimSecret) {
      throw new Error('CLAIM_JWT_SECRET environment variable not configured');
    }

    const secretKey = Buffer.from(claimSecret, 'utf8');
    const expiresAt = Math.floor(Date.now() / 1000) + 600; // 10 minutes from now

    const token = await new SignJWT({ user_id: userId })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(expiresAt)
      .setIssuedAt()
      .sign(secretKey);

    return {
      token,
      expiresAt,
    };
  }

  private parseTypeSettings(value: Prisma.JsonValue | null): Record<string, unknown> | null {
    if (value == null) {
      return null;
    }
    return value as Record<string, unknown>;
  }
}
