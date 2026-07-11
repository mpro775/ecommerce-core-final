import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PERMISSIONS } from '../auth/constants/permission.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { getRequestContext } from '../common/utils/request-context.util';
import { RequirePermissions } from '../rbac/decorators/permissions.decorator';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { TenantGuard } from '../tenancy/guards/tenant.guard';
import { ApplyCouponDto } from './dto/apply-coupon.dto';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { CreateOfferDto } from './dto/create-offer.dto';
import { ListPromotionsQueryDto } from './dto/list-promotions-query.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import {
  PromotionsService,
  type CouponApplyResult,
  type CouponResponse,
  type OfferResponse,
} from './promotions.service';

@ApiTags('promotions')
@ApiBearerAuth()
@Controller('promotions')
@UseGuards(AccessTokenGuard, TenantGuard, PermissionsGuard)
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Post('coupons')
  @RequirePermissions(PERMISSIONS.storeWrite)
  @ApiCreatedResponse({ description: 'Create coupon' })
  async createCoupon(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: CreateCouponDto,
    @Req() request: Request,
  ): Promise<CouponResponse> {
    return this.promotionsService.createCoupon(currentUser, body, getRequestContext(request));
  }

  @Get('coupons')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'List coupons' })
  async listCoupons(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: ListPromotionsQueryDto,
  ): Promise<CouponResponse[]> {
    return this.promotionsService.listCoupons(currentUser, query);
  }

  @Put('coupons/:couponId')
  @RequirePermissions(PERMISSIONS.storeWrite)
  @ApiOkResponse({ description: 'Update coupon' })
  async updateCoupon(
    @CurrentUser() currentUser: AuthUser,
    @Param('couponId', ParseUUIDPipe) couponId: string,
    @Body() body: UpdateCouponDto,
    @Req() request: Request,
  ): Promise<CouponResponse> {
    return this.promotionsService.updateCoupon(
      currentUser,
      couponId,
      body,
      getRequestContext(request),
    );
  }

  @Post('coupons/apply')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'Validate and compute coupon discount' })
  async applyCoupon(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: ApplyCouponDto,
  ): Promise<CouponApplyResult> {
    return this.promotionsService.applyCoupon(currentUser, body);
  }

  @Post('offers')
  @RequirePermissions(PERMISSIONS.storeWrite)
  @ApiCreatedResponse({ description: 'Create offer' })
  async createOffer(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: CreateOfferDto,
    @Req() request: Request,
  ): Promise<OfferResponse> {
    return this.promotionsService.createOffer(currentUser, body, getRequestContext(request));
  }

  @Get('offers')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'List offers' })
  async listOffers(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: ListPromotionsQueryDto,
  ): Promise<OfferResponse[]> {
    return this.promotionsService.listOffers(currentUser, query);
  }

  @Put('offers/:offerId')
  @RequirePermissions(PERMISSIONS.storeWrite)
  @ApiOkResponse({ description: 'Update offer' })
  async updateOffer(
    @CurrentUser() currentUser: AuthUser,
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @Body() body: UpdateOfferDto,
    @Req() request: Request,
  ): Promise<OfferResponse> {
    return this.promotionsService.updateOffer(
      currentUser,
      offerId,
      body,
      getRequestContext(request),
    );
  }
}
