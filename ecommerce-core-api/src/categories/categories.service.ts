import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import type { RequestContextData } from '../common/utils/request-context.util';
import { slugify } from '../common/utils/slug.util';
import { CategoriesRepository, type CategoryRecord } from './categories.repository';
import type { CreateCategoryDto } from './dto/create-category.dto';
import type { ListCategoriesQueryDto } from './dto/list-categories-query.dto';
import type { UpdateCategoryDto } from './dto/update-category.dto';

export interface CategoryResponse {
  id: string;
  storeId: string;
  parentId: string | null;
  name: string;
  nameAr: string | null;
  nameEn: string | null;
  slug: string;
  description: string | null;
  descriptionAr: string | null;
  descriptionEn: string | null;
  mediaAssetId: string | null;
  imageUrl: string | null;
  imageAltAr: string | null;
  imageAltEn: string | null;
  backgroundMediaAssetId: string | null;
  backgroundImageUrl: string | null;
  seoTitleAr: string | null;
  seoTitleEn: string | null;
  seoDescriptionAr: string | null;
  seoDescriptionEn: string | null;
  sortOrder: number;
  isActive: boolean;
}

@Injectable()
export class CategoriesService {
  constructor(
    private readonly categoriesRepository: CategoriesRepository,
    private readonly auditService: AuditService,
  ) {}

  async create(
    currentUser: AuthUser,
    input: CreateCategoryDto,
    context: RequestContextData,
  ): Promise<CategoryResponse> {
    const primaryArabicName = this.resolvePrimaryArabicName(input.name, input.nameAr);
    const slug = this.resolveSlug(primaryArabicName, input.slug);
    await this.ensureSlugAvailable(currentUser.storeId, slug);
    await this.validateParentCategory(currentUser.storeId, input.parentId ?? null);
    await this.validateMediaAsset(currentUser.storeId, input.mediaAssetId ?? null);
    await this.validateMediaAsset(currentUser.storeId, input.backgroundMediaAssetId ?? null);

    const category = await this.categoriesRepository.create({
      id: uuidv4(),
      storeId: currentUser.storeId,
      parentId: input.parentId ?? null,
      name: primaryArabicName,
      nameAr: primaryArabicName,
      nameEn: input.nameEn?.trim() ?? null,
      slug,
      description: input.description?.trim() ?? null,
      descriptionAr: input.descriptionAr?.trim() ?? null,
      descriptionEn: input.descriptionEn?.trim() ?? null,
      mediaAssetId: input.mediaAssetId ?? null,
      imageAltAr: input.imageAltAr?.trim() ?? null,
      imageAltEn: input.imageAltEn?.trim() ?? null,
      backgroundMediaAssetId: input.backgroundMediaAssetId ?? null,
      seoTitleAr: input.seoTitleAr?.trim() ?? null,
      seoTitleEn: input.seoTitleEn?.trim() ?? null,
      seoDescriptionAr: input.seoDescriptionAr?.trim() ?? null,
      seoDescriptionEn: input.seoDescriptionEn?.trim() ?? null,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
    });

    await this.logCategoryAction('categories.created', currentUser, category.id, context);
    return this.toResponse(category);
  }

  async list(currentUser: AuthUser, query: ListCategoriesQueryDto): Promise<CategoryResponse[]> {
    const records = await this.categoriesRepository.list(currentUser.storeId, {
      q: query.q?.trim(),
      parentId: query.parentId,
    });
    return records.map((record) => this.toResponse(record));
  }

  async getById(currentUser: AuthUser, categoryId: string): Promise<CategoryResponse> {
    const category = await this.categoriesRepository.findById(currentUser.storeId, categoryId);
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return this.toResponse(category);
  }

  async update(
    currentUser: AuthUser,
    categoryId: string,
    input: UpdateCategoryDto,
    context: RequestContextData,
  ): Promise<CategoryResponse> {
    const existing = await this.categoriesRepository.findById(currentUser.storeId, categoryId);
    if (!existing) {
      throw new NotFoundException('Category not found');
    }

    const nextSlug = await this.resolveUpdatedSlug(
      currentUser.storeId,
      categoryId,
      existing,
      input,
    );
    const parentId = await this.resolveUpdatedParentId(
      currentUser.storeId,
      categoryId,
      existing,
      input,
    );
    const mediaAssetId =
      input.mediaAssetId !== undefined ? (input.mediaAssetId ?? null) : existing.media_asset_id;
    const backgroundMediaAssetId =
      input.backgroundMediaAssetId !== undefined
        ? (input.backgroundMediaAssetId ?? null)
        : existing.background_media_asset_id;
    await this.validateMediaAsset(currentUser.storeId, mediaAssetId);
    await this.validateMediaAsset(currentUser.storeId, backgroundMediaAssetId);

    const updated = await this.categoriesRepository.update(
      this.buildUpdatePayload(
        currentUser.storeId,
        categoryId,
        existing,
        input,
        nextSlug,
        parentId,
        mediaAssetId,
        backgroundMediaAssetId,
      ),
    );

    if (!updated) {
      throw new NotFoundException('Category not found');
    }

    await this.logCategoryAction('categories.updated', currentUser, categoryId, context);
    return this.toResponse(updated);
  }

  private async resolveUpdatedSlug(
    storeId: string,
    categoryId: string,
    existing: CategoryRecord,
    input: UpdateCategoryDto,
  ): Promise<string> {
    if (!input.slug && !input.name && !input.nameAr) {
      return existing.slug;
    }

    const nextNameForSlug = this.resolvePrimaryArabicName(
      input.name ?? existing.name,
      input.nameAr ?? existing.name_ar,
    );
    const nextSlug = this.resolveSlug(nextNameForSlug, input.slug);
    if (nextSlug !== existing.slug) {
      await this.ensureSlugAvailable(storeId, nextSlug, categoryId);
    }

    return nextSlug;
  }

