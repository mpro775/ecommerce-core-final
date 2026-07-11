import { IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @IsNotEmpty()
  identifier!: string; // Phone or email

  @IsString()
  @IsNotEmpty()
  @Length(4, 6)
  code!: string;
}
