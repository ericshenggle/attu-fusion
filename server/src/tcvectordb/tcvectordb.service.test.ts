import axios from 'axios';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TencentVectorDbService } from './tcvectordb.service';
import {
  TencentVectorDbCreateCollectionDto,
  TencentVectorDbQueryDto,
  TencentVectorDbSearchDto,
  TencentVectorDbUpsertDto,
  TencentVectorDbDeleteDocumentsDto,
} from './dto';
import { validateVector } from './documents.validation';
import { ProviderCreateCollectionRequest } from '../providers/types';

jest.mock('axios');
const request = jest.mocked(axios.request);
const connection = {
  endpoint: 'http://vector.example:80/',
  account: 'root',
  apiKey: 'test-key',
  database: 'attu_dev',
  clientId: 'test-session',
};
const create: ProviderCreateCollectionRequest = {
  clientId: connection.clientId,
  database: 'attu_dev',
  collection: 'custom_collection',
  shardNum: 2,
  replicaNum: 0,
  indexes: [
    { fieldName: 'id', fieldType: 'string', indexType: 'primaryKey' },
    {
      fieldName: 'vector',
      fieldType: 'vector',
      indexType: 'HNSW',
      dimension: 128,
      metricType: 'L2',
      params: { M: 32, efConstruction: 256 },
    },
    { fieldName: 'score', fieldType: 'double', indexType: 'filter' },
  ],
};
const databaseResponse = {
  data: {
    code: 0,
    databases: ['attu_dev', 'other', 'files'],
    info: {
      attu_dev: { dbType: 'BASE_DB', count: 1 },
      other: { dbType: 'BASE_DB', count: 0 },
      files: { dbType: 'AI_DB' },
    },
  },
};

