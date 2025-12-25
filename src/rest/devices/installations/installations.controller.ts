import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
  StreamableFile,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiProduces,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { InstallationsService } from './installations.service';
import { SharedGuard } from '@/rest/guards/shared.guard';
import { CurrentUser } from '@/shared/current-user.decorator';
import type { AuthenticatedUser } from '@/rest/auth/oidc-auth.service';
import {
  CreateInstallationDto,
  UpdateInstallationDto,
  InstallationResponseDto,
  InstallationListItemDto,
} from './dto';

@ApiTags('Device Installations')
@ApiBearerAuth()
@Controller({ path: 'devices/:deviceId/installations', version: '1' })
@UseGuards(SharedGuard)
export class InstallationsController {
  constructor(private readonly installationsService: InstallationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new installation for a device' })
  @ApiParam({ name: 'deviceId', description: 'Device ID' })
  @ApiResponse({
    status: 201,
    description: 'Installation created',
    type: InstallationResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 422, description: 'Validation failed' })
  async create(
    @Param('deviceId') deviceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInstallationDto
  ): Promise<InstallationResponseDto> {
    return this.installationsService.create(deviceId, user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all installations for a device' })
  @ApiParam({ name: 'deviceId', description: 'Device ID' })
  @ApiResponse({
    status: 200,
    description: 'List of installations (without config)',
    type: [InstallationListItemDto],
  })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async findAll(
    @Param('deviceId') deviceId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<InstallationListItemDto[]> {
    return this.installationsService.findAll(deviceId, user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific installation with config' })
  @ApiParam({ name: 'deviceId', description: 'Device ID' })
  @ApiParam({ name: 'id', description: 'Installation ID' })
  @ApiResponse({
    status: 200,
    description: 'Installation details',
    type: InstallationResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Installation not found' })
  async findOne(
    @Param('deviceId') deviceId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<InstallationResponseDto> {
    return this.installationsService.findOne(deviceId, id, user.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an installation' })
  @ApiParam({ name: 'deviceId', description: 'Device ID' })
  @ApiParam({ name: 'id', description: 'Installation ID' })
  @ApiResponse({
    status: 200,
    description: 'Installation updated',
    type: InstallationResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Installation not found' })
  @ApiResponse({ status: 422, description: 'Validation failed' })
  async update(
    @Param('deviceId') deviceId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateInstallationDto
  ): Promise<InstallationResponseDto> {
    return this.installationsService.update(deviceId, id, user.sub, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an installation' })
  @ApiParam({ name: 'deviceId', description: 'Device ID' })
  @ApiParam({ name: 'id', description: 'Installation ID' })
  @ApiResponse({ status: 204, description: 'Installation deleted' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Installation not found' })
  async remove(
    @Param('deviceId') deviceId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<void> {
    return this.installationsService.delete(deviceId, id, user.sub);
  }

  @Get(':id/render/:dimensions.gif')
  @ApiProduces('image/gif')
  @ApiOperation({ summary: 'Render installation as GIF using stored config' })
  @ApiParam({ name: 'deviceId', description: 'Device ID' })
  @ApiParam({ name: 'id', description: 'Installation ID' })
  @ApiParam({ name: 'dimensions', description: 'Format: WIDTHxHEIGHT', example: '64x32' })
  @ApiResponse({
    status: 200,
    description: 'Binary GIF render',
    content: {
      'image/gif': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Installation not found' })
  async renderGif(
    @Param('deviceId') deviceId: string,
    @Param('id') id: string,
    @Param('dimensions') dimensions: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response
  ): Promise<StreamableFile> {
    const { width, height } = this.parseDimensions(dimensions);
    const buffer = await this.installationsService.render(
      deviceId,
      id,
      user.sub,
      'gif',
      width,
      height
    );
    this.setImageHeaders(res, 'image/gif', buffer.length);
    return new StreamableFile(buffer);
  }

  @Get(':id/render/:dimensions.webp')
  @ApiProduces('image/webp')
  @ApiOperation({ summary: 'Render installation as WebP using stored config' })
  @ApiParam({ name: 'deviceId', description: 'Device ID' })
  @ApiParam({ name: 'id', description: 'Installation ID' })
  @ApiParam({ name: 'dimensions', description: 'Format: WIDTHxHEIGHT', example: '64x32' })
  @ApiResponse({
    status: 200,
    description: 'Binary WebP render',
    content: {
      'image/webp': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Installation not found' })
  async renderWebp(
    @Param('deviceId') deviceId: string,
    @Param('id') id: string,
    @Param('dimensions') dimensions: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response
  ): Promise<StreamableFile> {
    const { width, height } = this.parseDimensions(dimensions);
    const buffer = await this.installationsService.render(
      deviceId,
      id,
      user.sub,
      'webp',
      width,
      height
    );
    this.setImageHeaders(res, 'image/webp', buffer.length);
    return new StreamableFile(buffer);
  }

  private parseDimensions(dimensions: string): { width: number; height: number } {
    const [widthStr, heightStr] = dimensions.split('x');
    const width = this.toPositiveInteger(widthStr, 'width');
    const height = this.toPositiveInteger(heightStr, 'height');
    return { width, height };
  }

  private toPositiveInteger(value: string, name: string): number {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new BadRequestException(`${name} must be a positive integer`);
    }
    return parsed;
  }

  private setImageHeaders(res: Response, contentType: string, length: number) {
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.setHeader('Content-Length', length.toString());
  }
}
