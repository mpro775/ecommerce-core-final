import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
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
import { AffiliatesService } from './affiliates.service';
import { CreateAffiliateDto } from './dto/create-affiliate.dto';
import { CreateAffiliateLinkDto } from './dto/create-affiliate-link.dto';
import { CreateAffiliatePayoutBatchDto } from './dto/create-affiliate-payout-batch.dto';
import { ListAffiliateCommissionsQueryDto } from './dto/list-affiliate-commissions-query.dto';
import { MarkAffiliatePayoutPaidDto } from './dto/mark-affiliate-payout-paid.dto';
import { UpdateAffiliateDto } from './dto/update-affiliate.dto';
import { UpdateAffiliateSettingsDto } from './dto/update-affiliate-settings.dto';

@ApiTags('affiliates')
@ApiBearerAuth()
@Controller('affiliates')

@UseGuards(AccessTokenGuard, TenantGuard, PermissionsGuard)
export class AffiliatesController {
  constructor(private readonly affiliatesService: AffiliatesService) {}

  @Get('settings')
  @RequirePermissions(PERMISSIONS.affiliatesRead)
  @ApiOkResponse({ description: 'Get affiliate system settings' })
  getSettings(@CurrentUser() currentUser: AuthUser) {
    return this.affiliatesService.getSettings(currentUser);
  }

  @Put('settings')
  @RequirePermissions(PERMISSIONS.affiliatesWrite)
  @ApiOkResponse({ description: 'Update affiliate system settings' })
  updateSettings(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: UpdateAffiliateSettingsDto,
    @Req() request: Request,
  ) {
    return this.affiliatesService.updateSettings(currentUser, body, getRequestContext(request));
  }

  @Post()
  @RequirePermissions(PERMISSIONS.affiliatesWrite)
  @ApiOkResponse({ description: 'Create affiliate profile' })
  createAffiliate(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: CreateAffiliateDto,
    @Req() request: Request,
  ) {
    return this.affiliatesService.createAffiliate(currentUser, body, getRequestContext(request));
  }

  @Get()
  @RequirePermissions(PERMISSIONS.affiliatesRead)
  @ApiOkResponse({ description: 'List affiliates' })
  listAffiliates(@CurrentUser() currentUser: AuthUser, @Query('q') q?: string) {
    return this.affiliatesService.listAffiliates(currentUser, q);
  }

  @Put(':affiliateId')
  @RequirePermissions(PERMISSIONS.affiliatesWrite)
  @ApiOkResponse({ description: 'Update affiliate profile' })
  updateAffiliate(
    @CurrentUser() currentUser: AuthUser,
    @Param('affiliateId', ParseUUIDPipe) affiliateId: string,
    @Body() body: UpdateAffiliateDto,
    @Req() request: Request,
  ) {
    return this.affiliatesService.updateAffiliate(
      currentUser,
      affiliateId,
      body,
      getRequestContext(request),
    );
  }

  @Post(':affiliateId/links')
  @RequirePermissions(PERMISSIONS.affiliatesWrite)
  @ApiOkResponse({ description: 'Create affiliate link' })
  createLink(
    @CurrentUser() currentUser: AuthUser,
    @Param('affiliateId', ParseUUIDPipe) affiliateId: string,
    @Body() body: CreateAffiliateLinkDto,
    @Req() request: Request,
  ) {
    return this.affiliatesService.createLink(
      currentUser,
      affiliateId,
      body,
      getRequestContext(request),
    );
  }

  @Get(':affiliateId/links')
  @RequirePermissions(PERMISSIONS.affiliatesRead)
  @ApiOkResponse({ description: 'List links for one affiliate' })
  listLinks(
    @CurrentUser() currentUser: AuthUser,
    @Param('affiliateId', ParseUUIDPipe) affiliateId: string,
  ) {
    return this.affiliatesService.listLinks(currentUser, affiliateId);
  }

  @Get('commissions')
  @RequirePermissions(PERMISSIONS.affiliatesRead)
  @ApiOkResponse({ description: 'List affiliate commissions' })
  listCommissions(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: ListAffiliateCommissionsQueryDto,
  ) {
    return this.affiliatesService.listCommissions(currentUser, query);
  }

  @Post('payout-batches')
  @RequirePermissions(PERMISSIONS.affiliatesWrite)
  @ApiOkResponse({ description: 'Create payout batch from approved commissions' })
  createPayoutBatch(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: CreateAffiliatePayoutBatchDto,
    @Req() request: Request,
  ) {
    return this.affiliatesService.createPayoutBatch(currentUser, body, getRequestContext(request));
  }

  @Get('payout-batches')
  @RequirePermissions(PERMISSIONS.affiliatesRead)
  @ApiOkResponse({ description: 'List payout batches' })
  listPayoutBatches(@CurrentUser() currentUser: AuthUser) {
    return this.affiliatesService.listPayoutBatches(currentUser);
  }

  @Post('payout-batches/:batchId/mark-paid')
  @RequirePermissions(PERMISSIONS.affiliatesWrite)
  @ApiOkResponse({ description: 'Mark payout batch as paid' })
  markPayoutBatchPaid(
    @CurrentUser() currentUser: AuthUser,
    @Param('batchId', ParseUUIDPipe) batchId: string,
    @Body() body: MarkAffiliatePayoutPaidDto,
    @Req() request: Request,
  ) {
    return this.affiliatesService.markPayoutBatchPaid(
      currentUser,
      batchId,
      body,
      getRequestContext(request),
    );
  }

  @Get('reports/export')
  @RequirePermissions(PERMISSIONS.affiliatesRead)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="affiliate-commissions.csv"')
  @ApiOkResponse({ description: 'Export affiliate commissions report as CSV' })
  exportReport(@CurrentUser() currentUser: AuthUser) {
    return this.affiliatesService.exportCommissionsCsv(currentUser);
  }
}
