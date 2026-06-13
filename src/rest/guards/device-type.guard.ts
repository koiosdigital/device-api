import {
  type CanActivate,
  type ExecutionContext,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '@/rest/auth/auth.types';
import { prisma } from '@/shared/utils';
import type { DeviceType } from '@/generated/prisma/enums';
import { REQUIRED_DEVICE_TYPE_KEY } from '@/rest/guards/require-device-type.decorator';

/**
 * Guard that enforces a route's {@link RequireDeviceType} requirement: the
 * device addressed by the route must be one of the declared types, else 400.
 *
 * Pairs with OwnerGuard/SharedGuard for access control. Place it AFTER the
 * access guard (e.g. `@UseGuards(SharedGuard, DeviceTypeGuard)`) so callers
 * without access get 403 before any device type is revealed. The resolved
 * device is attached to `request.device` for downstream reuse.
 */
@Injectable()
export class DeviceTypeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<DeviceType[] | undefined>(
      REQUIRED_DEVICE_TYPE_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const deviceId = (request.params['deviceId'] || request.params['id']) as string;

    if (!deviceId) {
      throw new NotFoundException('Device ID not found in request');
    }

    const device = await prisma.device.findUnique({
      where: { id: deviceId },
      select: { id: true, type: true },
    });

    if (!device) {
      throw new NotFoundException(`Device ${deviceId} not found`);
    }

    if (!required.includes(device.type)) {
      throw new BadRequestException(
        `Device ${deviceId} is type ${device.type}; this endpoint requires ${required.join(' or ')}`
      );
    }

    request.device = device;
    return true;
  }
}
