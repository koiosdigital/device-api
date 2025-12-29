import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { SignJWT, jwtVerify } from 'jose';
import { prisma } from '@/shared/utils';
import { emailService } from '@/shared/email';
import { ClaimType } from '@/generated/prisma/enums';
import type {
  DeviceSharesResponseDto,
  ShareInviteCreatedDto,
  AcceptShareResultDto,
} from './dto';

const INVITE_EXPIRY_HOURS = 24;

interface ShareInvitePayload {
  invite_id: string;
  device_id: string;
  target_email: string;
}

@Injectable()
export class SharingService {
  private getJwtSecret(): Uint8Array {
    const secret = process.env.CLAIM_JWT_SECRET;
    if (!secret) {
      throw new Error('CLAIM_JWT_SECRET environment variable not configured');
    }
    return Buffer.from(secret, 'utf8');
  }

  private async generateInviteToken(payload: ShareInvitePayload): Promise<string> {
    const expiresAt = Math.floor(Date.now() / 1000) + INVITE_EXPIRY_HOURS * 60 * 60;

    return new SignJWT(payload as unknown as Record<string, unknown>)
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(expiresAt)
      .setIssuedAt()
      .sign(this.getJwtSecret());
  }

  private async verifyInviteToken(token: string): Promise<ShareInvitePayload | null> {
    try {
      const { payload } = await jwtVerify(token, this.getJwtSecret());
      if (
        typeof payload.invite_id === 'string' &&
        typeof payload.device_id === 'string' &&
        typeof payload.target_email === 'string'
      ) {
        return {
          invite_id: payload.invite_id,
          device_id: payload.device_id,
          target_email: payload.target_email,
        };
      }
    } catch {
      // Token invalid or expired
    }
    return null;
  }

  async createInvite(
    deviceId: string,
    inviterId: string,
    targetEmail: string
  ): Promise<ShareInviteCreatedDto> {
    // Verify inviter owns the device
    const ownerClaim = await prisma.deviceClaims.findFirst({
      where: { deviceId, userId: inviterId, claimType: ClaimType.OWNER },
      include: { device: { include: { settings: true } } },
    });

    if (!ownerClaim) {
      throw new NotFoundException('Device not found or you are not the owner');
    }

    // Check if target email already has access
    const existingClaim = await prisma.deviceClaims.findFirst({
      where: {
        deviceId,
        // We can't check by email directly since claims are by userId
        // But we can check if there's already a pending invite
      },
    });

    // Check for existing pending invite
    const existingInvite = await prisma.deviceShareInvite.findUnique({
      where: { deviceId_targetEmail: { deviceId, targetEmail } },
    });

    if (existingInvite && !existingInvite.acceptedAt && existingInvite.expiresAt > new Date()) {
      throw new ConflictException('An active invite already exists for this email');
    }

    // Delete expired/accepted invite if exists
    if (existingInvite) {
      await prisma.deviceShareInvite.delete({
        where: { id: existingInvite.id },
      });
    }

    // Create new invite
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000);
    const invite = await prisma.deviceShareInvite.create({
      data: {
        deviceId,
        inviterId,
        targetEmail,
        expiresAt,
      },
    });

    // Generate token
    const token = await this.generateInviteToken({
      invite_id: invite.id,
      device_id: deviceId,
      target_email: targetEmail,
    });

    // Build invite URL
    const appUrl = process.env.APP_URL || 'https://app.example.com';
    const inviteUrl = `${appUrl}/share/accept?token=${encodeURIComponent(token)}`;

    // Get device name for email
    const deviceName = ownerClaim.device.settings?.displayName || deviceId;
    const inviterName = 'A user'; // TODO: Could fetch from user service if available

    // Send email
    try {
      await emailService.sendDeviceShareInvite({
        toEmail: targetEmail,
        inviterName,
        deviceName,
        inviteUrl,
      });
    } catch (error) {
      // Delete the invite if email fails
      await prisma.deviceShareInvite.delete({ where: { id: invite.id } });
      throw new BadRequestException('Failed to send invite email. Please try again.');
    }

    return {
      id: invite.id,
      email: targetEmail,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async acceptInvite(token: string, userId: string): Promise<AcceptShareResultDto> {
    // Verify token
    const payload = await this.verifyInviteToken(token);
    if (!payload) {
      throw new BadRequestException('Invalid or expired invite token');
    }

    // Find the invite
    const invite = await prisma.deviceShareInvite.findUnique({
      where: { id: payload.invite_id },
      include: { device: { include: { settings: true } } },
    });

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    if (invite.acceptedAt) {
      throw new BadRequestException('This invite has already been accepted');
    }

    if (invite.expiresAt < new Date()) {
      throw new BadRequestException('This invite has expired');
    }

    // Check if user already has access
    const existingClaim = await prisma.deviceClaims.findUnique({
      where: { deviceId_userId: { deviceId: invite.deviceId, userId } },
    });

    if (existingClaim) {
      throw new ConflictException('You already have access to this device');
    }

    // Create shared claim and mark invite as accepted
    await prisma.$transaction([
      prisma.deviceClaims.create({
        data: {
          deviceId: invite.deviceId,
          userId,
          claimType: ClaimType.SHARED,
        },
      }),
      prisma.deviceShareInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      }),
    ]);

    const deviceName = invite.device.settings?.displayName || invite.deviceId;

    return {
      deviceId: invite.deviceId,
      deviceName,
      message: `You now have shared access to "${deviceName}"`,
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

    // Get all invites (pending and accepted)
    const invites = await prisma.deviceShareInvite.findMany({
      where: { deviceId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      deviceId,
      sharedUsers: sharedClaims.map((claim) => ({
        userId: claim.userId,
        sharedAt: claim.claimedAt.toISOString(),
      })),
      pendingInvites: invites
        .filter((inv) => !inv.acceptedAt && inv.expiresAt > new Date())
        .map((inv) => ({
          id: inv.id,
          email: inv.targetEmail,
          accepted: false,
          acceptedAt: null,
          expiresAt: inv.expiresAt.toISOString(),
          createdAt: inv.createdAt.toISOString(),
        })),
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
