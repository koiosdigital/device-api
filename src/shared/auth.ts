import { SignJWT } from 'jose';

export interface SharedSecretJwtClaims {
  sub: string;
  roles?: string[];
  groups?: string[];
}

/**
 * Creates a JWT token signed with a shared secret (HMAC-SHA256).
 * Used for authenticating with internal services that accept shared-secret JWTs.
 *
 * @param secret - The shared secret key
 * @param claims - JWT claims including sub (subject) and optional roles/groups
 * @param expiresInSeconds - Token expiry time in seconds (default: 1 hour)
 * @returns Signed JWT token string
 */
export async function createSharedSecretJwt(
  secret: string,
  claims: SharedSecretJwtClaims,
  expiresInSeconds = 3600
): Promise<string> {
  const secretKey = Buffer.from(secret, 'utf8');
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({
    ...claims,
    jti: crypto.randomUUID(), // Required for replay prevention
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + expiresInSeconds)
    .sign(secretKey);
}
