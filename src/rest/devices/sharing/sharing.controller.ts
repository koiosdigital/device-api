import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { SharingService } from './sharing.service';
import { CreateShareInviteDto, DeviceSharesResponseDto, ShareInviteCreatedDto } from './dto';
import { CurrentUser } from '@/shared/current-user.decorator';
import type { AuthenticatedUser } from '@/rest/auth/oidc-auth.service';
import { OwnerGuard } from '@/rest/guards/owner.guard';
import {
  ApiCommonErrorResponses,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
} from '@/rest/common';

@ApiTags('Device Sharing')
@ApiBearerAuth()
@ApiCommonErrorResponses()
@Controller({ path: 'devices/:deviceId/shares', version: '1' })
export class SharingController {
  constructor(private readonly sharingService: SharingService) {}

  @Get()
  @UseGuards(OwnerGuard)
  @ApiOperation({
    summary: 'List all shares and pending invites for a device',
    description:
      'Returns a list of users with shared access and pending invites. Only device owners can view this.',
  })
  @ApiParam({ name: 'deviceId', description: 'Device ID' })
  @ApiResponse({ status: 200, description: 'Device shares', type: DeviceSharesResponseDto })
  @ApiForbiddenResponse('Only device owners can view shares')
  @ApiNotFoundResponse('Device not found')
  async getShares(
    @Param('deviceId') deviceId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<DeviceSharesResponseDto> {
    return this.sharingService.getDeviceShares(deviceId, user.sub);
  }

  @Post('invite')
  @UseGuards(OwnerGuard)
  @ApiOperation({
    summary: 'Share device access with a user by email',
    description:
      'Grants shared device access to a user by email. The share will be linked to the user when they next log in.',
  })
  @ApiParam({ name: 'deviceId', description: 'Device ID' })
  @ApiResponse({ status: 201, description: 'Share created', type: ShareInviteCreatedDto })
  @ApiBadRequestResponse('Invalid email')
  @ApiForbiddenResponse('Only device owners can share devices')
  @ApiNotFoundResponse('Device not found')
  async createInvite(
    @Param('deviceId') deviceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateShareInviteDto
  ): Promise<ShareInviteCreatedDto> {
    return this.sharingService.createInvite(deviceId, user.sub, dto.email);
  }

  @Delete('invite/:inviteId')
  @UseGuards(OwnerGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Cancel a pending invite',
    description: 'Cancels a pending share invite. Only device owners can cancel invites.',
  })
  @ApiParam({ name: 'deviceId', description: 'Device ID' })
  @ApiParam({ name: 'inviteId', description: 'Invite ID' })
  @ApiResponse({ status: 204, description: 'Invite cancelled' })
  @ApiForbiddenResponse('Only device owners can cancel invites')
  @ApiNotFoundResponse('Invite not found')
  async cancelInvite(
    @Param('deviceId') deviceId: string,
    @Param('inviteId') inviteId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<void> {
    return this.sharingService.cancelInvite(deviceId, inviteId, user.sub);
  }

  @Delete('user/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Revoke shared access',
    description:
      'Removes shared access for a user. Device owners can revoke any share, shared users can only revoke their own access.',
  })
  @ApiParam({ name: 'deviceId', description: 'Device ID' })
  @ApiParam({ name: 'userId', description: 'User ID to revoke access for' })
  @ApiResponse({ status: 204, description: 'Share revoked' })
  @ApiForbiddenResponse('Only device owners can revoke shares for other users')
  @ApiNotFoundResponse('Share not found')
  async revokeShare(
    @Param('deviceId') deviceId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<void> {
    return this.sharingService.revokeShare(deviceId, userId, user.sub);
  }
}
