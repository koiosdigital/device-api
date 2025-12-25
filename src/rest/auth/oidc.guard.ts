import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { OidcAuthService } from '@/rest/auth/oidc-auth.service';
import type { AuthenticatedRequest } from '@/rest/auth/auth.types';
import { IS_PUBLIC_KEY } from '@/rest/auth/public.decorator';

@Injectable()
export class OidcAuthGuard implements CanActivate {
  constructor(
    private readonly authService: OidcAuthService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest | (Request & { user?: any })>();

    if (request.user) {
      return true;
    }

    const token = this.extractBearerToken(request);
    request.user = await this.authService.verifyToken(token);
    return true;
  }

  private extractBearerToken(request: Request): string {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }
    return authHeader.slice(7).trim();
  }
}
