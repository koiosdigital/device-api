import { Injectable } from '@nestjs/common';

@Injectable()
export class TestService {
  checkAuth(): boolean {
    console.log('TestService.checkAuth called');
    return true;
  }
}
