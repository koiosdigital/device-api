import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
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
import { NemotoScheduleActionType } from '@/generated/prisma/enums';
import { NEMOTO_FLAP_MAX, NEMOTO_FLAP_MIN } from '@/shared/nemoto-flaps';

export class NemotoScheduleActionDto {
  @ApiProperty({
    description: 'Action to perform when the schedule fires',
    enum: NemotoScheduleActionType,
    enumName: 'NemotoScheduleActionType',
  })
  @IsEnum(NemotoScheduleActionType)
  type!: NemotoScheduleActionType;

  @ApiPropertyOptional({
    description: 'Preset id for DISPLAY_PRESET actions',
    example: 1,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  presetId?: number;

  @ApiPropertyOptional({
    description: 'Flap id for DISPLAY_SOLID actions (0-63)',
    example: 57,
    minimum: NEMOTO_FLAP_MIN,
    maximum: NEMOTO_FLAP_MAX,
  })
  @IsOptional()
  @IsInt()
  @Min(NEMOTO_FLAP_MIN)
  @Max(NEMOTO_FLAP_MAX)
  flap?: number;
}

export class NemotoScheduleResponseDto {
  @ApiProperty({ description: 'Device-local schedule id (uint32 sync key)', example: 1 })
  scheduleId!: number;

  @ApiProperty({ description: 'Schedule name', example: 'Morning greeting' })
  name!: string;

  @ApiProperty({ description: 'Cron expression', example: '0 9 * * 1-5' })
  cron!: string;

  @ApiProperty({ description: 'Whether the schedule is enabled', example: true })
  enabled!: boolean;

  @ApiProperty({ description: 'Whether the action obeys quiet hours', example: true })
  obeyQuietHours!: boolean;

  @ApiProperty({
    description: 'Action performed when the schedule fires',
    type: NemotoScheduleActionDto,
  })
  action!: NemotoScheduleActionDto;

  @ApiProperty({
    description: 'Last-writer-wins conflict timestamp (ISO 8601)',
    type: String,
    format: 'date-time',
  })
  syncedAt!: string;
}

export class CreateNemotoScheduleDto {
  @ApiProperty({
    description: 'Schedule name',
    example: 'Morning greeting',
    minLength: 1,
    maxLength: 64,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name!: string;

  @ApiProperty({
    description: 'Cron expression',
    example: '0 9 * * 1-5',
    minLength: 1,
    maxLength: 128,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  cron!: string;

  @ApiPropertyOptional({
    description: 'Whether the schedule is enabled',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the action obeys quiet hours',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  obeyQuietHours?: boolean;

  @ApiProperty({
    description: 'Action performed when the schedule fires',
    type: NemotoScheduleActionDto,
  })
  @ValidateNested()
  @Type(() => NemotoScheduleActionDto)
  action!: NemotoScheduleActionDto;
}

export class UpdateNemotoScheduleDto {
  @ApiPropertyOptional({
    description: 'Schedule name',
    example: 'Morning greeting',
    minLength: 1,
    maxLength: 64,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name?: string;

  @ApiPropertyOptional({
    description: 'Cron expression',
    example: '0 9 * * 1-5',
    minLength: 1,
    maxLength: 128,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  cron?: string;

  @ApiPropertyOptional({ description: 'Whether the schedule is enabled', example: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Whether the action obeys quiet hours', example: true })
  @IsOptional()
  @IsBoolean()
  obeyQuietHours?: boolean;

  @ApiPropertyOptional({
    description: 'Action performed when the schedule fires',
    type: NemotoScheduleActionDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => NemotoScheduleActionDto)
  action?: NemotoScheduleActionDto;
}
