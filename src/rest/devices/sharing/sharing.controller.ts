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
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { SharingService } from './sharing.service';
import {
  CreateShareInviteDto,
  AcceptShareInviteDto,
  DeviceSharesResponseDto,
  ShareInviteCreatedDto,
  AcceptShareResultDto,
} from './dto';
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
    description: 'Returns a list of users with shared access and pending invites. Only device owners can view this.',
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
    summary: 'Create a share invite',
    description: 'Sends an email invitation to share device access. Only device owners can create invites.',
  })
  @ApiParam({ name: 'deviceId', description: 'Device ID' })
  @ApiResponse({ status: 201, description: 'Invite created', type: ShareInviteCreatedDto })
  @ApiBadRequestResponse('Invalid email or failed to send invite')
  @ApiForbiddenResponse('Only device owners can create invites')
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
    description: 'Removes shared access for a user. Device owners can revoke any share, shared users can only revoke their own access.',
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

@ApiTags('Device Sharing')
@ApiBearerAuth()
@ApiCommonErrorResponses()
@Controller({ path: 'shares', version: '1' })
export class ShareAcceptController {
  constructor(private readonly sharingService: SharingService) {}

  @Post('accept')
  @ApiOperation({
    summary: 'Accept a share invite',
    description: 'Accepts a share invitation using the token from the invite email. The authenticated user will be granted shared access to the device.',
  })
  @ApiResponse({ status: 200, description: 'Share accepted', type: AcceptShareResultDto })
  @ApiBadRequestResponse('Invalid or expired token')
  @ApiNotFoundResponse('Invite not found')
  async acceptInvite(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AcceptShareInviteDto
  ): Promise<AcceptShareResultDto> {
    return this.sharingService.acceptInvite(dto.token, user.sub);
  }
}
