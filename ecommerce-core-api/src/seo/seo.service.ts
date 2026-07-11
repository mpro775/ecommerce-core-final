import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import type { BootstrapStorePagesDto } from './dto/bootstrap-store-pages.dto';
import type { CreateStorePageDto } from './dto/create-store-page.dto';
import type { UpdateStorePageDto } from './dto/update-store-page.dto';
import {
  SeoRepository,
  type SeoCategoryRecord,
  type SeoProductRecord,
  type SeoStoreProfile,
  type StorePageInput,
  type StorePageRecord,
  type StoreSeoSettings,
} from './seo.repository';

type StoreScopedUser = Pick<AuthUser, 'storeId'>;

interface UpdateStoreSeoSettingsDto {
  homeSeoTitleAr?: string;
  homeSeoTitleEn?: string;
  homeSeoDescriptionAr?: string;
  homeSeoDescriptionEn?: string;
  defaultSeoTitleAr?: string;
  defaultSeoTitleEn?: string;
  defaultSeoDescriptionAr?: string;
  defaultSeoDescriptionEn?: string;
  defaultOgImage?: string;
  defaultTwitterImage?: string;
  keywords?: string[];
  googleSiteVerification?: string;
  googleAnalyticsMeasurementId?: string;
  bingSiteVerification?: string;
  facebookDomainVerification?: string;
  seoIndexEnabled?: boolean;
  seoFollowDefault?: boolean;
  canonicalBaseUrl?: string;
  defaultLanguage?: 'ar' | 'en';
  supportedLanguages?: Array<'ar' | 'en'>;
}

interface SeoSuggestionDto {
  targetType: 'home' | 'product' | 'category' | 'page';
  targetId?: string;
  language: 'ar' | 'en' | 'both';
}

interface SeoAutoFixDto {
  scope?: 'all' | 'home' | 'products' | 'categories' | 'pages';
  targetId?: string;
  issueType?: string;
  language?: 'ar' | 'en' | 'both';
  overwriteExisting?: boolean;
  overwriteMode?: 'missing_only' | 'improve_weak' | 'replace_all';
}

type SeoScope = 'all' | 'home' | 'products' | 'categories' | 'pages';
type SeoTargetType = 'home' | 'product' | 'category' | 'page' | 'integration';
type SeoSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info' | 'warning';
type SeoOverwriteMode = 'missing_only' | 'improve_weak' | 'replace_all';
type SeoIssueType =
  | 'missing_title_ar'
  | 'missing_description_ar'
  | 'missing_title_en'
  | 'missing_description_en'
  | 'title_ar_too_short'
  | 'title_ar_too_long'
  | 'description_ar_too_short'
  | 'description_ar_too_long'
  | 'title_en_too_short'
  | 'title_en_too_long'
  | 'description_en_too_short'
  | 'description_en_too_long'
  | 'duplicate_title_ar'
  | 'duplicate_description_ar'
  | 'duplicate_title_en'
  | 'duplicate_description_en'
  | 'missing_default_og_image'
  | 'missing_google_analytics'
  | 'missing_google_site_verification'
  | 'canonical_base_url_missing'
  | 'store_noindex'
  | 'missing_core_page'
  | 'page_draft'
  | 'page_noindex';

const TITLE_MIN = 30;
const TITLE_MAX = 70;
const DESCRIPTION_MIN = 80;
const DESCRIPTION_MAX = 170;

const SEVERITY_WEIGHT: Record<Exclude<SeoSeverity, 'warning'>, number> = {
  critical: 18,
  high: 10,
  medium: 6,
  low: 2,
  info: 0,
};

const RESERVED_SLUGS = new Set([
  'products',
  'categories',
  'cart',
  'checkout',
  'account',
  'api',
  'preview',
  'sitemap.xml',
  'robots.txt',
]);

type StorePageKey =
  | 'about'
  | 'contact'
  | 'shipping_policy'
  | 'return_policy'
  | 'privacy_policy'
  | 'terms'
  | 'faq';

const SYSTEM_PAGES: Array<{
  pageKey: StorePageKey;
  slug: string;
  pageType: StorePageResponse['pageType'];
  titleAr: string;
  titleEn: string;
  showInHeader: boolean;
  showInFooter: boolean;
  sortOrder: number;
}> = [
  {
    pageKey: 'about',
    slug: 'about',
    pageType: 'about',
    titleAr: 'من نحن',
    titleEn: 'About us',
    showInHeader: true,
    showInFooter: true,
    sortOrder: 10,
  },
  {
    pageKey: 'contact',
    slug: 'contact',
    pageType: 'contact',
    titleAr: 'تواصل معنا',
    titleEn: 'Contact us',
    showInHeader: true,
    showInFooter: true,
    sortOrder: 20,
  },
  {
    pageKey: 'shipping_policy',
    slug: 'shipping-policy',
    pageType: 'policy',
    titleAr: 'سياسة الشحن',
    titleEn: 'Shipping policy',
    showInHeader: false,
    showInFooter: true,
    sortOrder: 30,
  },
  {
    pageKey: 'return_policy',
    slug: 'return-policy',
    pageType: 'policy',
    titleAr: 'سياسة الإرجاع',
    titleEn: 'Return policy',
    showInHeader: false,
    showInFooter: true,
    sortOrder: 40,
  },
  {
    pageKey: 'privacy_policy',
    slug: 'privacy-policy',
    pageType: 'policy',
    titleAr: 'سياسة الخصوصية',
    titleEn: 'Privacy policy',
    showInHeader: false,
    showInFooter: true,
    sortOrder: 50,
  },
  {
    pageKey: 'terms',
    slug: 'terms',
    pageType: 'policy',
    titleAr: 'الشروط والأحكام',
    titleEn: 'Terms and conditions',
    showInHeader: false,
    showInFooter: true,
    sortOrder: 60,
  },
  {
    pageKey: 'faq',
    slug: 'faq',
    pageType: 'faq',
    titleAr: 'الأسئلة الشائعة',
    titleEn: 'FAQ',
    showInHeader: false,
    showInFooter: true,
    sortOrder: 70,
  },
];

@Injectable()
export class SeoService {
  constructor(private readonly seoRepository: SeoRepository) {}

  async getSettings(user: StoreScopedUser): Promise<StoreSeoSettings> {
    return this.normalizeSettings(await this.seoRepository.getSettings(user.storeId));
  }

  async updateSettings(
    user: StoreScopedUser,
    body: UpdateStoreSeoSettingsDto,
  ): Promise<StoreSeoSettings> {
    const current = await this.getSettings(user);
    const next = this.normalizeSettings({ ...current, ...body });
    return this.normalizeSettings(await this.seoRepository.updateSettings(user.storeId, next));
  }

  async listPages(user: StoreScopedUser): Promise<{ items: StorePageResponse[] }> {
    const rows = await this.seoRepository.listPages(user.storeId, true);
    return { items: rows.map((row) => this.mapPage(row)) };
  }

  async getPage(user: StoreScopedUser, pageId: string): Promise<StorePageResponse> {
    const row = await this.seoRepository.findPageById(user.storeId, pageId);
    if (!row) {
      throw new NotFoundException('Page not found');
    }
    return this.mapPage(row);
  }

  async createPage(user: StoreScopedUser, body: CreateStorePageDto): Promise<StorePageResponse> {
    const input = await this.normalizePageInput(user.storeId, body);
    const row = await this.seoRepository.createPage(user.storeId, input);
    return this.mapPage(row);
  }

  async bootstrapPages(
    user: StoreScopedUser,
    body: BootstrapStorePagesDto = {},
  ): Promise<BootstrapStorePagesResponse> {
    const profile = await this.seoRepository.getStoreProfile(user.storeId);
    if (!profile) {
      throw new NotFoundException('Store not found');
    }

    const overwrite = body.overwrite === true;
    const items: BootstrapStorePageResult[] = [];

    for (const definition of SYSTEM_PAGES) {
      const existingByKey = await this.seoRepository.findPageByKey(
        user.storeId,
        definition.pageKey,
      );
      const existing =
        existingByKey ??
        (await this.seoRepository.findPageBySlug(user.storeId, definition.slug)) ??
        null;
      const generated = this.buildSystemPage(definition, profile);

      if (!existing) {
        const input = await this.normalizePageInput(user.storeId, {
          ...generated,
          status: 'published',
        } as CreateStorePageDto);
        const created = this.mapPage(await this.seoRepository.createPage(user.storeId, input));
        items.push({ pageKey: definition.pageKey, status: 'created', page: created });
        continue;
      }

      const current = this.mapPage(existing);
      const next = this.mergeGeneratedPage(current, generated, overwrite);
      const changedFields = this.changedBootstrapFields(current, next);
      if (changedFields.length === 0) {
        items.push({
          pageKey: definition.pageKey,
          status: 'skipped',
          page: current,
          changedFields: [],
        });
        continue;
      }

      const updated = await this.updatePage(
        user,
        existing.id,
        next as unknown as UpdateStorePageDto,
      );
      items.push({ pageKey: definition.pageKey, status: 'updated', page: updated, changedFields });
    }

    return { items };
  }

