import { Module } from '@nestjs/common';
import { SharingController } from './sharing.controller';
import { SharingService } from './sharing.service';
import { AuthModule } from '@/rest/auth/auth.module';
import { OwnerGuard } from '@/rest/guards/owner.guard';

@Module({
  imports: [AuthModule],
  controllers: [SharingController],
  providers: [SharingService, OwnerGuard],
})
export class SharingModule {}
