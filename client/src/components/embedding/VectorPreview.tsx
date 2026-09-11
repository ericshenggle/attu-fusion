import { useState } from 'react';
import {
  Box,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import ContentCopy from '@mui/icons-material/ContentCopy';
import Download from '@mui/icons-material/Download';
import type { EmbeddingResult } from '@server/embedding/types';
import { serializeEmbedding } from './vectors';

export default function VectorPreview({ result }: { result: EmbeddingResult }) {
  const { t } = useTranslation('embedding');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const json = serializeEmbedding(result);
  const norm = result.vector ? Math.hypot(...result.vector) : undefined;
  return (
    <Box sx={{ minWidth: 0 }}>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ flexWrap: 'wrap', mb: 1 }}
      >
        <Typography
          variant="caption"
          sx={{ flex: 1, overflowWrap: 'anywhere' }}
        >
          {result.vector &&
            t('resultSummary', {
              dimension: result.dimension,
              elapsed: result.elapsedMs,
              norm: norm!.toFixed(4),
            })}
          {result.sparseVector &&
            t('sparseSummary', {
              count: result.sparseVector.length,
              elapsed: result.elapsedMs,
            })}
        </Typography>
        <Tooltip title={copied ? t('copied') : t('copy')}>
          <IconButton
            size="small"
            aria-label={t('copy')}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(json);
                setCopied(true);
                setCopyError(false);
              } catch {
                setCopyError(true);
              }
            }}
          >
            <ContentCopy fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('download')}>
          <IconButton
            size="small"
            aria-label={t('download')}
            onClick={() => {
              const url = URL.createObjectURL(
                new Blob([json], { type: 'application/json' })
              );
              const link = document.createElement('a');
              link.href = url;
              link.download = 'embedding.json';
              link.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      <TextField
        fullWidth
        label={t('vectorPreview')}
        multiline
        minRows={3}
        maxRows={6}
        value={json}
        size="small"
        InputProps={{ readOnly: true }}
        inputProps={{ style: { fontFamily: 'monospace', fontSize: 12 } }}
      />
      {copyError && (
        <Typography color="error" variant="caption">
          {t('copyFailed')}
        </Typography>
      )}
    </Box>
  );
}
