import type { WebSocketAdapter } from '@/shared/types';
import { create, toBinary } from '@bufbuild/protobuf';
import { X509Certificate } from 'crypto';
import { NemotoMessageSchema, type NemotoMessage } from '@/protobufs/generated/ts/kd/v1/nemoto_pb';
import {
  type CertReport,
  type CertRenewRequest,
  type ClaimDevice,
  JoinResponseSchema,
  PongSchema,
  CertRenewRequiredSchema,
  CertRenewResponseSchema,
} from '@/protobufs/generated/ts/kd/v1/common_pb';
import { handleUploadCoreDump } from '@/shared/handler';
import { verifyClaimToken } from '@/shared/claim';
import { signCsr } from '@/wss/pki';
import { getDefaultTypeSettings, prisma } from '@/shared/utils';
import { LoggerService } from '@/shared/logger';
import {
  applyConfigUpsert,
  applyPresetDelete,
  applyPresetUpsert,
  applyScheduleDelete,
  applyScheduleUpsert,
  buildConfigSyncResponse,
  buildConfigUpsert,
  buildDisplayCell,
  buildDisplayClear,
  buildPresetDelete,
  buildPresetSyncDiff,
  buildPresetUpsert,
  buildReboot,
  buildRunScheduleNow,
  buildScheduleDelete,
  buildScheduleSyncDiff,
  buildScheduleUpsert,
  buildShowPreset,
  ingestFleetSummary,
  ingestOtaProgress,
  ingestSetupStatus,
  ingestSystemInfo,
  recordActivityEvent,
} from '@/wss/nemoto/sync';

const logger = new LoggerService();
logger.setServerType('SocketServer');
logger.setContext('NemotoHandler');

const sendNemotoMessage = (ws: WebSocketAdapter, msg: NemotoMessage): void => {
  ws.send(toBinary(NemotoMessageSchema, msg), true);
};

const THREE_YEARS_MS = 3 * 365 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Outbound helpers (Nemoto-framed)
//
// NOTE: the common sub-messages (joinResponse, cert*, ...) live under different
// field numbers in NemotoMessage than in MatrxMessage, so we cannot reuse the
// matrx/pki send helpers verbatim — they would frame the bytes as a
// MatrxMessage. These thin wrappers re-frame the same payloads for Nemoto.
// ---------------------------------------------------------------------------

export const sendNemotoJoinResponse = (
  ws: WebSocketAdapter,
  options: { isClaimed: boolean; success?: boolean }
): void => {
  const msg = create(NemotoMessageSchema, {
    message: {
      case: 'joinResponse',
      value: create(JoinResponseSchema, {
        success: options.success ?? true,
        isClaimed: options.isClaimed,
        needsClaimed: !options.isClaimed,
      }),
    },
  });
  ws.send(toBinary(NemotoMessageSchema, msg), true);
};

const sendPong = (ws: WebSocketAdapter): void => {
  const msg = create(NemotoMessageSchema, {
    message: { case: 'pong', value: create(PongSchema) },
  });
  ws.send(toBinary(NemotoMessageSchema, msg), true);
};

const sendCertRenewRequired = (ws: WebSocketAdapter, reason: string): void => {
  const msg = create(NemotoMessageSchema, {
    message: {
      case: 'certRenewRequired',
      value: create(CertRenewRequiredSchema, { reason }),
    },
  });
  ws.send(toBinary(NemotoMessageSchema, msg), true);
};

// ---------------------------------------------------------------------------
// Common inbound message handlers
// ---------------------------------------------------------------------------

const handleCertReportMessage = async (
  ws: WebSocketAdapter,
  message: CertReport
): Promise<void> => {
  const deviceId = ws.getDeviceID();
  const certPem = Buffer.from(message.currentCert).toString('utf8');

  try {
    const cert = new X509Certificate(certPem);
    const timeUntilExpiry = new Date(cert.validTo).getTime() - Date.now();
    logger.debug(`Cert report device=${deviceId} expires=${cert.validTo}`);

    if (timeUntilExpiry < THREE_YEARS_MS) {
      const daysUntilExpiry = Math.floor(timeUntilExpiry / (24 * 60 * 60 * 1000));
      logger.log(`Cert renewal required device=${deviceId} daysUntilExpiry=${daysUntilExpiry}`);
      sendCertRenewRequired(ws, `Certificate expires in ${daysUntilExpiry} days`);
    }
  } catch (error) {
    logger.error(
      `Failed to parse cert report device=${deviceId}`,
      error instanceof Error ? error.stack : String(error)
    );
  }
};

