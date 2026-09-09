export {
  KeyValuePair,
  ShowCollectionsType,
  MilvusClient,
  ResStatus,
  RerankerObj,
  TypeParamKey,
  TypeParam,
  QueryResults,
  SearchResultData,
  MutationResult,
} from '@zilliz/milvus2-sdk-node';

export * from './collections.type';
export * from './partitions.type';
export * from './users.type';

export type AuthReq = {
  provider?: 'milvus' | 'tcvectordb';
  username: string;
  password: string;
  address: string;
  token: string;
  apiKey?: string;
  ssl: boolean;
  database: string;
  checkHealth: boolean;
  clientId: string;
};

export type AuthObject = {
  provider: 'milvus' | 'tcvectordb';
  clientId: string;
  database: string;
};
