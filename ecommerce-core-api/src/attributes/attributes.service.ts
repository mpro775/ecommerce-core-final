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
import { CategoriesRepository } from '../categories/categories.repository';
import type { CreateAttributeDto } from './dto/create-attribute.dto';
import type { CreateAttributeValueDto } from './dto/create-attribute-value.dto';
import type { ListAttributesQueryDto } from './dto/list-attributes-query.dto';
import type { ListAttributeValuesQueryDto } from './dto/list-attribute-values-query.dto';
import type { UpdateAttributeDto } from './dto/update-attribute.dto';
import type { UpdateAttributeValueDto } from './dto/update-attribute-value.dto';
import { ATTRIBUTE_TYPES, type AttributeType } from './constants/attribute-type.constants';
import {
  AttributesRepository,
  type AttributeRecord,
  type AttributeValueRecord,
  type AttributeValueWithAttributeRecord,
} from './attributes.repository';

export interface AttributeValueResponse {
  id: string;
  storeId: string;
  attributeId: string;
  value: string;
  valueAr: string | null;
  valueEn: string | null;
  colorHex: string | null;
  isActive: boolean;
  slug: string;
}

export interface AttributeResponse {
  id: string;
  storeId: string;
  name: string;
  nameAr: string | null;
  nameEn: string | null;
  type: AttributeType;
  descriptionAr: string | null;
  descriptionEn: string | null;
  isActive: boolean;
  slug: string;
  values?: AttributeValueResponse[];
}

export interface CategoryAttributesResponse {
  categoryId: string;
  attributeIds: string[];
}

export interface StorefrontFilterAttributeResponse {
  id: string;
  name: string;
  nameAr: string | null;
  nameEn: string | null;
  type: AttributeType;
  slug: string;
  values: Array<{
    id: string;
    value: string;
    valueAr: string | null;
    valueEn: string | null;
    colorHex: string | null;
    slug: string;
  }>;
}

export interface VariantAttributeAssignment {
  attributeId: string;
  attributeValueId: string;
}

export interface ResolvedVariantAttributes {
  attributeValueIds: string[];
  assignments: VariantAttributeAssignment[];
  attributesMap: Record<string, string>;
}

export interface VariantAttributeState {
  valueIds: string[];
  attributeSlugs: string[];
}

@Injectable()
export class AttributesService {
  constructor(
    private readonly attributesRepository: AttributesRepository,
    private readonly categoriesRepository: CategoriesRepository,
    private readonly auditService: AuditService,
  ) {}

  async createAttribute(
    currentUser: AuthUser,
    input: CreateAttributeDto,
    context: RequestContextData,
  ): Promise<AttributeResponse> {
    const primaryArabicName = this.resolvePrimaryArabicName(input.name, input.nameAr);
    const slug = this.resolveSlug(primaryArabicName, input.slug, 'Attribute slug is invalid');
    const type = this.resolveAttributeType(input.type);
    await this.ensureAttributeSlugAvailable(currentUser.storeId, slug);

    try {
      const created = await this.attributesRepository.createAttribute({
        storeId: currentUser.storeId,
        name: primaryArabicName,
        nameAr: primaryArabicName,
        nameEn: input.nameEn ?? null,
        type,
        descriptionAr: this.normalizeOptionalText(input.descriptionAr),
        descriptionEn: this.normalizeOptionalText(input.descriptionEn),
        isActive: input.isActive ?? true,
        slug,
      });

      await this.logAction('attributes.created', currentUser, created.id, context);
      return this.toAttributeResponse(created);
    } catch (error) {
      this.throwOnUniqueViolation(error, 'Attribute slug already in use');
      throw error;
    }
  }

