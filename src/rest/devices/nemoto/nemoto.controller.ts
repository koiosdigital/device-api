import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SharedGuard } from '@/rest/guards/shared.guard';
import { OwnerGuard } from '@/rest/guards/owner.guard';
import { DeviceTypeGuard } from '@/rest/guards/device-type.guard';
import { RequireDeviceType } from '@/rest/guards/require-device-type.decorator';
import { DeviceType } from '@/generated/prisma/enums';
import {
  ApiCommonErrorResponses,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiValidationErrorResponse,
} from '@/rest/common';
import { NemotoService } from './nemoto.service';
import {
  NemotoConfigResponseDto,
  UpdateNemotoConfigDto,
  NemotoPresetListItemDto,
  NemotoPresetResponseDto,
  CreateNemotoPresetDto,
  UpdateNemotoPresetDto,
  NemotoScheduleResponseDto,
  CreateNemotoScheduleDto,
  UpdateNemotoScheduleDto,
  NemotoLiveStateDto,
  NemotoActivityEventDto,
  ListNemotoActivityQueryDto,
  ShowPresetCommandDto,
  DisplayCellCommandDto,
  DisplayClearCommandDto,
  RunScheduleNowCommandDto,
  CommandDispatchResultDto,
} from './dto';

/**
 * Nemoto device routes. Controller-level guards require shared access AND that
 * the device is a NEMOTO device (400 otherwise). Owner-only mutations add
 * OwnerGuard at the method level; shared users may read state and drive live
 * display playback only.
 */
@ApiTags('Device Nemoto')
@ApiBearerAuth()
@ApiCommonErrorResponses()
@ApiForbiddenResponse('Access denied')
@ApiBadRequestResponse('Device is not a Nemoto device')
@Controller({ path: 'devices/:deviceId/nemoto', version: '1' })
@UseGuards(SharedGuard, DeviceTypeGuard)
@RequireDeviceType(DeviceType.NEMOTO)
export class NemotoController {
  constructor(private readonly nemotoService: NemotoService) {}

  // --- Config ----------------------------------------------------------------

  @Get('config')
  @ApiOperation({ summary: 'Get the Nemoto display + quiet-hours config' })
  @ApiParam({ name: 'deviceId', description: 'Device ID' })
  @ApiResponse({ status: 200, description: 'Config document', type: NemotoConfigResponseDto })
  async getConfig(@Param('deviceId') deviceId: string): Promise<NemotoConfigResponseDto> {
    return this.nemotoService.getConfig(deviceId);
  }

  @Put('config')
  @UseGuards(OwnerGuard)
  @ApiOperation({ summary: 'Update the Nemoto config (owner only)' })
  @ApiParam({ name: 'deviceId', description: 'Device ID' })
  @ApiResponse({ status: 200, description: 'Updated config', type: NemotoConfigResponseDto })
  @ApiValidationErrorResponse()
  async updateConfig(
    @Param('deviceId') deviceId: string,
    @Body() dto: UpdateNemotoConfigDto
  ): Promise<NemotoConfigResponseDto> {
    return this.nemotoService.updateConfig(deviceId, dto);
  }

  // --- Presets ---------------------------------------------------------------

  @Get('presets')
  @ApiOperation({ summary: 'List presets (metadata only)' })
  @ApiParam({ name: 'deviceId', description: 'Device ID' })
  @ApiResponse({ status: 200, description: 'Presets', type: [NemotoPresetListItemDto] })
  async listPresets(@Param('deviceId') deviceId: string): Promise<NemotoPresetListItemDto[]> {
    return this.nemotoService.listPresets(deviceId);
  }

  @Get('presets/:presetId')
  @ApiOperation({ summary: 'Get a preset including its flap grid' })
  @ApiParam({ name: 'deviceId', description: 'Device ID' })
  @ApiParam({ name: 'presetId', description: 'Device-local preset id' })
  @ApiResponse({ status: 200, description: 'Preset with flaps', type: NemotoPresetResponseDto })
  @ApiNotFoundResponse('Preset not found')
  async getPreset(
    @Param('deviceId') deviceId: string,
    @Param('presetId', ParseIntPipe) presetId: number
  ): Promise<NemotoPresetResponseDto> {
    return this.nemotoService.getPreset(deviceId, presetId);
  }

