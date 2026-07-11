import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const PHONE_REGEX = /^\+?[0-9]{7,15}$/;

export class RegisterOwnerStartDto {
  @IsString({ message: 'Full name is required' })
  @MaxLength(120, { message: 'Full name must be at most 120 characters' })
  fullName!: string;

  @IsEmail({}, { message: 'Email format is invalid' })
  email!: string;

  @IsString({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(72, { message: 'Password must be at most 72 characters' })
  password!: string;

  @IsString({ message: 'Owner phone is required' })
  @MaxLength(30, { message: 'Owner phone is too long' })
  @Matches(PHONE_REGEX, { message: 'Owner phone is invalid' })
  ownerPhone!: string;
}
