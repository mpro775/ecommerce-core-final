import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type {
  PresignedGetUrlInput,
  PresignedPutUrlInput,
  PresignedUrlResult,
  StorageAdapter,
  StoredObjectHead,
} from './storage.adapter';

@Injectable()
export class S3StorageAdapter implements StorageAdapter {
  private readonly client: S3Client;
  private readonly bucketName: string;
  private readonly uploadUrlTtlSeconds: number;
  private readonly downloadUrlTtlSeconds: number;
  private readonly publicBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>('S3_ENDPOINT', '').trim();
    const forcePathStyle = this.configService.get<boolean>('S3_FORCE_PATH_STYLE', true);
    const accessKeyId = this.configService.get<string>('S3_ACCESS_KEY', '').trim();
    const secretAccessKey = this.configService.get<string>('S3_SECRET_KEY', '').trim();

    this.bucketName = this.configService.get<string>('S3_BUCKET', 'commerce-media').trim();
    this.uploadUrlTtlSeconds = this.configService.get<number>('S3_PRESIGNED_PUT_TTL_SECONDS', 900);
    this.downloadUrlTtlSeconds = this.configService.get<number>(
      'S3_PRESIGNED_GET_TTL_SECONDS',
      600,
    );
    this.publicBaseUrl = this.resolvePublicBaseUrl(
      this.configService.get<string>('S3_PUBLIC_BASE_URL', '').trim(),
      endpoint,
      forcePathStyle,
      this.bucketName,
    );

    const clientConfig: S3ClientConfig = {
      region: this.configService.get<string>('S3_REGION', 'us-east-1'),
      forcePathStyle,
    };

    if (endpoint.length > 0) {
      clientConfig.endpoint = endpoint;
    }

    if (accessKeyId.length > 0 && secretAccessKey.length > 0) {
      clientConfig.credentials = {
        accessKeyId,
        secretAccessKey,
      };
    }

    this.client = new S3Client(clientConfig);
  }

  async getPresignedPutUrl(input: PresignedPutUrlInput): Promise<PresignedUrlResult> {
    const expiresInSeconds = input.expiresInSeconds ?? this.uploadUrlTtlSeconds;
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: input.key,
      ContentType: input.contentType,
    });

    const url = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
    return {
      url,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
      headers: {
        'content-type': input.contentType,
      },
    };
  }

  async getPresignedGetUrl(input: PresignedGetUrlInput): Promise<PresignedUrlResult> {
    const expiresInSeconds = input.expiresInSeconds ?? this.downloadUrlTtlSeconds;
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: input.key,
    });
    const url = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });

    return {
      url,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
      headers: {},
    };
  }

  async putObject(input: {
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<{ etag: string | null }> {
    const result = await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
      }),
    );
    return { etag: result.ETag ? this.normalizeEtag(result.ETag) : null };
  }

  getPublicUrl(key: string): string {
    return `${this.publicBaseUrl}/${this.encodeObjectKey(key)}`;
  }

  async headObject(key: string): Promise<StoredObjectHead | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );

      return {
        contentType: result.ContentType ?? null,
        contentLength: result.ContentLength ?? null,
        etag: result.ETag ? this.normalizeEtag(result.ETag) : null,
      };
    } catch (error: unknown) {
      if (this.isNotFoundError(error)) {
        return null;
      }

      throw error;
    }
  }

  getBucketName(): string {
    return this.bucketName;
  }

  private resolvePublicBaseUrl(
    explicitBaseUrl: string,
    endpoint: string,
    forcePathStyle: boolean,
    bucketName: string,
  ): string {
    const trimmedExplicitBase = explicitBaseUrl.trim();
    if (trimmedExplicitBase.length > 0) {
      return trimmedExplicitBase.replace(/\/+$/, '');
    }

    const trimmedEndpoint = endpoint.trim();
    if (trimmedEndpoint.length === 0) {
      return `https://${bucketName}.s3.amazonaws.com`;
    }

    const normalizedEndpoint = trimmedEndpoint.replace(/\/+$/, '');
    if (forcePathStyle) {
      return `${normalizedEndpoint}/${bucketName}`;
    }

    const parsed = new URL(normalizedEndpoint);
    return `${parsed.protocol}//${bucketName}.${parsed.host}`;
  }

  private encodeObjectKey(key: string): string {
    return key
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
  }

  private normalizeEtag(etag: string): string {
    return etag.replace(/^"|"$/g, '').trim();
  }

  private isNotFoundError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const candidate = error as Error & { $metadata?: { httpStatusCode?: number } };
    return candidate.name === 'NotFound' || candidate.$metadata?.httpStatusCode === 404;
  }
}
