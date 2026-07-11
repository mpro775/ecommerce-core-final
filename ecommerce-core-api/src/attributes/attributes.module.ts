import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module';
import { SecurityModule } from '../security/security.module';
import { AttributesController } from './attributes.controller';
import { AttributesRepository } from './attributes.repository';
import { AttributesService } from './attributes.service';

@Module({
  imports: [SecurityModule, CategoriesModule],
  controllers: [AttributesController],
  providers: [AttributesService, AttributesRepository],
  exports: [AttributesService, AttributesRepository],
})
export class AttributesModule {}
