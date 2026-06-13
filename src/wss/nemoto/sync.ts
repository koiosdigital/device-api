// =============================================================================
// Nemoto bidirectional sync — proto <-> Postgres, plus live-state/activity
// ingestion. Pure data layer (no WebSocket I/O): builders return a fully-framed
// NemotoMessage for the caller to send; apply/ingest functions write the DB or
// Redis. The WSS dispatcher in handler.ts wires these to the socket.
//
// Conflict resolution follows the protocol: max(updated_at), ties to cloud.
// Flaps need no conversion here — proto bytes and the stored Bytes column are
// both row-major width*height grids.
// =============================================================================

import { create } from '@bufbuild/protobuf';
import {
  NemotoMessageSchema,
  PresetUpsertSchema,
  PresetSyncDiffSchema,
  PresetDeleteSchema,
  ScheduleUpsertSchema,
  ScheduleSyncDiffSchema,
  ScheduleDeleteSchema,
  NemotoScheduleActionSchema,
  NemotoConfigUpsertSchema,
  NemotoConfigRequestSchema,
  NemotoQuietWindowSchema,
  ShowPresetRequestSchema,
  DisplayCellRequestSchema,
  DisplayClearRequestSchema,
  RunScheduleNowRequestSchema,
  RebootRequestSchema,
  NemotoCycleType,
  NemotoScheduleActionType,
  NemotoSetupPhase,
  NemotoFaultKind,
  NemotoOtaPhase,
  type NemotoMessage,
  type PresetUpsert,
  type PresetDelete,
  type ScheduleUpsert,
  type ScheduleDelete,
  type NemotoConfigUpsert,
  type NemotoSystemInfo,
  type NemotoSetupStatus,
  type NemotoFleetSummary,
  type OtaProgress,
  type NemotoActivityEvent,
} from '@/protobufs/generated/ts/kd/v1/nemoto_pb';
import { Prisma } from '@/generated/prisma/client';
import {
  NemotoCycleType as PrismaCycleType,
  NemotoScheduleActionType as PrismaActionType,
  NemotoActivityKind,
} from '@/generated/prisma/enums';
import { prisma, writeNemotoLiveState } from '@/shared/utils';
import { LoggerService } from '@/shared/logger';

const logger = new LoggerService();
logger.setServerType('SocketServer');
logger.setContext('NemotoSync');

// --- time + bytes helpers ----------------------------------------------------

const dateToUnixSeconds = (date: Date): bigint => BigInt(Math.floor(date.getTime() / 1000));
const unixSecondsToDate = (seconds: bigint): Date => new Date(Number(seconds) * 1000);

// Copy into an ArrayBuffer-backed Uint8Array (Prisma's Bytes input type).
const toBytes = (src: Uint8Array): Uint8Array<ArrayBuffer> => {
  const out = new Uint8Array(new ArrayBuffer(src.length));
  out.set(src);
  return out;
};

const toHex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');

// --- enum mappers ------------------------------------------------------------

const cycleProtoToPrisma = (c: NemotoCycleType): PrismaCycleType =>
  c === NemotoCycleType.FULL ? PrismaCycleType.FULL : PrismaCycleType.PARTIAL;

const cyclePrismaToProto = (c: PrismaCycleType): NemotoCycleType =>
  c === PrismaCycleType.FULL ? NemotoCycleType.FULL : NemotoCycleType.PARTIAL;

const actionProtoToPrisma = (a: NemotoScheduleActionType): PrismaActionType => {
  switch (a) {
    case NemotoScheduleActionType.DISPLAY_PRESET:
      return PrismaActionType.DISPLAY_PRESET;
    case NemotoScheduleActionType.DISPLAY_SOLID:
      return PrismaActionType.DISPLAY_SOLID;
    default:
      return PrismaActionType.CLEAR;
  }
};

const actionPrismaToProto = (a: PrismaActionType): NemotoScheduleActionType => {
  switch (a) {
    case PrismaActionType.DISPLAY_PRESET:
      return NemotoScheduleActionType.DISPLAY_PRESET;
    case PrismaActionType.DISPLAY_SOLID:
      return NemotoScheduleActionType.DISPLAY_SOLID;
    default:
      return NemotoScheduleActionType.CLEAR;
  }
};

