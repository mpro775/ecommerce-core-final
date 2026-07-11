import { Module } from '@nestjs/common';
import { SecurityModule } from '../security/security.module';
import { ShippingCalculatorService } from './shipping-calculator.service';
import { MerchantFulfillmentController, ShippingController } from './shipping.controller';
import { ShippingRepository } from './shipping.repository';
import { ShippingService } from './shipping.service';

@Module({
  imports: [SecurityModule],
  controllers: [ShippingController, MerchantFulfillmentController],
  providers: [ShippingService, ShippingRepository, ShippingCalculatorService],
  exports: [ShippingService, ShippingRepository, ShippingCalculatorService],
})
export class ShippingModule {}
