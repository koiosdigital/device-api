# Device API

Backend service for Koios device management, providing both REST API and WebSocket connectivity for LANTERN and MATRX devices.

## Architecture

```
src/
├── index.ts              # Application entry point
├── rest/                 # NestJS REST API
│   ├── app.module.ts     # Root module with guards and middleware
│   ├── rest-server.ts    # REST server bootstrap
│   ├── auth/             # OIDC authentication
│   ├── devices/          # Device management endpoints
│   │   ├── installations/  # App installations on devices
│   │   └── sharing/        # Device sharing invites
│   ├── apps/             # App catalog endpoints
│   ├── health/           # Health check endpoint
│   ├── user/             # User profile endpoints
│   ├── guards/           # Authorization guards
│   ├── common/           # Shared filters, decorators, DTOs
│   └── config/           # Constants and configuration
├── wss/                  # WebSocket server
│   ├── server.ts         # WebSocket server bootstrap
│   ├── connection-manager.ts  # Device connection lifecycle
│   ├── lantern/          # LANTERN device handlers
│   ├── matrx/            # MATRX device handlers
│   └── pki/              # Certificate handling
├── shared/               # Shared utilities
│   ├── logger/           # Structured logging service
│   ├── email/            # Email service (MJML templates)
│   ├── matrx-renderer/   # MATRX renderer client
│   └── utils.ts          # Prisma, Redis, helpers
├── generated/            # Generated code (Prisma, OpenAPI types)
└── protobufs/            # Protobuf definitions and generated code
```

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **REST Framework**: NestJS with Express
- **WebSocket**: ws library
- **Database**: PostgreSQL via Prisma ORM
- **Cache/PubSub**: Redis via ioredis
- **Authentication**: OIDC/JWT via jose
- **API Documentation**: Swagger/OpenAPI
- **Build**: Vite + SWC

## Prerequisites

- Node.js 20+
- pnpm
- PostgreSQL
- Redis

## Environment Variables

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/device_api"

# Redis
REDIS_URL="redis://localhost:6379"

# OIDC Configuration
OIDC_ISSUER="https://your-oidc-provider/realms/your-realm"
OIDC_AUDIENCE="account"
OIDC_JWKS_URI="https://your-oidc-provider/realms/your-realm/protocol/openid-connect/certs"

# JWT Secrets
CLAIM_JWT_SECRET="your-claim-secret"
LICENSING_JWT_SECRET="your-licensing-secret"

# Server Ports (optional)
PORT=9091          # WebSocket server
REST_PORT=9090     # REST API server

# Development
NODE_ENV=development
DEBUG_CN=MATRX-DEVICE-ID  # Optional: Force device CN for testing
```

## Installation

```bash
# Install dependencies (also generates Prisma client and protobufs)
pnpm install

# Run database migrations
pnpm prisma migrate dev
```

## Development

```bash
# Start development server with hot reload
pnpm dev

# The servers will start on:
# - REST API: http://localhost:9090
# - WebSocket: ws://localhost:9091
# - Swagger UI: http://localhost:9090/docs
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm start` | Run production build |
| `pnpm lint` | Run ESLint |
| `pnpm lint:fix` | Fix ESLint issues |
| `pnpm format` | Format code with Prettier |
| `pnpm format:check` | Check code formatting |
| `pnpm generate:matrx-renderer` | Generate MATRX renderer types |
| `pnpm generate:licensing-api` | Generate licensing API types |

## API Endpoints

### Authentication

All endpoints (except health) require a valid OIDC JWT token:

```
Authorization: Bearer <access_token>
```

### REST API (v1)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/health` | Health check |
| GET | `/v1/user` | Get current user profile |
| GET | `/v1/devices` | List user's devices |
| GET | `/v1/devices/:id` | Get device details |
| PATCH | `/v1/devices/:id/settings` | Update device settings |
| DELETE | `/v1/devices/:id` | Delete/unclaim device |
| POST | `/v1/devices/:id/claim-token` | Generate claim token |
| GET | `/v1/devices/:id/installations` | List device installations |
| POST | `/v1/devices/:id/installations` | Create installation |
| PATCH | `/v1/devices/:id/installations/:installId` | Update installation |
| DELETE | `/v1/devices/:id/installations/:installId` | Delete installation |
| GET | `/v1/devices/:id/sharing` | List shared users |
| POST | `/v1/devices/:id/sharing/invite` | Send share invite |
| POST | `/v1/sharing/accept` | Accept share invite |
| DELETE | `/v1/devices/:id/sharing/:userId` | Revoke share |
| GET | `/v1/apps` | List available apps |
| GET | `/v1/apps/:id` | Get app details |

Full API documentation available at `/docs` when running the server.

### WebSocket Protocol

Devices connect via WebSocket with mTLS client certificates. The server:
- Authenticates devices via certificate CN
- Manages device state in PostgreSQL
- Broadcasts updates via Redis pub/sub
- Handles device-specific protocols (LANTERN/MATRX via protobufs)

## Rate Limiting

The API includes multi-tier rate limiting:
- **Short**: 10 requests/second
- **Medium**: 50 requests/10 seconds
- **Long**: 200 requests/minute

## Database

### Migrations

```bash
# Create a new migration
pnpm prisma migrate dev --name migration_name

# Apply migrations in production
pnpm prisma migrate deploy

# Reset database (development only)
pnpm prisma migrate reset
```

### Models

- `Device` - Physical devices (LANTERN/MATRX)
- `DeviceSettings` - Per-device configuration
- `DeviceClaims` - Owner/shared user claims
- `DeviceShareInvite` - Pending share invitations
- `MatrxInstallation` - Apps installed on MATRX devices
- `LanternGroup` - LANTERN grouping for synchronized control
- `LanternGroupDevices` - Many-to-many group membership

## Logging

The application uses structured logging via a custom NestJS logger:

```typescript
import { LoggerService } from '@/shared/logger';

// In services
constructor(private readonly logger: LoggerService) {
  this.logger.setContext('MyService');
}

// With context data
this.logger.setContextData({ userId: user.id, deviceId: device.id });
this.logger.log('Processing request');
```

Log levels are environment-aware:
- **Production**: `log`, `warn`, `error`
- **Development**: `log`, `warn`, `error`, `debug`, `verbose`
