import BaseModel from './BaseModel';

export type TencentVectorDbTestRequest = {
  endpoint: string;
  account: string;
  apiKey: string;
};

export type TencentVectorDbTestResponse = {
  provider: 'tcvectordb';
  endpoint: string;
  databases: string[];
};

export type TencentVectorDbCollection = {
  database: string;
  collection: string;
  documentCount?: number;
};

export type TencentVectorDbCollectionRequest = TencentVectorDbTestRequest & {
  database: string;
};

export class TencentVectorDbService extends BaseModel {
  static testConnection(data: TencentVectorDbTestRequest) {
    return super.create<TencentVectorDbTestResponse>({
      path: '/tcvectordb/test',
      data,
    });
  }

  static listCollections(data: TencentVectorDbCollectionRequest) {
    return super.create<{ collections: TencentVectorDbCollection[] }>({
      path: '/tcvectordb/collections/list',
      data,
    }).then(response => response.collections || []);
  }

  static createDemoCollection(data: TencentVectorDbCollectionRequest) {
    return super.create({
      path: '/tcvectordb/collections/create',
      data: { ...data, collection: 'attu_demo' },
    });
  }
}
