import type { WebSocketAdapter } from '../types';
import { type KDLanternMessage, type TouchEvent } from '../protobufs/kd_lantern_pb';
import { prisma, sendOkResponse, parseHexColor } from '../common/utils';
import { publishColorCommand, sendSetColorCommand } from './utils';

const handleTouchEventMessage = async (ws: WebSocketAdapter, message: TouchEvent) => {
  const deviceId = ws.getDeviceID();
  sendOkResponse(ws);

  // Get all groups this device belongs to
  const deviceGroups = await prisma.lanternGroupDevices.findMany({
    where: { deviceId },
  });

  if (deviceGroups.length === 0) {
    return;
  }

  const groupIds = deviceGroups.map((group) => group.groupId);

  // Get all devices in those groups
  const allGroupDevices = await prisma.lanternGroupDevices.findMany({
    where: {
      groupId: { in: groupIds },
    },
  });

  // Send color command to each device in the group
  await Promise.all(
    allGroupDevices.map(async (groupDevice) => {
      const deviceConfig = deviceGroups.find((dg) => dg.deviceId === groupDevice.deviceId);
      if (!deviceConfig) {
        return;
      }

      const color = parseHexColor(deviceConfig.triggeredSetColor);
      const effect = deviceConfig.triggeredSetEffect || 'none';

      await publishColorCommand(groupDevice.deviceId, color, effect);
    })
  );
};

export const lanternMessageHandler = async (ws: WebSocketAdapter, message: KDLanternMessage) => {
  if (message.message.case === 'touchEvent') {
    await handleTouchEventMessage(ws, message.message.value);
  }
};

export const lanternQueueHandler = async (ws: WebSocketAdapter, message: any) => {
  if (message.type === 'set_color') {
    sendSetColorCommand(ws, message);
  }
};
