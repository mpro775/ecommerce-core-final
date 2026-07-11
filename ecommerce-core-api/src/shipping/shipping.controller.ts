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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { PERMISSIONS } from '../auth/constants/permission.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { getRequestContext } from '../common/utils/request-context.util';
import { RequirePermissions } from '../rbac/decorators/permissions.decorator';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { TenantGuard } from '../tenancy/guards/tenant.guard';
import { CreateShippingMethodDto } from './dto/create-shipping-method.dto';
import { CreateShippingZoneDto } from './dto/create-shipping-zone.dto';
import { ListShippingZonesQueryDto } from './dto/list-shipping-zones-query.dto';
import { QuickFulfillmentSetupDto } from './dto/quick-fulfillment-setup.dto';
import { UpdateShippingMethodDto } from './dto/update-shipping-method.dto';
import { UpdateShippingZoneDto } from './dto/update-shipping-zone.dto';
import {
  ShippingService,
  type FulfillmentSettingsResponse,
  type ShippingMethodResponse,
  type ShippingZoneResponse,
} from './shipping.service';

@ApiTags('shipping')
@ApiBearerAuth()
@Controller('shipping-zones')
@UseGuards(AccessTokenGuard, TenantGuard, PermissionsGuard)
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.storeWrite)
  @ApiCreatedResponse({ description: 'Create shipping zone' })
  async create(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: CreateShippingZoneDto,
    @Req() request: Request,
  ): Promise<ShippingZoneResponse> {
    return this.shippingService.create(currentUser, body, getRequestContext(request));
  }

  @Get()
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'List shipping zones' })
  async list(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: ListShippingZonesQueryDto,
  ): Promise<ShippingZoneResponse[]> {
    return this.shippingService.list(currentUser, query);
  }

  @Put(':zoneId')
  @RequirePermissions(PERMISSIONS.storeWrite)
  @ApiOkResponse({ description: 'Update shipping zone' })
  async update(
    @CurrentUser() currentUser: AuthUser,
    @Param('zoneId', ParseUUIDPipe) zoneId: string,
    @Body() body: UpdateShippingZoneDto,
    @Req() request: Request,
  ): Promise<ShippingZoneResponse> {
    return this.shippingService.update(currentUser, zoneId, body, getRequestContext(request));
  }

  @Delete(':zoneId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.storeWrite)
  @ApiNoContentResponse({ description: 'Delete shipping zone' })
  async remove(
    @CurrentUser() currentUser: AuthUser,
    @Param('zoneId', ParseUUIDPipe) zoneId: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.shippingService.remove(currentUser, zoneId, getRequestContext(request));
  }

  @Get(':zoneId/methods')
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'List shipping methods for zone' })
  async listMethods(
    @CurrentUser() currentUser: AuthUser,
    @Param('zoneId', ParseUUIDPipe) zoneId: string,
  ): Promise<ShippingMethodResponse[]> {
    return this.shippingService.listMethods(currentUser, zoneId);
  }

  @Post(':zoneId/methods')
  @RequirePermissions(PERMISSIONS.storeWrite)
  @ApiCreatedResponse({ description: 'Create shipping method' })
  async createMethod(
    @CurrentUser() currentUser: AuthUser,
    @Param('zoneId', ParseUUIDPipe) zoneId: string,
    @Body() body: CreateShippingMethodDto,
    @Req() request: Request,
  ): Promise<ShippingMethodResponse> {
    return this.shippingService.createMethod(currentUser, zoneId, body, getRequestContext(request));
  }

  @Put(':zoneId/methods/:methodId')
  @RequirePermissions(PERMISSIONS.storeWrite)
  @ApiOkResponse({ description: 'Update shipping method' })
  async updateMethod(
    @CurrentUser() currentUser: AuthUser,
    @Param('zoneId', ParseUUIDPipe) zoneId: string,
    @Param('methodId', ParseUUIDPipe) methodId: string,
    @Body() body: UpdateShippingMethodDto,
    @Req() request: Request,
  ): Promise<ShippingMethodResponse> {
    return this.shippingService.updateMethod(
      currentUser,
      zoneId,
      methodId,
      body,
      getRequestContext(request),
    );
  }

  @Delete(':zoneId/methods/:methodId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.storeWrite)
  @ApiNoContentResponse({ description: 'Delete shipping method' })
  async removeMethod(
    @CurrentUser() currentUser: AuthUser,
    @Param('zoneId', ParseUUIDPipe) zoneId: string,
    @Param('methodId', ParseUUIDPipe) methodId: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.shippingService.removeMethod(
      currentUser,
      zoneId,
      methodId,
      getRequestContext(request),
    );
  }
}

