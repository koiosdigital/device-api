import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({
    description: 'Overall health status of the service',
    example: 'ok',
    enum: ['ok', 'degraded'],
  })
  status!: string;

  @ApiProperty({
    description: 'ISO timestamp when the health check was performed',
    example: '2025-12-24T22:00:00.000Z',
    type: String,
    format: 'date-time',
  })
  timestamp!: string;

  @ApiProperty({
    description: 'Database connection status',
    example: 'up',
    enum: ['up', 'error'],
  })
  database!: string;
}
