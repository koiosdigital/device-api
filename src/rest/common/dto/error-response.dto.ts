import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 400,
  })
  statusCode!: number;

  @ApiProperty({
    description: 'Error type/code',
    example: 'BAD_REQUEST',
  })
  error!: string;

  @ApiProperty({
    description: 'Human-readable error message',
    example: 'Invalid request parameters',
  })
  message!: string;

  @ApiPropertyOptional({
    description: 'Detailed validation errors or additional context',
    type: 'array',
    items: { type: 'string' },
    example: ['field must be a string', 'value is required'],
  })
  details?: string[];

  @ApiPropertyOptional({
    description: 'Request path that caused the error',
    example: '/v1/devices/abc123',
  })
  path?: string;

  @ApiPropertyOptional({
    description: 'Timestamp when the error occurred',
    example: '2025-12-26T12:00:00.000Z',
  })
  timestamp?: string;
}
