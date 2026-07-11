import {
  CheckCircleIcon,
  DashboardIcon,
  LanguageIcon,
  LocalOfferIcon,
  PaletteIcon,
  ReceiptLongIcon,
  StorefrontIcon,
  TrendingUpIcon,
} from '../../../components/icons';
import { Box, Button, Chip, Stack, Typography, alpha, useTheme } from '@mui/material';
import { useState, type ReactNode } from 'react';
import { ADMIN_TOKENS } from '../../../theme/tokens';
import { useMarketingLocale } from '../marketing-locale-context';
import {
  RevealOnScroll,
  getReducedMotionSx,
  marketingFloat,
  marketingMarquee,
  marketingPulseLine,
} from './marketing-motion';
import { MarketingSectionShell } from './marketing-section-shell';
import { MarketingMiniChart } from './marketing-visuals';

const ecommerce_core_ICON_SRC = '/brand/ecommerce_core-icon.png';

type ProductShowcaseSceneKey = 'dashboard' | 'storefront' | 'themes' | 'domain';

function BrowserChrome({ children, title }: { children: ReactNode; title: string }) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        overflow: 'hidden',
        border: '1px solid',
        borderColor: alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.7 : 0.9),
        borderRadius: 2,
        bgcolor:
          theme.palette.mode === 'dark'
            ? alpha('#20212A', 0.98)
            : alpha(theme.palette.background.paper, 0.92),
        boxShadow:
          theme.palette.mode === 'dark'
            ? '0 22px 54px rgba(0, 0, 0, 0.32)'
            : '0 22px 54px rgba(80, 46, 145, 0.12)',
        backdropFilter: 'blur(18px)',
      }}
    >
      <Box
        sx={{
          alignItems: 'center',
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          gap: 1,
          px: 1.5,
          py: 1.15,
        }}
      >
        <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: '#FF6B6B' }} />
        <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: '#F2B84B' }} />
        <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: '#4BD08C' }} />
        <Typography
          variant="caption"
          dir="ltr"
          sx={{
            mr: 'auto',
            color: 'text.secondary',
            fontFamily: 'monospace',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </Typography>
      </Box>
      {children}
    </Box>
  );
}

function MiniChart() {
  const theme = useTheme();
  const bars = [42, 64, 52, 78, 68, 88, 74, 96, 82];

  return (
    <Box sx={{ height: 108, pt: 1 }}>
      <MarketingMiniChart
        data={bars.map((value, index) => ({ name: `${index + 1}`, value }))}
        color={theme.palette.primary.main}
        secondaryColor={theme.palette.secondary.main}
      />
    </Box>
  );
}

