import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  NEMOTO_FLAP_MAX,
  NEMOTO_FLAP_MIN,
  NEMOTO_GRID_MAX_HEIGHT,
  NEMOTO_GRID_MAX_WIDTH,
  NEMOTO_PRESET_MAX_NAME_LEN,
} from '@/shared/nemoto-flaps';

// Flaps are a 2D grid (rows × columns) of flap ids 0-63, row-major — the same
// shape the firmware's local /api/presets uses. Deep validation (rectangular,
// in-range, within grid bounds) happens in the service.
const FLAPS_SCHEMA = {
  description: 'Flap grid as rows of columns; each cell is a flap id (0-63)',
  type: 'array',
  items: {
    type: 'array',
    items: { type: 'integer', minimum: NEMOTO_FLAP_MIN, maximum: NEMOTO_FLAP_MAX },
  },
  example: [
    [0, 1, 2],
    [26, 27, 28],
  ],
} as const;

export class NemotoPresetListItemDto {
  @ApiProperty({ description: 'Device-local preset id (uint32 sync key)', example: 1 })
  presetId!: number;

  @ApiProperty({ description: 'Preset name', example: 'Welcome' })
  name!: string;

  @ApiProperty({ description: 'Grid width in cells', example: 22 })
  width!: number;

  @ApiProperty({ description: 'Grid height in cells', example: 6 })
  height!: number;

  @ApiProperty({
    description: 'Last-writer-wins conflict timestamp (ISO 8601)',
    type: String,
    format: 'date-time',
  })
  syncedAt!: string;
}

export class NemotoPresetResponseDto extends NemotoPresetListItemDto {
  @ApiProperty(FLAPS_SCHEMA)
  flaps!: number[][];
}

export class CreateNemotoPresetDto {
  @ApiProperty({
    description: 'Preset name',
    example: 'Welcome',
    minLength: 1,
    maxLength: NEMOTO_PRESET_MAX_NAME_LEN,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(NEMOTO_PRESET_MAX_NAME_LEN)
  name!: string;

  @ApiProperty(FLAPS_SCHEMA)
  @IsArray()
  flaps!: number[][];
}

export class UpdateNemotoPresetDto {
  @ApiPropertyOptional({
    description: 'Preset name',
    example: 'Welcome',
    minLength: 1,
    maxLength: NEMOTO_PRESET_MAX_NAME_LEN,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(NEMOTO_PRESET_MAX_NAME_LEN)
  name?: string;

  @ApiPropertyOptional(FLAPS_SCHEMA)
  @IsOptional()
  @IsArray()
  flaps?: number[][];
}

// Re-exported for service-side bounds checks.
export const NEMOTO_PRESET_LIMITS = {
  maxWidth: NEMOTO_GRID_MAX_WIDTH,
  maxHeight: NEMOTO_GRID_MAX_HEIGHT,
  flapMin: NEMOTO_FLAP_MIN,
  flapMax: NEMOTO_FLAP_MAX,
} as const;
