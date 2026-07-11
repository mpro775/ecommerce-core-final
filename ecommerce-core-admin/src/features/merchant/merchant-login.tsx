import {
  MarkEmailReadOutlinedIcon,
  VerifiedUserIcon,
  Visibility,
  VisibilityOff,
} from '../../components/icons';
import { FormEvent, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Link,
  Stack,
  TextField,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import { requestJson } from '../../lib/http';
import { readStoredApiBaseUrl } from './session-storage';
import type { AuthResult, MerchantSession } from './types';

interface MerchantLoginProps {
  onLoggedIn: (session: MerchantSession) => void;
}

export function MerchantLogin({ onLoggedIn }: MerchantLoginProps) {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const trimmedApiBaseUrl = readStoredApiBaseUrl();
    if (!trimmedApiBaseUrl) {
      setError('تعذر العثور على رابط API. اضبط VITE_API_BASE_URL قبل تسجيل الدخول.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const result = await requestJson<AuthResult>(`${trimmedApiBaseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      if (!result) {
        throw new Error('تعذر تسجيل الدخول. تأكد من صحة البريد الإلكتروني وكلمة المرور.');
      }

      onLoggedIn({
        apiBaseUrl: trimmedApiBaseUrl,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
      });
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : 'تعذر تسجيل الدخول. حاول مرة أخرى بعد قليل.',
      );
    } finally {
      setBusy(false);
    }
  }

  const fieldIconSx = {
    color: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.86 : 0.74),
  };

  return (
    <Box component="form" onSubmit={onSubmit} sx={{ width: '100%' }}>
      <Stack spacing={2.25}>
        {error ? (
          <Alert
            severity="error"
            sx={{
              alignItems: 'center',
              border: '1px solid',
              borderColor: alpha(theme.palette.error.main, 0.18),
              fontWeight: 700,
            }}
          >
            {error}
          </Alert>
        ) : null}

        <TextField
          label="البريد الإلكتروني"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          placeholder="name@example.com"
          autoComplete="email"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <MarkEmailReadOutlinedIcon fontSize="small" sx={fieldIconSx} />
              </InputAdornment>
            ),
          }}
        />

        <TextField
          label="كلمة المرور"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          placeholder="أدخل كلمة المرور"
          autoComplete="current-password"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <VerifiedUserIcon fontSize="small" sx={fieldIconSx} />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  onClick={() => setShowPassword((current) => !current)}
                  edge="end"
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={{ xs: 0.75, sm: 1.5 }}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="space-between"
          sx={{ mt: -0.5 }}
        >
          <FormControlLabel
            control={
              <Checkbox
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                size="small"
              />
            }
            label={
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                تذكرني على هذا الجهاز
              </Typography>
            }
            sx={{ m: 0, color: 'text.secondary' }}
          />

          <Link
            component="button"
            type="button"
            underline="none"
            disabled
            sx={{
              alignSelf: { xs: 'flex-start', sm: 'center' },
              color: 'text.disabled',
              cursor: 'not-allowed',
              fontWeight: 800,
            }}
          >
            نسيت كلمة المرور؟ قريبًا
          </Link>
        </Stack>

        <Button
          variant="contained"
          color="primary"
          type="submit"
          disabled={busy}
          size="large"
          sx={{
            minHeight: 48,
            mt: 0.5,
            overflow: 'hidden',
            position: 'relative',
            '&::after': busy
              ? {
                  animation: 'loginButtonSweep 1.25s ease-in-out infinite',
                  background:
                    'linear-gradient(90deg, transparent, rgba(255,255,255,0.24), transparent)',
                  content: '""',
                  inset: 0,
                  position: 'absolute',
                  transform: 'translateX(110%)',
                }
              : undefined,
            '@keyframes loginButtonSweep': {
              '0%': { transform: 'translateX(110%)' },
              '100%': { transform: 'translateX(-110%)' },
            },
            '@media (prefers-reduced-motion: reduce)': {
              '&::after': { animation: 'none' },
            },
          }}
          fullWidth
        >
          <Box component="span" sx={{ minWidth: 112, position: 'relative', zIndex: 1 }}>
            {busy ? 'جار تسجيل الدخول...' : 'تسجيل الدخول'}
          </Box>
        </Button>
      </Stack>
    </Box>
  );
}
