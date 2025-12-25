import { Module } from '@nestjs/common';
import { OidcAuthService } from '@/rest/auth/oidc-auth.service';
import { OidcAuthGuard } from '@/rest/auth/oidc.guard';

@Module({
  providers: [OidcAuthService, OidcAuthGuard],
  exports: [OidcAuthService, OidcAuthGuard],
})
export class AuthModule {}
