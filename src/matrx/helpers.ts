/**
 * Converts a UUID string to a 16-byte Uint8Array
 * @param uuid - UUID string in format "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
 * @returns 16-byte Uint8Array representation
 */
export function uuidStringToBytes(uuid: string): Uint8Array {
    // Remove hyphens from UUID string
    const hex = uuid.replace(/-/g, '');

    if (hex.length !== 32) {
        throw new Error('Invalid UUID format');
    }

    const bytes = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
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
        throw new Error('UUID bytes must be exactly 16 bytes');
    }

    const hex = Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    return [
        hex.substr(0, 8),
        hex.substr(8, 4),
        hex.substr(12, 4),
        hex.substr(16, 4),
        hex.substr(20, 12)
    ].join('-');
}