import {
  AddIcon,
  DeleteOutlineIcon,
  FacebookIcon,
  InstagramIcon,
  LanguageIcon,
  LinkIcon,
  LocationOnIcon,
  SaveIcon,
  ScheduleIcon,
  SearchIcon,
  SettingsBackupRestoreIcon,
  SettingsIcon,
  SnapchatIcon,
  TelegramIcon,
  TikTokIcon,
  TimeIcon,
  TwitterIcon,
  UploadFileIcon,
  WhatsAppIcon,
  YouTubeIcon,
} from '../../../../components/icons';
import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { MerchantRequester } from '../../merchant-dashboard.types';
import type { MediaAsset, PresignedMediaUpload, StoreCurrency, StoreSettings, StoreSettingsOptions } from '../../types';
import { AppPage, FormSection, EcommerceCoreLoader, PageHeader } from '../../components/ui';
import { MAP_TILE_ATTRIBUTION, MAP_TILE_SUBDOMAINS, MAP_TILE_URL, searchYemenLocations } from '../../../../lib/map-config';
import { firstFieldError, isApiError, type ApiFieldErrors } from '../../../../lib/api-error';
import { normalizeSlug, sanitizeSlugInput } from '../../utils/slug';

interface StoreSettingsPanelProps {
  request: MerchantRequester;
  onSettingsUpdated?: (settings: StoreSettings) => void;
}

interface WorkingHoursSlotForm {
  id: string;
  open: string;
  close: string;
}

interface WorkingHoursDayForm {
  day: string;
  isClosed: boolean;
  slots: WorkingHoursSlotForm[];
}

type SocialLinksForm = Record<string, string>;

interface StoreSettingsForm {
  name: string;
  nameAr: string;
  nameEn: string;
  slug: string;
  descriptionAr: string;
  descriptionEn: string;
  businessCategory: string;
  currencyCode: string;
  timezone: string;
  logoMediaAssetId: string | null;
  logoUrl: string | null;
  phone: string;
  country: string;
  city: string;
  addressDetails: string;
  latitude: string;
  longitude: string;
  workingHours: WorkingHoursDayForm[];
  socialLinks: SocialLinksForm;
  shippingPolicy: string;
  returnPolicy: string;
  privacyPolicy: string;
  termsAndConditions: string;
}

