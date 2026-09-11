import React, { useContext, useEffect, useRef } from 'react';
import axiosInstance from '@/http/Axios';
import { rootContext, authContext, dataContext } from '@/context';
import { HTTP_STATUS_CODE } from '@server/utils/Const';
import { TencentVectorDbService } from '@/http/TencentVectorDb.service';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

let axiosResInterceptor: number | null = null;

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const TCVECTORDB_KEEPALIVE_MS = 10 * 60 * 1000;

const GlobalEffect = ({ children }: { children: React.ReactNode }) => {
  const { openSnackBar } = useContext(rootContext);
  const { logout, authReq, isAuth } = useContext(authContext);
  const { database } = useContext(dataContext);
  const navigate = useNavigate();
  const { t: commonTrans } = useTranslation();
  const idleLogoutStarted = useRef(false);

  useEffect(() => {
    // Add database header to all axios requests
    const requestInterceptor = axiosInstance.interceptors.request.use(
      config => {
        config.headers['x-attu-database'] = database;
        return config;
      },
      error => Promise.reject(error)
    );

    // Clean up interceptor on unmount
    return () => {
      axiosInstance.interceptors.request.eject(requestInterceptor);
    };
  }, [database]);

  useEffect(() => {
    if (axiosResInterceptor === null) {
      axiosResInterceptor = axiosInstance.interceptors.response.use(
        (response: any) => {
          // Handle successful responses
          const isHttpError =
            response.statusCode && response.statusCode !== 200;

          // check if the response is type of ResStatus and ResStatus.error_code !== 'Success'
          const isResStatusError =
            response.data &&
            response.data.data &&
            ((typeof response.data.data.error_code === 'string' &&
              response.data.data.error_code !== 'Success' &&
              response.data.data.error_code !== '') ||
              (response.data.data.status &&
                response.data.data.status.error_code &&
                response.data.data.status.error_code !== 'Success' &&
                response.data.data.status.error_code !== ''));

          if (isHttpError) {
            openSnackBar(response.data.message, 'warning');
            return Promise.reject(response.data);
          }

          if (isResStatusError) {
            const errorMessage =
              response.data.data.reason || response.data.data.status.detail;
            openSnackBar(errorMessage, 'error');
            return Promise.reject(errorMessage);
          }

          return response;
        },
        error => {
          const { response } = error;
          let messageType: 'error' | 'warning' = 'error';

          if (response) {
            switch (response.status) {
              case HTTP_STATUS_CODE.UNAUTHORIZED:
                setTimeout(() => logout(true), 1000);
                break;

              case HTTP_STATUS_CODE.FORBIDDEN:
                messageType = 'warning';
                break;
              default:
                break;
            }
            const errorMessage = response.data?.message;
            if (errorMessage) {
              openSnackBar(errorMessage, messageType);
              return Promise.reject(error);
            }
          }
          // Handle other error cases
          openSnackBar(error.message, messageType);
          return Promise.reject(error);
        }
      );
    }

    // Clean up response interceptor on unmount
    return () => {
      if (axiosResInterceptor !== null) {
        axiosInstance.interceptors.response.eject(axiosResInterceptor);
        axiosResInterceptor = null;
      }
    };
  }, [logout, openSnackBar]);

  useEffect(() => {
    if (!isAuth) return;

    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const resetIdleTimer = () => {
      if (idleLogoutStarted.current) return;
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(async () => {
        if (idleLogoutStarted.current) return;
        idleLogoutStarted.current = true;
        await logout(false);
        openSnackBar(commonTrans('attu.sessionExpired'), 'warning');
        navigate('/connect', { replace: true });
      }, IDLE_TIMEOUT_MS);
    };
    const activityEvents: Array<keyof WindowEventMap> = [
      'pointerdown',
      'keydown',
      'touchstart',
      'scroll',
    ];
    activityEvents.forEach(event =>
      window.addEventListener(event, resetIdleTimer, { passive: true })
    );
    document.addEventListener('visibilitychange', resetIdleTimer);
    resetIdleTimer();

    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      activityEvents.forEach(event =>
        window.removeEventListener(event, resetIdleTimer)
      );
      document.removeEventListener('visibilitychange', resetIdleTimer);
    };
  }, [commonTrans, isAuth, logout, navigate, openSnackBar]);

  useEffect(() => {
    if (!isAuth || authReq.provider !== 'tcvectordb') return;
    const keepalive = window.setInterval(() => {
      void TencentVectorDbService.listDatabases().catch(() => {});
    }, TCVECTORDB_KEEPALIVE_MS);
    return () => window.clearInterval(keepalive);
  }, [authReq.provider, isAuth]);

  return <>{children}</>;
};

export default GlobalEffect;
