import { ApiProperty } from '@nestjs/swagger';

export class ClaimTokenResponseDto {
  @ApiProperty({
    description: 'Short-lived JWT token for device claiming (valid for 10 minutes)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    type: String,
  })
  token!: string;

  @ApiProperty({
    description: 'Token expiration timestamp (Unix epoch in seconds)',
    example: 1735161127,
    type: Number,
  })
  expiresAt!: number;
}
