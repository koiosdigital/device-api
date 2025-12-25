import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { TestService } from './test.service';

@Injectable()
export class TestGuard implements CanActivate {
  constructor(private readonly testService: TestService) {
    console.log('TestGuard constructor called, testService:', testService);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    console.log('TestGuard.canActivate called, testService:', this.testService);
    return this.testService.checkAuth();
  }
}
