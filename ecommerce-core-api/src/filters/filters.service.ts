import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { slugify } from '../common/utils/slug.util';
import type { RequestContextData } from '../common/utils/request-context.util';
import { ProductsRepository } from '../products/products.repository';
import {
  FILTER_SOURCE_TYPES,
  FILTER_TYPES,
  type FilterSourceType,
  type FilterType,
} from './constants/filter-type.constants';
import type { CreateFilterDto } from './dto/create-filter.dto';
import type { CreateFilterValueDto } from './dto/create-filter-value.dto';
import type { ListFiltersQueryDto } from './dto/list-filters-query.dto';
import type { UpdateFilterDto } from './dto/update-filter.dto';
import type { UpdateFilterValueDto } from './dto/update-filter-value.dto';
import {
  FiltersRepository,
  type FilterRecord,
  type FilterValueRecord,
  type FilterValueWithFilterRecord,
  type ProductFilterRangeRecord,
} from './filters.repository';

export interface FilterValueResponse {
  id: string;
  storeId: string;
  filterId: string;
  valueAr: string;
  valueEn: string;
  slug: string;
  colorHex: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface FilterResponse {
  id: string;
  storeId: string;
  nameAr: string;
  nameEn: string;
  slug: string;
  type: FilterType;
  sortOrder: number;
  isActive: boolean;
  sourceType: FilterSourceType;
  sourceAttributeId: string | null;
  sourceKey: string | null;
  displayType: string | null;
  isSystem: boolean;
  values?: FilterValueResponse[];
}

export interface StorefrontSmartFilterValue {
  id: string;
  labelAr: string;
  labelEn: string;
  slug: string;
  colorHex?: string | null;
  count?: number;
}

export interface StorefrontSmartFilter {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  sourceType: FilterSourceType;
  type: FilterType;
  displayType: string | null;
  sourceAttributeId: string | null;
  values?: StorefrontSmartFilterValue[];
  min?: number;
  max?: number;
}

export interface ProductFilterSelectionsResponse {
  productId: string;
  valueIds: string[];
  values: Array<{
    id: string;
    filterId: string;
    filterSlug: string;
    filterType: FilterType;
    valueSlug: string;
  }>;
  ranges: Array<{
    filterId: string;
    filterSlug: string;
    numericValue: number;
  }>;
}

interface BrandSource {
  id: string;
  name_ar: string;
  name_en: string | null;
  slug?: string;
}

interface AttributeValueSource {
  id: string;
  value_ar: string | null;
  value_en: string | null;
  slug: string;
  color_hex: string | null;
}

interface WarehouseSource {
  id: string;
  name: string;
  name_ar: string | null;
  name_en: string | null;
  code: string;
}

@Injectable()
export class FiltersService {
  constructor(
    private readonly filtersRepository: FiltersRepository,
    private readonly productsRepository: ProductsRepository,
    private readonly auditService: AuditService,
  ) {}

  async createFilter(
    currentUser: AuthUser,
    input: CreateFilterDto,
    context: RequestContextData,
  ): Promise<FilterResponse> {
    const nameAr = input.nameAr.trim();
    const nameEn = input.nameEn.trim();
    this.assertName(nameAr, 'Filter Arabic name is invalid');
    this.assertName(nameEn, 'Filter English name is invalid');
    this.assertFilterType(input.type);

    const sourceType = input.sourceType ?? 'manual';
    this.assertSourceType(sourceType);
    await this.validateSmartFilterConstraints(
      currentUser.storeId,
      sourceType,
      input.sourceAttributeId,
    );

    if (sourceType === 'attribute' && !input.sourceAttributeId) {
      throw new BadRequestException('sourceAttributeId is required for attribute source type');
    }

    const slug = this.resolveSlug(input.slug, nameAr, 'Filter slug is invalid');
    await this.ensureFilterSlugAvailable(currentUser.storeId, slug);

    const created = await this.filtersRepository.createFilter({
      storeId: currentUser.storeId,
      nameAr,
      nameEn,
      slug,
      type: input.type,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
      sourceType,
      sourceAttributeId: input.sourceAttributeId ?? null,
      sourceKey: input.sourceKey ?? null,
      displayType: input.displayType ?? null,
      isSystem: input.isSystem ?? false,
    });

    await this.logAction('filters.created', currentUser, created.id, context);
    return this.toFilterResponse(created);
  }