  async listAttributes(
    currentUser: AuthUser,
    query: ListAttributesQueryDto,
  ): Promise<AttributeResponse[]> {
    const includeValues = query.includeValues ?? false;
    const onlyActive = query.onlyActive ?? false;
    if (!includeValues) {
      const attributes = await this.attributesRepository.listAttributes(
        currentUser.storeId,
        query.q?.trim(),
        onlyActive,
      );
      return attributes.map((item) => this.toAttributeResponse(item));
    }

    return this.listAttributesWithValues(currentUser.storeId, query.q?.trim(), onlyActive);
  }

  async getAttribute(currentUser: AuthUser, attributeId: string): Promise<AttributeResponse> {
    const attribute = await this.requireAttribute(currentUser.storeId, attributeId);
    const values = await this.attributesRepository.listAttributeValues(
      currentUser.storeId,
      attribute.id,
      undefined,
      false,
    );
    return this.toAttributeResponse(attribute, values);
  }

  async updateAttribute(
    currentUser: AuthUser,
    attributeId: string,
    input: UpdateAttributeDto,
    context: RequestContextData,
  ): Promise<AttributeResponse> {
    const existing = await this.requireAttribute(currentUser.storeId, attributeId);
    const name = this.resolvePrimaryArabicName(
      input.name ?? existing.name,
      input.nameAr ?? existing.name_ar,
    );
    const slug = this.resolveSlug(name, input.slug ?? existing.slug, 'Attribute slug is invalid');
    const type = this.resolveAttributeType(input.type ?? existing.type);

    if (slug !== existing.slug) {
      await this.ensureAttributeSlugAvailable(currentUser.storeId, slug, attributeId);
    }

    try {
      const updated = await this.attributesRepository.updateAttribute({
        storeId: currentUser.storeId,
        attributeId,
        name,
        nameAr: name,
        nameEn: input.nameEn ?? existing.name_en ?? null,
        type,
        descriptionAr:
          this.normalizeOptionalText(input.descriptionAr) ?? existing.description_ar ?? null,
        descriptionEn:
          this.normalizeOptionalText(input.descriptionEn) ?? existing.description_en ?? null,
        isActive: input.isActive ?? existing.is_active,
        slug,
      });

      if (!updated) {
        throw new NotFoundException('Attribute not found');
      }

      await this.logAction('attributes.updated', currentUser, attributeId, context);
      return this.toAttributeResponse(updated);
    } catch (error) {
      this.throwOnUniqueViolation(error, 'Attribute slug already in use');
      throw error;
    }
  }

  async deleteAttribute(
    currentUser: AuthUser,
    attributeId: string,
    context: RequestContextData,
  ): Promise<void> {
    await this.requireAttribute(currentUser.storeId, attributeId);
    await this.attributesRepository.deleteAttribute(currentUser.storeId, attributeId);
    await this.logAction('attributes.deleted', currentUser, attributeId, context);
  }

  async listAttributeValues(
    currentUser: AuthUser,
    attributeId: string,
    query: ListAttributeValuesQueryDto,
  ): Promise<AttributeValueResponse[]> {
    await this.requireAttribute(currentUser.storeId, attributeId);
    const values = await this.attributesRepository.listAttributeValues(
      currentUser.storeId,
      attributeId,
      query.q?.trim(),
      query.onlyActive ?? false,
    );

    return values.map((value) => this.toValueResponse(value));
  }

  async createAttributeValue(
    currentUser: AuthUser,
    attributeId: string,
    input: CreateAttributeValueDto,
    context: RequestContextData,
  ): Promise<AttributeValueResponse> {
    const attribute = await this.requireAttribute(currentUser.storeId, attributeId);
    const value = input.value.trim();
    const slug = this.resolveSlug(value, input.slug, 'Attribute value slug is invalid');
    await this.ensureAttributeValueSlugAvailable(currentUser.storeId, attributeId, slug);

    try {
      const createdValue = await this.attributesRepository.createAttributeValue({
        storeId: currentUser.storeId,
        attributeId,
        value,
        valueAr: input.valueAr ?? null,
        valueEn: input.valueEn ?? null,
        colorHex: this.resolveColorHex(attribute.type, input.colorHex ?? null),
        isActive: input.isActive ?? true,
        slug,
      });

      await this.logAction('attributes.values.created', currentUser, createdValue.id, context);
      return this.toValueResponse(createdValue);
    } catch (error) {
      this.throwOnUniqueViolation(error, 'Attribute value slug already in use for this attribute');
      throw error;
    }
  }

