import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ReqHeaderMiddleware } from '../middleware';
import { clientCache } from '../app';
import { getVectorDbProvider } from '../providers';
import type { Request, Response } from 'express';

jest.mock('../app', () => ({ clientCache: { get: jest.fn() } }));
jest.mock('../providers', () => ({ getVectorDbProvider: jest.fn() }));
const hasSession = jest.fn<(clientId: string) => boolean>();

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(getVectorDbProvider).mockReturnValue({ hasSession } as any);
});

describe('Embedding session access', () => {
  const check = (id = '') => {
    const next = jest.fn();
    ReqHeaderMiddleware({ headers: { 'milvus-client-id': id }, path: '/api/v1/embedding/generate' } as unknown as Request, {} as Response, next);
    return next;
  };
  it('rejects missing and expired sessions', () => {
    expect(check()).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    expect(check('expired')).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });
  it('accepts a Tencent session without a Milvus connection', () => {
    hasSession.mockReturnValue(true);
    expect(check('tencent')).toHaveBeenCalledWith();
  });
  it('accepts a Milvus session', () => {
    jest.mocked(clientCache.get).mockReturnValue({} as any);
    expect(check('milvus')).toHaveBeenCalledWith();
  });
});