  private async resolveUpdatedParentId(
    storeId: string,
    categoryId: string,
    existing: CategoryRecord,
    input: UpdateCategoryDto,
  ): Promise<string | null> {
    const parentId = input.parentId ?? existing.parent_id;
    this.assertNoSelfParent(categoryId, parentId);
    await this.validateParentCategory(storeId, parentId);
    return parentId;
  }

  private buildUpdatePayload(
    storeId: string,
    categoryId: string,
    existing: CategoryRecord,
    input: UpdateCategoryDto,
    nextSlug: string,
    parentId: string | null,
    mediaAssetId: string | null,
    backgroundMediaAssetId: string | null,
  ) {
    const primaryArabicName = this.resolvePrimaryArabicName(
      input.name ?? existing.name,
      input.nameAr ?? existing.name_ar,
    );

    return {
      storeId,
      categoryId,
      parentId,
      name: primaryArabicName,
      nameAr: primaryArabicName,
      nameEn: input.nameEn?.trim() ?? existing.name_en,
      slug: nextSlug,
      description: input.description?.trim() ?? existing.description,
      descriptionAr: input.descriptionAr?.trim() ?? existing.description_ar,
      descriptionEn: input.descriptionEn?.trim() ?? existing.description_en,
      mediaAssetId,
      imageAltAr: input.imageAltAr?.trim() ?? existing.image_alt_ar,
      imageAltEn: input.imageAltEn?.trim() ?? existing.image_alt_en,
      backgroundMediaAssetId,
      seoTitleAr: input.seoTitleAr?.trim() ?? existing.seo_title_ar,
      seoTitleEn: input.seoTitleEn?.trim() ?? existing.seo_title_en,
      seoDescriptionAr: input.seoDescriptionAr?.trim() ?? existing.seo_description_ar,
      seoDescriptionEn: input.seoDescriptionEn?.trim() ?? existing.seo_description_en,
      sortOrder: input.sortOrder ?? existing.sort_order,
      isActive: input.isActive ?? existing.is_active,
    };
  }

  async delete(
    currentUser: AuthUser,
    categoryId: string,
    context: RequestContextData,
  ): Promise<void> {
    const existing = await this.categoriesRepository.findById(currentUser.storeId, categoryId);
    if (!existing) {
      throw new NotFoundException('Category not found');
    }

    const [hasChildren, hasProducts] = await Promise.all([
      this.categoriesRepository.hasChildren(currentUser.storeId, categoryId),
      this.categoriesRepository.hasProducts(currentUser.storeId, categoryId),
    ]);

    if (hasChildren || hasProducts) {
      throw new BadRequestException(
        'Category cannot be deleted while linked to children or products',
      );
    }

    await this.categoriesRepository.delete(currentUser.storeId, categoryId);
    await this.logCategoryAction('categories.deleted', currentUser, categoryId, context);
  }

  private async ensureSlugAvailable(
    storeId: string,
    slug: string,
    exceptCategoryId?: string,
  ): Promise<void> {
    const existing = await this.categoriesRepository.findBySlug(storeId, slug);
    if (!existing || existing.id === exceptCategoryId) {
      return;
    }
    throw new ConflictException('Category slug already in use');
  }

  private resolveSlug(name: string, slug?: string): string {
    const value = slug ? slugify(slug) : slugify(name);
    if (!value) {
      throw new BadRequestException('Category slug is invalid');
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
      throw new BadRequestException('Category name is invalid');
    }

    return normalizedBaseName;
  }

  private assertNoSelfParent(categoryId: string, parentId: string | null): void {
    if (parentId && parentId === categoryId) {
      throw new BadRequestException('Category cannot be parent of itself');
    }
  }

  private async validateParentCategory(storeId: string, parentId: string | null): Promise<void> {
    if (!parentId) {
      return;
    }

    const parent = await this.categoriesRepository.findById(storeId, parentId);
    if (!parent) {
      throw new BadRequestException('Parent category does not exist in this store');
    }
  }

  private async validateMediaAsset(storeId: string, mediaAssetId: string | null): Promise<void> {
    if (!mediaAssetId) {
      return;
    }

    const media = await this.categoriesRepository.findMediaAssetById(storeId, mediaAssetId);
    if (!media) {
      throw new BadRequestException('Media asset not found in this store');
    }
  }

  private async logCategoryAction(
    action: string,
    currentUser: AuthUser,
    categoryId: string,
    context: RequestContextData,
  ): Promise<void> {
    await this.auditService.log({
      action,
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
      targetType: 'category',
      targetId: categoryId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: context.requestId ? { requestId: context.requestId } : {},
    });
  }

  private toResponse(record: CategoryRecord): CategoryResponse {
    return {
      id: record.id,
      storeId: record.store_id,
      parentId: record.parent_id,
      name: record.name,
      nameAr: record.name_ar,
      nameEn: record.name_en,
      slug: record.slug,
      description: record.description,
      descriptionAr: record.description_ar,
      descriptionEn: record.description_en,
      mediaAssetId: record.media_asset_id,
      imageUrl: record.image_url,
      imageAltAr: record.image_alt_ar,
      imageAltEn: record.image_alt_en,
      backgroundMediaAssetId: record.background_media_asset_id,
      backgroundImageUrl: record.background_image_url,
      seoTitleAr: record.seo_title_ar,
      seoTitleEn: record.seo_title_en,
      seoDescriptionAr: record.seo_description_ar,
      seoDescriptionEn: record.seo_description_en,
      sortOrder: record.sort_order,
      isActive: record.is_active,
    };
  }
}