  async updatePage(
    user: StoreScopedUser,
    pageId: string,
    body: UpdateStorePageDto,
  ): Promise<StorePageResponse> {
    const existing = await this.seoRepository.findPageById(user.storeId, pageId);
    if (!existing) {
      throw new NotFoundException('Page not found');
    }
    const input = await this.normalizePageInput(
      user.storeId,
      { ...this.mapPage(existing), ...body },
      pageId,
    );
    const updated = await this.seoRepository.updatePage(user.storeId, pageId, input);
    if (!updated) {
      throw new NotFoundException('Page not found');
    }
    return this.mapPage(updated);
  }

  async deletePage(user: StoreScopedUser, pageId: string): Promise<{ deleted: true }> {
    const deleted = await this.seoRepository.deletePage(user.storeId, pageId);
    if (!deleted) {
      throw new NotFoundException('Page not found');
    }
    return { deleted: true };
  }

  async publishPage(user: StoreScopedUser, pageId: string): Promise<StorePageResponse> {
    return this.updatePage(user, pageId, { status: 'published' });
  }

  async archivePage(user: StoreScopedUser, pageId: string): Promise<StorePageResponse> {
    return this.updatePage(user, pageId, { status: 'archived' });
  }

  async audit(user: StoreScopedUser): Promise<SeoAuditResponse> {
    const [counts, details] = await Promise.all([
      this.seoRepository.auditCounts(user.storeId),
      this.auditDetails(user),
    ]);
    return {
      score: details.score,
      status: details.status,
      counts,
      issuesTotal: details.totalIssues,
      summary: details.summary,
      sections: details.sections.map(({ key, label, score, issuesCount, fixableCount }) => ({
        key,
        title: label,
        score,
        issuesCount,
        fixableCount,
      })),
      recommendations: [
        ...(counts.products_missing_ar || counts.products_missing_en
          ? ['Complete product SEO titles and descriptions in Arabic and English.']
          : []),
        ...(counts.categories_missing_ar || counts.categories_missing_en
          ? ['Complete category SEO metadata and avoid indexing filtered URLs by default.']
          : []),
        ...(counts.pages_missing_seo ? ['Complete SEO metadata for published store pages.'] : []),
      ],
    };
  }

  async auditDetails(user: StoreScopedUser): Promise<SeoAuditDetailsResponse> {
    const [settings, profile, products, categories, pages] = await Promise.all([
      this.getSettings(user),
      this.seoRepository.getStoreProfile(user.storeId),
      this.seoRepository.listProductsForSeo(user.storeId, 80),
      this.seoRepository.listCategoriesForSeo(user.storeId, 80),
      this.seoRepository.listPagesForSeo(user.storeId, 80),
    ]);
    const issues: SeoIssue[] = [];

    this.pushHomeIssues(issues, settings);
    for (const product of products) {
      this.pushTargetIssues(issues, {
        targetType: 'product',
        targetId: product.id,
        targetTitle: product.title_ar ?? product.title_en ?? product.title,
        titleAr: product.seo_title_ar,
        titleEn: product.seo_title_en,
        descriptionAr: product.seo_description_ar,
        descriptionEn: product.seo_description_en,
        fixAction: 'generate_product_seo',
      });
    }
    this.pushDuplicateIssues(
      issues,
      products,
      'product',
      'title_ar',
      'seo_title_ar',
      'duplicate_title_ar',
      'عنوان SEO العربي مكرر',
      'generate_product_seo',
    );
    this.pushDuplicateIssues(
      issues,
      products,
      'product',
      'description_ar',
      'seo_description_ar',
      'duplicate_description_ar',
      'وصف SEO العربي مكرر',
      'generate_product_seo',
    );
    this.pushDuplicateIssues(
      issues,
      products,
      'product',
      'title_en',
      'seo_title_en',
      'duplicate_title_en',
      'عنوان SEO الإنجليزي مكرر',
      'generate_product_seo',
    );
    this.pushDuplicateIssues(
      issues,
      products,
      'product',
      'description_en',
      'seo_description_en',
      'duplicate_description_en',
      'وصف SEO الإنجليزي مكرر',
      'generate_product_seo',
    );
    for (const category of categories) {
      this.pushTargetIssues(issues, {
        targetType: 'category',
        targetId: category.id,
        targetTitle: category.name_ar ?? category.name_en ?? category.name,
        titleAr: category.seo_title_ar,
        titleEn: category.seo_title_en,
        descriptionAr: category.seo_description_ar,
        descriptionEn: category.seo_description_en,
        fixAction: 'generate_category_seo',
      });
    }
    this.pushDuplicateIssues(
      issues,
      categories,
      'category',
      'name_ar',
      'seo_title_ar',
      'duplicate_title_ar',
      'عنوان SEO العربي مكرر',
      'generate_category_seo',
    );
    this.pushDuplicateIssues(
      issues,
      categories,
      'category',
      'description_ar',
      'seo_description_ar',
      'duplicate_description_ar',
      'وصف SEO العربي مكرر',
      'generate_category_seo',
    );
    for (const page of pages) {
      this.pushTargetIssues(issues, {
        targetType: 'page',
        targetId: page.id,
        targetTitle: page.title_ar ?? page.title_en ?? page.slug,
        titleAr: page.seo_title_ar,
        titleEn: page.seo_title_en,
        descriptionAr: page.seo_description_ar,
        descriptionEn: page.seo_description_en,
        fixAction: 'generate_page_seo',
      });
    }
    if (!settings.defaultOgImage) {
      issues.push({
        id: 'default_og_image_missing',
        issueType: 'missing_default_og_image',
        targetType: 'home',
        targetId: null,
        severity: 'medium',
        title: 'صورة المشاركة غير مضافة',
        description: 'أضف صورة واضحة تظهر عند مشاركة رابط المتجر في واتساب والشبكات الاجتماعية.',
        impact: 'قد تظهر روابط المتجر بصورة غير جذابة عند المشاركة، وهذا يقلل معدل النقر.',
        fixMethod: 'ارفع صورة مشاركة افتراضية من إعدادات الصفحة الرئيسية.',
        canAutoFix: false,
        fixAction: 'upload_default_share_image',
      });
    }
    if (!settings.googleSiteVerification) {
      issues.push({
        id: 'google_site_verification_missing',
        issueType: 'missing_google_site_verification',
        targetType: 'integration',
        targetId: null,
        severity: 'low',
        title: 'Google Search Console غير مؤكد',
        description: 'أضف رمز التحقق حتى يمكن متابعة ظهور المتجر في نتائج Google.',
        impact: 'يصعب قياس مشاكل الفهرسة والكلمات التي يظهر عليها المتجر.',
        fixMethod: 'انسخ رمز التحقق من Search Console والصقه في تبويب الربط والتحقق.',
        canAutoFix: false,
        fixAction: 'connect_google_analytics',
      });
    }
    if (!settings.googleAnalyticsMeasurementId) {
      issues.push({
        id: 'google_analytics_missing',
        issueType: 'missing_google_analytics',
        targetType: 'integration',
        targetId: null,
        severity: 'low',
        title: 'Google Analytics غير مربوط',
        description: 'أضف Measurement ID لمعرفة الزيارات والمبيعات القادمة من Google.',
        impact: 'لن تستطيع قياس أثر تحسينات SEO على الزيارات والطلبات.',
        fixMethod: 'أضف Measurement ID الصحيح بصيغة G-XXXXXXXXXX.',
        canAutoFix: false,
        fixAction: 'connect_google_analytics',
      });
    }
    if (!settings.canonicalBaseUrl) {
      issues.push({
        id: 'canonical_base_url_missing',
        issueType: 'canonical_base_url_missing',
        targetType: 'home',
        targetId: null,
        severity: 'medium',
        title: 'الرابط الرسمي للمتجر غير مضبوط',
        description: 'اضبط canonicalBaseUrl حتى تتوحد روابط المتجر أمام محركات البحث.',
        impact: 'قد تتوزع قوة الصفحة بين أكثر من رابط لنفس المحتوى.',
        fixMethod: 'أضف رابط المتجر الرسمي الكامل في الإعدادات المتقدمة.',
        canAutoFix: false,
        fixAction: 'generate_home_seo',
      });
    }
    if (!settings.seoIndexEnabled) {
      issues.push({
        id: 'store_noindex',
        issueType: 'store_noindex',
        targetType: 'home',
        targetId: null,
        severity: 'critical',
        title: 'ظهور المتجر في Google متوقف',
        description: 'إعداد noindex مفعل على مستوى المتجر.',
        impact: 'قد يمنع ذلك فهرسة المتجر بالكامل.',
        fixMethod: 'فعّل خيار إظهار المتجر في Google بعد التأكد من جاهزية المحتوى.',
        canAutoFix: false,
        fixAction: 'generate_home_seo',
      });
    }

    const totalIssues = issues.length;
    const autoFixableIssues = issues.filter((issue) => issue.canAutoFix).length;
    const summary = this.issueSummary(issues);
    const score = this.scoreIssues(issues);
    const sections = this.groupIssues(issues);
    await this.seoRepository.logAuditRun(user.storeId, { score, summary }).catch(() => undefined);
    return {
      score,
      status: this.scoreStatus(score),
      totalIssues,
      autoFixableIssues,
      summary,
      sections,
      checklist: this.buildChecklist(settings, profile?.name ?? 'متجرك', issues),
    };
  }

