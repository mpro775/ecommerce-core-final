import { Global, Module } from '@nestjs/common';
import { StoreCapabilitiesService } from './store-capabilities.service';

@Global()
@Module({
  providers: [StoreCapabilitiesService],
  exports: [StoreCapabilitiesService],
})
export class StoreCapabilitiesModule {}
