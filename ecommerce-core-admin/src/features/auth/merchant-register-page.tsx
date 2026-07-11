import {
  ArrowForwardIcon,
  CheckCircleOutlineIcon,
  MarkEmailReadOutlinedIcon,
  PersonAddAlt1RoundedIcon,
  RocketLaunchIcon,
  StorefrontRoundedIcon,
  TrendingUpIcon,
  VerifiedUserIcon,
  Visibility,
  VisibilityOff,
} from '../../components/icons';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  InputAdornment,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import { requestJson } from '../../lib/http';
import { readStoredApiBaseUrl } from '../merchant/session-storage';
import type { AuthResult, MerchantSession } from '../merchant/types';

interface MerchantRegisterPageProps {
  onBackHome: () => void;
  onSignIn: () => void;
  onRegistered: (session: MerchantSession) => void;
}

interface OwnerRegistrationChallengeResult {
  challengeId: string;
  expiresAt: string;
  resendAvailableAt: string;
}

const PHONE_REGEX = /^\+?[0-9]{7,15}$/;

const launchSteps = [
  'أنشئ حساب المالك',
  'وثّق البريد برمز سريع',
  'ابدأ تجهيز هوية متجرك',
] as const;

const merchantPromises = [
  'واجهة إدارة عربية واضحة من أول يوم.',
  'كل طلب وعميل وحملة في مساحة واحدة.',
  'بداية مرتبة تساعدك تبيع بثقة أعلى.',
] as const;

