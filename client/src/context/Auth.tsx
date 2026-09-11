import { createContext, useEffect, useState, useMemo } from 'react';
import { AuthContextType } from './Types';
import { MilvusService, TencentVectorDbService } from '@/http';
import {
  MILVUS_CLIENT_ID,
  MILVUS_URL,
  MILVUS_DATABASE,
  ATTU_AUTH_REQ,
} from '@/consts';
import type { AuthReq } from '@server/types';

export const authContext = createContext<AuthContextType>({
  clientId: '',
  authReq: {
    provider: 'milvus',
    username: '',
    password: '',
    address: '',
    token: '',
    database: '',
    checkHealth: true,
    clientId: '',
    ssl: false,
  },
  setAuthReq: () => {},
  isManaged: false,
  isServerless: false,
  isDedicated: false,
  isAuth: false,
  login: async () => {
    return { provider: 'milvus', clientId: '', database: '' };
  },
  logout: () => {},
});

const { Provider } = authContext;
export const AuthProvider = (props: { children: React.ReactNode }) => {
  // get data from local storage
  let localClientId = '';
  let localAuthReq: AuthReq = {
    username: '',
    password: '',
    address: MILVUS_URL,
    token: '',
    database: MILVUS_DATABASE,
    checkHealth: true,
    clientId: '',
    ssl: false,
  };
  try {
    localClientId = window.localStorage.getItem(MILVUS_CLIENT_ID) || '';
    const storedAuthReq = window.localStorage.getItem(ATTU_AUTH_REQ);
    if (storedAuthReq) {
      localAuthReq = { ...localAuthReq, ...JSON.parse(storedAuthReq) };
    } else {
      localAuthReq.clientId = localClientId;
    }
  } catch (e) {
    // fallback to defaults if JSON parse fails
  }

  // state
  const [authReq, setAuthReq] = useState<AuthReq>(localAuthReq);
  const [clientId, setClientId] = useState<string>(localClientId);

  // update local storage when authReq changes
  useEffect(() => {
    window.localStorage.setItem(
      ATTU_AUTH_REQ,
      JSON.stringify({ ...authReq, password: '', token: '', apiKey: '' })
    );
    document.title = authReq.address ? `${authReq.address} - Attu` : 'Attu';
  }, [authReq]);

  // login API
  const login = async (params: AuthReq) => {
    params.clientId =
      params.provider === 'tcvectordb'
        ? Array.from(crypto.getRandomValues(new Uint8Array(16)), byte =>
            byte.toString(16).padStart(2, '0')
          ).join('')
        : Math.random().toString(36).substring(7);
    // only set clientId once
    window.localStorage.setItem(MILVUS_CLIENT_ID, params.clientId);
    try {
      const res =
        params.provider === 'tcvectordb'
          ? await TencentVectorDbService.connect({
              endpoint: params.address,
              account: params.username,
              apiKey: params.apiKey || params.token,
              clientId: params.clientId,
              ...(params.database?.trim()
                ? { database: params.database.trim() }
                : {}),
            })
          : await MilvusService.connect(params);
      setAuthReq({
        ...params,
        provider: res.provider,
        database: res.database,
        ...(res.provider === 'tcvectordb' ? { apiKey: '', token: '' } : {}),
      });
      setClientId(res.clientId);
      // update clientId in localStorage if changed
      if (res.clientId !== params.clientId) {
        window.localStorage.setItem(MILVUS_CLIENT_ID, res.clientId);
      }
      return res;
    } catch (error) {
      setClientId('');
      window.localStorage.removeItem(MILVUS_CLIENT_ID);
      throw error;
    }
  };

  // logout API
  const logout = async (pass?: boolean) => {
    if (!pass && authReq.provider === 'tcvectordb') {
      await TencentVectorDbService.disconnect().catch(() => {});
    }
    if (!pass && authReq.provider !== 'tcvectordb') {
      await MilvusService.closeConnection();
    }
    setClientId('');
    window.localStorage.removeItem(MILVUS_CLIENT_ID);
    window.localStorage.removeItem(ATTU_AUTH_REQ);
  };

  // useMemo for computed values
  const isManaged = useMemo(
    () => authReq.address.includes('zilliz'),
    [authReq.address]
  );
  const isServerless = useMemo(
    () => isManaged && authReq.address.includes('serverless'),
    [isManaged, authReq.address]
  );
  const isDedicated = useMemo(
    () => !isServerless && isManaged,
    [isServerless, isManaged]
  );

  return (
    <Provider
      value={{
        authReq,
        setAuthReq,
        login,
        logout,
        clientId,
        isAuth: !!clientId,
        isManaged,
        isServerless,
        isDedicated,
      }}
    >
      {props.children}
    </Provider>
  );
};
