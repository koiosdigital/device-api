import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { prisma } from '@/shared/utils';
import { Public } from '@/rest/auth/public.decorator';
import { HealthResponseDto } from '@/rest/health/dto/health-response.dto';
import { LoggerService } from '@/shared/logger';

@ApiTags('Health')
@Controller({ path: 'health', version: '1' })
export class HealthController {
  private readonly logger = new LoggerService();

  constructor() {
    this.logger.setContext('HealthController');
  }

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
      this.logger.error('Health check failed', error instanceof Error ? error.stack : String(error));
      return {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        database: 'error',
      };
    }
  }
}
