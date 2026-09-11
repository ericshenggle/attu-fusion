export type VectorDbProviderName = 'milvus' | 'tcvectordb';

export type ProviderConnectionRequest = {
  endpoint: string;
  account: string;
  apiKey: string;
};

export type ProviderConnectionResult = {
  provider: VectorDbProviderName;
  endpoint: string;
  databases: string[];
};

export type ProviderConnectRequest = ProviderConnectionRequest & {
  database?: string;
  clientId: string;
};

export type ProviderCollectionRequest = {
  clientId: string;
  database: string;
};

export type ProviderCollectionTarget = ProviderCollectionRequest & {
  collection: string;
};

export type ProviderDatabase = {
  name: string;
  type?: string;
  collectionCount?: number;
  createTime?: string;
};

export type ProviderIndex = {
  fieldName: string;
  fieldType: string;
  indexType: string;
  dimension?: number;
  metricType?: string;
  params?: Record<string, number>;
  indexedCount?: number;
};

export type ProviderCollection = {
  database: string;
  collection: string;
  documentCount?: number;
  shardNum?: number;
  replicaNum?: number;
  createTime?: string;
  description?: string;
  indexes?: ProviderIndex[];
  indexStatus?: { status: string; startTime?: string };
  alias?: string[];
  embedding?: {
    field?: string;
    vectorField?: string;
    model?: string;
    status?: string;
  };
};

export type ProviderCreateCollectionRequest = ProviderCollectionTarget & {
  shardNum: number;
  replicaNum: number;
  description?: string;
  indexes: ProviderIndex[];
};

export type ProviderMutationResponse = {
  code?: number;
  msg?: string;
  affectedCount?: number;
};

export type ProviderDocument = {
  id: string;
  vector?: number[];
  [field: string]: unknown;
};
export type ProviderReadConsistency =
  'strongConsistency' | 'eventualConsistency';
export type ProviderQueryDocumentsRequest = ProviderCollectionTarget & {
  documentIds?: string[];
  filter?: string;
  limit: number;
  offset: number;
  outputFields?: string[];
  retrieveVector?: boolean;
  readConsistency?: ProviderReadConsistency;
};
export type ProviderQueryDocumentsResult = {
  documents: ProviderDocument[];
  count: number;
};
export type ProviderUpsertDocumentsRequest = ProviderCollectionTarget & {
  documents: ProviderDocument[];
  buildIndex: boolean;
};
export type ProviderSearchDocumentsRequest = ProviderCollectionTarget & {
  vectors?: number[][];
  documentIds?: string[];
  embeddingItems?: string[];
  filter?: string;
  limit: number;
  ef?: number;
  nprobe?: number;
  outputFields?: string[];
  retrieveVector?: boolean;
  readConsistency?: ProviderReadConsistency;
};
export type ProviderSearchDocumentsResult = {
  documents: Array<Array<ProviderDocument & { score?: number }>>;
};
export type ProviderDeleteDocumentsRequest = ProviderCollectionTarget & {
  documentIds: string[];
};
export type ProviderCountDocumentsRequest = ProviderCollectionTarget & {
  filter?: string;
};
export type ProviderDatabaseMutationRequest = {
  clientId: string;
  database: string;
};
export type ProviderAliasRequest = ProviderCollectionTarget & { alias: string };
export type ProviderAliasDeleteRequest = {
  clientId: string;
  database: string;
  alias: string;
};
export type ProviderIndexRebuildRequest = ProviderCollectionTarget & {
  fieldName: string;
  dropBeforeRebuild?: boolean;
  throttle?: number;
};
export type ProviderIndexDropRequest = ProviderCollectionTarget & {
  fieldNames: string[];
};
export type ProviderUser = {
  user: string;
  createTime?: string;
  privileges?: Array<{ resource: string; actions: string[] }>;
};
export type ProviderUserRequest = { clientId: string; user: string };
export type ProviderUserCreateRequest = ProviderUserRequest & {
  password: string;
};
export type ProviderUserPrivilegesRequest = ProviderUserRequest & {
  privileges: Array<{ resource: string; actions: string[] }>;
};
export type ProviderUserListResult = { users: ProviderUser[] };
export type ProviderHybridSearchRequest = ProviderCollectionTarget & {
  search: Record<string, unknown>;
  readConsistency?: ProviderReadConsistency;
};
export type ProviderFullTextSearchRequest = ProviderCollectionTarget & {
  search: Record<string, unknown>;
  readConsistency?: ProviderReadConsistency;
};

export interface VectorDbProvider {
  readonly name: VectorDbProviderName;
  testConnection(
    request: ProviderConnectionRequest
  ): Promise<ProviderConnectionResult>;
  connect(request: ProviderConnectRequest): Promise<{
    provider: VectorDbProviderName;
    clientId: string;
    database: string;
  }>;
  disconnect(clientId: string): void;
  hasSession(clientId: string): boolean;
  listDatabases(clientId: string): Promise<ProviderDatabase[]>;
  listCollections(
    request: ProviderCollectionRequest
  ): Promise<ProviderCollection[]>;
  describeCollection(
    request: ProviderCollectionTarget
  ): Promise<ProviderCollection>;
  createCollection(
    request: ProviderCreateCollectionRequest
  ): Promise<ProviderMutationResponse>;
  dropCollection(
    request: ProviderCollectionTarget
  ): Promise<ProviderMutationResponse>;
  queryDocuments(
    request: ProviderQueryDocumentsRequest
  ): Promise<ProviderQueryDocumentsResult>;
  upsertDocuments(
    request: ProviderUpsertDocumentsRequest
  ): Promise<ProviderMutationResponse>;
  searchDocuments(
    request: ProviderSearchDocumentsRequest
  ): Promise<ProviderSearchDocumentsResult>;
  deleteDocuments(
    request: ProviderDeleteDocumentsRequest
  ): Promise<ProviderMutationResponse>;
  countDocuments(
    request: ProviderCountDocumentsRequest
  ): Promise<{ count: number }>;
  createDatabase(
    request: ProviderDatabaseMutationRequest
  ): Promise<ProviderMutationResponse>;
  dropDatabase(
    request: ProviderDatabaseMutationRequest
  ): Promise<ProviderMutationResponse>;
  setAlias(request: ProviderAliasRequest): Promise<ProviderMutationResponse>;
  deleteAlias(
    request: ProviderAliasDeleteRequest
  ): Promise<ProviderMutationResponse>;
  rebuildIndex(
    request: ProviderIndexRebuildRequest
  ): Promise<ProviderMutationResponse>;
  dropIndex(
    request: ProviderIndexDropRequest
  ): Promise<ProviderMutationResponse>;
  hybridSearch(
    request: ProviderHybridSearchRequest
  ): Promise<ProviderSearchDocumentsResult>;
  fullTextSearch(
    request: ProviderFullTextSearchRequest
  ): Promise<ProviderSearchDocumentsResult>;
  listUsers(clientId: string): Promise<ProviderUserListResult>;
  createUser(
    request: ProviderUserCreateRequest
  ): Promise<ProviderMutationResponse>;
  dropUser(request: ProviderUserRequest): Promise<ProviderMutationResponse>;
  grantUserPrivileges(
    request: ProviderUserPrivilegesRequest
  ): Promise<ProviderMutationResponse>;
  revokeUserPrivileges(
    request: ProviderUserPrivilegesRequest
  ): Promise<ProviderMutationResponse>;
  describeUser(request: ProviderUserRequest): Promise<ProviderUser>;
  changeUserPassword(
    request: ProviderUserCreateRequest
  ): Promise<ProviderMutationResponse>;
}
