import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module';
import { SecurityModule } from '../security/security.module';
import { FiltersController } from './filters.controller';
import { FiltersRepository } from './filters.repository';
import { FiltersService } from './filters.service';

@Module({
  imports: [SecurityModule, ProductsModule],
  controllers: [FiltersController],
  providers: [FiltersService, FiltersRepository],
  exports: [FiltersService, FiltersRepository],
})
export class FiltersModule {}
