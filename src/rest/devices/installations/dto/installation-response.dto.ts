import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InstallationConfigDto {
  @ApiProperty({
    description: 'App identifier',
    example: 'weather',
  })
  app_id!: string;

  @ApiProperty({
    description: 'App configuration parameters',
    type: 'object',
    additionalProperties: true,
    example: { city: 'seattle', units: 'imperial' },
  })
  params!: Record<string, unknown>;
}

export class InstallationResponseDto {
  @ApiProperty({
    description: 'Installation unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'Device identifier this installation belongs to',
    example: 'dev_abc123',
  })
  deviceId!: string;

  @ApiProperty({
    description: 'App display name',
    example: 'Weather',
  })
  appName!: string;

  @ApiProperty({
    description: 'Whether the installation is enabled',
    example: true,
  })
  enabled!: boolean;

  @ApiProperty({
    description: 'Whether the user skipped this installation',
    example: false,
  })
  skippedByUser!: boolean;

  @ApiProperty({
    description: 'Whether the server skipped this installation (e.g., render errors)',
    example: false,
  })
  skippedByServer!: boolean;

  @ApiProperty({
    description: 'Whether the user pinned this installation',
    example: false,
  })
  pinnedByUser!: boolean;

  @ApiProperty({
    description: 'Display time in seconds',
    example: 15,
  })
  displayTime!: number;

  @ApiProperty({
    description: 'Sort order for display rotation',
    example: 0,
  })
  sortOrder!: number;

  @ApiProperty({
    description: 'Timestamp when created',
    type: String,
    format: 'date-time',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Timestamp when last updated',
    type: String,
    format: 'date-time',
  })
  updatedAt!: string;

  @ApiPropertyOptional({
    description: 'Installation configuration (only included in single GET)',
    type: InstallationConfigDto,
  })
  config?: InstallationConfigDto;
}
