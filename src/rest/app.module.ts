import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { restFeatureModules } from '@/rest/modules';
import { AuthModule } from '@/rest/auth/auth.module';
import { OidcAuthGuard } from '@/rest/auth/oidc.guard';

@Module({
  imports: [AuthModule, ...restFeatureModules],
  providers: [
    {
      provide: APP_GUARD,
      useClass: OidcAuthGuard,
    },
  ],
})
export class AppModule {}
