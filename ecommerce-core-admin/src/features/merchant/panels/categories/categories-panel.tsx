import { AccountTreeIcon, AddIcon, ArrowForwardIcon, CloudUploadIcon, DeleteOutlineIcon, DragIndicatorIcon, EditNoteIcon, ImageIcon } from '../../../../components/icons';
import { useState, useEffect, useMemo } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
  Chip,
  Divider,
  CircularProgress,
} from '@mui/material';

import type { MerchantRequester } from '../../merchant-dashboard.types';
import type { Category, MediaAsset, PresignedMediaUpload } from '../../types';
import { FloatingActionButton } from '../../components/ui';
import { normalizeSlug, sanitizeSlugInput } from '../../utils/slug';

interface CategoriesPanelProps {
  request: MerchantRequester;
}

const emptyForm = {
  name: '',
  slug: '',
  description: '',
  parentId: '',
  sortOrder: '0',
  isActive: true,
  nameAr: '',
  nameEn: '',
  descriptionAr: '',
  descriptionEn: '',
  imageAltAr: '',
  imageAltEn: '',
  seoTitleAr: '',
  seoTitleEn: '',
  seoDescriptionAr: '',
  seoDescriptionEn: '',
};

export function CategoriesPanel({ request }: CategoriesPanelProps) {
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [message, setMessage] = useState({ text: '', type: 'info' as 'info' | 'success' | 'error' });
  const [formMediaAssetId, setFormMediaAssetId] = useState<string | null>(null);
  const [formImageUrl, setFormImageUrl] = useState<string | null>(null);
  const [formBackgroundMediaAssetId, setFormBackgroundMediaAssetId] = useState<string | null>(null);
  const [formBackgroundImageUrl, setFormBackgroundImageUrl] = useState<string | null>(null);
  const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null);
  const [reorderLoading, setReorderLoading] = useState(false);

  const treeRows = useMemo(() => buildCategoryTreeRows(categories), [categories]);

  useEffect(() => {
    loadCategories().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCategories(): Promise<void> {
    setLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      const data = await request<Category[]>('/categories', { method: 'GET' });
      setCategories(data ?? []);
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'تعذر تحميل التصنيفات', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  function handleCreateNew() {
    setSelectedId('');
    setForm(emptyForm);
    setFormMediaAssetId(null);
    setFormImageUrl(null);
    setFormBackgroundMediaAssetId(null);
    setFormBackgroundImageUrl(null);
    setMessage({ text: '', type: 'info' });
    setViewMode('detail');
  }

  function handleBackToList() {
    setViewMode('list');
    setMessage({ text: '', type: 'info' });
  }

  async function createCategory(): Promise<void> {
    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      await request('/categories', {
        method: 'POST',
        body: JSON.stringify(buildCategoryPayload(form, formMediaAssetId, formBackgroundMediaAssetId, false)),
      });
      setForm(emptyForm);
      await loadCategories();
      setMessage({ text: 'تم إنشاء التصنيف بنجاح', type: 'success' });
      setViewMode('list');
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'تعذر إنشاء التصنيف', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function updateCategory(): Promise<void> {
    if (!selectedId) return;
    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      await request(`/categories/${selectedId}`, {
        method: 'PUT',
        body: JSON.stringify(buildCategoryPayload(form, formMediaAssetId, formBackgroundMediaAssetId, true)),
      });
      await loadCategories();
      setMessage({ text: 'تم تحديث التصنيف بنجاح', type: 'success' });
      setViewMode('list');
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'تعذر تحديث التصنيف', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function deleteCategory(): Promise<void> {
    if (!selectedId || !window.confirm('هل أنت متأكد من حذف هذا التصنيف؟')) return;
    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      await request(`/categories/${selectedId}`, {
        method: 'DELETE',
      });
      setSelectedId('');
      setForm(emptyForm);
      setFormMediaAssetId(null);
      setFormImageUrl(null);
      setFormBackgroundMediaAssetId(null);
      setFormBackgroundImageUrl(null);
      await loadCategories();
      setMessage({ text: 'تم حذف التصنيف بنجاح', type: 'success' });
      setViewMode('list');
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'تعذر حذف التصنيف', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function deleteCategoryFromList(category: Category): Promise<void> {
    if (!window.confirm('هل أنت متأكد من حذف هذا التصنيف؟')) return;
    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      await request(`/categories/${category.id}`, {
        method: 'DELETE',
      });
      await loadCategories();
      setMessage({ text: 'تم حذف التصنيف بنجاح', type: 'success' });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'تعذر حذف التصنيف', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  function selectCategory(category: Category): void {
    setSelectedId(category.id);
    setForm({
      name: category.name,
      slug: category.slug,
      description: category.description ?? '',
      parentId: category.parentId ?? '',
      sortOrder: String(category.sortOrder),
      isActive: category.isActive,
      nameAr: category.nameAr ?? category.name,
      nameEn: category.nameEn ?? '',
      descriptionAr: category.descriptionAr ?? category.description ?? '',
      descriptionEn: category.descriptionEn ?? '',
      imageAltAr: category.imageAltAr ?? '',
      imageAltEn: category.imageAltEn ?? '',
      seoTitleAr: category.seoTitleAr ?? '',
      seoTitleEn: category.seoTitleEn ?? '',
      seoDescriptionAr: category.seoDescriptionAr ?? '',
      seoDescriptionEn: category.seoDescriptionEn ?? '',
    });
    setFormMediaAssetId(category.mediaAssetId);
    setFormImageUrl(category.imageUrl);
    setFormBackgroundMediaAssetId(category.backgroundMediaAssetId);
    setFormBackgroundImageUrl(category.backgroundImageUrl);
    setViewMode('detail');
  }

  async function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setMessage({ text: '', type: 'info' });
    try {
      const asset = await uploadMediaAsset(request, file);
      setFormMediaAssetId(asset.id);
      setFormImageUrl(asset.url);
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'تعذر رفع الصورة', type: 'error' });
    } finally {
      setUploadingImage(false);
      event.target.value = '';
    }
  }

  async function handleBackgroundImageUpload(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setMessage({ text: '', type: 'info' });
    try {
      const asset = await uploadMediaAsset(request, file);
      setFormBackgroundMediaAssetId(asset.id);
      setFormBackgroundImageUrl(asset.url);
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'تعذر رفع صورة الخلفية', type: 'error' });
    } finally {
      setUploadingImage(false);
      event.target.value = '';
    }
  }

  function handleRemoveImage() {
    setFormMediaAssetId(null);
    setFormImageUrl(null);
  }

  function handleRemoveBackgroundImage() {
    setFormBackgroundMediaAssetId(null);
    setFormBackgroundImageUrl(null);
  }

  async function applyReorder(nextCategories: Category[]): Promise<void> {
    const changedCategories = nextCategories.filter((nextCategory) => {
      const current = categories.find((item) => item.id === nextCategory.id);
      return (
        current &&
        (current.parentId !== nextCategory.parentId || current.sortOrder !== nextCategory.sortOrder)
      );
    });

    if (changedCategories.length === 0) {
      return;
    }

    setReorderLoading(true);
    setMessage({ text: '', type: 'info' });

    try {
      await Promise.all(
        changedCategories.map((category) =>
          request(`/categories/${category.id}`, {
            method: 'PUT',
            body: JSON.stringify({
              parentId: category.parentId,
              sortOrder: category.sortOrder,
            }),
          }),
        ),
      );
      setCategories(nextCategories);
      setMessage({ text: 'تم تحديث ترتيب شجرة التصنيفات', type: 'success' });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'تعذر حفظ ترتيب التصنيفات', type: 'error' });
      await loadCategories();
    } finally {
      setReorderLoading(false);
    }
  }

  async function handleDropOnCategory(targetCategoryId: string): Promise<void> {
    if (!draggedCategoryId || draggedCategoryId === targetCategoryId) {
      setDraggedCategoryId(null);
      return;
    }

    const nextCategories = reorderCategories(categories, draggedCategoryId, {
      type: 'after',
      targetCategoryId,
    });
    setDraggedCategoryId(null);
    await applyReorder(nextCategories);
  }

  async function handleDropOnRoot(): Promise<void> {
    if (!draggedCategoryId) {
      return;
    }
    const nextCategories = reorderCategories(categories, draggedCategoryId, { type: 'root' });
    setDraggedCategoryId(null);
    await applyReorder(nextCategories);
  }

  const getParentName = (parentId: string | null) => {
    if (!parentId) return 'بدون تصنيف أب';
    const parent = categories.find(c => c.id === parentId);
    return parent ? parent.name : parentId;
  };

  const parentCategoryOptions = categories.filter((category) => category.id !== selectedId);

  if (viewMode === 'detail') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 800, mx: 'auto', width: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, justifyContent: 'space-between' }}>
          <Button 
            startIcon={<ArrowForwardIcon />} 
            onClick={handleBackToList}
            color="inherit"
            sx={{ fontWeight: 700 }}
          >
            العودة للتصنيفات
          </Button>
          {selectedId && (
            <Button 
              color="error" 
              startIcon={<DeleteOutlineIcon />}
              onClick={() => deleteCategory().catch(() => undefined)}
              disabled={actionLoading}
            >
              حذف التصنيف
            </Button>
          )}
        </Box>

        {message.text && (
          <Alert severity={message.type} sx={{ borderRadius: 2 }}>{message.text}</Alert>
        )}

        <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, borderRadius: 4, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <AccountTreeIcon color="primary" />
            <Typography variant="h6" fontWeight={800}>
              {selectedId ? 'تعديل التصنيف' : 'تصنيف جديد'}
            </Typography>
          </Box>
          <Divider sx={{ mb: 4 }} />
          
          <Stack spacing={3}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 3 }}>
              <Box>
                <TextField 
                  label="الاسم (عربي)" 
                  fullWidth 
                  value={form.nameAr} 
                  onChange={(event) => setForm((prev) => ({ ...prev, nameAr: event.target.value, name: event.target.value }))} 
                  required
                  dir="rtl"
                />
              </Box>
              <Box>
                <TextField 
                  label="ترتيب العرض" 
                  type="number" 
                  inputProps={{ min: 0 }} 
                  fullWidth 
                  value={form.sortOrder} 
                  onChange={(event) => setForm((prev) => ({ ...prev, sortOrder: event.target.value }))} 
                />
              </Box>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr' }, gap: 3 }}>
              <Box>
                <TextField 
                  label="Name (English)" 
                  fullWidth 
                  value={form.nameEn} 
                  onChange={(event) => setForm((prev) => ({ ...prev, nameEn: event.target.value }))} 
                  dir="ltr"
                />
              </Box>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
              <Box>
                <TextField 
                  label="المسار المختصر (Slug)" 
                  fullWidth 
                  value={form.slug} 
                  onChange={(event) => setForm((prev) => ({ ...prev, slug: sanitizeSlugInput(event.target.value) }))}
                  onBlur={() => setForm((prev) => ({ ...prev, slug: normalizeSlug(prev.slug) }))}
                  dir="ltr"
                  helperText="يستخدم في روابط المتجر"
                />
              </Box>
              <Box>
                <TextField 
                  select
                  label="التصنيف الأب (اختياري)" 
                  fullWidth 
                  value={form.parentId} 
                  onChange={(event) => setForm((prev) => ({ ...prev, parentId: event.target.value }))} 
                  helperText="اختر تصنيفاً سابقاً لجعل هذا التصنيف فرعياً"
                >
                  <MenuItem value="">بدون تصنيف أب</MenuItem>
                  {parentCategoryOptions.map((category) => (
                    <MenuItem key={category.id} value={category.id}>
                      {category.nameAr ?? category.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
              <Box>
                <TextField 
                  label="الوصف (عربي)" 
                  fullWidth 
                  multiline 
                  minRows={3} 
                  value={form.descriptionAr} 
                  onChange={(event) => setForm((prev) => ({ ...prev, descriptionAr: event.target.value }))} 
                  dir="rtl"
                />
              </Box>
              <Box>
                <TextField 
                  label="Description (English)" 
                  fullWidth 
                  multiline 
                  minRows={3} 
                  value={form.descriptionEn} 
                  onChange={(event) => setForm((prev) => ({ ...prev, descriptionEn: event.target.value }))} 
                  dir="ltr"
                />
              </Box>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
              <Box>
                <TextField
                  label="وصف صورة التصنيف (عربي)"
                  fullWidth
                  value={form.imageAltAr}
                  onChange={(event) => setForm((prev) => ({ ...prev, imageAltAr: event.target.value }))}
                  dir="rtl"
                />
              </Box>
              <Box>
                <TextField
                  label="Category Image Alt (English)"
                  fullWidth
                  value={form.imageAltEn}
                  onChange={(event) => setForm((prev) => ({ ...prev, imageAltEn: event.target.value }))}
                  dir="ltr"
                />
              </Box>
            </Box>

            <FormControlLabel 
              control={<Checkbox checked={form.isActive} onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))} />} 
              label={<Typography fontWeight={600}>تفعيل التصنيف وظهوره في المتجر</Typography>} 
            />

            <Box sx={{ bgcolor: 'background.default', p: 3, borderRadius: 3, border: '1px dashed', borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight={700} mb={2}>صورة التصنيف</Typography>
              {formImageUrl && (
                <Box sx={{ mb: 2, position: 'relative', display: 'inline-block' }}>
                  <Box component="img" src={formImageUrl} alt={form.imageAltAr || form.imageAltEn || 'صورة التصنيف'} sx={{ width: 160, height: 160, objectFit: 'cover', borderRadius: 2, border: '1px solid', borderColor: 'divider' }} />
                  <Button size="small" color="error" onClick={handleRemoveImage} sx={{ mt: 1 }}>إزالة الصورة</Button>
                </Box>
              )}
              <Stack direction="row" spacing={2} alignItems="center">
                <Button variant="outlined" component="label" startIcon={<CloudUploadIcon />} disabled={uploadingImage}>
                  {uploadingImage ? 'جارِ الرفع...' : formImageUrl ? 'تغيير الصورة' : 'رفع صورة'}
                  <input type="file" accept="image/*" hidden onChange={(e) => handleImageUpload(e).catch(() => undefined)} />
                </Button>
              </Stack>
            </Box>

            <Box sx={{ bgcolor: 'background.default', p: 3, borderRadius: 3, border: '1px dashed', borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight={700} mb={2}>الصورة الخلفية للتصنيف</Typography>
              {formBackgroundImageUrl && (
                <Box sx={{ mb: 2, position: 'relative', display: 'inline-block' }}>
                  <Box component="img" src={formBackgroundImageUrl} alt="الصورة الخلفية للتصنيف" sx={{ width: 240, height: 120, objectFit: 'cover', borderRadius: 2, border: '1px solid', borderColor: 'divider' }} />
                  <Button size="small" color="error" onClick={handleRemoveBackgroundImage} sx={{ mt: 1 }}>إزالة الصورة</Button>
                </Box>
              )}
              <Stack direction="row" spacing={2} alignItems="center">
                <Button variant="outlined" component="label" startIcon={<CloudUploadIcon />} disabled={uploadingImage}>
                  {uploadingImage ? 'جارِ الرفع...' : formBackgroundImageUrl ? 'تغيير صورة الخلفية' : 'رفع صورة خلفية'}
                  <input type="file" accept="image/*" hidden onChange={(e) => handleBackgroundImageUpload(e).catch(() => undefined)} />
                </Button>
              </Stack>
            </Box>

            <Box sx={{ bgcolor: 'background.default', p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle1" fontWeight={800} mb={2}>تحسين الظهور ونتائج البحث (SEO)</Typography>
              <Stack spacing={3}>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
                  <TextField
                    label="عنوان صفحة التصنيف (عربي)"
                    fullWidth
                    value={form.seoTitleAr}
                    onChange={(event) => setForm((prev) => ({ ...prev, seoTitleAr: event.target.value }))}
                    dir="rtl"
                  />
                  <TextField
                    label="Category Page Title (English)"
                    fullWidth
                    value={form.seoTitleEn}
                    onChange={(event) => setForm((prev) => ({ ...prev, seoTitleEn: event.target.value }))}
                    dir="ltr"
                  />
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
                  <TextField
                    label="وصف صفحة التصنيف (عربي)"
                    fullWidth
                    multiline
                    minRows={3}
                    value={form.seoDescriptionAr}
                    onChange={(event) => setForm((prev) => ({ ...prev, seoDescriptionAr: event.target.value }))}
                    dir="rtl"
                  />
                  <TextField
                    label="Category Page Description (English)"
                    fullWidth
                    multiline
                    minRows={3}
                    value={form.seoDescriptionEn}
                    onChange={(event) => setForm((prev) => ({ ...prev, seoDescriptionEn: event.target.value }))}
                    dir="ltr"
                  />
                </Box>
              </Stack>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 2 }}>
              <Button 
                variant="contained" 
                size="large"
                onClick={() => (selectedId ? updateCategory() : createCategory()).catch(() => undefined)}
                disabled={actionLoading}
                sx={{ px: 4, borderRadius: 2 }}
              >
                {actionLoading ? 'جارِ الحفظ...' : selectedId ? 'حفظ التعديلات' : 'إنشاء التصنيف'}
              </Button>
            </Box>
          </Stack>
        </Paper>
        <FloatingActionButton
          label={actionLoading ? 'جاري الحفظ...' : selectedId ? 'حفظ التصنيف' : 'إنشاء التصنيف'}
          icon={<AddIcon />}
          onClick={() => (selectedId ? updateCategory() : createCategory()).catch(() => undefined)}
          disabled={actionLoading}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 1, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={800} gutterBottom>
            التصنيفات
          </Typography>
          <Typography color="text.secondary">
            نظم منتجاتك في مجموعات وفئات لتسهيل تصفحها على عملائك.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button 
            variant="outlined" 
            onClick={() => loadCategories().catch(() => undefined)}
            disabled={loading}
          >
            تحديث
          </Button>
          <Button 
            variant="contained" 
            color="primary" 
            startIcon={<AddIcon />} 
            onClick={handleCreateNew}
            size="large"
            sx={{ borderRadius: 2 }}
          >
            تصنيف جديد
          </Button>
        </Stack>
      </Box>

      {message.text && (
        <Alert severity={message.type} sx={{ borderRadius: 2 }}>{message.text}</Alert>
      )}

      <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', overflow: 'hidden', p: 2 }}>
        {loading ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <CircularProgress />
          </Box>
        ) : categories.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography color="text.secondary">لا توجد تصنيفات مضافة.</Typography>
          </Box>
        ) : (
          <Stack spacing={1.2}>
            <Typography variant="body2" color="text.secondary">
              اسحب التصنيف ثم أفلته فوق تصنيف آخر لإعادة الترتيب داخل نفس المستوى. ويمكنك إفلاته في منطقة الجذر لنقله كتصنيف رئيسي.
            </Typography>
            <Box
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                handleDropOnRoot().catch(() => undefined);
              }}
              sx={{
                border: '1px dashed',
                borderColor: draggedCategoryId ? 'primary.main' : 'divider',
                borderRadius: 2,
                p: 1.5,
                textAlign: 'center',
                bgcolor: draggedCategoryId ? 'action.hover' : 'background.default',
              }}
            >
              <Typography variant="body2" color="text.secondary">إفلات هنا للنقل إلى الجذر (بدون تصنيف أب)</Typography>
            </Box>
            {treeRows.map(({ category, depth }) => (
              <Box
                key={category.id}
                draggable={!reorderLoading}
                onDragStart={() => setDraggedCategoryId(category.id)}
                onDragEnd={() => setDraggedCategoryId(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  handleDropOnCategory(category.id).catch(() => undefined);
                }}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  p: 1.2,
                  pl: `${1.2 + depth * 2.4}rem`,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: draggedCategoryId === category.id ? 'primary.main' : 'divider',
                  bgcolor: draggedCategoryId === category.id ? 'action.selected' : 'background.paper',
                  opacity: reorderLoading && draggedCategoryId === category.id ? 0.5 : 1,
                  cursor: reorderLoading ? 'not-allowed' : 'grab',
                }}
              >
                <DragIndicatorIcon fontSize="small" color="disabled" />
                {category.imageUrl ? (
                  <Box
                    component="img"
                    src={category.imageUrl}
                    alt={category.imageAltAr ?? category.imageAltEn ?? category.name}
                    sx={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 1 }}
                  />
                ) : (
                  <Box sx={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default', borderRadius: 1 }}>
                    <ImageIcon fontSize="small" color="disabled" />
                  </Box>
                )}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontWeight={700} noWrap>
                    {category.nameAr ?? category.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" dir="ltr" sx={{ fontFamily: 'monospace' }} noWrap>
                    /{category.slug}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {getParentName(category.parentId)}
                </Typography>
                <Typography variant="body2" color="text.secondary">#{category.sortOrder}</Typography>
                <Chip
                  size="small"
                  label={category.isActive ? 'نشط' : 'غير نشط'}
                  color={category.isActive ? 'success' : 'default'}
                  sx={{ fontWeight: 700, borderRadius: 1.5 }}
                />
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<EditNoteIcon />}
                  onClick={() => selectCategory(category)}
                  sx={{ borderRadius: 1.5, whiteSpace: 'nowrap' }}
                >
                  تعديل
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteOutlineIcon />}
                  onClick={() => deleteCategoryFromList(category).catch(() => undefined)}
                  disabled={actionLoading}
                  sx={{ borderRadius: 1.5, whiteSpace: 'nowrap' }}
                >
                  حذف
                </Button>
              </Box>
            ))}
            {reorderLoading ? (
              <Typography variant="body2" color="text.secondary">
                جاري حفظ ترتيب التصنيفات...
              </Typography>
            ) : null}
          </Stack>
        )}
      </Paper>
      <FloatingActionButton
        label="إنشاء تصنيف"
        icon={<AddIcon />}
        onClick={handleCreateNew}
        disabled={loading || actionLoading}
      />
    </Box>
  );
}

