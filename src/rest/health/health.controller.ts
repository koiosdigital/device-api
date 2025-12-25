import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { prisma } from '@/shared/utils';
import { Public } from '@/rest/auth/public.decorator';
import { HealthResponseDto } from '@/rest/health/dto/health-response.dto';

@ApiTags('Health')
@Controller({ path: 'health', version: '1' })
export class HealthController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'Readiness probe' })
  @ApiResponse({ status: 200, type: HealthResponseDto, description: 'Health check successful' })
  async getHealth(): Promise<HealthResponseDto> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'up',
      };
    } catch (error) {
      console.error(error);
      return {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        database: 'error',
      };
    }
  }
}
