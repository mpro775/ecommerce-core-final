import { Controller, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentCustomer } from '../customers/decorators/current-customer.decorator';
import { CustomerAccessTokenGuard } from '../customers/guards/customer-access-token.guard';
import type { CustomerUser } from '../customers/interfaces/customer-user.interface';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('customers/notifications')
@UseGuards(CustomerAccessTokenGuard)
export class NotificationsCustomerController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('inbox')
  @ApiOkResponse({ description: 'List customer inbox notifications' })
  async listInbox(
    @CurrentCustomer() customer: CustomerUser,
    @Query() query: ListNotificationsQueryDto,
  ) {
    return this.notificationsService.listCustomerInbox(customer, {
      unreadOnly: query.unreadOnly ?? false,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      ...(query.type?.trim() ? { type: query.type.trim() } : {}),
    });
  }

  @Get('unread-count')
  @ApiOkResponse({ description: 'Get unread customer notifications count' })
  async unreadCount(@CurrentCustomer() customer: CustomerUser) {
    return this.notificationsService.countUnreadCustomerNotifications(customer);
  }

  @Patch(':notificationId/read')
  @ApiOkResponse({ description: 'Mark a customer notification as read' })
  async markRead(
    @CurrentCustomer() customer: CustomerUser,
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
  ) {
    await this.notificationsService.markCustomerNotificationRead(customer, notificationId);
    return { ok: true };
  }

  @Patch('read-all')
  @ApiOkResponse({ description: 'Mark all customer notifications as read' })
  async markAllRead(@CurrentCustomer() customer: CustomerUser) {
    return this.notificationsService.markAllCustomerNotificationsRead(customer);
  }
}
