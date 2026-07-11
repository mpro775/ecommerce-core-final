import { forwardRef, Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { StorefrontModule } from '../storefront/storefront.module';
import {
  MerchantPaymentMethodsController,
  PlatformPaymentMethodsController,
  StorefrontPaymentMethodsController,
} from './payment-methods.controller';
import { PaymentMethodsRepository } from './payment-methods.repository';
import { PaymentMethodsService } from './payment-methods.service';

@Module({
  controllers: [
    PlatformPaymentMethodsController,
    MerchantPaymentMethodsController,
    StorefrontPaymentMethodsController,
  ],
  providers: [PaymentMethodsService, PaymentMethodsRepository],
  exports: [PaymentMethodsService, PaymentMethodsRepository],
})
export class PaymentMethodsModule {}
