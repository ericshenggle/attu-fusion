import { MenuItem, Stack, TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';

export type HybridRerankSettings = {
  method: 'rrf' | 'weighted';
  k: number;
  denseWeight: number;
};
export const defaultRerank: HybridRerankSettings = {
  method: 'rrf',
  k: 60,
  denseWeight: 0.7,
};

export default function HybridRerank({
  value,
  onChange,
  disabled,
}: {
  value: HybridRerankSettings;
  onChange: (value: HybridRerankSettings) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation('embedding');
  return (
    <Stack spacing={1.5}>
      <TextField
        select
        fullWidth
        size="small"
        label={t('rerank')}
        value={value.method}
        disabled={disabled}
        onChange={e =>
          onChange({
            ...value,
            method: e.target.value as HybridRerankSettings['method'],
          })
        }
      >
        <MenuItem value="rrf">RRF</MenuItem>
        <MenuItem value="weighted">{t('weighted')}</MenuItem>
      </TextField>
      {value.method === 'rrf' ? (
        <TextField
          fullWidth
          size="small"
          label="RRF k"
          type="number"
          value={value.k}
          inputProps={{ min: 1, max: 16384, step: 1 }}
          disabled={disabled}
          onChange={e => onChange({ ...value, k: Number(e.target.value) })}
        />
      ) : (
        <TextField
          fullWidth
          size="small"
          label={t('denseWeight')}
          type="number"
          value={value.denseWeight}
          inputProps={{ min: 0, max: 1, step: 0.1 }}
          disabled={disabled}
          helperText={t('sparseWeight', {
            weight: Number((1 - value.denseWeight).toFixed(4)),
          })}
          onChange={e =>
            onChange({ ...value, denseWeight: Number(e.target.value) })
          }
        />
      )}
    </Stack>
  );
}
