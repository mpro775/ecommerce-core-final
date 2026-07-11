import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { CheckoutDto } from './dto/checkout.dto';
import { CheckoutQuoteDto } from './dto/checkout-quote.dto';
import { ListStorefrontFiltersQueryDto } from './dto/list-storefront-filters-query.dto';
import { TrackStorefrontEventDto } from './dto/track-storefront-event.dto';
import { TrackOrderQueryDto } from './dto/track-order-query.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { StorefrontService } from './storefront.service';

@ApiTags('storefront')
@Controller('app')
@Public()
export class StorefrontController {
  constructor(private readonly storefrontService: StorefrontService) {}

  @Get('store')
  @ApiOkResponse({ description: 'Get storefront public store info by host' })
  async getStore(@Req() request: Request) {
    return this.storefrontService.getStore(request);
  }

  @Get('categories')
  @ApiOkResponse({ description: 'Get active storefront categories' })
  async listCategories(@Req() request: Request) {
    return this.storefrontService.listCategories(request);
  }

  @Get('filters')
  @ApiOkResponse({ description: 'List storefront filter attributes and values' })
  async listFilters(@Req() request: Request, @Query() query: ListStorefrontFiltersQueryDto) {
    return this.storefrontService.listFilters(request, query);
  }

  @Get('products')
  @ApiOkResponse({ description: 'Get storefront products list' })
  async listProducts(@Req() request: Request) {
    return this.storefrontService.listProducts(request);
  }

  @Get('products/:slug')
  @ApiOkResponse({ description: 'Get storefront product details' })
  async getProduct(@Req() request: Request, @Param('slug') slug: string) {
    return this.storefrontService.getProductDetails(request, slug);
  }

  @Get('policies')
  @ApiOkResponse({ description: 'Get storefront public policies' })
  async getPolicies(@Req() request: Request) {
    return this.storefrontService.getPolicies(request);
  }

  @Get('pages')
  @ApiOkResponse({ description: 'Get published storefront pages' })
  async listPages(@Req() request: Request) {
    return this.storefrontService.listPages(request);
  }

  @Get('pages/:slug')
  @ApiOkResponse({ description: 'Get published storefront page by slug' })
  async getPageBySlug(@Req() request: Request, @Param('slug') slug: string) {
    return this.storefrontService.getPageBySlug(request, slug);
  }

  @Post('events')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOkResponse({ description: 'Track storefront analytics event' })
  async trackEvent(@Req() request: Request, @Body() body: TrackStorefrontEventDto) {
    return this.storefrontService.trackCustomEvent(request, body);
  }

  @Post('cart/items')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Add product variant to cart' })
  async addCartItem(@Req() request: Request, @Body() body: AddCartItemDto) {
    return this.storefrontService.addCartItem(request, body);
  }

  @Get('cart/:cartId')
  @ApiOkResponse({ description: 'Get cart details by id' })
  async getCart(
    @Req() request: Request,
    @Param('cartId', ParseUUIDPipe) cartId: string,
    @Query('currencyCode') currencyCode?: string,
  ) {
    return this.storefrontService.getCart(request, cartId, currencyCode);
  }

  @Put('cart/:cartId/items/:variantId')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Update cart item quantity' })
  async updateCartItem(
    @Req() request: Request,
    @Param('cartId', ParseUUIDPipe) cartId: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Query('currencyCode') currencyCode: string | undefined,
    @Body() body: UpdateCartItemDto,
  ) {
    return this.storefrontService.updateCartItemQuantity(
      request,
      cartId,
      variantId,
      body.quantity,
      currencyCode,
    );
  }

  @Delete('cart/:cartId/items/:variantId')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Remove cart item' })
  async removeCartItem(
    @Req() request: Request,
    @Param('cartId', ParseUUIDPipe) cartId: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Query('currencyCode') currencyCode?: string,
  ) {
    return this.storefrontService.removeCartItem(request, cartId, variantId, currencyCode);
  }

  @Get('recovery/:token')
  @ApiOkResponse({ description: 'Resolve abandoned cart recovery link and redirect to checkout' })
  async recoverAbandonedCart(@Param('token') token: string, @Res() response: Response) {
    const redirectUrl = await this.storefrontService.resolveAbandonedCartRecovery(token);
    return response.redirect(HttpStatus.FOUND, redirectUrl);
  }

  @Get('recovery/:token/open')
  @ApiOkResponse({ description: 'Track abandoned cart recovery email open pixel' })
  async trackAbandonedCartRecoveryOpen(@Param('token') token: string, @Res() response: Response) {
    await this.storefrontService.trackAbandonedCartRecoveryOpen(token);
    response.setHeader('content-type', 'image/gif');
    response.setHeader('cache-control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.setHeader('pragma', 'no-cache');
    response.setHeader('expires', '0');
    return response
      .status(HttpStatus.OK)
      .send(Buffer.from('R0lGODlhAQABAIABAP///wAAACwAAAAAAQABAAACAkQBADs=', 'base64'));
  }

  @Get('shipping-zones')
  @ApiOkResponse({ description: 'List active shipping zones for checkout' })
  async listShippingZones(@Req() request: Request) {
    return this.storefrontService.listShippingZones(request);
  }

  @Get('fulfillment-options')
  @ApiOkResponse({ description: 'List active delivery and pickup options for checkout' })
  async listFulfillmentOptions(@Req() request: Request) {
    return this.storefrontService.listFulfillmentOptions(request);
  }

  @Post('checkout')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Checkout active cart and create order' })
  async checkout(@Req() request: Request, @Body() body: CheckoutDto) {
    const idempotencyKey = this.extractIdempotencyKey(request);
    return this.storefrontService.checkout(request, body, idempotencyKey);
  }

  @Post('checkout/quote')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Quote checkout totals with optional loyalty redemption' })
  async checkoutQuote(@Req() request: Request, @Body() body: CheckoutQuoteDto) {
    return this.storefrontService.quoteCheckout(request, body);
  }

  @Post('checkout/summary')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Summarize checkout totals with fulfillment selection' })
  async checkoutSummary(@Req() request: Request, @Body() body: CheckoutQuoteDto) {
    return this.storefrontService.quoteCheckout(request, body);
  }

  @Get('restock/track/:token')
  @ApiOkResponse({ description: 'Track restock notification click and redirect to product page' })
  async trackRestock(@Param('token') token: string, @Res() response: Response) {
    const redirectUrl = await this.storefrontService.trackRestockToken(token);
    return response.redirect(HttpStatus.FOUND, redirectUrl);
  }

  @Get('orders/:orderCode/track')
  @ApiOkResponse({ description: 'Track order by order code' })
  async trackOrder(
    @Req() request: Request,
    @Param('orderCode') orderCode: string,
    @Query() query: TrackOrderQueryDto,
  ) {
    return this.storefrontService.trackOrder(request, orderCode, query.phone);
  }

  private extractIdempotencyKey(request: Request): string | undefined {
    const key = request.headers['idempotency-key'];
    if (typeof key === 'string' && key.trim().length > 0) {
      return key.trim();
    }
    return undefined;
  }
}
