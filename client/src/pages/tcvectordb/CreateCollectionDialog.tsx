import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import icons from '@/components/icons/Icons';
import { TencentVectorDbService } from '@/http/TencentVectorDb.service';
import type { ProviderIndex } from '@server/providers/types';

export const requestError = (error: unknown) => {
  const e = error as {
    response?: { data?: { message?: string } };
    message?: string;
  };
  return e.response?.data?.message || e.message || 'Request failed.';
};

export default function CreateCollectionDialog({
  database,
  onClose,
  onCreated,
}: {
  database: string;
  onClose: () => void;
  onCreated: (name: string) => void;
}) {
  const { t } = useTranslation('tcvectordb');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [shards, setShards] = useState(1);
  const [replicas, setReplicas] = useState(1);
  const [dimension, setDimension] = useState(768);
  const [indexType, setIndexType] = useState('HNSW');
  const [metric, setMetric] = useState('COSINE');
  const [m, setM] = useState(16);
  const [ef, setEf] = useState(200);
  const [includeSparseIndex, setIncludeSparseIndex] = useState(false);
  const [fields, setFields] = useState<
    Array<{ key: string; name: string; type: string }>
  >([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const validName = (value: string) =>
    /^[a-zA-Z][a-zA-Z0-9_-]{0,127}$/.test(value);
  const validNumber = (value: number, min: number, max: number) =>
    Number.isInteger(value) && value >= min && value <= max;
  const fieldNames = fields.map(f => f.name);
  const valid =
    validName(name) &&
    description.length <= 256 &&
    validNumber(shards, 1, 100) &&
    validNumber(replicas, 0, Number.MAX_SAFE_INTEGER) &&
    validNumber(dimension, 1, 4096) &&
    (indexType !== 'HNSW' ||
      (validNumber(m, 4, 64) && validNumber(ef, 8, 512))) &&
    fields.every(
      f =>
        validName(f.name) && !['id', 'vector', 'sparse_vector'].includes(f.name)
    ) &&
    new Set(fieldNames).size === fields.length;

  const create = async () => {
    if (busy || !valid) return;
    setBusy(true);
    setError('');
    const indexes: ProviderIndex[] = [
      { fieldName: 'id', fieldType: 'string', indexType: 'primaryKey' },
      {
        fieldName: 'vector',
        fieldType: 'vector',
        indexType,
        dimension,
        metricType: metric,
        ...(indexType === 'HNSW'
          ? { params: { M: m, efConstruction: ef } }
          : {}),
      },
      ...(includeSparseIndex
        ? [
            {
              fieldName: 'sparse_vector',
              fieldType: 'sparse_vector',
              indexType: 'SPARSE_INVERTED_INDEX',
              metricType: 'IP',
            },
          ]
        : []),
      ...fields.map(f => ({
        fieldName: f.name,
        fieldType: f.type,
        indexType: 'filter',
      })),
    ];
    try {
      await TencentVectorDbService.createCollection({
        database,
        collection: name,
        description,
        shardNum: shards,
        replicaNum: replicas,
        indexes,
      });
      onCreated(name);
    } catch (e) {
      setError(requestError(e));
    } finally {
      setBusy(false);
    }
  };

  const numberInput = (
    label: string,
    value: number,
    set: (n: number) => void,
    min: number,
    max?: number
  ) => (
    <TextField
      fullWidth
      size="small"
      type="number"
      label={label}
      value={Number.isNaN(value) ? '' : value}
      onChange={e => set(e.target.value === '' ? NaN : Number(e.target.value))}
      inputProps={{ min, max, step: 1 }}
      required
    />
  );

  return (
    <Dialog open fullWidth maxWidth="sm" onClose={busy ? undefined : onClose}>
      <Box
        component="form"
        onSubmit={e => {
          e.preventDefault();
          void create();
        }}
      >
        <DialogTitle>{t('create')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Tencent VectorDB / {database}
            </Typography>
            <TextField
              size="small"
              label={t('name')}
              required
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              inputProps={{
                maxLength: 128,
                pattern: '[a-zA-Z][a-zA-Z0-9_-]{0,127}',
              }}
            />
            <TextField
              size="small"
              label={t('description')}
              value={description}
              onChange={e => setDescription(e.target.value)}
              inputProps={{ maxLength: 256 }}
            />
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 2,
              }}
            >
              {numberInput(t('shards'), shards, setShards, 1, 100)}
              {numberInput(t('replicas'), replicas, setReplicas, 0)}
            </Box>
            <Typography variant="subtitle2">id: string / primaryKey</Typography>
            <Typography variant="subtitle2">vector: vector</Typography>
            {numberInput(t('dimension'), dimension, setDimension, 1, 4096)}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 2,
              }}
            >
              <TextField
                select
                size="small"
                label={t('indexType')}
                value={indexType}
                onChange={e => setIndexType(e.target.value)}
              >
                {['HNSW', 'FLAT'].map(v => (
                  <MenuItem key={v} value={v}>
                    {v}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label={t('metric')}
                value={metric}
                onChange={e => setMetric(e.target.value)}
              >
                {['COSINE', 'L2', 'IP'].map(v => (
                  <MenuItem key={v} value={v}>
                    {v}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
            {indexType === 'HNSW' && (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 2,
                }}
              >
                {numberInput('M', m, setM, 4, 64)}
                {numberInput('efConstruction', ef, setEf, 8, 512)}
              </Box>
            )}
            <Box>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeSparseIndex}
                    onChange={event =>
                      setIncludeSparseIndex(event.target.checked)
                    }
                  />
                }
                label={t('sparseVectorIndex')}
              />
              {includeSparseIndex && (
                <Typography variant="body2" color="text.secondary">
                  sparse_vector: sparse_vector / SPARSE_INVERTED_INDEX / IP
                </Typography>
              )}
            </Box>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Typography variant="subtitle2">{t('filterIndexes')}</Typography>
              <Tooltip title={t('addField')}>
                <IconButton
                  aria-label={t('addField')}
                  onClick={() =>
                    setFields(v => [
                      ...v,
                      {
                        key: String(
                          crypto.getRandomValues(new Uint32Array(1))[0]
                        ),
                        name: '',
                        type: 'string',
                      },
                    ])
                  }
                >
                  <icons.add />
                </IconButton>
              </Tooltip>
            </Box>
            {fields.map(field => (
              <Box
                key={field.key}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) 36px',
                  gap: 1,
                }}
              >
                <TextField
                  size="small"
                  required
                  label={t('fieldName')}
                  value={field.name}
                  onChange={e =>
                    setFields(v =>
                      v.map(f =>
                        f.key === field.key ? { ...f, name: e.target.value } : f
                      )
                    )
                  }
                />
                <TextField
                  size="small"
                  select
                  label={t('fieldType')}
                  value={field.type}
                  onChange={e =>
                    setFields(v =>
                      v.map(f =>
                        f.key === field.key ? { ...f, type: e.target.value } : f
                      )
                    )
                  }
                >
                  {['string', 'uint64', 'int64', 'double', 'array', 'json'].map(
                    v => (
                      <MenuItem key={v} value={v}>
                        {v}
                      </MenuItem>
                    )
                  )}
                </TextField>
                <Tooltip title={t('removeField')}>
                  <IconButton
                    aria-label={t('removeField')}
                    onClick={() =>
                      setFields(v => v.filter(f => f.key !== field.key))
                    }
                  >
                    <icons.delete />
                  </IconButton>
                </Tooltip>
              </Box>
            ))}
            {error && (
              <Alert severity="error" sx={{ color: 'text.primary' }}>
                {error}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="submit" variant="contained" disabled={busy || !valid}>
            {busy ? t('creating') : t('create')}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
