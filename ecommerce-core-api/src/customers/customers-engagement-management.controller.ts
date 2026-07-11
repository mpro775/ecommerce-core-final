import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { CustomerEngagementService } from './customer-engagement.service';
import { ListManagedQuestionsQueryDto } from './dto/list-managed-questions-query.dto';
import { ListManagedRestockStatsQueryDto } from './dto/list-managed-restock-stats-query.dto';
import { ListManagedReviewsQueryDto } from './dto/list-managed-reviews-query.dto';
import { ModerateQuestionDto } from './dto/moderate-question.dto';
import { ModerateReviewDto } from './dto/moderate-review.dto';

@ApiTags('customers')
@ApiBearerAuth()
@Controller('customers/manage')
@UseGuards(AccessTokenGuard, TenantGuard, PermissionsGuard)
export class CustomersEngagementManagementController {
  constructor(private readonly engagementService: CustomerEngagementService) {}

  @Get('reviews')
  @RequirePermissions(PERMISSIONS.customersRead)
  @ApiOkResponse({ description: 'List product reviews for moderation' })
  async listReviews(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: ListManagedReviewsQueryDto,
  ) {
    return this.engagementService.listManagedReviews({
      currentUser,
      q: query.q?.trim() ?? null,
      status: query.status ?? null,
      productId: query.productId ?? null,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  @Patch('reviews/:reviewId/moderation')
  @RequirePermissions(PERMISSIONS.customersWrite)
  @ApiOkResponse({ description: 'Approve/hide review' })
  async moderateReview(
    @CurrentUser() currentUser: AuthUser,
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @Body() body: ModerateReviewDto,
    @Req() request: Request,
  ) {
    return this.engagementService.updateReviewModeration({
      currentUser,
      reviewId,
      status: body.status,
      context: getRequestContext(request),
    });
  }

  @Get('questions')
  @RequirePermissions(PERMISSIONS.customersRead)
  @ApiOkResponse({ description: 'List product questions for moderation' })
  async listQuestions(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: ListManagedQuestionsQueryDto,
  ) {
    return this.engagementService.listManagedQuestions({
      currentUser,
      q: query.q?.trim() ?? null,
      status: query.status ?? null,
      productId: query.productId ?? null,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  @Patch('questions/:questionId/moderation')
  @RequirePermissions(PERMISSIONS.customersWrite)
  @ApiOkResponse({ description: 'Answer and moderate question' })
  async moderateQuestion(
    @CurrentUser() currentUser: AuthUser,
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Body() body: ModerateQuestionDto,
    @Req() request: Request,
  ) {
    return this.engagementService.updateQuestionModeration({
      currentUser,
      questionId,
      answer: body.answer?.trim() ?? null,
      status: body.status,
      context: getRequestContext(request),
    });
  }

  @Get('restock/overview')
  @RequirePermissions(PERMISSIONS.customersRead)
  @ApiOkResponse({ description: 'Get restock notifications overview metrics' })
  async getRestockOverview(@CurrentUser() currentUser: AuthUser) {
    return this.engagementService.getRestockOverview(currentUser);
  }

  @Get('restock/products')
  @RequirePermissions(PERMISSIONS.customersRead)
  @ApiOkResponse({ description: 'Get restock notifications metrics grouped by product' })
  async listRestockProducts(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: ListManagedRestockStatsQueryDto,
  ) {
    return this.engagementService.listRestockProductStats({
      currentUser,
      q: query.q?.trim() ?? null,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }
}
