import { Body, Controller, Get, Header, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../auth/constants/permission.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { RequirePermissions } from '../rbac/decorators/permissions.decorator';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { TenantGuard } from '../tenancy/guards/tenant.guard';
import { AnalyticsAnomaliesQueryDto } from './dto/analytics-anomalies-query.dto';
import { AnalyticsGovernanceQueryDto } from './dto/analytics-governance-query.dto';
import { AnalyticsWindowQueryDto } from './dto/analytics-window-query.dto';
import {
  AnalyticsService,
  type AnalyticsAnomalyReportResponse,
  type AbandonedCartMetricsResponse,
  type AnalyticsDataQualityResponse,
  type AnalyticsOverviewResponse,
  type CustomersRetentionResponse,
  type EventTaxonomyResponse,
  type FunnelConversionResponse,
  type FulfillmentSlaResponse,
  type InventoryHealthResponse,
  type OrdersStatusBreakdownResponse,
  type PaymentsPerformanceResponse,
  type PromotionsEfficiencyResponse,
  type SourceAttributionResponse,
  type AffiliatePerformanceResponse,
  type StockoutRiskResponse,
  type TopSellingProductsResponse,
  type AnalyticsGeneralResponse,
  type AnalyticsLiveResponse,
  type AnalyticsProductsResponse,
  type AnalyticsOperationsResponse,
  type AnalyticsPaymentsAdvancedResponse,
  type AnalyticsFinancialResponse,
  type AnalyticsShipmentsResponse,
} from './analytics.service';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')

@UseGuards(AccessTokenGuard, TenantGuard, PermissionsGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('general')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'Get unified general analytics dashboard payload' })
  async getGeneralAnalytics(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: AnalyticsWindowQueryDto,
  ): Promise<AnalyticsGeneralResponse> {
    return this.analyticsService.getGeneralAnalytics(currentUser, query);
  }

  @Get('live')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'Get near real-time analytics dashboard payload' })
  async getLiveAnalytics(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: AnalyticsWindowQueryDto,
  ): Promise<AnalyticsLiveResponse> {
    return this.analyticsService.getLiveAnalytics(currentUser, {
      ...query,
      liveMinutes: query.liveMinutes ?? 15,
    });
  }

  @Get('products')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'Get product analytics table' })
  async getProductsAnalytics(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: AnalyticsWindowQueryDto,
  ): Promise<AnalyticsProductsResponse> {
    return this.analyticsService.getProductsAnalytics(currentUser, query);
  }

  @Get('operations')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'Get operations analytics dashboard payload' })
  async getOperationsAnalytics(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: AnalyticsWindowQueryDto,
  ): Promise<AnalyticsOperationsResponse> {
    return this.analyticsService.getOperationsAnalytics(currentUser, query);
  }

  @Get('payments/advanced')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'Get advanced payments analytics payload' })
  async getPaymentsAdvancedAnalytics(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: AnalyticsWindowQueryDto,
  ): Promise<AnalyticsPaymentsAdvancedResponse> {
    return this.analyticsService.getPaymentsAdvancedAnalytics(currentUser, query);
  }

  @Get('financial')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'Get financial analytics dashboard payload' })
  async getFinancialAnalytics(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: AnalyticsWindowQueryDto,
  ): Promise<AnalyticsFinancialResponse> {
    return this.analyticsService.getFinancialAnalytics(currentUser, query);
  }

  @Get('delivery')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'Get delivery and pickup analytics dashboard payload' })
  async getDeliveryAnalytics(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: AnalyticsWindowQueryDto,
  ): Promise<AnalyticsShipmentsResponse> {
    return this.analyticsService.getShipmentsAnalytics(currentUser, query);
  }

  @Get('shipments')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'Get legacy delivery analytics dashboard payload' })
  async getShipmentsAnalytics(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: AnalyticsWindowQueryDto,
  ): Promise<AnalyticsShipmentsResponse> {
    return this.analyticsService.getShipmentsAnalytics(currentUser, query);
  }

  @Get('reports/customers.csv')
  @RequirePermissions(PERMISSIONS.reportsExport)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportCustomersReportCsv(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: AnalyticsWindowQueryDto,
  ): Promise<string> {
    return this.analyticsService.exportCustomersReportCsv(currentUser, query);
  }

  @Get('reports/sales.csv')
  @RequirePermissions(PERMISSIONS.reportsExport)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportSalesReportCsv(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: AnalyticsWindowQueryDto,
  ): Promise<string> {
    return this.analyticsService.exportSalesReportCsv(currentUser, query);
  }

  @Get('reports/inventory.csv')
  @RequirePermissions(PERMISSIONS.reportsExport)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportInventoryReportCsv(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: AnalyticsWindowQueryDto,
  ): Promise<string> {
    return this.analyticsService.exportInventoryReportCsv(currentUser, query);
  }

  @Get('overview')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'Get merchant analytics overview' })
  async getOverview(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: AnalyticsWindowQueryDto,
  ): Promise<AnalyticsOverviewResponse> {
    return this.analyticsService.getOverview(currentUser, {
      windowDays: query.window ?? 30,
      limit: query.limit ?? 5,
    });
  }

  @Get('orders/status-breakdown')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'Get order status breakdown analytics' })
  async getOrdersStatusBreakdown(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: AnalyticsWindowQueryDto,
  ): Promise<OrdersStatusBreakdownResponse> {
    return this.analyticsService.getOrdersStatusBreakdown(currentUser, query.window ?? 30);
  }

  @Get('products/top-selling')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'Get top-selling products for selected window' })
  async getTopSellingProducts(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: AnalyticsWindowQueryDto,
  ): Promise<TopSellingProductsResponse> {
    return this.analyticsService.getTopSellingProducts(currentUser, {
      windowDays: query.window ?? 30,
      limit: query.limit ?? 5,
    });
  }

  @Get('operations/fulfillment-sla')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'Get fulfillment SLA performance metrics' })
  async getFulfillmentSla(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: AnalyticsWindowQueryDto,
  ): Promise<FulfillmentSlaResponse> {
    return this.analyticsService.getFulfillmentSla(currentUser, query.window ?? 30);
  }

  @Get('payments/performance')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'Get payment performance metrics' })
  async getPaymentsPerformance(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: AnalyticsWindowQueryDto,
  ): Promise<PaymentsPerformanceResponse> {
    return this.analyticsService.getPaymentsPerformance(currentUser, query.window ?? 30);
  }

  @Get('promotions/efficiency')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'Get promotions and coupon efficiency metrics' })
  async getPromotionsEfficiency(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: AnalyticsWindowQueryDto,
  ): Promise<PromotionsEfficiencyResponse> {
    return this.analyticsService.getPromotionsEfficiency(currentUser, {
      windowDays: query.window ?? 30,
      limit: query.limit ?? 5,
    });
  }

  @Get('inventory/health')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'Get inventory health metrics and low-stock insights' })
  async getInventoryHealth(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: AnalyticsWindowQueryDto,
  ): Promise<InventoryHealthResponse> {
    return this.analyticsService.getInventoryHealth(currentUser, {
      windowDays: query.window ?? 30,
      limit: query.limit ?? 5,
    });
  }

  @Get('inventory/stockout-risk')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({
    description: 'Get stockout risk list based on sales velocity and current inventory',
  })
  async getStockoutRisk(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: AnalyticsWindowQueryDto,
  ): Promise<StockoutRiskResponse> {
    return this.analyticsService.getStockoutRisk(currentUser, {
      windowDays: query.window ?? 30,
      limit: query.limit ?? 5,
    });
  }

  @Get('customers/retention')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'Get customer retention and repeat purchase metrics' })
  async getCustomersRetention(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: AnalyticsWindowQueryDto,
  ): Promise<CustomersRetentionResponse> {
    return this.analyticsService.getCustomersRetention(currentUser, {
      windowDays: query.window ?? 30,
      limit: query.limit ?? 5,
    });
  }

  @Get('funnel/conversion')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'Get storefront conversion funnel metrics' })
  async getFunnelConversion(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: AnalyticsWindowQueryDto,
  ): Promise<FunnelConversionResponse> {
    return this.analyticsService.getFunnelConversion(currentUser, query.window ?? 30);
  }

  @Get('funnel/source-attribution')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'Get source attribution metrics for storefront funnel' })
  async getSourceAttribution(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: AnalyticsWindowQueryDto,
  ): Promise<SourceAttributionResponse> {
    return this.analyticsService.getSourceAttribution(currentUser, {
      windowDays: query.window ?? 30,
      limit: query.limit ?? 10,
    });
  }

  @Get('affiliates/performance')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'Get affiliate performance and commission KPIs' })
  async getAffiliatePerformance(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: AnalyticsWindowQueryDto,
  ): Promise<AffiliatePerformanceResponse> {
    return this.analyticsService.getAffiliatePerformance(currentUser, {
      windowDays: query.window ?? 30,
      limit: query.limit ?? 10,
    });
  }

  @Get('funnel/abandoned-carts')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'Get abandoned cart and recovery KPI metrics' })
  async getAbandonedCartsMetrics(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: AnalyticsWindowQueryDto,
  ): Promise<AbandonedCartMetricsResponse> {
    return this.analyticsService.getAbandonedCartMetrics(currentUser, query.window ?? 30);
  }

  @Get('funnel/event-taxonomy')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'Get tracked storefront event taxonomy and volume' })
  async getEventTaxonomy(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: AnalyticsWindowQueryDto,
  ): Promise<EventTaxonomyResponse> {
    return this.analyticsService.getEventTaxonomy(currentUser, {
      windowDays: query.window ?? 30,
      limit: query.limit ?? 20,
    });
  }

  @Get('quality/data-health')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'Get analytics data-quality checks and score' })
  async getDataQuality(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: AnalyticsWindowQueryDto,
  ): Promise<AnalyticsDataQualityResponse> {
    return this.analyticsService.getDataQualityReport(currentUser, query.window ?? 30);
  }

  @Get('quality/anomalies')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'Get analytics anomaly report versus previous window' })
  async getAnomalies(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: AnalyticsAnomaliesQueryDto,
  ): Promise<AnalyticsAnomalyReportResponse> {
    return this.analyticsService.getAnomalyReport(currentUser, {
      windowDays: query.window ?? 30,
      thresholdPercent: query.anomalyThresholdPercent ?? 25,
    });
  }

  @Post('quality/run-monitoring')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'Run governance monitoring and emit critical anomaly alerts' })
  async runMonitoring(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: AnalyticsGovernanceQueryDto,
    @Query() windowQuery: AnalyticsWindowQueryDto,
  ): Promise<{
    quality: AnalyticsDataQualityResponse;
    anomalies: AnalyticsAnomalyReportResponse;
    emittedAlerts: number;
  }> {
    return this.analyticsService.runGovernanceMonitoring(currentUser, {
      windowDays: windowQuery.window ?? 30,
      thresholdPercent: body.anomalyThresholdPercent ?? 25,
    });
  }
}
