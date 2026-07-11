import { BadRequestException, Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import { STORE_CURRENCY_CODES } from '../stores/constants/store-settings.constants';

export interface StoreCurrencyRecord {
  id: string;
  store_id: string;
  currency_code: string;
  yer_per_unit: string;
  decimal_digits: number;
  rounding_increment: string;
  is_default: boolean;
  is_active: boolean;
}

export interface StoreCurrencyResponse {
  currencyCode: string;
  yerPerUnit: number;
  decimalDigits: number;
  roundingIncrement: number;
  isDefault: boolean;
  isActive: boolean;
}

export interface VariantCurrencyPriceRecord {
  variant_id: string;
  currency_code: string;
  price: string;
  compare_at_price: string | null;
}

export interface VariantCurrencyOverride {
  currencyCode: string;
  price: number;
  compareAtPrice: number | null;
}

export interface ResolvedCurrency {
  currencyCode: string;
  yerPerUnit: number;
  decimalDigits: number;
  roundingIncrement: number;
}

@Injectable()
export class CurrencyService {
  constructor(private readonly databaseService: DatabaseService) {}

  async listStoreCurrencies(storeId: string): Promise<StoreCurrencyResponse[]> {
    await this.ensureBaseCurrency(storeId);
    const result = await this.databaseService.db.query<StoreCurrencyRecord>(
      `
        SELECT id, store_id, currency_code, yer_per_unit, decimal_digits,
               rounding_increment, is_default, is_active
        FROM store_currencies
        WHERE store_id = $1
        ORDER BY is_default DESC, currency_code ASC
      `,
      [storeId],
    );
    return result.rows.map((row) => this.toCurrencyResponse(row));
  }

  async replaceStoreCurrencies(
    storeId: string,
    currencies: StoreCurrencyResponse[],
  ): Promise<StoreCurrencyResponse[]> {
    const normalized = this.normalizeCurrencyPayload(currencies);

    const client = await this.databaseService.db.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM store_currencies WHERE store_id = $1`, [storeId]);

      for (const currency of normalized) {
        await client.query(
          `
            INSERT INTO store_currencies (
              id, store_id, currency_code, yer_per_unit, decimal_digits,
              rounding_increment, is_default, is_active
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
          `,
          [
            uuidv4(),
            storeId,
            currency.currencyCode,
            currency.yerPerUnit,
            currency.decimalDigits,
            currency.roundingIncrement,
            currency.isDefault,
          ],
        );
      }

      const defaultCurrency = normalized.find((currency) => currency.isDefault) ?? normalized[0]!;
      await client.query(
        `
          UPDATE stores
          SET base_currency_code = 'YER',
              default_currency_code = $2,
              currency_code = $2,
              updated_at = NOW()
          WHERE id = $1
        `,
        [storeId, defaultCurrency.currencyCode],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return this.listStoreCurrencies(storeId);
  }

  async resolveStoreCurrency(
    storeId: string,
    requestedCurrencyCode?: string | null,
  ): Promise<ResolvedCurrency> {
    const currencies = await this.listStoreCurrencies(storeId);
    const normalizedRequested = requestedCurrencyCode?.trim().toUpperCase();
    const requested = normalizedRequested
      ? currencies.find(
          (currency) => currency.currencyCode === normalizedRequested && currency.isActive,
        )
      : null;
    const fallback =
      currencies.find((currency) => currency.isDefault && currency.isActive) ??
      currencies.find((currency) => currency.currencyCode === 'YER') ??
      this.buildBaseCurrency();

    return this.toResolvedCurrency(requested ?? fallback);
  }

  async listVariantOverrides(
    storeId: string,
    variantIds: string[],
  ): Promise<Map<string, VariantCurrencyOverride[]>> {
    if (variantIds.length === 0) {
      return new Map();
    }

    const result = await this.databaseService.db.query<VariantCurrencyPriceRecord>(
      `
        SELECT variant_id, currency_code, price, compare_at_price
        FROM product_variant_currency_prices
        WHERE store_id = $1
          AND variant_id = ANY($2::uuid[])
        ORDER BY currency_code ASC
      `,
      [storeId, variantIds],
    );

    const grouped = new Map<string, VariantCurrencyOverride[]>();
    for (const row of result.rows) {
      const rows = grouped.get(row.variant_id) ?? [];
      rows.push({
        currencyCode: row.currency_code,
        price: Number(row.price),
        compareAtPrice: row.compare_at_price === null ? null : Number(row.compare_at_price),
      });
      grouped.set(row.variant_id, rows);
    }
    return grouped;
  }

  async replaceVariantOverrides(
    storeId: string,
    variantId: string,
    overrides: VariantCurrencyOverride[],
  ): Promise<VariantCurrencyOverride[]> {
    const activeCurrencies = await this.listStoreCurrencies(storeId);
    const activeCodes = new Set(
      activeCurrencies
        .filter((currency) => currency.isActive)
        .map((currency) => currency.currencyCode),
    );
    const normalized = overrides
      .map((override) => ({
        currencyCode: override.currencyCode.trim().toUpperCase(),
        price: Number(override.price),
        compareAtPrice:
          override.compareAtPrice === null || override.compareAtPrice === undefined
            ? null
            : Number(override.compareAtPrice),
      }))
      .filter((override) => override.currencyCode !== 'YER');

    const seen = new Set<string>();
    for (const override of normalized) {
      if (
        !STORE_CURRENCY_CODES.includes(
          override.currencyCode as (typeof STORE_CURRENCY_CODES)[number],
        )
      ) {
        throw new BadRequestException(`Unsupported currency: ${override.currencyCode}`);
      }
      if (!activeCodes.has(override.currencyCode)) {
        throw new BadRequestException(`Currency is not enabled: ${override.currencyCode}`);
      }
      if (seen.has(override.currencyCode)) {
        throw new BadRequestException(`Duplicated currency override: ${override.currencyCode}`);
      }
      seen.add(override.currencyCode);
      if (!Number.isFinite(override.price) || override.price < 0) {
        throw new BadRequestException('Override price must be a non-negative number');
      }
      if (
        override.compareAtPrice !== null &&
        (!Number.isFinite(override.compareAtPrice) || override.compareAtPrice < override.price)
      ) {
        throw new BadRequestException(
          'Override compare-at price must be greater than or equal to price',
        );
      }
    }

    await this.databaseService.db.query(
      `DELETE FROM product_variant_currency_prices WHERE store_id = $1 AND variant_id = $2`,
      [storeId, variantId],
    );

    for (const override of normalized) {
      await this.databaseService.db.query(
        `
          INSERT INTO product_variant_currency_prices (
            id, store_id, variant_id, currency_code, price, compare_at_price
          )
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          uuidv4(),
          storeId,
          variantId,
          override.currencyCode,
          override.price,
          override.compareAtPrice,
        ],
      );
    }

    const grouped = await this.listVariantOverrides(storeId, [variantId]);
    return grouped.get(variantId) ?? [];
  }

  priceFromYer(
    priceYer: number,
    currency: ResolvedCurrency,
    overrides: VariantCurrencyOverride[] = [],
  ): number {
    const override = overrides.find((item) => item.currencyCode === currency.currencyCode);
    if (override) {
      return this.roundForCurrency(override.price, currency);
    }
    return this.convertFromYer(priceYer, currency);
  }

  compareAtFromYer(
    compareAtYer: number | null,
    currency: ResolvedCurrency,
    overrides: VariantCurrencyOverride[] = [],
  ): number | null {
    const override = overrides.find((item) => item.currencyCode === currency.currencyCode);
    if (override) {
      return override.compareAtPrice === null
        ? null
        : this.roundForCurrency(override.compareAtPrice, currency);
    }
    return compareAtYer === null ? null : this.convertFromYer(compareAtYer, currency);
  }

  convertFromYer(amountYer: number, currency: ResolvedCurrency): number {
    const safeAmount = Number.isFinite(amountYer) ? amountYer : 0;
    const converted =
      currency.currencyCode === 'YER' ? safeAmount : safeAmount / currency.yerPerUnit;
    return this.roundForCurrency(converted, currency);
  }

  convertToYer(amount: number, currency: ResolvedCurrency): number {
    const safeAmount = Number.isFinite(amount) ? amount : 0;
    const converted =
      currency.currencyCode === 'YER' ? safeAmount : safeAmount * currency.yerPerUnit;
    return Number(converted.toFixed(2));
  }

  roundForCurrency(amount: number, currency: ResolvedCurrency): number {
    const increment = Math.max(currency.roundingIncrement, 0.0001);
    const roundedToIncrement = Math.round(amount / increment) * increment;
    return Number(roundedToIncrement.toFixed(currency.decimalDigits));
  }

  private normalizeCurrencyPayload(input: StoreCurrencyResponse[]): StoreCurrencyResponse[] {
    const rows = input.length > 0 ? input : [this.buildBaseCurrency()];
    const normalized = rows.map((row) => {
      const currencyCode = row.currencyCode.trim().toUpperCase();
      if (!STORE_CURRENCY_CODES.includes(currencyCode as (typeof STORE_CURRENCY_CODES)[number])) {
        throw new BadRequestException(`Unsupported currency: ${currencyCode}`);
      }
      const decimalDigits =
        currencyCode === 'YER'
          ? 0
          : Math.max(0, Math.min(4, Math.trunc(Number(row.decimalDigits ?? 2))));
      const roundingIncrement = currencyCode === 'YER' ? 1 : Number(row.roundingIncrement ?? 0.01);
      const yerPerUnit = currencyCode === 'YER' ? 1 : Number(row.yerPerUnit);
      if (!Number.isFinite(yerPerUnit) || yerPerUnit <= 0) {
        throw new BadRequestException(`Exchange rate is required for ${currencyCode}`);
      }
      if (!Number.isFinite(roundingIncrement) || roundingIncrement <= 0) {
        throw new BadRequestException(`Rounding increment is required for ${currencyCode}`);
      }
      return {
        currencyCode,
        yerPerUnit,
        decimalDigits,
        roundingIncrement,
        isDefault: Boolean(row.isDefault),
        isActive: true,
      };
    });

    if (!normalized.some((row) => row.currencyCode === 'YER')) {
      normalized.unshift(this.buildBaseCurrency());
    }

    const deduped = new Map<string, StoreCurrencyResponse>();
    for (const row of normalized) {
      deduped.set(
        row.currencyCode,
        row.currencyCode === 'YER' ? this.buildBaseCurrency(row.isDefault) : row,
      );
    }

    const values = [...deduped.values()];
    const defaultCount = values.filter((row) => row.isDefault).length;
    if (defaultCount === 0) {
      values[0] = { ...values[0]!, isDefault: true };
    } else if (defaultCount > 1) {
      throw new BadRequestException('Only one default currency is allowed');
    }
    return values;
  }

  private async ensureBaseCurrency(storeId: string): Promise<void> {
    await this.databaseService.db.query(
      `
        INSERT INTO store_currencies (
          id, store_id, currency_code, yer_per_unit, decimal_digits,
          rounding_increment, is_default, is_active
        )
        VALUES ($1, $2, 'YER', 1, 0, 1, TRUE, TRUE)
        ON CONFLICT (store_id, currency_code) DO NOTHING
      `,
      [uuidv4(), storeId],
    );
  }

  private buildBaseCurrency(isDefault = true): StoreCurrencyResponse {
    return {
      currencyCode: 'YER',
      yerPerUnit: 1,
      decimalDigits: 0,
      roundingIncrement: 1,
      isDefault,
      isActive: true,
    };
  }

  private toCurrencyResponse(row: StoreCurrencyRecord): StoreCurrencyResponse {
    return {
      currencyCode: row.currency_code,
      yerPerUnit: Number(row.yer_per_unit),
      decimalDigits: row.decimal_digits,
      roundingIncrement: Number(row.rounding_increment),
      isDefault: row.is_default,
      isActive: row.is_active,
    };
  }

  private toResolvedCurrency(row: StoreCurrencyResponse): ResolvedCurrency {
    return {
      currencyCode: row.currencyCode,
      yerPerUnit: row.yerPerUnit,
      decimalDigits: row.decimalDigits,
      roundingIncrement: row.roundingIncrement,
    };
  }
}
