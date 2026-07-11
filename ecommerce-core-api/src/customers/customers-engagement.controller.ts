import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { getRequestContext } from '../common/utils/request-context.util';
import { StoreResolverService } from '../storefront/store-resolver.service';
import { CurrentCustomer } from './decorators/current-customer.decorator';
import { CustomerPublic } from './decorators/customer-public.decorator';
import { CreateProductQuestionDto } from './dto/create-product-question.dto';
import { ListPublicQuestionsQueryDto } from './dto/list-public-questions-query.dto';
import { CustomerAccessTokenGuard } from './guards/customer-access-token.guard';
import type { CustomerUser } from './interfaces/customer-user.interface';
import { CustomerEngagementService } from './customer-engagement.service';

@ApiTags('customers')
@Controller('customers')
@UseGuards(CustomerAccessTokenGuard)
export class CustomersEngagementController {
  constructor(
    private readonly engagementService: CustomerEngagementService,
    private readonly storeResolverService: StoreResolverService,
  ) {}

  @CustomerPublic()
  @Get('products/:productId/questions')
  @ApiOkResponse({ description: 'List approved product questions and answers' })
  async listPublicQuestions(
    @Req() request: Request,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query() query: ListPublicQuestionsQueryDto,
  ) {
    const store = await this.storeResolverService.resolve(request);
    return this.engagementService.listPublicProductQuestions(
      store.id,
      productId,
      query.limit ?? 20,
      query.offset ?? 0,
    );
  }

  @ApiBearerAuth()
  @Post('products/:productId/questions')
  @ApiOkResponse({ description: 'Create a product question (pending moderation)' })
  async createQuestion(
    @CurrentCustomer() customer: CustomerUser,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() body: CreateProductQuestionDto,
    @Req() request: Request,
  ) {
    return this.engagementService.createProductQuestion(
      customer,
      productId,
      body.question.trim(),
      getRequestContext(request),
    );
  }

  @ApiBearerAuth()
  @Post('products/:productId/restock-subscriptions')
  @ApiOkResponse({ description: 'Subscribe customer to back-in-stock notifications' })
  async subscribeRestock(
    @CurrentCustomer() customer: CustomerUser,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Req() request: Request,
  ) {
    return this.engagementService.subscribeToRestock(
      customer,
      productId,
      getRequestContext(request),
    );
  }
}
