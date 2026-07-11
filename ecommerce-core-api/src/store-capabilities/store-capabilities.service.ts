import { Injectable } from '@nestjs/common';

export type FeatureKey =
  | 'loyalty'
  | 'affiliates'
  | 'advancedOffers'
  | 'multiWarehouse'
  | 'reviews'
  | 'productQuestions'
  | 'abandonedCarts'
  | 'digitalProducts'
  | string;

@Injectable()
export class StoreCapabilitiesService {
  private readonly staticFeatures: Record<string, boolean> = {
    loyalty: true,
    affiliates: false,
    advancedOffers: true,
    multiWarehouse: true,
    reviews: true,
    productQuestions: true,
    abandonedCarts: true,
    digitalProducts: false,
  };

  /**
   * Checks if a feature is enabled.
   * Replaces the old SaaS limits check.
   */
  isFeatureEnabled(storeId: string, featureKey: FeatureKey): boolean {
    // In a single-store environment, we rely on our static configuration,
    // or we just default to true if it's an operational feature.
    return this.staticFeatures[featureKey] ?? true;
  }

  /**
   * Asserts that a feature is enabled, throws if not.
   * Matches the signature of the old StoreCapabilitiesService.assertFeatureEnabled.
   */
  async assertFeatureEnabled(storeId: string, featureKey: FeatureKey): Promise<void> {
    if (!this.isFeatureEnabled(storeId, featureKey)) {
      throw new Error(`Feature ${featureKey} is not enabled.`);
    }
  }

  /**
   * Asserts that a metric can grow (no-op now since limits are removed).
   * Matches the signature of old StoreCapabilitiesService.assertMetricCanGrow.
   */
  async assertMetricCanGrow(
    storeId: string,
    metricKey: string,
    increment: number = 1,
  ): Promise<void> {
    // No-op
  }

  /**
   * Records usage for a metric (no-op now since billing/usage is removed).
   * Matches the signature of old StoreCapabilitiesService.recordUsageEvent.
   */
  async recordUsageEvent(
    storeId: string,
    metricKey: string,
    value: number,
    metadata?: Record<string, any>,
  ): Promise<void> {
    // No-op
  }
}
