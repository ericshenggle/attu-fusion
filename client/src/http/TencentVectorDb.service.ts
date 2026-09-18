import BaseModel from './BaseModel';
import type { AuthObject, DatabaseObject } from '@server/types';
import type {
  ProviderConnectRequest,
  ProviderConnectionRequest,
  ProviderConnectionResult,
  ProviderCollection,
  ProviderCollectionTarget,
  ProviderCreateCollectionRequest,
  ProviderDatabase,
  ProviderMutationResponse,
  ProviderQueryDocumentsRequest,
  ProviderQueryDocumentsResult,
  ProviderUpsertDocumentsRequest,
  ProviderSearchDocumentsRequest,
  ProviderSearchDocumentsResult,
  ProviderDeleteDocumentsRequest,
  ProviderCountDocumentsRequest,
  ProviderUser,
} from '@server/providers/types';

export type TencentVectorDbCollection = ProviderCollection;
export type TencentVectorDbCreateCollection = Omit<
  ProviderCreateCollectionRequest,
  'clientId'
>;
type CollectionTarget = Omit<ProviderCollectionTarget, 'clientId'>;

export class TencentVectorDbService extends BaseModel {
  static connect(data: ProviderConnectRequest) {
    return super.create<AuthObject>({ path: '/tcvectordb/connect', data });
  }

  static testConnection(data: ProviderConnectionRequest) {
    return super.create<ProviderConnectionResult>({
      path: '/tcvectordb/test',
      data,
    });
  }

  static disconnect() {
    return super.create({ path: '/tcvectordb/disconnect' });
  }

  static async listDatabases(): Promise<DatabaseObject[]> {
    const databases = await super.find<ProviderDatabase[]>({
      path: '/tcvectordb/databases',
    });
    return databases.map(db => ({
      name: db.name,
      db_name: db.name,
      dbID: db.name,
      createdTime: -1,
      created_timestamp: -1,
      properties: [],
      collections: [],
      collectionCount: db.collectionCount,
    }));
  }

  static async listCollections(database: string) {
    const response = await super.create<{ collections: ProviderCollection[] }>({
      path: '/tcvectordb/collections/list',
      data: { database },
    });
    return response.collections;
  }

  static describeCollection(data: CollectionTarget) {
    return super.create<ProviderCollection>({
      path: '/tcvectordb/collections/describe',
      data,
    });
  }

  static createCollection(data: TencentVectorDbCreateCollection) {
    return super.create<ProviderMutationResponse>({
      path: '/tcvectordb/collections/create',
      data,
    });
  }

  static dropCollection(data: CollectionTarget) {
    return super.create<ProviderMutationResponse>({
      path: '/tcvectordb/collections/drop',
      data,
    });
  }

  static queryDocuments(data: Omit<ProviderQueryDocumentsRequest, 'clientId'>) {
    return super.create<ProviderQueryDocumentsResult>({
      path: '/tcvectordb/documents/query',
      data,
    });
  }
  static upsertDocuments(
    data: Omit<ProviderUpsertDocumentsRequest, 'clientId'>
  ) {
    return super.create<ProviderMutationResponse>({
      path: '/tcvectordb/documents/upsert',
      data,
    });
  }
  static importDocuments(data: {
    database: string;
    collection: string;
    file: File;
    buildIndex: boolean;
  }) {
    return super.create<ProviderMutationResponse>({
      path: '/tcvectordb/documents/import',
      data: data.file,
      config: {
        params: {
          database: data.database,
          collection: data.collection,
          buildIndex: String(data.buildIndex),
        },
        headers: { 'Content-Type': 'application/octet-stream' },
      },
    });
  }
  static searchDocuments(
    data: Omit<ProviderSearchDocumentsRequest, 'clientId'>
  ) {
    return super.create<ProviderSearchDocumentsResult>({
      path: '/tcvectordb/documents/search',
      data,
    });
  }
  static deleteDocuments(
    data: Omit<ProviderDeleteDocumentsRequest, 'clientId'>
  ) {
    return super.create<ProviderMutationResponse>({
      path: '/tcvectordb/documents/delete',
      data,
    });
  }
  static countDocuments(data: Omit<ProviderCountDocumentsRequest, 'clientId'>) {
    return super.create<{ count: number }>({
      path: '/tcvectordb/documents/count',
      data,
    });
  }
  static createDatabase(data: { database: string }) {
    return super.create<ProviderMutationResponse>({
      path: '/tcvectordb/databases/create',
      data,
    });
  }
  static dropDatabase(data: { database: string }) {
    return super.create<ProviderMutationResponse>({
      path: '/tcvectordb/databases/drop',
      data,
    });
  }
  static setAlias(data: {
    database: string;
    collection: string;
    alias: string;
  }) {
    return super.create<ProviderMutationResponse>({
      path: '/tcvectordb/aliases/set',
      data,
    });
  }
  static deleteAlias(data: { database: string; alias: string }) {
    return super.create<ProviderMutationResponse>({
      path: '/tcvectordb/aliases/delete',
      data,
    });
  }
  static rebuildIndex(data: {
    database: string;
    collection: string;
    fieldName: string;
    dropBeforeRebuild?: boolean;
    throttle?: number;
  }) {
    return super.create<ProviderMutationResponse>({
      path: '/tcvectordb/indexes/rebuild',
      data,
    });
  }
  static dropIndex(data: {
    database: string;
    collection: string;
    fieldNames: string[];
  }) {
    return super.create<ProviderMutationResponse>({
      path: '/tcvectordb/indexes/drop',
      data,
    });
  }
  static hybridSearch(data: {
    database: string;
    collection: string;
    search: Record<string, unknown>;
    readConsistency?: string;
  }) {
    return super.create<ProviderSearchDocumentsResult>({
      path: '/tcvectordb/documents/hybrid-search',
      data,
    });
  }
  static fullTextSearch(data: {
    database: string;
    collection: string;
    search: Record<string, unknown>;
    readConsistency?: string;
  }) {
    return super.create<ProviderSearchDocumentsResult>({
      path: '/tcvectordb/documents/full-text-search',
      data,
    });
  }
  static listUsers() {
    return super.create<{ users: ProviderUser[] }>({
      path: '/tcvectordb/users/list',
      data: {},
    });
  }
  static createUser(data: { user: string; password: string }) {
    return super.create<ProviderMutationResponse>({
      path: '/tcvectordb/users/create',
      data,
    });
  }
  static dropUser(data: { user: string }) {
    return super.create<ProviderMutationResponse>({
      path: '/tcvectordb/users/drop',
      data,
    });
  }
  static describeUser(data: { user: string }) {
    return super.create<ProviderUser>({
      path: '/tcvectordb/users/describe',
      data,
    });
  }
  static grantUser(data: {
    user: string;
    privileges: Array<{ resource: string; actions: string[] }>;
  }) {
    return super.create<ProviderMutationResponse>({
      path: '/tcvectordb/users/grant',
      data,
    });
  }
  static revokeUser(data: {
    user: string;
    privileges: Array<{ resource: string; actions: string[] }>;
  }) {
    return super.create<ProviderMutationResponse>({
      path: '/tcvectordb/users/revoke',
      data,
    });
  }
  static changeUserPassword(data: { user: string; password: string }) {
    return super.create<ProviderMutationResponse>({
      path: '/tcvectordb/users/change-password',
      data,
    });
  }
}
