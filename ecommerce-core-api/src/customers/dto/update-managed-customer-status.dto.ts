import { IsBoolean } from 'class-validator';

export class UpdateManagedCustomerStatusDto {
  @IsBoolean()
  isActive!: boolean;
}
