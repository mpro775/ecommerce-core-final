import {
  AddIcon,
  CheckCircleIcon,
  DeleteOutlineIcon,
  ImageIcon,
  LinkIcon,
  LocationOnIcon,
  SearchIcon,
  StorefrontRoundedIcon,
  TimeIcon,
  UploadFileIcon,
} from '../../components/icons';
import { ChangeEvent, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  TextField,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { merchantRequestJson } from './api-client';
import type {
  MerchantSession,
  MediaAsset,
  PresignedMediaUpload,
  StoreRole,
  StoreSettings,
  StoreSettingsOptions,
} from './types';
import {
  MAP_TILE_ATTRIBUTION,
  MAP_TILE_SUBDOMAINS,
  MAP_TILE_URL,
  searchYemenLocations,
} from '../../lib/map-config';
import { ADMIN_TOKENS } from '../../theme/tokens';
import { EcommerceCoreLoader } from './components/ui';

interface MerchantOnboardingProps {
  session: MerchantSession;
  onCompleted: (session: MerchantSession) => void;
  onSignedOut: () => void;
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

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface SlugAvailabilityResponse {
  isValidFormat: boolean;
  isAvailable: boolean;
  normalizedSlug: string;
  reason?: 'reserved' | 'invalid_format' | 'taken';
}

interface MeResponse {
  id: string;
  storeId: string;
  email: string;
  fullName: string;
  role: StoreRole;
  permissions: string[];
  sessionId: string;
  onboardingCompleted: boolean;
}

const YEMEN_CENTER: [number, number] = [15.3694, 44.191];
const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_FAVICON_SIZE_BYTES = 1 * 1024 * 1024;
const ecommerce_core_LOGO_SRC = '/brand/ecommerce_core-logo.png';
const ecommerce_core_ICON_SRC = '/brand/ecommerce_core-icon.png';
const ecommerce_core_SHAPE_SRC = '/brand/ecommerce_core-bg-shape.png';

const ONBOARDING_STEPS = [
  {
    title: 'هوية المتجر',
    caption: 'الاسم والنطاق الفرعي والشعار',
  },
  {
    title: 'نشاط العمل',
    caption: 'تصنيف متجرك',
  },
  {
    title: 'معلومات التواصل',
    caption: 'العنوان وساعات العمل',
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  beauty: 'مستحضرات تجميل',
  fashion: 'ملابس وأزياء',
  abayas: 'عبايات',
  electronics: 'إلكترونيات وهواتف وأجهزة إلكترونية',
  books_stationery: 'كتب وقرطاسية',
  kids_toys: 'أطفال وألعاب',
  furniture_decor: 'أثاث وديكور',
  health_wellness: 'صحة وعافية',
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

const DAY_LABELS: Record<string, string> = {
  saturday: 'السبت',
  sunday: 'الأحد',
  monday: 'الاثنين',
  tuesday: 'الثلاثاء',
  wednesday: 'الأربعاء',
  thursday: 'الخميس',
  friday: 'الجمعة',
};

export function MerchantOnboarding({ session, onCompleted, onSignedOut }: MerchantOnboardingProps) {
  const theme = useTheme();
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const faviconInputRef = useRef<HTMLInputElement | null>(null);

  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'info' | 'success' | 'error' }>({
    text: '',
    type: 'info',
  });
  const [options, setOptions] = useState<StoreSettingsOptions | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugStatus, setSlugStatus] = useState<{
    loading: boolean;
    isValidFormat: boolean;
    isAvailable: boolean;
    normalizedSlug: string;
    reason?: SlugAvailabilityResponse['reason'];
  }>({
    loading: false,
    isValidFormat: true,
    isAvailable: true,
    normalizedSlug: '',
  });

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [logoMediaAssetId, setLogoMediaAssetId] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [faviconMediaAssetId, setFaviconMediaAssetId] = useState<string | null>(null);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
  const [businessCategory, setBusinessCategory] = useState<string>('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('اليمن');
  const [city, setCity] = useState('');
  const [addressDetails, setAddressDetails] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [workingHours, setWorkingHours] = useState<WorkingHoursDayForm[]>([]);
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});
  const [mapDialogOpen, setMapDialogOpen] = useState(false);
  const [mapSearch, setMapSearch] = useState('');
  const [mapSearching, setMapSearching] = useState(false);
  const [mapResults, setMapResults] = useState<NominatimResult[]>([]);
  const [mapPoint, setMapPoint] = useState<[number, number] | null>(YEMEN_CENTER);

  const storeSubdomainPreview = useMemo(() => slug.trim() || 'my-store', [slug]);
  const storeUrlPreview = useMemo(
    () => buildDefaultStoreUrl(storeSubdomainPreview),
    [storeSubdomainPreview],
  );

  useEffect(() => {
    initialize().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!slugTouched) {
      setSlug(buildSlugFromName(name));
    }
  }, [name, slugTouched]);

  useEffect(() => {
    const normalized = slug.trim().toLowerCase();
    if (!normalized) {
      setSlugStatus({
        loading: false,
        isValidFormat: false,
        isAvailable: false,
        normalizedSlug: '',
        reason: 'invalid_format',
      });
      return;
    }

    const timeoutId = window.setTimeout(() => {
      checkSlugAvailability(normalized).catch(() => undefined);
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [slug]);

  async function initialize(): Promise<void> {
    setLoading(true);
    try {
      const [settingsData, optionsData] = await Promise.all([
        request<StoreSettings>('/store/settings', { method: 'GET' }),
        request<StoreSettingsOptions>('/store/settings/options', { method: 'GET' }),
      ]);

      if (!settingsData || !optionsData) {
        throw new Error('تعذر تحميل بيانات إعداد المتجر.');
      }

      setOptions(optionsData);
      applySettings(settingsData, optionsData);
      setSlugStatus({
        loading: false,
        isValidFormat: true,
        isAvailable: true,
        normalizedSlug: settingsData.slug,
        reason: undefined,
      });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'تعذر تحميل إعداد المتجر.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  function applySettings(settings: StoreSettings, optionsData: StoreSettingsOptions): void {
    setName(settings.name || '');
    setSlug(settings.slug || '');
    setSlugTouched(Boolean(settings.slug));
    setLogoMediaAssetId(settings.logoMediaAssetId);
    setLogoUrl(settings.logoUrl);
    setFaviconMediaAssetId(settings.faviconMediaAssetId ?? null);
    setFaviconUrl(settings.faviconUrl ?? null);
    setBusinessCategory(settings.businessCategory ?? '');
    setPhone(settings.phone ?? '');
    setCountry(normalizeCountryName(settings.country || optionsData.defaultCountry));
    setCity(settings.city ?? '');
    setAddressDetails(settings.addressDetails ?? '');
    setLatitude(settings.latitude !== null ? String(settings.latitude) : '');
    setLongitude(settings.longitude !== null ? String(settings.longitude) : '');
    setWorkingHours(toWorkingHoursForm(settings.workingHours, optionsData.workingDays));
    setSocialLinks(
      Object.fromEntries(
        optionsData.socialPlatforms.map((platform) => [
          platform,
          settings.socialLinks?.[platform] ?? '',
        ]),
      ),
    );
    if (settings.latitude !== null && settings.longitude !== null) {
      setMapPoint([settings.latitude, settings.longitude]);
    }
  }

  async function checkSlugAvailability(rawSlug: string): Promise<void> {
    setSlugStatus((prev) => ({ ...prev, loading: true }));
    try {
      const result = await request<SlugAvailabilityResponse>(
        `/store/slug-availability?slug=${encodeURIComponent(rawSlug)}`,
        { method: 'GET' },
      );

      if (!result) {
        return;
      }

      setSlugStatus({
        loading: false,
        isValidFormat: result.isValidFormat,
        isAvailable: result.isAvailable,
        normalizedSlug: result.normalizedSlug,
        reason: result.reason,
      });
    } catch {
      setSlugStatus((prev) => ({ ...prev, loading: false }));
    }
  }

  async function saveAndComplete(): Promise<void> {
    if (!options) {
      return;
    }

    const validationError = validateCurrentStep(2);
    if (validationError) {
      setMessage({ text: validationError, type: 'error' });
      return;
    }

    setSaving(true);
    setMessage({ text: '', type: 'info' });

    try {
      await request('/store/settings', {
        method: 'PUT',
        body: JSON.stringify({
          name: name.trim(),
          slug: slugStatus.normalizedSlug || slug.trim().toLowerCase(),
          logoMediaAssetId: logoMediaAssetId || undefined,
          logoUrl: logoUrl || undefined,
          faviconMediaAssetId: faviconMediaAssetId || undefined,
          faviconUrl: faviconUrl || undefined,
          businessCategory: businessCategory || null,
          phone: phone.trim() || undefined,
          country,
          city: city.trim() || undefined,
          addressDetails: addressDetails.trim() || undefined,
          address: composeAddress(country, city, addressDetails) || undefined,
          ...(latitude.trim() && longitude.trim()
            ? { latitude: Number(latitude), longitude: Number(longitude) }
            : {}),
          workingHours: workingHours.map((dayRow) => ({
            day: dayRow.day,
            isClosed: dayRow.isClosed,
            slots: dayRow.isClosed
              ? []
              : dayRow.slots.map((slot) => ({ open: slot.open, close: slot.close })),
          })),
          socialLinks: Object.fromEntries(
            options.socialPlatforms.map((platform) => [
              platform,
              (socialLinks[platform] || '').trim(),
            ]),
          ),
          onboardingCompleted: true,
        }),
      });

      const me = await request<MeResponse>('/auth/me', { method: 'GET' });
      if (!me) {
        throw new Error('تعذر تحديث جلسة المستخدم.');
      }

      onCompleted({
        ...session,
        user: {
          ...session.user,
          ...me,
        },
      });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'تعذر إنهاء إعداد المتجر.',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  }

  function validateCurrentStep(step: number): string | null {
    if (!options) {
      return 'Options are not loaded yet.';
    }

    if (step >= 0) {
      if (!name.trim()) {
        return 'اسم المتجر مطلوب.';
      }
      if (!slug.trim()) {
        return 'النطاق الفرعي للمتجر مطلوب.';
      }
      if (!slugStatus.isValidFormat) {
        return 'صيغة النطاق الفرعي غير صحيحة.';
      }
      if (!slugStatus.isAvailable) {
        return 'هذا النطاق الفرعي غير متاح.';
      }
    }

    if (step >= 1) {
      if (!businessCategory) {
        return 'يرجى اختيار نشاط العمل.';
      }
    }

    if (step >= 2) {
      if (!phone.trim()) {
        return 'رقم التواصل مطلوب.';
      }

      const hasLatitude = latitude.trim().length > 0;
      const hasLongitude = longitude.trim().length > 0;
      if (hasLatitude !== hasLongitude) {
        return 'يجب إدخال خط العرض وخط الطول معًا.';
      }
      if (hasLatitude && hasLongitude) {
        const lat = Number(latitude);
        const lng = Number(longitude);
        if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
          return 'خط العرض غير صالح.';
        }
        if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
          return 'خط الطول غير صالح.';
        }
      }

      for (const dayRow of workingHours) {
        if (dayRow.isClosed) {
          continue;
        }
        for (const slot of dayRow.slots) {
          if (!slot.open || !slot.close) {
            return `أكمل ساعات العمل ليوم ${DAY_LABELS[dayRow.day] ?? dayRow.day}.`;
          }
          if (slot.open >= slot.close) {
            return `وقت الفتح يجب أن يسبق الإغلاق ليوم ${DAY_LABELS[dayRow.day] ?? dayRow.day}.`;
          }
        }
      }

      for (const platform of options.socialPlatforms) {
        const value = (socialLinks[platform] || '').trim();
        if (!value) {
          continue;
        }
        if (!isValidHttpUrl(value)) {
          return `رابط ${SOCIAL_LABELS[platform] ?? platform} غير صالح.`;
        }
      }
    }

    return null;
  }

  async function handleLogoUpload(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    if (file.size > MAX_LOGO_SIZE_BYTES) {
      setMessage({ text: 'حجم الشعار يجب أن لا يتجاوز 5MB.', type: 'error' });
      return;
    }

    setUploadingLogo(true);
    try {
      const asset = await uploadMediaAsset(file);
      setLogoMediaAssetId(asset.id);
      setLogoUrl(asset.url);
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'فشل رفع الشعار.',
        type: 'error',
      });
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleFaviconUpload(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    if (file.size > MAX_FAVICON_SIZE_BYTES) {
      setMessage({ text: 'حجم أيقونة الموقع يجب أن لا يتجاوز 1MB.', type: 'error' });
      return;
    }

    setUploadingFavicon(true);
    try {
      const asset = await uploadMediaAsset(file);
      setFaviconMediaAssetId(asset.id);
      setFaviconUrl(asset.url);
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'فشل رفع الأيقونة.',
        type: 'error',
      });
    } finally {
      setUploadingFavicon(false);
    }
  }

  async function uploadMediaAsset(file: File): Promise<MediaAsset> {
    const presigned = await request<PresignedMediaUpload>('/media/presign-upload', {
      method: 'POST',
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type,
        fileSizeBytes: file.size,
      }),
    });

    if (!presigned) {
      throw new Error('تعذر تجهيز رابط رفع الملف.');
    }

    const uploadResponse = await fetch(presigned.uploadUrl, {
      method: 'PUT',
      headers: presigned.uploadHeaders,
      body: file,
    });
    if (!uploadResponse.ok) {
      throw new Error('فشل رفع الملف.');
    }

    const etag = uploadResponse.headers.get('etag') ?? undefined;
    const confirmed = await request<MediaAsset>('/media/confirm', {
      method: 'POST',
      body: JSON.stringify({
        objectKey: presigned.objectKey,
        fileName: file.name,
        contentType: file.type,
        fileSizeBytes: file.size,
        ...(etag ? { etag } : {}),
      }),
    });

    if (!confirmed) {
      throw new Error('تعذر تأكيد رفع الملف.');
    }

    return confirmed;
  }

  function openMapDialog(): void {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      setMapPoint([lat, lng]);
    }
    setMapDialogOpen(true);
  }

  function applyMapPoint(): void {
    if (!mapPoint) {
      return;
    }
    setLatitude(mapPoint[0].toFixed(7));
    setLongitude(mapPoint[1].toFixed(7));
    setMapDialogOpen(false);
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
          setMapPoint([Number(first.lat), Number(first.lon)]);
        }
      }
    } catch {
      setMapResults([]);
    } finally {
      setMapSearching(false);
    }
  }

  async function request<T>(
    path: string,
    init?: RequestInit,
    options?: { includeStoreHeader?: boolean },
  ): Promise<T | null> {
    return merchantRequestJson<T>({
      session,
      path,
      init,
      options: {
        includeStoreHeader: options?.includeStoreHeader ?? true,
      },
      onSessionUpdate: () => undefined,
      onSessionExpired: onSignedOut,
    });
  }

  if (loading) {
    return (
      <Box
        dir="rtl"
        sx={{
          minHeight: '72vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <EcommerceCoreLoader size="lg" label="جاري تجهيز إعداد المتجر..." />
      </Box>
    );
  }

  if (!options) {
    return (
      <Stack dir="rtl" spacing={2}>
        <Alert severity="error">تعذر تحميل خيارات إعداد المتجر.</Alert>
        <Button variant="contained" onClick={() => initialize().catch(() => undefined)}>
          إعادة المحاولة
        </Button>
      </Stack>
    );
  }

  const activeStepMeta = ONBOARDING_STEPS[activeStep] ?? ONBOARDING_STEPS[0]!;
  const progressValue = Math.round(((activeStep + 1) / ONBOARDING_STEPS.length) * 100);

  return (
    <Box
      dir="rtl"
      sx={{
        position: 'relative',
        width: '100%',
        minHeight: { xs: 'auto', md: 'calc(100vh - 80px)' },
        display: 'flex',
        alignItems: 'center',
        isolation: 'isolate',
        py: { xs: 1, md: 1.5 },
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: { xs: '-32px -18px auto auto', md: '-88px auto auto -110px' },
          width: { xs: 220, md: 460 },
          height: { xs: 220, md: 460 },
          borderRadius: '50%',
          background: `radial-gradient(circle, ${alpha(theme.palette.secondary.main, 0.2)} 0%, transparent 68%)`,
          zIndex: -1,
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          insetBlockEnd: { xs: -34, md: -74 },
          insetInlineStart: { xs: -42, md: 16 },
          width: { xs: 190, md: 310 },
          height: { xs: 190, md: 310 },
          background: `url(${ecommerce_core_SHAPE_SRC}) center / contain no-repeat`,
          opacity: theme.palette.mode === 'dark' ? 0.08 : 0.18,
          zIndex: -1,
        },
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          overflow: 'hidden',
          borderRadius: { xs: '16px', md: '18px' },
          border: '1px solid',
          borderColor:
            theme.palette.mode === 'dark'
              ? alpha(theme.palette.common.white, 0.12)
              : alpha(theme.palette.primary.main, 0.14),
          bgcolor: alpha(
            theme.palette.background.paper,
            theme.palette.mode === 'dark' ? 0.9 : 0.78,
          ),
          boxShadow:
            theme.palette.mode === 'dark'
              ? '0 26px 62px rgba(9, 7, 16, 0.32), inset 0 1px 0 rgba(255,255,255,0.05)'
              : '0 28px 70px rgba(80, 46, 145, 0.15)',
          backdropFilter: 'blur(24px)',
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '310px minmax(0, 1fr)' },
            minHeight: { md: 720 },
          }}
        >
          <Box
            sx={{
              position: 'relative',
              overflow: 'hidden',
              p: { xs: 2.25, md: 3 },
              color: '#fff',
              background:
                theme.palette.mode === 'dark'
                  ? 'linear-gradient(155deg, #2A1D48 0%, #4C2A82 58%, #222B45 100%)'
                  : 'linear-gradient(155deg, #502E91 0%, #6757A9 56%, #6EC5D6 100%)',
              '&::before': {
                content: '""',
                position: 'absolute',
                insetInlineStart: -84,
                insetBlockEnd: -96,
                width: 280,
                height: 280,
                borderRadius: '50%',
                background: alpha('#FFFFFF', 0.13),
              },
            }}
          >
            <Stack sx={{ position: 'relative', zIndex: 1, minHeight: '100%' }} spacing={3}>
              <Stack spacing={1.5}>
                <Box
                  component="img"
                  src={ecommerce_core_LOGO_SRC}
                  alt="Ecommerce Core"
                  sx={{
                    width: 150,
                    maxWidth: '64%',
                    objectFit: 'contain',
                    filter: 'brightness(0) invert(1)',
                  }}
                />
                <Typography variant="h4" sx={{ color: '#fff', fontWeight: 900 }}>
                  إعداد المتجر
                </Typography>
                <Typography sx={{ color: alpha('#fff', 0.78), lineHeight: 1.8 }}>
                  أكمل بيانات متجرك الأساسية، وسنجهز لك رابطًا فرعيًا واضحًا على نطاق النظام
                  ستورز.
                </Typography>
              </Stack>

              <StepIndicator activeStep={activeStep} />

              <Box
                sx={{
                  mt: { xs: 1, md: 'auto' },
                  p: 2,
                  borderRadius: '14px',
                  bgcolor: alpha('#FFFFFF', 0.12),
                  border: `1px solid ${alpha('#FFFFFF', 0.18)}`,
                }}
              >
                <Stack spacing={1}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="subtitle2" sx={{ color: '#fff' }}>
                      التقدم
                    </Typography>
                    <Typography variant="subtitle2" sx={{ color: '#fff' }}>
                      {progressValue}%
                    </Typography>
                  </Stack>
                  <Box
                    sx={{
                      height: 8,
                      borderRadius: 99,
                      bgcolor: alpha('#fff', 0.18),
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      sx={{
                        width: `${progressValue}%`,
                        height: '100%',
                        borderRadius: 99,
                        bgcolor: '#fff',
                        transition: 'width 220ms ease',
                      }}
                    />
                  </Box>
                  <Typography variant="caption" sx={{ color: alpha('#fff', 0.72) }}>
                    الخطوة الحالية: {activeStepMeta.title}
                  </Typography>
                </Stack>
              </Box>
            </Stack>
          </Box>

          <Stack spacing={2.25} sx={{ p: { xs: 2, md: 3.25 } }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              alignItems={{ xs: 'stretch', sm: 'center' }}
              justifyContent="space-between"
            >
              <Stack spacing={0.5}>
                <Typography variant="caption" color="primary.main" sx={{ fontWeight: 800 }}>
                  {activeStepMeta.caption}
                </Typography>
                <Typography variant="h4">{activeStepMeta.title}</Typography>
              </Stack>
              <Box
                sx={{
                  width: 52,
                  height: 52,
                  borderRadius: '14px',
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  color: 'primary.main',
                  alignSelf: { xs: 'flex-start', sm: 'center' },
                }}
              >
                {activeStep === 0 ? (
                  <StorefrontRoundedIcon />
                ) : activeStep === 1 ? (
                  <CheckCircleIcon />
                ) : (
                  <TimeIcon />
                )}
              </Box>
            </Stack>

            {message.text ? <Alert severity={message.type}>{message.text}</Alert> : null}

            <Box sx={{ minHeight: { md: 456 } }}>
              {activeStep === 0 ? (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 260px' },
                    gap: 2,
                  }}
                >
                  <Stack spacing={2}>
                    <SectionBlock icon={<StorefrontRoundedIcon />} title="بيانات الواجهة">
                      <Stack spacing={1.5}>
                        <TextField
                          label="اسم المتجر"
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                        />
                        <TextField
                          label="النطاق الفرعي للمتجر"
                          value={slug}
                          onChange={(event) => {
                            setSlugTouched(true);
                            setSlug(normalizeSlugInput(event.target.value));
                          }}
                          inputProps={{ dir: 'ltr' }}
                          helperText={
                            slugStatus.loading
                              ? 'جاري التحقق...'
                              : !slugStatus.isValidFormat
                                ? 'استخدم أحرفًا إنجليزية صغيرة وأرقامًا وشرطات فقط، من 3 إلى 50 حرفًا.'
                                : !slugStatus.isAvailable
                                  ? slugStatus.reason === 'reserved'
                                    ? 'هذا النطاق محجوز للنظام.'
                                    : 'هذا النطاق الفرعي مستخدم بالفعل.'
                                  : storeUrlPreview
                          }
                          error={
                            !slugStatus.loading &&
                            (!slugStatus.isValidFormat || !slugStatus.isAvailable)
                          }
                        />
                      </Stack>
                    </SectionBlock>

                    <Box
                      sx={{
                        p: 2,
                        borderRadius: '14px',
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: alpha(
                          theme.palette.primary.main,
                          theme.palette.mode === 'dark' ? 0.1 : 0.035,
                        ),
                      }}
                    >
                      <Stack direction="row" spacing={1.25} alignItems="center">
                        <LinkIcon color="primary" fontSize="small" />
                        <Stack spacing={0.25}>
                          <Typography variant="subtitle2">رابط المتجر التلقائي</Typography>
                          <Typography variant="body2" dir="ltr" sx={{ wordBreak: 'break-word' }}>
                            {storeUrlPreview}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            يتم توليده من النطاق الفرعي، ويمكن استخدامه كعنوان المتجر العام.
                          </Typography>
                        </Stack>
                      </Stack>
                    </Box>
                  </Stack>

                  <Stack spacing={1.5}>
                    <UploadTile
                      title="شعار المتجر"
                      note="PNG, JPG, WebP, SVG - الحد الأقصى 5MB."
                      url={logoUrl}
                      fallback="بدون شعار"
                      buttonLabel={
                        uploadingLogo ? 'جاري الرفع...' : logoUrl ? 'تغيير الشعار' : 'رفع الشعار'
                      }
                      disabled={uploadingLogo || saving}
                      onClick={() => logoInputRef.current?.click()}
                    />
                    <UploadTile
                      title="أيقونة الموقع"
                      note="المقاس الموصى به 32x32 - الحد الأقصى 1MB."
                      url={faviconUrl}
                      fallback="بدون أيقونة"
                      buttonLabel={
                        uploadingFavicon
                          ? 'جاري الرفع...'
                          : faviconUrl
                            ? 'تغيير الأيقونة'
                            : 'رفع الأيقونة'
                      }
                      disabled={uploadingFavicon || saving}
                      onClick={() => faviconInputRef.current?.click()}
                      small
                    />
                    <input
                      ref={logoInputRef}
                      hidden
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={(event) => {
                        handleLogoUpload(event).catch(() => undefined);
                      }}
                    />
                    <input
                      ref={faviconInputRef}
                      hidden
                      type="file"
                      accept="image/png,image/x-icon,image/svg+xml"
                      onChange={(event) => {
                        handleFaviconUpload(event).catch(() => undefined);
                      }}
                    />
                  </Stack>
                </Box>
              ) : null}

              {activeStep === 1 ? (
                <SectionBlock icon={<CheckCircleIcon />} title="اختر أقرب نشاط">
                  <FormControl fullWidth>
                    <RadioGroup
                      value={businessCategory}
                      onChange={(event) => setBusinessCategory(event.target.value)}
                    >
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                          gap: 1,
                        }}
                      >
                        {options.businessCategories.map((category) => {
                          const selected = businessCategory === category;
                          return (
                            <FormControlLabel
                              key={category}
                              value={category}
                              control={<Radio />}
                              label={CATEGORY_LABELS[category] ?? category}
                              sx={{
                                m: 0,
                                minHeight: 58,
                                px: 1.25,
                                borderRadius: '12px',
                                border: '1px solid',
                                borderColor: selected ? 'primary.main' : 'divider',
                                bgcolor: selected
                                  ? alpha(
                                      theme.palette.primary.main,
                                      theme.palette.mode === 'dark' ? 0.2 : 0.08,
                                    )
                                  : 'background.paper',
                                transition: 'background-color 160ms ease, border-color 160ms ease',
                              }}
                            />
                          );
                        })}
                      </Box>
                    </RadioGroup>
                  </FormControl>
                </SectionBlock>
              ) : null}

              {activeStep === 2 ? (
                <Stack spacing={2}>
                  <SectionBlock icon={<LocationOnIcon />} title="موقع المتجر">
                    <Stack spacing={1.5}>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                          gap: 1.25,
                        }}
                      >
                        <TextField
                          label="رقم التواصل"
                          value={phone}
                          onChange={(event) => setPhone(event.target.value)}
                          inputProps={{ dir: 'ltr' }}
                        />
                        <TextField label="الدولة" value={country} disabled />
                        <TextField
                          select
                          label="المدينة (المحافظة)"
                          value={city}
                          onChange={(event) => setCity(event.target.value)}
                        >
                          <MenuItem value="">اختر المحافظة</MenuItem>
                          {options.governorates.map((governorate) => (
                            <MenuItem key={governorate} value={governorate}>
                              {governorate}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Box>
                      <TextField
                        label="العنوان التفصيلي"
                        value={addressDetails}
                        onChange={(event) => setAddressDetails(event.target.value)}
                        multiline
                        rows={2}
                      />
                      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25}>
                        <TextField
                          label="خط العرض"
                          value={latitude}
                          onChange={(event) => setLatitude(event.target.value)}
                        />
                        <TextField
                          label="خط الطول"
                          value={longitude}
                          onChange={(event) => setLongitude(event.target.value)}
                        />
                        <Button
                          variant="outlined"
                          startIcon={<LocationOnIcon />}
                          onClick={openMapDialog}
                        >
                          اختيار الموقع
                        </Button>
                      </Stack>
                    </Stack>
                  </SectionBlock>

                  <SectionBlock icon={<TimeIcon />} title="ساعات العمل">
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
                        gap: 1,
                      }}
                    >
                      {workingHours.map((dayRow) => (
                        <Box
                          key={dayRow.day}
                          sx={{
                            p: 1.25,
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: '12px',
                            bgcolor: alpha(
                              theme.palette.background.default,
                              theme.palette.mode === 'dark' ? 0.28 : 0.42,
                            ),
                          }}
                        >
                          <Stack spacing={1}>
                            <Stack
                              direction="row"
                              alignItems="center"
                              justifyContent="space-between"
                            >
                              <Typography variant="subtitle2">
                                {DAY_LABELS[dayRow.day] ?? dayRow.day}
                              </Typography>
                              <FormControlLabel
                                sx={{ m: 0 }}
                                control={
                                  <Switch
                                    checked={!dayRow.isClosed}
                                    onChange={(event) => {
                                      setWorkingHours((prev) =>
                                        prev.map((item) =>
                                          item.day === dayRow.day
                                            ? {
                                                ...item,
                                                isClosed: !event.target.checked,
                                                slots: event.target.checked
                                                  ? item.slots.length > 0
                                                    ? item.slots
                                                    : [createSlot()]
                                                  : [],
                                              }
                                            : item,
                                        ),
                                      );
                                    }}
                                  />
                                }
                                label={dayRow.isClosed ? 'مغلق' : 'مفتوح'}
                              />
                            </Stack>
                            {!dayRow.isClosed ? (
                              <Stack spacing={1}>
                                {dayRow.slots.map((slot) => (
                                  <Stack
                                    key={slot.id}
                                    direction="row"
                                    spacing={1}
                                    alignItems="center"
                                  >
                                    <TextField
                                      label="من"
                                      type="time"
                                      value={slot.open}
                                      onChange={(event) => {
                                        setWorkingHours((prev) =>
                                          prev.map((item) =>
                                            item.day === dayRow.day
                                              ? {
                                                  ...item,
                                                  slots: item.slots.map((entry) =>
                                                    entry.id === slot.id
                                                      ? { ...entry, open: event.target.value }
                                                      : entry,
                                                  ),
                                                }
                                              : item,
                                          ),
                                        );
                                      }}
                                      InputLabelProps={{ shrink: true }}
                                    />
                                    <TextField
                                      label="إلى"
                                      type="time"
                                      value={slot.close}
                                      onChange={(event) => {
                                        setWorkingHours((prev) =>
                                          prev.map((item) =>
                                            item.day === dayRow.day
                                              ? {
                                                  ...item,
                                                  slots: item.slots.map((entry) =>
                                                    entry.id === slot.id
                                                      ? { ...entry, close: event.target.value }
                                                      : entry,
                                                  ),
                                                }
                                              : item,
                                          ),
                                        );
                                      }}
                                      InputLabelProps={{ shrink: true }}
                                    />
                                    <IconButton
                                      color="error"
                                      onClick={() => {
                                        setWorkingHours((prev) =>
                                          prev.map((item) =>
                                            item.day === dayRow.day
                                              ? {
                                                  ...item,
                                                  slots: item.slots.filter(
                                                    (entry) => entry.id !== slot.id,
                                                  ),
                                                }
                                              : item,
                                          ),
                                        );
                                      }}
                                    >
                                      <DeleteOutlineIcon />
                                    </IconButton>
                                  </Stack>
                                ))}
                                <Button
                                  variant="text"
                                  startIcon={<AddIcon />}
                                  onClick={() => {
                                    setWorkingHours((prev) =>
                                      prev.map((item) =>
                                        item.day === dayRow.day
                                          ? { ...item, slots: [...item.slots, createSlot()] }
                                          : item,
                                      ),
                                    );
                                  }}
                                >
                                  إضافة فترة
                                </Button>
                              </Stack>
                            ) : null}
                          </Stack>
                        </Box>
                      ))}
                    </Box>
                  </SectionBlock>

                  <SectionBlock icon={<LinkIcon />} title="روابط التواصل الاجتماعي">
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                        gap: 1.25,
                      }}
                    >
                      {options.socialPlatforms.map((platform) => (
                        <TextField
                          key={platform}
                          label={SOCIAL_LABELS[platform] ?? platform}
                          value={socialLinks[platform] ?? ''}
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            setSocialLinks((prev) => ({ ...prev, [platform]: nextValue }));
                          }}
                          inputProps={{ dir: 'ltr' }}
                        />
                      ))}
                    </Box>
                  </SectionBlock>
                </Stack>
              ) : null}
            </Box>

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              justifyContent="space-between"
            >
              <Button variant="outlined" color="inherit" onClick={onSignedOut} disabled={saving}>
                تسجيل الخروج
              </Button>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Button
                  variant="outlined"
                  disabled={activeStep === 0 || saving}
                  onClick={() => {
                    setMessage({ text: '', type: 'info' });
                    setActiveStep((prev) => Math.max(0, prev - 1));
                  }}
                >
                  السابق
                </Button>
                {activeStep < 2 ? (
                  <Button
                    variant="contained"
                    disabled={saving}
                    onClick={() => {
                      const validationError = validateCurrentStep(activeStep);
                      if (validationError) {
                        setMessage({ text: validationError, type: 'error' });
                        return;
                      }
                      setMessage({ text: '', type: 'info' });
                      setActiveStep((prev) => prev + 1);
                    }}
                  >
                    التالي
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    disabled={saving}
                    onClick={() => saveAndComplete().catch(() => undefined)}
                  >
                    {saving ? 'جاري الإنهاء...' : 'إنهاء الإعداد'}
                  </Button>
                )}
              </Stack>
            </Stack>
          </Stack>
        </Box>

        <Dialog
          open={mapDialogOpen}
          onClose={() => setMapDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
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
                  disabled={mapSearching}
                  onClick={() => searchOnMap().catch(() => undefined)}
                >
                  {mapSearching ? 'جاري البحث...' : 'بحث'}
                </Button>
              </Stack>
              {mapResults.length > 0 ? (
                <Stack spacing={0.5}>
                  {mapResults.map((result) => (
                    <Button
                      key={`${result.lat}-${result.lon}-${result.display_name}`}
                      variant="text"
                      sx={{ justifyContent: 'flex-start' }}
                      onClick={() => setMapPoint([Number(result.lat), Number(result.lon)])}
                    >
                      {result.display_name}
                    </Button>
                  ))}
                </Stack>
              ) : null}
              <Box
                sx={{
                  height: 320,
                  borderRadius: '12px',
                  overflow: 'hidden',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <StoreMap point={mapPoint} onPointChange={setMapPoint} />
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setMapDialogOpen(false)}>إلغاء</Button>
            <Button onClick={applyMapPoint} variant="contained" disabled={!mapPoint}>
              اعتماد الموقع
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>
    </Box>
  );
}

