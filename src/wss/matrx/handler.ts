import type { WebSocketAdapter } from '@/shared/types';
import { create, toBinary } from '@bufbuild/protobuf';
import { jwtVerify } from 'jose';
import {
  MatrxMessageSchema,
  type MatrxMessage,
  type ModifyScheduleItem,
  type SpriteRenderRequest,
  type CurrentlyDisplayingUpdate,
  MatrxScheduleSchema,
  MatrxSpriteDataSchema,
  DeviceConfigSchema,
  DeviceConfigRequestSchema,
} from '@/protobufs/generated/ts/kd/v1/matrx_pb';
import type { ClaimDevice } from '@/protobufs/generated/ts/kd/v1/common_pb';
import {
  prisma,
  redis,
  uuidBytesToString,
  uuidStringToBytes,
  publishToRenderStream,
} from '@/shared/utils';
import type { MatrxInstallation } from '@/generated/prisma/client';
import { handleUploadCoreDump, sendJoinResponse } from '@/shared/handler';
import type { MatrxSettings } from '@/shared/utils';

const getMatrxDeviceSettings = async (deviceId: string): Promise<MatrxSettings | null> => {
  const settings = await prisma.deviceSettings.findUnique({
    where: { deviceId },
    select: { typeSettings: true },
  });

  if (!settings?.typeSettings) {
    return null;
  }

  return settings.typeSettings as MatrxSettings;
};

const upsertMatrxDeviceSettings = async (
  deviceId: string,
  payload: MatrxSettings
): Promise<void> => {
  const existing = await prisma.deviceSettings.findUnique({ where: { deviceId } });
  if (existing) {
    await prisma.deviceSettings.update({
      where: { deviceId },
      data: { typeSettings: payload },
    });
    return;
  }

  await prisma.deviceSettings.create({
    data: {
      deviceId,
      displayName: deviceId,
      typeSettings: payload,
    },
  });
};

const sendDeviceConfig = (ws: WebSocketAdapter, payload: MatrxSettings): void => {
  const apiResponse = create(MatrxMessageSchema);
  apiResponse.message.case = 'deviceConfig';
  apiResponse.message.value = create(DeviceConfigSchema);
  apiResponse.message.value.screenEnabled = payload.screenEnabled;
  apiResponse.message.value.screenBrightness = payload.screenBrightness;
  apiResponse.message.value.autoBrightnessEnabled = payload.autoBrightnessEnabled;
  apiResponse.message.value.screenOffLux = payload.screenOffLux;

  const resp = toBinary(MatrxMessageSchema, apiResponse);
  ws.send(resp, true);
};
const requestDeviceConfig = (ws: WebSocketAdapter): void => {
  const apiResponse = create(MatrxMessageSchema);
  apiResponse.message.case = 'deviceConfigRequest';
  apiResponse.message.value = create(DeviceConfigRequestSchema);
  const resp = toBinary(MatrxMessageSchema, apiResponse);
  ws.send(resp, true);
};

export const sendMatrxDeviceConfigOnBoot = async (ws: WebSocketAdapter): Promise<void> => {
  const settings = await getMatrxDeviceSettings(ws.getDeviceID());
  if (settings) {
    sendDeviceConfig(ws, settings);
  } else {
    requestDeviceConfig(ws);
  }
};

const handleScheduleRequestMessage = async (ws: WebSocketAdapter): Promise<void> => {
  const deviceId = ws.getDeviceID();

  const installations = await prisma.matrxInstallation.findMany({
    where: { deviceId },
    orderBy: { sortOrder: 'asc' },
  });

  const apiResponse = create(MatrxMessageSchema);
  apiResponse.message.case = 'schedule';
  apiResponse.message.value = create(MatrxScheduleSchema);
  apiResponse.message.value.scheduleItems = installations.map((installation) => ({
    uuid: uuidStringToBytes(installation.id),
    displayTime: installation.displayTime,
    pinned: installation.pinnedByUser,
    skipped: installation.skippedByUser,
    $typeName: 'kd.v1.ScheduleItem',
  }));

  const resp = toBinary(MatrxMessageSchema, apiResponse);
  ws.send(resp, true);
};

const handleSpriteRenderRequestMessage = async (
  ws: WebSocketAdapter,
  message: SpriteRenderRequest
): Promise<void> => {
  const uuid = uuidBytesToString(message.spriteUuid);
  const deviceId = ws.getDeviceID();

  const installation = await prisma.matrxInstallation.findUnique({
    where: {
      id: uuid,
      deviceId,
    },
  });

  if (!installation) {
    return;
  }

  const config = installation.config as { app_id: string; params: Record<string, unknown> };

  const requestPayload = {
    type: 'render_request',
    app_id: config.app_id,
    uuid,
    device: {
      id: deviceId,
      width: message.deviceWidth,
      height: message.deviceHeight,
    },
    params: config.params || {},
  };

  await publishToRenderStream(requestPayload);
};

const handleModifyScheduleItemMessage = async (
  ws: WebSocketAdapter,
  message: ModifyScheduleItem
): Promise<void> => {
  const uuid = uuidBytesToString(message.uuid);
  const deviceId = ws.getDeviceID();

  if (message.pinned) {
    await prisma.$transaction([
      prisma.matrxInstallation.updateMany({
        where: { deviceId },
        data: { pinnedByUser: false },
      }),
      prisma.matrxInstallation.update({
        where: { id: uuid, deviceId },
        data: { pinnedByUser: true },
      }),
    ]);
    return;
  }

  await prisma.matrxInstallation.update({
    where: { id: uuid, deviceId },
    data: {
      skippedByUser: message.skipped,
      pinnedByUser: message.pinned,
    },
  });

  await redis.publish(
    `device:${deviceId}`,
    JSON.stringify({ type: 'schedule_update' })
  );
};

