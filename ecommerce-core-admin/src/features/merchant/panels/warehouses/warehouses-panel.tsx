import { AddIcon, ArrowForwardIcon, Inventory2Icon, LinkIcon, PlaceIcon, TuneIcon } from '../../../../components/icons';
import { useEffect, useMemo, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { CircleMarker, MapContainer, TileLayer, useMapEvents } from 'react-leaflet';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
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
import type { MerchantRequester } from '../../merchant-dashboard.types';
import { AppPage, DataTableWrapper, FloatingActionButton, PageHeader, SectionCard } from '../../components/ui';
import type {
  Product,
  ProductListResponse,
  ProductWarehouseLink,
  VariantWarehouseAllocation,
  Warehouse,
} from '../../types';
import { MAP_TILE_ATTRIBUTION, MAP_TILE_SUBDOMAINS, MAP_TILE_URL } from '../../../../lib/map-config';

interface WarehousesPanelProps {
  request: MerchantRequester;
}

interface WarehouseFormState {
  nameAr: string;
  nameEn: string;
  code: string;
  country: string;
  city: string;
  branch: string;
  district: string;
  street: string;
  shortAddress: string;
  address: string;
  latitude: string;
  longitude: string;
  phone: string;
  email: string;
  priority: string;
  isActive: boolean;
  isDefault: boolean;
}

interface VariantAllocationFormRow {
  warehouseId: string;
  enabled: boolean;
  quantity: string;
  reservedQuantityReadonly: number;
  lowStockThreshold: string;
  reorderPoint: string;
}

const YEMEN_CITIES = [
  'صنعاء',
  'عدن',
  'تعز',
  'إب',
  'الحديدة',
  'المكلا',
  'مأرب',
  'ذمار',
  'لحج',
  'أبين',
  'الضالع',
  'حجة',
  'المحويت',
  'ريمة',
  'عمران',
  'صعدة',
  'الجوف',
  'شبوة',
  'المهرة',
  'سقطرى',
  'البيضاء',
];

const YEMEN_CENTER: [number, number] = [15.3694, 44.191];

function WarehouseLocationPicker({
  latitude,
  longitude,
  onPick,
}: {
  latitude: string;
  longitude: string;
  onPick: (latitude: number, longitude: number) => void;
}) {
  const parsedLatitude = Number(latitude);
  const parsedLongitude = Number(longitude);
  const hasPosition = Number.isFinite(parsedLatitude) && Number.isFinite(parsedLongitude);
  const position: [number, number] = hasPosition
    ? [parsedLatitude, parsedLongitude]
    : YEMEN_CENTER;

  function PickHandler() {
    useMapEvents({
      click(event) {
        onPick(Number(event.latlng.lat.toFixed(6)), Number(event.latlng.lng.toFixed(6)));
      },
    });
    return null;
  }

  return (
    <Box sx={{ height: 260, overflow: 'hidden', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
      <MapContainer center={position} zoom={hasPosition ? 13 : 6} style={{ height: '100%', width: '100%' }}>
        <TileLayer attribution={MAP_TILE_ATTRIBUTION} url={MAP_TILE_URL} subdomains={MAP_TILE_SUBDOMAINS} />
        <PickHandler />
        {hasPosition ? <CircleMarker center={position} radius={9} pathOptions={{ color: '#1976d2' }} /> : null}
      </MapContainer>
    </Box>
  );
}

function createWarehouseFormDefault(): WarehouseFormState {
  return {
    nameAr: '',
    nameEn: '',
    code: '',
    country: 'YE',
    city: '',
    branch: '',
    district: '',
    street: '',
    shortAddress: '',
    address: '',
    latitude: '',
    longitude: '',
    phone: '',
    email: '',
    priority: '0',
    isActive: true,
    isDefault: false,
  };
}

export function WarehousesPanel({ request }: WarehousesPanelProps) {
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState('');

  const [productLinks, setProductLinks] = useState<ProductWarehouseLink[]>([]);
  const [selectedProductWarehouseIds, setSelectedProductWarehouseIds] = useState<string[]>([]);

  const [variantAllocations, setVariantAllocations] = useState<VariantWarehouseAllocation[]>([]);
  const [variantAllocationRows, setVariantAllocationRows] = useState<VariantAllocationFormRow[]>([]);

  const [warehouseForm, setWarehouseForm] = useState<WarehouseFormState>(createWarehouseFormDefault());
  const [editingWarehouseId, setEditingWarehouseId] = useState('');

  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'info' | 'success' | 'error' }>({
    text: '',
    type: 'info',
  });

  useEffect(() => {
    loadInitialData().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedProductId) {
      setSelectedProduct(null);
      setSelectedVariantId('');
      setProductLinks([]);
      setSelectedProductWarehouseIds([]);
      setVariantAllocations([]);
      setVariantAllocationRows([]);
      return;
    }

    loadSelectedProductContext(selectedProductId).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProductId]);

  useEffect(() => {
    if (!selectedVariantId) {
      setVariantAllocations([]);
      setVariantAllocationRows([]);
      return;
    }

    loadVariantAllocations(selectedVariantId).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVariantId]);

  async function loadInitialData(): Promise<void> {
    setLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      const [warehouseData, productData] = await Promise.all([
        request<Warehouse[]>('/warehouses', { method: 'GET' }),
        request<ProductListResponse>('/products?page=1&limit=200', { method: 'GET' }),
      ]);

      setWarehouses(warehouseData ?? []);
      setProducts(productData?.items ?? []);
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'تعذر تحميل بيانات المستودعات',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadSelectedProductContext(productId: string): Promise<void> {
    setLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      const [productDetails, productLinkRows] = await Promise.all([
        request<Product>(`/products/${productId}`, { method: 'GET' }),
        request<ProductWarehouseLink[]>(`/warehouses/products/${productId}/links`, { method: 'GET' }),
      ]);

      const detail = productDetails ?? null;
      setSelectedProduct(detail);

      const links = productLinkRows ?? [];
      setProductLinks(links);
      setSelectedProductWarehouseIds(links.map((row) => row.warehouseId));

      const firstVariantId = detail?.variants?.[0]?.id ?? '';
      setSelectedVariantId(firstVariantId);
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'تعذر تحميل بيانات ربط المنتج بالمستودعات',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadVariantAllocations(variantId: string): Promise<void> {
    setLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      const rows = await request<VariantWarehouseAllocation[]>(
        `/warehouses/variants/${variantId}/allocations`,
        { method: 'GET' },
      );
      const safeRows = rows ?? [];
      setVariantAllocations(safeRows);
      setVariantAllocationRows(buildVariantAllocationRows(warehouses, safeRows));
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'تعذر تحميل توزيعات المتغير',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  function buildVariantAllocationRows(
    warehouseRows: Warehouse[],
    allocationRows: VariantWarehouseAllocation[],
  ): VariantAllocationFormRow[] {
    const byWarehouseId = new Map(allocationRows.map((row) => [row.warehouseId, row]));
    return warehouseRows.map((warehouse) => {
      const allocation = byWarehouseId.get(warehouse.id);
      return {
        warehouseId: warehouse.id,
        enabled: allocation !== undefined,
        quantity: String(allocation?.quantity ?? 0),
        reservedQuantityReadonly: allocation?.reservedQuantity ?? 0,
        lowStockThreshold: String(allocation?.lowStockThreshold ?? 0),
        reorderPoint: allocation?.reorderPoint !== null && allocation?.reorderPoint !== undefined
          ? String(allocation.reorderPoint)
          : '',
      };
    });
  }

  async function saveWarehouse(): Promise<void> {
    const latitude = Number(warehouseForm.latitude);
    const longitude = Number(warehouseForm.longitude);
    const priority = Number(warehouseForm.priority);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setMessage({ text: 'الإحداثيات غير صحيحة. أدخل Latitude وLongitude بشكل رقمي.', type: 'error' });
      return;
    }

    if (!Number.isInteger(priority) || priority < 0) {
      setMessage({ text: 'الأولوية يجب أن تكون رقماً صحيحاً أكبر أو يساوي 0.', type: 'error' });
      return;
    }

    const payload = {
      nameAr: warehouseForm.nameAr.trim(),
      nameEn: warehouseForm.nameEn.trim(),
      code: warehouseForm.code.trim(),
      country: warehouseForm.country.trim().toUpperCase(),
      city: warehouseForm.city.trim(),
      branch: warehouseForm.branch.trim(),
      district: warehouseForm.district.trim(),
      street: warehouseForm.street.trim(),
      shortAddress: warehouseForm.shortAddress.trim(),
      address: warehouseForm.address.trim() || undefined,
      latitude,
      longitude,
      phone: warehouseForm.phone.trim() || undefined,
      email: warehouseForm.email.trim() || undefined,
      priority,
      isActive: warehouseForm.isActive,
      isDefault: warehouseForm.isDefault,
    };

    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      if (editingWarehouseId) {
        await request(`/warehouses/${editingWarehouseId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setMessage({ text: 'تم تحديث بيانات المستودع بنجاح.', type: 'success' });
      } else {
        await request('/warehouses', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setMessage({ text: 'تم إنشاء المستودع بنجاح.', type: 'success' });
      }

      setWarehouseForm(createWarehouseFormDefault());
      setEditingWarehouseId('');
      setViewMode('list');
      await loadInitialData();
      if (selectedProductId) {
        await loadSelectedProductContext(selectedProductId);
      }
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'تعذر حفظ بيانات المستودع', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  function startEditWarehouse(warehouse: Warehouse): void {
    setEditingWarehouseId(warehouse.id);
    setWarehouseForm({
      nameAr: warehouse.nameAr,
      nameEn: warehouse.nameEn,
      code: warehouse.code,
      country: warehouse.country,
      city: warehouse.city,
      branch: warehouse.branch,
      district: warehouse.district,
      street: warehouse.street,
      shortAddress: warehouse.shortAddress,
      address: warehouse.address ?? '',
      latitude: warehouse.latitude !== null ? String(warehouse.latitude) : '',
      longitude: warehouse.longitude !== null ? String(warehouse.longitude) : '',
      phone: warehouse.phone ?? '',
      email: warehouse.email ?? '',
      priority: String(warehouse.priority),
      isActive: warehouse.isActive,
      isDefault: warehouse.isDefault,
    });
    setViewMode('detail');
  }

  function startCreateWarehouse(): void {
    setEditingWarehouseId('');
    setWarehouseForm(createWarehouseFormDefault());
    setMessage({ text: '', type: 'info' });
    setViewMode('detail');
  }

  async function setWarehouseAsDefault(warehouseId: string): Promise<void> {
    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      await request(`/warehouses/${warehouseId}/default`, { method: 'POST' });
      setMessage({ text: 'تم تعيين المستودع الافتراضي بنجاح.', type: 'success' });
      await loadInitialData();
      if (selectedProductId) {
        await loadSelectedProductContext(selectedProductId);
      }
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'تعذر تعيين المستودع الافتراضي', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function saveProductLinks(): Promise<void> {
    if (!selectedProductId) {
      setMessage({ text: 'اختر منتجاً أولاً.', type: 'error' });
      return;
    }

    if ((selectedProduct?.variants?.length ?? 0) > 0) {
      setMessage({
        text: 'هذا المنتج يحتوي على متغيرات، يرجى إدارة الربط من قسم توزيعات المتغيرات.',
        type: 'error',
      });
      return;
    }

    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      const rows = await request<ProductWarehouseLink[]>(`/warehouses/products/${selectedProductId}/links`, {
        method: 'PUT',
        body: JSON.stringify({ warehouseIds: selectedProductWarehouseIds }),
      });
      const safeRows = rows ?? [];
      setProductLinks(safeRows);
      setSelectedProductWarehouseIds(safeRows.map((row) => row.warehouseId));
      setMessage({ text: 'تم حفظ ربط المنتج بالمستودعات بنجاح.', type: 'success' });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'تعذر حفظ ربط المنتج', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function saveVariantAllocations(): Promise<void> {
    if (!selectedVariantId) {
      setMessage({ text: 'اختر متغيراً أولاً.', type: 'error' });
      return;
    }

    const allocationsPayload: Array<{
      warehouseId: string;
      quantity: number;
      lowStockThreshold: number;
      reorderPoint?: number;
    }> = [];

    for (const row of variantAllocationRows) {
      if (!row.enabled) {
        continue;
      }

      const quantity = Number(row.quantity);
      const lowStockThreshold = Number(row.lowStockThreshold);
      const reorderPointValue = row.reorderPoint.trim();
      const reorderPoint = reorderPointValue ? Number(reorderPointValue) : undefined;

      if (!Number.isInteger(quantity) || quantity < 0) {
        setMessage({ text: 'قيمة quantity يجب أن تكون رقماً صحيحاً أكبر أو يساوي 0.', type: 'error' });
        return;
      }

      if (quantity < row.reservedQuantityReadonly) {
        setMessage({ text: 'لا يمكن تقليل الكمية عن الكمية المحجوزة حالياً.', type: 'error' });
        return;
      }

      if (!Number.isInteger(lowStockThreshold) || lowStockThreshold < 0) {
        setMessage({ text: 'قيمة lowStockThreshold يجب أن تكون رقماً صحيحاً أكبر أو يساوي 0.', type: 'error' });
        return;
      }

      if (reorderPoint !== undefined && (!Number.isInteger(reorderPoint) || reorderPoint < 0)) {
        setMessage({ text: 'قيمة reorderPoint يجب أن تكون رقماً صحيحاً أكبر أو يساوي 0.', type: 'error' });
        return;
      }

      allocationsPayload.push({
        warehouseId: row.warehouseId,
        quantity,
        lowStockThreshold,
        ...(reorderPoint !== undefined ? { reorderPoint } : {}),
      });
    }

    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      const rows = await request<VariantWarehouseAllocation[]>(
        `/warehouses/variants/${selectedVariantId}/allocations`,
        {
          method: 'PUT',
          body: JSON.stringify({ allocations: allocationsPayload }),
        },
      );
      const safeRows = rows ?? [];
      setVariantAllocations(safeRows);
      setVariantAllocationRows(buildVariantAllocationRows(warehouses, safeRows));
      setMessage({ text: 'تم حفظ توزيع المخزون على المستودعات بنجاح.', type: 'success' });
      if (selectedProductId) {
        await loadSelectedProductContext(selectedProductId);
      }
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'تعذر حفظ توزيعات المتغير', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  function toggleProductWarehouseLink(warehouseId: string): void {
    setSelectedProductWarehouseIds((current) =>
      current.includes(warehouseId)
        ? current.filter((id) => id !== warehouseId)
        : [...current, warehouseId],
    );
  }

  function updateVariantAllocationRow(
    warehouseId: string,
    patch: Partial<VariantAllocationFormRow>,
  ): void {
    setVariantAllocationRows((rows) =>
      rows.map((row) => (row.warehouseId === warehouseId ? { ...row, ...patch } : row)),
    );
  }

  const variantOptions = selectedProduct?.variants ?? [];

  const selectedVariantAllocationSummary = useMemo(() => {
    return variantAllocations.reduce(
      (acc, row) => {
        acc.totalQuantity += row.quantity;
        acc.totalReserved += row.reservedQuantity;
        return acc;
      },
      { totalQuantity: 0, totalReserved: 0 },
    );
  }, [variantAllocations]);

  return (
    <AppPage>
      <PageHeader
        title="المستودعات وربط المنتجات"
        description="إدارة المستودعات ثنائية اللغة وربط المنتجات بدون متغيرات، وتوزيع مخزون المتغيرات لكل مستودع بإحداثيات دقيقة."
        actions={
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            {viewMode === 'detail' ? (
              <Button startIcon={<ArrowForwardIcon />} variant="outlined" onClick={() => setViewMode('list')}>
                العودة للمستودعات
              </Button>
            ) : (
              <Button startIcon={<AddIcon />} variant="contained" onClick={startCreateWarehouse}>
                إضافة مستودع
              </Button>
            )}
            <Button variant="outlined" onClick={() => loadInitialData().catch(() => undefined)} disabled={loading}>
              تحديث البيانات
            </Button>
          </Stack>
        }
      />

      {message.text ? <Alert severity={message.type}>{message.text}</Alert> : null}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Stack spacing={3}>
          {viewMode === 'detail' ? (
          <SectionCard>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
              <PlaceIcon color="primary" />
              <Typography variant="h6" fontWeight={800}>إدارة بيانات المستودع</Typography>
            </Box>

            <Stack spacing={2.5}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
                <TextField size="small" label="اسم المستودع (عربي)" value={warehouseForm.nameAr} onChange={(event) => setWarehouseForm({ ...warehouseForm, nameAr: event.target.value })} />
                <TextField size="small" label="Warehouse Name (English)" value={warehouseForm.nameEn} onChange={(event) => setWarehouseForm({ ...warehouseForm, nameEn: event.target.value })} />
                <TextField size="small" label="الكود (CODE)" value={warehouseForm.code} onChange={(event) => setWarehouseForm({ ...warehouseForm, code: event.target.value.toUpperCase() })} />
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
                <TextField size="small" label="الدولة (ISO)" value={warehouseForm.country} onChange={(event) => setWarehouseForm({ ...warehouseForm, country: event.target.value.toUpperCase() })} />
                <TextField size="small" select label="المدينة" value={warehouseForm.city} onChange={(event) => setWarehouseForm({ ...warehouseForm, city: event.target.value })}>
                  <MenuItem value="">اختر المدينة</MenuItem>
                  {YEMEN_CITIES.map((city) => (
                    <MenuItem key={city} value={city}>
                      {city}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField size="small" label="الفرع" value={warehouseForm.branch} onChange={(event) => setWarehouseForm({ ...warehouseForm, branch: event.target.value })} />
                <TextField size="small" label="الحي" value={warehouseForm.district} onChange={(event) => setWarehouseForm({ ...warehouseForm, district: event.target.value })} />
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 2fr 1fr' }, gap: 2 }}>
                <TextField size="small" label="الشارع" value={warehouseForm.street} onChange={(event) => setWarehouseForm({ ...warehouseForm, street: event.target.value })} />
                <TextField size="small" label="النص المختصر للعنوان" value={warehouseForm.shortAddress} onChange={(event) => setWarehouseForm({ ...warehouseForm, shortAddress: event.target.value })} />
                <TextField size="small" label="الأولوية" type="number" inputProps={{ min: 0, step: 1 }} value={warehouseForm.priority} onChange={(event) => setWarehouseForm({ ...warehouseForm, priority: event.target.value })} />
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr 1fr' }, gap: 2 }}>
                <TextField size="small" label="العنوان الكامل (اختياري)" value={warehouseForm.address} onChange={(event) => setWarehouseForm({ ...warehouseForm, address: event.target.value })} />
                <TextField size="small" label="Latitude" type="number" inputProps={{ step: 'any' }} value={warehouseForm.latitude} onChange={(event) => setWarehouseForm({ ...warehouseForm, latitude: event.target.value })} />
                <TextField size="small" label="Longitude" type="number" inputProps={{ step: 'any' }} value={warehouseForm.longitude} onChange={(event) => setWarehouseForm({ ...warehouseForm, longitude: event.target.value })} />
              </Box>

              <WarehouseLocationPicker
                latitude={warehouseForm.latitude}
                longitude={warehouseForm.longitude}
                onPick={(latitude, longitude) =>
                  setWarehouseForm({
                    ...warehouseForm,
                    latitude: String(latitude),
                    longitude: String(longitude),
                    address:
                      warehouseForm.address ||
                      [warehouseForm.shortAddress, warehouseForm.city, 'اليمن'].filter(Boolean).join('، '),
                  })
                }
              />

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                <TextField size="small" label="هاتف التواصل (اختياري)" value={warehouseForm.phone} onChange={(event) => setWarehouseForm({ ...warehouseForm, phone: event.target.value })} />
                <TextField size="small" label="البريد الإلكتروني (اختياري)" value={warehouseForm.email} onChange={(event) => setWarehouseForm({ ...warehouseForm, email: event.target.value })} />
              </Box>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <FormControlLabel control={<Checkbox checked={warehouseForm.isActive} onChange={(event) => setWarehouseForm({ ...warehouseForm, isActive: event.target.checked })} />} label="مستودع نشط" />
                <FormControlLabel control={<Checkbox checked={warehouseForm.isDefault} onChange={(event) => setWarehouseForm({ ...warehouseForm, isDefault: event.target.checked })} />} label="تعيين كمستودع افتراضي" />
              </Stack>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                <Button variant="contained" onClick={() => saveWarehouse().catch(() => undefined)} disabled={actionLoading}>
                  {editingWarehouseId ? 'حفظ تحديثات المستودع' : 'إضافة مستودع جديد'}
                </Button>
                {editingWarehouseId ? (
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setEditingWarehouseId('');
                      setWarehouseForm(createWarehouseFormDefault());
                    }}
                  >
                    إلغاء التعديل
                  </Button>
                ) : null}
              </Stack>
            </Stack>
          </SectionCard>
          ) : null}

          {viewMode === 'list' ? (
            <>
          <DataTableWrapper>
            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Inventory2Icon color="action" />
              <Typography variant="subtitle1" fontWeight={800}>قائمة المستودعات ({warehouses.length})</Typography>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>الاسم</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>الكود</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>العنوان المختصر</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>الإحداثيات</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>الحالة</TableCell>
                    <TableCell align="left"></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {warehouses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                        <Typography color="text.secondary">لا توجد مستودعات بعد.</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    warehouses.map((warehouse) => (
                      <TableRow key={warehouse.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={700}>{warehouse.nameAr}</Typography>
                          <Typography variant="caption" color="text.secondary">{warehouse.nameEn}</Typography>
                        </TableCell>
                        <TableCell><Typography fontFamily="monospace">{warehouse.code}</Typography></TableCell>
                        <TableCell>
                          <Typography variant="body2">{warehouse.shortAddress}</Typography>
                          <Typography variant="caption" color="text.secondary">{warehouse.city} - {warehouse.branch}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" fontFamily="monospace">{warehouse.latitude ?? '-'}, {warehouse.longitude ?? '-'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.8}>
                            {warehouse.isDefault ? <Chip size="small" color="primary" label="افتراضي" /> : null}
                            <Chip size="small" color={warehouse.isActive ? 'success' : 'default'} label={warehouse.isActive ? 'نشط' : 'غير نشط'} />
                          </Stack>
                        </TableCell>
                        <TableCell align="left">
                          <Stack direction="row" spacing={1}>
                            <Button size="small" onClick={() => startEditWarehouse(warehouse)}>تعديل</Button>
                            {!warehouse.isDefault ? (
                              <Button size="small" variant="outlined" onClick={() => setWarehouseAsDefault(warehouse.id).catch(() => undefined)}>
                                تعيين افتراضي
                              </Button>
                            ) : null}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </DataTableWrapper>

          <SectionCard>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
              <LinkIcon color="primary" />
              <Typography variant="h6" fontWeight={800}>ربط المنتجات بالمستودعات</Typography>
            </Box>

            <Stack spacing={2.5}>
              <TextField
                size="small"
                select
                label="اختر منتجاً"
                value={selectedProductId}
                onChange={(event) => setSelectedProductId(event.target.value)}
              >
                <MenuItem value="">اختر منتج</MenuItem>
                {products.map((product) => (
                  <MenuItem key={product.id} value={product.id}>
                    {product.titleAr ?? product.title} ({product.slug})
                  </MenuItem>
                ))}
              </TextField>

              {selectedProduct ? (
                <Alert severity={(selectedProduct.variants?.length ?? 0) > 0 ? 'info' : 'success'}>
                  {(selectedProduct.variants?.length ?? 0) > 0
                    ? 'المنتج يحتوي على متغيرات؛ إدارة الربط ستكون على مستوى المتغيرات.'
                    : 'هذا المنتج بدون متغيرات، يمكن ربطه بالمستودعات مباشرة.'}
                </Alert>
              ) : null}

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 1.5 }}>
                {warehouses.map((warehouse) => (
                  <FormControlLabel
                    key={warehouse.id}
                    control={
                      <Checkbox
                        checked={selectedProductWarehouseIds.includes(warehouse.id)}
                        onChange={() => toggleProductWarehouseLink(warehouse.id)}
                        disabled={(selectedProduct?.variants?.length ?? 0) > 0}
                      />
                    }
                    label={`${warehouse.nameAr} (${warehouse.code})`}
                  />
                ))}
              </Box>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                <Button
                  variant="contained"
                  onClick={() => saveProductLinks().catch(() => undefined)}
                  disabled={actionLoading || !selectedProductId || (selectedProduct?.variants?.length ?? 0) > 0}
                >
                  حفظ ربط المنتج
                </Button>
                <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
                  عدد الروابط الحالية: {productLinks.length}
                </Typography>
              </Stack>
            </Stack>
          </SectionCard>

          <SectionCard>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
              <TuneIcon color="primary" />
              <Typography variant="h6" fontWeight={800}>توزيع مخزون المتغيرات على المستودعات</Typography>
            </Box>

            <Stack spacing={2.5}>
              <TextField
                size="small"
                select
                label="اختر متغيراً"
                value={selectedVariantId}
                onChange={(event) => setSelectedVariantId(event.target.value)}
                disabled={variantOptions.length === 0}
              >
                <MenuItem value="">اختر متغير</MenuItem>
                {variantOptions.map((variant) => (
                  <MenuItem key={variant.id} value={variant.id}>
                    {variant.titleAr ?? variant.title} - {variant.sku}
                  </MenuItem>
                ))}
              </TextField>

              {selectedVariantId ? (
                <Alert severity="info">
                  إجمالي الكمية الموزعة: {selectedVariantAllocationSummary.totalQuantity} - المحجوز: {selectedVariantAllocationSummary.totalReserved}
                </Alert>
              ) : (
                <Alert severity="warning">اختر منتجاً ثم متغيراً لتعديل التوزيع.</Alert>
              )}

              {selectedVariantId ? (
                <DataTableWrapper>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>تفعيل</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>المستودع</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>الكمية</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>محجوز</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>حد التنبيه</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>نقطة إعادة الطلب</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {variantAllocationRows.map((row) => {
                          const warehouse = warehouses.find((item) => item.id === row.warehouseId);
                          return (
                            <TableRow key={row.warehouseId} hover>
                              <TableCell>
                                <Checkbox
                                  checked={row.enabled}
                                  onChange={(event) => updateVariantAllocationRow(row.warehouseId, { enabled: event.target.checked })}
                                />
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" fontWeight={700}>{warehouse?.nameAr ?? '-'}</Typography>
                                <Typography variant="caption" color="text.secondary">{warehouse?.code ?? '-'}</Typography>
                              </TableCell>
                              <TableCell>
                                <TextField size="small" type="number" inputProps={{ min: 0, step: 1 }} value={row.quantity} onChange={(event) => updateVariantAllocationRow(row.warehouseId, { quantity: event.target.value })} disabled={!row.enabled} />
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" color="text.secondary">{row.reservedQuantityReadonly}</Typography>
                              </TableCell>
                              <TableCell>
                                <TextField size="small" type="number" inputProps={{ min: 0, step: 1 }} value={row.lowStockThreshold} onChange={(event) => updateVariantAllocationRow(row.warehouseId, { lowStockThreshold: event.target.value })} disabled={!row.enabled} />
                              </TableCell>
                              <TableCell>
                                <TextField size="small" type="number" inputProps={{ min: 0, step: 1 }} value={row.reorderPoint} onChange={(event) => updateVariantAllocationRow(row.warehouseId, { reorderPoint: event.target.value })} disabled={!row.enabled} />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </DataTableWrapper>
              ) : null}

              <Button
                variant="contained"
                onClick={() => saveVariantAllocations().catch(() => undefined)}
                disabled={actionLoading || !selectedVariantId}
              >
                حفظ توزيع المتغير
              </Button>
            </Stack>
          </SectionCard>
            </>
          ) : null}
        </Stack>
      )}
      <FloatingActionButton
        label={viewMode === 'detail' ? (actionLoading ? 'جاري الحفظ...' : 'حفظ المستودع') : 'إضافة مستودع'}
        icon={<AddIcon />}
        onClick={() => {
          if (viewMode === 'detail') {
            saveWarehouse().catch(() => undefined);
            return;
          }
          startCreateWarehouse();
        }}
        disabled={loading || actionLoading}
      />
    </AppPage>
  );
}
