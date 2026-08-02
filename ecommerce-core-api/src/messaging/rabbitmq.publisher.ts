import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqp, { type ChannelModel, type ConfirmChannel } from 'amqplib';
import {
  bindNotificationMainQueue,
  resolveNotificationQueueNames,
} from './notification-rabbitmq-topology';
import type { MessagePublisher, PublishMessage } from './publisher.interface';

@Injectable()
export class RabbitMqPublisher implements MessagePublisher, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqPublisher.name);
  private connection: ChannelModel | null = null;
  private channel: ConfirmChannel | null = null;

  constructor(@Optional() private readonly configService?: ConfigService) {}

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }

  async ping(): Promise<boolean> {
    try {
      await this.ensureChannel();
      return true;
    } catch {
      return false;
    }
  }

  async publish(message: PublishMessage): Promise<void> {
    await this.ensureChannel();
    const channel = this.channel;
    if (!channel) {
      throw new Error('RabbitMQ confirm channel is not initialized');
    }
    const exchange = this.value('RABBITMQ_EXCHANGE', 'commerce.events');
    const timeoutMs = Number(this.value('RABBITMQ_CONFIRM_TIMEOUT_MS', '10000'));
    const content = Buffer.from(JSON.stringify(message.payload));
    const confirmation = new Promise<void>((resolve, reject) => {
      channel.publish(
        exchange,
        message.routingKey,
        content,
        {
          headers: { ...message.headers, publishedAt: new Date().toISOString() },
          contentType: 'application/json',
          persistent: true,
        },
        (error) => (error ? reject(error) : resolve()),
      );
    });
    let timeout: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        confirmation,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error('RabbitMQ publisher confirm timed out')), timeoutMs);
        }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  private async ensureChannel(): Promise<void> {
    if (this.channel) return;
    const exchange = this.value('RABBITMQ_EXCHANGE', 'commerce.events');
    const connection = await amqp.connect(
      this.value('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672'),
    );
    const channel = await connection.createConfirmChannel();
    await channel.assertExchange(exchange, 'topic', { durable: true });
    if (this.configService) {
      await bindNotificationMainQueue(
        channel,
        exchange,
        resolveNotificationQueueNames(this.configService),
      );
    }
    this.connection = connection;
    this.channel = channel;
    connection.on('error', (error: Error) => {
      this.logger.error(`RabbitMQ connection error: ${error.message}`);
      this.channel = null;
      this.connection = null;
    });
    connection.on('close', () => {
      this.channel = null;
      this.connection = null;
    });
  }

  private value(name: string, fallback: string): string {
    return this.configService?.get<string>(name) ?? process.env[name] ?? fallback;
  }
}