  async listFilters(currentUser: AuthUser, query: ListFiltersQueryDto): Promise<FilterResponse[]> {
    const filters = await this.filtersRepository.listFilters(currentUser.storeId, {
      ...(query.q?.trim() ? { q: query.q.trim() } : {}),
      ...(query.onlyActive !== undefined ? { onlyActive: query.onlyActive } : {}),
    });
    const includeValues = query.includeValues ?? false;

    if (!includeValues || filters.length === 0) {
      return filters.map((filter) => this.toFilterResponse(filter));
    }

    const manualFilterIds = filters.filter((f) => f.source_type === 'manual').map((f) => f.id);

    const values =
      manualFilterIds.length > 0
        ? await this.filtersRepository.listFilterValuesByFilterIds(
            currentUser.storeId,
            manualFilterIds,
            Boolean(query.onlyActive),
          )
        : [];

    return this.mapFiltersWithValues(filters, values);
  }

  async getFilter(currentUser: AuthUser, filterId: string): Promise<FilterResponse> {
    const filter = await this.requireFilter(currentUser.storeId, filterId);
    const values =
      filter.source_type === 'manual'
        ? await this.filtersRepository.listFilterValues(currentUser.storeId, filterId)
        : [];
    return this.toFilterResponse(filter, values);
  }

  async updateFilter(
    currentUser: AuthUser,
    filterId: string,
    input: UpdateFilterDto,
    context: RequestContextData,
  ): Promise<FilterResponse> {
    const existing = await this.requireFilter(currentUser.storeId, filterId);
    const nameAr = input.nameAr?.trim() ?? existing.name_ar;
    const nameEn = input.nameEn?.trim() ?? existing.name_en;
    this.assertName(nameAr, 'Filter Arabic name is invalid');
    this.assertName(nameEn, 'Filter English name is invalid');

    const type = input.type ?? existing.type;
    this.assertFilterType(type);

    const sourceType = input.sourceType ?? existing.source_type;
    this.assertSourceType(sourceType);

    if (sourceType === 'attribute') {
      const attrId = input.sourceAttributeId ?? existing.source_attribute_id;
      if (!attrId) {
        throw new BadRequestException('sourceAttributeId is required for attribute source type');
      }
      if (sourceType !== existing.source_type || attrId !== existing.source_attribute_id) {
        await this.validateSmartFilterConstraints(
          currentUser.storeId,
          sourceType,
          attrId,
          filterId,
        );
      }
    } else if (sourceType !== existing.source_type) {
      await this.validateSmartFilterConstraints(currentUser.storeId, sourceType, null, filterId);
    }

    const slug = this.resolveSlug(input.slug, nameAr, 'Filter slug is invalid');
    if (slug !== existing.slug) {
      await this.ensureFilterSlugAvailable(currentUser.storeId, slug, filterId);
    }

    const updated = await this.filtersRepository.updateFilter({
      storeId: currentUser.storeId,
      filterId,
      nameAr,
      nameEn,
      slug,
      type,
      sortOrder: input.sortOrder ?? existing.sort_order,
      isActive: input.isActive ?? existing.is_active,
      sourceType,
      sourceAttributeId: input.sourceAttributeId ?? existing.source_attribute_id,
      sourceKey: input.sourceKey ?? existing.source_key,
      displayType: input.displayType ?? existing.display_type,
      isSystem: input.isSystem ?? existing.is_system,
    });

    if (!updated) {
      throw new NotFoundException('Filter not found');
    }

    await this.logAction('filters.updated', currentUser, filterId, context);
    const values =
      updated.source_type === 'manual'
        ? await this.filtersRepository.listFilterValues(currentUser.storeId, filterId)
        : [];
    return this.toFilterResponse(updated, values);
  }

  async deleteFilter(
    currentUser: AuthUser,
    filterId: string,
    context: RequestContextData,
  ): Promise<void> {
    await this.requireFilter(currentUser.storeId, filterId);
    await this.filtersRepository.deleteFilter(currentUser.storeId, filterId);
    await this.logAction('filters.deleted', currentUser, filterId, context);
  }

