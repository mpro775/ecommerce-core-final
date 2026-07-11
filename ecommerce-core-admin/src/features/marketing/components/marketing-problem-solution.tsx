import { CancelOutlinedIcon, CheckCircleOutlineIcon } from '../../../components/icons';
import { Box, Stack, Typography, alpha, useTheme } from '@mui/material';
import { useMarketingLocale } from '../marketing-locale-context';
import { RevealOnScroll } from './marketing-motion';
import { MarketingSectionShell } from './marketing-section-shell';
import { MarketingMetricCard, MarketingMiniChart } from './marketing-visuals';

export function MarketingProblemSolution() {
  const theme = useTheme();
  const { content } = useMarketingLocale();
  const problem = content.problem;

  return (
    <MarketingSectionShell
      id="problem"
      mascotAnchor="center"
      mascotScene="problem"
      eyebrow={problem.eyebrow}
      title={problem.title}
      description={problem.description}
      surface="paper"
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1.06fr 0.94fr' },
          gap: { xs: 2.4, md: 3 },
          alignItems: 'stretch',
        }}
      >
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.6 }}>
          {[
            {
              title: problem.beforeTitle,
              items: problem.problemItems,
              color: theme.palette.error.main,
              icon: CancelOutlinedIcon,
            },
            {
              title: problem.afterTitle,
              items: problem.solutionItems,
              color: theme.palette.success.main,
              icon: CheckCircleOutlineIcon,
            },
          ].map((column, columnIndex) => {
            const Icon = column.icon;

            return (
              <RevealOnScroll key={column.title} delay={columnIndex * 100}>
                <Box
                  sx={{
                    height: '100%',
                    minHeight: 390,
                    p: { xs: 2.2, md: 2.7 },
                    borderRadius: 1.2,
                    border: '1px solid',
                    borderColor: alpha(column.color, 0.22),
                    bgcolor: alpha(column.color, theme.palette.mode === 'dark' ? 0.08 : 0.045),
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      insetInlineEnd: -32,
                      top: -32,
                      width: 120,
                      height: 120,
                      borderRadius: '50%',
                      border: '1px solid',
                      borderColor: alpha(column.color, 0.16),
                    }}
                  />
                  <Stack
                    direction="row"
                    spacing={1.5}
                    alignItems="center"
                    sx={{ mb: 2.5, position: 'relative' }}
                  >
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: 1.2,
                        bgcolor: alpha(column.color, 0.12),
                        color: column.color,
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      <Icon />
                    </Box>
                    <Typography variant="h5" sx={{ fontWeight: 900 }}>
                      {column.title}
                    </Typography>
                  </Stack>
                  <Stack spacing={1.5} sx={{ position: 'relative' }}>
                    {column.items.map((item) => (
                      <Box
                        key={item}
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: '10px 1fr',
                          gap: 1.2,
                          alignItems: 'start',
                        }}
                      >
                        <Box
                          sx={{
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            bgcolor: column.color,
                            mt: 1.05,
                          }}
                        />
                        <Typography color="text.secondary" sx={{ lineHeight: 1.75, fontWeight: 600 }}>
                          {item}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              </RevealOnScroll>
            );
          })}
        </Box>

        <RevealOnScroll delay={160}>
          <Box
            sx={{
              height: '100%',
              p: { xs: 2.2, md: 2.8 },
              borderRadius: 1.4,
              border: '1px solid',
              borderColor: alpha(theme.palette.primary.main, 0.18),
              bgcolor: alpha(theme.palette.background.default, theme.palette.mode === 'dark' ? 0.48 : 0.68),
            }}
          >
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)', lg: '1fr 1fr' }, gap: 1, mb: 2.2 }}>
              <MarketingMetricCard label={problem.metricCards[0].label} value={problem.metricCards[0].value} tone="error" caption={problem.metricCards[0].caption} />
              <MarketingMetricCard label={problem.metricCards[1].label} value={problem.metricCards[1].value} tone="success" caption={problem.metricCards[1].caption} />
            </Box>

            <Typography variant="h6" sx={{ fontWeight: 900, mb: 1.3 }}>
              {problem.impactTitle}
            </Typography>
            <Stack spacing={1.25} sx={{ mb: 2.5 }}>
              {problem.impactData.map((item) => (
                <Box key={item.name}>
                  <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.7 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900 }}>
                      {item.name}
                    </Typography>
                    <Typography variant="caption" color="primary" sx={{ fontWeight: 900 }}>
                      {item.after}%
                    </Typography>
                  </Stack>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 0.55 }}>
                    <Box sx={{ height: 8, borderRadius: 999, bgcolor: alpha(theme.palette.error.main, 0.12), overflow: 'hidden' }}>
                      <Box sx={{ width: `${item.before}%`, height: '100%', bgcolor: alpha(theme.palette.error.main, 0.62), borderRadius: 999 }} />
                    </Box>
                    <Box sx={{ height: 8, borderRadius: 999, bgcolor: alpha(theme.palette.success.main, 0.12), overflow: 'hidden' }}>
                      <Box sx={{ width: `${item.after}%`, height: '100%', bgcolor: theme.palette.success.main, borderRadius: 999 }} />
                    </Box>
                  </Box>
                </Box>
              ))}
            </Stack>

            <Box sx={{ height: 190 }}>
              <MarketingMiniChart
                type="bar"
                data={problem.clarityData.map((item) => ({
                  name: item.name,
                  value: item.value,
                  secondary: item.secondary,
                }))}
                color={theme.palette.error.main}
                secondaryColor={theme.palette.success.main}
              />
            </Box>
          </Box>
        </RevealOnScroll>
      </Box>
    </MarketingSectionShell>
  );
}
