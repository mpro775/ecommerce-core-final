import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SupportController } from './support.controller';
import { SupportCustomerController } from './support-customer.controller';
import { SupportRepository } from './support.repository';
import { SupportService } from './support.service';

@Module({
  imports: [CustomersModule, NotificationsModule],
  controllers: [SupportController, SupportCustomerController],
  providers: [SupportRepository, SupportService],
  exports: [SupportService, SupportRepository],
})
export class SupportModule {}
