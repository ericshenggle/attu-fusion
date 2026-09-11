import BaseModel from './BaseModel';
import type {
  EmbeddingProviderInfo,
  EmbeddingRequest,
  EmbeddingResult,
} from '@server/embedding/types';

export class EmbeddingService extends BaseModel {
  static providers(signal?: AbortSignal) {
    return super.find<EmbeddingProviderInfo[]>({
      path: '/embedding/providers',
      config: { signal },
    });
  }

  static generate(data: EmbeddingRequest, signal?: AbortSignal) {
    return super.create<EmbeddingResult>({
      path: '/embedding/generate',
      data,
      config: { signal, timeout: 60000 },
    });
  }
}
