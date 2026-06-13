import { DeviceType } from '@/generated/prisma/enums';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import Redis from 'ioredis';
import { LoggerService } from '@/shared/logger';

const logger = new LoggerService();
logger.setContext('Database');

const redisLogger = new LoggerService();
redisLogger.setContext('Redis');

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

export const prisma = new PrismaClient({
  adapter,
});

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 100, 3000),
});

export const redisSub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 100, 3000),
});

// Log Redis connection events for debugging
redis.on('error', (err) => redisLogger.error(`Redis error: ${err.message}`));
redis.on('connect', () => redisLogger.log('Redis connected'));
redis.on('reconnecting', () => redisLogger.warn('Redis reconnecting...'));

redisSub.on('error', (err) => redisLogger.error(`Redis sub error: ${err.message}`));
redisSub.on('connect', () => redisLogger.log('Redis sub connected'));
redisSub.on('reconnecting', () => redisLogger.warn('Redis sub reconnecting...'));
redisSub.on('end', () => redisLogger.error('Redis sub connection ended'));
redisSub.on('close', () => redisLogger.error('Redis sub connection closed'));
redisSub.on('subscribe', (channel, count) => {
  redisLogger.debug(`Subscribed to ${channel}, total subscriptions: ${count}`);
});
redisSub.on('unsubscribe', (channel, count) => {
  redisLogger.debug(`Unsubscribed from ${channel}, remaining subscriptions: ${count}`);
});

const notifyLogger = new LoggerService();
notifyLogger.setContext('Notify');

/**
 * Notify device to refresh its schedule (installations changed)
 */
export async function notifyScheduleUpdate(deviceId: string): Promise<void> {
  const channel = `device:${deviceId}`;
  const message = JSON.stringify({ type: 'schedule_update' });
  const subscribers = await redis.publish(channel, message);
  notifyLogger.debug(`schedule_update device=${deviceId} subscribers=${subscribers}`);
}

/**
 * Notify device to refresh its settings from database
 */
export async function notifySettingsUpdate(deviceId: string): Promise<void> {
  const channel = `device:${deviceId}`;
  const message = JSON.stringify({ type: 'settings_update' });
  const subscribers = await redis.publish(channel, message);
  notifyLogger.debug(`settings_update device=${deviceId} subscribers=${subscribers}`);
}

/**
 * Notify device to perform factory reset
 */
export async function notifyFactoryReset(deviceId: string, reason?: string): Promise<void> {
  const channel = `device:${deviceId}`;
  const message = JSON.stringify({
    type: 'factory_reset',
    reason: reason || 'Device deleted by owner',
  });
  const subscribers = await redis.publish(channel, message);
  notifyLogger.log(`factory_reset device=${deviceId} subscribers=${subscribers}`);
}

/**
 * Publish a raw message to a device's channel. Returns the number of WSS
 * subscribers that received it (0 ⇒ device is not currently connected).
 */
export async function publishDeviceMessage(
  deviceId: string,
  message: Record<string, unknown>
): Promise<number> {
  const subscribers = await redis.publish(`device:${deviceId}`, JSON.stringify(message));
  notifyLogger.debug(`publish device=${deviceId} type=${message.type} subscribers=${subscribers}`);
  return subscribers;
}

// --- Nemoto cloud→device notifications (consumed by nemotoQueueHandler) -------

export async function notifyNemotoConfigUpdate(deviceId: string): Promise<number> {
  return publishDeviceMessage(deviceId, { type: 'nemoto_config_update' });
}

export async function notifyNemotoPresetUpsert(
  deviceId: string,
  presetId: number
): Promise<number> {
  return publishDeviceMessage(deviceId, { type: 'nemoto_preset_upsert', presetId });
}

export async function notifyNemotoPresetDelete(
  deviceId: string,
  presetId: number
): Promise<number> {
  return publishDeviceMessage(deviceId, { type: 'nemoto_preset_delete', presetId });
}

export async function notifyNemotoScheduleUpsert(
  deviceId: string,
  scheduleId: number
): Promise<number> {
  return publishDeviceMessage(deviceId, { type: 'nemoto_schedule_upsert', scheduleId });
}

export async function notifyNemotoScheduleDelete(
  deviceId: string,
  scheduleId: number
): Promise<number> {
  return publishDeviceMessage(deviceId, { type: 'nemoto_schedule_delete', scheduleId });
}

// --- Nemoto live state (ephemeral, written by the WSS handler) ----------------

export type NemotoLiveField = 'system' | 'setup' | 'fleet' | 'ota';

// Refreshed on every write; absence ⇒ the device hasn't reported since its last
// (re)connect. Fleet summaries arrive ~60s, so 5 min tolerates a few misses.
export const NEMOTO_LIVE_TTL_SECONDS = 300;