export function MerchantRegisterPage({
  onBackHome,
  onSignIn,
  onRegistered,
}: MerchantRegisterPageProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [registrationChallenge, setRegistrationChallenge] = useState<{
    challengeId: string;
    expiresAtMs: number;
    resendAvailableAtMs: number;
  } | null>(null);
  const [clockNow, setClockNow] = useState(() => Date.now());

  const otpExpiresInSeconds = registrationChallenge
    ? Math.max(0, Math.ceil((registrationChallenge.expiresAtMs - clockNow) / 1000))
    : 0;

  const resendInSeconds = registrationChallenge
    ? Math.max(0, Math.ceil((registrationChallenge.resendAvailableAtMs - clockNow) / 1000))
    : 0;

  const launchProgress = useMemo(() => {
    if (registrationChallenge) {
      return 72;
    }

    const completedFields = [fullName.trim(), email.trim(), password, ownerPhone.trim()].filter(
      Boolean,
    ).length;
    return Math.max(18, completedFields * 16 + 18);
  }, [email, fullName, ownerPhone, password, registrationChallenge]);

  useEffect(() => {
    if (!registrationChallenge) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setClockNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [registrationChallenge]);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (registrationChallenge) {
      await onVerifyOtp();
      return;
    }
    await onStartRegistration();
  }

  async function onStartRegistration(): Promise<void> {
    const apiBaseUrl = readStoredApiBaseUrl();
    if (!apiBaseUrl) {
      setError('تعذر العثور على رابط API. اضبط VITE_API_BASE_URL قبل إنشاء الحساب.');
      return;
    }

    if (!fullName.trim() || !email.trim() || !password || !ownerPhone.trim()) {
      setError('أكمل جميع البيانات المطلوبة لبدء إنشاء حساب التاجر.');
      return;
    }

    if (!PHONE_REGEX.test(ownerPhone.trim())) {
      setError('رقم هاتف المالك غير صحيح. استخدم أرقامًا فقط ويمكنك إضافة + في البداية.');
      return;
    }

    setBusy(true);
    setError('');
    setInfoMessage('');

    try {
      const result = await requestJson<OwnerRegistrationChallengeResult>(
        `${apiBaseUrl}/auth/register-owner/start`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            fullName: fullName.trim(),
            email: email.trim(),
            password,
            ownerPhone: ownerPhone.trim(),
          }),
        },
      );

      if (!result) {
        throw new Error('تعذر بدء التسجيل. حاول مرة أخرى بعد قليل.');
      }

      setRegistrationChallenge({
        challengeId: result.challengeId,
        expiresAtMs: Date.parse(result.expiresAt),
        resendAvailableAtMs: Date.parse(result.resendAvailableAt),
      });
      setOtpCode('');
      setClockNow(Date.now());
      setInfoMessage('أرسلنا رمز التحقق إلى بريدك الإلكتروني. أنت قريب جدًا من تشغيل متجرك.');
    } catch (startError) {
      setError(
        startError instanceof Error ? startError.message : 'تعذر بدء التسجيل. حاول مرة أخرى.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function onVerifyOtp(): Promise<void> {
    const apiBaseUrl = readStoredApiBaseUrl();
    if (!apiBaseUrl || !registrationChallenge) {
      setError('جلسة التحقق غير موجودة. أعد بدء التسجيل.');
      return;
    }

    const normalizedOtp = otpCode.replace(/\D/g, '').slice(0, 6);
    if (!/^\d{6}$/.test(normalizedOtp)) {
      setError('رمز التحقق يجب أن يتكون من 6 أرقام.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const result = await requestJson<AuthResult>(`${apiBaseUrl}/auth/register-owner/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          challengeId: registrationChallenge.challengeId,
          otpCode: normalizedOtp,
        }),
      });

      if (!result) {
        throw new Error('تعذر إكمال التحقق. تأكد من الرمز وحاول مرة أخرى.');
      }

      onRegistered({
        apiBaseUrl,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
      });
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'فشل التحقق من الرمز.');
    } finally {
      setBusy(false);
    }
  }

  async function onResendOtp(): Promise<void> {
    const apiBaseUrl = readStoredApiBaseUrl();
    if (!apiBaseUrl || !registrationChallenge) {
      return;
    }

    setBusy(true);
    setError('');
    setInfoMessage('');

    try {
      const result = await requestJson<OwnerRegistrationChallengeResult>(
        `${apiBaseUrl}/auth/register-owner/resend-otp`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            challengeId: registrationChallenge.challengeId,
          }),
        },
      );

      if (!result) {
        throw new Error('تعذر إعادة إرسال رمز التحقق.');
      }

      setRegistrationChallenge({
        challengeId: result.challengeId,
        expiresAtMs: Date.parse(result.expiresAt),
        resendAvailableAtMs: Date.parse(result.resendAvailableAt),
      });
      setClockNow(Date.now());
      setInfoMessage('تم إرسال رمز تحقق جديد إلى بريدك الإلكتروني.');
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : 'تعذر إعادة إرسال الرمز.');
    } finally {
      setBusy(false);
    }
  }

  const fieldIconSx = {
    color: alpha(theme.palette.primary.main, isDark ? 0.86 : 0.74),
  };

  return (
    <Box
      component="section"
      dir="rtl"
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        overflowX: 'hidden',
        p: { xs: 2, md: 4 },
        position: 'relative',
        bgcolor: isDark ? 'background.default' : '#F3F0FA',
        backgroundImage: isDark
          ? `linear-gradient(135deg, ${alpha('#fff', 0.04)} 0%, transparent 36%), linear-gradient(155deg, ${alpha(theme.palette.primary.main, 0.13)} 0%, transparent 48%), linear-gradient(180deg, ${theme.palette.background.default} 0%, #111216 100%)`
          : `linear-gradient(135deg, ${alpha('#fff', 0.9)} 0%, transparent 38%), linear-gradient(155deg, ${alpha(theme.palette.primary.main, 0.12)} 0%, transparent 48%), linear-gradient(180deg, #F9F7FE 0%, #E9F7FA 100%)`,
        '&::before': {
          backgroundImage: `linear-gradient(${alpha(theme.palette.primary.main, 0.1)} 1px, transparent 1px), linear-gradient(90deg, ${alpha(theme.palette.primary.main, 0.1)} 1px, transparent 1px)`,
          backgroundSize: '42px 42px',
          content: '""',
          inset: 0,
          maskImage: 'linear-gradient(180deg, transparent, #000 18%, #000 72%, transparent)',
          opacity: isDark ? 0.18 : 0.28,
          pointerEvents: 'none',
          position: 'absolute',
        },
        '@keyframes registerPanelIn': {
          '0%': { opacity: 0, transform: 'translateY(18px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        '@keyframes registerFloat': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-7px)' },
        },
        '@keyframes registerSweep': {
          '0%': { transform: 'translateX(95%)' },
          '100%': { transform: 'translateX(-95%)' },
        },
        '@media (prefers-reduced-motion: reduce)': {
          '& .register-animated': {
            animation: 'none',
            transform: 'none',
          },
        },
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: 1240,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(430px, 0.95fr) minmax(0, 1.05fr)' },
          gap: { xs: 2, lg: 2 },
          alignItems: 'stretch',
          position: 'relative',
          zIndex: 1,
          p: { xs: 0, lg: 1 },
          border: { xs: 'none', lg: '1px solid' },
          borderColor: {
            lg: isDark ? alpha(theme.palette.common.white, 0.1) : alpha('#fff', 0.72),
          },
          borderRadius: { xs: 0, lg: '36px' },
          bgcolor: {
            xs: 'transparent',
            lg: isDark ? alpha(theme.palette.background.paper, 0.28) : alpha('#fff', 0.28),
          },
          boxShadow: {
            xs: 'none',
            lg: isDark ? '0 24px 52px rgba(0,0,0,0.22)' : '0 30px 80px rgba(80, 46, 145, 0.12)',
          },
        }}
      >
        <Paper
          elevation={0}
          className="register-animated"
          sx={{
            animation: 'registerPanelIn 520ms ease-out both',
            minHeight: { xs: 'auto', lg: 690 },
            p: { xs: 2.5, sm: 4, md: 4.5 },
            borderRadius: { xs: '24px', md: '28px' },
            bgcolor: isDark ? 'rgba(23, 24, 27, 0.82)' : alpha('#fff', 0.8),
            backdropFilter: 'blur(26px)',
            border: '1px solid',
            borderColor: alpha(theme.palette.common.white, isDark ? 0.12 : 0.78),
            boxShadow: isDark
              ? '0 24px 52px rgba(9, 7, 16, 0.3), inset 0 1px 0 rgba(255,255,255,0.04)'
              : '0 20px 50px rgba(80, 46, 145, 0.12)',
          }}
        >
          <Stack spacing={2.6} sx={{ minHeight: '100%', justifyContent: 'center' }}>
            <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
              <Button
                onClick={onBackHome}
                startIcon={<ArrowForwardIcon sx={{ mr: -1, ml: 1 }} />}
                sx={{ color: 'text.secondary', px: 0.5 }}
              >
                العودة للرئيسية
              </Button>
              <Button variant="text" onClick={onSignIn}>
                لدي حساب بالفعل
              </Button>
            </Stack>

            <Stack spacing={1.25}>
              <Chip
                icon={<RocketLaunchIcon fontSize="small" />}
                label={registrationChallenge ? 'خطوة التحقق الأخيرة' : 'ابدأ متجرك الآن'}
                color="primary"
                variant="outlined"
                sx={{
                  alignSelf: 'flex-start',
                  bgcolor: alpha(theme.palette.primary.main, isDark ? 0.14 : 0.06),
                  fontWeight: 900,
                }}
              />
              <Typography variant="h4" sx={{ color: 'text.primary', fontWeight: 950 }}>
                {registrationChallenge ? 'وثّق بريدك وأطلق البداية' : 'إنشاء حساب التاجر'}
              </Typography>
              <Typography color="text.secondary" sx={{ maxWidth: 520, lineHeight: 1.85, fontWeight: 650 }}>
                {registrationChallenge
                  ? 'أدخل رمز التحقق، وبعدها تنتقل مباشرة إلى لوحة النظام لتجهيز متجرك بثقة.'
                  : 'املأ بيانات المالك، وسنرسل رمز تحقق سريع. كل حقل تقطعه هنا يقرب متجرك خطوة من البيع.'}
              </Typography>
            </Stack>

            <Box
              sx={{
                bgcolor: alpha(theme.palette.primary.main, isDark ? 0.12 : 0.06),
                border: '1px solid',
                borderColor: alpha(theme.palette.primary.main, isDark ? 0.2 : 0.12),
                borderRadius: '18px',
                p: 2,
              }}
            >
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" sx={{ fontWeight: 900 }}>
                    جاهزية الانطلاق
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 900 }}>
                    {launchProgress}%
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={launchProgress}
                  sx={{
                    bgcolor: alpha(theme.palette.primary.main, isDark ? 0.18 : 0.1),
                    borderRadius: 999,
                    height: 8,
                    '& .MuiLinearProgress-bar': {
                      background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                      borderRadius: 999,
                    },
                  }}
                />
              </Stack>
            </Box>

            {error ? (
              <Alert severity="error" sx={{ fontWeight: 700 }}>
                {error}
              </Alert>
            ) : null}
            {infoMessage ? (
              <Alert severity="success" sx={{ fontWeight: 700 }}>
                {infoMessage}
              </Alert>
            ) : null}

            <Box component="form" onSubmit={onSubmit}>
              {!registrationChallenge ? (
                <Stack spacing={2}>
                  <TextField
                    label="الاسم الكامل"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    required
                    autoComplete="name"
                    placeholder="اسم مالك المتجر"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <PersonAddAlt1RoundedIcon fontSize="small" sx={fieldIconSx} />
                        </InputAdornment>
                      ),
                    }}
                  />
                  <TextField
                    label="البريد الإلكتروني"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    autoComplete="email"
                    placeholder="name@example.com"
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
                    autoComplete="new-password"
                    placeholder="8 أحرف على الأقل"
                    inputProps={{ minLength: 8 }}
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
                            onClick={() => setShowPassword((prev) => !prev)}
                            edge="end"
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                  <TextField
                    label="رقم هاتف المالك"
                    value={ownerPhone}
                    onChange={(event) => setOwnerPhone(event.target.value)}
                    required
                    autoComplete="tel"
                    placeholder="+9677xxxxxxx"
                    inputProps={{ dir: 'ltr' }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <VerifiedUserIcon fontSize="small" sx={fieldIconSx} />
                        </InputAdornment>
                      ),
                    }}
                  />
                  <Button type="submit" variant="contained" size="large" disabled={busy} sx={{ minHeight: 48 }}>
                    {busy ? 'جار إرسال رمز التحقق...' : 'إرسال رمز التحقق'}
                  </Button>
                </Stack>
              ) : (
                <Stack spacing={2}>
                  <Alert severity={otpExpiresInSeconds > 0 ? 'info' : 'warning'} sx={{ fontWeight: 700 }}>
                    {otpExpiresInSeconds > 0
                      ? `الرمز صالح لمدة ${formatCountdown(otpExpiresInSeconds)}`
                      : 'انتهت صلاحية الرمز. أعد الإرسال للمتابعة.'}
                  </Alert>
                  <TextField
                    label="رمز التحقق (6 أرقام)"
                    value={otpCode}
                    onChange={(event) =>
                      setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    placeholder="000000"
                    inputProps={{ maxLength: 6, dir: 'ltr' }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <VerifiedUserIcon fontSize="small" sx={fieldIconSx} />
                        </InputAdornment>
                      ),
                    }}
                  />
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={busy || otpExpiresInSeconds <= 0}
                      sx={{ flex: 1 }}
                    >
                      {busy ? 'جار التحقق...' : 'تأكيد وإنشاء المتجر'}
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => onResendOtp().catch(() => undefined)}
                      disabled={busy || resendInSeconds > 0}
                      sx={{ flex: 1 }}
                    >
                      {resendInSeconds > 0
                        ? `إعادة الإرسال بعد ${formatCountdown(resendInSeconds)}`
                        : 'إعادة إرسال الرمز'}
                    </Button>
                  </Stack>
                  <Button
                    variant="text"
                    onClick={() => {
                      setRegistrationChallenge(null);
                      setOtpCode('');
                      setError('');
                      setInfoMessage('');
                    }}
                    disabled={busy}
                  >
                    تعديل بيانات التسجيل
                  </Button>
                </Stack>
              )}
            </Box>
          </Stack>
        </Paper>

        <Paper
          elevation={0}
          className="register-animated"
          sx={{
            animation: 'registerPanelIn 620ms ease-out 90ms both',
            minHeight: { xs: 'auto', lg: 690 },
            overflow: 'hidden',
            p: { xs: 2.25, sm: 3, md: 4.5 },
            position: 'relative',
            borderRadius: { xs: '24px', md: '28px' },
            background: isDark
              ? `linear-gradient(145deg, ${alpha(theme.palette.background.paper, 0.9)} 0%, ${alpha(theme.palette.primary.main, 0.08)} 100%)`
              : `linear-gradient(145deg, ${alpha('#fff', 0.84)} 0%, ${alpha(theme.palette.secondary.light, 0.48)} 100%)`,
            backdropFilter: 'blur(24px)',
            border: '1px solid',
            borderColor: alpha(theme.palette.common.white, isDark ? 0.1 : 0.58),
            '&::after': {
              animation: 'registerSweep 7s linear infinite',
              background: `linear-gradient(90deg, transparent, ${alpha(theme.palette.secondary.main, isDark ? 0.1 : 0.18)}, transparent)`,
              content: '""',
              height: '100%',
              insetBlockStart: 0,
              insetInlineStart: 0,
              pointerEvents: 'none',
              position: 'absolute',
              transform: 'translateX(95%)',
              width: '34%',
            },
          }}
        >
          <Stack spacing={3} justifyContent="center" sx={{ height: '100%', position: 'relative', zIndex: 1 }}>
            <Box>
              <Typography
                variant="h2"
                sx={{
                  color: 'text.primary',
                  fontSize: { xs: '1.9rem', md: '2.65rem' },
                  fontWeight: 950,
                  lineHeight: 1.22,
                  mb: 1.5,
                  maxWidth: 590,
                }}
              >
                أول صفحة في قصة متجرك تبدأ من هنا.
              </Typography>
              <Typography
                sx={{
                  color: 'text.secondary',
                  fontSize: { xs: '0.95rem', md: '1.04rem' },
                  fontWeight: 650,
                  lineHeight: 1.9,
                  maxWidth: 590,
                }}
              >
                أنشئ حسابك اليوم، واترك لالنظام يرتب لك مساحة تشغيل تساعدك تتابع الطلبات وتفهم العملاء وتكبر بثبات.
              </Typography>
            </Box>

            <Box
              className="register-animated"
              sx={{
                animation: 'registerFloat 5.4s ease-in-out infinite',
                bgcolor: isDark ? alpha('#fff', 0.05) : alpha('#fff', 0.78),
                border: '1px solid',
                borderColor: alpha(theme.palette.primary.main, isDark ? 0.18 : 0.12),
                borderRadius: '24px',
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  bgcolor: alpha(theme.palette.primary.main, isDark ? 0.18 : 0.08),
                  borderBottom: '1px solid',
                  borderColor: alpha(theme.palette.primary.main, isDark ? 0.18 : 0.1),
                  p: 2,
                }}
              >
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <Box
                    sx={{
                      alignItems: 'center',
                      bgcolor: alpha(theme.palette.primary.main, 0.12),
                      borderRadius: '16px',
                      color: 'primary.main',
                      display: 'grid',
                      height: 46,
                      placeItems: 'center',
                      width: 46,
                    }}
                  >
                    <StorefrontRoundedIcon />
                  </Box>
                  <Box>
                    <Typography sx={{ color: 'text.primary', fontWeight: 950 }}>
                      متجر جاهز للانطلاق
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      منتجات، طلبات، عملاء، وتقارير في لوحة واحدة.
                    </Typography>
                  </Box>
                </Stack>
              </Box>

              <Box sx={{ p: 2.25 }}>
                <Box
                  sx={{
                    display: 'grid',
                    gap: 1.25,
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    mb: 2.25,
                  }}
                >
                  {[
                    ['طلبات', '24'],
                    ['عملاء', '183'],
                    ['نمو', '+31%'],
                  ].map(([label, value]) => (
                    <Box
                      key={label}
                      sx={{
                        bgcolor: isDark ? alpha('#fff', 0.04) : alpha('#fff', 0.82),
                        border: '1px solid',
                        borderColor: alpha(theme.palette.primary.main, isDark ? 0.16 : 0.1),
                        borderRadius: '16px',
                        p: 1.5,
                        textAlign: 'center',
                      }}
                    >
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                        {label}
                      </Typography>
                      <Typography sx={{ color: 'text.primary', fontWeight: 950 }}>{value}</Typography>
                    </Box>
                  ))}
                </Box>

                <Stack spacing={1.2}>
                  {launchSteps.map((step, index) => (
                    <Stack key={step} direction="row" spacing={1.25} alignItems="center">
                      <Box
                        sx={{
                          alignItems: 'center',
                          bgcolor:
                            index === 0 || registrationChallenge
                              ? alpha(theme.palette.success.main, 0.12)
                              : alpha(theme.palette.primary.main, 0.08),
                          borderRadius: '50%',
                          color:
                            index === 0 || registrationChallenge
                              ? theme.palette.success.main
                              : theme.palette.primary.main,
                          display: 'grid',
                          height: 30,
                          placeItems: 'center',
                          width: 30,
                        }}
                      >
                        <CheckCircleOutlineIcon fontSize="small" />
                      </Box>
                      <Typography sx={{ color: 'text.primary', fontWeight: 850 }}>{step}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            </Box>

            <Box
              sx={{
                display: 'grid',
                gap: 1.25,
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
              }}
            >
              {merchantPromises.map((text, index) => (
                <Box
                  key={text}
                  className="register-animated"
                  sx={{
                    animation: `registerFloat ${5.6 + index * 0.35}s ease-in-out ${index * 120}ms infinite`,
                    bgcolor: isDark ? alpha('#fff', 0.045) : alpha('#fff', 0.72),
                    border: '1px solid',
                    borderColor: alpha(theme.palette.primary.main, isDark ? 0.16 : 0.1),
                    borderRadius: '18px',
                    p: 2,
                  }}
                >
                  <Stack spacing={1}>
                    <TrendingUpIcon color="primary" fontSize="small" />
                    <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 850 }}>
                      {text}
                    </Typography>
                  </Stack>
                </Box>
              ))}
            </Box>

            <Divider />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
              {['بدون تعقيد', 'تحقق سريع', 'جاهز للجوال'].map((text) => (
                <Stack key={text} direction="row" spacing={0.75} alignItems="center">
                  <CheckCircleOutlineIcon
                    fontSize="small"
                    sx={{ color: isDark ? theme.palette.secondary.main : theme.palette.primary.main }}
                  />
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 800 }}>
                    {text}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}

function formatCountdown(seconds: number): string {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remain = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remain).padStart(2, '0')}`;
}
