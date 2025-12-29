import type { WebSocketAdapter } from '@/shared/types';
import { create, toBinary } from '@bufbuild/protobuf';
import { createHash } from 'crypto';
import { jwtVerify } from 'jose';
import createClient from 'openapi-fetch';
import type { paths } from '@/generated/matrx-renderer';
import {
  MatrxMessageSchema,
  type MatrxMessage,
  type ScheduleItemSetPinState,
  type AppRenderRequest,
  type CurrentlyDisplayingApp,
  type DeviceInfo,
  ScheduleSchema,
  AppRenderResponseSchema,
  DeviceConfigSchema,
  DeviceConfigRequestSchema,
} from '@/protobufs/generated/ts/kd/v1/matrx_pb';
import {
  type ClaimDevice,
  CommandResultSchema,
  FactoryResetRequestSchema,
} from '@/protobufs/generated/ts/kd/v1/common_pb';
import { prisma, redis, uuidBytesToString, uuidStringToBytes } from '@/shared/utils';
import { handleUploadCoreDump, sendJoinResponse } from '@/shared/handler';
import type { MatrxSettings } from '@/shared/utils';
import { handleCertReport, handleCertRenewRequest } from '@/wss/pki';
import { LoggerService } from '@/shared/logger';

const logger = new LoggerService();
logger.setServerType('SocketServer');
logger.setContext('MatrxHandler');

// Standalone renderer client for WSS (not using NestJS DI)
const rendererBaseUrl = process.env.MATRX_RENDERER_URL || 'http://localhost:8080';
const rendererClient = createClient<paths>({ baseUrl: rendererBaseUrl });

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
  apiResponse.message.value = create(ScheduleSchema);
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

const handleAppRenderRequestMessage = async (
  ws: WebSocketAdapter,
  message: AppRenderRequest
): Promise<void> => {
  const uuid = uuidBytesToString(message.appUuid);
  const deviceId = ws.getDeviceID();

  const installation = await prisma.matrxInstallation.findUnique({
    where: {
      id: uuid,
      deviceId,
    },
    include: {
      device: true,
    },
  });

  if (!installation) {
    return;
  }

  const config = installation.config as { app_id: string; params: Record<string, unknown> };
  const deviceInfo = installation.device.deviceInfo as { width?: number; height?: number } | null;

  logger.debug(`Render request app=${config.app_id} uuid=${uuid}`);

  try {
    const result = await rendererClient.POST('/apps/{id}/render', {
      params: {
        path: { id: config.app_id },
        query: {
          width: deviceInfo?.width || 0,
          height: deviceInfo?.height || 0,
          device_id: deviceId,
        },
      },
      body: config.params || {},
    });

    if (result.error || !result.data) {
      logger.warn(`Render error app=${config.app_id} uuid=${uuid}`);
      return;
    }

    const renderOutput = result.data.result.render_output;
    const bytes = Buffer.from(renderOutput, 'base64');

    // SHA256 of appData
    const hash = createHash('sha256').update(bytes).digest();

    // Skip sending if device already has this exact render
    if (
      message.dataSha256.length > 0 &&
      Buffer.compare(hash, Buffer.from(message.dataSha256)) === 0
    ) {
      logger.debug(`Render skipped (unchanged) app=${config.app_id} uuid=${uuid}`);
      return;
    }

    const apiResponse = create(MatrxMessageSchema);
    apiResponse.message.case = 'appRenderResponse';
    apiResponse.message.value = create(AppRenderResponseSchema);
    apiResponse.message.value.appUuid = uuidStringToBytes(uuid);
    apiResponse.message.value.appData = new Uint8Array(bytes);
    apiResponse.message.value.dataSha256 = new Uint8Array(hash);

    const resp = toBinary(MatrxMessageSchema, apiResponse);
    ws.send(resp, true);

    logger.debug(`Render response app=${config.app_id} uuid=${uuid} bytes=${bytes.length}`);
  } catch (error) {
    logger.error(
      `Render failed app=${config.app_id} uuid=${uuid}`,
      error instanceof Error ? error.stack : String(error)
    );
    return;
  }
};

const handleScheduleItemSetPinStateMessage = async (
  ws: WebSocketAdapter,
  message: ScheduleItemSetPinState
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

  await redis.publish(`device:${deviceId}`, JSON.stringify({ type: 'schedule_update' }));
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
    logger.warn(
      `Failed to verify claim token: ${error instanceof Error ? error.message : String(error)}`
    );
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

  const deviceId = ws.getDeviceID();

  try {
    // Check if device is already claimed by this user
    const existingOwner = await prisma.deviceClaims.findFirst({
      where: { deviceId, claimType: 'OWNER' },
    });

    if (existingOwner?.userId === userId) {
      // Already claimed by this user, do nothing
      sendJoinResponse(ws, { isClaimed: true, success: true });
      return;
    }

    // Device is unclaimed or claimed by a different user - reset everything
    await prisma.$transaction(async (tx) => {
      // Delete all existing claims (owner and shared)
      await tx.deviceClaims.deleteMany({
        where: { deviceId },
      });

      // Delete all installations
      await tx.matrxInstallation.deleteMany({
        where: { deviceId },
      });

      // Delete existing settings
      await tx.deviceSettings.deleteMany({
        where: { deviceId },
      });

      // Create new owner claim (upsert to handle race conditions)
      await tx.deviceClaims.upsert({
        where: { deviceId_userId: { deviceId, userId } },
        create: {
          deviceId,
          userId,
          claimType: 'OWNER',
        },
        update: {
          claimType: 'OWNER',
        },
      });
    });

    sendJoinResponse(ws, { isClaimed: true, success: true });
  } catch (error) {
    logger.error(
      `Failed to claim device: ${deviceId}`,
      error instanceof Error ? error.stack : String(error)
    );
    sendJoinResponse(ws, { isClaimed: false, success: false });
  }
};

