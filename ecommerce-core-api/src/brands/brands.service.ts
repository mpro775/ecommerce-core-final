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
import { BrandsRepository, type BrandRecord } from './brands.repository';
import type { CreateBrandDto } from './dto/create-brand.dto';
import type { ListBrandsQueryDto } from './dto/list-brands-query.dto';
import type { UpdateBrandDto } from './dto/update-brand.dto';

export interface BrandResponse {
  id: string;
  storeId: string;
  name: string;
  nameAr: string;
  nameEn: string | null;
  mediaAssetId: string | null;
  imageUrl: string | null;
  isActive: boolean;
  isPopular: boolean;
}

@Injectable()
export class BrandsService {
  constructor(
    private readonly brandsRepository: BrandsRepository,
    private readonly auditService: AuditService,
  ) {}

  async create(
    currentUser: AuthUser,
    input: CreateBrandDto,
    context: RequestContextData,
  ): Promise<BrandResponse> {
    const primaryArabicName = this.resolvePrimaryArabicName(input.name, input.nameAr);
    await this.ensureNameAvailable(currentUser.storeId, primaryArabicName);
    await this.validateMediaAsset(currentUser.storeId, input.mediaAssetId ?? null);

    const brand = await this.brandsRepository.create({
      id: uuidv4(),
      storeId: currentUser.storeId,
      name: primaryArabicName,
      nameAr: primaryArabicName,
      nameEn: input.nameEn?.trim() ?? null,
      mediaAssetId: input.mediaAssetId ?? null,
      isActive: input.isActive ?? true,
      isPopular: input.isPopular ?? false,
    });

    await this.logBrandAction('brands.created', currentUser, brand.id, context);
    return this.toResponse(brand);
  }

  async list(currentUser: AuthUser, query: ListBrandsQueryDto): Promise<BrandResponse[]> {
    const rows = await this.brandsRepository.list({
      storeId: currentUser.storeId,
      ...(query.q?.trim() ? { q: query.q.trim() } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    });

    return rows.map((row) => this.toResponse(row));
  }

  async getById(currentUser: AuthUser, brandId: string): Promise<BrandResponse> {
    const brand = await this.brandsRepository.findById(currentUser.storeId, brandId);
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    return this.toResponse(brand);
  }

  async update(
    currentUser: AuthUser,
    brandId: string,
    input: UpdateBrandDto,
    context: RequestContextData,
  ): Promise<BrandResponse> {
    const existing = await this.brandsRepository.findById(currentUser.storeId, brandId);
    if (!existing) {
      throw new NotFoundException('Brand not found');
    }

    const primaryArabicName = this.resolvePrimaryArabicName(
      input.name ?? existing.name,
      input.nameAr ?? existing.name_ar,
    );

    if (primaryArabicName.toLowerCase() !== existing.name_ar.toLowerCase()) {
      await this.ensureNameAvailable(currentUser.storeId, primaryArabicName, brandId);
    }

    const mediaAssetId =
      input.mediaAssetId !== undefined ? (input.mediaAssetId ?? null) : existing.media_asset_id;
    await this.validateMediaAsset(currentUser.storeId, mediaAssetId);

    const updated = await this.brandsRepository.update({
      storeId: currentUser.storeId,
      brandId,
      name: primaryArabicName,
      nameAr: primaryArabicName,
      nameEn: input.nameEn?.trim() ?? existing.name_en,
      mediaAssetId,
      isActive: input.isActive ?? existing.is_active,
      isPopular: input.isPopular ?? existing.is_popular,
    });

    if (!updated) {
      throw new NotFoundException('Brand not found');
    }

    await this.logBrandAction('brands.updated', currentUser, brandId, context);
    return this.toResponse(updated);
  }

  async delete(currentUser: AuthUser, brandId: string, context: RequestContextData): Promise<void> {
    const existing = await this.brandsRepository.findById(currentUser.storeId, brandId);
    if (!existing) {
      throw new NotFoundException('Brand not found');
    }

    await this.brandsRepository.delete(currentUser.storeId, brandId);
    await this.logBrandAction('brands.deleted', currentUser, brandId, context);
  }

  private async ensureNameAvailable(
    storeId: string,
    nameAr: string,
    exceptBrandId?: string,
  ): Promise<void> {
    const existing = await this.brandsRepository.findByNameAr(storeId, nameAr);
    if (!existing || existing.id === exceptBrandId) {
      return;
    }

    throw new ConflictException('Brand name already in use');
  }

  private resolvePrimaryArabicName(baseName: string, arabicName?: string | null): string {
    const normalizedArabicName = arabicName?.trim();
    if (normalizedArabicName) {
      return normalizedArabicName;
    }

    const normalizedBaseName = baseName.trim();
    if (!normalizedBaseName) {
      throw new BadRequestException('Brand name is invalid');
    }

    return normalizedBaseName;
  }

  private async validateMediaAsset(storeId: string, mediaAssetId: string | null): Promise<void> {
    if (!mediaAssetId) {
      return;
    }

    const media = await this.brandsRepository.findMediaAssetById(storeId, mediaAssetId);
    if (!media) {
      throw new BadRequestException('Media asset not found in this store');
    }
  }

  private async logBrandAction(
    action: string,
    currentUser: AuthUser,
    brandId: string,
    context: RequestContextData,
  ): Promise<void> {
    await this.auditService.log({
      action,
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
      targetType: 'brand',
      targetId: brandId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: context.requestId ? { requestId: context.requestId } : {},
    });
  }

  private toResponse(record: BrandRecord): BrandResponse {
    return {
      id: record.id,
      storeId: record.store_id,
      name: record.name,
      nameAr: record.name_ar,
      nameEn: record.name_en,
      mediaAssetId: record.media_asset_id,
      imageUrl: record.image_url,
      isActive: record.is_active,
      isPopular: record.is_popular,
    };
  }
}
