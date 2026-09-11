import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import icons from '@/components/icons/Icons';
import { TencentVectorDbService } from '@/http/TencentVectorDb.service';
import type {
  ProviderCollection,
  ProviderDocument,
  ProviderSearchDocumentsResult,
} from '@server/providers/types';
import { requestError } from './CreateCollectionDialog';
import DocumentTable, { downloadDocuments } from './DocumentTable';
import ReadOptions, { defaultReadSettings } from './ReadOptions';
import QueryHelp from './QueryHelp';

export default function CollectionSearch({
  collection,
}: {
  collection: ProviderCollection;
}) {
  const { t } = useTranslation('tcvectordb');
  const [mode, setMode] = useState<
    'vector' | 'id' | 'text' | 'hybrid' | 'fulltext'
  >('vector');
  const [input, setInput] = useState('');
  const [limit, setLimit] = useState(10);
  const [ef, setEf] = useState(200);
  const [nprobe, setNprobe] = useState(1);
  const [settings, setSettings] = useState(defaultReadSettings);
  const [result, setResult] = useState<ProviderSearchDocumentsResult>();
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const index = collection.indexes?.find(i => i.fieldName === 'vector');
  const resultRows =
    result?.documents.reduce<ProviderDocument[]>(
      (rows, group) => rows.concat(group),
      []
    ) || [];
  const binary = index?.fieldType === 'binary_vector';
  const dimension = index?.dimension;
  const expectedLength =
    dimension === undefined ? undefined : binary ? dimension / 8 : dimension;
  const search = async () => {
    if (busy) return;
    setError('');
    setResult(undefined);
    let vectors: number[][] | undefined;
    if (mode === 'vector') {
      try {
        const vector: unknown = JSON.parse(input);
        if (
          !Array.isArray(vector) ||
          !vector.length ||
          (expectedLength !== undefined && vector.length !== expectedLength) ||
          vector.some(
            v =>
              typeof v !== 'number' ||
              !Number.isFinite(v) ||
              (binary && (!Number.isInteger(v) || v < 0 || v > 255))
          )
        ) {
          setError(t('invalidVector', { dimension: expectedLength ?? '--' }));
          return;
        }
        vectors = [vector];
      } catch {
        setError(t('invalidJson'));
        return;
      }
    }
    setBusy(true);
    const start = performance.now();
    try {
      if (mode === 'hybrid' || mode === 'fulltext') {
        const advanced = JSON.parse(input) as Record<string, unknown>;
        const response =
          mode === 'hybrid'
            ? await TencentVectorDbService.hybridSearch({
                database: collection.database,
                collection: collection.collection,
                readConsistency: settings.readConsistency,
                search: advanced,
              })
            : await TencentVectorDbService.fullTextSearch({
                database: collection.database,
                collection: collection.collection,
                readConsistency: settings.readConsistency,
                search: advanced,
              });
        if (alive.current) {
          setResult(response);
          setElapsed(Math.round(performance.now() - start));
        }
        return;
      }
      const response = await TencentVectorDbService.searchDocuments({
        database: collection.database,
        collection: collection.collection,
        ...settings,
        limit,
        ...(vectors
          ? { vectors }
          : mode === 'id'
            ? { documentIds: [input.trim()] }
            : { embeddingItems: [input] }),
        ...(index?.indexType === 'HNSW'
          ? { ef }
          : index?.indexType.startsWith('IVF')
            ? { nprobe }
            : {}),
      });
      if (alive.current) {
        setResult(response);
        setElapsed(Math.round(performance.now() - start));
      }
    } catch (e) {
      if (alive.current) setError(requestError(e));
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  return (
    <Stack spacing={2}>
      <Box
        component="form"
        onSubmit={e => {
          e.preventDefault();
          void search();
        }}
      >
        <Stack spacing={1.5}>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={mode}
            disabled={busy}
            onChange={(_, value) => {
              if (value) {
                setMode(value);
                setInput('');
                setResult(undefined);
                setError('');
              }
            }}
            aria-label={t('searchMode')}
          >
            <ToggleButton value="vector">{t('vector')}</ToggleButton>
            <ToggleButton value="id">{t('documentId')}</ToggleButton>
            {collection.embedding?.status === 'enabled' && (
              <ToggleButton value="text">{t('text')}</ToggleButton>
            )}
            <ToggleButton value="hybrid">{t('hybrid')}</ToggleButton>
            <ToggleButton value="fulltext">{t('fullText')}</ToggleButton>
          </ToggleButtonGroup>
          <TextField
            fullWidth
            required
            size="small"
            multiline={mode !== 'id'}
            minRows={mode === 'id' ? undefined : 3}
            maxRows={8}
            label={
              mode === 'vector'
                ? t('vectorJson')
                : mode === 'id'
                  ? t('documentId')
                  : mode === 'text'
                    ? t('searchText')
                    : t('advancedSearchJson')
            }
            value={input}
            disabled={busy}
            onChange={e => setInput(e.target.value)}
            inputProps={
              mode === 'id'
                ? { maxLength: 128 }
                : {
                    style: {
                      fontFamily: mode === 'vector' ? 'monospace' : undefined,
                    },
                  }
            }
          />
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1.5,
              alignItems: 'center',
            }}
          >
            <TextField
              size="small"
              type="number"
              label="Top K"
              value={limit}
              onChange={e => setLimit(Number(e.target.value))}
              inputProps={{ min: 1, max: 16384, step: 1 }}
              sx={{ width: 130 }}
            />
            {index?.indexType === 'HNSW' && (
              <TextField
                size="small"
                type="number"
                label="ef"
                value={ef}
                onChange={e => setEf(Number(e.target.value))}
                inputProps={{ min: 1, max: 32768, step: 1 }}
                sx={{ width: 130 }}
              />
            )}
            {index?.indexType.startsWith('IVF') && (
              <TextField
                size="small"
                type="number"
                label="nprobe"
                value={nprobe}
                onChange={e => setNprobe(Number(e.target.value))}
                inputProps={{
                  min: 1,
                  max: index.params?.nlist ?? 65536,
                  step: 1,
                }}
                sx={{ width: 130 }}
              />
            )}
            <Typography variant="body2" color="text.secondary">
              {index?.indexType} / {index?.metricType} / {t('dimension')}:{' '}
              {dimension ?? '--'}
            </Typography>
          </Box>
          <ReadOptions
            value={settings}
            onChange={setSettings}
            fields={(collection.indexes || []).map(i => i.fieldName)}
          />
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 1,
            }}
          >
            <Button
              type="submit"
              variant="contained"
              startIcon={<icons.search />}
              disabled={busy || !input.trim()}
            >
              {t('search')}
            </Button>
            <Tooltip title={t('exportResults')}>
              <span>
                <IconButton
                  aria-label={t('exportResults')}
                  disabled={!resultRows.length || busy}
                  onClick={() => downloadDocuments(resultRows)}
                >
                  <icons.download />
                </IconButton>
              </span>
            </Tooltip>
            {busy && <CircularProgress size={18} />}
            {result && (
              <Typography variant="body2">
                {t('searchSummary', {
                  count: resultRows.length,
                  elapsed,
                })}
              </Typography>
            )}
          </Box>
        </Stack>
      </Box>
      <QueryHelp dimension={dimension} search />
      {error && (
        <Alert severity="error" sx={{ color: 'text.primary' }}>
          {error}
        </Alert>
      )}
      {result?.documents.map((documents, i) => (
        <DocumentTable key={i} documents={documents} />
      ))}
    </Stack>
  );
}
