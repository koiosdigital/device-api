import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@/generated/prisma/client';
import { NemotoCycleType } from '@/generated/prisma/enums';
import {
  prisma,
  publishDeviceMessage,
  readNemotoLiveState,
  notifyNemotoConfigUpdate,
  notifyNemotoPresetUpsert,
  notifyNemotoPresetDelete,
  notifyNemotoScheduleUpsert,
  notifyNemotoScheduleDelete,
} from '@/shared/utils';
import { NEMOTO_GRID_MAX_HEIGHT, NEMOTO_GRID_MAX_WIDTH } from '@/shared/nemoto-flaps';
import type {
  NemotoConfigResponseDto,
  UpdateNemotoConfigDto,
  NemotoQuietWindowDto,
  NemotoPresetListItemDto,
  NemotoPresetResponseDto,
  CreateNemotoPresetDto,
  UpdateNemotoPresetDto,
  NemotoScheduleResponseDto,
  CreateNemotoScheduleDto,
  UpdateNemotoScheduleDto,
  NemotoLiveStateDto,
  NemotoActivityEventDto,
  ListNemotoActivityQueryDto,
  ShowPresetCommandDto,
  DisplayCellCommandDto,
  DisplayClearCommandDto,
  RunScheduleNowCommandDto,
  CommandDispatchResultDto,
} from './dto';

@Injectable()
export class NemotoService {
  // ---------------------------------------------------------------------------
  // Config (single document, last-writer-wins). `deviceName` is sourced from /
  // written to DeviceSettings.displayName so there is one source of truth.
  // ---------------------------------------------------------------------------

  async getConfig(deviceId: string): Promise<NemotoConfigResponseDto> {
    const [config, settings] = await Promise.all([
      prisma.nemotoConfig.findUnique({ where: { deviceId } }),
      prisma.deviceSettings.findUnique({ where: { deviceId }, select: { displayName: true } }),
    ]);

    const deviceName = settings?.displayName ?? deviceId;

    if (!config) {
      // No config persisted yet — return defaults (matches schema defaults).
      return {
        deviceName,
        bootPresetId: 0,
        defaultSpeed: 0,
        defaultAccel: 0,
        autoDiscoverSec: 0,
        displayEffectId: '',
        displayDelayMs: 0,
        cycleType: NemotoCycleType.PARTIAL,
        quietWindows: [],
        syncedAt: new Date(0).toISOString(),
      };
    }

    return this.mapConfig(config, deviceName);
  }

  async updateConfig(
    deviceId: string,
    dto: UpdateNemotoConfigDto
  ): Promise<NemotoConfigResponseDto> {
    const now = new Date();

    const data: Prisma.NemotoConfigUncheckedUpdateInput & Prisma.NemotoConfigUncheckedCreateInput =
      {
        deviceId,
        syncedAt: now,
        ...(dto.bootPresetId !== undefined && { bootPresetId: dto.bootPresetId }),
        ...(dto.defaultSpeed !== undefined && { defaultSpeed: dto.defaultSpeed }),
        ...(dto.defaultAccel !== undefined && { defaultAccel: dto.defaultAccel }),
        ...(dto.autoDiscoverSec !== undefined && { autoDiscoverSec: dto.autoDiscoverSec }),
        ...(dto.displayEffectId !== undefined && { displayEffectId: dto.displayEffectId }),
        ...(dto.displayDelayMs !== undefined && { displayDelayMs: dto.displayDelayMs }),
        ...(dto.cycleType !== undefined && { cycleType: dto.cycleType }),
        ...(dto.quietWindows !== undefined && {
          quietWindows: dto.quietWindows as unknown as Prisma.InputJsonValue,
        }),
      };

    const config = await prisma.nemotoConfig.upsert({
      where: { deviceId },
      create: data,
      update: data,
    });

    // deviceName is the device display name — keep it in DeviceSettings.
    if (dto.deviceName !== undefined) {
      await prisma.deviceSettings.upsert({
        where: { deviceId },
        create: { deviceId, displayName: dto.deviceName },
        update: { displayName: dto.deviceName },
      });
    }

    await notifyNemotoConfigUpdate(deviceId);

    const settings = await prisma.deviceSettings.findUnique({
      where: { deviceId },
      select: { displayName: true },
    });
    return this.mapConfig(config, settings?.displayName ?? deviceId);
  }

  // ---------------------------------------------------------------------------
  // Presets
  // ---------------------------------------------------------------------------

