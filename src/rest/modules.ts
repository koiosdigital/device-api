import { HealthModule } from './health/health.module';
import { TestModule } from './test/test.module';

export const restFeatureModules = [HealthModule, TestModule] as const;
