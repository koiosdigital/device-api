import { ApiProperty } from '@nestjs/swagger';
import { DeviceType } from '~/generated/prisma/enums';

export class DeviceSettingsDto {
  @ApiProperty({ type: String, example: 'Living Room Matrx' })
  displayName!: string;

  @ApiProperty({ type: Object, nullable: true, additionalProperties: true })
  typeSettings!: Record<string, unknown> | null;
}

export class DeviceResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ enum: DeviceType, enumName: 'DeviceType' })
  type!: DeviceType;

  @ApiProperty({ type: Boolean })
  online!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ type: () => DeviceSettingsDto, nullable: true })
  settings!: DeviceSettingsDto | null;
}
