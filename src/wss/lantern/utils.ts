import type { WebSocketAdapter } from '@/shared/types';

export interface SetColorMessage {
  type: 'set_color';
  red: number;
  green: number;
  blue: number;
  effect: string;
  speed: number;
  brightness: number;
  timeout_seconds: number;
}

/**
 * Placeholder that keeps the signature used elsewhere until the Lantern
 * protocol migration lands.
 */
export async function publishColorCommand(
  deviceId: string,
  color: { red: number; green: number; blue: number },
  effect: string
): Promise<void> {
  void deviceId;
  void color;
  void effect;
}

export function sendSetColorCommand(ws: WebSocketAdapter, msg: SetColorMessage): void {
  void ws;
  void msg;
}
