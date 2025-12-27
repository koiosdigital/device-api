import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetSkipStateDto {
  @ApiProperty({
    description: 'Whether to skip this installation',
    example: true,
  })
  @IsBoolean()
  skipped!: boolean;
}

export class SetPinStateDto {
  @ApiProperty({
    description: 'Whether to pin this installation (unpins any other pinned installation on the device)',
    example: true,
  })
  @IsBoolean()
  pinned!: boolean;
}

export class InstallationStateResponseDto {
  @ApiProperty({
    description: 'Installation UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'Whether this installation is skipped',
    example: false,
  })
  skippedByUser!: boolean;

  @ApiProperty({
    description: 'Whether this installation is pinned',
    example: true,
  })
  pinnedByUser!: boolean;
}
