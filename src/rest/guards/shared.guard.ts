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
 * Guard that ensures the user has access to the device (either as owner or shared).
 * Checks the deviceId parameter and validates access via DeviceClaims.
 */
@Injectable()
export class SharedGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    const deviceId = request.params['deviceId'] || request.params['id'];

    if (!deviceId) {
      throw new NotFoundException('Device ID not found in request');
    }

    if (!user?.sub) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check if user has any access (owner or shared) to this device
    const claim = await prisma.deviceClaims.findFirst({
      where: {
        deviceId,
        userId: user.sub,
        claimType: { in: [ClaimType.OWNER, ClaimType.SHARED] },
      },
    });

    if (!claim) {
      throw new ForbiddenException('You do not have access to this device');
    }

    return true;
  }
}
