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

export class TencentVectorDbService extends BaseModel {
  static testConnection(data: TencentVectorDbTestRequest) {
    return super.create<TencentVectorDbTestResponse>({
      path: '/tcvectordb/test',
      data,
    });
  }
}
