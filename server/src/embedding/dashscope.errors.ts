import { EmbeddingFailureReason, EmbeddingProviderError } from './errors';
import type { EmbeddingRequest } from './types';

const clean = (
  value: unknown,
  request: EmbeddingRequest,
  maxLength: number
) => {
  if (typeof value !== 'string') return undefined;
  let text = value;
  for (const secret of [
    request.apiKey,
    request.apiKey?.trim(),
    request.input,
  ]) {
    if (secret) text = text.split(secret).join('[redacted]');
  }
  return text
    .replace(/Bearer\s+[^\s"',;]+/gi, 'Bearer [redacted]')
    .replace(/\bsk-[a-zA-Z0-9_-]+/g, '[redacted]')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .slice(0, maxLength);
};

export function dashscopeFailure(
  error: unknown,
  request: EmbeddingRequest
): EmbeddingProviderError {
  const source = error as {
    code?: unknown;
    response?: {
      status?: unknown;
      data?: { code?: unknown; message?: unknown; request_id?: unknown };
    };
  };
  const data = source?.response?.data;
  const status =
    typeof source?.response?.status === 'number'
      ? source.response.status
      : undefined;
  const code = clean(data?.code ?? source?.code, request, 100);
  const requestId = clean(data?.request_id, request, 100);
  let reason: EmbeddingFailureReason = 'upstream';
  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') reason = 'timeout';
  else if (
    status === 401 ||
    /InvalidApiKey|InvalidAuthentication|MissingApiKey/i.test(code || '')
  )
    reason = 'authentication';
  else if (/Arrearage|Quota|Balance|Overdue|PrepaidBill/i.test(code || ''))
    reason = 'quota';
  else if (status === 429 || /Throttling|RateLimit/i.test(code || ''))
    reason = 'rateLimit';
  else if (
    status === 403 ||
    /AccessDenied|Forbidden|NotAuthorized/i.test(code || '')
  )
    reason = 'permission';
  else if (
    status === 404 ||
    /ModelNotFound|ModelNotExist|InvalidModel/i.test(code || '')
  )
    reason = 'model';
  else if (
    status === 400 ||
    status === 422 ||
    /InvalidParameter|DataInspection/i.test(code || '')
  )
    reason = 'request';
  else if (
    !status &&
    [
      'ENOTFOUND',
      'EAI_AGAIN',
      'ECONNRESET',
      'ECONNREFUSED',
      'ENETUNREACH',
      'EHOSTUNREACH',
      'CERT_HAS_EXPIRED',
      'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
      'SELF_SIGNED_CERT_IN_CHAIN',
    ].includes(code || '')
  )
    reason = 'network';
  // Only the documented JSON error message is retained, never a raw exception,
  // HTML proxy response, request body, URL, headers or stack from Axios.
  const detail = clean(data?.message, request, 600);
  const description = [status ? `HTTP ${status}` : undefined, code]
    .filter(Boolean)
    .join(' / ');
  return new EmbeddingProviderError(
    `Alibaba Cloud Bailian${description ? ` (${description})` : ''}: ${detail || 'Embedding request failed.'}${requestId ? ` Request ID: ${requestId}` : ''}`,
    { provider: 'dashscope', reason, code, requestId, upstreamStatus: status }
  );
}
