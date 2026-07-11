import { Module } from '@nestjs/common';
import { StoreCapabilitiesModule } from '../store-capabilities/store-capabilities.module';
import { SecurityModule } from '../security/security.module';
import { WebhooksController } from './webhooks.controller';
import { WebhooksRepository } from './webhooks.repository';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [SecurityModule, StoreCapabilitiesModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhooksRepository],
  exports: [WebhooksService],
})
export class WebhooksModule {}
