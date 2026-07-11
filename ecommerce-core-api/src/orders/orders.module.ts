import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { SecurityModule } from '../security/security.module';
import { ShippingModule } from '../shipping/shipping.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { AffiliatesModule } from '../affiliates/affiliates.module';
import { OrdersController } from './orders.controller';
import { OrdersRepository } from './orders.repository';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    SecurityModule,
    InventoryModule,
    PromotionsModule,
    ShippingModule,
    WebhooksModule,
    LoyaltyModule,
    AffiliatesModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersRepository],
  exports: [OrdersRepository, OrdersService],
})
export class OrdersModule {}
