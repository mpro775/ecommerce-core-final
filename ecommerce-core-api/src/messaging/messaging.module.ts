import { Global, Module } from '@nestjs/common';
import { MESSAGE_PUBLISHER } from './publisher.interface';
import { RabbitMqPublisher } from './rabbitmq.publisher';
import { OutboxService } from './outbox.service';

@Global()
@Module({
  providers: [
    OutboxService,
    {
      provide: MESSAGE_PUBLISHER,
      useClass: RabbitMqPublisher,
    },
  ],
  exports: [MESSAGE_PUBLISHER, OutboxService],
})
export class MessagingModule {}
