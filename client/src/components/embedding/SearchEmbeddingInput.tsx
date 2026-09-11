import {
  forwardRef,
  ReactNode,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import AutoAwesome from '@mui/icons-material/AutoAwesome';
import Close from '@mui/icons-material/Close';
import Check from '@mui/icons-material/Check';
import { useTranslation } from 'react-i18next';
import EmbeddingEditor, { EmbeddingEditorHandle } from './EmbeddingEditor';
import type {
  EmbeddingResult,
  EmbeddingOutputType,
} from '@server/embedding/types';
import { serializeEmbedding, isCombinedInput } from './vectors';
import HybridRerank, {
  defaultRerank,
  HybridRerankSettings,
} from './HybridRerank';

export type SearchInputMode = 'builtin' | 'external' | 'vector';
export type SearchEmbeddingInputHandle = {
  resolve: () => Promise<{
    data: string;
    sparseTarget?: string;
    rerank: HybridRerankSettings;
  }>;
};
type Props = {
  mode: SearchInputMode;
  onModeChange: (mode: SearchInputMode) => void;
  input: string;
  onInputChange: (input: string) => void;
  dimension?: number;
  builtinAvailable: boolean;
  builtinModel?: string;
  externalAvailable: boolean;
  disabled?: boolean;
  onReadyChange?: (ready: boolean) => void;
  vectorInput?: ReactNode;
  outputTypes?: EmbeddingOutputType[];
  sparseTargets?: string[];
};
const denseOnly: EmbeddingOutputType[] = ['dense'];

const SearchEmbeddingInput = forwardRef<SearchEmbeddingInputHandle, Props>(
  function SearchEmbeddingInput(
    {
      mode,
      onModeChange,
      input,
      onInputChange,
      dimension,
      builtinAvailable,
      builtinModel,
      externalAvailable,
      disabled = false,
      onReadyChange,
      vectorInput,
      outputTypes = denseOnly,
      sparseTargets,
    },
    ref
  ) {
    const { t } = useTranslation('embedding');
    const editor = useRef<EmbeddingEditorHandle>(null);
    const [externalReady, setExternalReady] = useState(false);
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState('');
    const [generated, setGenerated] = useState<EmbeddingResult>();
    const [outputType, setOutputType] = useState<EmbeddingOutputType>(
      outputTypes[0] || 'dense'
    );
    const [sparseTarget, setSparseTarget] = useState('');
    const [rerank, setRerank] = useState(defaultRerank);
    const target = sparseTargets?.includes(sparseTarget)
      ? sparseTarget
      : sparseTargets?.[0];
    const combined =
      mode === 'external'
        ? outputType === 'dense&sparse'
        : mode === 'vector' && isCombinedInput(input);
    const readyCallback = useRef(onReadyChange);
    readyCallback.current = onReadyChange;
    const ready =
      mode === 'external'
        ? externalAvailable && externalReady
        : !!input.trim() && (mode !== 'builtin' || builtinAvailable);

    useEffect(() => {
      readyCallback.current?.(ready);
    }, [ready]);
    useImperativeHandle(ref, () => ({
      async resolve() {
        if (!ready) throw new Error(t('incomplete'));
        if (
          combined &&
          ((sparseTargets && !target) ||
            (rerank.method === 'rrf'
              ? !Number.isInteger(rerank.k) || rerank.k < 1 || rerank.k > 16384
              : !Number.isFinite(rerank.denseWeight) ||
                rerank.denseWeight < 0 ||
                rerank.denseWeight > 1))
        )
          throw new Error(t('invalidHybrid'));
        if (mode !== 'external')
          return { data: input, sparseTarget: target, rerank };
        if (!editor.current) throw new Error(t('incomplete'));
        return {
          data: serializeEmbedding(await editor.current.generate()),
          sparseTarget: target,
          rerank,
        };
      },
    }));

    return (
      <Stack spacing={1.5} sx={{ minWidth: 0 }}>
        <ToggleButtonGroup
          exclusive
          fullWidth
          size="small"
          value={mode}
          disabled={disabled}
          aria-label={t('mode')}
          onChange={(_, value: SearchInputMode | null) => {
            if (value && value !== mode) {
              setExternalReady(false);
              onModeChange(value);
            }
          }}
          sx={{
            '& .MuiToggleButton-root': {
              flex: 1,
              px: 0.5,
              fontSize: 12,
              lineHeight: 1.4,
              minHeight: 40,
            },
          }}
        >
          <ToggleButton
            value="builtin"
            disabled={disabled || !builtinAvailable}
            title={!builtinAvailable ? t('builtinUnavailable') : undefined}
          >
            {t('builtin')}
          </ToggleButton>
          <ToggleButton
            value="external"
            disabled={disabled || !externalAvailable}
            title={!externalAvailable ? t('externalUnavailable') : undefined}
          >
            {t('external')}
          </ToggleButton>
          <ToggleButton value="vector">{t('vector')}</ToggleButton>
        </ToggleButtonGroup>
        {dimension !== undefined && (
          <Typography variant="caption" color="text.secondary">
            {t('targetDimension', { dimension })}
          </Typography>
        )}
        {mode === 'external' ? (
          <EmbeddingEditor
            ref={editor}
            input={input}
            onInputChange={onInputChange}
            targetDimension={dimension}
            disabled={disabled}
            onReadyChange={setExternalReady}
            outputTypes={outputTypes}
            onOutputTypeChange={setOutputType}
          />
        ) : (
          <>
            {mode === 'builtin' && (
              <>
                <TextField
                  fullWidth
                  size="small"
                  label={t('builtinModel')}
                  value={builtinModel || t('collectionConfig')}
                  InputProps={{ readOnly: true }}
                />
                <TextField
                  fullWidth
                  size="small"
                  label={t('dimension')}
                  value={dimension ?? t('sparseDimension')}
                  InputProps={{ readOnly: true }}
                />
              </>
            )}
            {mode === 'vector' && vectorInput ? (
              vectorInput
            ) : (
              <TextField
                fullWidth
                size="small"
                label={t(mode === 'builtin' ? 'inputText' : 'vectorJson')}
                multiline
                minRows={3}
                maxRows={8}
                value={input}
                disabled={disabled}
                onChange={e => onInputChange(e.target.value)}
                inputProps={
                  mode === 'vector'
                    ? { style: { fontFamily: 'monospace' } }
                    : undefined
                }
              />
            )}
            {mode === 'vector' && externalAvailable && (
              <Box>
                <Button
                  type="button"
                  size="small"
                  startIcon={<AutoAwesome />}
                  disabled={disabled}
                  onClick={() => {
                    setGenerated(undefined);
                    setOpen(true);
                  }}
                >
                  {t('getVector')}
                </Button>
              </Box>
            )}
          </>
        )}
        {combined && (
          <>
            {sparseTargets && (
              <TextField
                select
                fullWidth
                size="small"
                label={t('sparseTarget')}
                value={target || ''}
                disabled={disabled}
                onChange={e => setSparseTarget(e.target.value)}
              >
                {sparseTargets.map(name => (
                  <MenuItem key={name} value={name}>
                    {name}
                  </MenuItem>
                ))}
              </TextField>
            )}
            <HybridRerank
              value={rerank}
              onChange={setRerank}
              disabled={disabled}
            />
          </>
        )}
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          fullWidth
          maxWidth="sm"
          aria-labelledby="embedding-dialog-title"
        >
          <DialogTitle
            id="embedding-dialog-title"
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            {t('getVector')}
            <Tooltip title={t('close')}>
              <IconButton
                aria-label={t('close')}
                onClick={() => setOpen(false)}
              >
                <Close />
              </IconButton>
            </Tooltip>
          </DialogTitle>
          <DialogContent dividers>
            {open && (
              <EmbeddingEditor
                input={draft}
                onInputChange={setDraft}
                targetDimension={dimension}
                onResultChange={setGenerated}
                outputTypes={outputTypes}
              />
            )}
          </DialogContent>
          <DialogActions>
            <Button
              startIcon={<Check />}
              variant="contained"
              disabled={!generated}
              onClick={() => {
                if (generated) {
                  onInputChange(serializeEmbedding(generated));
                  setOpen(false);
                }
              }}
            >
              {t('useVector')}
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    );
  }
);
export default SearchEmbeddingInput;
