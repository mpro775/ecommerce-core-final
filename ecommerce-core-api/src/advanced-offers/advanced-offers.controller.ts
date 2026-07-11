import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
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
import { AdvancedOffersService, type AdvancedOfferResponse } from './advanced-offers.service';
import { CreateAdvancedOfferDto } from './dto/create-advanced-offer.dto';
import { UpdateAdvancedOfferDto } from './dto/update-advanced-offer.dto';

@ApiTags('advanced-offers')
@ApiBearerAuth()
@Controller('advanced-offers')
@UseGuards(AccessTokenGuard, TenantGuard, PermissionsGuard)
export class AdvancedOffersController {
  constructor(private readonly advancedOffersService: AdvancedOffersService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.storeWrite)
  @ApiCreatedResponse({ description: 'Create advanced offer' })
  async create(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: CreateAdvancedOfferDto,
    @Req() request: Request,
  ): Promise<AdvancedOfferResponse> {
    return this.advancedOffersService.create(currentUser, body, getRequestContext(request));
  }

  @Get()
  @RequirePermissions(PERMISSIONS.storeRead)
  @ApiOkResponse({ description: 'List advanced offers' })
  async list(@CurrentUser() currentUser: AuthUser): Promise<AdvancedOfferResponse[]> {
    return this.advancedOffersService.list(currentUser);
  }

  @Put(':offerId')
  @RequirePermissions(PERMISSIONS.storeWrite)
  @ApiOkResponse({ description: 'Update advanced offer' })
  async update(
    @CurrentUser() currentUser: AuthUser,
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @Body() body: UpdateAdvancedOfferDto,
    @Req() request: Request,
  ): Promise<AdvancedOfferResponse> {
    return this.advancedOffersService.update(
      currentUser,
      offerId,
      body,
      getRequestContext(request),
    );
  }
}
