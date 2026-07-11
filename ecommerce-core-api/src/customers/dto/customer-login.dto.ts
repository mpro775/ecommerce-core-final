import { IsString, MaxLength, MinLength } from 'class-validator';

export class CustomerLoginDto {
  @IsString()
  @MaxLength(120)
  phoneOrEmail!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}
