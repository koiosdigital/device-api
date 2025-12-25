import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyResult } from 'jose';

export type AuthenticatedUser = {
  sub: string;
  username?: string;
  email?: string;
  scopes: string[];
  organizationId?: string;
  payload: JWTPayload;
};

@Injectable()
export class OidcAuthService {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;
  private readonly issuer?: string;
  private readonly audience?: string;

  constructor() {
    const jwksUri = process.env.OIDC_JWKS_URI;
    if (!jwksUri) {
      throw new Error('OIDC_JWKS_URI environment variable must be set');
    }

    this.jwks = createRemoteJWKSet(new URL(jwksUri));
    this.issuer = process.env.OIDC_ISSUER || undefined;
    this.audience = process.env.OIDC_AUDIENCE || undefined;
  }

  async verifyToken(token: string): Promise<AuthenticatedUser> {
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      const { payload }: JWTVerifyResult<JWTPayload> = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ['RS256', 'RS512'],
      });

      const scopes = typeof payload.scope === 'string' ? payload.scope.split(' ') : [];

      return {
        sub: payload.sub ?? 'unknown',
        username:
          (payload as Record<string, string>).preferred_username ??
          (payload as Record<string, string>).name,
        email: payload.email as string | undefined,
        organizationId: (payload as Record<string, string>).organization_id,
        scopes,
        payload,
      };
    } catch (error) {
      throw new UnauthorizedException(`Token verification failed: ${(error as Error).message}`);
    }
  }
}
