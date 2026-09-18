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
  // Editing keeps its single-document editor. Imports stay opaque so a large
  // JSON file is never parsed or rendered on the browser's main thread.
  const [text, setText] = useState(
    document ? JSON.stringify([document], null, 2) : ''
  );
  const [file, setFile] = useState<File>();
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
    if (!document) return { documents: undefined, error: '' };
    try {
      const docs: unknown = JSON.parse(text);
      if (
        !Array.isArray(docs) ||
        docs.length !== 1 ||
        !docs[0] ||
        typeof docs[0] !== 'object' ||
        Array.isArray(docs[0]) ||
        typeof docs[0].id !== 'string' ||
        docs[0].id !== document.id
      ) {
        return { error: t('invalidDocumentIds'), documents: undefined };
      }
      return { documents: docs as ProviderDocument[], error: '' };
    } catch {
      return { error: t('invalidJson'), documents: undefined };
    }
  }, [document, t, text]);

  const save = async () => {
    if (busy || (document ? !parsed.documents : !file)) return;
    setBusy(true);
    setError('');
    try {
      if (document) {
        await TencentVectorDbService.upsertDocuments({
          database: collection.database,
          collection: collection.collection,
          documents: parsed.documents!,
          buildIndex,
        });
      } else {
        await TencentVectorDbService.importDocuments({
          database: collection.database,
          collection: collection.collection,
          file: file!,
          buildIndex,
        });
      }
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
          {document ? (
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
              error={!!parsed.error}
              helperText={parsed.error || undefined}
            />
          ) : (
            <Box>
              <Button
                startIcon={<icons.upload />}
                disabled={busy}
                onClick={() => fileInput.current?.click()}
              >
                {t('selectJsonFile')}
              </Button>
              <input
                type="file"
                accept=".json,application/json"
                hidden
                ref={fileInput}
                onChange={event => {
                  const selected = event.target.files?.[0];
                  event.target.value = '';
                  if (!selected) return;
                  if (selected.size > 16 * 1024 * 1024) {
                    setFile(undefined);
                    setError(t('fileTooLarge'));
                    return;
                  }
                  setFile(selected);
                  setError('');
                }}
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {file
                  ? t('selectedFile', {
                      name: file.name,
                      size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
                    })
                  : t('importJsonFileOnly')}
              </Typography>
            </Box>
          )}
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
          disabled={busy || (document ? !parsed.documents : !file)}
          onClick={() => void save()}
        >
          {busy ? t('saving') : document ? t('upsert') : t('importJson')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
