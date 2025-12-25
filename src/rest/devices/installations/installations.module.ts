import { Module } from '@nestjs/common';
import { InstallationsController } from './installations.controller';
import { InstallationsService } from './installations.service';
import { MatrxRendererModule } from '@/shared/matrx-renderer/matrx-renderer.module';
import { AuthModule } from '@/rest/auth/auth.module';
import { SharedGuard } from '@/rest/guards/shared.guard';

@Module({
  imports: [MatrxRendererModule, AuthModule],
  controllers: [InstallationsController],
  providers: [InstallationsService, SharedGuard],
  exports: [InstallationsService],
})
export class InstallationsModule {}
