import { Module } from '@nestjs/common';
import { UserController } from '@/rest/user/user.controller';
import { AuthModule } from '@/rest/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [UserController],
})
export class UserModule {}
