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
  BulkUpdateInstallationsDto,
  BulkUpdateResultDto,
  SetSkipStateDto,
  SetPinStateDto,
  InstallationStateResponseDto,
} from './dto';
import {
  ApiCommonErrorResponses,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiValidationErrorResponse,
} from '@/rest/common';

@ApiTags('Device Installations')
@ApiBearerAuth()
@ApiCommonErrorResponses()
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
  @ApiForbiddenResponse('Access denied')
  @ApiValidationErrorResponse()
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
  @ApiForbiddenResponse('Access denied')
  async findAll(
    @Param('deviceId') deviceId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<InstallationListItemDto[]> {
    return this.installationsService.findAll(deviceId, user.sub);
  }

  @Patch('bulk')
  @ApiOperation({
    summary: 'Bulk update sort order and display times for multiple installations',
  })
  @ApiParam({ name: 'deviceId', description: 'Device ID' })
  @ApiResponse({
    status: 200,
    description: 'Number of installations updated',
    type: BulkUpdateResultDto,
  })
  @ApiForbiddenResponse('Access denied')
  async bulkUpdate(
    @Param('deviceId') deviceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BulkUpdateInstallationsDto
  ): Promise<BulkUpdateResultDto> {
    return this.installationsService.bulkUpdate(deviceId, user.sub, dto.installations);
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
  @ApiForbiddenResponse('Access denied')
  @ApiNotFoundResponse('Installation not found')
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
  @ApiForbiddenResponse('Access denied')
  @ApiNotFoundResponse('Installation not found')
  @ApiValidationErrorResponse()
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
  @ApiForbiddenResponse('Access denied')
  @ApiNotFoundResponse('Installation not found')
  async remove(
    @Param('deviceId') deviceId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<void> {
    return this.installationsService.delete(deviceId, id, user.sub);
  }

  @Patch(':id/skip')
  @ApiOperation({ summary: 'Set skip state for an installation' })
  @ApiParam({ name: 'deviceId', description: 'Device ID' })
  @ApiParam({ name: 'id', description: 'Installation ID' })
  @ApiResponse({
    status: 200,
    description: 'Installation state updated',
    type: InstallationStateResponseDto,
  })
  @ApiForbiddenResponse('Access denied')
  @ApiNotFoundResponse('Installation not found')
  async setSkipState(
    @Param('deviceId') deviceId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SetSkipStateDto
  ): Promise<InstallationStateResponseDto> {
    return this.installationsService.setSkipState(deviceId, id, user.sub, dto.skipped);
  }

  @Patch(':id/pin')
  @ApiOperation({
    summary: 'Set pin state for an installation (unpins any other pinned installation)',
  })
  @ApiParam({ name: 'deviceId', description: 'Device ID' })
  @ApiParam({ name: 'id', description: 'Installation ID' })
  @ApiResponse({
    status: 200,
    description: 'Installation state updated',
    type: InstallationStateResponseDto,
  })
  @ApiForbiddenResponse('Access denied')
  @ApiNotFoundResponse('Installation not found')
  async setPinState(
    @Param('deviceId') deviceId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SetPinStateDto
  ): Promise<InstallationStateResponseDto> {
    return this.installationsService.setPinState(deviceId, id, user.sub, dto.pinned);
  }

  @Get(':id/render.webp')
  @ApiProduces('image/webp')
  @ApiOperation({ summary: 'Render installation as WebP using stored config and device dimensions' })
  @ApiParam({ name: 'deviceId', description: 'Device ID' })
  @ApiParam({ name: 'id', description: 'Installation ID' })
  @ApiResponse({
    status: 200,
    description: 'Binary WebP render',
    content: {
      'image/webp': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiForbiddenResponse('Access denied')
  @ApiNotFoundResponse('Installation or device dimensions not found')
  async renderWebp(
    @Param('deviceId') deviceId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response
  ): Promise<StreamableFile> {
    const buffer = await this.installationsService.render(deviceId, id, user.sub);
    this.setImageHeaders(res, 'image/webp', buffer.length);
    return new StreamableFile(buffer);
  }

  private setImageHeaders(res: Response, contentType: string, length: number) {
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=10'); // 10 seconds
    res.setHeader('Content-Length', length.toString());
  }
}
