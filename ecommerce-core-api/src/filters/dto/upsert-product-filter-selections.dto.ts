import {
  ArrayUnique,
  IsArray,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class ProductFilterRangeInputDto {
  @IsUUID('4')
  filterId!: string;

  @IsNumber()
  @Min(0)
  numericValue!: number;
}

export class UpsertProductFilterSelectionsDto {
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  valueIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductFilterRangeInputDto)
  ranges?: ProductFilterRangeInputDto[];
}