  async listFilterValues(currentUser: AuthUser, filterId: string): Promise<FilterValueResponse[]> {
    const filter = await this.requireFilter(currentUser.storeId, filterId);
    if (filter.source_type !== 'manual') {
      return [];
    }
    const values = await this.filtersRepository.listFilterValues(currentUser.storeId, filterId);
    return values.map((value) => this.toFilterValueResponse(value));
  }

  async createFilterValue(
    currentUser: AuthUser,
    filterId: string,
    input: CreateFilterValueDto,
    context: RequestContextData,
  ): Promise<FilterValueResponse> {
    const filter = await this.requireFilter(currentUser.storeId, filterId);

    if (filter.source_type !== 'manual') {
      throw new BadRequestException(
        'Cannot add manual values to a smart filter. Values come from the source automatically.',
      );
    }

    this.assertValueAllowedForFilter(filter.type);

    const valueAr = input.valueAr.trim();
    const valueEn = input.valueEn.trim();
    this.assertName(valueAr, 'Filter value Arabic text is invalid');
    this.assertName(valueEn, 'Filter value English text is invalid');

    const slug = this.resolveSlug(input.slug, valueEn || valueAr, 'Filter value slug is invalid');
    await this.ensureFilterValueSlugAvailable(currentUser.storeId, filterId, slug);
    const colorHex = this.resolveColorHex(filter.type, input.colorHex ?? null);

    const created = await this.filtersRepository.createFilterValue({
      storeId: currentUser.storeId,
      filterId,
      valueAr,
      valueEn,
      slug,
      colorHex,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
    });

    await this.logAction('filters.values.created', currentUser, created.id, context);
    return this.toFilterValueResponse(created);
  }

  async updateFilterValue(
    currentUser: AuthUser,
    filterId: string,
    valueId: string,
    input: UpdateFilterValueDto,
    context: RequestContextData,
  ): Promise<FilterValueResponse> {
    const filter = await this.requireFilter(currentUser.storeId, filterId);
    this.assertValueAllowedForFilter(filter.type);

    const existing = await this.requireFilterValue(currentUser.storeId, valueId);
    if (existing.filter_id !== filterId) {
      throw new BadRequestException('Filter value does not belong to provided filter');
    }

    const valueAr = input.valueAr?.trim() ?? existing.value_ar;
    const valueEn = input.valueEn?.trim() ?? existing.value_en;
    this.assertName(valueAr, 'Filter value Arabic text is invalid');
    this.assertName(valueEn, 'Filter value English text is invalid');
    const slug = this.resolveSlug(
      input.slug,
      valueEn || valueAr,
      'Filter value slug is invalid',
      existing.slug,
    );

    if (slug !== existing.slug) {
      await this.ensureFilterValueSlugAvailable(currentUser.storeId, filterId, slug, valueId);
    }

    const colorHex = this.resolveColorHex(filter.type, input.colorHex ?? existing.color_hex);
    const updated = await this.filtersRepository.updateFilterValue({
      storeId: currentUser.storeId,
      valueId,
      valueAr,
      valueEn,
      slug,
      colorHex,
      sortOrder: input.sortOrder ?? existing.sort_order,
      isActive: input.isActive ?? existing.is_active,
    });

    if (!updated) {
      throw new NotFoundException('Filter value not found');
    }

    await this.logAction('filters.values.updated', currentUser, valueId, context);
    return this.toFilterValueResponse(updated);
  }

  async deleteFilterValue(
    currentUser: AuthUser,
    filterId: string,
    valueId: string,
    context: RequestContextData,
  ): Promise<void> {
    await this.requireFilter(currentUser.storeId, filterId);
    const existing = await this.requireFilterValue(currentUser.storeId, valueId);
    if (existing.filter_id !== filterId) {
      throw new BadRequestException('Filter value does not belong to provided filter');
    }

    await this.filtersRepository.deleteFilterValue(currentUser.storeId, valueId);
    await this.logAction('filters.values.deleted', currentUser, valueId, context);
  }

  async getProductSelections(
    currentUser: AuthUser,
    productId: string,
  ): Promise<ProductFilterSelectionsResponse> {
    await this.requireProduct(currentUser.storeId, productId);
    return this.getProductSelectionsForStore(currentUser.storeId, productId);
  }

