import { Module } from '@nestjs/common';
import { DevicesController } from '@/rest/devices/devices.controller';
import { DevicesService } from '@/rest/devices/devices.service';
import { AuthModule } from '@/rest/auth/auth.module';
import { OwnerGuard } from '@/rest/guards/owner.guard';
import { SharedGuard } from '@/rest/guards/shared.guard';
import { InstallationsModule } from '@/rest/devices/installations/installations.module';
import { SharingModule } from '@/rest/devices/sharing/sharing.module';

@Module({
  imports: [AuthModule, InstallationsModule, SharingModule],
  controllers: [DevicesController],
  providers: [DevicesService, OwnerGuard, SharedGuard],
})
export class DevicesModule {}
