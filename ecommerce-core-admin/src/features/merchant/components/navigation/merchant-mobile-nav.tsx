import { MoreHorizIcon } from '../../../../components/icons';
import { BottomNavigation, BottomNavigationAction, Paper } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { ADMIN_TOKENS } from '../../../../theme/tokens';
import type { MerchantNavItem, MerchantTabKey } from '../../merchant-dashboard.types';

interface MerchantMobileNavProps {
  primaryItems: MerchantNavItem[];
  activeTab: MerchantTabKey;
  onSelectTab: (tab: MerchantTabKey) => void;
  onOpenMore: () => void;
}

export function MerchantMobileNav({
  primaryItems,
  activeTab,
  onSelectTab,
  onOpenMore,
}: MerchantMobileNavProps) {
  const isPrimaryTab = primaryItems.some((item) => item.key === activeTab);
  const value = isPrimaryTab ? activeTab : 'none';

  return (
    <Paper
      elevation={0}
      sx={{
        position: 'fixed',
        insetBlockEnd: 0,
        insetInlineStart: 0,
        insetInlineEnd: 0,
        borderTop: '1px solid',
        borderColor: (theme) =>
          alpha(theme.palette.common.white, theme.palette.mode === 'dark' ? 0.14 : 0.62),
        borderRadius: `${ADMIN_TOKENS.radius.xxl}px ${ADMIN_TOKENS.radius.xxl}px 0 0`,
        bgcolor: (theme) =>
          alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.88 : 0.72),
        backdropFilter: 'blur(24px)',
        boxShadow: (theme) =>
          theme.palette.mode === 'dark'
            ? '0 -18px 38px rgba(9, 7, 16, 0.24)'
            : '0 -18px 38px rgba(80, 46, 145, 0.1)',
        display: { xs: 'block', lg: 'none' },
        zIndex: (theme) => theme.zIndex.appBar + 1,
      }}
    >
      <BottomNavigation
        value={value}
        showLabels
        sx={{
          height: 68,
          bgcolor: 'transparent',
          '& .MuiBottomNavigationAction-root': {
            minWidth: 0,
            px: 1,
            color: 'text.secondary',
            borderRadius: ADMIN_TOKENS.radius.pill,
            mx: 0.35,
            '&.Mui-selected': {
              color: 'primary.main',
              bgcolor: (theme) =>
                theme.palette.mode === 'dark'
                  ? alpha(theme.palette.common.white, 0.08)
                  : alpha(theme.palette.primary.main, 0.1),
            },
          },
        }}
        onChange={(_, nextValue: MerchantTabKey | 'more') => {
          if (nextValue === 'more') {
            onOpenMore();
            return;
          }
          onSelectTab(nextValue);
        }}
      >
        {primaryItems.map((item) => (
          <BottomNavigationAction
            key={item.key}
            value={item.key}
            label={item.label}
            icon={item.icon}
          />
        ))}
        <BottomNavigationAction value="more" label="المزيد" icon={<MoreHorizIcon />} />
      </BottomNavigation>
    </Paper>
  );
}
