import { DeviceType } from '../generated/prisma/enums';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import Redis from 'ioredis';
import type { WebSocketAdapter } from '~/types';
import { toBinary, create } from '@bufbuild/protobuf';
import { DeviceAPIMessageSchema } from '~/protobufs/device-api_pb';
import {
  ErrorResponseSchema,
  KDGlobalMessageSchema,
  OKResponseSchema,
} from '~/protobufs/kd_global_pb';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

export const prisma = new PrismaClient({
  adapter,
});

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
export const redisSub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

/**
 * Ensure a consumer group exists for a stream
 */
export async function ensureConsumerGroup(streamKey: string, groupName: string): Promise<void> {
  try {
    await redis.xgroup('CREATE', streamKey, groupName, '0', 'MKSTREAM');
    console.log(`Created consumer group ${groupName} for stream ${streamKey}`);
  } catch (error: any) {
    if (error.message.includes('BUSYGROUP')) {
      // Group already exists, this is fine
      return;
    }
    throw error;
  }
}

/**
 * Publish a message to a render request stream (work queue pattern)
 */
export async function publishToRenderStream(message: Record<string, any>): Promise<void> {
  const streamKey = 'matrx:render_requests';
  try {
    const messageId = await redis.xadd(streamKey, '*', 'payload', JSON.stringify(message));
    console.log(`Published to stream ${streamKey}, message ID: ${messageId}`, message);
  } catch (error) {
    console.error(`Error publishing to stream ${streamKey}:`, error);
    throw error;
  }
}

// Type-specific settings
export type LanternSettings = {
  brightness: number;
  sleep_start: number;
  sleep_end: number;
};

export type MatrxSettings = {
  brightness: number;
  light_sensor_enabled: boolean;
  sleep_start: number;
  sleep_end: number;
};

export type DeviceSettings = LanternSettings | MatrxSettings;

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
  } else {
    return {
      brightness: 100,
      light_sensor_enabled: false,
      sleep_start: 0,
      sleep_end: 0,
    } as MatrxSettings;
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
  if (type === 'LANTERN' || type === 'MATRX') {
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

/**
 * Send OK response back to the device
 */
export function sendOkResponse(ws: WebSocketAdapter): void {
  const apiResponse = create(DeviceAPIMessageSchema);
  apiResponse.message.case = 'kdGlobalMessage';
  apiResponse.message.value = create(KDGlobalMessageSchema);
  apiResponse.message.value.message.case = 'okResponse';
  apiResponse.message.value.message.value = create(OKResponseSchema);
  apiResponse.message.value.message.value.success = true;

  const resp = toBinary(DeviceAPIMessageSchema, apiResponse);
  ws.send(resp, true);
}

/**
 * Send error response back to the device
 */
export function sendErrorResponse(ws: WebSocketAdapter, errorMsg: string): void {
  const apiResponse = create(DeviceAPIMessageSchema);
  apiResponse.message.case = 'kdGlobalMessage';
  apiResponse.message.value = create(KDGlobalMessageSchema);
  apiResponse.message.value.message.case = 'errorResponse';
  apiResponse.message.value.message.value = create(ErrorResponseSchema);
  apiResponse.message.value.message.value.errorMessage = errorMsg;

  const resp = toBinary(DeviceAPIMessageSchema, apiResponse);
  ws.send(resp, true);
}
