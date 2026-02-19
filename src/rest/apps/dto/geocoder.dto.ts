import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Max, Min } from 'class-validator';

export class GeocoderRequestDto {
  @ApiProperty({ description: 'Latitude coordinate', example: 40.6781784 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @ApiProperty({ description: 'Longitude coordinate', example: -73.9441579 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;
}
