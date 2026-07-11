import { AddIcon, ArrowForwardIcon, DeleteOutlineIcon, EditNoteIcon, TuneIcon } from '../../../../components/icons';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  MenuItem,
  Paper,
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
import { DataTableWrapper, FloatingActionButton } from '../../components/ui';
import type { Attribute, AttributeValue, Filter, FilterSourceType, FilterType, FilterValue } from '../../types';
import { normalizeSlug, sanitizeSlugInput } from '../../utils/slug';

interface FiltersPanelProps {
  request: MerchantRequester;
}

const filterTypeLabels: Record<FilterType, string> = {
  checkbox: 'اختيار متعدد',
  radio: 'اختيار واحد',
  color: 'ألوان',
  range: 'نطاق رقمي',
};

const sourceTypeLabels: Record<FilterSourceType, string> = {
  manual: 'يدوي',
  brand: 'العلامات التجارية',
  attribute: 'خاصية',
  price: 'أسعار المنتجات',
  warehouse: 'المستودعات',
  availability: 'التوفر',
};

const sourceTypeDescriptions: Record<FilterSourceType, string> = {
  manual: 'إدخال القيم يدوياً',
  brand: 'تلقائي من البراندات',
  attribute: 'تلقائي من الخصائص',
  price: 'تلقائي من الأسعار',
  warehouse: 'تلقائي من المستودعات',
  availability: 'تلقائي من المخزون',
};

const filterFormDefault = {
  nameAr: '',
  nameEn: '',
  slug: '',
  type: 'checkbox' as FilterType,
  sortOrder: '0',
  isActive: true,
  sourceType: 'manual' as FilterSourceType,
  sourceAttributeId: '',
  displayType: '',
};

const valueFormDefault = {
  valueAr: '',
  valueEn: '',
  slug: '',
  colorHex: '',
  sortOrder: '0',
  isActive: true,
};