  async setProductSelections(
    currentUser: AuthUser,
    productId: string,
    input: {
      valueIds: string[];
      ranges: Array<{ filterId: string; numericValue: number }>;
    },
    context: RequestContextData,
  ): Promise<ProductFilterSelectionsResponse> {
    await this.requireProduct(currentUser.storeId, productId);
    const valueIds = this.uniqueIds(input.valueIds);
    const ranges = this.normalizeRanges(input.ranges);
    await this.validateSelections(currentUser.storeId, valueIds, ranges);

    await this.filtersRepository.replaceProductFilterSelections({
      storeId: currentUser.storeId,
      productId,
      valueIds,
      ranges,
    });

    await this.logAction('filters.products.updated', currentUser, productId, context);
    return this.getProductSelectionsForStore(currentUser.storeId, productId);
  }

  async listStorefrontFilters(
    storeId: string,
    onlyActive = true,
    categoryId?: string,
  ): Promise<StorefrontSmartFilter[]> {
    const filters = await this.filtersRepository.listFilters(storeId, { onlyActive });
    if (filters.length === 0) {
      return [];
    }

    const result: StorefrontSmartFilter[] = [];

    for (const filter of filters) {
      const smartFilter = await this.buildStorefrontFilter(storeId, filter, categoryId);
      if (smartFilter) {
        result.push(smartFilter);
      }
    }

    return result;
  }

  async getProductSelectionsForStore(
    storeId: string,
    productId: string,
  ): Promise<ProductFilterSelectionsResponse> {
    const [values, ranges] = await Promise.all([
      this.filtersRepository.listProductFilterValues(storeId, productId),
      this.filtersRepository.listProductFilterRanges(storeId, productId),
    ]);

    return {
      productId,
      valueIds: values.map((value) => value.id),
      values: values.map((value) => ({
        id: value.id,
        filterId: value.filter_id,
        filterSlug: value.filter_slug,
        filterType: value.filter_type,
        valueSlug: value.slug,
      })),
      ranges: ranges.map((range) => ({
        filterId: range.filter_id,
        filterSlug: range.filter_slug,
        numericValue: Number(range.numeric_value),
      })),
    };
  }

  private async buildStorefrontFilter(
    storeId: string,
    filter: FilterRecord,
    categoryId?: string,
  ): Promise<StorefrontSmartFilter | null> {
    const base: StorefrontSmartFilter = {
      id: filter.id,
      slug: filter.slug,
      nameAr: filter.name_ar,
      nameEn: filter.name_en,
      sourceType: filter.source_type as FilterSourceType,
      type: filter.type,
      displayType: filter.display_type,
      sourceAttributeId: filter.source_attribute_id,
    };

    switch (filter.source_type) {
      case 'brand':
        return this.buildBrandFilter(storeId, base);
      case 'attribute':
        return this.buildAttributeFilter(storeId, filter, base);
      case 'price':
        return this.buildPriceFilter(storeId, base, categoryId);
      case 'warehouse':
        return this.buildWarehouseFilter(storeId, base);
      case 'availability':
        return {
          ...base,
          values: [{ id: 'in-stock', labelAr: 'متوفر', labelEn: 'In Stock', slug: 'in-stock' }],
        };
      case 'manual':
      default:
        return this.buildManualFilter(storeId, filter.id, base);
    }
  }

  private async buildBrandFilter(
    storeId: string,
    base: StorefrontSmartFilter,
  ): Promise<StorefrontSmartFilter | null> {
    const brands = await this.queryBrands(storeId);
    if (brands.length === 0) return null;

    return {
      ...base,
      values: brands.map((brand) => ({
        id: brand.id,
        labelAr: brand.name_ar,
        labelEn: brand.name_en ?? brand.name_ar,
        slug: brand.slug ?? this.slugifyText(brand.name_ar),
      })),
    };
  }

  private async buildAttributeFilter(
    storeId: string,
    filter: FilterRecord,
    base: StorefrontSmartFilter,
  ): Promise<StorefrontSmartFilter | null> {
    if (!filter.source_attribute_id) return null;

    const values = await this.queryAttributeValues(storeId, filter.source_attribute_id);
    if (values.length === 0) return null;

    return {
      ...base,
      values: values.map((av) => ({
        id: av.id,
        labelAr: av.value_ar ?? av.slug,
        labelEn: av.value_en ?? av.slug,
        slug: av.slug,
        colorHex: av.color_hex,
      })),
    };
  }

