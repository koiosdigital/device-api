import { Module } from '@nestjs/common';
import { HealthController } from '@/rest/health/health.controller';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
