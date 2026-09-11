import axios from 'axios';
import HttpErrors from 'http-errors';
import { LRUCache } from 'lru-cache';
import {
  ProviderCollection,
  ProviderCollectionRequest,
  ProviderCollectionTarget,
  ProviderConnectRequest,
  ProviderConnectionRequest,
  ProviderConnectionResult,
  ProviderCreateCollectionRequest,
  ProviderDatabase,
  ProviderMutationResponse,
  VectorDbProvider,
  ProviderQueryDocumentsRequest,
  ProviderQueryDocumentsResult,
  ProviderUpsertDocumentsRequest,
  ProviderSearchDocumentsRequest,
  ProviderSearchDocumentsResult,
  ProviderDeleteDocumentsRequest,
  ProviderCountDocumentsRequest,
  ProviderDatabaseMutationRequest,
  ProviderAliasRequest,
  ProviderAliasDeleteRequest,
  ProviderIndexRebuildRequest,
  ProviderIndexDropRequest,
  ProviderHybridSearchRequest,
  ProviderFullTextSearchRequest,
  ProviderUserCreateRequest,
  ProviderUserRequest,
  ProviderUserPrivilegesRequest,
  ProviderUser,
  ProviderUserListResult,
} from '../providers/types';
import { CLIENT_TTL } from '../utils/Const';
import { validateCollectionIndexes } from './validation';
import {
  denseVectorIndex,
  validateVector,
  validateDocuments,
  validateDocumentIds,
} from './documents.validation';

type DatabaseListResponse = {
  databases?: string[];
  info?: Record<
    string,
    { createTime?: string; dbType?: string; count?: number }
  >;
};

export class TencentVectorDbService implements VectorDbProvider {
  readonly name = 'tcvectordb' as const;
  private readonly sessions = new LRUCache<string, ProviderConnectionRequest>({
    max: 1000,
    ttl: CLIENT_TTL,
    updateAgeOnGet: true,
  });

  async testConnection(
    request: ProviderConnectionRequest
  ): Promise<ProviderConnectionResult> {
    const endpoint = this.validateConnection(request);
    const response = await this.request<DatabaseListResponse>(
      request,
      '/database/list',
      'GET'
    );
    return {
      provider: this.name,
      endpoint,
      databases: response.databases || [],
    };
  }

  async connect(request: ProviderConnectRequest) {
    const endpoint = this.validateConnection(request);
    const response = await this.request<DatabaseListResponse>(
      request,
      '/database/list',
      'GET'
    );
    const database =
      request.database?.trim() ||
      (response.databases || []).find(
        name => response.info?.[name]?.dbType !== 'AI_DB'
      ) ||
      '';
    if (!database) {
      throw HttpErrors(400, 'TCVectordb has no Base databases available.');
    }
    if (!response.databases?.includes(database)) {
      throw HttpErrors(400, `TCVectordb database does not exist: ${database}.`);
    }
    if (response.info?.[database]?.dbType === 'AI_DB') {
      throw HttpErrors(
        400,
        'AI databases are not supported yet. Select a Base database.'
      );
    }
    this.sessions.set(request.clientId, {
      endpoint,
      account: request.account.trim(),
      apiKey: request.apiKey.trim(),
    });
    return { provider: this.name, clientId: request.clientId, database };
  }

  hasSession(clientId: string) {
    return !!this.sessions.get(clientId);
  }
  disconnect(clientId: string) {
    this.sessions.delete(clientId);
  }

  private getSession(clientId: string) {
    const session = this.sessions.get(clientId);
    if (!session)
      throw HttpErrors(401, 'TCVectordb connection expired, please reconnect.');
    return session;
  }

  async listDatabases(clientId: string): Promise<ProviderDatabase[]> {
    const body = await this.request<DatabaseListResponse>(
      this.getSession(clientId),
      '/database/list',
      'GET'
    );
    return (body.databases || [])
      .filter(name => body.info?.[name]?.dbType !== 'AI_DB')
      .map(name => ({
        name,
        type: body.info?.[name]?.dbType,
        createTime: body.info?.[name]?.createTime,
        collectionCount: body.info?.[name]?.count,
      }));
  }

