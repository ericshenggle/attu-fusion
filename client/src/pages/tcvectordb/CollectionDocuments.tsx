import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TablePagination,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import icons from '@/components/icons/Icons';
import { TencentVectorDbService } from '@/http/TencentVectorDb.service';
import type {
  ProviderCollection,
  ProviderDocument,
  ProviderQueryDocumentsRequest,
} from '@server/providers/types';
import { requestError } from './CreateCollectionDialog';
import DocumentTable, { downloadDocuments } from './DocumentTable';
import ReadOptions, { defaultReadSettings } from './ReadOptions';
import UpsertDocumentsDialog from './UpsertDocumentsDialog';
import QueryHelp from './QueryHelp';

type Query = Omit<
  ProviderQueryDocumentsRequest,
  'clientId' | 'database' | 'collection'
>;
export default function CollectionDocuments({
  collection,
  onMutation,
}: {
  collection: ProviderCollection;
  onMutation: () => void;
}) {
  const { t } = useTranslation('tcvectordb');
  const [settings, setSettings] = useState(defaultReadSettings);
  const [ids, setIds] = useState<string[]>([]);
  const [query, setQuery] = useState<Query>({
    ...defaultReadSettings,
    offset: 0,
    limit: 20,
  });
  const [rows, setRows] = useState<ProviderDocument[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [count, setCount] = useState<number>();
  const [counting, setCounting] = useState(false);
  const [countError, setCountError] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [editor, setEditor] = useState<{ document?: ProviderDocument }>();
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [revision, setRevision] = useState(0);
  const alive = useRef(true);
  const requestVersion = useRef(0);
  const target = {
    database: collection.database,
    collection: collection.collection,
  };
  const vectorIndexes = (collection.indexes || []).filter(i =>
    ['vector', 'binary_vector', 'sparse_vector'].includes(i.fieldType || '')
  );
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      ++requestVersion.current;
    };
  }, []);
  useEffect(() => {
    let active = true;
    ++requestVersion.current;
    setBusy(true);
    setError('');
    setCount(undefined);
    setCountError('');
    setSelected([]);
    setRows([]);
    TencentVectorDbService.queryDocuments({ ...target, ...query })
      .then(res => {
        if (active) setRows(res.documents);
      })
      .catch(e => {
        if (active) setError(requestError(e));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [query, revision, collection.database, collection.collection]);

  const countMatches = async () => {
    const version = requestVersion.current;
    setCounting(true);
    setCountError('');
    try {
      const res = await TencentVectorDbService.countDocuments({
        ...target,
        filter: query.filter,
      });
      if (alive.current && version === requestVersion.current)
        setCount(res.count);
    } catch (e) {
      if (alive.current && version === requestVersion.current)
        setCountError(requestError(e));
    } finally {
      if (alive.current) setCounting(false);
    }
  };
  const edit = async (id: string) => {
    setEditing(true);
    setError('');
    try {
      const res = await TencentVectorDbService.queryDocuments({
        ...target,
        documentIds: [id],
        retrieveVector: true,
        readConsistency: 'strongConsistency',
        offset: 0,
        limit: 1,
      });
      if (!res.documents[0]) throw new Error(t('documentMissing'));
      if (alive.current) setEditor({ document: res.documents[0] });
    } catch (e) {
      if (alive.current) setError(requestError(e));
    } finally {
      if (alive.current) setEditing(false);
    }
  };
  const remove = async () => {
    if (!selected.length || deleting) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await TencentVectorDbService.deleteDocuments({
        ...target,
        documentIds: selected,
      });
      if (alive.current) {
        setDeleteOpen(false);
        setSelected([]);
        setQuery(q => ({ ...q, offset: 0 }));
        onMutation();
      }
    } catch (e) {
      if (alive.current) setDeleteError(requestError(e));
    } finally {
      if (alive.current) setDeleting(false);
    }
  };
  return (
    <Stack spacing={2}>
      <Box
        component="form"
        onSubmit={e => {
          e.preventDefault();
          setQuery({
            ...settings,
            documentIds: ids.length ? ids : undefined,
            offset: 0,
            limit: query.limit,
          });
        }}
      >
        <Stack spacing={1.5}>
          <Autocomplete
            multiple
            freeSolo
            options={[]}
            value={ids}
            onChange={(_, value) => setIds(value)}
            renderInput={params => (
              <TextField
                {...params}
                size="small"
                label={t('documentIds')}
                error={ids.length > 20}
              />
            )}
          />
          <ReadOptions
            value={settings}
            onChange={setSettings}
            fields={(collection.indexes || []).map(i => i.fieldName)}
          />
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              flexWrap: 'wrap',
            }}
          >
            <Button
              type="submit"
              variant="contained"
              startIcon={<icons.search />}
              disabled={busy || ids.length > 20}
            >
              {t('query')}
            </Button>
            <Button
              startIcon={<icons.upload />}
              disabled={busy || editing}
              onClick={() => setEditor({})}
            >
              {t('upsert')}
            </Button>
            <Tooltip title={t('deleteDocuments')}>
              <span>
                <IconButton
                  aria-label={t('deleteDocuments')}
                  color="error"
                  disabled={!selected.length || busy}
                  onClick={() => {
                    setDeleteError('');
                    setDeleteOpen(true);
                  }}
                >
                  <icons.delete />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={t('exportResults')}>
              <span>
                <IconButton
                  aria-label={t('exportResults')}
                  disabled={!rows.length || busy}
                  onClick={() => downloadDocuments(rows)}
                >
                  <icons.download />
                </IconButton>
              </span>
            </Tooltip>
            <Button
              disabled={busy || counting || !!query.documentIds?.length}
              onClick={() => void countMatches()}
            >
              {t('countMatches')}
            </Button>
            {count !== undefined && (
              <Typography variant="body2">
                {t('matchedCount', { count })}
              </Typography>
            )}
            {(busy || counting || editing) && <CircularProgress size={18} />}
          </Box>
        </Stack>
      </Box>
      <Box sx={{ maxWidth: 760 }}>
        <Typography variant="body2" color="text.secondary">
          {t('vectorInfo')}:{' '}
          {vectorIndexes.length
            ? vectorIndexes
                .map(
                  index =>
                    `${index.fieldName} (${index.fieldType}, ${t('dimension')}: ${index.dimension ?? '--'})`
                )
                .join(' | ')
            : '--'}
        </Typography>
      </Box>
      <QueryHelp dimension={vectorIndexes[0]?.dimension} />
      {error && (
        <Alert severity="error" sx={{ color: 'text.primary' }}>
          {error}
        </Alert>
      )}
      {countError && (
        <Alert severity="warning" sx={{ color: 'text.primary' }}>
          {countError}
        </Alert>
      )}
      <DocumentTable
        documents={rows}
        selected={selected}
        onSelect={setSelected}
        onEdit={id => void edit(id)}
        busy={busy || editing}
      />
      <TablePagination
        component="div"
        count={-1}
        labelDisplayedRows={({ from }) =>
          rows.length ? `${from}-${from + rows.length - 1}` : '0'
        }
        sx={{
          '& .MuiTablePagination-toolbar': {
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
            px: 0,
          },
          '& .MuiTablePagination-spacer': {
            display: { xs: 'none', sm: 'block' },
          },
        }}
        page={query.offset / query.limit}
        rowsPerPage={query.limit}
        rowsPerPageOptions={[10, 20, 50, 100]}
        onPageChange={(_, page) =>
          setQuery(q => ({ ...q, offset: page * q.limit }))
        }
        onRowsPerPageChange={e =>
          setQuery(q => ({ ...q, limit: Number(e.target.value), offset: 0 }))
        }
        backIconButtonProps={{ disabled: busy || query.offset === 0 }}
        nextIconButtonProps={{
          disabled: busy || !!error || rows.length < query.limit,
        }}
      />
      {editor && (
        <UpsertDocumentsDialog
          collection={collection}
          document={editor.document}
          onClose={() => setEditor(undefined)}
          onSaved={() => {
            if (!alive.current) return;
            setEditor(undefined);
            setRevision(v => v + 1);
            onMutation();
          }}
        />
      )}
      <Dialog
        open={deleteOpen}
        onClose={deleting ? undefined : () => setDeleteOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('deleteDocuments')}</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ color: 'text.primary' }}>
            {t('deleteDocumentsWarning', { count: selected.length })}
          </Alert>
          <Box
            component="pre"
            sx={{
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              maxHeight: 200,
              overflow: 'auto',
            }}
          >
            {selected.join('\n')}
          </Box>
          {deleteError && (
            <Alert severity="error" sx={{ color: 'text.primary' }}>
              {deleteError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button disabled={deleting} onClick={() => setDeleteOpen(false)}>
            {t('cancel')}
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleting || !selected.length}
            onClick={() => void remove()}
          >
            {t('deleteDocuments')}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
