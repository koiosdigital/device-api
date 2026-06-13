import { Module } from '@nestjs/common';
import { AuthModule } from '@/rest/auth/auth.module';
import { OwnerGuard } from '@/rest/guards/owner.guard';
import { SharedGuard } from '@/rest/guards/shared.guard';
import { DeviceTypeGuard } from '@/rest/guards/device-type.guard';
import { NemotoController } from './nemoto.controller';
import { NemotoFlapsController } from './nemoto-flaps.controller';
import { NemotoService } from './nemoto.service';

@Module({
  imports: [AuthModule],
  controllers: [NemotoController, NemotoFlapsController],
  providers: [NemotoService, OwnerGuard, SharedGuard, DeviceTypeGuard],
  exports: [NemotoService],
})
export class NemotoModule {}
