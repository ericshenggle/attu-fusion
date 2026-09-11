import HttpErrors from 'http-errors';
import type {
  ProviderCollection,
  ProviderDocument,
  ProviderIndex,
} from '../providers/types';

export function denseVectorIndex(
  collection: ProviderCollection
): ProviderIndex {
  const index = collection.indexes?.find(i => i.fieldName === 'vector');
  if (
    !index ||
    !['vector', 'float16_vector', 'bfloat16_vector', 'binary_vector'].includes(
      index.fieldType
    )
  ) {
    throw HttpErrors(400, 'This operation requires a dense vector collection.');
  }
  return index;
}

export function validateVector(vector: unknown, index: ProviderIndex) {
  const binary = index.fieldType === 'binary_vector';
  const length = binary ? index.dimension / 8 : index.dimension;
  if (
    !Number.isInteger(length) ||
    length < 1 ||
    !Array.isArray(vector) ||
    vector.length !== length ||
    vector.some(
      v =>
        typeof v !== 'number' ||
        !Number.isFinite(v) ||
        (binary && (!Number.isInteger(v) || v < 0 || v > 255))
    )
  ) {
    throw HttpErrors(
      400,
      `vector must contain ${length} ${binary ? 'integers from 0 to 255' : 'finite numbers'}.`
    );
  }
}

export function validateDocumentIds(
  ids: unknown,
  max: number
): asserts ids is string[] {
  if (
    !Array.isArray(ids) ||
    ids.length < 1 ||
    ids.length > max ||
    ids.some(
      id => typeof id !== 'string' || id.length < 1 || id.length > 128
    ) ||
    new Set(ids).size !== ids.length
  ) {
    throw HttpErrors(
      400,
      `Provide 1-${max} distinct document IDs, each a string of 1-128 characters.`
    );
  }
}

export function validateDocuments(
  documents: ProviderDocument[],
  collection: ProviderCollection
) {
  if (
    !Array.isArray(documents) ||
    documents.length < 1 ||
    documents.length > 1000 ||
    documents.some(doc => !doc || typeof doc !== 'object' || Array.isArray(doc))
  ) {
    throw HttpErrors(400, 'Provide a JSON array of 1-1000 document objects.');
  }
  validateDocumentIds(
    documents.map(doc => doc.id),
    1000
  );
  const index = denseVectorIndex(collection);
  const textField =
    collection.embedding?.status === 'enabled' && collection.embedding.field;
  for (const doc of documents) {
    if (doc.vector !== undefined) {
      validateVector(doc.vector, index);
    } else if (
      !textField ||
      typeof doc[textField] !== 'string' ||
      !(doc[textField] as string).trim()
    ) {
      throw HttpErrors(
        400,
        `Document ${doc.id} requires vector${textField ? ` or ${textField}` : ''}.`
      );
    }
  }
}
