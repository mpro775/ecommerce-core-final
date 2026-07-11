import { PartialType } from '@nestjs/swagger';
import { CreateStorePageDto } from './create-store-page.dto';

export class UpdateStorePageDto extends PartialType(CreateStorePageDto) {}
