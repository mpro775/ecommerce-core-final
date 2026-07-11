import { PromotionsPanel } from '../promotions';
import type { MerchantRequester } from '../../merchant-dashboard.types';

interface CouponsPanelProps {
  request: MerchantRequester;
}

export function CouponsPanel({ request }: CouponsPanelProps) {
  return <PromotionsPanel request={request} mode="coupons" />;
}
