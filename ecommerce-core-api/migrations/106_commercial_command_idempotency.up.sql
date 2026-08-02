CREATE INDEX idx_idempotency_commercial_operations
  ON idempotency_keys (store_id, operation, actor_id, created_at DESC)
  WHERE operation IN (
    'admin.order.create', 'admin.order.edit', 'order.confirm', 'order.cancel',
    'order.complete', 'fulfillment.start_preparing', 'fulfillment.mark_ready',
    'fulfillment.dispatch', 'fulfillment.fulfill', 'fulfillment.fail',
    'fulfillment.retry', 'fulfillment.cancel', 'payment.submit',
    'payment.start_review', 'payment.approve', 'payment.reject',
    'payment.collect_cod', 'payment.expire', 'payment.cancel',
    'fulfillment.startPreparing', 'fulfillment.overrideStartPreparing',
    'fulfillment.markReady', 'fulfillment.markFulfilled',
    'fulfillment.markFailed', 'fulfillment.retryDispatch',
    'fulfillment.cancelFulfillment', 'payment.submitPaymentProof',
    'payment.resubmitPaymentProof', 'payment.startPaymentReview',
    'payment.approvePayment', 'payment.rejectPayment',
    'payment.collectCodPayment', 'payment.expirePayment', 'payment.cancelPayment'
  );
