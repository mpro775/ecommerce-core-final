import { ColorLensIcon } from '../../../components/icons';
import { Box, Button, Stack, Typography, alpha } from '@mui/material';
import { useState } from 'react';
import { useMarketingLocale } from '../marketing-locale-context';
import { RevealOnScroll } from './marketing-motion';
import { MarketingSectionShell } from './marketing-section-shell';
import { MarketingBrowserFrame, MarketingMetricCard } from './marketing-visuals';

const presetColors = [
  ['#502E91', '#6EC5D6', '#FFFFFF'],
  ['#2F91A7', '#E064D8', '#111827'],
  ['#B86E00', '#502E91', '#FFF2D8'],
];

export function MarketingThemes() {
  const { content } = useMarketingLocale();
  const themes = content.themes;
  const [activePreset, setActivePreset] = useState(0);
  const colors = presetColors[activePreset] ?? presetColors[0];

  return (
    <MarketingSectionShell
      id="themes"
      mascotAnchor="start"
      mascotScene="themes"
      eyebrow={themes.eyebrow}
      title={themes.title}
      description={themes.description}
    >
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '0.85fr 1.15fr' }, gap: 3.2, alignItems: 'center' }}>
        <RevealOnScroll>
          <Stack spacing={1.2}>
            {themes.presets.map((preset, index) => (
              <Button
                key={preset.name}
                onClick={() => setActivePreset(index)}
                variant={activePreset === index ? 'contained' : 'outlined'}
                sx={{
                  justifyContent: 'flex-start',
                  minHeight: 76,
                  borderRadius: 1.2,
                  p: 1.4,
                  textAlign: 'start',
                }}
              >
                <Box sx={{ width: '100%' }}>
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                    <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                      {preset.name}
                    </Typography>
                    <Stack direction="row" spacing={0.5}>
                      {(presetColors[index] ?? []).map((color) => (
                        <Box key={color} sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: color, border: '1px solid rgba(255,255,255,0.45)' }} />
                      ))}
                    </Stack>
                  </Stack>
                  <Typography variant="caption" sx={{ display: 'block', mt: 0.45 }}>
                    {preset.details.join(' · ')}
                  </Typography>
                </Box>
              </Button>
            ))}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)', lg: '1fr' }, gap: 1 }}>
              <MarketingMetricCard
                label={themes.metrics[0].label}
                value={themes.metrics[0].value}
                caption={themes.metrics[0].caption}
                tone={themes.metrics[0].tone}
                icon={<ColorLensIcon fontSize="small" />}
              />
              <MarketingMetricCard
                label={themes.metrics[1].label}
                value={themes.metrics[1].value}
                caption={themes.metrics[1].caption}
                tone={themes.metrics[1].tone}
                icon={<ColorLensIcon fontSize="small" />}
              />
              <MarketingMetricCard
                label={themes.metrics[2].label}
                value={themes.metrics[2].value}
                caption={themes.metrics[2].caption}
                tone={themes.metrics[2].tone}
                icon={<ColorLensIcon fontSize="small" />}
              />
            </Box>
          </Stack>
        </RevealOnScroll>

        <RevealOnScroll delay={140}>
          <MarketingBrowserFrame title="theme-lab.ecommerce_core.store" minHeight={380}>
            <Box
              sx={{
                minHeight: 380,
                overflow: 'hidden',
                bgcolor: colors?.[2] ?? '#fff',
                color: activePreset === 1 ? '#fff' : '#111827',
                transition: 'background-color 220ms ease, color 220ms ease',
              }}
            >
              <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ width: 34, height: 34, borderRadius: 1, bgcolor: colors?.[0] }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                    Brand Store
                  </Typography>
                </Stack>
                <ColorLensIcon />
              </Box>
              <Box
                sx={{
                  m: 2,
                  p: { xs: 2, md: 3 },
                  borderRadius: 1.4,
                  color: '#fff',
                  background: `linear-gradient(135deg, ${colors?.[0]}, ${colors?.[1]})`,
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 900, opacity: 0.82 }}>
                  {themes.presets[activePreset]?.name}
                </Typography>
                <Typography variant="h4" sx={{ mt: 0.5, fontWeight: 900 }}>
                  {themes.browserTitle}
                </Typography>
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.2, p: 2, pt: 0 }}>
                {[0, 1, 2].map((item) => (
                  <Box key={item} sx={{ p: 1, borderRadius: 1.2, bgcolor: alpha(colors?.[0] ?? '#502E91', item === 1 ? 0.18 : 0.1), border: `1px solid ${alpha(colors?.[1] ?? '#6EC5D6', 0.24)}` }}>
                    <Box sx={{ aspectRatio: '1/0.82', borderRadius: 1, bgcolor: alpha(colors?.[1] ?? '#6EC5D6', 0.24), mb: 1 }} />
                    <Typography variant="caption" sx={{ display: 'block', fontWeight: 900 }}>
                      {themes.productLabel}
                    </Typography>
                    <Typography variant="caption" sx={{ color: colors?.[0], fontWeight: 900 }}>
                      {180 + item * 45} {themes.currency}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </MarketingBrowserFrame>
        </RevealOnScroll>
      </Box>
    </MarketingSectionShell>
  );
}
