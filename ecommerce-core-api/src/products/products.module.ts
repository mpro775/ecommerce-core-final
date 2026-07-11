import { Module } from '@nestjs/common';
import { AttributesModule } from '../attributes/attributes.module';
import { BrandsModule } from '../brands/brands.module';
import { CategoriesModule } from '../categories/categories.module';
import { CurrencyModule } from '../currency/currency.module';
import { StoreCapabilitiesModule } from '../store-capabilities/store-capabilities.module';
import { SecurityModule } from '../security/security.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { WarehousesModule } from '../warehouses/warehouses.module';
import { FiltersRepository } from '../filters/filters.repository';
import { ProductsController } from './products.controller';
import { ProductsRepository } from './products.repository';
import { ProductsService } from './products.service';

@Module({
  imports: [
    SecurityModule,
    BrandsModule,
    CategoriesModule,
    CurrencyModule,
    AttributesModule,
    StoreCapabilitiesModule,
    WebhooksModule,
    WarehousesModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService, ProductsRepository, FiltersRepository],
  exports: [ProductsService, ProductsRepository],
})
export class ProductsModule {}
