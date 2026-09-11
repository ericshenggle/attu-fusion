import HttpErrors from 'http-errors';
import type { ProviderIndex } from '../providers/types';

export const validateCollectionIndexes = (
  indexes: ProviderIndex[]
): ProviderIndex[] => {
  const fail = (message: string): never => {
    throw HttpErrors(400, message);
  };
  if (!Array.isArray(indexes) || indexes.length < 2)
    fail('Primary key and vector indexes are required.');
  const names = new Set<string>();
  const integer = (value: number, min: number, max: number) =>
    Number.isInteger(value) && value >= min && value <= max;
  const result = indexes.map(index => {
    if (
      !index ||
      typeof index.fieldName !== 'string' ||
      !/^[a-zA-Z][a-zA-Z0-9_-]{0,127}$/.test(index.fieldName)
    ) {
      fail(
        'Index field names must start with a letter and contain letters, digits, underscores or hyphens.'
      );
    }
    if (names.has(index.fieldName))
      fail(`Duplicate index field: ${index.fieldName}.`);
    names.add(index.fieldName);
    const { fieldName, fieldType, indexType } = index;
    if (fieldName === 'id') {
      if (fieldType !== 'string' || indexType !== 'primaryKey')
        fail('id must be a string primaryKey index.');
      return { fieldName, fieldType, indexType };
    }
    if (fieldName === 'vector') {
      if (fieldType !== 'vector' || !['HNSW', 'FLAT'].includes(indexType))
        fail(
          'This create form supports vector fields with HNSW or FLAT indexes.'
        );
      if (!integer(index.dimension, 1, 4096))
        fail('Vector dimension must be an integer from 1 to 4096.');
      if (!['COSINE', 'L2', 'IP'].includes(index.metricType))
        fail('Metric must be COSINE, L2 or IP.');
      const vector: ProviderIndex = {
        fieldName,
        fieldType,
        indexType,
        dimension: index.dimension,
        metricType: index.metricType,
      };
      if (indexType === 'HNSW') {
        if (
          !integer(index.params?.M, 4, 64) ||
          !integer(index.params?.efConstruction, 8, 512)
        )
          fail('HNSW requires M (4-64) and efConstruction (8-512).');
        vector.params = {
          M: index.params.M,
          efConstruction: index.params.efConstruction,
        };
      }
      return vector;
    }
    if (
      indexType !== 'filter' ||
      !['string', 'uint64', 'int64', 'double', 'array', 'json'].includes(
        fieldType
      )
    )
      fail('Unsupported scalar filter index.');
    return { fieldName, fieldType, indexType };
  });
  if (!names.has('id') || !names.has('vector'))
    fail('The id and vector fields are required.');
  return result;
};