  async suggestions(user: StoreScopedUser, body: SeoSuggestionDto): Promise<SeoSuggestionResponse> {
    const [settings, profile] = await Promise.all([
      this.getSettings(user),
      this.seoRepository.getStoreProfile(user.storeId),
    ]);
    const storeName = profile?.name_ar ?? profile?.name ?? 'متجرك';

    if (body.targetType === 'home') {
      return { targetType: 'home', targetId: null, suggestions: this.homeSuggestion(storeName) };
    }
    if (body.targetType === 'product' && body.targetId) {
      const product = await this.seoRepository.findProductForSeo(user.storeId, body.targetId);
      if (!product) throw new NotFoundException('Product not found');
      return {
        targetType: 'product',
        targetId: product.id,
        suggestions: this.productSuggestion(product, storeName),
      };
    }
    if (body.targetType === 'category' && body.targetId) {
      const category = await this.seoRepository.findCategoryForSeo(user.storeId, body.targetId);
      if (!category) throw new NotFoundException('Category not found');
      return {
        targetType: 'category',
        targetId: category.id,
        suggestions: this.categorySuggestion(category, storeName),
      };
    }
    if (body.targetType === 'page' && body.targetId) {
      const page = await this.seoRepository.findPageById(user.storeId, body.targetId);
      if (!page) throw new NotFoundException('Page not found');
      return {
        targetType: 'page',
        targetId: page.id,
        suggestions: this.pageSuggestion(this.mapPage(page), storeName),
      };
    }
    return {
      targetType: body.targetType,
      targetId: body.targetId ?? null,
      suggestions: this.homeSuggestion(storeName, settings),
    };
  }

  async autoFix(user: StoreScopedUser, body: SeoAutoFixDto): Promise<SeoAutoFixResponse> {
    const overwriteMode: SeoOverwriteMode =
      body.overwriteMode ?? (body.overwriteExisting ? 'replace_all' : 'missing_only');
    const overwriteExisting = overwriteMode === 'replace_all';
    const scope = body.scope ?? 'all';
    const language = body.language ?? 'both';
    const profile = await this.seoRepository.getStoreProfile(user.storeId);
    const storeName = profile?.name_ar ?? profile?.name ?? 'متجرك';
    const details: SeoAutoFixDetail[] = [];

    if (body.targetId && (scope === 'all' || scope === 'home')) {
      throw new BadRequestException(
        'targetId is only supported for products, categories, and pages',
      );
    }

    if (!body.targetId && (scope === 'all' || scope === 'home')) {
      const current = await this.getSettings(user);
      const suggestion = this.homeSuggestion(storeName);
      const next = { ...current };
      this.applySuggestionToObject(next, suggestion, language, overwriteMode);
      if (JSON.stringify(current) !== JSON.stringify(next)) {
        await this.updateSettings(user, next as unknown as UpdateStoreSeoSettingsDto);
        const fieldsUpdated = this.changedSettingFields(current, next);
        details.push({
          scope: 'home',
          targetType: 'home',
          targetId: null,
          targetTitle: storeName,
          targetName: storeName,
          status: 'fixed',
          fieldsUpdated,
          fields: fieldsUpdated,
          reason: null,
        });
      } else {
        details.push({
          scope: 'home',
          targetType: 'home',
          targetId: null,
          targetTitle: storeName,
          targetName: storeName,
          status: 'skipped',
          fields: [],
          reason: this.skipReason(overwriteMode),
        });
      }
    }

    if (scope === 'all' || scope === 'products') {
      const products = body.targetId
        ? [await this.seoRepository.findProductForSeo(user.storeId, body.targetId)].filter(
            (item): item is SeoProductRecord => Boolean(item),
          )
        : await this.seoRepository.listProductsForSeo(user.storeId, 200);
      if (body.targetId && products.length === 0) throw new NotFoundException('Product not found');
      for (const product of products) {
        const suggestions = this.productSuggestion(product, storeName);
        const fields = this.pickSeoFields(
          product,
          suggestions,
          language,
          overwriteMode,
          body.issueType,
        );
        if (!Object.keys(fields).length) {
          details.push({
            scope: 'products',
            targetType: 'product',
            targetId: product.id,
            targetTitle: product.title_ar ?? product.title,
            targetName: product.title_ar ?? product.title,
            status: 'skipped',
            fields: [],
            reason: this.skipReason(overwriteMode),
          });
          continue;
        }
        const fieldsUpdated = await this.seoRepository.updateProductSeo(
          user.storeId,
          product.id,
          fields,
          overwriteExisting,
        );
        details.push({
          scope: 'products',
          targetType: 'product',
          targetId: product.id,
          targetTitle: product.title_ar ?? product.title,
          targetName: product.title_ar ?? product.title,
          status: 'fixed',
          fieldsUpdated,
          fields: fieldsUpdated,
          reason: null,
        });
      }
    }

    if (scope === 'all' || scope === 'categories') {
      const categories = body.targetId
        ? [await this.seoRepository.findCategoryForSeo(user.storeId, body.targetId)].filter(
            (item): item is SeoCategoryRecord => Boolean(item),
          )
        : await this.seoRepository.listCategoriesForSeo(user.storeId, 200);
      if (body.targetId && categories.length === 0)
        throw new NotFoundException('Category not found');
      for (const category of categories) {
        const suggestions = this.categorySuggestion(category, storeName);
        const fields = this.pickSeoFields(
          category,
          suggestions,
          language,
          overwriteMode,
          body.issueType,
        );
        if (!Object.keys(fields).length) {
          details.push({
            scope: 'categories',
            targetType: 'category',
            targetId: category.id,
            targetTitle: category.name_ar ?? category.name,
            targetName: category.name_ar ?? category.name,
            status: 'skipped',
            fields: [],
            reason: this.skipReason(overwriteMode),
          });
          continue;
        }
        const fieldsUpdated = await this.seoRepository.updateCategorySeo(
          user.storeId,
          category.id,
          fields,
          overwriteExisting,
        );
        details.push({
          scope: 'categories',
          targetType: 'category',
          targetId: category.id,
          targetTitle: category.name_ar ?? category.name,
          targetName: category.name_ar ?? category.name,
          status: 'fixed',
          fieldsUpdated,
          fields: fieldsUpdated,
          reason: null,
        });
      }
    }

    if (scope === 'all' || scope === 'pages') {
      const pages = body.targetId
        ? [await this.seoRepository.findPageById(user.storeId, body.targetId)].filter(
            (item): item is StorePageRecord => Boolean(item),
          )
        : await this.seoRepository.listPagesForSeo(user.storeId, 200);
      if (body.targetId && pages.length === 0) throw new NotFoundException('Page not found');
      for (const page of pages) {
        const mapped = this.mapPage(page);
        const suggestions = this.pageSuggestion(mapped, storeName);
        const next = { ...mapped };
        const before = { ...mapped };
        this.applySuggestionToObject(next, suggestions, language, overwriteMode, body.issueType);
        const changed = this.changedPageFields(before, next);
        if (!changed.length) {
          details.push({
            scope: 'pages',
            targetType: 'page',
            targetId: page.id,
            targetTitle: mapped.titleAr ?? mapped.slug,
            targetName: mapped.titleAr ?? mapped.slug,
            status: 'skipped',
            fields: [],
            reason: this.skipReason(overwriteMode),
          });
          continue;
        }
        await this.updatePage(user, page.id, next as unknown as UpdateStorePageDto);
        details.push({
          scope: 'pages',
          targetType: 'page',
          targetId: page.id,
          targetTitle: mapped.titleAr ?? mapped.slug,
          targetName: mapped.titleAr ?? mapped.slug,
          status: 'fixed',
          fieldsUpdated: changed,
          fields: changed,
          reason: null,
        });
      }
    }

    await this.seoRepository.logFixes(user.storeId, details, {
      scope,
      actorId: 'merchant',
      source: 'template',
      fixType: body.issueType ?? overwriteMode,
    });

    return {
      success: true,
      fixed: details.filter((item) => item.status === 'fixed').length,
      skipped: details.filter((item) => item.status === 'skipped').length,
      failed: details.filter((item) => item.status === 'failed').length,
      fixedCount: details.filter((item) => item.status === 'fixed').length,
      skippedCount: details.filter((item) => item.status === 'skipped').length,
      failedCount: details.filter((item) => item.status === 'failed').length,
      details,
    };
  }

