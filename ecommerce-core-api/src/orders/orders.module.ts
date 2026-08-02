import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { SecurityModule } from '../security/security.module';
import { ShippingModule } from '../shipping/shipping.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { AffiliatesModule } from '../affiliates/affiliates.module';
import { CurrencyModule } from '../currency/currency.module';
import { OrdersController } from './orders.controller';
import { OrdersRepository } from './orders.repository';
import { OrdersService } from './orders.service';
import { OrderTransitionService } from './transitions/order-transition.service';
import { FulfillmentTransitionService } from './transitions/fulfillment-transition.service';

@Module({
  imports: [
    SecurityModule,
    InventoryModule,
    PromotionsModule,
    ShippingModule,
    LoyaltyModule,
    AffiliatesModule,
    CurrencyModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersRepository, OrderTransitionService, FulfillmentTransitionService],
  exports: [OrdersRepository, OrdersService, OrderTransitionService, FulfillmentTransitionService],
})
export class OrdersModule {}
