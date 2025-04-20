import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { getPageviews, getSummary, pageviewsUrl, summaryUrl } from '../src/api.js';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

// Replaces fetch with a fake that answers with the given status and JSON body.
function fakeFetch(status, body) {
  globalThis.fetch = async () => new Response(JSON.stringify(body), { status });
}

test('summaryUrl encodes the title', () => {
  assert.equal(
    summaryUrl('en.wikipedia.org', 'AC/DC'),
    'https://en.wikipedia.org/api/rest_v1/page/summary/AC%2FDC',
  );
});

test('pageviewsUrl asks for the 30 days before today', () => {
  const today = new Date('2026-11-09T10:00:00Z');
  assert.equal(
    pageviewsUrl('de.wikipedia.org', 'Lake Constance', today),
    'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/de.wikipedia/all-access/user/Lake_Constance/daily/20261010/20261108',
  );
});

test('getPageviews returns views per day', async () => {
  fakeFetch(200, {
    items: [
      { timestamp: '2026110700', views: 120 },
      { timestamp: '2026110800', views: 95 },
    ],
  });
  assert.deepEqual(await getPageviews('en.wikipedia.org', 'Konstanz'), [
    { day: '2026-11-07', views: 120 },
    { day: '2026-11-08', views: 95 },
  ]);
});

test('missing pages give empty results instead of errors', async () => {
  fakeFetch(404, {});
  assert.deepEqual(await getPageviews('en.wikipedia.org', 'New page'), []);
  assert.equal(await getSummary('en.wikipedia.org', 'Deleted page'), null);
});

test('other errors are reported', async () => {
  fakeFetch(503, {});
  await assert.rejects(getSummary('en.wikipedia.org', 'Konstanz'), /HTTP 503/);
});
