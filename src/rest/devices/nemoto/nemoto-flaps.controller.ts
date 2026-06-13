import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiCommonErrorResponses } from '@/rest/common';
import { NEMOTO_FLAP_COUNT, NEMOTO_FLAPS } from '@/shared/nemoto-flaps';
import { NemotoFlapsResponseDto } from './dto';

/**
 * Static Nemoto flap set. Identical for every device (firmware-defined ordering)
 * so it lives at the type level, not under a device id. Auth-only; no device
 * access or type guard needed.
 */
@ApiTags('Device Nemoto')
@ApiBearerAuth()
@ApiCommonErrorResponses()
@Controller({ path: 'nemoto/flaps', version: '1' })
export class NemotoFlapsController {
  @Get()
  @ApiOperation({ summary: 'Get the static flap set (id → glyph/color), indexed 0-63' })
  @ApiResponse({ status: 200, description: 'Flap set', type: NemotoFlapsResponseDto })
  getFlaps(): NemotoFlapsResponseDto {
    return { flaps: [...NEMOTO_FLAPS], count: NEMOTO_FLAP_COUNT };
  }
}
