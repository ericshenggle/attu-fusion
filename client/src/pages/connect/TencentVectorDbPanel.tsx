import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { TencentVectorDbService } from '@/http';

const DEFAULT_ENDPOINT =
  ((window as any)._env_ && (window as any)._env_.TCVECTORDB_ENDPOINT) ||
  'http://sh-vdb-h7ats2ln.sql.tencentcdb.com:80';

export const TencentVectorDbPanel = () => {
  const [endpoint, setEndpoint] = useState(DEFAULT_ENDPOINT);
  const [account, setAccount] = useState('root');
  const [apiKey, setApiKey] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const testConnection = async () => {
    setIsTesting(true);
    setResult(null);
    setError(null);
    try {
      const response = await TencentVectorDbService.testConnection({
        endpoint,
        account,
        apiKey,
      });
      setResult(
        `Connected. ${response.databases.length} databases available${
          response.databases.length ? `: ${response.databases.join(', ')}` : '.'
        }`
      );
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          'TCVectordb connection failed.'
      );
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Box
      sx={{
        mx: 3,
        mb: 2,
        p: 2,
        border: theme => `1px solid ${theme.palette.divider}`,
        borderRadius: 1,
        backgroundColor: 'background.default',
      }}
    >
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        TCVectordb REST
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
        Test a Tencent Cloud VectorDB endpoint before adding it to Attu.
      </Typography>
      <TextField
        fullWidth
        size="small"
        label="Endpoint"
        value={endpoint}
        onChange={event => setEndpoint(event.target.value)}
        sx={{ mb: 1.25 }}
      />
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          fullWidth
          size="small"
          label="Account"
          value={account}
          onChange={event => setAccount(event.target.value)}
        />
        <TextField
          fullWidth
          size="small"
          type="password"
          label="API key"
          value={apiKey}
          onChange={event => setApiKey(event.target.value)}
        />
      </Box>
      <Divider sx={{ my: 1.5 }} />
      <Button
        variant="contained"
        size="small"
        onClick={testConnection}
        disabled={isTesting || !endpoint || !account || !apiKey}
      >
        {isTesting ? 'Testing...' : 'Test connection'}
      </Button>
      {result && <Alert severity="success" sx={{ mt: 1.5 }}>{result}</Alert>}
      {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
    </Box>
  );
};