  async fixLogs(user: StoreScopedUser): Promise<{ items: SeoFixLogRecord[] }> {
    return { items: await this.seoRepository.listFixLogs(user.storeId, 20) };
  }

  private normalizeSettings(value: Record<string, unknown>): StoreSeoSettings {
    return {
      homeSeoTitleAr: this.cleanString(value.homeSeoTitleAr),
      homeSeoTitleEn: this.cleanString(value.homeSeoTitleEn),
      homeSeoDescriptionAr: this.cleanString(value.homeSeoDescriptionAr),
      homeSeoDescriptionEn: this.cleanString(value.homeSeoDescriptionEn),
      defaultSeoTitleAr: this.cleanString(value.defaultSeoTitleAr),
      defaultSeoTitleEn: this.cleanString(value.defaultSeoTitleEn),
      defaultSeoDescriptionAr: this.cleanString(value.defaultSeoDescriptionAr),
      defaultSeoDescriptionEn: this.cleanString(value.defaultSeoDescriptionEn),
      defaultOgImage: this.cleanUrl(value.defaultOgImage),
      defaultTwitterImage: this.cleanUrl(value.defaultTwitterImage),
      keywords: Array.isArray(value.keywords)
        ? value.keywords
            .map((item) => this.cleanString(item))
            .filter((item): item is string => Boolean(item))
        : [],
      googleSiteVerification: this.extractVerificationContent(value.googleSiteVerification),
      googleAnalyticsMeasurementId: this.cleanMeasurementId(value.googleAnalyticsMeasurementId),
      bingSiteVerification: this.extractVerificationContent(value.bingSiteVerification),
      facebookDomainVerification: this.extractVerificationContent(value.facebookDomainVerification),
      seoIndexEnabled: typeof value.seoIndexEnabled === 'boolean' ? value.seoIndexEnabled : true,
      seoFollowDefault: typeof value.seoFollowDefault === 'boolean' ? value.seoFollowDefault : true,
      canonicalBaseUrl: this.cleanUrl(value.canonicalBaseUrl),
      defaultLanguage: value.defaultLanguage === 'en' ? 'en' : 'ar',
      supportedLanguages: this.normalizeLanguages(value.supportedLanguages),
    };
  }

  private pushHomeIssues(issues: SeoIssue[], settings: StoreSeoSettings): void {
    if (!settings.homeSeoTitleAr) {
      issues.push({
        id: 'home:missing_title_ar',
        issueType: 'missing_title_ar',
        targetType: 'home',
        targetId: null,
        severity: 'high',
        title: 'عنوان SEO العربي للصفحة الرئيسية غير مكتمل',
        description: 'أضف عنوانًا واضحًا لمتجرك حتى يظهر بشكل أفضل في Google.',
        impact: 'الصفحة الرئيسية هي أهم صفحة في المتجر، وغياب العنوان يضعف وضوحها في نتائج البحث.',
        fixMethod: 'توليد عنوان عربي من اسم المتجر.',
        canAutoFix: true,
        fixAction: 'generate_home_seo',
      });
    }
    if (!settings.homeSeoDescriptionAr) {
      issues.push({
        id: 'home:missing_description_ar',
        issueType: 'missing_description_ar',
        targetType: 'home',
        targetId: null,
        severity: 'high',
        title: 'وصف SEO العربي للصفحة الرئيسية غير مكتمل',
        description: 'أضف وصفًا واضحًا لمتجرك لتحسين ظهوره في Google.',
        impact: 'قد تعرض محركات البحث وصفًا عشوائيًا بدل رسالة واضحة عن المتجر.',
        fixMethod: 'توليد وصف عربي مختصر من اسم المتجر.',
        canAutoFix: true,
        fixAction: 'generate_home_seo',
      });
    }
    if (!settings.homeSeoTitleEn) {
      issues.push({
        id: 'home:missing_title_en',
        issueType: 'missing_title_en',
        targetType: 'home',
        targetId: null,
        severity: 'medium',
        title: 'عنوان SEO الإنجليزي للصفحة الرئيسية غير مكتمل',
        description: 'أضف عنوانًا إنجليزيًا واضحًا لمتجرك.',
        impact: 'يضعف الظهور في سياقات اللغة الإنجليزية.',
        fixMethod: 'توليد عنوان إنجليزي من اسم المتجر.',
        canAutoFix: true,
        fixAction: 'generate_home_seo',
      });
    }
    if (!settings.homeSeoDescriptionEn) {
      issues.push({
        id: 'home:missing_description_en',
        issueType: 'missing_description_en',
        targetType: 'home',
        targetId: null,
        severity: 'medium',
        title: 'وصف SEO الإنجليزي للصفحة الرئيسية غير مكتمل',
        description: 'أضف وصفًا إنجليزيًا واضحًا لمتجرك.',
        impact: 'يضعف جودة معاينة الصفحة عند استخدام اللغة الإنجليزية.',
        fixMethod: 'توليد وصف إنجليزي مختصر من اسم المتجر.',
        canAutoFix: true,
        fixAction: 'generate_home_seo',
      });
    }
    this.pushLengthIssue(
      issues,
      'home',
      null,
      null,
      settings.homeSeoTitleAr,
      'title_ar',
      'generate_home_seo',
      TITLE_MIN,
      TITLE_MAX,
    );
    this.pushLengthIssue(
      issues,
      'home',
      null,
      null,
      settings.homeSeoDescriptionAr,
      'description_ar',
      'generate_home_seo',
      DESCRIPTION_MIN,
      DESCRIPTION_MAX,
    );
    this.pushLengthIssue(
      issues,
      'home',
      null,
      null,
      settings.homeSeoTitleEn,
      'title_en',
      'generate_home_seo',
      TITLE_MIN,
      TITLE_MAX,
    );
    this.pushLengthIssue(
      issues,
      'home',
      null,
      null,
      settings.homeSeoDescriptionEn,
      'description_en',
      'generate_home_seo',
      DESCRIPTION_MIN,
      DESCRIPTION_MAX,
    );
  }

