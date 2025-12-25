import { Module } from '@nestjs/common';
import { OidcAuthService } from './oidc-auth.service';
import { OidcAuthGuard } from './oidc.guard';

@Module({
  providers: [OidcAuthService, OidcAuthGuard],
  exports: [OidcAuthService, OidcAuthGuard],
})
export class AuthModule {}