interface CurrencyFormRow {
  currencyCode: string;
  yerPerUnit: string;
  decimalDigits: string;
  roundingIncrement: string;
  isDefault: boolean;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

const DEFAULT_OPTIONS: StoreSettingsOptions = {
  defaultCountry: 'اليمن',
  currencies: ['YER', 'SAR', 'USD'],
  timezones: ['Asia/Aden'],
  governorates: [],
  workingDays: ['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  socialPlatforms: ['instagram', 'facebook', 'x', 'tiktok', 'snapchat', 'whatsapp', 'telegram', 'youtube', 'website'],
  businessCategories: ['beauty', 'fashion', 'abayas', 'electronics', 'books_stationery', 'kids_toys', 'furniture_decor', 'health_wellness', 'other'],
};

const DAY_LABELS: Record<string, string> = {
  saturday: 'السبت',
  sunday: 'الأحد',
  monday: 'الاثنين',
  tuesday: 'الثلاثاء',
  wednesday: 'الأربعاء',
  thursday: 'الخميس',
  friday: 'الجمعة',
};

const BUSINESS_CATEGORY_LABELS: Record<string, string> = {
  beauty: 'الجمال والعناية',
  fashion: 'الأزياء',
  abayas: 'العبايات',
  electronics: 'الإلكترونيات',
  books_stationery: 'الكتب والقرطاسية',
  kids_toys: 'الأطفال والألعاب',
  furniture_decor: 'الأثاث والديكور',
  health_wellness: 'الصحة والعافية',
  other: 'أخرى',
};

const SOCIAL_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  x: 'X',
  tiktok: 'TikTok',
  snapchat: 'Snapchat',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  youtube: 'YouTube',
  website: 'Website',
};

const SOCIAL_ICONS = {
  instagram: InstagramIcon,
  facebook: FacebookIcon,
  x: TwitterIcon,
  tiktok: TikTokIcon,
  snapchat: SnapchatIcon,
  whatsapp: WhatsAppIcon,
  telegram: TelegramIcon,
  youtube: YouTubeIcon,
  website: LanguageIcon,
};

const DEFAULT_COUNTRY_NAME = 'اليمن';
const DAMAGED_TEXT_PATTERN = /[\uFFFDØÙ]/;
const SANA_A_CENTER: [number, number] = [15.3694, 44.191];
const policyFieldSx = {
  '& .MuiInputBase-root': {
    alignItems: 'flex-start',
  },
  '& textarea': {
    overflow: 'auto !important',
    lineHeight: 1.8,
  },
};

export function StoreSettingsPanel({ request, onSettingsUpdated }: StoreSettingsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [options, setOptions] = useState<StoreSettingsOptions>(DEFAULT_OPTIONS);
  const [form, setForm] = useState<StoreSettingsForm>(createInitialForm(DEFAULT_OPTIONS));
  const [currencyRows, setCurrencyRows] = useState<CurrencyFormRow[]>([createBaseCurrencyRow(true)]);
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: 'info' as 'info' | 'success' | 'error' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [mapDialogOpen, setMapDialogOpen] = useState(false);
  const [mapSearch, setMapSearch] = useState('');
  const [mapSearching, setMapSearching] = useState(false);
  const [mapResults, setMapResults] = useState<NominatimResult[]>([]);
  const [mapPoint, setMapPoint] = useState<[number, number] | null>(SANA_A_CENTER);

  const composedAddress = useMemo(
    () => composeAddress(form.country, form.city, form.addressDetails),
    [form.country, form.city, form.addressDetails],
  );

  useEffect(() => {
    loadSettings().catch(() => undefined);
  }, []);

  async function loadSettings(): Promise<void> {
    setLoading(true);
    setMessage({ text: '', type: 'info' });

    try {
      const [settingsData, optionsData, currenciesData] = await Promise.all([
        request<StoreSettings>('/store/settings', { method: 'GET' }),
        request<StoreSettingsOptions>('/store/settings/options', { method: 'GET' }),
        request<{ currencies: StoreCurrency[] }>('/store/currencies', { method: 'GET' }),
      ]);

      if (!settingsData) {
        return;
      }

      const resolvedOptions = normalizeSettingsOptions(optionsData ?? DEFAULT_OPTIONS);
      setOptions(resolvedOptions);
      setForm(toFormState(settingsData, resolvedOptions));
      setCurrencyRows(toCurrencyRows(currenciesData?.currencies ?? settingsData.currencies ?? []));
      const settingsPoint = toMapPoint(settingsData.latitude, settingsData.longitude);
      if (settingsPoint) {
        setMapPoint(settingsPoint);
      }
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'تعذر تحميل إعدادات المتجر',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings(): Promise<void> {
    setFieldErrors({});
    const validationError = validateForm(form, options.socialPlatforms);
    if (validationError) {
      setMessage({ text: validationError, type: 'error' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSaveLoading(true);
    setMessage({ text: '', type: 'info' });

    try {
      const updatedSettings = await request<StoreSettings>('/store/settings', {
        method: 'PUT',
        body: JSON.stringify(buildPayload(form, composedAddress)),
      });
      await request('/store/currencies', {
        method: 'PUT',
        body: JSON.stringify({ currencies: buildCurrencyPayload(currencyRows) }),
      });
      if (updatedSettings) {
        onSettingsUpdated?.(updatedSettings);
      }
      setMessage({ text: 'تم تحديث إعدادات المتجر بنجاح', type: 'success' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      if (isApiError(error)) {
        setFieldErrors(mapStoreSettingsFieldErrors(error.fieldErrors));
      }
      setMessage({ text: error instanceof Error ? error.message : 'تعذر تحديث الإعدادات', type: 'error' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaveLoading(false);
    }
  }

  async function handleLogoFileChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    setUploadLoading(true);
    setMessage({ text: '', type: 'info' });

    try {
      const asset = await uploadMediaAsset(request, file);
      setForm((prev) => ({
        ...prev,
        logoMediaAssetId: asset.id,
        logoUrl: asset.url,
      }));
      setMessage({ text: 'تم رفع الشعار بنجاح', type: 'success' });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'تعذر رفع الشعار', type: 'error' });
    } finally {
      setUploadLoading(false);
    }
  }

  function clearLogo(): void {
    setForm((prev) => ({
      ...prev,
      logoMediaAssetId: null,
      logoUrl: null,
    }));
  }

  function openMapDialog(): void {
    const lat = Number(form.latitude);
    const lng = Number(form.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      setMapPoint([lat, lng]);
    } else {
      setMapPoint(SANA_A_CENTER);
    }
    setMapSearch((current) => current || 'صنعاء');
    setMapDialogOpen(true);
  }

  function useSanaaLocation(): void {
    setMapPoint(SANA_A_CENTER);
    setForm((prev) => ({
      ...prev,
      city: prev.city || 'أمانة العاصمة',
      latitude: formatCoordinate(SANA_A_CENTER[0]),
      longitude: formatCoordinate(SANA_A_CENTER[1]),
    }));
  }

  function applyMapPoint(): void {
    if (!mapPoint) {
      return;
    }

    setForm((prev) => ({
      ...prev,
      latitude: formatCoordinate(mapPoint[0]),
      longitude: formatCoordinate(mapPoint[1]),
    }));
    setMapDialogOpen(false);
  }

  function updateCurrencyRow(index: number, patch: Partial<CurrencyFormRow>): void {
    setCurrencyRows((prev) => {
      const next = prev.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row));
      return next.map((row) => row.currencyCode === 'YER' ? createBaseCurrencyRow(row.isDefault) : row);
    });
  }

  async function searchOnMap(): Promise<void> {
    const query = mapSearch.trim();
    if (!query) {
      return;
    }

    setMapSearching(true);
    try {
      const items = searchYemenLocations(query) as NominatimResult[];
      setMapResults(items);
      if (items.length > 0) {
        const first = items[0];
        if (first) {
          const point = toMapPoint(first.lat, first.lon);
          if (point) {
            setMapPoint(point);
          }
        }
      } else {
        setMessage({ text: 'لم يتم العثور على نتيجة محلية. يمكنك تحديد الموقع بالضغط على الخريطة مباشرة.', type: 'info' });
      }
    } catch {
      setMapResults([]);
      setMessage({ text: 'تعذر البحث في الخريطة حالياً', type: 'error' });
    } finally {
      setMapSearching(false);
    }
  }

  function setDayOpen(day: string, isOpen: boolean): void {
    setForm((prev) => ({
      ...prev,
      workingHours: prev.workingHours.map((item) =>
        item.day === day
          ? {
              ...item,
              isClosed: !isOpen,
              slots: isOpen ? (item.slots.length > 0 ? item.slots : [createSlot()]) : [],
            }
          : item,
      ),
    }));
  }

  function addWorkingHourSlot(day: string): void {
    setForm((prev) => ({
      ...prev,
      workingHours: prev.workingHours.map((item) =>
        item.day === day ? { ...item, slots: [...item.slots, createSlot()] } : item,
      ),
    }));
  }

  function updateWorkingHourSlot(day: string, slotId: string, field: 'open' | 'close', value: string): void {
    setForm((prev) => ({
      ...prev,
      workingHours: prev.workingHours.map((item) =>
        item.day === day
          ? {
              ...item,
              slots: item.slots.map((slot) => (slot.id === slotId ? { ...slot, [field]: value } : slot)),
            }
          : item,
      ),
    }));
  }

  function removeWorkingHourSlot(day: string, slotId: string): void {
    setForm((prev) => ({
      ...prev,
      workingHours: prev.workingHours.map((item) =>
        item.day === day ? { ...item, slots: item.slots.filter((slot) => slot.id !== slotId) } : item,
      ),
    }));
  }

  if (loading) {
    return (
      <AppPage maxWidth={980}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 320 }}>
          <EcommerceCoreLoader size="lg" label="جاري تحميل إعدادات المتجر..." />
        </Box>
      </AppPage>
    );
  }

  return (
    <AppPage maxWidth={1120}>
      <PageHeader
        title="إعدادات المتجر"
        description="إدارة بيانات المتجر الأساسية والعنوان وساعات العمل وروابط التواصل والسياسات."
        badgeIcon={<SettingsIcon fontSize="small" />}
        badgeLabel={null}
        sticky
        stickyTop={{ xs: 76, md: 92 }}
        actions={(
          <>
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<SettingsBackupRestoreIcon />}
              onClick={() => loadSettings().catch(() => undefined)}
              disabled={saveLoading || uploadLoading}
            >
              إعادة التحميل
            </Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={<SaveIcon />}
              onClick={() => saveSettings().catch(() => undefined)}
              disabled={saveLoading || uploadLoading}
            >
              {saveLoading ? 'جاري الحفظ...' : 'حفظ التغييرات'}
            </Button>
          </>
        )}
      />

      {message.text ? <Alert severity={message.type}>{message.text}</Alert> : null}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
          gap: 1.5,
        }}
      >
        <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
          <Typography variant="caption" color="text.secondary">المتجر</Typography>
          <Typography fontWeight={700}>{form.nameAr || form.name || 'لم يتم إدخال اسم المتجر'}</Typography>
          {form.nameEn ? (
            <Typography variant="caption" color="text.secondary" dir="ltr">{form.nameEn}</Typography>
          ) : null}
        </Box>
        <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
          <Typography variant="caption" color="text.secondary">فئة النشاط</Typography>
          <Typography fontWeight={700}>{(BUSINESS_CATEGORY_LABELS[form.businessCategory] ?? form.businessCategory) || 'لم يتم التحديد'}</Typography>
        </Box>
        <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
          <Typography variant="caption" color="text.secondary">العنوان</Typography>
          <Typography fontWeight={700}>{composedAddress || 'أكمل بيانات العنوان'}</Typography>
        </Box>
      </Box>

      <FormSection title="المعلومات الأساسية" description="اسم المتجر، شعاره، العملة والمنطقة الزمنية.">
        <Stack spacing={3}>
          <TextField
            label="اسم المتجر بالعربي"
            value={form.nameAr}
            error={Boolean(fieldErrors.nameAr || fieldErrors.name)}
            helperText={fieldErrors.nameAr || fieldErrors.name}
            onChange={(event) => {
              const value = event.target.value;
              setFieldErrors((prev) => clearFieldErrors(prev, ['nameAr', 'name']));
              setForm((prev) => ({
                ...prev,
                nameAr: value,
                name: value,
              }));
            }}
            required
          />

          <TextField
            label="اسم المتجر بالإنجليزي (Store Name EN)"
            value={form.nameEn}
            error={Boolean(fieldErrors.nameEn)}
            helperText={fieldErrors.nameEn}
            onChange={(event) => {
              setFieldErrors((prev) => clearFieldErrors(prev, ['nameEn']));
              setForm((prev) => ({ ...prev, nameEn: event.target.value }));
            }}
            dir="ltr"
            placeholder="Store Name in English"
          />

          <TextField
            select
            fullWidth
            label="فئة النشاط التجاري"
            value={form.businessCategory}
            onChange={(event) => setForm((prev) => ({ ...prev, businessCategory: event.target.value }))}
          >
            <MenuItem value="">اختر فئة النشاط</MenuItem>
            {options.businessCategories.map((cat) => (
              <MenuItem key={cat} value={cat}>{BUSINESS_CATEGORY_LABELS[cat] ?? cat}</MenuItem>
            ))}
          </TextField>

          <TextField
            label="وصف المتجر بالعربي"
            multiline
            minRows={3}
            maxRows={6}
            value={form.descriptionAr}
            onChange={(event) => setForm((prev) => ({ ...prev, descriptionAr: event.target.value }))}
            placeholder="وصف مختصر عن المتجر ونشاطه..."
          />

          <TextField
            label="وصف المتجر بالإنجليزي"
            multiline
            minRows={3}
            maxRows={6}
            value={form.descriptionEn}
            onChange={(event) => setForm((prev) => ({ ...prev, descriptionEn: event.target.value }))}
            dir="ltr"
            placeholder="Store description in English..."
          />

          <TextField
            label="رابط المتجر (Slug)"
            value={form.slug}
            error={Boolean(fieldErrors.slug)}
            onChange={(event) => {
              setFieldErrors((prev) => clearFieldErrors(prev, ['slug']));
              setForm((prev) => ({ ...prev, slug: sanitizeSlugInput(event.target.value) }));
            }}
            onBlur={() => setForm((prev) => ({ ...prev, slug: normalizeSlug(prev.slug) }))}
            dir="ltr"
            helperText={fieldErrors.slug || 'يسمح بالحروف الإنجليزية الصغيرة والأرقام والشرطة فقط.'}
          />

          <Stack spacing={1}>
            <Typography variant="subtitle2">شعار المتجر</Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
              <Box
                sx={{
                  width: 120,
                  height: 120,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  bgcolor: 'background.paper',
                }}
              >
                {form.logoUrl ? (
                  <Box component="img" src={form.logoUrl} alt="Store logo" sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <Typography variant="caption" color="text.secondary">بدون شعار</Typography>
                )}
              </Box>

              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  startIcon={<UploadFileIcon />}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadLoading || saveLoading}
                >
                  {uploadLoading ? 'جاري الرفع...' : form.logoUrl ? 'استبدال الشعار' : 'رفع الشعار'}
                </Button>
                <Button
                  variant="text"
                  color="error"
                  startIcon={<DeleteOutlineIcon />}
                  onClick={clearLogo}
                  disabled={!form.logoUrl || uploadLoading || saveLoading}
                >
                  حذف
                </Button>
              </Stack>
            </Stack>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              style={{ display: 'none' }}
              onChange={(event) => {
                handleLogoFileChange(event).catch(() => undefined);
              }}
            />
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              select
              fullWidth
              label="العملة"
              value={form.currencyCode}
              onChange={(event) => {
                const nextCurrency = event.target.value;
                setForm((prev) => ({ ...prev, currencyCode: nextCurrency }));
                setCurrencyRows((prev) => setDefaultCurrency(prev, nextCurrency));
              }}
            >
              {currencyRows.map((currency) => (
                <MenuItem key={currency.currencyCode} value={currency.currencyCode}>{currency.currencyCode}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              fullWidth
              label="المنطقة الزمنية"
              value={form.timezone}
              onChange={(event) => setForm((prev) => ({ ...prev, timezone: event.target.value }))}
              dir="ltr"
            >
              {options.timezones.map((timezone) => (
                <MenuItem key={timezone} value={timezone}>{timezone}</MenuItem>
              ))}
            </TextField>
          </Stack>
        </Stack>
      </FormSection>

      <FormSection title="العنوان الجغرافي" description="الدولة، المدينة، العنوان التفصيلي والإحداثيات مع اختيار مباشر من الخريطة.">
        <Stack spacing={2}>
          <TextField
            label="الدولة"
            value={form.country}
            disabled
            helperText="المتاجر مهيأة حالياً للعمل داخل اليمن."
          />
          <TextField
            select
            label="المدينة (المحافظة)"
            value={form.city}
            onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
          >
            <MenuItem value="">اختر المحافظة</MenuItem>
            {options.governorates.map((governorate) => (
              <MenuItem key={governorate} value={governorate}>{governorate}</MenuItem>
            ))}
          </TextField>
          <TextField
            label="العنوان التفصيلي"
            multiline
            rows={2}
            value={form.addressDetails}
            onChange={(event) => setForm((prev) => ({ ...prev, addressDetails: event.target.value }))}
          />

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              label="Latitude"
              value={form.latitude}
              onChange={(event) => setForm((prev) => ({ ...prev, latitude: event.target.value }))}
              dir="ltr"
            />
            <TextField
              label="Longitude"
              value={form.longitude}
              onChange={(event) => setForm((prev) => ({ ...prev, longitude: event.target.value }))}
              dir="ltr"
            />
          </Stack>

          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<LocationOnIcon />} onClick={openMapDialog}>
              اختيار من الخريطة
            </Button>
            <Button variant="text" onClick={useSanaaLocation}>
              تعيين صنعاء كموقع افتراضي
            </Button>
          </Stack>

          <TextField
            label="العنوان الكامل"
            value={composedAddress}
            helperText="يتم توليده تلقائياً من الدولة والمحافظة والعنوان التفصيلي عند الحفظ."
            InputProps={{ readOnly: true }}
          />
        </Stack>
      </FormSection>

      <FormSection title="ساعات العمل" description="تحديد أيام العمل مع إمكانية تعدد الفترات في اليوم الواحد.">
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
            gap: 2,
          }}
        >
          {form.workingHours.map((dayRow) => {
            const dayIsOpen = !dayRow.isClosed;
            const summary = dayIsOpen && dayRow.slots.length > 0
              ? dayRow.slots.map((slot) => `${slot.open} - ${slot.close}`).join('، ')
              : 'لا توجد فترات نشطة';

            return (
              <Box
                key={dayRow.day}
                sx={{
                  p: 2,
                  border: '1px solid',
                  borderColor: (theme) =>
                    dayIsOpen ? alpha(theme.palette.primary.main, 0.28) : theme.palette.divider,
                  borderRadius: 2,
                  bgcolor: (theme) =>
                    dayIsOpen ? alpha(theme.palette.primary.main, 0.045) : 'background.paper',
                  boxShadow: (theme) =>
                    dayIsOpen ? `0 14px 32px ${alpha(theme.palette.primary.main, 0.08)}` : 'none',
                }}
              >
                <Stack spacing={2}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
                      <Box
                        sx={{
                          width: 42,
                          height: 42,
                          borderRadius: 2,
                          display: 'grid',
                          placeItems: 'center',
                          color: dayIsOpen ? 'primary.main' : 'text.secondary',
                          bgcolor: (theme) =>
                            dayIsOpen
                              ? alpha(theme.palette.primary.main, 0.12)
                              : alpha(theme.palette.text.secondary, 0.08),
                        }}
                      >
                        <ScheduleIcon />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography fontWeight={800}>{DAY_LABELS[dayRow.day] ?? dayRow.day}</Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {summary}
                        </Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip
                        size="small"
                        label={dayIsOpen ? 'مفتوح' : 'مغلق'}
                        color={dayIsOpen ? 'success' : 'default'}
                        variant={dayIsOpen ? 'filled' : 'outlined'}
                        sx={{ fontWeight: 800 }}
                      />
                      <FormControlLabel
                        sx={{ m: 0 }}
                        control={(
                          <Switch
                            checked={dayIsOpen}
                            onChange={(event) => setDayOpen(dayRow.day, event.target.checked)}
                          />
                        )}
                        label=""
                      />
                    </Stack>
                  </Stack>

                  {dayIsOpen ? (
                    <Stack spacing={1.25}>
                      {dayRow.slots.map((slot, index) => (
                        <Box
                          key={slot.id}
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr auto' },
                            gap: 1,
                            alignItems: 'center',
                            p: 1.25,
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 2,
                            bgcolor: 'background.paper',
                          }}
                        >
                          <TextField
                            label={`بداية الفترة ${index + 1}`}
                            type="time"
                            value={slot.open}
                            onChange={(event) => updateWorkingHourSlot(dayRow.day, slot.id, 'open', event.target.value)}
                            InputLabelProps={{ shrink: true }}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <TimeIcon fontSize="small" />
                                </InputAdornment>
                              ),
                            }}
                          />
                          <TextField
                            label={`نهاية الفترة ${index + 1}`}
                            type="time"
                            value={slot.close}
                            onChange={(event) => updateWorkingHourSlot(dayRow.day, slot.id, 'close', event.target.value)}
                            InputLabelProps={{ shrink: true }}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <TimeIcon fontSize="small" />
                                </InputAdornment>
                              ),
                            }}
                          />
                          <IconButton
                            color="error"
                            onClick={() => removeWorkingHourSlot(dayRow.day, slot.id)}
                            aria-label="حذف فترة العمل"
                            sx={{
                              justifySelf: { xs: 'flex-end', sm: 'center' },
                              border: '1px solid',
                              borderColor: 'divider',
                            }}
                          >
                            <DeleteOutlineIcon />
                          </IconButton>
                        </Box>
                      ))}

                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<AddIcon />}
                        onClick={() => addWorkingHourSlot(dayRow.day)}
                        sx={{ alignSelf: 'flex-start', fontWeight: 800 }}
                      >
                        إضافة فترة عمل
                      </Button>
                    </Stack>
                  ) : (
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        color: 'text.secondary',
                        bgcolor: (theme) => alpha(theme.palette.text.secondary, 0.06),
                      }}
                    >
                      <Typography variant="body2">هذا اليوم مغلق، فعّل اليوم لإضافة ساعات العمل.</Typography>
                    </Box>
                  )}
                </Stack>
              </Box>
            );
          })}
        </Box>
      </FormSection>

      <FormSection title="روابط التواصل" description="روابط المنصات الاجتماعية والموقع الرسمي.">
        <Stack spacing={2}>
          <TextField
            label="رقم الهاتف"
            value={form.phone}
            onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
            dir="ltr"
          />

          <Divider />

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
              gap: 2,
            }}
          >
            {options.socialPlatforms.map((platform) => (
              <TextField
                key={platform}
                label={SOCIAL_LABELS[platform] ?? platform}
                value={form.socialLinks[platform] ?? ''}
                onChange={(event) => {
                  const value = event.target.value;
                  setForm((prev) => ({
                    ...prev,
                    socialLinks: {
                      ...prev.socialLinks,
                      [platform]: value,
                    },
                  }));
                }}
                placeholder="https://"
                dir="ltr"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      {renderSocialPlatformIcon(platform)}
                    </InputAdornment>
                  ),
                }}
              />
            ))}
          </Box>
        </Stack>
      </FormSection>

      <FormSection title="السياسات والأحكام" description="سياسات الشحن والاسترجاع والخصوصية والشروط العامة.">
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
            gap: 2.5,
          }}
        >
          <TextField
            label="سياسة الشحن"
            multiline
            minRows={8}
            maxRows={14}
            value={form.shippingPolicy}
            onChange={(event) => setForm((prev) => ({ ...prev, shippingPolicy: event.target.value }))}
            sx={policyFieldSx}
          />
          <TextField
            label="سياسة الاسترجاع"
            multiline
            minRows={8}
            maxRows={14}
            value={form.returnPolicy}
            onChange={(event) => setForm((prev) => ({ ...prev, returnPolicy: event.target.value }))}
            sx={policyFieldSx}
          />
          <TextField
            label="سياسة الخصوصية"
            multiline
            minRows={8}
            maxRows={14}
            value={form.privacyPolicy}
            onChange={(event) => setForm((prev) => ({ ...prev, privacyPolicy: event.target.value }))}
            sx={policyFieldSx}
          />
          <TextField
            label="الشروط والأحكام"
            multiline
            minRows={8}
            maxRows={14}
            value={form.termsAndConditions}
            onChange={(event) => setForm((prev) => ({ ...prev, termsAndConditions: event.target.value }))}
            sx={policyFieldSx}
          />
        </Box>
      </FormSection>

      <FormSection title="العملات والمصارفة" description="الريال اليمني هو عملة التسعير الأساسية. أضف عملات أخرى للعرض والطلب.">
        <Stack spacing={2}>
          {currencyRows.map((row, index) => (
            <Box
              key={`${row.currencyCode}-${index}`}
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 0.8fr 0.8fr auto auto' },
                gap: 1.5,
                alignItems: 'center',
              }}
            >
              <TextField select label="العملة" value={row.currencyCode} disabled={row.currencyCode === 'YER'} onChange={(event) => updateCurrencyRow(index, { currencyCode: event.target.value })}>
                {options.currencies.map((currency) => (
                  <MenuItem key={currency} value={currency}>{currency}</MenuItem>
                ))}
              </TextField>
              <TextField label="YER لكل 1" type="number" value={row.yerPerUnit} disabled={row.currencyCode === 'YER'} inputProps={{ min: 0.000001, step: 0.000001 }} onChange={(event) => updateCurrencyRow(index, { yerPerUnit: event.target.value })} />
              <TextField label="الكسور" type="number" value={row.decimalDigits} disabled={row.currencyCode === 'YER'} inputProps={{ min: 0, max: 4, step: 1 }} onChange={(event) => updateCurrencyRow(index, { decimalDigits: event.target.value })} />
              <TextField label="التقريب" type="number" value={row.roundingIncrement} disabled={row.currencyCode === 'YER'} inputProps={{ min: 0.0001, step: 0.01 }} onChange={(event) => updateCurrencyRow(index, { roundingIncrement: event.target.value })} />
              <Button
                variant={row.isDefault ? 'contained' : 'outlined'}
                onClick={() => {
                  setCurrencyRows((prev) => setDefaultCurrency(prev, row.currencyCode));
                  setForm((prev) => ({ ...prev, currencyCode: row.currencyCode }));
                }}
              >
                افتراضية
              </Button>
              <IconButton aria-label="Remove currency" disabled={row.currencyCode === 'YER'} onClick={() => setCurrencyRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index))}>
                <DeleteOutlineIcon />
              </IconButton>
            </Box>
          ))}
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setCurrencyRows((prev) => [...prev, createNextCurrencyRow(options.currencies, prev)])} sx={{ alignSelf: 'flex-start', fontWeight: 800 }}>
            إضافة عملة
          </Button>
        </Stack>
      </FormSection>

      <Dialog open={mapDialogOpen} onClose={() => setMapDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>اختيار الموقع من الخريطة</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField
                fullWidth
                label="ابحث عن مكان"
                value={mapSearch}
                onChange={(event) => setMapSearch(event.target.value)}
              />
              <Button
                variant="contained"
                startIcon={<SearchIcon />}
                onClick={() => searchOnMap().catch(() => undefined)}
                disabled={mapSearching}
              >
                {mapSearching ? 'جاري البحث...' : 'بحث'}
              </Button>
            </Stack>

            {mapResults.length > 0 ? (
              <Stack spacing={1}>
                {mapResults.map((result) => (
                  <Button
                    key={`${result.lat}-${result.lon}-${result.display_name}`}
                    variant="text"
                    sx={{ justifyContent: 'flex-start' }}
                    onClick={() => {
                      const point = toMapPoint(result.lat, result.lon);
                      if (point) {
                        setMapPoint(point);
                      }
                    }}
                  >
                    {result.display_name}
                  </Button>
                ))}
              </Stack>
            ) : null}

            <Box sx={{ height: 360, borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
              <StoreMap
                point={mapPoint}
                onPointChange={setMapPoint}
              />
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ sm: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                اضغط على الخريطة لتحديد موقع المتجر. الإحداثيات الحالية:{' '}
                {mapPoint ? `${formatCoordinate(mapPoint[0])}, ${formatCoordinate(mapPoint[1])}` : '-'}
              </Typography>
              <Button size="small" onClick={() => setMapPoint(SANA_A_CENTER)}>
                العودة إلى صنعاء
              </Button>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMapDialogOpen(false)}>إلغاء</Button>
          <Button onClick={applyMapPoint} variant="contained" disabled={!mapPoint}>اعتماد الإحداثيات</Button>
        </DialogActions>
      </Dialog>
    </AppPage>
  );
}

