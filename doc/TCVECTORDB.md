# Tencent VectorDB Integration

The business workflow supports Base databases, collection management and dense
vector documents.
Select Tencent VectorDB on the connection page, then open a database from the
home page. The database selector also switches databases without reconnecting.

Implemented:

- List Base databases and collection counts.
- List, filter and page collections; display document counts and index status.
- Describe a collection, inspect native field/index types and full metadata.
- Create collections with configurable shard/replica counts, dimension,
  HNSW or FLAT, COSINE/L2/IP, and scalar filter indexes.
- Drop a collection after confirming its name.
- Query documents by ID or filter, scan with offset pagination, choose returned
  fields and vectors, and use strong or eventual read consistency.
- Count filter matches independently of pagination. The query response count is
  the number of returned rows, not a total; paging does not invent a total.
  Upstream count and collection statistics can briefly lag behind writes/deletes,
  even when a strong-consistency document query already reflects the mutation.
- Upsert 1-1000 JSON documents from the editor or a JSON file, inspect/export
  returned JSON, and delete only explicitly selected document IDs.
- Edit a document after fetching its full contents with vectors and strong
  consistency. Upsert replaces the entire document, including non-indexed fields;
  this is not a partial update or an optimistic concurrency check.
- Search using one vector or document ID, or text for an embedding-enabled
  collection. Select Top K, filter, projection, and index-specific ef/nprobe.
  Results retain Tencent's ordering and scores. The backend supports up to 20
  inputs and preserves each result group; the page submits one input at a time.
- Use the advanced JSON modes for Tencent hybrid search and sparse full-text
  search. Their request object is passed through after route validation, so
  sparse schemas can use the vendor's `ann`, `match`, `rerank` and cutoff
  parameters.
- Manage databases, collection aliases, scalar indexes, vector/sparse index
  rebuilds, and users (including privileges) from the Tencent management page.

AI databases, collection views and AI document-set operations are not
implemented. Initial IVF collections require buildIndex=false followed by the
index rebuild action before searching. Creation in this UI offers HNSW and
FLAT; sparse and hybrid collections can be operated through their native JSON
request modes once created by the service.
Milvus-only routes and controls are excluded from Tencent sessions.

## Backend Contract

`POST /api/v1/tcvectordb/connect` accepts endpoint, account, apiKey, database
and clientId. After connecting, all business requests use the existing
`milvus-client-id` HTTP header for compatibility with Attu's HTTP client.
The key stays in a bounded backend session cache and is not persisted in
browser storage. Sessions expire after 24 hours of inactivity or a server
restart; reconnect when the backend returns HTTP 401.

