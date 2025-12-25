import { HealthModule } from '@/rest/health/health.module';
import { UserModule } from '@/rest/user/user.module';
import { DevicesModule } from '@/rest/devices/devices.module';
import { AppsModule } from '@/rest/apps/apps.module';

export const restFeatureModules = [HealthModule, UserModule, DevicesModule, AppsModule] as const;
