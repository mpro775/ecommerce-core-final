import { IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';

export class AddCartItemDto {
  @IsOptional()
  @IsUUID('4')
  cartId?: string;

  @IsUUID('4')
  variantId!: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currencyCode?: string;

  @IsInt()
  @Min(1)
  @Max(50)
  quantity!: number;
}