function createSlot(): WorkingHoursSlotForm {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    open: '09:00',
    close: '17:00',
  };
}

function createBaseCurrencyRow(isDefault: boolean): CurrencyFormRow {
  return {
    currencyCode: 'YER',
    yerPerUnit: '1',
    decimalDigits: '0',
    roundingIncrement: '1',
    isDefault,
  };
}

function createNextCurrencyRow(currencies: string[], rows: CurrencyFormRow[]): CurrencyFormRow {
  const used = new Set(rows.map((row) => row.currencyCode));
  const currencyCode = currencies.find((currency) => !used.has(currency) && currency !== 'YER') ?? 'USD';
  return {
    currencyCode,
    yerPerUnit: currencyCode === 'YER' ? '1' : '',
    decimalDigits: currencyCode === 'YER' ? '0' : '2',
    roundingIncrement: currencyCode === 'YER' ? '1' : '0.01',
    isDefault: rows.length === 0,
  };
}

function toCurrencyRows(currencies: StoreCurrency[]): CurrencyFormRow[] {
  const rows = currencies.length > 0 ? currencies : [createBaseCurrencyRow(true)];
  const mapped = rows.map((currency) => ({
    currencyCode: currency.currencyCode,
    yerPerUnit: String(currency.yerPerUnit),
    decimalDigits: String(currency.decimalDigits),
    roundingIncrement: String(currency.roundingIncrement),
    isDefault: currency.isDefault,
  }));
  if (!mapped.some((row) => row.currencyCode === 'YER')) {
    mapped.unshift(createBaseCurrencyRow(false));
  }
  return mapped;
}

