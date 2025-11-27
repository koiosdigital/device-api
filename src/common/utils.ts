import { DeviceType } from "../generated/prisma";

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
            sleep_end: 0
        } as LanternSettings;
    } else {
        return {
            brightness: 100,
            light_sensor_enabled: false,
            sleep_start: 0,
            sleep_end: 0
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
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    return [
        hex.substring(0, 8),
        hex.substring(8, 12),
        hex.substring(12, 16),
        hex.substring(16, 20),
        hex.substring(20, 32)
    ].join('-');
}

/**
 * Extract device type from certificate common name
 */
export function getDeviceTypeFromCN(cn: string): DeviceType {
    const type = cn.split("-")[0].toUpperCase();
    if (type === 'LANTERN' || type === 'MATRX') {
        return type as DeviceType;
    }
    throw new Error(`Invalid device type in CN: ${cn}`);
}