import type { Request } from 'express';
import type { AuthenticatedUser } from './oidc-auth.service';

export type AuthenticatedRequest = Request & { user: AuthenticatedUser };
