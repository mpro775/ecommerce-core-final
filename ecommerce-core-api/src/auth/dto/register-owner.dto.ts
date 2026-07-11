import { IsEmail, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';
import { STORE_SLUG_REGEX } from '../../stores/constants/store-slug.constants';

export class RegisterOwnerDto {
  @IsString()
  @MaxLength(120)
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @IsString()
  @MaxLength(120)
  storeName!: string;

  @IsString()
  @Length(3, 50)
  @Matches(STORE_SLUG_REGEX, {
    message:
      'Slug must be 3-50 chars and contain only lowercase letters, numbers, and hyphens. It must not start or end with a hyphen.',
  })
  storeSlug!: string;
}