  async updateAttributeValue(
    currentUser: AuthUser,
    attributeId: string,
    valueId: string,
    input: UpdateAttributeValueDto,
    context: RequestContextData,
  ): Promise<AttributeValueResponse> {
    const attribute = await this.requireAttribute(currentUser.storeId, attributeId);
    const existing = await this.requireAttributeValue(currentUser.storeId, valueId);
    this.assertAttributeOwnership(attributeId, existing.attribute_id);

    const value = input.value?.trim() ?? existing.value;
    const slug = this.resolveSlug(
      value,
      input.slug ?? existing.slug,
      'Attribute value slug is invalid',
    );

    if (slug !== existing.slug) {
      await this.ensureAttributeValueSlugAvailable(currentUser.storeId, attributeId, slug, valueId);
    }

    try {
      const updated = await this.attributesRepository.updateAttributeValue({
        storeId: currentUser.storeId,
        valueId,
        value,
        valueAr: input.valueAr ?? existing.value_ar ?? null,
        valueEn: input.valueEn ?? existing.value_en ?? null,
        colorHex: this.resolveColorHex(
          attribute.type,
          input.colorHex ?? (attribute.type === 'color' ? existing.color_hex : null),
        ),
        isActive: input.isActive ?? existing.is_active,
        slug,
      });

      if (!updated) {
        throw new NotFoundException('Attribute value not found');
      }

      await this.logAction('attributes.values.updated', currentUser, valueId, context);
      return this.toValueResponse(updated);
    } catch (error) {
      this.throwOnUniqueViolation(error, 'Attribute value slug already in use for this attribute');
      throw error;
    }
  }

  async deleteAttributeValue(
    currentUser: AuthUser,
    attributeId: string,
    valueId: string,
    context: RequestContextData,
  ): Promise<void> {
    await this.requireAttribute(currentUser.storeId, attributeId);
    const existing = await this.requireAttributeValue(currentUser.storeId, valueId);
    this.assertAttributeOwnership(attributeId, existing.attribute_id);

    await this.attributesRepository.deleteAttributeValue(currentUser.storeId, valueId);
    await this.logAction('attributes.values.deleted', currentUser, valueId, context);
  }

  async getCategoryAttributes(
    currentUser: AuthUser,
    categoryId: string,
  ): Promise<CategoryAttributesResponse> {
    await this.requireCategory(currentUser.storeId, categoryId);
    const attributeIds = await this.attributesRepository.listCategoryAttributeIds(
      currentUser.storeId,
      categoryId,
    );

    return {
      categoryId,
      attributeIds,
    };
  }

  async setCategoryAttributes(
    currentUser: AuthUser,
    categoryId: string,
    attributeIds: string[],
    context: RequestContextData,
  ): Promise<CategoryAttributesResponse> {
    await this.requireCategory(currentUser.storeId, categoryId);
    const uniqueIds = this.uniqueIds(attributeIds);
    await this.assertAttributeIdsExist(currentUser.storeId, uniqueIds);

    await this.attributesRepository.replaceCategoryAttributeIds(
      currentUser.storeId,
      categoryId,
      uniqueIds,
    );
    await this.logAction('attributes.categories.updated', currentUser, categoryId, context);

    return {
      categoryId,
      attributeIds: uniqueIds,
    };
  }