// =============================================================================
// Device -> cloud: apply inbound writes (conflict-resolved)
// =============================================================================

export async function applyPresetUpsert(deviceId: string, up: PresetUpsert): Promise<void> {
  const existing = await prisma.nemotoPreset.findUnique({
    where: { deviceId_presetId: { deviceId, presetId: up.id } },
    select: { syncedAt: true },
  });

  // max(updated_at), ties to cloud: only accept if the device is strictly newer.
  if (existing && dateToUnixSeconds(existing.syncedAt) >= up.updatedAt) {
    return;
  }

  const syncedAt = unixSecondsToDate(up.updatedAt);
  const flaps = toBytes(up.flaps);
  await prisma.nemotoPreset.upsert({
    where: { deviceId_presetId: { deviceId, presetId: up.id } },
    create: {
      deviceId,
      presetId: up.id,
      name: up.name,
      width: up.width,
      height: up.height,
      flaps,
      syncedAt,
    },
    update: { name: up.name, width: up.width, height: up.height, flaps, syncedAt, deletedAt: null },
  });
}

export async function applyPresetDelete(deviceId: string, del: PresetDelete): Promise<void> {
  const existing = await prisma.nemotoPreset.findUnique({
    where: { deviceId_presetId: { deviceId, presetId: del.id } },
    select: { id: true, syncedAt: true, deletedAt: true },
  });
  if (!existing) {
    return;
  }
  if (dateToUnixSeconds(existing.syncedAt) >= del.tombstoneAt) {
    return;
  }
  const at = unixSecondsToDate(del.tombstoneAt);
  await prisma.nemotoPreset.update({
    where: { id: existing.id },
    data: { deletedAt: at, syncedAt: at },
  });
}

export async function applyScheduleUpsert(deviceId: string, up: ScheduleUpsert): Promise<void> {
  const existing = await prisma.nemotoSchedule.findUnique({
    where: { deviceId_scheduleId: { deviceId, scheduleId: up.id } },
    select: { syncedAt: true },
  });
  if (existing && dateToUnixSeconds(existing.syncedAt) >= up.updatedAt) {
    return;
  }

  const syncedAt = unixSecondsToDate(up.updatedAt);
  const actionType = up.action ? actionProtoToPrisma(up.action.type) : PrismaActionType.CLEAR;
  const actionPresetId = up.action?.presetId ?? 0;
  const actionFlap = up.action?.flap ?? 0;

  await prisma.nemotoSchedule.upsert({
    where: { deviceId_scheduleId: { deviceId, scheduleId: up.id } },
    create: {
      deviceId,
      scheduleId: up.id,
      name: up.name,
      cron: up.cron,
      enabled: up.enabled,
      obeyQuietHours: up.obeyQuietHours,
      actionType,
      actionPresetId,
      actionFlap,
      syncedAt,
    },
    update: {
      name: up.name,
      cron: up.cron,
      enabled: up.enabled,
      obeyQuietHours: up.obeyQuietHours,
      actionType,
      actionPresetId,
      actionFlap,
      syncedAt,
      deletedAt: null,
    },
  });
}

export async function applyScheduleDelete(deviceId: string, del: ScheduleDelete): Promise<void> {
  const existing = await prisma.nemotoSchedule.findUnique({
    where: { deviceId_scheduleId: { deviceId, scheduleId: del.id } },
    select: { id: true, syncedAt: true },
  });
  if (!existing) {
    return;
  }
  if (dateToUnixSeconds(existing.syncedAt) >= del.tombstoneAt) {
    return;
  }
  const at = unixSecondsToDate(del.tombstoneAt);
  await prisma.nemotoSchedule.update({
    where: { id: existing.id },
    data: { deletedAt: at, syncedAt: at },
  });
}

