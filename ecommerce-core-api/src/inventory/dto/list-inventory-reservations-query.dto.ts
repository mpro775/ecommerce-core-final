import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { INVENTORY_RESERVATION_STATUSES } from '../constants/inventory.constants';

export class ListInventoryReservationsQueryDto {
  @IsOptional()
  @IsUUID('4')
  variantId?: string;

  @IsOptional()
  @IsUUID('4')
  orderId?: string;

  @IsOptional()
  @IsIn(INVENTORY_RESERVATION_STATUSES)
  status?: (typeof INVENTORY_RESERVATION_STATUSES)[number];

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
