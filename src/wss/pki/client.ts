import createClient from 'openapi-fetch';
import type { paths } from '@/generated/licensing-api';
import { createSharedSecretJwt } from '@/shared/auth';

const LICENSING_API_URL = process.env.LICENSING_API_URL || 'https://licensing.api.koiosdigital.net';

export interface SignCsrResult {
  success: boolean;
  cert?: string;
  error?: string;
}

/**
 * Signs a Certificate Signing Request (CSR) using the licensing API.
 *
 * @param csrPem - PEM-encoded CSR string
 * @returns Result with success status and either the certificate chain or an error message
 */
export async function signCsr(csrPem: string): Promise<SignCsrResult> {
  console.log(`[pki] signCsr called, csr length=${csrPem.length}`);

  const secret = process.env.LICENSING_JWT_SECRET;
  if (!secret) {
    console.error('[pki] LICENSING_JWT_SECRET not configured');
    return { success: false, error: 'LICENSING_JWT_SECRET not configured' };
  }

  try {
    console.log(`[pki] creating JWT token for licensing API`);
    const token = await createSharedSecretJwt(secret, {
      sub: 'device-api',
      roles: ['koios-factory'],
    });
    console.log(`[pki] JWT token created`);

    const client = createClient<paths>({ baseUrl: LICENSING_API_URL });

    console.log(`[pki] calling licensing API at ${LICENSING_API_URL}/v1/pki/sign`);
    console.log(`[pki] request body (CSR):\n${csrPem}`);

    const result = await client.POST('/v1/pki/sign', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: { csr: csrPem },
      bodySerializer: (body) => {
        const formData = new FormData();
        formData.append('csr', body.csr);
        return formData;
      },
      parseAs: 'text',
    });

    console.log(`[pki] licensing API response status=${result.response.status}`);

    if (result.error || !result.response.ok) {
      const status = result.response.status;
      let errorMsg = 'Unknown error';

      // Error response might be in result.error as JSON
      if (result.error && typeof result.error === 'object' && 'error' in result.error) {
        errorMsg = (result.error as { error: string }).error;
      } else if (status === 400) {
        errorMsg = 'Invalid CSR';
      } else if (status === 401) {
        errorMsg = 'Missing or invalid token';
      } else if (status === 403) {
        errorMsg = 'Missing koios-factory role';
      } else if (status === 502) {
        errorMsg = 'Signing failed';
      }

      console.error(`[pki] licensing API error: ${errorMsg} (status=${status})`);
      return { success: false, error: errorMsg };
    }

    // Success response is PEM text
    const certificateChain = result.data as string;
    console.log(`[pki] response body (certificate chain):\n${certificateChain}`);
    console.log(`[pki] signing successful, cert length=${certificateChain.length}`);
    return { success: true, cert: certificateChain };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[pki] signCsr error:', message);
    return { success: false, error: message };
  }
}
