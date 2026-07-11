import {
  Alert,
  Box,
  Button,
  Checkbox,
  Collapse,
  Divider,
  Drawer,
  FormControlLabel,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import type { Attribute, ProductVariant, Warehouse } from '../../../../types';
import type { MerchantRequester } from '../../../../merchant-dashboard.types';
import { clearFieldErrors, isApiError, mapFieldErrors } from '../../../../../../lib/api-error';
import type { ProductWarehouseAllocationRow } from './variant-types';
import { validateWarehouseAllocationRows } from './variant-utils';

interface ExistingVariantEditorDrawerProps {
  open: boolean;
  productId: string;
  variant: ProductVariant | null;
  attributes: Attribute[];
  warehouses: Warehouse[];
  request: MerchantRequester;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onDeleted: () => Promise<void>;
  setMessage: (msg: { text: string; type: 'info' | 'success' | 'error' }) => void;
}

interface VariantEditForm {
  title: string;
  sku: string;
  barcode: string;
  price: string;
  compareAtPrice: string;
  stockQuantity: string;
  lowStockThreshold: string;
  isDefault: boolean;
  selectedValueByAttributeId: Record<string, string>;
}

interface CurrencyOverrideFormRow {
  currencyCode: string;
  price: string;
  compareAtPrice: string;
}

export function ExistingVariantEditorDrawer({
  open,
  productId,
  variant,
  attributes,
  warehouses,
  request,
  onClose,
  onSaved,
  onDeleted,
  setMessage,
}: ExistingVariantEditorDrawerProps) {
  const [form, setForm] = useState<VariantEditForm>({
    title: '',
    sku: '',
    barcode: '',
    price: '0',
    compareAtPrice: '',
    stockQuantity: '0',
    lowStockThreshold: '0',
    isDefault: false,
    selectedValueByAttributeId: {},
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [warehouseExpanded, setWarehouseExpanded] = useState(false);
  const [warehouseRows, setWarehouseRows] = useState<ProductWarehouseAllocationRow[]>([]);
  const [warehouseLoading, setWarehouseLoading] = useState(false);
  const [currencyOverrideRows, setCurrencyOverrideRows] = useState<CurrencyOverrideFormRow[]>([]);

  useEffect(() => {
    if (!variant) return;
    const attributeValueIds = variant.attributeValueIds ?? [];
    const selectedValueByAttributeId: Record<string, string> = {};
    for (const attr of attributes) {
      for (const val of attr.values ?? []) {
        if (attributeValueIds.includes(val.id)) {
          selectedValueByAttributeId[attr.id] = val.id;
        }
      }
    }
    setForm({
      title: variant.title ?? '',
      sku: variant.sku ?? '',
      barcode: variant.barcode ?? '',
      price: String(variant.price ?? '0'),
      compareAtPrice: variant.compareAtPrice != null ? String(variant.compareAtPrice) : '',
      stockQuantity: String(variant.stockQuantity ?? 0),
      lowStockThreshold: String(variant.lowStockThreshold ?? 0),
      isDefault: Boolean(variant.isDefault),
      selectedValueByAttributeId,
    });
    setWarehouseExpanded(false);
    setCurrencyOverrideRows(
      (variant.currencyOverrides ?? []).map((override) => ({
        currencyCode: override.currencyCode,
        price: String(override.price),
        compareAtPrice: override.compareAtPrice !== null ? String(override.compareAtPrice) : '',
      })),
    );
  }, [variant, attributes]);

  async function loadWarehouseAllocations(): Promise<void> {
    if (!variant) return;
    setWarehouseLoading(true);
    try {
      const allocations = await request<any[]>(`/warehouses/variants/${variant.id}/allocations`, {
        method: 'GET',
      });
      const byWarehouseId = new Map((allocations ?? []).map((row: any) => [row.warehouseId, row]));
      setWarehouseRows(
        warehouses.map((w) => {
          const allocation = byWarehouseId.get(w.id);
          return {
            warehouseId: w.id,
            enabled: allocation !== undefined,
            quantity: String(allocation?.quantity ?? 0),
            reservedQuantityReadonly: allocation?.reservedQuantity ?? 0,
            lowStockThreshold: String(allocation?.lowStockThreshold ?? 0),
            reorderPoint:
              allocation?.reorderPoint !== null && allocation?.reorderPoint !== undefined
                ? String(allocation.reorderPoint)
                : '',
          };
        }),
      );
    } catch {
      setWarehouseRows(
        warehouses.map((w) => ({
          warehouseId: w.id,
          enabled: false,
          quantity: '0',
          reservedQuantityReadonly: 0,
          lowStockThreshold: '0',
          reorderPoint: '',
        })),
      );
    } finally {
      setWarehouseLoading(false);
    }
  }

  async function handleSave(): Promise<void> {
    if (!variant) return;
    setSaving(true);
    setFieldErrors({});
    try {
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        sku: form.sku.trim(),
        barcode: form.barcode.trim() || null,
        price: Number(form.price) || 0,
        compareAtPrice: form.compareAtPrice.trim() ? Number(form.compareAtPrice) : null,
        stockQuantity: Number(form.stockQuantity) || 0,
        lowStockThreshold: Number(form.lowStockThreshold) || 0,
        isDefault: form.isDefault,
      };

      const attributeValueIds = Object.values(form.selectedValueByAttributeId).filter(Boolean);
      if (attributeValueIds.length > 0) {
        payload.attributeValueIds = attributeValueIds;
      }

      await request(`/products/${productId}/variants/${variant.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      await request(`/products/${productId}/variants/${variant.id}/currency-prices`, {
        method: 'PUT',
        body: JSON.stringify({
          overrides: currencyOverrideRows
            .filter((row) => row.currencyCode.trim() && row.currencyCode.trim().toUpperCase() !== 'YER' && row.price.trim())
            .map((row) => ({
              currencyCode: row.currencyCode.trim().toUpperCase(),
              price: Number(row.price),
              compareAtPrice: row.compareAtPrice.trim() ? Number(row.compareAtPrice) : null,
            })),
        }),
      });

      if (warehouseExpanded) {
        const allocations = warehouseRows
          .filter((row) => row.enabled)
          .map((row) => ({
            warehouseId: row.warehouseId,
            quantity: Number(row.quantity),
            lowStockThreshold: Number(row.lowStockThreshold),
            ...(row.reorderPoint.trim() ? { reorderPoint: Number(row.reorderPoint) } : {}),
          }));
        if (allocations.length > 0) {
          await request(`/warehouses/variants/${variant.id}/allocations`, {
            method: 'PUT',
            body: JSON.stringify({ allocations }),
          });
        }
      }

      setMessage({ text: 'تم حفظ تعديلات المتغير بنجاح.', type: 'success' });
      await onSaved();
      onClose();
    } catch (error) {
      if (isApiError(error)) {
        setFieldErrors(mapVariantFieldErrors(error.fieldErrors));
      }
      setMessage({
        text: error instanceof Error ? error.message : 'تعذر حفظ تعديلات المتغير',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(): Promise<void> {
    if (!variant) return;
    if (!window.confirm(`هل أنت متأكد من حذف المتغير "${variant.title}"؟`)) return;
    setDeleting(true);
    try {
      await request(`/products/${productId}/variants/${variant.id}`, { method: 'DELETE' });
      setMessage({ text: 'تم حذف المتغير بنجاح.', type: 'success' });
      await onDeleted();
      onClose();
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'تعذر حذف المتغير',
        type: 'error',
      });
    } finally {
      setDeleting(false);
    }
  }

  function updateWarehouseRow(
    warehouseId: string,
    patch: Partial<ProductWarehouseAllocationRow>,
  ): void {
    setWarehouseRows((rows) =>
      rows.map((row) => (row.warehouseId === warehouseId ? { ...row, ...patch } : row)),
    );
  }

  function updateCurrencyOverrideRow(index: number, patch: Partial<CurrencyOverrideFormRow>): void {
    setCurrencyOverrideRows((prev) =>
      prev.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    );
  }

  const relevantAttributes = attributes.filter((attr) =>
    (attr.values ?? []).some((val) =>
      (variant?.attributeValueIds ?? []).includes(val.id),
    ),
  );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      anchor="left"
      sx={{
        '& .MuiDrawer-paper': {
          width: '100%',
          maxWidth: 640,
          height: '100vh',
        },
      }}
    >
      <Stack sx={{ height: '100%', direction: 'rtl' }}>
        <Box sx={{ p: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h5" fontWeight={900}>
                تعديل المتغير
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {variant?.title ?? ''}
              </Typography>
            </Box>
            <Button onClick={onClose} color="inherit" sx={{ fontWeight: 700 }}>
              إغلاق
            </Button>
          </Stack>
        </Box>

        <Box sx={{ flex: 1, overflow: 'auto', p: { xs: 2, md: 3 } }}>
          <Stack spacing={2.5}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <TextField
                label="اسم المتغير"
                value={form.title}
                error={Boolean(fieldErrors.title)}
                helperText={fieldErrors.title}
                onChange={(e) => {
                  setFieldErrors((prev) => clearFieldErrors(prev, ['title']));
                  setForm((prev) => ({ ...prev, title: e.target.value }));
                }}
              />
              <TextField
                label="SKU"
                value={form.sku}
                error={Boolean(fieldErrors.sku)}
                helperText={fieldErrors.sku}
                onChange={(e) => {
                  setFieldErrors((prev) => clearFieldErrors(prev, ['sku']));
                  setForm((prev) => ({ ...prev, sku: e.target.value }));
                }}
                dir="ltr"
              />
              <TextField
                label="الباركود"
                value={form.barcode}
                error={Boolean(fieldErrors.barcode)}
                helperText={fieldErrors.barcode}
                onChange={(e) => {
                  setFieldErrors((prev) => clearFieldErrors(prev, ['barcode']));
                  setForm((prev) => ({ ...prev, barcode: e.target.value }));
                }}
                dir="ltr"
              />
              <TextField
                label="السعر"
                type="number"
                value={form.price}
                error={Boolean(fieldErrors.price)}
                helperText={fieldErrors.price}
                onChange={(e) => {
                  setFieldErrors((prev) => clearFieldErrors(prev, ['price']));
                  setForm((prev) => ({ ...prev, price: e.target.value }));
                }}
              />
              <TextField
                label="السعر قبل الخصم"
                type="number"
                value={form.compareAtPrice}
                error={Boolean(fieldErrors.compareAtPrice)}
                helperText={fieldErrors.compareAtPrice}
                onChange={(e) => {
                  setFieldErrors((prev) => clearFieldErrors(prev, ['compareAtPrice']));
                  setForm((prev) => ({ ...prev, compareAtPrice: e.target.value }));
                }}
              />
              <TextField
                label="الكمية المتوفرة"
                type="number"
                value={form.stockQuantity}
                error={Boolean(fieldErrors.stockQuantity)}
                helperText={fieldErrors.stockQuantity}
                onChange={(e) => {
                  setFieldErrors((prev) => clearFieldErrors(prev, ['stockQuantity']));
                  setForm((prev) => ({ ...prev, stockQuantity: e.target.value }));
                }}
              />
              <TextField
                label="حد تنبيه المخزون"
                type="number"
                value={form.lowStockThreshold}
                error={Boolean(fieldErrors.lowStockThreshold)}
                helperText={fieldErrors.lowStockThreshold}
                onChange={(e) => {
                  setFieldErrors((prev) => clearFieldErrors(prev, ['lowStockThreshold']));
                  setForm((prev) => ({ ...prev, lowStockThreshold: e.target.value }));
                }}
              />
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={form.isDefault}
                      onChange={(e) => setForm((prev) => ({ ...prev, isDefault: e.target.checked }))}
                    />
                  }
                  label="المتغير الافتراضي"
                />
              </Box>
            </Box>

            <Divider />
            <Stack spacing={1.5}>
              <Typography variant="subtitle1" fontWeight={900}>
                Ø£Ø³Ø¹Ø§Ø± ÙŠØ¯ÙˆÙŠØ© Ù„Ù„Ø¹Ù…Ù„Ø§Øª Ø§Ù„Ø£Ø®Ø±Ù‰
              </Typography>
              {currencyOverrideRows.map((row, index) => (
                <Box key={`${row.currencyCode}-${index}`} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '0.8fr 1fr 1fr auto' }, gap: 1.5 }}>
                  <TextField
                    label="Currency"
                    value={row.currencyCode}
                    onChange={(e) => updateCurrencyOverrideRow(index, { currencyCode: e.target.value.toUpperCase().slice(0, 3) })}
                    dir="ltr"
                  />
                  <TextField
                    label="Ø§Ù„Ø³Ø¹Ø±"
                    type="number"
                    value={row.price}
                    onChange={(e) => updateCurrencyOverrideRow(index, { price: e.target.value })}
                  />
                  <TextField
                    label="Ø§Ù„Ø³Ø¹Ø± Ù‚Ø¨Ù„ Ø§Ù„Ø®ØµÙ…"
                    type="number"
                    value={row.compareAtPrice}
                    onChange={(e) => updateCurrencyOverrideRow(index, { compareAtPrice: e.target.value })}
                  />
                  <Button color="error" onClick={() => setCurrencyOverrideRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index))}>
                    Ø­Ø°Ù
                  </Button>
                </Box>
              ))}
              <Button
                variant="outlined"
                onClick={() => setCurrencyOverrideRows((prev) => [...prev, { currencyCode: 'USD', price: '', compareAtPrice: '' }])}
                sx={{ alignSelf: 'flex-start', fontWeight: 800 }}
              >
                Ø¥Ø¶Ø§ÙØ© Ø³Ø¹Ø± Ø¨Ø¹Ù…Ù„Ø©
              </Button>
            </Stack>

            {relevantAttributes.length > 0 ? (
              <>
                <Divider />
                <Typography variant="subtitle1" fontWeight={900}>
                  خصائص المتغير
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                  {relevantAttributes.map((attr) => (
                    <TextField
                      key={attr.id}
                      select
                      label={attr.nameAr ?? attr.name}
                      value={form.selectedValueByAttributeId[attr.id] ?? ''}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          selectedValueByAttributeId: {
                            ...prev.selectedValueByAttributeId,
                            [attr.id]: e.target.value,
                          },
                        }))
                      }
                    >
                      <MenuItem value="">غير محدد</MenuItem>
                      {(attr.values ?? [])
                        .filter((v) => v.isActive)
                        .map((val) => (
                          <MenuItem key={val.id} value={val.id}>
                            {val.valueAr ?? val.value}
                          </MenuItem>
                        ))}
                    </TextField>
                  ))}
                </Box>
              </>
            ) : null}

            {warehouses.length > 0 ? (
              <>
                <Divider />
                <Button
                  variant="outlined"
                  onClick={() => {
                    if (!warehouseExpanded) {
                      loadWarehouseAllocations().catch(() => undefined);
                    }
                    setWarehouseExpanded((prev) => !prev);
                  }}
                >
                  {warehouseExpanded ? 'إخفاء توزيع المستودعات' : 'عرض توزيع المستودعات'}
                </Button>
                <Collapse in={warehouseExpanded}>
                  {warehouseLoading ? (
                    <Typography variant="body2" color="text.secondary">
                      جارٍ التحميل...
                    </Typography>
                  ) : (
                    <TableContainer component={Box} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
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
                          {warehouseRows.map((row) => {
                            const warehouse = warehouses.find((w) => w.id === row.warehouseId);
                            return (
                              <TableRow key={row.warehouseId}>
                                <TableCell>
                                  <Checkbox
                                    checked={row.enabled}
                                    onChange={(e) => updateWarehouseRow(row.warehouseId, { enabled: e.target.checked })}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2" fontWeight={700}>
                                    {warehouse?.nameAr || warehouse?.name || '-'}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" dir="ltr">
                                    {warehouse?.code ?? '-'}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <TextField
                                    size="small"
                                    type="number"
                                    value={row.quantity}
                                    onChange={(e) => updateWarehouseRow(row.warehouseId, { quantity: e.target.value })}
                                    disabled={!row.enabled}
                                    variant="standard"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2" color="text.secondary">
                                    {row.reservedQuantityReadonly}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <TextField
                                    size="small"
                                    type="number"
                                    value={row.lowStockThreshold}
                                    onChange={(e) => updateWarehouseRow(row.warehouseId, { lowStockThreshold: e.target.value })}
                                    disabled={!row.enabled}
                                    variant="standard"
                                  />
                                </TableCell>
                                <TableCell>
                                  <TextField
                                    size="small"
                                    type="number"
                                    value={row.reorderPoint}
                                    onChange={(e) => updateWarehouseRow(row.warehouseId, { reorderPoint: e.target.value })}
                                    disabled={!row.enabled}
                                    variant="standard"
                                  />
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                  {!validateWarehouseAllocationRows(warehouseRows) ? (
                    <Alert severity="error" sx={{ mt: 1 }}>
                      تحقق من صحة الكميات (أرقام صحيحة غير سالبة).
                    </Alert>
                  ) : null}
                </Collapse>
              </>
            ) : null}
          </Stack>
        </Box>

        <Box sx={{ p: 2.5, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Stack direction="row" spacing={1.5} justifyContent="space-between">
            <Button
              color="error"
              variant="outlined"
              onClick={() => handleDelete().catch(() => undefined)}
              disabled={deleting || saving}
            >
              {deleting ? 'جارٍ الحذف...' : 'حذف المتغير'}
            </Button>
            <Stack direction="row" spacing={1.5}>
              <Button onClick={onClose} color="inherit">
                إلغاء
              </Button>
              <Button
                variant="contained"
                onClick={() => handleSave().catch(() => undefined)}
                disabled={saving || deleting}
              >
                {saving ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Stack>
    </Drawer>
  );
}

function mapVariantFieldErrors(fieldErrors: Record<string, string[]>): Record<string, string> {
  return mapFieldErrors(fieldErrors, {
    title: ['title'],
    sku: ['sku'],
    barcode: ['barcode'],
    price: ['price'],
    compareAtPrice: ['compareAtPrice'],
    stockQuantity: ['stockQuantity'],
    lowStockThreshold: ['lowStockThreshold'],
  });
}
