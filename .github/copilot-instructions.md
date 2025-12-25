# Copilot Instructions for Device API

## Project Overview

This is a NestJS-based REST API and WebSocket server for managing IoT devices (Lantern and Matrx). The API provides device management, user authentication via OIDC/JWT, and real-time device communication.

## Core Development Requirements

### 1. Data Transfer Objects (DTOs)

**All incoming and outgoing data MUST use strongly-typed DTOs.**

#### Request DTOs (Incoming Data)

- Use class-validator decorators for validation (`@IsString()`, `@IsOptional()`, `@IsEmail()`, etc.)
- Include constraints like `@MinLength()`, `@MaxLength()`, `@IsEnum()`, etc.
- Use OpenAPI decorators to document all properties
- Place in `src/rest/<module>/dto/` directories

**Example:**

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateDeviceDto {
  @ApiPropertyOptional({
    description: 'Display name for the device',
    example: 'Living Room Matrx',
    minLength: 1,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  displayName?: string;
}
```

#### Response DTOs (Outgoing Data)

- Use OpenAPI decorators on every property (`@ApiProperty()` or `@ApiPropertyOptional()`)
- Include detailed descriptions and examples
- Specify types, formats, enums, and constraints
- Never return raw database entities
- Use discriminated unions for polymorphic types with `oneOf` and `discriminator`

**Example (Simple DTO):**

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClaimType } from '@/generated/prisma/enums';

export class DeviceResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the device',
    example: 'dev_123abc',
    type: String,
  })
  id!: string;

  @ApiProperty({
    description: 'User access level to this device',
    enum: ClaimType,
    enumName: 'ClaimType',
    example: ClaimType.OWNER,
  })
  accessLevel!: ClaimType;
}
```

**Example (Discriminated Union):**

```typescript
// Base class with common properties
class DeviceResponseBaseDto {
  @ApiProperty({ description: 'Device ID', type: String })
  id!: string;

  @ApiProperty({ description: 'Online status', type: Boolean })
  online!: boolean;
}

// Discriminated subtypes
export class MatrxDeviceResponseDto extends DeviceResponseBaseDto {
  @ApiProperty({ enum: ['MATRX'], example: 'MATRX' })
  type!: 'MATRX';

  @ApiPropertyOptional({ type: () => MatrxSettingsDto })
  settings!: MatrxSettingsDto | null;
}

export class LanternDeviceResponseDto extends DeviceResponseBaseDto {
  @ApiProperty({ enum: ['LANTERN'], example: 'LANTERN' })
  type!: 'LANTERN';

  @ApiPropertyOptional({ type: () => LanternSettingsDto })
  settings!: LanternSettingsDto | null;
}

// Union type
export type DeviceResponseDto = MatrxDeviceResponseDto | LanternDeviceResponseDto;
```

**Controller with discriminated union:**

```typescript
@ApiExtraModels(LanternDeviceResponseDto, MatrxDeviceResponseDto)
@Controller('devices')
export class DevicesController {
  @Get(':id')
  @ApiResponse({
    status: 200,
    schema: {
      oneOf: [
        { $ref: getSchemaPath(LanternDeviceResponseDto) },
        { $ref: getSchemaPath(MatrxDeviceResponseDto) },
      ],
      discriminator: {
        propertyName: 'type',
        mapping: {
          LANTERN: getSchemaPath(LanternDeviceResponseDto),
          MATRX: getSchemaPath(MatrxDeviceResponseDto),
        },
      },
    },
  })
  async findOne(@Param('id') id: string): Promise<DeviceResponseDto> {
    // ...
  }
}
```

### 2. OpenAPI/Swagger Documentation

**All endpoints MUST be fully documented with OpenAPI decorators.**

#### Controller-Level

- Use `@ApiTags()` to group endpoints
- Use `@ApiBearerAuth()` for authenticated endpoints

#### Method-Level

- Use `@ApiOperation()` with a clear summary
- Use `@ApiResponse()` for all possible response codes (200, 400, 401, 403, 404, 500)
- Specify the DTO type for success responses
- Include descriptions for error responses

**Example:**

```typescript
@ApiTags('Devices')
@ApiBearerAuth()
@Controller({ path: 'devices', version: '1' })
export class DevicesController {
  @Get(':id')
  @UseGuards(SharedGuard)
  @ApiOperation({ summary: 'Get a specific device (owner or shared access)' })
  @ApiResponse({ status: 200, type: DeviceResponseDto, description: 'Device found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  async findOne(@Param('id') id: string): Promise<DeviceResponseDto> {
    // ...
  }
}
```

### 3. Import Path Aliases

**Always use the `@/` path alias for internal imports.**

```typescript
// ✅ Correct
import { DevicesService } from '@/rest/devices/devices.service';
import { prisma } from '@/shared/utils';

// ❌ Wrong
import { DevicesService } from '../devices/devices.service';
import { prisma } from '../../shared/utils';
```

### 4. Authentication & Authorization

- All endpoints are authenticated by default via the global `OidcAuthGuard`
- Use `@Public()` decorator for public endpoints (e.g., health checks)
- Use route-level guards for fine-grained authorization:
  - `OwnerGuard` - Only device owners
  - `SharedGuard` - Owners and users with shared access

### 5. Error Handling

- Use NestJS built-in exceptions (`NotFoundException`, `ForbiddenException`, `BadRequestException`)
- Include meaningful error messages
- Never expose internal errors or stack traces to clients

### 6. Database Access

- Use Prisma client from `@/shared/utils`
- Never expose raw Prisma types in DTOs
- Map database entities to DTOs in service layer
- Use proper relationships and includes

### 7. Code Organization

```
src/
├── rest/                    # REST API
│   ├── auth/               # Authentication
│   ├── devices/            # Device management
│   │   ├── dto/           # Data Transfer Objects
│   │   ├── devices.controller.ts
│   │   ├── devices.service.ts
│   │   └── devices.module.ts
│   ├── guards/            # Shared authorization guards
│   └── ...
├── shared/                 # Shared utilities
├── wss/                    # WebSocket server
└── generated/             # Prisma generated types
```

### 8. Validation Pipeline

- Global validation pipe is enabled in `rest-server.ts`
- DTOs are automatically validated on incoming requests
- Use `transform: true` to enable type coercion

### 9. Best Practices

- Use async/await for all database operations
- Return proper HTTP status codes (use `@HttpCode()` decorator when needed)
- Keep controllers thin - business logic belongs in services
- Write descriptive API operation summaries
- Use TypeScript strict mode
- Avoid `any` types - always be explicit

### 10. Testing & Documentation

- The API generates OpenAPI documentation at `/docs`
- Test all endpoints through Swagger UI during development
- Ensure DTOs match actual API responses

## Environment Variables

Required variables in `.env`:

- `OIDC_JWKS_URI` - JWKS endpoint for JWT verification
- `OIDC_ISSUER` - Expected token issuer (optional)
- `OIDC_AUDIENCE` - Expected token audience (optional)
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string

## Key Design Decisions

1. **No device creation via REST API** - Devices are created through WebSocket connection
2. **Owner vs Shared access** - Owners have full control; shared users have read access
3. **JWT-based authentication** - All endpoints (except health) require valid JWT
4. **Versioned API** - All endpoints are under `/api/v1/`

## Remember

> "Make the API easy to consume" - Always prioritize clear documentation, strong typing, and validation. Every endpoint should be self-documenting through OpenAPI decorators and DTOs.