export function CommerceCommandCenter() {
  const theme = useTheme();
  const { content } = useMarketingLocale();
  const commandCenter = content.showcase.commandCenter;

  return (
    <Box
      sx={{
        position: 'relative',
        mx: 'auto',
        maxWidth: 680,
        transform: { lg: 'perspective(1100px) rotateY(-4deg) rotateX(1.5deg)' },
        transition: 'transform 360ms ease',
        '&:hover': { transform: { lg: 'perspective(1100px) rotateY(0deg) rotateX(0deg)' } },
        ...getReducedMotionSx(),
      }}
    >
      <BrowserChrome title="app.your-domain.com/merchant/overview">
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '88px 1fr' },
            minHeight: { xs: 450, sm: 500 },
            bgcolor:
              theme.palette.mode === 'dark'
                ? '#181922'
                : alpha(theme.palette.background.default, 0.9),
          }}
        >
          <Box
            sx={{
              display: { xs: 'none', sm: 'flex' },
              flexDirection: 'column',
              gap: 1.4,
              borderInlineEnd: '1px solid',
              borderColor: 'divider',
              p: 1.6,
            }}
          >
            <Box
              component="img"
              src={ecommerce_core_ICON_SRC}
              alt=""
              sx={{ width: 34, height: 34, mx: 'auto', mb: 1 }}
            />
            {[DashboardIcon, StorefrontIcon, ReceiptLongIcon, PaletteIcon, LanguageIcon].map(
              (Icon, index) => (
                <Box
                  key={Icon.displayName}
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 1.5,
                    mx: 'auto',
                    display: 'grid',
                    placeItems: 'center',
                    color: index === 0 ? 'primary.main' : 'text.secondary',
                    bgcolor: index === 0 ? alpha(theme.palette.primary.main, 0.12) : 'transparent',
                  }}
                >
                  <Icon fontSize="small" />
                </Box>
              ),
            )}
          </Box>

          <Box sx={{ p: { xs: 1.6, md: 2.2 }, minWidth: 0 }}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ mb: 2 }}
            >
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                  {commandCenter.eyebrow}
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 900 }}>
                  {commandCenter.title}
                </Typography>
              </Box>
              <Chip
                size="small"
                label="Live"
                color="success"
                sx={{ fontWeight: 900, borderRadius: 999, direction: 'ltr' }}
              />
            </Stack>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
                gap: 1.2,
                mb: 1.4,
              }}
            >
              {commandCenter.statCards.map((item) => (
                <Box
                  key={item.label}
                  sx={{
                    p: 1.5,
                    borderRadius: 1.2,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: alpha(
                      theme.palette.background.paper,
                      theme.palette.mode === 'dark' ? 0.92 : 0.78,
                    ),
                  }}
                >
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                    {item.label}
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 900,
                    color:
                        item.tone === 'success'
                          ? 'success.main'
                          : item.tone === 'warning'
                            ? 'warning.main'
                            : 'primary.main',
                    }}
                  >
                    {item.value}
                  </Typography>
                </Box>
              ))}
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1.1fr 0.9fr' },
                gap: 1.4,
              }}
            >
              <Box
                sx={{
                  p: 1.7,
                  borderRadius: 1.2,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: alpha(
                    theme.palette.background.paper,
                    theme.palette.mode === 'dark' ? 0.92 : 0.78,
                  ),
                }}
              >
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ mb: 1 }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
                    {commandCenter.chartTitle}
                  </Typography>
                  <Stack
                    direction="row"
                    spacing={0.6}
                    alignItems="center"
                    sx={{ color: 'success.main' }}
                  >
                    <TrendingUpIcon fontSize="small" />
                    <Typography variant="caption" sx={{ fontWeight: 900 }}>
                      +24%
                    </Typography>
                  </Stack>
                </Stack>
                <MiniChart />
              </Box>

              <Box
                sx={{
                  display: 'grid',
                  gap: 1,
                  minWidth: 0,
                }}
              >
                {commandCenter.products.map((product) => (
                  <Box
                    key={product.name}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      p: 1.15,
                      borderRadius: 1.2,
                      border: '1px solid',
                      borderColor: 'divider',
                      bgcolor: alpha(
                        theme.palette.background.paper,
                        theme.palette.mode === 'dark' ? 0.9 : 0.72,
                      ),
                    }}
                  >
                    <Box
                      sx={{
                        width: 34,
                        height: 34,
                        borderRadius: 1,
                        bgcolor: alpha(product.color, 0.18),
                        border: `1px solid ${alpha(product.color, 0.38)}`,
                      }}
                    />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 900 }}>
                        {product.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {product.stock}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>

            <Box sx={{ mt: 1.4, display: 'grid', gap: 1 }}>
              {commandCenter.orders.map((order) => (
                <Box
                  key={order.id}
                  sx={{
                    alignItems: 'center',
                    display: 'grid',
                    gap: 1,
                    gridTemplateColumns: { xs: '1fr', sm: '72px 1fr 96px 82px' },
                    p: 1.1,
                    borderRadius: 1.2,
                    bgcolor: alpha(
                      theme.palette.primary.main,
                      theme.palette.mode === 'dark' ? 0.07 : 0.045,
                    ),
                  }}
                >
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900 }}>
                    {order.id}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800 }}>
                    {order.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                    {order.status}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 900 }}>
                    {order.amount}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </BrowserChrome>

      <Box
        sx={{
          position: 'absolute',
          insetInlineStart: { xs: 8, md: -18 },
          top: { xs: 14, md: 62 },
          display: { xs: 'none', sm: 'flex' },
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 1.15,
          borderRadius: 1.5,
          border: '1px solid',
          borderColor: alpha(theme.palette.success.main, 0.22),
          bgcolor: alpha(theme.palette.background.paper, 0.84),
          backdropFilter: 'blur(18px)',
          boxShadow: ADMIN_TOKENS.elevation.glass,
          animation: `${marketingFloat} 5.4s ease-in-out infinite`,
          ...getReducedMotionSx(),
        }}
      >
        <CheckCircleIcon color="success" fontSize="small" />
        <Typography variant="caption" sx={{ fontWeight: 900 }}>
          {commandCenter.secureDomain}
        </Typography>
      </Box>

      <Box
        sx={{
          position: 'absolute',
          insetInlineEnd: { xs: 8, md: -24 },
          bottom: { xs: 18, md: 56 },
          display: { xs: 'none', sm: 'block' },
          px: 1.6,
          py: 1.15,
          borderRadius: 1.5,
          border: '1px solid',
          borderColor: alpha(theme.palette.warning.main, 0.22),
          bgcolor: alpha(theme.palette.background.paper, 0.84),
          backdropFilter: 'blur(18px)',
          boxShadow: ADMIN_TOKENS.elevation.glass,
          animation: `${marketingFloat} 6.1s ease-in-out infinite 500ms`,
          ...getReducedMotionSx(),
        }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', fontWeight: 800 }}
        >
          {commandCenter.newOrder}
        </Typography>
        <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
          {commandCenter.newOrderLine}
        </Typography>
      </Box>
    </Box>
  );
}

