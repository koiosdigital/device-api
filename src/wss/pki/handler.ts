import type { WebSocketAdapter } from '@/shared/types';
import type { RenewCertRequest } from '@/protobufs/generated/ts/kd/v1/common_pb';
import { create, toBinary } from '@bufbuild/protobuf';
import { MatrxMessageSchema } from '@/protobufs/generated/ts/kd/v1/matrx_pb';
import { CertResponseSchema } from '@/protobufs/generated/ts/kd/v1/common_pb';
import { signCsr } from './client';

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
  console.log(`[pki] cert renewal request device=${deviceId} csrBytes=${csrBytes}`);

  // Convert CSR bytes to PEM string
  const csrPem = Buffer.from(message.csr).toString('utf8');
  console.log(`[pki] CSR preview device=${deviceId}: ${csrPem.substring(0, 50)}...`);

  // Sign via licensing API
  console.log(`[pki] calling signCsr device=${deviceId}`);
  const result = await signCsr(csrPem);
  console.log(`[pki] signCsr returned device=${deviceId} success=${result.success}`);

  // Build response
  const certResponse = create(CertResponseSchema, {
    success: result.success,
  });

  if (result.success && result.cert) {
    certResponse.deviceCert = Buffer.from(result.cert, 'utf8');
    const certBytes = certResponse.deviceCert.length;
    console.log(`[pki] cert renewal success device=${deviceId} certBytes=${certBytes}`);
  } else {
    certResponse.error = result.error || 'Unknown error';
    console.error(`[pki] cert renewal failed device=${deviceId} error=${result.error}`);
  }

  const apiResponse = create(MatrxMessageSchema, {
    message: {
      case: 'certResponse',
      value: certResponse,
    },
  });

  const resp = toBinary(MatrxMessageSchema, apiResponse);
  console.log(`[pki] sending CertResponse device=${deviceId} responseBytes=${resp.length}`);
  ws.send(resp, true);
  console.log(`[pki] CertResponse sent device=${deviceId}`);
}
