import { Module } from '@nestjs/common';
import { StoreCapabilitiesModule } from '../store-capabilities/store-capabilities.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { LoyaltyController } from './loyalty.controller';
import { LoyaltyRepository } from './loyalty.repository';
import { LoyaltyService } from './loyalty.service';

@Module({
  imports: [WebhooksModule, StoreCapabilitiesModule],
  controllers: [LoyaltyController],
  providers: [LoyaltyRepository, LoyaltyService],
  exports: [LoyaltyRepository, LoyaltyService],
})
export class LoyaltyModule {}
