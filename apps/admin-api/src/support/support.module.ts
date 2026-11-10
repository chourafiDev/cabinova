import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { FeaturesModule } from '../features/features.module.js';
import { SupportController } from './support.controller.js';
import { SupportScheduler } from './support.scheduler.js';
import { SupportService } from './support.service.js';

@Module({
  imports: [AuthModule, FeaturesModule],
  controllers: [SupportController],
  providers: [SupportService, SupportScheduler],
})
export class SupportModule {}
