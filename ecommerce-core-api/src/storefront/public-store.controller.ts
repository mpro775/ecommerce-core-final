import { Controller, Get, Req } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { CurrencyService } from '../currency/currency.service';
import { SeoService } from '../seo/seo.service';
import { StoresService, type StoreSettingsResponse } from '../stores/stores.service';
import { StoreResolverService } from './store-resolver.service';

interface PublicAppConfigResponse {
  storeId: string;
  storeSlug: string;
  storeSettings: StoreSettingsResponse & {
    email: string | null;
    policies: {
      shippingPolicy: string | null;
      returnPolicy: string | null;
      privacyPolicy: string | null;
      termsAndConditions: string | null;
      loyaltyPolicy: string | null;
    };
    language: 'ar' | 'en';
    seoSettings: Awaited<ReturnType<SeoService['getSettings']>>;
  };
}

@ApiTags('public')
@Controller('app')
@Public()
export class PublicStoreController {
  constructor(
    private readonly storeResolverService: StoreResolverService,
    private readonly storesService: StoresService,
    private readonly currencyService: CurrencyService,
    private readonly seoService: SeoService,
  ) {}

  @Get('config')
  @ApiOkResponse({ description: 'Get public mobile app configuration for the resolved store' })
  async resolve(@Req() request: Request): Promise<PublicAppConfigResponse> {
    const store = await this.storeResolverService.resolve(request);
    const [settings, seoSettings] = await Promise.all([
      this.storesService.getSettingsByStoreId(store.id),
      this.seoService.getSettings({ storeId: store.id }),
    ]);
    const selectedCurrency = await this.currencyService.resolveStoreCurrency(
      store.id,
      this.readCurrencyCode(request),
    );

    return {
      storeId: store.id,
      storeSlug: store.slug,
      storeSettings: {
        ...settings,
        currencyCode: selectedCurrency.currencyCode,
        email: settings.profile.supportEmail,
        policies: {
          shippingPolicy: settings.shippingPolicy,
          returnPolicy: settings.returnPolicy,
          privacyPolicy: settings.privacyPolicy,
          termsAndConditions: settings.termsAndConditions,
          loyaltyPolicy: settings.loyaltyPolicy,
        },
        language: settings.profile.defaultLanguage,
        seoSettings,
      },
    };
  }

  private readCurrencyCode(request: Request): string | undefined {
    const raw = request.query.currencyCode ?? request.headers['x-currency-code'];
    if (Array.isArray(raw)) {
      const first = raw[0];
      return typeof first === 'string' && first.trim().length > 0 ? first.trim() : undefined;
    }
    return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : undefined;
  }
}
