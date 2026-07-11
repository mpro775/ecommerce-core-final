import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import type { RequestContextData } from '../common/utils/request-context.util';
import { OutboxService } from '../messaging/outbox.service';
import { StoreCapabilitiesService } from '../store-capabilities/store-capabilities.service';
import { ALLOWED_UPLOAD_MIME_TYPES, MAX_UPLOAD_BYTES } from './media.constants';
import type { ConfirmMediaUploadDto } from './dto/confirm-media-upload.dto';
import type { PresignMediaUploadDto } from './dto/presign-media-upload.dto';
import type { UpdateMediaAltTextDto } from './dto/update-media-alt-text.dto';
import { MediaRepository, type MediaAssetRecord } from './media.repository';
import { STORAGE_ADAPTER, type StorageAdapter } from './storage.adapter';
import type {
  StorefrontConfirmReceiptDto,
  StorefrontPresignReceiptDto,
} from '../payment-methods/dto/storefront-payment-receipt.dto';

export interface PresignedMediaUploadResponse {
  objectKey: string;
  uploadUrl: string;
  uploadHeaders: Record<string, string>;
  expiresAt: Date;
  maxFileSizeBytes: number;
}

export interface MediaAssetResponse {
  id: string;
  storeId: string;
  bucketName: string | null;
  objectKey: string;
  url: string;
  etag: string | null;
  mimeType: string;
  fileSizeBytes: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  downloadUrl?: string;
  downloadUrlExpiresAt?: Date;
}

export interface AltTextCoverageResponse {
  totalImages: number;
  imagesWithAlt: number;
  withAltText: number;
  decorativeImages: number;
  decorative: number;
  missingAltImages: number;
  missingAltText: number;
  completionPercentage: number;
  completionRate: number;
}

interface ConfirmedStorageObject {
  mimeType: string;
  fileSizeBytes: number;
  etag: string | null;
}

@Injectable()
export class MediaService {
  constructor(
    private readonly mediaRepository: MediaRepository,
    private readonly outboxService: OutboxService,
    private readonly auditService: AuditService,
    @Inject(STORAGE_ADAPTER) private readonly storageAdapter: StorageAdapter,
    private readonly storeCapabilitiesService: StoreCapabilitiesService,
  ) {}

  async createPresignedUpload(
    currentUser: AuthUser,
    input: PresignMediaUploadDto,
  ): Promise<PresignedMediaUploadResponse> {
    this.validateMimeType(input.contentType);
    this.validateFileSize(input.fileSizeBytes);
    const objectKey = this.buildObjectKey(
      currentUser.storeId,
      input.fileName ?? '',
      input.contentType,
    );

    const upload = await this.storageAdapter.getPresignedPutUrl({
      key: objectKey,
      contentType: input.contentType,
    });

    return {
      objectKey,
      uploadUrl: upload.url,
      uploadHeaders: upload.headers,
      expiresAt: upload.expiresAt,
      maxFileSizeBytes: MAX_UPLOAD_BYTES,
    };
  }

  async confirmUpload(
    currentUser: AuthUser,
    input: ConfirmMediaUploadDto,
    context: RequestContextData,
  ): Promise<MediaAssetResponse> {
    this.assertObjectKeyOwnership(currentUser.storeId, input.objectKey);

    const existing = await this.mediaRepository.findByObjectKey(
      currentUser.storeId,
      input.objectKey,
    );
    if (existing) {
      return this.toResponse(existing);
    }

    const confirmedObject = await this.confirmStorageObject(input);
    await this.assertStorageLimit(currentUser.storeId, confirmedObject.fileSizeBytes);

    const asset = await this.createMediaAsset(currentUser, input, confirmedObject);
    await this.enqueueMediaUploadedEvent(asset, context);
    await this.logMediaUploadedAudit(currentUser, asset.id, context);

    return this.toResponse(asset);
  }

