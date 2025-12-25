import { ApiProperty } from '@nestjs/swagger';

export class RenderResultDto {
  @ApiProperty({ description: 'Renderer result type identifier', example: 'render' })
  type!: string;

  @ApiProperty({ description: 'Render job UUID', example: '4f252578-6f18-4ffd-8a69-2d4eb46c29ea' })
  uuid!: string;

  @ApiProperty({
    description: 'Optional device identifier used for logging',
    example: 'device_123',
    required: false,
  })
  device_id?: string;

  @ApiProperty({ description: 'App identifier that produced the render', example: 'weather' })
  app_id!: string;

  @ApiProperty({
    description: 'Base64 encoded WebP payload',
    example: 'UklGRjYAAABXRUJQVlA4WAoAAAAQAAAAMgAA...',
  })
  render_output!: string;

  @ApiProperty({
    description: 'Timestamp when rendering completed',
    example: '2024-01-01T12:00:00.000Z',
  })
  processed_at!: string;
}

export class RenderResponseDto {
  @ApiProperty({ description: 'Renderer output metadata', type: () => RenderResultDto })
  result!: RenderResultDto;

  @ApiProperty({
    description: 'Normalized configuration returned by the renderer',
    type: 'object',
    additionalProperties: true,
    example: { city: 'seattle', units: 'imperial' },
  })
  normalized_config!: Record<string, unknown>;
}
