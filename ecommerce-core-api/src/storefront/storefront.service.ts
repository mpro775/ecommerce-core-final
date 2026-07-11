import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { CategoriesRepository } from '../categories/categories.repository';
import { CustomerEngagementService } from '../customers/customer-engagement.service';
import { CustomersService } from '../customers/customers.service';
import { AbandonedCartsService } from '../customers/abandoned-carts.service';
import { FiltersService, type StorefrontSmartFilter } from '../filters/filters.service';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { InventoryService } from '../inventory/inventory.service';
import { OutboxService } from '../messaging/outbox.service';
import {
  ProductsRepository,
  type ProductImageRecord,
  type ProductRecord,
  type ProductVariantRecord,
} from '../products/products.repository';
import { MediaRepository } from '../media/media.repository';
import {
  OrdersRepository,
  type CartItemSnapshot,
  type OrderRecord,
  type OrderStatusHistoryRecord,
} from '../orders/orders.repository';
import {
  PromotionsService,
  type PromotionComputationInput,
  type PromotionComputationResult,
} from '../promotions/promotions.service';
import {
  ShippingCalculatorService,
  type ShippingMethodQuote,
} from '../shipping/shipping-calculator.service';
import {
  ShippingRepository,
  type ShippingMethodRangeRecord,
  type ShippingMethodRecord,
  type ShippingZoneRecord,
} from '../shipping/shipping.repository';
import { StoresRepository } from '../stores/stores.repository';
import { StoreCapabilitiesService } from '../store-capabilities/store-capabilities.service';
import {
  CurrencyService,
  type ResolvedCurrency,
  type VariantCurrencyOverride,
} from '../currency/currency.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import {
  AffiliatesService,
  type CheckoutAttributionResolution,
} from '../affiliates/affiliates.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import {
  PaymentMethodsRepository,
  type PaymentMethodSnapshot,
} from '../payment-methods/payment-methods.repository';
import { PaymentMethodsService } from '../payment-methods/payment-methods.service';
import { SeoService, type StorePageResponse } from '../seo/seo.service';
import { StoreResolverService } from './store-resolver.service';
import { StorefrontTrackingService } from './storefront-tracking.service';
import {
  type StorefrontAnalyticsEventName,
  type StorefrontEventType,
} from './constants/storefront-event.constants';
import type { AddCartItemDto } from './dto/add-cart-item.dto';
import type { CheckoutDto } from './dto/checkout.dto';
import type { CheckoutQuoteDto } from './dto/checkout-quote.dto';
import type { ListStorefrontFiltersQueryDto } from './dto/list-storefront-filters-query.dto';
import type { TrackStorefrontEventDto } from './dto/track-storefront-event.dto';

export interface StorefrontProductResponse {
  id: string;
  productType: 'single' | 'bundled' | 'digital';
  isVisible: boolean;
  stockUnlimited: boolean;
  questionsEnabled: boolean;
  title: string;
  titleAr: string | null;
  titleEn: string | null;
  slug: string;
  description: string | null;
  descriptionAr: string | null;
  descriptionEn: string | null;
  shortDescriptionAr: string | null;
  shortDescriptionEn: string | null;
  detailedDescriptionAr: string | null;
  detailedDescriptionEn: string | null;
  categoryId: string | null;
  primaryImageUrl: string | null;
  priceFrom: number | null;
  priceFromYER: number | null;
  brand: string | null;
  weight: number | null;
  weightUnit: string | null;
  dimensions: { length?: number; width?: number; height?: number } | null;
  productLabel: string | null;
  youtubeUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoTitleAr: string | null;
  seoTitleEn: string | null;
  seoDescriptionAr: string | null;
  seoDescriptionEn: string | null;
  tags: string[];
  isFeatured: boolean;
  isTaxable: boolean;
  taxRate: number;
  minOrderQuantity: number;
  maxOrderQuantity: number | null;
  ratingAvg: number;
  ratingCount: number;
}

export interface StorefrontCategoryResponse {
  id: string;
  name: string;
  nameAr: string | null;
  nameEn: string | null;
  slug: string;
  description: string | null;
  descriptionAr: string | null;
  descriptionEn: string | null;
  imageUrl: string | null;
  imageAltAr: string | null;
  imageAltEn: string | null;
  backgroundImageUrl: string | null;
  seoTitleAr: string | null;
  seoTitleEn: string | null;
  seoDescriptionAr: string | null;
  seoDescriptionEn: string | null;
  parentId: string | null;
}

export interface StorefrontShippingZoneResponse {
  id: string;
  name: string;
  city: string | null;
  area: string | null;
  description: string | null;
  fee: number;
}

export interface StorefrontFulfillmentOptionsResponse {
  hasOptions: boolean;
  pickup: ShippingMethodQuote[];
  deliveryZones: Array<StorefrontShippingZoneResponse & { methods: ShippingMethodQuote[] }>;
}

export interface PublicStoreResolveResponse {
  storeId: string;
  storeSlug: string;
  storeSettings: {
    name: string;
    nameAr: string | null;
    nameEn: string | null;
    descriptionAr: string | null;
    descriptionEn: string | null;
    description: string | null;
    logoUrl: string | null;
    faviconUrl: string | null;
    currencyCode: string;
    baseCurrencyCode: 'YER';
    defaultCurrencyCode: string;
    currencies: Array<{
      currencyCode: string;
      yerPerUnit: number;
      decimalDigits: number;
      roundingIncrement: number;
      isDefault: boolean;
      isActive: boolean;
    }>;
    socialLinks: Record<string, string | null>;
    phone: string | null;
    email: string | null;
    address: string | null;
    workingHours: unknown;
    policies: StorefrontPoliciesResponse;
    language: 'ar' | 'en';
    seoSettings: Awaited<ReturnType<SeoService['getSettings']>>;
  };
}

export interface StorefrontPoliciesResponse {
  shippingPolicy: string | null;
  returnPolicy: string | null;
  privacyPolicy: string | null;
  termsAndConditions: string | null;
  loyaltyPolicy: string | null;
}

export interface StorefrontCartResponse {
  cartId: string;
  currencyCode: string;
  exchangeRateYerPerUnit: number;
  subtotalYER: number;
  subtotal: number;
  totalItems: number;
  items: Array<{
    productId: string;
    variantId: string;
    title: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    unitPriceYER: number;
    lineTotal: number;
    lineTotalYER: number;
  }>;
}

export interface CheckoutResponse {
  orderId: string;
  orderCode: string;
  status: string;
  total: number;
  currencyCode: string;
  exchangeRateYerPerUnit: number;
  subtotalYER: number;
  totalYER: number;
  shippingFeeYER: number;
  discountTotalYER: number;
  shippingFee: number;
  discountTotal: number;
  pointsRedeemed: number;
  pointsDiscountAmount: number;
  pointsDiscountAmountYER: number;
  pointsEarned: number;
}

export interface CheckoutQuoteResponse {
  subtotal: number;
  shippingFee: number;
  availableShippingMethods: ShippingMethodQuote[];
  selectedShippingMethodId: string | null;
  promotionDiscount: number;
  pointsDiscount: number;
  total: number;
  currencyCode: string;
  exchangeRateYerPerUnit: number;
  subtotalYER: number;
  totalYER: number;
  shippingFeeYER: number;
  promotionDiscountYER: number;
  pointsDiscountYER: number;
  pointsToRedeemApplied: number;
  potentialEarnPoints: number;
  availablePoints: number;
}

type QueryRunner = {
  query: <T = unknown>(
    queryText: string,
    values?: unknown[],
  ) => Promise<{ rows: T[]; rowCount: number | null }>;
};

interface CheckoutData {
  cart: { id: string; currency_code: string; exchange_rate_yer_per_unit: string };
  items: CartItemSnapshot[];
  inventoryReservationItems: Array<{ variantId: string; quantity: number; sku: string }>;
  subtotal: number;
  subtotalYER: number;
  shippingZone: ShippingZoneRecord | null;
  shippingMethod: ShippingMethodQuote | null;
  shippingMethodYER: ShippingMethodQuote | null;
  availableShippingMethods: ShippingMethodQuote[];
  availableShippingMethodsYER: ShippingMethodQuote[];
  promotion: PromotionComputationResult;
  promotionYER: PromotionComputationResult;
  pointsToRedeem: number;
  pointsDiscountAmount: number;
  pointsDiscountAmountYER: number;
  pointsRedeemed: number;
  customerIdForLoyalty: string | null;
  potentialEarnPoints: number;
  affiliateAttribution: CheckoutAttributionResolution | null;
  total: number;
  totalYER: number;
  currency: ResolvedCurrency;
  paymentSnapshot: PaymentMethodSnapshot | null;
  payerReceiptUrl: string | null;
}

interface StorefrontCategoryFilterInput {
  categoryId?: string;
  categorySlug?: string;
}

interface ParsedProductsQuery extends StorefrontCategoryFilterInput {
  page: number;
  limit: number;
  ids?: string[];
  q?: string;
  filters?: Record<string, string[]>;
  ranges?: Record<string, { min?: number; max?: number }>;
  isFeatured?: boolean;
  brand?: string[];
  attr?: Record<string, string[]>;
  priceMin?: number;
  priceMax?: number;
  warehouse?: string[];
  inStock?: boolean;
}

@Injectable()
export class StorefrontService {
  constructor(
    private readonly storeResolverService: StoreResolverService,
    private readonly categoriesRepository: CategoriesRepository,
    private readonly filtersService: FiltersService,
    private readonly idempotencyService: IdempotencyService,
    private readonly inventoryService: InventoryService,
    private readonly productsRepository: ProductsRepository,
    private readonly ordersRepository: OrdersRepository,
    private readonly shippingRepository: ShippingRepository,
    private readonly shippingCalculatorService: ShippingCalculatorService,
    private readonly promotionsService: PromotionsService,
    private readonly storeCapabilitiesService: StoreCapabilitiesService,
    private readonly outboxService: OutboxService,
    private readonly storesRepository: StoresRepository,
    private readonly webhooksService: WebhooksService,
    private readonly customersService: CustomersService,
    private readonly customerEngagementService: CustomerEngagementService,
    private readonly abandonedCartsService: AbandonedCartsService,
    private readonly storefrontTrackingService: StorefrontTrackingService,
    private readonly loyaltyService: LoyaltyService,
    private readonly affiliatesService: AffiliatesService,
    private readonly paymentMethodsService: PaymentMethodsService,
    private readonly paymentMethodsRepository: PaymentMethodsRepository,
    private readonly mediaRepository: MediaRepository,
    private readonly seoService: SeoService,
    private readonly currencyService: CurrencyService,
  ) {}

  async getStore(request: Request) {
    const store = await this.storeResolverService.resolve(request);
    await this.storefrontTrackingService.trackEvent(request, {
      storeId: store.id,
      eventType: 'store_visit',
    });

    return {
      id: store.id,
      name: store.name,
      slug: store.slug,
      logoUrl: store.logo_url,
      faviconUrl: store.favicon_url,
      currencyCode: store.currency_code,
    };
  }

