import { IsInt, IsOptional, IsString, IsUUID, MaxLength, NotEquals } from 'class-validator';

export class AdjustInventoryDto {
  @IsUUID('4')
  warehouseId!: string;

  @IsInt()
  @NotEquals(0)
  quantityDelta!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