function setDefaultCurrency(rows: CurrencyFormRow[], currencyCode: string): CurrencyFormRow[] {
  return rows.map((row) => ({ ...row, isDefault: row.currencyCode === currencyCode }));
}

function buildCurrencyPayload(rows: CurrencyFormRow[]): StoreCurrency[] {
  const normalized = rows.length > 0 ? rows : [createBaseCurrencyRow(true)];
  const withBase = normalized.some((row) => row.currencyCode === 'YER')
    ? normalized
    : [createBaseCurrencyRow(false), ...normalized];
  const hasDefault = withBase.some((row) => row.isDefault);
  return withBase.map((row, index) => ({
    currencyCode: row.currencyCode,
    yerPerUnit: row.currencyCode === 'YER' ? 1 : Number(row.yerPerUnit || 0),
    decimalDigits: row.currencyCode === 'YER' ? 0 : Number(row.decimalDigits || 2),
    roundingIncrement: row.currencyCode === 'YER' ? 1 : Number(row.roundingIncrement || 0.01),
    isDefault: hasDefault ? row.isDefault : index === 0,
    isActive: true,
  }));
}

function createInitialForm(options: StoreSettingsOptions): StoreSettingsForm {
  return {
    name: '',
    nameAr: '',
    nameEn: '',
    slug: '',
    descriptionAr: '',
    descriptionEn: '',
    businessCategory: '',
    currencyCode: options.currencies[0] ?? 'YER',
    timezone: options.timezones[0] ?? 'Asia/Aden',
    logoMediaAssetId: null,
    logoUrl: null,
    phone: '',
    country: normalizeCountryName(options.defaultCountry),
    city: '',
    addressDetails: '',
    latitude: '',
    longitude: '',
    workingHours: options.workingDays.map((day) => ({
      day,
      isClosed: true,
      slots: [],
    })),
    socialLinks: Object.fromEntries(options.socialPlatforms.map((key) => [key, ''])),
    shippingPolicy: '',
    returnPolicy: '',
    privacyPolicy: '',
    termsAndConditions: '',
  };
}