  async resolvePublicStore(request: Request): Promise<PublicStoreResolveResponse> {
    const store = await this.storeResolverService.resolve(request);
    const [storeSettings, seoSettings] = await Promise.all([
      this.storesRepository.findById(store.id),
      this.seoService.getSettings({ storeId: store.id }),
    ]);
    const currencies = await this.currencyService.listStoreCurrencies(store.id);
    const defaultCurrency = currencies.find((currency) => currency.isDefault);
    const selectedCurrency = await this.currencyService.resolveStoreCurrency(
      store.id,
      this.readCurrencyCode(request),
    );

    return {
      storeId: store.id,
      storeSlug: store.slug,
      storeSettings: {
        name: storeSettings?.name ?? store.name,
        nameAr: storeSettings?.name_ar ?? storeSettings?.name ?? store.name,
        nameEn: storeSettings?.name_en ?? null,
        descriptionAr: storeSettings?.description_ar ?? null,
        descriptionEn: storeSettings?.description_en ?? null,
        description: storeSettings?.description_ar ?? storeSettings?.description_en ?? null,
        logoUrl: storeSettings?.logo_url ?? store.logo_url,
        faviconUrl: storeSettings?.favicon_url ?? store.favicon_url,
        currencyCode: selectedCurrency.currencyCode,
        baseCurrencyCode: 'YER',
        defaultCurrencyCode:
          defaultCurrency?.currencyCode ?? storeSettings?.default_currency_code ?? 'YER',
        currencies,
        socialLinks: this.normalizeSocialLinks(storeSettings?.social_links),
        phone: storeSettings?.phone ?? null,
        email: null,
        address: this.formatStoreAddress(storeSettings),
        workingHours: storeSettings?.working_hours ?? null,
        policies: {
          shippingPolicy: storeSettings?.shipping_policy ?? null,
          returnPolicy: storeSettings?.return_policy ?? null,
          privacyPolicy: storeSettings?.privacy_policy ?? null,
          termsAndConditions: storeSettings?.terms_of_service ?? null,
          loyaltyPolicy: storeSettings?.loyalty_policy ?? null,
        },
        language: this.containsArabic(storeSettings?.name ?? store.name) ? 'ar' : 'en',
        seoSettings,
      },
    };
  }

  async listCategories(request: Request): Promise<StorefrontCategoryResponse[]> {
    const store = await this.storeResolverService.resolve(request);
    const categories = await this.categoriesRepository.listActive(store.id);

    return categories.map((category) => ({
      id: category.id,
      name: category.name,
      nameAr: category.name_ar,
      nameEn: category.name_en,
      slug: category.slug,
      description: category.description,
      descriptionAr: category.description_ar,
      descriptionEn: category.description_en,
      imageUrl: category.image_url,
      imageAltAr: category.image_alt_ar,
      imageAltEn: category.image_alt_en,
      backgroundImageUrl: category.background_image_url,
      seoTitleAr: category.seo_title_ar,
      seoTitleEn: category.seo_title_en,
      seoDescriptionAr: category.seo_description_ar,
      seoDescriptionEn: category.seo_description_en,
      parentId: category.parent_id,
    }));
  }

  async listShippingZones(request: Request): Promise<StorefrontShippingZoneResponse[]> {
    const store = await this.storeResolverService.resolve(request);
    const zones = await this.shippingRepository.listActive(store.id);

    return zones.map((zone) => ({
      id: zone.id,
      name: zone.name,
      city: zone.city,
      area: zone.area,
      description: zone.description,
      fee: Number(zone.fee),
    }));
  }

  async listFulfillmentOptions(request: Request): Promise<StorefrontFulfillmentOptionsResponse> {
    const store = await this.storeResolverService.resolve(request);
    const zones = await this.shippingRepository.listActive(store.id);
    const methods = await this.shippingRepository.listActiveMethodsAcrossZones(store.id);
    const methodsByZoneId = new Map<string, ShippingMethodQuote[]>();

    for (const zone of zones) {
      const zoneMethods = methods.filter((method) => method.shipping_zone_id === zone.id);
      const resolution = this.shippingCalculatorService.resolveMethod({
        zone,
        methods: zoneMethods,
        items: [],
        subtotal: 0,
        couponCode: null,
        couponIsFreeShipping: false,
        autoSelectStrategy: 'none',
      });
      methodsByZoneId.set(zone.id, resolution.availableMethods);
    }

    return {
      hasOptions: methods.length > 0,
      pickup: [...methodsByZoneId.values()]
        .flat()
        .filter((method) => method.type === 'store_pickup'),
      deliveryZones: zones
        .map((zone) => ({
          id: zone.id,
          name: zone.name,
          city: zone.city,
          area: zone.area,
          description: zone.description,
          fee: Number(zone.fee),
          methods: (methodsByZoneId.get(zone.id) ?? []).filter(
            (method) => method.type !== 'store_pickup',
          ),
        }))
        .filter((zone) => zone.methods.length > 0),
    };
  }

  async listFilters(
    request: Request,
    query: ListStorefrontFiltersQueryDto,
  ): Promise<StorefrontSmartFilter[]> {
    const store = await this.storeResolverService.resolve(request);
    const categoryId = query.categoryId ?? undefined;
    return this.filtersService.listStorefrontFilters(store.id, true, categoryId);
  }

  async listProducts(request: Request) {
    const query = this.parseProductsQuery(request);
    const store = await this.storeResolverService.resolve(request);
    const currency = await this.currencyService.resolveStoreCurrency(
      store.id,
      this.readCurrencyCode(request),
    );
    const page = query.page;
    const limit = query.limit;
    if (query.ids && query.ids.length > 0) {
      const rows = await Promise.all(
        query.ids.map((productId) => this.productsRepository.findById(store.id, productId)),
      );
      const visibleRows = rows.filter((row): row is ProductRecord =>
        Boolean(row && row.status === 'active' && row.is_visible),
      );
      const items = await Promise.all(
        visibleRows.map(async (row) => {
          const listingMeta = await this.getProductListingMeta(store.id, row.id, currency);
          return this.mapProduct(row, listingMeta);
        }),
      );

      return {
        items,
        total: items.length,
        page: 1,
        limit: query.ids.length,
      };
    }
    const categoryId = await this.resolveStorefrontCategoryId(store.id, query);

    const smartFilters = await this.resolveSmartFilterParams(store.id, query);

    const result = await this.productsRepository.list({
      storeId: store.id,
      q: query.q?.trim(),
      categoryId,
      status: 'active',
      isVisible: true,
      isFeatured: query.isFeatured,
      filterValueFilters: smartFilters.filterValueFilters,
      filterRangeFilters: smartFilters.filterRangeFilters,
      attributeFilters: smartFilters.attributeFilters,
      brandFilter: smartFilters.brandFilter,
      warehouseFilter: smartFilters.warehouseFilter,
      inStockOnly: smartFilters.inStockOnly,
      priceMin: smartFilters.priceMin,
      priceMax: smartFilters.priceMax,
      limit,
      offset: (page - 1) * limit,
    });

    const items = await Promise.all(
      result.rows.map(async (row) => {
        const listingMeta = await this.getProductListingMeta(store.id, row.id, currency);
        return this.mapProduct(row, listingMeta);
      }),
    );

    return {
      items,
      total: result.total,
      page,
      limit,
    };
  }

  async getProductDetails(request: Request, slug: string) {
    const store = await this.storeResolverService.resolve(request);
    const currency = await this.currencyService.resolveStoreCurrency(
      store.id,
      this.readCurrencyCode(request),
    );
    const product = await this.productsRepository.findBySlug(store.id, slug);
    if (!product || product.status !== 'active' || !product.is_visible) {
      throw new NotFoundException('Product not found');
    }

    const [variants, images] = await Promise.all([
      this.productsRepository.listVariants(store.id, product.id),
      this.productsRepository.listProductImages(store.id, product.id),
    ]);

    const overrideMap = await this.currencyService.listVariantOverrides(
      store.id,
      variants.map((variant) => variant.id),
    );
    const listingMeta = this.computeProductListingMeta(variants, images, currency, overrideMap);

    await this.storefrontTrackingService.trackEvent(request, {
      storeId: store.id,
      eventType: 'product_view',
      productId: product.id,
      metadata: {
        productSlug: slug,
      },
    });

    return {
      ...this.mapProduct(product, listingMeta),
      variants: variants.map((variant) =>
        this.mapVariant(variant, currency, overrideMap.get(variant.id) ?? []),
      ),
      images: images.map((image) => this.mapImage(image)),
    };
  }

  async getPolicies(request: Request): Promise<StorefrontPoliciesResponse> {
    const store = await this.storeResolverService.resolve(request);
    const storeSettings = await this.storesRepository.findById(store.id);
    if (!storeSettings) {
      throw new NotFoundException('Store not found');
    }

    return {
      shippingPolicy: storeSettings.shipping_policy,
      returnPolicy: storeSettings.return_policy,
      privacyPolicy: storeSettings.privacy_policy,
      termsAndConditions: storeSettings.terms_of_service,
      loyaltyPolicy: storeSettings.loyalty_policy,
    };
  }

  async trackCustomEvent(
    request: Request,
    input: TrackStorefrontEventDto,
  ): Promise<{ accepted: true }> {
    const store = await this.storeResolverService.resolve(request);
    const eventType = this.mapAnalyticsEventToEventType(input.eventName);

    await this.storefrontTrackingService.trackEvent(request, {
      storeId: store.id,
      eventType,
      ...(input.cartId ? { cartId: input.cartId } : {}),
      ...(input.orderId ? { orderId: input.orderId } : {}),
      ...(input.productId ? { productId: input.productId } : {}),
      ...(input.variantId ? { variantId: input.variantId } : {}),
      metadata: {
        eventName: input.eventName,
        ...(input.sessionId ? { clientSessionId: input.sessionId } : {}),
        ...(input.metadata ?? {}),
      },
    });

    return { accepted: true };
  }

  async addCartItem(request: Request, input: AddCartItemDto): Promise<StorefrontCartResponse> {
    const store = await this.storeResolverService.resolve(request);
    const currency = await this.currencyService.resolveStoreCurrency(store.id, input.currencyCode);
    await this.inventoryService.releaseExpiredReservations(store.id);
    const variant = await this.requireVariant(store.id, input.variantId);
    const cart = await this.resolveCart(store.id, currency, input.cartId);

    if (variant.product_type === 'bundled') {
      await this.ensureBundleComponentsStock(store.id, variant.product_id, input.quantity);
    } else if (!variant.stock_unlimited) {
      const availableStock = await this.inventoryService.getAvailableStock(
        store.id,
        variant.variant_id,
      );
      this.ensureStockAvailable(availableStock ?? 0, input.quantity);
    }

    const overrideMap = await this.currencyService.listVariantOverrides(store.id, [
      variant.variant_id,
    ]);
    const unitPrice = this.currencyService.priceFromYer(
      Number(variant.price),
      currency,
      overrideMap.get(variant.variant_id) ?? [],
    );
    await this.ordersRepository.addOrIncrementCartItem({
      cartId: cart.id,
      storeId: store.id,
      productId: variant.product_id,
      variantId: variant.variant_id,
      quantity: input.quantity,
      unitPrice,
      unitPriceYER: Number(variant.price),
    });

    const items = await this.ordersRepository.listCartItems(store.id, cart.id);
    const mappedCart = await this.mapCart(cart.id, currency, items);
    await this.storefrontTrackingService.trackEvent(request, {
      storeId: store.id,
      eventType: 'add_to_cart',
      cartId: cart.id,
      productId: variant.product_id,
      variantId: variant.variant_id,
      metadata: {
        quantity: input.quantity,
      },
    });

    await this.publishCartSignals({
      storeId: store.id,
      cartId: cart.id,
      customerId: null,
      sessionId: null,
      variant,
      quantity: input.quantity,
      cart: mappedCart,
    });

    return mappedCart;
  }

