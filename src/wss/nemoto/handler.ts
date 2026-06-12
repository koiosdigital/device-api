import type { WebSocketAdapter } from '@/shared/types';
import { create, toBinary } from '@bufbuild/protobuf';
import { X509Certificate } from 'crypto';
import {
  NemotoMessageSchema,
  type NemotoMessage,
} from '@/protobufs/generated/ts/kd/v1/nemoto_pb';
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
import { prisma } from '@/shared/utils';
import { LoggerService } from '@/shared/logger';

const logger = new LoggerService();
logger.setServerType('SocketServer');
logger.setContext('NemotoHandler');

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

  logger.debug(`Nemoto message received device=${ws.getDeviceID()} type=${message.message.case}`);

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

    // --- Nemoto-specific (not yet implemented) ---
    case 'systemInfo':
    case 'setupStatus':
    case 'fleetSummary':
    case 'activityEvent':
    case 'presetSyncRequest':
    case 'presetUpsert':
    case 'presetDelete':
    case 'scheduleSyncRequest':
    case 'scheduleUpsert':
    case 'scheduleDelete':
    case 'configRequest':
    case 'configUpsert':
    case 'otaProgress':
      logger.warn(`Nemoto message type not yet implemented: ${message.message.case}`);
      return;

    default:
      logger.warn(`Unhandled Nemoto message type: ${message.message.case}`);
  }
};

export const nemotoQueueHandler = async (ws: WebSocketAdapter, message: any): Promise<void> => {
  // TODO: implement cloud->device fan-out (preset/schedule/config sync, remote
  // display commands, OTA) once those features land.
  logger.debug(`Queue received device=${ws.getDeviceID()} type=${message?.type}`);
};
