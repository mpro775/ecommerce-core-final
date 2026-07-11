import { forwardRef, Module } from '@nestjs/common';
import { AttributesModule } from '../attributes/attributes.module';
import { CategoriesModule } from '../categories/categories.module';
import { CustomersModule } from '../customers/customers.module';
import { CurrencyModule } from '../currency/currency.module';
import { FiltersModule } from '../filters/filters.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { InventoryModule } from '../inventory/inventory.module';
import { OrdersModule } from '../orders/orders.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { ProductsModule } from '../products/products.module';
import { StoreCapabilitiesModule } from '../store-capabilities/store-capabilities.module';
import { ShippingModule } from '../shipping/shipping.module';
import { StoresModule } from '../stores/stores.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { AffiliatesModule } from '../affiliates/affiliates.module';
import { MediaModule } from '../media/media.module';
import { PaymentMethodsModule } from '../payment-methods/payment-methods.module';
import { SeoModule } from '../seo/seo.module';
import { PublicStoreController } from './public-store.controller';
import { StoreResolverService } from './store-resolver.service';
import { StorefrontController } from './storefront.controller';
import { StorefrontTrackingRepository } from './storefront-tracking.repository';
import { StorefrontTrackingService } from './storefront-tracking.service';
import { StorefrontService } from './storefront.service';

@Module({
  imports: [
    StoresModule,
    CategoriesModule,
    AttributesModule,
    FiltersModule,
    ProductsModule,
    OrdersModule,
    InventoryModule,
    ShippingModule,
    PromotionsModule,
    WebhooksModule,
    LoyaltyModule,
    AffiliatesModule,
    MediaModule,
    forwardRef(() => PaymentMethodsModule),
    StoreCapabilitiesModule,
    IdempotencyModule,
    SeoModule,
    CurrencyModule,
    forwardRef(() => CustomersModule),
  ],
  controllers: [StorefrontController, PublicStoreController],
  providers: [
    StorefrontService,
    StoreResolverService,
    StorefrontTrackingRepository,
    StorefrontTrackingService,
  ],
  exports: [StoreResolverService],
})
export class StorefrontModule {}
