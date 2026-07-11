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
import { CategoriesService, type CategoryResponse } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { ListCategoriesQueryDto } from './dto/list-categories-query.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('categories')
@ApiBearerAuth()
@Controller('categories')
@UseGuards(AccessTokenGuard, TenantGuard, PermissionsGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.categoriesWrite)
  @ApiOkResponse({ description: 'Create category' })
  async create(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: CreateCategoryDto,
    @Req() request: Request,
  ): Promise<CategoryResponse> {
    return this.categoriesService.create(currentUser, body, getRequestContext(request));
  }

  @Get()
  @RequirePermissions(PERMISSIONS.categoriesRead)
  @ApiOkResponse({ description: 'List categories' })
  async list(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: ListCategoriesQueryDto,
  ): Promise<CategoryResponse[]> {
    return this.categoriesService.list(currentUser, query);
  }

  @Get(':categoryId')
  @RequirePermissions(PERMISSIONS.categoriesRead)
  @ApiOkResponse({ description: 'Get category details' })
  async getById(
    @CurrentUser() currentUser: AuthUser,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ): Promise<CategoryResponse> {
    return this.categoriesService.getById(currentUser, categoryId);
  }

  @Put(':categoryId')
  @RequirePermissions(PERMISSIONS.categoriesWrite)
  @ApiOkResponse({ description: 'Update category' })
  async update(
    @CurrentUser() currentUser: AuthUser,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() body: UpdateCategoryDto,
    @Req() request: Request,
  ): Promise<CategoryResponse> {
    return this.categoriesService.update(currentUser, categoryId, body, getRequestContext(request));
  }

  @Delete(':categoryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.categoriesWrite)
  async remove(
    @CurrentUser() currentUser: AuthUser,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.categoriesService.delete(currentUser, categoryId, getRequestContext(request));
  }
}