  async listPages(request: Request): Promise<{ items: StorePageResponse[] }> {
    const store = await this.storeResolverService.resolve(request);
    const pages = await this.seoService.listPages({ storeId: store.id });
    return {
      items: pages.items.filter((page) => page.status === 'published'),
    };
  }

  async getPageBySlug(request: Request, slug: string): Promise<StorePageResponse> {
    const store = await this.storeResolverService.resolve(request);
    const pages = await this.seoService.listPages({ storeId: store.id });
    const page = pages.items.find((item) => item.slug === slug && item.status === 'published');
    if (!page) {
      throw new NotFoundException('Page not found');
    }
    return page;
  }

  async getCart(
    request: Request,
    cartId: string,
    currencyCode?: string,
  ): Promise<StorefrontCartResponse> {
    const store = await this.storeResolverService.resolve(request);
    const cart = await this.ordersRepository.findOpenCartById(store.id, cartId);
    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    const currency = await this.currencyService.resolveStoreCurrency(
      store.id,
      currencyCode ?? cart.currency_code,
    );
    await this.ordersRepository.updateCartCurrency({
      storeId: store.id,
      cartId: cart.id,
      currencyCode: currency.currencyCode,
      exchangeRateYerPerUnit: currency.yerPerUnit,
    });
    const items = await this.ordersRepository.listCartItems(store.id, cart.id);
    return this.mapCart(cart.id, currency, items);
  }

  async updateCartItemQuantity(
    request: Request,
    cartId: string,
    variantId: string,
    quantity: number,
    currencyCode?: string,
  ): Promise<StorefrontCartResponse> {
    if (quantity <= 0) {
      return this.removeCartItem(request, cartId, variantId, currencyCode);
    }

    const store = await this.storeResolverService.resolve(request);
    await this.inventoryService.releaseExpiredReservations(store.id);
    const cart = await this.requireOpenCart(store.id, cartId);
    const variant = await this.requireVariant(store.id, variantId);

    if (variant.product_type === 'bundled') {
      await this.ensureBundleComponentsStock(store.id, variant.product_id, quantity);
    } else if (!variant.stock_unlimited) {
      const availableStock = await this.inventoryService.getAvailableStock(
        store.id,
        variant.variant_id,
      );
      this.ensureStockAvailable(availableStock ?? 0, quantity);
    }

    const updated = await this.ordersRepository.updateCartItemQuantity({
      storeId: store.id,
      cartId: cart.id,
      variantId,
      quantity,
    });

    if (!updated) {
      throw new NotFoundException('Cart item not found');
    }

    return this.getCart(request, cart.id, currencyCode ?? cart.currency_code);
  }

  async removeCartItem(
    request: Request,
    cartId: string,
    variantId: string,
    currencyCode?: string,
  ): Promise<StorefrontCartResponse> {
    const store = await this.storeResolverService.resolve(request);
    const cart = await this.requireOpenCart(store.id, cartId);

    const removed = await this.ordersRepository.removeCartItem({
      storeId: store.id,
      cartId: cart.id,
      variantId,
    });

    if (!removed) {
      throw new NotFoundException('Cart item not found');
    }

    return this.getCart(request, cart.id, currencyCode ?? cart.currency_code);
  }

  async resolveAbandonedCartRecovery(token: string): Promise<string> {
    const resolved = await this.abandonedCartsService.resolveRecoveryRedirect(token);
    return resolved.redirectUrl;
  }

  async trackAbandonedCartRecoveryOpen(token: string): Promise<void> {
    await this.abandonedCartsService.trackRecoveryEmailOpen(token);
  }

  async quoteCheckout(request: Request, input: CheckoutQuoteDto): Promise<CheckoutQuoteResponse> {
    const store = await this.storeResolverService.resolve(request);
    const checkoutData = await this.prepareCheckoutData(store.id, input, request, {
      requirePaymentMethod: false,
    });

    return {
      subtotal: checkoutData.subtotal,
      subtotalYER: checkoutData.subtotalYER,
      shippingFee: checkoutData.shippingMethod?.cost ?? 0,
      availableShippingMethods: checkoutData.availableShippingMethods,
      selectedShippingMethodId: checkoutData.shippingMethod?.id ?? null,
      promotionDiscount: checkoutData.promotion.totalDiscount,
      promotionDiscountYER: checkoutData.promotionYER.totalDiscount,
      pointsDiscount: checkoutData.pointsDiscountAmount,
      pointsDiscountYER: checkoutData.pointsDiscountAmountYER,
      total: checkoutData.total,
      currencyCode: checkoutData.cart.currency_code,
      exchangeRateYerPerUnit: checkoutData.currency.yerPerUnit,
      totalYER: checkoutData.totalYER,
      shippingFeeYER: checkoutData.shippingMethodYER?.cost ?? 0,
      pointsToRedeemApplied: checkoutData.pointsRedeemed,
      potentialEarnPoints: checkoutData.potentialEarnPoints,
      availablePoints: checkoutData.customerIdForLoyalty
        ? (
            await this.loyaltyService.getWalletForCurrentCustomer(
              checkoutData.customerIdForLoyalty,
              store.id,
            )
          ).availablePoints
        : 0,
    };
  }

  async checkout(
    request: Request,
    input: CheckoutDto,
    idempotencyKey?: string,
  ): Promise<CheckoutResponse> {
    const store = await this.storeResolverService.resolve(request);

    await this.storefrontTrackingService.trackEvent(request, {
      storeId: store.id,
      eventType: 'checkout_start',
      cartId: input.cartId,
      metadata: {
        paymentMethod: input.paymentMethod,
        hasCoupon: Boolean(input.couponCode?.trim()),
        hasRestockToken: Boolean(input.restockToken?.trim()),
      },
    });

    if (idempotencyKey) {
      const cachedResult = await this.idempotencyService.checkOrPrepare({
        storeId: store.id,
        key: idempotencyKey,
        requestBody: input,
      });

      if (cachedResult.isCached && cachedResult.record) {
        return cachedResult.record.response as unknown as CheckoutResponse;
      }
    }

    await this.storeCapabilitiesService.assertMetricCanGrow(store.id, 'orders.monthly', 1);

    const checkoutData = await this.prepareCheckoutData(store.id, input, request);
    const orderId = uuidv4();
    const orderCode = this.generateOrderCode();

    const order = await this.executeCheckoutTransaction(
      store.id,
      input,
      checkoutData,
      orderId,
      orderCode,
    );

    await this.abandonedCartsService.attachRecoveredCheckout({
      storeId: store.id,
      cartId: input.cartId,
      orderId: order.id,
    });

    const restockToken = input.restockToken?.trim();
    if (restockToken && order.customer_id) {
      await this.customerEngagementService.attachRestockConversion({
        token: restockToken,
        storeId: store.id,
        customerId: order.customer_id,
        orderId: order.id,
        amount: Number(order.total),
      });
    }

    await this.publishOrderCreated(order, store.id);
    await this.webhooksService.dispatchEvent(store.id, 'order.created', {
      orderId: order.id,
      orderCode: order.order_code,
      status: order.status,
      total: Number(order.total),
      currencyCode: order.currency_code,
    });
    await this.storeCapabilitiesService.recordUsageEvent(store.id, 'orders.monthly', 1, {
      orderId: order.id,
      orderCode: order.order_code,
    });

    const response = this.mapCheckoutResponse(order);

    await this.storefrontTrackingService.trackEvent(request, {
      storeId: store.id,
      eventType: 'checkout_complete',
      cartId: input.cartId,
      orderId: order.id,
      metadata: {
        paymentMethod: input.paymentMethod,
        total: response.total,
        currencyCode: response.currencyCode,
      },
    });

    if (checkoutData.promotion.couponCode) {
      await this.storefrontTrackingService.trackEvent(request, {
        storeId: store.id,
        eventType: 'coupon_apply',
        cartId: input.cartId,
        orderId: order.id,
        metadata: {
          couponCode: checkoutData.promotion.couponCode,
          discountTotal: checkoutData.promotion.totalDiscount,
          total: response.total,
          currencyCode: response.currencyCode,
        },
      });
    }

    if (idempotencyKey) {
      await this.idempotencyService.storeResponse(
        store.id,
        idempotencyKey,
        input,
        response as unknown as Record<string, unknown>,
        order.id,
      );
    }

    return response;
  }

  async trackOrder(request: Request, orderCode: string, phone?: string) {
    const store = await this.storeResolverService.resolve(request);
    const order = await this.ordersRepository.findOrderByCode(store.id, orderCode);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    await this.assertTrackOrderPhone(order.id, phone);

    const history = await this.ordersRepository.listOrderStatusHistory(order.id);
    return {
      orderCode: order.order_code,
      status: order.status,
      total: Number(order.total),
      currencyCode: order.currency_code,
      timeline: history.map((entry) => this.mapStatusHistory(entry)),
      updatedAt: order.updated_at,
    };
  }

  async trackRestockToken(token: string): Promise<string> {
    return this.customerEngagementService.trackRestockClickAndBuildRedirect(token.trim());
  }

  private mapProduct(
    row: ProductRecord,
    listingMeta: {
      primaryImageUrl: string | null;
      priceFrom: number | null;
      priceFromYER: number | null;
    },
  ): StorefrontProductResponse {
    return {
      id: row.id,
      productType: row.product_type,
      isVisible: row.is_visible,
      stockUnlimited: row.stock_unlimited,
      questionsEnabled: row.questions_enabled,
      title: row.title,
      titleAr: row.title_ar,
      titleEn: row.title_en,
      slug: row.slug,
      description: row.description,
      descriptionAr: row.description_ar,
      descriptionEn: row.description_en,
      shortDescriptionAr: row.short_description_ar,
      shortDescriptionEn: row.short_description_en,
      detailedDescriptionAr: row.detailed_description_ar,
      detailedDescriptionEn: row.detailed_description_en,
      categoryId: row.category_id,
      primaryImageUrl: listingMeta.primaryImageUrl,
      priceFrom: listingMeta.priceFrom,
      priceFromYER: listingMeta.priceFromYER,
      brand: row.brand,
      weight: row.weight ? Number(row.weight) : null,
      weightUnit: row.weight_unit,
      dimensions: row.dimensions,
      productLabel: row.product_label,
      youtubeUrl: row.youtube_url,
      seoTitle: row.seo_title,
      seoDescription: row.seo_description,
      seoTitleAr: row.seo_title_ar,
      seoTitleEn: row.seo_title_en,
      seoDescriptionAr: row.seo_description_ar,
      seoDescriptionEn: row.seo_description_en,
      tags: row.tags,
      isFeatured: row.is_featured,
      isTaxable: row.is_taxable,
      taxRate: Number(row.tax_rate),
      minOrderQuantity: row.min_order_quantity,
      maxOrderQuantity: row.max_order_quantity,
      ratingAvg: Number(row.rating_avg),
      ratingCount: row.rating_count,
    };
  }