  private async buildPriceFilter(
    storeId: string,
    base: StorefrontSmartFilter,
    categoryId?: string,
  ): Promise<StorefrontSmartFilter | null> {
    const priceRange = categoryId
      ? await this.filtersRepository.getStorePriceRangeForCategory(storeId, categoryId)
      : await this.filtersRepository.getStorePriceRange(storeId);

    if (!priceRange) return null;

    return {
      ...base,
      min: priceRange.min,
      max: priceRange.max,
    };
  }

  private async buildWarehouseFilter(
    storeId: string,
    base: StorefrontSmartFilter,
  ): Promise<StorefrontSmartFilter | null> {
    const warehouses = await this.queryWarehouses(storeId);
    if (warehouses.length === 0) return null;

    return {
      ...base,
      values: warehouses.map((wh) => ({
        id: wh.id,
        labelAr: wh.name_ar ?? wh.name,
        labelEn: wh.name_en ?? wh.name,
        slug: wh.code,
      })),
    };
  }

  private async buildManualFilter(
    storeId: string,
    filterId: string,
    base: StorefrontSmartFilter,
  ): Promise<StorefrontSmartFilter | null> {
    const values = await this.filtersRepository.listFilterValues(storeId, filterId);
    const activeValues = values.filter((v) => v.is_active);
    if (activeValues.length === 0 && base.type !== 'range') return null;

    return {
      ...base,
      values: activeValues.map((v) => ({
        id: v.id,
        labelAr: v.value_ar,
        labelEn: v.value_en,
        slug: v.slug,
        colorHex: v.color_hex,
      })),
    };
  }

  private async queryBrands(storeId: string): Promise<BrandSource[]> {
    const db = (
      this.filtersRepository as unknown as {
        databaseService: {
          db: { query: <T>(text: string, values?: unknown[]) => Promise<{ rows: T[] }> };
        };
      }
    ).databaseService;
    const result = await db.db.query<BrandSource>(
      `SELECT id, name_ar, name_en FROM brands WHERE store_id = $1 AND is_active = TRUE ORDER BY name_ar ASC`,
      [storeId],
    );
    return result.rows;
  }

  private async queryAttributeValues(
    storeId: string,
    attributeId: string,
  ): Promise<AttributeValueSource[]> {
    const db = (
      this.filtersRepository as unknown as {
        databaseService: {
          db: { query: <T>(text: string, values?: unknown[]) => Promise<{ rows: T[] }> };
        };
      }
    ).databaseService;
    const result = await db.db.query<AttributeValueSource>(
      `SELECT id, value_ar, value_en, slug, color_hex FROM attribute_values WHERE store_id = $1 AND attribute_id = $2 AND is_active = TRUE ORDER BY sort_order ASC, created_at ASC`,
      [storeId, attributeId],
    );
    return result.rows;
  }

  private async queryWarehouses(storeId: string): Promise<WarehouseSource[]> {
    const db = (
      this.filtersRepository as unknown as {
        databaseService: {
          db: { query: <T>(text: string, values?: unknown[]) => Promise<{ rows: T[] }> };
        };
      }
    ).databaseService;
    const result = await db.db.query<WarehouseSource>(
      `SELECT id, name, name_ar, name_en, code FROM warehouses WHERE store_id = $1 AND is_active = TRUE ORDER BY priority ASC, name ASC`,
      [storeId],
    );
    return result.rows;
  }

  private slugifyText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private async validateSmartFilterConstraints(
    storeId: string,
    sourceType: string,
    sourceAttributeId?: string | null,
    excludeFilterId?: string,
  ): Promise<void> {
    if (sourceType === 'manual') return;

    if (sourceType === 'attribute') {
      if (!sourceAttributeId) {
        throw new BadRequestException('sourceAttributeId is required for attribute filters');
      }
      const existing = await this.filtersRepository.findFilterBySourceAttributeId(
        storeId,
        sourceAttributeId,
      );
      if (existing && existing.id !== excludeFilterId) {
        throw new ConflictException('A filter for this attribute already exists');
      }
      return;
    }

    const existing = await this.filtersRepository.findFilterBySourceType(storeId, sourceType);
    if (existing && existing.id !== excludeFilterId) {
      const sourceLabels: Record<string, string> = {
        brand: 'Brand',
        price: 'Price',
        warehouse: 'Warehouse',
        availability: 'Availability',
      };
      throw new ConflictException(
        `A ${sourceLabels[sourceType] ?? sourceType} filter already exists for this store`,
      );
    }
  }

