import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface StoreSettingsRecord {
  id: string;
  name: string;
  name_ar: string | null;
  name_en: string | null;
  description_ar: string | null;
  description_en: string | null;
  slug: string;
  phone: string | null;
  address: string | null;
  country: string;
  city: string | null;
  address_details: string | null;
  latitude: number | null;
  longitude: number | null;
  working_hours: Array<{
    day: string;
    isClosed: boolean;
    slots: Array<{ open: string; close: string }>;
  }>;
  social_links: Record<string, unknown>;
  currency_code: string;
  base_currency_code: string;
  default_currency_code: string;
  timezone: string;
}

export interface StorePublicRecord {
  id: string;
  name: string;
  slug: string;
  currency_code: string;
  status: string;
  is_suspended: boolean;
}

export interface StoreGeneralSettingsRecord {
  store_id: string;
  order_settings: Record<string, unknown>;
  inventory_settings: Record<string, unknown>;
  tax_settings: Record<string, unknown>;
  mobile_app_config: Record<string, unknown>;
}

@Injectable()
export class StoresRepository {
  constructor(private readonly databaseService: DatabaseService) { }

  async findById(storeId: string): Promise<StoreSettingsRecord | null> {
    const result = await this.databaseService.db.query<StoreSettingsRecord>(
      `
        SELECT id, name, name_ar, name_en, description_ar, description_en,
               slug, phone, address,
               country, city, address_details, latitude, longitude,
               working_hours, social_links,
               currency_code, base_currency_code, default_currency_code, timezone
        FROM stores
        WHERE id = $1
        LIMIT 1
      `,
      [storeId],
    );

    return result.rows[0] ?? null;
  }

  async findGeneralSettings(storeId: string): Promise<StoreGeneralSettingsRecord | null> {
    await this.ensureGeneralSettings(storeId);
    const result = await this.databaseService.db.query<StoreGeneralSettingsRecord>(
      `
        SELECT store_id, order_settings, inventory_settings, tax_settings, mobile_app_config
        FROM store_general_settings
        WHERE store_id = $1
        LIMIT 1
      `,
      [storeId],
    );

    return result.rows[0] ?? null;
  }

  async findPublicById(storeId: string): Promise<StorePublicRecord | null> {
    const result = await this.databaseService.db.query<StorePublicRecord>(
      `
        SELECT id, name, slug, currency_code,
               COALESCE(status, CASE WHEN is_suspended THEN 'suspended' ELSE 'active' END) AS status,
               is_suspended
        FROM stores
        WHERE id = $1
          AND COALESCE(status, 'active') <> 'deleted'
        LIMIT 1
      `,
      [storeId],
    );

    return result.rows[0] ?? null;
  }

  async findFirstActiveStore(): Promise<StorePublicRecord | null> {
    const result = await this.databaseService.db.query<StorePublicRecord>(
      `
        SELECT id, name, slug, currency_code,
               COALESCE(status, CASE WHEN is_suspended THEN 'suspended' ELSE 'active' END) AS status,
               is_suspended
        FROM stores
        WHERE COALESCE(status, 'active') <> 'deleted'
        ORDER BY created_at ASC
        LIMIT 1
      `
    );

    return result.rows[0] ?? null;
  }

  async updateSettings(input: {
    storeId: string;
    name: string;
    nameAr: string | null;
    nameEn: string | null;
    descriptionAr: string | null;
    descriptionEn: string | null;
    currencyCode: string;
    timezone: string;
    phone: string | null;
    address: string | null;
    country: string;
    city: string | null;
    addressDetails: string | null;
    latitude: number | null;
    longitude: number | null;
    workingHours: Array<{
      day: string;
      isClosed: boolean;
      slots: Array<{ open: string; close: string }>;
    }>;
    socialLinks: Record<string, unknown>;
  }): Promise<StoreSettingsRecord> {
    const result = await this.databaseService.db.query<StoreSettingsRecord>(
      `
        UPDATE stores
        SET name = $2,
            name_ar = $3,
            name_en = $4,
            description_ar = $5,
            description_en = $6,
            currency_code = $7,
            default_currency_code = $7,
            base_currency_code = 'YER',
            timezone = $8,
            phone = $9,
            address = $10,
            country = $11,
            city = $12,
            address_details = $13,
            latitude = $14,
            longitude = $15,
            working_hours = $16::jsonb,
            social_links = $17::jsonb,
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, name, name_ar, name_en, description_ar, description_en,
                  slug, phone, address,
                  country, city, address_details, latitude, longitude,
                  working_hours, social_links,
                  currency_code, base_currency_code, default_currency_code, timezone
      `,
      [
        input.storeId,
        input.name,
        input.nameAr,
        input.nameEn,
        input.descriptionAr,
        input.descriptionEn,
        input.currencyCode,
        input.timezone,
        input.phone,
        input.address,
        input.country,
        input.city,
        input.addressDetails,
        input.latitude,
        input.longitude,
        JSON.stringify(input.workingHours),
        JSON.stringify(input.socialLinks),
      ],
    );

    return result.rows[0] as StoreSettingsRecord;
  }

  async updateGeneralSettings(input: {
    storeId: string;
    orderSettings: Record<string, unknown>;
    inventorySettings: Record<string, unknown>;
    taxSettings: Record<string, unknown>;
    mobileAppConfig: Record<string, unknown>;
  }): Promise<StoreGeneralSettingsRecord> {
    const result = await this.databaseService.db.query<StoreGeneralSettingsRecord>(
      `
        INSERT INTO store_general_settings (
          store_id,
          order_settings,
          inventory_settings,
          tax_settings,
          mobile_app_config
        )
        VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb)
        ON CONFLICT (store_id) DO UPDATE
        SET order_settings = EXCLUDED.order_settings,
            inventory_settings = EXCLUDED.inventory_settings,
            tax_settings = EXCLUDED.tax_settings,
            mobile_app_config = EXCLUDED.mobile_app_config,
            updated_at = NOW()
        RETURNING store_id, order_settings, inventory_settings, tax_settings, mobile_app_config
      `,
      [
        input.storeId,
        JSON.stringify(input.orderSettings),
        JSON.stringify(input.inventorySettings),
        JSON.stringify(input.taxSettings),
        JSON.stringify(input.mobileAppConfig),
      ],
    );

    return result.rows[0] as StoreGeneralSettingsRecord;
  }

  private async ensureGeneralSettings(storeId: string): Promise<void> {
    await this.databaseService.db.query(
      `
        INSERT INTO store_general_settings (store_id)
        SELECT id
        FROM stores
        WHERE id = $1
        ON CONFLICT (store_id) DO NOTHING
      `,
      [storeId],
    );
  }
}
