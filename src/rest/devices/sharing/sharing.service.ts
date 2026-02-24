import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { prisma } from '@/shared/utils';
import { ClaimType } from '@/generated/prisma/enums';
import type { DeviceSharesResponseDto, ShareInviteCreatedDto } from './dto';

@Injectable()
export class SharingService {
  async createInvite(
    deviceId: string,
    inviterId: string,
    targetEmail: string
  ): Promise<ShareInviteCreatedDto> {
    // Verify inviter owns the device
    const ownerClaim = await prisma.deviceClaims.findFirst({
      where: { deviceId, userId: inviterId, claimType: ClaimType.OWNER },
    });

    if (!ownerClaim) {
      throw new NotFoundException('Device not found or you are not the owner');
    }

    // Check if target email already has a claim for this device
    const existingClaim = await prisma.deviceClaims.findFirst({
      where: { deviceId, userId: targetEmail },
    });

    if (existingClaim) {
      throw new ConflictException('An invite already exists for this email');
    }

    // Create a shared claim with the email as userId (will be migrated on login)
    const claim = await prisma.deviceClaims.create({
      data: {
        deviceId,
        userId: targetEmail,
        claimType: ClaimType.SHARED,
      },
    });

    return {
      id: String(claim.id),
      email: targetEmail,
      expiresAt: null,
    };
  }

  async getDeviceShares(deviceId: string, userId: string): Promise<DeviceSharesResponseDto> {
    // Verify user owns the device
    const ownerClaim = await prisma.deviceClaims.findFirst({
      where: { deviceId, userId, claimType: ClaimType.OWNER },
    });

    if (!ownerClaim) {
      throw new NotFoundException('Device not found or you are not the owner');
    }

    // Get all shared users
    const sharedClaims = await prisma.deviceClaims.findMany({
      where: { deviceId, claimType: ClaimType.SHARED },
    });

    return {
      deviceId,
      sharedUsers: sharedClaims.map((claim) => ({
        userId: claim.userId,
        sharedAt: claim.claimedAt.toISOString(),
      })),
      pendingInvites: [],
    };
  }

  async revokeShare(deviceId: string, targetUserId: string, requesterId: string): Promise<void> {
    // Check if requester is owner
    const ownerClaim = await prisma.deviceClaims.findFirst({
      where: { deviceId, userId: requesterId, claimType: ClaimType.OWNER },
    });

    // Check if requester is the shared user themselves
    const isSelfRevoke = targetUserId === requesterId;

    if (!ownerClaim && !isSelfRevoke) {
      throw new ForbiddenException('Only device owners can revoke shares for other users');
    }

    // Find and delete the shared claim
    const sharedClaim = await prisma.deviceClaims.findFirst({
      where: { deviceId, userId: targetUserId, claimType: ClaimType.SHARED },
    });

    if (!sharedClaim) {
      throw new NotFoundException('Share not found');
    }

    await prisma.deviceClaims.delete({
      where: { id: sharedClaim.id },
    });
  }

  async cancelInvite(deviceId: string, inviteId: string, userId: string): Promise<void> {
    // Verify user owns the device
    const ownerClaim = await prisma.deviceClaims.findFirst({
      where: { deviceId, userId, claimType: ClaimType.OWNER },
    });

    if (!ownerClaim) {
      throw new ForbiddenException('Only device owners can cancel invites');
    }

    const invite = await prisma.deviceShareInvite.findFirst({
      where: { id: inviteId, deviceId },
    });

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    await prisma.deviceShareInvite.delete({
      where: { id: inviteId },
    });
  }
}