  private async validateSelections(
    storeId: string,
    valueIds: string[],
    ranges: Array<{ filterId: string; numericValue: number }>,
  ): Promise<void> {
    const values = await this.filtersRepository.listFilterValuesByIds(storeId, valueIds);
    if (values.length !== valueIds.length) {
      throw new BadRequestException('One or more valueIds are invalid for this store');
    }

    const filterIdsFromValues = new Set(values.map((value) => value.filter_id));
    const filterIdsFromRanges = new Set(ranges.map((range) => range.filterId));
    for (const filterId of filterIdsFromRanges) {
      if (filterIdsFromValues.has(filterId)) {
        throw new BadRequestException('Cannot assign range and value selections to same filter');
      }
    }

    const allFilterIds = [...new Set([...filterIdsFromValues, ...filterIdsFromRanges])];
    const filters = await this.filtersRepository.listFilters(storeId, {});
    const filtersMap = new Map(filters.map((filter) => [filter.id, filter]));

    for (const filterId of allFilterIds) {
      if (!filtersMap.has(filterId)) {
        throw new BadRequestException('One or more filters are invalid for this store');
      }
    }

    const valueCountsByFilter = new Map<string, number>();
    for (const value of values) {
      valueCountsByFilter.set(value.filter_id, (valueCountsByFilter.get(value.filter_id) ?? 0) + 1);
      if (!value.is_active) {
        throw new BadRequestException('Inactive filter value cannot be assigned to product');
      }
    }

    for (const [filterId, count] of valueCountsByFilter.entries()) {
      const filter = filtersMap.get(filterId) as FilterRecord;
      if (!filter.is_active) {
        throw new BadRequestException('Inactive filter cannot be assigned to product');
      }
      if (filter.source_type !== 'manual') {
        throw new BadRequestException(
          'Smart filter values cannot be manually assigned to products. They are derived from the source.',
        );
      }
      if (filter.type === 'range') {
        throw new BadRequestException('Range filters cannot use valueIds selections');
      }
      if (filter.type === 'radio' && count > 1) {
        throw new BadRequestException('Radio filter allows only one selected value');
      }
    }

    for (const range of ranges) {
      const filter = filtersMap.get(range.filterId) as FilterRecord;
      if (!filter.is_active) {
        throw new BadRequestException('Inactive filter cannot be assigned to product');
      }
      if (filter.source_type !== 'manual') {
        throw new BadRequestException(
          'Smart filter ranges cannot be manually assigned to products',
        );
      }
      if (filter.type !== 'range') {
        throw new BadRequestException('numeric range selection is allowed only for range filters');
      }
    }
  }

  private normalizeRanges(
    ranges: Array<{ filterId: string; numericValue: number }>,
  ): Array<{ filterId: string; numericValue: number }> {
    const normalized = new Map<string, number>();
    for (const item of ranges) {
      const value = Number(item.numericValue);
      if (!Number.isFinite(value) || value < 0) {
        throw new BadRequestException('Range numericValue must be a positive number');
      }
      normalized.set(item.filterId, value);
    }
    return [...normalized.entries()].map(([filterId, numericValue]) => ({
      filterId,
      numericValue,
    }));
  }

  private mapFiltersWithValues(
    filters: FilterRecord[],
    values: FilterValueRecord[],
  ): FilterResponse[] {
    const valuesByFilterId = new Map<string, FilterValueResponse[]>();
    for (const value of values) {
      const list = valuesByFilterId.get(value.filter_id) ?? [];
      list.push(this.toFilterValueResponse(value));
      valuesByFilterId.set(value.filter_id, list);
    }

    return filters.map((filter) =>
      this.toFilterResponse(
        filter,
        valuesByFilterId.get(filter.id)?.map((value) => ({
          id: value.id,
          store_id: value.storeId,
          filter_id: value.filterId,
          value_ar: value.valueAr,
          value_en: value.valueEn,
          slug: value.slug,
          color_hex: value.colorHex,
          sort_order: value.sortOrder,
          is_active: value.isActive,
        })) ?? [],
      ),
    );
  }