function toMapPoint(latitude: unknown, longitude: unknown): [number, number] | null {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return [lat, lng];
}

function formatCoordinate(value: unknown): string {
  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate.toFixed(7) : '';
}

function toFormState(settings: StoreSettings, options: StoreSettingsOptions): StoreSettingsForm {
  const workingHoursMap = new Map(settings.workingHours.map((row) => [row.day, row]));

  const workingHours = options.workingDays.map((day) => {
    const fromApi = workingHoursMap.get(day);
    if (!fromApi) {
      return { day, isClosed: true, slots: [] };
    }
    return {
      day,
      isClosed: Boolean(fromApi.isClosed),
      slots: (fromApi.slots ?? []).map((slot) => ({
        id: `${day}-${slot.open}-${slot.close}-${Math.random().toString(16).slice(2)}`,
        open: slot.open,
        close: slot.close,
      })),
    };
  });

  const socialLinks = Object.fromEntries(
    options.socialPlatforms.map((platform) => [platform, settings.socialLinks?.[platform] ?? '']),
  );

  return {
    name: settings.name || '',
    nameAr: settings.nameAr || settings.name || '',
    nameEn: settings.nameEn || '',
    slug: settings.slug || '',
    descriptionAr: settings.descriptionAr || settings.description || '',
    descriptionEn: settings.descriptionEn || '',
    businessCategory: settings.businessCategory || '',
    currencyCode: settings.currencyCode || options.currencies[0] || 'YER',
    timezone: settings.timezone || options.timezones[0] || 'Asia/Aden',
    logoMediaAssetId: settings.logoMediaAssetId,
    logoUrl: settings.logoUrl,
    phone: settings.phone ?? '',
    country: normalizeCountryName(settings.country || options.defaultCountry),
    city: cleanAddressPart(settings.city),
    addressDetails: cleanAddressPart(settings.addressDetails),
    latitude: settings.latitude !== null ? String(settings.latitude) : '',
    longitude: settings.longitude !== null ? String(settings.longitude) : '',
    workingHours,
    socialLinks,
    shippingPolicy: settings.shippingPolicy ?? '',
    returnPolicy: settings.returnPolicy ?? '',
    privacyPolicy: settings.privacyPolicy ?? '',
    termsAndConditions: settings.termsAndConditions ?? '',
  };
}

