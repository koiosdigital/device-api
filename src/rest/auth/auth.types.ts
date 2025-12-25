import type { Request } from 'express';
import type { AuthenticatedUser } from '@/rest/auth/oidc-auth.service';

export type AuthenticatedRequest = Request & { user: AuthenticatedUser };
