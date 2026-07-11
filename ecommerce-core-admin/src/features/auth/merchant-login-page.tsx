import {
  ArrowForwardIcon,
  CheckCircleOutlineIcon,
  LocalMallIcon,
  NotificationsActiveOutlinedIcon,
  PaymentsIcon,
  PeopleIcon,
  TrendingUpIcon,
  VerifiedUserIcon,
} from '../../components/icons';
import {
  Box,
  Button,
  Chip,
  LinearProgress,
  Paper,
  Stack,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import { MerchantLogin } from '../merchant/merchant-login';
import type { MerchantSession } from '../merchant/types';
import { ADMIN_TOKENS } from '../../theme/tokens';

interface MerchantLoginPageProps {
  onLoggedIn: (session: MerchantSession) => void;
  onBackHome: () => void;
}

const ecommerce_core_ICON_SRC = '/brand/ecommerce_core-icon.png';

const storeSignals = [
  { label: 'طلبات اليوم', value: '128', delta: '+18%', icon: LocalMallIcon, tone: 'success' },
  { label: 'رسائل العملاء', value: '42', delta: 'مباشر', icon: PeopleIcon, tone: 'info' },
  { label: 'مدفوعات مؤكدة', value: '96%', delta: 'آمن', icon: PaymentsIcon, tone: 'primary' },
  { label: 'تنبيهات ذكية', value: '7', delta: 'تحتاج متابعة', icon: NotificationsActiveOutlinedIcon, tone: 'warning' },
] as const;

const activityRows = [
  { title: 'طلب جديد من المتجر', meta: 'قبل دقيقة', progress: 82 },
  { title: 'حملة واتساب جاهزة للإرسال', meta: 'مجموعة العملاء النشطين', progress: 64 },
  { title: 'تحديث مخزون تلقائي', meta: 'منتجان بحاجة لمراجعة', progress: 46 },
] as const;

export function MerchantLoginPage({
  onLoggedIn,
  onBackHome,
}: MerchantLoginPageProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const primaryTint = alpha(theme.palette.primary.main, isDark ? 0.2 : 0.12);

  return (
    <Box
      component="section"
      dir="rtl"
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        overflowX: 'hidden',
        overflowY: 'auto',
        p: { xs: 2, md: 4 },
        position: 'relative',
        bgcolor: isDark ? 'background.default' : '#F3F0FA',
        backgroundImage: isDark
          ? `linear-gradient(135deg, ${alpha('#fff', 0.04)} 0%, transparent 36%), linear-gradient(155deg, ${alpha(theme.palette.primary.main, 0.12)} 0%, transparent 48%), linear-gradient(180deg, ${theme.palette.background.default} 0%, #111216 100%)`
          : `linear-gradient(135deg, ${alpha('#fff', 0.86)} 0%, transparent 38%), linear-gradient(155deg, ${primaryTint} 0%, transparent 48%), linear-gradient(180deg, #F9F7FE 0%, #E9F7FA 100%)`,
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
        '@keyframes loginPanelIn': {
          '0%': { opacity: 0, transform: 'translateY(18px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        '@keyframes loginFloat': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        '@keyframes loginPulse': {
          '0%, 100%': { boxShadow: `0 0 0 0 ${alpha(theme.palette.success.main, 0.28)}` },
          '50%': { boxShadow: `0 0 0 10px ${alpha(theme.palette.success.main, 0)}` },
        },
        '@keyframes loginSweep': {
          '0%': { transform: 'translateX(95%)' },
          '100%': { transform: 'translateX(-95%)' },
        },
        '@media (prefers-reduced-motion: reduce)': {
          '& .login-animated': {
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
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(420px, 0.9fr) minmax(0, 1.1fr)' },
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
          className="login-animated"
          sx={{
            animation: 'loginPanelIn 520ms ease-out both',
            minHeight: { xs: 'auto', lg: 640 },
            p: { xs: 2.5, sm: 4, md: 4.5 },
            borderRadius: { xs: '24px', md: '28px' },
            bgcolor: isDark ? ADMIN_TOKENS.surfaces.glassDark : alpha('#fff', 0.78),
            backdropFilter: 'blur(26px)',
            border: '1px solid',
            borderColor: alpha(theme.palette.common.white, isDark ? 0.12 : 0.78),
            boxShadow: isDark
              ? '0 24px 52px rgba(9, 7, 16, 0.3), inset 0 1px 0 rgba(255,255,255,0.04)'
              : '0 20px 50px rgba(80, 46, 145, 0.12)',
          }}
        >
          <Stack spacing={3.25} sx={{ minHeight: '100%', justifyContent: 'center' }}>
            <Button
              onClick={onBackHome}
              startIcon={<ArrowForwardIcon sx={{ mr: -1, ml: 1 }} />}
              sx={{ alignSelf: 'flex-start', color: 'text.secondary', px: 0.5 }}
            >
              العودة للرئيسية
            </Button>

            <Stack spacing={1.5} alignItems="center" textAlign="center">
              <Box
                sx={{
                  alignItems: 'center',
                  background: isDark
                    ? alpha(theme.palette.common.white, 0.06)
                    : `linear-gradient(180deg, #fff 0%, ${alpha(theme.palette.primary.light, 0.44)} 100%)`,
                  border: '1px solid',
                  borderColor: alpha(theme.palette.primary.main, isDark ? 0.22 : 0.14),
                  borderRadius: '22px',
                  boxShadow: `0 18px 34px ${alpha(theme.palette.primary.main, 0.16)}`,
                  display: 'grid',
                  height: 76,
                  placeItems: 'center',
                  width: 76,
                }}
              >
                <Box
                  component="img"
                  src={ecommerce_core_ICON_SRC}
                  alt="Ecommerce Core"
                  sx={{ height: 52, objectFit: 'contain', width: 52 }}
                />
              </Box>
              <Chip
                icon={<VerifiedUserIcon fontSize="small" />}
                label="دخول آمن للوحة التاجر"
                color="primary"
                variant="outlined"
                sx={{
                  bgcolor: alpha(theme.palette.primary.main, isDark ? 0.14 : 0.06),
                  fontWeight: 900,
                }}
              />
              <Typography
                variant="h4"
                sx={{
                  color: 'text.primary',
                  fontWeight: 950,
                  maxWidth: 420,
                }}
              >
                مرحبًا بعودتك إلى النظام
              </Typography>
              <Typography
                color="text.secondary"
                sx={{ maxWidth: 440, lineHeight: 1.85, fontWeight: 650 }}
              >
                ادخل إلى لوحة التحكم لإدارة الطلبات، العملاء، الحملات، والمدفوعات من مكان واحد واضح وسريع.
              </Typography>
            </Stack>

            <MerchantLogin onLoggedIn={onLoggedIn} />
          </Stack>
        </Paper>

        <Paper
          elevation={0}
          className="login-animated"
          sx={{
            animation: 'loginPanelIn 620ms ease-out 90ms both',
            display: { xs: 'block', lg: 'flex' },
            minHeight: { xs: 'auto', lg: 640 },
            overflow: 'hidden',
            p: { xs: 2.25, sm: 3, md: 4.5 },
            position: 'relative',
            borderRadius: { xs: '24px', md: '28px' },
            color: isDark ? 'text.primary' : '#211A32',
            background: isDark
              ? `linear-gradient(145deg, ${alpha(theme.palette.background.paper, 0.9)} 0%, ${alpha(theme.palette.primary.main, 0.08)} 100%)`
              : `linear-gradient(145deg, ${alpha('#fff', 0.82)} 0%, ${alpha(theme.palette.secondary.light, 0.44)} 100%)`,
            backdropFilter: 'blur(24px)',
            border: '1px solid',
            borderColor: alpha(theme.palette.common.white, isDark ? 0.1 : 0.58),
            boxShadow: isDark ? '0 24px 52px rgba(0, 0, 0, 0.26)' : 'none',
            '&::after': {
              animation: 'loginSweep 7s linear infinite',
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
          <Stack
            spacing={{ xs: 2.5, md: 3.25 }}
            justifyContent="center"
            sx={{ position: 'relative', zIndex: 1, width: '100%' }}
          >
            <Stack direction="row" spacing={1.25} alignItems="center">
              <Box
                className="login-animated"
                sx={{
                  animation: 'loginPulse 2.6s ease-in-out infinite',
                  bgcolor: theme.palette.success.main,
                  borderRadius: '50%',
                  height: 10,
                  width: 10,
                }}
              />
              <Typography variant="subtitle2" sx={{ color: 'text.secondary', fontWeight: 900 }}>
                متجرك يعمل الآن
              </Typography>
            </Stack>

            <Box>
              <Typography
                variant="h2"
                sx={{
                  color: 'text.primary',
                  fontSize: { xs: '1.9rem', md: '2.7rem' },
                  fontWeight: 950,
                  lineHeight: 1.22,
                  mb: 1.5,
                  maxWidth: 560,
                }}
              >
                لوحة واحدة لقرارات أسرع وتجربة تجارة أهدأ.
              </Typography>
              <Typography
                sx={{
                  color: 'text.secondary',
                  fontSize: { xs: '0.95rem', md: '1.04rem' },
                  fontWeight: 650,
                  lineHeight: 1.9,
                  maxWidth: 560,
                }}
              >
                صممنا الدخول ليكون بداية واضحة: أمان ظاهر، مؤشرات مختصرة، ومساحة عمل تشبه إيقاع التاجر اليومي.
              </Typography>
            </Box>

            <Box
              sx={{
                display: 'grid',
                gap: 1.5,
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              }}
            >
              {storeSignals.map((signal, index) => {
                const SignalIcon = signal.icon;
                const toneColor =
                  signal.tone === 'success'
                    ? theme.palette.success.main
                    : signal.tone === 'warning'
                      ? theme.palette.warning.main
                      : signal.tone === 'info'
                        ? theme.palette.info.main
                        : theme.palette.primary.main;

                return (
                  <Box
                    key={signal.label}
                    className="login-animated"
                    sx={{
                      animation: `loginFloat ${5.4 + index * 0.35}s ease-in-out ${index * 120}ms infinite`,
                      bgcolor: isDark ? alpha('#fff', 0.045) : alpha('#fff', 0.72),
                      border: '1px solid',
                      borderColor: alpha(toneColor, isDark ? 0.2 : 0.16),
                      borderRadius: '18px',
                      p: 2,
                    }}
                  >
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <Box
                        sx={{
                          alignItems: 'center',
                          bgcolor: alpha(toneColor, isDark ? 0.16 : 0.1),
                          borderRadius: '14px',
                          color: toneColor,
                          display: 'grid',
                          height: 42,
                          placeItems: 'center',
                          width: 42,
                        }}
                      >
                        <SignalIcon />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ color: 'text.secondary', fontWeight: 800 }}>
                          {signal.label}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="baseline">
                          <Typography variant="h5" sx={{ color: 'text.primary', fontWeight: 950 }}>
                            {signal.value}
                          </Typography>
                          <Typography variant="caption" sx={{ color: toneColor, fontWeight: 900 }}>
                            {signal.delta}
                          </Typography>
                        </Stack>
                      </Box>
                    </Stack>
                  </Box>
                );
              })}
            </Box>

            <Box
              sx={{
                bgcolor: isDark ? alpha('#fff', 0.045) : alpha('#fff', 0.76),
                border: '1px solid',
                borderColor: isDark ? alpha('#fff', 0.1) : alpha(theme.palette.primary.main, 0.12),
                borderRadius: '22px',
                p: { xs: 2, md: 2.5 },
              }}
            >
              <Stack spacing={2}>
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <TrendingUpIcon color="primary" />
                  <Typography variant="subtitle1" sx={{ fontWeight: 950 }}>
                    نبض التشغيل اليومي
                  </Typography>
                </Stack>
                {activityRows.map((row) => (
                  <Stack key={row.title} spacing={0.9}>
                    <Stack direction="row" spacing={1.5} justifyContent="space-between">
                      <Typography sx={{ color: 'text.primary', fontWeight: 800 }}>
                        {row.title}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800 }}>
                        {row.meta}
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={row.progress}
                      sx={{
                        bgcolor: alpha(theme.palette.primary.main, isDark ? 0.18 : 0.08),
                        borderRadius: 999,
                        height: 7,
                        '& .MuiLinearProgress-bar': {
                          background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                          borderRadius: 999,
                        },
                      }}
                    />
                  </Stack>
                ))}
              </Stack>
            </Box>

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.25}
              sx={{
                color: 'text.secondary',
                display: { xs: 'none', sm: 'flex' },
                fontWeight: 800,
              }}
            >
              {['جلسة مشفرة', 'تهيئة RTL كاملة', 'واجهة متوافقة مع الجوال'].map((text) => (
                <Stack key={text} direction="row" spacing={0.75} alignItems="center">
                  <CheckCircleOutlineIcon
                    fontSize="small"
                    sx={{ color: isDark ? theme.palette.secondary.main : theme.palette.primary.main }}
                  />
                  <Typography variant="body2" sx={{ fontWeight: 800 }}>
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
