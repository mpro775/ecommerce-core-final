import { ApiProperty } from '@nestjs/swagger';
import { ORDER_STATUSES } from '../constants/order-status.constants';
import { PAYMENT_STATUSES } from '../../payments/constants/payment.constants';

export class MoneyTotalsDto {
  @ApiProperty() subtotalAmount!: string; @ApiProperty() discountAmount!: string;
  @ApiProperty() shippingAmount!: string; @ApiProperty() taxAmount!: string;
  @ApiProperty() totalAmount!: string; @ApiProperty() paidAmount!: string;
  @ApiProperty() refundedAmount!: string; @ApiProperty() refundableAmount!: string;
  @ApiProperty() currency!: string;
}
export class FulfillmentSummaryDto {
  @ApiProperty({enum:['delivery','pickup','external_shipping','manual_coordination']}) type!: string;
  @ApiProperty({enum:['unfulfilled','preparing','ready','out_for_delivery','fulfilled','failed','cancelled']}) status!: string;
  @ApiProperty() statusLabel!: string;
}
export class CustomerSummaryDto { @ApiProperty({type:String,nullable:true}) id!:string|null;
  @ApiProperty({type:String,nullable:true}) name!:string|null; @ApiProperty({type:String,nullable:true}) phone!:string|null; }
export class PaymentSummaryDto { @ApiProperty({type:String,nullable:true}) method!:string|null;
  @ApiProperty({type:String,nullable:true}) methodCode!:string|null; @ApiProperty({type:String,nullable:true}) methodName!:string|null;
  @ApiProperty({enum:PAYMENT_STATUSES,nullable:true}) status!:string|null; }
export class OrderSummaryDto {
  @ApiProperty() id!:string; @ApiProperty() orderNumber!:string;
  @ApiProperty({enum:ORDER_STATUSES}) status!:string; @ApiProperty() statusLabel!:string;
  @ApiProperty({type:FulfillmentSummaryDto}) fulfillment!:FulfillmentSummaryDto;
  @ApiProperty({type:MoneyTotalsDto}) totals!:MoneyTotalsDto; @ApiProperty() version!:number;
  @ApiProperty({type:String,nullable:true}) note!:string|null;
  @ApiProperty({format:'date-time'}) createdAt!:string; @ApiProperty({format:'date-time'}) updatedAt!:string;
  @ApiProperty({type:CustomerSummaryDto}) customer!:CustomerSummaryDto;
  @ApiProperty({type:PaymentSummaryDto}) paymentSummary!:PaymentSummaryDto;
}
export class PaginationMetaDto { @ApiProperty() page!:number; @ApiProperty() limit!:number;
  @ApiProperty() total!:number; @ApiProperty() totalPages!:number; }
export class OrderListSummaryDto { @ApiProperty({additionalProperties:{type:'number'}}) statusCounts!:Record<string,number>; }
export class PaginatedOrdersDto { @ApiProperty({type:[OrderSummaryDto]}) data!:OrderSummaryDto[];
  @ApiProperty({type:PaginationMetaDto}) meta!:PaginationMetaDto;
  @ApiProperty({type:OrderListSummaryDto}) summary!:OrderListSummaryDto; }
export class AllowedTransitionDto { @ApiProperty() command!:string; @ApiProperty() toStatus!:string;
  @ApiProperty() requiresReason!:boolean; }
export class AllowedTransitionsDto { @ApiProperty({type:[AllowedTransitionDto]}) order!:AllowedTransitionDto[];
  @ApiProperty({type:[AllowedTransitionDto]}) fulfillment!:AllowedTransitionDto[];
  @ApiProperty({type:[AllowedTransitionDto]}) payment!:AllowedTransitionDto[]; }
export class OrderItemSnapshotDto { @ApiProperty() id!:string; @ApiProperty() productId!:string;
  @ApiProperty() variantId!:string; @ApiProperty() title!:string; @ApiProperty() sku!:string;
  @ApiProperty() unitPrice!:string; @ApiProperty() quantity!:number; @ApiProperty() lineSubtotal!:string;
  @ApiProperty() discountAmount!:string; @ApiProperty() lineTotal!:string; @ApiProperty() currency!:string; }
export class OrderPaymentDto { @ApiProperty() id!:string; @ApiProperty() method!:string;
  @ApiProperty({enum:PAYMENT_STATUSES}) status!:string; @ApiProperty() statusLabel!:string;
  @ApiProperty() amount!:string; @ApiProperty() paidAmount!:string; @ApiProperty() refundedAmount!:string;
  @ApiProperty() refundableAmount!:string; @ApiProperty() currency!:string;
  @ApiProperty({type:String,nullable:true}) receiptUrl!:string|null;
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
  @ApiProperty({type:String,nullable:true}) reviewedBy!:string|null;
  @ApiProperty({type:String,format:'date-time',nullable:true}) reviewedAt!:string|null;
  @ApiProperty({type:String,nullable:true}) reviewNote!:string|null;
}
export class OrderTimelineDto { @ApiProperty({type:String,nullable:true}) from!:string|null;
  @ApiProperty() to!:string; @ApiProperty({type:String,nullable:true}) note!:string|null;
  @ApiProperty({format:'date-time'}) createdAt!:string; }
export class CommercialHistoryDto { @ApiProperty({type:String,nullable:true}) from!:string|null;
  @ApiProperty() to!:string; @ApiProperty() command!:string;
  @ApiProperty({type:String,nullable:true}) reason!:string|null; @ApiProperty() actorType!:string;
  @ApiProperty({format:'date-time'}) createdAt!:string; }
export class InventoryReservationSummaryDto { @ApiProperty() id!:string; @ApiProperty() variantId!:string;
  @ApiProperty() quantity!:number; @ApiProperty() status!:string;
  @ApiProperty({format:'date-time'}) reservedAt!:string;
  @ApiProperty({format:'date-time'}) expiresAt!:string;
  @ApiProperty({type:String,format:'date-time',nullable:true}) releasedAt!:string|null;
  @ApiProperty({type:String,format:'date-time',nullable:true}) consumedAt!:string|null;
  @ApiProperty({type:String,nullable:true}) releaseReason!:string|null; }
export class CommercialAuditTimelineDto { @ApiProperty() action!:string; @ApiProperty() actorType!:string;
  @ApiProperty({type:Object,nullable:true}) before!:Record<string,unknown>|null;
  @ApiProperty({type:Object,nullable:true}) after!:Record<string,unknown>|null;
  @ApiProperty({type:Object}) metadata!:Record<string,unknown>;
  @ApiProperty({format:'date-time'}) createdAt!:string; }
export class OrderDetailDto extends OrderSummaryDto {
  @ApiProperty({type:[OrderItemSnapshotDto]}) items!:OrderItemSnapshotDto[];
  @ApiProperty({type:[OrderTimelineDto]}) timeline!:OrderTimelineDto[];
  @ApiProperty({type:[CommercialHistoryDto]}) fulfillmentHistory!:CommercialHistoryDto[];
  @ApiProperty({type:[CommercialHistoryDto]}) paymentHistory!:CommercialHistoryDto[];
  @ApiProperty({type:[InventoryReservationSummaryDto]}) inventoryReservations!:InventoryReservationSummaryDto[];
  @ApiProperty({type:[CommercialAuditTimelineDto]}) auditTimeline!:CommercialAuditTimelineDto[];
  @ApiProperty({type:OrderPaymentDto,nullable:true}) payment!:OrderPaymentDto|null;
  @ApiProperty({type:AllowedTransitionsDto}) allowedTransitions!:AllowedTransitionsDto;
}
