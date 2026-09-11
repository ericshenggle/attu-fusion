const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const { chromium } = require('playwright');
const { embeddingProviders } = require('../server/dist/src/embedding/providers');

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const output = path.resolve(__dirname, '../server/dist/verification/embedding');
  await fs.mkdir(output, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const requests = [];
  let failEmbedding = false;
  const vector = Array(64).fill(0.125);
  const sparseVector = [{ index: 2, value: 0.8 }, { index: 70000, value: 1e-8 }];
  await page.addInitScript(() => localStorage.setItem('attu.ui.lang', 'en'));
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const endpoint = new URL(request.url()).pathname;
    const body = request.postDataJSON();
    requests.push({ endpoint, body });
    let data = {};
    if (endpoint.endsWith('/embedding/providers')) data = embeddingProviders.map(p => p.info);
    else if (endpoint.endsWith('/embedding/generate')) {
      if (failEmbedding) return route.fulfill({ status: 502, json: { message: 'Embedding test failure', statusCode: 502 } });
      data = { provider: 'dashscope', model: body.model, elapsedMs: 12, outputType: body.outputType,
        ...(body.outputType !== 'sparse' ? { vector, dimension: 64 } : {}),
        ...(body.outputType !== 'dense' ? { sparseVector } : {}) };
    } else if (endpoint.includes('/tcvectordb/documents/')) data = { documents: [[{ id: '1', score: 0.9 }]] };
    else if (endpoint.endsWith('/search')) data = { results: [{ id: '1', score: 0.9 }], latency: 5 };
    else if (endpoint.endsWith('/version')) data = { version: '2.5.12' };
    await route.fulfill({ json: { statusCode: 200, data } });
  });
  const mount = async (provider, options = {}) => {
    await page.goto('http://localhost:3001/#/connect');
    await page.evaluate(async ({ provider, options }) => {
      const fixture = await import('/test/embedding-harness.tsx');
      fixture.mount(provider, options);
    }, { provider, options });
    await page.getByRole('group', { name: 'Search input', exact: true }).first().waitFor();
    requests.length = 0;
  };
  const select = async (label, option) => {
    await page.getByLabel(label, { exact: true }).first().click();
    await page.getByRole('option', { name: option, exact: true }).click();
  };
  const external = async () => {
    await page.getByRole('button', { name: 'External text', exact: true }).first().click();
    await page.getByLabel('API Key', { exact: false }).fill('test-only-secret');
    await page.getByLabel('Query text', { exact: true }).fill('Find similar documents');
  };
  const submit = async endpoint => {
    const pending = page.waitForResponse(r => new URL(r.url()).pathname === endpoint);
    await page.getByRole('button', { name: /^Search(?:\s*\(\d+\))?$/ }).first().click();
    await pending;
    return requests.filter(r => r.endpoint === endpoint).at(-1).body;
  };
  try {
    await mount('tcvectordb');
    await external();
    let body = await submit('/api/v1/tcvectordb/documents/search');
    assert.deepEqual(body.vectors, [vector]);
    assert.equal(body.apiKey, undefined);
    await select('Embedding output', 'Sparse');
    body = await submit('/api/v1/tcvectordb/documents/full-text-search');
    assert.deepEqual(body.search.match[0].data, [[[2, 0.8], [70000, 1e-8]]]);
    assert.equal(body.search.ann, undefined);
    await select('Embedding output', 'Dense + Sparse');
    body = await submit('/api/v1/tcvectordb/documents/hybrid-search');
    assert.deepEqual(body.search.ann[0].data, [vector]);
    assert.deepEqual(body.search.rerank, { method: 'rrf', k: 60 });
    await select('Hybrid reranker', 'Weighted');
    await page.getByLabel('Dense weight', { exact: true }).fill('0.6');
    body = await submit('/api/v1/tcvectordb/documents/hybrid-search');
    assert.deepEqual(body.search.rerank.weight, [0.6, 0.4]);
    await page.screenshot({ path: path.join(output, 'tencent-hybrid.png'), fullPage: true });
    await page.getByRole('button', { name: 'Built-in text', exact: true }).click();
    await page.getByLabel('Query text', { exact: true }).fill('Database text');
    body = await submit('/api/v1/tcvectordb/documents/search');
    assert.deepEqual(body.embeddingItems, ['Database text']);
    await page.getByRole('button', { name: 'Raw vector', exact: true }).click();
    await page.getByRole('button', { name: 'Get vector', exact: true }).click();
    await page.getByLabel('API Key', { exact: false }).fill('test-only-secret');
    await page.getByLabel('Query text', { exact: true }).fill('Vector tool');
    await select('Embedding output', 'Dense + Sparse');
    await page.getByRole('button', { name: 'Generate vector', exact: true }).click();
    await page.getByLabel('Generated vector', { exact: true }).waitFor();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download vector', exact: true }).click();
    assert.equal((await download).suggestedFilename(), 'embedding.json');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(output, 'vector-tool-mobile.png'), fullPage: true });
    const dialog = page.getByRole('dialog');
    assert.ok(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1));
    await page.getByRole('button', { name: 'Use vector', exact: true }).click();
    assert.deepEqual(JSON.parse(await page.getByLabel('Vector JSON').inputValue()).dense, vector);
    body = await submit('/api/v1/tcvectordb/documents/hybrid-search');
    assert.equal(body.search.match[0].data[0][1][0], 70000);
    assert.equal(await page.evaluate(() => JSON.stringify(localStorage).includes('test-only-secret')), false);
    await page.setViewportSize({ width: 1440, height: 1080 });

    await mount('tcvectordb', { dimension: 32, noSparse: true });
    await external();
    assert.equal(await page.getByRole('button', { name: 'Generate vector', exact: true }).isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Search', exact: true }).isDisabled(), true);

    await mount('milvus');
    await external();
    await select('Embedding output', 'Dense + Sparse');
    body = await submit('/api/v1/collections/embedding_test/search');
    assert.equal(body.data.length, 2);
    assert.deepEqual(body.data[0].data, vector);
    assert.deepEqual(body.data[1].data, { 2: 0.8, 70000: 1e-8 });
    assert.deepEqual(body.rerank, { strategy: 'rrf', params: { k: 60 } });
    await page.screenshot({ path: path.join(output, 'milvus-hybrid.png'), fullPage: true });
    await page.getByRole('button', { name: 'Raw vector', exact: true }).first().click();
    await page.getByRole('button', { name: 'Get vector', exact: true }).first().click();
    await page.getByLabel('API Key', { exact: false }).fill('test-only-secret');
    await page.getByLabel('Query text', { exact: true }).fill('Milvus combined raw vector');
    await select('Embedding output', 'Dense + Sparse');
    await page.getByRole('button', { name: 'Generate vector', exact: true }).click();
    await page.getByLabel('Generated vector', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Use vector', exact: true }).click();
    body = await submit('/api/v1/collections/embedding_test/search');
    assert.deepEqual(body.data[1].data, { 2: 0.8, 70000: 1e-8 });
    await mount('milvus', { sparseOnly: true });
    await external();
    body = await submit('/api/v1/collections/embedding_test/search');
    assert.deepEqual(body.data[0].data, { 2: 0.8, 70000: 1e-8 });

    await mount('milvus', { bm25: true });
    await page.getByLabel('Query text', { exact: true }).fill('BM25 text');
    body = await submit('/api/v1/collections/embedding_test/search');
    assert.equal(body.data[0].data, 'BM25 text');
    assert.equal(await page.getByRole('button', { name: 'External text', exact: true }).last().isDisabled(), true);

    await mount('tcvectordb');
    failEmbedding = true;
    await external();
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.getByText('Embedding test failure', { exact: true }).first().waitFor();
    assert.equal(requests.some(r => r.endpoint.includes('/documents/')), false);
    assert.deepEqual(errors, []);
    console.log('Embedding browser checks passed: dense, sparse, hybrid RRF/weighted, built-in text, vector tool, dimension blocking, failures, and mobile dialog.');
  } catch (error) {
    await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true });
    console.error('Browser errors:', errors);
    console.error((await page.locator('body').innerText()).slice(-3500));
    throw error;
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