  private mapVariant(
    variant: ProductVariantRecord,
    currency: ResolvedCurrency,
    overrides: VariantCurrencyOverride[] = [],
  ) {
    const priceYER = Number(variant.price);
    const compareAtPriceYER = variant.compare_at_price ? Number(variant.compare_at_price) : null;
    return {
      id: variant.id,
      title: variant.title,
      titleAr: variant.title_ar,
      titleEn: variant.title_en,
      sku: variant.sku,
      price: this.currencyService.priceFromYer(priceYER, currency, overrides),
      priceYER,
      compareAtPrice: this.currencyService.compareAtFromYer(compareAtPriceYER, currency, overrides),
      compareAtPriceYER,
      stockQuantity: variant.stock_quantity,
      isDefault: variant.is_default,
      attributes: variant.attributes,
    };
  }

  private mapImage(image: ProductImageRecord) {
    return {
      id: image.id,
      url: image.public_url,
      altText: image.alt_text,
      sortOrder: image.sort_order,
      variantId: image.variant_id,
    };
  }

  private mapAnalyticsEventToEventType(
    eventName: StorefrontAnalyticsEventName,
  ): StorefrontEventType {
    if (eventName === 'sf_checkout_completed') {
      return 'checkout_complete';
    }

    if (
      eventName === 'sf_checkout_started' ||
      eventName === 'sf_checkout_step_completed' ||
      eventName === 'sf_checkout_submitted'
    ) {
      return 'checkout_start';
    }

    if (eventName === 'sf_add_to_cart_clicked' || eventName === 'sf_cart_item_updated') {
      return 'add_to_cart';
    }

    if (eventName === 'sf_product_viewed') {
      return 'product_view';
    }

    return 'store_visit';
  }

  private async resolveStorefrontCategoryId(
    storeId: string,
    query: StorefrontCategoryFilterInput,
  ): Promise<string | undefined> {
    if (query.categoryId) {
      return query.categoryId;
    }

    const categorySlug = query.categorySlug?.trim();
    if (!categorySlug) {
      return undefined;
    }

    const category = await this.categoriesRepository.findBySlug(storeId, categorySlug);
    if (!category || !category.is_active) {
      throw new NotFoundException('Category not found');
    }

    return category.id;
  }

