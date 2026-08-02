import { Global, Module } from '@nestjs/common';
import { DocumentSequenceService } from './document-sequence.service';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { CommercialCommandIdempotencyService } from './commercial-command-idempotency.service';
import { CommercialInvariantService } from './commercial-invariant.service';

@Global()
@Module({
  imports: [IdempotencyModule],
  providers: [DocumentSequenceService, CommercialCommandIdempotencyService, CommercialInvariantService],
  exports: [DocumentSequenceService, CommercialCommandIdempotencyService, CommercialInvariantService],
})
export class CommercialModule {}
