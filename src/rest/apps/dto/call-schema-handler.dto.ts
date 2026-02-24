import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CallSchemaHandlerRequestDto {
  @ApiProperty({ description: 'Handler to invoke', example: 'search_locations' })
  @IsString()
  @MaxLength(128)
  handler_name!: string;

  @ApiPropertyOptional({
    description: 'Serialized payload passed to the handler',
    example: '{"query":"Seattle"}',
  })
  @IsOptional()
  @IsString()
  data?: string;

  @ApiProperty({
    description: 'Current app configuration passed to handlers that accept a config argument',
    example: { location: '{"lat":"47.6","lng":"-122.3"}', color: '#FF0000' },
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  @IsObject()
  config!: Record<string, string>;
}

export class CallSchemaHandlerResponseDto {
  @ApiProperty({
    description: 'Raw handler response payload',
    example: '{"results":["Seattle","Portland"]}',
  })
  result!: string;
}