function StepIndicator({ activeStep }: { activeStep: number }) {
  return (
    <Stack spacing={1}>
      {ONBOARDING_STEPS.map((step, index) => (
        <Box
          key={step.title}
          sx={{
            display: 'grid',
            gridTemplateColumns: '34px minmax(0, 1fr)',
            gap: 1,
            alignItems: 'center',
            p: 1,
            borderRadius: '14px',
            bgcolor: index === activeStep ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)',
            border: '1px solid',
            borderColor: index === activeStep ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.1)',
          }}
        >
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              bgcolor: index <= activeStep ? '#fff' : 'rgba(255,255,255,0.12)',
              color: index <= activeStep ? 'primary.main' : 'rgba(255,255,255,0.7)',
              fontWeight: 900,
            }}
          >
            {index < activeStep ? <CheckCircleIcon fontSize="small" /> : index + 1}
          </Box>
          <Stack spacing={0.2} sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ color: '#fff' }}>
              {step.title}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.68)' }}>
              {step.caption}
            </Typography>
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}

function SectionBlock({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <Box
      sx={(theme) => ({
        p: { xs: 1.5, md: 2 },
        borderRadius: '14px',
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.72 : 0.7),
      })}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box
            sx={(theme) => ({
              width: 36,
              height: 36,
              borderRadius: '10px',
              display: 'grid',
              placeItems: 'center',
              bgcolor: alpha(
                theme.palette.primary.main,
                theme.palette.mode === 'dark' ? 0.2 : 0.09,
              ),
              color: 'primary.main',
            })}
          >
            {icon}
          </Box>
          <Typography variant="subtitle1">{title}</Typography>
        </Stack>
        {children}
      </Stack>
    </Box>
  );
}

