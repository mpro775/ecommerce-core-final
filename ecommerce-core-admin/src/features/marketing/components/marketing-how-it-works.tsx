import {
  LinkIcon,
  PaletteIcon,
  RocketLaunchIcon,
  SettingsIcon,
  StorefrontIcon,
} from '../../../components/icons';
import { Box, Typography, alpha, useTheme } from '@mui/material';
import { useMarketingLocale } from '../marketing-locale-context';
import { RevealOnScroll } from './marketing-motion';
import { MarketingSectionShell } from './marketing-section-shell';
import { MarketingVisualFlow } from './marketing-visuals';

const launchIcons = [SettingsIcon, StorefrontIcon, StorefrontIcon, PaletteIcon, RocketLaunchIcon];

export function MarketingHowItWorks() {
  const theme = useTheme();
  const { content } = useMarketingLocale();
  const howItWorks = content.howItWorks;

  return (
    <MarketingSectionShell
      id="how-it-works"
      mascotAnchor="center"
      mascotScene="how-it-works"
      eyebrow={howItWorks.eyebrow}
      title={howItWorks.title}
      description={howItWorks.description}
    >
      <Box sx={{ mb: { xs: 3, md: 4.5 } }}>
        <MarketingVisualFlow
          items={howItWorks.steps.map((step, index) => {
            const Icon = index === 4 ? LinkIcon : (launchIcons[index] ?? StorefrontIcon);
            return {
              label: step.title,
              caption: step.description,
              icon: <Icon fontSize="small" />,
              tone: index === howItWorks.steps.length - 1 ? 'success' : 'primary',
            };
          })}
        />
      </Box>

      <Box sx={{ position: 'relative' }}>
        <Box
          sx={{
            display: { xs: 'none', md: 'block' },
            position: 'absolute',
            top: 38,
            insetInlineStart: 0,
            insetInlineEnd: 0,
            height: 2,
            bgcolor: alpha(theme.palette.primary.main, 0.15),
          }}
        />
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(5, 1fr)' },
            gap: { xs: 1.6, md: 1.2 },
          }}
        >
          {howItWorks.steps.map((step, index) => (
            <RevealOnScroll key={step.step} delay={index * 80}>
              <Box
                sx={{
                  position: 'relative',
                  minHeight: 210,
                  p: 2,
                  borderRadius: 1.2,
                  border: '1px solid',
                  borderColor: index === 0 ? alpha(theme.palette.primary.main, 0.35) : 'divider',
                  bgcolor: alpha(
                    theme.palette.background.paper,
                    theme.palette.mode === 'dark' ? 0.52 : 0.72,
                  ),
                }}
              >
                <Box
                  sx={{
                    width: 58,
                    height: 58,
                    borderRadius: '50%',
                    mb: 2,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor:
                      index === 0
                        ? alpha(theme.palette.primary.main, 0.14)
                        : alpha(theme.palette.background.default, 0.85),
                    color: index === 0 ? 'primary.main' : 'text.secondary',
                    border: '1px solid',
                    borderColor: index === 0 ? alpha(theme.palette.primary.main, 0.24) : 'divider',
                    fontWeight: 900,
                  }}
                >
                  {step.step}
                </Box>
                <Typography variant="h6" sx={{ mb: 1, fontWeight: 900 }}>
                  {step.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  {step.description}
                </Typography>
              </Box>
            </RevealOnScroll>
          ))}
        </Box>
      </Box>
    </MarketingSectionShell>
  );
}
