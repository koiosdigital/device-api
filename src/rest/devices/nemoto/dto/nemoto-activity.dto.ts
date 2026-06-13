import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, Max, Min } from 'class-validator';
import { NemotoActivityKind } from '@/generated/prisma/enums';

export class NemotoActivityEventDto {
  @ApiProperty({ description: 'Event id', example: '123e4567-e89b-12d3-a456-426614174000' })
  id!: string;

  @ApiProperty({
    description: 'Device-reported event time (ISO 8601)',
    type: String,
    format: 'date-time',
  })
  ts!: string;

  @ApiProperty({
    description: 'Event kind',
    enum: NemotoActivityKind,
    enumName: 'NemotoActivityKind',
  })
  kind!: NemotoActivityKind;

  @ApiProperty({
    description: 'Event payload (shape depends on kind)',
    type: 'object',
    additionalProperties: true,
    example: { presetId: 1, presetName: 'Welcome', source: 'cloud' },
  })
  payload!: Record<string, unknown>;
}

export class ListNemotoActivityQueryDto {
  @ApiPropertyOptional({
    description: 'Max events to return',
    example: 50,
    minimum: 1,
    maximum: 200,
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Return only events strictly before this time (ISO 8601) for cursor paging',
    type: String,
    format: 'date-time',
  })
  @IsOptional()
  @IsISO8601()
  before?: string;
}
