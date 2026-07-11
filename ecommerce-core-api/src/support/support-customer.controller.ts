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
import { getRequestContext } from '../common/utils/request-context.util';
import { CurrentCustomer } from '../customers/decorators/current-customer.decorator';
import { CreateCustomerSupportTicketDto } from './dto/create-customer-support-ticket.dto';
import { CreateSupportMessageDto } from './dto/create-support-message.dto';
import { ListSupportTicketsQueryDto } from './dto/list-support-tickets-query.dto';
import { UpdateSupportTicketStatusDto } from './dto/update-support-ticket-status.dto';
import { SupportService } from './support.service';
import { CustomerAccessTokenGuard } from '../customers/guards/customer-access-token.guard';
import type { CustomerUser } from '../customers/interfaces/customer-user.interface';

@ApiTags('support')
@ApiBearerAuth()
@Controller('customers/support')
@UseGuards(CustomerAccessTokenGuard)
export class SupportCustomerController {
  constructor(private readonly supportService: SupportService) {}

  @Post('tickets')
  @ApiOkResponse({ description: 'Create support ticket as customer' })
  async createTicket(
    @CurrentCustomer() customer: CustomerUser,
    @Body() body: CreateCustomerSupportTicketDto,
    @Req() request: Request,
  ) {
    return this.supportService.createTicketByCustomer(customer, body, getRequestContext(request));
  }

  @Get('tickets')
  @ApiOkResponse({ description: 'List customer support tickets' })
  async listTickets(
    @CurrentCustomer() customer: CustomerUser,
    @Query() query: ListSupportTicketsQueryDto,
  ) {
    return this.supportService.listTicketsForCustomer(customer, query);
  }

  @Get('tickets/:ticketId')
  @ApiOkResponse({ description: 'Get customer support ticket details' })
  async getTicket(
    @CurrentCustomer() customer: CustomerUser,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
  ) {
    return this.supportService.getTicketForCustomer(customer, ticketId);
  }

  @Post('tickets/:ticketId/messages')
  @ApiOkResponse({ description: 'Add customer support ticket message' })
  async addMessage(
    @CurrentCustomer() customer: CustomerUser,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Body() body: CreateSupportMessageDto,
    @Req() request: Request,
  ) {
    return this.supportService.addMessageByCustomer(
      customer,
      ticketId,
      body,
      getRequestContext(request),
    );
  }

  @Patch('tickets/:ticketId/status')
  @ApiOkResponse({ description: 'Update customer support ticket status' })
  async updateStatus(
    @CurrentCustomer() customer: CustomerUser,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Body() body: UpdateSupportTicketStatusDto,
    @Req() request: Request,
  ) {
    return this.supportService.updateStatusByCustomer(
      customer,
      ticketId,
      body,
      getRequestContext(request),
    );
  }
}
