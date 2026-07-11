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
import { CreateFilterDto } from './dto/create-filter.dto';
import { CreateFilterValueDto } from './dto/create-filter-value.dto';
import { ListFiltersQueryDto } from './dto/list-filters-query.dto';
import { UpdateFilterDto } from './dto/update-filter.dto';
import { UpdateFilterValueDto } from './dto/update-filter-value.dto';
import { UpsertProductFilterSelectionsDto } from './dto/upsert-product-filter-selections.dto';
import {
  FiltersService,
  type FilterResponse,
  type FilterValueResponse,
  type ProductFilterSelectionsResponse,
} from './filters.service';

@ApiTags('filters')
@ApiBearerAuth()
@Controller('filters')
@UseGuards(AccessTokenGuard, TenantGuard, PermissionsGuard)
export class FiltersController {
  constructor(private readonly filtersService: FiltersService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.filtersWrite)
  @ApiCreatedResponse({ description: 'Create filter' })
  async create(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: CreateFilterDto,
    @Req() request: Request,
  ): Promise<FilterResponse> {
    return this.filtersService.createFilter(currentUser, body, getRequestContext(request));
  }

  @Get()
  @RequirePermissions(PERMISSIONS.filtersRead)
  @ApiOkResponse({ description: 'List filters' })
  async list(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: ListFiltersQueryDto,
  ): Promise<FilterResponse[]> {
    return this.filtersService.listFilters(currentUser, query);
  }

  @Get(':filterId')
  @RequirePermissions(PERMISSIONS.filtersRead)
  @ApiOkResponse({ description: 'Get filter details' })
  async getById(
    @CurrentUser() currentUser: AuthUser,
    @Param('filterId', ParseUUIDPipe) filterId: string,
  ): Promise<FilterResponse> {
    return this.filtersService.getFilter(currentUser, filterId);
  }

  @Put(':filterId')
  @RequirePermissions(PERMISSIONS.filtersWrite)
  @ApiOkResponse({ description: 'Update filter' })
  async update(
    @CurrentUser() currentUser: AuthUser,
    @Param('filterId', ParseUUIDPipe) filterId: string,
    @Body() body: UpdateFilterDto,
    @Req() request: Request,
  ): Promise<FilterResponse> {
    return this.filtersService.updateFilter(
      currentUser,
      filterId,
      body,
      getRequestContext(request),
    );
  }

  @Delete(':filterId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.filtersWrite)
  @ApiNoContentResponse({ description: 'Delete filter' })
  async remove(
    @CurrentUser() currentUser: AuthUser,
    @Param('filterId', ParseUUIDPipe) filterId: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.filtersService.deleteFilter(currentUser, filterId, getRequestContext(request));
  }

  @Get(':filterId/values')
  @RequirePermissions(PERMISSIONS.filtersRead)
  @ApiOkResponse({ description: 'List filter values' })
  async listValues(
    @CurrentUser() currentUser: AuthUser,
    @Param('filterId', ParseUUIDPipe) filterId: string,
  ): Promise<FilterValueResponse[]> {
    return this.filtersService.listFilterValues(currentUser, filterId);
  }

  @Post(':filterId/values')
  @RequirePermissions(PERMISSIONS.filtersWrite)
  @ApiCreatedResponse({ description: 'Create filter value' })
  async createValue(
    @CurrentUser() currentUser: AuthUser,
    @Param('filterId', ParseUUIDPipe) filterId: string,
    @Body() body: CreateFilterValueDto,
    @Req() request: Request,
  ): Promise<FilterValueResponse> {
    return this.filtersService.createFilterValue(
      currentUser,
      filterId,
      body,
      getRequestContext(request),
    );
  }

  @Put(':filterId/values/:valueId')
  @RequirePermissions(PERMISSIONS.filtersWrite)
  @ApiOkResponse({ description: 'Update filter value' })
  async updateValue(
    @CurrentUser() currentUser: AuthUser,
    @Param('filterId', ParseUUIDPipe) filterId: string,
    @Param('valueId', ParseUUIDPipe) valueId: string,
    @Body() body: UpdateFilterValueDto,
    @Req() request: Request,
  ): Promise<FilterValueResponse> {
    return this.filtersService.updateFilterValue(
      currentUser,
      filterId,
      valueId,
      body,
      getRequestContext(request),
    );
  }

  @Delete(':filterId/values/:valueId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.filtersWrite)
  @ApiNoContentResponse({ description: 'Delete filter value' })
  async deleteValue(
    @CurrentUser() currentUser: AuthUser,
    @Param('filterId', ParseUUIDPipe) filterId: string,
    @Param('valueId', ParseUUIDPipe) valueId: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.filtersService.deleteFilterValue(
      currentUser,
      filterId,
      valueId,
      getRequestContext(request),
    );
  }

  @Get('products/:productId/selections')
  @RequirePermissions(PERMISSIONS.filtersRead, PERMISSIONS.productsRead)
  @ApiOkResponse({ description: 'Get product filter selections' })
  async getProductSelections(
    @CurrentUser() currentUser: AuthUser,
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<ProductFilterSelectionsResponse> {
    return this.filtersService.getProductSelections(currentUser, productId);
  }

  @Put('products/:productId/selections')
  @RequirePermissions(PERMISSIONS.filtersWrite, PERMISSIONS.productsWrite)
  @ApiOkResponse({ description: 'Replace product filter selections' })
  async setProductSelections(
    @CurrentUser() currentUser: AuthUser,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() body: UpsertProductFilterSelectionsDto,
    @Req() request: Request,
  ): Promise<ProductFilterSelectionsResponse> {
    return this.filtersService.setProductSelections(
      currentUser,
      productId,
      {
        valueIds: body.valueIds ?? [],
        ranges: body.ranges ?? [],
      },
      getRequestContext(request),
    );
  }
}
