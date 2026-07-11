import type { Attribute, Product, Warehouse } from '../../../../types';
import type { MerchantRequester } from '../../../../merchant-dashboard.types';

export { type MerchantRequester };

export interface ProductWarehouseAllocationRow {
  warehouseId: string;
  enabled: boolean;
  quantity: string;
  lowStockThreshold: string;
  reorderPoint: string;
  reservedQuantityReadonly: number;
}

export interface GeneratedVariantDraft {
  id: string;
  title: string;
  sku: string;
  barcode: string;
  price: string;
  compareAtPrice: string;
  stockQuantity: string;
  lowStockThreshold: string;
  selectedValueByAttributeId: Record<string, string>;
  warehouseRows: ProductWarehouseAllocationRow[];
}

export interface VariantForm {
  title: string;
  sku: string;
  barcode: string;
  price: string;
  compareAtPrice: string;
  stockQuantity: string;
  lowStockThreshold: string;
  selectedValueByAttributeId: Record<string, string>;
  isDefault: boolean;
  titleAr: string;
  titleEn: string;
}

export interface ProductVariantsSectionProps {
  request: MerchantRequester;
  selectedProduct: Product | null;
  attributes: Attribute[];
  warehouses: Warehouse[];
  generatedVariantDrafts: GeneratedVariantDraft[];
  setGeneratedVariantDrafts: React.Dispatch<React.SetStateAction<GeneratedVariantDraft[]>>;
  variantForm: VariantForm;
  setVariantForm: React.Dispatch<React.SetStateAction<VariantForm>>;
  selectedVariantAttributeIds: string[];
  setSelectedVariantAttributeIds: React.Dispatch<React.SetStateAction<string[]>>;
  selectedProductWarehouseIds: string[];
  warehousesSaving: boolean;
  selectedVariantId: string;
  setSelectedVariantId: (id: string) => void;
  actionLoading: boolean;
  setMessage: (msg: { text: string; type: 'info' | 'success' | 'error' }) => void;
  onRefresh: () => Promise<void>;
  onLoadProductDetails: (productId: string) => Promise<void>;
  isSingleProduct: boolean;
}
