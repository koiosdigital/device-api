import { Controller, Get, UseGuards } from '@nestjs/common';
import { TestGuard } from './test.guard';

@Controller({ path: 'test', version: '1' })
@UseGuards(TestGuard)
export class TestController {
  @Get()
  test(): string {
    return 'Test endpoint works!';
  }
}
