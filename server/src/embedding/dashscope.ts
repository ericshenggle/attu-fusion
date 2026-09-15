import axios from 'axios';
import type { EmbeddingProvider } from './types';
import { EmbeddingProviderError } from './errors';
import { dashscopeFailure } from './dashscope.errors';

export const dashscope: EmbeddingProvider = {
  info: {
    id: 'dashscope',
    name: 'Alibaba Cloud Bailian',
    requiresApiKey: true,
    models: [
      {
        id: 'text-embedding-v4',
        outputTypes: ['dense', 'sparse', 'dense&sparse'],
        name: 'text-embedding-v4',
        dimensions: [64, 128, 256, 512, 768, 1024, 1536, 2048],
        defaultDimension: 1024,
      },
      {
        id: 'text-embedding-v3',
        outputTypes: ['dense', 'sparse', 'dense&sparse'],
        name: 'text-embedding-v3',
        dimensions: [64, 128, 256, 512, 768, 1024],
        defaultDimension: 1024,
      },
      {
        id: 'text-embedding-v2',
        outputTypes: ['dense'],
        name: 'text-embedding-v2',
        dimensions: [1536],
        defaultDimension: 1536,
      },
      {
        id: 'qwen3.7-text-embedding',
        outputTypes: ['dense', 'sparse', 'dense&sparse'],
        name: 'qwen3.7-text-embedding',
        dimensions: [256, 512, 768, 1024, 1536, 2048, 2560],
        defaultDimension: 1024,
      },
    ],
  },
  async embed(request) {
    // DASHSCOPE_BASE_URL may point at the account's Beijing workspace API host.
    const base =
      process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/api/v1';
    let response;
    try {
      response = await axios.request({
        url: `${base.replace(/\/$/, '')}/services/embeddings/text-embedding/text-embedding`,
        method: 'POST',
        timeout: 45000,
        maxRedirects: 0,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${request.apiKey}`,
        },
        data: {
          model: request.model,
          input: { texts: [request.input] },
          parameters: {
            text_type: 'query',
            ...(request.model === 'text-embedding-v2'
              ? {}
              : {
                  ...(request.outputType === 'sparse'
                    ? {}
                    : { dimension: request.dimension }),
                  output_type: request.outputType || 'dense',
                }),
          },
        },
      });
    } catch (error) {
      throw dashscopeFailure(error, request);
    }
    if (response.data?.code || response.status >= 400) {
      throw dashscopeFailure({ response }, request);
    }
    const embeddings = response.data?.output?.embeddings;
    if (
      !Array.isArray(embeddings) ||
      embeddings.length !== 1 ||
      embeddings[0]?.text_index !== 0
    )
      throw new EmbeddingProviderError(
        'Alibaba Cloud Bailian returned an invalid embedding response.',
        { provider: 'dashscope', reason: 'response' }
      );
    return {
      vector: embeddings[0].embedding,
      sparseVector: embeddings[0].sparse_embedding,
    };
  },
};
