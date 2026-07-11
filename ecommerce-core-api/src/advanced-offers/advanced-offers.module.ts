import { Module } from '@nestjs/common';
import { StoreCapabilitiesModule } from '../store-capabilities/store-capabilities.module';
import { SecurityModule } from '../security/security.module';
import { AdvancedOffersController } from './advanced-offers.controller';
import { AdvancedOffersRepository } from './advanced-offers.repository';
import { AdvancedOffersService } from './advanced-offers.service';

@Module({
  imports: [SecurityModule, StoreCapabilitiesModule],
  controllers: [AdvancedOffersController],
  providers: [AdvancedOffersService, AdvancedOffersRepository],
  exports: [AdvancedOffersService, AdvancedOffersRepository],
})
export class AdvancedOffersModule {}
