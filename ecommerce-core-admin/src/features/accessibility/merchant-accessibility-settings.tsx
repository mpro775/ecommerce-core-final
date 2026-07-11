import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Switch,
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { fetchWithCsrfRetry } from '../../lib/csrf';

const STORAGE_KEY = 'ecommerce_core.merchant.accessibility.preferences';
const SESSION_STORAGE_KEY = 'merchant.session.v1';

interface AccessibilityPreferences {
  highContrast: boolean;
  reducedMotion: boolean;
  fontScale: '100' | '115' | '130' | '150';
  underlineLinks: boolean;
  strongFocusRing: boolean;
}

const DEFAULT_PREFERENCES: AccessibilityPreferences = {
  highContrast: false,
  reducedMotion: false,
  fontScale: '100',
  underlineLinks: false,
  strongFocusRing: true,
};

const OPEN_ACCESSIBILITY_SETTINGS_EVENT = 'ecommerce_core:open-accessibility-settings';

export function openMerchantAccessibilitySettings(): void {
  window.dispatchEvent(new Event(OPEN_ACCESSIBILITY_SETTINGS_EVENT));
}

export function MerchantAccessibilitySettings() {
  const [open, setOpen] = useState(false);
  const [preferences, setPreferences] = useState<AccessibilityPreferences>(DEFAULT_PREFERENCES);
  const [syncMessage, setSyncMessage] = useState('');
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener(OPEN_ACCESSIBILITY_SETTINGS_EVENT, handleOpen);
    return () => {
      window.removeEventListener(OPEN_ACCESSIBILITY_SETTINGS_EVENT, handleOpen);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPreferences(): Promise<void> {
      const fallback = readStoredPreferences();
      if (fallback) {
        setPreferences(fallback);
      }

      const session = readMerchantSession();
      if (!session) {
        hasLoadedRef.current = true;
        setSyncMessage('يتم حفظ تفضيلات الوصول محليا حتى تسجل الدخول.');
        return;
      }

      try {
        const response = await fetchWithCsrfRetry(
          session.apiBaseUrl,
          `${session.apiBaseUrl}/me/accessibility-preferences`,
          {
            headers: { authorization: `Bearer ${session.accessToken}` },
            credentials: 'include',
          },
        );
        if (!response.ok) throw new Error('Unable to load preferences');
        const remote = normalizePreferences((await response.json()) as Partial<AccessibilityPreferences>);
        if (!cancelled) {
          setPreferences(remote);
          setSyncMessage('تم تحميل تفضيلات الوصول من حسابك.');
        }
      } catch {
        if (!cancelled) {
          setSyncMessage('تعذر تحميل تفضيلات الوصول من الخادم؛ سيتم استخدام النسخة المحلية.');
        }
      } finally {
        hasLoadedRef.current = true;
      }
    }

    loadPreferences().catch(() => {
      hasLoadedRef.current = true;
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    applyPreferenceClasses(preferences);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  }, [preferences]);

  useEffect(() => {
    if (!hasLoadedRef.current) return;

    const session = readMerchantSession();
    if (!session) {
      setSyncMessage('يتم حفظ تفضيلات الوصول محليا حتى تسجل الدخول.');
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetchWithCsrfRetry(
        session.apiBaseUrl,
        `${session.apiBaseUrl}/me/accessibility-preferences`,
        {
          method: 'PATCH',
          headers: {
            authorization: `Bearer ${session.accessToken}`,
            'content-type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(preferences),
          signal: controller.signal,
        },
      )
        .then((response) => {
          if (!response.ok) throw new Error('Unable to save preferences');
          setSyncMessage('تم حفظ تفضيلات الوصول في حسابك.');
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setSyncMessage('تعذر حفظ التفضيلات في الخادم؛ تم حفظها محليا.');
          }
        });
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [preferences]);

  function updatePreference<K extends keyof AccessibilityPreferences>(
    key: K,
    value: AccessibilityPreferences[K],
  ) {
    setPreferences((current) => ({ ...current, [key]: value }));
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        aria-labelledby="merchant-a11y-title"
        aria-describedby="merchant-a11y-description"
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle id="merchant-a11y-title">إعدادات الوصول</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 1.5, pt: 1 }}>
          <Box id="merchant-a11y-description" sx={{ color: 'text.secondary', fontSize: '0.86rem' }}>
            خصص تجربة لوحة التاجر واحفظها في حسابك عند توفر الاتصال.
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={preferences.highContrast}
                onChange={(event) => updatePreference('highContrast', event.target.checked)}
              />
            }
            label="تباين عال"
          />
          <FormControl fullWidth size="small">
            <InputLabel id="merchant-font-scale-label">حجم الخط</InputLabel>
            <Select
              labelId="merchant-font-scale-label"
              label="حجم الخط"
              value={preferences.fontScale}
              onChange={(event) =>
                updatePreference('fontScale', event.target.value as AccessibilityPreferences['fontScale'])
              }
            >
              <MenuItem value="100">100%</MenuItem>
              <MenuItem value="115">115%</MenuItem>
              <MenuItem value="130">130%</MenuItem>
              <MenuItem value="150">150%</MenuItem>
            </Select>
          </FormControl>
          <FormControlLabel
            control={
              <Switch
                checked={preferences.reducedMotion}
                onChange={(event) => updatePreference('reducedMotion', event.target.checked)}
              />
            }
            label="تقليل الحركة"
          />
          <FormControlLabel
            control={
              <Switch
                checked={preferences.underlineLinks}
                onChange={(event) => updatePreference('underlineLinks', event.target.checked)}
              />
            }
            label="إظهار خط تحت الروابط"
          />
          <FormControlLabel
            control={
              <Switch
                checked={preferences.strongFocusRing}
                onChange={(event) => updatePreference('strongFocusRing', event.target.checked)}
              />
            }
            label="مؤشر تركيز واضح"
          />
          <Box role="status" aria-live="polite" sx={{ color: 'text.secondary', fontSize: '0.82rem' }}>
            {syncMessage}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreferences(DEFAULT_PREFERENCES)}>إعادة الضبط</Button>
          <Button variant="contained" onClick={() => setOpen(false)}>
            إغلاق
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function normalizePreferences(input: Partial<AccessibilityPreferences> | null | undefined): AccessibilityPreferences {
  return {
    ...DEFAULT_PREFERENCES,
    ...(input ?? {}),
    fontScale: ['100', '115', '130', '150'].includes(String(input?.fontScale))
      ? (input?.fontScale as AccessibilityPreferences['fontScale'])
      : DEFAULT_PREFERENCES.fontScale,
  };
}

function readStoredPreferences(): AccessibilityPreferences | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? normalizePreferences(JSON.parse(stored) as Partial<AccessibilityPreferences>) : null;
  } catch {
    return null;
  }
}

function readMerchantSession(): { apiBaseUrl: string; accessToken: string } | null {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { apiBaseUrl?: string; accessToken?: string };
    if (!parsed.apiBaseUrl || !parsed.accessToken) return null;
    return {
      apiBaseUrl: parsed.apiBaseUrl.replace(/\/+$/, ''),
      accessToken: parsed.accessToken,
    };
  } catch {
    return null;
  }
}

function applyPreferenceClasses(preferences: AccessibilityPreferences): void {
  const targets = [document.documentElement, document.body, document.getElementById('root')].filter(
    (target): target is HTMLElement => Boolean(target),
  );

  for (const target of targets) {
    target.classList.toggle('a11y-high-contrast', preferences.highContrast);
    target.classList.toggle('a11y-reduced-motion', preferences.reducedMotion);
    target.classList.toggle('a11y-underline-links', preferences.underlineLinks);
    target.classList.toggle('a11y-strong-focus', preferences.strongFocusRing);
    target.classList.remove('a11y-font-100', 'a11y-font-115', 'a11y-font-130', 'a11y-font-150');
    target.classList.add(`a11y-font-${preferences.fontScale}`);
  }
}
