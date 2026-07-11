export interface PresignedPutUrlInput {
  key: string;
  contentType: string;
  expiresInSeconds?: number;
}

export interface PresignedGetUrlInput {
  key: string;
  expiresInSeconds?: number;
}

export interface PutObjectInput {
  key: string;
  body: Buffer;
  contentType: string;
}

export interface PresignedUrlResult {
  url: string;
  expiresAt: Date;
  headers: Record<string, string>;
}

export interface StoredObjectHead {
  contentType: string | null;
  contentLength: number | null;
  etag: string | null;
}

export const STORAGE_ADAPTER = Symbol('STORAGE_ADAPTER');

export interface StorageAdapter {
  getPresignedPutUrl(input: PresignedPutUrlInput): Promise<PresignedUrlResult>;
  getPresignedGetUrl(input: PresignedGetUrlInput): Promise<PresignedUrlResult>;
  putObject(input: PutObjectInput): Promise<{ etag: string | null }>;
  getPublicUrl(key: string): string;
  headObject(key: string): Promise<StoredObjectHead | null>;
  getBucketName(): string;
}
