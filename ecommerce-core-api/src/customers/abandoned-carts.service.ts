import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { EmailService } from '../email/email.service';
import {
  AbandonedCartsRepository,
  type DispatchableAbandonedCartRecord,
  type ManagedAbandonedCartStatus,
} from './abandoned-carts.repository';

export interface AbandonedCartWorkerCaptureResult {
  scanned: number;
  captured: number;
}

export interface AbandonedCartWorkerDispatchResult {
  eligible: number;
  sent: number;
  failed: number;
}

export interface ManagedAbandonedCartListItem {
  id: string;
  cartId: string | null;
  customerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  cartTotal: number;
  itemsCount: number;
  recoverySentAt: Date | null;
  recoveredAt: Date | null;
  recoveredOrderId: string | null;
  expiresAt: Date;
  createdAt: Date;
  status: ManagedAbandonedCartStatus;
}

interface RecoveryEmailItem {
  title: string;
  sku: string | null;
  quantity: number;
  unitPrice: number;
}

@Injectable()
export class AbandonedCartsService {
  constructor(
    private readonly abandonedCartsRepository: AbandonedCartsRepository,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  async captureAbandonedCarts(limit?: number): Promise<AbandonedCartWorkerCaptureResult> {
    const inactivityMinutes = this.configService.get<number>(
      'ABANDONED_CART_INACTIVITY_MINUTES',
      60,
    );
    const batchSize =
      limit ?? this.configService.get<number>('ABANDONED_CART_CAPTURE_BATCH_SIZE', 200);

    const snapshots = await this.abandonedCartsRepository.listAbandonableCarts({
      inactivityMinutes,
      limit: batchSize,
    });

    let captured = 0;
    for (const snapshot of snapshots) {
      await this.abandonedCartsRepository.upsertAbandonedCart({
        storeId: snapshot.store_id,
        cartId: snapshot.cart_id,
        customerId: snapshot.customer_id,
        customerEmail: snapshot.customer_email,
        customerPhone: snapshot.customer_phone,
        cartData: snapshot.cart_data,
        cartTotal: Number(snapshot.cart_total),
        itemsCount: snapshot.items_count,
        expiresAt: snapshot.expires_at,
      });
      await this.abandonedCartsRepository.markCartAsAbandoned(snapshot.store_id, snapshot.cart_id);
      captured += 1;
    }

    return {
      scanned: snapshots.length,
      captured,
    };
  }

  async dispatchRecoveryEmails(limit?: number): Promise<AbandonedCartWorkerDispatchResult> {
    const cooldownHours = this.configService.get<number>(
      'ABANDONED_CART_REMINDER_COOLDOWN_HOURS',
      24,
    );
    const batchSize =
      limit ?? this.configService.get<number>('ABANDONED_CART_REMINDER_BATCH_SIZE', 100);

    const candidates = await this.abandonedCartsRepository.listDispatchableAbandonedCarts({
      cooldownHours,
      limit: batchSize,
    });

    let sent = 0;
    let failed = 0;

    for (const candidate of candidates) {
      try {
        await this.sendRecoveryEmail(candidate);
        await this.abandonedCartsRepository.markRecoveryEmailSent(candidate.abandoned_cart_id);
        await this.abandonedCartsRepository.insertReminder({
          abandonedCartId: candidate.abandoned_cart_id,
          reminderType: 'email',
        });
        sent += 1;
      } catch {
        failed += 1;
      }
    }

    return {
      eligible: candidates.length,
      sent,
      failed,
    };
  }

  async resolveRecoveryRedirect(token: string): Promise<{ redirectUrl: string; cartId: string }> {
    const recovery = await this.abandonedCartsRepository.findRecoveryTargetByToken(token.trim());
    if (!recovery) {
      throw new NotFoundException('Recovery link is invalid');
    }

    if (!recovery.cart_id) {
      throw new BadRequestException('Recovery cart is unavailable');
    }

    if (recovery.expires_at.getTime() <= Date.now()) {
      throw new BadRequestException('Recovery link has expired');
    }

    await this.abandonedCartsRepository.markLatestReminderClicked(recovery.abandoned_cart_id);
    await this.abandonedCartsRepository.reopenCart(recovery.store_id, recovery.cart_id);

    return {
      redirectUrl: this.buildStorefrontRecoveryUrl({
        storeSlug: recovery.store_slug,
        cartId: recovery.cart_id,
        token: recovery.recovery_token,
      }),
      cartId: recovery.cart_id,
    };
  }

  async trackRecoveryEmailOpen(token: string): Promise<void> {
    const recovery = await this.abandonedCartsRepository.findRecoveryTargetByToken(token.trim());
    if (!recovery) {
      return;
    }

    await this.abandonedCartsRepository.markLatestReminderOpened(recovery.abandoned_cart_id);
  }

  async attachRecoveredCheckout(input: {
    storeId: string;
    cartId: string;
    orderId: string;
  }): Promise<boolean> {
    return this.abandonedCartsRepository.attachRecoveredOrder(input);
  }

  async listManagedAbandonedCarts(input: {
    currentUser: AuthUser;
    status: ManagedAbandonedCartStatus | null;
    q: string | null;
    page: number;
    limit: number;
  }): Promise<{
    items: ManagedAbandonedCartListItem[];
    total: number;
    page: number;
    limit: number;
  }> {
    const offset = (input.page - 1) * input.limit;
    const { rows, total } = await this.abandonedCartsRepository.listManagedAbandonedCarts({
      storeId: input.currentUser.storeId,
      status: input.status,
      q: input.q,
      limit: input.limit,
      offset,
    });

    return {
      items: rows.map((row) => ({
        id: row.id,
        cartId: row.cart_id,
        customerId: row.customer_id,
        customerName: row.customer_name,
        customerEmail: row.customer_email,
        customerPhone: row.customer_phone,
        cartTotal: Number(row.cart_total),
        itemsCount: row.items_count,
        recoverySentAt: row.recovery_sent_at,
        recoveredAt: row.recovered_at,
        recoveredOrderId: row.recovered_order_id,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        status: this.resolveManagedStatus({
          recoverySentAt: row.recovery_sent_at,
          recoveredAt: row.recovered_at,
          expiresAt: row.expires_at,
        }),
      })),
      total,
      page: input.page,
      limit: input.limit,
    };
  }

  async sendManagedRecoveryEmail(
    currentUser: AuthUser,
    abandonedCartId: string,
  ): Promise<{ sent: true }> {
    const candidate = await this.abandonedCartsRepository.findDispatchableAbandonedCartById(
      currentUser.storeId,
      abandonedCartId,
    );
    if (!candidate) {
      throw new NotFoundException('Abandoned cart is unavailable for reminder');
    }

    await this.sendRecoveryEmail(candidate);
    await this.abandonedCartsRepository.markRecoveryEmailSent(candidate.abandoned_cart_id);
    await this.abandonedCartsRepository.insertReminder({
      abandonedCartId: candidate.abandoned_cart_id,
      reminderType: 'email',
    });

    return { sent: true };
  }

  private resolveManagedStatus(input: {
    recoverySentAt: Date | null;
    recoveredAt: Date | null;
    expiresAt: Date;
  }): ManagedAbandonedCartStatus {
    if (input.recoveredAt) {
      return 'recovered';
    }
    if (input.expiresAt.getTime() <= Date.now()) {
      return 'expired';
    }
    if (input.recoverySentAt) {
      return 'sent';
    }
    return 'ready';
  }

  private async sendRecoveryEmail(candidate: DispatchableAbandonedCartRecord): Promise<void> {
    const recoveryUrl = this.buildApiRecoveryUrl(candidate.store_slug, candidate.recovery_token);
    const openTrackingUrl = this.buildApiOpenTrackingUrl(
      candidate.store_slug,
      candidate.recovery_token,
    );

    await this.emailService.sendAbandonedCartRecovery({
      to: candidate.customer_email,
      storeName: candidate.store_name,
      recoveryUrl,
      openTrackingUrl,
      cartTotal: Number(candidate.cart_total),
      currencyCode: candidate.currency_code,
      itemsCount: candidate.items_count,
      expiresAt: candidate.expires_at,
      items: this.extractRecoveryEmailItems(candidate.cart_data),
    });
  }

  private buildApiRecoveryUrl(storeSlug: string, token: string): string {
    const apiBase = this.configService
      .get<string>('API_PUBLIC_BASE_URL', 'http://localhost:3000')
      .replace(/\/$/, '');
    return `${apiBase}/app/recovery/${encodeURIComponent(token)}?store=${encodeURIComponent(storeSlug)}`;
  }

  private buildApiOpenTrackingUrl(storeSlug: string, token: string): string {
    const apiBase = this.configService
      .get<string>('API_PUBLIC_BASE_URL', 'http://localhost:3000')
      .replace(/\/$/, '');
    return `${apiBase}/app/recovery/${encodeURIComponent(token)}/open?store=${encodeURIComponent(storeSlug)}`;
  }

  private buildStorefrontRecoveryUrl(input: {
    storeSlug: string;
    cartId: string;
    token: string;
  }): string {
    const storefrontBase = this.configService
      .get<string>('STOREFRONT_BASE_URL', 'http://localhost:3001')
      .replace(/\/$/, '');
    return `${storefrontBase}/checkout?cartId=${encodeURIComponent(input.cartId)}&recoveryToken=${encodeURIComponent(input.token)}&store=${encodeURIComponent(input.storeSlug)}`;
  }

  private extractRecoveryEmailItems(raw: unknown): RecoveryEmailItem[] {
    const entries = Array.isArray(raw) ? raw : [];
    const parsed = entries
      .map((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
          return null;
        }
        const title = typeof entry.title === 'string' ? entry.title.trim() : '';
        const sku =
          typeof entry.sku === 'string' && entry.sku.trim().length > 0 ? entry.sku.trim() : null;
        const quantity = Number(entry.quantity);
        const unitPrice = Number(entry.unitPrice);
        if (
          !title ||
          !Number.isFinite(quantity) ||
          quantity <= 0 ||
          !Number.isFinite(unitPrice) ||
          unitPrice < 0
        ) {
          return null;
        }
        return { title, sku, quantity, unitPrice };
      })
      .filter((entry): entry is RecoveryEmailItem => entry !== null);

    return parsed.slice(0, 8);
  }
}