  private pushTargetIssues(
    issues: SeoIssue[],
    input: {
      targetType: 'product' | 'category' | 'page';
      targetId: string;
      targetTitle: string;
      titleAr: string | null;
      titleEn: string | null;
      descriptionAr: string | null;
      descriptionEn: string | null;
      fixAction: SeoIssue['fixAction'];
    },
  ): void {
    if (!input.descriptionAr) {
      issues.push({
        id: `${input.targetType}-${input.targetId}:missing_description_ar`,
        issueType: 'missing_description_ar',
        targetType: input.targetType,
        targetId: input.targetId,
        targetTitle: input.targetTitle,
        severity: 'medium',
        title: this.issueTitle(input.targetType, 'description', 'ar'),
        description: 'هذا العنصر لا يحتوي على وصف SEO عربي.',
        impact: 'قد يظهر في نتائج البحث بوصف عشوائي أو غير واضح.',
        fixMethod: 'توليد وصف عربي من بيانات العنصر بدون استخدام AI.',
        canAutoFix: true,
        fixAction: input.fixAction,
      });
    }
    if (!input.titleAr) {
      issues.push({
        id: `${input.targetType}-${input.targetId}:missing_title_ar`,
        issueType: 'missing_title_ar',
        targetType: input.targetType,
        targetId: input.targetId,
        targetTitle: input.targetTitle,
        severity: 'medium',
        title: this.issueTitle(input.targetType, 'title', 'ar'),
        description: 'أضف عنوانًا واضحًا لهذا العنصر في نتائج البحث.',
        impact: 'قد يستخدم Google عنوانًا غير مناسب من محتوى الصفحة.',
        fixMethod: 'توليد عنوان عربي من اسم العنصر واسم المتجر.',
        canAutoFix: true,
        fixAction: input.fixAction,
      });
    }
    if (!input.descriptionEn) {
      issues.push({
        id: `${input.targetType}-${input.targetId}:missing_description_en`,
        issueType: 'missing_description_en',
        targetType: input.targetType,
        targetId: input.targetId,
        targetTitle: input.targetTitle,
        severity: 'low',
        title: this.issueTitle(input.targetType, 'description', 'en'),
        description: 'هذا العنصر لا يحتوي على وصف SEO إنجليزي.',
        impact: 'قد يضعف ظهوره عند العملاء أو المتصفحات باللغة الإنجليزية.',
        fixMethod: 'توليد وصف إنجليزي من بيانات العنصر بدون استخدام AI.',
        canAutoFix: true,
        fixAction: input.fixAction,
      });
    }
    if (!input.titleEn) {
      issues.push({
        id: `${input.targetType}-${input.targetId}:missing_title_en`,
        issueType: 'missing_title_en',
        targetType: input.targetType,
        targetId: input.targetId,
        targetTitle: input.targetTitle,
        severity: 'low',
        title: this.issueTitle(input.targetType, 'title', 'en'),
        description: 'أضف عنوانًا إنجليزيًا واضحًا لهذا العنصر في نتائج البحث.',
        impact: 'قد يضعف ظهوره في سياقات اللغة الإنجليزية.',
        fixMethod: 'توليد عنوان إنجليزي من اسم العنصر واسم المتجر.',
        canAutoFix: true,
        fixAction: input.fixAction,
      });
    }
    this.pushLengthIssue(
      issues,
      input.targetType,
      input.targetId,
      input.targetTitle,
      input.titleAr,
      'title_ar',
      input.fixAction,
      TITLE_MIN,
      TITLE_MAX,
    );
    this.pushLengthIssue(
      issues,
      input.targetType,
      input.targetId,
      input.targetTitle,
      input.descriptionAr,
      'description_ar',
      input.fixAction,
      DESCRIPTION_MIN,
      DESCRIPTION_MAX,
    );
    this.pushLengthIssue(
      issues,
      input.targetType,
      input.targetId,
      input.targetTitle,
      input.titleEn,
      'title_en',
      input.fixAction,
      TITLE_MIN,
      TITLE_MAX,
    );
    this.pushLengthIssue(
      issues,
      input.targetType,
      input.targetId,
      input.targetTitle,
      input.descriptionEn,
      'description_en',
      input.fixAction,
      DESCRIPTION_MIN,
      DESCRIPTION_MAX,
    );
  }

  private pushLengthIssue(
    issues: SeoIssue[],
    targetType: SeoIssue['targetType'],
    targetId: string | null,
    targetTitle: string | null,
    value: string | null,
    field: 'title_ar' | 'title_en' | 'description_ar' | 'description_en',
    fixAction: SeoIssue['fixAction'],
    min: number,
    max: number,
  ): void {
    const length = value?.trim().length ?? 0;
    if (length > 0 && (length < min || length > max)) {
      const direction = length < min ? 'too_short' : 'too_long';
      const issueType = `${field}_${direction}` as SeoIssueType;
      issues.push({
        id: `${targetType}-${targetId}:${issueType}`,
        issueType,
        targetType,
        targetId,
        targetTitle: targetTitle ?? undefined,
        severity: 'low',
        title: `${this.fieldLabel(field)} ${length < min ? 'قصير جدًا' : 'طويل جدًا'}`,
        description: `الأفضل أن يكون الطول بين ${min} و${max} حرفًا.`,
        impact: 'الطول غير المناسب قد يجعل نتيجة البحث أقل وضوحًا أو يتم اقتطاعها.',
        fixMethod: 'تحسين النص تلقائيًا ضمن حدود الطول المناسبة.',
        canAutoFix: true,
        fixAction,
      });
    }
  }

  private issueTitle(
    targetType: string,
    field: 'title' | 'description',
    language: 'ar' | 'en',
  ): string {
    const label =
      targetType === 'product' ? 'المنتج' : targetType === 'category' ? 'التصنيف' : 'الصفحة';
    const languageLabel = language === 'ar' ? 'العربي' : 'الإنجليزي';
    return field === 'title'
      ? `${label} لا يحتوي على عنوان SEO ${languageLabel}`
      : `${label} لا يحتوي على وصف SEO ${languageLabel}`;
  }

  private fieldLabel(field: 'title_ar' | 'title_en' | 'description_ar' | 'description_en'): string {
    if (field === 'title_ar') return 'عنوان SEO العربي';
    if (field === 'title_en') return 'عنوان SEO الإنجليزي';
    if (field === 'description_ar') return 'وصف SEO العربي';
    return 'وصف SEO الإنجليزي';
  }

  private pushDuplicateIssues<T extends { id: string }>(
    issues: SeoIssue[],
    rows: T[],
    targetType: 'product' | 'category' | 'page',
    nameKey: keyof T,
    valueKey: keyof T,
    issueType: SeoIssueType,
    title: string,
    fixAction: SeoIssue['fixAction'],
  ): void {
    const groups = new Map<string, T[]>();
    for (const row of rows) {
      const value =
        typeof row[valueKey] === 'string' ? String(row[valueKey]).trim().toLowerCase() : '';
      if (!value) continue;
      groups.set(value, [...(groups.get(value) ?? []), row]);
    }
    for (const duplicated of groups.values()) {
      if (duplicated.length < 2) continue;
      for (const row of duplicated) {
        const targetTitle = typeof row[nameKey] === 'string' ? String(row[nameKey]) : undefined;
        issues.push({
          id: `${targetType}-${row.id}:${issueType}`,
          issueType,
          targetType,
          targetId: row.id,
          targetTitle,
          severity: 'medium',
          title,
          description:
            'هذا النص مستخدم في أكثر من عنصر، والأفضل أن يكون لكل عنصر عنوان ووصف فريدان.',
          impact: 'التكرار يجعل محركات البحث أقل قدرة على تمييز الصفحة المناسبة للظهور.',
          fixMethod: 'استخدم إصلاح التحسين لتوليد نص مميز لهذا العنصر.',
          canAutoFix: true,
          fixAction,
        });
      }
    }
  }

  private issueSummary(issues: SeoIssue[]): SeoAuditSummary {
    return {
      critical: issues.filter((issue) => this.normalizedSeverity(issue.severity) === 'critical')
        .length,
      high: issues.filter((issue) => this.normalizedSeverity(issue.severity) === 'high').length,
      medium: issues.filter((issue) => this.normalizedSeverity(issue.severity) === 'medium').length,
      low: issues.filter((issue) => this.normalizedSeverity(issue.severity) === 'low').length,
      info: issues.filter((issue) => this.normalizedSeverity(issue.severity) === 'info').length,
      fixable: issues.filter((issue) => issue.canAutoFix).length,
      manual: issues.filter((issue) => !issue.canAutoFix).length,
    };
  }

  private scoreIssues(issues: SeoIssue[]): number {
    const penalty = issues.reduce(
      (sum, issue) => sum + SEVERITY_WEIGHT[this.normalizedSeverity(issue.severity)],
      0,
    );
    return Math.max(0, Math.min(100, 100 - penalty));
  }

  private normalizedSeverity(severity: SeoSeverity): Exclude<SeoSeverity, 'warning'> {
    return severity === 'warning' ? 'medium' : severity;
  }

  private groupIssues(issues: SeoIssue[]): SeoAuditSection[] {
    const sections = [
      {
        key: 'home',
        label: 'الصفحة الرئيسية',
        filter: (issue: SeoIssue) => issue.targetType === 'home',
      },
      {
        key: 'products',
        label: 'المنتجات',
        filter: (issue: SeoIssue) => issue.targetType === 'product',
      },
      {
        key: 'categories',
        label: 'التصنيفات',
        filter: (issue: SeoIssue) => issue.targetType === 'category',
      },
      { key: 'pages', label: 'الصفحات', filter: (issue: SeoIssue) => issue.targetType === 'page' },
      {
        key: 'integrations',
        label: 'الربط والتحقق',
        filter: (issue: SeoIssue) => issue.targetType === 'integration',
      },
    ];
    return sections.map((section) => {
      const sectionIssues = issues.filter(section.filter);
      return {
        key: section.key,
        label: section.label,
        score: this.scoreIssues(sectionIssues),
        issuesCount: sectionIssues.length,
        fixableCount: sectionIssues.filter((issue) => issue.canAutoFix).length,
        issues: sectionIssues,
      };
    });
  }

