import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { ConfigService } from '@nestjs/config';

export interface WebhookPayload {
  id: string;
  eventType: string;
  timestamp: string;
  data: Record<string, unknown>;
  storeId: string;
}

@Injectable()
export class WebhookSigningService {
  private readonly logger = new Logger(WebhookSigningService.name);
  private readonly algorithm = 'sha256';
  private readonly signatureHeader = 'x-webhook-signature';
  private readonly timestampHeader = 'x-webhook-timestamp';
  private readonly maxTimestampDriftMs = 5 * 60 * 1000;

  constructor(private readonly configService: ConfigService) {}

  signPayload(payload: WebhookPayload, secret?: string): { signature: string; timestamp: string } {
    const webhookSecret =
      secret ?? this.configService.get<string>('WEBHOOK_SECRET', 'default-webhook-secret');
    const timestamp = Date.now().toString();

    const payloadToSign = this.createPayloadToSign(payload, timestamp);
    const signature = createHmac(this.algorithm, webhookSecret).update(payloadToSign).digest('hex');

    return {
      signature: `sha256=${signature}`,
      timestamp,
    };
  }

  verifySignature(
    payload: WebhookPayload,
    signature: string,
    timestamp: string,
    secret?: string,
  ): { valid: boolean; error?: string } {
    const webhookSecret =
      secret ?? this.configService.get<string>('WEBHOOK_SECRET', 'default-webhook-secret');

    if (!signature) {
      return { valid: false, error: 'Missing signature' };
    }

    if (!timestamp) {
      return { valid: false, error: 'Missing timestamp' };
    }

    const timestampNum = parseInt(timestamp, 10);
    if (isNaN(timestampNum)) {
      return { valid: false, error: 'Invalid timestamp' };
    }

    const now = Date.now();
    if (Math.abs(now - timestampNum) > this.maxTimestampDriftMs) {
      return { valid: false, error: 'Timestamp drift too large' };
    }

    const expectedSignature = this.signPayload(payload, webhookSecret);
    const expectedSigBuffer = Buffer.from(expectedSignature.signature, 'utf8');
    const providedSigBuffer = Buffer.from(signature, 'utf8');

    if (expectedSigBuffer.length !== providedSigBuffer.length) {
      return { valid: false, error: 'Signature length mismatch' };
    }

    try {
      const isValid = timingSafeEqual(expectedSigBuffer, providedSigBuffer);
      if (isValid) {
        return { valid: true };
      }
      return { valid: false, error: 'Signature mismatch' };
    } catch {
      return { valid: false, error: 'Signature comparison failed' };
    }
  }

  verifyHeaders(
    payload: WebhookPayload,
    headers: Record<string, string | undefined>,
    secret?: string,
  ): { valid: boolean; error?: string } {
    const signature = headers[this.signatureHeader];
    const timestamp = headers[this.timestampHeader];

    return this.verifySignature(payload, signature ?? '', timestamp ?? '', secret);
  }

  generateSecret(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let secret = '';
    for (let i = 0; i < 32; i++) {
      secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return secret;
  }

  getSignatureHeaders(): { signature: string; timestamp: string } {
    return {
      signature: this.signatureHeader,
      timestamp: this.timestampHeader,
    };
  }

  private createPayloadToSign(payload: WebhookPayload, timestamp: string): string {
    const canonicalPayload = JSON.stringify({
      id: payload.id,
      eventType: payload.eventType,
      timestamp: payload.timestamp,
      storeId: payload.storeId,
      data: payload.data,
    });

    return `${timestamp}.${canonicalPayload}`;
  }
}
