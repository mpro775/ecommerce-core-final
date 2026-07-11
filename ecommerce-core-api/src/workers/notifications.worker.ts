import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import amqp, { type Channel, type ChannelModel, type ConsumeMessage } from 'amqplib';
import { AppModule } from '../app.module';
import {
  bindNotificationMainQueue,
  resolveNotificationQueueNames,
  type NotificationQueueNames,
} from '../messaging/notification-rabbitmq-topology';
import { NotificationsService } from '../notifications/notifications.service';

const logger = new Logger('NotificationsWorker');

type QueueNames = NotificationQueueNames;

export async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const configService = app.get(ConfigService);
  const notificationsService = app.get(NotificationsService);

  const rabbitUrl = configService.get<string>('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672');
  const exchange = configService.get<string>('RABBITMQ_EXCHANGE', 'commerce.events');
  const maxRetries = configService.get<number>('NOTIFICATIONS_MAX_RETRIES', 3);
  const retryDelayMs = configService.get<number>('NOTIFICATIONS_RETRY_DELAY_MS', 10_000);
  const connectMaxAttempts = Math.max(
    1,
    configService.get<number>('NOTIFICATIONS_RABBITMQ_CONNECT_MAX_ATTEMPTS', 20),
  );
  const connectRetryDelayMs = Math.max(
    250,
    configService.get<number>('NOTIFICATIONS_RABBITMQ_CONNECT_RETRY_DELAY_MS', 3_000),
  );

  const queues = resolveQueueNames(configService);

  const connection = await connectWithRetry({
    rabbitUrl,
    maxAttempts: connectMaxAttempts,
    delayMs: connectRetryDelayMs,
  });
  const channel = await connection.createChannel();

  await setupTopology(channel, exchange, queues);

  await channel.consume(
    queues.mainQueue,
    async (message) => {
      if (!message) {
        return;
      }

      await handleMessage({
        channel,
        message,
        maxRetries,
        retryDelayMs,
        notificationsService,
        queues,
      });
    },
    { noAck: false },
  );

  connection.on('error', (error) => {
    logger.error(`RabbitMQ connection error: ${error.message}`);
  });

  process.on('SIGINT', async () => {
    await shutdown(channel, connection, app);
  });

  process.on('SIGTERM', async () => {
    await shutdown(channel, connection, app);
  });

  logger.log('Notifications worker is running');
}

async function connectWithRetry(input: {
  rabbitUrl: string;
  maxAttempts: number;
  delayMs: number;
}): Promise<ChannelModel> {
  const { rabbitUrl, maxAttempts, delayMs } = input;

  let attempt = 0;
  let lastError: unknown;

  while (attempt < maxAttempts) {
    attempt += 1;

    try {
      const connection = await amqp.connect(rabbitUrl);
      if (attempt > 1) {
        logger.log(`Connected to RabbitMQ on attempt ${attempt}`);
      }
      return connection;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : 'Unknown RabbitMQ connection error';

      if (attempt >= maxAttempts) {
        logger.error(`Failed to connect to RabbitMQ after ${attempt} attempts: ${message}`);
        break;
      }

      logger.warn(
        `RabbitMQ connection attempt ${attempt}/${maxAttempts} failed: ${message}. Retrying in ${delayMs}ms`,
      );
      await sleep(delayMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to connect to RabbitMQ');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function setupTopology(
  channel: Channel,
  exchange: string,
  queues: QueueNames,
): Promise<void> {
  await channel.assertExchange(exchange, 'topic', { durable: true });

  await bindNotificationMainQueue(channel, exchange, queues);

  await channel.assertQueue(queues.retryCreatedQueue, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': exchange,
      'x-dead-letter-routing-key': 'order.created',
    },
  });

  await channel.assertQueue(queues.retryStatusQueue, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': exchange,
      'x-dead-letter-routing-key': 'order.status.changed',
    },
  });

  await channel.assertQueue(queues.retryInventoryQueue, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': exchange,
      'x-dead-letter-routing-key': 'inventory.low_stock',
    },
  });

  await channel.assertQueue(queues.retryGenericQueue, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': '',
      'x-dead-letter-routing-key': queues.mainQueue,
    },
  });

  await channel.assertQueue(queues.dlqQueue, { durable: true });
}