const claimSecret = process.env.CLAIM_JWT_SECRET;
const claimSecretKey = claimSecret ? Buffer.from(claimSecret, 'utf8') : null;

async function verifyClaimToken(tokenBytes: Uint8Array): Promise<string | null> {
  if (!claimSecretKey) {
    return null;
  }

  const token = Buffer.from(tokenBytes).toString('utf8').trim();
  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, claimSecretKey);
    if (typeof payload.user_id === 'string' && payload.user_id.length > 0) {
      return payload.user_id;
    }
  } catch (error) {
    console.warn('Failed to verify claim token', error);
  }

  return null;
}

const handleClaimDeviceMessage = async (
  ws: WebSocketAdapter,
  message: ClaimDevice
): Promise<void> => {
  const userId = await verifyClaimToken(message.claimToken);
  if (!userId) {
    sendJoinResponse(ws, { isClaimed: false, success: false });
    return;
  }

  const alreadyClaimed = await prisma.deviceClaims.findFirst({
    where: { deviceId: ws.getDeviceID(), claimType: 'OWNER' },
  });

  if (alreadyClaimed) {
    sendJoinResponse(ws, { isClaimed: true, success: true });
    return;
  }

  try {
    await prisma.deviceClaims.create({
      data: {
        deviceId: ws.getDeviceID(),
        userId,
        claimType: 'OWNER',
      },
    });
    sendJoinResponse(ws, { isClaimed: true, success: true });
  } catch (error) {
    console.error('Failed to persist claim result:', error);
    sendJoinResponse(ws, { isClaimed: false, success: false });
  }
};

const handleCurrentlyDisplayingUpdate = async (
  ws: WebSocketAdapter,
  message: CurrentlyDisplayingUpdate
): Promise<void> => {
  const installationId = uuidBytesToString(message.installationUuid);
  const deviceId = ws.getDeviceID();

  await prisma.device.update({
    where: { id: deviceId },
    data: { currentlyDisplayingInstallationId: installationId },
  });
};

export const matrxMessageHandler = async (
  ws: WebSocketAdapter,
  message: MatrxMessage
): Promise<void> => {
  if (!message.message.case) {
    return;
  }

  switch (message.message.case) {
    case 'scheduleRequest':
      await handleScheduleRequestMessage(ws);
      return;
    case 'spriteRenderRequest':
      await handleSpriteRenderRequestMessage(ws, message.message.value);
      return;
    case 'modifyScheduleItem':
      await handleModifyScheduleItemMessage(ws, message.message.value);
      return;
    case 'deviceConfigRequest': {
      const current = await getMatrxDeviceSettings(ws.getDeviceID());
      if (current) {
        sendDeviceConfig(ws, current);
      } else {
        requestDeviceConfig(ws);
      }
      return;
    }
    case 'deviceConfig': {
      const payload = message.message.value;
      const normalized: MatrxSettings = {
        screenEnabled: payload.screenEnabled,
        screenBrightness: payload.screenBrightness,
        autoBrightnessEnabled: payload.autoBrightnessEnabled,
        screenOffLux: payload.screenOffLux,
      };
      await upsertMatrxDeviceSettings(ws.getDeviceID(), normalized);
      sendDeviceConfig(ws, normalized);
      return;
    }
    case 'uploadCoreDump':
      await handleUploadCoreDump(ws, message.message.value);
      return;
    case 'claimDevice':
      await handleClaimDeviceMessage(ws, message.message.value);
      return;
    case 'currentlyDisplayingUpdate':
      await handleCurrentlyDisplayingUpdate(ws, message.message.value);
      return;
    default:
      console.warn(`Unhandled Matrx message type: ${message.message.case}`);
  }
};

export const matrxQueueHandler = async (ws: WebSocketAdapter, message: any) => {
  const msg = message; // Already parsed JSON from Redis
  if (msg.type === 'render_result') {
    const apiResponse = create(MatrxMessageSchema);
    apiResponse.message.case = 'spriteData';
    apiResponse.message.value = create(MatrxSpriteDataSchema);
    apiResponse.message.value.spriteUuid = uuidStringToBytes(msg.uuid);

    if (msg.render_output && msg.render_output.length > 0) {
      try {
        const bytes = Buffer.from(msg.render_output, 'base64');
        apiResponse.message.value.spriteData = new Uint8Array(bytes);
        apiResponse.message.value.error = false;
        apiResponse.message.value.ttlEpoch = Math.floor(Date.now() / 1000) + 60;
      } catch (error) {
        console.error('Failed to decode render output:', error);
        apiResponse.message.value.spriteData = new Uint8Array(0);
        apiResponse.message.value.error = true;
        apiResponse.message.value.ttlEpoch = 0;
      }
    } else {
      apiResponse.message.value.spriteData = new Uint8Array(0);
      apiResponse.message.value.error = true;
      apiResponse.message.value.ttlEpoch = 0;
    }

    const resp = toBinary(MatrxMessageSchema, apiResponse);
    ws.send(resp, true);
  } else if (msg.type === 'schedule_update') {
    await handleScheduleRequestMessage(ws);
  }
};