interface TreeRow {
  category: Category;
  depth: number;
}

function buildCategoryTreeRows(categories: Category[]): TreeRow[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const childrenByParent = new Map<string, Category[]>();

  for (const category of categories) {
    const parentKey = category.parentId && byId.has(category.parentId) ? category.parentId : 'root';
    const siblings = childrenByParent.get(parentKey) ?? [];
    siblings.push(category);
    childrenByParent.set(parentKey, siblings);
  }

  for (const siblings of childrenByParent.values()) {
    siblings.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return (a.nameAr ?? a.name).localeCompare(b.nameAr ?? b.name, 'ar');
    });
  }

  const rows: TreeRow[] = [];
  const visited = new Set<string>();

  const walk = (parentKey: string, depth: number) => {
    const siblings = childrenByParent.get(parentKey) ?? [];
    for (const category of siblings) {
      if (visited.has(category.id)) continue;
      visited.add(category.id);
      rows.push({ category, depth });
      walk(category.id, depth + 1);
    }
  };

  walk('root', 0);

  for (const category of categories) {
    if (!visited.has(category.id)) {
      rows.push({ category, depth: 0 });
    }
  }

  return rows;
}

function reorderCategories(
  categories: Category[],
  draggedCategoryId: string,
  destination: { type: 'after'; targetCategoryId: string } | { type: 'root' },
): Category[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const dragged = byId.get(draggedCategoryId);
  if (!dragged) {
    return categories;
  }

  const childrenByParent = buildChildrenIndex(categories, byId);
  const oldParentKey = dragged.parentId && byId.has(dragged.parentId) ? dragged.parentId : 'root';
  const sourceSiblings = [...(childrenByParent.get(oldParentKey) ?? [])].filter((id) => id !== draggedCategoryId);
  childrenByParent.set(oldParentKey, sourceSiblings);

  if (destination.type === 'root') {
    const rootSiblings = [...(childrenByParent.get('root') ?? []), draggedCategoryId];
    childrenByParent.set('root', uniqueIds(rootSiblings));
    return materializeReorderedCategories(categories, byId, childrenByParent);
  }

  const target = byId.get(destination.targetCategoryId);
  if (!target) {
    return categories;
  }

  const descendantIds = collectDescendantIds(draggedCategoryId, childrenByParent);
  if (descendantIds.has(target.id)) {
    return categories;
  }

  const targetParentKey = target.parentId && byId.has(target.parentId) ? target.parentId : 'root';
  const destinationSiblings = [...(childrenByParent.get(targetParentKey) ?? [])].filter((id) => id !== draggedCategoryId);
  const targetIndex = destinationSiblings.findIndex((id) => id === target.id);
  const insertIndex = targetIndex === -1 ? destinationSiblings.length : targetIndex + 1;
  destinationSiblings.splice(insertIndex, 0, draggedCategoryId);
  childrenByParent.set(targetParentKey, destinationSiblings);

  return materializeReorderedCategories(categories, byId, childrenByParent);
}