| Attu route                                  | Request body                                                                                                                                          | Tencent route                 |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| GET /tcvectordb/databases                   | None                                                                                                                                                  | GET /database/list            |
| POST /tcvectordb/collections/list           | database                                                                                                                                              | POST /collection/list         |
| POST /tcvectordb/collections/describe       | database, collection                                                                                                                                  | POST /collection/describe     |
| POST /tcvectordb/collections/create         | database, collection, shardNum, replicaNum, indexes, optional description                                                                             | POST /collection/create       |
| POST /tcvectordb/collections/drop           | database, collection                                                                                                                                  | POST /collection/drop         |
| POST /tcvectordb/documents/query            | database, collection, limit, offset, optional documentIds/filter/outputFields/retrieveVector/readConsistency                                          | POST /document/query          |
| POST /tcvectordb/documents/upsert           | database, collection, documents, buildIndex                                                                                                           | POST /document/upsert         |
| POST /tcvectordb/documents/search           | database, collection, limit, exactly one of vectors/documentIds/embeddingItems, optional filter/outputFields/retrieveVector/readConsistency/ef/nprobe | POST /document/search         |
| POST /tcvectordb/documents/delete           | database, collection, documentIds                                                                                                                     | POST /document/delete         |
| POST /tcvectordb/documents/count            | database, collection, optional filter                                                                                                                 | POST /document/count          |
| POST /tcvectordb/documents/hybrid-search    | database, collection, search, optional readConsistency                                                                                                | POST /document/hybridSearch   |
| POST /tcvectordb/documents/full-text-search | database, collection, search, optional readConsistency                                                                                                | POST /document/fullTextSearch |
| POST /tcvectordb/databases/create           | database                                                                                                                                              | POST /database/create         |
| POST /tcvectordb/databases/drop             | database                                                                                                                                              | POST /database/drop           |
| POST /tcvectordb/aliases/set                | database, collection, alias                                                                                                                           | POST /alias/set               |
| POST /tcvectordb/aliases/delete             | database, alias                                                                                                                                       | POST /alias/delete            |
| POST /tcvectordb/indexes/rebuild            | database, collection, fieldName, optional dropBeforeRebuild/throttle                                                                                  | POST /index/rebuild           |
| POST /tcvectordb/indexes/drop               | database, collection, fieldNames                                                                                                                      | POST /index/drop              |
| POST /tcvectordb/users/list                 | None                                                                                                                                                  | POST /user/list               |
| POST /tcvectordb/users/create               | user, password                                                                                                                                        | POST /user/create             |
| POST /tcvectordb/users/drop                 | user                                                                                                                                                  | POST /user/drop               |
| POST /tcvectordb/users/describe             | user                                                                                                                                                  | POST /user/describe           |
| POST /tcvectordb/users/grant                | user, privileges                                                                                                                                      | POST /user/grant              |
| POST /tcvectordb/users/revoke               | user, privileges                                                                                                                                      | POST /user/revoke             |
| POST /tcvectordb/users/change-password      | user, password                                                                                                                                        | POST /user/changePassword     |
| POST /tcvectordb/disconnect                 | None                                                                                                                                                  | Clears local session          |

Credentials are only sent at connect time. Every collection operation supplies
its own database, preventing requests from sharing mutable database state.
The adapter nests flat read options under Tencent's query/search object.
Document mutations validate IDs, batch size and vector dimensions using current
collection metadata. Binary vectors use dimension/8 bytes, each from 0 to 255.
Filter deletion is deliberately not exposed by the delete route.

## Validation

Run backend tests from `server`:

```sh
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath src/tcvectordb/tcvectordb.service.test.ts
```

The opt-in browser test is `scripts/tcvectordb-smoke.cjs`. It requires Playwright,
Microsoft Edge, running frontend/backend servers, and these environment variables:
`TCVECTORDB_ENDPOINT`, `TCVECTORDB_API_KEY`, optional `TCVECTORDB_ACCOUNT`
(root), `TCVECTORDB_DATABASE` (attu_dev) and `ATTU_URL` (http://localhost:3001).
It creates a uniquely named collection and 25 sample documents, checks schema,
upsert, paging, filtering/count, projected reads, editing without losing fields,
vector/ID search, export, selected-ID deletion, reload and invalid requests.
It also checks provider routing and session expiration and writes desktop/mobile
screenshots under `server/dist/verification`. The owned test collection is
removed in cleanup even when document assertions fail. Run it only against a
development database. The document checks live in
`scripts/tcvectordb-documents-smoke.cjs` and run through the main script.

## Official References

- [Database list](https://cloud.tencent.com/document/product/1709/95114)
- [Collection list](https://cloud.tencent.com/document/product/1709/95118)
- [Collection describe](https://cloud.tencent.com/document/product/1709/95119)
- [Collection create](https://cloud.tencent.com/document/product/1709/95116)
- [Collection drop](https://cloud.tencent.com/document/product/1709/95117)
- [Document upsert](https://cloud.tencent.com/document/product/1709/95121)
- [Document query](https://cloud.tencent.com/document/product/1709/95122)
- [Document search](https://cloud.tencent.com/document/product/1709/95123)
- [Document delete](https://cloud.tencent.com/document/product/1709/95124)
- [Document count](https://cloud.tencent.com/document/product/1709/114258)

The database/list page has a conflicting POST heading; its curl example,
the supplied HTTP directory and the tested instance all use GET.
