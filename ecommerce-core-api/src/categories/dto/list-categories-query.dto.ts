import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ListCategoriesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsUUID('4')
  parentId?: string;
}
