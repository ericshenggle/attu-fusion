# Embedding Search

Milvus and Tencent VectorDB collection search expose three input modes:

- Built-in text uses the collection's configured embedding or text function. Its model and dimensions belong to the collection schema. Milvus 2.5 BM25 remains a sparse text search, not a dense embedding model.
- External text calls Alibaba Cloud Bailian and routes dense, sparse or combined output to the corresponding database search. The query model must match the model used for stored vectors, even when dimensions agree. Sparse token indices must use the same model vocabulary as stored sparse vectors.
- Raw vector accepts the existing vector format. The Get vector dialog can generate, preview, copy, download and apply a Bailian embedding.

Bailian is the only registered external provider. Model and dimension options come from `GET /api/v1/embedding/providers`. `POST /api/v1/embedding/generate` requires an active database connection. API keys stay in the editor's memory and are sent only to the backend for generation; they are not saved in browser storage or database search requests.

The default API base is `https://dashscope.aliyuncs.com/api/v1` (Beijing). For a workspace API host, set `DASHSCOPE_BASE_URL` on the backend before starting it, for example:

```powershell
$env:DASHSCOPE_BASE_URL = 'https://YOUR_WORKSPACE_ID.cn-beijing.maas.aliyuncs.com/api/v1'
node dist/src/app.js
```

Run the command from `server`. API keys must belong to the configured region/workspace. The adapter uses the native text embedding endpoint with `text_type: query`. v3, v4 and qwen3.7 support `dense`, `sparse`, and `dense&sparse`; v2 supports only dense output at 1536 dimensions. Sparse output has no fixed dimension and does not send the dimension parameter. Invalid vectors, repeated sparse indices, and unsupported output types are rejected.

Tencent VectorDB uses `/document/search` for dense vectors, `/document/fullTextSearch` for sparse vectors, and `/document/hybridSearch` for combined output. Sparse weights are converted to `[index, weight]` pairs. Hybrid mode requires both indexes and offers RRF or weighted reranking.

Milvus uses dense arrays and sparse index-to-weight maps. For a single selected dense field, combined output can target an unselected sparse field and submit both in one hybrid search. Multi-field searches also support separate external embedding inputs per field using the existing global reranker. External sparse embeddings require a compatible sparse index; BM25 indexes retain database text input and do not accept provider embeddings through the external mode.

Raw input can be a dense array, a sparse map (Tencent also accepts pairs), or `{ "dense": [...], "sparse": { "2": 0.8 } }` for combined output. The vector tool applies these same formats.

Verification: run `node node_modules/jest/bin/jest.js --runInBand` from `server`. With Vite on port 3001 and Playwright available, run `node scripts/embedding-smoke.cjs` from the repository root after compiling the server. Browser tests use simulated HTTP responses; actual Bailian generation requires your API key and a live database with compatible fields and embeddings.

Reference: [Bailian synchronous text embedding API](https://help.aliyun.com/zh/model-studio/text-embedding-synchronous-api).
