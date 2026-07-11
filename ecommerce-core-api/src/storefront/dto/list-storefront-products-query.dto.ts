import { Transform } from 'class-transformer';
import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ListStorefrontProductsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  q?: string;

  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(180)
  categorySlug?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeAttributeQueryValue(value))
  @IsObject()
  attrs?: Record<string, string[]>;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

function normalizeAttributeQueryValue(value: unknown): Record<string, string[]> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const normalized: Record<string, string[]> = {};
  for (const [attributeSlug, rawValue] of Object.entries(value)) {
    const values = toArrayOfStrings(rawValue);
    if (values.length === 0) {
      continue;
    }

    normalized[attributeSlug] = values;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function toArrayOfStrings(value: unknown): string[] {
  const items = Array.isArray(value) ? value : [value];
  return items
    .flatMap((item) => (typeof item === 'string' ? item.split(',') : []))
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
