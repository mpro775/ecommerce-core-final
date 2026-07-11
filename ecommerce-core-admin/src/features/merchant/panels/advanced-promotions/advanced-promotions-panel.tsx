import { PromotionsPanel } from '../promotions';
import type { MerchantRequester } from '../../merchant-dashboard.types';

interface AdvancedPromotionsPanelProps {
  request: MerchantRequester;
}

export function AdvancedPromotionsPanel({ request }: AdvancedPromotionsPanelProps) {
  return <PromotionsPanel request={request} mode="advanced" />;
}
