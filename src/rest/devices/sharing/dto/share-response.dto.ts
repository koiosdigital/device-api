import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ShareUserDto {
  @ApiProperty({ description: 'User ID of the shared user' })
  userId!: string;

  @ApiProperty({ description: 'When the share was created' })
  sharedAt!: string;
}

export class ShareInviteDto {
  @ApiProperty({ description: 'Invite ID' })
  id!: string;

  @ApiProperty({ description: 'Email address the invite was sent to' })
  email!: string;

  @ApiProperty({ description: 'Whether the invite has been accepted' })
  accepted!: boolean;

  @ApiPropertyOptional({ description: 'When the invite was accepted (if accepted)' })
  acceptedAt?: string | null;

  @ApiProperty({ description: 'When the invite expires' })
  expiresAt!: string;

  @ApiProperty({ description: 'When the invite was created' })
  createdAt!: string;
}

export class DeviceSharesResponseDto {
  @ApiProperty({ description: 'Device ID' })
  deviceId!: string;

  @ApiProperty({
    description: 'List of users with shared access',
    type: [ShareUserDto],
  })
  sharedUsers!: ShareUserDto[];

  @ApiProperty({
    description: 'List of pending invites',
    type: [ShareInviteDto],
  })
  pendingInvites!: ShareInviteDto[];
}

export class ShareInviteCreatedDto {
  @ApiProperty({ description: 'Invite ID' })
  id!: string;

  @ApiProperty({ description: 'Email address the invite was sent to' })
  email!: string;

  @ApiProperty({ description: 'When the invite expires' })
  expiresAt!: string;
}

export class AcceptShareResultDto {
  @ApiProperty({ description: 'Device ID that was shared' })
  deviceId!: string;

  @ApiProperty({ description: 'Device display name' })
  deviceName!: string;

  @ApiProperty({ description: 'Success message' })
  message!: string;
}