  async listCollections(
    request: ProviderCollectionRequest
  ): Promise<ProviderCollection[]> {
    const body = await this.request<{ collections?: ProviderCollection[] }>(
      this.getSession(request.clientId),
      '/collection/list',
      'POST',
      { database: request.database }
    );
    return body.collections || [];
  }

  async describeCollection(
    request: ProviderCollectionTarget
  ): Promise<ProviderCollection> {
    const body = await this.request<{ collection?: ProviderCollection }>(
      this.getSession(request.clientId),
      '/collection/describe',
      'POST',
      { database: request.database, collection: request.collection }
    );
    if (!body.collection)
      throw HttpErrors(502, 'TCVectordb returned no collection details.');
    return body.collection;
  }

  async createCollection(
    request: ProviderCreateCollectionRequest
  ): Promise<ProviderMutationResponse> {
    const session = this.getSession(request.clientId);
    const indexes = validateCollectionIndexes(request.indexes);
    const { database, collection, shardNum, replicaNum, description } = request;
    return this.request(session, '/collection/create', 'POST', {
      database,
      collection,
      shardNum,
      replicaNum,
      indexes,
      ...(description ? { description } : {}),
    });
  }

  async dropCollection(
    request: ProviderCollectionTarget
  ): Promise<ProviderMutationResponse> {
    return this.request(
      this.getSession(request.clientId),
      '/collection/drop',
      'POST',
      {
        database: request.database,
        collection: request.collection,
      }
    );
  }

  async queryDocuments(
    request: ProviderQueryDocumentsRequest
  ): Promise<ProviderQueryDocumentsResult> {
    const session = this.getSession(request.clientId);
    const {
      database,
      collection,
      readConsistency,
      limit,
      offset,
      documentIds,
      filter,
      retrieveVector,
      outputFields,
    } = request;
    if (offset % limit !== 0)
      throw HttpErrors(400, 'offset must be a multiple of limit.');
    if (documentIds !== undefined) validateDocumentIds(documentIds, 20);
    const body = await this.request<ProviderQueryDocumentsResult>(
      session,
      '/document/query',
      'POST',
      {
        database,
        collection,
        readConsistency,
        query: {
          limit,
          offset,
          documentIds,
          filter,
          retrieveVector,
          outputFields: outputFields?.length ? outputFields : undefined,
        },
      }
    );
    if (!Array.isArray(body.documents))
      throw HttpErrors(502, 'TCVectordb returned invalid query results.');
    return {
      documents: body.documents,
      count: body.count ?? body.documents.length,
    };
  }

  async upsertDocuments(
    request: ProviderUpsertDocumentsRequest
  ): Promise<ProviderMutationResponse> {
    const session = this.getSession(request.clientId);
    const info = await this.describeCollection(request);
    validateDocuments(request.documents, info);
    const index = denseVectorIndex(info);
    if (
      index.indexType.startsWith('IVF') &&
      request.buildIndex &&
      info.indexStatus?.status === 'initial'
    ) {
      throw HttpErrors(
        400,
        'An initial IVF index requires buildIndex=false and an index rebuild after insertion.'
      );
    }
    return this.request(session, '/document/upsert', 'POST', {
      database: request.database,
      collection: request.collection,
      documents: request.documents,
      buildIndex: request.buildIndex,
    });
  }

