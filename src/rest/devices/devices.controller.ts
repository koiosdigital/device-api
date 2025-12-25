import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DevicesService } from './devices.service';
import { DeviceResponseDto } from './dto/device-response.dto';
import type { AuthenticatedUser } from '../auth/oidc-auth.service';
import { CurrentUser } from '../../shared/current-user.decorator';

@ApiTags('Devices')
@ApiBearerAuth()
@Controller({ path: 'devices', version: '1' })
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  @ApiOperation({ summary: 'List devices claimed by the current user' })
  @ApiResponse({ status: 200, type: DeviceResponseDto, isArray: true })
  findAll(@CurrentUser() user: AuthenticatedUser): Promise<DeviceResponseDto[]> {
    return this.devicesService.listDevicesForUser(user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve a device claimed by the current user' })
  @ApiResponse({ status: 200, type: DeviceResponseDto })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<DeviceResponseDto> {
    return this.devicesService.getDeviceForUser(id, user.sub);
  }
}
