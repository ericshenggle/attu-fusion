import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AutoAwesome from '@mui/icons-material/AutoAwesome';
import { useTranslation } from 'react-i18next';
import { EmbeddingService } from '@/http/Embedding.service';
import type {
  EmbeddingProviderInfo,
  EmbeddingResult,
  EmbeddingOutputType,
} from '@server/embedding/types';
import VectorPreview from './VectorPreview';

export type EmbeddingEditorHandle = {
  generate: () => Promise<EmbeddingResult>;
};
type Props = {
  input: string;
  onInputChange: (value: string) => void;
  targetDimension?: number;
  disabled?: boolean;
  onReadyChange?: (ready: boolean) => void;
  onResultChange?: (result: EmbeddingResult | undefined) => void;
  outputTypes?: EmbeddingOutputType[];
  onOutputTypeChange?: (outputType: EmbeddingOutputType) => void;
};
const defaultOutputTypes: EmbeddingOutputType[] = [
  'dense',
  'sparse',
  'dense&sparse',
];
const errorMessage = (error: unknown) => {
  const e = error as {
    response?: { data?: { message?: string } };
    message?: string;
  };
  return e.response?.data?.message || e.message || 'Embedding request failed.';
};

const EmbeddingEditor = forwardRef<EmbeddingEditorHandle, Props>(
  function EmbeddingEditor(
    {
      input,
      onInputChange,
      targetDimension,
      disabled = false,
      onReadyChange,
      onResultChange,
      outputTypes = defaultOutputTypes,
      onOutputTypeChange,
    },
    ref
  ) {
    const { t } = useTranslation('embedding');
    const [providers, setProviders] = useState<EmbeddingProviderInfo[]>([]);
    const [providerId, setProviderId] = useState('');
    const [modelId, setModelId] = useState('');
    const [outputType, setOutputType] = useState<EmbeddingOutputType>(
      outputTypes[0] || 'dense'
    );
    const [dimension, setDimension] = useState<number | ''>('');
    const [apiKey, setApiKey] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [reload, setReload] = useState(0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState<EmbeddingResult>();
    const requestController = useRef<AbortController>();
    const cached = useRef<EmbeddingResult>();
    const readyCallback = useRef(onReadyChange);
    const resultCallback = useRef(onResultChange);
    readyCallback.current = onReadyChange;
    resultCallback.current = onResultChange;
    const provider = providers.find(p => p.id === providerId);
    const model = provider?.models.find(m => m.id === modelId);
    const supportedOutputs = outputTypes.filter(type =>
      model?.outputTypes.includes(type)
    );
    const dense = outputType !== 'sparse';
    const mismatch =
      dense &&
      targetDimension !== undefined &&
      dimension !== '' &&
      dimension !== targetDimension;
    const ready =
      !loading &&
      !loadError &&
      !!model &&
      supportedOutputs.includes(outputType) &&
      (!dense || (dimension !== '' && model.dimensions.includes(dimension))) &&
      (!provider?.requiresApiKey || !!apiKey.trim()) &&
      !!input.trim() &&
      input.length <= 65536 &&
      !mismatch;

    useEffect(() => {
      if (supportedOutputs.length && !supportedOutputs.includes(outputType))
        setOutputType(supportedOutputs[0]);
    }, [supportedOutputs.join(','), outputType]);
    useEffect(() => {
      onOutputTypeChange?.(outputType);
    }, [outputType, onOutputTypeChange]);

    useEffect(() => {
      const controller = new AbortController();
      setLoading(true);
      setLoadError('');
      EmbeddingService.providers(controller.signal)
        .then(items => {
          if (controller.signal.aborted) return;
          setProviders(items);
          const first = items[0];
          const initialModel =
            first?.models.find(
              m =>
                targetDimension !== undefined &&
                m.dimensions.includes(targetDimension)
            ) || first?.models[0];
          setProviderId(first?.id || '');
          setModelId(initialModel?.id || '');
          setDimension(
            initialModel
              ? targetDimension &&
                initialModel.dimensions.includes(targetDimension)
                ? targetDimension
                : initialModel.defaultDimension
              : ''
          );
        })
        .catch(e => {
          if (!controller.signal.aborted) setLoadError(errorMessage(e));
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
      return () => controller.abort();
    }, [reload, targetDimension]);

    useEffect(() => {
      requestController.current?.abort();
      cached.current = undefined;
      setResult(undefined);
      setError('');
      setBusy(false);
      resultCallback.current?.(undefined);
      return () => requestController.current?.abort();
    }, [
      providerId,
      modelId,
      dimension,
      input,
      apiKey,
      targetDimension,
      outputType,
    ]);

    useEffect(() => {
      readyCallback.current?.(ready && !busy);
    }, [ready, busy]);
    useImperativeHandle(ref, () => ({ generate }));

    async function generate() {
      if (!ready || busy) throw new Error(t('incomplete'));
      if (cached.current) return cached.current;
      const controller = new AbortController();
      requestController.current = controller;
      setBusy(true);
      setError('');
      try {
        const generated = await EmbeddingService.generate(
          {
            provider: providerId,
            model: modelId,
            dimension: dense ? Number(dimension) : undefined,
            outputType,
            input,
            apiKey: apiKey || undefined,
            targetDimension: dense ? targetDimension : undefined,
          },
          controller.signal
        );
        if (controller.signal.aborted) throw new Error(t('cancelled'));
        if (
          generated.outputType !== outputType ||
          (dense &&
            (generated.dimension !== dimension ||
              !Array.isArray(generated.vector) ||
              generated.vector.length !== dimension ||
              generated.vector.some(
                v => typeof v !== 'number' || !Number.isFinite(v)
              ))) ||
          (outputType !== 'dense' &&
            (!Array.isArray(generated.sparseVector) ||
              !generated.sparseVector.length ||
              generated.sparseVector.some(
                v =>
                  !Number.isInteger(v.index) ||
                  v.index < 0 ||
                  v.index > 4294967294 ||
                  !Number.isFinite(v.value)
              ) ||
              new Set(generated.sparseVector.map(v => v.index)).size !==
                generated.sparseVector.length))
        )
          throw new Error(t('invalidResult'));
        cached.current = generated;
        setResult(generated);
        resultCallback.current?.(generated);
        return generated;
      } catch (e) {
        if (!controller.signal.aborted) setError(errorMessage(e));
        throw e;
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    }

    return (
      <Stack
        spacing={1.5}
        sx={{
          minWidth: 0,
          containerType: 'inline-size',
          containerName: 'embedding-editor',
        }}
      >
        {loading && <CircularProgress size={18} />}
        {loadError && (
          <Alert
            severity="error"
            action={
              <Button onClick={() => setReload(v => v + 1)}>
                {t('retry')}
              </Button>
            }
          >
            {loadError}
          </Alert>
        )}
        {!loading && !loadError && !providers.length && (
          <Alert severity="info">{t('noProviders')}</Alert>
        )}
        <Box
          component="fieldset"
          disabled={disabled || busy}
          sx={{
            border: 0,
            p: 0,
            m: 0,
            minWidth: 0,
            display: 'grid',
            gap: 1.5,
            gridTemplateColumns: 'minmax(0, 1fr)',
            alignItems: 'start',
            '@container embedding-editor (min-width: 480px)': {
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            },
            '@container embedding-editor (min-width: 960px)': {
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            },
            '& .MuiTextField-root': { minWidth: 0 },
          }}
        >
          <TextField
            select
            size="small"
            fullWidth
            label={t('provider')}
            value={providerId}
            disabled={loading || !providers.length}
            onChange={e => {
              setProviderId(e.target.value);
              setApiKey('');
              const next = providers.find(p => p.id === e.target.value)
                ?.models[0];
              setModelId(next?.id || '');
              setDimension(
                next
                  ? targetDimension && next.dimensions.includes(targetDimension)
                    ? targetDimension
                    : next.defaultDimension
                  : ''
              );
            }}
          >
            {providers.map(p => (
              <MenuItem key={p.id} value={p.id}>
                {p.id === 'dashscope' ? t('bailian') : p.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            fullWidth
            label={t('model')}
            value={modelId}
            disabled={!provider}
            onChange={e => {
              setModelId(e.target.value);
              const next = provider?.models.find(m => m.id === e.target.value);
              setDimension(
                next
                  ? targetDimension && next.dimensions.includes(targetDimension)
                    ? targetDimension
                    : next.defaultDimension
                  : ''
              );
            }}
          >
            {(provider?.models || []).map(m => (
              <MenuItem key={m.id} value={m.id}>
                {m.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            fullWidth
            label={t('outputType')}
            value={supportedOutputs.includes(outputType) ? outputType : ''}
            disabled={!model}
            onChange={e => setOutputType(e.target.value as EmbeddingOutputType)}
          >
            {supportedOutputs.map(type => (
              <MenuItem key={type} value={type}>
                {t(type)}
              </MenuItem>
            ))}
          </TextField>
          {!supportedOutputs.length && model && (
            <Alert severity="warning">{t('noCompatibleOutput')}</Alert>
          )}
          {dense ? (
            <TextField
              select
              size="small"
              fullWidth
              label={t('dimension')}
              value={dimension}
              disabled={!model}
              error={mismatch}
              helperText={
                targetDimension !== undefined
                  ? t('targetDimension', { dimension: targetDimension })
                  : undefined
              }
              onChange={e => setDimension(Number(e.target.value))}
            >
              {(model?.dimensions || []).map(d => (
                <MenuItem key={d} value={d}>
                  {d}
                </MenuItem>
              ))}
            </TextField>
          ) : (
            <Typography variant="caption" color="text.secondary">
              {t('sparseDimension')}
            </Typography>
          )}
          <TextField
            size="small"
            fullWidth
            label="API Key"
            sx={{ gridColumn: '1 / -1' }}
            type="password"
            value={apiKey}
            autoComplete="off"
            disabled={!provider}
            required={provider?.requiresApiKey}
            onChange={e => setApiKey(e.target.value)}
          />
          <TextField
            size="small"
            fullWidth
            label={t('inputText')}
            sx={{ gridColumn: '1 / -1' }}
            multiline
            minRows={3}
            maxRows={8}
            value={input}
            onChange={e => onInputChange(e.target.value)}
            inputProps={{ maxLength: 65536 }}
          />
        </Box>
        {mismatch && <Alert severity="warning">{t('dimensionMismatch')}</Alert>}
        <Button
          type="button"
          variant="outlined"
          startIcon={busy ? <CircularProgress size={16} /> : <AutoAwesome />}
          disabled={disabled || busy || !ready}
          onClick={() => {
            void generate().catch(() => {});
          }}
        >
          {busy ? t('generating') : t('generate')}
        </Button>
        {error && (
          <Alert severity="error" sx={{ overflowWrap: 'anywhere' }}>
            {error}
          </Alert>
        )}
        {result && (
          <VectorPreview
            key={`${result.model}:${result.elapsedMs}`}
            result={result}
          />
        )}
      </Stack>
    );
  }
);
export default EmbeddingEditor;
