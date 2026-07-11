import { CheckCircleIcon, ExpandLess, ExpandMore } from '../../../../components/icons';
import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Collapse,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { ADMIN_TOKENS } from '../../../../theme/tokens';
import type { MerchantNavItem, MerchantTabKey } from '../../merchant-dashboard.types';

interface MerchantSidebarProps {
  drawerWidth: number;
  navItems: MerchantNavItem[];
  activeTab: MerchantTabKey;
  isDesktop: boolean;
  mobileOpen: boolean;
  storeName?: string | null;
  storeLogoUrl?: string | null;
  onCloseMobile: () => void;
  onSelectTab: (tab: MerchantTabKey) => void;
}

const ecommerce_core_ICON_SRC = '/brand/ecommerce_core-icon.png';

export function MerchantSidebar({
  drawerWidth,
  navItems,
  activeTab,
  isDesktop,
  mobileOpen,
  storeName,
  storeLogoUrl,
  onCloseMobile,
  onSelectTab,
}: MerchantSidebarProps) {
  const theme = useTheme();
  const isRtl = theme.direction === 'rtl';
  const isDark = theme.palette.mode === 'dark';
  const radius = ADMIN_TOKENS.radius;
  const activeTextColor = isDark ? theme.palette.text.primary : theme.palette.primary.dark;
  const activeBg = isDark
    ? alpha(theme.palette.common.white, 0.075)
    : alpha(theme.palette.primary.main, 0.16);
  const activeHoverBg = isDark
    ? alpha(theme.palette.common.white, 0.105)
    : alpha(theme.palette.primary.main, 0.2);
  const quietHoverBg = alpha(theme.palette.text.primary, isDark ? 0.07 : 0.045);
  const iconBg = isDark
    ? alpha(theme.palette.common.white, 0.045)
    : alpha(theme.palette.primary.main, 0.08);
  const resolvedStoreName = storeName?.trim() || 'متجرك';
  const resolvedLogoSrc = storeLogoUrl?.trim() || ecommerce_core_ICON_SRC;
  const activeRailColor = theme.palette.primary.main;
  const activeEdgeGlow = `linear-gradient(90deg, transparent 0%, ${alpha(
    theme.palette.primary.main,
    isDark ? 0.08 : 0.08,
  )} 40%, ${alpha(theme.palette.primary.main, isDark ? 0.18 : 0.42)} 100%)`;
  const activeGroupKey = useMemo(() => {
    for (const group of navItems) {
      if (group.children?.some((child) => child.key === activeTab)) {
        return group.key;
      }
    }
    return undefined;
  }, [activeTab, navItems]);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    activeGroupKey ? { [activeGroupKey]: true } : {},
  );

  useEffect(() => {
    setOpenGroups(activeGroupKey ? { [activeGroupKey]: true } : {});
  }, [activeGroupKey]);

  const handleToggleGroup = (groupKey: string) => {
    setOpenGroups((prev) => (prev[groupKey] ? {} : { [groupKey]: true }));
  };

  const renderNavIcon = (icon: MerchantNavItem['icon'], isActive: boolean) =>
    icon ? (
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: `${radius.md}px`,
          display: 'grid',
          placeItems: 'center',
          color: isActive ? activeTextColor : 'text.secondary',
          bgcolor: isActive
            ? isDark
              ? alpha(theme.palette.common.white, 0.085)
              : alpha(theme.palette.primary.main, 0.12)
            : iconBg,
          transition: 'background-color 160ms ease, color 160ms ease, transform 160ms ease',
          '& svg': {
            fontSize: 18,
            strokeWidth: 2,
          },
        }}
      >
        {icon}
      </Box>
    ) : null;

  const content = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        bgcolor: alpha(theme.palette.background.paper, isDark ? 0.86 : 0.7),
        backgroundImage: isDark
          ? `linear-gradient(180deg, ${alpha(theme.palette.common.white, 0.035)} 0%, ${alpha(theme.palette.background.paper, 0.74)} 52%)`
          : `linear-gradient(180deg, rgba(255,255,255,0.72) 0%, ${alpha(theme.palette.primary.light, 0.4)} 100%)`,
        backdropFilter: 'blur(24px)',
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          borderBottom: '1px solid',
          borderColor: alpha(theme.palette.divider, isDark ? 0.86 : 0.82),
        }}
      >
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: `${radius.lg}px`,
            display: 'grid',
            placeItems: 'center',
            border: '1px solid',
            borderColor: isDark
              ? alpha(theme.palette.common.white, 0.12)
              : alpha(theme.palette.primary.main, 0.16),
            bgcolor: alpha(theme.palette.background.paper, isDark ? 0.72 : 0.78),
            boxShadow: isDark
              ? '0 12px 24px rgba(9, 7, 16, 0.2)'
              : '0 12px 24px rgba(80, 46, 145, 0.10)',
          }}
        >
          <Box
            component="img"
            src={resolvedLogoSrc}
            alt={resolvedStoreName}
            sx={{
              width: 30,
              height: 30,
              objectFit: 'contain',
              filter: `drop-shadow(0 8px 14px ${alpha(theme.palette.primary.main, 0.18)})`,
            }}
          />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="h6"
            sx={{ fontWeight: 800, color: 'text.primary', fontSize: '0.98rem', letterSpacing: 0 }}
          >
            {resolvedStoreName}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
            لوحة إدارة التاجر
          </Typography>
        </Box>
      </Box>

      <List
        sx={{
          flex: 1,
          px: 1.25,
          py: 1.25,
          overflowY: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: `${alpha(
            isDark ? theme.palette.common.white : theme.palette.primary.main,
            isDark ? 0.2 : 0.22,
          )} transparent`,
          '&::-webkit-scrollbar': {
            width: 6,
          },
          '&::-webkit-scrollbar-thumb': {
            borderRadius: radius.pill,
            backgroundColor: alpha(
              isDark ? theme.palette.common.white : theme.palette.primary.main,
              isDark ? 0.2 : 0.22,
            ),
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'transparent',
          },
        }}
      >
        {navItems.map((group) => {
          const isGroupOpen = openGroups[group.key];
          const hasActiveChild = group.children?.some((child) => child.key === activeTab);

          if (!group.children || group.children.length === 0) {
            const isActive = activeTab === group.key;
            return (
              <ListItem key={group.key} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  onClick={() => onSelectTab(group.key as MerchantTabKey)}
                  sx={{
                    position: 'relative',
                    overflow: 'hidden',
                    minHeight: 42,
                    py: 0.55,
                    px: 1,
                    gap: 1,
                    borderRadius: radius.pill,
                    bgcolor: isActive ? activeBg : 'transparent',
                    color: isActive ? activeTextColor : 'text.secondary',
                    border: '1px solid',
                    borderColor: isActive
                      ? isDark
                        ? alpha(theme.palette.common.white, 0.14)
                        : alpha(theme.palette.primary.main, 0.18)
                      : 'transparent',
                    boxShadow: isActive
                      ? isDark
                        ? '0 18px 30px rgba(0, 0, 0, 0.22)'
                        : `0 18px 34px ${alpha(theme.palette.primary.main, 0.14)}`
                      : 'none',
                    transition: 'background-color 160ms ease, border-color 160ms ease',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      zIndex: 3,
                      insetBlock: 9,
                      insetInlineStart: 0,
                      width: 3,
                      borderRadius: radius.pill,
                      bgcolor: isActive ? activeRailColor : 'transparent',
                      boxShadow:
                        isActive && isDark ? `0 0 8px ${alpha(activeRailColor, 0.28)}` : 'none',
                    },
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      zIndex: 1,
                      insetBlock: 0,
                      insetInlineEnd: 0,
                      width: isActive ? 72 : 0,
                      borderRadius: 'inherit',
                      background: activeEdgeGlow,
                      opacity: isActive ? 1 : 0,
                      pointerEvents: 'none',
                      transition: 'opacity 180ms ease, width 180ms ease',
                    },
                    '& .MuiListItemIcon-root, & .MuiListItemText-root': {
                      position: 'relative',
                      zIndex: 4,
                    },
                    '&:hover': {
                      bgcolor: isActive ? activeHoverBg : quietHoverBg,
                      color: isActive ? activeTextColor : 'text.primary',
                    },
                    '&:hover .nav-icon-box': {
                      transform: 'translateY(-1px)',
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 0 }}>
                    <Box className="nav-icon-box">{renderNavIcon(group.icon, isActive)}</Box>
                  </ListItemIcon>
                  <ListItemText
                    primary={group.label}
                    sx={{ textAlign: 'start', m: 0 }}
                    primaryTypographyProps={{
                      fontWeight: isActive ? 800 : 700,
                      fontSize: '0.86rem',
                      noWrap: true,
                    }}
                  />
                </ListItemButton>
              </ListItem>
            );
          }

          return (
            <Box key={group.key} sx={{ mb: 0.5 }}>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => handleToggleGroup(group.key)}
                  sx={{
                    position: 'relative',
                    overflow: 'hidden',
                    minHeight: 42,
                    py: 0.55,
                    px: 1,
                    gap: 1,
                    borderRadius: radius.pill,
                    color: hasActiveChild ? activeTextColor : 'text.primary',
                    bgcolor:
                      hasActiveChild && !isGroupOpen
                        ? isDark
                          ? alpha(theme.palette.common.white, 0.07)
                          : alpha(theme.palette.primary.main, 0.07)
                        : 'transparent',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      zIndex: 3,
                      insetBlock: 9,
                      insetInlineStart: 0,
                      width: 3,
                      borderRadius: radius.pill,
                      bgcolor: hasActiveChild ? activeRailColor : 'transparent',
                      boxShadow:
                        hasActiveChild && isDark
                          ? `0 0 8px ${alpha(activeRailColor, 0.28)}`
                          : 'none',
                    },
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      zIndex: 1,
                      insetBlock: 0,
                      insetInlineEnd: 0,
                      width: hasActiveChild ? 72 : 0,
                      borderRadius: 'inherit',
                      background: activeEdgeGlow,
                      opacity: hasActiveChild ? 1 : 0,
                      pointerEvents: 'none',
                      transition: 'opacity 180ms ease, width 180ms ease',
                    },
                    '& .MuiListItemIcon-root, & .MuiListItemText-root, & > svg': {
                      position: 'relative',
                      zIndex: 4,
                    },
                    '&:hover': { bgcolor: quietHoverBg },
                    '&:hover .nav-icon-box': {
                      transform: 'translateY(-1px)',
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 0 }}>
                    <Box className="nav-icon-box">
                      {renderNavIcon(group.icon, Boolean(hasActiveChild))}
                    </Box>
                  </ListItemIcon>
                  <ListItemText
                    primary={group.label}
                    sx={{ textAlign: 'start', m: 0 }}
                    primaryTypographyProps={{
                      fontWeight: hasActiveChild ? 800 : 700,
                      fontSize: '0.85rem',
                      noWrap: true,
                    }}
                  />
                  {isGroupOpen ? (
                    <ExpandLess sx={{ color: 'text.secondary', fontSize: 18 }} />
                  ) : (
                    <ExpandMore sx={{ color: 'text.secondary', fontSize: 18 }} />
                  )}
                </ListItemButton>
              </ListItem>
              <Collapse in={isGroupOpen} timeout="auto" unmountOnExit>
                <List
                  component="div"
                  disablePadding
                  sx={{
                    position: 'relative',
                    mt: 0.5,
                    mb: 0.75,
                    paddingInlineStart: '34px',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      insetBlock: 7,
                      insetInlineStart: '18px',
                      borderInlineStart: `1px dashed ${alpha(
                        theme.palette.text.secondary,
                        isDark ? 0.34 : 0.24,
                      )}`,
                    },
                  }}
                >
                  {group.children.map((child) => {
                    const isChildActive = activeTab === child.key;
                    return (
                      <ListItemButton
                        key={child.key}
                        onClick={() => onSelectTab(child.key as MerchantTabKey)}
                        sx={{
                          position: 'relative',
                          minHeight: 34,
                          py: 0.35,
                          px: 1.5,
                          mb: 0.25,
                          borderRadius: radius.pill,
                          bgcolor: isChildActive ? activeBg : 'transparent',
                          color: isChildActive ? activeTextColor : 'text.secondary',
                          border: '1px solid',
                          borderColor: isChildActive
                            ? isDark
                              ? alpha(theme.palette.common.white, 0.14)
                              : alpha(theme.palette.primary.main, 0.16)
                            : 'transparent',
                          '&::before': {
                            content: '""',
                            position: 'absolute',
                            width: 2,
                            height: 'calc(100% - 8px)',
                            borderRadius: radius.pill,
                            insetBlock: 4,
                            insetInlineStart: '-17px',
                            bgcolor: isChildActive ? theme.palette.primary.main : 'transparent',
                            boxShadow: isChildActive
                              ? `0 0 0 2px ${alpha(theme.palette.primary.main, isDark ? 0.08 : 0.08)}`
                              : 'none',
                          },
                          '&:hover': {
                            bgcolor: isChildActive ? activeHoverBg : quietHoverBg,
                            color: isChildActive ? activeTextColor : 'text.primary',
                          },
                        }}
                      >
                        <ListItemText
                          primary={child.label}
                          sx={{ textAlign: 'start', m: 0 }}
                          primaryTypographyProps={{
                            fontWeight: isChildActive ? 800 : 600,
                            fontSize: '0.8rem',
                            noWrap: true,
                          }}
                        />
                      </ListItemButton>
                    );
                  })}
                </List>
              </Collapse>
            </Box>
          );
        })}
      </List>

      <Box sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
        <Paper
          elevation={0}
          sx={{
            p: 1.25,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            bgcolor: alpha(theme.palette.success.main, isDark ? 0.1 : 0.07),
            border: '1px solid',
            borderColor: alpha(theme.palette.success.main, isDark ? 0.28 : 0.18),
            borderRadius: `${radius.md}px`,
          }}
        >
          <Box
            sx={{
              width: 30,
              height: 30,
              borderRadius: radius.pill,
              display: 'grid',
              placeItems: 'center',
              bgcolor: alpha(theme.palette.success.main, isDark ? 0.18 : 0.12),
            }}
          >
            <CheckCircleIcon color="success" sx={{ fontSize: 16 }} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', fontWeight: 700, display: 'block' }}
            >
              حالة المتجر
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 800, color: 'text.primary' }}>
              متصل ونشط
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Box>
  );

  return (
    <>
      <Box sx={{ display: { xs: 'none', lg: 'block' }, width: drawerWidth, flexShrink: 0 }}>
        <Box
          sx={{
            position: 'fixed',
            insetBlock: 0,
            insetInlineStart: 0,
            width: drawerWidth,
            height: '100dvh',
            borderInlineEnd: '1px solid',
            borderColor: alpha(theme.palette.common.white, isDark ? 0.12 : 0.62),
            bgcolor: alpha(theme.palette.background.paper, isDark ? 0.78 : 0.42),
            boxShadow: isDark
              ? '16px 0 36px rgba(9, 7, 16, 0.16)'
              : '16px 0 34px rgba(80, 46, 145, 0.06)',
            zIndex: (currentTheme) => currentTheme.zIndex.drawer,
          }}
        >
          {content}
        </Box>
      </Box>

      <Drawer
        anchor={isRtl ? 'right' : 'left'}
        variant="temporary"
        open={!isDesktop && mobileOpen}
        onClose={onCloseMobile}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', lg: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: drawerWidth,
            borderInlineEnd: '1px solid',
            borderColor: alpha(theme.palette.divider, isDark ? 0.86 : 0.82),
          },
        }}
      >
        {content}
      </Drawer>
    </>
  );
}
