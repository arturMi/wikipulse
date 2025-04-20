import assert from 'node:assert/strict';
import { test } from 'node:test';
import { feedEntries, keepRecent, parseChange, summarize, topWikis } from '../src/stats.js';

// A shortened event, as the stream sends it.
function streamEvent(fields = {}) {
  return JSON.stringify({
    meta: { domain: 'en.wikipedia.org' },
    type: 'edit',
    namespace: 0,
    title: 'Lake Constance',
    title_url: 'https://en.wikipedia.org/wiki/Lake_Constance',
    user: 'Anna',
    bot: false,
    length: { old: 1000, new: 1120 },
    server_name: 'en.wikipedia.org',
    ...fields,
  });
}

function change(fields = {}) {
  return { time: 0, wiki: 'en.wikipedia', bot: false, type: 'edit', isArticle: true, ...fields };
}

test('parseChange keeps the fields the dashboard needs', () => {
  assert.deepEqual(parseChange(streamEvent(), 5000), {
    time: 5000,
    host: 'en.wikipedia.org',
    wiki: 'en.wikipedia',
    title: 'Lake Constance',
    user: 'Anna',
    bot: false,
    type: 'edit',
    isArticle: true,
    sizeChange: 120,
    url: 'https://en.wikipedia.org/wiki/Lake_Constance',
  });
});

test('parseChange shortens wiki names and counts a new page fully as added bytes', () => {
  const change = parseChange(
    streamEvent({ server_name: 'www.wikidata.org', type: 'new', length: { new: 900 } }),
    0,
  );
  assert.equal(change.wiki, 'wikidata');
  assert.equal(change.isArticle, false);
  assert.equal(change.sizeChange, 900);
});

test('parseChange skips canary events, unknown types and broken messages', () => {
  assert.equal(parseChange(streamEvent({ meta: { domain: 'canary' } }), 0), null);
  assert.equal(parseChange(streamEvent({ type: 'external' }), 0), null);
  assert.equal(parseChange('{"broken', 0), null);
});

test('keepRecent removes old changes', () => {
  const changes = [change({ time: 1000 }), change({ time: 9000 })];
  assert.deepEqual(keepRecent(changes, 10_000, 5000), [change({ time: 9000 })]);
});

test('topWikis counts people and bots per wiki, busiest first', () => {
  const changes = [
    change({ wiki: 'de.wikipedia' }),
    change({ wiki: 'wikidata', bot: true }),
    change({ wiki: 'wikidata', bot: true }),
    change({ wiki: 'wikidata' }),
  ];
  assert.deepEqual(topWikis(changes), [
    { wiki: 'wikidata', people: 1, bots: 2 },
    { wiki: 'de.wikipedia', people: 1, bots: 0 },
  ]);
  assert.equal(topWikis(changes, 1).length, 1);
});

test('summarize calculates the numbers at the top', () => {
  const now = 100_000;
  const changes = [
    change({ time: now - 60_000, bot: true }),
    change({ time: now - 5_000, type: 'new', wiki: 'de.wikipedia' }),
    change({ time: now - 1_000 }),
    change({ time: now - 500, bot: true }),
  ];
  assert.deepEqual(summarize(changes, now), {
    perSecond: 0.3, // 3 changes in the last 10 seconds
    botShare: 0.5,
    newPages: 1,
    activeWikis: 2,
  });
  assert.equal(summarize([], now).botShare, 0);
});

test('feedEntries filters and puts the newest first', () => {
  const changes = [
    change({ title: 'A' }),
    change({ title: 'B', bot: true }),
    change({ title: 'C', isArticle: false }),
    change({ title: 'D' }),
  ];
  const titles = (filters) => feedEntries(changes, filters).map((c) => c.title);
  assert.deepEqual(titles({ onlyArticles: false, hideBots: false }), ['D', 'C', 'B', 'A']);
  assert.deepEqual(titles({ onlyArticles: true, hideBots: true }), ['D', 'A']);
  assert.deepEqual(
    feedEntries(changes, { onlyArticles: false, hideBots: false }, 2).map((c) => c.title),
    ['D', 'C'],
  );
});
