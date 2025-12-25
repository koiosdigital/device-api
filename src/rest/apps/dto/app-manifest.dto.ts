import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AppManifestDto {
  @ApiProperty({ description: 'Unique app identifier', example: 'weather' })
  id!: string;

  @ApiProperty({ description: 'Display name shown in the catalog', example: 'Weather' })
  name!: string;

  @ApiProperty({ description: 'Short summary of the app', example: 'Local weather on your Matrx' })
  summary!: string;

  @ApiProperty({
    description: 'Long form description',
    example: 'Displays the current forecast, highs, lows, and alerts.',
  })
  description!: string;

  @ApiProperty({ description: 'App author', example: 'Koios Labs' })
  author!: string;

  @ApiProperty({ description: 'Primary .star filename', example: 'weather.star' })
  fileName!: string;

  @ApiProperty({ description: 'Internal package name', example: 'com.koios.weather' })
  packageName!: string;

  @ApiPropertyOptional({
    description: 'Absolute path to the app directory',
    example: '/apps/weather',
  })
  directoryPath?: string;

  @ApiPropertyOptional({
    description: 'Absolute path to the entry .star file',
    example: '/apps/weather/weather.star',
  })
  starFilePath?: string;
}