function buildChildrenIndex(
  categories: Category[],
  byId: Map<string, Category>,
): Map<string, string[]> {
  const index = new Map<string, string[]>();

  const sortedCategories = [...categories].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return (a.nameAr ?? a.name).localeCompare(b.nameAr ?? b.name, 'ar');
  });

  for (const category of sortedCategories) {
    const parentKey = category.parentId && byId.has(category.parentId) ? category.parentId : 'root';
    const siblings = index.get(parentKey) ?? [];
    siblings.push(category.id);
    index.set(parentKey, siblings);
  }

  return index;
}

function collectDescendantIds(categoryId: string, childrenByParent: Map<string, string[]>): Set<string> {
  const descendants = new Set<string>();
  const stack = [...(childrenByParent.get(categoryId) ?? [])];

  while (stack.length > 0) {
    const nextId = stack.pop();
    if (!nextId || descendants.has(nextId)) {
      continue;
    }
    descendants.add(nextId);
    const nested = childrenByParent.get(nextId) ?? [];
    for (const childId of nested) {
      stack.push(childId);
    }
  }

  return descendants;
}

function uniqueIds(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function materializeReorderedCategories(
  categories: Category[],
  byId: Map<string, Category>,
  childrenByParent: Map<string, string[]>,
): Category[] {
  const updates = new Map<string, { parentId: string | null; sortOrder: number }>();

  for (const [parentKey, siblingIds] of childrenByParent.entries()) {
    const parentId = parentKey === 'root' ? null : parentKey;
    siblingIds.forEach((categoryId, index) => {
      if (!byId.has(categoryId)) return;
      updates.set(categoryId, { parentId, sortOrder: index });
    });
  }

  return categories.map((category) => {
    const next = updates.get(category.id);
    if (!next) return category;
    return {
      ...category,
      parentId: next.parentId,
      sortOrder: next.sortOrder,
    };
  });
}

function buildCategoryPayload(form: {
  name: string;
  slug: string;
  description: string;
  parentId: string;
  sortOrder: string;
  isActive: boolean;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  imageAltAr: string;
  imageAltEn: string;
  seoTitleAr: string;
  seoTitleEn: string;
  seoDescriptionAr: string;
  seoDescriptionEn: string;
}, mediaAssetId: string | null, backgroundMediaAssetId: string | null, isUpdate: boolean) {
  const primaryArabicName = form.nameAr.trim() || form.name.trim();
  if (!primaryArabicName) {
    throw new Error('الاسم العربي للتصنيف مطلوب');
  }

  const payload: {
    name: string;
    slug?: string;
    description?: string;
    parentId?: string;
    sortOrder: number;
    isActive: boolean;
    nameAr?: string;
    nameEn?: string;
    descriptionAr?: string;
    descriptionEn?: string;
    imageAltAr?: string;
    imageAltEn?: string;
    seoTitleAr?: string;
    seoTitleEn?: string;
    seoDescriptionAr?: string;
    seoDescriptionEn?: string;
    mediaAssetId?: string | null;
    backgroundMediaAssetId?: string | null;
  } = {
    name: primaryArabicName,
    nameAr: primaryArabicName,
    sortOrder: Number(form.sortOrder || '0'),
    isActive: form.isActive,
  };

  if (isUpdate) {
    payload.mediaAssetId = mediaAssetId;
    payload.backgroundMediaAssetId = backgroundMediaAssetId;
  } else {
    if (mediaAssetId) {
      payload.mediaAssetId = mediaAssetId;
    }
    if (backgroundMediaAssetId) {
      payload.backgroundMediaAssetId = backgroundMediaAssetId;
    }
  }

  const slug = normalizeSlug(form.slug);
  const description = form.descriptionAr.trim();
  const parentId = form.parentId.trim();
  const nameEn = form.nameEn.trim();
  const descriptionAr = form.descriptionAr.trim();
  const descriptionEn = form.descriptionEn.trim();
  const imageAltAr = form.imageAltAr.trim();
  const imageAltEn = form.imageAltEn.trim();
  const seoTitleAr = form.seoTitleAr.trim();
  const seoTitleEn = form.seoTitleEn.trim();
  const seoDescriptionAr = form.seoDescriptionAr.trim();
  const seoDescriptionEn = form.seoDescriptionEn.trim();

  if (slug) {
    payload.slug = slug;
  }
  if (description) {
    payload.description = description;
  }
  if (parentId) {
    payload.parentId = parentId;
  }
  if (nameEn) {
    payload.nameEn = nameEn;
  }
  if (descriptionAr) {
    payload.descriptionAr = descriptionAr;
  }
  if (descriptionEn) {
    payload.descriptionEn = descriptionEn;
  }
  if (imageAltAr) {
    payload.imageAltAr = imageAltAr;
  }
  if (imageAltEn) {
    payload.imageAltEn = imageAltEn;
  }
  if (seoTitleAr) {
    payload.seoTitleAr = seoTitleAr;
  }
  if (seoTitleEn) {
    payload.seoTitleEn = seoTitleEn;
  }
  if (seoDescriptionAr) {
    payload.seoDescriptionAr = seoDescriptionAr;
  }
  if (seoDescriptionEn) {
    payload.seoDescriptionEn = seoDescriptionEn;
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
