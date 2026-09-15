export type EmbeddingFailureReason =
  | 'authentication'
  | 'permission'
  | 'quota'
  | 'rateLimit'
  | 'model'
  | 'request'
  | 'timeout'
  | 'network'
  | 'response'
  | 'configuration'
  | 'upstream';

export type EmbeddingFailure = {
  provider: string;
  reason: EmbeddingFailureReason;
  code?: string;
  requestId?: string;
  upstreamStatus?: number;
};

// Only this sanitized error may leave a provider adapter. Never attach an Axios
// error/cause: it includes Authorization, input text and the entire HTTP config.
export class EmbeddingProviderError extends Error {
  readonly statusCode = 502;
  constructor(
    message: string,
    readonly info: EmbeddingFailure
  ) {
    super(message);
    this.name = 'EmbeddingProviderError';
  }
}