  async listPresets(deviceId: string): Promise<NemotoPresetListItemDto[]> {
    const presets = await prisma.nemotoPreset.findMany({
      where: { deviceId, deletedAt: null },
      orderBy: { presetId: 'asc' },
      select: { presetId: true, name: true, width: true, height: true, syncedAt: true },
    });
    return presets.map((p) => ({
      presetId: p.presetId,
      name: p.name,
      width: p.width,
      height: p.height,
      syncedAt: p.syncedAt.toISOString(),
    }));
  }

  async getPreset(deviceId: string, presetId: number): Promise<NemotoPresetResponseDto> {
    const preset = await prisma.nemotoPreset.findFirst({
      where: { deviceId, presetId, deletedAt: null },
    });
    if (!preset) {
      throw new NotFoundException(`Preset ${presetId} not found`);
    }
    return this.mapPreset(preset);
  }

  async createPreset(
    deviceId: string,
    dto: CreateNemotoPresetDto
  ): Promise<NemotoPresetResponseDto> {
    const { bytes, width, height } = this.packFlaps(dto.flaps);

    // Allocate the next device-local id atomically. Tombstoned ids are counted
    // so a deleted preset's id is never reused.
    const preset = await prisma.$transaction(async (tx) => {
      const max = await tx.nemotoPreset.aggregate({
        where: { deviceId },
        _max: { presetId: true },
      });
      const presetId = (max._max.presetId ?? 0) + 1;
      return tx.nemotoPreset.create({
        data: {
          deviceId,
          presetId,
          name: dto.name,
          width,
          height,
          flaps: bytes,
          syncedAt: new Date(),
        },
      });
    });

    await notifyNemotoPresetUpsert(deviceId, preset.presetId);
    return this.mapPreset(preset);
  }

