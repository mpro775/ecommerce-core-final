import {
  DarkModeOutlinedIcon,
  KeyboardArrowDownIcon,
  LightModeOutlinedIcon,
  LogoutIcon,
  MenuIcon,
  NotificationsIcon,
  PeopleIcon,
  StorefrontIcon,
  TuneIcon,
} from '../../../../components/icons';
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Button,
  Divider,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useState, type MouseEvent } from 'react';
import type { MerchantSession } from '../../types';
import type { MerchantRequester } from '../../merchant-dashboard.types';
import { ADMIN_TOKENS } from '../../../../theme/tokens';
import { MerchantNotificationsMenu } from '../notifications/merchant-notifications-menu';
import { openMerchantAccessibilitySettings } from '../../../accessibility/merchant-accessibility-settings';

interface MerchantTopBarProps {
  activeLabel: string;
  session: MerchantSession;

  storeName?: string | null;
  storeLogoUrl?: string | null;
  themeMode: 'light' | 'dark';
  showNavigationToggle: boolean;
  userMenuAnchorEl: HTMLElement | null;
  onToggleThemeMode: (origin?: { x: number; y: number }) => void;
  onOpenNavigation: () => void;
  onOpenUserMenu: (event: MouseEvent<HTMLElement>) => void;
  onCloseUserMenu: () => void;
  onGoToStoreSettings: () => void;
  onGoToStaff: () => void;
  notificationUnreadCount?: number;
  onOpenNotifications: () => void;
  request: MerchantRequester;
  notificationRealtimeVersion?: number;
  onSignOut: () => void;
}

const ecommerce_core_ICON_SRC = '/brand/ecommerce_core-icon.png';

