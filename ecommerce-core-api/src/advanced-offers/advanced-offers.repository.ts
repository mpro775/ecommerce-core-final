import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import type { AdvancedOfferConfig, AdvancedOfferType } from './constants/advanced-offer.constants';

export interface AdvancedOfferRecord {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  offer_type: AdvancedOfferType;
  config: AdvancedOfferConfig;
  starts_at: Date | null;
  ends_at: Date | null;
  is_active: boolean;
  priority: number;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class AdvancedOffersRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(input: {
    storeId: string;
    name: string;
    description: string | null;
    offerType: AdvancedOfferType;
    config: AdvancedOfferConfig;
    startsAt: Date | null;
    endsAt: Date | null;
    isActive: boolean;
    priority: number;
  }): Promise<AdvancedOfferRecord> {
    const result = await this.databaseService.db.query<AdvancedOfferRecord>(
      `
        INSERT INTO advanced_offers (
          id,
          store_id,
          name,
          description,
          offer_type,
          config,
          starts_at,
          ends_at,
          is_active,
          priority
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10)
        RETURNING id, store_id, name, description, offer_type, config, starts_at, ends_at,
                  is_active, priority, created_at, updated_at
      `,
      [
        uuidv4(),
        input.storeId,
        input.name,
        input.description,
        input.offerType,
        JSON.stringify(input.config),
        input.startsAt,
        input.endsAt,
        input.isActive,
        input.priority,
      ],
    );

    return result.rows[0] as AdvancedOfferRecord;
  }

  async list(storeId: string): Promise<AdvancedOfferRecord[]> {
    const result = await this.databaseService.db.query<AdvancedOfferRecord>(
      `
        SELECT id, store_id, name, description, offer_type, config, starts_at, ends_at,
               is_active, priority, created_at, updated_at
        FROM advanced_offers
        WHERE store_id = $1
        ORDER BY priority DESC, created_at DESC
      `,
      [storeId],
    );

    return result.rows;
  }

  async findById(storeId: string, offerId: string): Promise<AdvancedOfferRecord | null> {
    const result = await this.databaseService.db.query<AdvancedOfferRecord>(
      `
        SELECT id, store_id, name, description, offer_type, config, starts_at, ends_at,
               is_active, priority, created_at, updated_at
        FROM advanced_offers
        WHERE store_id = $1
          AND id = $2
        LIMIT 1
      `,
      [storeId, offerId],
    );

    return result.rows[0] ?? null;
  }

  async update(input: {
    storeId: string;
    offerId: string;
    name: string;
    description: string | null;
    offerType: AdvancedOfferType;
    config: AdvancedOfferConfig;
    startsAt: Date | null;
    endsAt: Date | null;
    isActive: boolean;
    priority: number;
  }): Promise<AdvancedOfferRecord | null> {
    const result = await this.databaseService.db.query<AdvancedOfferRecord>(
      `
        UPDATE advanced_offers
        SET name = $3,
            description = $4,
            offer_type = $5,
            config = $6::jsonb,
            starts_at = $7,
            ends_at = $8,
            is_active = $9,
            priority = $10,
            updated_at = NOW()
        WHERE store_id = $1
          AND id = $2
        RETURNING id, store_id, name, description, offer_type, config, starts_at, ends_at,
                  is_active, priority, created_at, updated_at
      `,
      [
        input.storeId,
        input.offerId,
        input.name,
        input.description,
        input.offerType,
        JSON.stringify(input.config),
        input.startsAt,
        input.endsAt,
        input.isActive,
        input.priority,
      ],
    );

    return result.rows[0] ?? null;
  }

  async listActive(storeId: string, now: Date): Promise<AdvancedOfferRecord[]> {
    const result = await this.databaseService.db.query<AdvancedOfferRecord>(
      `
        SELECT id, store_id, name, description, offer_type, config, starts_at, ends_at,
               is_active, priority, created_at, updated_at
        FROM advanced_offers
        WHERE store_id = $1
          AND is_active = TRUE
          AND (starts_at IS NULL OR starts_at <= $2)
          AND (ends_at IS NULL OR ends_at >= $2)
        ORDER BY priority DESC, created_at DESC
      `,
      [storeId, now],
    );

    return result.rows;
  }
}
