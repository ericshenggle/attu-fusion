import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createTheme, CssBaseline, ThemeProvider } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';
import getAttuTheme from '../src/styles/theme';
import '../src/i18n';
import TencentSearch from '../src/pages/tcvectordb/CollectionSearch';
import MilvusSearch from '../src/pages/databases/collections/search/Search';
import type { SearchParams } from '../src/pages/databases/types';
import type { CollectionFullObject, FieldObject } from '../../server/src/types';

const dense = {
  name: 'vector',
  data_type: 'FloatVector',
  dimension: 64,
  index: { indexType: 'HNSW', metricType: 'COSINE' },
} as FieldObject;
const sparse = {
  name: 'sparse',
  data_type: 'SparseFloatVector',
  dimension: 0,
  index: { indexType: 'SPARSE_INVERTED_INDEX', metricType: 'IP' },
} as FieldObject;
const primary = {
  name: 'id',
  data_type: 'Int64',
  is_primary_key: true,
} as FieldObject;
const collection = {
  collection_name: 'embedding_test',
  loaded: true,
  schema: {
    fields: [primary, dense, sparse],
    vectorFields: [dense, sparse],
    scalarFields: [primary],
    dynamicFields: [],
    primaryField: primary,
    hasVectorIndex: true,
    enablePartitionKey: true,
  },
} as unknown as CollectionFullObject;

function MilvusFixture({
  sparseOnly = false,
  bm25 = false,
}: {
  sparseOnly?: boolean;
  bm25?: boolean;
}) {
  const schema = structuredClone(collection);
  if (bm25) {
    const field = schema.schema.vectorFields[1];
    field.is_function_output = true;
    field.function = {
      name: 'BM25',
      type: 1,
      input_field_names: ['text'],
      params: {},
    };
    field.index.metricType = 'BM25';
  }
  const [params, setParams] = useState<SearchParams>({
    collection: schema,
    partitions: [],
    searchResult: null,
    graphData: { nodes: [], links: [] },
    searchParams: schema.schema.vectorFields.map((field, i) => ({
      anns_field: field.name,
      field,
      data: '',
      expanded: sparseOnly || bm25 ? i === 1 : i === 0,
      selected: sparseOnly || bm25 ? i === 1 : i === 0,
      params: i === 0 ? { ef: 200 } : {},
    })),
    globalParams: {
      topK: 10,
      consistency_level: 'Bounded',
      filter: '',
      rerank: 'rrf',
      rrfParams: { k: 60 },
      weightedParams: { weights: [0.7, 0.3] },
      output_fields: ['id'],
    },
  });
  return (
    <div style={{ height: 860 }}>
      <MilvusSearch
        collectionName={schema.collection_name}
        collections={[schema]}
        searchParams={params}
        setSearchParams={setParams}
      />
    </div>
  );
}

export function mount(
  provider: 'tcvectordb' | 'milvus',
  options: {
    sparseOnly?: boolean;
    bm25?: boolean;
    dimension?: number;
    noSparse?: boolean;
  } = {}
) {
  document.getElementById('root')!.style.display = 'none';
  document.getElementById('embedding-smoke-root')?.remove();
  const host = document.createElement('div');
  host.id = 'embedding-smoke-root';
  host.style.padding = '16px';
  document.body.append(host);
  createRoot(host).render(
    <ThemeProvider theme={createTheme(getAttuTheme('light'))}>
      <CssBaseline />
      <MemoryRouter>
        {provider === 'milvus' ? (
          <MilvusFixture {...options} />
        ) : (
          <TencentSearch
            collection={{
              database: 'attu_dev',
              collection: 'embedding_test',
              embedding: { status: 'enabled', model: 'collection-model' },
              indexes: [
                {
                  fieldName: 'id',
                  fieldType: 'string',
                  indexType: 'primaryKey',
                },
                ...(!options.sparseOnly
                  ? [
                      {
                        fieldName: 'vector',
                        fieldType: 'vector',
                        indexType: 'HNSW',
                        dimension: options.dimension || 64,
                        metricType: 'COSINE',
                      },
                    ]
                  : []),
                ...(!options.noSparse
                  ? [
                      {
                        fieldName: 'sparse_vector',
                        fieldType: 'sparseVector',
                        indexType: 'inverted',
                      },
                    ]
                  : []),
              ],
            }}
          />
        )}
      </MemoryRouter>
    </ThemeProvider>
  );
}