@ApiTags('fulfillment')
@ApiBearerAuth()
@Controller('merchant/fulfillment')
@UseGuards(AccessTokenGuard, TenantGuard, PermissionsGuard)
export class MerchantFulfillmentController {
  constructor(private readonly shippingService: ShippingService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'Get merchant fulfillment settings and readiness' })
  async getSettings(@CurrentUser() currentUser: AuthUser): Promise<FulfillmentSettingsResponse> {
    return this.shippingService.getFulfillmentSettings(currentUser);
  }

  @Post('quick-setup')
  @RequirePermissions(PERMISSIONS.storeWrite)
  @ApiCreatedResponse({ description: 'Create suggested fulfillment setup' })
  async quickSetup(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: QuickFulfillmentSetupDto,
    @Req() request: Request,
  ): Promise<FulfillmentSettingsResponse> {
    return this.shippingService.quickSetup(currentUser, body, getRequestContext(request));
  }

  @Post('zones')
  @RequirePermissions(PERMISSIONS.storeWrite)
  @ApiCreatedResponse({ description: 'Create fulfillment zone' })
  async createZone(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: CreateShippingZoneDto,
    @Req() request: Request,
  ): Promise<ShippingZoneResponse> {
    return this.shippingService.create(currentUser, body, getRequestContext(request));
  }

  @Put('zones/:zoneId')
  @RequirePermissions(PERMISSIONS.storeWrite)
  @ApiOkResponse({ description: 'Update fulfillment zone' })
  async updateZone(
    @CurrentUser() currentUser: AuthUser,
    @Param('zoneId', ParseUUIDPipe) zoneId: string,
    @Body() body: UpdateShippingZoneDto,
    @Req() request: Request,
  ): Promise<ShippingZoneResponse> {
    return this.shippingService.update(currentUser, zoneId, body, getRequestContext(request));
  }

  @Delete('zones/:zoneId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.storeWrite)
  @ApiNoContentResponse({ description: 'Delete fulfillment zone' })
  async removeZone(
    @CurrentUser() currentUser: AuthUser,
    @Param('zoneId', ParseUUIDPipe) zoneId: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.shippingService.remove(currentUser, zoneId, getRequestContext(request));
  }

  @Post('zones/:zoneId/methods')
  @RequirePermissions(PERMISSIONS.storeWrite)
  @ApiCreatedResponse({ description: 'Create fulfillment method' })
  async createMethod(
    @CurrentUser() currentUser: AuthUser,
    @Param('zoneId', ParseUUIDPipe) zoneId: string,
    @Body() body: CreateShippingMethodDto,
    @Req() request: Request,
  ): Promise<ShippingMethodResponse> {
    return this.shippingService.createMethod(currentUser, zoneId, body, getRequestContext(request));
  }

  @Put('zones/:zoneId/methods/:methodId')
  @RequirePermissions(PERMISSIONS.storeWrite)
  @ApiOkResponse({ description: 'Update fulfillment method' })
  async updateMethod(
    @CurrentUser() currentUser: AuthUser,
    @Param('zoneId', ParseUUIDPipe) zoneId: string,
    @Param('methodId', ParseUUIDPipe) methodId: string,
    @Body() body: UpdateShippingMethodDto,
    @Req() request: Request,
  ): Promise<ShippingMethodResponse> {
    return this.shippingService.updateMethod(
      currentUser,
      zoneId,
      methodId,
      body,
      getRequestContext(request),
    );
  }

  @Delete('zones/:zoneId/methods/:methodId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.storeWrite)
  @ApiNoContentResponse({ description: 'Delete fulfillment method' })
  async removeMethod(
    @CurrentUser() currentUser: AuthUser,
    @Param('zoneId', ParseUUIDPipe) zoneId: string,
    @Param('methodId', ParseUUIDPipe) methodId: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.shippingService.removeMethod(
      currentUser,
      zoneId,
      methodId,
      getRequestContext(request),
    );
  }
}