  private buildChecklist(
    settings: StoreSeoSettings,
    storeName: string,
    issues: SeoIssue[],
  ): SeoChecklistItem[] {
    return [
      {
        key: 'store_name',
        label: 'اسم المتجر واضح',
        status: storeName ? 'done' : 'error',
        priority: 'high',
        action: null,
      },
      {
        key: 'home_description',
        label: 'وصف الصفحة الرئيسية مكتمل',
        status: settings.homeSeoDescriptionAr ? 'done' : 'warning',
        priority: 'high',
        action: settings.homeSeoDescriptionAr ? null : 'إصلاح',
      },
      {
        key: 'products',
        label: `${issues.filter((issue) => issue.targetType === 'product').length} مشكلة في منتجات تحتاج SEO`,
        status: issues.some((issue) => issue.targetType === 'product') ? 'warning' : 'done',
        priority: 'high',
        action: 'إصلاح المنتجات',
      },
      {
        key: 'categories',
        label: `${issues.filter((issue) => issue.targetType === 'category').length} مشكلة في التصنيفات`,
        status: issues.some((issue) => issue.targetType === 'category') ? 'warning' : 'done',
        priority: 'medium',
        action: 'إصلاح التصنيفات',
      },
      {
        key: 'og_image',
        label: 'صورة المشاركة مضافة',
        status: settings.defaultOgImage ? 'done' : 'error',
        priority: 'medium',
        action: settings.defaultOgImage ? null : 'إعداد',
      },
      {
        key: 'analytics',
        label: 'Google Analytics مربوط',
        status: settings.googleAnalyticsMeasurementId ? 'done' : 'warning',
        priority: 'low',
        action: settings.googleAnalyticsMeasurementId ? null : 'إعداد',
      },
      {
        key: 'sitemap',
        label: 'Sitemap يعمل تلقائيًا',
        status: 'done',
        priority: 'low',
        action: null,
      },
      {
        key: 'robots',
        label: 'Robots يعمل تلقائيًا',
        status: 'done',
        priority: 'low',
        action: null,
      },
    ];
  }