function StorefrontPreview({ accent = '#502E91' }: { accent?: string }) {
  const theme = useTheme();
  const { content } = useMarketingLocale();
  const storefront = content.showcase.storefront;

  return (
    <BrowserChrome title="yourbrand.com">
      <Box
        sx={{
          minHeight: 330,
          p: 2,
          bgcolor: theme.palette.mode === 'dark' ? '#121317' : '#fbfbfd',
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
            {storefront.storeName}
          </Typography>
          <Stack direction="row" spacing={1}>
            {storefront.navLinks.map((item) => (
              <Typography
                key={item}
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: 800 }}
              >
                {item}
              </Typography>
            ))}
          </Stack>
        </Stack>
        <Box
          sx={{
            p: 2,
            borderRadius: 1.5,
            color: '#fff',
            background: `linear-gradient(135deg, ${accent}, ${alpha('#6EC5D6', 0.92)})`,
            mb: 2,
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 900, opacity: 0.82 }}>
            {storefront.eyebrow}
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 900, mt: 0.5 }}>
            {storefront.title}
          </Typography>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.2 }}>
          {[1, 2, 3].map((item) => (
            <Box
              key={item}
              sx={{
                p: 1,
                borderRadius: 1.2,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
              }}
            >
              <Box
                sx={{
                  aspectRatio: '1/0.82',
                  borderRadius: 1,
                  mb: 1,
                  bgcolor: alpha(accent, item === 2 ? 0.18 : 0.1),
                }}
              />
              <Typography variant="caption" sx={{ display: 'block', fontWeight: 900 }}>
                {storefront.productNames[item - 1] ?? storefront.productNames[0]}
              </Typography>
              <Typography variant="caption" color="primary" sx={{ fontWeight: 900 }}>
                {(item * 1200 + 2400).toLocaleString('en-US')} {storefront.currency}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </BrowserChrome>
  );
}

function DomainFlowPreview() {
  const theme = useTheme();
  const { content } = useMarketingLocale();
  const steps = ['DNS', 'SSL', 'LIVE'];
  const domainFlow = content.showcase.domainFlow;

  return (
    <Box
      sx={{
        p: { xs: 2, md: 3 },
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: alpha(theme.palette.background.paper, 0.78),
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: 60,
          insetInlineStart: '16%',
          width: '68%',
          height: 2,
          bgcolor: alpha(theme.palette.primary.main, 0.18),
          '&::after': {
            animation: `${marketingPulseLine} 3.8s ease-in-out infinite`,
            bgcolor: theme.palette.secondary.main,
            content: '""',
            height: '100%',
            insetInlineStart: 0,
            position: 'absolute',
            top: 0,
            width: '42%',
            ...getReducedMotionSx(),
          },
        }}
      />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 1,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {steps.map((step, index) => (
          <Box key={step} sx={{ textAlign: 'center' }}>
            <Box
              sx={{
                width: 62,
                height: 62,
                mx: 'auto',
                mb: 1.5,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                bgcolor:
                  index === 2
                    ? alpha(theme.palette.success.main, 0.14)
                    : alpha(theme.palette.primary.main, 0.1),
                color: index === 2 ? 'success.main' : 'primary.main',
                border: '1px solid',
                borderColor:
                  index === 2
                    ? alpha(theme.palette.success.main, 0.28)
                    : alpha(theme.palette.primary.main, 0.18),
              }}
            >
              {index === 2 ? <CheckCircleIcon /> : <LanguageIcon />}
            </Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
              {step}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {domainFlow.captions[index] ?? ''}
            </Typography>
          </Box>
        ))}
      </Box>
      <Box
        sx={{
          mt: 3,
          p: 1.4,
          borderRadius: 1.2,
          bgcolor: alpha(theme.palette.success.main, 0.08),
          border: '1px solid',
          borderColor: alpha(theme.palette.success.main, 0.16),
          direction: 'ltr',
          textAlign: 'left',
        }}
      >
        <Typography
          variant="caption"
          sx={{ color: 'success.main', fontFamily: 'monospace', fontWeight: 900 }}
        >
          https://www.yourbrand.com · {domainFlow.verified}
        </Typography>
      </Box>
    </Box>
  );
}

export function MarketingProductShowcase() {
  const theme = useTheme();
  const { content } = useMarketingLocale();
  const showcase = content.showcase;
  const themePresets = content.themes.presets;
  const [activeScene, setActiveScene] = useState<ProductShowcaseSceneKey>('dashboard');
  const [activeTheme, setActiveTheme] = useState(0);
  const activePreset = themePresets[activeTheme] ?? themePresets[0];
  const accent = activeTheme === 0 ? '#502E91' : activeTheme === 1 ? '#2F91A7' : '#B86E00';

  return (
    <MarketingSectionShell
      id="showcase"
      mascotAnchor="end"
      mascotScene="showcase"
      eyebrow={showcase.eyebrow}
      title={showcase.title}
      description={showcase.description}
      surface="panel"
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '0.82fr 1.18fr' },
          gap: { xs: 3, md: 4 },
          alignItems: 'stretch',
        }}
      >
        <RevealOnScroll>
          <Box sx={{ display: 'grid', gap: 1.4 }}>
            {showcase.scenes.map((scene) => {
              const isActive = activeScene === scene.key;
              return (
                <Button
                  key={scene.key}
                  onClick={() => setActiveScene(scene.key)}
                  variant="outlined"
                  sx={{
                    justifyContent: 'flex-start',
                    minHeight: 82,
                    borderRadius: 1.2,
                    p: 1.5,
                    textAlign: 'start',
                    color: isActive ? 'text.primary' : 'text.secondary',
                    borderColor: isActive ? 'primary.main' : 'divider',
                    bgcolor: isActive
                      ? alpha(theme.palette.primary.main, 0.08)
                      : alpha(theme.palette.background.paper, 0.62),
                  }}
                >
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
                      {scene.title}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ display: 'block', mt: 0.4, lineHeight: 1.5 }}
                    >
                      {scene.description}
                    </Typography>
                  </Box>
                </Button>
              );
            })}
          </Box>
        </RevealOnScroll>

        <RevealOnScroll delay={120}>
          <Box sx={{ minHeight: { xs: 360, md: 470 } }}>
            {activeScene === 'storefront' ? (
              <StorefrontPreview accent={accent} />
            ) : activeScene === 'themes' ? (
              <Box>
                <Stack direction="row" spacing={1} sx={{ mb: 1.4, flexWrap: 'wrap' }}>
                  {themePresets.map((preset, index) => (
                    <Button
                      key={preset.name}
                      size="small"
                      variant={activeTheme === index ? 'contained' : 'outlined'}
                      onClick={() => setActiveTheme(index)}
                    >
                      {preset.name}
                    </Button>
                  ))}
                </Stack>
                <StorefrontPreview accent={accent} />
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 1.4, fontWeight: 700 }}
                >
                  {activePreset?.details.join(' · ')}
                </Typography>
              </Box>
            ) : activeScene === 'domain' ? (
              <DomainFlowPreview />
            ) : (
              <CommerceCommandCenter />
            )}
          </Box>
        </RevealOnScroll>
      </Box>

      <Box
        sx={{
          mt: 5,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1.5,
          bgcolor: alpha(theme.palette.background.paper, 0.62),
        }}
      >
        <Box
          sx={{
            display: 'flex',
            width: 'max-content',
            animation: `${marketingMarquee} 24s linear infinite`,
            ...getReducedMotionSx(),
          }}
        >
          {[...showcase.scenes, ...showcase.scenes].map((scene, index) => (
            <Stack
              key={`${scene.key}-${index}`}
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ px: 2.4, py: 1.2, color: 'text.secondary' }}
            >
              {scene.key === 'dashboard' ? (
                <DashboardIcon fontSize="small" />
              ) : scene.key === 'storefront' ? (
                <StorefrontIcon fontSize="small" />
              ) : scene.key === 'themes' ? (
                <PaletteIcon fontSize="small" />
              ) : (
                <LocalOfferIcon fontSize="small" />
              )}
              <Typography variant="caption" sx={{ fontWeight: 900, whiteSpace: 'nowrap' }}>
                {scene.title}
              </Typography>
            </Stack>
          ))}
        </Box>
      </Box>
    </MarketingSectionShell>
  );
}
