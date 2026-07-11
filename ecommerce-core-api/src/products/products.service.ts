import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4, validate as isUuid } from 'uuid';
import * as XLSX from 'xlsx';
import { BrandsRepository } from '../brands/brands.repository';
import {
  AttributesService,
  type ResolvedVariantAttributes,
} from '../attributes/attributes.service';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { CategoriesRepository } from '../categories/categories.repository';
import type { RequestContextData } from '../common/utils/request-context.util';
import { slugify } from '../common/utils/slug.util';
import { StoreCapabilitiesService } from '../store-capabilities/store-capabilities.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { WarehousesService } from '../warehouses/warehouses.service';
import { FiltersRepository } from '../filters/filters.repository';
import { CurrencyService, type VariantCurrencyOverride } from '../currency/currency.service';
import type { AttachProductImageDto } from './dto/attach-product-image.dto';
import type { CreateProductDto } from './dto/create-product.dto';
import type { CreateVariantDto } from './dto/create-variant.dto';
import type { ListProductsQueryDto } from './dto/list-products-query.dto';
import type { ReorderProductImagesDto } from './dto/reorder-product-images.dto';
import type { UpdateProductDto } from './dto/update-product.dto';
import type { UpdateVariantDto } from './dto/update-variant.dto';
import { PRODUCT_STATUSES, type ProductStatus } from './constants/product-status.constants';
import { PRODUCT_TYPES, type ProductType } from './constants/product-type.constants';
import {
  ProductsRepository,
  type MediaAssetRecord,
  type ProductBundleItemRecord,
  type ProductDigitalFileRecord,
  type ProductImageRecord,
  type ProductRecord,
  type ProductVariantRecord,
} from './products.repository';

export interface ProductVariantResponse {
  id: string;
  productId: string;
  title: string;
  titleAr: string | null;
  titleEn: string | null;
  sku: string;
  barcode: string | null;
  price: number;
  priceYER: number;
  compareAtPrice: number | null;
  compareAtPriceYER: number | null;
  currencyOverrides: VariantCurrencyOverride[];
  stockQuantity: number;
  lowStockThreshold: number;
  attributes: Record<string, string>;
  attributeValueIds: string[];
  isDefault: boolean;
}

export interface ProductImageResponse {
  id: string;
  productId: string;
  variantId: string | null;
  mediaAssetId: string;
  url: string;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
}

export interface ProductBundleItemResponse {
  id: string;
  bundledProductId: string;
  bundledVariantId: string | null;
  quantity: number;
  sortOrder: number;
  bundledProductTitle: string;
  bundledVariantTitle: string | null;
}

export interface ProductDigitalFileResponse {
  id: string;
  mediaAssetId: string;
  fileName: string | null;
  sortOrder: number;
  url: string;
  fileSizeBytes: number;
}

export interface ProductInlineDiscountResponse {
  type: 'percent' | 'fixed';
  value: number;
  startsAt: string | null;
  endsAt: string | null;
}

export interface ProductResponse {
  id: string;
  storeId: string;
  categoryId: string | null;
  categoryIds: string[];
  productType: ProductType;
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
  status: ProductStatus;
  variants?: ProductVariantResponse[];
  images?: ProductImageResponse[];
  bundleItems?: ProductBundleItemResponse[];
  digitalFiles?: ProductDigitalFileResponse[];
  relatedProductIds?: string[];
  brand: string | null;
  brandId: string | null;
  weight: number | null;
  weightUnit: string | null;
  dimensions: { length?: number; width?: number; height?: number } | null;
  costPrice: number | null;
  productLabel: string | null;
  youtubeUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoTitleAr: string | null;
  seoTitleEn: string | null;
  seoDescriptionAr: string | null;
  seoDescriptionEn: string | null;
  customFields: Array<Record<string, unknown>>;
  inlineDiscount: ProductInlineDiscountResponse | null;
  digitalDownloadAttemptsLimit: number | null;
  digitalDownloadExpiresAt: string | null;
  tags: string[];
  isFeatured: boolean;
  isTaxable: boolean;
  taxRate: number;
  minOrderQuantity: number;
  maxOrderQuantity: number | null;
  publishedAt: string | null;
  ratingAvg: number;
  ratingCount: number;
  filterValueIds?: string[];
  filterRanges?: Array<{ filterId: string; numericValue: number }>;
}

export interface ProductListResponse {
  items: ProductResponse[];
  total: number;
  page: number;
  limit: number;
}

