import { Module } from '@nestjs/common';
import { SeoModule } from '../seo/seo.module';
import { ShippingModule } from '../shipping/shipping.module';
import { StoresModule } from '../stores/stores.module';
import { StoreReadinessController } from './store-readiness.controller';
import { StoreReadinessRepository } from './store-readiness.repository';
import { StoreReadinessService } from './store-readiness.service';

@Module({
  imports: [StoresModule, ShippingModule, SeoModule],
  controllers: [StoreReadinessController],
  providers: [StoreReadinessRepository, StoreReadinessService],
  exports: [StoreReadinessService],
})
export class StoreReadinessModule {}