  private toFilterResponse(filter: FilterRecord, values: FilterValueRecord[] = []): FilterResponse {
    return {
      id: filter.id,
      storeId: filter.store_id,
      nameAr: filter.name_ar,
      nameEn: filter.name_en,
      slug: filter.slug,
      type: filter.type,
      sortOrder: filter.sort_order,
      isActive: filter.is_active,
      sourceType: filter.source_type,
      sourceAttributeId: filter.source_attribute_id,
      sourceKey: filter.source_key,
      displayType: filter.display_type,
      isSystem: filter.is_system,
      values: values.map((value) => this.toFilterValueResponse(value)),
    };
  }

  private toFilterValueResponse(value: FilterValueRecord): FilterValueResponse {
    return {
      id: value.id,
      storeId: value.store_id,
      filterId: value.filter_id,
      valueAr: value.value_ar,
      valueEn: value.value_en,
      slug: value.slug,
      colorHex: value.color_hex,
      sortOrder: value.sort_order,
      isActive: value.is_active,
    };
  }

  private async requireFilter(storeId: string, filterId: string): Promise<FilterRecord> {
    const filter = await this.filtersRepository.findFilterById(storeId, filterId);
    if (!filter) {
      throw new NotFoundException('Filter not found');
    }
    return filter;
  }

  private async requireFilterValue(storeId: string, valueId: string): Promise<FilterValueRecord> {
    const value = await this.filtersRepository.findFilterValueById(storeId, valueId);
    if (!value) {
      throw new NotFoundException('Filter value not found');
    }
    return value;
  }

  private async requireProduct(storeId: string, productId: string): Promise<void> {
    const product = await this.productsRepository.findById(storeId, productId);
    if (!product) {
      throw new NotFoundException('Product not found');
    }
  }

  private assertFilterType(type: string): void {
    if (!(FILTER_TYPES as readonly string[]).includes(type)) {
      throw new BadRequestException('Filter type is invalid');
    }
  }

  private assertSourceType(type: string): void {
    if (!(FILTER_SOURCE_TYPES as readonly string[]).includes(type)) {
      throw new BadRequestException('Filter source type is invalid');
    }
  }

  private assertValueAllowedForFilter(type: FilterType): void {
    if (type === 'range') {
      throw new BadRequestException('Range filters do not support static values');
    }
  }

  private resolveColorHex(type: FilterType, colorHex: string | null): string | null {
    const normalized = colorHex?.trim() ?? null;
    if (type === 'color') {
      if (!normalized) {
        throw new BadRequestException('Color filter values require colorHex');
      }
      return normalized.toUpperCase();
    }

    return null;
  }

  private resolveSlug(
    explicit: string | undefined,
    source: string,
    errorMessage: string,
    fallback?: string,
  ): string {
    const value = slugify(explicit ?? source ?? fallback ?? '');
    if (!value) {
      throw new BadRequestException(errorMessage);
    }

    return value;
  }

  private assertName(value: string, message: string): void {
    if (!value || value.trim().length === 0) {
      throw new BadRequestException(message);
    }
  }

  private async ensureFilterSlugAvailable(
    storeId: string,
    slug: string,
    exceptFilterId?: string,
  ): Promise<void> {
    const existing = await this.filtersRepository.findFilterBySlug(storeId, slug);
    if (!existing || existing.id === exceptFilterId) {
      return;
    }

    throw new ConflictException('Filter slug already in use');
  }

  private async ensureFilterValueSlugAvailable(
    storeId: string,
    filterId: string,
    slug: string,
    exceptValueId?: string,
  ): Promise<void> {
    const existing = await this.filtersRepository.findFilterValueBySlug(storeId, filterId, slug);
    if (!existing || existing.id === exceptValueId) {
      return;
    }

    throw new ConflictException('Filter value slug already in use for this filter');
  }

  private uniqueIds(ids: string[]): string[] {
    return [...new Set(ids.map((id) => id.trim()).filter((id) => id.length > 0))];
  }

  private async logAction(
    action: string,
    currentUser: AuthUser,
    targetId: string,
    context: RequestContextData,
  ): Promise<void> {
    await this.auditService.log({
      action,
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
      targetType: 'filter',
      targetId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: context.requestId ? { requestId: context.requestId } : {},
    });
  }
}
