# Matrx Renderer Client

This module provides a type-safe client for the Matrx Renderer service using `openapi-fetch`.

## Setup

### Environment Variable

Set the base URL for the Matrx Renderer service:

```env
MATRX_RENDERER_URL=http://localhost:8080
```

If not set, defaults to `http://localhost:8080`.

### Generating TypeScript Types

To generate the latest TypeScript types from the Matrx Renderer OpenAPI specification:

1. Ensure the Matrx Renderer service is running on `http://localhost:8080`
2. Run the generation script:

```bash
pnpm generate:matrx-renderer
```

This will fetch the OpenAPI spec from `http://localhost:8080/swagger.json` and generate TypeScript types in `src/generated/matrx-renderer.d.ts`.

## Usage

### In a NestJS Module

Import the `MatrxRendererModule` in your module:

```typescript
import { Module } from '@nestjs/common';
import { MatrxRendererModule } from '@/shared/matrx-renderer';

@Module({
  imports: [MatrxRendererModule],
  // ...
})
export class YourModule {}
```

### In a Service

Inject the `MatrxRendererService` to interact with the Matrx Renderer API:

```typescript
import { Injectable } from '@nestjs/common';
import { MatrxRendererService } from '@/shared/matrx-renderer';

@Injectable()
export class YourService {
  constructor(private readonly matrxRenderer: MatrxRendererService) {}

  async listApps() {
    const apps = await this.matrxRenderer.listApps();
    return apps;
  }

  async renderApp(appId: string, config: Record<string, unknown>) {
    const result = await this.matrxRenderer.renderApp(appId, config);
    return result;
  }
}
```

### Using the Raw Client

For advanced usage, you can get the raw `openapi-fetch` client:

```typescript
const client = this.matrxRenderer.getClient();
const { data, error } = await client.GET('/apps/{id}', {
  params: { path: { id: 'clock' } },
});
```

## Available Methods

- `getHealth()` - Check the health status of the renderer service
- `listApps()` - Get all available Pixlet apps
- `getApp(id)` - Get details for a specific app
- `getAppSchema(id)` - Get the configuration schema for an app
- `renderApp(id, config)` - Render an app with the given configuration
- `getClient()` - Get the raw `openapi-fetch` client for advanced usage

## Type Safety

All methods are fully type-safe thanks to the generated types from the OpenAPI specification. TypeScript will provide autocomplete and type checking for:

- API endpoints
- Request parameters
- Request bodies
- Response shapes

## Troubleshooting

If you encounter type errors after updating the Matrx Renderer service:

1. Regenerate the types: `pnpm generate:matrx-renderer`
2. Restart your TypeScript server in VS Code (Cmd+Shift+P → "TypeScript: Restart TS Server")
