import { IsInt, Max, Min } from 'class-validator';

export class UpdateCartItemDto {
  @IsInt()
  @Min(0)
  @Max(50)
  quantity!: number;
}
