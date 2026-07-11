import {
  BrandingWatermarkIcon,
  HomeRoundedIcon,
  InstagramIcon,
  StorefrontIcon,
} from '../../../components/icons';
import { Box, Typography, alpha, useTheme } from '@mui/material';
import { useMarketingLocale } from '../marketing-locale-context';
import { RevealOnScroll } from './marketing-motion';
import { MarketingSectionShell } from './marketing-section-shell';
import { MarketingMetricCard } from './marketing-visuals';

const audienceIcons = [StorefrontIcon, HomeRoundedIcon, InstagramIcon, BrandingWatermarkIcon];

export function MarketingForWho() {
  const theme = useTheme();
  const { content } = useMarketingLocale();
  const audiences = content.audiences;

  return (
    <MarketingSectionShell
      id="for-who"
      mascotAnchor="start"
      mascotScene="for-who"
      eyebrow={audiences.eyebrow}
      title={audiences.title}
      description={audiences.description}
      surface="paper"
    >
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 0.92fr' }, gap: 2.4 }}>
        <Box
          sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: '1fr' }, gap: 1.4 }}
        >
          {audiences.items.map((item, index) => {
            const Icon = audienceIcons[index % audienceIcons.length] ?? StorefrontIcon;

            return (
              <RevealOnScroll key={item.title} delay={(index % 2) * 90}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '58px 1fr',
                    gap: 1.5,
                    height: '100%',
                    p: { xs: 1.8, md: 2.15 },
                    borderRadius: 1.2,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: alpha(
                      theme.palette.background.default,
                      theme.palette.mode === 'dark' ? 0.48 : 0.65,
                    ),
                  }}
                >
                  <Box
                    sx={{
                      width: 50,
                      height: 50,
                      borderRadius: 1.2,
                      color: 'primary.main',
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    <Icon />
                  </Box>
                  <Box>
                    <Typography variant="h5" sx={{ mb: 0.75, fontWeight: 900 }}>
                      {item.title}
                    </Typography>
                    <Typography color="text.secondary" sx={{ lineHeight: 1.75 }}>
                      {item.description}
                    </Typography>
                  </Box>
                </Box>
              </RevealOnScroll>
            );
          })}
        </Box>

        <RevealOnScroll delay={120}>
          <Box
            sx={{
              height: '100%',
              p: { xs: 2, md: 2.5 },
              borderRadius: 1.4,
              border: '1px solid',
              borderColor: alpha(theme.palette.primary.main, 0.18),
              bgcolor: alpha(theme.palette.background.default, theme.palette.mode === 'dark' ? 0.48 : 0.68),
            }}
          >
            <Typography variant="h5" sx={{ fontWeight: 900, mb: 1 }}>
              {audiences.fitTitle}
            </Typography>
            <Typography color="text.secondary" sx={{ lineHeight: 1.75, mb: 2.2 }}>
              {audiences.fitDescription}
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(2, 1fr)' }, gap: 1.1 }}>
              {audiences.gains.map((item, index) => {
                const Icon = audienceIcons[index % audienceIcons.length] ?? StorefrontIcon;
                return (
                  <MarketingMetricCard
                    key={item.label}
                    label={item.label}
                    value={item.score}
                    caption={item.gain}
                    tone={item.tone}
                    icon={<Icon fontSize="small" />}
                  />
                );
              })}
            </Box>
          </Box>
        </RevealOnScroll>
      </Box>
    </MarketingSectionShell>
  );
}
