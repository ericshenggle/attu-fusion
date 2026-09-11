import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import icons from '@/components/icons/Icons';
import { authContext, dataContext } from '@/context';
import { useNavigationHook } from '@/hooks';
import { ROUTE_PATHS } from '@/config/routes';
import {
  TencentVectorDbService,
  TencentVectorDbCollection,
} from '@/http/TencentVectorDb.service';
import CreateCollectionDialog, { requestError } from './CreateCollectionDialog';
import CollectionDocuments from './CollectionDocuments';
import CollectionSearch from './CollectionSearch';
import TencentAdmin from './TencentAdmin';
import CollectionOperations from './CollectionOperations';

export default function TencentDatabases() {
  const { t } = useTranslation('tcvectordb');
  const { clientId } = useContext(authContext);
  const { database, setDatabase, fetchDatabases } = useContext(dataContext);
  const {
    databaseName,
    collectionName = '',
    collectionPage = 'schema',
    databasePage = '',
  } = useParams();
  const activeDatabase = databaseName || database;
  const navigate = useNavigate();
  const [collections, setCollections] = useState<TencentVectorDbCollection[]>(
    []
  );
  const [detail, setDetail] = useState<TencentVectorDbCollection>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [createOpen, setCreateOpen] = useState(false);
  const [dropTarget, setDropTarget] = useState<TencentVectorDbCollection>();
  const [confirmation, setConfirmation] = useState('');
  const [dropping, setDropping] = useState(false);
  const [dropError, setDropError] = useState('');
  const [refreshError, setRefreshError] = useState('');
  const loadVersion = useRef(0);
  useNavigationHook(ROUTE_PATHS.DATABASES, { collectionName });

  useEffect(() => {
    if (activeDatabase && database !== activeDatabase)
      setDatabase(activeDatabase);
  }, [activeDatabase, database, setDatabase]);
  useEffect(() => {
    setFilter('');
    setPage(0);
    setCreateOpen(false);
    setDropTarget(undefined);
  }, [activeDatabase]);
  useEffect(() => {
    let active = true;
    ++loadVersion.current;
    setRefreshError('');
    setCollections([]);
    setDetail(undefined);
    setError('');
    if (!activeDatabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      TencentVectorDbService.listCollections(activeDatabase),
      collectionName
        ? TencentVectorDbService.describeCollection({
            database: activeDatabase,
            collection: collectionName,
          })
        : Promise.resolve(undefined),
    ])
      .then(([items, info]) => {
        if (active) {
          setCollections(items);
          setDetail(info);
        }
      })
      .catch(e => {
        if (active) setError(requestError(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      ++loadVersion.current;
    };
  }, [activeDatabase, collectionName, clientId, tick]);

  const refreshAfterMutation = async () => {
    const version = ++loadVersion.current;
    setRefreshError('');
    try {
      const [items, info] = await Promise.all([
        TencentVectorDbService.listCollections(activeDatabase),
        TencentVectorDbService.describeCollection({
          database: activeDatabase,
          collection: collectionName,
        }),
      ]);
      if (version === loadVersion.current) {
        setCollections(items);
        setDetail(info);
      }
    } catch (e) {
      if (version === loadVersion.current) setRefreshError(requestError(e));
    }
  };

  const filtered = useMemo(
    () =>
      collections
        .filter(c => c.collection.toLowerCase().includes(filter.toLowerCase()))
        .sort((a, b) => a.collection.localeCompare(b.collection)),
    [collections, filter]
  );
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / pageSize) - 1)
  );
  const collectionPath = (name: string, tab = 'schema') =>
    `/databases/${encodeURIComponent(activeDatabase)}/${encodeURIComponent(name)}/${tab}`;
  const listPath = `/databases/${encodeURIComponent(activeDatabase)}/collections`;
  const openDrop = (item: TencentVectorDbCollection) => {
    setDropTarget(item);
    setConfirmation('');
    setDropError('');
  };
  const drop = async () => {
    if (!dropTarget || confirmation !== dropTarget.collection || dropping)
      return;
    setDropping(true);
    try {
      await TencentVectorDbService.dropCollection({
        database: dropTarget.database,
        collection: dropTarget.collection,
      });
      setDropTarget(undefined);
      if (collectionName === dropTarget.collection) navigate(listPath);
      setTick(v => v + 1);
      void fetchDatabases();
    } catch (e) {
      setDropError(requestError(e));
    } finally {
      setDropping(false);
    }
  };

  const status = (item: TencentVectorDbCollection) => (
    <Typography
      component="span"
      variant="body2"
      color={
        item.indexStatus?.status === 'ready'
          ? 'success.main'
          : item.indexStatus?.status === 'failed'
            ? 'error.main'
            : 'text.secondary'
      }
    >
      {item.indexStatus?.status || '--'}
    </Typography>
  );
  const actions = (item: TencentVectorDbCollection) => (
    <Tooltip title={t('drop')}>
      <IconButton
        aria-label={`${t('drop')} ${item.collection}`}
        color="error"
        size="small"
        onClick={() => openDrop(item)}
      >
        <icons.delete />
      </IconButton>
    </Tooltip>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: 0, flex: 1, overflow: 'hidden' }}>
      <Box
        component="aside"
        sx={{
          width: 220,
          flexShrink: 0,
          borderRight: 1,
          borderColor: 'divider',
          overflow: 'auto',
          display: { xs: 'none', lg: 'block' },
        }}
      >
        <ListItemButton
          selected={!collectionName}
          onClick={() => navigate(listPath)}
          sx={{ minHeight: 48 }}
        >
          <icons.database sx={{ mr: 1, fontSize: 20 }} />
          <ListItemText
            primary={activeDatabase}
            primaryTypographyProps={{ noWrap: true, title: activeDatabase }}
          />
        </ListItemButton>
        <List dense>
          {collections.map(c => (
            <ListItemButton
              key={c.collection}
              selected={c.collection === collectionName}
              onClick={() => navigate(collectionPath(c.collection))}
            >
              <ListItemText
                primary={c.collection}
                primaryTypographyProps={{ noWrap: true, title: c.collection }}
              />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ ml: 1 }}
              >
                {c.documentCount ?? '--'}
              </Typography>
            </ListItemButton>
          ))}
        </List>
      </Box>
      <Box
        component="main"
        sx={{ flex: 1, minWidth: 0, overflow: 'auto', p: { xs: 1, sm: 2 } }}
      >
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{ mb: 2, flexWrap: 'wrap', rowGap: 1 }}
        >
          {collectionName && (
            <Tooltip title={t('collections')}>
              <IconButton
                aria-label={t('collections')}
                onClick={() => navigate(listPath)}
              >
                <icons.back />
              </IconButton>
            </Tooltip>
          )}
          <Typography
            component="h1"
            sx={{
              fontSize: 20,
              fontWeight: 600,
              flex: 1,
              minWidth: { xs: collectionName ? 0 : '100%', sm: 0 },
              overflowWrap: 'anywhere',
            }}
          >
            {collectionName || t('collections')}
          </Typography>
          <Tooltip title={t('refresh')}>
            <span>
              <IconButton
                aria-label={t('refresh')}
                disabled={loading}
                onClick={() => setTick(v => v + 1)}
              >
                <icons.refresh />
              </IconButton>
            </span>
          </Tooltip>
          {detail && actions(detail)}
          {!collectionName && (
            <Button
              startIcon={<icons.add />}
              variant="contained"
              disabled={!activeDatabase}
              onClick={() => setCreateOpen(true)}
            >
              {t('create')}
            </Button>
          )}
          {!collectionName && activeDatabase && (
            <Button
              onClick={() =>
                navigate(
                  `/databases/${encodeURIComponent(activeDatabase)}/admin`
                )
              }
            >
              {t('management')}
            </Button>
          )}
        </Stack>
        {loading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <CircularProgress size={24} aria-label={t('loading')} />
          </Box>
        ) : error ? (
          <Alert
            severity="error"
            sx={{ color: 'text.primary' }}
            action={
              <Button color="inherit" onClick={() => setTick(v => v + 1)}>
                {t('retry')}
              </Button>
            }
          >
            {error}
          </Alert>
        ) : !collectionName && databasePage === 'admin' ? (
          <TencentAdmin
            database={activeDatabase}
            onChanged={() => {
              setTick(v => v + 1);
              void fetchDatabases();
            }}
          />
        ) : !collectionName ? (
          <>
            <TextField
              size="small"
              label={t('filter')}
              value={filter}
              onChange={e => {
                setFilter(e.target.value);
                setPage(0);
              }}
              sx={{ mb: 2, width: { xs: '100%', sm: 280 } }}
            />
            <TableContainer>
              <Table
                size="small"
                aria-label={t('collections')}
                sx={{ minWidth: 680 }}
              >
                <TableHead>
                  <TableRow>
                    {[
                      'name',
                      'documents',
                      'status',
                      'shards',
                      'replicas',
                      'created',
                      'actions',
                    ].map(k => (
                      <TableCell key={k}>{t(k)}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered
                    .slice(currentPage * pageSize, (currentPage + 1) * pageSize)
                    .map(c => (
                      <TableRow key={c.collection} hover>
                        <TableCell
                          sx={{ maxWidth: 260, overflowWrap: 'anywhere' }}
                        >
                          <Link
                            component={RouterLink}
                            to={collectionPath(c.collection)}
                          >
                            {c.collection}
                          </Link>
                        </TableCell>
                        <TableCell>{c.documentCount ?? '--'}</TableCell>
                        <TableCell>{status(c)}</TableCell>
                        <TableCell>{c.shardNum ?? '--'}</TableCell>
                        <TableCell>{c.replicaNum ?? '--'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {c.createTime || '--'}
                        </TableCell>
                        <TableCell>{actions(c)}</TableCell>
                      </TableRow>
                    ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                        {t('empty')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={filtered.length}
              page={currentPage}
              rowsPerPage={pageSize}
              rowsPerPageOptions={[10, 20, 50]}
              onPageChange={(_, value) => setPage(value)}
              onRowsPerPageChange={e => {
                setPageSize(Number(e.target.value));
                setPage(0);
              }}
            />
          </>
        ) : (
          detail && (
            <>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 2 }}>
                <Typography variant="body2">
                  {t('documents')}: {detail.documentCount ?? '--'}
                </Typography>
                <Typography variant="body2">
                  {t('status')}: {status(detail)}
                </Typography>
                <Typography variant="body2">
                  {t('shards')}: {detail.shardNum ?? '--'}
                </Typography>
                <Typography variant="body2">
                  {t('replicas')}: {detail.replicaNum ?? '--'}
                </Typography>
              </Box>
              {detail.description && (
                <Typography
                  sx={{ mb: 2, overflowWrap: 'anywhere' }}
                  variant="body2"
                  color="text.secondary"
                >
                  {detail.description}
                </Typography>
              )}
              <Tabs
                value={
                  ['data', 'search', 'metadata'].includes(collectionPage)
                    ? collectionPage
                    : 'schema'
                }
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
                onChange={(_, value) =>
                  navigate(collectionPath(collectionName, value))
                }
                sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
              >
                <Tab value="data" label={t('data')} />
                <Tab value="search" label={t('vectorSearch')} />
                <Tab value="schema" label={t('indexes')} />
                <Tab value="metadata" label={t('metadata')} />
              </Tabs>
              {refreshError && (
                <Alert severity="warning" sx={{ mb: 2, color: 'text.primary' }}>
                  {refreshError}
                </Alert>
              )}
              {collectionPage === 'data' ? (
                <CollectionDocuments
                  key={`${clientId}:${activeDatabase}:${collectionName}`}
                  collection={detail}
                  onMutation={() => void refreshAfterMutation()}
                />
              ) : collectionPage === 'search' ? (
                <CollectionSearch
                  key={`${clientId}:${activeDatabase}:${collectionName}`}
                  collection={detail}
                />
              ) : collectionPage === 'metadata' ? (
                <Box
                  component="pre"
                  sx={{
                    m: 0,
                    p: 1,
                    fontSize: 13,
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                    bgcolor: 'background.default',
                  }}
                >
                  {JSON.stringify(detail, null, 2)}
                </Box>
              ) : (
                <>
                  <CollectionOperations
                    collection={detail}
                    onChanged={() => void refreshAfterMutation()}
                  />
                  <TableContainer>
                    <Table
                      size="small"
                      sx={{ minWidth: 600 }}
                      aria-label={t('indexes')}
                    >
                      <TableHead>
                        <TableRow>
                          {[
                            'fieldName',
                            'fieldType',
                            'indexType',
                            'dimension',
                            'metric',
                            'parameters',
                          ].map(k => (
                            <TableCell key={k}>{t(k)}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(detail.indexes || []).map(index => (
                          <TableRow key={index.fieldName}>
                            <TableCell
                              sx={{ overflowWrap: 'anywhere', maxWidth: 220 }}
                            >
                              {index.fieldName}
                            </TableCell>
                            <TableCell>{index.fieldType}</TableCell>
                            <TableCell>{index.indexType}</TableCell>
                            <TableCell>{index.dimension ?? '--'}</TableCell>
                            <TableCell>{index.metricType || '--'}</TableCell>
                            <TableCell
                              sx={{ maxWidth: 280, overflowWrap: 'anywhere' }}
                            >
                              {index.params
                                ? JSON.stringify(index.params)
                                : '--'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}
            </>
          )
        )}
      </Box>
      {createOpen && (
        <CreateCollectionDialog
          database={activeDatabase}
          onClose={() => setCreateOpen(false)}
          onCreated={name => {
            setCreateOpen(false);
            setTick(v => v + 1);
            void fetchDatabases();
            navigate(collectionPath(name));
          }}
        />
      )}
      <Dialog
        open={!!dropTarget}
        fullWidth
        maxWidth="xs"
        onClose={dropping ? undefined : () => setDropTarget(undefined)}
      >
        <DialogTitle>{t('drop')}</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2, color: 'text.primary' }}>
            {t('dropWarning')}
          </Alert>
          <Typography sx={{ mb: 2, overflowWrap: 'anywhere' }}>
            {dropTarget?.database} / {dropTarget?.collection}
          </Typography>
          <TextField
            fullWidth
            size="small"
            label={t('confirmName')}
            value={confirmation}
            onChange={e => setConfirmation(e.target.value)}
          />
          {dropError && (
            <Alert severity="error" sx={{ mt: 2, color: 'text.primary' }}>
              {dropError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button disabled={dropping} onClick={() => setDropTarget(undefined)}>
            {t('cancel')}
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={dropping || confirmation !== dropTarget?.collection}
            onClick={() => void drop()}
          >
            {t('drop')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
