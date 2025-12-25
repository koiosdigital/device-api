import { Module } from '@nestjs/common';
import { MatrxRendererService } from '@/shared/matrx-renderer/matrx-renderer.service';

@Module({
  providers: [MatrxRendererService],
  exports: [MatrxRendererService],
})
export class MatrxRendererModule {}
