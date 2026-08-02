import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import {
  SeoRepository,
  type StoreSeoSettings,
} from './seo.repository';

type StoreScopedUser = Pick<AuthUser, 'storeId'>;

export interface SeoAuditResponse {
  score: number;
  counts: Record<string, number>;
  issuesTotal: number;
  recommendations: string[];
}

@Injectable()
export class SeoService {
  constructor(private readonly seoRepository: SeoRepository) {}

  async getSettings(user: StoreScopedUser): Promise<StoreSeoSettings> {
    return this.normalizeSettings(await this.seoRepository.getSettings(user.storeId));
  }

  async updateSettings(
    user: StoreScopedUser,
    updates: Partial<StoreSeoSettings>,
  ): Promise<StoreSeoSettings> {
    const current = await this.getSettings(user);
    const next = this.normalizeSettings({ ...current, ...updates });
    return this.normalizeSettings(await this.seoRepository.updateSettings(user.storeId, next));
  }

  async audit(user: StoreScopedUser): Promise<SeoAuditResponse> {
    const [settings, counts] = await Promise.all([
      this.getSettings(user),
      this.seoRepository.auditCounts(user.storeId),
    ]);
    const homeMissing = [
      settings.homeSeoTitleAr,
      settings.homeSeoTitleEn,
      settings.homeSeoDescriptionAr,
      settings.homeSeoDescriptionEn,
    ].filter((value) => !value).length;
    const issuesTotal = Object.values(counts).reduce((sum, value) => sum + value, homeMissing);

    return {
      score: Math.max(0, Math.round(100 - Math.min(100, issuesTotal * 5))),
      counts: { ...counts, home_missing_fields: homeMissing },
      issuesTotal,
      recommendations: [
        ...(homeMissing > 0 ? ['Complete homepage SEO metadata in Arabic and English.'] : []),
        ...((counts.products_missing_ar ?? 0) + (counts.products_missing_en ?? 0) > 0
          ? ['Complete product SEO metadata.']
          : []),
        ...((counts.categories_missing_ar ?? 0) + (counts.categories_missing_en ?? 0) > 0
          ? ['Complete category SEO metadata.']
          : []),
      ],
    };
  }

  private normalizeSettings(value: Record<string, unknown>): StoreSeoSettings {
    const defaultLanguage = value.defaultLanguage === 'en' ? 'en' : 'ar';
    const supportedLanguages = this.normalizeLanguages(value.supportedLanguages);
    return {
      homeSeoTitleAr: this.cleanString(value.homeSeoTitleAr),
      homeSeoTitleEn: this.cleanString(value.homeSeoTitleEn),
      homeSeoDescriptionAr: this.cleanString(value.homeSeoDescriptionAr),
      homeSeoDescriptionEn: this.cleanString(value.homeSeoDescriptionEn),
      defaultSeoTitleAr: this.cleanString(value.defaultSeoTitleAr),
      defaultSeoTitleEn: this.cleanString(value.defaultSeoTitleEn),
      defaultSeoDescriptionAr: this.cleanString(value.defaultSeoDescriptionAr),
      defaultSeoDescriptionEn: this.cleanString(value.defaultSeoDescriptionEn),
      defaultOgImage: this.cleanString(value.defaultOgImage),
      defaultTwitterImage: this.cleanString(value.defaultTwitterImage),
      keywords: Array.isArray(value.keywords)
        ? value.keywords.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : [],
      googleSiteVerification: this.cleanString(value.googleSiteVerification),
      googleAnalyticsMeasurementId: this.cleanString(value.googleAnalyticsMeasurementId),
      bingSiteVerification: this.cleanString(value.bingSiteVerification),
      facebookDomainVerification: this.cleanString(value.facebookDomainVerification),
      seoIndexEnabled: value.seoIndexEnabled !== false,
      seoFollowDefault: value.seoFollowDefault !== false,
      canonicalBaseUrl: this.cleanString(value.canonicalBaseUrl),
      defaultLanguage,
      supportedLanguages: supportedLanguages.includes(defaultLanguage)
        ? supportedLanguages
        : [defaultLanguage, ...supportedLanguages],
    };
  }

  private cleanString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
  }

  private normalizeLanguages(value: unknown): Array<'ar' | 'en'> {
    if (!Array.isArray(value)) return ['ar', 'en'];
    const languages = value.filter(
      (item): item is 'ar' | 'en' => item === 'ar' || item === 'en',
    );
    return languages.length > 0 ? [...new Set(languages)] : ['ar', 'en'];
  }
}
