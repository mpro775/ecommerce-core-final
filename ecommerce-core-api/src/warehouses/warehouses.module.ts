import { Module } from '@nestjs/common';
import { SecurityModule } from '../security/security.module';
import { WarehousesController } from './warehouses.controller';
import { WarehousesRepository } from './warehouses.repository';
import { WarehousesService } from './warehouses.service';

@Module({
  imports: [SecurityModule],
  controllers: [WarehousesController],
  providers: [WarehousesService, WarehousesRepository],
  exports: [WarehousesService, WarehousesRepository],
})
export class WarehousesModule {}