function UploadTile({
  title,
  note,
  url,
  fallback,
  buttonLabel,
  disabled,
  onClick,
  small = false,
}: {
  title: string;
  note: string;
  url: string | null;
  fallback: string;
  buttonLabel: string;
  disabled: boolean;
  onClick: () => void;
  small?: boolean;
}) {
  return (
    <Box
      sx={(theme) => ({
        p: 1.5,
        borderRadius: '14px',
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.76 : 0.78),
      })}
    >
      <Stack spacing={1.25} alignItems="stretch">
        <Stack direction="row" spacing={1} alignItems="center">
          <ImageIcon color="primary" fontSize="small" />
          <Stack spacing={0.1}>
            <Typography variant="subtitle2">{title}</Typography>
            <Typography variant="caption" color="text.secondary">
              {note}
            </Typography>
          </Stack>
        </Stack>
        <PreviewImage url={url} fallback={fallback} small={small} />
        <Button
          fullWidth
          variant="outlined"
          startIcon={<UploadFileIcon />}
          onClick={onClick}
          disabled={disabled}
          sx={{
            minWidth: 0,
            px: 1.25,
            whiteSpace: 'normal',
            textAlign: 'center',
            lineHeight: 1.35,
            '& .MuiButton-startIcon': {
              flexShrink: 0,
              marginInlineEnd: 0.75,
              marginInlineStart: 0,
            },
          }}
        >
          {buttonLabel}
        </Button>
      </Stack>
    </Box>
  );
}

