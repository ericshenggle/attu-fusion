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

export type ProviderCollectionRequest = ProviderConnectionRequest & {
  database: string;
};

export type ProviderConnectRequest = ProviderCollectionRequest & {
  clientId: string;
};

export type ProviderCollection = {
  database: string;
  collection: string;
  documentCount?: number;
  shardNum?: number;
  replicaNum?: number;
};

export type ProviderCreateCollectionRequest = ProviderCollectionRequest & {
  collection: string;
};

export type ProviderMutationResponse = {
  code?: number;
  msg?: string;
  affectedCount?: number;
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
  listCollections(request: ProviderCollectionRequest): Promise<ProviderCollection[]>;
  createCollection(
    request: ProviderCreateCollectionRequest
  ): Promise<ProviderMutationResponse>;
}
