import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOperation,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { DevicesService } from '@/rest/devices/devices.service';
import {
  type DeviceResponseDto,
  LanternDeviceResponseDto,
  MatrxDeviceResponseDto,
} from '@/rest/devices/dto/device-response.dto';
import { UpdateDeviceDto } from '@/rest/devices/dto/update-device.dto';
import { ClaimTokenResponseDto } from '@/rest/devices/dto/claim-token-response.dto';
import type { AuthenticatedUser } from '@/rest/auth/oidc-auth.service';
import { CurrentUser } from '@/shared/current-user.decorator';
import { OwnerGuard } from '@/rest/guards/owner.guard';
import { SharedGuard } from '@/rest/guards/shared.guard';

@ApiTags('Devices')
@ApiBearerAuth()
@ApiExtraModels(LanternDeviceResponseDto, MatrxDeviceResponseDto)
@Controller({ path: 'devices', version: '1' })
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  @ApiOperation({ summary: 'List all devices owned by the current user' })
  @ApiResponse({
    status: 200,
    description: 'List of devices',
    schema: {
      type: 'array',
      items: {
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
    },
  })
  async findAll(@CurrentUser() user: AuthenticatedUser): Promise<DeviceResponseDto[]> {
    return this.devicesService.listDevicesForUser(user.sub);
  }

  @Get('get_claim_token')
  @ApiOperation({
    summary: 'Generate a short-lived token for device claiming',
    description:
      'Generates a JWT token valid for 10 minutes that a device can use to claim itself to the authenticated user account',
  })
  @ApiResponse({
    status: 200,
    description: 'Claim token generated successfully',
    type: ClaimTokenResponseDto,
  })
  async getClaimToken(@CurrentUser() user: AuthenticatedUser): Promise<ClaimTokenResponseDto> {
    return this.devicesService.generateClaimToken(user.sub);
  }

  @Get(':id')
  @UseGuards(SharedGuard)
  @ApiOperation({ summary: 'Get a specific device (owner or shared access)' })
  @ApiResponse({
    status: 200,
    description: 'Device details',
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
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<DeviceResponseDto> {
    return this.devicesService.getDeviceForUser(id, user.sub);
  }

  @Patch(':id')
  @UseGuards(OwnerGuard)
  @ApiOperation({ summary: 'Update a device (owner only)' })
  @ApiResponse({
    status: 200,
    description: 'Updated device',
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
  @ApiResponse({ status: 403, description: 'Only device owners can update' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() updateDeviceDto: UpdateDeviceDto
  ): Promise<DeviceResponseDto> {
    return this.devicesService.updateDevice(id, user.sub, updateDeviceDto);
  }

  @Delete(':id')
  @UseGuards(OwnerGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a device (owner only)' })
  @ApiResponse({ status: 204, description: 'Device deleted successfully' })
  @ApiResponse({ status: 403, description: 'Only device owners can delete' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  async remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.devicesService.deleteDevice(id, user.sub);
  }
}
