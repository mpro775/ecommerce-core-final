import {
  Body,
  Controller,
  Get,
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
import { CreateManagedCustomerDto } from './dto/create-managed-customer.dto';
import { ListManagedCustomersQueryDto } from './dto/list-managed-customers-query.dto';
import { UpdateManagedCustomerStatusDto } from './dto/update-managed-customer-status.dto';
import { UpdateManagedCustomerDto } from './dto/update-managed-customer.dto';
import { CustomersService } from './customers.service';
import { ListManagedAbandonedCartsQueryDto } from './dto/list-managed-abandoned-carts-query.dto';
import { AbandonedCartsService } from './abandoned-carts.service';

@ApiTags('customers')
@ApiBearerAuth()
@Controller('customers/manage')
@UseGuards(AccessTokenGuard, TenantGuard, PermissionsGuard)
export class CustomersManagementController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly abandonedCartsService: AbandonedCartsService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.customersRead)
  @ApiOkResponse({ description: 'List customers for merchant dashboard' })
  async list(@CurrentUser() currentUser: AuthUser, @Query() query: ListManagedCustomersQueryDto) {
    return this.customersService.listManagedCustomers(currentUser, query);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.customersWrite)
  @ApiOkResponse({ description: 'Create customer manually from merchant dashboard' })
  async create(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: CreateManagedCustomerDto,
    @Req() request: Request,
  ) {
    return this.customersService.createManagedCustomer(
      currentUser,
      body,
      getRequestContext(request),
    );
  }

  @Get('abandoned-carts')
  @RequirePermissions(PERMISSIONS.customersRead)
  @ApiOkResponse({ description: 'List abandoned carts for merchant dashboard' })
  async listAbandonedCarts(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: ListManagedAbandonedCartsQueryDto,
  ) {
    return this.abandonedCartsService.listManagedAbandonedCarts({
      currentUser,
      status: query.status ?? null,
      q: query.q?.trim() ?? null,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  @Post('abandoned-carts/:abandonedCartId/send-recovery')
  @RequirePermissions(PERMISSIONS.customersWrite)
  @ApiOkResponse({ description: 'Send abandoned cart recovery email manually' })
  async sendAbandonedCartRecovery(
    @CurrentUser() currentUser: AuthUser,
    @Param('abandonedCartId', ParseUUIDPipe) abandonedCartId: string,
  ) {
    return this.abandonedCartsService.sendManagedRecoveryEmail(currentUser, abandonedCartId);
  }

  @Get(':customerId')
  @RequirePermissions(PERMISSIONS.customersRead)
  @ApiOkResponse({ description: 'Get managed customer details' })
  async getById(
    @CurrentUser() currentUser: AuthUser,
    @Param('customerId', ParseUUIDPipe) customerId: string,
  ) {
    return this.customersService.getManagedCustomerDetails(currentUser, customerId);
  }

  @Patch(':customerId')
  @RequirePermissions(PERMISSIONS.customersWrite)
  @ApiOkResponse({ description: 'Update managed customer profile' })
  async update(
    @CurrentUser() currentUser: AuthUser,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() body: UpdateManagedCustomerDto,
    @Req() request: Request,
  ) {
    return this.customersService.updateManagedCustomer(
      currentUser,
      customerId,
      body,
      getRequestContext(request),
    );
  }

  @Patch(':customerId/status')
  @RequirePermissions(PERMISSIONS.customersWrite)
  @ApiOkResponse({ description: 'Activate/deactivate managed customer' })
  async updateStatus(
    @CurrentUser() currentUser: AuthUser,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() body: UpdateManagedCustomerStatusDto,
    @Req() request: Request,
  ) {
    return this.customersService.updateManagedCustomerStatus(
      currentUser,
      customerId,
      body,
      getRequestContext(request),
    );
  }
}
