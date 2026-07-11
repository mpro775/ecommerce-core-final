export interface PublishMessage {
  routingKey: string;
  payload: Record<string, unknown>;
  headers?: Record<string, string>;
}

export const MESSAGE_PUBLISHER = Symbol('MESSAGE_PUBLISHER');

export interface MessagePublisher {
  publish(message: PublishMessage): Promise<void>;
  ping(): Promise<boolean>;
}
