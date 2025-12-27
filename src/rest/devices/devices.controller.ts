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
import {
  UpdateLanternSettingsDto,
  UpdateMatrxSettingsDto,
} from '@/rest/devices/dto/update-device-settings.dto';
import { ClaimTokenResponseDto } from '@/rest/devices/dto/claim-token-response.dto';
import type { AuthenticatedUser } from '@/rest/auth/oidc-auth.service';
import { CurrentUser } from '@/shared/current-user.decorator';
import { OwnerGuard } from '@/rest/guards/owner.guard';
import { SharedGuard } from '@/rest/guards/shared.guard';
import {
  ApiCommonErrorResponses,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
} from '@/rest/common';

@ApiTags('Devices')
@ApiBearerAuth()
@ApiCommonErrorResponses()
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
  @ApiForbiddenResponse('Access denied')
  @ApiNotFoundResponse('Device not found')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<DeviceResponseDto> {
    return this.devicesService.getDeviceForUser(id, user.sub);
  }

  @Patch(':id/settings')
  @UseGuards(OwnerGuard)
  @ApiExtraModels(UpdateLanternSettingsDto, UpdateMatrxSettingsDto)
  @ApiOperation({
    summary: 'Update device settings (owner only)',
    description: 'Update display name and type-specific settings. The `type` field must match the device type.',
  })
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
  @ApiForbiddenResponse('Only device owners can update settings')
  @ApiNotFoundResponse('Device not found')
  @ApiBadRequestResponse('Device type mismatch')
  async updateSettings(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateLanternSettingsDto | UpdateMatrxSettingsDto
  ): Promise<DeviceResponseDto> {
    return this.devicesService.updateSettings(id, user.sub, dto);
  }

  @Delete(':id')
  @UseGuards(OwnerGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a device (owner only)' })
  @ApiResponse({ status: 204, description: 'Device deleted successfully' })
  @ApiForbiddenResponse('Only device owners can delete')
  @ApiNotFoundResponse('Device not found')
  async remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.devicesService.deleteDevice(id, user.sub);
  }
}
