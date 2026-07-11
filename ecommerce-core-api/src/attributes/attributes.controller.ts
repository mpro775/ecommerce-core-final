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
import { CreateAttributeDto } from './dto/create-attribute.dto';
import { CreateAttributeValueDto } from './dto/create-attribute-value.dto';
import { ListAttributesQueryDto } from './dto/list-attributes-query.dto';
import { ListAttributeValuesQueryDto } from './dto/list-attribute-values-query.dto';
import { UpdateAttributeDto } from './dto/update-attribute.dto';
import { UpdateAttributeValueDto } from './dto/update-attribute-value.dto';
import { UpsertCategoryAttributesDto } from './dto/upsert-category-attributes.dto';
import {
  AttributesService,
  type AttributeResponse,
  type AttributeValueResponse,
  type CategoryAttributesResponse,
} from './attributes.service';

@ApiTags('attributes')
@ApiBearerAuth()
@Controller('attributes')
@UseGuards(AccessTokenGuard, TenantGuard, PermissionsGuard)
export class AttributesController {
  constructor(private readonly attributesService: AttributesService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.attributesWrite)
  @ApiCreatedResponse({ description: 'Create attribute' })
  async create(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: CreateAttributeDto,
    @Req() request: Request,
  ): Promise<AttributeResponse> {
    return this.attributesService.createAttribute(currentUser, body, getRequestContext(request));
  }

  @Get()
  @RequirePermissions(PERMISSIONS.attributesRead)
  @ApiOkResponse({ description: 'List attributes' })
  async list(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: ListAttributesQueryDto,
  ): Promise<AttributeResponse[]> {
    return this.attributesService.listAttributes(currentUser, query);
  }

  @Get('categories/:categoryId/attributes')
  @RequirePermissions(PERMISSIONS.attributesRead, PERMISSIONS.categoriesRead)
  @ApiOkResponse({ description: 'Get category attribute assignments' })
  async getCategoryAttributes(
    @CurrentUser() currentUser: AuthUser,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ): Promise<CategoryAttributesResponse> {
    return this.attributesService.getCategoryAttributes(currentUser, categoryId);
  }

  @Put('categories/:categoryId/attributes')
  @RequirePermissions(PERMISSIONS.attributesWrite, PERMISSIONS.categoriesWrite)
  @ApiOkResponse({ description: 'Replace category attribute assignments' })
  async setCategoryAttributes(
    @CurrentUser() currentUser: AuthUser,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() body: UpsertCategoryAttributesDto,
    @Req() request: Request,
  ): Promise<CategoryAttributesResponse> {
    return this.attributesService.setCategoryAttributes(
      currentUser,
      categoryId,
      body.attributeIds,
      getRequestContext(request),
    );
  }

  @Get(':attributeId')
  @RequirePermissions(PERMISSIONS.attributesRead)
  @ApiOkResponse({ description: 'Get attribute details with values' })
  async getById(
    @CurrentUser() currentUser: AuthUser,
    @Param('attributeId', ParseUUIDPipe) attributeId: string,
  ): Promise<AttributeResponse> {
    return this.attributesService.getAttribute(currentUser, attributeId);
  }

  @Put(':attributeId')
  @RequirePermissions(PERMISSIONS.attributesWrite)
  @ApiOkResponse({ description: 'Update attribute' })
  async update(
    @CurrentUser() currentUser: AuthUser,
    @Param('attributeId', ParseUUIDPipe) attributeId: string,
    @Body() body: UpdateAttributeDto,
    @Req() request: Request,
  ): Promise<AttributeResponse> {
    return this.attributesService.updateAttribute(
      currentUser,
      attributeId,
      body,
      getRequestContext(request),
    );
  }

  @Delete(':attributeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.attributesWrite)
  @ApiNoContentResponse({ description: 'Delete attribute' })
  async remove(
    @CurrentUser() currentUser: AuthUser,
    @Param('attributeId', ParseUUIDPipe) attributeId: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.attributesService.deleteAttribute(
      currentUser,
      attributeId,
      getRequestContext(request),
    );
  }

  @Get(':attributeId/values')
  @RequirePermissions(PERMISSIONS.attributesRead)
  @ApiOkResponse({ description: 'List attribute values' })
  async listValues(
    @CurrentUser() currentUser: AuthUser,
    @Param('attributeId', ParseUUIDPipe) attributeId: string,
    @Query() query: ListAttributeValuesQueryDto,
  ): Promise<AttributeValueResponse[]> {
    return this.attributesService.listAttributeValues(currentUser, attributeId, query);
  }

  @Post(':attributeId/values')
  @RequirePermissions(PERMISSIONS.attributesWrite)
  @ApiCreatedResponse({ description: 'Create attribute value' })
  async createValue(
    @CurrentUser() currentUser: AuthUser,
    @Param('attributeId', ParseUUIDPipe) attributeId: string,
    @Body() body: CreateAttributeValueDto,
    @Req() request: Request,
  ): Promise<AttributeValueResponse> {
    return this.attributesService.createAttributeValue(
      currentUser,
      attributeId,
      body,
      getRequestContext(request),
    );
  }

  @Put(':attributeId/values/:valueId')
  @RequirePermissions(PERMISSIONS.attributesWrite)
  @ApiOkResponse({ description: 'Update attribute value' })
  async updateValue(
    @CurrentUser() currentUser: AuthUser,
    @Param('attributeId', ParseUUIDPipe) attributeId: string,
    @Param('valueId', ParseUUIDPipe) valueId: string,
    @Body() body: UpdateAttributeValueDto,
    @Req() request: Request,
  ): Promise<AttributeValueResponse> {
    return this.attributesService.updateAttributeValue(
      currentUser,
      attributeId,
      valueId,
      body,
      getRequestContext(request),
    );
  }

  @Delete(':attributeId/values/:valueId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.attributesWrite)
  @ApiNoContentResponse({ description: 'Delete attribute value' })
  async deleteValue(
    @CurrentUser() currentUser: AuthUser,
    @Param('attributeId', ParseUUIDPipe) attributeId: string,
    @Param('valueId', ParseUUIDPipe) valueId: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.attributesService.deleteAttributeValue(
      currentUser,
      attributeId,
      valueId,
      getRequestContext(request),
    );
  }
}