  async updatePreset(
    deviceId: string,
    presetId: number,
    dto: UpdateNemotoPresetDto
  ): Promise<NemotoPresetResponseDto> {
    const existing = await prisma.nemotoPreset.findFirst({
      where: { deviceId, presetId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException(`Preset ${presetId} not found`);
    }

    const data: Prisma.NemotoPresetUpdateInput = { syncedAt: new Date() };
    if (dto.name !== undefined) {
      data.name = dto.name;
    }
    if (dto.flaps !== undefined) {
      const { bytes, width, height } = this.packFlaps(dto.flaps);
      data.flaps = bytes;
      data.width = width;
      data.height = height;
    }

    const preset = await prisma.nemotoPreset.update({
      where: { id: existing.id },
      data,
    });

    await notifyNemotoPresetUpsert(deviceId, presetId);
    return this.mapPreset(preset);
  }

  async deletePreset(deviceId: string, presetId: number): Promise<void> {
    const existing = await prisma.nemotoPreset.findFirst({
      where: { deviceId, presetId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException(`Preset ${presetId} not found`);
    }

    // Soft-delete (tombstone) so digest-then-diff sync can propagate the delete.
    const now = new Date();
    await prisma.nemotoPreset.update({
      where: { id: existing.id },
      data: { deletedAt: now, syncedAt: now },
    });

    await notifyNemotoPresetDelete(deviceId, presetId);
  }

  // ---------------------------------------------------------------------------
  // Schedules
  // ---------------------------------------------------------------------------

  async listSchedules(deviceId: string): Promise<NemotoScheduleResponseDto[]> {
    const schedules = await prisma.nemotoSchedule.findMany({
      where: { deviceId, deletedAt: null },
      orderBy: { scheduleId: 'asc' },
    });
    return schedules.map((s) => this.mapSchedule(s));
  }

  async getSchedule(deviceId: string, scheduleId: number): Promise<NemotoScheduleResponseDto> {
    const schedule = await prisma.nemotoSchedule.findFirst({
      where: { deviceId, scheduleId, deletedAt: null },
    });
    if (!schedule) {
      throw new NotFoundException(`Schedule ${scheduleId} not found`);
    }
    return this.mapSchedule(schedule);
  }

  async createSchedule(
    deviceId: string,
    dto: CreateNemotoScheduleDto
  ): Promise<NemotoScheduleResponseDto> {
    const schedule = await prisma.$transaction(async (tx) => {
      const max = await tx.nemotoSchedule.aggregate({
        where: { deviceId },
        _max: { scheduleId: true },
      });
      const scheduleId = (max._max.scheduleId ?? 0) + 1;
      return tx.nemotoSchedule.create({
        data: {
          deviceId,
          scheduleId,
          name: dto.name,
          cron: dto.cron,
          enabled: dto.enabled ?? true,
          obeyQuietHours: dto.obeyQuietHours ?? true,
          actionType: dto.action.type,
          actionPresetId: dto.action.presetId ?? 0,
          actionFlap: dto.action.flap ?? 0,
          syncedAt: new Date(),
        },
      });
    });

    await notifyNemotoScheduleUpsert(deviceId, schedule.scheduleId);
    return this.mapSchedule(schedule);
  }

  async updateSchedule(
    deviceId: string,
    scheduleId: number,
    dto: UpdateNemotoScheduleDto
  ): Promise<NemotoScheduleResponseDto> {
    const existing = await prisma.nemotoSchedule.findFirst({
      where: { deviceId, scheduleId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException(`Schedule ${scheduleId} not found`);
    }

    const schedule = await prisma.nemotoSchedule.update({
      where: { id: existing.id },
      data: {
        syncedAt: new Date(),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.cron !== undefined && { cron: dto.cron }),
        ...(dto.enabled !== undefined && { enabled: dto.enabled }),
        ...(dto.obeyQuietHours !== undefined && { obeyQuietHours: dto.obeyQuietHours }),
        ...(dto.action !== undefined && {
          actionType: dto.action.type,
          actionPresetId: dto.action.presetId ?? 0,
          actionFlap: dto.action.flap ?? 0,
        }),
      },
    });

    await notifyNemotoScheduleUpsert(deviceId, scheduleId);
    return this.mapSchedule(schedule);
  }

  async deleteSchedule(deviceId: string, scheduleId: number): Promise<void> {
    const existing = await prisma.nemotoSchedule.findFirst({
      where: { deviceId, scheduleId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException(`Schedule ${scheduleId} not found`);
    }

    const now = new Date();
    await prisma.nemotoSchedule.update({
      where: { id: existing.id },
      data: { deletedAt: now, syncedAt: now },
    });

    await notifyNemotoScheduleDelete(deviceId, scheduleId);
  }

  // ---------------------------------------------------------------------------
  // Live state (ephemeral, from Redis)
  // ---------------------------------------------------------------------------

  async getLiveState(deviceId: string): Promise<NemotoLiveStateDto> {
    const live = await readNemotoLiveState(deviceId);
    if (!live) {
      return { system: null, setup: null, fleet: null, ota: null, at: null };
    }
    return live as NemotoLiveStateDto;
  }

  // ---------------------------------------------------------------------------
  // Activity timeline
  // ---------------------------------------------------------------------------

  async listActivity(
    deviceId: string,
    query: ListNemotoActivityQueryDto
  ): Promise<NemotoActivityEventDto[]> {
    const events = await prisma.nemotoActivityEvent.findMany({
      where: {
        deviceId,
        ...(query.before && { ts: { lt: new Date(query.before) } }),
      },
      orderBy: { ts: 'desc' },
      take: query.limit ?? 50,
    });
    return events.map((e) => ({
      id: e.id,
      ts: e.ts.toISOString(),
      kind: e.kind,
      payload: (e.payload ?? {}) as Record<string, unknown>,
    }));
  }

  // ---------------------------------------------------------------------------
  // Remote commands (cloud→device, fire-and-forget via Redis)
  // ---------------------------------------------------------------------------

  async showPreset(deviceId: string, dto: ShowPresetCommandDto): Promise<CommandDispatchResultDto> {
    return this.dispatch(deviceId, {
      type: 'nemoto_show_preset',
      presetId: dto.presetId,
      forceQuiet: dto.forceQuiet ?? false,
    });
  }

  async displayCell(
    deviceId: string,
    dto: DisplayCellCommandDto
  ): Promise<CommandDispatchResultDto> {
    return this.dispatch(deviceId, {
      type: 'nemoto_display_cell',
      x: dto.x,
      y: dto.y,
      flap: dto.flap,
      forceQuiet: dto.forceQuiet ?? false,
    });
  }

  async displayClear(
    deviceId: string,
    dto: DisplayClearCommandDto
  ): Promise<CommandDispatchResultDto> {
    return this.dispatch(deviceId, {
      type: 'nemoto_display_clear',
      forceQuiet: dto.forceQuiet ?? false,
    });
  }

  async runScheduleNow(
    deviceId: string,
    dto: RunScheduleNowCommandDto
  ): Promise<CommandDispatchResultDto> {
    return this.dispatch(deviceId, {
      type: 'nemoto_run_schedule',
      scheduleId: dto.scheduleId,
      forceQuiet: dto.forceQuiet ?? false,
    });
  }

  async reboot(deviceId: string): Promise<CommandDispatchResultDto> {
    return this.dispatch(deviceId, { type: 'nemoto_reboot' });
  }

  private async dispatch(
    deviceId: string,
    message: Record<string, unknown>
  ): Promise<CommandDispatchResultDto> {
    const subscribers = await publishDeviceMessage(deviceId, message);
    return { delivered: subscribers > 0 };
  }

  // ---------------------------------------------------------------------------
  // Flap grid <-> packed bytes (row-major), mirroring the firmware layout.
  // ---------------------------------------------------------------------------

  private packFlaps(flaps: number[][]): {
    bytes: Uint8Array<ArrayBuffer>;
    width: number;
    height: number;
  } {
    if (!Array.isArray(flaps) || flaps.length < 1) {
      throw new BadRequestException('flaps must be a non-empty 2D array');
    }
    const height = flaps.length;
    if (height > NEMOTO_GRID_MAX_HEIGHT) {
      throw new BadRequestException(`flaps height ${height} exceeds max ${NEMOTO_GRID_MAX_HEIGHT}`);
    }
    const width = flaps[0]?.length ?? 0;
    if (width < 1 || width > NEMOTO_GRID_MAX_WIDTH) {
      throw new BadRequestException(`flaps width must be 1-${NEMOTO_GRID_MAX_WIDTH}`);
    }

    const bytes = new Uint8Array(new ArrayBuffer(width * height));
    for (let y = 0; y < height; y++) {
      const row = flaps[y];
      if (!Array.isArray(row) || row.length !== width) {
        throw new BadRequestException('all flap rows must have the same length');
      }
      for (let x = 0; x < width; x++) {
        const v = row[x];
        if (!Number.isInteger(v) || v < 0 || v > 63) {
          throw new BadRequestException('each flap must be an integer in [0, 63]');
        }
        bytes[y * width + x] = v;
      }
    }
    return { bytes, width, height };
  }

  private unpackFlaps(flaps: Uint8Array, width: number, height: number): number[][] {
    const grid: number[][] = [];
    for (let y = 0; y < height; y++) {
      const row: number[] = [];
      for (let x = 0; x < width; x++) {
        row.push(flaps[y * width + x] ?? 0);
      }
      grid.push(row);
    }
    return grid;
  }

  // ---------------------------------------------------------------------------
  // Mappers
  // ---------------------------------------------------------------------------

  private mapConfig(
    config: {
      bootPresetId: number;
      defaultSpeed: number;
      defaultAccel: number;
      autoDiscoverSec: number;
      displayEffectId: string;
      displayDelayMs: number;
      cycleType: NemotoCycleType;
      quietWindows: unknown;
      syncedAt: Date;
    },
    deviceName: string
  ): NemotoConfigResponseDto {
    return {
      deviceName,
      bootPresetId: config.bootPresetId,
      defaultSpeed: config.defaultSpeed,
      defaultAccel: config.defaultAccel,
      autoDiscoverSec: config.autoDiscoverSec,
      displayEffectId: config.displayEffectId,
      displayDelayMs: config.displayDelayMs,
      cycleType: config.cycleType,
      quietWindows: (config.quietWindows ?? []) as NemotoQuietWindowDto[],
      syncedAt: config.syncedAt.toISOString(),
    };
  }

  private mapPreset(preset: {
    presetId: number;
    name: string;
    width: number;
    height: number;
    flaps: Uint8Array;
    syncedAt: Date;
  }): NemotoPresetResponseDto {
    return {
      presetId: preset.presetId,
      name: preset.name,
      width: preset.width,
      height: preset.height,
      flaps: this.unpackFlaps(preset.flaps, preset.width, preset.height),
      syncedAt: preset.syncedAt.toISOString(),
    };
  }

  private mapSchedule(schedule: {
    scheduleId: number;
    name: string;
    cron: string;
    enabled: boolean;
    obeyQuietHours: boolean;
    actionType: NemotoScheduleResponseDto['action']['type'];
    actionPresetId: number;
    actionFlap: number;
    syncedAt: Date;
  }): NemotoScheduleResponseDto {
    return {
      scheduleId: schedule.scheduleId,
      name: schedule.name,
      cron: schedule.cron,
      enabled: schedule.enabled,
      obeyQuietHours: schedule.obeyQuietHours,
      action: {
        type: schedule.actionType,
        presetId: schedule.actionPresetId,
        flap: schedule.actionFlap,
      },
      syncedAt: schedule.syncedAt.toISOString(),
    };
  }
}
