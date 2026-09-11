import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import type { SetStateAction } from 'react';
import { DatabaseService, TencentVectorDbService } from '@/http';
import { authContext } from '@/context';
import type { DatabaseObject } from '@server/types';

export const useDatabaseManagement = () => {
  const { authReq, isAuth, clientId, setAuthReq } = useContext(authContext);
  const isMilvus = authReq.provider !== 'tcvectordb';

  const [databases, setDatabases] = useState<DatabaseObject[]>([]);
  const [loadingDatabases, setLoadingDatabases] = useState(true);
  const database = authReq.database;
  const setDatabase = useCallback(
    (value: SetStateAction<string>) => {
      setAuthReq(prev => ({
        ...prev,
        database: typeof value === 'function' ? value(prev.database) : value,
      }));
    },
    [setAuthReq]
  );
  const requestId = useRef(0);

  // API: fetch databases
  const fetchDatabases = useCallback(
    async (updateLoading?: boolean): Promise<void> => {
      const current = ++requestId.current;
      try {
        updateLoading && setLoadingDatabases(true);
        const newDatabases = isMilvus
          ? await DatabaseService.listDatabases()
          : await TencentVectorDbService.listDatabases();
        if (current !== requestId.current) return;
        setDatabases(newDatabases);
        setAuthReq(prev =>
          newDatabases.some(db => db.name === prev.database)
            ? prev
            : { ...prev, database: newDatabases[0]?.name || '' }
        );
      } catch (error) {
        console.error('Failed to fetch databases:', error);
      } finally {
        if (current === requestId.current) setLoadingDatabases(false);
      }
    },
    [clientId, isMilvus, setAuthReq]
  );

  // Effect to fetch initial databases when authenticated
  useEffect(() => {
    if (isAuth) {
      fetchDatabases(true);
    } else {
      // Clear data when not authenticated
      setDatabases([]);
      setLoadingDatabases(false);
    }
    return () => {
      ++requestId.current;
    };
  }, [isAuth, fetchDatabases]);

  return {
    databases,
    loadingDatabases,
    database,
    setDatabase,
    fetchDatabases,
  };
};
