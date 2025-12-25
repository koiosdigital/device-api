import { Module } from '@nestjs/common';
import { restFeatureModules } from './modules';

@Module({
  imports: [...restFeatureModules],
})
export class AppModule {}
