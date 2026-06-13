import { ApiProperty } from '@nestjs/swagger';

// Ephemeral live state read from Redis (nemoto:live:{deviceId}). These mirror
// the device→cloud proto messages; every block is nullable because the device
// may not have reported it since its last (re)connect.

export class NemotoSystemInfoDto {
  @ApiProperty({ example: '1.4.2' }) firmwareVersion!: string;
  @ApiProperty({ example: 'nemoto-rev-c' }) hwVariant!: string;
  @ApiProperty({ example: 'Lobby Board' }) deviceName!: string;
  @ApiProperty({ example: 'aa:bb:cc:dd:ee:ff' }) mac!: string;
  @ApiProperty({ example: '192.168.1.42' }) ip!: string;
  @ApiProperty({ example: 'nemoto-lobby' }) hostname!: string;
  @ApiProperty({ example: 'OfficeWiFi' }) wifiSsid!: string;
  @ApiProperty({ example: -54 }) wifiRssi!: number;
  @ApiProperty({ example: 86400 }) uptimeS!: number;
  @ApiProperty({ example: 102400 }) freeHeap!: number;
  @ApiProperty({ example: true }) timeSynced!: boolean;
  @ApiProperty({ example: 'America/Los_Angeles' }) timezone!: string;
}

export class NemotoSetupStatusDto {
  @ApiProperty({ description: 'Onboarding phase', example: 'NEMOTO_SETUP_PHASE_READY' })
  phase!: string;
  @ApiProperty({ example: 132 }) moduleCount!: number;
  @ApiProperty({ example: 132 }) assignedCount!: number;
  @ApiProperty({ example: 132 }) mappedCount!: number;
  @ApiProperty({ example: 132 }) homedCount!: number;
  @ApiProperty({ example: 22 }) gridWidth!: number;
  @ApiProperty({ example: 6 }) gridHeight!: number;
}

export class NemotoModuleFaultDto {
  @ApiProperty({ description: '6-byte module uuid (hex)', example: 'a1b2c3d4e5f6' }) uuid!: string;
  @ApiProperty({ description: 'Short id (0 if unassigned)', example: 41 }) shortId!: number;
  @ApiProperty({ description: 'Fault kind', example: 'NEMOTO_FAULT_KIND_STALL_ERROR' })
  kind!: string;
  @ApiProperty({ example: 42 }) tempC!: number;
  @ApiProperty({ example: 3 }) lastSeenSAgo!: number;
  @ApiProperty({ example: 'stall on column 4' }) detail!: string;
}

export class NemotoFleetSummaryDto {
  @ApiProperty({ example: 132 }) total!: number;
  @ApiProperty({ example: 132 }) assigned!: number;
  @ApiProperty({ example: 131 }) alive!: number;
  @ApiProperty({ example: 132 }) homed!: number;
  @ApiProperty({ example: 1 }) inError!: number;
  @ApiProperty({ example: 22 }) gridWidth!: number;
  @ApiProperty({ example: 6 }) gridHeight!: number;
  @ApiProperty({ example: 132 }) gridMapped!: number;
  @ApiProperty({ description: 'Only modules with an active fault', type: [NemotoModuleFaultDto] })
  faults!: NemotoModuleFaultDto[];
  @ApiProperty({ description: 'Unix seconds when generated', example: 1765400000 })
  generatedAt!: number;
}

export class NemotoOtaProgressDto {
  @ApiProperty({ example: 'NEMOTO_OTA_PHASE_FLASHING_MODULES' }) phase!: string;
  @ApiProperty({ example: 64 }) percent!: number;
  @ApiProperty({
    description: '6-byte module uuid (hex), set while flashing',
    example: 'a1b2c3d4e5f6',
  })
  currentModuleUuid!: string;
  @ApiProperty({ example: 84 }) modulesDone!: number;
  @ApiProperty({ example: 132 }) modulesTotal!: number;
  @ApiProperty({ example: '' }) errorDetail!: string;
  @ApiProperty({ example: '1.4.3' }) fwVersion!: string;
}

export class NemotoLiveStateDto {
  @ApiProperty({ type: NemotoSystemInfoDto, nullable: true })
  system!: NemotoSystemInfoDto | null;

  @ApiProperty({ type: NemotoSetupStatusDto, nullable: true })
  setup!: NemotoSetupStatusDto | null;

  @ApiProperty({ type: NemotoFleetSummaryDto, nullable: true })
  fleet!: NemotoFleetSummaryDto | null;

  @ApiProperty({ type: NemotoOtaProgressDto, nullable: true })
  ota!: NemotoOtaProgressDto | null;

  @ApiProperty({
    description: 'When the live state was last updated, or null if never reported',
    type: String,
    format: 'date-time',
    nullable: true,
  })
  at!: string | null;
}