  async searchDocuments(
    request: ProviderSearchDocumentsRequest
  ): Promise<ProviderSearchDocumentsResult> {
    const session = this.getSession(request.clientId);
    const { vectors, documentIds, embeddingItems } = request;
    if (
      [vectors, documentIds, embeddingItems].filter(
        value => value !== undefined
      ).length !== 1
    ) {
      throw HttpErrors(
        400,
        'Specify exactly one of vectors, documentIds or embeddingItems.'
      );
    }
    if (documentIds !== undefined) validateDocumentIds(documentIds, 20);
    const info = await this.describeCollection(request);
    const index = denseVectorIndex(info);
    if (vectors !== undefined) {
      if (!Array.isArray(vectors) || vectors.length < 1 || vectors.length > 20)
        throw HttpErrors(400, 'Provide 1-20 vectors.');
      vectors.forEach(vector => validateVector(vector, index));
    }
    if (embeddingItems !== undefined && info.embedding?.status !== 'enabled') {
      throw HttpErrors(
        400,
        'Text search requires an embedding-enabled collection.'
      );
    }
    if (
      embeddingItems !== undefined &&
      (!Array.isArray(embeddingItems) ||
        embeddingItems.length < 1 ||
        embeddingItems.length > 20 ||
        embeddingItems.some(item => typeof item !== 'string' || !item.trim()))
    ) {
      throw HttpErrors(400, 'Provide 1-20 non-empty text inputs.');
    }
    if (
      (request.ef !== undefined && index.indexType !== 'HNSW') ||
      (request.nprobe !== undefined && !index.indexType.startsWith('IVF'))
    ) {
      throw HttpErrors(
        400,
        'Search parameters do not match the collection index.'
      );
    }
    if (request.nprobe !== undefined && request.nprobe > index.params?.nlist) {
      throw HttpErrors(400, 'nprobe must not exceed the index nlist.');
    }
    const body = await this.request<ProviderSearchDocumentsResult>(
      session,
      '/document/search',
      'POST',
      {
        database: request.database,
        collection: request.collection,
        readConsistency: request.readConsistency,
        search: {
          vectors,
          documentIds,
          embeddingItems,
          filter: request.filter,
          limit: request.limit,
          retrieveVector: request.retrieveVector,
          outputFields: request.outputFields?.length
            ? request.outputFields
            : undefined,
          ...(request.ef !== undefined ? { params: { ef: request.ef } } : {}),
          ...(request.nprobe !== undefined
            ? { params: { nprobe: request.nprobe } }
            : {}),
        },
      }
    );
    if (
      !Array.isArray(body.documents) ||
      body.documents.some(group => !Array.isArray(group))
    ) {
      throw HttpErrors(502, 'TCVectordb returned invalid search results.');
    }
    return { documents: body.documents };
  }

  async deleteDocuments(
    request: ProviderDeleteDocumentsRequest
  ): Promise<ProviderMutationResponse> {
    const session = this.getSession(request.clientId);
    // Only explicit IDs are exposed by the UI; never translate an empty selection to a filter delete.
    validateDocumentIds(request.documentIds, 1000);
    return this.request(session, '/document/delete', 'POST', {
      database: request.database,
      collection: request.collection,
      query: { documentIds: request.documentIds },
    });
  }

  async countDocuments(
    request: ProviderCountDocumentsRequest
  ): Promise<{ count: number }> {
    const body = await this.request<{ count: number }>(
      this.getSession(request.clientId),
      '/document/count',
      'POST',
      {
        database: request.database,
        collection: request.collection,
        query: { filter: request.filter || '' },
      }
    );
    if (!Number.isSafeInteger(body.count) || body.count < 0)
      throw HttpErrors(502, 'TCVectordb returned an invalid document count.');
    return { count: body.count };
  }

