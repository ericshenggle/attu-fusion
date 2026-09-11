export type EmbeddingOutputType = 'dense' | 'sparse' | 'dense&sparse';
export type SparseEmbedding = Array<{
  index: number;
  value: number;
  token?: string;
}>;
export type EmbeddingVectors = {
  vector?: number[];
  sparseVector?: SparseEmbedding;
};

export type EmbeddingModel = {
  id: string;
  name: string;
  dimensions: number[];
  defaultDimension: number;
  outputTypes: EmbeddingOutputType[];
};

export type EmbeddingProviderInfo = {
  id: string;
  name: string;
  requiresApiKey: boolean;
  models: EmbeddingModel[];
};

export type EmbeddingRequest = {
  provider: string;
  model: string;
  dimension?: number;
  outputType?: EmbeddingOutputType;
  input: string;
  apiKey?: string;
  targetDimension?: number;
};

export type EmbeddingResult = EmbeddingVectors & {
  provider: string;
  model: string;
  dimension?: number;
  outputType: EmbeddingOutputType;
  elapsedMs: number;
};

export interface EmbeddingProvider {
  info: EmbeddingProviderInfo;
  // Adapters own the URL, authentication, payload and response parsing.
  embed(request: EmbeddingRequest): Promise<EmbeddingVectors>;
}
