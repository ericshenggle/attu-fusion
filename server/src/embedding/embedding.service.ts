import HttpErrors from 'http-errors';
import { EmbeddingProviderError } from './errors';
import type {
  EmbeddingProvider,
  EmbeddingRequest,
  EmbeddingResult,
  EmbeddingVectors,
} from './types';

export class EmbeddingService {
  constructor(private readonly providers: EmbeddingProvider[]) {}

  listProviders() {
    return this.providers.map(provider => provider.info);
  }

  async generate(request: EmbeddingRequest): Promise<EmbeddingResult> {
    if (!request || typeof request !== 'object')
      throw HttpErrors(400, 'An embedding request is required.');
    const provider = this.providers.find(p => p.info.id === request.provider);
    if (!provider)
      throw HttpErrors(400, 'Embedding provider is not available.');
    const model = provider.info.models.find(m => m.id === request.model);
    if (!model) throw HttpErrors(400, 'Embedding model is not available.');
    const outputType = request.outputType || 'dense';
    if (!model.outputTypes.includes(outputType))
      throw HttpErrors(
        400,
        'The model does not support this embedding output type.'
      );
    const needsDense = outputType !== 'sparse';
    const needsSparse = outputType !== 'dense';
    if (
      needsDense &&
      (!Number.isSafeInteger(request.dimension) ||
        !model.dimensions.includes(request.dimension))
    )
      throw HttpErrors(400, 'The model does not support this dimension.');
    if (
      needsDense &&
      request.targetDimension !== undefined &&
      request.dimension !== request.targetDimension
    )
      throw HttpErrors(
        400,
        'Embedding dimension must match the target vector field.'
      );
    if (
      typeof request.input !== 'string' ||
      !request.input.trim() ||
      request.input.length > 65536
    )
      throw HttpErrors(
        400,
        'Provide non-empty text of at most 65536 characters.'
      );
    if (
      request.apiKey !== undefined &&
      (typeof request.apiKey !== 'string' || request.apiKey.length > 8192)
    )
      throw HttpErrors(400, 'Invalid embedding API key.');
    if (provider.info.requiresApiKey && !request.apiKey?.trim())
      throw HttpErrors(400, 'An embedding API key is required.');

    const start = Date.now();
    let vectors: EmbeddingVectors;
    try {
      vectors = await provider.embed({
        provider: provider.info.id,
        model: model.id,
        dimension: needsDense ? request.dimension : undefined,
        outputType,
        input: request.input,
        apiKey: request.apiKey?.trim(),
      });
    } catch (error) {
      if (error instanceof EmbeddingProviderError) throw error;
      // Provider errors can contain credentials, request bodies or response headers.
      throw HttpErrors(
        502,
        'Embedding generation failed. Check the provider and credentials.'
      );
    }
    const { vector, sparseVector } = vectors || {};
    if (
      needsDense &&
      (!Array.isArray(vector) ||
        vector.length !== request.dimension ||
        vector.some(v => typeof v !== 'number' || !Number.isFinite(v)))
    )
      throw HttpErrors(
        502,
        'Embedding provider returned an invalid vector or dimension.'
      );
    if (
      needsSparse &&
      (!Array.isArray(sparseVector) ||
        !sparseVector.length ||
        sparseVector.some(
          v =>
            !v ||
            !Number.isInteger(v.index) ||
            v.index < 0 ||
            v.index > 4294967294 ||
            typeof v.value !== 'number' ||
            !Number.isFinite(v.value)
        ) ||
        new Set(sparseVector.map(v => v.index)).size !== sparseVector.length)
    )
      throw HttpErrors(
        502,
        'Embedding provider returned an invalid sparse vector.'
      );
    return {
      provider: provider.info.id,
      model: model.id,
      outputType,
      ...(needsDense ? { dimension: vector.length, vector } : {}),
      ...(needsSparse
        ? {
            sparseVector: sparseVector.map(({ index, value, token }) => ({
              index,
              value,
              ...(typeof token === 'string' ? { token } : {}),
            })),
          }
        : {}),
      elapsedMs: Date.now() - start,
    };
  }
}
