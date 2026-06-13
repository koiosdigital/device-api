import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  NEMOTO_FLAP_MAX,
  NEMOTO_FLAP_MIN,
  NEMOTO_GRID_MAX_HEIGHT,
  NEMOTO_GRID_MAX_WIDTH,
} from '@/shared/nemoto-flaps';

export class ShowPresetCommandDto {
  @ApiProperty({ description: 'Preset id to display', example: 1, minimum: 0 })
  @IsInt()
  @Min(0)
  presetId!: number;

  @ApiPropertyOptional({ description: 'Bypass quiet hours', example: false, default: false })
  @IsOptional()
  @IsBoolean()
  forceQuiet?: boolean;
}

export class DisplayCellCommandDto {
  @ApiProperty({
    description: 'Column (0-based)',
    example: 3,
    minimum: 0,
    maximum: NEMOTO_GRID_MAX_WIDTH - 1,
  })
  @IsInt()
  @Min(0)
  @Max(NEMOTO_GRID_MAX_WIDTH - 1)
  x!: number;

  @ApiProperty({
    description: 'Row (0-based)',
    example: 1,
    minimum: 0,
    maximum: NEMOTO_GRID_MAX_HEIGHT - 1,
  })
  @IsInt()
  @Min(0)
  @Max(NEMOTO_GRID_MAX_HEIGHT - 1)
  y!: number;

  @ApiProperty({
    description: 'Flap id (0-63)',
    example: 57,
    minimum: NEMOTO_FLAP_MIN,
    maximum: NEMOTO_FLAP_MAX,
  })
  @IsInt()
  @Min(NEMOTO_FLAP_MIN)
  @Max(NEMOTO_FLAP_MAX)
  flap!: number;

  @ApiPropertyOptional({ description: 'Bypass quiet hours', example: false, default: false })
  @IsOptional()
  @IsBoolean()
  forceQuiet?: boolean;
}

export class DisplayClearCommandDto {
  @ApiPropertyOptional({ description: 'Bypass quiet hours', example: false, default: false })
  @IsOptional()
  @IsBoolean()
  forceQuiet?: boolean;
}

export class RunScheduleNowCommandDto {
  @ApiProperty({ description: 'Schedule id to run immediately', example: 1, minimum: 0 })
  @IsInt()
  @Min(0)
  scheduleId!: number;

  @ApiPropertyOptional({ description: 'Bypass quiet hours', example: false, default: false })
  @IsOptional()
  @IsBoolean()
  forceQuiet?: boolean;
}

export class CommandDispatchResultDto {
  @ApiProperty({
    description: 'Whether a connected device received the command (false ⇒ device offline)',
    example: true,
  })
  delivered!: boolean;
}
