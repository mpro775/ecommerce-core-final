import type { ConfigService } from '@nestjs/config';
import type { Channel } from 'amqplib';

export interface NotificationQueueNames {
  mainQueue: string;
  dlqQueue: string;
  retryCreatedQueue: string;
  retryStatusQueue: string;
  retryInventoryQueue: string;
  retryGenericQueue: string;
}

export const NOTIFICATION_ROUTING_PATTERNS = [
  'order.*',
  'payment.*',
  'inventory.*',
  'cart.*',
  'checkout.*',
  'support.*',
  'domain.*',
  'theme.*',
  'analytics.*',
  'customer.*',
];

export function resolveNotificationQueueNames(
  configService: ConfigService,
): NotificationQueueNames {
  return {
    mainQueue: configService.get<string>('NOTIFICATIONS_MAIN_QUEUE', 'notifications.order-events'),
    dlqQueue: configService.get<string>(
      'NOTIFICATIONS_DLQ_QUEUE',
      'notifications.order-events.dlq',
    ),
    retryCreatedQueue: configService.get<string>(
      'NOTIFICATIONS_RETRY_CREATED_QUEUE',
      'notifications.order-created.retry',
    ),
    retryStatusQueue: configService.get<string>(
      'NOTIFICATIONS_RETRY_STATUS_QUEUE',
      'notifications.order-status.retry',
    ),
    retryInventoryQueue: configService.get<string>(
      'NOTIFICATIONS_RETRY_INVENTORY_QUEUE',
      'notifications.inventory.retry',
    ),
    retryGenericQueue: configService.get<string>(
      'NOTIFICATIONS_RETRY_GENERIC_QUEUE',
      'notifications.generic.retry',
    ),
  };
}

export async function bindNotificationMainQueue(
  channel: Channel,
  exchange: string,
  queues: Pick<NotificationQueueNames, 'mainQueue'>,
): Promise<void> {
  await channel.assertQueue(queues.mainQueue, { durable: true });
  for (const pattern of NOTIFICATION_ROUTING_PATTERNS) {
    await channel.bindQueue(queues.mainQueue, exchange, pattern);
  }
}
