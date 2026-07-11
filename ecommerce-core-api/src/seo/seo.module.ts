import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SeoRepository } from './seo.repository';
import { SeoService } from './seo.service';

@Module({
  imports: [DatabaseModule],
  providers: [SeoRepository, SeoService],
  exports: [SeoRepository, SeoService],
})
export class SeoModule {}
