# Stage 3 commercial operations contract

## Checkout and idempotency

`POST /storefront/checkout` requires an `Idempotency-Key` header between 16 and 200 characters. The key is scoped by store and the `storefront.checkout` operation. The server hashes a canonical representation of the request.

- The same key and payload returns the exact stored status and response body.
- The same key with a different payload returns HTTP 409 with `IDEMPOTENCY_KEY_PAYLOAD_MISMATCH`.
- A request that is still processing returns HTTP 409 with `IDEMPOTENCY_REQUEST_IN_PROGRESS`.
- A deterministic failed execution is stored and replayed; all business writes are rolled back.
- A cart can produce at most one order, independently of the idempotency key.

Checkout locks the cart and authoritative catalog rows, calculates prices, locks coupon and loyalty state when used, reserves inventory, and writes the order, immutable items, payment, financial ledgers, cart transition, Outbox events, and idempotency result in one PostgreSQL transaction.

## Payment states

The supported states are `pending`, `under_review`, `approved`, `rejected`, and `refunded`. `under_review` is the submitted-proof state. Receipt upload and review use expected-state SQL, status history, affiliate effects, and Outbox writes in one transaction. Duplicate terminal review is idempotent; competing terminal decisions return `PAYMENT_TRANSITION_CONFLICT`.

## Inventory reservations

Reservations use `active -> consumed | released | expired`. Reserving atomically increments the selected warehouse's `reserved_quantity`; consuming decrements both on-hand and reserved quantities once; release/expiration decrements reserved once. Claims use `FOR UPDATE SKIP LOCKED`, so multiple expiration workers may run. Deploy with:

```bash
npm run worker:inventory-reservations
```

## Coupons

Coupon validation is repeated under a row lock. Active window, currency, minimum order, maximum discount, product/category inclusion and exclusion, global maximum uses, and per-customer limit are enforced in the checkout transaction. `coupon_usages` is the order/customer ledger. Reversal changes a consumed usage once and decrements both protected counters.

## Loyalty

Redemption locks the customer wallet, rejects insufficient points, writes a unique business-key ledger entry, and reconciles the committed order discount to the actual debit. Earned points start `pending`, become `available` after `LOYALTY_EARN_HOLD_DAYS`, and reverse exactly once on cancellation/return. Deploy the activation worker with:

```bash
npm run worker:loyalty-earn
```

## Affiliate commissions

The lifecycle is `pending -> approved -> payable -> paid`. Approval requires a completed order and approved payment. `payable` waits until `AFFILIATE_RETURN_WINDOW_DAYS` has elapsed. Cancellation/refund reverses unpaid commissions; a paid reversal creates one clawback adjustment. Deploy with:

```bash
npm run worker:affiliate-commissions
```

## Outbox and webhooks

Critical events are inserted in the owner transaction. Workers atomically claim rows with `SKIP LOCKED`, recover stale locks, await RabbitMQ publisher confirms, and retry with exponential backoff and jitter. Delivery is **at least once**: consumers must deduplicate by `outboxId` or `deduplicationKey`. Webhook delivery rows are projected from Outbox rows with a unique endpoint/outbox source key.

```bash
npm run worker:outbox
```

## Operations, migration, and rollback

Migration `099_commercial_operations_hardening` is the only Stage 3 migration. It contains preflight checks and does not choose winners among ambiguous financial duplicates. Before rollout, run the report-only reconciliation:

```bash
npm run stage3:reconcile
```

`--apply-safe-inventory` only reconciles warehouse reserved counters from active reservation rows and writes every change to `stage3_reconciliation_audit`. Ambiguous payments, coupon usage, commissions, loyalty business keys, cart/order relationships, missing items/payments, or missing historical `order.created` events cause a safe non-zero exit and require operator review. No application boot path mutates historical financial data.

Rollback uses `npm run migrate:down` for migration 099. Stop all Stage 3 workers before rollback and confirm no new Stage 3 lifecycle state is in use. Reapply with `npm run migrate:up`.

Required variables are documented in `.env.example`: idempotency TTL, Outbox batch/retry/lock/confirm values, inventory reservation TTL/worker interval, affiliate return window/worker interval, and loyalty earn hold/worker interval/batch size.
