import { IsString, Length, Matches } from 'class-validator';
import { STORE_SLUG_REGEX } from '../constants/store-slug.constants';

export class StoreSlugAvailabilityQueryDto {
  @IsString()
  @Length(3, 50)
  @Matches(STORE_SLUG_REGEX, {
    message:
      'Slug must be 3-50 chars and contain only lowercase letters, numbers, and hyphens. It must not start or end with a hyphen.',
  })
  slug!: string;
}