export interface NemotoLiveState {
  system: unknown | null;
  setup: unknown | null;
  fleet: unknown | null;
  ota: unknown | null;
  at: string | null;
}

const nemotoLiveKey = (deviceId: string): string => `nemoto:live:${deviceId}`;

/**
 * Upsert one field of a device's live-state hash and (re)arm its TTL.
 * Called by the WSS handler when the device reports system/setup/fleet/ota.
 */
export async function writeNemotoLiveState(
  deviceId: string,
  field: NemotoLiveField,
  value: unknown
): Promise<void> {
  const key = nemotoLiveKey(deviceId);
  await redis
    .multi()
    .hset(key, field, JSON.stringify(value), 'at', new Date().toISOString())
    .expire(key, NEMOTO_LIVE_TTL_SECONDS)
    .exec();
}

/**
 * Read a device's live-state snapshot, or null if nothing has been reported
 * (key absent/expired). Individual fields are null until first reported.
 */
export async function readNemotoLiveState(deviceId: string): Promise<NemotoLiveState | null> {
  const hash = await redis.hgetall(nemotoLiveKey(deviceId));
  if (!hash || Object.keys(hash).length === 0) {
    return null;
  }
  const parse = (raw: string | undefined): unknown | null => (raw ? JSON.parse(raw) : null);
  return {
    system: parse(hash.system),
    setup: parse(hash.setup),
    fleet: parse(hash.fleet),
    ota: parse(hash.ota),
    at: hash.at ?? null,
  };
}

// Type-specific settings
export type LanternSettings = {
  brightness: number;
  sleep_start: number;
  sleep_end: number;
};

export type MatrxSettings = {
  screenEnabled: boolean;
  screenBrightness: number;
  autoBrightnessEnabled: boolean;
  screenOffLux: number;
};

export type NemotoSettings = {
  bootPresetId: number;
  autoDiscoverSec: number;
};

export type DeviceSettings = LanternSettings | MatrxSettings | NemotoSettings;

/**
 * Get default settings for a device type
 */
export function getDefaultTypeSettings(type: DeviceType): DeviceSettings {
  if (type === 'LANTERN') {
    return {
      brightness: 255,
      sleep_start: 0,
      sleep_end: 0,
    } as LanternSettings;
  } else if (type === 'MATRX') {
    return {
      screenEnabled: true,
      screenBrightness: 128,
      autoBrightnessEnabled: false,
      screenOffLux: 5,
    } as MatrxSettings;
  } else if (type === 'NEMOTO') {
    return {
      bootPresetId: 0,
      autoDiscoverSec: 0,
    } as NemotoSettings;
  } else {
    throw new Error(`No default settings for device type: ${type}`);
  }
}

/**
 * Converts a UUID string to a 16-byte Uint8Array
 * @param uuid - UUID string in format "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
 * @returns 16-byte Uint8Array representation
 */
export function uuidStringToBytes(uuid: string): Uint8Array {
  // Remove hyphens from UUID string
  const hex = uuid.replace(/-/g, '');

  if (hex.length !== 32) {
    throw new Error(`Invalid UUID format: ${uuid}`);
  }

  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }

  return bytes;
}

/**
 * Converts a 16-byte Uint8Array to a UUID string
 * @param bytes - 16-byte Uint8Array
 * @returns UUID string in format "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
 */
export function uuidBytesToString(bytes: Uint8Array): string {
  if (bytes.length !== 16) {
    throw new Error(`UUID bytes must be exactly 16 bytes, got ${bytes.length}`);
  }

  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return [
    hex.substring(0, 8),
    hex.substring(8, 12),
    hex.substring(12, 16),
    hex.substring(16, 20),
    hex.substring(20, 32),
  ].join('-');
}

/**
 * Extract device type from certificate common name
 */
export function getDeviceTypeFromCN(cn: string): DeviceType {
  const type = cn.split('-')[0].toUpperCase();
  if (type === 'LANTERN' || type === 'MATRX' || type === 'NEMOTO') {
    return type as DeviceType;
  }
  throw new Error(`Invalid device type in CN: ${cn}`);
}

/**
 * Parse a hex color string into RGB components
 */
export function parseHexColor(hexColor: string | null): {
  red: number;
  green: number;
  blue: number;
} {
  if (!hexColor || typeof hexColor !== 'string' || !/^#?[0-9A-Fa-f]{6}$/.test(hexColor)) {
    return { red: 0, green: 0, blue: 0 };
  }

  const hex = hexColor.replace(/^#/, '');
  return {
    red: parseInt(hex.slice(0, 2), 16),
    green: parseInt(hex.slice(2, 4), 16),
    blue: parseInt(hex.slice(4, 6), 16),
  };
}