  async getById(currentUser: AuthUser, mediaAssetId: string): Promise<MediaAssetResponse> {
    const asset = await this.mediaRepository.findById(currentUser.storeId, mediaAssetId);
    if (!asset) {
      throw new NotFoundException('Media asset not found');
    }

    const download = await this.storageAdapter.getPresignedGetUrl({
      key: asset.object_key,
    });

    return this.toResponse(asset, {
      downloadUrl: download.url,
      downloadUrlExpiresAt: download.expiresAt,
    });
  }

  async createStorefrontReceiptPresignedUpload(
    storeId: string,
    input: StorefrontPresignReceiptDto,
  ): Promise<PresignedMediaUploadResponse> {
    if (!input.contentType.startsWith('image/')) {
      throw new BadRequestException('يجب أن يكون الإيصال صورة.');
    }
    this.validateMimeType(input.contentType);
    this.validateFileSize(input.fileSizeBytes);
    const objectKey = this.buildObjectKey(
      storeId,
      input.fileName,
      input.contentType,
      'payment-receipts',
    );
    const upload = await this.storageAdapter.getPresignedPutUrl({
      key: objectKey,
      contentType: input.contentType,
    });
    return {
      objectKey,
      uploadUrl: upload.url,
      uploadHeaders: upload.headers,
      expiresAt: upload.expiresAt,
      maxFileSizeBytes: MAX_UPLOAD_BYTES,
    };
  }

  async confirmStorefrontReceiptUpload(
    storeId: string,
    input: StorefrontConfirmReceiptDto,
    context: RequestContextData,
  ): Promise<MediaAssetResponse> {
    this.assertObjectKeyOwnership(storeId, input.objectKey);
    if (!input.objectKey.includes('/payment-receipts/')) {
      throw new BadRequestException('Invalid payment receipt object key');
    }

    const existing = await this.mediaRepository.findByObjectKey(storeId, input.objectKey);
    if (existing) {
      return this.toResponse(existing);
    }

    const confirmedObject = await this.confirmStorageObject(input);
    if (!confirmedObject.mimeType.startsWith('image/')) {
      throw new BadRequestException('يجب أن يكون الإيصال صورة.');
    }
    await this.assertStorageLimit(storeId, confirmedObject.fileSizeBytes);
    const asset = await this.mediaRepository.create({
      storeId,
      uploadedBy: null,
      bucketName: this.storageAdapter.getBucketName(),
      objectKey: input.objectKey,
      publicUrl: this.storageAdapter.getPublicUrl(input.objectKey),
      etag: confirmedObject.etag,
      mimeType: confirmedObject.mimeType,
      fileSizeBytes: confirmedObject.fileSizeBytes,
      metadata: {
        ...this.buildAssetMetadata(input.fileName),
        source: 'storefront.payment_receipt',
      },
    });
    await this.enqueueMediaUploadedEvent(asset, context);
    return this.toResponse(asset);
  }

  async getAltTextCoverage(currentUser: AuthUser): Promise<AltTextCoverageResponse> {
    return this.getAltTextCoverageByStoreId(currentUser.storeId);
  }

  async getAltTextCoverageByStoreId(storeId: string): Promise<AltTextCoverageResponse> {
    const coverage = await this.mediaRepository.getAltTextCoverage(storeId);
    const completeImages = coverage.with_alt_text + coverage.decorative;
    const completionRate =
      coverage.total_images > 0 ? Math.round((completeImages / coverage.total_images) * 100) : 100;

    return {
      totalImages: coverage.total_images,
      imagesWithAlt: coverage.with_alt_text,
      withAltText: coverage.with_alt_text,
      decorativeImages: coverage.decorative,
      decorative: coverage.decorative,
      missingAltImages: coverage.missing_alt_text,
      missingAltText: coverage.missing_alt_text,
      completionPercentage: completionRate,
      completionRate,
    };
  }

