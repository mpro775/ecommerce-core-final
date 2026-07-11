import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { INVENTORY_MOVEMENT_TYPES } from '../constants/inventory.constants';

export class ListInventoryMovementsQueryDto {
  @IsOptional()
  @IsUUID('4')
  variantId?: string;

  @IsOptional()
  @IsUUID('4')
  orderId?: string;

  @IsOptional()
  @IsIn(INVENTORY_MOVEMENT_TYPES)
  movementType?: (typeof INVENTORY_MOVEMENT_TYPES)[number];

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