  @Post('presets')
  @UseGuards(OwnerGuard)
  @ApiOperation({ summary: 'Create a preset (owner only)' })
  @ApiParam({ name: 'deviceId', description: 'Device ID' })
  @ApiResponse({ status: 201, description: 'Created preset', type: NemotoPresetResponseDto })
  @ApiValidationErrorResponse()
  async createPreset(
    @Param('deviceId') deviceId: string,
    @Body() dto: CreateNemotoPresetDto
  ): Promise<NemotoPresetResponseDto> {
    return this.nemotoService.createPreset(deviceId, dto);
  }

  @Put('presets/:presetId')
  @UseGuards(OwnerGuard)
  @ApiOperation({ summary: 'Update a preset (owner only)' })
  @ApiParam({ name: 'deviceId', description: 'Device ID' })
  @ApiParam({ name: 'presetId', description: 'Device-local preset id' })
  @ApiResponse({ status: 200, description: 'Updated preset', type: NemotoPresetResponseDto })
  @ApiNotFoundResponse('Preset not found')
  @ApiValidationErrorResponse()
  async updatePreset(
    @Param('deviceId') deviceId: string,
    @Param('presetId', ParseIntPipe) presetId: number,
    @Body() dto: UpdateNemotoPresetDto
  ): Promise<NemotoPresetResponseDto> {
    return this.nemotoService.updatePreset(deviceId, presetId, dto);
  }