function PreviewImage({
  url,
  fallback,
  small = false,
}: {
  url: string | null;
  fallback: string;
  small?: boolean;
}) {
  return (
    <Box
      sx={{
        width: '100%',
        height: small ? 96 : 150,
        borderRadius: '12px',
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        backgroundImage: `linear-gradient(45deg, rgba(80,46,145,0.04) 25%, transparent 25%),
          linear-gradient(-45deg, rgba(80,46,145,0.04) 25%, transparent 25%),
          linear-gradient(45deg, transparent 75%, rgba(80,46,145,0.04) 75%),
          linear-gradient(-45deg, transparent 75%, rgba(80,46,145,0.04) 75%)`,
        backgroundSize: '18px 18px',
        backgroundPosition: '0 0, 0 9px, 9px -9px, -9px 0px',
      }}
    >
      {url ? (
        <Box
          component="img"
          src={url}
          alt={fallback}
          sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      ) : (
        <Stack spacing={0.75} alignItems="center" sx={{ color: 'text.secondary' }}>
          <Box
            component="img"
            src={ecommerce_core_ICON_SRC}
            alt=""
            sx={{
              width: small ? 34 : 46,
              height: small ? 34 : 46,
              objectFit: 'contain',
              opacity: 0.62,
            }}
          />
          <Typography variant="caption" color="text.secondary">
            {fallback}
          </Typography>
        </Stack>
      )}
    </Box>
  );
}

