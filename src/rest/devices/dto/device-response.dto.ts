import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeviceType, ClaimType } from '@/generated/prisma/enums';

// Type-specific settings DTOs
export class LanternSettingsDto {
  @ApiProperty({
    description: 'LED brightness level (0-255)',
    example: 255,
    type: Number,
    minimum: 0,
    maximum: 255,
  })
  brightness!: number;

  @ApiProperty({
    description: 'Hour when sleep mode starts (0-23)',
    example: 22,
    type: Number,
    minimum: 0,
    maximum: 23,
  })
  sleep_start!: number;

  @ApiProperty({
    description: 'Hour when sleep mode ends (0-23)',
    example: 7,
    type: Number,
    minimum: 0,
    maximum: 23,
  })
  sleep_end!: number;
}

export class MatrxSettingsDto {
  @ApiProperty({
    description: 'Whether the screen is enabled',
    example: true,
    type: Boolean,
  })
  screenEnabled!: boolean;

  @ApiProperty({
    description: 'Screen brightness level (0-255)',
    example: 128,
    type: Number,
    minimum: 0,
    maximum: 255,
  })
  screenBrightness!: number;

  @ApiProperty({
    description: 'Whether automatic brightness adjustment is enabled',
    example: false,
    type: Boolean,
  })
  autoBrightnessEnabled!: boolean;

  @ApiProperty({
    description: 'Lux threshold below which screen turns off',
    example: 5,
    type: Number,
    minimum: 0,
  })
  screenOffLux!: number;
}

// Base settings DTO with common fields
export class DeviceSettingsBaseDto {
  @ApiProperty({
    description: 'Display name for the device',
    example: 'Living Room Matrx',
    type: String,
  })
  displayName!: string;

  @ApiPropertyOptional({
    description: 'Device display width in pixels (read-only)',
    type: Number,
  })
  width?: number;

  @ApiPropertyOptional({
    description: 'Device display height in pixels (read-only)',
    type: Number,
  })
  height?: number;

  @ApiPropertyOptional({
    description: 'Whether device has a light sensor (read-only)',
    type: Boolean,
  })
  hasLightSensor?: boolean;
}

export class LanternDeviceSettingsDto extends DeviceSettingsBaseDto {
  @ApiPropertyOptional({
    description: 'Lantern-specific settings',
    type: () => LanternSettingsDto,
    nullable: true,
  })
  typeSettings!: LanternSettingsDto | null;
}

export class MatrxDeviceSettingsDto extends DeviceSettingsBaseDto {
  @ApiPropertyOptional({
    description: 'Matrx-specific settings',
    type: () => MatrxSettingsDto,
    nullable: true,
  })
  typeSettings!: MatrxSettingsDto | null;
}

// Base device response
class DeviceResponseBaseDto {
  @ApiProperty({
    description: 'Unique identifier for the device',
    example: 'dev_123abc',
    type: String,
  })
  id!: string;

  @ApiProperty({
    description: 'Whether the device is currently online',
    example: true,
    type: Boolean,
  })
  online!: boolean;

  @ApiProperty({
    description: 'User access level to this device',
    enum: ClaimType,
    enumName: 'ClaimType',
    example: ClaimType.OWNER,
  })
  accessLevel!: ClaimType;

  @ApiPropertyOptional({
    description: 'UUID of the installation currently being displayed on the device',
    example: '123e4567-e89b-12d3-a456-426614174000',
    type: String,
    nullable: true,
  })
  currentlyDisplayingInstallation!: string | null;

  @ApiProperty({
    description: 'Number of installations configured on this device',
    example: 5,
    type: Number,
  })
  installationCount!: number;

  @ApiProperty({
    description: 'Timestamp when the device was created',
    example: '2025-12-24T22:00:00.000Z',
    type: String,
    format: 'date-time',
  })
  createdAt!: string;

  @ApiProperty({
    description: 'Timestamp when the device was last updated',
    example: '2025-12-24T22:30:00.000Z',
    type: String,
    format: 'date-time',
  })
  updatedAt!: string;
}

// Discriminated device types
export class LanternDeviceResponseDto extends DeviceResponseBaseDto {
  @ApiProperty({
    description: 'Type of device',
    enum: ['LANTERN'],
    example: 'LANTERN',
  })
  type!: 'LANTERN';

  @ApiPropertyOptional({
    description: 'Device settings including display name and Lantern-specific configuration',
    type: () => LanternDeviceSettingsDto,
    nullable: true,
  })
  settings!: LanternDeviceSettingsDto | null;
}

export class MatrxDeviceResponseDto extends DeviceResponseBaseDto {
  @ApiProperty({
    description: 'Type of device',
    enum: ['MATRX'],
    example: 'MATRX',
  })
  type!: 'MATRX';

  @ApiPropertyOptional({
    description: 'Device settings including display name and Matrx-specific configuration',
    type: () => MatrxDeviceSettingsDto,
    nullable: true,
  })
  settings!: MatrxDeviceSettingsDto | null;
}

// Union type for API responses
export type DeviceResponseDto = LanternDeviceResponseDto | MatrxDeviceResponseDto;
