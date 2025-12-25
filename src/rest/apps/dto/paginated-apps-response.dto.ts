import { ApiProperty } from '@nestjs/swagger';
import { AppManifestDto } from './app-manifest.dto';

export class PaginationMetaDto {
  @ApiProperty({ description: 'Current page number', example: 1 })
  page!: number;

  @ApiProperty({ description: 'Number of items per page', example: 20 })
  limit!: number;

  @ApiProperty({ description: 'Total number of items', example: 45 })
  total!: number;

  @ApiProperty({ description: 'Total number of pages', example: 3 })
  totalPages!: number;

  @ApiProperty({ description: 'Whether there is a previous page', example: false })
  hasPrevious!: boolean;

  @ApiProperty({ description: 'Whether there is a next page', example: true })
  hasNext!: boolean;
}

export class PaginatedAppsResponseDto {
  @ApiProperty({
    description: 'Array of app manifests for current page',
    type: [AppManifestDto],
  })
  data!: AppManifestDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: PaginationMetaDto,
  })
  meta!: PaginationMetaDto;
}
