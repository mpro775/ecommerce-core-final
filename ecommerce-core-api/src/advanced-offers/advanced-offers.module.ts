import { Module } from '@nestjs/common';
import { SecurityModule } from '../security/security.module';
import { AdvancedOffersController } from './advanced-offers.controller';
import { AdvancedOffersRepository } from './advanced-offers.repository';
import { AdvancedOffersService } from './advanced-offers.service';

@Module({
  imports: [SecurityModule],
  controllers: [AdvancedOffersController],
  providers: [AdvancedOffersService, AdvancedOffersRepository],
  exports: [AdvancedOffersService, AdvancedOffersRepository],
})
export class AdvancedOffersModule {}
