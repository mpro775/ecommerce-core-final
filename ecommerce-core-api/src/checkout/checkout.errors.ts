import { HttpException, HttpStatus } from '@nestjs/common';

export const CHECKOUT_ERROR_CODES = {
  IDEMPOTENCY_KEY_REQUIRED: 'IDEMPOTENCY_KEY_REQUIRED',
  IDEMPOTENCY_KEY_INVALID: 'IDEMPOTENCY_KEY_INVALID',
  IDEMPOTENCY_KEY_PAYLOAD_MISMATCH: 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH',
  IDEMPOTENCY_REQUEST_IN_PROGRESS: 'IDEMPOTENCY_REQUEST_IN_PROGRESS',
  CART_NOT_FOUND: 'CART_NOT_FOUND',
  CART_NOT_OPEN: 'CART_NOT_OPEN',
  CART_ALREADY_CHECKED_OUT: 'CART_ALREADY_CHECKED_OUT',
  CART_EXPIRED: 'CART_EXPIRED',
  CART_EMPTY: 'CART_EMPTY',
  PRODUCT_NOT_PURCHASABLE: 'PRODUCT_NOT_PURCHASABLE',
  PRICE_CHANGED: 'PRICE_CHANGED',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  INVENTORY_RESERVATION_INVALID: 'INVENTORY_RESERVATION_INVALID',
  INVENTORY_RESERVATION_ALREADY_CONSUMED: 'INVENTORY_RESERVATION_ALREADY_CONSUMED',
  COUPON_INVALID: 'COUPON_INVALID',
  COUPON_EXPIRED: 'COUPON_EXPIRED',
  COUPON_USAGE_LIMIT_REACHED: 'COUPON_USAGE_LIMIT_REACHED',
  COUPON_CUSTOMER_LIMIT_REACHED: 'COUPON_CUSTOMER_LIMIT_REACHED',
  LOYALTY_INSUFFICIENT_POINTS: 'LOYALTY_INSUFFICIENT_POINTS',
  PAYMENT_TRANSITION_CONFLICT: 'PAYMENT_TRANSITION_CONFLICT',
  PAYMENT_ALREADY_REVIEWED: 'PAYMENT_ALREADY_REVIEWED',
} as const;

export type CheckoutErrorCode = (typeof CHECKOUT_ERROR_CODES)[keyof typeof CHECKOUT_ERROR_CODES];

export class CheckoutDomainException extends HttpException {
  constructor(code: CheckoutErrorCode, message: string, status = HttpStatus.CONFLICT) {
    super({ code, message }, status);
  }
}

export function normalizeCheckoutError(error: unknown): {
  status: number;
  body: { code: string; message: string };
} {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    if (response && typeof response === 'object') {
      const body = response as { code?: unknown; message?: unknown };
      return {
        status: error.getStatus(),
        body: {
          code: typeof body.code === 'string' ? body.code : 'CHECKOUT_FAILED',
          message:
            typeof body.message === 'string'
              ? body.message
              : Array.isArray(body.message)
                ? body.message.join('; ')
                : error.message,
        },
      };
    }
    return {
      status: error.getStatus(),
      body: { code: 'CHECKOUT_FAILED', message: String(response) },
    };
  }

  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    body: { code: 'CHECKOUT_FAILED', message: 'Checkout could not be completed' },
  };
}

