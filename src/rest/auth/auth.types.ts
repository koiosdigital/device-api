import type { Request } from 'express';
import type { AuthenticatedUser } from '@/rest/auth/oidc-auth.service';
import type { DeviceType } from '@/generated/prisma/enums';

export type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
  // Populated by DeviceTypeGuard after it resolves the route's device.
  device?: { id: string; type: DeviceType };
};
