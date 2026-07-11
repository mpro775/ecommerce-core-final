import { AddShoppingCartIcon, AssignmentReturnIcon, LocalOfferIcon, WarningAmberIcon } from '../../../../components/icons';
import { useState, useEffect } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Stack,
  TextField,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
} from '@mui/material';

import type { MerchantRequester } from '../../merchant-dashboard.types';
import { AppPage, DataTableWrapper, PageHeader, SectionCard } from '../../components/ui';
import type {
  InventoryVariantSnapshot,
  PaginatedInventoryMovements,
  PaginatedInventoryReservations,
  ProductListResponse,
  Warehouse,
} from '../../types';

interface InventoryPanelProps {
  request: MerchantRequester;
}

interface InventoryVariantOption {
  variantId: string;
  productTitle: string;
  variantTitle: string;
  sku: string;
  stockQuantity: number;
  lowStockThreshold: number;
}

export function InventoryPanel({ request }: InventoryPanelProps) {
  const [movements, setMovements] = useState<PaginatedInventoryMovements['items']>([]);
  const [reservations, setReservations] = useState<PaginatedInventoryReservations['items']>([]);
  const [alerts, setAlerts] = useState<InventoryVariantSnapshot[]>([]);
  const [warehousePriority, setWarehousePriority] = useState<Warehouse[]>([]);
  const [variantOptions, setVariantOptions] = useState<InventoryVariantOption[]>([]);
  
  const [adjustVariantId, setAdjustVariantId] = useState('');
  const [adjustWarehouseId, setAdjustWarehouseId] = useState('');
  const [adjustDelta, setAdjustDelta] = useState('0');
  const [adjustNote, setAdjustNote] = useState('');
  
  const [thresholdVariantId, setThresholdVariantId] = useState('');
  const [thresholdValue, setThresholdValue] = useState('0');
  
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [prioritySaving, setPrioritySaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: 'info' as 'info' | 'success' | 'error' });

  useEffect(() => {
    loadInventoryData().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadInventoryData(): Promise<void> {
    setLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      const [alertsData, movementsData, reservationsData, warehousesData] = await Promise.all([
        request<InventoryVariantSnapshot[]>('/inventory/alerts/low-stock', { method: 'GET' }),
        request<PaginatedInventoryMovements>('/inventory/movements?page=1&limit=20', {
          method: 'GET',
        }),
        request<PaginatedInventoryReservations>('/inventory/reservations?page=1&limit=20', {
          method: 'GET',
        }),
        request<Warehouse[]>('/warehouses', { method: 'GET' }),
      ]);
      const productData = await request<ProductListResponse>('/products?page=1&limit=200', {
        method: 'GET',
      });

      setAlerts(alertsData ?? []);
      setMovements(movementsData?.items ?? []);
      setReservations(reservationsData?.items ?? []);
      setWarehousePriority(warehousesData ?? []);
      setVariantOptions(
        (productData?.items ?? []).flatMap((product) =>
          (product.variants ?? []).map((variant) => ({
            variantId: variant.id,
            productTitle: product.titleAr ?? product.title,
            variantTitle: variant.titleAr ?? variant.title,
            sku: variant.sku,
            stockQuantity: variant.stockQuantity,
            lowStockThreshold: variant.lowStockThreshold,
          })),
        ),
      );
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'تعذر تحميل بيانات المخزون', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function adjustInventory(): Promise<void> {
    const variantId = adjustVariantId.trim();
    const warehouseId = adjustWarehouseId.trim();
    const quantityDelta = Number(adjustDelta);

    if (!variantId) {
      setMessage({ text: 'معرّف المتغير مطلوب لتعديل المخزون', type: 'error' });
      return;
    }
    if (!warehouseId) {
      setMessage({ text: 'يجب اختيار المستودع لتعديل المخزون', type: 'error' });
      return;
    }
    if (!Number.isInteger(quantityDelta) || quantityDelta === 0) {
      setMessage({ text: 'يجب أن تكون قيمة التعديل رقماً صحيحاً وغير صفري', type: 'error' });
      return;
    }

    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      await request(`/inventory/variants/${variantId}/adjustments`, {
        method: 'POST',
        body: JSON.stringify({
          warehouseId,
          quantityDelta,
          note: adjustNote.trim() || undefined,
        }),
      });
      await loadInventoryData();
      setAdjustDelta('0');
      setAdjustNote('');
      setMessage({ text: 'تم تعديل المخزون بنجاح', type: 'success' });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'تعذر تعديل المخزون', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function updateThreshold(): Promise<void> {
    const variantId = thresholdVariantId.trim();
    const lowStockThreshold = Number(thresholdValue);

    if (!variantId) {
      setMessage({ text: 'معرّف المتغير مطلوب لتحديث حد التنبيه', type: 'error' });
      return;
    }
    if (!Number.isInteger(lowStockThreshold) || lowStockThreshold < 0) {
      setMessage({ text: 'حد انخفاض المخزون يجب أن يكون رقماً صحيحاً أكبر أو يساوي 0', type: 'error' });
      return;
    }

    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      await request(`/inventory/variants/${variantId}/threshold`, {
        method: 'PUT',
        body: JSON.stringify({ lowStockThreshold }),
      });
      await loadInventoryData();
      setMessage({ text: 'تم تحديث حد انخفاض المخزون بنجاح', type: 'success' });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'تعذر تحديث حد التنبيه', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  function moveWarehousePriority(warehouseId: string, direction: 'up' | 'down'): void {
    setWarehousePriority((current) => {
      const index = current.findIndex((item) => item.id === warehouseId);
      if (index < 0) {
        return current;
      }

      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }

      const next = [...current];
      const sourceItem = next[index];
      const targetItem = next[targetIndex];
      if (!sourceItem || !targetItem) {
        return current;
      }

      next[index] = targetItem;
      next[targetIndex] = sourceItem;
      return next;
    });
  }

  async function saveWarehousePriorityOrder(): Promise<void> {
    if (warehousePriority.length === 0) {
      setMessage({ text: 'لا توجد مستودعات لحفظ ترتيب السحب.', type: 'error' });
      return;
    }

    setPrioritySaving(true);
    setMessage({ text: '', type: 'info' });
    try {
      const updated = await request<Warehouse[]>('/warehouses/priority-order', {
        method: 'PUT',
        body: JSON.stringify({ warehouseIds: warehousePriority.map((item) => item.id) }),
      });
      setWarehousePriority(updated ?? []);
      setMessage({ text: 'تم حفظ أولوية السحب من المستودعات بنجاح.', type: 'success' });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'تعذر حفظ ترتيب أولوية السحب',
        type: 'error',
      });
    } finally {
      setPrioritySaving(false);
    }
  }

  return (
    <AppPage>
      <PageHeader
        title="إدارة المخزون"
        description="مراقبة الحركات والتنبيهات وتنفيذ التعديلات اليدوية بدقة."
        actions={
          <Button variant="outlined" onClick={() => loadInventoryData().catch(() => undefined)} disabled={loading}>
            تحديث البيانات
          </Button>
        }
      />

      {message.text ? <Alert severity={message.type}>{message.text}</Alert> : null}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Quick Actions / Adjustments */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
            <Box>
              <SectionCard>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                  <AddShoppingCartIcon color="primary" />
                  <Typography variant="h6" fontWeight={800}>تعديل مخزون يدوي</Typography>
                </Box>
                <Stack spacing={2}>
                  <Autocomplete
                    size="small"
                    options={variantOptions}
                    value={variantOptions.find((option) => option.variantId === adjustVariantId) ?? null}
                    onChange={(_, value) => setAdjustVariantId(value?.variantId ?? '')}
                    getOptionLabel={(option) => `${option.productTitle} - ${option.variantTitle} (${option.sku})`}
                    isOptionEqualToValue={(option, value) => option.variantId === value.variantId}
                    renderOption={(props, option) => (
                      <Box component="li" {...props} key={option.variantId}>
                        <Box>
                          <Typography variant="body2" fontWeight={700}>{option.productTitle}</Typography>
                          <Typography variant="caption" color="text.secondary" dir="ltr">
                            {option.variantTitle} - SKU: {option.sku} - Stock: {option.stockQuantity}
                          </Typography>
                        </Box>
                      </Box>
                    )}
                    renderInput={(params) => (
                      <TextField {...params} label="اختر المتغير بالاسم أو SKU" fullWidth />
                    )}
                  />
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Autocomplete
                      size="small"
                      options={warehousePriority}
                      value={warehousePriority.find((w) => w.id === adjustWarehouseId) ?? null}
                      onChange={(_, value) => setAdjustWarehouseId(value?.id ?? '')}
                      getOptionLabel={(option) => option.nameAr || option.name}
                      isOptionEqualToValue={(option, value) => option.id === value.id}
                      renderInput={(params) => (
                        <TextField {...params} label="اختر المستودع" fullWidth />
                      )}
                      sx={{ minWidth: 200 }}
                    />
                    <TextField size="small" label="فرق الكمية (مثل: 5 أو -2)" type="number" inputProps={{ step: 1 }} fullWidth value={adjustDelta} onChange={(event) => setAdjustDelta(event.target.value)} />
                  </Box>
                  <TextField size="small" label="ملاحظة أو سبب التعديل" fullWidth value={adjustNote} onChange={(event) => setAdjustNote(event.target.value)} />
                  <Button variant="contained" onClick={() => adjustInventory().catch(() => undefined)} disabled={actionLoading} disableElevation>
                    تطبيق التعديل
                  </Button>
                </Stack>
              </SectionCard>
            </Box>

            <Box>
              <SectionCard>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                  <WarningAmberIcon color="warning" />
                  <Typography variant="h6" fontWeight={800}>حد تنبيه انخفاض المخزون</Typography>
                </Box>
                <Stack spacing={2}>
                  <Autocomplete
                    size="small"
                    options={variantOptions}
                    value={variantOptions.find((option) => option.variantId === thresholdVariantId) ?? null}
                    onChange={(_, value) => setThresholdVariantId(value?.variantId ?? '')}
                    getOptionLabel={(option) => `${option.productTitle} - ${option.variantTitle} (${option.sku})`}
                    isOptionEqualToValue={(option, value) => option.variantId === value.variantId}
                    renderOption={(props, option) => (
                      <Box component="li" {...props} key={option.variantId}>
                        <Box>
                          <Typography variant="body2" fontWeight={700}>{option.productTitle}</Typography>
                          <Typography variant="caption" color="text.secondary" dir="ltr">
                            {option.variantTitle} - SKU: {option.sku} - Threshold: {option.lowStockThreshold}
                          </Typography>
                        </Box>
                      </Box>
                    )}
                    renderInput={(params) => (
                      <TextField {...params} label="اختر المتغير بالاسم أو SKU" fullWidth />
                    )}
                  />
                  <TextField size="small" label="الحد الأدنى للتنبيه" type="number" inputProps={{ min: 0, step: 1 }} fullWidth value={thresholdValue} onChange={(event) => setThresholdValue(event.target.value)} />
                  <Button variant="outlined" color="warning" onClick={() => updateThreshold().catch(() => undefined)} disabled={actionLoading}>
                    تحديث الحد
                  </Button>
                </Stack>
              </SectionCard>
            </Box>
          </Box>

          <DataTableWrapper>
            <Box sx={{ p: 2, bgcolor: 'background.default', borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
              <Box>
                <Typography variant="h6" fontWeight={800}>أولوية السحب من المستودعات</Typography>
                <Typography variant="caption" color="text.secondary">
                  الترتيب من الأعلى إلى الأدنى. السحب يتم تلقائيًا وفق هذا التسلسل عند خصم المخزون.
                </Typography>
              </Box>
              <Button variant="contained" onClick={() => saveWarehousePriorityOrder().catch(() => undefined)} disabled={prioritySaving || actionLoading || warehousePriority.length === 0}>
                حفظ ترتيب السحب
              </Button>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>الترتيب</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>المستودع</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>الكود</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>الحالة</TableCell>
                    <TableCell align="left" sx={{ fontWeight: 700 }}>تحكم</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {warehousePriority.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                        <Typography color="text.secondary">لا توجد مستودعات متاحة.</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    warehousePriority.map((warehouse, index) => (
                      <TableRow key={warehouse.id} hover>
                        <TableCell>
                          <Chip size="small" color={index === 0 ? 'primary' : 'default'} label={`#${index + 1}`} />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={700}>{warehouse.nameAr || warehouse.name}</Typography>
                          <Typography variant="caption" color="text.secondary">{warehouse.nameEn}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace">{warehouse.code}</Typography>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.8}>
                            {warehouse.isDefault ? <Chip size="small" color="primary" label="افتراضي" /> : null}
                            <Chip size="small" color={warehouse.isActive ? 'success' : 'default'} label={warehouse.isActive ? 'نشط' : 'غير نشط'} />
                          </Stack>
                        </TableCell>
                        <TableCell align="left">
                          <Stack direction="row" spacing={1}>
                            <Button size="small" disabled={index === 0} onClick={() => moveWarehousePriority(warehouse.id, 'up')}>
                              رفع
                            </Button>
                            <Button size="small" disabled={index === warehousePriority.length - 1} onClick={() => moveWarehousePriority(warehouse.id, 'down')}>
                              خفض
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </DataTableWrapper>

          {/* Alerts Table */}
          <DataTableWrapper>
            <Box sx={{ p: 2, bgcolor: 'error.50', borderBottom: '1px solid', borderColor: 'error.light', display: 'flex', alignItems: 'center', gap: 1 }}>
              <WarningAmberIcon color="error" />
              <Typography variant="h6" fontWeight={800} color="error.dark">تنبيهات انخفاض المخزون ({alerts.length})</Typography>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'background.paper' }}>
                    <TableCell sx={{ fontWeight: 700 }}>المنتج / المتغير</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>SKU</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>المتوفر / المحجوز</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>المخزون الفعلي</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>حد التنبيه</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {alerts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                        <Typography color="text.secondary">المخزون بوضع جيد. لا توجد تنبيهات.</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    alerts.map((alert) => (
                      <TableRow key={alert.variantId} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={700}>{alert.productTitle}</Typography>
                          <Typography variant="caption" color="text.secondary">{alert.variantTitle}</Typography>
                        </TableCell>
                        <TableCell><Typography variant="body2" fontFamily="monospace">{alert.sku}</Typography></TableCell>
                        <TableCell align="center">
                          <Typography variant="body2" color="success.main" display="inline" fontWeight={700}>{alert.availableQuantity}</Typography>
                          {' / '}
                          <Typography variant="body2" color="warning.main" display="inline" fontWeight={700}>{alert.reservedQuantity}</Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip size="small" label={alert.stockQuantity} color="error" sx={{ fontWeight: 700 }} />
                        </TableCell>
                        <TableCell align="center">{alert.lowStockThreshold}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </DataTableWrapper>

          {/* Movements and Reservations */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3 }}>
            <Box>
              <DataTableWrapper>
                <Box sx={{ p: 2, bgcolor: 'background.default', borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AssignmentReturnIcon color="action" />
                  <Typography variant="subtitle1" fontWeight={800}>آخر الحركات</Typography>
                </Box>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>النوع</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>SKU</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>الكمية</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>ملاحظة</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {movements.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                            <Typography color="text.secondary" variant="body2">لا توجد حركات.</Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        movements.map((movement) => (
                          <TableRow key={movement.id} hover>
                            <TableCell>
                              <Chip size="small" label={movement.movementType} variant="outlined" />
                            </TableCell>
                            <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{movement.sku}</TableCell>
                            <TableCell>
                              <Typography variant="body2" fontWeight={700} color={movement.qtyDelta > 0 ? 'success.main' : 'error.main'} dir="ltr">
                                {movement.qtyDelta > 0 ? `+${movement.qtyDelta}` : movement.qtyDelta}
                              </Typography>
                            </TableCell>
                            <TableCell><Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 150 }}>{movement.note ?? '-'}</Typography></TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </DataTableWrapper>
            </Box>

            <Box>
              <DataTableWrapper>
                <Box sx={{ p: 2, bgcolor: 'background.default', borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LocalOfferIcon color="action" />
                  <Typography variant="subtitle1" fontWeight={800}>الحجوزات النشطة (للطلبات غير المكتملة)</Typography>
                </Box>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>SKU</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>الكمية المحجوزة</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>حالة الحجز</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>رقم الطلب</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {reservations.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                            <Typography color="text.secondary" variant="body2">لا توجد حجوزات نشطة.</Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        reservations.map((reservation) => (
                          <TableRow key={reservation.id} hover>
                            <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{reservation.sku}</TableCell>
                            <TableCell align="center">
                              <Typography variant="body2" fontWeight={700} color="warning.main">
                                {reservation.quantity}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip size="small" label={reservation.status} color="warning" sx={{ height: 20, fontSize: '0.7rem' }} />
                            </TableCell>
                            <TableCell>
                              <Typography variant="caption" color="text.secondary">{reservation.orderId.slice(0,8)}...</Typography>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </DataTableWrapper>
            </Box>
          </Box>
        </>
      )}
    </AppPage>
  );
}
