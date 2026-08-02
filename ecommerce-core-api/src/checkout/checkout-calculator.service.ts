import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

function canonicalizeValue(value: unknown): unknown {
  if (value === undefined) {
    return null;
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalizeValue(entry));
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalizeValue(entry)]),
  );
}

@Injectable()
export class CheckoutCalculatorService {
  canonicalize(value: unknown): string {
    return JSON.stringify(canonicalizeValue(value));
  }

  requestHash(input: { storeId: string; operation: string; payload: unknown }): string {
    return createHash('sha256')
      .update(
        this.canonicalize({
          operation: input.operation,
          payload: input.payload,
          storeId: input.storeId,
        }),
      )
      .digest('hex');
  }
}

