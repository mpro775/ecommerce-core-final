import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import type { MerchantRequester } from '../../merchant-dashboard.types';
import type { BootstrapStorePagesResponse, StorePage, StorePagesResponse } from '../../types';
import { AppPage, PageHeader } from '../../components/ui';
import { clearFieldErrors, isApiError, mapFieldErrors } from '../../../../lib/api-error';

interface StorePagesPanelProps {
  request: MerchantRequester;
}

type PageTemplateType = 'about' | 'contact' | 'shipping-policy' | 'return-policy' | 'privacy-policy' | 'terms' | 'faq';
type SystemPageKey = NonNullable<StorePage['pageKey']>;

const EMPTY_PAGE: Partial<StorePage> = {
  slug: '',
  pageType: 'custom',
  titleAr: '',
  titleEn: '',
  contentAr: '',
  contentEn: '',
  seoTitleAr: '',
  seoTitleEn: '',
  seoDescriptionAr: '',
  seoDescriptionEn: '',
  seoIndex: true,
  seoFollow: true,
  showInHeader: false,
  showInFooter: true,
  sortOrder: 0,
  status: 'draft',
};

const PAGE_TYPE_LABELS: Record<StorePage['pageType'], string> = {
  custom: 'صفحة مخصصة',
  about: 'من نحن',
  contact: 'تواصل معنا',
  faq: 'الأسئلة الشائعة',
  policy: 'سياسة',
};

const STATUS_LABELS: Record<StorePage['status'], string> = {
  draft: 'مسودة',
  published: 'منشورة',
  archived: 'مؤرشفة',
};

const TEMPLATE_LABELS: Record<PageTemplateType, string> = {
  about: 'من نحن',
  contact: 'تواصل معنا',
  'shipping-policy': 'سياسة الشحن',
  'return-policy': 'سياسة الإرجاع',
  'privacy-policy': 'سياسة الخصوصية',
  terms: 'الشروط والأحكام',
  faq: 'الأسئلة الشائعة',
};

const SYSTEM_PAGE_CARDS: Array<{ key: SystemPageKey; label: string; source: string }> = [
  { key: 'about', label: 'من نحن', source: 'تسحب من وصف المتجر العربي والإنجليزي.' },
  { key: 'contact', label: 'تواصل معنا', source: 'تسحب الهاتف، العنوان، روابط التواصل، وساعات العمل.' },
  { key: 'shipping_policy', label: 'سياسة الشحن', source: 'تسحب من shippingPolicy في إعدادات المتجر.' },
  { key: 'return_policy', label: 'سياسة الإرجاع', source: 'تسحب من returnPolicy في إعدادات المتجر.' },
  { key: 'privacy_policy', label: 'الخصوصية', source: 'تسحب من privacyPolicy في إعدادات المتجر.' },
  { key: 'terms', label: 'الشروط والأحكام', source: 'تسحب من termsAndConditions في إعدادات المتجر.' },
  { key: 'faq', label: 'الأسئلة الشائعة', source: 'صفحة أساسية جاهزة للأسئلة المتكررة.' },
];

