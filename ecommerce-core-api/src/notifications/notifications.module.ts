import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsCustomerController } from './notifications-customer.controller';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController, NotificationsCustomerController],
  providers: [NotificationsRepository, NotificationsGateway, NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