export async function applyConfigUpsert(deviceId: string, cfg: NemotoConfigUpsert): Promise<void> {
  const existing = await prisma.nemotoConfig.findUnique({
    where: { deviceId },
    select: { syncedAt: true },
  });
  if (existing && dateToUnixSeconds(existing.syncedAt) >= cfg.updatedAt) {
    return;
  }

  const syncedAt = unixSecondsToDate(cfg.updatedAt);
  const quietWindows = cfg.quietWindows.map((w) => ({
    dayMask: w.dayMask,
    startHour: w.startHour,
    startMin: w.startMin,
    endHour: w.endHour,
    endMin: w.endMin,
    enabled: w.enabled,
  }));

  const data = {
    bootPresetId: cfg.bootPresetId,
    defaultSpeed: cfg.defaultSpeed,
    defaultAccel: cfg.defaultAccel,
    autoDiscoverSec: cfg.autoDiscoverSec,
    displayEffectId: cfg.displayEffectId,
    displayDelayMs: cfg.displayDelayMs,
    cycleType: cycleProtoToPrisma(cfg.cycleType),
    quietWindows,
    syncedAt,
  };

  await prisma.nemotoConfig.upsert({
    where: { deviceId },
    create: { deviceId, ...data },
    update: data,
  });

  // device_name is the display name — keep it in DeviceSettings (single source).
  if (cfg.deviceName) {
    await prisma.deviceSettings.upsert({
      where: { deviceId },
      create: { deviceId, displayName: cfg.deviceName },
      update: { displayName: cfg.deviceName },
    });
  }
}

// =============================================================================
// Cloud -> device: build framed messages
// =============================================================================

export async function buildPresetSyncDiff(deviceId: string): Promise<NemotoMessage> {
  const presets = await prisma.nemotoPreset.findMany({ where: { deviceId } });
  const upserts = presets
    .filter((p) => !p.deletedAt)
    .map((p) =>
      create(PresetUpsertSchema, {
        id: p.presetId,
        name: p.name,
        width: p.width,
        height: p.height,
        flaps: p.flaps,
        updatedAt: dateToUnixSeconds(p.syncedAt),
      })
    );
  const deletedIds = presets.filter((p) => p.deletedAt).map((p) => p.presetId);

  return create(NemotoMessageSchema, {
    message: {
      case: 'presetSyncDiff',
      value: create(PresetSyncDiffSchema, { upserts, deletedIds }),
    },
  });
}

export async function buildScheduleSyncDiff(deviceId: string): Promise<NemotoMessage> {
  const schedules = await prisma.nemotoSchedule.findMany({ where: { deviceId } });
  const upserts = schedules.filter((s) => !s.deletedAt).map((s) => scheduleToProto(s));
  const deletedIds = schedules.filter((s) => s.deletedAt).map((s) => s.scheduleId);

  return create(NemotoMessageSchema, {
    message: {
      case: 'scheduleSyncDiff',
      value: create(ScheduleSyncDiffSchema, { upserts, deletedIds }),
    },
  });
}

export async function buildConfigUpsert(deviceId: string): Promise<NemotoMessage> {
  const [config, settings] = await Promise.all([
    prisma.nemotoConfig.findUnique({ where: { deviceId } }),
    prisma.deviceSettings.findUnique({ where: { deviceId }, select: { displayName: true } }),
  ]);

  const quietWindows = ((config?.quietWindows as QuietWindowJson[] | null) ?? []).map((w) =>
    create(NemotoQuietWindowSchema, {
      dayMask: w.dayMask,
      startHour: w.startHour,
      startMin: w.startMin,
      endHour: w.endHour,
      endMin: w.endMin,
      enabled: w.enabled,
    })
  );

  const value = create(NemotoConfigUpsertSchema, {
    deviceName: settings?.displayName ?? deviceId,
    bootPresetId: config?.bootPresetId ?? 0,
    defaultSpeed: config?.defaultSpeed ?? 0,
    defaultAccel: config?.defaultAccel ?? 0,
    autoDiscoverSec: config?.autoDiscoverSec ?? 0,
    displayEffectId: config?.displayEffectId ?? '',
    displayDelayMs: config?.displayDelayMs ?? 0,
    cycleType: cyclePrismaToProto(config?.cycleType ?? PrismaCycleType.PARTIAL),
    quietWindows,
    updatedAt: dateToUnixSeconds(config?.syncedAt ?? new Date(0)),
  });

  return create(NemotoMessageSchema, { message: { case: 'configUpsert', value } });
}

/**
 * Respond to a device's configRequest. If we hold a config, push it. If we
 * don't yet, reply with a configRequest of our own to pull the device's config
 * up (it answers with configUpsert) — pushing empty defaults would clobber the
 * device's local config, which it applies unconditionally.
 */
