import { Module } from '@nestjs/common';
import { SecurityModule } from '../security/security.module';
import { StoreCapabilitiesModule } from '../store-capabilities/store-capabilities.module';
import { StoresModule } from '../stores/stores.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsRepository } from './analytics.repository';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [SecurityModule, StoresModule, StoreCapabilitiesModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsRepository],
  exports: [AnalyticsService, AnalyticsRepository],
})
export class AnalyticsModule {}