  async listStorefrontFilterAttributes(
    storeId: string,
    categoryId?: string,
  ): Promise<StorefrontFilterAttributeResponse[]> {
    const attributeIds = await this.resolveFilterAttributeIds(storeId, categoryId ?? null);
    const attributes = await this.attributesRepository.listAttributesByIds(
      storeId,
      attributeIds,
      true,
    );
    if (attributes.length === 0) {
      return [];
    }

    const values = await this.attributesRepository.listAttributeValuesByAttributeIds(
      storeId,
      attributes.map((attribute) => attribute.id),
      true,
    );

    return this.toStorefrontFilters(attributes, values);
  }

  async resolveVariantAttributes(
    storeId: string,
    attributeValueIds: string[],
    categoryId: string | null,
  ): Promise<ResolvedVariantAttributes> {
    const uniqueValueIds = this.uniqueIds(attributeValueIds);
    if (uniqueValueIds.length === 0) {
      return {
        attributeValueIds: [],
        assignments: [],
        attributesMap: {},
      };
    }

    const orderedValues = await this.resolveOrderedValues(storeId, uniqueValueIds);
    this.assertResolvedValuesAreUsable(orderedValues);
    this.assertNoDuplicateAttributes(orderedValues);
    await this.assertCategoryScope(storeId, categoryId, orderedValues);

    return {
      attributeValueIds: orderedValues.map((value) => value.id),
      assignments: orderedValues.map((value) => ({
        attributeId: value.attribute_id,
        attributeValueId: value.id,
      })),
      attributesMap: orderedValues.reduce<Record<string, string>>((acc, value) => {
        acc[value.attribute_slug] = value.slug;
        return acc;
      }, {}),
    };
  }

  async replaceVariantAttributeValues(
    storeId: string,
    variantId: string,
    assignments: VariantAttributeAssignment[],
  ): Promise<void> {
    await this.attributesRepository.replaceVariantAttributeValues(storeId, variantId, assignments);
  }

  async listVariantAttributeState(
    storeId: string,
    variantIds: string[],
  ): Promise<Map<string, VariantAttributeState>> {
    const rows = await this.attributesRepository.listVariantAttributeSelections(
      storeId,
      variantIds,
    );
    const state = new Map<string, VariantAttributeState>();

    for (const row of rows) {
      const entry = state.get(row.variant_id) ?? { valueIds: [], attributeSlugs: [] };
      entry.valueIds.push(row.attribute_value_id);
      entry.attributeSlugs.push(row.attribute_slug);
      state.set(row.variant_id, entry);
    }

    return state;
  }

  private async requireCategory(storeId: string, categoryId: string): Promise<void> {
    const category = await this.categoriesRepository.findById(storeId, categoryId);
    if (!category) {
      throw new NotFoundException('Category not found');
    }
  }

  private async requireAttribute(storeId: string, attributeId: string): Promise<AttributeRecord> {
    const attribute = await this.attributesRepository.findAttributeById(storeId, attributeId);
    if (!attribute) {
      throw new NotFoundException('Attribute not found');
    }

    return attribute;
  }

  private async requireAttributeValue(
    storeId: string,
    valueId: string,
  ): Promise<AttributeValueRecord> {
    const value = await this.attributesRepository.findAttributeValueById(storeId, valueId);
    if (!value) {
      throw new NotFoundException('Attribute value not found');
    }

    return value;
  }

  private async ensureAttributeSlugAvailable(
    storeId: string,
    slug: string,
    exceptAttributeId?: string,
  ): Promise<void> {
    const existing = await this.attributesRepository.findAttributeBySlug(storeId, slug);
    if (!existing || existing.id === exceptAttributeId) {
      return;
    }

    throw new ConflictException('Attribute slug already in use');
  }

  private async ensureAttributeValueSlugAvailable(
    storeId: string,
    attributeId: string,
    slug: string,
    exceptValueId?: string,
  ): Promise<void> {
    const existing = await this.attributesRepository.findAttributeValueBySlug(
      storeId,
      attributeId,
      slug,
    );
    if (!existing || existing.id === exceptValueId) {
      return;
    }

    throw new ConflictException('Attribute value slug already in use for this attribute');
  }

