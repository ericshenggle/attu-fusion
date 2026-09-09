import axios, { AxiosError } from 'axios';

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

type DatabaseListResponse = {
  code?: number;
  msg?: string;
  databases?: string[];
};

export class TencentVectorDbService {
  async testConnection(
    request: TencentVectorDbTestRequest
  ): Promise<TencentVectorDbTestResponse> {
    const endpoint = request.endpoint.trim().replace(/\/$/, '');
    if (!/^https?:\/\/[^\s]+$/i.test(endpoint)) {
      throw new Error('TCVectordb endpoint must be a valid http or https URL.');
    }
    if (!request.account.trim() || !request.apiKey.trim()) {
      throw new Error('TCVectordb account and API key are required.');
    }

    const authorization = `Bearer account=${request.account.trim()}&api_key=${request.apiKey.trim()}`;
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
}