export interface ProductExcelImportResultResponse {
  totalRows: number;
  created: number;
  updated: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly productsRepository: ProductsRepository,
    private readonly categoriesRepository: CategoriesRepository,
    private readonly attributesService: AttributesService,
    private readonly filtersRepository: FiltersRepository,
    private readonly auditService: AuditService,
    private readonly storeCapabilitiesService: StoreCapabilitiesService,
    private readonly webhooksService: WebhooksService,
    private readonly warehousesService: WarehousesService,
    private readonly brandsRepository: BrandsRepository,
    private readonly currencyService: CurrencyService,
  ) {}

  async create(
    currentUser: AuthUser,
    input: CreateProductDto,
    context: RequestContextData,
  ): Promise<ProductResponse> {
    await this.storeCapabilitiesService.assertMetricCanGrow(
      currentUser.storeId,
      'products.total',
      1,
    );

    const primaryArabicTitle = this.resolvePrimaryArabicTitle(input.title, input.titleAr);
    const slug = this.resolveSlug(primaryArabicTitle, input.slug);
    await this.ensureProductSlugAvailable(currentUser.storeId, slug);
    const productType = input.productType ?? 'single';
    const categoryIds = this.resolveCategoryIds(input.categoryIds, input.categoryId);
    await this.validateCategories(currentUser.storeId, categoryIds);
    await this.validateRelatedProducts(currentUser.storeId, [], input.relatedProductIds ?? []);
    await this.validateBundleItems(currentUser.storeId, input.bundleItems ?? [], productType);
    await this.validateDigitalFiles(currentUser.storeId, productType, input.digitalFiles ?? []);
    this.validateInlineDiscount(input.inlineDiscount, input.inlineDiscountEnabled);
    const brandAssignment = await this.resolveBrandAssignment(currentUser.storeId, {
      ...(input.brandId !== undefined ? { brandId: input.brandId } : {}),
      ...(input.brand !== undefined ? { brand: input.brand } : {}),
    });

    const productId = uuidv4();
    const stockUnlimited = this.resolveStockUnlimited(input.stockUnlimited, productType);

    const product = await this.productsRepository.withTransaction(async (db) => {
      const created = await this.productsRepository.create({
        id: productId,
        storeId: currentUser.storeId,
        categoryId: categoryIds[0] ?? null,
        productType,
        isVisible: input.isVisible ?? true,
        stockUnlimited,
        questionsEnabled: input.questionsEnabled ?? false,
        title: primaryArabicTitle,
        titleAr: primaryArabicTitle,
        titleEn: input.titleEn ?? null,
        slug,
        description: input.description?.trim() ?? null,
        descriptionAr: input.descriptionAr ?? null,
        descriptionEn: input.descriptionEn ?? null,
        shortDescriptionAr: input.shortDescriptionAr?.trim() ?? null,
        shortDescriptionEn: input.shortDescriptionEn?.trim() ?? null,
        detailedDescriptionAr: input.detailedDescriptionAr?.trim() ?? null,
        detailedDescriptionEn: input.detailedDescriptionEn?.trim() ?? null,
        status: input.status ?? 'draft',
        brand: brandAssignment.brand,
        brandId: brandAssignment.brandId,
        weight: input.weight ?? null,
        weightUnit: input.weightUnit?.trim() ?? null,
        dimensions: input.dimensions ?? null,
        costPrice: input.costPrice ?? null,
        productLabel: input.productLabel?.trim() ?? null,
        youtubeUrl: input.youtubeUrl?.trim() ?? null,
        seoTitle: input.seoTitle?.trim() ?? null,
        seoDescription: input.seoDescription?.trim() ?? null,
        seoTitleAr: input.seoTitleAr?.trim() ?? null,
        seoTitleEn: input.seoTitleEn?.trim() ?? null,
        seoDescriptionAr: input.seoDescriptionAr?.trim() ?? null,
        seoDescriptionEn: input.seoDescriptionEn?.trim() ?? null,
        customFields: this.normalizeCustomFields(input.customFields),
        inlineDiscountType:
          (input.inlineDiscountEnabled ?? Boolean(input.inlineDiscount)) && input.inlineDiscount
            ? input.inlineDiscount.type
            : null,
        inlineDiscountValue:
          (input.inlineDiscountEnabled ?? Boolean(input.inlineDiscount)) && input.inlineDiscount
            ? input.inlineDiscount.value
            : null,
        inlineDiscountStartsAt:
          (input.inlineDiscountEnabled ?? Boolean(input.inlineDiscount)) &&
          input.inlineDiscount?.startsAt
            ? new Date(input.inlineDiscount.startsAt)
            : null,
        inlineDiscountEndsAt:
          (input.inlineDiscountEnabled ?? Boolean(input.inlineDiscount)) &&
          input.inlineDiscount?.endsAt
            ? new Date(input.inlineDiscount.endsAt)
            : null,
        inlineDiscountActive: input.inlineDiscountEnabled ?? Boolean(input.inlineDiscount),
        digitalDownloadAttemptsLimit:
          productType === 'digital' ? (input.digitalDownloadAttemptsLimit ?? null) : null,
        digitalDownloadExpiresAt:
          productType === 'digital' && input.digitalDownloadExpiresAt
            ? new Date(input.digitalDownloadExpiresAt)
            : null,
        tags: input.tags ?? [],
        isFeatured: input.isFeatured ?? false,
        isTaxable: input.isTaxable ?? true,
        taxRate: input.taxRate ?? 0,
        minOrderQuantity: input.minOrderQuantity ?? 1,
        maxOrderQuantity: input.maxOrderQuantity ?? null,
      });

      await this.productsRepository.replaceProductCategories(db, {
        storeId: currentUser.storeId,
        productId,
        categoryIds,
      });
      await this.productsRepository.replaceRelatedProducts(db, {
        storeId: currentUser.storeId,
        productId,
        relatedProductIds: this.normalizeUniqueIds(input.relatedProductIds ?? []).filter(
          (id) => id !== productId,
        ),
      });
      await this.productsRepository.replaceBundleItems(db, {
        storeId: currentUser.storeId,
        productId,
        bundleItems: (input.bundleItems ?? []).map((item, index) => ({
          bundledProductId: item.bundledProductId,
          bundledVariantId: item.bundledVariantId ?? null,
          quantity: item.quantity,
          sortOrder: item.sortOrder ?? index,
        })),
      });
      await this.productsRepository.replaceDigitalFiles(db, {
        storeId: currentUser.storeId,
        productId,
        files: (input.digitalFiles ?? []).map((file, index) => ({
          mediaAssetId: file.mediaAssetId,
          fileName: file.fileName?.trim() ?? null,
          sortOrder: file.sortOrder ?? index,
        })),
      });

      return created;
    });

    const categoryIdsForResponse = categoryIds;
    const relatedProductIdsForResponse = this.normalizeUniqueIds(input.relatedProductIds ?? []);

    await this.logProductAction('products.created', currentUser, product.id, context);
    await this.webhooksService.dispatchEvent(currentUser.storeId, 'product.created', {
      productId: product.id,
      title: product.title,
      slug: product.slug,
      status: product.status,
    });
    return this.toProductResponse(product, categoryIdsForResponse, relatedProductIdsForResponse);
  }

  async list(currentUser: AuthUser, query: ListProductsQueryDto): Promise<ProductListResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const data = await this.productsRepository.list({
      storeId: currentUser.storeId,
      q: query.q?.trim(),
      status: query.status,
      categoryId: query.categoryId,
      productType: query.productType,
      isVisible: query.isVisible,
      limit,
      offset,
    });

    const items = await Promise.all(
      data.rows.map(async (record) => {
        const [images, variants] = await Promise.all([
          this.productsRepository.listProductImages(currentUser.storeId, record.id),
          this.productsRepository.listVariants(currentUser.storeId, record.id),
        ]);
        const overrideMap = await this.currencyService.listVariantOverrides(
          currentUser.storeId,
          variants.map((variant) => variant.id),
        );

        return {
          ...this.toProductResponse(record),
          images: images.map((image) => this.toImageResponse(image)),
          variants: variants.map((variant) =>
            this.toVariantResponse(variant, [], overrideMap.get(variant.id) ?? []),
          ),
        };
      }),
    );

    return {
      items,
      total: data.total,
      page,
      limit,
    };
  }

  async exportToExcel(currentUser: AuthUser): Promise<Buffer> {
    const limit = 100;
    let page = 1;
    let total = 0;
    const rows: ProductResponse[] = [];

    do {
      const batch = await this.list(currentUser, { page, limit });
      rows.push(...batch.items);
      total = batch.total;
      page += 1;
    } while (rows.length < total);

    const worksheetRows = rows.map((product) => ({
      id: product.id,
      title_ar: product.titleAr ?? product.title,
      title_en: product.titleEn ?? '',
      slug: product.slug,
      status: product.status,
      product_type: product.productType,
      is_visible: product.isVisible,
      category_ids: product.categoryIds.join(','),
      brand: product.brand ?? '',
      tags: product.tags.join(','),
      description_ar: product.descriptionAr ?? '',
      description_en: product.descriptionEn ?? '',
      tax_rate: product.taxRate,
      is_featured: product.isFeatured,
      is_taxable: product.isTaxable,
      min_order_quantity: product.minOrderQuantity,
      max_order_quantity: product.maxOrderQuantity ?? '',
      stock_unlimited: product.stockUnlimited,
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'products');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  async importFromExcel(
    currentUser: AuthUser,
    fileBuffer: Buffer,
    context: RequestContextData,
  ): Promise<ProductExcelImportResultResponse> {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new BadRequestException('Excel file is empty');
    }

    const worksheet = workbook.Sheets[firstSheetName];
    if (!worksheet) {
      throw new BadRequestException('Excel worksheet not found');
    }
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });
    if (rawRows.length === 0) {
      throw new BadRequestException('Excel file has no data rows');
    }

    const result: ProductExcelImportResultResponse = {
      totalRows: rawRows.length,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
    };

    for (let index = 0; index < rawRows.length; index += 1) {
      const rowNumber = index + 2;
      const rawRow = rawRows[index];
      if (!rawRow) {
        continue;
      }
      const row = this.normalizeExcelRow(rawRow);

      try {
        const id = this.readStringCell(row, ['id']);
        const slug = this.readStringCell(row, ['slug']);
        const titleAr = this.readStringCell(row, ['title_ar', 'titlear', 'title']);
        const titleEn = this.readStringCell(row, ['title_en', 'titleen']);
        const descriptionAr = this.readStringCell(row, [
          'description_ar',
          'descriptionar',
          'description',
        ]);
        const descriptionEn = this.readStringCell(row, ['description_en', 'descriptionen']);
        const statusRaw = this.readStringCell(row, ['status'])?.toLowerCase();
        const productTypeRaw = this.readStringCell(row, [
          'product_type',
          'producttype',
        ])?.toLowerCase();
        const brand = this.readStringCell(row, ['brand']);
        const categoryIds = this.readStringListCell(row, ['category_ids', 'categoryids']);
        const tags = this.readStringListCell(row, ['tags']);
        const isVisible = this.readBooleanCell(row, ['is_visible', 'isvisible']);
        const isFeatured = this.readBooleanCell(row, ['is_featured', 'isfeatured']);
        const isTaxable = this.readBooleanCell(row, ['is_taxable', 'istaxable']);
        const stockUnlimited = this.readBooleanCell(row, ['stock_unlimited', 'stockunlimited']);
        const taxRate = this.readNumberCell(row, ['tax_rate', 'taxrate']);
        const minOrderQuantity = this.readIntegerCell(row, [
          'min_order_quantity',
          'minorderquantity',
        ]);
        const maxOrderQuantity = this.readIntegerCell(row, [
          'max_order_quantity',
          'maxorderquantity',
        ]);

        const payload: Partial<CreateProductDto> & Partial<UpdateProductDto> = {};

        if (titleAr) {
          payload.title = titleAr;
          payload.titleAr = titleAr;
        }
        if (titleEn) {
          payload.titleEn = titleEn;
        }
        if (slug) {
          payload.slug = slug;
        }
        if (descriptionAr) {
          payload.description = descriptionAr;
          payload.descriptionAr = descriptionAr;
        }
        if (descriptionEn) {
          payload.descriptionEn = descriptionEn;
        }
        if (brand) {
          payload.brand = brand;
        }
        if (categoryIds.length > 0) {
          payload.categoryIds = categoryIds;
        }
        if (tags.length > 0) {
          payload.tags = tags;
        }
        if (isVisible !== undefined) {
          payload.isVisible = isVisible;
        }
        if (isFeatured !== undefined) {
          payload.isFeatured = isFeatured;
        }
        if (isTaxable !== undefined) {
          payload.isTaxable = isTaxable;
        }
        if (stockUnlimited !== undefined) {
          payload.stockUnlimited = stockUnlimited;
        }
        if (taxRate !== undefined) {
          payload.taxRate = taxRate;
        }
        if (minOrderQuantity !== undefined) {
          payload.minOrderQuantity = minOrderQuantity;
        }
        if (maxOrderQuantity !== undefined) {
          payload.maxOrderQuantity = maxOrderQuantity;
        }

        if (statusRaw) {
          if (!PRODUCT_STATUSES.includes(statusRaw as ProductStatus)) {
            throw new BadRequestException(`Invalid status value: ${statusRaw}`);
          }
          payload.status = statusRaw as ProductStatus;
        }

        if (productTypeRaw) {
          if (!PRODUCT_TYPES.includes(productTypeRaw as ProductType)) {
            throw new BadRequestException(`Invalid product_type value: ${productTypeRaw}`);
          }
          payload.productType = productTypeRaw as ProductType;
        }

        let existingProduct: ProductRecord | null = null;
        if (id) {
          if (!isUuid(id)) {
            throw new BadRequestException('Invalid id value. Expected UUID v4');
          }
          existingProduct = await this.productsRepository.findById(currentUser.storeId, id);
        } else if (slug) {
          existingProduct = await this.productsRepository.findBySlug(currentUser.storeId, slug);
        }

        if (existingProduct) {
          await this.update(currentUser, existingProduct.id, payload as UpdateProductDto, context);
          result.updated += 1;
          continue;
        }

        if (!payload.title) {
          throw new BadRequestException('title_ar (or title) is required for new products');
        }

        await this.create(currentUser, payload as CreateProductDto, context);
        result.created += 1;
      } catch (error) {
        result.failed += 1;
        const message = error instanceof Error ? error.message : 'Unexpected import error';
        result.errors.push({ row: rowNumber, message });
      }
    }

    return result;
  }

  async getById(currentUser: AuthUser, productId: string): Promise<ProductResponse> {
    const product = await this.requireProduct(currentUser.storeId, productId);
    const [
      variants,
      images,
      categoryIds,
      relatedProductIds,
      bundleItems,
      digitalFiles,
      filterValues,
      filterRanges,
    ] = await Promise.all([
      this.productsRepository.listVariants(currentUser.storeId, productId),
      this.productsRepository.listProductImages(currentUser.storeId, productId),
      this.productsRepository.listProductCategoryIds(currentUser.storeId, productId),
      this.productsRepository.listRelatedProductIds(currentUser.storeId, productId),
      this.productsRepository.listBundleItems(currentUser.storeId, productId),
      this.productsRepository.listDigitalFiles(currentUser.storeId, productId),
      this.filtersRepository.listProductFilterValues(currentUser.storeId, productId),
      this.filtersRepository.listProductFilterRanges(currentUser.storeId, productId),
    ]);
    const variantAttributeState = await this.attributesService.listVariantAttributeState(
      currentUser.storeId,
      variants.map((variant) => variant.id),
    );
    const overrideMap = await this.currencyService.listVariantOverrides(
      currentUser.storeId,
      variants.map((variant) => variant.id),
    );

    return {
      ...this.toProductResponse(product, categoryIds, relatedProductIds),
      variants: variants.map((variant) =>
        this.toVariantResponse(
          variant,
          variantAttributeState.get(variant.id)?.valueIds ?? [],
          overrideMap.get(variant.id) ?? [],
        ),
      ),
      images: images.map((image) => this.toImageResponse(image)),
      bundleItems: bundleItems.map((item) => this.toBundleItemResponse(item)),
      digitalFiles: digitalFiles.map((item) => this.toDigitalFileResponse(item)),
      filterValueIds: filterValues.map((item) => item.id),
      filterRanges: filterRanges.map((item) => ({
        filterId: item.filter_id,
        numericValue: Number(item.numeric_value),
      })),
    };
  }

  async update(
    currentUser: AuthUser,
    productId: string,
    input: UpdateProductDto,
    context: RequestContextData,
  ): Promise<ProductResponse> {
    const existing = await this.requireProduct(currentUser.storeId, productId);
    const slug = this.getNextSlug(existing, input);
    const primaryArabicTitle = this.resolvePrimaryArabicTitle(
      input.title ?? existing.title,
      input.titleAr ?? existing.title_ar,
    );
    if (slug !== existing.slug) {
      await this.ensureProductSlugAvailable(currentUser.storeId, slug, productId);
    }

    const [currentCategoryIds, currentRelatedProductIds, currentBundleItems, currentDigitalFiles] =
      await Promise.all([
        this.productsRepository.listProductCategoryIds(currentUser.storeId, productId),
        this.productsRepository.listRelatedProductIds(currentUser.storeId, productId),
        this.productsRepository.listBundleItems(currentUser.storeId, productId),
        this.productsRepository.listDigitalFiles(currentUser.storeId, productId),
      ]);

    const categoryIds =
      input.categoryIds !== undefined || input.categoryId !== undefined
        ? this.resolveCategoryIds(input.categoryIds, input.categoryId)
        : currentCategoryIds;
    const relatedProductIds =
      input.relatedProductIds !== undefined
        ? this.normalizeUniqueIds(input.relatedProductIds)
        : currentRelatedProductIds;
    const productType = input.productType ?? existing.product_type;
    const bundleItems =
      productType === 'bundled'
        ? input.bundleItems !== undefined
          ? input.bundleItems
          : currentBundleItems.map((item) => ({
              bundledProductId: item.bundled_product_id,
              ...(item.bundled_variant_id ? { bundledVariantId: item.bundled_variant_id } : {}),
              quantity: item.quantity,
              sortOrder: item.sort_order,
            }))
        : [];
    const digitalFiles =
      productType === 'digital'
        ? input.digitalFiles !== undefined
          ? input.digitalFiles
          : currentDigitalFiles.map((file) => ({
              mediaAssetId: file.media_asset_id,
              ...(file.file_name ? { fileName: file.file_name } : {}),
              sortOrder: file.sort_order,
            }))
        : [];

    await this.validateCategories(currentUser.storeId, categoryIds);
    await this.validateRelatedProducts(currentUser.storeId, [productId], relatedProductIds);

    await this.validateBundleItems(currentUser.storeId, bundleItems, productType, productId);
    await this.validateDigitalFiles(currentUser.storeId, productType, digitalFiles);
    this.validateInlineDiscount(input.inlineDiscount, input.inlineDiscountEnabled);
    const brandAssignment = await this.resolveBrandAssignment(currentUser.storeId, {
      brandId: input.brandId !== undefined ? input.brandId : existing.brand_id,
      brand:
        input.brand !== undefined
          ? input.brand
          : input.brandId !== undefined && input.brandId === null
            ? null
            : existing.brand,
    });

    const stockUnlimited = this.resolveStockUnlimited(
      input.stockUnlimited ?? existing.stock_unlimited,
      productType,
    );

    const updated = await this.productsRepository.withTransaction(async (db) => {
      const row = await this.productsRepository.update({
        storeId: currentUser.storeId,
        productId,
        categoryId: categoryIds[0] ?? null,
        productType,
        isVisible: input.isVisible ?? existing.is_visible,
        stockUnlimited,
        questionsEnabled: input.questionsEnabled ?? existing.questions_enabled,
        title: primaryArabicTitle,
        titleAr: primaryArabicTitle,
        titleEn: input.titleEn ?? existing.title_en,
        slug,
        description: input.description?.trim() ?? existing.description,
        descriptionAr: input.descriptionAr ?? existing.description_ar,
        descriptionEn: input.descriptionEn ?? existing.description_en,
        shortDescriptionAr: input.shortDescriptionAr ?? existing.short_description_ar,
        shortDescriptionEn: input.shortDescriptionEn ?? existing.short_description_en,
        detailedDescriptionAr: input.detailedDescriptionAr ?? existing.detailed_description_ar,
        detailedDescriptionEn: input.detailedDescriptionEn ?? existing.detailed_description_en,
        status: input.status ?? existing.status,
        brand: brandAssignment.brand,
        brandId: brandAssignment.brandId,
        weight: input.weight ?? (existing.weight ? Number(existing.weight) : null),
        weightUnit: input.weightUnit ?? existing.weight_unit,
        dimensions: input.dimensions ?? existing.dimensions,
        costPrice: input.costPrice ?? (existing.cost_price ? Number(existing.cost_price) : null),
        productLabel: input.productLabel ?? existing.product_label,
        youtubeUrl: input.youtubeUrl ?? existing.youtube_url,
        seoTitle: input.seoTitle?.trim() ?? existing.seo_title,
        seoDescription: input.seoDescription?.trim() ?? existing.seo_description,
        seoTitleAr: input.seoTitleAr ?? existing.seo_title_ar,
        seoTitleEn: input.seoTitleEn ?? existing.seo_title_en,
        seoDescriptionAr: input.seoDescriptionAr ?? existing.seo_description_ar,
        seoDescriptionEn: input.seoDescriptionEn ?? existing.seo_description_en,
        customFields:
          input.customFields !== undefined
            ? this.normalizeCustomFields(input.customFields)
            : (existing.custom_fields ?? []),
        inlineDiscountType:
          input.inlineDiscountEnabled === false
            ? null
            : (input.inlineDiscount?.type ?? existing.inline_discount_type),
        inlineDiscountValue:
          input.inlineDiscountEnabled === false
            ? null
            : (input.inlineDiscount?.value ??
              (existing.inline_discount_value ? Number(existing.inline_discount_value) : null)),
        inlineDiscountStartsAt:
          input.inlineDiscountEnabled === false
            ? null
            : input.inlineDiscount?.startsAt
              ? new Date(input.inlineDiscount.startsAt)
              : existing.inline_discount_starts_at
                ? new Date(existing.inline_discount_starts_at)
                : null,
        inlineDiscountEndsAt:
          input.inlineDiscountEnabled === false
            ? null
            : input.inlineDiscount?.endsAt
              ? new Date(input.inlineDiscount.endsAt)
              : existing.inline_discount_ends_at
                ? new Date(existing.inline_discount_ends_at)
                : null,
        inlineDiscountActive:
          input.inlineDiscountEnabled ??
          (input.inlineDiscount !== undefined ? true : existing.inline_discount_active),
        digitalDownloadAttemptsLimit:
          productType === 'digital'
            ? (input.digitalDownloadAttemptsLimit ?? existing.digital_download_attempts_limit)
            : null,
        digitalDownloadExpiresAt:
          productType === 'digital'
            ? input.digitalDownloadExpiresAt
              ? new Date(input.digitalDownloadExpiresAt)
              : existing.digital_download_expires_at
                ? new Date(existing.digital_download_expires_at)
                : null
            : null,
        tags: input.tags ?? existing.tags,
        isFeatured: input.isFeatured ?? existing.is_featured,
        isTaxable: input.isTaxable ?? existing.is_taxable,
        taxRate: input.taxRate ?? Number(existing.tax_rate),
        minOrderQuantity: input.minOrderQuantity ?? existing.min_order_quantity,
        maxOrderQuantity: input.maxOrderQuantity ?? existing.max_order_quantity,
      });

      if (!row) {
        return null;
      }

      await this.productsRepository.replaceProductCategories(db, {
        storeId: currentUser.storeId,
        productId,
        categoryIds,
      });
      await this.productsRepository.replaceRelatedProducts(db, {
        storeId: currentUser.storeId,
        productId,
        relatedProductIds,
      });
      await this.productsRepository.replaceBundleItems(db, {
        storeId: currentUser.storeId,
        productId,
        bundleItems: bundleItems.map((item, index) => ({
          bundledProductId: item.bundledProductId,
          bundledVariantId: item.bundledVariantId ?? null,
          quantity: item.quantity,
          sortOrder: item.sortOrder ?? index,
        })),
      });
      await this.productsRepository.replaceDigitalFiles(db, {
        storeId: currentUser.storeId,
        productId,
        files: digitalFiles.map((file, index) => ({
          mediaAssetId: file.mediaAssetId,
          fileName: file.fileName?.trim() ?? null,
          sortOrder: file.sortOrder ?? index,
        })),
      });

      return row;
    });

    if (!updated) {
      throw new NotFoundException('Product not found');
    }

    if (input.status === 'active' && existing.status !== 'active') {
      await this.productsRepository.setPublishedAt(currentUser.storeId, productId);
    }

    await this.logProductAction('products.updated', currentUser, productId, context);
    await this.webhooksService.dispatchEvent(currentUser.storeId, 'product.updated', {
      productId: updated.id,
      title: updated.title,
      slug: updated.slug,
      status: updated.status,
    });
    const [categoryIdsAfter, relatedProductIdsAfter] = await Promise.all([
      this.productsRepository.listProductCategoryIds(currentUser.storeId, productId),
      this.productsRepository.listRelatedProductIds(currentUser.storeId, productId),
    ]);
    return this.toProductResponse(updated, categoryIdsAfter, relatedProductIdsAfter);
  }

  async delete(
    currentUser: AuthUser,
    productId: string,
    context: RequestContextData,
  ): Promise<void> {
    await this.requireProduct(currentUser.storeId, productId);
    await this.productsRepository.delete(currentUser.storeId, productId);
    await this.logProductAction('products.deleted', currentUser, productId, context);
  }

  async addVariant(
    currentUser: AuthUser,
    productId: string,
    input: CreateVariantDto,
    context: RequestContextData,
  ): Promise<ProductVariantResponse> {
    const product = await this.requireProduct(currentUser.storeId, productId);
    this.validateVariantPrices(input);
    await this.ensureSkuAvailable(currentUser.storeId, input.sku);
    const selectedAttributes = await this.resolveVariantAttributes(
      currentUser.storeId,
      input.attributeValueIds ?? [],
      product.category_id,
    );
    const variantCount = await this.productsRepository.countVariants(
      currentUser.storeId,
      productId,
    );
    const isDefault = input.isDefault ?? variantCount === 0;
    const mergedAttributes = this.mergeVariantAttributes(
      input.attributes ?? {},
      selectedAttributes.attributesMap,
    );
    const variant = await this.createVariantWithAssignments({
      storeId: currentUser.storeId,
      productId,
      payload: input,
      mergedAttributes,
      isDefault,
      selectedAttributes,
    });
    await this.logProductAction('products.variant_created', currentUser, productId, context);
    return this.toVariantResponse(variant, selectedAttributes.attributeValueIds);
  }

  async updateVariantCurrencyPrices(
    currentUser: AuthUser,
    productId: string,
    variantId: string,
    overrides: VariantCurrencyOverride[],
    context: RequestContextData,
  ): Promise<ProductVariantResponse> {
    await this.requireProduct(currentUser.storeId, productId);
    const variant = await this.productsRepository.findVariantById(currentUser.storeId, variantId);
    if (!variant || variant.product_id !== productId) {
      throw new NotFoundException('Variant not found');
    }

    const updatedOverrides = await this.currencyService.replaceVariantOverrides(
      currentUser.storeId,
      variantId,
      overrides,
    );
    const attributeState = await this.attributesService.listVariantAttributeState(
      currentUser.storeId,
      [variantId],
    );
    await this.logProductAction(
      'products.variant_currency_prices_updated',
      currentUser,
      productId,
      context,
    );

    return this.toVariantResponse(
      variant,
      attributeState.get(variantId)?.valueIds ?? [],
      updatedOverrides,
    );
  }

  private resolveVariantAttributes(
    storeId: string,
    attributeValueIds: string[],
    categoryId: string | null,
  ) {
    return this.attributesService.resolveVariantAttributes(storeId, attributeValueIds, categoryId);
  }

  private mergeVariantAttributes(
    inputAttributes: Record<string, string>,
    selectedAttributesMap: Record<string, string>,
  ): Record<string, string> {
    return {
      ...this.normalizeAttributes(inputAttributes),
      ...selectedAttributesMap,
    };
  }

  private async createVariantWithAssignments(input: {
    storeId: string;
    productId: string;
    payload: CreateVariantDto;
    mergedAttributes: Record<string, string>;
    isDefault: boolean;
    selectedAttributes: ResolvedVariantAttributes;
  }): Promise<ProductVariantRecord> {
    const primaryArabicTitle = this.resolvePrimaryArabicTitle(
      input.payload.title,
      input.payload.titleAr,
    );

    const variant = await this.productsRepository.createVariant({
      productId: input.productId,
      storeId: input.storeId,
      title: primaryArabicTitle,
      titleAr: primaryArabicTitle,
      titleEn: input.payload.titleEn ?? null,
      sku: input.payload.sku.trim(),
      barcode: input.payload.barcode?.trim() ?? null,
      price: input.payload.price,
      compareAtPrice: input.payload.compareAtPrice ?? null,
      stockQuantity: input.payload.stockQuantity ?? 0,
      lowStockThreshold: input.payload.lowStockThreshold ?? 0,
      attributes: input.mergedAttributes,
      isDefault: input.isDefault,
    });

    await this.attributesService.replaceVariantAttributeValues(
      input.storeId,
      variant.id,
      input.selectedAttributes.assignments,
    );
    if (variant.is_default) {
      await this.productsRepository.unsetDefaultVariants(
        input.storeId,
        input.productId,
        variant.id,
      );
    }

    await this.warehousesService.assignInitialVariantAllocation({
      storeId: input.storeId,
      productId: input.productId,
      variantId: variant.id,
      stockQuantity: variant.stock_quantity,
      lowStockThreshold: variant.low_stock_threshold,
    });

    return variant;
  }

  async updateVariantAttributes(
    currentUser: AuthUser,
    productId: string,
    variantId: string,
    attributeValueIds: string[],
    context: RequestContextData,
  ): Promise<ProductVariantResponse> {
    const product = await this.requireProduct(currentUser.storeId, productId);
    const variant = await this.productsRepository.findVariantById(currentUser.storeId, variantId);
    if (!variant || variant.product_id !== productId) {
      throw new NotFoundException('Variant not found');
    }

    const selectedAttributes = await this.attributesService.resolveVariantAttributes(
      currentUser.storeId,
      attributeValueIds,
      product.category_id,
    );
    const currentState = await this.attributesService.listVariantAttributeState(
      currentUser.storeId,
      [variantId],
    );
    const preservedAttributes = this.omitKeys(
      variant.attributes,
      currentState.get(variantId)?.attributeSlugs ?? [],
    );

    const updated = await this.productsRepository.updateVariantAttributes({
      storeId: currentUser.storeId,
      variantId,
      attributes: {
        ...preservedAttributes,
        ...selectedAttributes.attributesMap,
      },
    });

    if (!updated) {
      throw new NotFoundException('Variant not found');
    }

    await this.attributesService.replaceVariantAttributeValues(
      currentUser.storeId,
      variantId,
      selectedAttributes.assignments,
    );
    await this.logProductAction(
      'products.variant_attributes_updated',
      currentUser,
      productId,
      context,
    );

    return this.toVariantResponse(updated, selectedAttributes.attributeValueIds);
  }

  async updateVariant(
    currentUser: AuthUser,
    productId: string,
    variantId: string,
    input: UpdateVariantDto,
    context: RequestContextData,
  ): Promise<ProductVariantResponse> {
    await this.requireProduct(currentUser.storeId, productId);
    const variant = await this.productsRepository.findVariantById(currentUser.storeId, variantId);
    if (!variant || variant.product_id !== productId) {
      throw new NotFoundException('Variant not found');
    }

    if (input.sku !== undefined && input.sku.trim() !== variant.sku) {
      await this.ensureSkuAvailable(currentUser.storeId, input.sku.trim(), variantId);
    }

    if (
      input.compareAtPrice !== undefined &&
      input.compareAtPrice !== null &&
      input.price !== undefined &&
      input.compareAtPrice < input.price
    ) {
      throw new BadRequestException('compareAtPrice must be greater than or equal to price');
    }

    const updated = await this.productsRepository.updateVariant({
      storeId: currentUser.storeId,
      variantId,
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.titleAr !== undefined ? { titleAr: input.titleAr?.trim() ?? null } : {}),
      ...(input.titleEn !== undefined ? { titleEn: input.titleEn?.trim() ?? null } : {}),
      ...(input.sku !== undefined ? { sku: input.sku.trim() } : {}),
      ...(input.barcode !== undefined ? { barcode: input.barcode?.trim() ?? null } : {}),
      ...(input.price !== undefined ? { price: input.price } : {}),
      ...(input.compareAtPrice !== undefined ? { compareAtPrice: input.compareAtPrice } : {}),
      ...(input.stockQuantity !== undefined ? { stockQuantity: input.stockQuantity } : {}),
      ...(input.lowStockThreshold !== undefined
        ? { lowStockThreshold: input.lowStockThreshold }
        : {}),
      ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
    });

    if (!updated) {
      throw new NotFoundException('Variant not found after update');
    }

    if (input.isDefault === true) {
      await this.productsRepository.unsetDefaultVariants(currentUser.storeId, productId, variantId);
    }

    let attributeValueIds = variant.attributes
      ? await this.getCurrentAttributeValueIds(currentUser.storeId, variantId)
      : [];

    if (input.attributeValueIds !== undefined) {
      const product = await this.requireProduct(currentUser.storeId, productId);
      const selectedAttributes = await this.attributesService.resolveVariantAttributes(
        currentUser.storeId,
        input.attributeValueIds,
        product.category_id,
      );
      const currentState = await this.attributesService.listVariantAttributeState(
        currentUser.storeId,
        [variantId],
      );
      const preservedAttributes = this.omitKeys(
        variant.attributes,
        currentState.get(variantId)?.attributeSlugs ?? [],
      );

      await this.productsRepository.updateVariantAttributes({
        storeId: currentUser.storeId,
        variantId,
        attributes: {
          ...preservedAttributes,
          ...selectedAttributes.attributesMap,
        },
      });

      await this.attributesService.replaceVariantAttributeValues(
        currentUser.storeId,
        variantId,
        selectedAttributes.assignments,
      );

      attributeValueIds = selectedAttributes.attributeValueIds;
    }

    await this.logProductAction('products.variant_updated', currentUser, productId, context);
    return this.toVariantResponse(
      (await this.productsRepository.findVariantById(currentUser.storeId, variantId)) ?? updated,
      attributeValueIds,
    );
  }

  async deleteVariant(
    currentUser: AuthUser,
    productId: string,
    variantId: string,
    context: RequestContextData,
  ): Promise<void> {
    await this.requireProduct(currentUser.storeId, productId);
    const variant = await this.productsRepository.findVariantById(currentUser.storeId, variantId);
    if (!variant || variant.product_id !== productId) {
      throw new NotFoundException('Variant not found');
    }

    const variantCount = await this.productsRepository.countVariants(
      currentUser.storeId,
      productId,
    );
    if (variantCount <= 1) {
      throw new BadRequestException(
        'لا يمكن حذف آخر متغير للمنتج. يمكنك تعديل بياناته بدلًا من حذفه.',
      );
    }

    await this.productsRepository.deleteVariant(currentUser.storeId, variantId);
    await this.logProductAction('products.variant_deleted', currentUser, productId, context);
  }

  private async ensureSkuAvailable(
    storeId: string,
    sku: string,
    exceptVariantId?: string,
  ): Promise<void> {
    const existing = await this.productsRepository.findVariantBySku(storeId, sku.trim());
    if (existing && existing.id !== exceptVariantId) {
      throw new ConflictException('Variant SKU already in use');
    }
  }

  private async getCurrentAttributeValueIds(storeId: string, variantId: string): Promise<string[]> {
    const state = await this.attributesService.listVariantAttributeState(storeId, [variantId]);
    return state.get(variantId)?.valueIds ?? [];
  }

  async attachImage(
    currentUser: AuthUser,
    productId: string,
    input: AttachProductImageDto,
    context: RequestContextData,
  ): Promise<ProductImageResponse> {
    await this.requireProduct(currentUser.storeId, productId);
    await this.validateVariantOwnership(currentUser.storeId, productId, input.variantId ?? null);
    await this.validateMediaAsset(currentUser.storeId, input.mediaAssetId);

    const imageCount = await this.productsRepository.countProductImages(
      currentUser.storeId,
      productId,
    );
    const shouldSetPrimary = input.isPrimary ?? imageCount === 0;

    const image = await this.productsRepository.attachImage({
      storeId: currentUser.storeId,
      productId,
      variantId: input.variantId ?? null,
      mediaAssetId: input.mediaAssetId,
      altText: input.altText?.trim() ?? null,
      sortOrder: input.sortOrder ?? 0,
      isPrimary: shouldSetPrimary,
    });

    await this.logProductAction('products.image_attached', currentUser, productId, context);
    return this.toImageResponse(image);
  }

  async reorderImages(
    currentUser: AuthUser,
    productId: string,
    input: ReorderProductImagesDto,
    context: RequestContextData,
  ): Promise<ProductImageResponse[]> {
    await this.requireProduct(currentUser.storeId, productId);

    const currentImages = await this.productsRepository.listProductImages(
      currentUser.storeId,
      productId,
    );
    if (currentImages.length === 0) {
      throw new BadRequestException('Product has no images to reorder');
    }

    const imageIds = this.normalizeUniqueIds(input.imageIds);
    if (imageIds.length !== input.imageIds.length) {
      throw new BadRequestException('Duplicate product images are not allowed');
    }

    const existingImageIds = new Set(currentImages.map((image) => image.id));
    if (
      imageIds.length !== currentImages.length ||
      imageIds.some((imageId) => !existingImageIds.has(imageId))
    ) {
      throw new BadRequestException('Image order must include all images for this product');
    }

    const primaryImageId = input.primaryImageId ?? imageIds[0];
    if (!primaryImageId || !existingImageIds.has(primaryImageId)) {
      throw new BadRequestException('Primary image must belong to this product');
    }

    await this.productsRepository.reorderProductImages({
      storeId: currentUser.storeId,
      productId,
      imageIds,
      primaryImageId,
    });

    await this.logProductAction('products.images_reordered', currentUser, productId, context);
    const images = await this.productsRepository.listProductImages(currentUser.storeId, productId);
    return images.map((image) => this.toImageResponse(image));
  }

  async deleteImage(
    currentUser: AuthUser,
    productId: string,
    imageId: string,
    context: RequestContextData,
  ): Promise<ProductImageResponse[]> {
    await this.requireProduct(currentUser.storeId, productId);

    const deleted = await this.productsRepository.deleteProductImage({
      storeId: currentUser.storeId,
      productId,
      imageId,
    });

    if (!deleted) {
      throw new NotFoundException('Product image not found');
    }

    await this.logProductAction('products.image_deleted', currentUser, productId, context);
    const images = await this.productsRepository.listProductImages(currentUser.storeId, productId);
    return images.map((image) => this.toImageResponse(image));
  }

  private async requireProduct(storeId: string, productId: string): Promise<ProductRecord> {
    const product = await this.productsRepository.findById(storeId, productId);
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  private getNextSlug(existing: ProductRecord, input: UpdateProductDto): string {
    if (!input.slug && !input.title && !input.titleAr) {
      return existing.slug;
    }

    const nextTitleForSlug = this.resolvePrimaryArabicTitle(
      input.title ?? existing.title,
      input.titleAr ?? existing.title_ar,
    );
    return this.resolveSlug(nextTitleForSlug, input.slug);
  }

  private resolveSlug(title: string, slug?: string): string {
    const value = slugify(slug ?? title);
    if (!value) {
      throw new BadRequestException('Product slug is invalid');
    }
    return value;
  }

  private resolvePrimaryArabicTitle(baseTitle: string, arabicTitle?: string | null): string {
    const normalizedArabicTitle = arabicTitle?.trim();
    if (normalizedArabicTitle) {
      return normalizedArabicTitle;
    }

    const normalizedBaseTitle = baseTitle.trim();
    if (!normalizedBaseTitle) {
      throw new BadRequestException('Product title is invalid');
    }

    return normalizedBaseTitle;
  }

  private async ensureProductSlugAvailable(
    storeId: string,
    slug: string,
    exceptProductId?: string,
  ): Promise<void> {
    const existing = await this.productsRepository.findBySlug(storeId, slug);
    if (!existing || existing.id === exceptProductId) {
      return;
    }
    throw new ConflictException('Product slug already in use');
  }

  private resolveCategoryIds(categoryIds?: string[], categoryId?: string): string[] {
    const normalized = this.normalizeUniqueIds([
      ...(categoryIds ?? []),
      ...(categoryId ? [categoryId] : []),
    ]);
    return normalized;
  }

  private normalizeUniqueIds(ids: string[]): string[] {
    const seen = new Set<string>();
    const normalized: string[] = [];
    for (const id of ids) {
      const trimmed = id.trim();
      if (!trimmed || seen.has(trimmed)) {
        continue;
      }
      seen.add(trimmed);
      normalized.push(trimmed);
    }
    return normalized;
  }

  private normalizeCustomFields(
    fields:
      | Array<{
          key: string;
          labelAr?: string;
          labelEn?: string;
          value?: Record<string, unknown>;
        }>
      | undefined,
  ): Array<Record<string, unknown>> {
    if (!fields) {
      return [];
    }

    return fields.map((field) => ({
      key: field.key,
      ...(field.labelAr ? { labelAr: field.labelAr } : {}),
      ...(field.labelEn ? { labelEn: field.labelEn } : {}),
      ...(field.value ? { value: field.value } : {}),
    }));
  }

  private async validateCategories(storeId: string, categoryIds: string[]): Promise<void> {
    for (const categoryId of categoryIds) {
      const category = await this.categoriesRepository.findById(storeId, categoryId);
      if (!category) {
        throw new BadRequestException('Category not found in this store');
      }
    }
  }

  private async resolveBrandAssignment(
    storeId: string,
    input: { brandId?: string | null; brand?: string | null },
  ): Promise<{ brandId: string | null; brand: string | null }> {
    const normalizedBrandId = input.brandId?.trim() ? input.brandId : null;
    const normalizedBrandText =
      input.brand === null ? null : input.brand?.trim() ? input.brand.trim() : null;

    if (!normalizedBrandId) {
      return {
        brandId: null,
        brand: normalizedBrandText,
      };
    }

    const brand = await this.brandsRepository.findById(storeId, normalizedBrandId);
    if (!brand) {
      throw new BadRequestException('Brand not found in this store');
    }

    return {
      brandId: brand.id,
      brand: normalizedBrandText ?? brand.name_ar,
    };
  }

  private async validateRelatedProducts(
    storeId: string,
    excludedProductIds: string[],
    relatedProductIds: string[],
  ): Promise<void> {
    const normalized = this.normalizeUniqueIds(relatedProductIds);
    const excluded = new Set(excludedProductIds);

    for (const relatedProductId of normalized) {
      if (excluded.has(relatedProductId)) {
        throw new BadRequestException('Product cannot be related to itself');
      }

      const product = await this.productsRepository.findById(storeId, relatedProductId);
      if (!product) {
        throw new BadRequestException('Related product not found in this store');
      }
    }
  }

  private resolveStockUnlimited(value: boolean | undefined, productType: ProductType): boolean {
    if (productType === 'digital' || productType === 'bundled') {
      return true;
    }
    return Boolean(value);
  }

  private validateInlineDiscount(
    inlineDiscount:
      | {
          type: 'percent' | 'fixed';
          value: number;
          startsAt?: string;
          endsAt?: string;
        }
      | undefined,
    enabled?: boolean,
  ): void {
    if (enabled && !inlineDiscount) {
      throw new BadRequestException(
        'Inline discount details are required when inline discount is enabled',
      );
    }

    if (!inlineDiscount) {
      return;
    }

    if (inlineDiscount.type === 'percent' && inlineDiscount.value > 100) {
      throw new BadRequestException('Inline percent discount must not exceed 100');
    }

    if (inlineDiscount.value < 0) {
      throw new BadRequestException('Inline discount value must be non-negative');
    }

    if (
      inlineDiscount.startsAt &&
      inlineDiscount.endsAt &&
      new Date(inlineDiscount.startsAt).getTime() > new Date(inlineDiscount.endsAt).getTime()
    ) {
      throw new BadRequestException('Inline discount start date must be before end date');
    }
  }

  private async validateBundleItems(
    storeId: string,
    bundleItems: Array<{
      bundledProductId: string;
      bundledVariantId?: string;
      quantity: number;
    }>,
    productType: ProductType,
    currentProductId?: string,
  ): Promise<void> {
    if (productType !== 'bundled') {
      if (bundleItems.length > 0) {
        throw new BadRequestException('Bundle items are only allowed for bundled products');
      }
      return;
    }

    if (bundleItems.length === 0) {
      return;
    }

    for (const item of bundleItems) {
      if (currentProductId && item.bundledProductId === currentProductId) {
        throw new BadRequestException('Bundled product cannot include itself');
      }

      const bundledProduct = await this.productsRepository.findById(storeId, item.bundledProductId);
      if (!bundledProduct) {
        throw new BadRequestException('Bundled product not found in this store');
      }

      if (item.bundledVariantId) {
        const variant = await this.productsRepository.findVariantById(
          storeId,
          item.bundledVariantId,
        );
        if (!variant || variant.product_id !== item.bundledProductId) {
          throw new BadRequestException('Bundled variant does not belong to bundled product');
        }
      }
    }
  }

  private async validateDigitalFiles(
    storeId: string,
    productType: ProductType,
    digitalFiles: Array<{ mediaAssetId: string }>,
  ): Promise<MediaAssetRecord[]> {
    if (productType !== 'digital') {
      if (digitalFiles.length > 0) {
        throw new BadRequestException('Digital files are only allowed for digital products');
      }
      return [];
    }

    if (digitalFiles.length > 10) {
      throw new BadRequestException('Digital products support up to 10 files');
    }

    const mediaAssetIds = this.normalizeUniqueIds(digitalFiles.map((file) => file.mediaAssetId));
    if (mediaAssetIds.length !== digitalFiles.length) {
      throw new BadRequestException('Duplicate digital files are not allowed');
    }
    const assets = await this.productsRepository.listMediaAssetsByIds(storeId, mediaAssetIds);
    if (assets.length !== mediaAssetIds.length) {
      throw new BadRequestException('One or more digital files do not belong to this store');
    }

    const totalSize = assets.reduce((sum, asset) => sum + asset.file_size_bytes, 0);
    const oneGigabyte = 1024 * 1024 * 1024;
    if (totalSize > oneGigabyte) {
      throw new BadRequestException('Digital files total size must not exceed 1 GB');
    }

    return assets;
  }

  private validateVariantPrices(input: CreateVariantDto): void {
    if (input.compareAtPrice !== undefined && input.compareAtPrice < input.price) {
      throw new BadRequestException('compareAtPrice must be greater than or equal to price');
    }
  }

  private async validateVariantOwnership(
    storeId: string,
    productId: string,
    variantId: string | null,
  ): Promise<void> {
    if (!variantId) {
      return;
    }

    const variant = await this.productsRepository.findVariantById(storeId, variantId);
    if (!variant || variant.product_id !== productId) {
      throw new BadRequestException('Variant does not belong to this product');
    }
  }

  private async validateMediaAsset(storeId: string, mediaAssetId: string): Promise<void> {
    const media = await this.productsRepository.findMediaAssetById(storeId, mediaAssetId);
    if (!media) {
      throw new BadRequestException('Media asset not found in this store');
    }
  }

  private async logProductAction(
    action: string,
    currentUser: AuthUser,
    productId: string,
    context: RequestContextData,
  ): Promise<void> {
    await this.auditService.log({
      action,
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
      targetType: 'product',
      targetId: productId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: context.requestId ? { requestId: context.requestId } : {},
    });
  }

  private toProductResponse(
    record: ProductRecord,
    categoryIds: string[] = [],
    relatedProductIds: string[] = [],
  ): ProductResponse {
    return {
      id: record.id,
      storeId: record.store_id,
      categoryId: record.category_id,
      categoryIds:
        categoryIds.length > 0 ? categoryIds : record.category_id ? [record.category_id] : [],
      productType: record.product_type,
      isVisible: record.is_visible,
      stockUnlimited: record.stock_unlimited,
      questionsEnabled: record.questions_enabled,
      title: record.title,
      titleAr: record.title_ar,
      titleEn: record.title_en,
      slug: record.slug,
      description: record.description,
      descriptionAr: record.description_ar,
      descriptionEn: record.description_en,
      shortDescriptionAr: record.short_description_ar,
      shortDescriptionEn: record.short_description_en,
      detailedDescriptionAr: record.detailed_description_ar,
      detailedDescriptionEn: record.detailed_description_en,
      relatedProductIds,
      status: record.status,
      brand: record.brand,
      brandId: record.brand_id,
      weight: record.weight ? Number(record.weight) : null,
      weightUnit: record.weight_unit,
      dimensions: record.dimensions,
      costPrice: record.cost_price ? Number(record.cost_price) : null,
      productLabel: record.product_label,
      youtubeUrl: record.youtube_url,
      seoTitle: record.seo_title,
      seoDescription: record.seo_description,
      seoTitleAr: record.seo_title_ar,
      seoTitleEn: record.seo_title_en,
      seoDescriptionAr: record.seo_description_ar,
      seoDescriptionEn: record.seo_description_en,
      customFields: Array.isArray(record.custom_fields) ? record.custom_fields : [],
      inlineDiscount:
        record.inline_discount_active &&
        record.inline_discount_type &&
        record.inline_discount_value !== null
          ? {
              type: record.inline_discount_type,
              value: Number(record.inline_discount_value),
              startsAt: record.inline_discount_starts_at
                ? new Date(record.inline_discount_starts_at).toISOString()
                : null,
              endsAt: record.inline_discount_ends_at
                ? new Date(record.inline_discount_ends_at).toISOString()
                : null,
            }
          : null,
      digitalDownloadAttemptsLimit: record.digital_download_attempts_limit,
      digitalDownloadExpiresAt: record.digital_download_expires_at
        ? new Date(record.digital_download_expires_at).toISOString()
        : null,
      tags: record.tags,
      isFeatured: record.is_featured,
      isTaxable: record.is_taxable,
      taxRate: Number(record.tax_rate),
      minOrderQuantity: record.min_order_quantity,
      maxOrderQuantity: record.max_order_quantity,
      publishedAt: record.published_at,
      ratingAvg: Number(record.rating_avg),
      ratingCount: record.rating_count,
    };
  }

  private toBundleItemResponse(record: ProductBundleItemRecord): ProductBundleItemResponse {
    return {
      id: record.id,
      bundledProductId: record.bundled_product_id,
      bundledVariantId: record.bundled_variant_id,
      quantity: record.quantity,
      sortOrder: record.sort_order,
      bundledProductTitle: record.bundled_product_title,
      bundledVariantTitle: record.bundled_variant_title,
    };
  }

  private toDigitalFileResponse(record: ProductDigitalFileRecord): ProductDigitalFileResponse {
    return {
      id: record.id,
      mediaAssetId: record.media_asset_id,
      fileName: record.file_name,
      sortOrder: record.sort_order,
      url: record.public_url,
      fileSizeBytes: record.file_size_bytes,
    };
  }

  private toVariantResponse(
    record: ProductVariantRecord,
    attributeValueIds: string[],
    currencyOverrides: VariantCurrencyOverride[] = [],
  ): ProductVariantResponse {
    const priceYER = Number(record.price);
    const compareAtPriceYER = record.compare_at_price ? Number(record.compare_at_price) : null;
    return {
      id: record.id,
      productId: record.product_id,
      title: record.title,
      titleAr: record.title_ar,
      titleEn: record.title_en,
      sku: record.sku,
      barcode: record.barcode,
      price: priceYER,
      priceYER,
      compareAtPrice: compareAtPriceYER,
      compareAtPriceYER,
      currencyOverrides,
      stockQuantity: record.stock_quantity,
      lowStockThreshold: record.low_stock_threshold,
      attributes: record.attributes,
      attributeValueIds,
      isDefault: record.is_default,
    };
  }

  private normalizeAttributes(input: Record<string, string>): Record<string, string> {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(input)) {
      const normalizedKey = String(key).trim();
      const normalizedValue = String(value).trim();
      if (!normalizedKey || !normalizedValue) {
        continue;
      }

      normalized[normalizedKey] = normalizedValue;
    }

    return normalized;
  }

  private omitKeys(input: Record<string, string>, keys: string[]): Record<string, string> {
    const next = { ...input };
    for (const key of keys) {
      delete next[key];
    }
    return next;
  }

  private toImageResponse(record: ProductImageRecord): ProductImageResponse {
    return {
      id: record.id,
      productId: record.product_id,
      variantId: record.variant_id,
      mediaAssetId: record.media_asset_id,
      url: record.public_url,
      altText: record.alt_text,
      sortOrder: record.sort_order,
      isPrimary: record.is_primary,
    };
  }

  private normalizeExcelRow(row: Record<string, unknown>): Record<string, unknown> {
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[this.normalizeColumnKey(key)] = value;
    }
    return normalized;
  }

  private normalizeColumnKey(key: string): string {
    return key.trim().toLowerCase().replace(/\s+/g, '_');
  }

  private readStringCell(row: Record<string, unknown>, keys: string[]): string | undefined {
    for (const key of keys) {
      const raw = row[this.normalizeColumnKey(key)];
      if (raw === null || raw === undefined) {
        continue;
      }
      const value = String(raw).trim();
      if (value) {
        return value;
      }
    }
    return undefined;
  }

  private readStringListCell(row: Record<string, unknown>, keys: string[]): string[] {
    const raw = this.readStringCell(row, keys);
    if (!raw) {
      return [];
    }
    return raw
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  private readBooleanCell(row: Record<string, unknown>, keys: string[]): boolean | undefined {
    const raw = this.readStringCell(row, keys);
    if (!raw) {
      return undefined;
    }
    const normalized = raw.toLowerCase();
    if (['true', '1', 'yes'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no'].includes(normalized)) {
      return false;
    }
    throw new BadRequestException(`Invalid boolean value: ${raw}`);
  }

  private readNumberCell(row: Record<string, unknown>, keys: string[]): number | undefined {
    const raw = this.readStringCell(row, keys);
    if (!raw) {
      return undefined;
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      throw new BadRequestException(`Invalid number value: ${raw}`);
    }
    return value;
  }

  private readIntegerCell(row: Record<string, unknown>, keys: string[]): number | undefined {
    const value = this.readNumberCell(row, keys);
    if (value === undefined) {
      return undefined;
    }
    if (!Number.isInteger(value)) {
      throw new BadRequestException(`Expected integer value, received: ${value}`);
    }
    return value;
  }
}
