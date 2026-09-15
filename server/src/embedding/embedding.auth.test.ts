import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  ErrorMiddleware,
  ReqHeaderMiddleware,
  TransformResMiddleware,
} from '../middleware';
import { EmbeddingProviderError } from './errors';
import type { HttpError } from 'http-errors';
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

describe('Embedding HTTP errors', () => {
  it('passes safe provider details through response middleware without expiring the database session', () => {
    const info = {
      provider: 'dashscope',
      reason: 'authentication' as const,
      code: 'InvalidApiKey',
      upstreamStatus: 401,
      requestId: 'test-request-401',
    };
    const error = new EmbeddingProviderError('Invalid API key', info);
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const json = res.json;
    const req = {
      method: 'POST',
      url: '/api/v1/embedding/generate',
    } as Request;
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      TransformResMiddleware(req, res as unknown as Response, jest.fn());
      ErrorMiddleware(
        error as unknown as HttpError,
        req,
        res as unknown as Response,
        jest.fn()
      );
      expect(res.status).toHaveBeenCalledWith(502);
      expect(json).toHaveBeenCalledWith({
        statusCode: 502,
        message: 'Invalid API key',
        error: info,
      });
    } finally {
      log.mockRestore();
    }
  });
});

describe('Embedding session access', () => {
  const check = (id = '') => {
    const next = jest.fn();
    ReqHeaderMiddleware(
      {
        headers: { 'milvus-client-id': id },
        path: '/api/v1/embedding/generate',
      } as unknown as Request,
      {} as Response,
      next
    );
    return next;
  };
  it('rejects missing and expired sessions', () => {
    expect(check()).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 401 })
    );
    expect(check('expired')).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 401 })
    );
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