function buildPayload(form: StoreSettingsForm, composedAddress: string): Record<string, unknown> {
  const latitude = form.latitude.trim();
  const longitude = form.longitude.trim();
  const parsedLatitude = latitude ? Number(latitude) : null;
  const parsedLongitude = longitude ? Number(longitude) : null;

  const payload: Record<string, unknown> = {
    name: form.nameAr.trim() || form.name.trim(),
    nameAr: form.nameAr.trim() || form.name.trim(),
    nameEn: form.nameEn.trim() || null,
    descriptionAr: form.descriptionAr.trim() || null,
    descriptionEn: form.descriptionEn.trim() || null,
    businessCategory: form.businessCategory || undefined,
    currencyCode: form.currencyCode,
    timezone: form.timezone,
    logoMediaAssetId: form.logoMediaAssetId || undefined,
    logoUrl: form.logoUrl || undefined,
    phone: form.phone.trim() || undefined,
    country: normalizeCountryName(form.country),
    city: cleanAddressPart(form.city) || undefined,
    addressDetails: cleanAddressPart(form.addressDetails) || undefined,
    address: composedAddress || undefined,
    workingHours: form.workingHours.map((dayRow) => ({
      day: dayRow.day,
      isClosed: dayRow.isClosed,
      slots: dayRow.isClosed
        ? []
        : dayRow.slots
            .map((slot) => ({ open: slot.open.trim(), close: slot.close.trim() }))
            .filter((slot) => slot.open && slot.close),
    })),
    socialLinks: Object.fromEntries(
      Object.entries(form.socialLinks).map(([key, value]) => [key, value.trim()]),
    ),
    shippingPolicy: form.shippingPolicy.trim(),
    returnPolicy: form.returnPolicy.trim(),
    privacyPolicy: form.privacyPolicy.trim(),
    termsAndConditions: form.termsAndConditions.trim(),
  };

  const slug = normalizeSlug(form.slug);
  if (slug) {
    payload.slug = slug;
  }

  if (parsedLatitude !== null && parsedLongitude !== null) {
    payload.latitude = parsedLatitude;
    payload.longitude = parsedLongitude;
  }

  return payload;
}

