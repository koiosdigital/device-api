import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '@/rest/auth/auth.types';
import { prisma } from '@/shared/utils';
import { ClaimType } from '@/generated/prisma/enums';

/**
 * Guard that ensures the user is the owner of the device.
 * Checks the deviceId parameter and validates ownership via DeviceClaims.
 */
@Injectable()
export class OwnerGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    const deviceId = request.params['id'];

    if (!deviceId) {
      throw new NotFoundException('Device ID not found in request');
    }

    if (!user?.sub) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check if user owns this device
    const claim = await prisma.deviceClaims.findFirst({
      where: {
        deviceId,
        userId: user.sub,
        claimType: ClaimType.OWNER,
      },
    });

    if (!claim) {
      throw new ForbiddenException('You do not own this device');
    }

    return true;
  }
}