  private async assertAttributeIdsExist(storeId: string, attributeIds: string[]): Promise<void> {
    if (attributeIds.length === 0) {
      return;
    }

    const attributes = await this.attributesRepository.listAttributesByIds(storeId, attributeIds);
    if (attributes.length !== attributeIds.length) {
      throw new BadRequestException('One or more attributeIds are invalid for this store');
    }
  }

  private async resolveFilterAttributeIds(
    storeId: string,
    categoryId: string | null,
  ): Promise<string[]> {
    if (categoryId) {
      const mapped = await this.attributesRepository.listCategoryAttributeIds(storeId, categoryId);
      if (mapped.length > 0) {
        return mapped;
      }
    }

    const all = await this.attributesRepository.listAttributes(storeId, undefined, true);
    return all.map((item) => item.id);
  }

  private toStorefrontFilters(
    attributes: AttributeRecord[],
    values: AttributeValueRecord[],
  ): StorefrontFilterAttributeResponse[] {
    const valuesByAttributeId = new Map<string, AttributeValueResponse[]>();

    for (const value of values) {
      const list = valuesByAttributeId.get(value.attribute_id) ?? [];
      list.push(this.toValueResponse(value));
      valuesByAttributeId.set(value.attribute_id, list);
    }

    return attributes
      .map((attribute) => ({
        id: attribute.id,
        name: attribute.name,
        nameAr: attribute.name_ar,
        nameEn: attribute.name_en,
        type: attribute.type,
        slug: attribute.slug,
        values:
          valuesByAttributeId.get(attribute.id)?.map((value) => ({
            id: value.id,
            value: value.value,
            valueAr: value.valueAr,
            valueEn: value.valueEn,
            colorHex: value.colorHex,
            slug: value.slug,
          })) ?? [],
      }))
      .filter((attribute) => attribute.values.length > 0);
  }

  private async resolveOrderedValues(
    storeId: string,
    valueIds: string[],
  ): Promise<AttributeValueWithAttributeRecord[]> {
    const records = await this.attributesRepository.listAttributeValuesByIds(storeId, valueIds);
    if (records.length !== valueIds.length) {
      throw new BadRequestException('One or more attributeValueIds are invalid for this store');
    }

    const recordsById = new Map(records.map((record) => [record.id, record]));
    return valueIds.map((id) => recordsById.get(id) as AttributeValueWithAttributeRecord);
  }

  private assertResolvedValuesAreUsable(values: AttributeValueWithAttributeRecord[]): void {
    for (const value of values) {
      if (!value.is_active) {
        throw new BadRequestException('Inactive attribute value cannot be selected');
      }

      if (!value.attribute_is_active) {
        throw new BadRequestException('Inactive attribute cannot be selected');
      }
    }
  }

  private assertNoDuplicateAttributes(values: AttributeValueWithAttributeRecord[]): void {
    const seen = new Set<string>();
    for (const value of values) {
      if (seen.has(value.attribute_id)) {
        throw new BadRequestException('Only one value per attribute can be selected');
      }
      seen.add(value.attribute_id);
    }
  }

  private async assertCategoryScope(
    storeId: string,
    categoryId: string | null,
    values: AttributeValueWithAttributeRecord[],
  ): Promise<void> {
    if (!categoryId || values.length === 0) {
      return;
    }

    const allowed = await this.attributesRepository.listCategoryAttributeIds(storeId, categoryId);
    if (allowed.length === 0) {
      return;
    }

    const allowedSet = new Set(allowed);
    for (const value of values) {
      if (!allowedSet.has(value.attribute_id)) {
        throw new BadRequestException(
          'Selected attribute value is not assigned to product category',
        );
      }
    }
  }

  private uniqueIds(ids: string[]): string[] {
    return [...new Set(ids.filter((id) => id.trim().length > 0))];
  }

