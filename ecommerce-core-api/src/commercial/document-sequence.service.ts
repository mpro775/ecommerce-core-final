import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import type { QueryExecutor } from '../database/query-executor';
import { MetricsService } from '../observability/metrics.service';

export type DocumentType = 'ORD' | 'INV' | 'RET' | 'REF';

@Injectable()
export class DocumentSequenceService {
  constructor(private readonly metricsService: MetricsService) {}

  async allocate(
    db: QueryExecutor,
    input: { storeId: string; documentType: DocumentType; at?: Date },
  ): Promise<string> {
    const year = (input.at ?? new Date()).getUTCFullYear();
    try {
      const result = await db.query<{ last_number: string }>(
        `INSERT INTO document_sequences (
           id, store_id, document_type, year, last_number
         ) VALUES ($1, $2, $3, $4, 1)
         ON CONFLICT (store_id, document_type, year)
         DO UPDATE SET last_number = document_sequences.last_number + 1, updated_at = NOW()
         RETURNING last_number::text`,
        [uuidv4(), input.storeId, input.documentType, year],
      );
      const value = Number(result.rows[0]?.last_number);
      if (!Number.isSafeInteger(value) || value < 1 || value > 999_999) {
        throw new Error('Document sequence exhausted or invalid');
      }
      const prefix = this.prefix();
      this.metricsService.incrementCounter('document_sequence_allocated_total', {
        store_id: input.storeId,
        document_type: input.documentType,
      });
      return `${prefix}-${input.documentType}-${year}-${String(value).padStart(6, '0')}`;
    } catch (error) {
      this.metricsService.incrementCounter('document_sequence_failure_total', {
        store_id: input.storeId,
        document_type: input.documentType,
      });
      throw new InternalServerErrorException({
        code: 'DOCUMENT_SEQUENCE_ALLOCATION_FAILED',
        message: error instanceof Error ? error.message : 'Document sequence allocation failed',
      });
    }
  }

  private prefix(): string {
    const configured = (process.env.ORDER_NUMBER_PREFIX ?? 'NJM').trim().toUpperCase();
    return /^[A-Z0-9]{2,8}$/.test(configured) ? configured : 'NJM';
  }
}

