import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PERMISSIONS } from '../auth/constants/permission.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { getRequestContext } from '../common/utils/request-context.util';
import { RequirePermissions } from '../rbac/decorators/permissions.decorator';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { TenantGuard } from '../tenancy/guards/tenant.guard';
import { StoreSlugAvailabilityQueryDto } from './dto/store-slug-availability-query.dto';
import { UpdateStoreCurrenciesDto } from './dto/update-store-currencies.dto';
import { UpdateStoreSettingsDto } from './dto/update-store-settings.dto';
import {
  type StoreSlugAvailabilityResponse,
  StoresService,
  type StoreAccessibilityReportResponse,
  type StoreSettingsOptionsResponse,
  type StoreSettingsResponse,
} from './stores.service';
import type { AltTextCoverageResponse } from '../media/media.service';

@ApiTags('store')
@ApiBearerAuth()
@Controller('store')
@UseGuards(AccessTokenGuard, TenantGuard, PermissionsGuard)
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Get('settings')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'Get store settings' })
  async getSettings(@CurrentUser() user: AuthUser): Promise<StoreSettingsResponse> {
    return this.storesService.getSettings(user);
  }

  @Get('settings/options')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'Get store settings options' })
  getSettingsOptions(): StoreSettingsOptionsResponse {
    return this.storesService.getSettingsOptions();
  }

  @Get('slug-availability')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'Check store slug format and availability' })
  checkSlugAvailability(
    @CurrentUser() user: AuthUser,
    @Query() query: StoreSlugAvailabilityQueryDto,
  ): Promise<StoreSlugAvailabilityResponse> {
    return this.storesService.checkSlugAvailability(user, query.slug);
  }

  @Put('settings')
  @RequirePermissions(PERMISSIONS.storeWrite)
  @ApiOkResponse({ description: 'Update store settings' })
  async updateSettings(
    @CurrentUser() user: AuthUser,
    @Body() body: UpdateStoreSettingsDto,
    @Req() request: Request,
  ): Promise<StoreSettingsResponse> {
    return this.storesService.updateSettings(user, body, getRequestContext(request));
  }

  @Get('currencies')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'Get enabled store currencies' })
  async getCurrencies(@CurrentUser() user: AuthUser) {
    return this.storesService.getCurrencies(user);
  }

  @Put('currencies')
  @RequirePermissions(PERMISSIONS.storeWrite)
  @ApiOkResponse({ description: 'Replace enabled store currencies' })
  async updateCurrencies(
    @CurrentUser() user: AuthUser,
    @Body() body: UpdateStoreCurrenciesDto,
    @Req() request: Request,
  ) {
    return this.storesService.updateCurrencies(
      user,
      body.currencies.map((currency) => ({
        currencyCode: currency.currencyCode,
        yerPerUnit: currency.yerPerUnit,
        decimalDigits: currency.decimalDigits ?? (currency.currencyCode === 'YER' ? 0 : 2),
        roundingIncrement:
          currency.roundingIncrement ?? (currency.currencyCode === 'YER' ? 1 : 0.01),
        isDefault: Boolean(currency.isDefault),
        isActive: true,
      })),
      getRequestContext(request),
    );
  }
}

@ApiTags('stores')
@ApiBearerAuth()
@Controller('stores')
@UseGuards(AccessTokenGuard, TenantGuard, PermissionsGuard)
export class StoreAccessibilityController {
  constructor(private readonly storesService: StoresService) {}

  @Get(':storeId/media/alt-text-coverage')
  @RequirePermissions(PERMISSIONS.mediaWrite)
  @ApiOkResponse({ description: 'Get store media alt text coverage report' })
  async getAltTextCoverage(
    @CurrentUser() user: AuthUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
  ): Promise<AltTextCoverageResponse> {
    return this.storesService.getAltTextCoverage(user, storeId);
  }

  @Get(':storeId/accessibility/report')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'Get complete store accessibility report' })
  async getAccessibilityReport(
    @CurrentUser() user: AuthUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Req() request: Request,
  ): Promise<StoreAccessibilityReportResponse> {
    return this.storesService.getAccessibilityReport(user, storeId, getRequestContext(request));
  }
}
