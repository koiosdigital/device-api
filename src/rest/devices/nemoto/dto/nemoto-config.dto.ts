import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { NemotoCycleType } from '@/generated/prisma/enums';

export class NemotoQuietWindowDto {
  @ApiProperty({
    description: 'Bitmask of active days (bit0 = Sunday … bit6 = Saturday)',
    example: 0b0111110,
    minimum: 0,
    maximum: 127,
  })
  @IsInt()
  @Min(0)
  @Max(127)
  dayMask!: number;

  @ApiProperty({ description: 'Start hour (0-23)', example: 22, minimum: 0, maximum: 23 })
  @IsInt()
  @Min(0)
  @Max(23)
  startHour!: number;

  @ApiProperty({ description: 'Start minute (0-59)', example: 0, minimum: 0, maximum: 59 })
  @IsInt()
  @Min(0)
  @Max(59)
  startMin!: number;

  @ApiProperty({ description: 'End hour (0-23)', example: 7, minimum: 0, maximum: 23 })
  @IsInt()
  @Min(0)
  @Max(23)
  endHour!: number;

  @ApiProperty({ description: 'End minute (0-59)', example: 30, minimum: 0, maximum: 59 })
  @IsInt()
  @Min(0)
  @Max(59)
  endMin!: number;

  @ApiProperty({ description: 'Whether this quiet window is active', example: true })
  @IsBoolean()
  enabled!: boolean;
}

export class NemotoConfigResponseDto {
  @ApiProperty({
    description: 'Friendly device name (mirror of the device display name)',
    example: 'Lobby Board',
  })
  deviceName!: string;

  @ApiProperty({ description: 'Preset shown on boot (0 = none)', example: 0 })
  bootPresetId!: number;

  @ApiProperty({ description: 'Default flap speed (flaps/sec, 0 = no override)', example: 0 })
  defaultSpeed!: number;

  @ApiProperty({ description: 'Default acceleration (steps/s^2)', example: 0 })
  defaultAccel!: number;

  @ApiProperty({ description: 'Auto-discovery interval in seconds (0 = off)', example: 0 })
  autoDiscoverSec!: number;

  @ApiProperty({ description: 'Display effect identifier', example: '' })
  displayEffectId!: string;

  @ApiProperty({ description: 'Inter-cell display delay in milliseconds', example: 0 })
  displayDelayMs!: number;

  @ApiProperty({
    description: 'Flap cycle behavior',
    enum: NemotoCycleType,
    enumName: 'NemotoCycleType',
  })
  cycleType!: NemotoCycleType;

  @ApiProperty({ description: 'Quiet-hours windows', type: [NemotoQuietWindowDto] })
  quietWindows!: NemotoQuietWindowDto[];

  @ApiProperty({
    description: 'Last-writer-wins conflict timestamp (ISO 8601)',
    type: String,
    format: 'date-time',
  })
  syncedAt!: string;
}

/**
 * Merge-update for the single config document. Provided fields overwrite the
 * stored value; omitted fields are left unchanged. `deviceName` is written to
 * the device's display name (single source of truth).
 */
export class UpdateNemotoConfigDto {
  @ApiPropertyOptional({
    description: 'Friendly device name (updates the device display name)',
    example: 'Lobby Board',
    minLength: 1,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  deviceName?: string;

  @ApiPropertyOptional({ description: 'Preset shown on boot (0 = none)', example: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  bootPresetId?: number;

  @ApiPropertyOptional({ description: 'Default flap speed (flaps/sec)', example: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  defaultSpeed?: number;

  @ApiPropertyOptional({ description: 'Default acceleration (steps/s^2)', example: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  defaultAccel?: number;

  @ApiPropertyOptional({ description: 'Auto-discovery interval (seconds)', example: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  autoDiscoverSec?: number;

  @ApiPropertyOptional({ description: 'Display effect identifier', example: '' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  displayEffectId?: string;

  @ApiPropertyOptional({ description: 'Inter-cell display delay (ms)', example: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayDelayMs?: number;

  @ApiPropertyOptional({
    description: 'Flap cycle behavior',
    enum: NemotoCycleType,
    enumName: 'NemotoCycleType',
  })
  @IsOptional()
  @IsEnum(NemotoCycleType)
  cycleType?: NemotoCycleType;

  @ApiPropertyOptional({
    description: 'Quiet-hours windows (replaces the full list)',
    type: [NemotoQuietWindowDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NemotoQuietWindowDto)
  quietWindows?: NemotoQuietWindowDto[];
}
