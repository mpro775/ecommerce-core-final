import {
  AddIcon,
  ArrowForwardIcon,
  CheckCircleIcon,
  CloudUploadIcon,
  DeleteOutlineIcon,
  DragIndicatorIcon,
  DownloadIcon,
  EditNoteIcon,
  ExpandMoreIcon,
  ImageIcon,
  InventoryIcon,
  SearchIcon,
  StarIcon,
  StyleIcon,
  UploadFileIcon,
} from '../../../../components/icons';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  InputAdornment,
  MenuItem,
  Paper,
  Slider,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';

import type { MerchantRequester } from '../../merchant-dashboard.types';
import { AppPage, DataTableWrapper, FilterBar, FloatingActionButton, PageHeader } from '../../components/ui';
import type {
  Attribute,
  Brand,
  Category,
  Filter,
  MediaAsset,
  PresignedMediaUpload,
  Product,
  ProductFilterSelection,
  ProductImage,
  ProductListResponse,
  ProductStatus,
  ProductType,
  ProductVariant,
  ProductWarehouseLink,
  VariantWarehouseAllocation,
  Warehouse,
} from '../../types';
import { ProductDescriptionEditor, ProductSection } from './components';
import { ProductVariantsSection } from './components/variants/product-variants-section';
import { productStatusColors, productStatusLabels } from './constants';
import { normalizeSlug, sanitizeSlugInput } from '../../utils/slug';
import { firstFieldError, isApiError, type ApiFieldErrors } from '../../../../lib/api-error';

interface ProductsPanelProps {
  request: MerchantRequester;
}

interface ProductCompletionIssue {
  id: string;
  label: string;
  severity: 'warning' | 'error';
}

interface PendingProductImageItem {
  id: string;
  file: File;
  previewUrl: string;
  altText: string;
  variantId: string;
}

interface AttachProductImageForm {
  variantId: string;
  altText: string;
  sortOrder: string;
}

type ProductGalleryItem =
  | {
      key: string;
      source: 'server';
      image: ProductImage;
      url: string;
      altText: string;
    }
  | {
      key: string;
      source: 'pending';
      image: PendingProductImageItem;
      url: string;
      altText: string;
    };

const ACCEPTED_PRODUCT_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

function getServerImageKey(imageId: string): string {
  return `server:${imageId}`;
}

function getPendingImageKey(imageId: string): string {
  return `pending:${imageId}`;
}

function createClientId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatFileSize(bytes: number): string {
  const megabytes = bytes / (1024 * 1024);
  return `${megabytes.toFixed(megabytes >= 10 ? 0 : 2)} MB`;
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('تعذر قراءة الصورة'));
    image.src = src;
  });
}

async function createCroppedImageFile(
  imageUrl: string,
  originalFile: File,
  cropPixels: Area,
): Promise<File> {
  const image = await loadImageElement(imageUrl);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(cropPixels.width));
  canvas.height = Math.max(1, Math.round(cropPixels.height));
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('تعذر تجهيز محرر القص');
  }

  context.drawImage(
    image,
    cropPixels.x,
    cropPixels.y,
    cropPixels.width,
    cropPixels.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  const outputType = originalFile.type === 'image/gif' ? 'image/png' : originalFile.type;
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outputType, 0.92));
  if (!blob) {
    throw new Error('تعذر إنشاء الصورة بعد القص');
  }

  const fileName =
    outputType === originalFile.type
      ? originalFile.name
      : originalFile.name.replace(/\.[^.]+$/, '.png');
  return new File([blob], fileName, { type: outputType, lastModified: Date.now() });
}

const productFormDefault = {
  productType: 'single' as ProductType,
  isVisible: true,
  questionsEnabled: false,
  title: '',
  slug: '',
  description: '',
  categoryId: '',
  status: 'draft' as ProductStatus,
  titleAr: '',
  titleEn: '',
  descriptionAr: '',
  descriptionEn: '',
  shortDescriptionAr: '',
  shortDescriptionEn: '',
  detailedDescriptionAr: '',
  detailedDescriptionEn: '',
};

function createVariantFormDefault() {
  return {
    title: '',
    sku: '',
    barcode: '',
    price: '0',
    compareAtPrice: '',
    stockQuantity: '0',
    lowStockThreshold: '0',
    selectedValueByAttributeId: {} as Record<string, string>,
    isDefault: false,
    titleAr: '',
    titleEn: '',
  };
}

interface CustomFieldRow {
  id: string;
  key: string;
  value: string;
}

interface GeneratedVariantDraft {
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

interface ProductWarehouseAllocationRow {
  warehouseId: string;
  enabled: boolean;
  quantity: string;
  reservedQuantityReadonly: number;
  lowStockThreshold: string;
  reorderPoint: string;
}

function parseTagList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );
}

function joinTagList(tags: string[]): string {
  return tags.join(', ');
}

function getProductPrimaryImage(product: Product): string {
  const image = (product.images ?? []).find((item) => item.isPrimary) ?? product.images?.[0];
  return image?.url?.trim() ?? '';
}

function normalizeSkuPart(value: string): string {
  const normalized = value
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase();
  return normalized || 'PRD';
}

function generateSku(seed: string, existingCount = 0): string {
  const suffix = `${Date.now().toString(36)}${existingCount ? `-${existingCount + 1}` : ''}`.toUpperCase();
  return `${normalizeSkuPart(seed).slice(0, 24)}-${suffix}`;
}

function calculateEan13CheckDigit(firstTwelveDigits: string): number {
  const sum = firstTwelveDigits
    .split('')
    .reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10;
}

function generateEan13(): string {
  const base = `${Date.now()}${Math.floor(Math.random() * 1000000)}`
    .replace(/\D/g, '')
    .slice(-12)
    .padStart(12, '2');
  return `${base}${calculateEan13CheckDigit(base)}`;
}

function formatProductAmount(amount: number, currencyCode = 'YER'): string {
  const fractionDigits = currencyCode === 'YER' ? 0 : 2;
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Number.isFinite(amount) ? amount : 0);
  return `${formatted} ${currencyCode}`;
}

function customFieldsToRows(fields: Array<Record<string, unknown>> | undefined): CustomFieldRow[] {
  if (!Array.isArray(fields)) return [];
  return fields.map((field) => {
    const rawValue = field.value;
    const value =
      rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue) && 'text' in rawValue
        ? String((rawValue as { text?: unknown }).text ?? '')
        : rawValue == null
          ? ''
          : typeof rawValue === 'string'
            ? rawValue
            : JSON.stringify(rawValue);
    return {
      id: createClientId(),
      key: String(field.labelAr ?? field.key ?? ''),
      value,
    };
  });
}

function customFieldRowsToPayload(rows: CustomFieldRow[]): Array<Record<string, unknown>> {
  return rows
    .map((row) => ({
      key: normalizeSlug(row.key) || normalizeSkuPart(row.key).toLowerCase(),
      labelAr: row.key.trim(),
      value: { text: row.value.trim() },
    }))
    .filter((row) => row.labelAr && row.value.text);
}

