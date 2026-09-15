import axios from 'axios';
import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { EmbeddingService } from './embedding.service';
import { embeddingProviders } from './providers';
import type { EmbeddingRequest } from './types';

jest.mock('axios');
const http = jest.mocked(axios.request);
const service = new EmbeddingService(embeddingProviders);
const originalBaseUrl = process.env.DASHSCOPE_BASE_URL;
const input: EmbeddingRequest = {
  provider: 'dashscope',
  model: 'text-embedding-v4',
  dimension: 64,
  targetDimension: 64,
  input: 'Find similar documents',
  apiKey: 'test-secret',
};
const response = (vector: unknown) => ({
  data: { output: { embeddings: [{ text_index: 0, embedding: vector }] } },
});

beforeEach(() => {
  jest.resetAllMocks();
  delete process.env.DASHSCOPE_BASE_URL;
});
afterEach(() => {
  if (originalBaseUrl === undefined) delete process.env.DASHSCOPE_BASE_URL;
  else process.env.DASHSCOPE_BASE_URL = originalBaseUrl;
});

describe('Bailian embedding', () => {
  it.each(['sparse', 'dense&sparse'] as const)(
    'requests and validates %s output',
    async outputType => {
      const sparse = [
        { index: 2, value: 0.8, token: 'hello' },
        { index: 70000, value: 0.2 },
      ];
      http.mockResolvedValueOnce({
        data: {
          output: {
            embeddings: [
              {
                text_index: 0,
                embedding: Array(64).fill(0.1),
                sparse_embedding: sparse,
              },
            ],
          },
        },
      });
      const result = await service.generate({
        ...input,
        outputType,
        ...(outputType === 'sparse'
          ? { dimension: undefined, targetDimension: undefined }
          : {}),
      });
      expect(result.sparseVector).toEqual(sparse);
      expect(result.outputType).toBe(outputType);
      expect(http.mock.calls[0][0].data).toHaveProperty(
        'parameters.output_type',
        outputType
      );
      if (outputType === 'sparse') {
        expect(result.vector).toBeUndefined();
        expect(result.dimension).toBeUndefined();
        expect(http.mock.calls[0][0].data).not.toHaveProperty(
          'parameters.dimension'
        );
      } else expect(result.vector).toHaveLength(64);
    }
  );

  it.each(
    [
      [],
      [{ index: -1, value: 1 }],
      [{ index: 1.5, value: 1 }],
      [{ index: 4294967295, value: 1 }],
      [{ index: 1, value: NaN }],
      [
        { index: 1, value: 1 },
        { index: 1, value: 2 },
      ],
    ].map(sparse => ({ sparse }))
  )('rejects malformed sparse output', async ({ sparse }) => {
    http.mockResolvedValueOnce({
      data: {
        output: { embeddings: [{ text_index: 0, sparse_embedding: sparse }] },
      },
    });
    await expect(
      service.generate({ ...input, outputType: 'sparse' })
    ).rejects.toMatchObject({ statusCode: 502 });
  });

  it('rejects sparse output for a dense-only model before HTTP', async () => {
    await expect(
      service.generate({
        ...input,
        model: 'text-embedding-v2',
        outputType: 'sparse',
      })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(http).not.toHaveBeenCalled();
  });

  it('publishes only Bailian and its supported model dimensions', () => {
    expect(service.listProviders().map(p => p.id)).toEqual(['dashscope']);
    expect(
      service.listProviders()[0].models.find(m => m.id === 'text-embedding-v2')
        ?.dimensions
    ).toEqual([1536]);
  });

  it('sends the native HTTP query payload and returns a validated vector', async () => {
    const vector = Array(64).fill(0.125);
    http.mockResolvedValueOnce(response(vector));
    expect(await service.generate(input)).toMatchObject({
      provider: 'dashscope',
      model: input.model,
      dimension: 64,
      vector,
    });
    expect(http).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding',
        method: 'POST',
        timeout: 45000,
        maxRedirects: 0,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-secret',
        },
        data: {
          model: input.model,
          input: { texts: [input.input] },
          parameters: {
            text_type: 'query',
            dimension: 64,
            output_type: 'dense',
          },
        },
      })
    );
  });

  it('uses the configured workspace base URL', async () => {
    process.env.DASHSCOPE_BASE_URL =
      'https://workspace.cn-beijing.maas.aliyuncs.com/api/v1/';
    http.mockResolvedValueOnce(response(Array(64).fill(0)));
    await service.generate(input);
    expect(http.mock.calls[0][0].url).toBe(
      'https://workspace.cn-beijing.maas.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding'
    );
  });

  it('omits unsupported v2 dimension and output_type parameters', async () => {
    http.mockResolvedValueOnce(response(Array(1536).fill(0)));
    await service.generate({
      ...input,
      model: 'text-embedding-v2',
      dimension: 1536,
      targetDimension: 1536,
    });
    expect(http.mock.calls[0][0].data).toMatchObject({
      parameters: { text_type: 'query' },
    });
    expect(http.mock.calls[0][0].data).not.toHaveProperty(
      'parameters.dimension'
    );
    expect(http.mock.calls[0][0].data).not.toHaveProperty(
      'parameters.output_type'
    );
  });

  it.each([
    { provider: 'unavailable' },
    { model: 'unavailable' },
    { dimension: 63 },
    { dimension: 64.5 },
    { targetDimension: 128 },
    { apiKey: '' },
    { input: '   ' },
    { input: 'a'.repeat(65537) },
  ])('rejects invalid input before calling Bailian', async invalid => {
    await expect(
      service.generate({ ...input, ...invalid })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(http).not.toHaveBeenCalled();
  });

  it.each([
    null,
    [],
    Array(32).fill(0),
    Array(64).fill('0'),
    Array(64).fill(NaN),
    Array(64).fill(Infinity),
  ])('rejects malformed or mismatched embedding results', async vector => {
    http.mockResolvedValueOnce(response(vector));
    await expect(service.generate(input)).rejects.toMatchObject({
      statusCode: 502,
    });
  });

  it('rejects a provider error in a successful HTTP response', async () => {
    http.mockResolvedValueOnce({
      data: { code: 'InvalidApiKey', message: 'upstream details' },
    });
    await expect(service.generate(input)).rejects.toMatchObject({
      statusCode: 502,
    });
  });

  it('does not expose credentials or request text from upstream errors', async () => {
    http.mockRejectedValueOnce(new Error(`${input.apiKey} ${input.input}`));
    await expect(service.generate(input)).rejects.toMatchObject({
      statusCode: 502,
      message: 'Alibaba Cloud Bailian: Embedding request failed.',
    });
  });

  it.each([
    [401, 'InvalidApiKey', 'authentication'],
    [403, 'AccessDenied', 'permission'],
    [400, 'InvalidParameter', 'request'],
    [400, 'InvalidParameter.Instruct', 'request'],
    [400, 'Arrearage', 'quota'],
    [429, 'Throttling', 'rateLimit'],
    [404, 'ModelNotFound', 'model'],
    [503, 'ServiceUnavailable', 'upstream'],
  ])(
    'preserves safe Bailian error details for HTTP %s / %s',
    async (status, code, reason) => {
      http.mockRejectedValueOnce({
        response: {
          status,
          data: {
            code,
            message: 'Provider explanation',
            request_id: 'request-123',
          },
        },
      });
      await expect(service.generate(input)).rejects.toMatchObject({
        statusCode: 502,
        info: {
          provider: 'dashscope',
          upstreamStatus: status,
          code,
          reason,
          requestId: 'request-123',
        },
        message: `Alibaba Cloud Bailian (HTTP ${status} / ${code}): Provider explanation Request ID: request-123`,
      });
    }
  );

  it.each([
    ['ECONNABORTED', 'timeout'],
    ['ENOTFOUND', 'network'],
    ['ECONNRESET', 'network'],
  ])('classifies %s without leaking Axios config', async (code, reason) => {
    http.mockRejectedValueOnce({
      code,
      message: input.apiKey,
      config: { headers: { Authorization: input.apiKey }, data: input.input },
    });
    await expect(service.generate(input)).rejects.toMatchObject({
      statusCode: 502,
      info: { code, reason },
    });
  });

  it('redacts secrets and input echoed in the provider response, code and request ID', async () => {
    http.mockRejectedValueOnce({
      response: {
        status: 401,
        data: {
          code: input.apiKey,
          message: `Invalid ${input.apiKey} Bearer other-secret sk-another-secret ${input.input}`,
          request_id: input.apiKey,
        },
      },
    });
    try {
      await service.generate(input);
      throw new Error('Expected failure');
    } catch (error) {
      const serialized = JSON.stringify(error);
      expect(serialized).not.toContain(input.apiKey);
      expect(serialized).not.toContain(input.input);
      expect((error as Error).message).not.toContain(input.apiKey);
      expect((error as Error).message).not.toContain('other-secret');
      expect((error as Error).message).not.toContain('sk-another-secret');
    }
  });

  it('preserves errors returned with HTTP 200', async () => {
    http.mockResolvedValueOnce({
      status: 200,
      data: {
        code: 'InvalidApiKey',
        message: 'Key is not valid',
        request_id: 'request-200',
      },
    });
    await expect(service.generate(input)).rejects.toMatchObject({
      statusCode: 502,
      info: {
        reason: 'authentication',
        code: 'InvalidApiKey',
        requestId: 'request-200',
      },
    });
  });
});
