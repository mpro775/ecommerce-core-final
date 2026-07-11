import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateStorePageDto {
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(120)
  slug!: string;

  @IsOptional()
  @IsIn(['custom', 'about', 'contact', 'faq', 'policy'])
  pageType?: 'custom' | 'about' | 'contact' | 'faq' | 'policy';

  @IsOptional()
  @IsIn(['about', 'contact', 'shipping_policy', 'return_policy', 'privacy_policy', 'terms', 'faq'])
  pageKey?:
    | 'about'
    | 'contact'
    | 'shipping_policy'
    | 'return_policy'
    | 'privacy_policy'
    | 'terms'
    | 'faq';

  @IsOptional()
  @IsString()
  @MaxLength(140)
  titleAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  titleEn?: string;

  @IsOptional()
  @IsString()
  contentAr?: string;

  @IsOptional()
  @IsString()
  contentEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(260)
  excerptAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(260)
  excerptEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(70)
  seoTitleAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(70)
  seoTitleEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(170)
  seoDescriptionAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(170)
  seoDescriptionEn?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  ogImage?: string;

  @IsOptional()
  @IsArray()
  faqItems?: Array<Record<string, unknown>>;

  @IsOptional()
  @IsBoolean()
  seoIndex?: boolean;

  @IsOptional()
  @IsBoolean()
  seoFollow?: boolean;

  @IsOptional()
  @IsBoolean()
  showInHeader?: boolean;

  @IsOptional()
  @IsBoolean()
  showInFooter?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsIn(['draft', 'published', 'archived'])
  status?: 'draft' | 'published' | 'archived';
}