describe('Tencent VectorDB business workflow', () => {
  let service: TencentVectorDbService;
  beforeEach(async () => {
    jest.clearAllMocks();
    service = new TencentVectorDbService();
    request.mockResolvedValueOnce(databaseResponse);
    await service.connect(connection);
    request.mockResolvedValue({ data: { code: 0, affectedCount: 1 } });
  });

  it('keeps credentials in the session and forwards custom creation options', async () => {
    await service.createCollection(create);
    const config = request.mock.calls[1][0];
    expect(config.url).toBe('http://vector.example/collection/create');
    expect(config.headers.Authorization).toBe(
      'Bearer account=root&api_key=test-key'
    );
    expect(config.data).toEqual({
      database: 'attu_dev',
      collection: 'custom_collection',
      shardNum: 2,
      replicaNum: 0,
      indexes: create.indexes,
    });
    expect(config.data).not.toHaveProperty('clientId');
    expect(config.data).not.toHaveProperty('apiKey');
  });

  it('lists only Base databases and preserves server collection counts', async () => {
    request.mockResolvedValueOnce(databaseResponse);
    expect(await service.listDatabases(connection.clientId)).toEqual([
      { name: 'attu_dev', type: 'BASE_DB', collectionCount: 1 },
      { name: 'other', type: 'BASE_DB', collectionCount: 0 },
    ]);
  });

  it('uses the requested database on each operation without shared mutable database state', async () => {
    request.mockResolvedValueOnce({ data: { code: 0, collections: [] } });
    await service.listCollections({
      clientId: connection.clientId,
      database: 'other',
    });
    expect(request.mock.calls[1][0].data).toEqual({ database: 'other' });
    await service.dropCollection({
      clientId: connection.clientId,
      database: 'attu_dev',
      collection: 'custom_collection',
    });
    expect(request.mock.calls[2][0].data).toEqual({
      database: 'attu_dev',
      collection: 'custom_collection',
    });
  });

  it('rejects missing or closed sessions before sending an upstream request', async () => {
    await expect(service.listDatabases('missing')).rejects.toMatchObject({
      status: 401,
    });
    service.disconnect(connection.clientId);
    await expect(
      service.listCollections({
        clientId: connection.clientId,
        database: 'attu_dev',
      })
    ).rejects.toMatchObject({ status: 401 });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('rejects an AI database connection without creating a session', async () => {
    request.mockResolvedValueOnce(databaseResponse);
    await expect(
      service.connect({
        ...connection,
        database: 'files',
        clientId: 'ai-session',
      })
    ).rejects.toMatchObject({ status: 400 });
    expect(service.hasSession('ai-session')).toBe(false);
  });

  it('does not fabricate collection details when the upstream response is incomplete', async () => {
    await expect(
      service.describeCollection({
        clientId: connection.clientId,
        database: 'attu_dev',
        collection: 'missing',
      })
    ).rejects.toMatchObject({ status: 502 });
  });

  it('propagates upstream application errors', async () => {
    request.mockResolvedValueOnce({
      data: { code: 100, msg: 'Collection already exists' },
    });
    await expect(service.createCollection(create)).rejects.toThrow(
      'Collection already exists'
    );
  });

  it.each([
    ['missing vector', [create.indexes[0]]],
    ['duplicate name', [...create.indexes, create.indexes[0]]],
    [
      'invalid dimension',
      [create.indexes[0], { ...create.indexes[1], dimension: 0 }],
    ],
    [
      'invalid HNSW',
      [
        create.indexes[0],
        { ...create.indexes[1], params: { M: 1, efConstruction: 200 } },
      ],
    ],
    [
      'invalid scalar',
      [
        ...create.indexes,
        { fieldName: 'extra', fieldType: 'bool', indexType: 'filter' },
      ],
    ],
  ])('rejects %s without sending a mutation', async (_, indexes) => {
    await expect(
      service.createCollection({ ...create, indexes })
    ).rejects.toMatchObject({ status: 400 });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('validates shard count, replica count and collection name at the HTTP boundary', async () => {
    expect(
      await validate(
        plainToInstance(TencentVectorDbCreateCollectionDto, create)
      )
    ).toHaveLength(0);
    const errors = await validate(
      plainToInstance(TencentVectorDbCreateCollectionDto, {
        ...create,
        shardNum: 0,
        replicaNum: -1,
        collection: '../invalid',
      })
    );
    expect(errors.map(e => e.property).sort()).toEqual([
      'collection',
      'replicaNum',
      'shardNum',
    ]);
  });

  const target = {
    clientId: connection.clientId,
    database: 'attu_dev',
    collection: 'documents_test',
  };
  const vector = Array.from({ length: 128 }, (_, i) => i / 128);
  const detail = {
    ...target,
    indexes: create.indexes,
    indexStatus: { status: 'ready' },
  };
  const mockDetail = (info = detail) =>
    request.mockResolvedValueOnce({ data: { code: 0, collection: info } });

  it('nests query options, preserves projection and does not interpret returned count as total', async () => {
    request.mockResolvedValueOnce({
      data: { code: 0, count: 1, documents: [{ id: 'a', text: 'alpha' }] },
    });
    const result = await service.queryDocuments({
      ...target,
      limit: 20,
      offset: 40,
      filter: 'text = "alpha"',
      outputFields: ['id', 'text'],
      retrieveVector: false,
      readConsistency: 'strongConsistency',
    });
    expect(result).toEqual({
      count: 1,
      documents: [{ id: 'a', text: 'alpha' }],
    });
    expect(request.mock.calls[1][0]).toMatchObject({
      url: 'http://vector.example/document/query',
      data: {
        database: target.database,
        collection: target.collection,
        readConsistency: 'strongConsistency',
        query: {
          limit: 20,
          offset: 40,
          filter: 'text = "alpha"',
          outputFields: ['id', 'text'],
          retrieveVector: false,
        },
      },
    });
    expect(request.mock.calls[1][0].data).not.toHaveProperty('clientId');
  });

  it('rejects misaligned query pages before contacting upstream', async () => {
    await expect(
      service.queryDocuments({ ...target, limit: 20, offset: 1 })
    ).rejects.toMatchObject({ status: 400 });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('preserves complete documents and only forwards whitelisted upsert options', async () => {
    mockDetail();
    const documents = [
      { id: 'a', vector, text: 'alpha', metadata: { tag: 'kept' } },
    ];
    await service.upsertDocuments({
      ...target,
      documents,
      buildIndex: false,
      apiKey: 'not-forwarded',
    } as any);
    expect(request.mock.calls[2][0]).toMatchObject({
      url: 'http://vector.example/document/upsert',
      data: {
        database: target.database,
        collection: target.collection,
        documents,
        buildIndex: false,
      },
    });
    expect(request.mock.calls[2][0].data).not.toHaveProperty('apiKey');
  });

  it.each([
    ['dimension mismatch', [{ id: 'a', vector: [1, 2] }]],
    ['missing vector', [{ id: 'a', text: 'alpha' }]],
    [
      'duplicate IDs',
      [
        { id: 'a', vector },
        { id: 'a', vector },
      ],
    ],
    ['invalid document', [null]],
  ])('rejects %s without writing documents', async (_, documents) => {
    mockDetail();
    await expect(
      service.upsertDocuments({ ...target, documents, buildIndex: true } as any)
    ).rejects.toMatchObject({ status: 400 });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('requires an initial IVF index to be populated without buildIndex', async () => {
    mockDetail({
      ...detail,
      indexes: [
        { ...create.indexes[1], indexType: 'IVF_FLAT', params: { nlist: 16 } },
      ],
      indexStatus: { status: 'initial' },
    });
    await expect(
      service.upsertDocuments({
        ...target,
        documents: [{ id: 'a', vector }],
        buildIndex: true,
      })
    ).rejects.toMatchObject({ status: 400 });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('preserves search result groups, scores and vendor order', async () => {
    mockDetail();
    const documents = [
      [
        { id: 'b', score: 0.2 },
        { id: 'a', score: 0.9 },
      ],
      [{ id: 'c', score: 0 }],
    ];
    request.mockResolvedValueOnce({ data: { code: 0, documents } });
    expect(
      await service.searchDocuments({
        ...target,
        vectors: [vector, vector],
        ef: 200,
        limit: 5,
        outputFields: [],
      })
    ).toEqual({ documents });
    expect(request.mock.calls[2][0]).toMatchObject({
      url: 'http://vector.example/document/search',
      data: {
        database: target.database,
        collection: target.collection,
        search: {
          vectors: [vector, vector],
          limit: 5,
          params: { ef: 200 },
          outputFields: undefined,
        },
      },
    });
  });

  it.each([
    {},
    { vectors: [vector], documentIds: ['a'] },
    { vectors: [vector], embeddingItems: ['text'] },
  ])('requires exactly one search input type: %j', async input => {
    await expect(
      service.searchDocuments({ ...target, limit: 10, ...input })
    ).rejects.toMatchObject({ status: 400 });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it.each([
    { vectors: [[1]] },
    { embeddingItems: ['alpha'] },
    { documentIds: ['a'], nprobe: 2 },
  ])(
    'rejects search inputs inconsistent with collection metadata: %j',
    async input => {
      mockDetail();
      await expect(
        service.searchDocuments({ ...target, limit: 10, ...input })
      ).rejects.toMatchObject({ status: 400 });
      expect(request).toHaveBeenCalledTimes(2);
    }
  );

  it('checks binary vector byte length and values', () => {
    const index = {
      ...create.indexes[1],
      fieldType: 'binary_vector',
      dimension: 16,
    };
    expect(() => validateVector([0, 255], index)).not.toThrow();
    expect(() => validateVector([0, 256], index)).toThrow();
    expect(() => validateVector([0], index)).toThrow();
    expect(() => validateVector([0, 1.5], index)).toThrow();
  });

  it.each(
    [undefined, [], ['a', 'a'], [''], [12]].map(documentIds => ({
      documentIds,
    }))
  )(
    'rejects unsafe delete selection %j before sending a mutation',
    async ({ documentIds }) => {
      await expect(
        service.deleteDocuments({ ...target, documentIds } as any)
      ).rejects.toMatchObject({ status: 400 });
      expect(request).toHaveBeenCalledTimes(1);
    }
  );

  it('deletes only the selected IDs even when an extra filter is supplied', async () => {
    await service.deleteDocuments({
      ...target,
      documentIds: ['a'],
      filter: 'id != ""',
    } as any);
    expect(request.mock.calls[1][0].data).toEqual({
      database: target.database,
      collection: target.collection,
      query: { documentIds: ['a'] },
    });
  });

  it('forwards filtered count separately from query pagination', async () => {
    request.mockResolvedValueOnce({ data: { code: 0, count: 42 } });
    expect(
      await service.countDocuments({ ...target, filter: 'text = "alpha"' })
    ).toEqual({ count: 42 });
    expect(request.mock.calls[1][0].data).toEqual({
      database: target.database,
      collection: target.collection,
      query: { filter: 'text = "alpha"' },
    });
  });

  it('validates malformed document request DTOs before dispatch', async () => {
    const cases: Array<[new () => object, object, string[]]> = [
      [
        TencentVectorDbQueryDto,
        { limit: 0, offset: -1, documentIds: [], retrieveVector: 'yes' },
        ['documentIds', 'limit', 'offset', 'retrieveVector'],
      ],
      [
        TencentVectorDbSearchDto,
        { limit: 5, vectors: [], ef: 0, readConsistency: 'unknown' },
        ['ef', 'readConsistency', 'vectors'],
      ],
      [
        TencentVectorDbUpsertDto,
        { documents: [], buildIndex: 'true' },
        ['buildIndex', 'documents'],
      ],
      [TencentVectorDbDeleteDocumentsDto, { documentIds: [] }, ['documentIds']],
    ];
    for (const [dto, input, fields] of cases) {
      const errors = await validate(
        plainToInstance(dto, { ...target, ...input })
      );
      expect(errors.map(e => e.property).sort()).toEqual(fields);
    }
  });
});
