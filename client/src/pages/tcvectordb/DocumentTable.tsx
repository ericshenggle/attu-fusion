import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Checkbox,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Menu,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
} from '@mui/material';
import icons from '@/components/icons/Icons';
import type { ProviderDocument } from '@server/providers/types';

export function downloadDocuments(
  documents: ProviderDocument[],
  filename = 'documents.json'
) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(documents, null, 2)], { type: 'application/json' })
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function DocumentTable({
  documents,
  selected,
  onSelect,
  onEdit,
  busy = false,
}: {
  documents: ProviderDocument[];
  selected?: string[];
  onSelect?: (ids: string[]) => void;
  onEdit?: (id: string) => void;
  busy?: boolean;
}) {
  const { t } = useTranslation('tcvectordb');
  const [inspected, setInspected] = useState<ProviderDocument>();
  const [columnsAnchor, setColumnsAnchor] = useState<HTMLElement | null>(null);
  const [visibleFields, setVisibleFields] = useState<string[]>([]);
  const fields = useMemo(() => {
    const keys = new Set<string>();
    documents.forEach(doc => Object.keys(doc).forEach(key => keys.add(key)));
    return [
      'id',
      ...(keys.has('score') ? ['score'] : []),
      ...Array.from(keys).filter(k => k !== 'id' && k !== 'score'),
    ];
  }, [documents]);
  useEffect(() => {
    setVisibleFields(current => {
      const next = current.filter(field => fields.includes(field));
      return next.length ? next : fields;
    });
  }, [fields]);
  const displayedFields = fields.filter(field => visibleFields.includes(field));
  const selectedOnPage = documents.filter(document =>
    selected?.includes(document.id)
  );
  const toggleField = (field: string) => {
    if (field === 'id') return;
    setVisibleFields(current =>
      current.includes(field)
        ? current.filter(value => value !== field)
        : [...current, field]
    );
  };
  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          minHeight: 40,
          opacity: busy ? 0.55 : 1,
        }}
      >
        <Tooltip title={t('visibleColumns')}>
          <IconButton
            size="small"
            aria-label={t('visibleColumns')}
            onClick={event => setColumnsAnchor(event.currentTarget)}
            disabled={!fields.length}
          >
            <icons.list />
          </IconButton>
        </Tooltip>
        <Menu
          anchorEl={columnsAnchor}
          open={Boolean(columnsAnchor)}
          onClose={() => setColumnsAnchor(null)}
        >
          {fields.map(field => (
            <MenuItem key={field} dense onClick={() => toggleField(field)}>
              <FormControlLabel
                sx={{ m: 0, width: '100%' }}
                control={
                  <Checkbox
                    size="small"
                    checked={visibleFields.includes(field)}
                    disabled={field === 'id'}
                    tabIndex={-1}
                    readOnly
                  />
                }
                label={field}
              />
            </MenuItem>
          ))}
        </Menu>
      </Box>
      <TableContainer
        sx={{
          opacity: busy ? 0.55 : 1,
          maxWidth: '100%',
          maxHeight: 'min(60vh, 720px)',
          overflow: 'auto',
        }}
      >
        <Table
          size="small"
          stickyHeader
          aria-label={t('documentResults')}
          sx={{
            minWidth: Math.max(560, displayedFields.length * 200 + 120),
            tableLayout: 'fixed',
          }}
        >
          <TableHead>
            <TableRow>
              {onSelect && (
                <TableCell padding="checkbox">
                  <Checkbox
                    disabled={busy || !documents.length}
                    inputProps={{ 'aria-label': t('selectAll') }}
                    checked={
                      documents.length > 0 &&
                      selectedOnPage.length === documents.length
                    }
                    indeterminate={
                      selectedOnPage.length > 0 &&
                      selectedOnPage.length < documents.length
                    }
                    onChange={(_, checked) => {
                      const pageIds = new Set(documents.map(d => d.id));
                      onSelect(
                        checked
                          ? Array.from(
                              new Set([
                                ...(selected || []),
                                ...documents.map(d => d.id),
                              ])
                            )
                          : (selected || []).filter(id => !pageIds.has(id))
                      );
                    }}
                  />
                </TableCell>
              )}
              {displayedFields.map(field => (
                <TableCell
                  key={field}
                  sx={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 2,
                    backgroundColor: 'background.paper',
                    width: field === 'id' ? 170 : 200,
                    overflowWrap: 'anywhere',
                  }}
                >
                  {field}
                </TableCell>
              ))}
              <TableCell sx={{ width: 90 }}>{t('actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {documents.map((doc, i) => (
              <TableRow key={`${doc.id}:${i}`} hover>
                {onSelect && (
                  <TableCell padding="checkbox">
                    <Checkbox
                      disabled={busy}
                      inputProps={{
                        'aria-label': `${t('selectDocument')} ${doc.id}`,
                      }}
                      checked={selected?.includes(doc.id) || false}
                      onChange={(_, checked) =>
                        onSelect(
                          checked
                            ? [...(selected || []), doc.id]
                            : (selected || []).filter(id => id !== doc.id)
                        )
                      }
                    />
                  </TableCell>
                )}
                {displayedFields.map(field => {
                  const value = doc[field];
                  const text =
                    value === undefined
                      ? '--'
                      : typeof value === 'string'
                        ? value
                        : JSON.stringify(value);
                  return (
                    <TableCell key={field} sx={{ overflow: 'hidden' }}>
                      <Box
                        sx={{
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {text}
                      </Box>
                    </TableCell>
                  );
                })}
                <TableCell>
                  <Tooltip title={t('inspectDocument')}>
                    <IconButton
                      aria-label={`${t('inspectDocument')} ${doc.id}`}
                      size="small"
                      onClick={() => setInspected(doc)}
                    >
                      <icons.code />
                    </IconButton>
                  </Tooltip>
                  {onEdit && (
                    <Tooltip title={t('editDocument')}>
                      <span>
                        <IconButton
                          disabled={busy}
                          aria-label={`${t('editDocument')} ${doc.id}`}
                          size="small"
                          onClick={() => onEdit(doc.id)}
                        >
                          <icons.edit />
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!documents.length && (
              <TableRow>
                <TableCell
                  colSpan={displayedFields.length + (onSelect ? 2 : 1)}
                  align="center"
                  sx={{ py: 4 }}
                >
                  {t('noDocuments')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Dialog
        open={!!inspected}
        onClose={() => setInspected(undefined)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ overflowWrap: 'anywhere' }}>
          {inspected?.id}
          <IconButton
            aria-label={t('close')}
            onClick={() => setInspected(undefined)}
            sx={{ float: 'right' }}
          >
            <icons.cross />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box
            component="pre"
            sx={{
              m: 0,
              fontSize: 13,
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
            }}
          >
            {JSON.stringify(inspected, null, 2)}
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
}
