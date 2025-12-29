import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { restFeatureModules } from '@/rest/modules';
import { AuthModule } from '@/rest/auth/auth.module';
import { OidcAuthGuard } from '@/rest/auth/oidc.guard';
import { LoggerModule } from '@/shared/logger';

@Module({
  imports: [
    LoggerModule,
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 second
        limit: 20, // 20 requests per second
      },
      {
        name: 'medium',
        ttl: 10000, // 10 seconds
        limit: 100, // 100 requests per 10 seconds
      },
      {
        name: 'long',
        ttl: 60000, // 1 minute
        limit: 300, // 300 requests per minute
      },
    ]),
    AuthModule,
    ...restFeatureModules,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: OidcAuthGuard,
    },
  ],
})
export class AppModule {}
