import { Module } from '@nestjs/common';
import { AdvancedOffersModule } from '../advanced-offers/advanced-offers.module';
import { SecurityModule } from '../security/security.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { PromotionsController } from './promotions.controller';
import { PromotionsRepository } from './promotions.repository';
import { PromotionsService } from './promotions.service';

@Module({
  imports: [SecurityModule, WebhooksModule, AdvancedOffersModule],
  controllers: [PromotionsController],
  providers: [PromotionsService, PromotionsRepository],
  exports: [PromotionsService, PromotionsRepository],
})
export class PromotionsModule {}
