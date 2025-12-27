import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class BulkUpdateInstallationItemDto {
  @ApiProperty({
    description: 'Installation UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  id!: string;

  @ApiPropertyOptional({
    description: 'New sort order for the installation',
    example: 0,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({
    description: 'Display time in seconds (0 = use default)',
    example: 30,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayTime?: number;
}

export class BulkUpdateInstallationsDto {
  @ApiProperty({
    description: 'List of installations to update',
    type: [BulkUpdateInstallationItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkUpdateInstallationItemDto)
  installations!: BulkUpdateInstallationItemDto[];
}

export class BulkUpdateResultDto {
  @ApiProperty({
    description: 'Number of installations updated',
    example: 5,
  })
  updated!: number;
}
