import { SetMetadata } from '@nestjs/common';

export const IS_CUSTOMER_PUBLIC_KEY = 'isCustomerPublicRoute';
export const CustomerPublic = () => SetMetadata(IS_CUSTOMER_PUBLIC_KEY, true);
