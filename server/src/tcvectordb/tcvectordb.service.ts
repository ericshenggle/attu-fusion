import axios, { AxiosError } from 'axios';
import {
  ProviderCollection,
  ProviderConnectionResult,
  ProviderMutationResponse,
  VectorDbProvider,
} from '../providers/types';
import { AuthObject } from '../types';

export type TencentVectorDbTestRequest = {
  endpoint: string;
  account: string;
  apiKey: string;
};

export type TencentVectorDbTestResponse = ProviderConnectionResult;

export type TencentVectorDbCollection = ProviderCollection;

export type TencentVectorDbCollectionRequest = TencentVectorDbTestRequest & {
  database: string;
};

export type TencentVectorDbConnectRequest = TencentVectorDbCollectionRequest & {
  clientId: string;
};

export type TencentVectorDbCreateCollectionRequest =
  TencentVectorDbCollectionRequest & {
    collection: string;
  };

type DatabaseListResponse = {
  code?: number;
  msg?: string;
  databases?: string[];
};

type CollectionListResponse = {
  code?: number;
  msg?: string;
  collections?: TencentVectorDbCollection[];
};

export class TencentVectorDbService implements VectorDbProvider {
  readonly name = 'tcvectordb' as const;

  private getAuthorization(account: string, apiKey: string) {
    return `Bearer account=${account.trim()}&api_key=${apiKey.trim()}`;
  }

  async testConnection(
    request: TencentVectorDbTestRequest
  ): Promise<TencentVectorDbTestResponse> {
    const endpoint = this.validateConnection(request);

    const authorization = this.getAuthorization(request.account, request.apiKey);
    try {
      const response = await axios.get<DatabaseListResponse>(
        `${endpoint}/database/list`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: authorization,
          },
          timeout: 15000,
        }
      );
      const body = response.data || {};
      if (body.code !== 0) {
        throw new Error(body.msg || 'TCVectordb returned an unsuccessful response.');
      }
      return {
        provider: 'tcvectordb',
        endpoint,
        databases: body.databases || [],
      };
    } catch (error) {
      const axiosError = error as AxiosError<DatabaseListResponse>;
      const responseBody = axiosError.response?.data;
      const message = responseBody?.msg || axiosError.message;
      throw new Error(`TCVectordb connection failed: ${message}`);
    }
  }

  async listCollections(
    request: TencentVectorDbCollectionRequest
  ): Promise<TencentVectorDbCollection[]> {
    return this.post<TencentVectorDbCollectionRequest, CollectionListResponse>(
      request,
      '/collection/list',
      { database: request.database }
    ).then(body => body.collections || []);
  }

  async connect(request: TencentVectorDbConnectRequest): Promise<AuthObject> {
    const response = await this.testConnection(request);
    const database = request.database.trim() || response.databases[0] || 'default';
    if (response.databases.length > 0 && !response.databases.includes(database)) {
      throw new Error(`TCVectordb database does not exist: ${database}.`);
    }
    return { provider: this.name, clientId: request.clientId, database };
  }

  async createCollection(
    request: TencentVectorDbCreateCollectionRequest
  ): Promise<ProviderMutationResponse> {
    return this.post<TencentVectorDbCreateCollectionRequest, ProviderMutationResponse>(
      request,
      '/collection/create',
      {
        database: request.database,
        collection: request.collection,
        replicaNum: 1,
        shardNum: 1,
        description: 'Attu TCVectordb integration test collection',
        indexes: [
          { fieldName: 'id', fieldType: 'string', indexType: 'primaryKey' },
          {
            fieldName: 'vector',
            fieldType: 'vector',
            indexType: 'HNSW',
            dimension: 4,
            metricType: 'COSINE',
            params: { M: 16, efConstruction: 200 },
          },
          { fieldName: 'text', fieldType: 'string', indexType: 'filter' },
        ],
      }
    );
  }

  private async post<T extends TencentVectorDbTestRequest, R>(
    request: T,
    path: string,
    data: Record<string, unknown>
  ): Promise<R> {
    const endpoint = this.validateConnection(request);
    try {
      const response = await axios.post<R>(`${endpoint}${path}`, data, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.getAuthorization(request.account, request.apiKey),
        },
        timeout: 15000,
      });
      const body = response.data;
      if ((body as { code?: number }).code !== 0) {
        throw new Error((body as { msg?: string }).msg || 'TCVectordb request failed.');
      }
      return body;
    } catch (error) {
      const axiosError = error as AxiosError<{ msg?: string }>;
      const responseBody = axiosError.response?.data;
      const message = responseBody?.msg || axiosError.message;
      if (!axiosError.isAxiosError && error instanceof Error) {
        throw error;
      }
      throw new Error(`TCVectordb request failed: ${message}`);
    }
  }

  private validateConnection(request: TencentVectorDbTestRequest) {
    const endpoint = request.endpoint.trim().replace(/\/$/, '');
    if (!/^https?:\/\/[^\s]+$/i.test(endpoint)) {
      throw new Error('TCVectordb endpoint must be a valid http or https URL.');
    }
    if (!request.account.trim() || !request.apiKey.trim()) {
      throw new Error('TCVectordb account and API key are required.');
    }
    return endpoint;
  }
}
