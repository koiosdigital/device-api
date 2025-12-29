import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '@/rest/auth/public.decorator';
import {
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { AppsService } from '@/rest/apps/apps.service';
import { AppManifestDto } from '@/rest/apps/dto/app-manifest.dto';
import {
  AppSchemaDto,
  AppSchemaFieldBaseDto,
  AppSchemaOptionDto,
  AppSchemaSoundDto,
  AppSchemaVisibilityDto,
  APP_SCHEMA_FIELD_MODELS,
} from '@/rest/apps/dto/app-schema.dto';
import { RenderResponseDto } from '@/rest/apps/dto/render-response.dto';
import { ValidateSchemaResponseDto } from '@/rest/apps/dto/validate-schema-response.dto';
import {
  CallSchemaHandlerRequestDto,
  CallSchemaHandlerResponseDto,
} from '@/rest/apps/dto/call-schema-handler.dto';
import type { RenderOptions } from '@/shared/matrx-renderer/matrx-renderer.service';
import { ListAppsQueryDto } from '@/rest/apps/dto/list-apps-query.dto';
import { PaginatedAppsResponseDto } from '@/rest/apps/dto/paginated-apps-response.dto';
import {
  ApiCommonErrorResponses,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiValidationErrorResponse,
} from '@/rest/common';

const APP_CONFIG_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  description: 'Configuration object keyed by schema field identifiers',
  example: {
    city: 'seattle',
    units: 'imperial',
  },
};

@ApiTags('Apps')
@ApiBearerAuth()
@ApiCommonErrorResponses()
@ApiExtraModels(
  AppSchemaDto,
  AppSchemaFieldBaseDto,
  AppSchemaOptionDto,
  AppSchemaSoundDto,
  AppSchemaVisibilityDto,
  AppManifestDto,
  RenderResponseDto,
  ValidateSchemaResponseDto,
  CallSchemaHandlerRequestDto,
  CallSchemaHandlerResponseDto,
  PaginatedAppsResponseDto,
  ...APP_SCHEMA_FIELD_MODELS
)
@Controller({ path: 'apps', version: '1' })
export class AppsController {
  constructor(private readonly appsService: AppsService) {}