  async updateAltText(
    currentUser: AuthUser,
    mediaAssetId: string,
    input: UpdateMediaAltTextDto,
    context: RequestContextData,
  ): Promise<MediaAssetResponse> {
    const asset = await this.mediaRepository.findById(currentUser.storeId, mediaAssetId);
    if (!asset) {
      throw new NotFoundException('Media asset not found');
    }

    const metadata = {
      ...asset.metadata,
      accessibility: this.normalizeAccessibilityMetadata(input),
    };
    const updated = await this.mediaRepository.updateMetadata(
      currentUser.storeId,
      mediaAssetId,
      metadata,
    );
    if (!updated) {
      throw new NotFoundException('Media asset not found');
    }

    await this.auditService.log({
      action: 'media.alt_text_updated',
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
      targetType: 'media_asset',
      targetId: mediaAssetId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        isDecorative: input.isDecorative === true,
        hasAltTextAr: Boolean(input.altTextAr?.trim()),
        hasAltTextEn: Boolean(input.altTextEn?.trim()),
        ...(context.requestId ? { requestId: context.requestId } : {}),
      },
    });

    return this.toResponse(updated);
  }

  private validateMimeType(mimeType: string): void {
    if (!ALLOWED_UPLOAD_MIME_TYPES.has(mimeType)) {
      throw new BadRequestException('Unsupported file type');
    }
  }

  private validateFileSize(fileSizeBytes: number): void {
    if (fileSizeBytes <= 0 || fileSizeBytes > MAX_UPLOAD_BYTES) {
      throw new BadRequestException(`File size must be between 1 and ${MAX_UPLOAD_BYTES} bytes`);
    }
  }

  private async assertStorageLimit(storeId: string, additionalBytes: number): Promise<void> {
    const additionalMb = Math.ceil(additionalBytes / (1024 * 1024));
    try {
      await this.storeCapabilitiesService.assertMetricCanGrow(
        storeId,
        'storage.used',
        additionalMb,
      );
    } catch (error) {
      if (error instanceof UnprocessableEntityException) {
        throw new UnprocessableEntityException(
          'Storage limit reached. Please upgrade your plan to upload more files.',
        );
      }
      throw error;
    }
  }

  private buildObjectKey(
    storeId: string,
    originalName: string,
    mimeType: string,
    folder: string | null = null,
  ): string {
    const extension = this.resolveExtension(originalName, mimeType);
    const prefix = folder ? `${storeId}/${folder}` : storeId;
    return `${prefix}/${Date.now()}-${uuidv4()}.${extension}`;
  }

  private resolveExtension(originalName: string, mimeType: string): string {
    const fromName = path.extname(originalName).replace('.', '').toLowerCase();
    if (fromName) {
      return fromName;
    }

    if (mimeType === 'image/jpeg') {
      return 'jpg';
    }
    if (mimeType === 'image/png') {
      return 'png';
    }
    if (mimeType === 'image/webp') {
      return 'webp';
    }
    if (mimeType === 'image/gif') {
      return 'gif';
    }
    if (mimeType === 'video/quicktime') {
      return 'mov';
    }
    return 'mp4';
  }

  private assertObjectKeyOwnership(storeId: string, objectKey: string): void {
    if (!objectKey.startsWith(`${storeId}/`)) {
      throw new BadRequestException('Object key must belong to the current store');
    }
  }

  private buildAssetMetadata(fileName: string | undefined): Record<string, unknown> {
    if (!fileName) {
      return {};
    }

    const normalizedFileName = fileName.trim();
    if (!normalizedFileName) {
      return {};
    }

    return {
      fileName: normalizedFileName,
    };
  }

  private normalizeAccessibilityMetadata(input: UpdateMediaAltTextDto): Record<string, unknown> {
    const isDecorative = input.isDecorative === true;
    return {
      altTextAr: isDecorative ? '' : (input.altTextAr?.trim() ?? ''),
      altTextEn: isDecorative ? '' : (input.altTextEn?.trim() ?? ''),
      isDecorative,
      captionAr: input.captionAr?.trim() ?? '',
      captionEn: input.captionEn?.trim() ?? '',
    };
  }

  private normalizeEtag(etag: string): string {
    return etag.replace(/^"|"$/g, '').trim();
  }

  private async confirmStorageObject(
    input: ConfirmMediaUploadDto,
  ): Promise<ConfirmedStorageObject> {
    const objectHead = await this.storageAdapter.headObject(input.objectKey);
    if (!objectHead) {
      throw new BadRequestException('Uploaded object was not found in storage');
    }

    const mimeType = objectHead.contentType ?? input.contentType ?? 'application/octet-stream';
    const fileSizeBytes = objectHead.contentLength ?? input.fileSizeBytes ?? 0;
    const etag = objectHead.etag ? this.normalizeEtag(objectHead.etag) : null;

    this.validateConfirmationPayload(input, mimeType, fileSizeBytes, etag);
    this.validateMimeType(mimeType);
    this.validateFileSize(fileSizeBytes);

    return {
      mimeType,
      fileSizeBytes,
      etag,
    };
  }

  private validateConfirmationPayload(
    input: ConfirmMediaUploadDto,
    mimeType: string,
    fileSizeBytes: number,
    etag: string | null,
  ): void {
    if (input.contentType && mimeType !== input.contentType) {
      throw new BadRequestException('Uploaded content type does not match confirmation payload');
    }

    if (input.fileSizeBytes !== undefined && fileSizeBytes !== input.fileSizeBytes) {
      throw new BadRequestException('Uploaded file size does not match confirmation payload');
    }

    if (input.etag) {
      const expectedEtag = this.normalizeEtag(input.etag);
      if (!etag || etag !== expectedEtag) {
        throw new BadRequestException('Uploaded ETag does not match confirmation payload');
      }
    }
  }

  private async createMediaAsset(
    currentUser: AuthUser,
    input: ConfirmMediaUploadDto,
    confirmedObject: ConfirmedStorageObject,
  ): Promise<MediaAssetRecord> {
    return this.mediaRepository.create({
      storeId: currentUser.storeId,
      uploadedBy: currentUser.id,
      bucketName: this.storageAdapter.getBucketName(),
      objectKey: input.objectKey,
      publicUrl: this.storageAdapter.getPublicUrl(input.objectKey),
      etag: confirmedObject.etag,
      mimeType: confirmedObject.mimeType,
      fileSizeBytes: confirmedObject.fileSizeBytes,
      metadata: this.buildAssetMetadata(input.fileName),
    });
  }

  private async enqueueMediaUploadedEvent(
    asset: MediaAssetRecord,
    context: RequestContextData,
  ): Promise<void> {
    await this.outboxService.enqueue({
      aggregateType: 'media_asset',
      aggregateId: asset.id,
      eventType: 'media.uploaded',
      payload: {
        id: asset.id,
        storeId: asset.store_id,
        objectKey: asset.object_key,
        bucketName: asset.bucket_name,
        etag: asset.etag,
        mimeType: asset.mime_type,
        fileSizeBytes: asset.file_size_bytes,
      },
      headers: context.requestId ? { requestId: context.requestId } : {},
    });
  }

  private async logMediaUploadedAudit(
    currentUser: AuthUser,
    mediaAssetId: string,
    context: RequestContextData,
  ): Promise<void> {
    await this.auditService.log({
      action: 'media.uploaded',
      storeId: currentUser.storeId,
      storeUserId: currentUser.id,
      targetType: 'media_asset',
      targetId: mediaAssetId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: context.requestId ? { requestId: context.requestId } : {},
    });
  }

  private toResponse(
    asset: MediaAssetRecord,
    extra: { downloadUrl: string; downloadUrlExpiresAt: Date } | null = null,
  ): MediaAssetResponse {
    return {
      id: asset.id,
      storeId: asset.store_id,
      bucketName: asset.bucket_name,
      objectKey: asset.object_key,
      url: asset.public_url,
      etag: asset.etag,
      mimeType: asset.mime_type,
      fileSizeBytes: asset.file_size_bytes,
      metadata: asset.metadata,
      createdAt: asset.created_at,
      ...(extra ?? {}),
    };
  }
}
