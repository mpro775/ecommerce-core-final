import { ApiProperty } from '@nestjs/swagger';
import { PAYMENT_STATUSES } from '../constants/payment.constants';
import { AllowedTransitionDto, PaginationMetaDto } from '../../orders/dto/order-response.dto';
export class PaymentDto { @ApiProperty() id!:string; @ApiProperty() orderId!:string;
  @ApiProperty() method!:string; @ApiProperty({enum:PAYMENT_STATUSES}) status!:string;
  @ApiProperty() statusLabel!:string; @ApiProperty() amount!:string; @ApiProperty() paidAmount!:string;
  @ApiProperty() refundedAmount!:string; @ApiProperty() refundableAmount!:string;
  @ApiProperty() currency!:string; @ApiProperty() version!:number; @ApiProperty() submissionVersion!:number;
  @ApiProperty({type:String,nullable:true}) storePaymentMethodId!:string|null;
  @ApiProperty({type:String,nullable:true}) paymentMethodCatalogId!:string|null;
  @ApiProperty({type:String,nullable:true}) paymentMethodCode!:string|null;
  @ApiProperty({type:String,nullable:true}) paymentMethodName!:string|null;
  @ApiProperty({type:String,nullable:true}) accountName!:string|null;
  @ApiProperty({type:String,nullable:true}) accountNumber!:string|null;
  @ApiProperty({type:String,nullable:true}) phoneNumber!:string|null;
  @ApiProperty({type:String,nullable:true}) iban!:string|null;
  @ApiProperty({type:String,nullable:true}) instructionsAr!:string|null;
  @ApiProperty({type:String,nullable:true}) instructionsEn!:string|null;
  @ApiProperty({type:String,nullable:true}) payerReference!:string|null;
  @ApiProperty({type:String,nullable:true}) payerReceiptUrl!:string|null;
  @ApiProperty({type:String,nullable:true}) payerReceiptMediaAssetId!:string|null;
  @ApiProperty({type:String,nullable:true}) payerNote!:string|null;
  @ApiProperty({type:String,format:'date-time',nullable:true}) customerSubmittedAt!:string|null;
  @ApiProperty({type:String,nullable:true}) receiptUrl!:string|null;
  @ApiProperty({type:String,nullable:true}) receiptMediaAssetId!:string|null;
  @ApiProperty({type:String,format:'date-time',nullable:true}) reviewedAt!:string|null;
  @ApiProperty({type:String,nullable:true}) reviewedBy!:string|null;
  @ApiProperty({type:String,nullable:true}) reviewNote!:string|null;
  @ApiProperty({type:String,format:'date-time',nullable:true}) customerUploadedAt!:string|null;
  @ApiProperty({format:'date-time'}) createdAt!:string; @ApiProperty({format:'date-time'}) updatedAt!:string;
  @ApiProperty({type:[AllowedTransitionDto]}) allowedTransitions!:AllowedTransitionDto[]; }
export class PaymentWithOrderDto extends PaymentDto { @ApiProperty() orderNumber!:string;
  @ApiProperty() orderStatus!:string; @ApiProperty() orderTotal!:string; }
export class PaginatedPaymentsDto { @ApiProperty({type:[PaymentWithOrderDto]}) data!:PaymentWithOrderDto[];
  @ApiProperty({type:PaginationMetaDto}) meta!:PaginationMetaDto; }
