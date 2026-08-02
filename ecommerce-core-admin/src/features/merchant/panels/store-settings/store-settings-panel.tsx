import { useEffect, useState, type ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import type { MerchantRequester } from '../../merchant-dashboard.types';
import type { StoreCurrency, StoreSettings, StoreSettingsOptions } from '../../types';
import { AppPage, EcommerceCoreLoader, PageHeader } from '../../components/ui';

interface StoreSettingsPanelProps {
  request: MerchantRequester;
  onSettingsUpdated?: (settings: StoreSettings) => void;
}

type WorkingDay = StoreSettings['workingHours'][number];

interface StoreForm {
  name: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  phone: string;
  country: string;
  city: string;
  addressDetails: string;
  latitude: string;
  longitude: string;
  timezone: string;
  workingHours: WorkingDay[];
  socialLinks: Record<string, string>;
}

const DEFAULT_OPTIONS: StoreSettingsOptions = {
  defaultCountry: 'اليمن',
  currencies: ['YER', 'SAR', 'USD'],
  timezones: ['Asia/Aden'],
  governorates: [],
  workingDays: ['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  socialPlatforms: ['instagram', 'facebook', 'x', 'tiktok', 'snapchat', 'whatsapp', 'telegram', 'youtube', 'website'],
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

export function StoreSettingsPanel({ request, onSettingsUpdated }: StoreSettingsPanelProps) {
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [form, setForm] = useState<StoreForm>(() => emptyForm(DEFAULT_OPTIONS));
  const [currencies, setCurrencies] = useState<StoreCurrency[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let active = true;

    Promise.all([
      request<StoreSettings>('/store/settings', { method: 'GET' }),
      request<StoreSettingsOptions>('/store/settings/options', { method: 'GET' }),
      request<{ currencies: StoreCurrency[] }>('/store/currencies', { method: 'GET' }),
    ])
      .then(([settings, settingsOptions, currencyResponse]) => {
        if (!active || !settings) return;
        const resolvedOptions = settingsOptions ?? DEFAULT_OPTIONS;
        setOptions(resolvedOptions);
        setForm(toForm(settings, resolvedOptions));
        setCurrencies(normalizeCurrencies(currencyResponse?.currencies ?? settings.currencies));
      })
      .catch((error: unknown) => {
        if (active) {
          setMessage({ type: 'error', text: error instanceof Error ? error.message : 'تعذر تحميل إعدادات المتجر.' });
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [request]);

  async function save(): Promise<void> {
    if (!form.name.trim() && !form.nameAr.trim()) {
      setMessage({ type: 'error', text: 'اسم المتجر مطلوب.' });
      return;
    }
    if (!currencies.some((currency) => currency.isDefault)) {
      setMessage({ type: 'error', text: 'اختر عملة افتراضية واحدة.' });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const latitude = optionalNumber(form.latitude);
      const longitude = optionalNumber(form.longitude);
      const updated = await request<StoreSettings>('/store/settings', {
        method: 'PUT',
        body: JSON.stringify({
          name: form.nameAr.trim() || form.name.trim(),
          nameAr: form.nameAr.trim() || null,
          nameEn: form.nameEn.trim() || null,
          descriptionAr: form.descriptionAr.trim() || null,
          descriptionEn: form.descriptionEn.trim() || null,
          phone: form.phone.trim() || null,
          country: form.country.trim(),
          city: form.city || null,
          addressDetails: form.addressDetails.trim() || null,
          address: buildAddress(form),
          latitude,
          longitude,
          timezone: form.timezone,
          workingHours: form.workingHours,
          socialLinks: Object.fromEntries(
            Object.entries(form.socialLinks).map(([key, value]) => [key, value.trim() || null]),
          ),
        }),
      });

      await request('/store/currencies', {
        method: 'PUT',
        body: JSON.stringify({ currencies: normalizeCurrencies(currencies) }),
      });

      if (updated) onSettingsUpdated?.(updated);
      setMessage({ type: 'success', text: 'تم حفظ إعدادات المتجر التشغيلية بنجاح.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'تعذر حفظ الإعدادات.' });
    } finally {
      setSaving(false);
    }
  }

  function updateDay(day: string, patch: Partial<WorkingDay>): void {
    setForm((current) => ({
      ...current,
      workingHours: current.workingHours.map((row) => (row.day === day ? { ...row, ...patch } : row)),
    }));
  }

  function updateSlot(day: string, slotIndex: number, field: 'open' | 'close', value: string): void {
    const row = form.workingHours.find((item) => item.day === day);
    if (!row) return;
    const slots = row.slots.map((slot, index) => (index === slotIndex ? { ...slot, [field]: value } : slot));
    updateDay(day, { slots });
  }

  function updateCurrency(code: string, patch: Partial<StoreCurrency>): void {
    setCurrencies((current) => current.map((row) => {
      if (row.currencyCode !== code) {
        return patch.isDefault ? { ...row, isDefault: false } : row;
      }
      return { ...row, ...patch };
    }));
  }

  if (loading) {
    return <EcommerceCoreLoader label="جاري تحميل إعدادات المتجر..." sx={{ minHeight: 320 }} />;
  }

  return (
    <AppPage>
      <PageHeader
        title="إعدادات المتجر"
        description="بيانات التشغيل والاتصال والموقع وساعات العمل والعملات. تصميم واجهة المتجر يُدار في التطبيق المخصص."
        actions={<Button variant="contained" onClick={() => void save()} disabled={saving}>{saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}</Button>}
      />

      {message ? <Alert severity={message.type}>{message.text}</Alert> : null}

      <SettingsSection title="الهوية التشغيلية" description="الأسماء والأوصاف المستخدمة في الطلبات والفواتير والاتصال.">
        <TextField label="اسم المتجر" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        <TextField label="الاسم بالعربية" value={form.nameAr} onChange={(event) => setForm({ ...form, nameAr: event.target.value })} />
        <TextField label="الاسم بالإنجليزية" value={form.nameEn} onChange={(event) => setForm({ ...form, nameEn: event.target.value })} />
        <TextField label="رقم التواصل" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        <TextField multiline minRows={3} label="الوصف بالعربية" value={form.descriptionAr} onChange={(event) => setForm({ ...form, descriptionAr: event.target.value })} />
        <TextField multiline minRows={3} label="الوصف بالإنجليزية" value={form.descriptionEn} onChange={(event) => setForm({ ...form, descriptionEn: event.target.value })} />
      </SettingsSection>

      <SettingsSection title="الموقع والتوقيت" description="تُستخدم هذه البيانات للاستلام والتوصيل والتحليلات.">
        <TextField label="الدولة" value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} />
        <TextField select label="المحافظة" value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })}>
          <MenuItem value="">غير محدد</MenuItem>
          {options.governorates.map((governorate) => <MenuItem key={governorate} value={governorate}>{governorate}</MenuItem>)}
        </TextField>
        <TextField label="تفاصيل العنوان" value={form.addressDetails} onChange={(event) => setForm({ ...form, addressDetails: event.target.value })} />
        <TextField select label="المنطقة الزمنية" value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })}>
          {options.timezones.map((timezone) => <MenuItem key={timezone} value={timezone}>{timezone}</MenuItem>)}
        </TextField>
        <TextField type="number" label="خط العرض" value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })} inputProps={{ step: '0.0000001' }} />
        <TextField type="number" label="خط الطول" value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })} inputProps={{ step: '0.0000001' }} />
      </SettingsSection>

      <SettingsSection title="ساعات العمل" description="يمكن إضافة أكثر من فترة عمل لليوم الواحد.">
        <Stack spacing={1.5} sx={{ gridColumn: '1 / -1' }}>
          {form.workingHours.map((row) => (
            <Paper key={row.day} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
                <Typography fontWeight={800} sx={{ minWidth: 90 }}>{DAY_LABELS[row.day] ?? row.day}</Typography>
                <FormControlLabel
                  control={<Switch checked={!row.isClosed} onChange={(event) => updateDay(row.day, { isClosed: !event.target.checked, slots: event.target.checked && row.slots.length === 0 ? [{ open: '09:00', close: '17:00' }] : row.slots })} />}
                  label={row.isClosed ? 'مغلق' : 'مفتوح'}
                />
                {!row.isClosed ? (
                  <Stack spacing={1} sx={{ flex: 1 }}>
                    {row.slots.map((slot, index) => (
                      <Stack key={`${row.day}-${index}`} direction="row" spacing={1}>
                        <TextField type="time" label="من" value={slot.open} onChange={(event) => updateSlot(row.day, index, 'open', event.target.value)} InputLabelProps={{ shrink: true }} />
                        <TextField type="time" label="إلى" value={slot.close} onChange={(event) => updateSlot(row.day, index, 'close', event.target.value)} InputLabelProps={{ shrink: true }} />
                        <Button color="error" onClick={() => updateDay(row.day, { slots: row.slots.filter((_, slotIndex) => slotIndex !== index) })}>حذف</Button>
                      </Stack>
                    ))}
                    <Button size="small" onClick={() => updateDay(row.day, { slots: [...row.slots, { open: '09:00', close: '17:00' }] })}>إضافة فترة</Button>
                  </Stack>
                ) : null}
              </Stack>
            </Paper>
          ))}
        </Stack>
      </SettingsSection>

      <SettingsSection title="قنوات التواصل" description="روابط اتصال تشغيلية اختيارية.">
        {options.socialPlatforms.map((platform) => (
          <TextField
            key={platform}
            label={SOCIAL_LABELS[platform] ?? platform}
            value={form.socialLinks[platform] ?? ''}
            onChange={(event) => setForm({ ...form, socialLinks: { ...form.socialLinks, [platform]: event.target.value } })}
          />
        ))}
      </SettingsSection>

      <SettingsSection title="العملات" description="سعر كل عملة بوحدة الريال اليمني مع عملة افتراضية واحدة.">
        {currencies.map((currency) => (
          <Paper key={currency.currencyCode} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
            <Stack spacing={1}>
              <Typography fontWeight={800}>{currency.currencyCode}</Typography>
              <TextField
                type="number"
                label="ريال يمني لكل وحدة"
                value={currency.yerPerUnit}
                disabled={currency.currencyCode === 'YER'}
                onChange={(event) => updateCurrency(currency.currencyCode, { yerPerUnit: Number(event.target.value) })}
              />
              <FormControlLabel
                control={<Switch checked={currency.isDefault} onChange={() => updateCurrency(currency.currencyCode, { isDefault: true })} />}
                label="العملة الافتراضية"
              />
            </Stack>
          </Paper>
        ))}
      </SettingsSection>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button size="large" variant="contained" onClick={() => void save()} disabled={saving}>{saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}</Button>
      </Box>
    </AppPage>
  );
}

function SettingsSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
      <Typography variant="h6" fontWeight={900}>{title}</Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>{description}</Typography>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>{children}</Box>
    </Paper>
  );
}

function emptyForm(options: StoreSettingsOptions): StoreForm {
  return {
    name: '', nameAr: '', nameEn: '', descriptionAr: '', descriptionEn: '', phone: '',
    country: options.defaultCountry, city: '', addressDetails: '', latitude: '', longitude: '',
    timezone: options.timezones[0] ?? 'Asia/Aden',
    workingHours: options.workingDays.map((day) => ({ day, isClosed: true, slots: [] })),
    socialLinks: Object.fromEntries(options.socialPlatforms.map((platform) => [platform, ''])),
  };
}

function toForm(settings: StoreSettings, options: StoreSettingsOptions): StoreForm {
  const byDay = new Map(settings.workingHours.map((day) => [day.day, day]));
  return {
    name: settings.name ?? '',
    nameAr: settings.nameAr ?? '',
    nameEn: settings.nameEn ?? '',
    descriptionAr: settings.descriptionAr ?? '',
    descriptionEn: settings.descriptionEn ?? '',
    phone: settings.phone ?? '',
    country: settings.country || options.defaultCountry,
    city: settings.city ?? '',
    addressDetails: settings.addressDetails ?? '',
    latitude: settings.latitude === null ? '' : String(settings.latitude),
    longitude: settings.longitude === null ? '' : String(settings.longitude),
    timezone: settings.timezone || options.timezones[0] || 'Asia/Aden',
    workingHours: options.workingDays.map((day) => byDay.get(day) ?? { day, isClosed: true, slots: [] }),
    socialLinks: Object.fromEntries(options.socialPlatforms.map((platform) => [platform, settings.socialLinks?.[platform] ?? ''])),
  };
}

function normalizeCurrencies(rows: StoreCurrency[]): StoreCurrency[] {
  const source = rows.length > 0 ? rows : [{ currencyCode: 'YER', yerPerUnit: 1, decimalDigits: 0, roundingIncrement: 1, isDefault: true, isActive: true }];
  return source.map((row) => ({
    ...row,
    yerPerUnit: row.currencyCode === 'YER' ? 1 : Number(row.yerPerUnit),
    decimalDigits: row.currencyCode === 'YER' ? 0 : Number(row.decimalDigits),
    roundingIncrement: row.currencyCode === 'YER' ? 1 : Number(row.roundingIncrement),
    isActive: true,
  }));
}

function optionalNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildAddress(form: StoreForm): string | null {
  const value = [form.country, form.city, form.addressDetails].map((part) => part.trim()).filter(Boolean).join('، ');
  return value || null;
}
