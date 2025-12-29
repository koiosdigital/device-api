import type { WebSocketAdapter } from '@/shared/types';
import type { RenewCertRequest } from '@/protobufs/generated/ts/kd/v1/common_pb';
import { create, toBinary } from '@bufbuild/protobuf';
import { MatrxMessageSchema } from '@/protobufs/generated/ts/kd/v1/matrx_pb';
import { CertResponseSchema } from '@/protobufs/generated/ts/kd/v1/common_pb';
import { signCsr } from './client';
import { LoggerService } from '@/shared/logger';

const logger = new LoggerService();
logger.setServerType('SocketServer');
logger.setContext('PKI');

/**
 * Handles certificate renewal requests from devices.
 * Receives a CSR, sends it to the licensing API for signing,
 * and returns the signed certificate to the device.
 */
export async function handleRenewCertRequest(
  ws: WebSocketAdapter,
  message: RenewCertRequest
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
  const certResponse = create(CertResponseSchema, {
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
      case: 'certResponse',
      value: certResponse,
    },
  });

  const resp = toBinary(MatrxMessageSchema, apiResponse);
  logger.debug(`Sending CertResponse device=${deviceId} responseBytes=${resp.length}`);
  ws.send(resp, true);
  logger.debug(`CertResponse sent device=${deviceId}`);
}
