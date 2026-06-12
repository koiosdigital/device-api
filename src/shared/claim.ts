import { jwtVerify } from 'jose';
import { LoggerService } from '@/shared/logger';

const logger = new LoggerService();
logger.setServerType('SocketServer');
logger.setContext('Claim');

const claimSecret = process.env.CLAIM_JWT_SECRET;
const claimSecretKey = claimSecret ? Buffer.from(claimSecret, 'utf8') : null;

/**
 * Verifies a device claim token (JWT) and returns the embedded user id, or
 * null if the token is missing, malformed, or fails verification.
 *
 * Device-type agnostic — used by every device handler that supports claiming.
 */
export async function verifyClaimToken(tokenBytes: Uint8Array): Promise<string | null> {
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
