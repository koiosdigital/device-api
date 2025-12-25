import { Injectable, NotFoundException } from '@nestjs/common';
import type { Device, DeviceSettings } from '~/generated/prisma/client';
import { Prisma } from '~/generated/prisma/client';
import { ClaimType } from '~/generated/prisma/enums';
import { prisma } from '~/shared/utils';
import { DeviceResponseDto } from './dto/device-response.dto';

@Injectable()
export class DevicesService {
  async listDevicesForUser(userId: string): Promise<DeviceResponseDto[]> {
    const records = await prisma.device.findMany({
      where: {
        deviceClaims: {
          some: {
            userId,
            claimType: { in: [ClaimType.OWNER, ClaimType.SHARED] },
          },
        },
      },
      include: { settings: true },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((record) => this.mapDevice(record));
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
      include: { settings: true },
    });

    if (!record) {
      throw new NotFoundException(`Device ${deviceId} not found`);
    }

    return this.mapDevice(record);
  }

  private mapDevice(record: Device & { settings: DeviceSettings | null }): DeviceResponseDto {
    return {
      id: record.id,
      type: record.type,
      online: record.online,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      settings: record.settings
        ? {
            displayName: record.settings.displayName,
            typeSettings: this.parseTypeSettings(record.settings.typeSettings),
          }
        : null,
    };
  }

  private parseTypeSettings(value: Prisma.JsonValue | null): Record<string, unknown> | null {
    if (value == null) {
      return null;
    }
    return value as Record<string, unknown>;
  }
}
