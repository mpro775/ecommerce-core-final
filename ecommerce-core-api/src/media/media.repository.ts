import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';

export interface MediaAssetRecord {
  id: string;
  store_id: string;
  uploaded_by: string | null;
  bucket_name: string | null;
  object_key: string;
  public_url: string;
  etag: string | null;
  mime_type: string;
  file_size_bytes: number;
  metadata: Record<string, unknown>;
  created_at: Date;
}

export interface AltTextCoverageRecord {
  total_images: number;
  with_alt_text: number;
  decorative: number;
  missing_alt_text: number;
}

@Injectable()
export class MediaRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(input: {
    storeId: string;
    uploadedBy: string | null;
    bucketName: string;
    objectKey: string;
    publicUrl: string;
    etag: string | null;
    mimeType: string;
    fileSizeBytes: number;
    metadata: Record<string, unknown>;
  }): Promise<MediaAssetRecord> {
    const result = await this.databaseService.db.query<MediaAssetRecord>(
      `
        INSERT INTO media_assets (
          id,
          store_id,
          uploaded_by,
          bucket_name,
          object_key,
          public_url,
          etag,
          mime_type,
          file_size_bytes,
          metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
        RETURNING id, store_id, uploaded_by, bucket_name, object_key, public_url, etag, mime_type, file_size_bytes, metadata, created_at
      `,
      [
        uuidv4(),
        input.storeId,
        input.uploadedBy,
        input.bucketName,
        input.objectKey,
        input.publicUrl,
        input.etag,
        input.mimeType,
        input.fileSizeBytes,
        JSON.stringify(input.metadata),
      ],
    );
    return result.rows[0] as MediaAssetRecord;
  }

  async findByObjectKey(storeId: string, objectKey: string): Promise<MediaAssetRecord | null> {
    const result = await this.databaseService.db.query<MediaAssetRecord>(
      `
        SELECT id, store_id, uploaded_by, bucket_name, object_key, public_url, etag, mime_type, file_size_bytes, metadata, created_at
        FROM media_assets
        WHERE store_id = $1
          AND object_key = $2
        LIMIT 1
      `,
      [storeId, objectKey],
    );

    return result.rows[0] ?? null;
  }

  async findById(storeId: string, mediaAssetId: string): Promise<MediaAssetRecord | null> {
    const result = await this.databaseService.db.query<MediaAssetRecord>(
      `
        SELECT id, store_id, uploaded_by, bucket_name, object_key, public_url, etag, mime_type, file_size_bytes, metadata, created_at
        FROM media_assets
        WHERE store_id = $1
          AND id = $2
        LIMIT 1
      `,
      [storeId, mediaAssetId],
    );

    return result.rows[0] ?? null;
  }

  async updateMetadata(
    storeId: string,
    mediaAssetId: string,
    metadata: Record<string, unknown>,
  ): Promise<MediaAssetRecord | null> {
    const result = await this.databaseService.db.query<MediaAssetRecord>(
      `
        UPDATE media_assets
        SET metadata = $3::jsonb
        WHERE store_id = $1
          AND id = $2
        RETURNING id, store_id, uploaded_by, bucket_name, object_key, public_url, etag, mime_type, file_size_bytes, metadata, created_at
      `,
      [storeId, mediaAssetId, JSON.stringify(metadata)],
    );

    return result.rows[0] ?? null;
  }

  async getAltTextCoverage(storeId: string): Promise<AltTextCoverageRecord> {
    const result = await this.databaseService.db.query<AltTextCoverageRecord>(
      `
        SELECT
          COUNT(*)::int AS total_images,
          COUNT(*) FILTER (
            WHERE COALESCE(metadata #>> '{accessibility,isDecorative}', 'false') = 'true'
          )::int AS decorative,
          COUNT(*) FILTER (
            WHERE NULLIF(BTRIM(COALESCE(metadata #>> '{accessibility,altTextAr}', '')), '') IS NOT NULL
               OR NULLIF(BTRIM(COALESCE(metadata #>> '{accessibility,altTextEn}', '')), '') IS NOT NULL
          )::int AS with_alt_text,
          COUNT(*) FILTER (
            WHERE COALESCE(metadata #>> '{accessibility,isDecorative}', 'false') <> 'true'
              AND NULLIF(BTRIM(COALESCE(metadata #>> '{accessibility,altTextAr}', '')), '') IS NULL
              AND NULLIF(BTRIM(COALESCE(metadata #>> '{accessibility,altTextEn}', '')), '') IS NULL
          )::int AS missing_alt_text
        FROM media_assets
        WHERE store_id = $1
          AND mime_type LIKE 'image/%'
      `,
      [storeId],
    );

    return (
      result.rows[0] ?? {
        total_images: 0,
        with_alt_text: 0,
        decorative: 0,
        missing_alt_text: 0,
      }
    );
  }
}
