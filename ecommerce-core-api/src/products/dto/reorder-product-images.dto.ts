import { ArrayMinSize, IsArray, IsOptional, IsUUID } from 'class-validator';

export class ReorderProductImagesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  imageIds!: string[];

  @IsOptional()
  @IsUUID('4')
  primaryImageId?: string;
}
