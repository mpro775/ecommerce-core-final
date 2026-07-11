import { Module } from '@nestjs/common';
import { StoreCapabilitiesModule } from '../store-capabilities/store-capabilities.module';
import { SecurityModule } from '../security/security.module';
import { MediaController } from './media.controller';
import { MediaRepository } from './media.repository';
import { S3StorageAdapter } from './s3-storage.adapter';
import { MediaService } from './media.service';
import { STORAGE_ADAPTER } from './storage.adapter';

@Module({
  providers: [
    MediaService,
    MediaRepository,
    {
      provide: STORAGE_ADAPTER,
      useClass: S3StorageAdapter,
    },
  ],
  exports: [MediaService, MediaRepository, STORAGE_ADAPTER],
})
export class MediaModule {}
