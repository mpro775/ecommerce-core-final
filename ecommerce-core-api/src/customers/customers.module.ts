import { forwardRef, Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersManagementController } from './customers-management.controller';
import { CustomersRepository } from './customers.repository';
import { CustomersService } from './customers.service';
import { CustomerAccessTokenGuard } from './guards/customer-access-token.guard';
import { StorefrontModule } from '../storefront/storefront.module';
import { CustomersEngagementController } from './customers-engagement.controller';
import { CustomersEngagementManagementController } from './customers-engagement-management.controller';
import { CustomerEngagementService } from './customer-engagement.service';
import { CustomerEngagementRepository } from './customer-engagement.repository';
import { AbandonedCartsRepository } from './abandoned-carts.repository';
import { AbandonedCartsService } from './abandoned-carts.service';
import { LoyaltyModule } from '../loyalty/loyalty.module';

@Module({
  imports: [forwardRef(() => StorefrontModule), LoyaltyModule],
  controllers: [
    CustomersController,
    CustomersEngagementController,
    CustomersEngagementManagementController,
    CustomersManagementController,
  ],
  providers: [
    CustomersService,
    CustomersRepository,
    CustomerAccessTokenGuard,
    CustomerEngagementService,
    CustomerEngagementRepository,
    AbandonedCartsRepository,
    AbandonedCartsService,
  ],
  exports: [
    CustomersService,
    CustomersRepository,
    CustomerAccessTokenGuard,
    CustomerEngagementService,
    CustomerEngagementRepository,
    AbandonedCartsRepository,
    AbandonedCartsService,
  ],
})
export class CustomersModule {}
