import { AddIcon, ArrowForwardIcon, DeleteOutlineIcon, EditNoteIcon, LocalShippingIcon } from '../../../../components/icons';
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
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

import type { MerchantRequester } from '../../merchant-dashboard.types';
import type {
  ShippingMethod,
  ShippingMethodRange,
  ShippingMethodType,
  ShippingZone,
  StoreSettingsOptions,
} from '../../types';
import { FloatingActionButton } from '../../components/ui';
import { clearFieldErrors, isApiError, mapFieldErrors } from '../../../../lib/api-error';

interface ShippingPanelProps {
  request: MerchantRequester;
}

const methodTypes: Array<{ value: ShippingMethodType; label: string }> = [
  { value: 'flat_rate', label: 'سعر ثابت' },
  { value: 'by_weight', label: 'حسب الوزن' },
  { value: 'by_item', label: 'حسب المنتج/الكمية' },
  { value: 'weight_tier', label: 'جدول حسب الوزن' },
  { value: 'order_value_tier', label: 'جدول حسب قيمة الطلب' },
  { value: 'free_shipping', label: 'توصيل مجاني' },
  { value: 'store_pickup', label: 'استلام من المتجر' },
];

const emptyZoneForm = {
  name: '',
  city: '',
  area: '',
  description: '',
  fee: '0',
  isActive: true,
};

const emptyMethodForm = {
  type: 'flat_rate' as ShippingMethodType,
  displayName: '',
  description: '',
  isActive: true,
  sortOrder: '0',
  minDeliveryDays: '0',
  maxDeliveryDays: '0',
  cost: '0',
  baseCost: '0',
  costPerKg: '0',
  costPerItem: '0',
  minCost: '',
  maxCost: '',
  freeShippingConditionType: 'none' as 'none' | 'coupon' | 'min_order_amount',
  freeShippingMinOrderAmount: '',
  pickupCost: '0',
  ranges: [{ min: '0', max: '', cost: '0', sortOrder: '0' }],
};

const fallbackYemenGovernorates = [
  'أمانة العاصمة',
  'عدن',
  'تعز',
  'لحج',
  'أبين',
  'الضالع',
  'إب',
  'الحديدة',
  'حجة',
  'المحويت',
  'ريمة',
  'ذمار',
  'صنعاء',
  'عمران',
  'صعدة',
  'الجوف',
  'مأرب',
  'شبوة',
  'حضرموت',
  'المهرة',
  'سقطرى',
  'البيضاء',
];

