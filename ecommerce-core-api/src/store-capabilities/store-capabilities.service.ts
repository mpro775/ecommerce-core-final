import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export type FeatureKey =
  | 'loyalty'
  | 'loyalty_program'
  | 'affiliates'
  | 'affiliate_program'
  | 'advancedOffers'
  | 'advanced_offers'
  | 'multiWarehouse'
  | 'multi_warehouse'
  | 'reviews'
  | 'productQuestions'
  | 'product_questions'
  | 'abandonedCarts'
  | 'abandoned_carts'
  | 'digitalProducts'
  | 'digital_products'
  | 'staff_management'
  | 'webhooks_access'
  | string;

const FEATURE_ALIASES: Record<string, string[]> = {
  loyalty: ['loyalty', 'loyalty_program'],
  loyalty_program: ['loyalty_program', 'loyalty'],
  affiliates: ['affiliates', 'affiliate_program'],
  affiliate_program: ['affiliate_program', 'affiliates'],
  advancedOffers: ['advancedOffers', 'advanced_offers'],
  advanced_offers: ['advanced_offers', 'advancedOffers'],
  multiWarehouse: ['multiWarehouse', 'multi_warehouse'],
  multi_warehouse: ['multi_warehouse', 'multiWarehouse'],
  productQuestions: ['productQuestions', 'product_questions'],
  product_questions: ['product_questions', 'productQuestions'],
  abandonedCarts: ['abandonedCarts', 'abandoned_carts'],
  abandoned_carts: ['abandoned_carts', 'abandonedCarts'],
  digitalProducts: ['digitalProducts', 'digital_products'],
  digital_products: ['digital_products', 'digitalProducts'],
};

@Injectable()
export class StoreCapabilitiesService {
  constructor(private readonly databaseService: DatabaseService) {}

  async isFeatureEnabled(storeId: string, featureKey: FeatureKey): Promise<boolean> {
    const enabledFeatures = await this.loadEnabledFeatures(storeId);
    for (const key of this.resolveFeatureKeys(featureKey)) {
      if (typeof enabledFeatures[key] === 'boolean') {
        return enabledFeatures[key];
      }
    }
    return false;
  }

  async assertFeatureEnabled(storeId: string, featureKey: FeatureKey): Promise<void> {
    if (!(await this.isFeatureEnabled(storeId, featureKey))) {
      throw new BadRequestException(`Feature ${featureKey} is not enabled for this store.`);
    }
  }

  async assertMetricCanGrow(
    _storeId: string,
    _metricKey: string,
    _increment: number = 1,
  ): Promise<void> {
    // Single-store core has no SaaS quota ceilings.
  }

  async recordUsageEvent(
    _storeId: string,
    _metricKey: string,
    _value: number,
    _metadata?: Record<string, unknown>,
  ): Promise<void> {
    // Usage accounting belonged to the removed SaaS billing layer.
  }

  private async loadEnabledFeatures(storeId: string): Promise<Record<string, unknown>> {
    const result = await this.databaseService.db.query<{ enabled_features: Record<string, unknown> }>(
      `
        SELECT COALESCE(mobile_app_config->'enabledFeatures', '{}'::jsonb) AS enabled_features
        FROM store_general_settings
        WHERE store_id = $1
        LIMIT 1
      `,
      [storeId],
    );
    return result.rows[0]?.enabled_features ?? {};
  }

  private resolveFeatureKeys(featureKey: string): string[] {
    return FEATURE_ALIASES[featureKey] ?? [featureKey];
  }
}
