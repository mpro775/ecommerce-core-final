import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsUUID, Min, ValidateNested } from 'class-validator';

export class VariantWarehouseAllocationDto {
  @IsUUID('4')
  warehouseId!: string;

  @IsInt()
  @Min(0)
  quantity!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  reorderPoint?: number;
}

export class ReplaceVariantWarehouseAllocationsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantWarehouseAllocationDto)
  allocations!: VariantWarehouseAllocationDto[];
}
