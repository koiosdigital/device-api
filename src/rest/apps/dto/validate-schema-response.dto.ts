import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ValidationErrorDto {
  @ApiProperty({ description: 'Field identifier that failed validation', example: 'city' })
  field!: string;

  @ApiProperty({ description: 'Human readable error message', example: 'City is required' })
  message!: string;

  @ApiProperty({ description: 'Machine readable error code', example: 'required' })
  code!: string;
}

export class ValidateSchemaResponseDto {
  @ApiProperty({ description: 'Whether the configuration passed validation', example: true })
  valid!: boolean;

  @ApiPropertyOptional({
    description: 'List of validation errors, if any',
    type: () => [ValidationErrorDto],
  })
  errors?: ValidationErrorDto[];

  @ApiProperty({
    description: 'Normalized configuration returned by the renderer',
    type: 'object',
    additionalProperties: true,
    example: { city: 'seattle', units: 'imperial' },
  })
  normalized_config!: Record<string, unknown>;
}