export function StorePagesPanel({ request }: StorePagesPanelProps) {
  const [pages, setPages] = useState<StorePage[]>([]);
  const [storeName, setStoreName] = useState('متجرك');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<StorePage> | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateType, setTemplateType] = useState<PageTemplateType>('about');
  const [bootstrapping, setBootstrapping] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string }>({ type: 'info', text: '' });

  useEffect(() => {
    load().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load(): Promise<void> {
    setLoading(true);
    try {
      const [response, storeSettings] = await Promise.all([
        request<StorePagesResponse>('/merchant/pages'),
        request<{ name?: string | null; nameAr?: string | null }>('/store/settings').catch(() => null),
      ]);
      setPages(response?.items ?? []);
      setStoreName(storeSettings?.nameAr || storeSettings?.name || 'متجرك');
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'تعذر تحميل صفحات المتجر' });
    } finally {
      setLoading(false);
    }
  }

  async function save(): Promise<void> {
    if (!editing?.slug) {
      setFieldErrors({ slug: 'رابط الصفحة مطلوب.' });
      setMessage({ type: 'error', text: 'رابط الصفحة مطلوب.' });
      return;
    }

    const payload = { ...editing, sortOrder: Number(editing.sortOrder ?? 0) };
    setFieldErrors({});
    try {
      if (editing.id) {
        await request<StorePage>(`/merchant/pages/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      } else {
        await request<StorePage>('/merchant/pages', { method: 'POST', body: JSON.stringify(payload) });
      }
      setEditing(null);
      setMessage({ type: 'success', text: 'تم حفظ الصفحة بنجاح.' });
      await load();
    } catch (error) {
      if (isApiError(error)) {
        setFieldErrors(mapStorePageFieldErrors(error.fieldErrors));
      }
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'تعذر حفظ الصفحة' });
    }
  }

  async function publish(page: StorePage): Promise<void> {
    await request<StorePage>(`/merchant/pages/${page.id}/publish`, { method: 'PATCH' });
    setMessage({ type: 'success', text: 'تم نشر الصفحة.' });
    await load();
  }

  async function archive(page: StorePage): Promise<void> {
    await request<StorePage>(`/merchant/pages/${page.id}/archive`, { method: 'PATCH' });
    setMessage({ type: 'success', text: 'تمت أرشفة الصفحة.' });
    await load();
  }

  async function bootstrap(overwrite = false): Promise<void> {
    setBootstrapping(true);
    try {
      const response = await request<BootstrapStorePagesResponse>('/merchant/pages/bootstrap', {
        method: 'POST',
        body: JSON.stringify({ overwrite }),
      });
      const items = response?.items ?? [];
      const created = items.filter((item) => item.status === 'created').length;
      const updated = items.filter((item) => item.status === 'updated').length;
      setMessage({ type: 'success', text: `تم تجهيز صفحات المتجر. جديد: ${created}، محدث: ${updated}.` });
      await load();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'تعذر تجهيز صفحات المتجر من البيانات الحالية' });
    } finally {
      setBootstrapping(false);
    }
  }

  function update<K extends keyof StorePage>(key: K, value: StorePage[K]): void {
    setFieldErrors((current) => clearFieldErrors(current, [key]));
    setEditing((current) => ({ ...(current ?? EMPTY_PAGE), [key]: value }));
  }

  function openTemplate(): void {
    setEditing(buildTemplate(templateType, storeName));
    setTemplateOpen(false);
  }

  if (loading) {
    return (
      <AppPage maxWidth={1120}>
        <LinearProgress />
      </AppPage>
    );
  }

  return (
    <AppPage maxWidth={1120}>
      <PageHeader
        title="صفحات المتجر"
        description="أنشئ صفحات ثابتة مثل من نحن وسياسات الشحن والإرجاع. القوالب تملأ المحتوى وبيانات SEO الأساسية تلقائيًا."
        actions={(
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={() => setTemplateOpen(true)}>إنشاء صفحة من قالب</Button>
            <Button variant="outlined" disabled={bootstrapping} onClick={() => bootstrap(false).catch(() => undefined)}>تفعيل الصفحات الأساسية</Button>
            <Button variant="outlined" color="secondary" disabled={bootstrapping} onClick={() => bootstrap(true).catch(() => undefined)}>تحديث من بيانات المتجر</Button>
            <Button variant="contained" onClick={() => setEditing({ ...EMPTY_PAGE })}>إضافة صفحة</Button>
          </Stack>
        )}
      />
      {message.text ? <Alert severity={message.type}>{message.text}</Alert> : null}

      <Alert severity="info" sx={{ mb: 2 }}>
        هذه الصفحة مرتبطة ببيانات المتجر. يمكنك تعديلها يدوياً أو إعادة توليدها من البيانات الحالية.
      </Alert>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5, mb: 3 }}>
        {SYSTEM_PAGE_CARDS.map((card) => {
          const page = pages.find((item) => item.pageKey === card.key || item.slug === systemSlug(card.key));
          const missingData = !page || !(page.contentAr || page.contentEn);
          const status = !page ? 'غير مفعلة' : page.status === 'published' && !missingData ? 'مفعلة' : 'ناقصة بيانات';
          return (
            <Box key={card.key} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
              <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                  <Typography fontWeight={900}>{card.label}</Typography>
                  <Chip label={status} color={status === 'مفعلة' ? 'success' : status === 'ناقصة بيانات' ? 'warning' : 'default'} size="small" />
                </Stack>
                <Typography variant="body2" color="text.secondary">{card.source}</Typography>
                <Typography variant="body2" color="text.secondary">{page ? `/pages/${page.slug}` : `/pages/${systemSlug(card.key)}`}</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {!page || page.status !== 'published' ? <Button size="small" variant="contained" disabled={bootstrapping} onClick={() => bootstrap(false).catch(() => undefined)}>تفعيل</Button> : null}
                  <Button size="small" variant="outlined" disabled={bootstrapping} onClick={() => bootstrap(true).catch(() => undefined)}>تعبئة من بيانات المتجر</Button>
                  {page ? <Button size="small" variant="text" onClick={() => setEditing(page)}>تعديل يدوي</Button> : null}
                </Stack>
              </Stack>
            </Box>
          );
        })}
      </Box>

      <Box sx={{ display: 'grid', gap: 1.5 }}>
        {pages.length === 0 ? <Alert severity="info">لا توجد صفحات متجر حتى الآن.</Alert> : null}
        {pages.map((page) => (
          <Box key={page.id} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
              <Box>
                <Typography fontWeight={900}>{page.titleAr || page.titleEn || page.slug}</Typography>
                <Typography variant="body2" color="text.secondary">/pages/{page.slug} · {STATUS_LABELS[page.status]} · {PAGE_TYPE_LABELS[page.pageType]}</Typography>
                <Typography variant="body2" color="text.secondary">
                  SEO: {page.seoTitleAr || page.seoTitleEn ? 'العنوان مكتمل' : 'العنوان ناقص'} / {page.seoDescriptionAr || page.seoDescriptionEn ? 'الوصف مكتمل' : 'الوصف ناقص'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  الظهور في Google: {page.seoIndex ? 'مسموح' : 'ممنوع'} · الفوتر: {page.showInFooter ? 'ظاهر' : 'مخفي'}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" onClick={() => setEditing(page)}>تعديل</Button>
                {page.status === 'published'
                  ? <Button color="warning" onClick={() => archive(page).catch(() => undefined)}>أرشفة</Button>
                  : <Button color="success" onClick={() => publish(page).catch(() => undefined)}>نشر</Button>}
              </Stack>
            </Stack>
          </Box>
        ))}
      </Box>

      <Dialog open={templateOpen} onClose={() => setTemplateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>إنشاء صفحة من قالب</DialogTitle>
        <DialogContent>
          <TextField select fullWidth label="نوع الصفحة" value={templateType} onChange={(event) => setTemplateType(event.target.value as PageTemplateType)} sx={{ mt: 1 }}>
            {Object.entries(TEMPLATE_LABELS).map(([type, label]) => <MenuItem key={type} value={type}>{label}</MenuItem>)}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplateOpen(false)}>إلغاء</Button>
          <Button variant="contained" onClick={openTemplate}>استخدام القالب</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} maxWidth="md" fullWidth>
        <DialogTitle>{editing?.id ? 'تعديل صفحة' : 'إضافة صفحة جديدة'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField label="رابط الصفحة" value={editing?.slug ?? ''} error={Boolean(fieldErrors.slug)} onChange={(event) => update('slug', event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} fullWidth dir="ltr" helperText={fieldErrors.slug || 'مثال: shipping-policy ويظهر الرابط /pages/shipping-policy'} />
              <TextField select label="نوع الصفحة" value={editing?.pageType ?? 'custom'} error={Boolean(fieldErrors.pageType)} helperText={fieldErrors.pageType} onChange={(event) => update('pageType', event.target.value as StorePage['pageType'])} fullWidth>
                {Object.entries(PAGE_TYPE_LABELS).map(([type, label]) => <MenuItem key={type} value={type}>{label}</MenuItem>)}
              </TextField>
            </Stack>
            <TextField label="عنوان الصفحة بالعربي" value={editing?.titleAr ?? ''} error={Boolean(fieldErrors.titleAr)} helperText={fieldErrors.titleAr} onChange={(event) => update('titleAr', event.target.value)} />
            <TextField label="عنوان الصفحة بالإنجليزي" value={editing?.titleEn ?? ''} error={Boolean(fieldErrors.titleEn)} helperText={fieldErrors.titleEn} onChange={(event) => update('titleEn', event.target.value)} />
            <TextField label="محتوى الصفحة بالعربي" multiline minRows={5} value={editing?.contentAr ?? ''} error={Boolean(fieldErrors.contentAr)} helperText={fieldErrors.contentAr} onChange={(event) => update('contentAr', event.target.value)} />
            <TextField label="محتوى الصفحة بالإنجليزي" multiline minRows={4} value={editing?.contentEn ?? ''} error={Boolean(fieldErrors.contentEn)} helperText={fieldErrors.contentEn} onChange={(event) => update('contentEn', event.target.value)} />
            <TextField label="عنوان يظهر في نتائج البحث بالعربي" value={editing?.seoTitleAr ?? ''} error={Boolean(fieldErrors.seoTitleAr)} onChange={(event) => update('seoTitleAr', event.target.value)} helperText={fieldErrors.seoTitleAr || `${(editing?.seoTitleAr ?? '').length} / 70`} />
            <TextField label="وصف يظهر في نتائج البحث بالعربي" multiline minRows={2} value={editing?.seoDescriptionAr ?? ''} error={Boolean(fieldErrors.seoDescriptionAr)} onChange={(event) => update('seoDescriptionAr', event.target.value)} helperText={fieldErrors.seoDescriptionAr || `${(editing?.seoDescriptionAr ?? '').length} / 170`} />
            <TextField label="عنوان SEO إنجليزي" value={editing?.seoTitleEn ?? ''} error={Boolean(fieldErrors.seoTitleEn)} helperText={fieldErrors.seoTitleEn} onChange={(event) => update('seoTitleEn', event.target.value)} />
            <TextField label="وصف SEO إنجليزي" multiline minRows={2} value={editing?.seoDescriptionEn ?? ''} error={Boolean(fieldErrors.seoDescriptionEn)} helperText={fieldErrors.seoDescriptionEn} onChange={(event) => update('seoDescriptionEn', event.target.value)} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
              <Typography component="label">إظهار في Google <Switch checked={editing?.seoIndex ?? true} onChange={(event) => update('seoIndex', event.target.checked)} /></Typography>
              <Typography component="label">تتبع الروابط <Switch checked={editing?.seoFollow ?? true} onChange={(event) => update('seoFollow', event.target.checked)} /></Typography>
              <Typography component="label">إظهار في الفوتر <Switch checked={editing?.showInFooter ?? true} onChange={(event) => update('showInFooter', event.target.checked)} /></Typography>
              <Typography component="label">إظهار في الهيدر <Switch checked={editing?.showInHeader ?? false} onChange={(event) => update('showInHeader', event.target.checked)} /></Typography>
            </Stack>
            <TextField select label="حالة الصفحة" value={editing?.status ?? 'draft'} error={Boolean(fieldErrors.status)} helperText={fieldErrors.status} onChange={(event) => update('status', event.target.value as StorePage['status'])}>
              {Object.entries(STATUS_LABELS).map(([status, label]) => <MenuItem key={status} value={status}>{label}</MenuItem>)}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>إلغاء</Button>
          <Button variant="contained" onClick={() => save().catch(() => undefined)}>حفظ الصفحة</Button>
        </DialogActions>
      </Dialog>
    </AppPage>
  );
}

function buildTemplate(type: PageTemplateType, storeName: string): Partial<StorePage> {
  const base = {
    ...EMPTY_PAGE,
    slug: type,
    pageKey: templatePageKey(type),
    pageType: type === 'about' ? 'about' : type === 'contact' ? 'contact' : type === 'faq' ? 'faq' : 'policy',
    titleAr: TEMPLATE_LABELS[type],
    titleEn: englishTitle(type),
    showInFooter: true,
    status: 'published',
    seoIndex: true,
    seoFollow: true,
  } satisfies Partial<StorePage>;

  return {
    ...base,
    contentAr: arabicContent(type, storeName),
    contentEn: englishContent(type, storeName),
    seoTitleAr: `${TEMPLATE_LABELS[type]} - ${storeName}`,
    seoDescriptionAr: seoDescriptionAr(type, storeName),
    seoTitleEn: `${englishTitle(type)} - ${storeName}`,
    seoDescriptionEn: seoDescriptionEn(type, storeName),
  };
}

function templatePageKey(type: PageTemplateType): SystemPageKey {
  const map: Record<PageTemplateType, SystemPageKey> = {
    about: 'about',
    contact: 'contact',
    'shipping-policy': 'shipping_policy',
    'return-policy': 'return_policy',
    'privacy-policy': 'privacy_policy',
    terms: 'terms',
    faq: 'faq',
  };
  return map[type];
}

function arabicContent(type: PageTemplateType, storeName: string): string {
  const map: Record<PageTemplateType, string> = {
    about: `مرحبًا بك في ${storeName}. نعمل على تقديم منتجات مختارة بتفاصيل واضحة وتجربة طلب سهلة.`,
    contact: `يمكنك التواصل مع ${storeName} للاستفسار عن المنتجات والطلبات والدعم. سنرد عليك في أقرب وقت ممكن.`,
    'shipping-policy': `توضح هذه الصفحة طرق الشحن، مدة التوصيل، ورسوم الشحن المتاحة في ${storeName}. تختلف المدة حسب المدينة وطريقة الشحن.`,
    'return-policy': `يمكنك طلب الإرجاع أو الاستبدال حسب حالة المنتج وسياسة ${storeName}. يجب أن يكون المنتج بحالته الأصلية ما لم يوجد عيب واضح.`,
    'privacy-policy': `نحترم خصوصيتك في ${storeName}. نستخدم بياناتك لإتمام الطلبات وتحسين تجربة التسوق ولا نشاركها إلا حسب الحاجة لتقديم الخدمة.`,
    terms: `باستخدامك متجر ${storeName} فأنت توافق على شروط الاستخدام المتعلقة بالطلبات والدفع والشحن وسياسات المتجر.`,
    faq: `جمعنا هنا أكثر الأسئلة شيوعًا حول الطلبات والدفع والشحن في ${storeName}.`,
  };
  return map[type];
}

function englishContent(type: PageTemplateType, storeName: string): string {
  const map: Record<PageTemplateType, string> = {
    about: `Welcome to ${storeName}. We provide selected products with clear details and an easy ordering experience.`,
    contact: `Contact ${storeName} for product, order, and support questions. We will respond as soon as possible.`,
    'shipping-policy': `This page explains shipping methods, delivery time, and shipping fees at ${storeName}.`,
    'return-policy': `Returns and exchanges are handled according to product condition and ${storeName} policies.`,
    'privacy-policy': `${storeName} respects your privacy and uses your data to complete orders and improve shopping.`,
    terms: `By using ${storeName}, you agree to the store terms for orders, payment, shipping, and policies.`,
    faq: `Find common questions about orders, payment, and shipping at ${storeName}.`,
  };
  return map[type];
}

function seoDescriptionAr(type: PageTemplateType, storeName: string): string {
  if (type === 'shipping-policy') return `تعرف على طرق الشحن، مدة التوصيل، ورسوم الشحن في ${storeName}.`;
  if (type === 'return-policy') return `تعرف على سياسة الإرجاع والاستبدال في ${storeName} قبل إتمام الطلب.`;
  if (type === 'privacy-policy') return `تعرف على كيفية حماية بياناتك واستخدامها عند التسوق من ${storeName}.`;
  if (type === 'terms') return `اقرأ شروط وأحكام استخدام ${storeName} وسياسات الطلب والدفع والشحن.`;
  if (type === 'faq') return `إجابات واضحة على الأسئلة الشائعة حول الطلبات والشحن والدفع في ${storeName}.`;
  if (type === 'contact') return `تواصل مع ${storeName} للاستفسار عن المنتجات والطلبات وخدمة العملاء.`;
  return `تعرف على ${storeName} وتجربة التسوق والمنتجات المتاحة في المتجر.`;
}

function seoDescriptionEn(type: PageTemplateType, storeName: string): string {
  if (type === 'shipping-policy') return `Learn about shipping methods, delivery time, and shipping fees at ${storeName}.`;
  if (type === 'return-policy') return `Learn about returns and exchanges at ${storeName} before placing your order.`;
  if (type === 'privacy-policy') return `Learn how ${storeName} protects and uses your data while shopping.`;
  if (type === 'terms') return `Read ${storeName} terms for orders, payment, shipping, and store policies.`;
  if (type === 'faq') return `Clear answers to common order, shipping, and payment questions at ${storeName}.`;
  if (type === 'contact') return `Contact ${storeName} for products, orders, and customer support.`;
  return `Learn about ${storeName}, the shopping experience, and available products.`;
}

function englishTitle(type: PageTemplateType): string {
  const map: Record<PageTemplateType, string> = {
    about: 'About us',
    contact: 'Contact us',
    'shipping-policy': 'Shipping policy',
    'return-policy': 'Return policy',
    'privacy-policy': 'Privacy policy',
    terms: 'Terms and conditions',
    faq: 'FAQ',
  };
  return map[type];
}

function mapStorePageFieldErrors(fieldErrors: Record<string, string[]>): Record<string, string> {
  return mapFieldErrors(fieldErrors, {
    slug: ['slug'],
    pageType: ['pageType'],
    titleAr: ['titleAr'],
    titleEn: ['titleEn'],
    contentAr: ['contentAr'],
    contentEn: ['contentEn'],
    seoTitleAr: ['seoTitleAr'],
    seoTitleEn: ['seoTitleEn'],
    seoDescriptionAr: ['seoDescriptionAr'],
    seoDescriptionEn: ['seoDescriptionEn'],
    status: ['status'],
  });
}

function systemSlug(key: SystemPageKey): string {
  const map: Record<SystemPageKey, string> = {
    about: 'about',
    contact: 'contact',
    shipping_policy: 'shipping-policy',
    return_policy: 'return-policy',
    privacy_policy: 'privacy-policy',
    terms: 'terms',
    faq: 'faq',
  };
  return map[key];
}