export async function buildConfigSyncResponse(deviceId: string): Promise<NemotoMessage> {
  const config = await prisma.nemotoConfig.findUnique({
    where: { deviceId },
    select: { deviceId: true },
  });
  if (!config) {
    return create(NemotoMessageSchema, {
      message: { case: 'configRequest', value: create(NemotoConfigRequestSchema) },
    });
  }
  return buildConfigUpsert(deviceId);
}

export async function buildPresetUpsert(
  deviceId: string,
  presetId: number
): Promise<NemotoMessage | null> {
  const p = await prisma.nemotoPreset.findUnique({
    where: { deviceId_presetId: { deviceId, presetId } },
  });
  if (!p || p.deletedAt) {
    return null;
  }
  return create(NemotoMessageSchema, {
    message: {
      case: 'presetUpsert',
      value: create(PresetUpsertSchema, {
        id: p.presetId,
        name: p.name,
        width: p.width,
        height: p.height,
        flaps: p.flaps,
        updatedAt: dateToUnixSeconds(p.syncedAt),
      }),
    },
  });
}

export function buildPresetDelete(presetId: number): NemotoMessage {
  return create(NemotoMessageSchema, {
    message: {
      case: 'presetDelete',
      value: create(PresetDeleteSchema, {
        id: presetId,
        tombstoneAt: dateToUnixSeconds(new Date()),
      }),
    },
  });
}

export async function buildScheduleUpsert(
  deviceId: string,
  scheduleId: number
): Promise<NemotoMessage | null> {
  const s = await prisma.nemotoSchedule.findUnique({
    where: { deviceId_scheduleId: { deviceId, scheduleId } },
  });
  if (!s || s.deletedAt) {
    return null;
  }
  return create(NemotoMessageSchema, {
    message: { case: 'scheduleUpsert', value: scheduleToProto(s) },
  });
}

export function buildScheduleDelete(scheduleId: number): NemotoMessage {
  return create(NemotoMessageSchema, {
    message: {
      case: 'scheduleDelete',
      value: create(ScheduleDeleteSchema, {
        id: scheduleId,
        tombstoneAt: dateToUnixSeconds(new Date()),
      }),
    },
  });
}

// --- remote command builders -------------------------------------------------

export function buildShowPreset(presetId: number, forceQuiet: boolean): NemotoMessage {
  return create(NemotoMessageSchema, {
    message: {
      case: 'showPresetRequest',
      value: create(ShowPresetRequestSchema, { presetId, forceQuiet }),
    },
  });
}

export function buildDisplayCell(
  x: number,
  y: number,
  flap: number,
  forceQuiet: boolean
): NemotoMessage {
  return create(NemotoMessageSchema, {
    message: {
      case: 'displayCellRequest',
      value: create(DisplayCellRequestSchema, { x, y, flap, forceQuiet }),
    },
  });
}

export function buildDisplayClear(forceQuiet: boolean): NemotoMessage {
  return create(NemotoMessageSchema, {
    message: {
      case: 'displayClearRequest',
      value: create(DisplayClearRequestSchema, { forceQuiet }),
    },
  });
}

export function buildRunScheduleNow(scheduleId: number, forceQuiet: boolean): NemotoMessage {
  return create(NemotoMessageSchema, {
    message: {
      case: 'runScheduleNowRequest',
      value: create(RunScheduleNowRequestSchema, { scheduleId, forceQuiet }),
    },
  });
}

export function buildReboot(): NemotoMessage {
  return create(NemotoMessageSchema, {
    message: { case: 'rebootRequest', value: create(RebootRequestSchema) },
  });
}

// =============================================================================
// Live state ingestion (ephemeral -> Redis)
// =============================================================================

export async function ingestSystemInfo(deviceId: string, m: NemotoSystemInfo): Promise<void> {
  await writeNemotoLiveState(deviceId, 'system', {
    firmwareVersion: m.firmwareVersion,
    hwVariant: m.hwVariant,
    deviceName: m.deviceName,
    mac: m.mac,
    ip: m.ip,
    hostname: m.hostname,
    wifiSsid: m.wifiSsid,
    wifiRssi: m.wifiRssi,
    uptimeS: m.uptimeS,
    freeHeap: m.freeHeap,
    timeSynced: m.timeSynced,
    timezone: m.timezone,
  });
}

