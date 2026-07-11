import { IsNotEmpty, IsString } from 'class-validator';

export class RequestOtpDto {
  @IsString()
  @IsNotEmpty()
  identifier!: string; // Phone or email
}
