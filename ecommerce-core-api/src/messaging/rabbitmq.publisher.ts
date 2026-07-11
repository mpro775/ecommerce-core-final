import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqp, { type Channel, type ChannelModel } from 'amqplib';
import {
  bindNotificationMainQueue,
  resolveNotificationQueueNames,
} from './notification-rabbitmq-topology';
import type { MessagePublisher, PublishMessage } from './publisher.interface';

@Injectable()
export class RabbitMqPublisher implements MessagePublisher, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqPublisher.name);
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;

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
    if (!this.channel) {
      throw new Error('RabbitMQ channel is not initialized');
    }

    const exchange =
      this.configService?.get<string>('RABBITMQ_EXCHANGE') ??
      process.env.RABBITMQ_EXCHANGE ??
      'commerce.events';

    const headers = {
      ...message.headers,
      publishedAt: new Date().toISOString(),
    };

    const content = Buffer.from(JSON.stringify(message.payload));
    this.channel.publish(exchange, message.routingKey, content, {
      headers,
      contentType: 'application/json',
      persistent: true,
    });
  }

  private async ensureChannel(): Promise<void> {
    if (this.channel) {
      return;
    }

    const rabbitUrl =
      this.configService?.get<string>('RABBITMQ_URL') ??
      process.env.RABBITMQ_URL ??
      'amqp://guest:guest@localhost:5672';
    const exchange =
      this.configService?.get<string>('RABBITMQ_EXCHANGE') ??
      process.env.RABBITMQ_EXCHANGE ??
      'commerce.events';

    const connection = await amqp.connect(rabbitUrl);
    const channel = await connection.createChannel();
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
  }
}
