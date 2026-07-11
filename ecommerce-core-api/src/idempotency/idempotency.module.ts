import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { IdempotencyRepository } from './idempotency.repository';
import { IdempotencyService } from './idempotency.service';

@Module({
  imports: [DatabaseModule],
  providers: [IdempotencyService, IdempotencyRepository],
  exports: [IdempotencyService],
})
export class IdempotencyModule {}
