import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { CreateWebhookEndpointDto } from './dto/create-webhook-endpoint.dto';
import { ListWebhookDeliveriesQueryDto } from './dto/list-webhook-deliveries-query.dto';
import { TriggerWebhookEventDto } from './dto/trigger-webhook-event.dto';
import { UpdateWebhookEndpointDto } from './dto/update-webhook-endpoint.dto';
import { WebhooksService } from './webhooks.service';

@ApiTags('webhooks')
@ApiBearerAuth()
@Controller('webhooks')
@UseGuards(AccessTokenGuard, TenantGuard, PermissionsGuard)
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.webhooksRead)
  @ApiOkResponse({ description: 'List webhook endpoints' })
  async listEndpoints(@CurrentUser() user: AuthUser) {
    return this.webhooksService.listEndpoints(user);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.webhooksWrite)
  @ApiOkResponse({ description: 'Create webhook endpoint' })
  async createEndpoint(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateWebhookEndpointDto,
    @Req() request: Request,
  ) {
    return this.webhooksService.createEndpoint(user, body, getRequestContext(request));
  }

  @Patch(':endpointId')
  @RequirePermissions(PERMISSIONS.webhooksWrite)
  @ApiOkResponse({ description: 'Update webhook endpoint' })
  async updateEndpoint(
    @CurrentUser() user: AuthUser,
    @Param('endpointId', ParseUUIDPipe) endpointId: string,
    @Body() body: UpdateWebhookEndpointDto,
    @Req() request: Request,
  ) {
    return this.webhooksService.updateEndpoint(user, endpointId, body, getRequestContext(request));
  }

  @Delete(':endpointId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.webhooksWrite)
  async deleteEndpoint(
    @CurrentUser() user: AuthUser,
    @Param('endpointId', ParseUUIDPipe) endpointId: string,
    @Req() request: Request,
  ) {
    await this.webhooksService.deleteEndpoint(user, endpointId, getRequestContext(request));
  }

  @Get('deliveries')
  @RequirePermissions(PERMISSIONS.webhooksRead)
  @ApiOkResponse({ description: 'List webhook deliveries' })
  async listDeliveries(
    @CurrentUser() user: AuthUser,
    @Query() query: ListWebhookDeliveriesQueryDto,
  ) {
    return this.webhooksService.listDeliveries(user, query);
  }

  @Post('deliveries/:deliveryId/retry')
  @RequirePermissions(PERMISSIONS.webhooksWrite)
  @ApiOkResponse({ description: 'Retry a webhook delivery' })
  async retryDelivery(
    @CurrentUser() user: AuthUser,
    @Param('deliveryId', ParseUUIDPipe) deliveryId: string,
    @Req() request: Request,
  ) {
    return this.webhooksService.retryDelivery(user, deliveryId, getRequestContext(request));
  }

  @Post('deliveries/retry-pending')
  @RequirePermissions(PERMISSIONS.webhooksWrite)
  @ApiOkResponse({ description: 'Process pending retries now' })
  async retryPending() {
    return this.webhooksService.processPendingRetries();
  }

  @Post('test-event')
  @RequirePermissions(PERMISSIONS.webhooksWrite)
  @ApiOkResponse({ description: 'Trigger a test webhook event' })
  async triggerEvent(
    @CurrentUser() user: AuthUser,
    @Body() body: TriggerWebhookEventDto,
    @Req() request: Request,
  ) {
    return this.webhooksService.triggerEvent(user, body, getRequestContext(request));
  }
}