export function ShippingPanel({ request }: ShippingPanelProps) {
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [zones, setZones] = useState<ShippingZone[]>([]);
  const [methods, setMethods] = useState<ShippingMethod[]>([]);
  const [governorates, setGovernorates] = useState<string[]>(fallbackYemenGovernorates);

  const [selectedZoneId, setSelectedZoneId] = useState('');
  const [selectedMethodId, setSelectedMethodId] = useState('');

  const [zoneForm, setZoneForm] = useState(emptyZoneForm);
  const [methodForm, setMethodForm] = useState(emptyMethodForm);

  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [methodLoading, setMethodLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: 'info' as 'info' | 'success' | 'error' });
  const [zoneFieldErrors, setZoneFieldErrors] = useState<Record<string, string>>({});
  const [methodFieldErrors, setMethodFieldErrors] = useState<Record<string, string>>({});

  const selectedZone = useMemo(
    () => zones.find((zone) => zone.id === selectedZoneId) ?? null,
    [zones, selectedZoneId],
  );

  useEffect(() => {
    loadInitialData().catch(() => undefined);
  }, []);

  async function loadInitialData(): Promise<void> {
    setLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      const [zonesData, optionsData] = await Promise.all([
        request<ShippingZone[]>('/shipping-zones', { method: 'GET' }),
        request<StoreSettingsOptions>('/store/settings/options', { method: 'GET' }),
      ]);
      setZones(zonesData ?? []);
      if (optionsData?.governorates?.length) {
        setGovernorates(optionsData.governorates);
      }
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'تعذر تحميل مناطق التوصيل', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function loadZones(): Promise<void> {
    setLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      const data = await request<ShippingZone[]>('/shipping-zones', { method: 'GET' });
      setZones(data ?? []);
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'تعذر تحميل مناطق التوصيل', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function loadMethods(zoneId: string): Promise<void> {
    setMethodLoading(true);
    try {
      const data = await request<ShippingMethod[]>(`/shipping-zones/${zoneId}/methods`, {
        method: 'GET',
      });
      setMethods(data ?? []);
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'تعذر تحميل طرق التوصيل والاستلام', type: 'error' });
    } finally {
      setMethodLoading(false);
    }
  }

  function handleCreateZone() {
    setSelectedZoneId('');
    setZoneForm(emptyZoneForm);
    setMethods([]);
    setSelectedMethodId('');
    setMethodForm(emptyMethodForm);
    setViewMode('detail');
    setMessage({ text: '', type: 'info' });
    setZoneFieldErrors({});
    setMethodFieldErrors({});
  }

  async function selectZone(zone: ShippingZone): Promise<void> {
    setSelectedZoneId(zone.id);
    setZoneForm({
      name: zone.name,
      city: zone.city ?? '',
      area: zone.area ?? '',
      description: zone.description ?? '',
      fee: String(zone.fee),
      isActive: zone.isActive,
    });
    setSelectedMethodId('');
    setMethodForm(emptyMethodForm);
    setViewMode('detail');
    setZoneFieldErrors({});
    setMethodFieldErrors({});
    await loadMethods(zone.id);
  }

  function backToList() {
    setViewMode('list');
    setSelectedZoneId('');
    setMethods([]);
    setSelectedMethodId('');
    setMethodForm(emptyMethodForm);
    setZoneFieldErrors({});
    setMethodFieldErrors({});
    setMessage({ text: '', type: 'info' });
  }

  async function saveZone(): Promise<void> {
    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    setZoneFieldErrors({});
    try {
      const payload = buildZonePayload(zoneForm);
      if (selectedZoneId) {
        await request(`/shipping-zones/${selectedZoneId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        const created = await request<ShippingZone>('/shipping-zones', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        if (created?.id) {
          setSelectedZoneId(created.id);
          await loadMethods(created.id);
        }
      }

      await loadZones();
      setMessage({ text: 'تم حفظ منطقة التوصيل بنجاح', type: 'success' });
    } catch (error) {
      if (isApiError(error)) {
        setZoneFieldErrors(mapShippingZoneFieldErrors(error.fieldErrors));
      }
      setMessage({ text: error instanceof Error ? error.message : 'تعذر حفظ منطقة التوصيل', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function deleteZone(): Promise<void> {
    if (!selectedZoneId) return;
    if (!window.confirm('هل تريد حذف منطقة التوصيل؟')) return;

    setActionLoading(true);
    try {
      await request(`/shipping-zones/${selectedZoneId}`, { method: 'DELETE' });
      await loadZones();
      backToList();
      setMessage({ text: 'تم حذف المنطقة بنجاح', type: 'success' });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'تعذر حذف المنطقة', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  function resetMethodForm() {
    setSelectedMethodId('');
    setMethodForm(emptyMethodForm);
    setMethodFieldErrors({});
  }

  function editMethod(method: ShippingMethod) {
    setSelectedMethodId(method.id);
    setMethodForm({
      type: method.type,
      displayName: method.displayName,
      description: method.description ?? '',
      isActive: method.isActive,
      sortOrder: String(method.sortOrder),
      minDeliveryDays: String(method.minDeliveryDays),
      maxDeliveryDays: String(method.maxDeliveryDays),
      cost: String((method.config.cost as number | undefined) ?? 0),
      baseCost: String((method.config.baseCost as number | undefined) ?? 0),
      costPerKg: String((method.config.costPerKg as number | undefined) ?? 0),
      costPerItem: String((method.config.costPerItem as number | undefined) ?? 0),
      minCost:
        method.config.minCost !== undefined && method.config.minCost !== null
          ? String(method.config.minCost)
          : '',
      maxCost:
        method.config.maxCost !== undefined && method.config.maxCost !== null
          ? String(method.config.maxCost)
          : '',
      freeShippingConditionType:
        (method.config.conditionType as 'none' | 'coupon' | 'min_order_amount') ?? 'none',
      freeShippingMinOrderAmount:
        method.config.minOrderAmount !== undefined && method.config.minOrderAmount !== null
          ? String(method.config.minOrderAmount)
          : '',
      pickupCost: String((method.config.pickupCost as number | undefined) ?? 0),
      ranges:
        method.ranges.length > 0
          ? method.ranges.map((range) => ({
              min: String(range.min),
              max: range.max === null ? '' : String(range.max),
              cost: String(range.cost),
              sortOrder: String(range.sortOrder),
            }))
          : [{ min: '0', max: '', cost: '0', sortOrder: '0' }],
    });
    setMethodFieldErrors({});
  }

  async function saveMethod(): Promise<void> {
    if (!selectedZoneId) {
      setMessage({ text: 'احفظ منطقة التوصيل أولاً قبل إضافة طرق التوصيل أو الاستلام', type: 'error' });
      return;
    }
    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    setMethodFieldErrors({});

    try {
      const payload = buildMethodPayload(methodForm);
      if (selectedMethodId) {
        await request(`/shipping-zones/${selectedZoneId}/methods/${selectedMethodId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await request(`/shipping-zones/${selectedZoneId}/methods`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      await loadMethods(selectedZoneId);
      resetMethodForm();
      setMessage({ text: 'تم حفظ طريقة التوصيل أو الاستلام بنجاح', type: 'success' });
    } catch (error) {
      if (isApiError(error)) {
        setMethodFieldErrors(mapShippingMethodFieldErrors(error.fieldErrors));
      }
      setMessage({ text: error instanceof Error ? error.message : 'تعذر حفظ طريقة التوصيل أو الاستلام', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function deleteMethod(methodId: string): Promise<void> {
    if (!selectedZoneId) return;
    if (!window.confirm('هل تريد حذف طريقة التوصيل أو الاستلام؟')) return;

    setActionLoading(true);
    try {
      await request(`/shipping-zones/${selectedZoneId}/methods/${methodId}`, { method: 'DELETE' });
      await loadMethods(selectedZoneId);
      if (selectedMethodId === methodId) {
        resetMethodForm();
      }
      setMessage({ text: 'تم حذف طريقة التوصيل أو الاستلام', type: 'success' });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'تعذر حذف طريقة التوصيل أو الاستلام', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  function addRangeRow() {
    setMethodForm((prev) => ({
      ...prev,
      ranges: [
        ...prev.ranges,
        { min: '0', max: '', cost: '0', sortOrder: String(prev.ranges.length) },
      ],
    }));
  }

  function removeRangeRow(index: number) {
    setMethodForm((prev) => ({
      ...prev,
      ranges: prev.ranges.filter((_, rowIndex) => rowIndex !== index),
    }));
  }

  if (viewMode === 'detail') {
    return (
      <>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Button startIcon={<ArrowForwardIcon />} onClick={backToList} color="inherit">
            العودة للقائمة
          </Button>
          {selectedZoneId ? (
            <Button color="error" onClick={() => deleteZone().catch(() => undefined)}>
              حذف المنطقة
            </Button>
          ) : null}
        </Box>

        {message.text ? <Alert severity={message.type}>{message.text}</Alert> : null}

        <Paper sx={{ p: 3, borderRadius: 3 }}>
          <Typography variant="h6" fontWeight={800} mb={2}>بيانات منطقة التوصيل</Typography>
          <Stack spacing={2}>
            <TextField
              label="اسم المنطقة"
              value={zoneForm.name}
              error={Boolean(zoneFieldErrors.name)}
              helperText={zoneFieldErrors.name}
              onChange={(event) => {
                setZoneFieldErrors((prev) => clearFieldErrors(prev, ['name']));
                setZoneForm((prev) => ({ ...prev, name: event.target.value }));
              }}
              fullWidth
            />
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                select
                label="المدينة"
                value={zoneForm.city}
                error={Boolean(zoneFieldErrors.city)}
                helperText={zoneFieldErrors.city}
                onChange={(event) => {
                  setZoneFieldErrors((prev) => clearFieldErrors(prev, ['city']));
                  setZoneForm((prev) => ({ ...prev, city: event.target.value }));
                }}
                fullWidth
              >
                <MenuItem value="">اختر المدينة</MenuItem>
                {governorates.map((city) => (
                  <MenuItem key={city} value={city}>{city}</MenuItem>
                ))}
              </TextField>
              <TextField
                label="الحي/المنطقة"
                value={zoneForm.area}
                error={Boolean(zoneFieldErrors.area)}
                helperText={zoneFieldErrors.area}
                onChange={(event) => {
                  setZoneFieldErrors((prev) => clearFieldErrors(prev, ['area']));
                  setZoneForm((prev) => ({ ...prev, area: event.target.value }));
                }}
                fullWidth
              />
            </Stack>
            <TextField
              label="الوصف"
              value={zoneForm.description}
              error={Boolean(zoneFieldErrors.description)}
              helperText={zoneFieldErrors.description}
              onChange={(event) => {
                setZoneFieldErrors((prev) => clearFieldErrors(prev, ['description']));
                setZoneForm((prev) => ({ ...prev, description: event.target.value }));
              }}
              fullWidth
              multiline
              minRows={2}
            />
            <TextField
              label="رسوم افتراضية (توافق خلفي)"
              type="number"
              inputProps={{ min: 0, step: 0.01 }}
              value={zoneForm.fee}
              error={Boolean(zoneFieldErrors.fee)}
              helperText={zoneFieldErrors.fee}
              onChange={(event) => {
                setZoneFieldErrors((prev) => clearFieldErrors(prev, ['fee']));
                setZoneForm((prev) => ({ ...prev, fee: event.target.value }));
              }}
              fullWidth
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={zoneForm.isActive}
                  onChange={(event) =>
                    setZoneForm((prev) => ({ ...prev, isActive: event.target.checked }))
                  }
                />
              }
              label="المنطقة مفعّلة"
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="contained" onClick={() => saveZone().catch(() => undefined)} disabled={actionLoading}>
                {actionLoading ? 'جارٍ الحفظ...' : 'حفظ المنطقة'}
              </Button>
            </Box>
          </Stack>
        </Paper>

        {selectedZoneId || zoneForm.city ? (
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" fontWeight={800} mb={2}>
              طرق التوصيل والاستلام للمنطقة
            </Typography>

            {!selectedZoneId ? (
              <Alert severity="info" sx={{ mb: 2 }}>
                احفظ منطقة التوصيل أولاً، وبعدها يمكنك إضافة طرق التوصيل أو الاستلام لهذه المدينة.
              </Alert>
            ) : null}

            {!selectedZoneId ? null : methodLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer sx={{ mb: 3 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>الاسم</TableCell>
                      <TableCell>النوع</TableCell>
                      <TableCell>المدة</TableCell>
                      <TableCell>الحالة</TableCell>
                      <TableCell align="left">تحكم</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {methods.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center">لا توجد طرق توصيل أو استلام بعد</TableCell>
                      </TableRow>
                    ) : (
                      methods.map((method) => (
                        <TableRow key={method.id} hover>
                          <TableCell>{method.displayName}</TableCell>
                          <TableCell>{method.type}</TableCell>
                          <TableCell>{method.minDeliveryDays} - {method.maxDeliveryDays} يوم</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              color={method.isActive ? 'success' : 'default'}
                              label={method.isActive ? 'مفعّل' : 'موقوف'}
                            />
                          </TableCell>
                          <TableCell align="left">
                            <IconButton
                              onClick={() => editMethod(method)}
                              size="small"
                              aria-label={`تعديل طريقة التوصيل أو الاستلام ${method.displayName}`}
                            >
                              <EditNoteIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              onClick={() => deleteMethod(method.id).catch(() => undefined)}
                              size="small"
                              color="error"
                              aria-label={`حذف طريقة التوصيل أو الاستلام ${method.displayName}`}
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            <Divider sx={{ my: 2 }} />

            <Stack spacing={2}>
              <Typography variant="subtitle1" fontWeight={700}>
                {selectedMethodId ? 'تعديل طريقة التوصيل أو الاستلام' : 'إضافة طريقة توصيل أو استلام'}
              </Typography>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  select
                  label="نوع الطريقة"
                  fullWidth
                  value={methodForm.type}
                  error={Boolean(methodFieldErrors.type)}
                  helperText={methodFieldErrors.type}
                  onChange={(event) => {
                    setMethodFieldErrors((prev) => clearFieldErrors(prev, ['type']));
                    setMethodForm((prev) => ({
                      ...prev,
                      type: event.target.value as ShippingMethodType,
                    }));
                  }}
                >
                  {methodTypes.map((item) => (
                    <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="الاسم الظاهر"
                  fullWidth
                  value={methodForm.displayName}
                  error={Boolean(methodFieldErrors.displayName)}
                  helperText={methodFieldErrors.displayName}
                  onChange={(event) => {
                    setMethodFieldErrors((prev) => clearFieldErrors(prev, ['displayName']));
                    setMethodForm((prev) => ({ ...prev, displayName: event.target.value }));
                  }}
                />
              </Stack>

              <TextField
                label="الوصف"
                value={methodForm.description}
                error={Boolean(methodFieldErrors.description)}
                helperText={methodFieldErrors.description}
                onChange={(event) => {
                  setMethodFieldErrors((prev) => clearFieldErrors(prev, ['description']));
                  setMethodForm((prev) => ({ ...prev, description: event.target.value }));
                }}
                multiline
                minRows={2}
                fullWidth
              />

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  label="ترتيب العرض"
                  type="number"
                  inputProps={{ min: 0, step: 1 }}
                  value={methodForm.sortOrder}
                  onChange={(event) =>
                    setMethodForm((prev) => ({ ...prev, sortOrder: event.target.value }))
                  }
                  fullWidth
                />
                <TextField
                  label="أقل مدة (يوم)"
                  type="number"
                  inputProps={{ min: 0, step: 1 }}
                  value={methodForm.minDeliveryDays}
                  onChange={(event) =>
                    setMethodForm((prev) => ({ ...prev, minDeliveryDays: event.target.value }))
                  }
                  fullWidth
                />
                <TextField
                  label="أقصى مدة (يوم)"
                  type="number"
                  inputProps={{ min: 0, step: 1 }}
                  value={methodForm.maxDeliveryDays}
                  onChange={(event) =>
                    setMethodForm((prev) => ({ ...prev, maxDeliveryDays: event.target.value }))
                  }
                  fullWidth
                />
              </Stack>

              {renderMethodSpecificFields(methodForm, setMethodForm, addRangeRow, removeRangeRow)}

              <FormControlLabel
                control={
                  <Checkbox
                    checked={methodForm.isActive}
                    onChange={(event) =>
                      setMethodForm((prev) => ({ ...prev, isActive: event.target.checked }))
                    }
                  />
                }
                label="الطريقة مفعّلة"
              />

              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button variant="outlined" onClick={resetMethodForm}>جديد</Button>
                <Button variant="contained" onClick={() => saveMethod().catch(() => undefined)} disabled={actionLoading || !selectedZoneId}>
                  {actionLoading ? 'جارٍ الحفظ...' : 'حفظ الطريقة'}
                </Button>
              </Stack>
            </Stack>
          </Paper>
        ) : null}
      </Box>
      <FloatingActionButton
        label={actionLoading ? 'جاري الحفظ...' : 'حفظ منطقة التوصيل'}
        icon={<AddIcon />}
        onClick={() => saveZone().catch(() => undefined)}
        disabled={actionLoading}
      />
      </>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" fontWeight={800}>التوصيل والاستلام</Typography>
          <Typography color="text.secondary">إدارة مناطق التوصيل وطرق التوصيل والاستلام لكل منطقة</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={() => loadInitialData().catch(() => undefined)} disabled={loading}>تحديث</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateZone}>منطقة جديدة</Button>
        </Stack>
      </Box>

      {message.text ? <Alert severity={message.type}>{message.text}</Alert> : null}

      <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>المنطقة</TableCell>
                <TableCell>المدينة / الحي</TableCell>
                <TableCell>الوصف</TableCell>
                <TableCell>الحالة</TableCell>
                <TableCell align="left">تحكم</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : zones.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                    لا توجد مناطق شحن
                  </TableCell>
                </TableRow>
              ) : (
                zones.map((zone) => (
                  <TableRow key={zone.id} hover>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <LocalShippingIcon color="primary" fontSize="small" />
                        <Typography fontWeight={700}>{zone.name}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>{zone.city ?? '-'} / {zone.area ?? '-'}</TableCell>
                    <TableCell>{zone.description ?? '-'}</TableCell>
                    <TableCell>
                      <Chip size="small" label={zone.isActive ? 'مفعّل' : 'موقوف'} color={zone.isActive ? 'success' : 'default'} />
                    </TableCell>
                    <TableCell align="left">
                      <Button size="small" variant="outlined" onClick={() => selectZone(zone).catch(() => undefined)}>
                        إدارة
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      <FloatingActionButton
        label="منطقة جديدة"
        icon={<AddIcon />}
        onClick={handleCreateZone}
        disabled={loading || actionLoading}
      />
    </Box>
  );
}

function renderMethodSpecificFields(
  methodForm: typeof emptyMethodForm,
  setMethodForm: Dispatch<SetStateAction<typeof emptyMethodForm>>,
  addRangeRow: () => void,
  removeRangeRow: (index: number) => void,
) {
  if (methodForm.type === 'flat_rate') {
    return (
      <TextField
        label="التكلفة"
        type="number"
        inputProps={{ min: 0, step: 0.01 }}
        value={methodForm.cost}
        onChange={(event) => setMethodForm((prev) => ({ ...prev, cost: event.target.value }))}
        fullWidth
      />
    );
  }

  if (methodForm.type === 'by_weight') {
    return (
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <TextField label="التكلفة الأساسية" type="number" inputProps={{ min: 0, step: 0.01 }} value={methodForm.baseCost} onChange={(event) => setMethodForm((prev) => ({ ...prev, baseCost: event.target.value }))} fullWidth />
        <TextField label="السعر لكل كغ" type="number" inputProps={{ min: 0, step: 0.01 }} value={methodForm.costPerKg} onChange={(event) => setMethodForm((prev) => ({ ...prev, costPerKg: event.target.value }))} fullWidth />
        <TextField label="حد أدنى" type="number" inputProps={{ min: 0, step: 0.01 }} value={methodForm.minCost} onChange={(event) => setMethodForm((prev) => ({ ...prev, minCost: event.target.value }))} fullWidth />
        <TextField label="حد أقصى" type="number" inputProps={{ min: 0, step: 0.01 }} value={methodForm.maxCost} onChange={(event) => setMethodForm((prev) => ({ ...prev, maxCost: event.target.value }))} fullWidth />
      </Stack>
    );
  }

  if (methodForm.type === 'by_item') {
    return (
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <TextField label="التكلفة الأساسية" type="number" inputProps={{ min: 0, step: 0.01 }} value={methodForm.baseCost} onChange={(event) => setMethodForm((prev) => ({ ...prev, baseCost: event.target.value }))} fullWidth />
        <TextField label="السعر لكل وحدة" type="number" inputProps={{ min: 0, step: 0.01 }} value={methodForm.costPerItem} onChange={(event) => setMethodForm((prev) => ({ ...prev, costPerItem: event.target.value }))} fullWidth />
        <TextField label="حد أدنى" type="number" inputProps={{ min: 0, step: 0.01 }} value={methodForm.minCost} onChange={(event) => setMethodForm((prev) => ({ ...prev, minCost: event.target.value }))} fullWidth />
        <TextField label="حد أقصى" type="number" inputProps={{ min: 0, step: 0.01 }} value={methodForm.maxCost} onChange={(event) => setMethodForm((prev) => ({ ...prev, maxCost: event.target.value }))} fullWidth />
      </Stack>
    );
  }

  if (methodForm.type === 'weight_tier' || methodForm.type === 'order_value_tier') {
    return (
      <Stack spacing={1}>
        <Typography variant="subtitle2" fontWeight={700}>النطاقات</Typography>
        {methodForm.ranges.map((range, index) => (
          <Stack key={`${range.sortOrder}-${index}`} direction={{ xs: 'column', md: 'row' }} spacing={1}>
            <TextField label="من" type="number" inputProps={{ min: 0, step: 0.001 }} value={range.min} onChange={(event) => setMethodForm((prev) => ({ ...prev, ranges: prev.ranges.map((row, rowIndex) => rowIndex === index ? { ...row, min: event.target.value } : row) }))} fullWidth />
            <TextField label="إلى (اختياري)" type="number" inputProps={{ min: 0, step: 0.001 }} value={range.max} onChange={(event) => setMethodForm((prev) => ({ ...prev, ranges: prev.ranges.map((row, rowIndex) => rowIndex === index ? { ...row, max: event.target.value } : row) }))} fullWidth />
            <TextField label="التكلفة" type="number" inputProps={{ min: 0, step: 0.01 }} value={range.cost} onChange={(event) => setMethodForm((prev) => ({ ...prev, ranges: prev.ranges.map((row, rowIndex) => rowIndex === index ? { ...row, cost: event.target.value } : row) }))} fullWidth />
            <TextField label="الترتيب" type="number" inputProps={{ min: 0, step: 1 }} value={range.sortOrder} onChange={(event) => setMethodForm((prev) => ({ ...prev, ranges: prev.ranges.map((row, rowIndex) => rowIndex === index ? { ...row, sortOrder: event.target.value } : row) }))} fullWidth />
            <Button color="error" onClick={() => removeRangeRow(index)} disabled={methodForm.ranges.length <= 1}>حذف</Button>
          </Stack>
        ))}
        <Button variant="outlined" startIcon={<AddIcon />} onClick={addRangeRow}>إضافة نطاق</Button>
      </Stack>
    );
  }

  if (methodForm.type === 'free_shipping') {
    return (
      <Stack spacing={2}>
        <TextField
          select
          label="شرط الشحن المجاني"
          value={methodForm.freeShippingConditionType}
          onChange={(event) =>
            setMethodForm((prev) => ({
              ...prev,
              freeShippingConditionType: event.target.value as
                | 'none'
                | 'coupon'
                | 'min_order_amount',
            }))
          }
          fullWidth
        >
          <MenuItem value="none">بدون شرط</MenuItem>
          <MenuItem value="coupon">كوبون شحن مجاني صالح</MenuItem>
          <MenuItem value="min_order_amount">حد أدنى لقيمة الطلب</MenuItem>
        </TextField>
        {methodForm.freeShippingConditionType === 'min_order_amount' ? (
          <TextField
            label="الحد الأدنى لقيمة الطلب"
            type="number"
            inputProps={{ min: 0, step: 0.01 }}
            value={methodForm.freeShippingMinOrderAmount}
            onChange={(event) =>
              setMethodForm((prev) => ({
                ...prev,
                freeShippingMinOrderAmount: event.target.value,
              }))
            }
            fullWidth
          />
        ) : null}
      </Stack>
    );
  }

  if (methodForm.type === 'store_pickup') {
    return (
      <TextField
        label="تكلفة الاستلام"
        type="number"
        inputProps={{ min: 0, step: 0.01 }}
        value={methodForm.pickupCost}
        onChange={(event) =>
          setMethodForm((prev) => ({ ...prev, pickupCost: event.target.value }))
        }
        fullWidth
      />
    );
  }

  return null;
}

function buildZonePayload(form: typeof emptyZoneForm) {
  const payload: {
    name: string;
    city?: string;
    area?: string;
    description?: string;
    fee: number;
    isActive: boolean;
  } = {
    name: form.name.trim(),
    fee: Number(form.fee || '0'),
    isActive: form.isActive,
  };

  if (form.city.trim()) payload.city = form.city.trim();
  if (form.area.trim()) payload.area = form.area.trim();
  if (form.description.trim()) payload.description = form.description.trim();

  return payload;
}

function mapShippingZoneFieldErrors(fieldErrors: Record<string, string[]>): Record<string, string> {
  return mapFieldErrors(fieldErrors, {
    name: ['name'],
    city: ['city'],
    area: ['area'],
    description: ['description'],
    fee: ['fee'],
  });
}

function mapShippingMethodFieldErrors(fieldErrors: Record<string, string[]>): Record<string, string> {
  return mapFieldErrors(fieldErrors, {
    type: ['type'],
    displayName: ['displayName', 'name'],
    description: ['description'],
    sortOrder: ['sortOrder'],
    minDeliveryDays: ['minDeliveryDays'],
    maxDeliveryDays: ['maxDeliveryDays'],
    cost: ['cost', 'config.cost'],
    baseCost: ['baseCost', 'config.baseCost'],
    costPerKg: ['costPerKg', 'config.costPerKg'],
    costPerItem: ['costPerItem', 'config.costPerItem'],
    minCost: ['minCost', 'config.minCost'],
    maxCost: ['maxCost', 'config.maxCost'],
    freeShippingMinOrderAmount: ['freeShippingMinOrderAmount', 'config.minOrderAmount'],
    pickupCost: ['pickupCost', 'config.pickupCost'],
  });
}

function buildMethodPayload(form: typeof emptyMethodForm) {
  const payload: Record<string, unknown> = {
    type: form.type,
    displayName: form.displayName.trim(),
    description: form.description.trim() || undefined,
    isActive: form.isActive,
    sortOrder: Number(form.sortOrder || '0'),
    minDeliveryDays: Number(form.minDeliveryDays || '0'),
    maxDeliveryDays: Number(form.maxDeliveryDays || '0'),
  };

  if (form.type === 'flat_rate') {
    payload.cost = Number(form.cost || '0');
  }

  if (form.type === 'by_weight') {
    payload.baseCost = Number(form.baseCost || '0');
    payload.costPerKg = Number(form.costPerKg || '0');
    if (form.minCost.trim()) payload.minCost = Number(form.minCost);
    if (form.maxCost.trim()) payload.maxCost = Number(form.maxCost);
  }

  if (form.type === 'by_item') {
    payload.baseCost = Number(form.baseCost || '0');
    payload.costPerItem = Number(form.costPerItem || '0');
    if (form.minCost.trim()) payload.minCost = Number(form.minCost);
    if (form.maxCost.trim()) payload.maxCost = Number(form.maxCost);
  }

  if (form.type === 'weight_tier' || form.type === 'order_value_tier') {
    payload.ranges = form.ranges.map((range, index): ShippingMethodRange => ({
      min: Number(range.min || '0'),
      max: range.max.trim() ? Number(range.max) : null,
      cost: Number(range.cost || '0'),
      sortOrder: Number(range.sortOrder || String(index)),
    }));
  }

  if (form.type === 'free_shipping') {
    payload.freeShippingConditionType = form.freeShippingConditionType;
    if (
      form.freeShippingConditionType === 'min_order_amount' &&
      form.freeShippingMinOrderAmount.trim()
    ) {
      payload.freeShippingMinOrderAmount = Number(form.freeShippingMinOrderAmount);
    }
  }

  if (form.type === 'store_pickup') {
    payload.pickupCost = Number(form.pickupCost || '0');
  }

  return payload;
}