const handleCertRenewRequestMessage = async (
  ws: WebSocketAdapter,
  message: CertRenewRequest
): Promise<void> => {
  const deviceId = ws.getDeviceID();
  const csrPem = Buffer.from(message.csr).toString('utf8');
  logger.log(`Cert renewal request device=${deviceId} csrBytes=${message.csr.length}`);

  const result = await signCsr(csrPem);

  const certResponse = create(CertRenewResponseSchema, { success: result.success });
  if (result.success && result.cert) {
    certResponse.deviceCert = Buffer.from(result.cert, 'utf8');
    logger.log(`Cert renewal success device=${deviceId}`);
  } else {
    certResponse.error = result.error || 'Unknown error';
    logger.error(`Cert renewal failed device=${deviceId} error=${result.error}`);
  }

  const msg = create(NemotoMessageSchema, {
    message: { case: 'certRenewResponse', value: certResponse },
  });
  ws.send(toBinary(NemotoMessageSchema, msg), true);
};

const handleClaimDeviceMessage = async (
  ws: WebSocketAdapter,
  message: ClaimDevice
): Promise<void> => {
  const userId = await verifyClaimToken(message.claimToken);
  if (!userId) {
    sendNemotoJoinResponse(ws, { isClaimed: false, success: false });
    return;
  }

  const deviceId = ws.getDeviceID();

  try {
    // Already owned by this user — nothing to do.
    const existingOwner = await prisma.deviceClaims.findFirst({
      where: { deviceId, claimType: 'OWNER' },
    });
    if (existingOwner?.userId === userId) {
      sendNemotoJoinResponse(ws, { isClaimed: true, success: true });
      return;
    }

    // Unclaimed, or owned by someone else — reset ownership and device state.
    // Nemoto has no cloud-side installation tables (presets/schedules live on
    // the device and re-sync after the claim), so we only clear claims and
    // settings here.
    await prisma.$transaction(async (tx) => {
      await tx.deviceClaims.deleteMany({ where: { deviceId } });
      await tx.deviceSettings.deleteMany({ where: { deviceId } });

      await tx.deviceClaims.upsert({
        where: { deviceId_userId: { deviceId, userId } },
        create: { deviceId, userId, claimType: 'OWNER' },
        update: { claimType: 'OWNER' },
      });

      // Re-seed default settings (mirrors the connect-time upsert) so the
      // freshly-claimed device always has a settings row. The device's
      // configUpsert sync overwrites these once it reconnects.
      await tx.deviceSettings.create({
        data: {
          deviceId,
          displayName: deviceId,
          typeSettings: getDefaultTypeSettings('NEMOTO'),
        },
      });
    });

    sendNemotoJoinResponse(ws, { isClaimed: true, success: true });
  } catch (error) {
    logger.error(
      `Failed to claim device: ${deviceId}`,
      error instanceof Error ? error.stack : String(error)
    );
    sendNemotoJoinResponse(ws, { isClaimed: false, success: false });
  }
};

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

