import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import icons from '@/components/icons/Icons';
import { TencentVectorDbService } from '@/http/TencentVectorDb.service';
import type { ProviderCollection } from '@server/providers/types';
import { requestError } from './CreateCollectionDialog';

export default function CollectionOperations({
  collection,
  onChanged,
}: {
  collection: ProviderCollection;
  onChanged: () => void;
}) {
  const { t } = useTranslation('tcvectordb');
  const [alias, setAlias] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dropIndexOpen, setDropIndexOpen] = useState(false);
  const scalarIndexFields = (collection.indexes || [])
    .filter(i => i.indexType === 'filter')
    .map(i => i.fieldName);
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await action();
      onChanged();
      return true;
    } catch (e) {
      setError(requestError(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return (
    <Stack spacing={1.5} sx={{ mb: 2 }}>
      {error && (
        <Alert severity="error" sx={{ color: 'text.primary' }}>
          {error}
        </Alert>
      )}
      <Typography variant="subtitle2">{t('collectionOperations')}</Typography>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        alignItems={{ sm: 'center' }}
      >
        <TextField
          size="small"
          label={t('alias')}
          value={alias}
          onChange={e => setAlias(e.target.value)}
        />
        <Button
          variant="outlined"
          disabled={busy || !alias.trim()}
          onClick={() =>
            void run(() =>
              TencentVectorDbService.setAlias({
                database: collection.database,
                collection: collection.collection,
                alias: alias.trim(),
              })
            )
          }
        >
          {t('setAlias')}
        </Button>
        <Button
          color="error"
          disabled={busy || !alias.trim()}
          onClick={() =>
            void run(() =>
              TencentVectorDbService.deleteAlias({
                database: collection.database,
                alias: alias.trim(),
              })
            )
          }
        >
          {t('deleteAlias')}
        </Button>
        <Typography variant="body2" color="text.secondary">
          {t('aliases')}: {(collection.alias || []).join(', ') || '--'}
        </Typography>
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        {(collection.indexes || [])
          .filter(
            i => i.fieldName === 'vector' || i.fieldName === 'sparse_vector'
          )
          .map(i => (
            <Button
              key={i.fieldName}
              startIcon={<icons.refresh />}
              disabled={busy}
              onClick={() =>
                void run(() =>
                  TencentVectorDbService.rebuildIndex({
                    database: collection.database,
                    collection: collection.collection,
                    fieldName: i.fieldName,
                    dropBeforeRebuild: false,
                  })
                )
              }
            >
              {t('rebuildIndex')} {i.fieldName}
            </Button>
          ))}
        <Button
          color="error"
          disabled={busy || !scalarIndexFields.length}
          onClick={() => setDropIndexOpen(true)}
        >
          {t('dropScalarIndexes')}
        </Button>
      </Stack>
      <Dialog
        open={dropIndexOpen}
        onClose={busy ? undefined : () => setDropIndexOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('dropScalarIndexes')}</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ color: 'text.primary', mb: 1 }}>
            {t('dropIndexWarning', { count: scalarIndexFields.length })}
          </Alert>
          <Typography variant="body2">
            {scalarIndexFields.join(', ')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setDropIndexOpen(false)}>
            {t('cancel')}
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={busy || !scalarIndexFields.length}
            onClick={() => {
              void run(() =>
                TencentVectorDbService.dropIndex({
                  database: collection.database,
                  collection: collection.collection,
                  fieldNames: scalarIndexFields,
                })
              ).then(success => {
                if (success) setDropIndexOpen(false);
              });
            }}
          >
            {t('dropScalarIndexes')}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
