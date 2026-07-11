import { Module } from '@nestjs/common';
import { CurrencyModule } from '../currency/currency.module';
import { MediaModule } from '../media/media.module';
import { SecurityModule } from '../security/security.module';
import { StoreAccessibilityController, StoresController } from './stores.controller';
import { StoresRepository } from './stores.repository';
import { StoresService } from './stores.service';

@Module({
  imports: [SecurityModule, MediaModule, CurrencyModule],
  controllers: [StoresController, StoreAccessibilityController],
  providers: [StoresService, StoresRepository],
  exports: [StoresRepository, StoresService],
})
export class StoresModule {}