export const nemotoMessageHandler = async (
  ws: WebSocketAdapter,
  message: NemotoMessage
): Promise<void> => {
  if (!message.message.case) {
    return;
  }

  const deviceId = ws.getDeviceID();
  logger.debug(`Nemoto message received device=${deviceId} type=${message.message.case}`);

  switch (message.message.case) {
    // --- Liveness ---
    case 'ping':
      sendPong(ws);
      return;

    // --- Common (common.proto) ---
    case 'uploadCoreDump':
      await handleUploadCoreDump(ws, message.message.value);
      return;
    case 'claimDevice':
      await handleClaimDeviceMessage(ws, message.message.value);
      return;
    case 'certReport':
      await handleCertReportMessage(ws, message.message.value);
      return;
    case 'certRenewRequest':
      await handleCertRenewRequestMessage(ws, message.message.value);
      return;

    // --- Bidirectional sync: device requests our full authoritative state ---
    case 'presetSyncRequest':
      sendNemotoMessage(ws, await buildPresetSyncDiff(deviceId));
      return;
    case 'scheduleSyncRequest':
      sendNemotoMessage(ws, await buildScheduleSyncDiff(deviceId));
      return;
    case 'configRequest':
      sendNemotoMessage(ws, await buildConfigSyncResponse(deviceId));
      return;

    // --- Bidirectional sync: device pushes a local edit up (conflict-resolved) ---
    case 'presetUpsert':
      await applyPresetUpsert(deviceId, message.message.value);
      return;
    case 'presetDelete':
      await applyPresetDelete(deviceId, message.message.value);
      return;
    case 'scheduleUpsert':
      await applyScheduleUpsert(deviceId, message.message.value);
      return;
    case 'scheduleDelete':
      await applyScheduleDelete(deviceId, message.message.value);
      return;
    case 'configUpsert':
      await applyConfigUpsert(deviceId, message.message.value);
      return;

    // --- Live state (ephemeral → Redis) ---
    case 'systemInfo':
      await ingestSystemInfo(deviceId, message.message.value);
      return;
    case 'setupStatus':
      await ingestSetupStatus(deviceId, message.message.value);
      return;
    case 'fleetSummary':
      await ingestFleetSummary(deviceId, message.message.value);
      return;
    case 'otaProgress':
      await ingestOtaProgress(deviceId, message.message.value);
      return;

    // --- Activity timeline (→ Postgres) ---
    case 'activityEvent':
      await recordActivityEvent(deviceId, message.message.value);
      return;

    default:
      logger.warn(`Unhandled Nemoto message type: ${message.message.case}`);
  }
};

// Cloud→device fan-out. Messages are published to `device:${deviceId}` by the
// REST layer (notifyNemoto*/publishDeviceMessage); we translate each to the
// corresponding NemotoMessage and send it to the connected device.
export const nemotoQueueHandler = async (ws: WebSocketAdapter, message: any): Promise<void> => {
  const deviceId = ws.getDeviceID();
  const type = message?.type;
  logger.debug(`Queue received device=${deviceId} type=${type}`);

  switch (type) {
    // Sync fan-out (a REST edit changed cloud state).
    case 'nemoto_config_update':
      sendNemotoMessage(ws, await buildConfigUpsert(deviceId));
      return;
    case 'nemoto_preset_upsert': {
      const msg = await buildPresetUpsert(deviceId, message.presetId);
      if (msg) {
        sendNemotoMessage(ws, msg);
      }
      return;
    }
    case 'nemoto_preset_delete':
      sendNemotoMessage(ws, buildPresetDelete(message.presetId));
      return;
    case 'nemoto_schedule_upsert': {
      const msg = await buildScheduleUpsert(deviceId, message.scheduleId);
      if (msg) {
        sendNemotoMessage(ws, msg);
      }
      return;
    }
    case 'nemoto_schedule_delete':
      sendNemotoMessage(ws, buildScheduleDelete(message.scheduleId));
      return;

    // Remote display commands.
    case 'nemoto_show_preset':
      sendNemotoMessage(ws, buildShowPreset(message.presetId, Boolean(message.forceQuiet)));
      return;
    case 'nemoto_display_cell':
      sendNemotoMessage(
        ws,
        buildDisplayCell(message.x, message.y, message.flap, Boolean(message.forceQuiet))
      );
      return;
    case 'nemoto_display_clear':
      sendNemotoMessage(ws, buildDisplayClear(Boolean(message.forceQuiet)));
      return;
    case 'nemoto_run_schedule':
      sendNemotoMessage(ws, buildRunScheduleNow(message.scheduleId, Boolean(message.forceQuiet)));
      return;
    case 'nemoto_reboot':
      sendNemotoMessage(ws, buildReboot());
      return;

    default:
      logger.warn(`Queue unknown message type device=${deviceId} type=${type}`);
  }
};
