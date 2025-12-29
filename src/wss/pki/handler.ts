import type { WebSocketAdapter } from '@/shared/types';
import type { CertReport, CertRenewRequest } from '@/protobufs/generated/ts/kd/v1/common_pb';
import { create, toBinary } from '@bufbuild/protobuf';
import { MatrxMessageSchema } from '@/protobufs/generated/ts/kd/v1/matrx_pb';
import {
  CertRenewRequiredSchema,
  CertRenewResponseSchema,
} from '@/protobufs/generated/ts/kd/v1/common_pb';
import { signCsr } from './client';
import { LoggerService } from '@/shared/logger';
import { X509Certificate } from 'crypto';

const logger = new LoggerService();
logger.setServerType('SocketServer');
logger.setContext('PKI');

const THREE_YEARS_MS = 3 * 365 * 24 * 60 * 60 * 1000;

/**
 * Sends a CertRenewRequired message to the device.
 */
function sendCertRenewRequired(ws: WebSocketAdapter, reason: string): void {
  const apiResponse = create(MatrxMessageSchema, {
    message: {
      case: 'certRenewRequired',
      value: create(CertRenewRequiredSchema, { reason }),
    },
  });

  const resp = toBinary(MatrxMessageSchema, apiResponse);
  ws.send(resp, true);
}

/**
 * Handles certificate report from devices.
 * Parses the certificate, checks expiry, and sends CertRenewRequired if < 3 years.
 */
export async function handleCertReport(ws: WebSocketAdapter, message: CertReport): Promise<void> {
  const deviceId = ws.getDeviceID();
  const certPem = Buffer.from(message.currentCert).toString('utf8');

  try {
    const cert = new X509Certificate(certPem);
    const expiryDate = new Date(cert.validTo);
    const now = new Date();
    const timeUntilExpiry = expiryDate.getTime() - now.getTime();

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
}

/**
 * Handles certificate renewal requests from devices.
 * Receives a CSR, sends it to the licensing API for signing,
 * and returns the signed certificate to the device.
 */
export async function handleCertRenewRequest(
  ws: WebSocketAdapter,
  message: CertRenewRequest
): Promise<void> {
  const deviceId = ws.getDeviceID();
  const csrBytes = message.csr.length;
  logger.log(`Cert renewal request device=${deviceId} csrBytes=${csrBytes}`);

  // Convert CSR bytes to PEM string
  const csrPem = Buffer.from(message.csr).toString('utf8');
  logger.debug(`CSR preview device=${deviceId}: ${csrPem.substring(0, 50)}...`);

  // Sign via licensing API
  logger.debug(`Calling signCsr device=${deviceId}`);
  const result = await signCsr(csrPem);
  logger.debug(`signCsr returned device=${deviceId} success=${result.success}`);

  // Build response
  const certResponse = create(CertRenewResponseSchema, {
    success: result.success,
  });

  if (result.success && result.cert) {
    certResponse.deviceCert = Buffer.from(result.cert, 'utf8');
    const certBytes = certResponse.deviceCert.length;
    logger.log(`Cert renewal success device=${deviceId} certBytes=${certBytes}`);
  } else {
    certResponse.error = result.error || 'Unknown error';
    logger.error(`Cert renewal failed device=${deviceId} error=${result.error}`);
  }

  const apiResponse = create(MatrxMessageSchema, {
    message: {
      case: 'certRenewResponse',
      value: certResponse,
    },
  });

  const resp = toBinary(MatrxMessageSchema, apiResponse);
  logger.debug(`Sending CertRenewResponse device=${deviceId} responseBytes=${resp.length}`);
  ws.send(resp, true);
  logger.debug(`CertRenewResponse sent device=${deviceId}`);
}
