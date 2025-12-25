import { Injectable, type OnModuleInit } from '@nestjs/common';
import createClient, { type Client } from 'openapi-fetch';
import type { operations, paths } from '@/generated/matrx-renderer';

export class MatrxRendererRequestError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'MatrxRendererRequestError';
  }
}

export interface RenderOptions {
  width?: number;
  height?: number;
  deviceId?: string;
}

@Injectable()
export class MatrxRendererService implements OnModuleInit {
  private client!: Client<paths>;

  onModuleInit() {
    const baseUrl = process.env.MATRX_RENDERER_URL || 'http://localhost:8080';
    this.client = createClient<paths>({ baseUrl });
  }

  /**
   * Get the OpenAPI client for the Matrx Renderer service
   */
  getClient(): Client<paths> {
    return this.client;
  }

  /**
   * Get health status of the renderer service
   */
  async getHealth() {
    const result = await this.client.GET('/health');
    return this.unwrap(result, 'Failed to fetch renderer health');
  }

  /**
   * List all available Pixlet apps
   */
  async listApps() {
    const result = await this.client.GET('/apps');
    return this.unwrap(result, 'Failed to fetch apps');
  }

  /**
   * Get details for a specific app
   */
  async getApp(id: string) {
    const result = await this.client.GET('/apps/{id}', {
      params: { path: { id } },
    });
    return this.unwrap(result, `Failed to fetch app ${id}`);
  }

  /**
   * Get schema for a specific app
   */
  async getAppSchema(id: string) {
    const result = await this.client.GET('/apps/{id}/schema', {
      params: { path: { id } },
    });
    return this.unwrap(result, `Failed to fetch schema for app ${id}`);
  }

  /**
   * Validate configuration for an app
   */
  async validateSchema(id: string, config: Record<string, unknown>) {
    const result = await this.client.POST('/apps/{id}/schema', {
      params: { path: { id } },
      body: config,
    });
    return this.unwrap(result, `Failed to validate configuration for app ${id}`);
  }

  /**
   * Render an app with the given configuration
   */
  async renderApp(id: string, config: Record<string, unknown>, options?: RenderOptions) {
    const result = await this.client.POST('/apps/{id}/render', {
      params: {
        path: { id },
        query: this.buildRenderQuery(options),
      },
      body: config,
    });
    return this.unwrap(result, `Failed to render app ${id}: ${JSON.stringify(result.error)}`);
  }

  /**
   * Retrieve a static preview for the app
   */
  async previewApp(id: string, format: 'webp' | 'gif', options?: RenderOptions) {
    const path = format === 'webp' ? '/apps/{id}/preview.webp' : '/apps/{id}/preview.gif';
    const result = await this.client.GET(path, {
      params: {
        path: { id },
        query: this.buildPreviewQuery(options),
      },
      parseAs: 'arrayBuffer',
    });
    return this.unwrap(
      result,
      `Failed to generate ${format} preview for app ${id}: ${result.error}`
    );
  }

  /**
   * Invoke a Pixlet schema handler
   */
  async callSchemaHandler(
    id: string,
    payload: NonNullable<
      operations['callSchemaHandler']['requestBody']
    >['content']['application/json']
  ) {
    const result = await this.client.POST('/apps/{id}/call_handler', {
      params: { path: { id } },
      body: payload,
    });
    return this.unwrap(result, `Failed to call schema handler for app ${id}`);
  }

  private buildRenderQuery(options?: RenderOptions) {
    if (!options) {
      return undefined;
    }
    const query: NonNullable<operations['renderApp']['parameters']['query']> = {};
    if (options.width !== undefined) {
      query.width = options.width;
    }
    if (options.height !== undefined) {
      query.height = options.height;
    }
    if (options.deviceId !== undefined) {
      query.device_id = options.deviceId;
    }
    return Object.keys(query).length ? query : undefined;
  }

  private buildPreviewQuery(options?: RenderOptions) {
    if (!options) {
      return undefined;
    }
    const query: NonNullable<operations['previewWebP']['parameters']['query']> = {};
    if (options.width !== undefined) {
      query.width = options.width;
    }
    if (options.height !== undefined) {
      query.height = options.height;
    }
    if (options.deviceId !== undefined) {
      query.device_id = options.deviceId;
    }
    return Object.keys(query).length ? query : undefined;
  }

  private unwrap<T>(
    result: { data?: T | null; error?: unknown; response: { status: number } },
    message: string
  ): T {
    if (result.error) {
      this.toRequestError(result.response.status, result.error, message);
    }
    if (result.data == null) {
      throw new MatrxRendererRequestError(message);
    }
    return result.data;
  }

  private toRequestError(status: number, cause: unknown, message: string): never {
    const requestError = new MatrxRendererRequestError(message, status);
    (requestError as Error & { cause?: unknown }).cause = cause;
    throw requestError;
  }
}