export async function handleMessage(input: {
  channel: Channel;
  message: ConsumeMessage;
  maxRetries: number;
  retryDelayMs: number;
  notificationsService: NotificationsService;
  queues: QueueNames;
}): Promise<void> {
  const { channel, message, maxRetries, retryDelayMs, notificationsService, queues } = input;
  const eventType = resolveOriginalRoutingKey(message);

  try {
    const payload = parsePayload(message);
    const attempts = extractRetryCount(message) + 1;
    await notificationsService.processEvent({ eventType, payload, attempts });
    channel.ack(message);
  } catch (error) {
    const retries = extractRetryCount(message);
    const nextRetryCount = retries + 1;
    const messageText = error instanceof Error ? error.message : 'Notification processing failed';

    if (nextRetryCount <= maxRetries) {
      publishToRetryQueue(channel, message, eventType, nextRetryCount, retryDelayMs, queues);
      channel.ack(message);
      logger.warn(`Retry scheduled for event ${eventType}. Attempt ${nextRetryCount}`);
      return;
    }

    const payload = safeParsePayload(message);
    await notificationsService.markFailure({
      eventType,
      payload,
      attempts: nextRetryCount,
      errorMessage: messageText,
    });

    channel.publish('', queues.dlqQueue, message.content, {
      persistent: true,
      contentType: 'application/json',
      headers: {
        ...message.properties.headers,
        'x-retry-count': nextRetryCount,
        'x-failed-reason': messageText,
        'x-original-routing-key': eventType,
      },
    });

    channel.ack(message);
    logger.error(`Message moved to DLQ after retries for event ${eventType}`);
  }
}

export function resolveQueueNames(configService: ConfigService): QueueNames {
  return resolveNotificationQueueNames(configService);
}

export function parsePayload(message: ConsumeMessage): Record<string, unknown> {
  return normalizePayload(JSON.parse(message.content.toString()) as Record<string, unknown>);
}

export function safeParsePayload(message: ConsumeMessage): Record<string, unknown> {
  try {
    return parsePayload(message);
  } catch {
    return { raw: message.content.toString() };
  }
}

export function extractRetryCount(message: ConsumeMessage): number {
  const value = message.properties.headers?.['x-retry-count'];
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export function resolveOriginalRoutingKey(message: ConsumeMessage): string {
  const value = message.properties.headers?.['x-original-routing-key'];
  return typeof value === 'string' && value.length > 0 ? value : message.fields.routingKey;
}

export function normalizePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const nestedPayload = payload.payload;
  if (
    nestedPayload &&
    typeof nestedPayload === 'object' &&
    !Array.isArray(nestedPayload) &&
    !('storeId' in payload) &&
    !('orderId' in payload)
  ) {
    return nestedPayload as Record<string, unknown>;
  }

  return payload;
}

export function publishToRetryQueue(
  channel: Channel,
  message: ConsumeMessage,
  eventType: string,
  retryCount: number,
  retryDelayMs: number,
  queues: QueueNames,
): void {
  const queueName = resolveRetryQueueName(eventType, queues);

  channel.publish('', queueName, message.content, {
    persistent: true,
    expiration: String(retryDelayMs),
    contentType: 'application/json',
    headers: {
      ...message.properties.headers,
      'x-retry-count': retryCount,
      'x-original-routing-key': eventType,
    },
  });
}

function resolveRetryQueueName(eventType: string, queues: QueueNames): string {
  if (eventType === 'order.created') {
    return queues.retryCreatedQueue;
  }
  if (eventType === 'inventory.low_stock') {
    return queues.retryInventoryQueue;
  }
  if (eventType === 'inventory.back_in_stock') {
    return queues.retryInventoryQueue;
  }
  if (eventType === 'order.status.changed') {
    return queues.retryStatusQueue;
  }
  return queues.retryGenericQueue;
}

export async function shutdown(
  channel: Channel,
  connection: ChannelModel,
  app: Awaited<ReturnType<typeof NestFactory.createApplicationContext>>,
): Promise<void> {
  await channel.close();
  await connection.close();
  await app.close();
  process.exit(0);
}

if (require.main === module) {
  bootstrap().catch((error: unknown) => {
    logger.error(error instanceof Error ? error.message : 'Failed to start notifications worker');
    process.exit(1);
  });
}
