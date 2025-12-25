import { Injectable, NotFoundException } from '@nestjs/common';
import type { Device, DeviceSettings, DeviceClaims } from '@/generated/prisma/client';
import { Prisma } from '@/generated/prisma/client';
import { ClaimType, DeviceType } from '@/generated/prisma/enums';
import { prisma } from '@/shared/utils';
import { SignJWT } from 'jose';
import type {
  DeviceResponseDto,
  LanternSettingsDto,
  MatrxSettingsDto,
} from '@/rest/devices/dto/device-response.dto';
import type { ClaimTokenResponseDto } from '@/rest/devices/dto/claim-token-response.dto';

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

  async updateDevice(
    deviceId: string,
    userId: string,
    data: { displayName?: string }
  ): Promise<DeviceResponseDto> {
    // Verify ownership
    const claim = await prisma.deviceClaims.findFirst({
      where: { deviceId, userId, claimType: ClaimType.OWNER },
    });

    if (!claim) {
      throw new NotFoundException(`Device ${deviceId} not found or not owned by user`);
    }

    // Update device settings
    if (data.displayName !== undefined) {
      await prisma.deviceSettings.upsert({
        where: { deviceId },
        create: {
          deviceId,
          displayName: data.displayName,
        },
        update: {
          displayName: data.displayName,
        },
      });
    }

    // Fetch and return updated device
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

    const baseFields = {
      id: record.id,
      online: record.online,
      accessLevel,
      currentlyDisplayingInstallation: record.currentlyDisplayingInstallation?.id ?? null,
      installationCount: record._count.installations,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };

    const settings = record.settings
      ? {
          displayName: record.settings.displayName,
          typeSettings: this.parseTypeSettings(record.settings.typeSettings),
        }
      : null;

    if (record.type === DeviceType.LANTERN) {
      return {
        ...baseFields,
        type: 'LANTERN' as const,
        settings: settings as { displayName: string; typeSettings: LanternSettingsDto | null } | null,
      };
    }

    return {
      ...baseFields,
      type: 'MATRX' as const,
      settings: settings as { displayName: string; typeSettings: MatrxSettingsDto | null } | null,
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
