const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const { chromium } = require('playwright');
const verifyDocuments = require('./tcvectordb-documents-smoke.cjs');

async function main() {
  const base = process.env.ATTU_URL || 'http://localhost:3001';
  const endpoint = process.env.TCVECTORDB_ENDPOINT;
  const key = process.env.TCVECTORDB_API_KEY;
  const database = process.env.TCVECTORDB_DATABASE || 'attu_dev';
  assert(
    endpoint && key,
    'TCVECTORDB_ENDPOINT and TCVECTORDB_API_KEY are required.'
  );
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    locale: 'en-US',
  });
  await context.addInitScript(() => localStorage.setItem('attu.ui.lang', 'en'));
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => {
    if (r.url().includes('/api/v1/')) requests.push(r.url());
  });
  const output = path.resolve(__dirname, '../server/dist/verification');
  await fs.mkdir(output, { recursive: true });
  let sessionId;
  const collection = `attu_ui_verify_${Date.now()}`;
  let created = false;
  const api = async (route, data) => {
    const response = await context.request.post(
      `${base}/api/v1/tcvectordb/${route}`,
      {
        headers: { 'milvus-client-id': sessionId || '' },
        data,
      }
    );
    assert.equal(response.status(), 200, `${route}: ${await response.text()}`);
    return (await response.json()).data;
  };
  try {
    await page.goto(`${base}/#/connect`);
    await page
      .getByRole('button', { name: 'Tencent VectorDB', exact: true })
      .click();
    await page.getByLabel('Endpoint').fill(endpoint);
    await page
      .getByLabel('Account')
      .fill(process.env.TCVECTORDB_ACCOUNT || 'root');
    await page.getByLabel('API key').fill(key);
    await page.getByLabel('Database', { exact: false }).fill(database);
    const connection = page.waitForResponse(r =>
      r.url().endsWith('/tcvectordb/connect')
    );
    await page.getByRole('button', { name: 'Connect', exact: true }).click();
    const response = await connection;
    assert.equal(response.status(), 200, await response.text());
    sessionId = (await response.json()).data.clientId;
    await page.waitForURL(`${base}/#/`);
    assert.equal(
      await page.evaluate(
        secret => JSON.stringify(localStorage).includes(secret),
        key
      ),
      false
    );
    requests.length = 0;
    await page.getByText(database, { exact: true }).first().click();
    await page
      .getByRole('table', { name: 'Collections', exact: true })
      .waitFor();
    await page.screenshot({
      path: path.join(output, 'collections-desktop.png'),
      fullPage: true,
    });
    await page
      .getByRole('button', { name: 'Create collection', exact: true })
      .click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Collection name').fill(collection);
    await dialog.getByLabel('Dimension').fill('8');
    await dialog
      .getByLabel('Description', { exact: true })
      .fill('Attu UI integration verification');
    await dialog
      .getByRole('button', { name: 'Add field', exact: true })
      .click();
    await dialog.getByLabel('Field name').fill('text');
    await dialog.getByLabel('Collection name').focus();
    await page.waitForTimeout(200);
    await page.screenshot({
      path: path.join(output, 'create-desktop.png'),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: path.join(output, 'create-mobile.png'),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 960 });
    const creation = page.waitForResponse(r =>
      r.url().endsWith('/tcvectordb/collections/create')
    );
    await dialog
      .getByRole('button', { name: 'Create collection', exact: true })
      .click();
    const creationResponse = await creation;
    assert.equal(creationResponse.status(), 200, await creationResponse.text());
    created = true;
    await page.getByRole('table', { name: 'Indexes', exact: true }).waitFor();
    const info = await api('collections/describe', { database, collection });
    assert.equal(info.indexes.find(i => i.fieldName === 'vector').dimension, 8);
    assert.equal(
      info.indexes.find(i => i.fieldName === 'text').indexType,
      'filter'
    );
    assert.equal(info.documentCount, 0);
    await page.screenshot({
      path: path.join(output, 'schema-desktop.png'),
      fullPage: true,
    });
    await page.reload();
    await page.getByRole('table', { name: 'Indexes', exact: true }).waitFor();
    await page.getByRole('tab', { name: 'Metadata', exact: true }).click();
    await page.locator('pre').waitFor();
    assert((await page.locator('pre').innerText()).includes('"dimension": 8'));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: path.join(output, 'metadata-mobile.png'),
      fullPage: true,
    });
    const dimensions = await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    assert(
      dimensions.scroll <= dimensions.width,
      `Mobile page overflow: ${JSON.stringify(dimensions)}`
    );
    await page.setViewportSize({ width: 1440, height: 960 });
    await verifyDocuments({
      page,
      api,
      context,
      base,
      sessionId,
      database,
      collection,
      output,
    });
    await page
      .getByRole('button', {
        name: `Drop collection ${collection}`,
        exact: true,
      })
      .click();
    await page
      .getByLabel('Confirm collection name', { exact: true })
      .fill('wrong');
    assert(
      await page
        .getByRole('dialog')
        .getByRole('button', { name: 'Drop collection', exact: true })
        .isDisabled()
    );
    await page
      .getByLabel('Confirm collection name', { exact: true })
      .fill(collection);
    const deletion = page.waitForResponse(r =>
      r.url().endsWith('/tcvectordb/collections/drop')
    );
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Drop collection', exact: true })
      .click();
    assert.equal((await deletion).status(), 200);
    created = false;
    await page
      .getByRole('table', { name: 'Collections', exact: true })
      .waitFor();
    const items = await api('collections/list', { database });
    assert(!items.collections.some(c => c.collection === collection));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: path.join(output, 'collections-mobile.png'),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 960 });
    const dbResponse = await context.request.get(
      `${base}/api/v1/tcvectordb/databases`,
      { headers: { 'milvus-client-id': sessionId } }
    );
    const other = (await dbResponse.json()).data.find(
      db => db.name !== database
    );
    if (other) {
      await page.getByText(database, { exact: true }).first().click();
      await page
        .getByRole('menuitem', { name: other.name, exact: true })
        .click();
      await page
        .getByRole('table', { name: 'Collections', exact: true })
        .waitFor();
      assert(
        (await page.evaluate(() => location.hash)).includes(
          encodeURIComponent(other.name)
        )
      );
      await page.getByText(other.name, { exact: true }).first().click();
      await page.getByRole('menuitem', { name: database, exact: true }).click();
      await page
        .getByRole('table', { name: 'Collections', exact: true })
        .waitFor();
    }
    const invalid = await context.request.post(
      `${base}/api/v1/tcvectordb/collections/create`,
      {
        headers: { 'milvus-client-id': sessionId },
        data: {
          database,
          collection: 'invalid_test',
          shardNum: 0,
          replicaNum: 1,
          indexes: [],
        },
      }
    );
    assert.equal(invalid.status(), 400);
    const missing = await context.request.post(
      `${base}/api/v1/tcvectordb/collections/list`,
      { data: { database } }
    );
    assert.equal(missing.status(), 401);
    assert(
      !requests.some(url =>
        /\/api\/v1\/(milvus|collections|databases|users|crons|partitions)\b/.test(
          url
        )
      ),
      'Unexpected Milvus request after login'
    );
    assert.deepEqual(errors, []);
    await api('disconnect', {});
    sessionId = undefined;
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.waitForURL(`${base}/#/connect`);
    console.log(
      JSON.stringify({
        result: 'passed',
        database,
        collection,
        removed: true,
        screenshots: output,
        apiRequests: requests.length,
      })
    );
  } catch (error) {
    await page.screenshot({
      path: path.join(output, 'failure.png'),
      fullPage: true,
    });
    console.error('Browser errors:', errors);
    throw error;
  } finally {
    if (created && sessionId) {
      // This collection was created by this run and contains only its own fixtures.
      await api('collections/drop', { database, collection });
    }
    if (sessionId) await api('disconnect', {});
    await browser.close();
  }
}
main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
