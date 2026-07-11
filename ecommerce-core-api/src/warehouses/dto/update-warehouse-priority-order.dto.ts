import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class UpdateWarehousePriorityOrderDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  warehouseIds!: string[];
}
