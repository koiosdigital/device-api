import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  Min,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InstallationConfigInputDto } from './create-installation.dto';

export class UpdateInstallationDto {
  @ApiPropertyOptional({
    description: 'Installation configuration',
    type: InstallationConfigInputDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => InstallationConfigInputDto)
  config?: InstallationConfigInputDto;

  @ApiPropertyOptional({
    description: 'Whether the installation is enabled',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the user skipped this installation',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  skippedByUser?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the user pinned this installation',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  pinnedByUser?: boolean;

  @ApiPropertyOptional({
    description: 'Display time in seconds',
    example: 15,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayTime?: number;

  @ApiPropertyOptional({
    description: 'Sort order for display rotation',
    example: 0,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
