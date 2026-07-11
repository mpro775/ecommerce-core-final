import { PartialType } from '@nestjs/swagger';
import { CreateAdvancedOfferDto } from './create-advanced-offer.dto';

export class UpdateAdvancedOfferDto extends PartialType(CreateAdvancedOfferDto) {}
