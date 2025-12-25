import { Module } from '@nestjs/common';
import { AppsController } from '@/rest/apps/apps.controller';
import { AppsService } from '@/rest/apps/apps.service';
import { MatrxRendererModule } from '@/shared/matrx-renderer/matrx-renderer.module';

@Module({
  imports: [MatrxRendererModule],
  controllers: [AppsController],
  providers: [AppsService],
})
export class AppsModule {}