function validateForm(form: StoreSettingsForm, socialPlatforms: string[]): string | null {
  if (!form.nameAr.trim() && !form.name.trim()) {
    return 'اسم المتجر بالعربي مطلوب';
  }

  const slug = normalizeSlug(form.slug);
  if (slug && slug.length < 3) {
    return 'رابط المتجر يجب أن يكون 3 أحرف على الأقل';
  }

  const latitude = form.latitude.trim();
  const longitude = form.longitude.trim();
  const hasLatitude = latitude.length > 0;
  const hasLongitude = longitude.length > 0;
  if (hasLatitude !== hasLongitude) {
    return 'يجب إدخال Latitude وLongitude معاً';
  }

  if (hasLatitude && hasLongitude) {
    const parsedLatitude = Number(latitude);
    const parsedLongitude = Number(longitude);
    if (!Number.isFinite(parsedLatitude) || parsedLatitude < -90 || parsedLatitude > 90) {
      return 'Latitude غير صالح';
    }
    if (!Number.isFinite(parsedLongitude) || parsedLongitude < -180 || parsedLongitude > 180) {
      return 'Longitude غير صالح';
    }
  }

  for (const dayRow of form.workingHours) {
    if (dayRow.isClosed) {
      continue;
    }
    for (const slot of dayRow.slots) {
      if (!slot.open || !slot.close) {
        return `أكمل أوقات العمل ليوم ${DAY_LABELS[dayRow.day] ?? dayRow.day}`;
      }
      if (slot.open >= slot.close) {
        return `وقت الفتح يجب أن يسبق الإغلاق ليوم ${DAY_LABELS[dayRow.day] ?? dayRow.day}`;
      }
    }
  }

  for (const platform of socialPlatforms) {
    const value = form.socialLinks[platform]?.trim();
    if (!value) {
      continue;
    }

    if (!isValidHttpUrl(value)) {
      return `رابط ${SOCIAL_LABELS[platform] ?? platform} غير صالح`;
    }
  }

  return null;
}

