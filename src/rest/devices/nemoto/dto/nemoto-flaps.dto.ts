import { ApiProperty } from '@nestjs/swagger';

export class NemotoFlapDefDto {
  @ApiProperty({ description: 'Flap id (0-63), the value stored in preset grids', example: 0 })
  id!: number;

  @ApiProperty({
    description: 'Flap category',
    enum: ['letter', 'digit', 'special', 'blank', 'color'],
    example: 'letter',
  })
  type!: string;

  @ApiProperty({ description: 'Canonical label', example: 'char_A' })
  label!: string;

  @ApiProperty({
    description: 'Displayed character, or null for color flaps',
    example: 'A',
    nullable: true,
  })
  glyph!: string | null;

  @ApiProperty({ description: '#RRGGBB for color flaps, else null', example: null, nullable: true })
  color!: string | null;
}

export class NemotoFlapsResponseDto {
  @ApiProperty({ description: 'The static flap set, indexed 0-63', type: [NemotoFlapDefDto] })
  flaps!: NemotoFlapDefDto[];

  @ApiProperty({ description: 'Number of flaps', example: 64 })
  count!: number;
}
