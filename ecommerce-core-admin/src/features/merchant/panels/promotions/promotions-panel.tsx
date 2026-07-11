import { AddIcon, ArrowForwardIcon, DiscountIcon, EditNoteIcon, LocalOfferIcon, StarBorderIcon } from '../../../../components/icons';
import { useState, useEffect } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Paper,
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
  Divider,
  CircularProgress,
} from '@mui/material';

import type { MerchantRequester } from '../../merchant-dashboard.types';
import type {
  AdvancedOffer,
  AdvancedOfferType,
  Category,
  Coupon,
  DiscountType,
  Offer,
  OfferTargetType,
  Product,
  ProductListResponse,
} from '../../types';
import { FloatingActionButton } from '../../components/ui';
import { clearFieldErrors, isApiError, mapFieldErrors } from '../../../../lib/api-error';

interface PromotionsPanelProps {
  request: MerchantRequester;
  mode?: PromotionsSection;
}

type PromotionsSection = 'coupons' | 'offers' | 'advanced';

const couponFormDefault = {
  code: '',
  discountType: 'percent' as DiscountType,
  discountValue: '10',
  minOrderAmount: '0',
  isFreeShipping: false,
  startsAt: '',
  endsAt: '',
  maxUses: '',
  isActive: true,
};

const offerFormDefault = {
  name: '',
  targetType: 'cart' as OfferTargetType,
  targetProductId: '',
  targetCategoryId: '',
  discountType: 'percent' as DiscountType,
  discountValue: '10',
  startsAt: '',
  endsAt: '',
  isActive: true,
};

const advancedOfferFormDefault = {
  name: '',
  description: '',
  offerType: 'bxgy' as AdvancedOfferType,
  config: JSON.stringify(
    {
      bxgy: {
        buyQuantity: 2,
        buyProductIds: ['product-id-1'],
        getXQuantity: 1,
        getXProductIds: ['product-id-2'],
        discountPercent: 100,
      },
    },
    null,
    2,
  ),
  startsAt: '',
  endsAt: '',
  isActive: true,
  priority: '0',
};

