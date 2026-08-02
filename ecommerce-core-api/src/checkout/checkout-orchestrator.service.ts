import { Injectable } from '@nestjs/common';
import { CheckoutCalculatorService } from './checkout-calculator.service';
import { CheckoutTransactionService } from './checkout-transaction.service';
import type { AtomicCheckoutContext, AtomicCheckoutResult } from './checkout.types';

export const CHECKOUT_OPERATION = 'storefront.checkout';

@Injectable()
export class CheckoutOrchestratorService {
  constructor(
    private readonly calculator: CheckoutCalculatorService,
    private readonly transaction: CheckoutTransactionService,
  ) {}

  execute<T extends Record<string, unknown>>(input: {
    storeId: string;
    actorId: string | null;
    idempotencyKey: string;
    payload: unknown;
    work: (context: AtomicCheckoutContext) => Promise<AtomicCheckoutResult<T>>;
  }): Promise<{
    status: number;
    body: T | { code: string; message: string };
    replayed: boolean;
  }> {
    return this.transaction.execute({
      storeId: input.storeId,
      actorId: input.actorId,
      operation: CHECKOUT_OPERATION,
      idempotencyKey: input.idempotencyKey,
      requestHash: this.calculator.requestHash({
        storeId: input.storeId,
        operation: CHECKOUT_OPERATION,
        payload: input.payload,
      }),
      work: input.work,
    });
  }
}
