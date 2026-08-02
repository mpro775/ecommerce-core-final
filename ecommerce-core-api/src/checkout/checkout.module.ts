import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { CheckoutCalculatorService } from './checkout-calculator.service';
import { CheckoutOrchestratorService } from './checkout-orchestrator.service';
import { CheckoutTransactionService } from './checkout-transaction.service';

@Module({
  imports: [DatabaseModule, IdempotencyModule],
  providers: [CheckoutCalculatorService, CheckoutTransactionService, CheckoutOrchestratorService],
  exports: [CheckoutCalculatorService, CheckoutOrchestratorService],
})
export class CheckoutModule {}
