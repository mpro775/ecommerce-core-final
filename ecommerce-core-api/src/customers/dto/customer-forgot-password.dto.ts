import { IsEmail, IsString, MaxLength } from 'class-validator';

export class CustomerForgotPasswordDto {
  @IsEmail()
  email!: string;
}
