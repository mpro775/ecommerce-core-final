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
import { AssignSupportTicketDto } from './dto/assign-support-ticket.dto';
import { CreateSupportMessageDto } from './dto/create-support-message.dto';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { ListSupportTicketsQueryDto } from './dto/list-support-tickets-query.dto';
import { UpdateSupportTicketStatusDto } from './dto/update-support-ticket-status.dto';
import { SupportService } from './support.service';

@ApiTags('support')
@ApiBearerAuth()
@Controller('support')
@UseGuards(AccessTokenGuard, TenantGuard, PermissionsGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('tickets')
  @RequirePermissions(PERMISSIONS.customersWrite)
  @ApiOkResponse({ description: 'Create support ticket as store user' })
  async createTicket(
    @CurrentUser() currentUser: AuthUser,
    @Body() body: CreateSupportTicketDto,
    @Req() request: Request,
  ) {
    return this.supportService.createTicketByStoreUser(
      currentUser,
      body,
      getRequestContext(request),
    );
  }

  @Get('tickets')
  @RequirePermissions(PERMISSIONS.customersRead)
  @ApiOkResponse({ description: 'List support tickets' })
  async listTickets(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: ListSupportTicketsQueryDto,
  ) {
    return this.supportService.listTicketsForStore(currentUser, query);
  }

  @Get('tickets/:ticketId')
  @RequirePermissions(PERMISSIONS.customersRead)
  @ApiOkResponse({ description: 'Get support ticket details' })
  async getTicket(
    @CurrentUser() currentUser: AuthUser,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
  ) {
    return this.supportService.getTicketForStore(currentUser, ticketId);
  }

  @Post('tickets/:ticketId/messages')
  @RequirePermissions(PERMISSIONS.customersWrite)
  @ApiOkResponse({ description: 'Add support ticket message' })
  async addMessage(
    @CurrentUser() currentUser: AuthUser,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Body() body: CreateSupportMessageDto,
    @Req() request: Request,
  ) {
    return this.supportService.addMessageByStoreUser(
      currentUser,
      ticketId,
      body,
      getRequestContext(request),
    );
  }

  @Patch('tickets/:ticketId/status')
  @RequirePermissions(PERMISSIONS.customersWrite)
  @ApiOkResponse({ description: 'Update support ticket status' })
  async updateStatus(
    @CurrentUser() currentUser: AuthUser,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Body() body: UpdateSupportTicketStatusDto,
    @Req() request: Request,
  ) {
    return this.supportService.updateStatusByStoreUser(
      currentUser,
      ticketId,
      body,
      getRequestContext(request),
    );
  }

  @Patch('tickets/:ticketId/assign')
  @RequirePermissions(PERMISSIONS.customersWrite)
  @ApiOkResponse({ description: 'Assign support ticket' })
  async assignTicket(
    @CurrentUser() currentUser: AuthUser,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Body() body: AssignSupportTicketDto,
    @Req() request: Request,
  ) {
    return this.supportService.assignByStoreUser(
      currentUser,
      ticketId,
      body,
      getRequestContext(request),
    );
  }
}