export function FiltersPanel({ request }: FiltersPanelProps) {
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [filters, setFilters] = useState<Filter[]>([]);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [selectedFilterId, setSelectedFilterId] = useState('');
  const [selectedValueId, setSelectedValueId] = useState('');
  const [filterForm, setFilterForm] = useState(filterFormDefault);
  const [valueForm, setValueForm] = useState(valueFormDefault);
  const [isValueFormVisible, setIsValueFormVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: 'info' as 'info' | 'success' | 'error' });

  const selectedFilter = useMemo(
    () => filters.find((item) => item.id === selectedFilterId) ?? null,
    [filters, selectedFilterId],
  );

  const isSmartFilter = useMemo(
    () => selectedFilter?.sourceType && selectedFilter.sourceType !== 'manual',
    [selectedFilter],
  );

  useEffect(() => {
    void loadFilters();
    void loadAttributes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const automaticFilters = useMemo(
    () => filters.filter((f) => ['brand', 'price', 'warehouse', 'availability'].includes(f.sourceType)),
    [filters],
  );

  const attributeFilters = useMemo(
    () => filters.filter((f) => f.sourceType === 'attribute'),
    [filters],
  );

  const manualFilters = useMemo(
    () => filters.filter((f) => f.sourceType === 'manual' || !f.sourceType),
    [filters],
  );

  const usedAttributeIds = useMemo(
    () => new Set(attributeFilters.map((f) => f.sourceAttributeId)),
    [attributeFilters],
  );

  async function loadFilters(): Promise<void> {
    setLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      const data = await request<Filter[]>('/filters?includeValues=true', { method: 'GET' });
      setFilters((data ?? []).map((f) => ({ ...f, sourceType: f.sourceType ?? 'manual' })));
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'تعذر تحميل الفلاتر', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function loadAttributes(): Promise<void> {
    try {
      const data = await request<Attribute[]>('/attributes?includeValues=true', { method: 'GET' });
      setAttributes(data ?? []);
    } catch {
      // attributes not critical for filter page
    }
  }

  function prepareNewFilter(): void {
    setSelectedFilterId('');
    setSelectedValueId('');
    setFilterForm(filterFormDefault);
    setValueForm(valueFormDefault);
    setIsValueFormVisible(false);
    setMessage({ text: '', type: 'info' });
    setViewMode('detail');
  }

  function handleBackToList(): void {
    setViewMode('list');
    setSelectedFilterId('');
    setSelectedValueId('');
    setValueForm(valueFormDefault);
    setIsValueFormVisible(false);
    setMessage({ text: '', type: 'info' });
  }

  function selectFilter(filter: Filter): void {
    setSelectedFilterId(filter.id);
    setSelectedValueId('');
    setFilterForm({
      nameAr: filter.nameAr,
      nameEn: filter.nameEn,
      slug: filter.slug,
      type: filter.type,
      sortOrder: String(filter.sortOrder),
      isActive: filter.isActive,
      sourceType: filter.sourceType ?? 'manual',
      sourceAttributeId: filter.sourceAttributeId ?? '',
      displayType: filter.displayType ?? '',
    });
    setValueForm(valueFormDefault);
    setIsValueFormVisible(false);
    setViewMode('detail');
  }

  function prepareNewValue(): void {
    setSelectedValueId('');
    setValueForm(valueFormDefault);
    setIsValueFormVisible(true);
  }

  function selectValue(value: FilterValue): void {
    setSelectedValueId(value.id);
    setValueForm({
      valueAr: value.valueAr,
      valueEn: value.valueEn,
      slug: value.slug,
      colorHex: value.colorHex ?? '',
      sortOrder: String(value.sortOrder),
      isActive: value.isActive,
    });
    setIsValueFormVisible(true);
  }

  async function saveFilter(): Promise<void> {
    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      const sourceType = filterForm.sourceType;
      const payload: Record<string, unknown> = {
        nameAr: filterForm.nameAr.trim(),
        nameEn: filterForm.nameEn.trim(),
        type: sourceType === 'price' ? 'range' : filterForm.type,
        sortOrder: Number(filterForm.sortOrder || '0'),
        isActive: filterForm.isActive,
        sourceType,
        ...(sourceType === 'attribute' && filterForm.sourceAttributeId
          ? { sourceAttributeId: filterForm.sourceAttributeId }
          : {}),
        ...(filterForm.displayType ? { displayType: filterForm.displayType } : {}),
        ...(normalizeSlug(filterForm.slug) ? { slug: normalizeSlug(filterForm.slug) } : {}),
      };

      if (selectedFilterId) {
        await request(`/filters/${selectedFilterId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        const created = await request<Filter>('/filters', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        if (created) {
          setSelectedFilterId(created.id);
        }
      }

      await loadFilters();
      setMessage({ text: 'تم حفظ الفلتر بنجاح', type: 'success' });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'تعذر حفظ الفلتر', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function deleteFilter(filterId = selectedFilterId): Promise<void> {
    if (!filterId || !window.confirm('تأكيد حذف الفلتر؟')) {
      return;
    }
    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      await request(`/filters/${filterId}`, { method: 'DELETE' });
      setSelectedFilterId('');
      setSelectedValueId('');
      setFilterForm(filterFormDefault);
      setValueForm(valueFormDefault);
      setIsValueFormVisible(false);
      setViewMode('list');
      await loadFilters();
      setMessage({ text: 'تم حذف الفلتر', type: 'success' });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'تعذر حذف الفلتر', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function saveValue(): Promise<void> {
    if (!selectedFilterId) {
      setMessage({ text: 'احفظ الفلتر أولاً', type: 'error' });
      return;
    }
    if (isSmartFilter) {
      setMessage({ text: 'لا يمكن إضافة قيم يدوية لفلتر تلقائي. القيم تأتي من المصدر تلقائياً.', type: 'error' });
      return;
    }

    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      const payload = {
        valueAr: valueForm.valueAr.trim(),
        valueEn: valueForm.valueEn.trim(),
        sortOrder: Number(valueForm.sortOrder || '0'),
        isActive: valueForm.isActive,
        ...(normalizeSlug(valueForm.slug) ? { slug: normalizeSlug(valueForm.slug) } : {}),
        ...(selectedFilter?.type === 'color' && valueForm.colorHex.trim()
          ? { colorHex: valueForm.colorHex.trim() }
          : {}),
      };

      if (selectedValueId) {
        await request(`/filters/${selectedFilterId}/values/${selectedValueId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await request(`/filters/${selectedFilterId}/values`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      setSelectedValueId('');
      setValueForm(valueFormDefault);
      setIsValueFormVisible(false);
      await loadFilters();
      setMessage({ text: 'تم حفظ قيمة الفلتر', type: 'success' });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'تعذر حفظ القيمة', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function deleteValue(valueId: string): Promise<void> {
    if (!selectedFilterId || !window.confirm('تأكيد حذف القيمة؟')) {
      return;
    }
    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      await request(`/filters/${selectedFilterId}/values/${valueId}`, { method: 'DELETE' });
      setSelectedValueId('');
      setValueForm(valueFormDefault);
      setIsValueFormVisible(false);
      await loadFilters();
      setMessage({ text: 'تم حذف القيمة', type: 'success' });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'تعذر حذف القيمة', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function toggleFilterActive(filter: Filter): Promise<void> {
    try {
      await request(`/filters/${filter.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !filter.isActive }),
      });
      await loadFilters();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'تعذر تحديث الحالة', type: 'error' });
    }
  }

  async function enableAttributeAsFilter(attr: Attribute): Promise<void> {
    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      const defaultType = attr.type === 'color' ? 'color' : 'checkbox';
      await request<Filter>('/filters', {
        method: 'POST',
        body: JSON.stringify({
          nameAr: attr.nameAr ?? attr.name,
          nameEn: attr.nameEn ?? attr.name,
          slug: attr.slug,
          type: defaultType,
          displayType: defaultType,
          sourceType: 'attribute',
          sourceAttributeId: attr.id,
          isActive: true,
          sortOrder: filters.length,
        }),
      });
      await loadFilters();
      setMessage({ text: `تم تفعيل "${attr.nameAr ?? attr.name}" كفلتر`, type: 'success' });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'تعذر تفعيل الخاصية كفلتر', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  if (viewMode === 'detail') {
    return (
      <>
        <Box sx={{ display: 'grid', gap: 3 }}>
          <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between">
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Button startIcon={<ArrowForwardIcon />} onClick={handleBackToList} color="inherit">
                العودة للفلاتر
              </Button>
              <Box>
                <Typography variant="h5" fontWeight={800}>
                  {selectedFilterId ? 'تعديل الفلتر' : 'فلتر جديد'}
                </Typography>
                <Typography color="text.secondary">
                  {selectedFilterId && isSmartFilter
                    ? `فلتر تلقائي — ${sourceTypeDescriptions[selectedFilter?.sourceType ?? 'manual']}`
                    : 'بيانات الفلتر وقيمه'}
                </Typography>
              </Box>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              {selectedFilterId ? (
                <Button
                  color="error"
                  startIcon={<DeleteOutlineIcon />}
                  onClick={() => deleteFilter().catch(() => undefined)}
                  disabled={actionLoading}
                >
                  حذف الفلتر
                </Button>
              ) : null}
              <Button variant="contained" onClick={() => saveFilter().catch(() => undefined)} disabled={actionLoading}>
                حفظ الفلتر
              </Button>
            </Stack>
          </Stack>
        </Paper>

        {message.text ? <Alert severity={message.type}>{message.text}</Alert> : null}

        <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
          <Stack spacing={2.5}>
            <TextField
              select
              label="مصدر الفلتر"
              value={filterForm.sourceType}
              onChange={(event) =>
                setFilterForm((prev) => ({
                  ...prev,
                  sourceType: event.target.value as FilterSourceType,
                  sourceAttributeId: '',
                  type: event.target.value === 'price' ? 'range' : prev.type,
                }))
              }
              fullWidth
              disabled={!!selectedFilterId}
            >
              <MenuItem value="manual">يدوي — إدخال القيم يدوياً</MenuItem>
              <MenuItem value="brand">البراندات — تلقائي من البراندات</MenuItem>
              <MenuItem value="attribute">خاصية — تلقائي من الخصائص</MenuItem>
              <MenuItem value="price">السعر — تلقائي من الأسعار</MenuItem>
              <MenuItem value="warehouse">المستودعات — تلقائي من المستودعات</MenuItem>
              <MenuItem value="availability">التوفر — تلقائي من المخزون</MenuItem>
            </TextField>

            {filterForm.sourceType === 'attribute' ? (
              <TextField
                select
                label="اختر الخاصية"
                value={filterForm.sourceAttributeId}
                onChange={(event) => {
                  const attr = attributes.find((a) => a.id === event.target.value);
                  setFilterForm((prev) => ({
                    ...prev,
                    sourceAttributeId: event.target.value,
                    nameAr: prev.nameAr || attr?.nameAr || attr?.name || '',
                    nameEn: prev.nameEn || attr?.nameEn || attr?.name || '',
                    slug: prev.slug || attr?.slug || '',
                    type: attr?.type === 'color' ? 'color' : prev.type,
                    displayType: attr?.type === 'color' ? 'color' : 'checkbox',
                  }));
                }}
                fullWidth
                disabled={!!selectedFilterId}
              >
                {attributes
                  .filter((attr) => !usedAttributeIds.has(attr.id) || attr.id === filterForm.sourceAttributeId)
                  .map((attr) => (
                    <MenuItem key={attr.id} value={attr.id}>
                      {attr.nameAr ?? attr.name} ({attr.type}) — {attr.values?.length ?? 0} قيمة
                    </MenuItem>
                  ))}
              </TextField>
            ) : null}

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
              <TextField
                label="الاسم عربي"
                value={filterForm.nameAr}
                onChange={(event) => setFilterForm((prev) => ({ ...prev, nameAr: event.target.value }))}
                fullWidth
              />
              <TextField
                label="Name (English)"
                value={filterForm.nameEn}
                onChange={(event) => setFilterForm((prev) => ({ ...prev, nameEn: event.target.value }))}
                fullWidth
              />
              <TextField
                label="Slug"
                value={filterForm.slug}
                onChange={(event) =>
                  setFilterForm((prev) => ({ ...prev, slug: sanitizeSlugInput(event.target.value) }))
                }
                onBlur={() => setFilterForm((prev) => ({ ...prev, slug: normalizeSlug(prev.slug) }))}
                fullWidth
                dir="ltr"
              />
              <TextField
                select
                label="النوع"
                value={filterForm.type}
                onChange={(event) =>
                  setFilterForm((prev) => ({ ...prev, type: event.target.value as FilterType }))
                }
                fullWidth
                disabled={filterForm.sourceType === 'price'}
              >
                <MenuItem value="checkbox">اختيار متعدد</MenuItem>
                <MenuItem value="radio">اختيار واحد</MenuItem>
                <MenuItem value="color">لون</MenuItem>
                <MenuItem value="range">نطاق رقمي</MenuItem>
              </TextField>
              <TextField
                label="ترتيب العرض"
                type="number"
                value={filterForm.sortOrder}
                onChange={(event) => setFilterForm((prev) => ({ ...prev, sortOrder: event.target.value }))}
                fullWidth
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={filterForm.isActive}
                    onChange={(event) =>
                      setFilterForm((prev) => ({ ...prev, isActive: event.target.checked }))
                    }
                  />
                }
                label="نشط"
                sx={{ alignSelf: 'center' }}
              />
            </Box>
          </Stack>
        </Paper>

        {selectedFilterId ? (
          isSmartFilter ? (
            <Alert severity="info">
              هذا فلتر تلقائي ({sourceTypeDescriptions[selectedFilter?.sourceType ?? 'manual']}).
              القيم تسحب تلقائياً من المصدر ولا تحتاج إدخال يدوي.
            </Alert>
          ) : (
            <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
              <Stack spacing={2.5}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TuneIcon color="primary" />
                    <Typography variant="h6" fontWeight={800}>
                      قيم الفلتر
                    </Typography>
                  </Box>
                  {selectedFilter?.type !== 'range' ? (
                    <Button startIcon={<AddIcon />} variant="outlined" onClick={prepareNewValue}>
                      قيمة جديدة
                    </Button>
                  ) : null}
                </Box>

                {selectedFilter?.type === 'range' ? (
                  <Alert severity="info">فلتر النطاق رقمي ولا يحتوي قيماً ثابتة.</Alert>
                ) : isValueFormVisible ? (
                  <Box sx={{ display: 'grid', gap: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                      <TextField
                        label="القيمة عربي"
                        value={valueForm.valueAr}
                        onChange={(event) => setValueForm((prev) => ({ ...prev, valueAr: event.target.value }))}
                        fullWidth
                      />
                      <TextField
                        label="Value (English)"
                        value={valueForm.valueEn}
                        onChange={(event) => setValueForm((prev) => ({ ...prev, valueEn: event.target.value }))}
                        fullWidth
                      />
                      <TextField
                        label="Slug"
                        value={valueForm.slug}
                        onChange={(event) =>
                          setValueForm((prev) => ({ ...prev, slug: sanitizeSlugInput(event.target.value) }))
                        }
                        onBlur={() => setValueForm((prev) => ({ ...prev, slug: normalizeSlug(prev.slug) }))}
                        fullWidth
                        dir="ltr"
                      />
                      <TextField
                        label="ترتيب العرض"
                        type="number"
                        value={valueForm.sortOrder}
                        onChange={(event) => setValueForm((prev) => ({ ...prev, sortOrder: event.target.value }))}
                        fullWidth
                      />
                      {selectedFilter?.type === 'color' ? (
                        <TextField
                          label="HEX Color"
                          placeholder="#FF0000"
                          value={valueForm.colorHex}
                          onChange={(event) => setValueForm((prev) => ({ ...prev, colorHex: event.target.value }))}
                          fullWidth
                          dir="ltr"
                        />
                      ) : null}
                      <FormControlLabel
                        control={
                          <Switch
                            checked={valueForm.isActive}
                            onChange={(event) =>
                              setValueForm((prev) => ({ ...prev, isActive: event.target.checked }))
                            }
                          />
                        }
                        label="القيمة نشطة"
                        sx={{ alignSelf: 'center' }}
                      />
                    </Box>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                      <Button variant="contained" onClick={() => saveValue().catch(() => undefined)} disabled={actionLoading}>
                        {selectedValueId ? 'تحديث القيمة' : 'إضافة قيمة'}
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={() => {
                          setSelectedValueId('');
                          setValueForm(valueFormDefault);
                          setIsValueFormVisible(false);
                        }}
                      >
                        إلغاء
                      </Button>
                    </Stack>
                  </Box>
                ) : null}

                {selectedFilter?.type !== 'range' ? (
                  <DataTableWrapper>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>القيمة</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Slug</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>الترتيب</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>الحالة</TableCell>
                            <TableCell align="left" />
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(selectedFilter?.values ?? []).length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                                <Typography color="text.secondary">لا توجد قيم لهذا الفلتر بعد.</Typography>
                              </TableCell>
                            </TableRow>
                          ) : (
                            (selectedFilter?.values ?? []).map((value) => (
                              <TableRow key={value.id} hover>
                                <TableCell>
                                  <Stack direction="row" spacing={1} alignItems="center">
                                    {value.colorHex ? (
                                      <Box
                                        sx={{
                                          width: 16,
                                          height: 16,
                                          borderRadius: '50%',
                                          bgcolor: value.colorHex,
                                          border: '1px solid',
                                          borderColor: 'divider',
                                        }}
                                      />
                                    ) : null}
                                    <Box>
                                      <Typography variant="body2" fontWeight={700}>
                                        {value.valueAr}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        {value.valueEn}
                                      </Typography>
                                    </Box>
                                  </Stack>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="caption" dir="ltr">
                                    {value.slug}
                                  </Typography>
                                </TableCell>
                                <TableCell>{value.sortOrder}</TableCell>
                                <TableCell>
                                  <Chip
                                    size="small"
                                    color={value.isActive ? 'success' : 'default'}
                                    label={value.isActive ? 'نشطة' : 'غير نشطة'}
                                  />
                                </TableCell>
                                <TableCell align="left">
                                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                                    <Button size="small" onClick={() => selectValue(value)}>
                                      تعديل
                                    </Button>
                                    <Button
                                      size="small"
                                      color="error"
                                      onClick={() => deleteValue(value.id).catch(() => undefined)}
                                      disabled={actionLoading}
                                    >
                                      حذف
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
                ) : null}
              </Stack>
            </Paper>
          )
        ) : (
          <Alert severity="info">احفظ الفلتر أولاً حتى تتمكن من إدارة قيمه.</Alert>
        )}
        </Box>
        <FloatingActionButton
          label={actionLoading ? 'جاري الحفظ...' : 'حفظ الفلتر'}
          icon={<AddIcon />}
          onClick={() => saveFilter().catch(() => undefined)}
          disabled={actionLoading}
        />
      </>
    );
  }

  return (
    <Box sx={{ display: 'grid', gap: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={800}>
            إدارة فلاتر المنتجات
          </Typography>
          <Typography color="text.secondary">
            لا تحتاج لإعادة كتابة البراندات أو الألوان أو التخزين. اختر مصدر الفلتر فقط وسيتم سحب القيم تلقائياً.
          </Typography>
        </Box>
        <Button startIcon={<AddIcon />} variant="contained" onClick={prepareNewFilter}>
          فلتر جديد
        </Button>
      </Box>

      {message.text ? <Alert severity={message.type}>{message.text}</Alert> : null}

      {/* Section 1: Automatic Filters */}
      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
        <Typography variant="h6" fontWeight={800} gutterBottom>
          الفلاتر التلقائية
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          فلاتر تسحب بياناتها تلقائياً من البراندات، الأسعار، المستودعات، أو المخزون.
        </Typography>
        <DataTableWrapper>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>الفلتر</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>المصدر</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>النوع</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>الحالة</TableCell>
                  <TableCell align="left" />
                </TableRow>
              </TableHead>
              <TableBody>
                {automaticFilters.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                      <Typography color="text.secondary">
                        {loading ? 'جاري التحميل...' : 'لا توجد فلاتر تلقائية. أنشئ واحدة جديدة.'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  automaticFilters.map((filter) => (
                    <TableRow key={filter.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={700}>{filter.nameAr}</Typography>
                        <Typography variant="caption" color="text.secondary" dir="ltr">{filter.slug}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip size="small" color="info" variant="outlined" label={sourceTypeLabels[filter.sourceType]} />
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={filterTypeLabels[filter.type]} />
                      </TableCell>
                      <TableCell>
                        <Switch
                          size="small"
                          checked={filter.isActive}
                          onChange={() => toggleFilterActive(filter).catch(() => undefined)}
                        />
                      </TableCell>
                      <TableCell align="left">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button size="small" startIcon={<EditNoteIcon />} onClick={() => selectFilter(filter)}>
                            تعديل
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            startIcon={<DeleteOutlineIcon />}
                            onClick={() => deleteFilter(filter.id).catch(() => undefined)}
                            disabled={actionLoading}
                          >
                            حذف
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
      </Paper>

      {/* Section 2: Attribute Filters */}
      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
        <Typography variant="h6" fontWeight={800} gutterBottom>
          فلاتر من الخصائص
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          حوّل أي خاصية (اللون، التخزين، RAM...) إلى فلتر تلقائي.
        </Typography>
        <DataTableWrapper>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>الخاصية</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>النوع</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>القيم</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>مفعلة كفلتر</TableCell>
                  <TableCell align="left" />
                </TableRow>
              </TableHead>
              <TableBody>
                {attributes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                      <Typography color="text.secondary">
                        {loading ? 'جاري التحميل...' : 'لا توجد خصائص بعد. أنشئ خصائص أولاً من قسم الخصائص.'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  attributes.map((attr) => {
                    const existingFilter = attributeFilters.find((f) => f.sourceAttributeId === attr.id);
                    return (
                      <TableRow key={attr.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={700}>
                            {attr.nameAr ?? attr.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" dir="ltr">
                            {attr.slug}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip size="small" variant="outlined" label={attr.type === 'color' ? 'لون' : 'قائمة'} />
                        </TableCell>
                        <TableCell>{attr.values?.length ?? 0}</TableCell>
                        <TableCell>
                          {existingFilter ? (
                            <Switch
                              size="small"
                              checked={existingFilter.isActive}
                              onChange={() => toggleFilterActive(existingFilter).catch(() => undefined)}
                            />
                          ) : (
                            <Chip size="small" label="لا" color="default" />
                          )}
                        </TableCell>
                        <TableCell align="left">
                          {existingFilter ? (
                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                              <Button size="small" startIcon={<EditNoteIcon />} onClick={() => selectFilter(existingFilter)}>
                                تعديل
                              </Button>
                              <Button
                                size="small"
                                color="error"
                                startIcon={<DeleteOutlineIcon />}
                                onClick={() => deleteFilter(existingFilter.id).catch(() => undefined)}
                                disabled={actionLoading}
                              >
                                حذف
                              </Button>
                            </Stack>
                          ) : (
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => enableAttributeAsFilter(attr).catch(() => undefined)}
                              disabled={actionLoading}
                            >
                              تفعيل كفلتر
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DataTableWrapper>
      </Paper>

      {/* Section 3: Manual Filters */}
      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
        <Typography variant="h6" fontWeight={800} gutterBottom>
          فلاتر يدوية مخصصة
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          فلاتر مخصصة تدار قيمها يدوياً (الشبكة، نوع الشاشة، مناسب لـ...).
        </Typography>
        <DataTableWrapper>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>الفلتر</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>النوع</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>القيم</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>الترتيب</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>الحالة</TableCell>
                  <TableCell align="left" />
                </TableRow>
              </TableHead>
              <TableBody>
                {manualFilters.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                      <Typography color="text.secondary">
                        {loading ? 'جاري التحميل...' : 'لا توجد فلاتر يدوية بعد.'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  manualFilters.map((filter) => (
                    <TableRow key={filter.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={700}>{filter.nameAr}</Typography>
                        <Typography variant="caption" color="text.secondary" dir="ltr">{filter.slug}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={filterTypeLabels[filter.type]} />
                      </TableCell>
                      <TableCell>{filter.type === 'range' ? 'نطاق رقمي' : filter.values?.length ?? 0}</TableCell>
                      <TableCell>{filter.sortOrder}</TableCell>
                      <TableCell>
                        <Switch
                          size="small"
                          checked={filter.isActive}
                          onChange={() => toggleFilterActive(filter).catch(() => undefined)}
                        />
                      </TableCell>
                      <TableCell align="left">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button size="small" startIcon={<TuneIcon />} onClick={() => selectFilter(filter)}>
                            إدارة القيم
                          </Button>
                          <Button size="small" startIcon={<EditNoteIcon />} onClick={() => selectFilter(filter)}>
                            تعديل
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            startIcon={<DeleteOutlineIcon />}
                            onClick={() => deleteFilter(filter.id).catch(() => undefined)}
                            disabled={actionLoading}
                          >
                            حذف
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
      </Paper>
      <FloatingActionButton
        label="إنشاء فلتر"
        icon={<AddIcon />}
        onClick={prepareNewFilter}
        disabled={loading || actionLoading}
      />
    </Box>
  );
}
