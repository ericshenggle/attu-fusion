import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import icons from '@/components/icons/Icons';
import { TencentVectorDbService } from '@/http/TencentVectorDb.service';
import type {
  ProviderCollection,
  ProviderDocument,
} from '@server/providers/types';
import { requestError } from './CreateCollectionDialog';

export default function UpsertDocumentsDialog({
  collection,
  document,
  onClose,
  onSaved,
}: {
  collection: ProviderCollection;
  document?: ProviderDocument;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation('tcvectordb');
  const compact = useMediaQuery(useTheme().breakpoints.down('sm'));
  const [text, setText] = useState(
    document ? JSON.stringify([document], null, 2) : '[]'
  );
  const [buildIndex, setBuildIndex] = useState(
    !collection.indexes?.some(
      i =>
        i.indexType.startsWith('IVF') &&
        collection.indexStatus?.status === 'initial'
    )
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const parsed = useMemo(() => {
    try {
      const docs: unknown = JSON.parse(text);
      if (
        !Array.isArray(docs) ||
        docs.length < 1 ||
        docs.length > 1000 ||
        docs.some(
          doc =>
            !doc ||
            typeof doc !== 'object' ||
            Array.isArray(doc) ||
            typeof doc.id !== 'string' ||
            doc.id.length < 1 ||
            doc.id.length > 128
        )
      ) {
        return { error: t('invalidDocuments'), documents: undefined };
      }
      if (
        new Set(docs.map(doc => doc.id)).size !== docs.length ||
        (document && (docs.length !== 1 || docs[0].id !== document.id))
      ) {
        return { error: t('invalidDocumentIds'), documents: undefined };
      }
      return { documents: docs as ProviderDocument[], error: '' };
    } catch {
      return { error: t('invalidJson'), documents: undefined };
    }
  }, [text, document, t]);
  const save = async () => {
    if (!parsed.documents || busy) return;
    setBusy(true);
    setError('');
    try {
      await TencentVectorDbService.upsertDocuments({
        database: collection.database,
        collection: collection.collection,
        documents: parsed.documents,
        buildIndex,
      });
      onSaved();
    } catch (e) {
      setError(requestError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>{document ? t('editDocument') : t('upsert')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
            {collection.database} / {collection.collection}
          </Typography>
          <Alert severity="warning" sx={{ color: 'text.primary' }}>
            {t('upsertWarning')}
          </Alert>
          {!document && (
            <Box>
              <Button
                startIcon={<icons.upload />}
                disabled={busy}
                onClick={() => fileInput.current?.click()}
              >
                {t('importJson')}
              </Button>
              <input
                type="file"
                accept=".json,application/json"
                hidden
                ref={fileInput}
                onChange={async e => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  if (file.size > 16 * 1024 * 1024) {
                    setError(t('fileTooLarge'));
                    return;
                  }
                  try {
                    setText(await file.text());
                    setError('');
                  } catch (error) {
                    setError(requestError(error));
                  }
                }}
              />
            </Box>
          )}
          <TextField
            label={t('documentsJson')}
            multiline
            minRows={compact ? 6 : 10}
            maxRows={compact ? 10 : 20}
            fullWidth
            value={text}
            disabled={busy}
            onChange={e => setText(e.target.value)}
            inputProps={{ style: { fontFamily: 'monospace', fontSize: 13 } }}
            error={!!parsed.error && text !== '[]'}
            helperText={text !== '[]' ? parsed.error : undefined}
          />
          <FormControlLabel
            control={
              <Switch
                checked={buildIndex}
                disabled={busy}
                onChange={(_, checked) => setBuildIndex(checked)}
              />
            }
            label={t('buildIndex')}
          />
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
        <Button
          variant="contained"
          disabled={busy || !parsed.documents}
          onClick={() => void save()}
        >
          {busy ? t('saving') : t('upsert')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