  private scoreStatus(score: number): SeoAuditDetailsResponse['status'] {
    if (score >= 90) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 45) return 'needs_improvement';
    return 'poor';
  }

  private homeSuggestion(storeName: string, _settings?: StoreSeoSettings): SeoSuggestionValues {
    return {
      titleAr: this.limitText(`${storeName} | تسوق أونلاين في اليمن`, 70),
      descriptionAr: this.limitText(
        `تسوق من ${storeName} في اليمن، واكتشف منتجات مختارة بتفاصيل واضحة وتجربة طلب سهلة.`,
        170,
      ),
      titleEn: this.limitText(`${storeName} | Online shopping in Yemen`, 70),
      descriptionEn: this.limitText(
        `Shop from ${storeName} in Yemen with clear product details and an easy ordering experience.`,
        170,
      ),
    };
  }

  private productSuggestion(product: SeoProductRecord, storeName: string): SeoSuggestionValues {
    const nameAr = product.title_ar ?? product.title;
    const nameEn = product.title_en ?? product.title;
    const categoryAr = product.category_name_ar ?? product.category_name ?? 'منتجات مختارة';
    return {
      titleAr: this.limitText(`${nameAr} - ${storeName}`, 70),
      descriptionAr: this.limitText(
        `اشترِ ${nameAr} من ${storeName} في اليمن. ${categoryAr} بتفاصيل واضحة وتجربة طلب سهلة.`,
        170,
      ),
      titleEn: this.limitText(`${nameEn} - ${storeName}`, 70),
      descriptionEn: this.limitText(
        `Shop ${nameEn} from ${storeName}. Clear product details, easy ordering, and reliable shopping experience.`,
        170,
      ),
    };
  }

  private categorySuggestion(category: SeoCategoryRecord, storeName: string): SeoSuggestionValues {
    const nameAr = category.name_ar ?? category.name;
    const nameEn = category.name_en ?? category.name;
    return {
      titleAr: this.limitText(`${nameAr} - ${storeName}`, 70),
      descriptionAr: this.limitText(
        `تصفح منتجات ${nameAr} في ${storeName}. خيارات متعددة، تفاصيل واضحة، وتجربة طلب سهلة.`,
        170,
      ),
      titleEn: this.limitText(`${nameEn} - ${storeName}`, 70),
      descriptionEn: this.limitText(
        `Browse ${nameEn} products at ${storeName}. Multiple options, clear details, and easy ordering.`,
        170,
      ),
    };
  }

  private pageSuggestion(page: StorePageResponse, storeName: string): SeoSuggestionValues {
    const titleAr = page.titleAr ?? page.slug;
    const titleEn = page.titleEn ?? page.slug;
    return {
      titleAr: this.limitText(`${titleAr} - ${storeName}`, 70),
      descriptionAr: this.limitText(
        `تعرف على ${titleAr} في ${storeName}، مع معلومات واضحة تساعدك على التسوق بثقة.`,
        170,
      ),
      titleEn: this.limitText(`${titleEn} - ${storeName}`, 70),
      descriptionEn: this.limitText(
        `Learn about ${titleEn} at ${storeName} with clear information that helps you shop confidently.`,
        170,
      ),
    };
  }

  private applySuggestionToObject(
    target: Partial<StoreSeoSettings & StorePageResponse>,
    suggestion: SeoSuggestionValues,
    language: 'ar' | 'en' | 'both',
    overwriteMode: SeoOverwriteMode,
    issueType?: string,
  ): void {
    const map = [
      ['homeSeoTitleAr', 'seoTitleAr', 'titleAr', 'missing_title_ar'],
      ['homeSeoDescriptionAr', 'seoDescriptionAr', 'descriptionAr', 'missing_description_ar'],
      ['homeSeoTitleEn', 'seoTitleEn', 'titleEn', 'missing_title_en'],
      ['homeSeoDescriptionEn', 'seoDescriptionEn', 'descriptionEn', 'missing_description_en'],
    ] as const;
    for (const [settingsKey, pageKey, suggestionKey, missingIssueType] of map) {
      if (
        (suggestionKey.endsWith('Ar') && language === 'en') ||
        (suggestionKey.endsWith('En') && language === 'ar')
      )
        continue;
      if (issueType && !this.issueTypeTargetsField(issueType, missingIssueType)) continue;
      const key = settingsKey in target ? settingsKey : pageKey;
      if (
        this.shouldWriteSeoText(
          target[key] as string | null | undefined,
          overwriteMode,
          missingIssueType,
        )
      ) {
        target[key] = suggestion[suggestionKey];
      }
    }
  }

  private pickSeoFields(
    target: SeoProductRecord | SeoCategoryRecord,
    suggestion: SeoSuggestionValues,
    language: 'ar' | 'en' | 'both',
    overwriteMode: SeoOverwriteMode,
    issueType?: string,
  ): Partial<
    Pick<StorePageInput, 'seoTitleAr' | 'seoTitleEn' | 'seoDescriptionAr' | 'seoDescriptionEn'>
  > {
    const fields: Partial<
      Pick<StorePageInput, 'seoTitleAr' | 'seoTitleEn' | 'seoDescriptionAr' | 'seoDescriptionEn'>
    > = {};
    if (
      (language === 'ar' || language === 'both') &&
      (!issueType || this.issueTypeTargetsField(issueType, 'missing_title_ar')) &&
      this.shouldWriteSeoText(target.seo_title_ar, overwriteMode, 'missing_title_ar')
    )
      fields.seoTitleAr = suggestion.titleAr;
    if (
      (language === 'ar' || language === 'both') &&
      (!issueType || this.issueTypeTargetsField(issueType, 'missing_description_ar')) &&
      this.shouldWriteSeoText(target.seo_description_ar, overwriteMode, 'missing_description_ar')
    )
      fields.seoDescriptionAr = suggestion.descriptionAr;
    if (
      (language === 'en' || language === 'both') &&
      (!issueType || this.issueTypeTargetsField(issueType, 'missing_title_en')) &&
      this.shouldWriteSeoText(target.seo_title_en, overwriteMode, 'missing_title_en')
    )
      fields.seoTitleEn = suggestion.titleEn;
    if (
      (language === 'en' || language === 'both') &&
      (!issueType || this.issueTypeTargetsField(issueType, 'missing_description_en')) &&
      this.shouldWriteSeoText(target.seo_description_en, overwriteMode, 'missing_description_en')
    )
      fields.seoDescriptionEn = suggestion.descriptionEn;
    return fields;
  }

  private issueTypeTargetsField(issueType: string, missingIssueType: string): boolean {
    const field = missingIssueType.replace('missing_', '');
    return (
      issueType === missingIssueType ||
      issueType.startsWith(`${field}_`) ||
      issueType === `duplicate_${field}`
    );
  }

  private shouldWriteSeoText(
    value: string | null | undefined,
    overwriteMode: SeoOverwriteMode,
    issueType: string,
  ): boolean {
    if (overwriteMode === 'replace_all') return true;
    const length = value?.trim().length ?? 0;
    if (length === 0) return true;
    if (overwriteMode === 'missing_only') return false;
    if (issueType.includes('title')) return length < TITLE_MIN || length > TITLE_MAX;
    if (issueType.includes('description'))
      return length < DESCRIPTION_MIN || length > DESCRIPTION_MAX;
    return false;
  }

  private skipReason(overwriteMode: SeoOverwriteMode): string {
    if (overwriteMode === 'missing_only')
      return 'SEO fields already exist and overwrite mode is missing_only';
    if (overwriteMode === 'improve_weak')
      return 'SEO fields are present and within the accepted length range';
    return 'No eligible SEO fields were changed';
  }

  private changedSettingFields(before: StoreSeoSettings, after: StoreSeoSettings): string[] {
    return (
      ['homeSeoTitleAr', 'homeSeoDescriptionAr', 'homeSeoTitleEn', 'homeSeoDescriptionEn'] as const
    ).filter((key) => before[key] !== after[key]);
  }

  private changedPageFields(before: StorePageResponse, after: StorePageResponse): string[] {
    return (['seoTitleAr', 'seoDescriptionAr', 'seoTitleEn', 'seoDescriptionEn'] as const).filter(
      (key) => before[key] !== after[key],
    );
  }

  private limitText(value: string, maxLength: number): string {
    const text = value.replace(/\s+/g, ' ').trim();
    return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1).trim()}.`;
  }

  private async normalizePageInput(
    storeId: string,
    body: CreateStorePageDto | UpdateStorePageDto | StorePageResponse,
    exceptPageId?: string,
  ): Promise<StorePageInput> {
    const slug = this.cleanString(body.slug)?.toLowerCase() ?? '';
    if (!slug || RESERVED_SLUGS.has(slug)) {
      throw new BadRequestException('Slug is reserved or invalid');
    }
    if (await this.seoRepository.pageSlugExists(storeId, slug, exceptPageId)) {
      throw new BadRequestException('Slug is already used by another page');
    }
    const pageKey = this.cleanPageKey(body.pageKey);
    if (pageKey) {
      const existingKeyPage = await this.seoRepository.findPageByKey(storeId, pageKey);
      if (existingKeyPage && existingKeyPage.id !== exceptPageId) {
        throw new BadRequestException('Page key is already used by another page');
      }
    }

    const status = body.status ?? 'draft';
    return {
      slug,
      pageKey,
      pageType: body.pageType ?? 'custom',
      titleAr: this.cleanString(body.titleAr),
      titleEn: this.cleanString(body.titleEn),
      contentAr: this.sanitizeHtmlish(body.contentAr),
      contentEn: this.sanitizeHtmlish(body.contentEn),
      excerptAr: this.cleanString(body.excerptAr),
      excerptEn: this.cleanString(body.excerptEn),
      seoTitleAr: this.cleanString(body.seoTitleAr),
      seoTitleEn: this.cleanString(body.seoTitleEn),
      seoDescriptionAr: this.cleanString(body.seoDescriptionAr),
      seoDescriptionEn: this.cleanString(body.seoDescriptionEn),
      ogImage: this.cleanUrl(body.ogImage),
      faqItems: Array.isArray(body.faqItems)
        ? body.faqItems.filter((item) => item && typeof item === 'object')
        : [],
      seoIndex: body.seoIndex ?? true,
      seoFollow: body.seoFollow ?? true,
      showInHeader: body.showInHeader ?? false,
      showInFooter: body.showInFooter ?? true,
      sortOrder: body.sortOrder ?? 0,
      status,
    };
  }

  private mapPage(row: StorePageRecord): StorePageResponse {
    return {
      id: row.id,
      slug: row.slug,
      pageKey: row.page_key as StorePageResponse['pageKey'],
      pageType: row.page_type as StorePageResponse['pageType'],
      titleAr: row.title_ar,
      titleEn: row.title_en,
      contentAr: row.content_ar,
      contentEn: row.content_en,
      excerptAr: row.excerpt_ar,
      excerptEn: row.excerpt_en,
      seoTitleAr: row.seo_title_ar,
      seoTitleEn: row.seo_title_en,
      seoDescriptionAr: row.seo_description_ar,
      seoDescriptionEn: row.seo_description_en,
      ogImage: row.og_image,
      faqItems: row.faq_items ?? [],
      seoIndex: row.seo_index,
      seoFollow: row.seo_follow,
      showInHeader: row.show_in_header,
      showInFooter: row.show_in_footer,
      sortOrder: row.sort_order,
      status: row.status as StorePageResponse['status'],
      publishedAt: row.published_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private cleanString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
  }

  private cleanUrl(value: unknown): string | null {
    const text = this.cleanString(value);
    if (!text) {
      return null;
    }
    try {
      const url = new URL(text);
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
    } catch {
      return null;
    }
  }

  private extractVerificationContent(value: unknown): string | null {
    const text = this.cleanString(value);
    if (!text) {
      return null;
    }
    const match = /content=["']([^"']+)["']/i.exec(text);
    return (match?.[1] ?? text).replace(/[<>"']/g, '').trim() || null;
  }

  private cleanMeasurementId(value: unknown): string | null {
    const text = this.cleanString(value)?.toUpperCase() ?? null;
    if (!text) {
      return null;
    }
    return /^G-[A-Z0-9]{4,24}$/.test(text) ? text : null;
  }

  private normalizeLanguages(value: unknown): Array<'ar' | 'en'> {
    const languages = Array.isArray(value)
      ? value.filter((item) => item === 'ar' || item === 'en')
      : [];
    return languages.length > 0 ? [...new Set(languages)] : ['ar', 'en'];
  }

  private sanitizeHtmlish(value: unknown): string | null {
    const text = this.cleanString(value);
    if (!text) {
      return null;
    }
    return text
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/\son[a-z]+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '');
  }

  private cleanPageKey(value: unknown): StorePageKey | null {
    return SYSTEM_PAGES.some((page) => page.pageKey === value) ? (value as StorePageKey) : null;
  }

  private buildSystemPage(
    definition: (typeof SYSTEM_PAGES)[number],
    store: NonNullable<Awaited<ReturnType<SeoRepository['getStoreProfile']>>>,
  ): Partial<StorePageResponse> {
    const storeNameAr = store.name_ar ?? store.name;
    const storeNameEn = store.name_en ?? store.name;
    const content = this.systemPageContent(definition.pageKey, store, storeNameAr, storeNameEn);
    return {
      slug: definition.slug,
      pageKey: definition.pageKey,
      pageType: definition.pageType,
      titleAr: definition.titleAr,
      titleEn: definition.titleEn,
      contentAr: content.ar,
      contentEn: content.en,
      excerptAr: this.limitText(content.ar.replace(/\n+/g, ' '), 260),
      excerptEn: this.limitText(content.en.replace(/\n+/g, ' '), 260),
      seoTitleAr: this.limitText(`${definition.titleAr} - ${storeNameAr}`, 70),
      seoTitleEn: this.limitText(`${definition.titleEn} - ${storeNameEn}`, 70),
      seoDescriptionAr: this.limitText(content.ar.replace(/\n+/g, ' '), 170),
      seoDescriptionEn: this.limitText(content.en.replace(/\n+/g, ' '), 170),
      faqItems: [],
      seoIndex: true,
      seoFollow: true,
      showInHeader: definition.showInHeader,
      showInFooter: definition.showInFooter,
      sortOrder: definition.sortOrder,
      status: 'published',
    };
  }

  private mergeGeneratedPage(
    current: StorePageResponse,
    generated: Partial<StorePageResponse>,
    overwrite: boolean,
  ): Partial<StorePageResponse> {
    const next = { ...current };
    const generatedFields = [
      'pageKey',
      'pageType',
      'titleAr',
      'titleEn',
      'contentAr',
      'contentEn',
      'excerptAr',
      'excerptEn',
      'seoTitleAr',
      'seoTitleEn',
      'seoDescriptionAr',
      'seoDescriptionEn',
    ] as const;
    for (const field of generatedFields) {
      if (overwrite || !next[field]) {
        next[field] = generated[field] as never;
      }
    }
    next.showInHeader = current.showInHeader ?? generated.showInHeader ?? false;
    next.showInFooter = current.showInFooter ?? generated.showInFooter ?? true;
    next.sortOrder = current.sortOrder || generated.sortOrder || 0;
    next.seoIndex = current.seoIndex ?? true;
    next.seoFollow = current.seoFollow ?? true;
    next.status = 'published';
    return next;
  }

  private changedBootstrapFields(
    before: StorePageResponse,
    after: Partial<StorePageResponse>,
  ): string[] {
    return (
      [
        'pageKey',
        'pageType',
        'titleAr',
        'titleEn',
        'contentAr',
        'contentEn',
        'excerptAr',
        'excerptEn',
        'seoTitleAr',
        'seoTitleEn',
        'seoDescriptionAr',
        'seoDescriptionEn',
        'showInHeader',
        'showInFooter',
        'sortOrder',
        'status',
      ] as const
    ).filter((key) => before[key] !== after[key]);
  }

  private systemPageContent(
    pageKey: StorePageKey,
    store: NonNullable<Awaited<ReturnType<SeoRepository['getStoreProfile']>>>,
    storeNameAr: string,
    storeNameEn: string,
  ): { ar: string; en: string } {
    const address = [store.address, store.address_details, store.city, store.country]
      .filter(Boolean)
      .join(', ');
    const socialLinks = Object.entries(store.social_links ?? {})
      .filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
      .map(([key, value]) => `${key}: ${value}`);
    const hours = this.formatWorkingHours(store.working_hours);
    const contactLines = [
      store.phone ? `الهاتف: ${store.phone}` : null,
      address ? `العنوان: ${address}` : null,
      hours ? `ساعات العمل:\n${hours}` : null,
      socialLinks.length ? `روابط التواصل:\n${socialLinks.join('\n')}` : null,
    ]
      .filter(Boolean)
      .join('\n\n');

    if (pageKey === 'about') {
      const ar =
        store.description_ar ??
        `مرحباً بك في ${storeNameAr}. نقدم تجربة تسوق واضحة ومنظمة تساعدك على اختيار المنتجات وطلبها بسهولة.`;
      const en =
        store.description_en ??
        `Welcome to ${storeNameEn}. We provide a clear shopping experience that helps customers choose and order products easily.`;
      return { ar, en };
    }
    if (pageKey === 'contact') {
      return {
        ar:
          contactLines || `يمكنك التواصل مع ${storeNameAr} للاستفسار عن المنتجات والطلبات والدعم.`,
        en: [
          `Contact ${storeNameEn} for product, order, and support questions.`,
          store.phone ? `Phone: ${store.phone}` : null,
          address ? `Address: ${address}` : null,
          hours ? `Working hours:\n${hours}` : null,
          socialLinks.length ? `Social links:\n${socialLinks.join('\n')}` : null,
        ]
          .filter(Boolean)
          .join('\n\n'),
      };
    }
    if (pageKey === 'shipping_policy')
      return this.policyContent(
        store.shipping_policy,
        storeNameAr,
        storeNameEn,
        'سياسة الشحن',
        'Shipping policy',
      );
    if (pageKey === 'return_policy')
      return this.policyContent(
        store.return_policy,
        storeNameAr,
        storeNameEn,
        'سياسة الإرجاع',
        'Return policy',
      );
    if (pageKey === 'privacy_policy')
      return this.policyContent(
        store.privacy_policy,
        storeNameAr,
        storeNameEn,
        'سياسة الخصوصية',
        'Privacy policy',
      );
    if (pageKey === 'terms')
      return this.policyContent(
        store.terms_of_service,
        storeNameAr,
        storeNameEn,
        'الشروط والأحكام',
        'Terms and conditions',
      );
    return {
      ar: `تجد هنا إجابات مختصرة لأكثر الأسئلة شيوعاً حول الطلبات والدفع والشحن في ${storeNameAr}.`,
      en: `Find short answers to common order, payment, and shipping questions at ${storeNameEn}.`,
    };
  }

  private policyContent(
    policy: string | null,
    storeNameAr: string,
    storeNameEn: string,
    titleAr: string,
    titleEn: string,
  ): { ar: string; en: string } {
    return {
      ar:
        policy ?? `${titleAr} الخاصة بمتجر ${storeNameAr} ستظهر هنا بعد إضافتها من إعدادات المتجر.`,
      en:
        policy ??
        `${titleEn} for ${storeNameEn} will appear here after it is added in store settings.`,
    };
  }

  private formatWorkingHours(value: SeoStoreProfile['working_hours']): string | null {
    if (!Array.isArray(value) || value.length === 0) return null;
    const lines = value
      .map((day: SeoStoreProfile['working_hours'][number]) => {
        if (day.isClosed) return `${day.day}: مغلق`;
        const slots = Array.isArray(day.slots)
          ? day.slots
              .map((slot: { open: string; close: string }) => `${slot.open}-${slot.close}`)
              .join(', ')
          : '';
        return slots ? `${day.day}: ${slots}` : null;
      })
      .filter(Boolean);
    return lines.length ? lines.join('\n') : null;
  }
}

export interface StorePageResponse {
  id: string;
  slug: string;
  pageKey: StorePageKey | null;
  pageType: 'custom' | 'about' | 'contact' | 'faq' | 'policy';
  titleAr: string | null;
  titleEn: string | null;
  contentAr: string | null;
  contentEn: string | null;
  excerptAr: string | null;
  excerptEn: string | null;
  seoTitleAr: string | null;
  seoTitleEn: string | null;
  seoDescriptionAr: string | null;
  seoDescriptionEn: string | null;
  ogImage: string | null;
  faqItems: Array<Record<string, unknown>>;
  seoIndex: boolean;
  seoFollow: boolean;
  showInHeader: boolean;
  showInFooter: boolean;
  sortOrder: number;
  status: 'draft' | 'published' | 'archived';
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BootstrapStorePageResult {
  pageKey: StorePageKey;
  status: 'created' | 'updated' | 'skipped';
  page: StorePageResponse;
  changedFields?: string[];
}

export interface BootstrapStorePagesResponse {
  items: BootstrapStorePageResult[];
}

export interface SeoAuditResponse {
  score: number;
  status: SeoAuditDetailsResponse['status'];
  counts: Record<string, number>;
  issuesTotal: number;
  summary: SeoAuditSummary;
  sections: Array<
    Pick<SeoAuditSection, 'key' | 'score' | 'issuesCount' | 'fixableCount'> & { title: string }
  >;
  recommendations: string[];
}

export interface SeoIssue {
  id: string;
  issueType: SeoIssueType;
  scope?: SeoScope;
  targetType: SeoTargetType;
  targetId: string | null;
  targetTitle?: string;
  targetName?: string;
  severity: SeoSeverity;
  title: string;
  description: string;
  impact: string;
  fixMethod: string;
  canAutoFix: boolean;
  fixAction:
    | 'generate_home_seo'
    | 'generate_product_seo'
    | 'generate_category_seo'
    | 'generate_page_seo'
    | 'upload_default_share_image'
    | 'connect_google_analytics';
}

export interface SeoAuditSection {
  key: string;
  label: string;
  score: number;
  issuesCount: number;
  fixableCount: number;
  issues: SeoIssue[];
}

export interface SeoAuditSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  fixable: number;
  manual: number;
}

export interface SeoChecklistItem {
  key: string;
  label: string;
  status: 'done' | 'warning' | 'error';
  priority: 'high' | 'medium' | 'low';
  action: string | null;
}

export interface SeoAuditDetailsResponse {
  score: number;
  status: 'excellent' | 'good' | 'needs_improvement' | 'poor';
  summary: SeoAuditSummary;
  totalIssues: number;
  autoFixableIssues: number;
  sections: SeoAuditSection[];
  checklist: SeoChecklistItem[];
}

export interface SeoSuggestionValues {
  titleAr: string;
  descriptionAr: string;
  titleEn: string;
  descriptionEn: string;
}

export interface SeoSuggestionResponse {
  targetType: 'home' | 'product' | 'category' | 'page';
  targetId: string | null;
  suggestions: SeoSuggestionValues;
}

export interface SeoAutoFixDetail {
  scope: Exclude<SeoScope, 'all'>;
  targetType: 'home' | 'product' | 'category' | 'page';
  targetId: string | null;
  targetTitle: string;
  targetName: string;
  status: 'fixed' | 'skipped' | 'failed';
  fieldsUpdated?: string[];
  fields: string[];
  reason: string | null;
}

export interface SeoFixLogOptions {
  scope: SeoScope;
  actorId: string;
  source: 'template' | 'manual' | 'system' | 'ai';
  fixType: string;
}

export interface SeoFixLogRecord {
  id: string;
  merchantId: string | null;
  storeId: string;
  actorId: string | null;
  actorType: string;
  scope: string;
  targetId: string | null;
  targetName: string | null;
  fixType: string;
  fieldsChanged: string[];
  oldValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
  source: string;
  status: string;
  reason: string | null;
  createdAt: string;
}

export interface SeoAutoFixResponse {
  success: boolean;
  fixed: number;
  skipped: number;
  failed: number;
  fixedCount: number;
  skippedCount: number;
  failedCount: number;
  details: SeoAutoFixDetail[];
}
