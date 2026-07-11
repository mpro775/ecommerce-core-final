import {
  DashboardIcon,
  InventoryIcon,
  LanguageIcon,
  LocalOfferIcon,
  LocalShippingIcon,
  PaletteIcon,
  ShoppingCartIcon,
  TrendingUpIcon,
} from '../../../components/icons';
import { Box, Typography, alpha, useTheme } from '@mui/material';
import { useMarketingLocale } from '../marketing-locale-context';
import { RevealOnScroll } from './marketing-motion';
import { MarketingSectionShell } from './marketing-section-shell';
import { MarketingVisualFlow } from './marketing-visuals';

const featureIcons = [
  InventoryIcon,
  ShoppingCartIcon,
  PaletteIcon,
  LanguageIcon,
  LocalOfferIcon,
  LocalShippingIcon,
  DashboardIcon,
  TrendingUpIcon,
];

export function MarketingFeatures() {
  const theme = useTheme();
  const { content } = useMarketingLocale();
  const features = content.features;

  return (
    <MarketingSectionShell
      id="features"
      mascotAnchor="end"
      mascotScene="features"
      eyebrow={features.eyebrow}
      title={features.title}
      description={features.description}
      surface="paper"
    >
      <Box sx={{ mb: { xs: 3.4, md: 5 } }}>
        <MarketingVisualFlow
          items={features.systemNodes.map((node, index) => {
            const Icon = featureIcons[index % featureIcons.length] ?? DashboardIcon;
            return {
              label: node.label,
              caption: node.caption,
              icon: <Icon fontSize="small" />,
              tone: index === features.systemNodes.length - 1 ? 'success' : 'primary',
            };
          })}
        />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 1.5 }}>
        {features.items.map((feature, index) => {
          const Icon = featureIcons[index % featureIcons.length] ?? DashboardIcon;

          return (
            <RevealOnScroll key={feature.title} delay={(index % 4) * 70}>
              <Box
                sx={{
                  minHeight: 214,
                  p: 2.3,
                  borderRadius: 1.2,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: alpha(theme.palette.background.default, theme.palette.mode === 'dark' ? 0.5 : 0.62),
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    borderColor: alpha(theme.palette.primary.main, 0.36),
                    boxShadow:
                      theme.palette.mode === 'dark'
                        ? '0 18px 34px rgba(0,0,0,0.22)'
                        : '0 18px 34px rgba(80,46,145,0.10)',
                  },
                  '@media (prefers-reduced-motion: reduce)': {
                    transition: 'none',
                    '&:hover': { transform: 'none' },
                  },
                }}
              >
                <Box
                  sx={{
                    width: 46,
                    height: 46,
                    borderRadius: 1.2,
                    mb: 2,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    color: 'primary.main',
                  }}
                >
                  <Icon fontSize="medium" />
                </Box>
                <Typography variant="h6" sx={{ mb: 1, fontWeight: 900 }}>
                  {feature.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.75 }}>
                  {feature.description}
                </Typography>
                <Box
                  sx={{
                    position: 'absolute',
                    insetInlineEnd: 16,
                    bottom: 16,
                    width: 52,
                    height: 7,
                    borderRadius: 999,
                    bgcolor: alpha(theme.palette.secondary.main, 0.22),
                  }}
                />
              </Box>
            </RevealOnScroll>
          );
        })}
      </Box>
    </MarketingSectionShell>
  );
}
