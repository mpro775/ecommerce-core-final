import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import type { ProductVariant } from '../../../../types';
import type { ProductVariantsSectionProps } from './variant-types';
import { countMissingPrice, countMissingStock } from './variant-utils';
import { VariantBuilderDrawer } from './variant-builder-drawer';
import { ExistingVariantEditorDrawer } from './existing-variant-editor-drawer';

export function ProductVariantsSection({
  request,
  selectedProduct,
  attributes,
  warehouses,
  generatedVariantDrafts,
  setGeneratedVariantDrafts,
  variantForm,
  setVariantForm: _setVariantForm,
  selectedVariantAttributeIds,
  setSelectedVariantAttributeIds,
  selectedProductWarehouseIds,
  warehousesSaving: _warehousesSaving,
  selectedVariantId: _selectedVariantId,
  setSelectedVariantId: _setSelectedVariantId,
  actionLoading,
  setMessage,
  onRefresh,
  onLoadProductDetails,
  isSingleProduct,
}: ProductVariantsSectionProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);

  const existingVariants = selectedProduct?.variants ?? [];
  const totalVariants = existingVariants.length;
  const generatedCount = generatedVariantDrafts.length;
  const missingPrice = countMissingPrice(generatedVariantDrafts);
  const missingStock = countMissingStock(generatedVariantDrafts);

  const usedAttributeNames = attributes
    .filter((attr) => selectedVariantAttributeIds.includes(attr.id))
    .map((attr) => attr.nameAr ?? attr.name);

  const isComplete = generatedCount === 0 || (missingPrice === 0 && missingStock === 0);

  async function handleSaveGeneratedVariants(): Promise<void> {
    if (!selectedProduct || generatedVariantDrafts.length === 0) return;

    if (generatedVariantDrafts.some((draft) => {
      const enabledRows = draft.warehouseRows.filter((r) => r.enabled);
      const allocations = enabledRows.map((row) => ({
        warehouseId: row.warehouseId,
        quantity: Number(row.quantity),
        lowStockThreshold: Number(row.lowStockThreshold),
        ...(row.reorderPoint.trim() ? { reorderPoint: Number(row.reorderPoint) } : {}),
      }));
      return allocations.some(
        (row) =>
          !Number.isInteger(row.quantity) ||
          row.quantity < 0 ||
          !Number.isInteger(row.lowStockThreshold) ||
          row.lowStockThreshold < 0 ||
          ('reorderPoint' in row && (!Number.isInteger(row.reorderPoint) || Number(row.reorderPoint) < 0)),
      );
    })) {
      setMessage({ text: 'تحقق من كميات المستودعات للمتغيرات المولدة قبل الحفظ', type: 'error' });
      return;
    }

    setMessage({ text: '', type: 'info' });
    try {
      for (const draft of generatedVariantDrafts) {
        const enabledRows = draft.warehouseRows.filter((r) => r.enabled);
        const allocations = enabledRows.map((row) => ({
          warehouseId: row.warehouseId,
          quantity: Number(row.quantity),
          lowStockThreshold: Number(row.lowStockThreshold),
          ...(row.reorderPoint.trim() ? { reorderPoint: Number(row.reorderPoint) } : {}),
        }));

        const payload = {
          title: draft.title,
          titleAr: draft.title,
          sku: draft.sku,
          ...(draft.barcode.trim() ? { barcode: draft.barcode.trim() } : {}),
          price: Number(draft.price || '0'),
          ...(draft.compareAtPrice.trim() ? { compareAtPrice: Number(draft.compareAtPrice) } : {}),
          stockQuantity: Number(draft.stockQuantity || '0'),
          lowStockThreshold: Number(draft.lowStockThreshold || '0'),
          attributeValueIds: Object.values(draft.selectedValueByAttributeId),
          isDefault: false,
        };

        const createdVariant = await request<any>(
          `/products/${selectedProduct.id}/variants`,
          { method: 'POST', body: JSON.stringify(payload) },
        );
        if (createdVariant && allocations.length > 0) {
          await request(`/warehouses/variants/${createdVariant.id}/allocations`, {
            method: 'PUT',
            body: JSON.stringify({ allocations }),
          });
        }
      }
      setGeneratedVariantDrafts([]);
      await onLoadProductDetails(selectedProduct.id);
      setMessage({ text: 'تم حفظ المتغيرات المولدة بنجاح.', type: 'success' });
      setDrawerOpen(false);
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'تعذر حفظ المتغيرات المولدة',
        type: 'error',
      });
    }
  }

  async function handleDeleteVariant(variantId: string): Promise<void> {
    if (!selectedProduct) return;
    try {
      await request(`/products/${selectedProduct.id}/variants/${variantId}`, { method: 'DELETE' });
      await onLoadProductDetails(selectedProduct.id);
      setMessage({ text: 'تم حذف المتغير.', type: 'success' });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'تعذر حذف المتغير',
        type: 'error',
      });
    }
  }

  if (!isSingleProduct) return null;

  return (
    <>
      <Paper
        elevation={0}
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          bgcolor: 'background.paper',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ px: { xs: 2.5, md: 3 }, py: 2.25 }}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Box>
              <Typography variant="h6" fontWeight={900}>
                المتغيرات والخصائص
              </Typography>
              <Typography variant="body2" color="text.secondary">
                إدارة متغيرات المنتج حسب اللون، الرام، السعة وغيرها.
              </Typography>
            </Box>
          </Stack>
        </Box>
        <Divider />

        <Box sx={{ px: { xs: 2.5, md: 3 }, py: { xs: 2.5, md: 3 } }}>
          <Stack spacing={2.5}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2 }}>
              <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'background.default' }}>
                <Typography variant="caption" color="text.secondary">متغيرات حالية</Typography>
                <Typography variant="h5" fontWeight={900}>{totalVariants}</Typography>
              </Paper>
              <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: generatedCount > 0 ? 'warning.main' : 'divider', bgcolor: generatedCount > 0 ? 'warning.50' : 'background.default' }}>
                <Typography variant="caption" color="text.secondary">مولدة غير محفوظة</Typography>
                <Typography variant="h5" fontWeight={900}>{generatedCount}</Typography>
              </Paper>
              <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: missingPrice > 0 ? 'error.main' : 'divider', bgcolor: missingPrice > 0 ? 'error.50' : 'background.default' }}>
                <Typography variant="caption" color="text.secondary">ناقصة السعر</Typography>
                <Typography variant="h5" fontWeight={900}>{missingPrice}</Typography>
              </Paper>
              <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: missingStock > 0 ? 'warning.main' : 'divider', bgcolor: missingStock > 0 ? 'warning.50' : 'background.default' }}>
                <Typography variant="caption" color="text.secondary">ناقصة المخزون</Typography>
                <Typography variant="h5" fontWeight={900}>{missingStock}</Typography>
              </Paper>
            </Box>

            {usedAttributeNames.length > 0 ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>الخصائص:</Typography>
                {usedAttributeNames.map((name) => (
                  <Chip key={name} size="small" label={name} variant="outlined" />
                ))}
              </Box>
            ) : null}

            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                size="small"
                label={isComplete ? 'مكتمل' : 'يحتاج مراجعة'}
                color={isComplete ? 'success' : 'warning'}
                sx={{ fontWeight: 800 }}
              />
            </Stack>

            {!selectedProduct ? (
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                احفظ المنتج كمسودة أولًا قبل إضافة متغيرات إضافية.
              </Alert>
            ) : null}

            {existingVariants.length > 0 ? (
              <Stack spacing={1}>
                <Typography variant="caption" color="text.secondary">
                  هذه المتغيرات محفوظة ويمكن تعديلها من زر إدارة. أما نافذة التوليد فهي لإنشاء متغيرات جديدة من الخصائص المحددة فقط.
                </Typography>
                <TableContainer component={Box} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>المتغير</TableCell>
                        <TableCell>السعر</TableCell>
                        <TableCell>المخزون</TableCell>
                        <TableCell>الحالة</TableCell>
                        <TableCell align="left">الإجراء</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {existingVariants.map((variant) => (
                        <TableRow key={variant.id} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight={700}>{variant.title}</Typography>
                            <Typography variant="caption" color="text.secondary" dir="ltr">SKU: {variant.sku}</Typography>
                          </TableCell>
                          <TableCell>{variant.price}</TableCell>
                          <TableCell>{variant.stockQuantity}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={variant.isDefault ? 'افتراضي' : 'عادي'}
                              color={variant.isDefault ? 'primary' : 'default'}
                              sx={{ fontWeight: 700 }}
                            />
                          </TableCell>
                          <TableCell align="left">
                            <Button size="small" variant="outlined" onClick={() => setEditingVariant(variant)}>
                              إدارة
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Stack>
            ) : null}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
              <Button variant="contained" onClick={() => setDrawerOpen(true)}>
                توليد متغيرات جديدة
              </Button>
              {generatedCount > 0 ? (
                <>
                  <Button
                    variant="outlined"
                    onClick={() => handleSaveGeneratedVariants().catch(() => undefined)}
                    disabled={actionLoading || !selectedProduct}
                  >
                    حفظ المتغيرات المولدة
                  </Button>
                  <Button
                    color="error"
                    variant="outlined"
                    onClick={() => setGeneratedVariantDrafts([])}
                    disabled={actionLoading}
                  >
                    حذف المتغيرات المولدة
                  </Button>
                </>
              ) : null}
            </Stack>
          </Stack>
        </Box>
      </Paper>

      <VariantBuilderDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        attributes={attributes}
        warehouses={warehouses}
        productTitle={selectedProduct?.title ?? ''}
        selectedProduct={selectedProduct}
        selectedProductWarehouseIds={selectedProductWarehouseIds}
        generatedVariantDrafts={generatedVariantDrafts}
        setGeneratedVariantDrafts={setGeneratedVariantDrafts}
        variantForm={variantForm}
        selectedVariantAttributeIds={selectedVariantAttributeIds}
        setSelectedVariantAttributeIds={setSelectedVariantAttributeIds}
        actionLoading={actionLoading}
        setMessage={setMessage}
        onSaveGeneratedVariants={handleSaveGeneratedVariants}
        onDeleteVariant={handleDeleteVariant}
        onRefresh={onRefresh}
        request={request}
      />

      <ExistingVariantEditorDrawer
        open={editingVariant !== null}
        productId={selectedProduct?.id ?? ''}
        variant={editingVariant}
        attributes={attributes}
        warehouses={warehouses}
        request={request}
        onClose={() => setEditingVariant(null)}
        onSaved={async () => {
          if (selectedProduct) await onLoadProductDetails(selectedProduct.id);
        }}
        onDeleted={async () => {
          if (selectedProduct) await onLoadProductDetails(selectedProduct.id);
        }}
        setMessage={setMessage}
      />
    </>
  );
}

