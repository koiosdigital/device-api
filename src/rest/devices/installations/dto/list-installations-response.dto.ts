import { ApiProperty } from '@nestjs/swagger';

export class InstallationListItemDto {
  @ApiProperty({
    description: 'Installation unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'App identifier',
    example: 'weather',
  })
  appId!: string;

  @ApiProperty({
    description: 'Whether the installation is enabled',
    example: true,
  })
  enabled!: boolean;

  @ApiProperty({
    description: 'Sort order for display rotation',
    example: 0,
  })
  sortOrder!: number;
}
