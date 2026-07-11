import { InstagramIcon, LinkedInIcon, TwitterIcon } from '../../../components/icons';
import { Box, Container, Stack, Typography, Divider, IconButton } from '@mui/material';
import { useMarketingLocale } from '../marketing-locale-context';

interface MarketingFooterProps {
  onCreateAccount: () => void;
  onSignIn: () => void;
}

const ecommerce_core_LOGO_SRC = '/brand/ecommerce_core-logo.png';
const ecommerce_core_ICON_SRC = '/brand/ecommerce_core-icon.png';

export function MarketingFooter({ onCreateAccount: _onCreateAccount, onSignIn: _onSignIn }: MarketingFooterProps) {
  const { content } = useMarketingLocale();
  const footer = content.footer;

  return (
    <Box component="footer" sx={{ pt: 10, pb: 4, bgcolor: 'background.default', borderTop: '1px solid', borderColor: 'divider' }}>
      <Container maxWidth="lg">
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '2fr 3fr' }, gap: 8, mb: 8 }}>
          <Box>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
              <Box
                component="img"
                src={ecommerce_core_ICON_SRC}
                alt="Ecommerce Core Store"
                sx={{
                  width: 42,
                  height: 42,
                  objectFit: 'contain',
                  display: { xs: 'block', sm: 'none' },
                }}
              />
              <Box
                component="img"
                src={ecommerce_core_LOGO_SRC}
                alt="Ecommerce Core Store"
                sx={{
                  width: { sm: 190, md: 220 },
                  height: 'auto',
                  objectFit: 'contain',
                  display: { xs: 'none', sm: 'block' },
                }}
              />
            </Stack>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 350, lineHeight: 1.7 }}>
              {footer.description}
            </Typography>
            <Stack direction="row" spacing={1}>
              <IconButton
                size="small"
                aria-label="فتح حساب النظام على تويتر"
                sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
              >
                <TwitterIcon />
              </IconButton>
              <IconButton
                size="small"
                aria-label="فتح حساب النظام على لينكدإن"
                sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
              >
                <LinkedInIcon />
              </IconButton>
              <IconButton
                size="small"
                aria-label="فتح حساب النظام على إنستغرام"
                sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
              >
                <InstagramIcon />
              </IconButton>
            </Stack>
          </Box>

          {/* Links Grid */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 4 }}>
            {footer.columns.map((column) => (
              <Box key={column.title}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2, color: 'text.primary' }}>
                  {column.title}
                </Typography>
                <Stack spacing={1.5}>
                  {column.links.map((link) => (
                    <Typography 
                      key={link} 
                      component="a" 
                      href="#" 
                      variant="body2" 
                      color="text.secondary" 
                      sx={{ 
                        textDecoration: 'none', 
                        transition: 'color 0.2s',
                        '&:hover': { color: 'primary.main' }
                      }}
                    >
                      {link}
                    </Typography>
                  ))}
                </Stack>
              </Box>
            ))}
          </Box>
        </Box>

        <Divider sx={{ mb: 4 }} />

        {/* Bottom Bar */}
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {footer.copyright} © {new Date().getFullYear()} Ecommerce Core Store
          </Typography>
          <Stack direction="row" spacing={3}>
            <Typography component="a" href="#" variant="body2" color="text.secondary" sx={{ textDecoration: 'none', '&:hover': { color: 'text.primary' } }}>
              {footer.terms}
            </Typography>
            <Typography component="a" href="#" variant="body2" color="text.secondary" sx={{ textDecoration: 'none', '&:hover': { color: 'text.primary' } }}>
              {footer.privacy}
            </Typography>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}