  private parseProductsQuery(request: Request): ParsedProductsQuery {
    const page = this.parseQueryNumber(
      this.readSingleQueryString(request, 'page'),
      1,
      1,
      10_000,
      'page',
    );
    const limit = this.parseQueryNumber(
      this.readSingleQueryString(request, 'limit'),
      20,
      1,
      100,
      'limit',
    );
    const q = this.readSingleQueryString(request, 'q');
    const categoryId = this.readSingleQueryString(request, 'categoryId');
    const categorySlug = this.readSingleQueryString(request, 'categorySlug');
    const isFeaturedRaw = this.readSingleQueryString(request, 'isFeatured');
    const ids = this.readIdsQuery(request, 'ids');

    if (categoryId && !this.isUuidV4(categoryId)) {
      throw new BadRequestException('categoryId must be a valid UUID');
    }
    if (categorySlug && !this.isSlug(categorySlug)) {
      throw new BadRequestException('categorySlug is invalid');
    }

    let isFeatured: boolean | undefined;
    if (isFeaturedRaw === 'true') {
      isFeatured = true;
    } else if (isFeaturedRaw === 'false') {
      isFeatured = false;
    }

    const filters = this.extractFilterValueParams(request);
    const ranges = this.extractRangeFilterParams(request);
    const brand = this.extractBrandParam(request);
    const attr = this.extractAttrParams(request);
    const priceMin = this.parseOptionalNumber(this.readSingleQueryString(request, 'priceMin'));
    const priceMax = this.parseOptionalNumber(this.readSingleQueryString(request, 'priceMax'));
    const warehouse = this.extractWarehouseParam(request);
    const inStockRaw = this.readSingleQueryString(request, 'inStock');
    const inStock = inStockRaw === 'true' ? true : undefined;

    return {
      page,
      limit,
      ...(q ? { q } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(categorySlug ? { categorySlug } : {}),
      ...(isFeatured !== undefined ? { isFeatured } : {}),
      ...(ids.length > 0 ? { ids } : {}),
      ...(filters ? { filters } : {}),
      ...(ranges ? { ranges } : {}),
      ...(brand ? { brand } : {}),
      ...(attr ? { attr } : {}),
      ...(priceMin !== undefined ? { priceMin } : {}),
      ...(priceMax !== undefined ? { priceMax } : {}),
      ...(warehouse ? { warehouse } : {}),
      ...(inStock !== undefined ? { inStock } : {}),
    };
  }

  private readSingleQueryString(request: Request, key: string): string | undefined {
    const value = request.query[key];
    if (Array.isArray(value)) {
      const first = value[0];
      return typeof first === 'string' ? first.trim() : undefined;
    }

    return typeof value === 'string' ? value.trim() : undefined;
  }

  private parseQueryNumber(
    value: string | undefined,
    fallback: number,
    min: number,
    max: number,
    key: string,
  ): number {
    if (!value) {
      return fallback;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
      throw new BadRequestException(`${key} must be an integer between ${min} and ${max}`);
    }

    return parsed;
  }

  private extractFilterValueParams(request: Request): Record<string, string[]> | undefined {
    const filters: Record<string, string[]> = {};
    for (const [key, rawValue] of Object.entries(request.query)) {
      const match = /^filters\[([a-z0-9]+(?:-[a-z0-9]+)*)\]$/i.exec(key);
      if (!match) {
        continue;
      }

      const values = this.normalizeRawQueryValue(rawValue);
      if (values.length === 0) {
        continue;
      }

      filters[match[1]!.toLowerCase()] = [...new Set(values)];
    }

    return Object.keys(filters).length > 0 ? filters : undefined;
  }

  private extractRangeFilterParams(
    request: Request,
  ): Record<string, { min?: number; max?: number }> | undefined {
    const ranges: Record<string, { min?: number; max?: number }> = {};
    for (const [key, rawValue] of Object.entries(request.query)) {
      const match = /^ranges\[([a-z0-9]+(?:-[a-z0-9]+)*)\]\[(min|max)\]$/i.exec(key);
      if (!match) {
        continue;
      }

      const value = this.readRangeBoundary(rawValue, match[2] as 'min' | 'max');
      if (value === undefined) {
        continue;
      }

      const slug = match[1]!.toLowerCase();
      const current = ranges[slug] ?? {};
      current[match[2]!.toLowerCase() as 'min' | 'max'] = value;
      ranges[slug] = current;
    }

    for (const [slug, range] of Object.entries(ranges)) {
      if (range.min !== undefined && range.max !== undefined && range.min > range.max) {
        throw new BadRequestException(`Invalid range for ${slug}: min must be <= max`);
      }
    }

    return Object.keys(ranges).length > 0 ? ranges : undefined;
  }

  private normalizeRawQueryValue(value: unknown): string[] {
    if (value === undefined || value === null) {
      return [];
    }

    const values = Array.isArray(value) ? value : [value];

    return values
      .filter((entry) => entry !== undefined && entry !== null)
      .map((entry) => String(entry).trim().toLowerCase())
      .filter((entry) => entry.length > 0 && entry !== 'undefined' && entry !== 'null');
  }

  private resolveFilterValueFilters(filters: Record<string, string[]> | undefined) {
    if (!filters) {
      return undefined;
    }

    const resolved = Object.entries(filters)
      .map(([filterSlug, valueSlugs]) => ({
        filterSlug: filterSlug.trim().toLowerCase(),
        valueSlugs: valueSlugs.map((value) => value.trim().toLowerCase()).filter(Boolean),
      }))
      .filter((filter) => filter.filterSlug.length > 0 && filter.valueSlugs.length > 0)
      .map((filter) => ({ ...filter, valueSlugs: [...new Set(filter.valueSlugs)] }));

    for (const filter of resolved) {
      if (!this.isSlug(filter.filterSlug)) {
        throw new BadRequestException('Invalid filter slug');
      }
      for (const valueSlug of filter.valueSlugs) {
        if (!this.isSlug(valueSlug)) {
          throw new BadRequestException('Invalid filter value slug');
        }
      }
    }

    return resolved.length > 0 ? resolved : undefined;
  }

  private resolveFilterRangeFilters(
    ranges: Record<string, { min?: number; max?: number }> | undefined,
  ) {
    if (!ranges) {
      return undefined;
    }

    const resolved = Object.entries(ranges)
      .map(([filterSlug, range]) => ({
        filterSlug: filterSlug.trim().toLowerCase(),
        ...(range.min !== undefined ? { min: range.min } : {}),
        ...(range.max !== undefined ? { max: range.max } : {}),
      }))
      .filter(
        (item) => item.filterSlug.length > 0 && (item.min !== undefined || item.max !== undefined),
      );

    for (const range of resolved) {
      if (!this.isSlug(range.filterSlug)) {
        throw new BadRequestException('Invalid range filter slug');
      }
      if (range.min !== undefined && range.min < 0) {
        throw new BadRequestException('Range min must be >= 0');
      }
      if (range.max !== undefined && range.max < 0) {
        throw new BadRequestException('Range max must be >= 0');
      }
      if (range.min !== undefined && range.max !== undefined && range.min > range.max) {
        throw new BadRequestException('Range min must be <= max');
      }
    }

    return resolved.length > 0 ? resolved : undefined;
  }

  private extractBrandParam(request: Request): string[] | undefined {
    const raw = request.query['brand'];
    const values = this.normalizeRawQueryValue(raw);
    return values.length > 0 ? values : undefined;
  }

  private extractAttrParams(request: Request): Record<string, string[]> | undefined {
    const attrs: Record<string, string[]> = {};
    for (const [key, rawValue] of Object.entries(request.query)) {
      const match = /^attr\[([a-z0-9]+(?:-[a-z0-9]+)*)\]$/i.exec(key);
      if (!match) continue;
      const values = this.normalizeRawQueryValue(rawValue);
      if (values.length === 0) continue;
      attrs[match[1]!.toLowerCase()] = [...new Set(values)];
    }
    return Object.keys(attrs).length > 0 ? attrs : undefined;
  }

  private extractWarehouseParam(request: Request): string[] | undefined {
    const raw = request.query['warehouse'];
    const values = this.normalizeRawQueryValue(raw);
    return values.length > 0 ? values : undefined;
  }

  private parseOptionalNumber(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private async resolveSmartFilterParams(
    storeId: string,
    query: ParsedProductsQuery,
  ): Promise<{
    filterValueFilters:
      | import('../products/products.repository').ProductListFilterValueFilter[]
      | undefined;
    filterRangeFilters:
      | import('../products/products.repository').ProductListFilterRangeFilter[]
      | undefined;
    attributeFilters:
      | import('../products/products.repository').ProductListAttributeFilter[]
      | undefined;
    brandFilter: string[] | undefined;
    warehouseFilter: string[] | undefined;
    inStockOnly: boolean;
    priceMin: number | undefined;
    priceMax: number | undefined;
  }> {
    const allFilters = await this.filtersService.listStorefrontFilters(storeId, false);
    const filterSlugMap = new Map(allFilters.map((f) => [f.slug, f]));

    const manualFilterSlugs = new Set<string>();
    const attrFilters: { attributeSlug: string; valueSlugs: string[] }[] = [];
    let brandFilter: string[] | undefined;
    let warehouseFilter: string[] | undefined;
    let inStockOnly = false;
    let priceMin: number | undefined;
    let priceMax: number | undefined;

    if (query.brand) {
      brandFilter = query.brand;
    }

    if (query.attr) {
      for (const [attrSlug, valueSlugs] of Object.entries(query.attr)) {
        attrFilters.push({ attributeSlug: attrSlug, valueSlugs });
      }
    }

    if (query.priceMin !== undefined) {
      priceMin = query.priceMin;
    }
    if (query.priceMax !== undefined) {
      priceMax = query.priceMax;
    }

    if (query.warehouse) {
      warehouseFilter = query.warehouse;
    }

    if (query.inStock) {
      inStockOnly = true;
    }

    if (query.filters) {
      for (const [filterSlug, valueSlugs] of Object.entries(query.filters)) {
        const smartFilter = filterSlugMap.get(filterSlug);
        if (smartFilter && smartFilter.sourceType !== 'manual') {
          switch (smartFilter.sourceType) {
            case 'brand':
              brandFilter = (brandFilter ?? []).concat(valueSlugs);
              break;
            case 'attribute':
              if (smartFilter.sourceAttributeId) {
                attrFilters.push({ attributeSlug: filterSlug, valueSlugs });
              }
              break;
            case 'warehouse':
              warehouseFilter = (warehouseFilter ?? []).concat(valueSlugs);
              break;
            case 'availability':
              if (valueSlugs.includes('in-stock')) {
                inStockOnly = true;
              }
              break;
            default:
              break;
          }
        } else {
          manualFilterSlugs.add(filterSlug);
        }
      }
    }

    if (query.ranges) {
      for (const [rangeSlug, range] of Object.entries(query.ranges)) {
        const smartFilter = filterSlugMap.get(rangeSlug);
        if (smartFilter && smartFilter.sourceType === 'price') {
          if (range.min !== undefined) priceMin = range.min;
          if (range.max !== undefined) priceMax = range.max;
        }
      }
    }

    const filterValueFilters = this.resolveFilterValueFilters(
      query.filters
        ? Object.fromEntries(
            Object.entries(query.filters).filter(([slug]) => manualFilterSlugs.has(slug)),
          )
        : undefined,
    );
    const filterRangeFilters = this.resolveFilterRangeFilters(
      query.ranges
        ? Object.fromEntries(
            Object.entries(query.ranges).filter(([slug]) => {
              const sf = filterSlugMap.get(slug);
              return !sf || sf.sourceType === 'manual';
            }),
          )
        : undefined,
    );

    const attributeFilters =
      attrFilters.length > 0
        ? attrFilters.map((f) => ({ attributeSlug: f.attributeSlug, valueSlugs: f.valueSlugs }))
        : undefined;

    if (brandFilter) {
      brandFilter = [...new Set(brandFilter)];
    }
    if (warehouseFilter) {
      warehouseFilter = [...new Set(warehouseFilter)];
    }

    return {
      filterValueFilters,
      filterRangeFilters,
      attributeFilters,
      brandFilter,
      warehouseFilter,
      inStockOnly,
      priceMin,
      priceMax,
    };
  }

  private readRangeBoundary(value: unknown, boundary: 'min' | 'max'): number | undefined {
    const raw = Array.isArray(value) ? value[0] : value;
    if (raw === null || raw === undefined || String(raw).trim().length === 0) {
      return undefined;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      throw new BadRequestException(`Range ${boundary} must be a valid number`);
    }
    return parsed;
  }

  private async getProductListingMeta(
    storeId: string,
    productId: string,
    currency: ResolvedCurrency,
  ): Promise<{
    primaryImageUrl: string | null;
    priceFrom: number | null;
    priceFromYER: number | null;
  }> {
    const [variants, images] = await Promise.all([
      this.productsRepository.listVariants(storeId, productId),
      this.productsRepository.listProductImages(storeId, productId),
    ]);
    const overrideMap = await this.currencyService.listVariantOverrides(
      storeId,
      variants.map((variant) => variant.id),
    );

    return this.computeProductListingMeta(variants, images, currency, overrideMap);
  }

  private computeProductListingMeta(
    variants: ProductVariantRecord[],
    images: ProductImageRecord[],
    currency: ResolvedCurrency,
    overrideMap: Map<string, VariantCurrencyOverride[]>,
  ): { primaryImageUrl: string | null; priceFrom: number | null; priceFromYER: number | null } {
    const sortedPricesYER = variants.map((variant) => Number(variant.price)).sort((a, b) => a - b);
    const sortedPrices = variants
      .map((variant) =>
        this.currencyService.priceFromYer(
          Number(variant.price),
          currency,
          overrideMap.get(variant.id) ?? [],
        ),
      )
      .sort((a, b) => a - b);
    return {
      primaryImageUrl: images[0]?.public_url ?? null,
      priceFrom: sortedPrices[0] ?? null,
      priceFromYER: sortedPricesYER[0] ?? null,
    };
  }

  private readCurrencyCode(request: Request): string | undefined {
    const value = request.query.currencyCode ?? request.query.currency;
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim().toUpperCase();
    }
    return undefined;
  }

  private async requireOpenCart(storeId: string, cartId: string) {
    const cart = await this.ordersRepository.findOpenCartById(storeId, cartId);
    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    return cart;
  }

  private async assertTrackOrderPhone(orderId: string, phone: string | undefined): Promise<void> {
    const normalizedPhone = phone?.trim();
    if (!normalizedPhone) {
      return;
    }

    const customerPhone = await this.ordersRepository.findCustomerPhoneByOrderId(orderId);
    if (!customerPhone || customerPhone.trim() !== normalizedPhone) {
      throw new NotFoundException('Order not found');
    }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private isSlug(value: string): boolean {
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
  }

  private isUuidV4(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  private async requireVariant(storeId: string, variantId: string) {
    const variant = await this.ordersRepository.findVariantForStore(storeId, variantId);
    if (!variant || variant.product_status !== 'active' || !variant.product_is_visible) {
      throw new NotFoundException('Variant not found or inactive');
    }
    return variant;
  }

  private async resolveCart(storeId: string, currency: ResolvedCurrency, cartId?: string) {
    if (!cartId) {
      return this.ordersRepository.createCart(storeId, currency.currencyCode, currency.yerPerUnit);
    }

    const cart = await this.ordersRepository.findOpenCartById(storeId, cartId);
    if (!cart) {
      throw new BadRequestException('Invalid cart id');
    }
    if (
      cart.currency_code !== currency.currencyCode ||
      Number(cart.exchange_rate_yer_per_unit) !== currency.yerPerUnit
    ) {
      return (
        (await this.ordersRepository.updateCartCurrency({
          storeId,
          cartId,
          currencyCode: currency.currencyCode,
          exchangeRateYerPerUnit: currency.yerPerUnit,
        })) ?? cart
      );
    }
    return cart;
  }

  private ensureStockAvailable(stockQuantity: number, requestedQuantity: number): void {
    if (stockQuantity < requestedQuantity) {
      throw new UnprocessableEntityException('Requested quantity exceeds available stock');
    }
  }

  private async mapCart(
    cartId: string,
    currency: ResolvedCurrency,
    items: CartItemSnapshot[],
  ): Promise<StorefrontCartResponse> {
    const variantOverrides = await this.currencyService.listVariantOverrides(
      this.readStoreIdFromCartItems(items),
      items.map((item) => item.variant_id),
    );
    const mappedItems = items.map((item) =>
      this.mapCartItem(item, currency, variantOverrides.get(item.variant_id) ?? []),
    );
    const subtotal = mappedItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const subtotalYER = mappedItems.reduce((sum, item) => sum + item.lineTotalYER, 0);
    const totalItems = mappedItems.reduce((sum, item) => sum + item.quantity, 0);
    return {
      cartId,
      currencyCode: currency.currencyCode,
      exchangeRateYerPerUnit: currency.yerPerUnit,
      subtotal,
      subtotalYER,
      totalItems,
      items: mappedItems,
    };
  }

  private mapCartItem(
    item: CartItemSnapshot,
    currency: ResolvedCurrency,
    overrides: VariantCurrencyOverride[],
  ) {
    const unitPriceYER = Number(item.current_price_yer ?? item.unit_price_yer ?? item.unit_price);
    const unitPrice = this.currencyService.priceFromYer(unitPriceYER, currency, overrides);
    return {
      productId: item.product_id,
      variantId: item.variant_id,
      title: item.product_title,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice,
      unitPriceYER,
      lineTotal: unitPrice * item.quantity,
      lineTotalYER: unitPriceYER * item.quantity,
    };
  }

  private readStoreIdFromCartItems(items: CartItemSnapshot[]): string {
    return items[0]?.store_id ?? '';
  }

  private async validateCartStock(storeId: string, items: CartItemSnapshot[]): Promise<void> {
    for (const item of items) {
      if (item.product_type === 'bundled') {
        await this.ensureBundleComponentsStock(storeId, item.product_id, item.quantity);
        continue;
      }

      if (!item.stock_unlimited) {
        const availableStock = await this.inventoryService.getAvailableStock(
          storeId,
          item.variant_id,
        );
        if (availableStock === null || item.quantity > availableStock) {
          throw new UnprocessableEntityException(`Variant ${item.sku} is out of stock`);
        }
      }
    }
  }

  private async ensureBundleComponentsStock(
    storeId: string,
    bundleProductId: string,
    bundleQuantity: number,
  ): Promise<void> {
    const reservationRows = await this.resolveBundleReservationRows(
      storeId,
      bundleProductId,
      bundleQuantity,
    );

    for (const row of reservationRows) {
      const availableStock = await this.inventoryService.getAvailableStock(storeId, row.variantId);
      if (availableStock === null || row.quantity > availableStock) {
        throw new UnprocessableEntityException(`Bundle component SKU ${row.sku} is out of stock`);
      }
    }
  }

  private async resolveBundleReservationRows(
    storeId: string,
    bundleProductId: string,
    bundleQuantity: number,
  ): Promise<Array<{ variantId: string; quantity: number; sku: string }>> {
    const bundleItems = await this.productsRepository.listBundleItems(storeId, bundleProductId);
    if (bundleItems.length === 0) {
      throw new UnprocessableEntityException('Bundled product has no configured bundled items');
    }

    const rows: Array<{ variantId: string; quantity: number; sku: string }> = [];
    for (const item of bundleItems) {
      const bundledProduct = await this.productsRepository.findById(
        storeId,
        item.bundled_product_id,
      );
      if (!bundledProduct) {
        throw new UnprocessableEntityException('One bundled product is unavailable');
      }

      if (bundledProduct.stock_unlimited) {
        continue;
      }

      const variant = item.bundled_variant_id
        ? await this.productsRepository.findVariantById(storeId, item.bundled_variant_id)
        : await this.productsRepository.findDefaultVariantByProductId(
            storeId,
            item.bundled_product_id,
          );

      if (!variant) {
        throw new UnprocessableEntityException('One bundle component has no purchasable variant');
      }

      rows.push({
        variantId: variant.id,
        quantity: bundleQuantity * item.quantity,
        sku: variant.sku,
      });
    }

    return rows;
  }

  private calculateTotals(items: CartItemSnapshot[]) {
    const subtotal = items.reduce((sum, item) => sum + Number(item.unit_price) * item.quantity, 0);
    return { subtotal };
  }

  private async prepareCheckoutData(
    storeId: string,
    input: Pick<
      CheckoutDto,
      | 'cartId'
      | 'shippingZoneId'
      | 'shippingMethodId'
      | 'fulfillmentZoneId'
      | 'fulfillmentMethodId'
      | 'couponCode'
      | 'customerAccessToken'
      | 'pointsToRedeem'
      | 'currencyCode'
    >,
    request: Request,
    options: { requirePaymentMethod?: boolean } = {},
  ): Promise<CheckoutData> {
    const requirePaymentMethod = options.requirePaymentMethod ?? true;
    const cart = await this.ordersRepository.findOpenCartById(storeId, input.cartId);
    if (!cart) {
      throw new BadRequestException('«·”·… €Ì— „ÊÃÊœ… √Ê  „  ÕÊÌ·Â« ≈·Ï ÿ·» ”«»ﬁ«.');
    }
    const currency = await this.currencyService.resolveStoreCurrency(
      storeId,
      input.currencyCode ?? cart.currency_code,
    );
    await this.ordersRepository.updateCartCurrency({
      storeId,
      cartId: cart.id,
      currencyCode: currency.currencyCode,
      exchangeRateYerPerUnit: currency.yerPerUnit,
    });
    cart.currency_code = currency.currencyCode;
    cart.exchange_rate_yer_per_unit = String(currency.yerPerUnit);

    const items = await this.ordersRepository.listCartItems(storeId, cart.id);
    if (items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    await this.inventoryService.releaseExpiredReservations(storeId);
    await this.validateCartStock(storeId, items);
    const inventoryReservationItems = await this.mapCheckoutItemsToInventoryInput(storeId, items);
    const mappedCart = await this.mapCart(cart.id, currency, items);
    const subtotal = mappedCart.subtotal;
    const subtotalYER = mappedCart.subtotalYER;
    const itemsYER = items.map((item) => ({
      ...item,
      unit_price: String(item.current_price_yer ?? item.unit_price_yer ?? item.unit_price),
    }));
    const fulfillment = await this.resolveCheckoutFulfillment(
      storeId,
      input.fulfillmentZoneId ?? input.shippingZoneId,
      input.fulfillmentMethodId ?? input.shippingMethodId,
    );
    if (fulfillment.availableMethods.length === 0) {
      throw new BadRequestException(
        '·«  ÊÃœ ÿ—ﬁ  Ê’Ì· √Ê «” ·«„ „ «Õ… Õ«·Ì« ·Â–« «·„ Ã—. Ì—ÃÏ «· Ê«’· „⁄ «·„ Ã—.',
      );
    }
    const shippingZone = fulfillment.zone;
    const customerIdForLoyalty = await this.resolveCustomerIdFromAccessToken(
      storeId,
      input.customerAccessToken,
    );
    const requestedPointsToRedeem = Math.max(0, Math.trunc(input.pointsToRedeem ?? 0));

    if (requestedPointsToRedeem > 0 && !customerIdForLoyalty) {
      throw new BadRequestException('Customer login is required to redeem loyalty points');
    }
    if (requestedPointsToRedeem > 0 && input.couponCode?.trim()) {
      throw new BadRequestException('Cannot combine loyalty points with coupon codes');
    }

    let promotionYER: PromotionComputationResult;
    if (requestedPointsToRedeem > 0) {
      promotionYER = {
        couponId: null,
        couponCode: null,
        couponIsFreeShipping: false,
        couponDiscount: 0,
        offerId: null,
        offerDiscount: 0,
        totalDiscount: 0,
      };
    } else {
      promotionYER = await this.promotionsService.computeCheckoutDiscount(
        storeId,
        this.buildPromotionInput(subtotalYER, itemsYER, input.couponCode),
      );
    }

    if (requestedPointsToRedeem > 0 && promotionYER.totalDiscount > 0) {
      throw new BadRequestException('Cannot combine loyalty points with offers or coupons');
    }

    const shippingResolutionYER = this.shippingCalculatorService.resolveMethod({
      zone: shippingZone,
      methods: fulfillment.methods,
      items: items.map((item) => ({
        quantity: item.quantity,
        productWeight: item.product_weight !== null ? Number(item.product_weight) : null,
      })),
      subtotal: subtotalYER,
      couponCode: promotionYER.couponCode,
      couponIsFreeShipping: promotionYER.couponIsFreeShipping,
      requestedMethodId: fulfillment.requestedMethodId,
      autoSelectStrategy: fulfillment.shouldAutoSelect ? 'free_then_first' : 'none',
    });
    if (
      (input.fulfillmentMethodId ?? input.shippingMethodId) &&
      !shippingResolutionYER.selectedMethod
    ) {
      throw new BadRequestException('ÿ—Ìﬁ… «· Ê’Ì· «·„Õœœ… ·„  ⁄œ „ «Õ…. Ì—ÃÏ «Œ Ì«— ÿ—Ìﬁ… √Œ—Ï.');
    }

    const shippingResolution = this.convertShippingResolution(shippingResolutionYER, currency);
    const shippingFeeYER = shippingResolutionYER.selectedMethod?.cost ?? 0;
    const promotion = this.convertPromotionResult(promotionYER, currency);
    const baseTotalYER = this.calculateTotal(
      subtotalYER,
      shippingFeeYER,
      promotionYER.totalDiscount,
    );
    let pointsRedeemed = 0;
    let pointsDiscountAmountYER = 0;
    if (requestedPointsToRedeem > 0 && customerIdForLoyalty) {
      const settings = await this.loyaltyService.getSettingsByStoreId(storeId);
      if (!settings.isEnabled) {
        throw new BadRequestException('Loyalty program is disabled');
      }
      const wallet = await this.loyaltyService.getWalletForCurrentCustomer(
        customerIdForLoyalty,
        storeId,
      );
      const estimate = this.loyaltyService.computeRedeemEstimate({
        program: {
          id: '',
          store_id: storeId,
          is_enabled: settings.isEnabled,
          redeem_rate_points: settings.redeemRatePoints,
          redeem_rate_amount: String(settings.redeemRateAmount),
          min_redeem_points: settings.minRedeemPoints,
          redeem_step_points: settings.redeemStepPoints,
          max_discount_percent: String(settings.maxDiscountPercent),
        },
        availablePoints: wallet.availablePoints,
        requestedPoints: requestedPointsToRedeem,
        totalBeforeDiscount: baseTotalYER,
      });
      pointsRedeemed = estimate.pointsRedeemed;
      pointsDiscountAmountYER = estimate.discountAmount;
    }
    const pointsDiscountAmount = this.currencyService.convertFromYer(
      pointsDiscountAmountYER,
      currency,
    );

    const loyaltyRuleList = await this.loyaltyService.getRulesByStoreId(storeId);
    const potentialEarnPoints = this.computePotentialEarnPoints(subtotalYER, loyaltyRuleList);
    const affiliateAttribution = await this.affiliatesService.resolveCheckoutAttribution({
      storeId,
      sessionId: this.storefrontTrackingService.resolveSessionIdForRequest(request),
      couponCode: promotionYER.couponCode,
    });
    const totalYER = this.calculateTotal(
      subtotalYER + shippingFeeYER,
      0,
      promotionYER.totalDiscount + pointsDiscountAmountYER,
    );
    const total = this.currencyService.convertFromYer(totalYER, currency);
    let paymentSnapshot: PaymentMethodSnapshot | null = null;
    if (requirePaymentMethod) {
      const enabledPaymentMethods = await this.paymentMethodsService.listStorefront(storeId);
      if (enabledPaymentMethods.length === 0) {
        throw new BadRequestException('·«  ÊÃœ ÿ—ﬁ œ›⁄ „›⁄·… ·Â–« «·„ Ã— Õ«·Ì«.');
      }
      paymentSnapshot = await this.paymentMethodsService.resolveCheckoutMethod(
        storeId,
        (input as CheckoutDto).storePaymentMethodId,
        (input as CheckoutDto).paymentMethod,
      );
    }
    const payerReference = (input as CheckoutDto).payerReference?.trim() ?? '';
    if (paymentSnapshot?.requiresReference && !payerReference) {
      throw new BadRequestException('—ﬁ„ „—Ã⁄ «·⁄„·Ì… „ÿ·Ê» ·ÿ—Ìﬁ… «·œ›⁄ «·„Œ «—….');
    }
    let payerReceiptUrl: string | null = null;
    if ((input as CheckoutDto).payerReceiptMediaAssetId) {
      const receipt = await this.mediaRepository.findById(
        storeId,
        (input as CheckoutDto).payerReceiptMediaAssetId!,
      );
      if (!receipt || !receipt.mime_type.startsWith('image/')) {
        throw new BadRequestException('’Ê—… «·≈Ì’«· €Ì— ’ÕÌÕ… √Ê €Ì— „ÊÃÊœ….');
      }
      payerReceiptUrl = receipt.public_url;
    }

    return {
      cart,
      items,
      inventoryReservationItems,
      subtotal,
      subtotalYER,
      shippingZone,
      shippingMethod: shippingResolution.selectedMethod,
      shippingMethodYER: shippingResolutionYER.selectedMethod,
      availableShippingMethods: shippingResolution.availableMethods,
      availableShippingMethodsYER: shippingResolutionYER.availableMethods,
      promotion,
      promotionYER,
      pointsToRedeem: requestedPointsToRedeem,
      pointsDiscountAmount,
      pointsDiscountAmountYER,
      pointsRedeemed,
      customerIdForLoyalty,
      potentialEarnPoints,
      affiliateAttribution,
      total,
      totalYER,
      currency,
      paymentSnapshot,
      payerReceiptUrl,
    };
  }

  private async executeCheckoutTransaction(
    storeId: string,
    input: CheckoutDto,
    checkoutData: CheckoutData,
    orderId: string,
    orderCode: string,
  ): Promise<OrderRecord> {
    return this.ordersRepository.withTransaction(async (db) =>
      this.persistCheckoutTransaction(db, storeId, input, checkoutData, orderId, orderCode),
    );
  }

  private async persistCheckoutTransaction(
    db: QueryRunner,
    storeId: string,
    input: CheckoutDto,
    checkoutData: CheckoutData,
    orderId: string,
    orderCode: string,
  ): Promise<OrderRecord> {
    const customerId = await this.findOrCreateCheckoutCustomer(db, storeId, input);
    if (checkoutData.pointsToRedeem > 0 && checkoutData.customerIdForLoyalty !== customerId) {
      throw new BadRequestException('Loyalty redemption requires authenticated customer');
    }
    if (!checkoutData.shippingMethod || !checkoutData.shippingZone) {
      throw new BadRequestException('Ì—ÃÏ «Œ Ì«— ÿ—Ìﬁ… «” ·«„ «·ÿ·» ﬁ»· ≈ﬂ„«· «·ÿ·».');
    }
    const requiresAddress = checkoutData.shippingMethod?.type !== 'store_pickup';
    await this.saveCheckoutAddress(db, storeId, customerId, input, requiresAddress);

    const order = await this.ordersRepository.createOrder(db, {
      id: orderId,
      storeId,
      customerId,
      orderCode,
      subtotal: checkoutData.subtotal,
      total: checkoutData.total,
      shippingZoneId: checkoutData.shippingZone?.id ?? null,
      shippingMethodId:
        checkoutData.shippingMethod?.id && !checkoutData.shippingMethod.id.startsWith('legacy-')
          ? checkoutData.shippingMethod.id
          : null,
      fulfillmentType: checkoutData.shippingMethod?.type === 'store_pickup' ? 'pickup' : 'delivery',
      shippingMethodSnapshot: checkoutData.shippingMethod
        ? {
            id: checkoutData.shippingMethod.id,
            type: checkoutData.shippingMethod.type,
            displayName: checkoutData.shippingMethod.displayName,
            description: checkoutData.shippingMethod.description,
            cost: checkoutData.shippingMethod.cost,
            minDeliveryDays: checkoutData.shippingMethod.minDeliveryDays,
            maxDeliveryDays: checkoutData.shippingMethod.maxDeliveryDays,
            zoneName: checkoutData.shippingZone.name,
            zoneCity: checkoutData.shippingZone.city,
            zoneArea: checkoutData.shippingZone.area,
          }
        : null,
      shippingFee: checkoutData.shippingMethod?.cost ?? 0,
      discountTotal: checkoutData.promotion.totalDiscount + checkoutData.pointsDiscountAmount,
      couponCode: checkoutData.promotion.couponCode,
      currencyCode: checkoutData.cart.currency_code,
      exchangeRateYerPerUnit: checkoutData.currency.yerPerUnit,
      subtotalYER: checkoutData.subtotalYER,
      totalYER: checkoutData.totalYER,
      shippingFeeYER: checkoutData.shippingMethodYER?.cost ?? 0,
      discountTotalYER:
        checkoutData.promotionYER.totalDiscount + checkoutData.pointsDiscountAmountYER,
      pointsDiscountAmountYER: checkoutData.pointsDiscountAmountYER,
      note: input.note?.trim() ?? null,
      shippingAddress: this.buildShippingAddress(input, requiresAddress),
    });

    await this.completeCheckoutArtifacts(db, storeId, orderId, customerId, input, checkoutData);
    return order;
  }

  private async findOrCreateCheckoutCustomer(
    db: QueryRunner,
    storeId: string,
    input: CheckoutDto,
  ): Promise<string> {
    // If customer is logged in, use their customer_id from the session
    if (input.customerAccessToken) {
      try {
        const payload = await this.customersService.verifyAccessToken(input.customerAccessToken);
        if (payload.storeId === storeId) {
          return payload.sub; // Return customer_id from token
        }
      } catch {
        // Token invalid or expired, fall through to guest checkout
      }
    }

    // Guest checkout: find or create by phone
    return this.ordersRepository.findOrCreateCustomer(db, {
      storeId,
      fullName: input.customerName.trim(),
      phone: input.customerPhone.trim(),
      email: input.customerEmail?.trim() ?? null,
    });
  }

  private async saveCheckoutAddress(
    db: QueryRunner,
    storeId: string,
    customerId: string,
    input: CheckoutDto,
    requireAddressLine = true,
  ): Promise<void> {
    const addressLine = input.addressLine?.trim();
    if (!requireAddressLine && (!addressLine || addressLine.length === 0)) {
      return;
    }

    if (input.customerAddressId) {
      const selectedAddress = await this.ordersRepository.findCustomerAddressByIdInTransaction(
        db,
        storeId,
        customerId,
        input.customerAddressId,
      );
      if (!selectedAddress) {
        throw new BadRequestException('«·⁄‰Ê«‰ «·„Õœœ €Ì— „ÊÃÊœ ·Â–« «·⁄„Ì·.');
      }
      return;
    }

    await this.ordersRepository.insertCustomerAddress(db, {
      storeId,
      customerId,
      addressLine: addressLine ?? '',
      city: input.city?.trim() ?? null,
      area: input.area?.trim() ?? null,
      notes: input.note?.trim() ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      mapProvider: input.mapProvider?.trim() || null,
      placeLabel: input.placeLabel?.trim() || null,
    });
  }

  private readIdsQuery(request: Request, key: string): string[] {
    const rawValues = this.normalizeRawQueryValue(request.query[key]);
    const ids = rawValues
      .flatMap((value) => value.split(','))
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    for (const id of ids) {
      if (!this.isUuidV4(id)) {
        throw new BadRequestException(`${key} must contain valid UUID values`);
      }
    }

    return [...new Set(ids)].slice(0, 24);
  }

  private async completeCheckoutArtifacts(
    db: QueryRunner,
    storeId: string,
    orderId: string,
    customerId: string,
    input: CheckoutDto,
    checkoutData: CheckoutData,
  ): Promise<void> {
    await this.persistOrderItems(db, storeId, orderId, checkoutData.items, checkoutData.currency);
    if (checkoutData.inventoryReservationItems.length > 0) {
      await this.inventoryService.reserveOrderItems(db, {
        storeId,
        orderId,
        expiresAt: this.buildReservationExpiryDate(),
        items: checkoutData.inventoryReservationItems,
        metadata: {
          source: 'storefront.checkout',
        },
      });
    }
    await this.createPayment(db, storeId, orderId, input, checkoutData);
    if (checkoutData.promotion.couponId) {
      await this.promotionsService.increaseCouponUsageInTransaction(
        db,
        storeId,
        checkoutData.promotion.couponId,
      );
    }
    if (checkoutData.pointsToRedeem > 0) {
      await this.loyaltyService.applyRedemptionToOrderInTransaction(db, {
        storeId,
        customerId,
        orderId,
        pointsToRedeem: checkoutData.pointsToRedeem,
        totalBeforeDiscount: checkoutData.subtotalYER + (checkoutData.shippingMethodYER?.cost ?? 0),
        createdByStoreUserId: null,
      });
    }
    await this.affiliatesService.createPendingCommissionInTransaction(db, {
      storeId,
      orderId,
      attribution: checkoutData.affiliateAttribution,
      subtotal: checkoutData.subtotalYER,
      discountTotal: checkoutData.promotionYER.totalDiscount + checkoutData.pointsDiscountAmountYER,
    });
    await this.ordersRepository.insertOrderStatusHistory(db, {
      storeId,
      orderId,
      oldStatus: null,
      newStatus: 'new',
      changedBy: null,
      note: 'Order created via storefront checkout',
    });
    await this.ordersRepository.markCartCheckedOut(db, checkoutData.cart.id);
  }

  private async publishOrderCreated(order: OrderRecord, storeId: string): Promise<void> {
    await this.outboxService.enqueue({
      aggregateType: 'order',
      aggregateId: order.id,
      eventType: 'order.created',
      payload: {
        orderId: order.id,
        orderCode: order.order_code,
        storeId,
        customerId: order.customer_id,
        total: Number(order.total),
        currencyCode: order.currency_code,
        paymentStatus: 'pending',
        orderStatus: order.status,
        source: 'storefront_checkout',
      },
    });
  }

  private async publishCartSignals(input: {
    storeId: string;
    cartId: string;
    customerId: string | null;
    sessionId: string | null;
    variant: {
      product_id: string;
      variant_id: string;
      sku: string;
      price: string;
    };
    quantity: number;
    cart: StorefrontCartResponse;
  }): Promise<void> {
    const payload = {
      storeId: input.storeId,
      cartId: input.cartId,
      customerId: input.customerId,
      sessionId: input.sessionId,
      productId: input.variant.product_id,
      productTitle: input.cart.items.find((item) => item.variantId === input.variant.variant_id)
        ?.title,
      variantId: input.variant.variant_id,
      sku: input.variant.sku,
      quantity: input.quantity,
      unitPrice: Number(input.variant.price),
      unitPriceYER: Number(input.variant.price),
      cartTotal: input.cart.subtotal,
      cartTotalYER: input.cart.subtotalYER,
      currencyCode: input.cart.currencyCode,
      itemsCount: input.cart.totalItems,
      source: 'storefront_cart',
    };

    await this.outboxService.enqueue({
      aggregateType: 'cart',
      aggregateId: input.cartId,
      eventType: 'cart.item_added',
      payload,
    });

    if (input.cart.currencyCode === 'YER' && input.cart.subtotal >= 50_000) {
      await this.outboxService.enqueue({
        aggregateType: 'cart',
        aggregateId: input.cartId,
        eventType: 'cart.high_value_detected',
        payload,
      });
    }

    if (input.cart.totalItems >= 3) {
      await this.outboxService.enqueue({
        aggregateType: 'cart',
        aggregateId: input.cartId,
        eventType: 'cart.strong_intent_detected',
        payload,
      });
    }
  }

  private mapCheckoutResponse(order: OrderRecord): CheckoutResponse {
    return {
      orderId: order.id,
      orderCode: order.order_code,
      status: order.status,
      total: Number(order.total),
      currencyCode: order.currency_code,
      exchangeRateYerPerUnit: Number(order.exchange_rate_yer_per_unit),
      subtotalYER: Number(order.subtotal_yer),
      totalYER: Number(order.total_yer),
      shippingFee: Number(order.shipping_fee),
      shippingFeeYER: Number(order.shipping_fee_yer),
      discountTotal: Number(order.discount_total),
      discountTotalYER: Number(order.discount_total_yer),
      pointsRedeemed: order.points_redeemed,
      pointsDiscountAmount: Number(order.points_discount_amount),
      pointsDiscountAmountYER: Number(order.points_discount_amount_yer),
      pointsEarned: order.points_earned,
    };
  }

  private normalizeSocialLinks(value: unknown): Record<string, string | null> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => key.trim().length > 0)
        .map(([key, link]) => [
          key,
          typeof link === 'string' && link.trim().length > 0 ? link.trim() : null,
        ]),
    );
  }

  private formatStoreAddress(
    store: Awaited<ReturnType<StoresRepository['findById']>>,
  ): string | null {
    if (!store) {
      return null;
    }

    return (
      [store.address, store.address_details, store.city, store.country]
        .filter(Boolean)
        .join(', ') || null
    );
  }

  private containsArabic(value: string): boolean {
    return /[\u0600-\u06FF]/.test(value);
  }

  private async resolveShippingZone(
    storeId: string,
    shippingZoneId?: string,
  ): Promise<ShippingZoneRecord | null> {
    if (!shippingZoneId) {
      return null;
    }

    const zone = await this.shippingRepository.findActiveById(storeId, shippingZoneId);
    if (!zone) {
      throw new BadRequestException('Shipping zone not found or inactive');
    }

    return zone;
  }

  private async resolveCheckoutFulfillment(
    storeId: string,
    zoneId?: string,
    methodId?: string,
  ): Promise<{
    zone: ShippingZoneRecord;
    methods: Array<ShippingMethodRecord & { ranges: ShippingMethodRangeRecord[] }>;
    availableMethods: Array<ShippingMethodRecord & { ranges: ShippingMethodRangeRecord[] }>;
    requestedMethodId: string | null;
    shouldAutoSelect: boolean;
  }> {
    const activeMethods = await this.shippingRepository.listActiveMethodsAcrossZones(storeId);
    if (activeMethods.length === 0) {
      throw new BadRequestException(
        '·«  ÊÃœ ÿ—ﬁ  Ê’Ì· √Ê «” ·«„ „ «Õ… Õ«·Ì« ·Â–« «·„ Ã—. Ì—ÃÏ «· Ê«’· „⁄ «·„ Ã—.',
      );
    }

    if (methodId) {
      const selected = activeMethods.find((method) => method.id === methodId);
      if (!selected) {
        throw new BadRequestException(
          'ÿ—Ìﬁ… «· Ê’Ì· «·„Õœœ… ·„  ⁄œ „ «Õ…. Ì—ÃÏ «Œ Ì«— ÿ—Ìﬁ… √Œ—Ï.',
        );
      }
      if (zoneId && selected.shipping_zone_id !== zoneId) {
        throw new BadRequestException('ÿ—Ìﬁ… «· Ê’Ì· ·«   »⁄ „‰ÿﬁ… «· Ê’Ì· «·„Õœœ….');
      }
      const zone = await this.resolveShippingZone(storeId, selected.shipping_zone_id);
      if (!zone) {
        throw new BadRequestException('«· Ê’Ì· €Ì— „ «Õ ·Â–Â «·„‰ÿﬁ… Õ«·Ì«.');
      }
      return {
        zone,
        methods: activeMethods.filter((method) => method.shipping_zone_id === zone.id),
        availableMethods: activeMethods,
        requestedMethodId: methodId,
        shouldAutoSelect: true,
      };
    }

    if (zoneId) {
      const zone = await this.resolveShippingZone(storeId, zoneId);
      if (!zone) {
        throw new BadRequestException('«· Ê’Ì· €Ì— „ «Õ ·Â–Â «·„‰ÿﬁ… Õ«·Ì«.');
      }
      const methods = activeMethods.filter((method) => method.shipping_zone_id === zone.id);
      return {
        zone,
        methods,
        availableMethods: activeMethods,
        requestedMethodId: null,
        shouldAutoSelect: methods.length === 1,
      };
    }

    if (activeMethods.length === 1) {
      const onlyMethod = activeMethods[0]!;
      const zone = await this.resolveShippingZone(storeId, onlyMethod.shipping_zone_id);
      if (!zone) {
        throw new BadRequestException('«· Ê’Ì· €Ì— „ «Õ ·Â–Â «·„‰ÿﬁ… Õ«·Ì«.');
      }
      return {
        zone,
        methods: [onlyMethod],
        availableMethods: activeMethods,
        requestedMethodId: onlyMethod.id,
        shouldAutoSelect: true,
      };
    }

    const firstMethod = activeMethods[0]!;
    const firstZone = await this.resolveShippingZone(storeId, firstMethod.shipping_zone_id);
    if (!firstZone) {
      throw new BadRequestException('«· Ê’Ì· €Ì— „ «Õ ·Â–Â «·„‰ÿﬁ… Õ«·Ì«.');
    }
    return {
      zone: firstZone,
      methods: activeMethods.filter((method) => method.shipping_zone_id === firstZone.id),
      availableMethods: activeMethods,
      requestedMethodId: null,
      shouldAutoSelect: false,
    };
  }

  private calculateTotal(subtotal: number, shippingFee: number, totalDiscount: number): number {
    const total = Number((subtotal + shippingFee - totalDiscount).toFixed(2));
    if (total < 0) {
      throw new BadRequestException('Computed total cannot be negative');
    }
    return total;
  }

  private convertShippingResolution(
    resolution: {
      availableMethods: ShippingMethodQuote[];
      selectedMethod: ShippingMethodQuote | null;
    },
    currency: ResolvedCurrency,
  ): { availableMethods: ShippingMethodQuote[]; selectedMethod: ShippingMethodQuote | null } {
    const availableMethods = resolution.availableMethods.map((method) => ({
      ...method,
      cost: this.currencyService.convertFromYer(method.cost, currency),
    }));
    const selectedMethod = resolution.selectedMethod
      ? (availableMethods.find((method) => method.id === resolution.selectedMethod?.id) ?? null)
      : null;
    return { availableMethods, selectedMethod };
  }

  private convertPromotionResult(
    promotion: PromotionComputationResult,
    currency: ResolvedCurrency,
  ): PromotionComputationResult {
    return {
      ...promotion,
      couponDiscount: this.currencyService.convertFromYer(promotion.couponDiscount, currency),
      offerDiscount: this.currencyService.convertFromYer(promotion.offerDiscount, currency),
      totalDiscount: this.currencyService.convertFromYer(promotion.totalDiscount, currency),
    };
  }

  private buildPromotionInput(
    subtotal: number,
    items: CartItemSnapshot[],
    couponCode?: string,
  ): PromotionComputationInput {
    const normalizedCouponCode = couponCode?.trim();

    return {
      subtotal,
      items,
      at: new Date(),
      ...(normalizedCouponCode ? { couponCode: normalizedCouponCode } : {}),
    };
  }

  private async resolveCustomerIdFromAccessToken(
    storeId: string,
    customerAccessToken?: string,
  ): Promise<string | null> {
    if (!customerAccessToken) {
      return null;
    }

    try {
      const payload = await this.customersService.verifyAccessToken(customerAccessToken);
      if (payload.storeId === storeId) {
        return payload.sub;
      }
      return null;
    } catch {
      return null;
    }
  }

  private computePotentialEarnPoints(
    subtotal: number,
    rules: Array<{ earnRate: number; minOrderAmount: number; isActive: boolean; priority: number }>,
  ): number {
    const matched =
      rules
        .filter((rule) => rule.isActive)
        .sort((a, b) => a.priority - b.priority)
        .find((rule) => subtotal >= rule.minOrderAmount) ?? null;

    if (!matched) {
      return 0;
    }
    return Math.max(0, Math.floor((subtotal * matched.earnRate) / 100));
  }

  private generateOrderCode(): string {
    const random = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `KS-${random}`;
  }

  private async mapCheckoutItemsToInventoryInput(
    storeId: string,
    items: CartItemSnapshot[],
  ): Promise<Array<{ variantId: string; quantity: number; sku: string }>> {
    const aggregated = new Map<string, { variantId: string; quantity: number; sku: string }>();

    for (const item of items) {
      if (item.product_type === 'bundled') {
        const bundleRows = await this.resolveBundleReservationRows(
          storeId,
          item.product_id,
          item.quantity,
        );

        for (const row of bundleRows) {
          const current = aggregated.get(row.variantId);
          if (current) {
            current.quantity += row.quantity;
          } else {
            aggregated.set(row.variantId, { ...row });
          }
        }
        continue;
      }

      if (item.stock_unlimited) {
        continue;
      }

      const current = aggregated.get(item.variant_id);
      if (current) {
        current.quantity += item.quantity;
      } else {
        aggregated.set(item.variant_id, {
          variantId: item.variant_id,
          quantity: item.quantity,
          sku: item.sku,
        });
      }
    }

    return [...aggregated.values()];
  }

  private buildReservationExpiryDate(referenceDate: Date = new Date()): Date {
    const ttlMinutes = this.getReservationTtlMinutes();
    return new Date(referenceDate.getTime() + ttlMinutes * 60_000);
  }

  private getReservationTtlMinutes(): number {
    const raw = Number(process.env.INVENTORY_RESERVATION_TTL_MINUTES ?? '15');
    if (!Number.isInteger(raw) || raw < 1 || raw > 120) {
      return 15;
    }
    return raw;
  }

  private buildShippingAddress(
    input: CheckoutDto,
    requireAddressLine = true,
  ): Record<string, unknown> {
    const addressLine = input.addressLine?.trim();
    if (requireAddressLine && !addressLine) {
      throw new BadRequestException('addressLine is required');
    }
    if (requireAddressLine && !input.city?.trim()) {
      throw new BadRequestException('city is required for delivery orders');
    }
    if (requireAddressLine && !input.area?.trim()) {
      throw new BadRequestException('area is required for delivery orders');
    }

    return {
      fullName: input.customerName.trim(),
      phone: input.customerPhone.trim(),
      addressLine: addressLine ?? null,
      city: input.city?.trim() ?? null,
      area: input.area?.trim() ?? null,
      note: input.note?.trim() ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      mapProvider: input.mapProvider?.trim() || null,
      placeLabel: input.placeLabel?.trim() || null,
    };
  }

  private async persistOrderItems(
    db: QueryRunner,
    storeId: string,
    orderId: string,
    items: CartItemSnapshot[],
    currency: ResolvedCurrency,
  ): Promise<void> {
    const overrideMap = await this.currencyService.listVariantOverrides(
      storeId,
      items.map((item) => item.variant_id),
    );
    for (const item of items) {
      const unitPriceYER = Number(item.current_price_yer ?? item.unit_price_yer ?? item.unit_price);
      const unitPrice = this.currencyService.priceFromYer(
        unitPriceYER,
        currency,
        overrideMap.get(item.variant_id) ?? [],
      );
      await this.ordersRepository.insertOrderItem(db, {
        orderId,
        storeId,
        productId: item.product_id,
        variantId: item.variant_id,
        title: item.product_title,
        sku: item.sku,
        unitPrice,
        unitPriceYER,
        quantity: item.quantity,
        lineTotal: unitPrice * item.quantity,
        lineTotalYER: unitPriceYER * item.quantity,
        attributes: item.attributes,
      });
    }
  }

  private async createPayment(
    db: QueryRunner,
    storeId: string,
    orderId: string,
    input: CheckoutDto,
    checkoutData: CheckoutData,
  ): Promise<void> {
    if (!checkoutData.paymentSnapshot) {
      throw new BadRequestException('Ì—ÃÏ «Œ Ì«— ÿ—Ìﬁ… œ›⁄ „ «Õ… ·Â–« «·„ Ã—.');
    }
    const snapshot = checkoutData.paymentSnapshot;
    const status = snapshot.type === 'cod' ? 'pending' : 'under_review';
    await this.paymentMethodsRepository.createPayment(db, {
      storeId,
      orderId,
      amount: checkoutData.total,
      status,
      snapshot,
      amountYER: checkoutData.totalYER,
      payerReference: input.payerReference?.trim() || null,
      payerReceiptMediaAssetId: input.payerReceiptMediaAssetId ?? null,
      payerReceiptUrl: checkoutData.payerReceiptUrl,
      payerNote: input.payerNote?.trim() || null,
    });
  }

  private mapStatusHistory(entry: OrderStatusHistoryRecord) {
    return {
      from: entry.old_status,
      to: entry.new_status,
      note: entry.note,
      createdAt: entry.created_at,
    };
  }
}
