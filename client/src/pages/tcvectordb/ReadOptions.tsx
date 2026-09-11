import { useTranslation } from 'react-i18next';
import {
  Autocomplete,
  Box,
  FormControlLabel,
  MenuItem,
  Switch,
  TextField,
} from '@mui/material';
import type { ProviderReadConsistency } from '@server/providers/types';

export type ReadSettings = {
  filter: string;
  outputFields: string[];
  retrieveVector: boolean;
  readConsistency: ProviderReadConsistency;
};
export const defaultReadSettings: ReadSettings = {
  filter: '',
  outputFields: [],
  retrieveVector: false,
  readConsistency: 'strongConsistency',
};

export default function ReadOptions({
  value,
  onChange,
  fields,
}: {
  value: ReadSettings;
  onChange: (value: ReadSettings) => void;
  fields: string[];
}) {
  const { t } = useTranslation('tcvectordb');
  return (
    <>
      <TextField
        fullWidth
        size="small"
        label={t('filterExpression')}
        value={value.filter}
        onChange={e => onChange({ ...value, filter: e.target.value })}
      />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 200px 160px' },
          gap: 1.5,
          alignItems: 'center',
        }}
      >
        <Autocomplete
          multiple
          freeSolo
          options={fields}
          value={value.outputFields}
          onChange={(_, outputFields) => onChange({ ...value, outputFields })}
          renderInput={params => (
            <TextField {...params} size="small" label={t('outputFields')} />
          )}
        />
        <TextField
          select
          size="small"
          label={t('consistency')}
          value={value.readConsistency}
          onChange={e =>
            onChange({
              ...value,
              readConsistency: e.target.value as ProviderReadConsistency,
            })
          }
        >
          <MenuItem value="strongConsistency">{t('strong')}</MenuItem>
          <MenuItem value="eventualConsistency">{t('eventual')}</MenuItem>
        </TextField>
        <FormControlLabel
          sx={{ m: 0 }}
          control={
            <Switch
              size="small"
              checked={value.retrieveVector}
              onChange={(_, retrieveVector) =>
                onChange({ ...value, retrieveVector })
              }
            />
          }
          label={t('retrieveVector')}
        />
      </Box>
    </>
  );
}