function mapStoreSettingsFieldErrors(fieldErrors: ApiFieldErrors): Record<string, string> {
  return compactFieldErrors({
    name: firstFieldError(fieldErrors, ['name', 'nameAr']),
    nameAr: firstFieldError(fieldErrors, ['nameAr', 'name']),
    nameEn: firstFieldError(fieldErrors, ['nameEn']),
    slug: firstFieldError(fieldErrors, ['slug']),
  });
}

function compactFieldErrors(fieldErrors: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fieldErrors).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}

function clearFieldErrors(
  current: Record<string, string>,
  fields: string[],
): Record<string, string> {
  if (fields.every((field) => !current[field])) {
    return current;
  }

  const next = { ...current };
  for (const field of fields) {
    delete next[field];
  }
  return next;
}

function composeAddress(country: string, city: string, addressDetails: string): string {
  return [
    normalizeCountryName(country),
    cleanAddressPart(city),
    cleanAddressPart(addressDetails),
  ].filter(Boolean).join('، ');
}

function normalizeSettingsOptions(options: StoreSettingsOptions): StoreSettingsOptions {
  return {
    ...options,
    defaultCountry: normalizeCountryName(options.defaultCountry),
    governorates: options.governorates.map(cleanAddressPart).filter(Boolean),
  };
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function StoreMap({ point, onPointChange }: { point: [number, number] | null; onPointChange: (point: [number, number]) => void }) {
  const center = (point ?? SANA_A_CENTER) as LatLngExpression;

  return (
    <MapContainer center={center} zoom={point ? 12 : 11} style={{ width: '100%', height: '100%' }}>
      <TileLayer attribution={MAP_TILE_ATTRIBUTION} url={MAP_TILE_URL} subdomains={MAP_TILE_SUBDOMAINS} />
      <MapInvalidateSize />
      <MapClickHandler onPointChange={onPointChange} />
      <MapRecenter point={point} />
      {point ? <CircleMarker center={point} radius={8} pathOptions={{ color: '#502E91', fillOpacity: 0.85 }} /> : null}
    </MapContainer>
  );
}

function MapClickHandler({ onPointChange }: { onPointChange: (point: [number, number]) => void }) {
  useMapEvents({
    click(event) {
      onPointChange([event.latlng.lat, event.latlng.lng]);
    },
  });

  return null;
}

function MapRecenter({ point }: { point: [number, number] | null }) {
  const map = useMap();

  useEffect(() => {
    if (!point) {
      return;
    }
    map.setView(point, Math.max(map.getZoom(), 12));
  }, [map, point]);

  return null;
}

function MapInvalidateSize() {
  const map = useMap();

  useEffect(() => {
    const timeoutId = window.setTimeout(() => map.invalidateSize(), 120);
    return () => window.clearTimeout(timeoutId);
  }, [map]);

  return null;
}

function normalizeCountryName(country: string): string {
  if (!country) return DEFAULT_COUNTRY_NAME;
  const lower = country.trim().toLowerCase();
  if (lower === 'ye' || lower === 'yemen' || lower === DEFAULT_COUNTRY_NAME) return DEFAULT_COUNTRY_NAME;
  if (isDamagedText(country)) return DEFAULT_COUNTRY_NAME;
  return country.trim();
}

function cleanAddressPart(value: string | null | undefined): string {
  if (!value || isDamagedText(value)) {
    return '';
  }
  return value.trim();
}

function isDamagedText(value: string): boolean {
  return DAMAGED_TEXT_PATTERN.test(value);
}

function renderSocialPlatformIcon(platform: string) {
  const Icon = SOCIAL_ICONS[platform as keyof typeof SOCIAL_ICONS] ?? LinkIcon;
  return <Icon fontSize="small" />;
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
    throw new Error('تعذر إنشاء رابط الرفع');
  }

  const uploadResponse = await fetch(presigned.uploadUrl, {
    method: 'PUT',
    headers: presigned.uploadHeaders,
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error('فشل رفع الملف');
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
    throw new Error('تعذر تأكيد الملف المرفوع');
  }

  return mediaAsset;
}
