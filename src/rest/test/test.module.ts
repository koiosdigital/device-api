import { Module } from '@nestjs/common';
import { TestController } from './test.controller';
import { TestService } from './test.service';
import { TestGuard } from './test.guard';

@Module({
  controllers: [TestController],
  providers: [TestService, TestGuard],
})
export class TestModule {}
