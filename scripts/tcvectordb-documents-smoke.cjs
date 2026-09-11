const assert = require('node:assert/strict');
const path = require('node:path');

module.exports = async function verifyDocuments({
  page,
  api,
  context,
  base,
  sessionId,
  database,
  collection,
  output,
}) {
  const target = { database, collection };
  const docs = Array.from({ length: 25 }, (_, i) => ({
    id: `doc-${String(i).padStart(2, '0')}`,
    vector: i === 0 ? [1, 0, 0, 0, 0, 0, 0, 0] : [0, 1, i / 100, 0, 0, 0, 0, 0],
    text: i % 2 === 0 ? 'alpha' : 'beta',
    metadata: { position: i, retained: true },
  }));
  const table = page.getByRole('table', {
    name: 'Document results',
    exact: true,
  });
  const waitUntil = async check => {
    const deadline = Date.now() + 15000;
    while (!(await check())) {
      assert(Date.now() < deadline, 'Timed out waiting for document UI');
      await page.waitForTimeout(100);
    }
  };
  const requestAfter = async (route, action) => {
    const pending = page.waitForResponse(r =>
      r.url().endsWith(`/tcvectordb/documents/${route}`)
    );
    await action();
    const response = await pending;
    assert.equal(response.status(), 200, `${route}: ${await response.text()}`);
    return (await response.json()).data;
  };
  const query = async () => {
    const result = await requestAfter('query', () =>
      page.getByRole('button', { name: 'Query', exact: true }).click()
    );
    await waitUntil(() =>
      page.getByRole('button', { name: 'Query', exact: true }).isEnabled()
    );
    return result;
  };
  const checkMobile = async filename => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: path.join(output, filename),
      fullPage: true,
      animations: 'disabled',
    });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      ),
      'Mobile document page overflows'
    );
    await page.setViewportSize({ width: 1440, height: 960 });
  };
  await requestAfter('query', () =>
    page.getByRole('tab', { name: 'Data', exact: true }).click()
  );
  await table.waitFor();
  await page
    .getByRole('button', { name: 'Upsert documents', exact: true })
    .click();
  let dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('Documents (JSON array)', { exact: true })
    .fill('invalid json');
  assert(
    await dialog
      .getByRole('button', { name: 'Upsert documents', exact: true })
      .isDisabled()
  );
  await dialog
    .locator('input[type="file"]')
    .setInputFiles({
      name: 'documents.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(docs)),
    });
  await waitUntil(
    async () =>
      (await dialog
        .getByLabel('Documents (JSON array)', { exact: true })
        .inputValue()) === JSON.stringify(docs)
  );
  await page.screenshot({
    path: path.join(output, 'upsert-desktop.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await checkMobile('upsert-mobile.png');
  await requestAfter('upsert', () =>
    dialog
      .getByRole('button', { name: 'Upsert documents', exact: true })
      .click()
  );
  await dialog.waitFor({ state: 'hidden' });
  await waitUntil(async () => (await table.locator('tbody tr').count()) === 20);
  await waitUntil(
    async () => (await api('documents/count', target)).count === 25
  );
  await requestAfter('query', () =>
    page.getByRole('button', { name: 'Go to next page', exact: true }).click()
  );
  await waitUntil(async () => (await table.locator('tbody tr').count()) === 5);
  assert(
    await page
      .getByRole('button', { name: 'Go to next page', exact: true })
      .isDisabled()
  );

  await page
    .getByLabel('Filter expression', { exact: true })
    .fill('text = "alpha"');
  let result = await query();
  assert.equal(result.documents.length, 13);
  assert(result.documents.every(doc => doc.text === 'alpha'));
  await requestAfter('count', () =>
    page.getByRole('button', { name: 'Count matches', exact: true }).click()
  );
  await page.getByText('Matched documents: 13', { exact: true }).waitFor();
  const fields = page.getByRole('combobox', {
    name: 'Output fields',
    exact: true,
  });
  await fields.fill('text');
  await fields.press('Enter');
  await fields.press('Escape');
  result = await query();
  assert(
    result.documents.every(doc => !('vector' in doc) && !('metadata' in doc))
  );
  await page.screenshot({
    path: path.join(output, 'documents-desktop.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await checkMobile('documents-mobile.png');

  const ids = page.getByRole('combobox', { name: 'Document IDs', exact: true });
  await ids.fill('doc-00');
  await ids.press('Enter');
  await ids.press('Escape');
  await query();
  await page
    .getByRole('button', { name: 'Edit document doc-00', exact: true })
    .click();
  dialog = page.getByRole('dialog');
  const editor = dialog.getByLabel('Documents (JSON array)', { exact: true });
  await editor.waitFor();
  const original = JSON.parse(await editor.inputValue());
  assert.deepEqual(original[0].vector, docs[0].vector);
  assert.deepEqual(original[0].metadata, docs[0].metadata);
  original[0].text = 'alpha';
  original[0].extra = 'edited';
  await editor.fill(JSON.stringify(original));
  await requestAfter('upsert', () =>
    dialog
      .getByRole('button', { name: 'Upsert documents', exact: true })
      .click()
  );
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(
    await page.getByLabel('Filter expression', { exact: true }).inputValue(),
    'text = "alpha"'
  );
  const updated = await api('documents/query', {
    ...target,
    documentIds: ['doc-00'],
    limit: 1,
    offset: 0,
    retrieveVector: true,
    readConsistency: 'strongConsistency',
  });
  assert.equal(updated.documents[0].extra, 'edited');
  assert.deepEqual(updated.documents[0].metadata, docs[0].metadata);
  assert.deepEqual(updated.documents[0].vector, docs[0].vector);

  await page.getByRole('tab', { name: 'Vector search', exact: true }).click();
  await page.getByLabel('Vector (JSON array)', { exact: false }).fill('[1,2]');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page
    .getByText('Provide a vector with 8 valid numeric elements.', {
      exact: true,
    })
    .waitFor();
  await page
    .getByLabel('Vector (JSON array)', { exact: false })
    .fill(JSON.stringify(docs[0].vector));
  const found = await requestAfter('search', () =>
    page.getByRole('button', { name: 'Search', exact: true }).click()
  );
  assert.equal(found.documents[0][0].id, 'doc-00');
  assert.equal(found.documents[0].length, 10);
  await table.waitFor();
  assert(
    (await table.locator('tbody tr').first().innerText()).includes('doc-00')
  );
  await page.screenshot({
    path: path.join(output, 'search-desktop.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await checkMobile('search-mobile.png');
  const download = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Export results', exact: true })
    .click();
  const saved = await download;
  assert.equal(saved.suggestedFilename(), 'documents.json');
  await saved.saveAs(path.join(output, 'search-results.json'));
  await page.getByRole('button', { name: 'Document ID', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Document ID', exact: false })
    .fill('doc-00');
  const byId = await requestAfter('search', () =>
    page.getByRole('button', { name: 'Search', exact: true }).click()
  );
  assert.equal(byId.documents[0][0].id, 'doc-00');

  await requestAfter('query', () =>
    page.getByRole('tab', { name: 'Data', exact: true }).click()
  );
  const deleteIds = page.getByRole('combobox', {
    name: 'Document IDs',
    exact: true,
  });
  await deleteIds.fill('doc-00');
  await deleteIds.press('Enter');
  await deleteIds.press('Escape');
  await query();
  await page
    .getByRole('checkbox', { name: 'Select document doc-00', exact: true })
    .check();
  await page
    .getByRole('button', { name: 'Delete documents', exact: true })
    .click();
  dialog = page.getByRole('dialog');
  await requestAfter('delete', () =>
    dialog
      .getByRole('button', { name: 'Delete documents', exact: true })
      .click()
  );
  await dialog.waitFor({ state: 'hidden' });
  await page.getByText('No documents', { exact: true }).waitFor();
  await waitUntil(
    async () => (await api('documents/count', target)).count === 24
  );
  await page.reload();
  await table.waitFor();
  await waitUntil(async () => (await table.locator('tbody tr').count()) === 20);

  for (const [route, data] of [
    ['delete', { documentIds: [] }],
    [
      'upsert',
      { documents: [{ id: 'invalid-vector', vector: [1] }], buildIndex: true },
    ],
    [
      'search',
      { vectors: [docs[0].vector], documentIds: ['doc-01'], limit: 5 },
    ],
  ]) {
    const response = await context.request.post(
      `${base}/api/v1/tcvectordb/documents/${route}`,
      {
        headers: { 'milvus-client-id': sessionId },
        data: { ...target, ...data },
      }
    );
    assert.equal(response.status(), 400, `${route} must reject invalid input`);
  }
  assert.equal((await api('documents/count', target)).count, 24);
  let releaseSave;
  const responseGate = new Promise(resolve => {
    releaseSave = resolve;
  });
  const upsertRoute = '**/api/v1/tcvectordb/documents/upsert';
  await page.route(upsertRoute, async route => {
    const response = await route.fetch();
    await responseGate;
    await route.fulfill({ response });
  });
  try {
    await page
      .getByRole('button', { name: 'Upsert documents', exact: true })
      .click();
    dialog = page.getByRole('dialog');
    await dialog
      .getByLabel('Documents (JSON array)', { exact: true })
      .fill(JSON.stringify([docs[1]]));
    const sent = page.waitForRequest(r =>
      r.url().endsWith('/documents/upsert')
    );
    const completed = page.waitForResponse(r =>
      r.url().endsWith('/documents/upsert')
    );
    await dialog
      .getByRole('button', { name: 'Upsert documents', exact: true })
      .click();
    await sent;
    await page.evaluate(db => {
      location.hash = `/databases/${encodeURIComponent(db)}/collections`;
    }, database);
    await page
      .getByRole('table', { name: 'Collections', exact: true })
      .waitFor();
    let lateReads = 0;
    const trackLateRead = request => {
      if (request.url().endsWith('/tcvectordb/collections/describe'))
        ++lateReads;
    };
    page.on('request', trackLateRead);
    releaseSave();
    await completed;
    await page.waitForTimeout(250);
    page.off('request', trackLateRead);
    assert.equal(
      lateReads,
      0,
      'A completed save must not refresh the collection page after navigating away'
    );
    assert.equal(
      await page
        .getByRole('button', {
          name: `Drop collection ${collection}`,
          exact: true,
        })
        .count(),
      1
    );
    await page.getByRole('link', { name: collection, exact: true }).click();
    await page.getByRole('table', { name: 'Indexes', exact: true }).waitFor();
  } finally {
    releaseSave();
    await page.unroute(upsertRoute);
  }
  console.log(
    'Document workflow passed: JSON import/upsert, pagination, filter, count, projection, edit, vector/ID search, export, delete, reload, validation, navigation during save.'
  );
};
