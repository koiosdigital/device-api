import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsObject,
  IsBoolean,
  IsInt,
  Min,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class InstallationConfigInputDto {
  @ApiProperty({
    description: 'App identifier',
    example: 'weather',
  })
  @IsString()
  app_id!: string;

  @ApiProperty({
    description: 'App configuration parameters',
    type: 'object',
    additionalProperties: true,
    example: { city: 'seattle', units: 'imperial' },
  })
  @IsObject()
  params!: Record<string, unknown>;
}

export class CreateInstallationDto {
  @ApiProperty({
    description: 'Installation configuration',
    type: InstallationConfigInputDto,
  })
  @ValidateNested()
  @Type(() => InstallationConfigInputDto)
  config!: InstallationConfigInputDto;

  @ApiPropertyOptional({
    description: 'Whether the installation is enabled',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Display time in seconds',
    example: 15,
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayTime?: number;

  @ApiPropertyOptional({
    description: 'Sort order for display rotation',
    example: 0,
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
