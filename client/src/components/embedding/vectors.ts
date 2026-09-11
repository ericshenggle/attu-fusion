import type { EmbeddingResult, SparseEmbedding } from '@server/embedding/types';

export const pairsToMap = (pairs: number[][]) =>
  pairs.reduce<Record<string, number>>((result, [index, value]) => {
    result[index] = value;
    return result;
  }, {});
export const sparseToMap = (sparse: SparseEmbedding) =>
  pairsToMap(sparse.map(v => [v.index, v.value]));
export const serializeEmbedding = (result: EmbeddingResult) =>
  JSON.stringify(
    result.outputType === 'dense'
      ? result.vector
      : result.outputType === 'sparse'
        ? sparseToMap(result.sparseVector!)
        : {
            dense: result.vector,
            sparse: sparseToMap(result.sparseVector!),
          }
  );

export function sparseToPairs(value: unknown): number[][] {
  const pairs: unknown[] = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? Object.entries(value).map(([index, weight]) => [
          /^(0|[1-9]\d*)$/.test(index) ? Number(index) : NaN,
          weight,
        ])
      : [];
  if (
    !pairs.length ||
    pairs.some(
      pair =>
        !Array.isArray(pair) ||
        pair.length !== 2 ||
        !Number.isInteger(pair[0]) ||
        pair[0] < 0 ||
        pair[0] > 4294967294 ||
        typeof pair[1] !== 'number' ||
        !Number.isFinite(pair[1])
    ) ||
    new Set(pairs.map(pair => (pair as number[])[0])).size !== pairs.length
  )
    throw new Error(
      'Invalid sparse vector: expected unique non-negative indices with finite weights.'
    );
  return pairs as number[][];
}

export const isCombinedVector = (
  value: unknown
): value is { dense: unknown; sparse: unknown } =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  'dense' in value &&
  'sparse' in value;

export function isCombinedInput(input: string) {
  try {
    return isCombinedVector(JSON.parse(input));
  } catch {
    return false;
  }
}