const handleCurrentlyDisplayingApp = async (
  ws: WebSocketAdapter,
  message: CurrentlyDisplayingApp
): Promise<void> => {
  const installationId = uuidBytesToString(message.uuid);
  const deviceId = ws.getDeviceID();

  await prisma.device.update({
    where: { id: deviceId },
    data: { currentlyDisplayingInstallationId: installationId },
  });
};

const sendCommandResponse = (ws: WebSocketAdapter, success: boolean): void => {
  const apiResponse = create(MatrxMessageSchema);
  apiResponse.message.case = 'commandResult';
  apiResponse.message.value = create(CommandResultSchema);
  apiResponse.message.value.success = success;
  apiResponse.message.value.errorCode = success ? 0 : 1;
  apiResponse.message.value.detail = '';

  const resp = toBinary(MatrxMessageSchema, apiResponse);
  ws.send(resp, true);
};

const handleDeviceInfoMessage = async (
  ws: WebSocketAdapter,
  message: DeviceInfo
): Promise<void> => {
  const deviceId = ws.getDeviceID();

  try {
    const deviceInfo = {
      width: message.width,
      height: message.height,
      hasLightSensor: message.hasLightSensor,
    };

    await prisma.device.update({
      where: { id: deviceId },
      data: { deviceInfo },
    });

    sendCommandResponse(ws, true);
  } catch (error) {
    logger.error(
      `Failed to update device info: ${deviceId}`,
      error instanceof Error ? error.stack : String(error)
    );
    sendCommandResponse(ws, false);
  }
};

export const matrxMessageHandler = async (
  ws: WebSocketAdapter,
  message: MatrxMessage
): Promise<void> => {
  if (!message.message.case) {
    return;
  }

  logger.debug(`Matrx message received device=${ws.getDeviceID()} type=${message.message.case}`);

  switch (message.message.case) {
    case 'scheduleRequest':
      await handleScheduleRequestMessage(ws);
      return;
    case 'appRenderRequest':
      await handleAppRenderRequestMessage(ws, message.message.value);
      return;
    case 'scheduleItemSetPinState':
      await handleScheduleItemSetPinStateMessage(ws, message.message.value);
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
    case 'currentlyDisplayingApp':
      await handleCurrentlyDisplayingApp(ws, message.message.value);
      return;
    case 'deviceInfo':
      await handleDeviceInfoMessage(ws, message.message.value);
      return;
    case 'certReport':
      await handleCertReport(ws, message.message.value);
      return;
    case 'certRenewRequest':
      await handleCertRenewRequest(ws, message.message.value);
      return;
    default:
      logger.warn(`Unhandled Matrx message type: ${message.message.case}`);
  }
};

const sendFactoryResetRequest = (ws: WebSocketAdapter, reason: string): void => {
  const apiResponse = create(MatrxMessageSchema);
  apiResponse.message.case = 'factoryResetRequest';
  apiResponse.message.value = create(FactoryResetRequestSchema);
  apiResponse.message.value.reason = reason;

  const resp = toBinary(MatrxMessageSchema, apiResponse);
  ws.send(resp, true);
};

export const matrxQueueHandler = async (ws: WebSocketAdapter, message: any) => {
  const msg = message;
  const deviceId = ws.getDeviceID();

  logger.debug(`Queue received device=${deviceId} type=${msg.type}`);

  if (msg.type === 'schedule_update') {
    logger.debug(`Queue sending schedule device=${deviceId}`);
    await handleScheduleRequestMessage(ws);
  } else if (msg.type === 'settings_update') {
    const settings = await getMatrxDeviceSettings(deviceId);
    if (settings) {
      logger.debug(`Queue sending device config device=${deviceId}`);
      sendDeviceConfig(ws, settings);
    } else {
      logger.warn(`Queue no settings found device=${deviceId}`);
    }
  } else if (msg.type === 'factory_reset') {
    logger.log(`Queue sending factory reset device=${deviceId}`);
    sendFactoryResetRequest(ws, msg.reason || 'Factory reset requested');
  } else {
    logger.warn(`Queue unknown message type device=${deviceId} type=${msg.type}`);
  }
};