  @Delete('presets/:presetId')
  @UseGuards(OwnerGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a preset (owner only)' })
  @ApiParam({ name: 'deviceId', description: 'Device ID' })
  @ApiParam({ name: 'presetId', description: 'Device-local preset id' })
  @ApiResponse({ status: 204, description: 'Preset deleted' })
  @ApiNotFoundResponse('Preset not found')
  async deletePreset(
    @Param('deviceId') deviceId: string,
    @Param('presetId', ParseIntPipe) presetId: number
  ): Promise<void> {
    return this.nemotoService.deletePreset(deviceId, presetId);
  }

  // --- Schedules -------------------------------------------------------------

  @Get('schedules')
  @ApiOperation({ summary: 'List schedules' })
  @ApiParam({ name: 'deviceId', description: 'Device ID' })
  @ApiResponse({ status: 200, description: 'Schedules', type: [NemotoScheduleResponseDto] })
  async listSchedules(@Param('deviceId') deviceId: string): Promise<NemotoScheduleResponseDto[]> {
    return this.nemotoService.listSchedules(deviceId);
  }

  @Get('schedules/:scheduleId')
  @ApiOperation({ summary: 'Get a schedule' })
  @ApiParam({ name: 'deviceId', description: 'Device ID' })
  @ApiParam({ name: 'scheduleId', description: 'Device-local schedule id' })
  @ApiResponse({ status: 200, description: 'Schedule', type: NemotoScheduleResponseDto })
  @ApiNotFoundResponse('Schedule not found')
  async getSchedule(
    @Param('deviceId') deviceId: string,
    @Param('scheduleId', ParseIntPipe) scheduleId: number
  ): Promise<NemotoScheduleResponseDto> {
    return this.nemotoService.getSchedule(deviceId, scheduleId);
  }

  @Post('schedules')
  @UseGuards(OwnerGuard)
  @ApiOperation({ summary: 'Create a schedule (owner only)' })
  @ApiParam({ name: 'deviceId', description: 'Device ID' })
  @ApiResponse({ status: 201, description: 'Created schedule', type: NemotoScheduleResponseDto })
  @ApiValidationErrorResponse()
  async createSchedule(
    @Param('deviceId') deviceId: string,
    @Body() dto: CreateNemotoScheduleDto
  ): Promise<NemotoScheduleResponseDto> {
    return this.nemotoService.createSchedule(deviceId, dto);
  }

  @Put('schedules/:scheduleId')
  @UseGuards(OwnerGuard)
  @ApiOperation({ summary: 'Update a schedule (owner only)' })
  @ApiParam({ name: 'deviceId', description: 'Device ID' })
  @ApiParam({ name: 'scheduleId', description: 'Device-local schedule id' })
  @ApiResponse({ status: 200, description: 'Updated schedule', type: NemotoScheduleResponseDto })
  @ApiNotFoundResponse('Schedule not found')
  @ApiValidationErrorResponse()
  async updateSchedule(
    @Param('deviceId') deviceId: string,
    @Param('scheduleId', ParseIntPipe) scheduleId: number,
    @Body() dto: UpdateNemotoScheduleDto
  ): Promise<NemotoScheduleResponseDto> {
    return this.nemotoService.updateSchedule(deviceId, scheduleId, dto);
  }

  @Delete('schedules/:scheduleId')
  @UseGuards(OwnerGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a schedule (owner only)' })
  @ApiParam({ name: 'deviceId', description: 'Device ID' })
  @ApiParam({ name: 'scheduleId', description: 'Device-local schedule id' })
  @ApiResponse({ status: 204, description: 'Schedule deleted' })
  @ApiNotFoundResponse('Schedule not found')
  async deleteSchedule(
    @Param('deviceId') deviceId: string,
    @Param('scheduleId', ParseIntPipe) scheduleId: number
  ): Promise<void> {
    return this.nemotoService.deleteSchedule(deviceId, scheduleId);
  }

  // --- Live state + activity -------------------------------------------------

  @Get('state')
  @ApiOperation({ summary: 'Get live device state (system, setup, fleet, OTA)' })
  @ApiParam({ name: 'deviceId', description: 'Device ID' })
  @ApiResponse({ status: 200, description: 'Live state snapshot', type: NemotoLiveStateDto })
  async getLiveState(@Param('deviceId') deviceId: string): Promise<NemotoLiveStateDto> {
    return this.nemotoService.getLiveState(deviceId);
  }

  @Get('activity')
  @ApiOperation({ summary: 'List recent activity events (newest first)' })
  @ApiParam({ name: 'deviceId', description: 'Device ID' })
  @ApiResponse({ status: 200, description: 'Activity events', type: [NemotoActivityEventDto] })
  async listActivity(
    @Param('deviceId') deviceId: string,
    @Query() query: ListNemotoActivityQueryDto
  ): Promise<NemotoActivityEventDto[]> {
    return this.nemotoService.listActivity(deviceId, query);
  }

  // --- Remote commands -------------------------------------------------------
  // Shared users may drive live playback; reboot is owner-only.

  @Post('commands/show-preset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Show a preset on the display now' })
  @ApiParam({ name: 'deviceId', description: 'Device ID' })
  @ApiResponse({ status: 200, description: 'Dispatch result', type: CommandDispatchResultDto })
  @ApiValidationErrorResponse()
  async showPreset(
    @Param('deviceId') deviceId: string,
    @Body() dto: ShowPresetCommandDto
  ): Promise<CommandDispatchResultDto> {
    return this.nemotoService.showPreset(deviceId, dto);
  }

  @Post('commands/display-cell')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set a single cell on the display now' })
  @ApiParam({ name: 'deviceId', description: 'Device ID' })
  @ApiResponse({ status: 200, description: 'Dispatch result', type: CommandDispatchResultDto })
  @ApiValidationErrorResponse()
  async displayCell(
    @Param('deviceId') deviceId: string,
    @Body() dto: DisplayCellCommandDto
  ): Promise<CommandDispatchResultDto> {
    return this.nemotoService.displayCell(deviceId, dto);
  }

  @Post('commands/display-clear')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear the display now' })
  @ApiParam({ name: 'deviceId', description: 'Device ID' })
  @ApiResponse({ status: 200, description: 'Dispatch result', type: CommandDispatchResultDto })
  async displayClear(
    @Param('deviceId') deviceId: string,
    @Body() dto: DisplayClearCommandDto
  ): Promise<CommandDispatchResultDto> {
    return this.nemotoService.displayClear(deviceId, dto);
  }

  @Post('commands/run-schedule-now')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Run a schedule immediately' })
  @ApiParam({ name: 'deviceId', description: 'Device ID' })
  @ApiResponse({ status: 200, description: 'Dispatch result', type: CommandDispatchResultDto })
  @ApiValidationErrorResponse()
  async runScheduleNow(
    @Param('deviceId') deviceId: string,
    @Body() dto: RunScheduleNowCommandDto
  ): Promise<CommandDispatchResultDto> {
    return this.nemotoService.runScheduleNow(deviceId, dto);
  }

  @Post('commands/reboot')
  @UseGuards(OwnerGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reboot the device (owner only)' })
  @ApiParam({ name: 'deviceId', description: 'Device ID' })
  @ApiResponse({ status: 200, description: 'Dispatch result', type: CommandDispatchResultDto })
  async reboot(@Param('deviceId') deviceId: string): Promise<CommandDispatchResultDto> {
    return this.nemotoService.reboot(deviceId);
  }
}
