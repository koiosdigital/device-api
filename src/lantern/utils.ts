import type { WebSocketAdapter } from '../types';
import { create, toBinary } from '@bufbuild/protobuf';
import { DeviceAPIMessageSchema } from '../protobufs/device-api_pb';
import { KDLanternMessageSchema, SetColorSchema, LEDEffect } from '../protobufs/kd_lantern_pb';
import { redis } from '~/common/utils';

interface SetColorMessage {
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
 * Convert string effect name to LEDEffect enum
 */
function parseEffectType(effect: string): LEDEffect {
  const effectMap: Record<string, LEDEffect> = {
    none: LEDEffect.SOLID,
    off: LEDEffect.OFF,
    solid: LEDEffect.SOLID,
    flash: LEDEffect.FLASH,
    breathing: LEDEffect.BREATHING,
    cycle: LEDEffect.CYCLE,
    rainbow: LEDEffect.RAINBOW,
  };

  return effectMap[effect.toLowerCase()] ?? LEDEffect.SOLID;
}

/**
 * Publish a color change command to a device via Redis
 */
export async function publishColorCommand(
  deviceId: string,
  color: { red: number; green: number; blue: number },
  effect: string
): Promise<void> {
  const payload: SetColorMessage = {
    type: 'set_color',
    red: color.red,
    green: color.green,
    blue: color.blue,
    effect,
    speed: 10,
    brightness: 127,
    timeout_seconds: 300,
  };

  await redis.publish(`device:${deviceId}`, JSON.stringify(payload));
}

/**
 * Send a set color command to a Lantern device via WebSocket
 */
export function sendSetColorCommand(ws: WebSocketAdapter, msg: SetColorMessage): void {
  const apiResponse = create(DeviceAPIMessageSchema);
  apiResponse.message.case = 'kdLanternMessage';
  apiResponse.message.value = create(KDLanternMessageSchema);
  apiResponse.message.value.message.case = 'setColor';
  apiResponse.message.value.message.value = create(SetColorSchema);
  apiResponse.message.value.message.value.blue = msg.blue;
  apiResponse.message.value.message.value.green = msg.green;
  apiResponse.message.value.message.value.red = msg.red;
  apiResponse.message.value.message.value.effect = parseEffectType(msg.effect);
  apiResponse.message.value.message.value.effectSpeed = msg.speed;
  apiResponse.message.value.message.value.effectBrightness = msg.brightness;
  apiResponse.message.value.message.value.timeoutSeconds = msg.timeout_seconds;

  const resp = toBinary(DeviceAPIMessageSchema, apiResponse);
  ws.send(resp, true);
}