export function ProductsPanel({ request }: ProductsPanelProps) {
  const importFileRef = useRef<HTMLInputElement | null>(null);
  const imageFileRef = useRef<HTMLInputElement | null>(null);

  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedFilterValueIds, setSelectedFilterValueIds] = useState<string[]>([]);
  const [selectedRangeByFilterId, setSelectedRangeByFilterId] = useState<Record<string, string>>(
    {},
  );

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(true);
  const [expandedProductSections, setExpandedProductSections] = useState<Record<string, boolean>>(
    {},
  );

  const [productForm, setProductForm] = useState(productFormDefault);
  const [variantForm, setVariantForm] = useState(createVariantFormDefault);
  const [pendingImageItems, setPendingImageItems] = useState<PendingProductImageItem[]>([]);
  const [imageGalleryOrder, setImageGalleryOrder] = useState<string[]>([]);
  const [draggedGalleryItemId, setDraggedGalleryItemId] = useState('');
  const [isImageDropActive, setIsImageDropActive] = useState(false);
  const [cropItem, setCropItem] = useState<PendingProductImageItem | null>(null);
  const [cropQueue, setCropQueue] = useState<PendingProductImageItem[]>([]);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [cropZoom, setCropZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const [formBrandId, setFormBrandId] = useState('');
  const [formWeight, setFormWeight] = useState('');
  const [formCostPrice, setFormCostPrice] = useState('');
  const [formSeoTitle, setFormSeoTitle] = useState('');
  const [formSeoDescription, setFormSeoDescription] = useState('');
  const [formDimensionsLength, setFormDimensionsLength] = useState('');
  const [formDimensionsWidth, setFormDimensionsWidth] = useState('');
  const [formDimensionsHeight, setFormDimensionsHeight] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formIsFeatured, setFormIsFeatured] = useState(false);
  const [formIsTaxable, setFormIsTaxable] = useState(false);
  const [formTaxRate, setFormTaxRate] = useState('');
  const [formMinOrderQuantity, setFormMinOrderQuantity] = useState('');
  const [formMaxOrderQuantity, setFormMaxOrderQuantity] = useState('');
  const [formCategoryIds, setFormCategoryIds] = useState<string[]>([]);
  const [formRelatedProductIds, setFormRelatedProductIds] = useState<string[]>([]);
  const [formWeightUnit, setFormWeightUnit] = useState('');
  const [formProductLabel, setFormProductLabel] = useState('');
  const [formYoutubeUrl, setFormYoutubeUrl] = useState('');
  const [formSeoTitleAr, setFormSeoTitleAr] = useState('');
  const [formSeoTitleEn, setFormSeoTitleEn] = useState('');
  const [formSeoDescriptionAr, setFormSeoDescriptionAr] = useState('');
  const [formSeoDescriptionEn, setFormSeoDescriptionEn] = useState('');
  const [formStockUnlimited, setFormStockUnlimited] = useState(false);
  const [formInlineDiscountEnabled, setFormInlineDiscountEnabled] = useState(false);
  const [formInlineDiscountType, setFormInlineDiscountType] = useState<'percent' | 'fixed'>(
    'percent',
  );
  const [formInlineDiscountValue, setFormInlineDiscountValue] = useState('');
  const [formInlineDiscountStartsAt, setFormInlineDiscountStartsAt] = useState('');
  const [formInlineDiscountEndsAt, setFormInlineDiscountEndsAt] = useState('');
  const [formCustomFieldsJson, setFormCustomFieldsJson] = useState('[]');
  const [formTagInput, setFormTagInput] = useState('');
  const [customFieldRows, setCustomFieldRows] = useState<CustomFieldRow[]>([]);
  const [generatedVariantDrafts, setGeneratedVariantDrafts] = useState<GeneratedVariantDraft[]>([]);
  const [selectedVariantAttributeIds, setSelectedVariantAttributeIds] = useState<string[]>([]);
  const [bundleItems, setBundleItems] = useState<
    Array<{ bundledProductId: string; quantity: string }>
  >([]);
  const [digitalFiles, setDigitalFiles] = useState<
    Array<{
      mediaAssetId: string;
      fileName: string;
      sortOrder: string;
      url: string;
      fileSizeBytes: number;
    }>
  >([]);
  const [digitalUploadFile, setDigitalUploadFile] = useState<File | null>(null);
  const [digitalUploadName, setDigitalUploadName] = useState('');
  const [formDigitalDownloadAttemptsLimit, setFormDigitalDownloadAttemptsLimit] = useState('');
  const [formDigitalDownloadExpiresAt, setFormDigitalDownloadExpiresAt] = useState('');
  const [selectedProductWarehouseIds, setSelectedProductWarehouseIds] = useState<string[]>([]);
  const [productWarehouseLinks, setProductWarehouseLinks] = useState<ProductWarehouseLink[]>([]);
  const [warehouseAllocationVariantId, setWarehouseAllocationVariantId] = useState('');
  const [warehouseAllocationRows, setWarehouseAllocationRows] = useState<ProductWarehouseAllocationRow[]>([]);
  const [warehouseSaving, setWarehouseSaving] = useState(false);

  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [message, setMessage] = useState({
    text: '',
    type: 'info' as 'info' | 'success' | 'error',
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [listStatusFilter, setListStatusFilter] = useState<'all' | ProductStatus>('all');
  const [listTypeFilter, setListTypeFilter] = useState<'all' | ProductType>('all');
  const [listCategoryFilter, setListCategoryFilter] = useState('all');

  useEffect(() => {
    loadCatalog().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (productForm.productType === 'digital' || productForm.productType === 'bundled') {
      setFormStockUnlimited(true);
    }
  }, [productForm.productType]);

  useEffect(() => {
    if (!selectedProduct && warehouseAllocationRows.length === 0 && warehouses.length > 0) {
      setWarehouseAllocationRows(buildProductWarehouseAllocationRows(warehouses, []));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct, warehouses]);

  useEffect(
    () => () => {
      pendingImageItems.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      cropQueue.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      if (cropItem) {
        URL.revokeObjectURL(cropItem.previewUrl);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  async function loadCatalog(): Promise<void> {
    setLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      const [productsData, categoriesData, brandsData, attributesData, filtersData, warehousesData] =
        await Promise.all([
          request<ProductListResponse>('/products?page=1&limit=30', { method: 'GET' }),
          request<Category[]>('/categories', { method: 'GET' }),
          request<Brand[]>('/brands?isActive=true', { method: 'GET' }),
          request<Attribute[]>('/attributes?includeValues=true&onlyActive=true', { method: 'GET' }),
          request<Filter[]>('/filters?includeValues=true&onlyActive=true', { method: 'GET' }),
          request<Warehouse[]>('/warehouses', { method: 'GET' }),
        ]);

      setProducts(productsData?.items ?? []);
      setCategories(categoriesData ?? []);
      setBrands(brandsData ?? []);
      setAttributes(attributesData ?? []);
      setFilters(filtersData ?? []);
      setWarehouses(warehousesData ?? []);
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'تعذر تحميل المنتجات',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadProductDetails(productId: string): Promise<void> {
    setDetailLoading(true);
    setViewMode('detail');
    setMessage({ text: '', type: 'info' });
    try {
      const [data, filterSelection] = await Promise.all([
        request<Product>(`/products/${productId}`, { method: 'GET' }),
        request<ProductFilterSelection>(`/filters/products/${productId}/selections`, {
          method: 'GET',
        }),
      ]);
      setSelectedProduct(data ?? null);
      clearPendingImages();
      setImageGalleryOrder(
        (data?.images ?? []).map((image) => getServerImageKey(image.id)),
      );
      setSelectedVariantId('');

      const allManualValueIds = new Set(
        productAssignableFilters.flatMap((filter) => (filter.values ?? []).map((value) => value.id)),
      );
      const allManualFilterIds = new Set(productAssignableFilters.map((filter) => filter.id));

      setSelectedFilterValueIds(
        (filterSelection?.valueIds ?? []).filter((valueId) => allManualValueIds.has(valueId)),
      );
      setSelectedRangeByFilterId(
        (filterSelection?.ranges ?? [])
          .filter((range) => allManualFilterIds.has(range.filterId))
          .reduce<Record<string, string>>((acc, range) => {
            acc[range.filterId] = String(range.numericValue);
            return acc;
          }, {}),
      );

      if (data) {
        setProductForm({
          productType: (data as any).productType ?? 'single',
          isVisible: (data as any).isVisible ?? true,
          questionsEnabled: (data as any).questionsEnabled ?? false,
          title: data.title,
          slug: data.slug,
          description: (data as any).descriptionAr ?? data.description ?? '',
          categoryId: data.categoryId ?? '',
          status: data.status,
          titleAr: (data as any).titleAr ?? data.title,
          titleEn: (data as any).titleEn ?? '',
          descriptionAr: (data as any).descriptionAr ?? data.description ?? '',
          descriptionEn: (data as any).descriptionEn ?? '',
          shortDescriptionAr: (data as any).shortDescriptionAr ?? '',
          shortDescriptionEn: (data as any).shortDescriptionEn ?? '',
          detailedDescriptionAr: (data as any).detailedDescriptionAr ?? '',
          detailedDescriptionEn: (data as any).detailedDescriptionEn ?? '',
        });

        const d = data as any;
        setFormBrandId(d.brandId ?? '');
        setFormWeight(d.weight != null ? String(d.weight) : '');
        setFormWeightUnit(d.weightUnit ?? '');
        setFormCostPrice(d.costPrice != null ? String(d.costPrice) : '');
        setFormSeoTitle(d.seoTitle ?? '');
        setFormSeoDescription(d.seoDescription ?? '');
        setFormSeoTitleAr(d.seoTitleAr ?? '');
        setFormSeoTitleEn(d.seoTitleEn ?? '');
        setFormSeoDescriptionAr(d.seoDescriptionAr ?? '');
        setFormSeoDescriptionEn(d.seoDescriptionEn ?? '');
        setFormDimensionsLength(d.dimensions?.length != null ? String(d.dimensions.length) : '');
        setFormDimensionsWidth(d.dimensions?.width != null ? String(d.dimensions.width) : '');
        setFormDimensionsHeight(d.dimensions?.height != null ? String(d.dimensions.height) : '');
        setFormTags(Array.isArray(d.tags) ? joinTagList(d.tags) : '');
        setFormTagInput('');
        setFormIsFeatured(Boolean(d.isFeatured));
        setFormIsTaxable(Boolean(d.isTaxable));
        setFormTaxRate(d.taxRate != null ? String(d.taxRate) : '');
        setFormMinOrderQuantity(d.minOrderQuantity != null ? String(d.minOrderQuantity) : '');
        setFormMaxOrderQuantity(d.maxOrderQuantity != null ? String(d.maxOrderQuantity) : '');
        setFormCategoryIds(
          Array.isArray(d.categoryIds) ? d.categoryIds : d.categoryId ? [d.categoryId] : [],
        );
        setFormRelatedProductIds(Array.isArray(d.relatedProductIds) ? d.relatedProductIds : []);
        setFormProductLabel(d.productLabel ?? '');
        setFormYoutubeUrl(d.youtubeUrl ?? '');
        setFormStockUnlimited(Boolean(d.stockUnlimited));
        setFormInlineDiscountEnabled(Boolean(d.inlineDiscount));
        setFormInlineDiscountType(d.inlineDiscount?.type ?? 'percent');
        setFormInlineDiscountValue(
          d.inlineDiscount?.value != null ? String(d.inlineDiscount.value) : '',
        );
        setFormInlineDiscountStartsAt(
          d.inlineDiscount?.startsAt ? String(d.inlineDiscount.startsAt).slice(0, 16) : '',
        );
        setFormInlineDiscountEndsAt(
          d.inlineDiscount?.endsAt ? String(d.inlineDiscount.endsAt).slice(0, 16) : '',
        );
        setFormCustomFieldsJson(
          Array.isArray(d.customFields) ? JSON.stringify(d.customFields, null, 2) : '[]',
        );
        setCustomFieldRows(customFieldsToRows(d.customFields));
        setBundleItems(
          Array.isArray(d.bundleItems)
            ? d.bundleItems.map((item: any) => ({
                bundledProductId: item.bundledProductId,
                quantity: String(item.quantity ?? 1),
              }))
            : [],
        );
        setDigitalFiles(
          Array.isArray(d.digitalFiles)
            ? d.digitalFiles.map((file: any) => ({
                mediaAssetId: file.mediaAssetId,
                fileName: file.fileName ?? '',
                sortOrder: String(file.sortOrder ?? 0),
                url: file.url,
                fileSizeBytes: file.fileSizeBytes ?? 0,
              }))
            : [],
        );
        setFormDigitalDownloadAttemptsLimit(
          d.digitalDownloadAttemptsLimit != null ? String(d.digitalDownloadAttemptsLimit) : '',
        );
        setFormDigitalDownloadExpiresAt(
          d.digitalDownloadExpiresAt ? String(d.digitalDownloadExpiresAt).slice(0, 16) : '',
        );

        const defaultVariant =
          (data.variants ?? []).find((variant) => variant.isDefault) ?? data.variants?.[0];
        if (((data as any).productType ?? 'single') === 'single' && defaultVariant) {
          setSelectedVariantId(defaultVariant.id);
          setVariantForm({
            title: defaultVariant.title,
            sku: defaultVariant.sku,
            barcode: defaultVariant.barcode ?? '',
            price: String(defaultVariant.price),
            compareAtPrice: defaultVariant.compareAtPrice
              ? String(defaultVariant.compareAtPrice)
              : '',
            stockQuantity: String(defaultVariant.stockQuantity),
            lowStockThreshold: String(defaultVariant.lowStockThreshold),
            selectedValueByAttributeId: buildVariantValueSelection(
              attributes,
              defaultVariant.attributeValueIds,
            ),
            isDefault: defaultVariant.isDefault,
            titleAr: (defaultVariant as any).titleAr ?? defaultVariant.title,
            titleEn: (defaultVariant as any).titleEn ?? '',
          });
        } else {
          setVariantForm(createVariantFormDefault());
        }

        await loadProductWarehouseState(data, defaultVariant?.id ?? '');
      }
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'تعذر تحميل تفاصيل المنتج',
        type: 'error',
      });
      setViewMode('list');
    } finally {
      setDetailLoading(false);
    }
  }

  async function exportProductsToExcel(): Promise<void> {
    setExportLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      const file = await request<Blob>(
        '/products/export/excel',
        { method: 'GET' },
        { responseType: 'blob' },
      );

      if (!file) {
        throw new Error('تعذر إنشاء ملف التصدير');
      }

      const url = window.URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = `products-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setMessage({ text: 'تم تصدير المنتجات إلى ملف Excel بنجاح', type: 'success' });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'تعذر تصدير المنتجات',
        type: 'error',
      });
    } finally {
      setExportLoading(false);
    }
  }

  async function importProductsFromExcel(file: File): Promise<void> {
    setImportLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      const formData = new FormData();
      formData.append('file', file);

      const result = await request<{
        totalRows: number;
        created: number;
        updated: number;
        failed: number;
        errors: Array<{ row: number; message: string }>;
      }>('/products/import/excel', {
        method: 'POST',
        body: formData,
      });

      const summary = result
        ? `اكتمل الاستيراد: ${result.created} إنشاء، ${result.updated} تحديث، ${result.failed} فشل من أصل ${result.totalRows} صف.`
        : 'اكتمل الاستيراد.';
      const firstError = result?.errors?.[0];
      setMessage({
        text: firstError
          ? `${summary} أول خطأ في الصف ${firstError.row}: ${firstError.message}`
          : summary,
        type: result && result.failed > 0 ? 'error' : 'success',
      });

      await loadCatalog();
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'تعذر استيراد المنتجات',
        type: 'error',
      });
    } finally {
      setImportLoading(false);
      if (importFileRef.current) {
        importFileRef.current.value = '';
      }
    }
  }

  function openImportFileDialog(): void {
    importFileRef.current?.click();
  }

  function handleImportFileChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    importProductsFromExcel(file).catch(() => undefined);
  }

  function clearPendingImages(): void {
    setPendingImageItems((current) => {
      current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return [];
    });
    setCropQueue((current) => {
      current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return [];
    });
    setCropItem((current) => {
      if (current) {
        URL.revokeObjectURL(current.previewUrl);
      }
      return null;
    });
    setCrop({ x: 0, y: 0 });
    setCropZoom(1);
    setCroppedAreaPixels(null);
    if (imageFileRef.current) {
      imageFileRef.current.value = '';
    }
  }

  function resetProductForms(): void {
    setSelectedProduct(null);
    setSelectedVariantId('');
    setProductForm({ ...productFormDefault, isVisible: false, status: 'draft' });
    setVariantForm(createVariantFormDefault());
    clearPendingImages();
    setImageGalleryOrder([]);
    setDraggedGalleryItemId('');
    setIsImageDropActive(false);
    setFormBrandId('');
    setFormWeight('');
    setFormWeightUnit('');
    setFormCostPrice('');
    setFormSeoTitle('');
    setFormSeoDescription('');
    setFormSeoTitleAr('');
    setFormSeoTitleEn('');
    setFormSeoDescriptionAr('');
    setFormSeoDescriptionEn('');
    setFormDimensionsLength('');
    setFormDimensionsWidth('');
    setFormDimensionsHeight('');
    setFormTags('');
    setFormTagInput('');
    setFormIsFeatured(false);
    setFormIsTaxable(false);
    setFormTaxRate('');
    setFormMinOrderQuantity('');
    setFormMaxOrderQuantity('');
    setFormCategoryIds([]);
    setFormRelatedProductIds([]);
    setFormProductLabel('');
    setFormYoutubeUrl('');
    setFormStockUnlimited(false);
    setFormInlineDiscountEnabled(false);
    setFormInlineDiscountType('percent');
    setFormInlineDiscountValue('');
    setFormInlineDiscountStartsAt('');
    setFormInlineDiscountEndsAt('');
    setFormCustomFieldsJson('[]');
    setCustomFieldRows([]);
    setGeneratedVariantDrafts([]);
    setSelectedVariantAttributeIds([]);
    setBundleItems([]);
    setDigitalFiles([]);
    setDigitalUploadFile(null);
    setDigitalUploadName('');
    setFormDigitalDownloadAttemptsLimit('');
    setFormDigitalDownloadExpiresAt('');
    setSelectedFilterValueIds([]);
    setSelectedRangeByFilterId({});
    setSelectedProductWarehouseIds([]);
    setProductWarehouseLinks([]);
    setWarehouseAllocationVariantId('');
    setWarehouseAllocationRows(buildProductWarehouseAllocationRows(warehouses, []));
    setExpandedProductSections({
      details: false,
      variants: true,
      warehouses: true,
      seo: false,
      customFields: false,
    });
    setIsPreviewExpanded(true);
  }

  function handleCreateNew(): void {
    resetProductForms();
    setMessage({ text: '', type: 'info' });
    setViewMode('detail');
  }

  function isProductSectionExpanded(sectionKey: string, defaultExpanded = true): boolean {
    return expandedProductSections[sectionKey] ?? defaultExpanded;
  }

  function toggleProductSection(sectionKey: string, defaultExpanded = true): void {
    setExpandedProductSections((current) => ({
      ...current,
      [sectionKey]: !(current[sectionKey] ?? defaultExpanded),
    }));
  }

  function handleBackToList(): void {
    setViewMode('list');
    setMessage({ text: '', type: 'info' });
  }

  function getProductPayloadExtras() {
    return {
      brandId: formBrandId,
      weight: formWeight,
      costPrice: formCostPrice,
      seoTitle: formSeoTitle,
      seoDescription: formSeoDescription,
      seoTitleAr: formSeoTitleAr,
      seoTitleEn: formSeoTitleEn,
      seoDescriptionAr: formSeoDescriptionAr,
      seoDescriptionEn: formSeoDescriptionEn,
      dimensionsLength: formDimensionsLength,
      dimensionsWidth: formDimensionsWidth,
      dimensionsHeight: formDimensionsHeight,
      tags: formTags,
      isFeatured: formIsFeatured,
      isTaxable: formIsTaxable,
      taxRate: formTaxRate,
      minOrderQuantity: formMinOrderQuantity,
      maxOrderQuantity: formMaxOrderQuantity,
      categoryIds: formCategoryIds,
      relatedProductIds: formRelatedProductIds,
      weightUnit: formWeightUnit,
      productLabel: formProductLabel,
      youtubeUrl: formYoutubeUrl,
      stockUnlimited: formStockUnlimited,
      inlineDiscountEnabled: formInlineDiscountEnabled,
      inlineDiscountType: formInlineDiscountType,
      inlineDiscountValue: formInlineDiscountValue,
      inlineDiscountStartsAt: formInlineDiscountStartsAt,
      inlineDiscountEndsAt: formInlineDiscountEndsAt,
      customFields: customFieldRows,
      shortDescriptionAr: productForm.shortDescriptionAr,
      shortDescriptionEn: productForm.shortDescriptionEn,
      detailedDescriptionAr: productForm.detailedDescriptionAr,
      detailedDescriptionEn: productForm.detailedDescriptionEn,
      bundleItems,
      digitalFiles,
      digitalDownloadAttemptsLimit: formDigitalDownloadAttemptsLimit,
      digitalDownloadExpiresAt: formDigitalDownloadExpiresAt,
    };
  }

  async function saveProduct(options?: {
    status?: ProductStatus;
    isVisible?: boolean;
    successMessage?: string;
  }): Promise<void> {
    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    setFieldErrors({});
    try {
      if (!selectedProduct) {
        const pendingGeneratedDrafts = generatedVariantDrafts;
        const pendingDefaultWarehouseRows = warehouseAllocationRows;
        if (!validateWarehouseAllocationRows(pendingDefaultWarehouseRows)) {
          setMessage({ text: 'تحقق من كميات المستودعات قبل حفظ المنتج', type: 'error' });
          return;
        }
        if (pendingGeneratedDrafts.some((draft) => !validateWarehouseAllocationRows(draft.warehouseRows))) {
          setMessage({ text: 'تحقق من كميات المستودعات للمتغيرات المولدة قبل حفظ المنتج', type: 'error' });
          return;
        }

        const draftForm = {
          ...productForm,
          status: options?.status ?? 'draft',
          isVisible: options?.isVisible ?? false,
        };
        const created = await request<Product>('/products', {
          method: 'POST',
          body: JSON.stringify(buildProductPayload(draftForm, getProductPayloadExtras())),
        });

        if (!created) {
          throw new Error('تعذر إنشاء المنتج');
        }

        if (draftForm.productType === 'single' && pendingGeneratedDrafts.length > 0) {
          for (const [index, draft] of pendingGeneratedDrafts.entries()) {
            const createdVariant = await request<ProductVariant>(`/products/${created.id}/variants`, {
              method: 'POST',
              body: JSON.stringify(
                buildVariantPayload(
                  {
                    ...createVariantFormDefault(),
                    title: draft.title,
                    titleAr: draft.title,
                    sku: draft.sku,
                    barcode: draft.barcode,
                    price: draft.price,
                    compareAtPrice: draft.compareAtPrice,
                    stockQuantity: draft.stockQuantity,
                    lowStockThreshold: draft.lowStockThreshold,
                    selectedValueByAttributeId: draft.selectedValueByAttributeId,
                    isDefault: index === 0,
                  },
                  false,
                ),
              ),
            });
            if (createdVariant) {
              await saveVariantWarehouseRows(createdVariant.id, draft.warehouseRows);
            }
          }
        } else if (draftForm.productType === 'single') {
          const defaultVariantForm = {
            ...variantForm,
            title:
              variantForm.titleAr.trim() || productForm.titleAr.trim() || productForm.title.trim(),
            titleAr:
              variantForm.titleAr.trim() || productForm.titleAr.trim() || productForm.title.trim(),
            sku: variantForm.sku.trim() || created.slug || `SKU-${created.id.slice(0, 8)}`,
            isDefault: true,
          };

          const createdVariant = await request<ProductVariant>(`/products/${created.id}/variants`, {
            method: 'POST',
            body: JSON.stringify(buildVariantPayload(defaultVariantForm, formStockUnlimited)),
          });
          if (createdVariant) {
            await saveVariantWarehouseRows(createdVariant.id, pendingDefaultWarehouseRows);
          }
        }

        await syncProductImages(created.id);

        await saveProductFilterSelections(created.id);
        setGeneratedVariantDrafts([]);
        await loadCatalog();
        await loadProductDetails(created.id);
        setMessage({
          text:
            options?.successMessage ??
            'تم إنشاء مسودة مخفية للمنتج. يمكنك الآن إكمال الصور والفلاتر والملفات.',
          type: 'success',
        });
        return;
      }

      const nextForm = {
        ...productForm,
        ...(options?.status ? { status: options.status } : {}),
        ...(options?.isVisible !== undefined ? { isVisible: options.isVisible } : {}),
      };

      await request(`/products/${selectedProduct.id}`, {
        method: 'PUT',
        body: JSON.stringify(buildProductPayload(nextForm, getProductPayloadExtras())),
      });
      await syncProductImages(selectedProduct.id);
      await saveProductFilterSelections(selectedProduct.id);
      await loadCatalog();
      await loadProductDetails(selectedProduct.id);
      setMessage({ text: options?.successMessage ?? 'تم حفظ المنتج بنجاح', type: 'success' });
    } catch (error) {
      if (isApiError(error)) {
        setFieldErrors(mapProductFieldErrors(error.fieldErrors));
      }
      setMessage({
        text: error instanceof Error ? error.message : 'تعذر حفظ المنتج',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function saveProductFilterSelections(productId: string): Promise<void> {
    const manualFilterIds = new Set(productAssignableFilters.map((filter) => filter.id));
    const manualValueIds = new Set(
      productAssignableFilters.flatMap((filter) => (filter.values ?? []).map((value) => value.id)),
    );

    const valueIds = selectedFilterValueIds.filter((valueId) => manualValueIds.has(valueId));

    const ranges = Object.entries(selectedRangeByFilterId)
      .map(([filterId, value]) => ({ filterId, numericValue: Number(value) }))
      .filter((item) => manualFilterIds.has(item.filterId))
      .filter((item) => Number.isFinite(item.numericValue));

    await request(`/filters/products/${productId}/selections`, {
      method: 'PUT',
      body: JSON.stringify({
        valueIds,
        ranges,
      }),
    });
  }

  function toggleProductFilterValue(valueId: string, enabled: boolean): void {
    setSelectedFilterValueIds((current) => {
      const next = new Set(current);
      if (enabled) {
        next.add(valueId);
      } else {
        next.delete(valueId);
      }
      return [...next];
    });
  }

  function setProductFilterRange(filterId: string, value: string): void {
    setSelectedRangeByFilterId((current) => ({
      ...current,
      [filterId]: value,
    }));
  }

  function addTagFromInput(): void {
    const tag = formTagInput.trim();
    if (!tag) return;
    const nextTags = parseTagList(`${formTags},${tag}`);
    setFormTags(joinTagList(nextTags));
    setFormTagInput('');
  }

  function removeTag(tag: string): void {
    setFormTags(joinTagList(parseTagList(formTags).filter((item) => item !== tag)));
  }

  function addCustomFieldRow(): void {
    setCustomFieldRows((rows) => [...rows, { id: createClientId(), key: '', value: '' }]);
  }

  function updateCustomFieldRow(id: string, patch: Partial<CustomFieldRow>): void {
    setCustomFieldRows((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function removeCustomFieldRow(id: string): void {
    setCustomFieldRows((rows) => rows.filter((row) => row.id !== id));
  }

  function fillVariantSku(): void {
    const titleSeed =
      variantForm.titleAr.trim() ||
      variantForm.title.trim() ||
      productForm.titleAr.trim() ||
      productForm.title.trim();
    setVariantForm((prev) => ({
      ...prev,
      sku: generateSku(titleSeed, selectedProduct?.variants?.length ?? 0),
    }));
  }

  function fillVariantBarcode(): void {
    setVariantForm((prev) => ({ ...prev, barcode: generateEan13() }));
  }

  function _generateVariantDrafts(): void {
    if (selectedVariantAttributeIds.length === 0) {
      setMessage({ text: 'اختر الخصائص التي تريد توليد المتغيرات منها أولاً.', type: 'error' });
      return;
    }

    const selectedAttributes = attributes
      .filter((attribute) => selectedVariantAttributeIds.includes(attribute.id))
      .map((attribute) => ({
        attribute,
        values: (attribute.values ?? []).filter((value) => value.isActive),
      }))
      .filter((entry) => entry.values.length > 0);

    if (selectedAttributes.length === 0) {
      setMessage({ text: 'أضف قيماً نشطة للخصائص أولاً قبل توليد المتغيرات.', type: 'error' });
      return;
    }

    const combinations = selectedAttributes.reduce<Array<Record<string, string>>>(
      (acc, entry) =>
        acc.flatMap((current) =>
          entry.values.map((value) => ({
            ...current,
            [entry.attribute.id]: value.id,
          })),
        ),
      [{}],
    );

    const existingSignatures = new Set(
      (selectedProduct?.variants ?? []).map((variant) => [...variant.attributeValueIds].sort().join('|')),
    );

    const drafts = combinations
      .filter((selection) => {
        const signature = Object.values(selection).sort().join('|');
        return signature && !existingSignatures.has(signature);
      })
      .map((selection, index) => {
        const valueNames = selectedAttributes
          .map((entry) => {
            const valueId = selection[entry.attribute.id];
            const value = entry.values.find((item) => item.id === valueId);
            return value?.valueAr || value?.value || '';
          })
          .filter(Boolean);
        const title = valueNames.join(' / ');
        return {
          id: createClientId(),
          title,
          sku: generateSku(`${productForm.titleAr || productForm.title} ${title}`, index),
          barcode: generateEan13(),
          price: variantForm.price,
          compareAtPrice: variantForm.compareAtPrice,
          stockQuantity: variantForm.stockQuantity,
          lowStockThreshold: variantForm.lowStockThreshold,
          selectedValueByAttributeId: selection,
          warehouseRows: createDraftWarehouseRows(),
        };
      });

    setGeneratedVariantDrafts(drafts);
    setMessage({
      text: drafts.length > 0 ? `تم توليد ${drafts.length} متغير قابل للمراجعة.` : 'لا توجد تركيبات جديدة غير مضافة.',
      type: drafts.length > 0 ? 'success' : 'info',
    });
  }

  function _updateGeneratedVariantDraft(id: string, patch: Partial<GeneratedVariantDraft>): void {
    setGeneratedVariantDrafts((drafts) =>
      drafts.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)),
    );
  }

  function _updateGeneratedVariantWarehouseRow(
    draftId: string,
    warehouseId: string,
    patch: Partial<ProductWarehouseAllocationRow>,
  ): void {
    setGeneratedVariantDrafts((drafts) =>
      drafts.map((draft) =>
        draft.id === draftId
          ? {
              ...draft,
              warehouseRows: draft.warehouseRows.map((row) =>
                row.warehouseId === warehouseId ? { ...row, ...patch } : row,
              ),
            }
          : draft,
      ),
    );
  }

  async function _saveGeneratedVariantDrafts(): Promise<void> {
    if (!selectedProduct || generatedVariantDrafts.length === 0) return;
    if (generatedVariantDrafts.some((draft) => !validateWarehouseAllocationRows(draft.warehouseRows))) {
      setMessage({ text: 'تحقق من كميات المستودعات للمتغيرات المولدة قبل الحفظ', type: 'error' });
      return;
    }
    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      for (const draft of generatedVariantDrafts) {
        const createdVariant = await request<ProductVariant>(`/products/${selectedProduct.id}/variants`, {
          method: 'POST',
          body: JSON.stringify(
            buildVariantPayload(
              {
                ...createVariantFormDefault(),
                title: draft.title,
                titleAr: draft.title,
                sku: draft.sku,
                barcode: draft.barcode,
                price: draft.price,
                compareAtPrice: draft.compareAtPrice,
                stockQuantity: draft.stockQuantity,
                lowStockThreshold: draft.lowStockThreshold,
                selectedValueByAttributeId: draft.selectedValueByAttributeId,
              },
              false,
            ),
          ),
        });
        if (createdVariant) {
          await saveVariantWarehouseRows(createdVariant.id, draft.warehouseRows);
        }
      }
      setGeneratedVariantDrafts([]);
      await loadProductDetails(selectedProduct.id);
      setMessage({ text: 'تم حفظ المتغيرات المولدة بنجاح.', type: 'success' });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'تعذر حفظ المتغيرات المولدة',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  }

  function buildProductWarehouseAllocationRows(
    warehouseRows: Warehouse[],
    allocationRows: VariantWarehouseAllocation[],
  ): ProductWarehouseAllocationRow[] {
    const byWarehouseId = new Map(allocationRows.map((row) => [row.warehouseId, row]));
    return warehouseRows.map((warehouse) => {
      const allocation = byWarehouseId.get(warehouse.id);
      return {
        warehouseId: warehouse.id,
        enabled: allocation !== undefined,
        quantity: String(allocation?.quantity ?? 0),
        reservedQuantityReadonly: allocation?.reservedQuantity ?? 0,
        lowStockThreshold: String(allocation?.lowStockThreshold ?? 0),
        reorderPoint:
          allocation?.reorderPoint !== null && allocation?.reorderPoint !== undefined
            ? String(allocation.reorderPoint)
            : '',
      };
    });
  }

  function createDraftWarehouseRows(): ProductWarehouseAllocationRow[] {
    return buildProductWarehouseAllocationRows(warehouses, []).map((row) => ({
      ...row,
      enabled: selectedProductWarehouseIds.includes(row.warehouseId),
    }));
  }

  function buildWarehouseAllocationsPayload(rows: ProductWarehouseAllocationRow[]) {
    return rows
      .filter((row) => row.enabled)
      .map((row) => ({
        warehouseId: row.warehouseId,
        quantity: Number(row.quantity),
        lowStockThreshold: Number(row.lowStockThreshold),
        ...(row.reorderPoint.trim() ? { reorderPoint: Number(row.reorderPoint) } : {}),
      }));
  }

  function validateWarehouseAllocationRows(rows: ProductWarehouseAllocationRow[]): boolean {
    return !buildWarehouseAllocationsPayload(rows).some(
      (row) =>
        !Number.isInteger(row.quantity) ||
        row.quantity < 0 ||
        !Number.isInteger(row.lowStockThreshold) ||
        row.lowStockThreshold < 0 ||
        ('reorderPoint' in row && (!Number.isInteger(row.reorderPoint) || Number(row.reorderPoint) < 0)),
    );
  }

  async function saveVariantWarehouseRows(variantId: string, rows: ProductWarehouseAllocationRow[]): Promise<void> {
    await request(`/warehouses/variants/${variantId}/allocations`, {
      method: 'PUT',
      body: JSON.stringify({ allocations: buildWarehouseAllocationsPayload(rows) }),
    });
  }

  async function loadProductWarehouseState(product: Product, variantId: string): Promise<void> {
    const links = await request<ProductWarehouseLink[]>(`/warehouses/products/${product.id}/links`, {
      method: 'GET',
    });
    const safeLinks = links ?? [];
    setProductWarehouseLinks(safeLinks);
    setSelectedProductWarehouseIds(safeLinks.map((row) => row.warehouseId));
    setWarehouseAllocationVariantId(variantId);

    if (!variantId) {
      setWarehouseAllocationRows(buildProductWarehouseAllocationRows(warehouses, []));
      return;
    }

    const allocations = await request<VariantWarehouseAllocation[]>(
      `/warehouses/variants/${variantId}/allocations`,
      { method: 'GET' },
    );
    setWarehouseAllocationRows(buildProductWarehouseAllocationRows(warehouses, allocations ?? []));
  }

  async function loadWarehouseAllocationForVariant(variantId: string): Promise<void> {
    setWarehouseAllocationVariantId(variantId);
    if (!variantId) {
      setWarehouseAllocationRows(buildProductWarehouseAllocationRows(warehouses, []));
      return;
    }
    const allocations = await request<VariantWarehouseAllocation[]>(
      `/warehouses/variants/${variantId}/allocations`,
      { method: 'GET' },
    );
    setWarehouseAllocationRows(buildProductWarehouseAllocationRows(warehouses, allocations ?? []));
  }

  function toggleProductWarehouse(warehouseId: string): void {
    setSelectedProductWarehouseIds((current) =>
      current.includes(warehouseId)
        ? current.filter((id) => id !== warehouseId)
        : [...current, warehouseId],
    );
    setWarehouseAllocationRows((rows) =>
      rows.map((row) => (row.warehouseId === warehouseId ? { ...row, enabled: !row.enabled } : row)),
    );
    setGeneratedVariantDrafts((drafts) =>
      drafts.map((draft) => ({
        ...draft,
        warehouseRows: draft.warehouseRows.map((row) =>
          row.warehouseId === warehouseId ? { ...row, enabled: !row.enabled } : row,
        ),
      })),
    );
  }

  function updateWarehouseAllocationRow(
    warehouseId: string,
    patch: Partial<ProductWarehouseAllocationRow>,
  ): void {
    setWarehouseAllocationRows((rows) =>
      rows.map((row) => (row.warehouseId === warehouseId ? { ...row, ...patch } : row)),
    );
  }

  async function saveSelectedProductWarehouseLinks(): Promise<void> {
    if (!selectedProduct) return;
    setWarehouseSaving(true);
    setMessage({ text: '', type: 'info' });
    try {
      const rows = await request<ProductWarehouseLink[]>(
        `/warehouses/products/${selectedProduct.id}/links`,
        {
          method: 'PUT',
          body: JSON.stringify({ warehouseIds: selectedProductWarehouseIds }),
        },
      );
      const safeRows = rows ?? [];
      setProductWarehouseLinks(safeRows);
      setSelectedProductWarehouseIds(safeRows.map((row) => row.warehouseId));
      setMessage({ text: 'تم حفظ مستودعات المنتج بنجاح', type: 'success' });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'تعذر حفظ مستودعات المنتج',
        type: 'error',
      });
    } finally {
      setWarehouseSaving(false);
    }
  }

  async function saveSelectedVariantWarehouseAllocations(): Promise<void> {
    if (!warehouseAllocationVariantId) return;

    const allocations = warehouseAllocationRows
      .filter((row) => row.enabled)
      .map((row) => ({
        warehouseId: row.warehouseId,
        quantity: Number(row.quantity),
        lowStockThreshold: Number(row.lowStockThreshold),
        ...(row.reorderPoint.trim() ? { reorderPoint: Number(row.reorderPoint) } : {}),
      }));

    if (
      allocations.some(
        (row) =>
          !Number.isInteger(row.quantity) ||
          row.quantity < 0 ||
          !Number.isInteger(row.lowStockThreshold) ||
          row.lowStockThreshold < 0 ||
          ('reorderPoint' in row &&
            (!Number.isInteger(row.reorderPoint) || Number(row.reorderPoint) < 0)),
      )
    ) {
      setMessage({ text: 'تحقق من كميات المستودعات والحدود قبل الحفظ', type: 'error' });
      return;
    }

    setWarehouseSaving(true);
    setMessage({ text: '', type: 'info' });
    try {
      const rows = await request<VariantWarehouseAllocation[]>(
        `/warehouses/variants/${warehouseAllocationVariantId}/allocations`,
        {
          method: 'PUT',
          body: JSON.stringify({ allocations }),
        },
      );
      setWarehouseAllocationRows(buildProductWarehouseAllocationRows(warehouses, rows ?? []));
      setMessage({ text: 'تم حفظ كميات المستودعات للمتغير بنجاح', type: 'success' });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'تعذر حفظ كميات المستودعات',
        type: 'error',
      });
    } finally {
      setWarehouseSaving(false);
    }
  }

  async function deleteProduct(): Promise<void> {
    if (!selectedProduct || !window.confirm('هل أنت متأكد من حذف هذا المنتج نهائيًا؟')) return;
    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      await request(`/products/${selectedProduct.id}`, { method: 'DELETE' });
      resetProductForms();
      await loadCatalog();
      setViewMode('list');
      setMessage({ text: 'تم حذف المنتج بنجاح', type: 'success' });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'تعذر حذف المنتج',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function _addVariant(): Promise<void> {
    if (!selectedProduct) {
      setMessage({ text: 'احفظ المنتج كمسودة أولًا قبل إضافة المتغيرات.', type: 'error' });
      return;
    }

    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      await request(`/products/${selectedProduct.id}/variants`, {
        method: 'POST',
        body: JSON.stringify(buildVariantPayload(variantForm, productForm.productType !== 'single')),
      });
      setVariantForm(createVariantFormDefault());
      await loadProductDetails(selectedProduct.id);
      setMessage({ text: 'تمت إضافة المتغير بنجاح', type: 'success' });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'تعذر إضافة المتغير',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function _updateVariantAttributes(): Promise<void> {
    if (!selectedProduct || !selectedVariantId) return;
    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      await request(`/products/${selectedProduct.id}/variants/${selectedVariantId}/attributes`, {
        method: 'PUT',
        body: JSON.stringify({
          attributeValueIds: extractSelectedValueIds(variantForm.selectedValueByAttributeId),
        }),
      });
      await loadProductDetails(selectedProduct.id);
      setMessage({ text: 'تم تحديث خصائص المتغير بنجاح', type: 'success' });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'تعذر تحديث الخصائص',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  }

  function _selectVariantForEdit(variant: ProductVariant): void {
    setSelectedVariantId(variant.id);
    setVariantForm({
      title: variant.title,
      sku: variant.sku,
      barcode: variant.barcode ?? '',
      price: String(variant.price),
      compareAtPrice: variant.compareAtPrice ? String(variant.compareAtPrice) : '',
      stockQuantity: String(variant.stockQuantity),
      lowStockThreshold: String(variant.lowStockThreshold),
      selectedValueByAttributeId: buildVariantValueSelection(attributes, variant.attributeValueIds),
      isDefault: variant.isDefault,
      titleAr: (variant as any).titleAr ?? variant.title,
      titleEn: (variant as any).titleEn ?? '',
    });
    setMessage({ text: 'تم تحميل بيانات المتغير للتعديل', type: 'info' });
  }

  function startImageCropQueue(items: PendingProductImageItem[]): void {
    if (items.length === 0) return;
    if (cropItem || cropQueue.length > 0) {
      setCropQueue((current) => [...current, ...items]);
      return;
    }
    setCropItem(items[0] ?? null);
    setCropQueue(items.slice(1));
    setCrop({ x: 0, y: 0 });
    setCropZoom(1);
    setCroppedAreaPixels(null);
  }

  function handleProductImageFiles(files: FileList | File[]): void {
    const selectedFiles = Array.from(files);
    const accepted: PendingProductImageItem[] = [];
    const rejectedNames: string[] = [];

    for (const file of selectedFiles) {
      if (!ACCEPTED_PRODUCT_IMAGE_TYPES.has(file.type) || file.size > PRODUCT_IMAGE_MAX_BYTES) {
        rejectedNames.push(file.name);
        continue;
      }

      accepted.push({
        id: createClientId(),
        file,
        previewUrl: URL.createObjectURL(file),
        altText: '',
        variantId: '',
      });
    }

    if (rejectedNames.length > 0) {
      setMessage({
        text: `تم تجاهل ${rejectedNames.length} ملف. الصيغ المدعومة JPG وPNG وGIF وWEBP، والحد الأقصى ${formatFileSize(PRODUCT_IMAGE_MAX_BYTES)}.`,
        type: 'error',
      });
    }

    startImageCropQueue(accepted);
    if (imageFileRef.current) {
      imageFileRef.current.value = '';
    }
  }

  function addPendingImageToGallery(item: PendingProductImageItem): void {
    setPendingImageItems((current) => [...current, item]);
    setImageGalleryOrder((current) => {
      const baseOrder = current.length > 0 ? current : galleryItems.map((galleryItem) => galleryItem.key);
      return [...baseOrder, getPendingImageKey(item.id)];
    });
  }

  function openNextCropItem(): void {
    setCropQueue((current) => {
      const [next, ...rest] = current;
      setCropItem(next ?? null);
      setCrop({ x: 0, y: 0 });
      setCropZoom(1);
      setCroppedAreaPixels(null);
      return rest;
    });
  }

  async function applyCropToCurrentImage(): Promise<void> {
    if (!cropItem || !croppedAreaPixels) return;
    try {
      const croppedFile = await createCroppedImageFile(cropItem.previewUrl, cropItem.file, croppedAreaPixels);
      const croppedPreviewUrl = URL.createObjectURL(croppedFile);
      URL.revokeObjectURL(cropItem.previewUrl);
      addPendingImageToGallery({
        ...cropItem,
        file: croppedFile,
        previewUrl: croppedPreviewUrl,
      });
      openNextCropItem();
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'تعذر قص الصورة',
        type: 'error',
      });
    }
  }

  function useOriginalCropImage(): void {
    if (!cropItem) return;
    addPendingImageToGallery(cropItem);
    openNextCropItem();
  }

  function cancelCropImage(): void {
    if (cropItem) {
      URL.revokeObjectURL(cropItem.previewUrl);
    }
    openNextCropItem();
  }

  function moveGalleryItem(sourceKey: string, targetKey: string): void {
    if (sourceKey === targetKey) return;
    const currentOrder = imageGalleryOrder.length > 0 ? imageGalleryOrder : galleryItems.map((item) => item.key);
    const sourceIndex = currentOrder.indexOf(sourceKey);
    const targetIndex = currentOrder.indexOf(targetKey);
    if (sourceIndex < 0 || targetIndex < 0) return;

    const nextOrder = [...currentOrder];
    const [movedItem] = nextOrder.splice(sourceIndex, 1);
    if (!movedItem) return;
    nextOrder.splice(targetIndex, 0, movedItem);
    setImageGalleryOrder(nextOrder);
  }

  function removePendingGalleryItem(item: PendingProductImageItem): void {
    URL.revokeObjectURL(item.previewUrl);
    setPendingImageItems((current) => current.filter((row) => row.id !== item.id));
    setImageGalleryOrder((current) => current.filter((key) => key !== getPendingImageKey(item.id)));
  }

  async function deleteServerGalleryImage(imageId: string): Promise<void> {
    if (!selectedProduct) return;
    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      await request(`/products/${selectedProduct.id}/images/${imageId}`, { method: 'DELETE' });
      await loadProductDetails(selectedProduct.id);
      setMessage({ text: 'تم حذف الصورة من معرض المنتج', type: 'success' });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'تعذر حذف الصورة',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function syncProductImages(productId: string): Promise<void> {
    if (galleryItems.length === 0) return;

    const orderedImageIds: string[] = [];
    for (const [index, item] of galleryItems.entries()) {
      if (item.source === 'server') {
        orderedImageIds.push(item.image.id);
        continue;
      }

      const mediaAsset = await uploadMediaAsset(request, item.image.file);
      const attached = await request<ProductImage>(`/products/${productId}/images`, {
        method: 'POST',
        body: JSON.stringify(
          buildAttachImagePayload(
            {
              variantId: item.image.variantId,
              altText: item.image.altText,
              sortOrder: String(index),
            },
            mediaAsset.id,
            index === 0,
          ),
        ),
      });
      if (!attached) {
        throw new Error('تعذر حفظ إحدى صور المنتج');
      }
      orderedImageIds.push(attached.id);
    }

    const primaryImageId = orderedImageIds[0];
    if (primaryImageId) {
      await request(`/products/${productId}/images/reorder`, {
        method: 'PUT',
        body: JSON.stringify({
          imageIds: orderedImageIds,
          primaryImageId,
        }),
      });
    }

    clearPendingImages();
  }

  async function uploadDigitalFileAsset(): Promise<void> {
    if (!digitalUploadFile) {
      setMessage({ text: 'اختر ملفًا رقميًا أولًا', type: 'error' });
      return;
    }

    if (digitalFiles.length >= 10) {
      setMessage({ text: 'الحد الأقصى للملفات الرقمية هو 10 ملفات لكل منتج', type: 'error' });
      return;
    }

    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      const mediaAsset = await uploadMediaAsset(request, digitalUploadFile);
      setDigitalFiles((current) => [
        ...current,
        {
          mediaAssetId: mediaAsset.id,
          fileName: digitalUploadName.trim() || digitalUploadFile.name,
          sortOrder: String(current.length),
          url: mediaAsset.url,
          fileSizeBytes: mediaAsset.fileSizeBytes,
        },
      ]);
      setDigitalUploadFile(null);
      setDigitalUploadName('');
      setMessage({ text: 'تم رفع الملف الرقمي وإضافته لقائمة ملفات المنتج', type: 'success' });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'تعذر رفع الملف الرقمي',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  }

  const isSingleProduct = productForm.productType === 'single';
  const isBundledProduct = productForm.productType === 'bundled';
  const isDigitalProduct = productForm.productType === 'digital';
  const previewTitle = productForm.titleAr.trim() || productForm.title.trim() || 'اسم المنتج';
  const previewDescription =
    productForm.shortDescriptionAr.trim() ||
    productForm.descriptionAr.trim() ||
    productForm.description.trim() ||
    'وصف المنتج';
  const previewPrice = Number(variantForm.price || '0');
  const galleryItems = useMemo<ProductGalleryItem[]>(() => {
    const serverImages = [...(selectedProduct?.images ?? [])].sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      return a.sortOrder - b.sortOrder;
    });

    const itemByKey = new Map<string, ProductGalleryItem>();
    for (const image of serverImages) {
      const key = getServerImageKey(image.id);
      itemByKey.set(key, {
        key,
        source: 'server',
        image,
        url: image.url,
        altText: image.altText ?? '',
      });
    }
    for (const image of pendingImageItems) {
      const key = getPendingImageKey(image.id);
      itemByKey.set(key, {
        key,
        source: 'pending',
        image,
        url: image.previewUrl,
        altText: image.altText,
      });
    }

    const defaultOrder = [
      ...serverImages.map((image) => getServerImageKey(image.id)),
      ...pendingImageItems.map((image) => getPendingImageKey(image.id)),
    ];
    const orderedKeys = imageGalleryOrder.length > 0 ? imageGalleryOrder : defaultOrder;
    const orderedItems = orderedKeys
      .map((key) => itemByKey.get(key))
      .filter((item): item is ProductGalleryItem => Boolean(item));
    const orderedKeySet = new Set(orderedItems.map((item) => item.key));
    for (const key of defaultOrder) {
      const item = itemByKey.get(key);
      if (item && !orderedKeySet.has(key)) {
        orderedItems.push(item);
      }
    }
    return orderedItems;
  }, [imageGalleryOrder, pendingImageItems, selectedProduct?.images]);
  const previewImage =
    galleryItems[0]?.url ||
    selectedProduct?.images?.find((image) => image.isPrimary)?.url ||
    selectedProduct?.images?.[0]?.url ||
    '';

  const filteredProducts = useMemo(
    () =>
      products.filter((product) => {
        const query = searchQuery.trim().toLowerCase();
        const matchesQuery =
          !query ||
          product.title.toLowerCase().includes(query) ||
          product.slug.toLowerCase().includes(query) ||
          (product.titleAr ?? '').toLowerCase().includes(query) ||
          (product.titleEn ?? '').toLowerCase().includes(query);
        const matchesStatus = listStatusFilter === 'all' || product.status === listStatusFilter;
        const matchesType = listTypeFilter === 'all' || product.productType === listTypeFilter;
        const matchesCategory =
          listCategoryFilter === 'all' ||
          product.categoryId === listCategoryFilter ||
          product.categoryIds?.includes(listCategoryFilter);

        return matchesQuery && matchesStatus && matchesType && matchesCategory;
      }),
    [listCategoryFilter, listStatusFilter, listTypeFilter, products, searchQuery],
  );

  const productAssignableFilters = useMemo(
    () => filters.filter((filter) => filter.sourceType === 'manual'),
    [filters],
  );

  const activeListFilterCount =
    (searchQuery.trim() ? 1 : 0) +
    (listStatusFilter !== 'all' ? 1 : 0) +
    (listTypeFilter !== 'all' ? 1 : 0) +
    (listCategoryFilter !== 'all' ? 1 : 0);

  const completionIssues: ProductCompletionIssue[] = [
    ...(!(productForm.titleAr.trim() || productForm.title.trim())
      ? [{ id: 'title', label: 'اسم المنتج بالعربية مطلوب.', severity: 'error' as const }]
      : []),
    ...(!selectedProduct
      ? [
          {
            id: 'draft',
            label: 'الحفظ الأول سينشئ مسودة مخفية حتى لا تظهر للعميل.',
            severity: 'warning' as const,
          },
        ]
      : []),
    ...(!previewImage
      ? [{ id: 'image', label: 'الصورة الرئيسية غير مضافة بعد.', severity: 'warning' as const }]
      : []),
    ...(isSingleProduct && Number(variantForm.price || '0') <= 0
      ? [{ id: 'price', label: 'السعر الأساسي ما زال صفرًا.', severity: 'warning' as const }]
      : []),
    ...(isDigitalProduct && digitalFiles.length === 0
      ? [
          {
            id: 'digital',
            label: 'المنتج الرقمي يحتاج ملفًا واحدًا على الأقل.',
            severity: 'warning' as const,
          },
        ]
      : []),
    ...(isBundledProduct && bundleItems.length === 0
      ? [
          {
            id: 'bundle',
            label: 'المنتج المجمع يحتاج منتجًا مضمنًا واحدًا على الأقل.',
            severity: 'warning' as const,
          },
        ]
      : []),
  ];

  const productTypeLabel =
    productForm.productType === 'digital'
      ? 'منتج رقمي'
      : productForm.productType === 'bundled'
        ? 'منتج مجمع'
        : 'منتج فردي';

  if (viewMode === 'detail') {
    return (
      <AppPage maxWidth={1680}>
        <Stack spacing={2.5}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, md: 2.5 },
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
            }}
          >
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              alignItems={{ xs: 'stretch', md: 'center' }}
              justifyContent="space-between"
            >
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Button
                  startIcon={<ArrowForwardIcon />}
                  onClick={handleBackToList}
                  color="inherit"
                  sx={{ fontWeight: 700 }}
                >
                  العودة للمنتجات
                </Button>
                <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' } }} />
                <Box>
                  <Typography variant="h5" fontWeight={900}>
                    {selectedProduct ? `تحرير ${productTypeLabel}` : productTypeLabel}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    نموذج واحد مقسم إلى سكشنات واضحة. المنتج الجديد يبدأ كمسودة مخفية.
                  </Typography>
                </Box>
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                <Chip
                  label={productStatusLabels[productForm.status] ?? productForm.status}
                  color={productStatusColors[productForm.status] ?? 'default'}
                  sx={{ fontWeight: 800 }}
                />
                {selectedProduct ? (
                  <Button
                    color="error"
                    startIcon={<DeleteOutlineIcon />}
                    onClick={() => deleteProduct().catch(() => undefined)}
                    disabled={actionLoading}
                  >
                    حذف المنتج
                  </Button>
                ) : null}
                <Button
                  variant="contained"
                  onClick={() => saveProduct().catch(() => undefined)}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'جار الحفظ...' : selectedProduct ? 'حفظ المنتج' : 'حفظ كمسودة مخفية'}
                </Button>
              </Stack>
            </Stack>
          </Paper>

          {message.text ? (
            <Alert severity={message.type} sx={{ borderRadius: 2 }}>
              {message.text}
            </Alert>
          ) : null}

          <Dialog open={Boolean(cropItem)} onClose={cancelCropImage} maxWidth="lg" fullWidth>
            <DialogTitle sx={{ fontWeight: 900 }}>محرر الصور</DialogTitle>
            <DialogContent>
              <Box
                sx={{
                  position: 'relative',
                  height: { xs: 320, md: 620 },
                  bgcolor: 'grey.900',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}
              >
                {cropItem ? (
                  <Cropper
                    image={cropItem.previewUrl}
                    crop={crop}
                    zoom={cropZoom}
                    aspect={1}
                    onCropChange={setCrop}
                    onZoomChange={setCropZoom}
                    onCropComplete={(_, areaPixels) => setCroppedAreaPixels(areaPixels)}
                  />
                ) : null}
              </Box>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }} sx={{ mt: 2 }}>
                <Typography variant="body2" fontWeight={800}>
                  التكبير
                </Typography>
                <Slider
                  value={cropZoom}
                  min={1}
                  max={3}
                  step={0.1}
                  onChange={(_, value) => setCropZoom(Array.isArray(value) ? value[0] ?? 1 : value)}
                  sx={{ flex: 1 }}
                />
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2.5 }}>
              <Button onClick={cancelCropImage} color="inherit">
                إلغاء
              </Button>
              <Button onClick={useOriginalCropImage} variant="outlined">
                استخدام الصورة الأصلية
              </Button>
              <Button onClick={() => applyCropToCurrentImage().catch(() => undefined)} variant="contained">
                تطبيق القص
              </Button>
            </DialogActions>
          </Dialog>
          <FloatingActionButton
            label={actionLoading ? 'جاري الحفظ...' : selectedProduct ? 'حفظ المنتج' : 'إنشاء المنتج'}
            icon={<AddIcon />}
            onClick={() => saveProduct().catch(() => undefined)}
            disabled={actionLoading}
          />

          {detailLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 10 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  lg: 'minmax(0, 1fr) clamp(340px, 26vw, 420px)',
                },
                gap: { xs: 2.5, lg: 2.5, xl: 3 },
                alignItems: 'start',
              }}
            >
              <Stack spacing={2.25}>
                <ProductSection
                  title="معلومات المنتج"
                  description="البيانات الأساسية التي تظهر للتاجر والعميل."
                  icon={<InventoryIcon color="primary" />}
                  expanded
                  onChange={() => undefined}
                  collapsible={false}
                >
                  <Stack spacing={2.5}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                      <TextField
                        label="اسم المنتج بالعربية"
                        value={productForm.titleAr}
                        error={Boolean(fieldErrors.titleAr || fieldErrors.title)}
                        helperText={fieldErrors.titleAr || fieldErrors.title}
                        onChange={(event) => {
                          setFieldErrors((prev) => clearFieldErrors(prev, ['titleAr', 'title']));
                          setProductForm((prev) => ({
                            ...prev,
                            titleAr: event.target.value,
                            title: event.target.value,
                          }));
                        }}
                        required
                        dir="rtl"
                      />
                      <TextField
                        label="Product name in English"
                        value={productForm.titleEn}
                        error={Boolean(fieldErrors.titleEn)}
                        helperText={fieldErrors.titleEn}
                        onChange={(event) => {
                          setFieldErrors((prev) => clearFieldErrors(prev, ['titleEn']));
                          setProductForm((prev) => ({ ...prev, titleEn: event.target.value }));
                        }}
                        dir="ltr"
                      />
                      <TextField
                        select
                        label="نوع المنتج"
                        value={productForm.productType}
                        onChange={(event) =>
                          setProductForm((prev) => ({
                            ...prev,
                            productType: event.target.value as ProductType,
                          }))
                        }
                        disabled={Boolean(selectedProduct)}
                        helperText={selectedProduct ? 'لا يفضل تغيير النوع بعد إنشاء المنتج.' : undefined}
                      >
                        <MenuItem value="single">منتج فردي</MenuItem>
                        <MenuItem value="digital">ملف رقمي</MenuItem>
                        <MenuItem value="bundled">منتج مجمع</MenuItem>
                      </TextField>
                      <TextField
                        select
                        label="الحالة"
                        value={productForm.status}
                        onChange={(event) =>
                          setProductForm((prev) => ({
                            ...prev,
                            status: event.target.value as ProductStatus,
                          }))
                        }
                      >
                        <MenuItem value="draft">مسودة</MenuItem>
                        <MenuItem value="active">نشط</MenuItem>
                        <MenuItem value="archived">مؤرشف</MenuItem>
                      </TextField>
                      <TextField
                        label="رابط المنتج (Slug)"
                        value={productForm.slug}
                        error={Boolean(fieldErrors.slug)}
                        onChange={(event) => {
                          setFieldErrors((prev) => clearFieldErrors(prev, ['slug']));
                          setProductForm((prev) => ({
                            ...prev,
                            slug: sanitizeSlugInput(event.target.value),
                          }));
                        }}
                        onBlur={() => {
                          const current = productForm.slug.trim();
                          if (!current) {
                            const generated = normalizeSlug(
                              productForm.titleEn.trim() || productForm.titleAr.trim() || productForm.title.trim(),
                            );
                            setProductForm((prev) => ({ ...prev, slug: generated }));
                          } else {
                            setProductForm((prev) => ({ ...prev, slug: normalizeSlug(prev.slug) }));
                          }
                        }}
                        dir="ltr"
                        helperText={
                          fieldErrors.slug ||
                          "يتم توليده تلقائيًا من الاسم. يمكنك تعديله بالإنجليزية وأرقام وشرطات فقط."
                        }
                      />
                    </Box>

                    {isSingleProduct ? (
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: 'repeat(4, 1fr)' },
                          gap: 2,
                          p: 2,
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 2,
                          bgcolor: 'background.default',
                        }}
                      >
                        <TextField
                          label="السعر الاساسي"
                          type="number"
                          value={variantForm.price}
                          error={Boolean(fieldErrors.price)}
                          onChange={(event) => {
                            setFieldErrors((prev) => clearFieldErrors(prev, ['price']));
                            setVariantForm((prev) => ({ ...prev, price: event.target.value }));
                          }}
                          helperText={fieldErrors.price || (selectedProduct ? 'يستخدم عند إضافة متغير جديد.' : undefined)}
                        />
                        <TextField
                          label="السعر قبل الخصم"
                          type="number"
                          value={variantForm.compareAtPrice}
                          error={Boolean(fieldErrors.compareAtPrice)}
                          helperText={fieldErrors.compareAtPrice}
                          onChange={(event) => {
                            setFieldErrors((prev) => clearFieldErrors(prev, ['compareAtPrice']));
                            setVariantForm((prev) => ({
                              ...prev,
                              compareAtPrice: event.target.value,
                            }));
                          }}
                        />
                        <Stack spacing={1}>
                          <TextField
                            label="SKU"
                            value={variantForm.sku}
                            error={Boolean(fieldErrors.sku)}
                            helperText={fieldErrors.sku}
                            onChange={(event) => {
                              setFieldErrors((prev) => clearFieldErrors(prev, ['sku']));
                              setVariantForm((prev) => ({ ...prev, sku: event.target.value }));
                            }}
                            dir="ltr"
                          />
                          <Button size="small" variant="outlined" onClick={fillVariantSku}>
                            توليد SKU
                          </Button>
                        </Stack>
                        <Stack spacing={1}>
                          <TextField
                            label="الباركود"
                            value={variantForm.barcode}
                            error={Boolean(fieldErrors.barcode)}
                            helperText={fieldErrors.barcode}
                            onChange={(event) => {
                              setFieldErrors((prev) => clearFieldErrors(prev, ['barcode']));
                              setVariantForm((prev) => ({ ...prev, barcode: event.target.value }));
                            }}
                            dir="ltr"
                          />
                          <Button size="small" variant="outlined" onClick={fillVariantBarcode}>
                            توليد باركود
                          </Button>
                        </Stack>
                      </Box>
                    ) : null}

                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={productForm.isVisible}
                            onChange={(event) =>
                              setProductForm((prev) => ({ ...prev, isVisible: event.target.checked }))
                            }
                          />
                        }
                        label={productForm.isVisible ? 'ظاهر في المتجر' : 'مخفي عن المتجر'}
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={productForm.questionsEnabled}
                            onChange={(event) =>
                              setProductForm((prev) => ({
                                ...prev,
                                questionsEnabled: event.target.checked,
                              }))
                            }
                          />
                        }
                        label="استقبال أسئلة العملاء"
                      />
                    </Box>
                  </Stack>
                </ProductSection>

                <ProductSection
                  title="صور المنتج والوسائط"
                  description="الصورة الرئيسية والوسائط التي تظهر في صفحة المنتج."
                  icon={<ImageIcon color="primary" />}
                  expanded
                  onChange={() => undefined}
                  collapsible={false}
                >
                  <Stack spacing={2.5}>
                    {galleryItems.length > 0 ? (
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', xl: 'repeat(5, 1fr)' },
                          gap: 2,
                        }}
                      >
                        {galleryItems.map((item, index) => (
                          <Paper
                            key={item.key}
                            elevation={0}
                            draggable
                            onDragStart={() => setDraggedGalleryItemId(item.key)}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => {
                              event.preventDefault();
                              moveGalleryItem(draggedGalleryItemId, item.key);
                              setDraggedGalleryItemId('');
                            }}
                            sx={{
                              p: 1,
                              borderRadius: 2,
                              border: '1px solid',
                              borderColor: index === 0 ? 'primary.main' : 'divider',
                              bgcolor: index === 0 ? 'primary.50' : 'background.paper',
                              cursor: 'grab',
                            }}
                          >
                            <Box sx={{ position: 'relative' }}>
                              <Box
                                component="img"
                                src={item.url}
                                alt={item.altText}
                                sx={{
                                  width: '100%',
                                  aspectRatio: '1 / 1',
                                  objectFit: 'cover',
                                  borderRadius: 1.5,
                                  bgcolor: 'background.default',
                                }}
                              />
                              <Chip
                                size="small"
                                color={index === 0 ? 'primary' : 'default'}
                                label={index === 0 ? 'صورة البطاقة' : `#${index + 1}`}
                                sx={{ position: 'absolute', top: 8, insetInlineStart: 8, fontWeight: 800 }}
                              />
                            </Box>
                            <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="space-between" sx={{ mt: 1, minHeight: 32 }}>
                              <Stack direction="row" spacing={0.5} alignItems="center">
                                <DragIndicatorIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                                <Typography variant="caption" color="text.secondary">
                                  {item.source === 'pending' ? 'لم تحفظ بعد' : 'محفوظة'}
                                </Typography>
                              </Stack>
                              <Button
                                size="small"
                                color="error"
                                onClick={() =>
                                  item.source === 'pending'
                                    ? removePendingGalleryItem(item.image)
                                    : deleteServerGalleryImage(item.image.id).catch(() => undefined)
                                }
                                disabled={actionLoading}
                              >
                                حذف
                              </Button>
                            </Stack>
                            {item.source === 'pending' ? (
                              <Stack spacing={1} sx={{ mt: 1 }}>
                                <TextField
                                  size="small"
                                  label="النص البديل"
                                  value={item.image.altText}
                                  error={Boolean(fieldErrors.altText)}
                                  helperText={fieldErrors.altText}
                                  onChange={(event) => {
                                    setFieldErrors((prev) => clearFieldErrors(prev, ['altText', 'images.0.altText']));
                                    setPendingImageItems((current) =>
                                      current.map((row) =>
                                        row.id === item.image.id ? { ...row, altText: event.target.value } : row,
                                      ),
                                    );
                                  }}
                                />
                                <TextField
                                  size="small"
                                  select
                                  label="ربط بمتغير"
                                  value={item.image.variantId}
                                  error={Boolean(fieldErrors.variantId)}
                                  helperText={fieldErrors.variantId}
                                  onChange={(event) => {
                                    setFieldErrors((prev) => clearFieldErrors(prev, ['variantId', 'images.0.variantId']));
                                    setPendingImageItems((current) =>
                                      current.map((row) =>
                                        row.id === item.image.id ? { ...row, variantId: event.target.value } : row,
                                      ),
                                    );
                                  }}
                                  disabled={!selectedProduct}
                                >
                                  <MenuItem value="">صورة عامة</MenuItem>
                                  {(selectedProduct?.variants ?? []).map((variant) => (
                                    <MenuItem key={variant.id} value={variant.id}>
                                      {variant.title}
                                    </MenuItem>
                                  ))}
                                </TextField>
                              </Stack>
                            ) : null}
                          </Paper>
                        ))}
                      </Box>
                    ) : (
                      <Alert severity="info" sx={{ borderRadius: 2 }}>
                        اختر صورة الآن، وسيتم رفعها تلقائيًا عند حفظ المسودة الجديدة.
                      </Alert>
                    )}

                    <Box
                      onDragEnter={(event: DragEvent<HTMLDivElement>) => {
                        event.preventDefault();
                        setIsImageDropActive(true);
                      }}
                      onDragOver={(event: DragEvent<HTMLDivElement>) => {
                        event.preventDefault();
                        setIsImageDropActive(true);
                      }}
                      onDragLeave={() => setIsImageDropActive(false)}
                      onDrop={(event: DragEvent<HTMLDivElement>) => {
                        event.preventDefault();
                        setIsImageDropActive(false);
                        handleProductImageFiles(event.dataTransfer.files);
                      }}
                      sx={{
                        p: { xs: 2.5, md: 4 },
                        borderRadius: 3,
                        border: '1px dashed',
                        borderColor: isImageDropActive ? 'primary.main' : 'divider',
                        bgcolor: isImageDropActive ? 'action.hover' : 'background.default',
                        textAlign: 'center',
                        transition: 'border-color 160ms ease, background-color 160ms ease',
                      }}
                    >
                      <Stack spacing={2} alignItems="center">
                        <input
                          ref={imageFileRef}
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/webp"
                          multiple
                          hidden
                          onChange={(event) => {
                            if (event.target.files) {
                              handleProductImageFiles(event.target.files);
                            }
                          }}
                        />
                        <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main' }} />
                        <Box>
                          <Typography variant="subtitle1" fontWeight={900}>
                            اسحب الصور وأفلتها هنا
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            JPG وJPEG وPNG وGIF وWEBP حتى {formatFileSize(PRODUCT_IMAGE_MAX_BYTES)} لكل صورة.
                          </Typography>
                        </Box>
                        <Button
                          variant="outlined"
                          startIcon={<UploadFileIcon />}
                          onClick={() => imageFileRef.current?.click()}
                          disabled={actionLoading}
                        >
                          استعراض الصور
                        </Button>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                          <Button
                            variant="contained"
                            onClick={() => {
                              if (!selectedProduct) {
                                saveProduct().catch(() => undefined);
                                return;
                              }
                              syncProductImages(selectedProduct.id)
                                .then(() => loadProductDetails(selectedProduct.id))
                                .then(() => setMessage({ text: 'تم حفظ صور المنتج وترتيبها', type: 'success' }))
                                .catch((error) =>
                                  setMessage({
                                    text: error instanceof Error ? error.message : 'تعذر حفظ صور المنتج',
                                    type: 'error',
                                  }),
                                );
                            }}
                            disabled={actionLoading || galleryItems.length === 0}
                          >
                            {selectedProduct ? 'حفظ الصور والترتيب' : 'حفظ المسودة ورفع الصور'}
                          </Button>
                        </Stack>
                      </Stack>
                    </Box>

                    <TextField
                      label="رابط فيديو يوتيوب"
                      value={formYoutubeUrl}
                      error={Boolean(fieldErrors.youtubeUrl)}
                      helperText={fieldErrors.youtubeUrl}
                      onChange={(event) => {
                        setFieldErrors((prev) => clearFieldErrors(prev, ['youtubeUrl']));
                        setFormYoutubeUrl(event.target.value);
                      }}
                      dir="ltr"
                    />
                  </Stack>
                </ProductSection>

                <ProductSection
                  title="إعدادات النوع"
                  description="حقول تختلف حسب نوع المنتج المختار."
                  icon={<StyleIcon color="primary" />}
                  expanded
                  onChange={() => undefined}
                  collapsible={false}
                >
                  {isSingleProduct ? (
                    <Stack spacing={2.5}>
                      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
                        <TextField
                          label="الكمية المتوفرة"
                          type="number"
                          value={variantForm.stockQuantity}
                          error={Boolean(fieldErrors.stockQuantity)}
                          helperText={fieldErrors.stockQuantity}
                          onChange={(event) => {
                            setFieldErrors((prev) => clearFieldErrors(prev, ['stockQuantity']));
                            setVariantForm((prev) => ({ ...prev, stockQuantity: event.target.value }));
                          }}
                          disabled={formStockUnlimited}
                        />
                        <TextField
                          label="تنبيه انخفاض المخزون"
                          type="number"
                          value={variantForm.lowStockThreshold}
                          error={Boolean(fieldErrors.lowStockThreshold)}
                          helperText={fieldErrors.lowStockThreshold}
                          onChange={(event) => {
                            setFieldErrors((prev) => clearFieldErrors(prev, ['lowStockThreshold']));
                            setVariantForm((prev) => ({
                              ...prev,
                              lowStockThreshold: event.target.value,
                            }));
                          }}
                          disabled={formStockUnlimited}
                        />
                        <FormControlLabel
                          control={
                            <Switch
                              checked={formStockUnlimited}
                              onChange={(event) => setFormStockUnlimited(event.target.checked)}
                            />
                          }
                          label="مخزون غير محدود"
                          sx={{ alignSelf: 'center' }}
                        />
                      </Box>
                      <Alert severity="info" sx={{ borderRadius: 2 }}>
                        عند تحرير منتج موجود، تظهر أسعار المتغيرات الحالية في سكشن خيارات المنتج.
                      </Alert>
                    </Stack>
                  ) : null}

                  {isDigitalProduct ? (
                    <Stack spacing={2.5}>
                      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                        <TextField
                          label="عدد محاولات التحميل"
                          type="number"
                          value={formDigitalDownloadAttemptsLimit}
                          error={Boolean(fieldErrors.digitalDownloadAttemptsLimit)}
                          helperText={fieldErrors.digitalDownloadAttemptsLimit || 'اتركه فارغًا ليكون غير محدود.'}
                          onChange={(event) => {
                            setFieldErrors((prev) => clearFieldErrors(prev, ['digitalDownloadAttemptsLimit']));
                            setFormDigitalDownloadAttemptsLimit(event.target.value);
                          }}
                        />
                        <TextField
                          label="تاريخ انتهاء التحميل"
                          type="datetime-local"
                          InputLabelProps={{ shrink: true }}
                          value={formDigitalDownloadExpiresAt}
                          error={Boolean(fieldErrors.digitalDownloadExpiresAt)}
                          helperText={fieldErrors.digitalDownloadExpiresAt}
                          onChange={(event) => {
                            setFieldErrors((prev) => clearFieldErrors(prev, ['digitalDownloadExpiresAt']));
                            setFormDigitalDownloadExpiresAt(event.target.value);
                          }}
                        />
                      </Box>
                      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '2fr 2fr auto' }, gap: 1.5 }}>
                        <TextField
                          type="file"
                          onChange={(event) =>
                            setDigitalUploadFile((event.target as HTMLInputElement).files?.[0] ?? null)
                          }
                        />
                        <TextField
                          label="اسم الملف"
                          value={digitalUploadName}
                          error={Boolean(fieldErrors.digitalFiles)}
                          helperText={fieldErrors.digitalFiles}
                          onChange={(event) => {
                            setFieldErrors((prev) => clearFieldErrors(prev, ['digitalFiles', 'digitalFiles.0.mediaAssetId']));
                            setDigitalUploadName(event.target.value);
                          }}
                        />
                        <Button
                          variant="outlined"
                          onClick={() => uploadDigitalFileAsset().catch(() => undefined)}
                          disabled={actionLoading || !digitalUploadFile}
                        >
                          رفع الملف
                        </Button>
                      </Box>
                      {digitalFiles.map((file, index) => (
                        <Paper key={file.mediaAssetId} elevation={0} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                            <Typography variant="body2">
                              {file.fileName || `Digital File ${index + 1}`} - {(file.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB
                            </Typography>
                            <Button color="error" size="small" onClick={() => setDigitalFiles((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}>
                              حذف
                            </Button>
                          </Stack>
                        </Paper>
                      ))}
                    </Stack>
                  ) : null}

                  {isBundledProduct ? (
                    <Stack spacing={2.5}>
                      {bundleItems.map((item, index) => (
                        <Box key={`${item.bundledProductId}-${index}`} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr auto' }, gap: 1.5 }}>
                          <TextField
                            select
                            label="المنتج المضمن"
                            value={item.bundledProductId}
                            onChange={(event) =>
                              setBundleItems((rows) =>
                                rows.map((row, rowIndex) =>
                                  rowIndex === index ? { ...row, bundledProductId: event.target.value } : row,
                                ),
                              )
                            }
                          >
                            {products
                              .filter((product) => !selectedProduct || product.id !== selectedProduct.id)
                              .map((product) => (
                                <MenuItem key={product.id} value={product.id}>
                                  {product.title}
                                </MenuItem>
                              ))}
                          </TextField>
                          <TextField
                            label="الكمية"
                            type="number"
                            value={item.quantity}
                            onChange={(event) =>
                              setBundleItems((rows) =>
                                rows.map((row, rowIndex) =>
                                  rowIndex === index ? { ...row, quantity: event.target.value } : row,
                                ),
                              )
                            }
                          />
                          <Button color="error" onClick={() => setBundleItems((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}>
                            حذف
                          </Button>
                        </Box>
                      ))}
                      <Button
                        variant="outlined"
                        onClick={() => setBundleItems((rows) => [...rows, { bundledProductId: '', quantity: '1' }])}
                      >
                        إضافة منتج للمجموعة
                      </Button>
                    </Stack>
                  ) : null}
                </ProductSection>

                <ProductSection
                  title="التصنيفات والتنظيم"
                  description="التصنيفات، العلامات التجارية، الوسوم، والفلاتر."
                  expanded
                  onChange={() => undefined}
                  collapsible={false}
                >
                  <Stack spacing={2.5}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                      <TextField
                        select
                        label="العلامة التجارية"
                        value={formBrandId}
                        error={Boolean(fieldErrors.brandId)}
                        helperText={fieldErrors.brandId}
                        onChange={(event) => {
                          setFieldErrors((prev) => clearFieldErrors(prev, ['brandId', 'brand']));
                          setFormBrandId(event.target.value);
                        }}
                      >
                        <MenuItem value="">بدون علامة تجارية</MenuItem>
                        {brands.map((brand) => (
                          <MenuItem key={brand.id} value={brand.id}>
                            {brand.nameAr ?? brand.name}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        select
                        label="التصنيفات"
                        value={formCategoryIds}
                        SelectProps={{
                          multiple: true,
                          renderValue: (selected) =>
                            (selected as string[])
                              .map(
                                (id) =>
                                  categories.find((category) => category.id === id)?.nameAr ??
                                  categories.find((category) => category.id === id)?.name ??
                                  id,
                              )
                              .join('، '),
                        }}
                        error={Boolean(fieldErrors.categoryIds || fieldErrors.categoryId)}
                        helperText={fieldErrors.categoryIds || fieldErrors.categoryId || 'يمكن اختيار أكثر من تصنيف من هذا الحقل.'}
                        onChange={(event) => {
                          setFieldErrors((prev) => clearFieldErrors(prev, ['categoryIds', 'categoryId']));
                          const value = event.target.value;
                          const nextCategoryIds = typeof value === 'string' ? value.split(',') : (value as string[]);
                          setFormCategoryIds(nextCategoryIds);
                          setProductForm((prev) => ({ ...prev, categoryId: nextCategoryIds[0] ?? '' }));
                        }}
                      >
                        {categories.map((category) => (
                          <MenuItem key={category.id} value={category.id}>
                            {category.nameAr ?? category.name}
                          </MenuItem>
                        ))}
                      </TextField>
                      <Box sx={{ display: 'grid', gap: 1 }}>
                        <TextField
                          label="الوسوم"
                          value={formTagInput}
                          error={Boolean(fieldErrors.tags)}
                          helperText={fieldErrors.tags || 'اكتب اسم الوسم ثم اضغط Enter.'}
                          onChange={(event) => {
                            setFieldErrors((prev) => clearFieldErrors(prev, ['tags']));
                            setFormTagInput(event.target.value);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              addTagFromInput();
                            }
                          }}
                          onBlur={addTagFromInput}
                        />
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, minHeight: 32 }}>
                          {parseTagList(formTags).map((tag) => (
                            <Chip key={tag} label={tag} onDelete={() => removeTag(tag)} />
                          ))}
                        </Box>
                      </Box>
                    </Box>

                    <TextField
                      select
                      label="المنتجات المشابهة"
                      value={formRelatedProductIds}
                      SelectProps={{
                        multiple: true,
                        renderValue: (selected) =>
                          (selected as string[])
                            .map((id) => products.find((product) => product.id === id)?.title ?? id)
                            .join('، '),
                      }}
                      onChange={(event) => {
                        const value = event.target.value;
                        setFormRelatedProductIds(typeof value === 'string' ? value.split(',') : (value as string[]));
                      }}
                    >
                      {products
                        .filter((product) => !selectedProduct || product.id !== selectedProduct.id)
                        .map((product) => (
                          <MenuItem key={product.id} value={product.id}>
                            {product.title}
                          </MenuItem>
                        ))}
                    </TextField>

                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      تظهر هنا فقط الفلاتر اليدوية. أما الفلاتر التلقائية مثل البراند، السعر، المخزون، المستودعات والخصائص، فتظهر في المتجر تلقائيًا من بيانات المنتج.
                    </Typography>
                    {!selectedProduct ? (
                      <Alert severity="info" sx={{ borderRadius: 2 }}>
                        سيتم حفظ الفلاتر بعد إنشاء المسودة.
                      </Alert>
                    ) : productAssignableFilters.length === 0 ? (
                      <Alert severity="info" sx={{ borderRadius: 2 }}>
                        لا توجد فلاتر يدوية قابلة للإضافة لهذا المنتج.
                      </Alert>
                    ) : (
                      <Stack spacing={2}>
                        {productAssignableFilters.map((filter) => (
                          <Box key={filter.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2 }}>
                            <Typography variant="subtitle2" fontWeight={800} gutterBottom>
                              {filter.nameAr}
                            </Typography>
                            {filter.type === 'range' ? (
                              <TextField
                                type="number"
                                label="القيمة الرقمية"
                                value={selectedRangeByFilterId[filter.id] ?? ''}
                                onChange={(event) => setProductFilterRange(filter.id, event.target.value)}
                                inputProps={{ min: 0, step: '0.01' }}
                                sx={{ maxWidth: 260 }}
                              />
                            ) : (
                              <Stack direction="row" flexWrap="wrap" gap={1}>
                                {(filter.values ?? []).map((value) => {
                                  const checked = selectedFilterValueIds.includes(value.id);
                                  return (
                                    <FormControlLabel
                                      key={value.id}
                                      control={
                                        <Checkbox
                                          checked={checked}
                                          onChange={(event) => {
                                            if (filter.type === 'radio' && event.target.checked) {
                                              const removable = new Set((filter.values ?? []).map((item) => item.id));
                                              setSelectedFilterValueIds((current) =>
                                                current.filter((item) => !removable.has(item)).concat(value.id),
                                              );
                                              return;
                                            }
                                            toggleProductFilterValue(value.id, event.target.checked);
                                          }}
                                        />
                                      }
                                      label={
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                          {filter.type === 'color' && value.colorHex ? (
                                            <Box
                                              sx={{
                                                width: 14,
                                                height: 14,
                                                borderRadius: '50%',
                                                bgcolor: value.colorHex,
                                                border: '1px solid',
                                                borderColor: 'divider',
                                              }}
                                            />
                                          ) : null}
                                          <span>{value.valueAr}</span>
                                        </Box>
                                      }
                                    />
                                  );
                                })}
                              </Stack>
                            )}
                          </Box>
                        ))}
                      </Stack>
                    )}
                  </Stack>
                </ProductSection>

                <ProductSection
                  title="الخصم والوسم"
                  description="خصم مباشر وملصق يظهر بجانب المنتج."
                  expanded
                  onChange={() => undefined}
                  collapsible={false}
                >
                  <Stack spacing={2.5}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                      <TextField
                        label="ملصق المنتج"
                        value={formProductLabel}
                        error={Boolean(fieldErrors.productLabel)}
                        helperText={fieldErrors.productLabel}
                        onChange={(event) => {
                          setFieldErrors((prev) => clearFieldErrors(prev, ['productLabel']));
                          setFormProductLabel(event.target.value);
                        }}
                        placeholder="جديد / الأكثر مبيعًا"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={formInlineDiscountEnabled}
                            onChange={(event) => setFormInlineDiscountEnabled(event.target.checked)}
                          />
                        }
                        label="تفعيل خصم خاص لهذا المنتج"
                        sx={{ alignSelf: 'center' }}
                      />
                    </Box>
                    <Collapse in={formInlineDiscountEnabled}>
                      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(4, 1fr)' }, gap: 2 }}>
                        <TextField
                          select
                          label="نوع الخصم"
                          value={formInlineDiscountType}
                          onChange={(event) => setFormInlineDiscountType(event.target.value as 'percent' | 'fixed')}
                        >
                          <MenuItem value="percent">نسبة مئوية</MenuItem>
                          <MenuItem value="fixed">مبلغ ثابت</MenuItem>
                        </TextField>
                        <TextField
                          label="قيمة الخصم"
                          type="number"
                          value={formInlineDiscountValue}
                          error={Boolean(fieldErrors.inlineDiscountValue)}
                          helperText={fieldErrors.inlineDiscountValue}
                          onChange={(event) => {
                            setFieldErrors((prev) => clearFieldErrors(prev, ['inlineDiscountValue', 'inlineDiscount.value']));
                            setFormInlineDiscountValue(event.target.value);
                          }}
                        />
                        <TextField
                          label="بداية الخصم"
                          type="datetime-local"
                          InputLabelProps={{ shrink: true }}
                          value={formInlineDiscountStartsAt}
                          onChange={(event) => setFormInlineDiscountStartsAt(event.target.value)}
                        />
                        <TextField
                          label="نهاية الخصم"
                          type="datetime-local"
                          InputLabelProps={{ shrink: true }}
                          value={formInlineDiscountEndsAt}
                          onChange={(event) => setFormInlineDiscountEndsAt(event.target.value)}
                        />
                      </Box>
                    </Collapse>
                  </Stack>
                </ProductSection>

                <ProductSection
                  title="تفاصيل إضافية"
                  description="الوصف، الشحن، الضريبة، الوزن، وحدود الطلب."
                  expanded={isProductSectionExpanded('details', false)}
                  onChange={() => toggleProductSection('details', false)}
                >
                  <Stack spacing={3}>
                    <ProductDescriptionEditor
                      label="الوصف المختصر بالعربية"
                      value={productForm.shortDescriptionAr}
                      error={fieldErrors.shortDescriptionAr}
                      onChange={(value) => {
                        setFieldErrors((prev) => clearFieldErrors(prev, ['shortDescriptionAr']));
                        setProductForm((prev) => ({ ...prev, shortDescriptionAr: value }));
                      }}
                      minRows={5}
                      maxLength={250}
                    />
                    <ProductDescriptionEditor
                      label="الوصف التفصيلي بالعربية"
                      value={productForm.detailedDescriptionAr}
                      error={fieldErrors.detailedDescriptionAr || fieldErrors.descriptionAr || fieldErrors.description}
                      onChange={(value) => {
                        setFieldErrors((prev) => clearFieldErrors(prev, ['detailedDescriptionAr', 'descriptionAr', 'description']));
                        setProductForm((prev) => ({
                          ...prev,
                          detailedDescriptionAr: value,
                          descriptionAr: value,
                          description: value,
                        }));
                      }}
                      minRows={8}
                      maxLength={1000}
                    />
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                      <ProductDescriptionEditor
                        label="Short description in English"
                        value={productForm.shortDescriptionEn}
                        error={fieldErrors.shortDescriptionEn}
                        onChange={(value) => {
                          setFieldErrors((prev) => clearFieldErrors(prev, ['shortDescriptionEn']));
                          setProductForm((prev) => ({ ...prev, shortDescriptionEn: value }));
                        }}
                        dir="ltr"
                        minRows={5}
                        maxLength={250}
                      />
                      <ProductDescriptionEditor
                        label="Detailed description in English"
                        value={productForm.detailedDescriptionEn}
                        error={fieldErrors.detailedDescriptionEn || fieldErrors.descriptionEn}
                        onChange={(value) => {
                          setFieldErrors((prev) => clearFieldErrors(prev, ['detailedDescriptionEn', 'descriptionEn']));
                          setProductForm((prev) => ({
                            ...prev,
                            detailedDescriptionEn: value,
                            descriptionEn: value,
                          }));
                        }}
                        dir="ltr"
                        minRows={5}
                        maxLength={1000}
                      />
                    </Box>
                    {!isDigitalProduct ? (
                      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
                        <TextField label="الوزن" type="number" value={formWeight} error={Boolean(fieldErrors.weight)} helperText={fieldErrors.weight} onChange={(event) => { setFieldErrors((prev) => clearFieldErrors(prev, ['weight'])); setFormWeight(event.target.value); }} />
                        <TextField label="وحدة الوزن" value={formWeightUnit} error={Boolean(fieldErrors.weightUnit)} helperText={fieldErrors.weightUnit} onChange={(event) => { setFieldErrors((prev) => clearFieldErrors(prev, ['weightUnit'])); setFormWeightUnit(event.target.value); }} placeholder="kg / g" />
                        <TextField label="سعر التكلفة" type="number" value={formCostPrice} error={Boolean(fieldErrors.costPrice)} helperText={fieldErrors.costPrice} onChange={(event) => { setFieldErrors((prev) => clearFieldErrors(prev, ['costPrice'])); setFormCostPrice(event.target.value); }} />
                        <TextField label="السماكة (سم)" type="number" value={formDimensionsLength} onChange={(event) => setFormDimensionsLength(event.target.value)} />
                        <TextField label="العرض (سم)" type="number" value={formDimensionsWidth} onChange={(event) => setFormDimensionsWidth(event.target.value)} />
                        <TextField label="الارتفاع (سم)" type="number" value={formDimensionsHeight} onChange={(event) => setFormDimensionsHeight(event.target.value)} />
                      </Box>
                    ) : null}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                      <FormControlLabel control={<Switch checked={formIsFeatured} onChange={(event) => setFormIsFeatured(event.target.checked)} />} label="منتج مميز" />
                      <FormControlLabel control={<Switch checked={formIsTaxable} onChange={(event) => setFormIsTaxable(event.target.checked)} />} label="خاضع للضريبة" />
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
                      {formIsTaxable ? (
                        <TextField label="نسبة الضريبة (%)" type="number" value={formTaxRate} error={Boolean(fieldErrors.taxRate)} helperText={fieldErrors.taxRate} onChange={(event) => { setFieldErrors((prev) => clearFieldErrors(prev, ['taxRate'])); setFormTaxRate(event.target.value); }} />
                      ) : null}
                      <TextField label="الحد الأدنى للطلب" type="number" value={formMinOrderQuantity} error={Boolean(fieldErrors.minOrderQuantity)} helperText={fieldErrors.minOrderQuantity} onChange={(event) => { setFieldErrors((prev) => clearFieldErrors(prev, ['minOrderQuantity'])); setFormMinOrderQuantity(event.target.value); }} />
                      <TextField label="الحد الأقصى للطلب" type="number" value={formMaxOrderQuantity} error={Boolean(fieldErrors.maxOrderQuantity)} helperText={fieldErrors.maxOrderQuantity} onChange={(event) => { setFieldErrors((prev) => clearFieldErrors(prev, ['maxOrderQuantity'])); setFormMaxOrderQuantity(event.target.value); }} />
                    </Box>
                  </Stack>
                </ProductSection>

                <ProductVariantsSection
                  request={request}
                  selectedProduct={selectedProduct}
                  attributes={attributes}
                  warehouses={warehouses}
                  generatedVariantDrafts={generatedVariantDrafts}
                  setGeneratedVariantDrafts={setGeneratedVariantDrafts}
                  variantForm={variantForm}
                  setVariantForm={setVariantForm}
                  selectedVariantAttributeIds={selectedVariantAttributeIds}
                  setSelectedVariantAttributeIds={setSelectedVariantAttributeIds}
                  selectedProductWarehouseIds={selectedProductWarehouseIds}
                  warehousesSaving={warehouseSaving}
                  selectedVariantId={selectedVariantId}
                  setSelectedVariantId={setSelectedVariantId}
                  actionLoading={actionLoading}
                  setMessage={setMessage}
                  onRefresh={loadCatalog}
                  onLoadProductDetails={loadProductDetails}
                  isSingleProduct={isSingleProduct}
                />

                {isSingleProduct ? (
                  <ProductSection
                    title="المستودعات والمخزون"
                    description="اختيار المستودعات وتوزيع كميات المتغيرات مباشرة من صفحة المنتج."
                    expanded={isProductSectionExpanded('warehouses', false)}
                    onChange={() => toggleProductSection('warehouses', false)}
                  >
                    <Stack spacing={2.5}>
                      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 1.5 }}>
                        {warehouses.map((warehouse) => (
                          <FormControlLabel
                            key={warehouse.id}
                            control={
                              <Checkbox
                                checked={selectedProductWarehouseIds.includes(warehouse.id)}
                                onChange={() => toggleProductWarehouse(warehouse.id)}
                              />
                            }
                            label={`${warehouse.nameAr || warehouse.name} (${warehouse.code})`}
                          />
                        ))}
                      </Box>
                      {selectedProduct ? (
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
                          <Button variant="outlined" onClick={() => saveSelectedProductWarehouseLinks().catch(() => undefined)} disabled={warehouseSaving || warehouses.length === 0}>
                            حفظ مستودعات المنتج
                          </Button>
                          <Typography variant="body2" color="text.secondary">
                            المستودعات المرتبطة حالياً: {productWarehouseLinks.length}
                          </Typography>
                        </Stack>
                      ) : (
                        <Alert severity="info">سيتم حفظ المستودعات والكميات تلقائياً عند حفظ المنتج.</Alert>
                      )}

                      <Divider />

                      <TextField
                        select
                        label="اختر المتغير لتوزيع الكميات"
                        value={warehouseAllocationVariantId}
                        onChange={(event) => loadWarehouseAllocationForVariant(event.target.value).catch(() => undefined)}
                        disabled={(selectedProduct?.variants ?? []).length === 0}
                      >
                        <MenuItem value="">اختر المتغير</MenuItem>
                        {(selectedProduct?.variants ?? []).map((variant) => (
                          <MenuItem key={variant.id} value={variant.id}>
                            {(variant.titleAr ?? variant.title) || variant.sku} - {variant.sku}
                          </MenuItem>
                        ))}
                      </TextField>

                      {warehouseAllocationVariantId || !selectedProduct ? (
                        <TableContainer component={Paper} variant="outlined">
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>تفعيل</TableCell>
                                <TableCell>المستودع</TableCell>
                                <TableCell>الكمية</TableCell>
                                <TableCell>محجوز</TableCell>
                                <TableCell>حد التنبيه</TableCell>
                                <TableCell>إعادة الطلب</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {warehouseAllocationRows.map((row) => {
                                const warehouse = warehouses.find((item) => item.id === row.warehouseId);
                                return (
                                  <TableRow key={row.warehouseId}>
                                    <TableCell>
                                      <Checkbox checked={row.enabled} onChange={(event) => updateWarehouseAllocationRow(row.warehouseId, { enabled: event.target.checked })} />
                                    </TableCell>
                                    <TableCell>
                                      <Typography variant="body2" fontWeight={700}>{warehouse?.nameAr || warehouse?.name || '-'}</Typography>
                                      <Typography variant="caption" color="text.secondary" dir="ltr">{warehouse?.code ?? '-'}</Typography>
                                    </TableCell>
                                    <TableCell>
                                      <TextField size="small" type="number" value={row.quantity} onChange={(event) => updateWarehouseAllocationRow(row.warehouseId, { quantity: event.target.value })} disabled={!row.enabled} />
                                    </TableCell>
                                    <TableCell>
                                      <Typography variant="body2" color="text.secondary">{row.reservedQuantityReadonly}</Typography>
                                    </TableCell>
                                    <TableCell>
                                      <TextField size="small" type="number" value={row.lowStockThreshold} onChange={(event) => updateWarehouseAllocationRow(row.warehouseId, { lowStockThreshold: event.target.value })} disabled={!row.enabled} />
                                    </TableCell>
                                    <TableCell>
                                      <TextField size="small" type="number" value={row.reorderPoint} onChange={(event) => updateWarehouseAllocationRow(row.warehouseId, { reorderPoint: event.target.value })} disabled={!row.enabled} />
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      ) : (
                        <Alert severity="info">اختر متغيراً لتحديد كمياته في كل مستودع.</Alert>
                      )}

                      {selectedProduct ? (
                        <Button variant="contained" onClick={() => saveSelectedVariantWarehouseAllocations().catch(() => undefined)} disabled={warehouseSaving || !warehouseAllocationVariantId}>
                          حفظ كميات المتغير في المستودعات
                        </Button>
                      ) : null}
                    </Stack>
                  </ProductSection>
                ) : null}

                <ProductSection
                  title="تحسين محركات البحث"
                  description="بيانات ظهور صفحة المنتج في البحث والرابط."
                  expanded={isProductSectionExpanded('seo', false)}
                  onChange={() => toggleProductSection('seo', false)}
                >
                  <Stack spacing={2.5}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                      <TextField label="وصف SEO" multiline minRows={2} value={formSeoDescription} error={Boolean(fieldErrors.seoDescription)} helperText={fieldErrors.seoDescription} onChange={(event) => { setFieldErrors((prev) => clearFieldErrors(prev, ['seoDescription'])); setFormSeoDescription(event.target.value); }} />
                      <TextField label="SEO title English" value={formSeoTitleEn} error={Boolean(fieldErrors.seoTitleEn)} helperText={fieldErrors.seoTitleEn} onChange={(event) => { setFieldErrors((prev) => clearFieldErrors(prev, ['seoTitleEn'])); setFormSeoTitleEn(event.target.value); }} dir="ltr" />
                      <TextField label="وصف SEO عربي" multiline minRows={2} value={formSeoDescriptionAr} error={Boolean(fieldErrors.seoDescriptionAr)} helperText={fieldErrors.seoDescriptionAr} onChange={(event) => { setFieldErrors((prev) => clearFieldErrors(prev, ['seoDescriptionAr'])); setFormSeoDescriptionAr(event.target.value); }} />
                      <TextField label="SEO description English" multiline minRows={2} value={formSeoDescriptionEn} error={Boolean(fieldErrors.seoDescriptionEn)} helperText={fieldErrors.seoDescriptionEn} onChange={(event) => { setFieldErrors((prev) => clearFieldErrors(prev, ['seoDescriptionEn'])); setFormSeoDescriptionEn(event.target.value); }} dir="ltr" />
                    </Box>
                  </Stack>
                </ProductSection>

                <ProductSection
                  title="الحقول المخصصة"
                  description="حقول إضافية حسب طبيعة المنتج، مثل بلد المنشأ أو تاريخ الإنتاج."
                  expanded={isProductSectionExpanded('customFields', false)}
                  onChange={() => toggleProductSection('customFields', false)}
                >
                  <Stack spacing={2}>
                    <Stack spacing={1.5}>
                      {customFieldRows.map((row) => (
                        <Box
                          key={row.id}
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', md: '1fr 1.5fr auto' },
                            gap: 1,
                            alignItems: 'center',
                          }}
                        >
                          <TextField
                            label="اسم الحقل"
                            value={row.key}
                            onChange={(event) => updateCustomFieldRow(row.id, { key: event.target.value })}
                          />
                          <TextField
                            label="القيمة"
                            value={row.value}
                            onChange={(event) => updateCustomFieldRow(row.id, { value: event.target.value })}
                          />
                          <Button color="error" onClick={() => removeCustomFieldRow(row.id)}>
                            حذف
                          </Button>
                        </Box>
                      ))}
                      <Button variant="outlined" startIcon={<AddIcon />} onClick={addCustomFieldRow} sx={{ alignSelf: 'flex-start' }}>
                        إضافة حقل مخصص
                      </Button>
                    </Stack>
                  </Stack>
                </ProductSection>

                <Paper
                  elevation={0}
                  sx={{ p: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}
                >
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="flex-end">
                    <Button
                      variant="outlined"
                      onClick={() =>
                        saveProduct({
                          status: 'draft',
                          isVisible: false,
                          successMessage: 'تم حفظ المنتج كمسودة مخفية.',
                        }).catch(() => undefined)
                      }
                      disabled={actionLoading}
                    >
                      حفظ كمسودة
                    </Button>
                    <Button
                      variant="outlined"
                      color="secondary"
                      onClick={() =>
                        saveProduct({
                          status: 'active',
                          isVisible: false,
                          successMessage: 'تم حفظ المنتج نشطًا لكنه مخفي عن المتجر.',
                        }).catch(() => undefined)
                      }
                      disabled={actionLoading}
                    >
                      حفظ مخفيًا
                    </Button>
                    <Button
                      variant="contained"
                      onClick={() =>
                        saveProduct({
                          status: 'active',
                          isVisible: true,
                          successMessage: 'تم نشر المنتج وإظهاره في المتجر.',
                        }).catch(() => undefined)
                      }
                      disabled={actionLoading || completionIssues.some((issue) => issue.severity === 'error')}
                    >
                      نشر المنتج
                    </Button>
                  </Stack>
                </Paper>
              </Stack>

              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: 3,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                  position: { lg: 'sticky' },
                  top: { lg: 96 },
                  alignSelf: 'start',
                  height: 'fit-content',
                  maxHeight: { lg: 'calc(100vh - 112px)' },
                  overflowY: { lg: 'auto' },
                  order: { xs: -1, lg: 0 },
                }}
              >
                <Stack spacing={2}>
                  <Typography variant="h6" fontWeight={900}>
                    معاينة المنتج
                  </Typography>
                  <Button
                    size="small"
                    endIcon={
                      <ExpandMoreIcon
                        sx={{
                          transition: 'transform 160ms ease',
                          transform: isPreviewExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        }}
                      />
                    }
                    onClick={() => setIsPreviewExpanded((current) => !current)}
                    sx={{ display: { xs: 'inline-flex', lg: 'none' }, alignSelf: 'flex-start', fontWeight: 800 }}
                  >
                    {isPreviewExpanded ? 'إخفاء' : 'عرض'}
                  </Button>
                  <Collapse
                    in={isPreviewExpanded}
                    timeout="auto"
                    unmountOnExit={false}
                    sx={{
                      height: { lg: 'auto !important' },
                      overflow: { lg: 'visible !important' },
                      visibility: { lg: 'visible !important' },
                    }}
                  >
                    <Stack spacing={2}>
                  <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden', bgcolor: 'background.default' }}>
                    <Box sx={{ height: { xs: 180, sm: 220, lg: 240 }, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px dashed', borderColor: 'divider', bgcolor: 'background.paper' }}>
                      {previewImage ? (
                        <Box component="img" src={previewImage} alt={previewTitle} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <ImageIcon sx={{ fontSize: 54, color: 'text.disabled' }} />
                      )}
                    </Box>
                    <Stack spacing={1.25} sx={{ p: 2 }}>
                      <Typography variant="subtitle1" fontWeight={900} noWrap>
                        {previewTitle}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ minHeight: 44 }}>
                        {previewDescription}
                      </Typography>
                      {isSingleProduct ? (
                        <Typography variant="h6" fontWeight={900} color="primary.dark">
                          {formatProductAmount(previewPrice, 'YER')}
                        </Typography>
                      ) : (
                        <Chip size="small" label={productTypeLabel} sx={{ width: 'fit-content' }} />
                      )}
                      <Stack direction="row" spacing={1}>
                        <Button variant="contained" size="small" disabled sx={{ flex: 1 }}>
                          اشتر الآن
                        </Button>
                        <Button variant="outlined" size="small" disabled sx={{ flex: 1 }}>
                          أضف للسلة
                        </Button>
                      </Stack>
                    </Stack>
                  </Box>

                  <Stack spacing={1}>
                    <Typography variant="subtitle2" fontWeight={900}>
                      حالة الاكتمال
                    </Typography>
                    {completionIssues.length === 0 ? (
                      <Alert severity="success" sx={{ borderRadius: 2 }} icon={<CheckCircleIcon />}>
                        المنتج جاهز للنشر.
                      </Alert>
                    ) : (
                      completionIssues.map((issue) => (
                        <Alert key={issue.id} severity={issue.severity} sx={{ borderRadius: 2 }}>
                          {issue.label}
                        </Alert>
                      ))
                    )}
                  </Stack>
                    </Stack>
                  </Collapse>
                </Stack>
              </Paper>
            </Box>
          )}
        </Stack>
      </AppPage>
    );
  }

  return (
    <AppPage>
      <PageHeader
        title="المنتجات"
        description="أضف منتجاتك ونظم الكتالوج مع صورة واضحة للحالة والتصنيف."
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateNew}>
            منتج جديد
          </Button>
        }
      />

      {message.text ? <Alert severity={message.type}>{message.text}</Alert> : null}

      <FilterBar>
        <Box
          sx={{
            width: '100%',
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              md: 'repeat(2, minmax(0, 1fr))',
              xl: 'minmax(260px, 1.2fr) repeat(3, minmax(150px, 1fr)) auto',
            },
            gap: 1.5,
            alignItems: 'center',
          }}
        >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="space-between"
          sx={{ gridColumn: '1 / -1' }}
        >
          <Typography variant="subtitle2" fontWeight={900}>
            فلاتر المنتجات
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip size="small" label={`${filteredProducts.length} نتيجة`} color="primary" variant="outlined" />
            {activeListFilterCount > 0 ? (
              <Chip size="small" label={`${activeListFilterCount} فلتر نشط`} color="secondary" />
            ) : (
              <Chip size="small" label="بدون فلاتر" variant="outlined" />
            )}
          </Stack>
        </Stack>
        <TextField
          placeholder="ابحث باسم المنتج أو الرابط..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          sx={{ minWidth: 0, gridColumn: { xs: '1', md: '1 / -1', xl: 'auto' } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          select
          label="الحالة"
          value={listStatusFilter}
          onChange={(event) => setListStatusFilter(event.target.value as 'all' | ProductStatus)}
          sx={{ minWidth: 0 }}
        >
          <MenuItem value="all">كل الحالات</MenuItem>
          <MenuItem value="draft">مسودة</MenuItem>
          <MenuItem value="active">نشط</MenuItem>
          <MenuItem value="archived">مؤرشف</MenuItem>
        </TextField>
        <TextField
          select
          label="النوع"
          value={listTypeFilter}
          onChange={(event) => setListTypeFilter(event.target.value as 'all' | ProductType)}
          sx={{ minWidth: 0 }}
        >
          <MenuItem value="all">كل الأنواع</MenuItem>
          <MenuItem value="single">فردي</MenuItem>
          <MenuItem value="digital">رقمي</MenuItem>
          <MenuItem value="bundled">مجمع</MenuItem>
        </TextField>
        <TextField
          select
          label="التصنيف"
          value={listCategoryFilter}
          onChange={(event) => setListCategoryFilter(event.target.value)}
          sx={{ minWidth: 0 }}
        >
          <MenuItem value="all">كل التصنيفات</MenuItem>
          {categories.map((category) => (
            <MenuItem key={category.id} value={category.id}>
              {category.nameAr ?? category.name}
            </MenuItem>
          ))}
        </TextField>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{
            gridColumn: { xs: '1', md: '1 / -1', xl: 'auto' },
            justifyContent: { xs: 'stretch', sm: 'flex-start' },
            flexWrap: 'wrap',
            '& .MuiButton-root': {
              flex: { xs: '1 1 auto', sm: '0 0 auto' },
            },
          }}
        >
          <Button
            variant="outlined"
            onClick={() => loadCatalog().catch(() => undefined)}
            disabled={loading}
          >
            تحديث القائمة
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => exportProductsToExcel().catch(() => undefined)}
            disabled={exportLoading}
          >
            {exportLoading ? 'جار التصدير...' : 'تصدير Excel'}
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<UploadFileIcon />}
            onClick={openImportFileDialog}
            disabled={importLoading}
          >
            {importLoading ? 'جار الاستيراد...' : 'استيراد Excel'}
          </Button>
        </Stack>
        </Box>
      </FilterBar>

      <input
        ref={importFileRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: 'none' }}
        onChange={handleImportFileChange}
      />

      <DataTableWrapper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 60 }}></TableCell>
                <TableCell>اسم المنتج</TableCell>
                <TableCell>النوع</TableCell>
                <TableCell>التصنيف</TableCell>
                <TableCell>الحالة</TableCell>
                <TableCell>المتغيرات</TableCell>
                <TableCell align="left">الإجراءات</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">لا توجد منتجات.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((product) => {
                  const primaryImageUrl = getProductPrimaryImage(product);
                  const categoryName =
                    categories.find((category) => category.id === product.categoryId)?.name ||
                    'بدون تصنيف';
                  return (
                    <TableRow
                      key={product.id}
                      hover
                      sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                    >
                      <TableCell>
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: 1.5,
                            bgcolor: 'background.default',
                            border: '1px solid',
                            borderColor: 'divider',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                          }}
                        >
                          {primaryImageUrl ? (
                            <Box
                              component="img"
                              src={primaryImageUrl}
                              alt={product.title}
                              onError={(event) => {
                                event.currentTarget.style.display = 'none';
                              }}
                              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <ImageIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography variant="subtitle2" fontWeight={700}>
                            {product.title}
                          </Typography>
                          {(product as any).isFeatured ? (
                            <StarIcon sx={{ color: 'warning.main', fontSize: 16 }} />
                          ) : null}
                        </Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          dir="ltr"
                          display="block"
                        >
                          /{product.slug}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={
                            product.productType === 'digital'
                              ? 'رقمي'
                              : product.productType === 'bundled'
                                ? 'مجمع'
                                : 'فردي'
                          }
                          color={
                            product.productType === 'digital'
                              ? 'info'
                              : product.productType === 'bundled'
                                ? 'secondary'
                                : 'default'
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={categoryName} variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={productStatusLabels[product.status] || product.status}
                          color={productStatusColors[product.status] || 'default'}
                          size="small"
                          sx={{ fontWeight: 700 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {product.variants?.length || 0} متغير
                        </Typography>
                      </TableCell>
                      <TableCell align="left">
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<EditNoteIcon />}
                          onClick={() => loadProductDetails(product.id).catch(() => undefined)}
                        >
                          تعديل
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </DataTableWrapper>
      <FloatingActionButton
        label="إنشاء منتج"
        icon={<AddIcon />}
        onClick={handleCreateNew}
        disabled={loading || actionLoading}
      />
    </AppPage>
  );
}

function mapProductFieldErrors(fieldErrors: ApiFieldErrors): Record<string, string> {
  return compactFieldErrors({
    title: firstFieldError(fieldErrors, ['title', 'titleAr']),
    titleAr: firstFieldError(fieldErrors, ['titleAr', 'title']),
    titleEn: firstFieldError(fieldErrors, ['titleEn']),
    slug: firstFieldError(fieldErrors, ['slug']),
    productType: firstFieldError(fieldErrors, ['productType']),
    status: firstFieldError(fieldErrors, ['status']),
    price: firstFieldError(fieldErrors, ['price']),
    compareAtPrice: firstFieldError(fieldErrors, ['compareAtPrice']),
    sku: firstFieldError(fieldErrors, ['sku']),
    barcode: firstFieldError(fieldErrors, ['barcode']),
    stockQuantity: firstFieldError(fieldErrors, ['stockQuantity']),
    lowStockThreshold: firstFieldError(fieldErrors, ['lowStockThreshold']),
    categoryId: firstFieldError(fieldErrors, ['categoryId']),
    categoryIds: firstFieldError(fieldErrors, ['categoryIds']),
    brand: firstFieldError(fieldErrors, ['brand']),
    brandId: firstFieldError(fieldErrors, ['brandId']),
    tags: firstFieldError(fieldErrors, ['tags']),
    relatedProductIds: firstFieldError(fieldErrors, ['relatedProductIds']),
    productLabel: firstFieldError(fieldErrors, ['productLabel']),
    youtubeUrl: firstFieldError(fieldErrors, ['youtubeUrl']),
    weight: firstFieldError(fieldErrors, ['weight']),
    weightUnit: firstFieldError(fieldErrors, ['weightUnit']),
    costPrice: firstFieldError(fieldErrors, ['costPrice']),
    taxRate: firstFieldError(fieldErrors, ['taxRate']),
    minOrderQuantity: firstFieldError(fieldErrors, ['minOrderQuantity']),
    maxOrderQuantity: firstFieldError(fieldErrors, ['maxOrderQuantity']),
    seoTitle: firstFieldError(fieldErrors, ['seoTitle']),
    seoTitleAr: firstFieldError(fieldErrors, ['seoTitleAr']),
    seoTitleEn: firstFieldError(fieldErrors, ['seoTitleEn']),
    seoDescription: firstFieldError(fieldErrors, ['seoDescription']),
    seoDescriptionAr: firstFieldError(fieldErrors, ['seoDescriptionAr']),
    seoDescriptionEn: firstFieldError(fieldErrors, ['seoDescriptionEn']),
    shortDescriptionAr: firstFieldError(fieldErrors, ['shortDescriptionAr']),
    shortDescriptionEn: firstFieldError(fieldErrors, ['shortDescriptionEn']),
    detailedDescriptionAr: firstFieldError(fieldErrors, ['detailedDescriptionAr']),
    detailedDescriptionEn: firstFieldError(fieldErrors, ['detailedDescriptionEn']),
    inlineDiscountValue: firstFieldError(fieldErrors, ['inlineDiscount.value', 'inlineDiscountValue']),
    altText: firstFieldError(fieldErrors, ['altText', 'images.0.altText']),
    variantId: firstFieldError(fieldErrors, ['variantId', 'images.0.variantId']),
    mediaAssetId: firstFieldError(fieldErrors, ['mediaAssetId', 'images.0.mediaAssetId']),
    digitalFiles: firstFieldError(fieldErrors, ['digitalFiles', 'digitalFiles.0.mediaAssetId', 'digitalFiles.0.fileName']),
    digitalDownloadAttemptsLimit: firstFieldError(fieldErrors, ['digitalDownloadAttemptsLimit']),
    digitalDownloadExpiresAt: firstFieldError(fieldErrors, ['digitalDownloadExpiresAt']),
  });
}

function compactFieldErrors(fieldErrors: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fieldErrors).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}

function clearFieldErrors(
  current: Record<string, string>,
  fields: string[],
): Record<string, string> {
  if (fields.every((field) => !current[field])) {
    return current;
  }

  const next = { ...current };
  for (const field of fields) {
    delete next[field];
  }
  return next;
}

function buildProductPayload(
  form: typeof productFormDefault,
  extra?: {
    brandId: string;
    weight: string;
    costPrice: string;
    seoTitle: string;
    seoDescription: string;
    seoTitleAr: string;
    seoTitleEn: string;
    seoDescriptionAr: string;
    seoDescriptionEn: string;
    dimensionsLength: string;
    dimensionsWidth: string;
    dimensionsHeight: string;
    tags: string;
    isFeatured: boolean;
    isTaxable: boolean;
    taxRate: string;
    minOrderQuantity: string;
    maxOrderQuantity: string;
    categoryIds: string[];
    relatedProductIds: string[];
    weightUnit: string;
    productLabel: string;
    youtubeUrl: string;
    stockUnlimited: boolean;
    inlineDiscountEnabled: boolean;
    inlineDiscountType: 'percent' | 'fixed';
    inlineDiscountValue: string;
    inlineDiscountStartsAt: string;
    inlineDiscountEndsAt: string;
    customFields: CustomFieldRow[];
    shortDescriptionAr: string;
    shortDescriptionEn: string;
    detailedDescriptionAr: string;
    detailedDescriptionEn: string;
    bundleItems: Array<{ bundledProductId: string; quantity: string }>;
    digitalFiles: Array<{ mediaAssetId: string; fileName: string; sortOrder: string }>;
    digitalDownloadAttemptsLimit: string;
    digitalDownloadExpiresAt: string;
  },
) {
  const primaryArabicTitle = form.titleAr.trim() || form.title.trim();
  if (!primaryArabicTitle) {
    throw new Error('الاسم العربي للمنتج مطلوب');
  }

  const payload: {
    title: string;
    productType: ProductType;
    isVisible: boolean;
    questionsEnabled: boolean;
    slug?: string;
    description?: string;
    categoryId?: string;
    categoryIds?: string[];
    status: ProductStatus;
    titleAr?: string;
    titleEn?: string;
    descriptionAr?: string;
    descriptionEn?: string;
    shortDescriptionAr?: string;
    shortDescriptionEn?: string;
    detailedDescriptionAr?: string;
    detailedDescriptionEn?: string;
    brandId?: string | null;
    weightUnit?: string;
    weight?: number;
    costPrice?: number;
    dimensions?: { length?: number; width?: number; height?: number };
    productLabel?: string;
    youtubeUrl?: string;
    tags?: string[];
    relatedProductIds?: string[];
    stockUnlimited?: boolean;
    inlineDiscount?: {
      type: 'percent' | 'fixed';
      value: number;
      startsAt?: string;
      endsAt?: string;
    };
    inlineDiscountEnabled?: boolean;
    bundleItems?: Array<{ bundledProductId: string; quantity: number }>;
    digitalFiles?: Array<{ mediaAssetId: string; fileName?: string; sortOrder?: number }>;
    digitalDownloadAttemptsLimit?: number;
    digitalDownloadExpiresAt?: string;
    customFields?: Array<Record<string, unknown>>;
    isFeatured?: boolean;
    isTaxable?: boolean;
    taxRate?: number;
    minOrderQuantity?: number;
    maxOrderQuantity?: number;
    seoTitle?: string;
    seoDescription?: string;
    seoTitleAr?: string;
    seoTitleEn?: string;
    seoDescriptionAr?: string;
    seoDescriptionEn?: string;
  } = {
    title: primaryArabicTitle,
    productType: form.productType,
    isVisible: form.isVisible,
    questionsEnabled: form.questionsEnabled,
    titleAr: primaryArabicTitle,
    status: form.status,
  };

  const slug =
    normalizeSlug(form.slug) ||
    normalizeSlug(form.titleEn.trim() || primaryArabicTitle);
  const categoryId = form.categoryId.trim();
  const titleEn = form.titleEn.trim();
  const descriptionAr = form.descriptionAr.trim();
  const descriptionEn = form.descriptionEn.trim();

  if (slug) payload.slug = slug;
  if (categoryId) payload.categoryId = categoryId;
  if (titleEn) payload.titleEn = titleEn;
  if (descriptionAr) {
    payload.description = descriptionAr;
    payload.descriptionAr = descriptionAr;
  }
  if (descriptionEn) payload.descriptionEn = descriptionEn;

  if (extra) {
    const mergedCategoryIds = Array.from(
      new Set([categoryId, ...extra.categoryIds].filter((id): id is string => Boolean(id))),
    );
    if (mergedCategoryIds.length > 0) {
      payload.categoryIds = mergedCategoryIds;
      const primaryCategoryId = mergedCategoryIds[0];
      if (primaryCategoryId) {
        payload.categoryId = primaryCategoryId;
      }
    }

    payload.brandId = extra.brandId.trim() ? extra.brandId.trim() : null;
    payload.stockUnlimited = extra.stockUnlimited;
    payload.inlineDiscountEnabled = extra.inlineDiscountEnabled;
    payload.isFeatured = extra.isFeatured;
    payload.isTaxable = extra.isTaxable;

    if (extra.weightUnit.trim()) payload.weightUnit = extra.weightUnit.trim();
    if (extra.weight) payload.weight = Number(extra.weight);
    if (extra.costPrice) payload.costPrice = Number(extra.costPrice);
    if (extra.productLabel.trim()) payload.productLabel = extra.productLabel.trim();
    if (extra.youtubeUrl.trim()) payload.youtubeUrl = extra.youtubeUrl.trim();
    if (extra.dimensionsLength || extra.dimensionsWidth || extra.dimensionsHeight) {
      payload.dimensions = {
        ...(extra.dimensionsLength ? { length: Number(extra.dimensionsLength) } : {}),
        ...(extra.dimensionsWidth ? { width: Number(extra.dimensionsWidth) } : {}),
        ...(extra.dimensionsHeight ? { height: Number(extra.dimensionsHeight) } : {}),
      };
    }
    if (extra.tags.trim()) {
      payload.tags = parseTagList(extra.tags);
    }
    if (extra.relatedProductIds.length > 0) payload.relatedProductIds = extra.relatedProductIds;

    const shortDescriptionAr = extra.shortDescriptionAr.trim();
    const shortDescriptionEn = extra.shortDescriptionEn.trim();
    const detailedDescriptionAr = extra.detailedDescriptionAr.trim();
    const detailedDescriptionEn = extra.detailedDescriptionEn.trim();
    if (shortDescriptionAr) payload.shortDescriptionAr = shortDescriptionAr;
    if (shortDescriptionEn) payload.shortDescriptionEn = shortDescriptionEn;
    if (detailedDescriptionAr) {
      payload.detailedDescriptionAr = detailedDescriptionAr;
      payload.description = detailedDescriptionAr;
      payload.descriptionAr = detailedDescriptionAr;
    }
    if (detailedDescriptionEn) {
      payload.detailedDescriptionEn = detailedDescriptionEn;
      payload.descriptionEn = detailedDescriptionEn;
    }

    if (extra.inlineDiscountEnabled && extra.inlineDiscountValue) {
      payload.inlineDiscount = {
        type: extra.inlineDiscountType,
        value: Number(extra.inlineDiscountValue),
        ...(extra.inlineDiscountStartsAt
          ? { startsAt: new Date(extra.inlineDiscountStartsAt).toISOString() }
          : {}),
        ...(extra.inlineDiscountEndsAt
          ? { endsAt: new Date(extra.inlineDiscountEndsAt).toISOString() }
          : {}),
      };
    }

    if (form.productType === 'bundled' && extra.bundleItems.length > 0) {
      payload.bundleItems = extra.bundleItems
        .filter((row) => row.bundledProductId.trim() && Number(row.quantity) > 0)
        .map((row) => ({
          bundledProductId: row.bundledProductId.trim(),
          quantity: Number(row.quantity),
        }));
    }

    if (form.productType === 'digital') {
      payload.digitalFiles = extra.digitalFiles.map((file) => ({
        mediaAssetId: file.mediaAssetId,
        ...(file.fileName.trim() ? { fileName: file.fileName.trim() } : {}),
        ...(file.sortOrder ? { sortOrder: Number(file.sortOrder) } : {}),
      }));
      if (extra.digitalDownloadAttemptsLimit) {
        payload.digitalDownloadAttemptsLimit = Number(extra.digitalDownloadAttemptsLimit);
      }
      if (extra.digitalDownloadExpiresAt) {
        payload.digitalDownloadExpiresAt = new Date(extra.digitalDownloadExpiresAt).toISOString();
      }
    }

    payload.customFields = customFieldRowsToPayload(extra.customFields);

    if (extra.isTaxable && extra.taxRate) payload.taxRate = Number(extra.taxRate);
    if (extra.minOrderQuantity) payload.minOrderQuantity = Number(extra.minOrderQuantity);
    if (extra.maxOrderQuantity) payload.maxOrderQuantity = Number(extra.maxOrderQuantity);
    const fallbackSeoTitle = extra.seoTitle.trim() || form.titleAr.trim() || form.title.trim();
    if (fallbackSeoTitle) payload.seoTitle = fallbackSeoTitle;
    if (extra.seoDescription.trim()) payload.seoDescription = extra.seoDescription.trim();
    const fallbackSeoTitleAr = extra.seoTitleAr.trim() || form.titleAr.trim() || form.title.trim();
    if (fallbackSeoTitleAr) payload.seoTitleAr = fallbackSeoTitleAr;
    if (extra.seoTitleEn.trim()) payload.seoTitleEn = extra.seoTitleEn.trim();
    if (extra.seoDescriptionAr.trim()) payload.seoDescriptionAr = extra.seoDescriptionAr.trim();
    if (extra.seoDescriptionEn.trim()) payload.seoDescriptionEn = extra.seoDescriptionEn.trim();
  }

  return payload;
}

function buildVariantPayload(
  form: ReturnType<typeof createVariantFormDefault>,
  isNonStockTrackedProduct = false,
) {
  const primaryArabicTitle = form.titleAr.trim() || form.title.trim();
  if (!primaryArabicTitle) {
    throw new Error('عنوان المتغير بالعربية مطلوب');
  }

  const payload: {
    title: string;
    sku: string;
    barcode?: string;
    price: number;
    compareAtPrice?: number;
    stockQuantity: number;
    lowStockThreshold: number;
    attributeValueIds: string[];
    isDefault: boolean;
    titleAr?: string;
    titleEn?: string;
  } = {
    title: primaryArabicTitle,
    titleAr: primaryArabicTitle,
    sku: form.sku.trim(),
    price: Number(form.price || '0'),
    stockQuantity: isNonStockTrackedProduct ? 0 : Number(form.stockQuantity || '0'),
    lowStockThreshold: isNonStockTrackedProduct ? 0 : Number(form.lowStockThreshold || '0'),
    attributeValueIds: extractSelectedValueIds(form.selectedValueByAttributeId),
    isDefault: form.isDefault,
  };

  const barcode = form.barcode.trim();
  const compareAtPrice = form.compareAtPrice.trim();
  const titleEn = form.titleEn.trim();

  if (barcode) payload.barcode = barcode;
  if (compareAtPrice) payload.compareAtPrice = Number(compareAtPrice);
  if (titleEn) payload.titleEn = titleEn;

  return payload;
}

function buildAttachImagePayload(
  form: AttachProductImageForm,
  mediaAssetId: string,
  isPrimary: boolean,
) {
  const payload: {
    mediaAssetId: string;
    variantId?: string;
    altText?: string;
    sortOrder: number;
    isPrimary: boolean;
  } = {
    mediaAssetId,
    sortOrder: Number(form.sortOrder || '0'),
    isPrimary,
  };

  const variantId = form.variantId.trim();
  const altText = form.altText.trim();

  if (variantId) payload.variantId = variantId;
  if (altText) payload.altText = altText;

  return payload;
}

function extractSelectedValueIds(selectedValueByAttributeId: Record<string, string>): string[] {
  return Object.values(selectedValueByAttributeId)
    .map((valueId) => valueId.trim())
    .filter((valueId) => valueId.length > 0);
}

function buildVariantValueSelection(
  attributes: Attribute[],
  attributeValueIds: string[],
): Record<string, string> {
  const selectedValueSet = new Set(attributeValueIds);
  const selectedByAttribute: Record<string, string> = {};

  for (const attribute of attributes) {
    for (const value of attribute.values ?? []) {
      if (!selectedValueSet.has(value.id)) continue;
      selectedByAttribute[attribute.id] = value.id;
      break;
    }
  }

  return selectedByAttribute;
}

function _formatVariantAttributes(attributes: Record<string, string>): string {
  const entries = Object.entries(attributes);
  if (entries.length === 0) {
    return 'لا يوجد';
  }

  return entries.map(([key, value]) => `${key}:${value}`).join(', ');
}

async function uploadMediaAsset(request: MerchantRequester, file: File): Promise<MediaAsset> {
  const presigned = await request<PresignedMediaUpload>('/media/presign-upload', {
    method: 'POST',
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
      fileSizeBytes: file.size,
    }),
  });

  if (!presigned) {
    throw new Error('تعذر الحصول على رابط الرفع الموقع');
  }

  const uploadResponse = await fetch(presigned.uploadUrl, {
    method: 'PUT',
    headers: presigned.uploadHeaders,
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error('فشل رفع الوسائط المباشر');
  }

  const etag = uploadResponse.headers.get('etag') ?? undefined;
  const confirmPayload: {
    objectKey: string;
    fileName: string;
    contentType: string;
    fileSizeBytes: number;
    etag?: string;
  } = {
    objectKey: presigned.objectKey,
    fileName: file.name,
    contentType: file.type,
    fileSizeBytes: file.size,
  };

  if (etag) confirmPayload.etag = etag;

  const mediaAsset = await request<MediaAsset>('/media/confirm', {
    method: 'POST',
    body: JSON.stringify(confirmPayload),
  });

  if (!mediaAsset) {
    throw new Error('تعذر تأكيد الوسائط المرفوعة');
  }

  return mediaAsset;
}

