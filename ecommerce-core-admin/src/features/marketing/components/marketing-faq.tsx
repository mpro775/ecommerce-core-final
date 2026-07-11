import { LanguageIcon, RocketLaunchIcon, SettingsIcon, ExpandMoreIcon } from '../../../components/icons';
import { Accordion, AccordionDetails, AccordionSummary, Box, Typography } from '@mui/material';
import { useMarketingLocale } from '../marketing-locale-context';
import { RevealOnScroll } from './marketing-motion';
import { MarketingSectionShell } from './marketing-section-shell';
import { MarketingMetricCard } from './marketing-visuals';

export function MarketingFaq() {
  const { content } = useMarketingLocale();
  const faq = content.faq;

  return (
    <MarketingSectionShell
      id="faq"
      mascotAnchor="start"
      mascotScene="faq"
      eyebrow={faq.eyebrow}
      title={faq.title}
      description={faq.description}
      maxWidth="md"
    >
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1.1, mb: 2.4 }}>
        <MarketingMetricCard
          label={faq.metrics[0].label}
          value={faq.metrics[0].value}
          caption={faq.metrics[0].caption}
          tone={faq.metrics[0].tone}
          icon={<SettingsIcon fontSize="small" />}
        />
        <MarketingMetricCard
          label={faq.metrics[1].label}
          value={faq.metrics[1].value}
          caption={faq.metrics[1].caption}
          tone={faq.metrics[1].tone}
          icon={<LanguageIcon fontSize="small" />}
        />
        <MarketingMetricCard
          label={faq.metrics[2].label}
          value={faq.metrics[2].value}
          caption={faq.metrics[2].caption}
          tone={faq.metrics[2].tone}
          icon={<RocketLaunchIcon fontSize="small" />}
        />
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
        {faq.items.map((item, index) => (
          <RevealOnScroll key={item.question} delay={(index % 3) * 60}>
            <Accordion
              elevation={0}
              sx={{
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: '10px !important',
                overflow: 'hidden',
                '&:before': { display: 'none' },
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: 'primary.main' }} />} sx={{ px: 2.4, py: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 900, fontSize: '1rem' }}>
                  {item.question}
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 2.4, pb: 2.4, pt: 0 }}>
                <Typography color="text.secondary" sx={{ lineHeight: 1.75 }}>
                  {item.answer}
                </Typography>
              </AccordionDetails>
            </Accordion>
          </RevealOnScroll>
        ))}
      </Box>
    </MarketingSectionShell>
  );
}