  async createDatabase(request: ProviderDatabaseMutationRequest) {
    return this.request(
      this.getSession(request.clientId),
      '/database/create',
      'POST',
      { database: request.database }
    );
  }
  async dropDatabase(request: ProviderDatabaseMutationRequest) {
    return this.request(
      this.getSession(request.clientId),
      '/database/drop',
      'POST',
      { database: request.database }
    );
  }
  async setAlias(request: ProviderAliasRequest) {
    return this.request(
      this.getSession(request.clientId),
      '/alias/set',
      'POST',
      {
        database: request.database,
        collection: request.collection,
        alias: request.alias,
      }
    );
  }
  async deleteAlias(request: ProviderAliasDeleteRequest) {
    return this.request(
      this.getSession(request.clientId),
      '/alias/delete',
      'POST',
      { database: request.database, alias: request.alias }
    );
  }
  async rebuildIndex(request: ProviderIndexRebuildRequest) {
    return this.request(
      this.getSession(request.clientId),
      '/index/rebuild',
      'POST',
      {
        database: request.database,
        collection: request.collection,
        fieldName: request.fieldName,
        ...(request.dropBeforeRebuild !== undefined
          ? { dropBeforeRebuild: request.dropBeforeRebuild }
          : {}),
        ...(request.throttle !== undefined
          ? { throttle: request.throttle }
          : {}),
      }
    );
  }
  async dropIndex(request: ProviderIndexDropRequest) {
    return this.request(
      this.getSession(request.clientId),
      '/index/drop',
      'POST',
      {
        database: request.database,
        collection: request.collection,
        fieldNames: request.fieldNames,
      }
    );
  }
  async hybridSearch(request: ProviderHybridSearchRequest) {
    return this.advancedSearch(request, '/document/hybridSearch');
  }
  async fullTextSearch(request: ProviderFullTextSearchRequest) {
    return this.advancedSearch(request, '/document/fullTextSearch');
  }
  private async advancedSearch(
    request: ProviderHybridSearchRequest | ProviderFullTextSearchRequest,
    path: string
  ): Promise<ProviderSearchDocumentsResult> {
    const body = await this.request<ProviderSearchDocumentsResult>(
      this.getSession(request.clientId),
      path,
      'POST',
      {
        database: request.database,
        collection: request.collection,
        readConsistency: request.readConsistency,
        search: request.search,
      }
    );
    if (
      !Array.isArray(body.documents) ||
      body.documents.some(group => !Array.isArray(group))
    )
      throw HttpErrors(502, 'TCVectordb returned invalid search results.');
    return body;
  }
  async listUsers(clientId: string): Promise<ProviderUserListResult> {
    return this.request(this.getSession(clientId), '/user/list', 'POST');
  }
  async createUser(request: ProviderUserCreateRequest) {
    return this.request(
      this.getSession(request.clientId),
      '/user/create',
      'POST',
      { user: request.user, password: request.password }
    );
  }
  async dropUser(request: ProviderUserRequest) {
    return this.request(
      this.getSession(request.clientId),
      '/user/drop',
      'POST',
      { user: request.user }
    );
  }
  async grantUserPrivileges(request: ProviderUserPrivilegesRequest) {
    return this.request(
      this.getSession(request.clientId),
      '/user/grant',
      'POST',
      { user: request.user, privileges: request.privileges }
    );
  }
  async revokeUserPrivileges(request: ProviderUserPrivilegesRequest) {
    return this.request(
      this.getSession(request.clientId),
      '/user/revoke',
      'POST',
      { user: request.user, privileges: request.privileges }
    );
  }
  async describeUser(request: ProviderUserRequest): Promise<ProviderUser> {
    return this.request(
      this.getSession(request.clientId),
      '/user/describe',
      'POST',
      { user: request.user }
    );
  }
  async changeUserPassword(request: ProviderUserCreateRequest) {
    return this.request(
      this.getSession(request.clientId),
      '/user/changePassword',
      'POST',
      { user: request.user, password: request.password }
    );
  }

  private async request<R>(
    connection: ProviderConnectionRequest,
    path: string,
    method: 'GET' | 'POST',
    data?: object
  ): Promise<R> {
    const endpoint = this.validateConnection(connection);
    try {
      const response = await axios.request<R & { code?: number; msg?: string }>(
        {
          url: `${endpoint}${path}`,
          method,
          data,
          timeout: 15000,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer account=${connection.account.trim()}&api_key=${connection.apiKey.trim()}`,
          },
        }
      );
      if (response.data?.code !== 0) {
        throw HttpErrors(
          502,
          `TCVectordb: ${response.data?.msg || 'Request failed.'}`
        );
      }
      return response.data;
    } catch (error) {
      // Axios errors contain the Authorization header; propagate only the public message.
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        throw HttpErrors(
          status === 401 || status === 403 ? 403 : 502,
          `TCVectordb: ${error.response?.data?.msg || error.message}`
        );
      }
      throw error;
    }
  }

  private validateConnection(request: ProviderConnectionRequest) {
    try {
      const endpoint = new URL(request.endpoint.trim());
      if (
        !['http:', 'https:'].includes(endpoint.protocol) ||
        endpoint.username ||
        endpoint.password ||
        endpoint.search ||
        endpoint.hash ||
        endpoint.pathname !== '/'
      )
        throw new Error();
      if (!request.account.trim() || !request.apiKey.trim()) throw new Error();
      return endpoint.origin;
    } catch {
      throw HttpErrors(
        400,
        'A valid http/https endpoint, account and API key are required.'
      );
    }
  }
}
