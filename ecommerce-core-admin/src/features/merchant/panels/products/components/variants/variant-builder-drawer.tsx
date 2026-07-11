import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Drawer,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useMemo, useState } from 'react';
import type { Attribute, Product, Warehouse } from '../../../../types';
import type { MerchantRequester } from '../../../../merchant-dashboard.types';
import type { GeneratedVariantDraft, ProductWarehouseAllocationRow, VariantForm } from './variant-types';
import {
  calculateCombinationCount,
  createClientId,
  generateEan13,
  generateSku,
  validateWarehouseAllocationRows,
} from './variant-utils';
import { GeneratedVariantsEditor } from './generated-variants-editor';
import { VariantAttributePicker } from './variant-attribute-picker';
import { VariantBulkActionsToolbar } from './variant-bulk-actions-toolbar';
import { VariantValuesSelector } from './variant-values-selector';
import { VariantWarehouseDrawer } from './variant-warehouse-drawer';

interface VariantBuilderDrawerProps {
  open: boolean;
  onClose: () => void;
  attributes: Attribute[];
  warehouses: Warehouse[];
  productTitle: string;
  selectedProduct: Product | null;
  selectedProductWarehouseIds: string[];
  generatedVariantDrafts: GeneratedVariantDraft[];
  setGeneratedVariantDrafts: React.Dispatch<React.SetStateAction<GeneratedVariantDraft[]>>;
  variantForm: VariantForm;
  selectedVariantAttributeIds: string[];
  setSelectedVariantAttributeIds: React.Dispatch<React.SetStateAction<string[]>>;
  actionLoading: boolean;
  setMessage: (msg: { text: string; type: 'info' | 'success' | 'error' }) => void;
  onSaveGeneratedVariants: () => Promise<void>;
  onDeleteVariant: (variantId: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  request: MerchantRequester;
}

type BuilderTab = 'generate' | 'edit';

export function VariantBuilderDrawer({
  open,
  onClose,
  attributes,
  warehouses,
  productTitle,
  selectedProduct,
  selectedProductWarehouseIds,
  generatedVariantDrafts,
  setGeneratedVariantDrafts,
  variantForm,
  selectedVariantAttributeIds,
  setSelectedVariantAttributeIds,
  actionLoading,
  setMessage,
  onSaveGeneratedVariants,
  onDeleteVariant: _onDeleteVariant,
  onRefresh: _onRefresh,
  request: _request,
}: VariantBuilderDrawerProps) {
  const [activeTab, setActiveTab] = useState<BuilderTab>('generate');
  const [selectedValueIdsByAttributeId, setSelectedValueIdsByAttributeId] = useState<Record<string, string[]>>({});
  const [defaultPrice, setDefaultPrice] = useState(variantForm.price || '0');
  const [defaultCompareAtPrice, setDefaultCompareAtPrice] = useState(variantForm.compareAtPrice || '');
  const [defaultStock, setDefaultStock] = useState(variantForm.stockQuantity || '0');
  const [defaultLowStockThreshold, setDefaultLowStockThreshold] = useState(variantForm.lowStockThreshold || '0');
  const [skuPrefix, setSkuPrefix] = useState('');
  const [autoBarcode, setAutoBarcode] = useState(true);
  const [confirmLargeGeneration, setConfirmLargeGeneration] = useState(false);
  const [warehouseDrawerDraftId, setWarehouseDrawerDraftId] = useState<string | null>(null);
  const [isBulkWarehouseOpen, setIsBulkWarehouseOpen] = useState(false);
  const [bulkWarehouseRows, setBulkWarehouseRows] = useState<ProductWarehouseAllocationRow[]>([]);

  const combinationCount = useMemo(
    () => calculateCombinationCount(selectedValueIdsByAttributeId),
    [selectedValueIdsByAttributeId],
  );

  const handleToggleAttribute = useCallback((attributeId: string, selected: boolean) => {
    setSelectedVariantAttributeIds((prev) =>
      selected ? [...new Set([...prev, attributeId])] : prev.filter((id) => id !== attributeId),
    );
    if (!selected) {
      setSelectedValueIdsByAttributeId((prev) => {
        const next = { ...prev };
        delete next[attributeId];
        return next;
      });
    }
  }, [setSelectedVariantAttributeIds]);

  const handleToggleValue = useCallback((attributeId: string, valueId: string, selected: boolean) => {
    setSelectedValueIdsByAttributeId((prev) => {
      const current = prev[attributeId] ?? [];
      return {
        ...prev,
        [attributeId]: selected ? [...current, valueId] : current.filter((id) => id !== valueId),
      };
    });
  }, []);

  const hasEnoughValues = useMemo(() => {
    if (selectedVariantAttributeIds.length === 0) return false;
    return selectedVariantAttributeIds.every((attrId) => {
      const ids = selectedValueIdsByAttributeId[attrId] ?? [];
      return ids.length > 0;
    });
  }, [selectedVariantAttributeIds, selectedValueIdsByAttributeId]);

  function generateVariants(): void {
    if (selectedVariantAttributeIds.length === 0) {
      setMessage({ text: 'اختر الخصائص التي تريد توليد المتغيرات منها أولاً.', type: 'error' });
      return;
    }

    const emptyAttribute = selectedVariantAttributeIds.find(
      (attrId) => (selectedValueIdsByAttributeId[attrId] ?? []).length === 0,
    );
    if (emptyAttribute) {
      const attr = attributes.find((a) => a.id === emptyAttribute);
      setMessage({
        text: `اختر قيمة واحدة على الأقل للخاصية "${attr?.nameAr ?? attr?.name ?? ''}" قبل التوليد.`,
        type: 'error',
      });
      return;
    }

    if (combinationCount > 100 && !confirmLargeGeneration) {
      setConfirmLargeGeneration(true);
      return;
    }
    setConfirmLargeGeneration(false);

    const selectedAttributes = selectedVariantAttributeIds
      .map((attrId) => {
        const attribute = attributes.find((a) => a.id === attrId);
        if (!attribute) return null;
        const valueIds = selectedValueIdsByAttributeId[attrId] ?? [];
        const values = (attribute.values ?? []).filter((v) => valueIds.includes(v.id));
        return { attribute, values };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null && entry.values.length > 0);

    if (selectedAttributes.length === 0) {
      setMessage({ text: 'أضف قيماً للخصائص المختارة أولاً قبل توليد المتغيرات.', type: 'error' });
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
        const prefix = skuPrefix.trim() || productTitle;
        return {
          id: createClientId(),
          title,
          sku: generateSku(`${prefix} ${title}`, index),
          barcode: autoBarcode ? generateEan13() : '',
          price: defaultPrice,
          compareAtPrice: defaultCompareAtPrice,
          stockQuantity: defaultStock,
          lowStockThreshold: defaultLowStockThreshold,
          selectedValueByAttributeId: selection,
          warehouseRows: warehouses.map((w) => ({
            warehouseId: w.id,
            enabled: selectedProductWarehouseIds.includes(w.id),
            quantity: defaultStock,
            lowStockThreshold: defaultLowStockThreshold,
            reorderPoint: '',
            reservedQuantityReadonly: 0,
          })),
        };
      });

    setGeneratedVariantDrafts(drafts);
    setMessage({
      text: drafts.length > 0 ? `تم توليد ${drafts.length} متغير قابل للمراجعة.` : 'لا توجد تركيبات جديدة غير مضافة.',
      type: drafts.length > 0 ? 'success' : 'info',
    });

    if (drafts.length > 0) {
      setActiveTab('edit');
    }
  }

  function updateDraft(id: string, patch: Partial<GeneratedVariantDraft>): void {
    setGeneratedVariantDrafts((drafts) =>
      drafts.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)),
    );
  }

  function removeDraft(id: string): void {
    setGeneratedVariantDrafts((drafts) => drafts.filter((d) => d.id !== id));
  }

  function openWarehouseForDraft(draftId: string): void {
    setWarehouseDrawerDraftId(draftId);
    setIsBulkWarehouseOpen(false);
  }

  function openBulkWarehouse(): void {
    setBulkWarehouseRows(
      warehouses.map((w) => ({
        warehouseId: w.id,
        enabled: selectedProductWarehouseIds.includes(w.id),
        quantity: '0',
        lowStockThreshold: '0',
        reorderPoint: '',
        reservedQuantityReadonly: 0,
      })),
    );
    setIsBulkWarehouseOpen(true);
    setWarehouseDrawerDraftId(null);
  }

  function applyBulkWarehouse(): void {
    if (!validateWarehouseAllocationRows(bulkWarehouseRows)) {
      setMessage({ text: 'تحقق من صحة كميات المستودعات.', type: 'error' });
      return;
    }
    setGeneratedVariantDrafts((drafts) =>
      drafts.map((draft) => ({
        ...draft,
        warehouseRows: draft.warehouseRows.map((row) => {
          const bulkRow = bulkWarehouseRows.find((br) => br.warehouseId === row.warehouseId);
          if (!bulkRow || !bulkRow.enabled) return { ...row, enabled: false };
          return {
            ...row,
            enabled: true,
            quantity: bulkRow.quantity,
            lowStockThreshold: bulkRow.lowStockThreshold,
            reorderPoint: bulkRow.reorderPoint,
            reservedQuantityReadonly: row.reservedQuantityReadonly,
          };
        }),
      })),
    );
    setIsBulkWarehouseOpen(false);
    setMessage({ text: 'تم تطبيق توزيع المستودعات على كل المتغيرات.', type: 'success' });
  }

  function updateDraftWarehouseRow(
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

  const warehouseTargetDraft = warehouseDrawerDraftId
    ? generatedVariantDrafts.find((d) => d.id === warehouseDrawerDraftId)
    : null;

  const [editorSelectedIds, setEditorSelectedIds] = useState<string[]>([]);

  function handleBulkUpdate(patches: Array<{ id: string; patch: Partial<GeneratedVariantDraft> }>): void {
    setGeneratedVariantDrafts((drafts) => {
      const patchMap = new Map(patches.map((p) => [p.id, p.patch]));
      return drafts.map((draft) => {
        const patch = patchMap.get(draft.id);
        return patch ? { ...draft, ...patch } : draft;
      });
    });
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      anchor="left"
      sx={{
        '& .MuiDrawer-paper': {
          width: '100%',
          maxWidth: '100vw',
          height: '100vh',
        },
      }}
    >
      <Stack sx={{ height: '100%', direction: 'rtl' }}>
        <Box sx={{ p: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h5" fontWeight={900}>
                توليد متغيرات جديدة
              </Typography>
              <Typography variant="body2" color="text.secondary">
                اختر الخصائص والقيم ثم تولّد المتغيرات
              </Typography>
            </Box>
            <Button onClick={onClose} color="inherit" sx={{ fontWeight: 700 }}>
              إغلاق
            </Button>
          </Stack>
        </Box>

        <Stack direction="row" spacing={0} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
          <Button
            onClick={() => setActiveTab('generate')}
            sx={{
              flex: 1,
              borderRadius: 0,
              py: 1.5,
              fontWeight: activeTab === 'generate' ? 900 : 400,
              borderBottom: activeTab === 'generate' ? '3px solid' : '3px solid transparent',
              borderColor: activeTab === 'generate' ? 'primary.main' : 'transparent',
            }}
          >
            توليد المتغيرات
          </Button>
          <Button
            onClick={() => setActiveTab('edit')}
            sx={{
              flex: 1,
              borderRadius: 0,
              py: 1.5,
              fontWeight: activeTab === 'edit' ? 900 : 400,
              borderBottom: activeTab === 'edit' ? '3px solid' : '3px solid transparent',
              borderColor: activeTab === 'edit' ? 'primary.main' : 'transparent',
            }}
          >
            مراجعة المتغيرات المولدة ({generatedVariantDrafts.length})
          </Button>
        </Stack>

        <Box sx={{ flex: 1, overflow: 'auto', p: { xs: 2, md: 3 } }}>
          {activeTab === 'generate' ? (
            <Stack spacing={3}>
              <Box>
                <Typography variant="h6" fontWeight={900} sx={{ mb: 1 }}>
                  1. اختيار الخصائص
                </Typography>
                <VariantAttributePicker
                  attributes={attributes}
                  selectedAttributeIds={selectedVariantAttributeIds}
                  onToggleAttribute={handleToggleAttribute}
                />
              </Box>

              <Divider />

              <Box>
                <Typography variant="h6" fontWeight={900} sx={{ mb: 1 }}>
                  2. اختيار القيم
                </Typography>
                <VariantValuesSelector
                  attributes={attributes}
                  selectedAttributeIds={selectedVariantAttributeIds}
                  selectedValueIdsByAttributeId={selectedValueIdsByAttributeId}
                  onToggleValue={handleToggleValue}
                />
              </Box>

              <Divider />

              <Box>
                <Typography variant="h6" fontWeight={900} sx={{ mb: 1.5 }}>
                  3. إعدادات افتراضية
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
                  <TextField
                    label="السعر الافتراضي"
                    type="number"
                    value={defaultPrice}
                    onChange={(e) => setDefaultPrice(e.target.value)}
                  />
                  <TextField
                    label="السعر قبل الخصم"
                    type="number"
                    value={defaultCompareAtPrice}
                    onChange={(e) => setDefaultCompareAtPrice(e.target.value)}
                  />
                  <TextField
                    label="المخزون الافتراضي"
                    type="number"
                    value={defaultStock}
                    onChange={(e) => setDefaultStock(e.target.value)}
                  />
                  <TextField
                    label="حد تنبيه المخزون"
                    type="number"
                    value={defaultLowStockThreshold}
                    onChange={(e) => setDefaultLowStockThreshold(e.target.value)}
                  />
                  <TextField
                    label="بادئة SKU"
                    value={skuPrefix}
                    onChange={(e) => setSkuPrefix(e.target.value)}
                    placeholder={productTitle}
                    dir="ltr"
                    helperText="تُستخدم كبادئة لرموز SKU"
                  />
                </Box>
                <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                  <Button
                    size="small"
                    variant={autoBarcode ? 'contained' : 'outlined'}
                    onClick={() => setAutoBarcode(!autoBarcode)}
                  >
                    {autoBarcode ? 'باركود تلقائي: نعم' : 'باركود تلقائي: لا'}
                  </Button>
                </Stack>
              </Box>

              <Divider />

              <Box>
                <Typography variant="h6" fontWeight={900} sx={{ mb: 1 }}>
                  4. معاينة وتوليد
                </Typography>
                {hasEnoughValues ? (
                  <Alert severity="info" sx={{ borderRadius: 2, mb: 2 }}>
                    سيتم توليد <strong>{combinationCount}</strong> متغير.
                  </Alert>
                ) : (
                  <Alert severity="warning" sx={{ borderRadius: 2, mb: 2 }}>
                    اختر خاصية واحدة على الأقل وقيمة واحدة لكل خاصية.
                  </Alert>
                )}
                {combinationCount > 50 && hasEnoughValues ? (
                  <Alert severity="warning" sx={{ borderRadius: 2, mb: 2 }}>
                    تنبيه: سيتم توليد عدد كبير من المتغيرات. يفضل استخدام التحرير الجماعي بعد التوليد.
                  </Alert>
                ) : null}
                {confirmLargeGeneration ? (
                  <Alert severity="error" sx={{ borderRadius: 2, mb: 2 }}>
                    سيتم توليد {combinationCount} متغير. هل أنت متأكد؟
                    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                      <Button size="small" variant="contained" onClick={() => { setConfirmLargeGeneration(false); generateVariants(); }}>
                        نعم، تأكيد التوليد
                      </Button>
                      <Button size="small" color="inherit" onClick={() => setConfirmLargeGeneration(false)}>
                        إلغاء
                      </Button>
                    </Stack>
                  </Alert>
                ) : null}
                <Button
                  variant="contained"
                  size="large"
                  onClick={generateVariants}
                  disabled={!hasEnoughValues || actionLoading}
                  sx={{ mt: 1 }}
                >
                  {actionLoading ? <CircularProgress size={24} /> : `توليد ${hasEnoughValues ? combinationCount : 0} متغير`}
                </Button>
              </Box>
            </Stack>
          ) : (
            <Stack spacing={3}>
              {generatedVariantDrafts.length === 0 ? (
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                  لا توجد متغيرات مولدة غير محفوظة. المتغيرات الحالية تُدار من جدول المتغيرات في صفحة المنتج.
                </Alert>
              ) : (
                <>
                  <VariantBulkActionsToolbar
                    drafts={generatedVariantDrafts}
                    selectedDraftIds={editorSelectedIds}
                    onUpdateDrafts={handleBulkUpdate}
                    onDeleteSelected={() => {
                      setGeneratedVariantDrafts((drafts) => drafts.filter((d) => !editorSelectedIds.includes(d.id)));
                      setEditorSelectedIds([]);
                    }}
                    productTitle={productTitle}
                  />
                  <Divider />
                  <Button size="small" variant="outlined" onClick={openBulkWarehouse}>
                    تطبيق توزيع مستودعات موحد على كل المتغيرات
                  </Button>
                  <Divider />
                  <GeneratedVariantsEditor
                    drafts={generatedVariantDrafts}
                    onUpdateDraft={updateDraft}
                    onRemoveDraft={removeDraft}
                    onOpenWarehouseDrawer={openWarehouseForDraft}
                  />
                </>
              )}
            </Stack>
          )}
        </Box>

        <Box sx={{ p: 2.5, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Stack direction="row" spacing={1.5} justifyContent="flex-end">
            <Button onClick={onClose} color="inherit">
              إغلاق بدون حفظ
            </Button>
            <Button
              variant="contained"
              onClick={() => onSaveGeneratedVariants().catch(() => undefined)}
              disabled={actionLoading || generatedVariantDrafts.length === 0 || !selectedProduct}
            >
              {actionLoading ? 'جار الحفظ...' : `حفظ ${generatedVariantDrafts.length} متغير`}
            </Button>
          </Stack>
        </Box>
      </Stack>

      {warehouseTargetDraft ? (
        <VariantWarehouseDrawer
          open={Boolean(warehouseTargetDraft)}
          onClose={() => setWarehouseDrawerDraftId(null)}
          draftTitle={warehouseTargetDraft.title}
          warehouses={warehouses}
          warehouseRows={warehouseTargetDraft.warehouseRows}
          onUpdateRow={(warehouseId, patch) =>
            updateDraftWarehouseRow(warehouseTargetDraft.id, warehouseId, patch)
          }
        />
      ) : null}

      <VariantWarehouseDrawer
        open={isBulkWarehouseOpen}
        onClose={() => setIsBulkWarehouseOpen(false)}
        onApply={applyBulkWarehouse}
        draftTitle=""
        warehouses={warehouses}
        warehouseRows={bulkWarehouseRows}
        onUpdateRow={(warehouseId, patch) =>
          setBulkWarehouseRows((rows) =>
            rows.map((row) => (row.warehouseId === warehouseId ? { ...row, ...patch } : row)),
          )
        }
        isBulk
        bulkCount={generatedVariantDrafts.length}
      />
    </Drawer>
  );
}