  private resolveAttributeType(value: string): AttributeType {
    if (!(ATTRIBUTE_TYPES as readonly string[]).includes(value)) {
      throw new BadRequestException('Attribute type is invalid');
    }

    return value as AttributeType;
  }

  private normalizeOptionalText(value?: string | null): string | null {
    const normalized = value?.trim();
    return normalized && normalized.length > 0 ? normalized : null;
  }

  private resolveColorHex(type: AttributeType, colorHex: string | null): string | null {
    const normalized = colorHex?.trim() ?? null;
    if (type === 'color') {
      if (!normalized) {
        throw new BadRequestException('Color attribute values require colorHex');
      }

      return normalized.toUpperCase();
    }

    if (normalized) {
      throw new BadRequestException('colorHex is allowed only for color attributes');
    }

    return null;
  }

  private resolveSlug(source: string, explicit: string | undefined, errorMessage: string): string {
    const value = slugify(explicit ?? source);
    if (!value) {
      throw new BadRequestException(errorMessage);
    }

    return value;
  }

  private resolvePrimaryArabicName(baseName: string, arabicName?: string | null): string {
    const normalizedArabicName = arabicName?.trim();
    if (normalizedArabicName) {
      return normalizedArabicName;
    }

    const normalizedBaseName = baseName.trim();
    if (!normalizedBaseName) {
      throw new BadRequestException('Attribute name is invalid');
    }

    return normalizedBaseName;
  }

  private assertAttributeOwnership(expectedAttributeId: string, actualAttributeId: string): void {
    if (expectedAttributeId !== actualAttributeId) {
      throw new BadRequestException('Attribute value does not belong to provided attribute');
    }
  }

  private throwOnUniqueViolation(error: unknown, message: string): void {
    if (!(error instanceof Error)) {
      return;
    }

    const dbError = error as Error & { code?: string };
    if (dbError.code === '23505') {
      throw new ConflictException(message);
    }
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
      targetType: 'attribute',
      targetId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: context.requestId ? { requestId: context.requestId } : {},
    });
  }

  private toAttributeResponse(
    attribute: AttributeRecord,
    values: AttributeValueRecord[] = [],
  ): AttributeResponse {
    return {
      id: attribute.id,
      storeId: attribute.store_id,
      name: attribute.name,
      nameAr: attribute.name_ar ?? null,
      nameEn: attribute.name_en ?? null,
      type: attribute.type,
      descriptionAr: attribute.description_ar ?? null,
      descriptionEn: attribute.description_en ?? null,
      isActive: attribute.is_active,
      slug: attribute.slug,
      ...(values.length > 0 ? { values: values.map((value) => this.toValueResponse(value)) } : {}),
    };
  }

  private toValueResponse(value: AttributeValueRecord): AttributeValueResponse {
    return {
      id: value.id,
      storeId: value.store_id,
      attributeId: value.attribute_id,
      value: value.value,
      valueAr: value.value_ar ?? null,
      valueEn: value.value_en ?? null,
      colorHex: value.color_hex ?? null,
      isActive: value.is_active,
      slug: value.slug,
    };
  }

  private async listAttributesWithValues(
    storeId: string,
    q?: string,
    onlyActive = false,
  ): Promise<AttributeResponse[]> {
    const attributes = await this.attributesRepository.listAttributes(storeId, q, onlyActive);
    if (attributes.length === 0) {
      return [];
    }

    const values = await this.attributesRepository.listAttributeValuesByAttributeIds(
      storeId,
      attributes.map((attribute) => attribute.id),
      onlyActive,
    );

    const valuesByAttribute = new Map<string, AttributeValueRecord[]>();
    for (const value of values) {
      const list = valuesByAttribute.get(value.attribute_id) ?? [];
      list.push(value);
      valuesByAttribute.set(value.attribute_id, list);
    }

    return attributes.map((attribute) =>
      this.toAttributeResponse(attribute, valuesByAttribute.get(attribute.id) ?? []),
    );
  }
}