export function MerchantTopBar({
  activeLabel,
  session,

  storeName,
  storeLogoUrl,
  themeMode,
  showNavigationToggle,
  userMenuAnchorEl,
  onToggleThemeMode,
  onOpenNavigation,
  onOpenUserMenu,
  onCloseUserMenu,
  onGoToStoreSettings,
  onGoToStaff,
  notificationUnreadCount = 0,
  onOpenNotifications,
  request,
  notificationRealtimeVersion = 0,
  onSignOut,
}: MerchantTopBarProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [notificationAnchorEl, setNotificationAnchorEl] = useState<HTMLElement | null>(null);
  const radius = ADMIN_TOKENS.radius;
  const glassSurface = alpha(theme.palette.background.paper, isDark ? 0.86 : 0.7);
  const controlSurface = alpha(theme.palette.background.paper, isDark ? 0.54 : 0.72);
  const controlBorder = alpha(theme.palette.divider, isDark ? 0.82 : 0.86);
  const controlHover = isDark
    ? alpha(theme.palette.common.white, 0.07)
    : alpha(theme.palette.primary.main, 0.08);
  const resolvedStoreName = storeName?.trim() || 'متجرك';
  const resolvedLogoSrc = storeLogoUrl?.trim() || ecommerce_core_ICON_SRC;

  function handleToggleThemeMode(event: MouseEvent<HTMLButtonElement>): void {
    const rect = event.currentTarget.getBoundingClientRect();
    onToggleThemeMode({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
  }

  return (
    <AppBar
      position="static"
      elevation={0}
      sx={{
        color: 'text.primary',
        bgcolor: glassSurface,
        backgroundImage: isDark
          ? `linear-gradient(180deg, ${alpha(theme.palette.common.white, 0.035)} 0%, ${alpha(theme.palette.background.paper, 0.74)} 100%)`
          : `linear-gradient(180deg, rgba(255,255,255,0.72) 0%, ${alpha(theme.palette.primary.light, 0.4)} 100%)`,
        borderBottom: '1px solid',
        borderColor: controlBorder,
        backdropFilter: 'blur(24px)',
        boxShadow: isDark
          ? '0 12px 30px rgba(9, 7, 16, 0.14), inset 0 1px 0 rgba(255,255,255,0.04)'
          : '0 12px 28px rgba(80, 46, 145, 0.05)',
        zIndex: 'auto',
      }}
    >
      <Toolbar
        sx={{
          justifyContent: 'space-between',
          minHeight: { xs: 62, md: 68 },
          px: { xs: 1.25, md: 2.5, xl: 3 },
          gap: 1.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          {showNavigationToggle ? (
            <IconButton
              color="inherit"
              aria-label="فتح التنقل"
              edge="start"
              onClick={onOpenNavigation}
              sx={{
                width: 40,
                height: 40,
                marginInlineEnd: 0.25,
                borderRadius: `${radius.md}px`,
                border: '1px solid',
                borderColor: controlBorder,
                bgcolor: controlSurface,
                '&:hover': {
                  bgcolor: controlHover,
                  borderColor: isDark
                    ? alpha(theme.palette.common.white, 0.16)
                    : alpha(theme.palette.primary.main, 0.22),
                },
              }}
            >
              <MenuIcon />
            </IconButton>
          ) : null}

          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: `${radius.lg}px`,
              display: { xs: 'none', sm: 'grid', lg: 'none' },
              placeItems: 'center',
              border: '1px solid',
              borderColor: isDark
                ? alpha(theme.palette.common.white, 0.12)
                : alpha(theme.palette.primary.main, 0.16),
              bgcolor: alpha(theme.palette.background.paper, isDark ? 0.66 : 0.72),
              boxShadow: isDark
                ? '0 10px 22px rgba(9, 7, 16, 0.18)'
                : '0 10px 22px rgba(80, 46, 145, 0.08)',
            }}
          >
            <Box
              component="img"
              src={resolvedLogoSrc}
              alt={resolvedStoreName}
              sx={{
                width: 27,
                height: 27,
                objectFit: 'contain',
                filter: `drop-shadow(0 6px 12px ${alpha(theme.palette.primary.main, 0.16)})`,
              }}
            />
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                display: { xs: 'none', md: 'block', lg: 'none' },
                fontWeight: 700,
                lineHeight: 1.2,
              }}
            >
              لوحة التاجر
            </Typography>
            <Typography
              variant="h6"
              noWrap
              component="div"
              sx={{
                color: 'text.primary',
                fontSize: { xs: '0.95rem', md: '1rem' },
                fontWeight: 800,
                letterSpacing: 0,
                lineHeight: 1.25,
                maxWidth: { xs: 150, sm: 240, md: 420 },
              }}
            >
              {activeLabel}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, md: 0.75 } }}>
          <Tooltip title={themeMode === 'dark' ? 'الوضع الفاتح' : 'الوضع الليلي'}>
            <IconButton
              onClick={handleToggleThemeMode}
              aria-label={themeMode === 'dark' ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الليلي'}
              sx={{
                width: { xs: 40, md: 44 },
                height: { xs: 40, md: 44 },
                border: '1px solid',
                borderColor: isDark
                  ? alpha(theme.palette.common.white, 0.14)
                  : alpha(theme.palette.primary.main, 0.14),
                bgcolor: isDark
                  ? alpha(theme.palette.common.white, 0.06)
                  : alpha(theme.palette.background.paper, 0.72),
                color: isDark ? 'primary.main' : 'warning.main',
                boxShadow: isDark
                  ? 'inset 0 1px 0 rgba(255,255,255,0.04)'
                  : '0 8px 18px rgba(80,46,145,0.08)',
                '&:hover': {
                  bgcolor: isDark
                    ? alpha(theme.palette.common.white, 0.1)
                    : alpha(theme.palette.primary.light, 0.32),
                  borderColor: isDark
                    ? alpha(theme.palette.common.white, 0.2)
                    : alpha(theme.palette.primary.main, 0.24),
                },
              }}
            >
              {themeMode === 'dark' ? (
                <LightModeOutlinedIcon fontSize="small" />
              ) : (
                <DarkModeOutlinedIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>



          <IconButton
            size="medium"
            aria-label="عرض الإشعارات"
            color="inherit"
            onClick={(event) =>
              setNotificationAnchorEl((prev) => (prev ? null : event.currentTarget))
            }
            sx={{
              width: 40,
              height: 40,
              borderRadius: `${radius.md}px`,
              border: '1px solid',
              borderColor: controlBorder,
              bgcolor: controlSurface,
              color: 'text.secondary',
              '&:hover': {
                bgcolor: controlHover,
                color: 'text.primary',
                borderColor: isDark
                  ? alpha(theme.palette.common.white, 0.16)
                  : alpha(theme.palette.primary.main, 0.22),
              },
            }}
          >
            <Badge badgeContent={notificationUnreadCount} color="error" max={99} overlap="circular">
              <NotificationsIcon />
            </Badge>
          </IconButton>

          <MerchantNotificationsMenu
            anchorEl={notificationAnchorEl}
            onClose={() => setNotificationAnchorEl(null)}
            onViewAll={() => {
              setNotificationAnchorEl(null);
              onOpenNotifications();
            }}
            request={request}
            realtimeVersion={notificationRealtimeVersion}
          />

          <Box
            onClick={onOpenUserMenu}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              marginInlineStart: { xs: 0, md: 0.25 },
              height: 42,
              paddingInlineStart: 0.5,
              paddingInlineEnd: { xs: 0.5, sm: 1 },
              borderRadius: `${radius.lg}px`,
              cursor: 'pointer',
              border: '1px solid',
              borderColor: controlBorder,
              bgcolor: controlSurface,
              transition:
                'background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease',
              '&:hover': {
                bgcolor: controlHover,
                borderColor: isDark
                  ? alpha(theme.palette.common.white, 0.16)
                  : alpha(theme.palette.primary.main, 0.22),
                boxShadow: isDark
                  ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.08)}`
                  : '0 8px 18px rgba(80, 46, 145, 0.08)',
              },
            }}
          >
            <Avatar
              sx={{
                width: 32,
                height: 32,
                bgcolor: isDark
                  ? alpha(theme.palette.common.white, 0.09)
                  : alpha(theme.palette.primary.main, 0.1),
                color: isDark ? 'primary.main' : 'primary.dark',
                fontWeight: 800,
                fontSize: '0.82rem',
              }}
            >
              {session.user.fullName.charAt(0).toUpperCase()}
            </Avatar>

            <Box sx={{ display: { xs: 'none', sm: 'block' }, minWidth: 0 }}>
              <Typography
                variant="body2"
                noWrap
                sx={{ color: 'text.primary', fontWeight: 800, lineHeight: 1.15, maxWidth: 150 }}
              >
                {session.user.fullName}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                {session.user.role === 'owner' ? 'المالك' : 'عضو فريق'}
              </Typography>
            </Box>

            <KeyboardArrowDownIcon
              fontSize="small"
              sx={{ color: 'text.secondary', display: { xs: 'none', sm: 'inline-block' } }}
            />
          </Box>

          <Menu
            anchorEl={userMenuAnchorEl}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            open={Boolean(userMenuAnchorEl)}
            onClose={onCloseUserMenu}
            PaperProps={{
              elevation: 0,
              sx: {
                overflow: 'visible',
                boxShadow: isDark
                  ? '0 20px 42px rgba(9, 7, 16, 0.28)'
                  : '0 18px 36px rgba(15, 23, 42, 0.12)',
                mt: 1,
                minWidth: 230,
                borderRadius: `${radius.lg}px`,
                border: '1px solid',
                borderColor: controlBorder,
                bgcolor: alpha(theme.palette.background.paper, isDark ? 0.96 : 0.98),
                backdropFilter: 'blur(16px)',
              },
            }}
          >
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                {session.user.fullName}
              </Typography>
              <Typography variant="body2" color="text.secondary" dir="ltr">
                {session.user.email}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  mt: 0.75,
                  display: 'inline-block',
                  bgcolor: isDark
                    ? alpha(theme.palette.common.white, 0.07)
                    : alpha(theme.palette.primary.main, 0.1),
                  color: isDark ? 'primary.main' : 'primary.dark',
                  px: 1,
                  py: 0.25,
                  borderRadius: `${radius.sm}px`,
                  fontWeight: 800,
                }}
                dir="ltr"
              >
                Store ID: {session.user.storeId}
              </Typography>
            </Box>

            <Divider />

            <MenuItem
              onClick={() => {
                onCloseUserMenu();
                openMerchantAccessibilitySettings();
              }}
              sx={{ direction: 'rtl' }}
            >
              <ListItemIcon sx={{ minWidth: 32, marginInlineEnd: 1 }}>
                <TuneIcon fontSize="small" />
              </ListItemIcon>
              إعدادات الوصول
            </MenuItem>

            <MenuItem onClick={onGoToStoreSettings} sx={{ direction: 'rtl' }}>
              <ListItemIcon sx={{ minWidth: 32, marginInlineEnd: 1 }}>
                <StorefrontIcon fontSize="small" />
              </ListItemIcon>
              إعدادات المتجر
            </MenuItem>

            <MenuItem onClick={onGoToStaff} sx={{ direction: 'rtl' }}>
              <ListItemIcon sx={{ minWidth: 32, marginInlineEnd: 1 }}>
                <PeopleIcon fontSize="small" />
              </ListItemIcon>
              إدارة الفريق
            </MenuItem>

            <Divider />

            <MenuItem onClick={onSignOut} sx={{ color: 'error.main', direction: 'rtl' }}>
              <ListItemIcon sx={{ minWidth: 32, marginInlineEnd: 1 }}>
                <LogoutIcon fontSize="small" color="error" />
              </ListItemIcon>
              تسجيل الخروج
            </MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
