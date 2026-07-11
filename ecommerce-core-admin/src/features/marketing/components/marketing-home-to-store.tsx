import {
  CloudUploadIcon,
  LinkIcon,
  ReceiptLongIcon,
  ShoppingBagOutlinedIcon,
  StorefrontIcon,
  VerifiedUserIcon,
} from '../../../components/icons';
import { Box, Stack, Typography, alpha, useTheme } from '@mui/material';
import { useMarketingLocale } from '../marketing-locale-context';
import { RevealOnScroll } from './marketing-motion';
import { MarketingSectionShell } from './marketing-section-shell';
import { MarketingMiniChart, MarketingVisualFlow } from './marketing-visuals';

const stepIcons = [StorefrontIcon, ShoppingBagOutlinedIcon, LinkIcon];
const costIcons = [CloudUploadIcon, VerifiedUserIcon, ReceiptLongIcon];
const flowIcons = [StorefrontIcon, ShoppingBagOutlinedIcon, ReceiptLongIcon, LinkIcon, VerifiedUserIcon];

export function MarketingHomeToStore() {
  const theme = useTheme();
  const { content } = useMarketingLocale();
  const homeToStore = content.homeToStore;

  return (
    <MarketingSectionShell
      id="home-to-store"
      mascotAnchor="end"
      mascotScene="showcase"
      eyebrow={homeToStore.eyebrow}
      title={homeToStore.title}
      description={homeToStore.description}
      surface="panel"
    >
      <Box sx={{ mb: { xs: 3, md: 4.5 } }}>
        <MarketingVisualFlow
          items={homeToStore.flow.map((item, index) => {
            const Icon = flowIcons[index % flowIcons.length] ?? StorefrontIcon;
            return {
              label: item.label,
              caption: item.caption,
              icon: <Icon fontSize="small" />,
              tone: index === homeToStore.flow.length - 1 ? 'success' : 'primary',
            };
          })}
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '0.9fr 1.1fr' },
          gap: { xs: 3, md: 4 },
          alignItems: 'stretch',
        }}
      >
        <RevealOnScroll>
          <Box
            sx={{
              height: '100%',
              minHeight: { xs: 340, md: 430 },
              border: '1px solid',
              borderColor: alpha(theme.palette.primary.main, 0.16),
              borderRadius: 2,
              bgcolor: alpha(
                theme.palette.background.paper,
                theme.palette.mode === 'dark' ? 0.66 : 0.78,
              ),
              overflow: 'hidden',
              position: 'relative',
              p: { xs: 2.2, md: 3 },
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                insetInlineEnd: -70,
                top: -70,
                width: 210,
                height: 210,
                borderRadius: '50%',
                bgcolor: alpha(theme.palette.secondary.main, 0.13),
              }}
            />
            <Stack
              direction="row"
              spacing={1.2}
              alignItems="center"
              sx={{ mb: 3, position: 'relative' }}
            >
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 1.4,
                  bgcolor: alpha(theme.palette.primary.main, 0.12),
                  color: 'primary.main',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <StorefrontIcon />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                  {homeToStore.preview.caption}
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 900 }}>
                  {homeToStore.preview.title}
                </Typography>
              </Box>
            </Stack>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 1.2,
                mb: 2,
                position: 'relative',
              }}
            >
              {homeToStore.preview.products.map((product, index) => (
                <Box
                  key={product.name}
                  sx={{
                    p: 1.3,
                    borderRadius: 1.3,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: alpha(
                      theme.palette.background.default,
                      theme.palette.mode === 'dark' ? 0.55 : 0.76,
                    ),
                  }}
                >
                  <Box
                    sx={{
                      aspectRatio: '1/0.72',
                      borderRadius: 1,
                      mb: 1.1,
                      bgcolor: alpha(index === 0 ? theme.palette.secondary.main : theme.palette.primary.main, 0.16),
                    }}
                  />
                  <Typography variant="body2" sx={{ fontWeight: 900 }}>
                    {product.name}
                  </Typography>
                  <Typography variant="caption" color="primary" sx={{ fontWeight: 900 }}>
                    {product.price}
                  </Typography>
                </Box>
              ))}
            </Box>

            <Stack spacing={1.1} sx={{ position: 'relative' }}>
              <Box
                sx={{
                  p: 1.35,
                  borderRadius: 1.2,
                  bgcolor: alpha(theme.palette.success.main, 0.09),
                  border: '1px solid',
                  borderColor: alpha(theme.palette.success.main, 0.18),
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', fontWeight: 800 }}
                >
                  {homeToStore.preview.orderCaption}
                </Typography>
                <Typography variant="subtitle2" sx={{ color: 'success.main', fontWeight: 900 }}>
                  {homeToStore.preview.orderLine}
                </Typography>
              </Box>
              <Box
                sx={{
                  p: 1.35,
                  borderRadius: 1.2,
                  bgcolor: alpha(theme.palette.primary.main, 0.07),
                  direction: 'ltr',
                  textAlign: 'left',
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ color: 'primary.main', fontFamily: 'monospace', fontWeight: 900 }}
                >
                  https://yourbrand.ecommerce_core.store
                </Typography>
              </Box>
              <Box
                sx={{
                  p: 1.35,
                  borderRadius: 1.2,
                  bgcolor: alpha(theme.palette.warning.main, 0.08),
                  border: '1px solid',
                  borderColor: alpha(theme.palette.warning.main, 0.16),
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', fontWeight: 800 }}
                >
                  {homeToStore.preview.noServersCaption}
                </Typography>
                <Typography variant="subtitle2" sx={{ color: 'warning.main', fontWeight: 900 }}>
                  {homeToStore.preview.noServersTitle}
                </Typography>
              </Box>
              <Box
                sx={{
                  p: 1.35,
                  borderRadius: 1.2,
                  bgcolor: alpha(theme.palette.secondary.main, 0.08),
                  border: '1px solid',
                  borderColor: alpha(theme.palette.secondary.main, 0.16),
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.8 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900 }}>
                    {homeToStore.preview.readinessTitle}
                  </Typography>
                  <Typography variant="caption" color="secondary" sx={{ fontWeight: 900 }}>
                    91%
                  </Typography>
                </Stack>
                <Box sx={{ height: 86 }}>
                  <MarketingMiniChart
                    data={homeToStore.launchReadinessData}
                    color={theme.palette.secondary.main}
                  />
                </Box>
              </Box>
            </Stack>
          </Box>
        </RevealOnScroll>

        <Box sx={{ display: 'grid', gap: 1.4 }}>
          <Box sx={{ display: 'grid', gap: 1.4 }}>
            {homeToStore.steps.map((step, index) => {
              const Icon = stepIcons[index % stepIcons.length] ?? ShoppingBagOutlinedIcon;

              return (
                <RevealOnScroll key={step.step} delay={index * 80}>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '52px 1fr', sm: '64px 1fr' },
                      gap: 1.6,
                      alignItems: 'start',
                      minHeight: { xs: 118, md: 104 },
                      p: { xs: 1.8, md: 2.1 },
                      borderRadius: 1.2,
                      border: '1px solid',
                      borderColor:
                        index === 0 ? alpha(theme.palette.primary.main, 0.36) : 'divider',
                      bgcolor:
                        index === 0
                          ? alpha(
                              theme.palette.primary.main,
                              theme.palette.mode === 'dark' ? 0.1 : 0.065,
                            )
                          : alpha(
                              theme.palette.background.paper,
                              theme.palette.mode === 'dark' ? 0.5 : 0.68,
                            ),
                    }}
                  >
                    <Box
                      sx={{
                        width: { xs: 48, sm: 56 },
                        height: { xs: 48, sm: 56 },
                        borderRadius: 1.3,
                        bgcolor: alpha(theme.palette.primary.main, 0.11),
                        color: 'primary.main',
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      <Icon />
                    </Box>
                    <Box>
                      <Typography variant="caption" color="primary" sx={{ fontWeight: 900 }}>
                        {step.step}
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 900, mb: 0.6 }}>
                        {step.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                        {step.description}
                      </Typography>
                    </Box>
                  </Box>
                </RevealOnScroll>
              );
            })}
          </Box>

          <RevealOnScroll delay={280}>
            <Box
              sx={{
                mt: 1.4,
                p: { xs: 1.8, md: 2.2 },
                borderRadius: 1.4,
                border: '1px solid',
                borderColor: alpha(theme.palette.secondary.main, 0.2),
                bgcolor: alpha(
                  theme.palette.secondary.main,
                  theme.palette.mode === 'dark' ? 0.08 : 0.055,
                ),
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 900, mb: 1.5 }}>
                {homeToStore.buildTitle}
              </Typography>
              <Box sx={{ display: 'grid', gap: 1.1 }}>
                {homeToStore.buildCostItems.map((item, index) => {
                  const Icon = costIcons[index % costIcons.length] ?? CloudUploadIcon;

                  return (
                    <Stack key={item.title} direction="row" spacing={1.2} alignItems="flex-start">
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: 1,
                          bgcolor: alpha(theme.palette.secondary.main, 0.12),
                          color: 'secondary.main',
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Icon fontSize="small" />
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
                          {item.title}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ lineHeight: 1.6 }}
                        >
                          {item.description}
                        </Typography>
                      </Box>
                    </Stack>
                  );
                })}
              </Box>
            </Box>
          </RevealOnScroll>
        </Box>
      </Box>
    </MarketingSectionShell>
  );
}
