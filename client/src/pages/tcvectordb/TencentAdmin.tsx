import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import icons from '@/components/icons/Icons';
import { TencentVectorDbService } from '@/http/TencentVectorDb.service';
import type { ProviderUser } from '@server/providers/types';
import { requestError } from './CreateCollectionDialog';

export default function TencentAdmin({
  database,
  onChanged,
}: {
  database: string;
  onChanged: () => void;
}) {
  const { t } = useTranslation('tcvectordb');
  const [name, setName] = useState('');
  const [users, setUsers] = useState<ProviderUser[]>([]);
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [privileges, setPrivileges] = useState(
    '[{"resource":"*.*","actions":["read"]}]'
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const loadUsers = async () => {
    try {
      setUsers((await TencentVectorDbService.listUsers()).users || []);
    } catch (e) {
      setError(requestError(e));
    }
  };
  useEffect(() => {
    void loadUsers();
  }, []);
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await action();
      onChanged();
      await loadUsers();
    } catch (e) {
      setError(requestError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Stack spacing={3}>
      {error && (
        <Alert severity="error" sx={{ color: 'text.primary' }}>
          {error}
        </Alert>
      )}
      <Box>
        <Typography variant="h6" sx={{ mb: 1 }}>
          {t('databaseManagement')}
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField
            size="small"
            label={t('databaseName')}
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <Button
            startIcon={<icons.add />}
            variant="contained"
            disabled={busy || !name.trim()}
            onClick={() =>
              void run(() =>
                TencentVectorDbService.createDatabase({ database: name.trim() })
              )
            }
          >
            {t('createDatabase')}
          </Button>
          <Button
            color="error"
            startIcon={<icons.delete />}
            disabled={busy || !name.trim()}
            onClick={() => {
              if (window.confirm(t('dropDatabaseWarning')))
                void run(() =>
                  TencentVectorDbService.dropDatabase({ database: name.trim() })
                );
            }}
          >
            {t('dropDatabase')}
          </Button>
        </Stack>
      </Box>
      <Divider />
      <Box>
        <Typography variant="h6" sx={{ mb: 1 }}>
          {t('userManagement')}
        </Typography>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{ mb: 2 }}
        >
          <TextField
            size="small"
            label={t('username')}
            value={user}
            onChange={e => setUser(e.target.value)}
          />
          <TextField
            size="small"
            type="password"
            label={t('password')}
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          <Button
            startIcon={<icons.add />}
            variant="contained"
            disabled={busy || !user.trim() || password.length < 8}
            onClick={() =>
              void run(() =>
                TencentVectorDbService.createUser({
                  user: user.trim(),
                  password,
                })
              )
            }
          >
            {t('createUser')}
          </Button>
        </Stack>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{ mb: 2 }}
        >
          <TextField
            fullWidth
            size="small"
            label={t('privilegesJson')}
            value={privileges}
            onChange={e => setPrivileges(e.target.value)}
            inputProps={{ style: { fontFamily: 'monospace' } }}
          />
          <Button
            disabled={busy || !user.trim()}
            onClick={() =>
              void run(async () =>
                TencentVectorDbService.grantUser({
                  user: user.trim(),
                  privileges: JSON.parse(privileges),
                })
              )
            }
          >
            {t('grant')}
          </Button>
          <Button
            disabled={busy || !user.trim()}
            onClick={() =>
              void run(async () =>
                TencentVectorDbService.revokeUser({
                  user: user.trim(),
                  privileges: JSON.parse(privileges),
                })
              )
            }
          >
            {t('revoke')}
          </Button>
        </Stack>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('username')}</TableCell>
              <TableCell>{t('created')}</TableCell>
              <TableCell>{t('privileges')}</TableCell>
              <TableCell>{t('actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map(item => (
              <TableRow key={item.user}>
                <TableCell>{item.user}</TableCell>
                <TableCell>{item.createTime || '--'}</TableCell>
                <TableCell sx={{ maxWidth: 420, overflowWrap: 'anywhere' }}>
                  {JSON.stringify(item.privileges || [])}
                </TableCell>
                <TableCell>
                  <Button
                    color="error"
                    size="small"
                    disabled={busy || item.user === 'root'}
                    onClick={() => {
                      if (window.confirm(t('dropUserWarning')))
                        void run(() =>
                          TencentVectorDbService.dropUser({ user: item.user })
                        );
                    }}
                  >
                    {t('drop')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Stack>
  );
}
