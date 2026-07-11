import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class UpsertCategoryAttributesDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  attributeIds!: string[];
}
