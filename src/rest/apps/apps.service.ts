import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { components } from '@/generated/matrx-renderer';
import {
  MatrxRendererRequestError,
  MatrxRendererService,
  type RenderOptions,
} from '@/shared/matrx-renderer/matrx-renderer.service';
import { redis } from '@/shared/utils';
import { AppManifestDto } from '@/rest/apps/dto/app-manifest.dto';
import {
  AppSchemaDto,
  type AppSchemaFieldDto,
  AppSchemaNotificationFieldDto,
} from '@/rest/apps/dto/app-schema.dto';
import { RenderResponseDto } from '@/rest/apps/dto/render-response.dto';
import { ValidateSchemaResponseDto } from '@/rest/apps/dto/validate-schema-response.dto';
import type { CallSchemaHandlerRequestDto } from '@/rest/apps/dto/call-schema-handler.dto';
import { CallSchemaHandlerResponseDto } from '@/rest/apps/dto/call-schema-handler.dto';
import { ListAppsQueryDto } from '@/rest/apps/dto/list-apps-query.dto';
import { PaginatedAppsResponseDto } from '@/rest/apps/dto/paginated-apps-response.dto';

const CACHE_TTL_SECONDS = 300; // 5 minutes
const REDIS_KEY_PREFIX = 'matrx-renderer:';

@Injectable()
export class AppsService {
  private appsListCache: AppManifestDto[] | null = null;
  private appsListCacheExpiry: number = 0;

  constructor(private readonly matrxRendererService: MatrxRendererService) {}

  async listApps(): Promise<AppManifestDto[]> {
    const now = Date.now();
    if (this.appsListCache && now < this.appsListCacheExpiry) {
      return this.appsListCache;
    }

    const apps = await this.safeCall(() => this.matrxRendererService.listApps());
    const mapped = apps.map((app) => this.mapManifest(app));

    this.appsListCache = mapped;
    this.appsListCacheExpiry = now + CACHE_TTL_SECONDS * 1000;

    return mapped;
  }

  async listAppsPaginated(query: ListAppsQueryDto): Promise<PaginatedAppsResponseDto> {
    let apps = await this.listApps();

    if (query.search) {
      const searchLower = query.search.toLowerCase();
      apps = apps.filter(
        (app) =>
          app.name.toLowerCase().includes(searchLower) ||
          app.summary.toLowerCase().includes(searchLower) ||
          app.author.toLowerCase().includes(searchLower)
      );
    }

    apps = this.sortApps(apps, query.sortBy, query.order);

    const total = apps.length;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;

    const paginatedApps = apps.slice(offset, offset + limit);

    return {
      data: paginatedApps,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasPrevious: page > 1,
        hasNext: page < totalPages,
      },
    };
  }

  private sortApps(
    apps: AppManifestDto[],
    sortBy: 'name' | 'author' = 'name',
    order: 'asc' | 'desc' = 'asc'
  ): AppManifestDto[] {
    const sorted = [...apps].sort((a, b) => {
      let comparison = 0;

      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'author') {
        comparison = a.author.localeCompare(b.author);
      }

      return order === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }

  async getApp(id: string): Promise<AppManifestDto> {
    const cacheKey = `${REDIS_KEY_PREFIX}app:${id}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as AppManifestDto;
    }

    const app = await this.safeCall(() => this.matrxRendererService.getApp(id));
    const mapped = this.mapManifest(app);

    await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(mapped));
    return mapped;
  }

  async getSchema(id: string): Promise<AppSchemaDto> {
    const cacheKey = `${REDIS_KEY_PREFIX}schema:${id}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as AppSchemaDto;
    }

    const schema = await this.safeCall(() => this.matrxRendererService.getAppSchema(id));
    const mapped = this.mapSchema(schema);

    await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(mapped));
    return mapped;
  }

  async validateConfiguration(
    id: string,
    config: Record<string, unknown>
  ): Promise<ValidateSchemaResponseDto> {
    const result = await this.safeCall(() => this.matrxRendererService.validateSchema(id, config));
    return this.mapValidateResponse(result);
  }

  async renderApp(
    id: string,
    config: Record<string, unknown>,
    options?: RenderOptions
  ): Promise<RenderResponseDto> {
    const result = await this.safeCall(() =>
      this.matrxRendererService.renderApp(id, config, options)
    );
    return this.mapRenderResponse(result);
  }

  async getPreview(id: string, format: 'webp' | 'gif', options?: RenderOptions): Promise<Buffer> {
    const buffer = await this.safeCall(() =>
      this.matrxRendererService.previewApp(id, format, options)
    );
    return Buffer.from(buffer);
  }

  async callSchemaHandler(
    id: string,
    payload: CallSchemaHandlerRequestDto
  ): Promise<CallSchemaHandlerResponseDto> {
    const response = await this.safeCall(() =>
      this.matrxRendererService.callSchemaHandler(id, {
        handler_name: payload.handler_name,
        data: payload.data,
      })
    );
    return this.mapCallHandlerResponse(response);
  }

  private mapManifest(manifest: components['schemas']['AppManifest']): AppManifestDto {
    return { ...manifest };
  }

  private mapSchema(schema: components['schemas']['AppSchema']): AppSchemaDto {
    return {
      version: schema.version,
      schema: (schema.schema?.map((field) => ({ ...field })) ?? []) as AppSchemaFieldDto[],
      notifications: schema.notifications?.map((field) => ({ ...field })) as
        | AppSchemaNotificationFieldDto[]
        | undefined,
    };
  }

  private mapValidateResponse(
    response: components['schemas']['ValidateSchemaResponse']
  ): ValidateSchemaResponseDto {
    return {
      valid: response.valid,
      errors: response.errors ? response.errors.map((error) => ({ ...error })) : undefined,
      normalized_config: response.normalized_config ? { ...response.normalized_config } : {},
    };
  }

  private mapRenderResponse(response: components['schemas']['RenderResponse']): RenderResponseDto {
    return {
      result: { ...response.result },
      normalized_config: response.normalized_config ? { ...response.normalized_config } : {},
    };
  }

  private mapCallHandlerResponse(
    response: components['schemas']['CallSchemaHandlerResponse']
  ): CallSchemaHandlerResponseDto {
    return { result: response.result };
  }

  private async safeCall<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      this.handleRendererError(error);
    }
  }

  private handleRendererError(error: unknown): never {
    if (error instanceof MatrxRendererRequestError) {
      switch (error.status) {
        case 400:
          throw new BadRequestException(error.message, { cause: error });
        case 404:
          throw new NotFoundException(error.message, { cause: error });
        case 422:
          throw new UnprocessableEntityException(error.message, { cause: error });
        default:
          throw new InternalServerErrorException(error.message, { cause: error });
      }
    }
    throw error;
  }
}
