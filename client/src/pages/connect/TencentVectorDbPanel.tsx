import { useContext, useState } from 'react';
import type { FormEvent } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import type { Theme } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { authContext, dataContext, rootContext } from '@/context';

const DEFAULT_ENDPOINT =
  ((window as any)._env_ && (window as any)._env_.TCVECTORDB_ENDPOINT) || '';

export const TencentVectorDbPanel = () => {
  const { login } = useContext(authContext);
  const { setDatabase } = useContext(dataContext);
  const { openSnackBar } = useContext(rootContext);
  const navigate = useNavigate();
  const [endpoint, setEndpoint] = useState(DEFAULT_ENDPOINT);
  const [account, setAccount] = useState('root');
  const [apiKey, setApiKey] = useState('');
  const [database, setDatabaseName] = useState('default');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsConnecting(true);
    try {
      const response = await login({
        provider: 'tcvectordb',
        address: endpoint,
        username: account,
        apiKey,
        token: apiKey,
        password: '',
        database,
        ssl: endpoint.startsWith('https://'),
        checkHealth: true,
        clientId: '',
      });
      setDatabase(response.database);
      openSnackBar('TCVectordb connected.');
      navigate('/');
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          'TCVectordb connection failed.'
      );
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <Box
      component="form"
      onSubmit={handleConnect}
      sx={{
        mx: 3,
        mb: 2,
        p: 2,
        border: (theme: Theme) => `1px solid ${theme.palette.divider}`,
        borderRadius: 1,
        backgroundColor: 'background.default',
      }}
    >
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        Tencent Cloud VectorDB
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
        Connect with the Tencent VectorDB REST API.
      </Typography>
      <TextField
        fullWidth
        required
        size="small"
        label="Endpoint"
        value={endpoint}
        onChange={event => setEndpoint(event.target.value)}
        sx={{ mb: 1.25 }}
      />
      <Box sx={{ display: 'flex', gap: 1, mb: 1.25 }}>
        <TextField
          fullWidth
          required
          size="small"
          label="Account"
          value={account}
          onChange={event => setAccount(event.target.value)}
        />
        <TextField
          fullWidth
          required
          size="small"
          type="password"
          label="API key"
          value={apiKey}
          onChange={event => setApiKey(event.target.value)}
        />
      </Box>
      <TextField
        fullWidth
        required
        size="small"
        label="Database"
        value={database}
        onChange={event => setDatabaseName(event.target.value)}
      />
      <Button
        type="submit"
        variant="contained"
        size="small"
        sx={{ mt: 1.5 }}
        disabled={isConnecting || !endpoint || !account || !apiKey || !database}
      >
        {isConnecting ? 'Connecting...' : 'Connect'}
      </Button>
      {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
    </Box>
  );
};