export async function ingestSetupStatus(deviceId: string, m: NemotoSetupStatus): Promise<void> {
  await writeNemotoLiveState(deviceId, 'setup', {
    phase: NemotoSetupPhase[m.phase] ?? 'UNSPECIFIED',
    moduleCount: m.moduleCount,
    assignedCount: m.assignedCount,
    mappedCount: m.mappedCount,
    homedCount: m.homedCount,
    gridWidth: m.gridWidth,
    gridHeight: m.gridHeight,
  });
}

export async function ingestFleetSummary(deviceId: string, m: NemotoFleetSummary): Promise<void> {
  await writeNemotoLiveState(deviceId, 'fleet', {
    total: m.total,
    assigned: m.assigned,
    alive: m.alive,
    homed: m.homed,
    inError: m.inError,
    gridWidth: m.gridWidth,
    gridHeight: m.gridHeight,
    gridMapped: m.gridMapped,
    faults: m.faults.map((f) => ({
      uuid: toHex(f.uuid),
      shortId: f.shortId,
      kind: NemotoFaultKind[f.kind] ?? 'UNSPECIFIED',
      tempC: f.tempC,
      lastSeenSAgo: f.lastSeenSAgo,
      detail: f.detail,
    })),
    generatedAt: Number(m.generatedAt),
  });
}

export async function ingestOtaProgress(deviceId: string, m: OtaProgress): Promise<void> {
  await writeNemotoLiveState(deviceId, 'ota', {
    phase: NemotoOtaPhase[m.phase] ?? 'UNSPECIFIED',
    percent: m.percent,
    currentModuleUuid: toHex(m.currentModuleUuid),
    modulesDone: m.modulesDone,
    modulesTotal: m.modulesTotal,
    errorDetail: m.errorDetail,
    fwVersion: m.fwVersion,
  });
}

// =============================================================================
// Activity timeline (-> Postgres)
// =============================================================================

const ACTIVITY_KIND_BY_CASE: Record<string, NemotoActivityKind> = {
  schedulePresetShown: NemotoActivityKind.SCHEDULE_PRESET_SHOWN,
  presetShownManual: NemotoActivityKind.PRESET_SHOWN_MANUAL,
  discoveryComplete: NemotoActivityKind.DISCOVERY_COMPLETE,
  bootloaderEntered: NemotoActivityKind.BOOTLOADER_ENTERED,
  emergencyStopFired: NemotoActivityKind.EMERGENCY_STOP_FIRED,
  quietHoursBlocked: NemotoActivityKind.QUIET_HOURS_BLOCKED,
};

export async function recordActivityEvent(
  deviceId: string,
  event: NemotoActivityEvent
): Promise<void> {
  const ev = event.event;
  if (!ev.case) {
    return;
  }
  const kind = ACTIVITY_KIND_BY_CASE[ev.case];
  if (!kind) {
    logger.warn(`Unknown Nemoto activity event case: ${ev.case}`);
    return;
  }

  // ev.value is the matched oneof message; strip proto bookkeeping for storage.
  const { $typeName: _typeName, ...payload } = ev.value as Record<string, unknown> & {
    $typeName?: string;
  };

  await prisma.nemotoActivityEvent.create({
    data: {
      deviceId,
      ts: unixSecondsToDate(event.ts),
      kind,
      payload: payload as Prisma.InputJsonValue,
    },
  });
}

// --- internal ----------------------------------------------------------------

type QuietWindowJson = {
  dayMask: number;
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
  enabled: boolean;
};

function scheduleToProto(s: {
  scheduleId: number;
  name: string;
  cron: string;
  enabled: boolean;
  obeyQuietHours: boolean;
  actionType: PrismaActionType;
  actionPresetId: number;
  actionFlap: number;
  syncedAt: Date;
}): ScheduleUpsert {
  return create(ScheduleUpsertSchema, {
    id: s.scheduleId,
    name: s.name,
    cron: s.cron,
    enabled: s.enabled,
    obeyQuietHours: s.obeyQuietHours,
    action: create(NemotoScheduleActionSchema, {
      type: actionPrismaToProto(s.actionType),
      presetId: s.actionPresetId,
      flap: s.actionFlap,
    }),
    updatedAt: dateToUnixSeconds(s.syncedAt),
  });
}
