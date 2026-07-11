import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Patch,
  Put,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { getRequestContext } from '../common/utils/request-context.util';
import { StoreResolverService } from '../storefront/store-resolver.service';
import {
  CustomersService,
  type CustomerProfileResponse,
  type CustomerAddressResponse,
  type WishlistItemResponse,
  type ProductReviewResponse,
  type ProductReviewStatsResponse,
  type CustomerOrderResponse,
} from './customers.service';
import { CustomerAccessTokenGuard } from './guards/customer-access-token.guard';
import { CurrentCustomer } from './decorators/current-customer.decorator';
import { CustomerPublic } from './decorators/customer-public.decorator';
import type { CustomerUser, CustomerAuthResult } from './interfaces/customer-user.interface';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { CustomerLoginDto } from './dto/customer-login.dto';
import { CustomerForgotPasswordDto } from './dto/customer-forgot-password.dto';
import { CustomerResetPasswordDto } from './dto/customer-reset-password.dto';
import { CustomerRefreshTokenDto } from './dto/customer-refresh-token.dto';
import { UpdateCustomerProfileDto } from './dto/update-customer-profile.dto';
import { CreateCustomerAddressDto } from './dto/create-customer-address.dto';
import { CreateCustomerReviewDto } from './dto/create-customer-review.dto';
import { UpdateCustomerReviewDto } from './dto/update-customer-review.dto';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { ListLoyaltyLedgerQueryDto } from '../loyalty/dto/list-loyalty-ledger-query.dto';

