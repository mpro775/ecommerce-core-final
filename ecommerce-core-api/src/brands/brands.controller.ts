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
import { BrandsService, type BrandResponse } from './brands.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { ListBrandsQueryDto } from './dto/list-brands-query.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@ApiTags('brands')
@ApiBearerAuth()
@Controller('brands')
@UseGuards(AccessTokenGuard, TenantGuard, PermissionsGuard)
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.brandsWrite)
  @ApiOkResponse({ description: 'Create brand' })
  async create(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: CreateBrandDto,
    @Req() request: Request,
  ): Promise<BrandResponse> {
    return this.brandsService.create(currentUser, body, getRequestContext(request));
  }

  @Get()
  @RequirePermissions(PERMISSIONS.brandsRead)
  @ApiOkResponse({ description: 'List brands' })
  async list(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: ListBrandsQueryDto,
  ): Promise<BrandResponse[]> {
    return this.brandsService.list(currentUser, query);
  }

  @Get(':brandId')
  @RequirePermissions(PERMISSIONS.brandsRead)
  @ApiOkResponse({ description: 'Get brand details' })
  async getById(
    @CurrentUser() currentUser: AuthUser,
    @Param('brandId', ParseUUIDPipe) brandId: string,
  ): Promise<BrandResponse> {
    return this.brandsService.getById(currentUser, brandId);
  }

  @Put(':brandId')
  @RequirePermissions(PERMISSIONS.brandsWrite)
  @ApiOkResponse({ description: 'Update brand' })
  async update(
    @CurrentUser() currentUser: AuthUser,
    @Param('brandId', ParseUUIDPipe) brandId: string,
    @Body() body: UpdateBrandDto,
    @Req() request: Request,
  ): Promise<BrandResponse> {
    return this.brandsService.update(currentUser, brandId, body, getRequestContext(request));
  }

  @Delete(':brandId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.brandsWrite)
  async remove(
    @CurrentUser() currentUser: AuthUser,
    @Param('brandId', ParseUUIDPipe) brandId: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.brandsService.delete(currentUser, brandId, getRequestContext(request));
  }
}
