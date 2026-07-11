import { AddIcon, ArrowForwardIcon, BrandingWatermarkIcon, CloudUploadIcon, DeleteOutlineIcon, EditNoteIcon, ImageIcon } from '../../../../components/icons';
import { useEffect, useState, type ChangeEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';

import type { MerchantRequester } from '../../merchant-dashboard.types';
import type { Brand, MediaAsset, PresignedMediaUpload } from '../../types';
import { FloatingActionButton, EcommerceCoreLoader } from '../../components/ui';

interface BrandsPanelProps {
  request: MerchantRequester;
}

const emptyForm = {
  nameAr: '',
  nameEn: '',
  isActive: true,
  isPopular: false,
};

export function BrandsPanel({ request }: BrandsPanelProps) {
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [formMediaAssetId, setFormMediaAssetId] = useState<string | null>(null);
  const [formImageUrl, setFormImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [message, setMessage] = useState({ text: '', type: 'info' as 'info' | 'success' | 'error' });

  useEffect(() => {
    loadBrands().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadBrands(): Promise<void> {
    setLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      const rows = await request<Brand[]>('/brands', { method: 'GET' });
      setBrands(rows ?? []);
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'تعذر تحميل العلامات التجارية', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  function handleCreateNew(): void {
    setSelectedId('');
    setForm(emptyForm);
    setFormMediaAssetId(null);
    setFormImageUrl(null);
    setMessage({ text: '', type: 'info' });
    setViewMode('detail');
  }

  function selectBrand(brand: Brand): void {
    setSelectedId(brand.id);
    setForm({
      nameAr: brand.nameAr ?? brand.name,
      nameEn: brand.nameEn ?? '',
      isActive: brand.isActive,
      isPopular: brand.isPopular,
    });
    setFormMediaAssetId(brand.mediaAssetId);
    setFormImageUrl(brand.imageUrl);
    setMessage({ text: '', type: 'info' });
    setViewMode('detail');
  }

  function handleBackToList(): void {
    setViewMode('list');
    setMessage({ text: '', type: 'info' });
  }

  async function createBrand(): Promise<void> {
    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      await request('/brands', {
        method: 'POST',
        body: JSON.stringify(buildBrandPayload(form, formMediaAssetId, false)),
      });
      await loadBrands();
      setMessage({ text: 'تم إنشاء العلامة التجارية بنجاح', type: 'success' });
      setViewMode('list');
      setForm(emptyForm);
      setFormMediaAssetId(null);
      setFormImageUrl(null);
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'تعذر إنشاء العلامة التجارية', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function updateBrand(): Promise<void> {
    if (!selectedId) {
      return;
    }

    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      await request(`/brands/${selectedId}`, {
        method: 'PUT',
        body: JSON.stringify(buildBrandPayload(form, formMediaAssetId, true)),
      });
      await loadBrands();
      setMessage({ text: 'تم تحديث العلامة التجارية بنجاح', type: 'success' });
      setViewMode('list');
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'تعذر تحديث العلامة التجارية', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function deleteBrand(): Promise<void> {
    if (!selectedId || !window.confirm('هل أنت متأكد من حذف هذه العلامة التجارية؟')) {
      return;
    }

    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      await request(`/brands/${selectedId}`, { method: 'DELETE' });
      await loadBrands();
      setMessage({ text: 'تم حذف العلامة التجارية بنجاح', type: 'success' });
      setSelectedId('');
      setForm(emptyForm);
      setFormMediaAssetId(null);
      setFormImageUrl(null);
      setViewMode('list');
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'تعذر حذف العلامة التجارية', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setMessage({ text: '', type: 'info' });
    try {
      const asset = await uploadMediaAsset(request, file);
      setFormMediaAssetId(asset.id);
      setFormImageUrl(asset.url);
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'تعذر رفع صورة العلامة التجارية', type: 'error' });
    } finally {
      setUploadingImage(false);
      event.target.value = '';
    }
  }

  function removeImage(): void {
    setFormMediaAssetId(null);
    setFormImageUrl(null);
  }

  if (viewMode === 'detail') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 800, mx: 'auto', width: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Button startIcon={<ArrowForwardIcon />} onClick={handleBackToList} color="inherit" sx={{ fontWeight: 700 }}>
            العودة إلى العلامات التجارية
          </Button>
          {selectedId ? (
            <Button color="error" startIcon={<DeleteOutlineIcon />} onClick={() => deleteBrand().catch(() => undefined)} disabled={actionLoading}>
              حذف العلامة التجارية
            </Button>
          ) : null}
        </Box>

        {message.text ? <Alert severity={message.type}>{message.text}</Alert> : null}

        <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <BrandingWatermarkIcon color="primary" />
            <Typography variant="h6" fontWeight={800}>
              {selectedId ? 'تعديل العلامة التجارية' : 'علامة تجارية جديدة'}
            </Typography>
          </Box>

          <Stack spacing={3}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
              <TextField
                label="اسم العلامة التجارية (عربي)"
                fullWidth
                value={form.nameAr}
                onChange={(event) => setForm((prev) => ({ ...prev, nameAr: event.target.value }))}
                required
              />
              <TextField
                label="Brand Name (English)"
                fullWidth
                value={form.nameEn}
                onChange={(event) => setForm((prev) => ({ ...prev, nameEn: event.target.value }))}
                dir="ltr"
              />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
              <FormControlLabel
                control={<Switch checked={form.isActive} onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))} />}
                label="نشطة"
              />
              <FormControlLabel
                control={<Switch checked={form.isPopular} onChange={(event) => setForm((prev) => ({ ...prev, isPopular: event.target.checked }))} />}
                label="شائعة"
              />
            </Box>

            <Box sx={{ bgcolor: 'background.default', p: 3, borderRadius: 3, border: '1px dashed', borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight={700} mb={2}>صورة العلامة التجارية (اختياري)</Typography>
              {formImageUrl ? (
                <Box sx={{ mb: 2, position: 'relative', display: 'inline-block' }}>
                  <Box component="img" src={formImageUrl} alt={form.nameAr || 'brand'} sx={{ width: 160, height: 160, objectFit: 'cover', borderRadius: 2, border: '1px solid', borderColor: 'divider' }} />
                  <Button size="small" color="error" onClick={removeImage} sx={{ mt: 1 }}>إزالة الصورة</Button>
                </Box>
              ) : null}
              <Button variant="outlined" component="label" startIcon={<CloudUploadIcon />} disabled={uploadingImage}>
                {uploadingImage ? 'جاري الرفع...' : formImageUrl ? 'تغيير الصورة' : 'رفع صورة'}
                <input type="file" accept="image/*" hidden onChange={(event) => handleImageUpload(event).catch(() => undefined)} />
              </Button>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 1 }}>
              <Button
                variant="contained"
                size="large"
                onClick={() => (selectedId ? updateBrand() : createBrand()).catch(() => undefined)}
                disabled={actionLoading}
              >
                {actionLoading ? 'جاري الحفظ...' : selectedId ? 'حفظ التعديلات' : 'إنشاء العلامة التجارية'}
              </Button>
            </Box>
          </Stack>
        </Paper>
        <FloatingActionButton
          label={actionLoading ? 'جاري الحفظ...' : selectedId ? 'حفظ العلامة' : 'إنشاء العلامة'}
          icon={<AddIcon />}
          onClick={() => (selectedId ? updateBrand() : createBrand()).catch(() => undefined)}
          disabled={actionLoading}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={800} gutterBottom>
            العلامات التجارية
          </Typography>
          <Typography color="text.secondary">إدارة العلامات التجارية وربطها بالمنتجات.</Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button variant="outlined" onClick={() => loadBrands().catch(() => undefined)} disabled={loading}>تحديث</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateNew}>علامة تجارية جديدة</Button>
        </Stack>
      </Box>

      {message.text ? <Alert severity={message.type}>{message.text}</Alert> : null}

      <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', overflow: 'hidden', p: 2 }}>
        {loading ? (
          <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
            <EcommerceCoreLoader size="md" label="جاري تحميل العلامات..." compact />
          </Box>
        ) : brands.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography color="text.secondary">لا توجد علامات تجارية.</Typography>
          </Box>
        ) : (
          <Stack spacing={1.25}>
            {brands.map((brand) => (
              <Box
                key={brand.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  p: 1.5,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                {brand.imageUrl ? (
                  <Box component="img" src={brand.imageUrl} alt={brand.nameAr} sx={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 1 }} />
                ) : (
                  <Box sx={{ width: 44, height: 44, borderRadius: 1, bgcolor: 'background.default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ImageIcon color="disabled" fontSize="small" />
                  </Box>
                )}

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontWeight={700} noWrap>{brand.nameAr ?? brand.name}</Typography>
                  <Typography variant="body2" color="text.secondary" dir="ltr" noWrap>{brand.nameEn ?? '-'}</Typography>
                </Box>

                <Chip size="small" label={brand.isActive ? 'نشطة' : 'غير نشطة'} color={brand.isActive ? 'success' : 'default'} />
                {brand.isPopular ? <Chip size="small" label="شائعة" color="warning" /> : null}
                <Button size="small" variant="outlined" startIcon={<EditNoteIcon />} onClick={() => selectBrand(brand)}>تعديل</Button>
              </Box>
            ))}
          </Stack>
        )}
      </Paper>
      <FloatingActionButton
        label="إنشاء علامة"
        icon={<AddIcon />}
        onClick={handleCreateNew}
        disabled={loading || actionLoading}
      />
    </Box>
  );
}

function buildBrandPayload(
  form: typeof emptyForm,
  mediaAssetId: string | null,
  isUpdate: boolean,
): {
  name: string;
  nameAr: string;
  nameEn?: string;
  mediaAssetId?: string | null;
  isActive: boolean;
  isPopular: boolean;
} {
  const nameAr = form.nameAr.trim();
  if (!nameAr) {
    throw new Error('اسم العلامة التجارية العربي مطلوب');
  }

  const payload: {
    name: string;
    nameAr: string;
    nameEn?: string;
    mediaAssetId?: string | null;
    isActive: boolean;
    isPopular: boolean;
  } = {
    name: nameAr,
    nameAr,
    isActive: form.isActive,
    isPopular: form.isPopular,
  };

  if (form.nameEn.trim()) {
    payload.nameEn = form.nameEn.trim();
  }

  if (isUpdate) {
    payload.mediaAssetId = mediaAssetId;
  } else if (mediaAssetId) {
    payload.mediaAssetId = mediaAssetId;
  }

  return payload;
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
    throw new Error('تعذر الحصول على رابط الرفع الموقّع');
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

  if (etag) {
    confirmPayload.etag = etag;
  }

  const mediaAsset = await request<MediaAsset>('/media/confirm', {
    method: 'POST',
    body: JSON.stringify(confirmPayload),
  });

  if (!mediaAsset) {
    throw new Error('تعذر تأكيد الوسائط المرفوعة');
  }

  return mediaAsset;
}


