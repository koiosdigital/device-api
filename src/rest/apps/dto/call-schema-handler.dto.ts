import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

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
}

export class CallSchemaHandlerResponseDto {
  @ApiProperty({
    description: 'Raw handler response payload',
    example: '{"results":["Seattle","Portland"]}',
  })
  result!: string;
}