function StoreMap({
  point,
  onPointChange,
}: {
  point: [number, number] | null;
  onPointChange: (point: [number, number]) => void;
}) {
  const center = (point ?? YEMEN_CENTER) as LatLngExpression;
  return (
    <MapContainer center={center} zoom={6} style={{ width: '100%', height: '100%' }}>
      <TileLayer
        attribution={MAP_TILE_ATTRIBUTION}
        url={MAP_TILE_URL}
        subdomains={MAP_TILE_SUBDOMAINS}
      />
      <MapInvalidateSize />
      <MapClickHandler onPointChange={onPointChange} />
      <MapRecenter point={point} />
      {point ? (
        <CircleMarker
          center={point}
          radius={8}
          pathOptions={{ color: '#502E91', fillOpacity: 0.85 }}
        />
      ) : null}
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
    map.setView(point, Math.max(map.getZoom(), 10));
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

function createSlot(): WorkingHoursSlotForm {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    open: '09:00',
    close: '17:00',
  };
}

function toWorkingHoursForm(
  source: StoreSettings['workingHours'],
  supportedDays: string[],
): WorkingHoursDayForm[] {
  const byDay = new Map(source.map((item) => [item.day, item]));
  return supportedDays.map((day) => {
    const existing = byDay.get(day);
    if (!existing) {
      return { day, isClosed: true, slots: [] };
    }
    return {
      day,
      isClosed: existing.isClosed,
      slots: (existing.slots ?? []).map((slot) => ({
        id: `${day}-${slot.open}-${slot.close}-${Math.random().toString(16).slice(2)}`,
        open: slot.open,
        close: slot.close,
      })),
    };
  });
}

function normalizeCountryName(country: string): string {
  if (!country) return 'اليمن';
  const lower = country.trim().toLowerCase();
  if (lower === 'ye' || lower === 'yemen' || lower === 'اليمن') return 'اليمن';
  return country;
}

function composeAddress(country: string, city: string, addressDetails: string): string {
  return [country, city, addressDetails]
    .map((part) => part.trim())
    .filter(Boolean)
    .join('، ');
}

function normalizeSlugInput(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function buildSlugFromName(input: string): string {
  const transliterated = transliterateArabic(input);
  return normalizeSlugInput(transliterated);
}

function transliterateArabic(value: string): string {
  const map: Record<string, string> = {
    ا: 'a',
    أ: 'a',
    إ: 'i',
    آ: 'a',
    ء: '',
    ب: 'b',
    ت: 't',
    ث: 'th',
    ج: 'j',
    ح: 'h',
    خ: 'kh',
    د: 'd',
    ذ: 'th',
    ر: 'r',
    ز: 'z',
    س: 's',
    ش: 'sh',
    ص: 's',
    ض: 'd',
    ط: 't',
    ظ: 'z',
    ع: 'a',
    غ: 'gh',
    ف: 'f',
    ق: 'q',
    ك: 'k',
    ل: 'l',
    م: 'm',
    ن: 'n',
    ه: 'h',
    و: 'w',
    ي: 'y',
    ى: 'a',
    ة: 'h',
  };

  return value
    .split('')
    .map((char) => map[char] ?? char)
    .join('');
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function buildDefaultStoreUrl(slug: string): string {
  const pattern = import.meta.env.VITE_STOREFRONT_URL_PATTERN || 'https://{storeSlug}.your-domain.com';
  return pattern.replace('{storeSlug}', slug);
}