export function PromotionsPanel({ request, mode = 'offers' }: PromotionsPanelProps) {
  const activeSection = mode;
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [advancedOffers, setAdvancedOffers] = useState<AdvancedOffer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  const [selectedCouponId, setSelectedCouponId] = useState('');
  const [selectedOfferId, setSelectedOfferId] = useState('');
  const [selectedAdvancedOfferId, setSelectedAdvancedOfferId] = useState('');
  
  const [couponForm, setCouponForm] = useState(couponFormDefault);
  const [offerForm, setOfferForm] = useState(offerFormDefault);
  const [advancedOfferForm, setAdvancedOfferForm] = useState(advancedOfferFormDefault);
  
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: 'info' as 'info' | 'success' | 'error' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const pageCopy = {
    coupons: {
      title: 'الكوبونات',
      description: 'إدارة كوبونات الخصم، حدود الاستخدام، وتواريخ التفعيل.',
      createLabel: 'كوبون جديد',
    },
    offers: {
      title: 'العروض التسويقية',
      description: 'إدارة العروض التلقائية المطبقة على السلة أو منتج أو تصنيف محدد.',
      createLabel: 'عرض جديد',
    },
    advanced: {
      title: 'العروض المتقدمة',
      description: 'إدارة عروض BXGY والحزم والخصومات التدريجية بشكل مستقل.',
      createLabel: 'عرض متقدم',
    },
  }[activeSection];

  useEffect(() => {
    loadAll().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAll(): Promise<void> {
    setLoading(true);
    setMessage({ text: '', type: 'info' });
    try {
      const [couponData, offerData, advancedOfferData, productData, categoryData] = await Promise.all([
        request<Coupon[]>('/promotions/coupons', { method: 'GET' }),
        request<Offer[]>('/promotions/offers', { method: 'GET' }),
        request<AdvancedOffer[]>('/advanced-offers', { method: 'GET' }),
        request<ProductListResponse>('/products?page=1&limit=200', { method: 'GET' }),
        request<Category[]>('/categories', { method: 'GET' }),
      ]);

      setCoupons(couponData ?? []);
      setOffers(offerData ?? []);
      setAdvancedOffers(advancedOfferData ?? []);
      setProducts(productData?.items ?? []);
      setCategories(categoryData ?? []);
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'تعذر تحميل العروض', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  function handleCreateNew() {
    setSelectedCouponId('');
    setSelectedOfferId('');
    setSelectedAdvancedOfferId('');
    setCouponForm(couponFormDefault);
    setOfferForm(offerFormDefault);
    setAdvancedOfferForm(advancedOfferFormDefault);
    setMessage({ text: '', type: 'info' });
    setFieldErrors({});
    setViewMode('detail');
  }

  function handleBackToList() {
    setViewMode('list');
    setMessage({ text: '', type: 'info' });
    setFieldErrors({});
  }

  async function createCoupon(): Promise<void> {
    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    setFieldErrors({});
    try {
      await request('/promotions/coupons', {
        method: 'POST',
        body: JSON.stringify(buildCouponCreatePayload(couponForm)),
      });
      setCouponForm(couponFormDefault);
      await loadAll();
      setMessage({ text: 'تم إنشاء كوبون الخصم بنجاح', type: 'success' });
      setViewMode('list');
    } catch (error) {
      if (isApiError(error)) {
        setFieldErrors(mapCouponFieldErrors(error.fieldErrors));
      }
      setMessage({ text: error instanceof Error ? error.message : 'تعذر إنشاء الكوبون', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function updateCoupon(): Promise<void> {
    if (!selectedCouponId) return;
    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    setFieldErrors({});
    try {
      await request(`/promotions/coupons/${selectedCouponId}`, {
        method: 'PUT',
        body: JSON.stringify(buildCouponUpdatePayload(couponForm)),
      });
      await loadAll();
      setMessage({ text: 'تم تحديث كوبون الخصم بنجاح', type: 'success' });
      setViewMode('list');
    } catch (error) {
      if (isApiError(error)) {
        setFieldErrors(mapCouponFieldErrors(error.fieldErrors));
      }
      setMessage({ text: error instanceof Error ? error.message : 'تعذر تحديث الكوبون', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function createOffer(): Promise<void> {
    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    setFieldErrors({});
    try {
      await request('/promotions/offers', {
        method: 'POST',
        body: JSON.stringify(buildOfferCreatePayload(offerForm)),
      });
      setOfferForm(offerFormDefault);
      await loadAll();
      setMessage({ text: 'تم إنشاء العرض التلقائي بنجاح', type: 'success' });
      setViewMode('list');
    } catch (error) {
      if (isApiError(error)) {
        setFieldErrors(mapOfferFieldErrors(error.fieldErrors));
      }
      setMessage({ text: error instanceof Error ? error.message : 'تعذر إنشاء العرض', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function updateOffer(): Promise<void> {
    if (!selectedOfferId) return;
    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    setFieldErrors({});
    try {
      await request(`/promotions/offers/${selectedOfferId}`, {
        method: 'PUT',
        body: JSON.stringify(buildOfferUpdatePayload(offerForm)),
      });
      await loadAll();
      setMessage({ text: 'تم تحديث العرض التلقائي بنجاح', type: 'success' });
      setViewMode('list');
    } catch (error) {
      if (isApiError(error)) {
        setFieldErrors(mapOfferFieldErrors(error.fieldErrors));
      }
      setMessage({ text: error instanceof Error ? error.message : 'تعذر تحديث العرض', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function createAdvancedOffer(): Promise<void> {
    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    setFieldErrors({});
    try {
      await request('/advanced-offers', {
        method: 'POST',
        body: JSON.stringify(buildAdvancedOfferCreatePayload(advancedOfferForm)),
      });
      setAdvancedOfferForm(advancedOfferFormDefault);
      await loadAll();
      setMessage({ text: 'تم إنشاء العرض المتقدم بنجاح', type: 'success' });
      setViewMode('list');
    } catch (error) {
      if (isApiError(error)) {
        setFieldErrors(mapAdvancedOfferFieldErrors(error.fieldErrors));
      }
      setMessage({ text: error instanceof Error ? error.message : 'تعذر إنشاء العرض المتقدم', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  async function updateAdvancedOffer(): Promise<void> {
    if (!selectedAdvancedOfferId) return;
    setActionLoading(true);
    setMessage({ text: '', type: 'info' });
    setFieldErrors({});
    try {
      await request(`/advanced-offers/${selectedAdvancedOfferId}`, {
        method: 'PUT',
        body: JSON.stringify(buildAdvancedOfferUpdatePayload(advancedOfferForm)),
      });
      await loadAll();
      setMessage({ text: 'تم تحديث العرض المتقدم بنجاح', type: 'success' });
      setViewMode('list');
    } catch (error) {
      if (isApiError(error)) {
        setFieldErrors(mapAdvancedOfferFieldErrors(error.fieldErrors));
      }
      setMessage({ text: error instanceof Error ? error.message : 'تعذر تحديث العرض المتقدم', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  }

  function selectCoupon(coupon: Coupon): void {
    setSelectedCouponId(coupon.id);
    setCouponForm({
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: String(coupon.discountValue),
      minOrderAmount: String(coupon.minOrderAmount),
      isFreeShipping: coupon.isFreeShipping,
      startsAt: coupon.startsAt ? coupon.startsAt.slice(0, 16) : '',
      endsAt: coupon.endsAt ? coupon.endsAt.slice(0, 16) : '',
      maxUses: coupon.maxUses !== null ? String(coupon.maxUses) : '',
      isActive: coupon.isActive,
    });
    setFieldErrors({});
    setViewMode('detail');
  }

  function selectOffer(offer: Offer): void {
    setSelectedOfferId(offer.id);
    setOfferForm({
      name: offer.name,
      targetType: offer.targetType,
      targetProductId: offer.targetProductId ?? '',
      targetCategoryId: offer.targetCategoryId ?? '',
      discountType: offer.discountType,
      discountValue: String(offer.discountValue),
      startsAt: offer.startsAt ? offer.startsAt.slice(0, 16) : '',
      endsAt: offer.endsAt ? offer.endsAt.slice(0, 16) : '',
      isActive: offer.isActive,
    });
    setFieldErrors({});
    setViewMode('detail');
  }

  function selectAdvancedOffer(offer: AdvancedOffer): void {
    setSelectedAdvancedOfferId(offer.id);
    setAdvancedOfferForm({
      name: offer.name,
      description: offer.description ?? '',
      offerType: offer.offerType,
      config: JSON.stringify(offer.config, null, 2),
      startsAt: offer.startsAt ? offer.startsAt.slice(0, 16) : '',
      endsAt: offer.endsAt ? offer.endsAt.slice(0, 16) : '',
      isActive: offer.isActive,
      priority: String(offer.priority),
    });
    setFieldErrors({});
    setViewMode('detail');
  }

  function readAdvancedConfig(): Record<string, any> {
    try {
      const parsed = JSON.parse(advancedOfferForm.config);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function updateAdvancedConfigSection(section: string, patch: Record<string, unknown>): void {
    const current = readAdvancedConfig();
    const currentSection =
      current[section] && typeof current[section] === 'object' ? current[section] : {};
    setAdvancedOfferForm((prev) => ({
      ...prev,
      config: JSON.stringify(
        {
          ...current,
          [section]: {
            ...currentSection,
            ...patch,
          },
        },
        null,
        2,
      ),
    }));
  }

  function advancedNumber(section: string, key: string, fallback: number): string {
    const value = readAdvancedConfig()[section]?.[key];
    return typeof value === 'number' ? String(value) : String(fallback);
  }

  function advancedIdList(section: string, key: string): string[] {
    const value = readAdvancedConfig()[section]?.[key];
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  }

  if (viewMode === 'detail') {
    const saveCurrentPromotion = () => {
      if (activeSection === 'coupons') {
        return selectedCouponId ? updateCoupon() : createCoupon();
      }
      if (activeSection === 'offers') {
        return selectedOfferId ? updateOffer() : createOffer();
      }
      return selectedAdvancedOfferId ? updateAdvancedOffer() : createAdvancedOffer();
    };

    return (
      <>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 800, mx: 'auto', width: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Button 
            startIcon={<ArrowForwardIcon />} 
            onClick={handleBackToList}
            color="inherit"
            sx={{ fontWeight: 700 }}
          >
            العودة للقائمة
          </Button>
        </Box>

        {message.text && (
          <Alert severity={message.type} sx={{ borderRadius: 2 }}>{message.text}</Alert>
        )}

        <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, borderRadius: 4, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
          
          {/* COUPON FORM */}
          {activeSection === 'coupons' && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <DiscountIcon color="primary" />
                <Typography variant="h6" fontWeight={800}>{selectedCouponId ? 'تعديل كوبون الخصم' : 'كوبون خصم جديد'}</Typography>
              </Box>
              <Divider sx={{ mb: 4 }} />
              
              <Stack spacing={3}>
                <TextField label="رمز الكوبون (Code)" fullWidth value={couponForm.code} error={Boolean(fieldErrors.code)} helperText={fieldErrors.code} onChange={(event) => { setFieldErrors((prev) => clearFieldErrors(prev, ['code'])); setCouponForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() })); }} dir="ltr" />
                
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3 }}>
                  <TextField select label="نوع الخصم" fullWidth value={couponForm.discountType} error={Boolean(fieldErrors.discountType)} helperText={fieldErrors.discountType} onChange={(event) => { setFieldErrors((prev) => clearFieldErrors(prev, ['discountType'])); setCouponForm((prev) => ({ ...prev, discountType: event.target.value as DiscountType })); }}>
                    <MenuItem value="percent">نسبة مئوية (%)</MenuItem>
                    <MenuItem value="fixed">مبلغ ثابت</MenuItem>
                  </TextField>
                  <TextField label="قيمة الخصم" type="number" inputProps={{ min: 0, step: 0.01 }} fullWidth value={couponForm.discountValue} error={Boolean(fieldErrors.discountValue)} helperText={fieldErrors.discountValue} onChange={(event) => { setFieldErrors((prev) => clearFieldErrors(prev, ['discountValue'])); setCouponForm((prev) => ({ ...prev, discountValue: event.target.value })); }} />
                </Box>
                
                <TextField label="الحد الأدنى للطلب (اختياري)" type="number" inputProps={{ min: 0, step: 0.01 }} fullWidth value={couponForm.minOrderAmount} error={Boolean(fieldErrors.minOrderAmount)} helperText={fieldErrors.minOrderAmount} onChange={(event) => { setFieldErrors((prev) => clearFieldErrors(prev, ['minOrderAmount'])); setCouponForm((prev) => ({ ...prev, minOrderAmount: event.target.value })); }} />
                
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3 }}>
                  <TextField label="تاريخ البدء" type="datetime-local" InputLabelProps={{ shrink: true }} fullWidth value={couponForm.startsAt} error={Boolean(fieldErrors.startsAt)} helperText={fieldErrors.startsAt} onChange={(event) => { setFieldErrors((prev) => clearFieldErrors(prev, ['startsAt'])); setCouponForm((prev) => ({ ...prev, startsAt: event.target.value })); }} />
                  <TextField label="تاريخ الانتهاء" type="datetime-local" InputLabelProps={{ shrink: true }} fullWidth value={couponForm.endsAt} error={Boolean(fieldErrors.endsAt)} helperText={fieldErrors.endsAt} onChange={(event) => { setFieldErrors((prev) => clearFieldErrors(prev, ['endsAt'])); setCouponForm((prev) => ({ ...prev, endsAt: event.target.value })); }} />
                </Box>

                <TextField label="الحد الأقصى لعدد الاستخدامات (اختياري)" type="number" inputProps={{ min: 1 }} fullWidth value={couponForm.maxUses} error={Boolean(fieldErrors.maxUses)} helperText={fieldErrors.maxUses} onChange={(event) => { setFieldErrors((prev) => clearFieldErrors(prev, ['maxUses'])); setCouponForm((prev) => ({ ...prev, maxUses: event.target.value })); }} />
                <FormControlLabel control={<Checkbox checked={couponForm.isFreeShipping} onChange={(event) => setCouponForm((prev) => ({ ...prev, isFreeShipping: event.target.checked }))} />} label="كوبون شحن مجاني" />
                <FormControlLabel control={<Checkbox checked={couponForm.isActive} onChange={(event) => setCouponForm((prev) => ({ ...prev, isActive: event.target.checked }))} />} label="الكوبون فعال" />
                <Button variant="contained" size="large" onClick={() => (selectedCouponId ? updateCoupon() : createCoupon()).catch(() => undefined)} disabled={actionLoading}>
                  {actionLoading ? 'جارِ الحفظ...' : 'حفظ الكوبون'}
                </Button>
              </Stack>
            </Box>
          )}

          {/* OFFER FORM */}
          {activeSection === 'offers' && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <LocalOfferIcon color="primary" />
                <Typography variant="h6" fontWeight={800}>{selectedOfferId ? 'تعديل العرض التلقائي' : 'عرض تلقائي جديد'}</Typography>
              </Box>
              <Divider sx={{ mb: 4 }} />
              
              <Stack spacing={3}>
                <TextField label="اسم العرض" fullWidth value={offerForm.name} error={Boolean(fieldErrors.name)} helperText={fieldErrors.name} onChange={(event) => { setFieldErrors((prev) => clearFieldErrors(prev, ['name'])); setOfferForm((prev) => ({ ...prev, name: event.target.value })); }} />
                <TextField select label="يطبق على" fullWidth value={offerForm.targetType} error={Boolean(fieldErrors.targetType)} helperText={fieldErrors.targetType} onChange={(event) => { setFieldErrors((prev) => clearFieldErrors(prev, ['targetType'])); setOfferForm((prev) => ({ ...prev, targetType: event.target.value as OfferTargetType })); }}>
                  <MenuItem value="cart">كامل السلة</MenuItem>
                  <MenuItem value="product">منتج محدد</MenuItem>
                  <MenuItem value="category">تصنيف محدد</MenuItem>
                </TextField>
                {offerForm.targetType === 'product' && (
                  <Autocomplete
                    options={products}
                    value={products.find((product) => product.id === offerForm.targetProductId) ?? null}
                    onChange={(_, value) =>
                      setOfferForm((prev) => ({ ...prev, targetProductId: value?.id ?? '' }))
                    }
                    getOptionLabel={(option) => `${option.titleAr ?? option.title} (${option.slug})`}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    renderInput={(params) => <TextField {...params} label="اختر المنتج بالاسم" fullWidth error={Boolean(fieldErrors.targetProductId)} helperText={fieldErrors.targetProductId} />}
                  />
                )}
                {offerForm.targetType === 'category' && (
                  <Autocomplete
                    options={categories}
                    value={categories.find((category) => category.id === offerForm.targetCategoryId) ?? null}
                    onChange={(_, value) =>
                      setOfferForm((prev) => ({ ...prev, targetCategoryId: value?.id ?? '' }))
                    }
                    getOptionLabel={(option) => option.nameAr ?? option.name}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    renderInput={(params) => <TextField {...params} label="اختر التصنيف بالاسم" fullWidth error={Boolean(fieldErrors.targetCategoryId)} helperText={fieldErrors.targetCategoryId} />}
                  />
                )}
                
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3 }}>
                  <TextField select label="نوع الخصم" fullWidth value={offerForm.discountType} error={Boolean(fieldErrors.discountType)} helperText={fieldErrors.discountType} onChange={(event) => { setFieldErrors((prev) => clearFieldErrors(prev, ['discountType'])); setOfferForm((prev) => ({ ...prev, discountType: event.target.value as DiscountType })); }}>
                    <MenuItem value="percent">نسبة مئوية (%)</MenuItem>
                    <MenuItem value="fixed">مبلغ ثابت</MenuItem>
                  </TextField>
                  <TextField label="قيمة الخصم" type="number" inputProps={{ min: 0, step: 0.01 }} fullWidth value={offerForm.discountValue} error={Boolean(fieldErrors.discountValue)} helperText={fieldErrors.discountValue} onChange={(event) => { setFieldErrors((prev) => clearFieldErrors(prev, ['discountValue'])); setOfferForm((prev) => ({ ...prev, discountValue: event.target.value })); }} />
                </Box>
                
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3 }}>
                  <TextField label="تاريخ البدء" type="datetime-local" InputLabelProps={{ shrink: true }} fullWidth value={offerForm.startsAt} error={Boolean(fieldErrors.startsAt)} helperText={fieldErrors.startsAt} onChange={(event) => { setFieldErrors((prev) => clearFieldErrors(prev, ['startsAt'])); setOfferForm((prev) => ({ ...prev, startsAt: event.target.value })); }} />
                  <TextField label="تاريخ الانتهاء" type="datetime-local" InputLabelProps={{ shrink: true }} fullWidth value={offerForm.endsAt} error={Boolean(fieldErrors.endsAt)} helperText={fieldErrors.endsAt} onChange={(event) => { setFieldErrors((prev) => clearFieldErrors(prev, ['endsAt'])); setOfferForm((prev) => ({ ...prev, endsAt: event.target.value })); }} />
                </Box>

                <FormControlLabel control={<Checkbox checked={offerForm.isActive} onChange={(event) => setOfferForm((prev) => ({ ...prev, isActive: event.target.checked }))} />} label="العرض فعال" />
                <Button variant="contained" size="large" onClick={() => (selectedOfferId ? updateOffer() : createOffer()).catch(() => undefined)} disabled={actionLoading}>
                  {actionLoading ? 'جارِ الحفظ...' : 'حفظ العرض'}
                </Button>
              </Stack>
            </Box>
          )}

          {/* ADVANCED OFFER FORM */}
          {activeSection === 'advanced' && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <StarBorderIcon color="primary" />
                <Typography variant="h6" fontWeight={800}>{selectedAdvancedOfferId ? 'تعديل العرض المتقدم' : 'عرض متقدم جديد'}</Typography>
              </Box>
              <Divider sx={{ mb: 4 }} />
              
              <Stack spacing={3}>
                <TextField label="الاسم" fullWidth value={advancedOfferForm.name} error={Boolean(fieldErrors.name)} helperText={fieldErrors.name} onChange={(event) => { setFieldErrors((prev) => clearFieldErrors(prev, ['name'])); setAdvancedOfferForm((prev) => ({ ...prev, name: event.target.value })); }} />
                <TextField label="الوصف (اختياري)" fullWidth multiline minRows={2} value={advancedOfferForm.description} error={Boolean(fieldErrors.description)} helperText={fieldErrors.description} onChange={(event) => { setFieldErrors((prev) => clearFieldErrors(prev, ['description'])); setAdvancedOfferForm((prev) => ({ ...prev, description: event.target.value })); }} />
                
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3 }}>
                  <TextField select label="نوع العرض المتقدم" fullWidth value={advancedOfferForm.offerType} error={Boolean(fieldErrors.offerType)} helperText={fieldErrors.offerType} onChange={(event) => { setFieldErrors((prev) => clearFieldErrors(prev, ['offerType'])); setAdvancedOfferForm((prev) => ({ ...prev, offerType: event.target.value as AdvancedOfferType })); }}>
                    <MenuItem value="bxgy">اشتر X واحصل على Y (BXGY)</MenuItem>
                    <MenuItem value="bundle">حزمة منتجات (Bundle)</MenuItem>
                    <MenuItem value="tiered_discount">خصم تدريجي (Tiered)</MenuItem>
                  </TextField>
                  <TextField label="الأولوية (أعلى رقم يُنفذ أولاً)" type="number" fullWidth value={advancedOfferForm.priority} error={Boolean(fieldErrors.priority)} helperText={fieldErrors.priority} onChange={(event) => { setFieldErrors((prev) => clearFieldErrors(prev, ['priority'])); setAdvancedOfferForm((prev) => ({ ...prev, priority: event.target.value })); }} />
                </Box>
                
                {advancedOfferForm.offerType === 'bxgy' && (
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3 }}>
                    <TextField
                      label="كمية الشراء"
                      type="number"
                      value={advancedNumber('bxgy', 'buyQuantity', 2)}
                      onChange={(event) =>
                        updateAdvancedConfigSection('bxgy', { buyQuantity: Number(event.target.value) })
                      }
                    />
                    <TextField
                      label="كمية الحصول"
                      type="number"
                      value={advancedNumber('bxgy', 'getXQuantity', 1)}
                      onChange={(event) =>
                        updateAdvancedConfigSection('bxgy', { getXQuantity: Number(event.target.value) })
                      }
                    />
                    <Autocomplete
                      multiple
                      options={products}
                      value={products.filter((product) =>
                        advancedIdList('bxgy', 'buyProductIds').includes(product.id),
                      )}
                      onChange={(_, value) =>
                        updateAdvancedConfigSection('bxgy', { buyProductIds: value.map((product) => product.id) })
                      }
                      getOptionLabel={(option) => `${option.titleAr ?? option.title} (${option.slug})`}
                      isOptionEqualToValue={(option, value) => option.id === value.id}
                      renderInput={(params) => <TextField {...params} label="منتجات الشراء" />}
                    />
                    <Autocomplete
                      multiple
                      options={products}
                      value={products.filter((product) =>
                        advancedIdList('bxgy', 'getXProductIds').includes(product.id),
                      )}
                      onChange={(_, value) =>
                        updateAdvancedConfigSection('bxgy', { getXProductIds: value.map((product) => product.id) })
                      }
                      getOptionLabel={(option) => `${option.titleAr ?? option.title} (${option.slug})`}
                      isOptionEqualToValue={(option, value) => option.id === value.id}
                      renderInput={(params) => <TextField {...params} label="منتجات الحصول على الخصم" />}
                    />
                    <TextField
                      label="نسبة الخصم على منتجات الحصول"
                      type="number"
                      value={advancedNumber('bxgy', 'discountPercent', 100)}
                      onChange={(event) =>
                        updateAdvancedConfigSection('bxgy', { discountPercent: Number(event.target.value) })
                      }
                    />
                  </Box>
                )}

                {advancedOfferForm.offerType === 'bundle' && (
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr' }, gap: 3 }}>
                    <Autocomplete
                      multiple
                      options={products}
                      value={products.filter((product) =>
                        advancedIdList('bundle', 'productIds').includes(product.id),
                      )}
                      onChange={(_, value) =>
                        updateAdvancedConfigSection('bundle', { productIds: value.map((product) => product.id) })
                      }
                      getOptionLabel={(option) => `${option.titleAr ?? option.title} (${option.slug})`}
                      isOptionEqualToValue={(option, value) => option.id === value.id}
                      renderInput={(params) => <TextField {...params} label="منتجات الحزمة" />}
                    />
                    <TextField
                      label="قيمة الخصم"
                      type="number"
                      value={advancedNumber('bundle', 'discountValue', 10)}
                      onChange={(event) =>
                        updateAdvancedConfigSection('bundle', { discountValue: Number(event.target.value) })
                      }
                    />
                  </Box>
                )}

                <TextField 
                  label="إعدادات متقدمة اختيارية (JSON)" 
                  fullWidth 
                  multiline 
                  minRows={4} 
                  value={advancedOfferForm.config} 
                  error={Boolean(fieldErrors.config)}
                  helperText={fieldErrors.config}
                  onChange={(event) => {
                    setFieldErrors((prev) => clearFieldErrors(prev, ['config']));
                    setAdvancedOfferForm((prev) => ({ ...prev, config: event.target.value }));
                  }} 
                  dir="ltr" 
                  InputProps={{ sx: { fontFamily: 'monospace' } }} 
                />
                
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3 }}>
                  <TextField label="تاريخ البدء" type="datetime-local" InputLabelProps={{ shrink: true }} fullWidth value={advancedOfferForm.startsAt} onChange={(event) => setAdvancedOfferForm((prev) => ({ ...prev, startsAt: event.target.value }))} />
                  <TextField label="تاريخ الانتهاء" type="datetime-local" InputLabelProps={{ shrink: true }} fullWidth value={advancedOfferForm.endsAt} onChange={(event) => setAdvancedOfferForm((prev) => ({ ...prev, endsAt: event.target.value }))} />
                </Box>

                <FormControlLabel control={<Checkbox checked={advancedOfferForm.isActive} onChange={(event) => setAdvancedOfferForm((prev) => ({ ...prev, isActive: event.target.checked }))} />} label="العرض فعال" />
                <Button variant="contained" size="large" onClick={() => (selectedAdvancedOfferId ? updateAdvancedOffer() : createAdvancedOffer()).catch(() => undefined)} disabled={actionLoading}>
                  {actionLoading ? 'جارِ الحفظ...' : 'حفظ العرض'}
                </Button>
              </Stack>
            </Box>
          )}

        </Paper>
      </Box>
      <FloatingActionButton
        label={actionLoading ? 'جاري الحفظ...' : 'حفظ العرض'}
        icon={<AddIcon />}
        onClick={() => saveCurrentPromotion().catch(() => undefined)}
        disabled={actionLoading}
      />
      </>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 1, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={800} gutterBottom>
            {pageCopy.title}
          </Typography>
          <Typography color="text.secondary">
            {pageCopy.description}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button 
            variant="outlined" 
            onClick={() => loadAll().catch(() => undefined)}
            disabled={loading}
          >
            تحديث القائمة
          </Button>
          <Button 
            variant="contained" 
            color="primary" 
            startIcon={<AddIcon />} 
            onClick={handleCreateNew}
            size="large"
            sx={{ borderRadius: 2 }}
          >
            {pageCopy.createLabel}
          </Button>
        </Stack>
      </Box>

      {message.text && (
        <Alert severity={message.type} sx={{ borderRadius: 2 }}>{message.text}</Alert>
      )}

      <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: 'background.default' }}>
              {activeSection === 'coupons' && (
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>الكود</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>الخصم</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>عدد الاستخدامات</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>الحالة</TableCell>
                  <TableCell align="left" sx={{ fontWeight: 700 }}>إجراءات</TableCell>
                </TableRow>
              )}
              {activeSection === 'offers' && (
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>اسم العرض</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>الهدف</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>الخصم</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>الحالة</TableCell>
                  <TableCell align="left" sx={{ fontWeight: 700 }}>إجراءات</TableCell>
                </TableRow>
              )}
              {activeSection === 'advanced' && (
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>الاسم</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>النوع</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>الأولوية</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>الحالة</TableCell>
                  <TableCell align="left" sx={{ fontWeight: 700 }}>إجراءات</TableCell>
                </TableRow>
              )}
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 6 }}><CircularProgress /></TableCell></TableRow>
              ) : activeSection === 'coupons' ? (
                coupons.length === 0 ? (
                  <TableRow><TableCell colSpan={5} align="center" sx={{ py: 6 }}><Typography color="text.secondary">لا توجد كوبونات.</Typography></TableCell></TableRow>
                ) : (
                  coupons.map((coupon) => (
                    <TableRow key={coupon.id} hover>
                      <TableCell><Typography fontWeight={700} fontFamily="monospace" dir="ltr" display="inline">{coupon.code}</Typography></TableCell>
                      <TableCell>{coupon.discountType === 'percent' ? `%${coupon.discountValue}` : `${coupon.discountValue} ثابت`}</TableCell>
                      <TableCell>{coupon.usedCount} {coupon.maxUses ? `/ ${coupon.maxUses}` : ''}</TableCell>
                      <TableCell><Chip size="small" label={coupon.isActive ? 'فعال' : 'غير فعال'} color={coupon.isActive ? 'success' : 'default'} /></TableCell>
                      <TableCell align="left">
                        <Button size="small" variant="outlined" startIcon={<EditNoteIcon />} onClick={() => selectCoupon(coupon)}>تعديل</Button>
                      </TableCell>
                    </TableRow>
                  ))
                )
              ) : activeSection === 'offers' ? (
                offers.length === 0 ? (
                  <TableRow><TableCell colSpan={5} align="center" sx={{ py: 6 }}><Typography color="text.secondary">لا توجد عروض تلقائية.</Typography></TableCell></TableRow>
                ) : (
                  offers.map((offer) => (
                    <TableRow key={offer.id} hover>
                      <TableCell><Typography fontWeight={700}>{offer.name}</Typography></TableCell>
                      <TableCell>{offer.targetType}</TableCell>
                      <TableCell>{offer.discountType === 'percent' ? `%${offer.discountValue}` : `${offer.discountValue} ثابت`}</TableCell>
                      <TableCell><Chip size="small" label={offer.isActive ? 'فعال' : 'غير فعال'} color={offer.isActive ? 'success' : 'default'} /></TableCell>
                      <TableCell align="left">
                        <Button size="small" variant="outlined" startIcon={<EditNoteIcon />} onClick={() => selectOffer(offer)}>تعديل</Button>
                      </TableCell>
                    </TableRow>
                  ))
                )
              ) : (
                advancedOffers.length === 0 ? (
                  <TableRow><TableCell colSpan={5} align="center" sx={{ py: 6 }}><Typography color="text.secondary">لا توجد عروض متقدمة.</Typography></TableCell></TableRow>
                ) : (
                  advancedOffers.map((offer) => (
                    <TableRow key={offer.id} hover>
                      <TableCell><Typography fontWeight={700}>{offer.name}</Typography></TableCell>
                      <TableCell><Chip size="small" variant="outlined" label={offer.offerType} /></TableCell>
                      <TableCell>{offer.priority}</TableCell>
                      <TableCell><Chip size="small" label={offer.isActive ? 'فعال' : 'غير فعال'} color={offer.isActive ? 'success' : 'default'} /></TableCell>
                      <TableCell align="left">
                        <Button size="small" variant="outlined" startIcon={<EditNoteIcon />} onClick={() => selectAdvancedOffer(offer)}>تعديل</Button>
                      </TableCell>
                    </TableRow>
                  ))
                )
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      <FloatingActionButton
        label={pageCopy.createLabel}
        icon={<AddIcon />}
        onClick={handleCreateNew}
        disabled={loading || actionLoading}
      />
    </Box>
  );
}

function buildCouponCreatePayload(form: typeof couponFormDefault) {
  const payload: {
    code: string;
    discountType: DiscountType;
    discountValue: number;
    minOrderAmount: number;
    isFreeShipping: boolean;
    startsAt?: string;
    endsAt?: string;
    maxUses?: number;
  } = {
    code: form.code.trim().toUpperCase(),
    discountType: form.discountType,
    discountValue: Number(form.discountValue || '0'),
    minOrderAmount: Number(form.minOrderAmount || '0'),
    isFreeShipping: form.isFreeShipping,
  };

  if (form.startsAt) {
    payload.startsAt = toIso(form.startsAt);
  }
  if (form.endsAt) {
    payload.endsAt = toIso(form.endsAt);
  }
  if (form.maxUses.trim()) {
    payload.maxUses = Number(form.maxUses);
  }

  return payload;
}

function mapCouponFieldErrors(fieldErrors: Record<string, string[]>): Record<string, string> {
  return mapFieldErrors(fieldErrors, {
    code: ['code'],
    discountType: ['discountType'],
    discountValue: ['discountValue'],
    minOrderAmount: ['minOrderAmount'],
    startsAt: ['startsAt'],
    endsAt: ['endsAt'],
    maxUses: ['maxUses'],
  });
}

function mapOfferFieldErrors(fieldErrors: Record<string, string[]>): Record<string, string> {
  return mapFieldErrors(fieldErrors, {
    name: ['name'],
    targetType: ['targetType'],
    targetProductId: ['targetProductId'],
    targetCategoryId: ['targetCategoryId'],
    discountType: ['discountType'],
    discountValue: ['discountValue'],
    startsAt: ['startsAt'],
    endsAt: ['endsAt'],
  });
}

function mapAdvancedOfferFieldErrors(fieldErrors: Record<string, string[]>): Record<string, string> {
  return mapFieldErrors(fieldErrors, {
    name: ['name'],
    description: ['description'],
    offerType: ['offerType'],
    config: ['config'],
    priority: ['priority'],
    startsAt: ['startsAt'],
    endsAt: ['endsAt'],
  });
}

function buildCouponUpdatePayload(form: typeof couponFormDefault) {
  const payload = buildCouponCreatePayload(form) as ReturnType<typeof buildCouponCreatePayload> & {
    isActive: boolean;
  };
  payload.isActive = form.isActive;
  return payload;
}

function buildOfferCreatePayload(form: typeof offerFormDefault) {
  const payload: {
    name: string;
    targetType: OfferTargetType;
    targetProductId?: string;
    targetCategoryId?: string;
    discountType: DiscountType;
    discountValue: number;
    startsAt?: string;
    endsAt?: string;
  } = {
    name: form.name.trim(),
    targetType: form.targetType,
    discountType: form.discountType,
    discountValue: Number(form.discountValue || '0'),
  };

  const targetProductId = form.targetProductId.trim();
  const targetCategoryId = form.targetCategoryId.trim();

  if (targetProductId) {
    payload.targetProductId = targetProductId;
  }
  if (targetCategoryId) {
    payload.targetCategoryId = targetCategoryId;
  }
  if (form.startsAt) {
    payload.startsAt = toIso(form.startsAt);
  }
  if (form.endsAt) {
    payload.endsAt = toIso(form.endsAt);
  }

  return payload;
}

function buildOfferUpdatePayload(form: typeof offerFormDefault) {
  const payload = buildOfferCreatePayload(form) as ReturnType<typeof buildOfferCreatePayload> & {
    isActive: boolean;
  };
  payload.isActive = form.isActive;
  return payload;
}

function buildAdvancedOfferCreatePayload(form: typeof advancedOfferFormDefault) {
  const payload: {
    name: string;
    description?: string;
    offerType: AdvancedOfferType;
    config: Record<string, unknown>;
    startsAt?: string;
    endsAt?: string;
    isActive: boolean;
    priority: number;
  } = {
    name: form.name.trim(),
    offerType: form.offerType,
    config: parseJsonConfig(form.config),
    isActive: form.isActive,
    priority: Number(form.priority || '0'),
  };

  if (form.description.trim()) {
    payload.description = form.description.trim();
  }
  if (form.startsAt) {
    payload.startsAt = toIso(form.startsAt);
  }
  if (form.endsAt) {
    payload.endsAt = toIso(form.endsAt);
  }

  return payload;
}

function buildAdvancedOfferUpdatePayload(form: typeof advancedOfferFormDefault) {
  return buildAdvancedOfferCreatePayload(form);
}

function parseJsonConfig(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

function toIso(localDateTime: string): string {
  return new Date(localDateTime).toISOString();
}