@ApiTags('customers')
@Controller('customers')
@UseGuards(CustomerAccessTokenGuard)
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly storeResolverService: StoreResolverService,
    private readonly loyaltyService: LoyaltyService,
  ) {}

  @CustomerPublic()
  @Post('register')
  @ApiOkResponse({ description: 'Register a new customer' })
  async register(
    @Body() body: RegisterCustomerDto,
    @Req() request: Request,
  ): Promise<CustomerAuthResult> {
    const store = await this.storeResolverService.resolve(request);
    return this.customersService.register(body, store.id, getRequestContext(request));
  }

  @CustomerPublic()
  @Post('login')
  @ApiOkResponse({ description: 'Login customer' })
  async login(
    @Body() body: CustomerLoginDto,
    @Req() request: Request,
  ): Promise<CustomerAuthResult> {
    const store = await this.storeResolverService.resolve(request);
    return this.customersService.login(body, store.id, getRequestContext(request));
  }

  @CustomerPublic()
  @Post('refresh')
  @ApiOkResponse({ description: 'Refresh customer token' })
  async refresh(
    @Body() body: CustomerRefreshTokenDto,
    @Req() request: Request,
  ): Promise<CustomerAuthResult> {
    const store = await this.storeResolverService.resolve(request);
    return this.customersService.refresh(body, store.id, getRequestContext(request));
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOkResponse({ description: 'Logout customer' })
  async logout(@CurrentCustomer() customer: CustomerUser, @Req() request: Request): Promise<void> {
    await this.customersService.logout(customer, getRequestContext(request));
  }

  @CustomerPublic()
  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOkResponse({ description: 'Request password reset' })
  async forgotPassword(
    @Body() body: CustomerForgotPasswordDto,
    @Req() request: Request,
  ): Promise<void> {
    const store = await this.storeResolverService.resolve(request);
    await this.customersService.requestPasswordReset(body, store.id);
  }

  @CustomerPublic()
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOkResponse({ description: 'Reset password with token' })
  async resetPassword(
    @Body() body: CustomerResetPasswordDto,
    @Req() request: Request,
  ): Promise<void> {
    const store = await this.storeResolverService.resolve(request);
    await this.customersService.resetPassword(body, store.id);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Get current customer profile' })
  async me(@CurrentCustomer() customer: CustomerUser): Promise<CustomerProfileResponse> {
    return this.customersService.getProfile(customer);
  }

  @Patch('me')
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Update customer profile' })
  async updateProfile(
    @CurrentCustomer() customer: CustomerUser,
    @Body() body: UpdateCustomerProfileDto,
    @Req() request: Request,
  ): Promise<CustomerProfileResponse> {
    return this.customersService.updateProfile(customer, body, getRequestContext(request));
  }

  @Get('addresses')
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'List customer addresses' })
  async listAddresses(
    @CurrentCustomer() customer: CustomerUser,
  ): Promise<CustomerAddressResponse[]> {
    return this.customersService.listAddresses(customer);
  }

  @Post('addresses')
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Create new address' })
  async createAddress(
    @CurrentCustomer() customer: CustomerUser,
    @Body() body: CreateCustomerAddressDto,
    @Req() request: Request,
  ): Promise<CustomerAddressResponse> {
    return this.customersService.createAddress(customer, body, getRequestContext(request));
  }

  @Delete('addresses/:addressId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Delete address' })
  async deleteAddress(
    @CurrentCustomer() customer: CustomerUser,
    @Param('addressId') addressId: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.customersService.deleteAddress(customer, addressId, getRequestContext(request));
  }

  // ==================== WISHLIST ====================

  @Get('wishlist')
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'List customer wishlist items' })
  async listWishlist(@CurrentCustomer() customer: CustomerUser): Promise<WishlistItemResponse[]> {
    return this.customersService.listWishlist(customer);
  }

  @Post('wishlist/:productId')
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Add product to wishlist' })
  async addToWishlist(
    @CurrentCustomer() customer: CustomerUser,
    @Param('productId') productId: string,
    @Req() request: Request,
  ): Promise<WishlistItemResponse> {
    return this.customersService.addToWishlist(customer, productId, getRequestContext(request));
  }

  @Delete('wishlist/:productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Remove product from wishlist' })
  async removeFromWishlist(
    @CurrentCustomer() customer: CustomerUser,
    @Param('productId') productId: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.customersService.removeFromWishlist(customer, productId, getRequestContext(request));
  }

  @Get('wishlist/:productId/check')
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Check if product is in wishlist' })
  async checkWishlist(
    @CurrentCustomer() customer: CustomerUser,
    @Param('productId') productId: string,
  ): Promise<{ inWishlist: boolean }> {
    const inWishlist = await this.customersService.isInWishlist(customer, productId);
    return { inWishlist };
  }

  // ==================== REVIEWS ====================

  @Get('reviews')
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'List customer reviews' })
  async listMyReviews(@CurrentCustomer() customer: CustomerUser): Promise<ProductReviewResponse[]> {
    return this.customersService.listCustomerReviews(customer);
  }

  @Post('reviews')
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Create a product review' })
  async createReview(
    @CurrentCustomer() customer: CustomerUser,
    @Body() body: CreateCustomerReviewDto,
    @Req() request: Request,
  ): Promise<ProductReviewResponse> {
    return this.customersService.createReview(customer, body, getRequestContext(request));
  }

  @Patch('reviews/:reviewId')
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Update a review' })
  async updateReview(
    @CurrentCustomer() customer: CustomerUser,
    @Param('reviewId') reviewId: string,
    @Body() body: UpdateCustomerReviewDto,
    @Req() request: Request,
  ): Promise<ProductReviewResponse> {
    return this.customersService.updateReview(customer, reviewId, body, getRequestContext(request));
  }

  @Delete('reviews/:reviewId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Delete a review' })
  async deleteReview(
    @CurrentCustomer() customer: CustomerUser,
    @Param('reviewId') reviewId: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.customersService.deleteReview(customer, reviewId, getRequestContext(request));
  }

  // ==================== PUBLIC REVIEWS ====================

  @CustomerPublic()
  @Get('products/:productId/reviews')
  @ApiOkResponse({ description: 'List product reviews (public)' })
  async listProductReviews(
    @Req() request: Request,
    @Param('productId') productId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{ reviews: ProductReviewResponse[]; stats: ProductReviewStatsResponse }> {
    const store = await this.storeResolverService.resolve(request);
    return this.customersService.listProductReviews(
      store.id,
      productId,
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  // ==================== ORDERS ====================

  @Get('orders')
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'List customer orders' })
  async listOrders(
    @CurrentCustomer() customer: CustomerUser,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{ orders: CustomerOrderResponse[]; total: number }> {
    return this.customersService.getCustomerOrders(
      customer,
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Get('loyalty/wallet')
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Get current customer loyalty wallet' })
  async getLoyaltyWallet(@CurrentCustomer() customer: CustomerUser) {
    return this.loyaltyService.getWalletForCurrentCustomer(customer.id, customer.storeId);
  }

  @Get('loyalty/ledger')
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'List current customer loyalty ledger' })
  async getLoyaltyLedger(
    @CurrentCustomer() customer: CustomerUser,
    @Query() query: ListLoyaltyLedgerQueryDto,
  ) {
    return this.loyaltyService.listLedgerForCurrentCustomer(customer.id, customer.storeId, query);
  }
}
