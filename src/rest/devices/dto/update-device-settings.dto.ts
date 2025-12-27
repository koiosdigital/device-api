import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class LanternTypeSettingsDto {
  @ApiPropertyOptional({
    description: 'LED brightness level (0-255)',
    example: 255,
    minimum: 0,
    maximum: 255,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(255)
  brightness?: number;

  @ApiPropertyOptional({
    description: 'Hour when sleep mode starts (0-23)',
    example: 22,
    minimum: 0,
    maximum: 23,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  sleep_start?: number;

  @ApiPropertyOptional({
    description: 'Hour when sleep mode ends (0-23)',
    example: 7,
    minimum: 0,
    maximum: 23,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  sleep_end?: number;
}

export class MatrxTypeSettingsDto {
  @ApiPropertyOptional({
    description: 'Whether the screen is enabled',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  screenEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Screen brightness level (0-255)',
    example: 128,
    minimum: 0,
    maximum: 255,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(255)
  screenBrightness?: number;

  @ApiPropertyOptional({
    description: 'Whether automatic brightness adjustment is enabled',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  autoBrightnessEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Lux threshold below which screen turns off',
    example: 5,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  screenOffLux?: number;
}

// Discriminated union for update settings
export class UpdateLanternSettingsDto {
  @ApiProperty({
    description: 'Device type discriminator',
    enum: ['LANTERN'],
    example: 'LANTERN',
  })
  @IsIn(['LANTERN'])
  type!: 'LANTERN';

  @ApiPropertyOptional({
    description: 'Display name for the device',
    example: 'Living Room Lantern',
    minLength: 1,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  displayName?: string;

  @ApiPropertyOptional({
    description: 'Lantern-specific settings',
    type: LanternTypeSettingsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => LanternTypeSettingsDto)
  typeSettings?: LanternTypeSettingsDto;
}

export class UpdateMatrxSettingsDto {
  @ApiProperty({
    description: 'Device type discriminator',
    enum: ['MATRX'],
    example: 'MATRX',
  })
  @IsIn(['MATRX'])
  type!: 'MATRX';

  @ApiPropertyOptional({
    description: 'Display name for the device',
    example: 'Living Room Matrx',
    minLength: 1,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  displayName?: string;

  @ApiPropertyOptional({
    description: 'Matrx-specific settings',
    type: MatrxTypeSettingsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => MatrxTypeSettingsDto)
  typeSettings?: MatrxTypeSettingsDto;
}

// Union type for the unified endpoint
export type UpdateDeviceSettingsDto = UpdateLanternSettingsDto | UpdateMatrxSettingsDto;
