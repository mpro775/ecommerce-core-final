import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class UpdateVariantAttributesDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  attributeValueIds!: string[];
}