  @Get()
  @ApiOperation({ summary: 'List all available Pixlet apps with pagination and filtering' })
  @ApiResponse({ status: 200, description: 'Paginated list of apps', type: PaginatedAppsResponseDto })
  async listApps(@Query() query: ListAppsQueryDto): Promise<PaginatedAppsResponseDto> {
    return this.appsService.listAppsPaginated(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details for a specific app' })
  @ApiResponse({ status: 200, description: 'App details', type: AppManifestDto })
  @ApiNotFoundResponse('App not found')
  async getApp(@Param('id') id: string): Promise<AppManifestDto> {
    return this.appsService.getApp(id);
  }

  @Get(':id/schema')
  @ApiOperation({ summary: 'Fetch the schema definition for an app' })
  @ApiResponse({ status: 200, description: 'App schema', type: AppSchemaDto })
  @ApiNotFoundResponse('App not found')
  async getSchema(@Param('id') id: string): Promise<AppSchemaDto> {
    return this.appsService.getSchema(id);
  }

  @Public()
  @SkipThrottle()
  @Get(':id/preview/:dimensions.webp')
  @ApiProduces('image/webp')
  @ApiOperation({ summary: 'Generate a static WebP preview using schema defaults' })
  @ApiQuery({
    name: 'device_id',
    required: false,
    description: 'Optional device identifier',
    example: 'device_123',
  })
  @ApiResponse({
    status: 200,
    description: 'Binary WebP preview',
    content: {
      'image/webp': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiNotFoundResponse('App not found')
  @ApiBadRequestResponse('Invalid dimensions')
  async previewWebp(
    @Param('id') id: string,
    @Param('dimensions') dimensions: string,
    @Query('device_id') deviceId: string | undefined,
    @Res({ passthrough: true }) res: Response
  ): Promise<StreamableFile> {
    const [width, height] = dimensions.split('x');
    const { width: parsedWidth, height: parsedHeight } = this.parseDimensions(width, height);
    const buffer = await this.appsService.getPreview(id, 'webp', {
      width: parsedWidth,
      height: parsedHeight,
      deviceId,
    });
    this.setPreviewHeaders(res, 'image/webp', buffer.length);
    return new StreamableFile(buffer);
  }

  @Public()
  @SkipThrottle()
  @Get(':id/preview/:dimensions.gif')
  @ApiProduces('image/gif')
  @ApiOperation({ summary: 'Generate a static GIF preview using schema defaults' })
  @ApiQuery({
    name: 'device_id',
    required: false,
    description: 'Optional device identifier',
    example: 'device_123',
  })
  @ApiResponse({
    status: 200,
    description: 'Binary GIF preview',
    content: {
      'image/gif': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiNotFoundResponse('App not found')
  @ApiBadRequestResponse('Invalid dimensions')
  async previewGif(
    @Param('id') id: string,
    @Param('dimensions') dimensions: string,
    @Query('device_id') deviceId: string | undefined,
    @Res({ passthrough: true }) res: Response
  ): Promise<StreamableFile> {
    const [width, height] = dimensions.split('x');
    const { width: parsedWidth, height: parsedHeight } = this.parseDimensions(width, height);
    const buffer = await this.appsService.getPreview(id, 'gif', {
      width: parsedWidth,
      height: parsedHeight,
      deviceId,
    });
    this.setPreviewHeaders(res, 'image/gif', buffer.length);
    return new StreamableFile(buffer);
  }

  @Post(':id/render')
  @ApiOperation({ summary: 'Render an app with the provided configuration' })
  @ApiQuery({ name: 'width', required: false, description: 'Device width in pixels', example: 64 })
  @ApiQuery({
    name: 'height',
    required: false,
    description: 'Device height in pixels',
    example: 32,
  })
  @ApiQuery({
    name: 'device_id',
    required: false,
    description: 'Optional device identifier',
    example: 'device_123',
  })
  @ApiBody({ schema: APP_CONFIG_SCHEMA })
  @ApiResponse({ status: 200, description: 'Render result', type: RenderResponseDto })
  @ApiValidationErrorResponse()
  @ApiNotFoundResponse('App not found')
  async renderApp(
    @Param('id') id: string,
    @Body() config: Record<string, unknown>,
    @Query('width') width?: string,
    @Query('height') height?: string,
    @Query('device_id') deviceId?: string
  ): Promise<RenderResponseDto> {
    const options = this.parseRenderOptions(width, height, deviceId);
    return this.appsService.renderApp(id, config, options);
  }

  @Post(':id/validate')
  @ApiOperation({ summary: 'Validate a configuration object against the schema' })
  @ApiBody({ schema: APP_CONFIG_SCHEMA })
  @ApiResponse({ status: 200, description: 'Validation result', type: ValidateSchemaResponseDto })
  @ApiNotFoundResponse('App not found')
  async validateConfig(
    @Param('id') id: string,
    @Body() config: Record<string, unknown>
  ): Promise<ValidateSchemaResponseDto> {
    return this.appsService.validateConfiguration(id, config);
  }

  @Post(':id/call_handler')
  @ApiOperation({ summary: 'Invoke a Pixlet schema handler' })
  @ApiBody({ type: CallSchemaHandlerRequestDto })
  @ApiResponse({ status: 200, description: 'Handler result', type: CallSchemaHandlerResponseDto })
  @ApiNotFoundResponse('App or handler not found')
  async callSchemaHandler(
    @Param('id') id: string,
    @Body() payload: CallSchemaHandlerRequestDto
  ): Promise<CallSchemaHandlerResponseDto> {
    return this.appsService.callSchemaHandler(id, payload);
  }

  private parseDimensions(width: string, height: string): { width: number; height: number } {
    return {
      width: this.toPositiveInteger(width, 'width'),
      height: this.toPositiveInteger(height, 'height'),
    };
  }

  private parseRenderOptions(
    width?: string,
    height?: string,
    deviceId?: string
  ): RenderOptions | undefined {
    const options: RenderOptions = {};
    if (width !== undefined) {
      options.width = this.toPositiveInteger(width, 'width');
    }
    if (height !== undefined) {
      options.height = this.toPositiveInteger(height, 'height');
    }
    if (deviceId !== undefined) {
      options.deviceId = deviceId;
    }
    return Object.keys(options).length > 0 ? options : undefined;
  }

  private toPositiveInteger(value: string, name: string): number {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new BadRequestException(`${name} must be a positive integer`);
    }
    return parsed;
  }

  private setPreviewHeaders(res: Response, contentType: string, length: number) {
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
    res.setHeader('Content-Length', length.toString());
  }
}
