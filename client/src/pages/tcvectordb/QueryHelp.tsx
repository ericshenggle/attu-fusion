import { useTranslation } from 'react-i18next';
import { Accordion, AccordionDetails, AccordionSummary, Box, Typography } from '@mui/material';
import icons from '@/components/icons/Icons';

export default function QueryHelp({
  dimension,
  search = false,
}: {
  dimension?: number;
  search?: boolean;
}) {
  const { t } = useTranslation('tcvectordb');
  return (
    <Accordion disableGutters variant="outlined" sx={{ '&:before': { display: 'none' } }}>
      <AccordionSummary expandIcon={<icons.rightArrow />}>
        <icons.info sx={{ mr: 1, fontSize: 18 }} />
        <Typography variant="body2" fontWeight={600}>
          {search ? t('searchHelp') : t('queryHelp')}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1 }}>
          {t('filterExamples')}
        </Typography>
        <Box component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', fontSize: 12 }}>
          {`text = "alpha"\nscore >= 0.8\ncategory in ("a", "b")`}
        </Box>
        {search && (
          <>
            <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
              {t('vectorExample', { dimension: dimension ?? '--' })}
            </Typography>
            <Box component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', fontSize: 12 }}>
              {`[0.1, 0.2, 0.3${dimension && dimension > 3 ? ', ...' : ''}]`}
            </Box>
            <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
              {t('advancedSearchExample')}
            </Typography>
            <Box component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', fontSize: 12 }}>
              {`{"ann":[{"fieldName":"vector","data":[[0.1,0.2]],"limit":10}],"limit":10}`}
            </Box>
          </>
        )}
      </AccordionDetails>
    </Accordion>
  );
}
