import { Box, Container, Typography, Paper } from '@mui/material';
import { useMarketingLocale } from '../marketing-locale-context';

export function MarketingScreenshots() {
  const { content } = useMarketingLocale();
  const screenshots = content.screenshots;

  return (
    <Box
      component="section"
      id="screenshots"
      sx={{ py: { xs: 8, md: 12 }, bgcolor: 'background.default' }}
    >
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: { xs: 6, md: 8 }, maxWidth: 700, mx: 'auto' }}>
          <Typography
            variant="caption"
            sx={{
              color: 'primary.main',
              fontWeight: 800,
              letterSpacing: 1,
              textTransform: 'uppercase',
              display: 'block',
              mb: 1.5,
            }}
          >
            {screenshots.eyebrow}
          </Typography>
          <Typography variant="h2" sx={{ mb: 2, fontSize: { xs: '2rem', md: '2.5rem' } }}>
            {screenshots.title}
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 400 }}>
            {screenshots.description}
          </Typography>
        </Box>

        <Box
          sx={{ display: 'grid', gap: 4, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' } }}
        >
          {screenshots.items.slice(0, 4).map((item) => (
            <Paper
              key={item.title}
              elevation={0}
              sx={{
                p: { xs: 2, md: 3 },
                borderRadius: 4,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box
                sx={{
                  width: '100%',
                  aspectRatio: '16/10',
                  borderRadius: 2,
                  bgcolor: 'background.default',
                  border: '1px dashed',
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 3,
                }}
              >
                <Typography
                  variant="h6"
                  color="text.secondary"
                  sx={{
                    fontWeight: 700,
                    opacity: (theme) => (theme.palette.mode === 'dark' ? 0.86 : 0.5),
                  }}
                >
                  {screenshots.imageLabel} ({item.title})
                </Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
                {item.title}
              </Typography>
              <Typography color="text.secondary">{item.caption}</Typography>
            </Paper>
          ))}
        </Box>
      </Container>
    </Box>
  );
}
