// Pure functions: no DOM, no network. That makes them easy to test (see test/stats.test.js).

const SHOWN_TYPES = ['edit', 'new', 'log', 'categorize'];

// Turns one message from the stream into the few fields the dashboard needs.
// Returns null for messages we don't show.
export function parseChange(text, now) {
  let event;
  try {
    event = JSON.parse(text);
  } catch {
    return null; // broken message
  }

  // "canary" events are test messages from Wikimedia, not real edits.
  if (event.meta?.domain === 'canary') return null;
  if (!event.server_name || !SHOWN_TYPES.includes(event.type)) return null;

  const host = event.server_name; // e.g. "en.wikipedia.org"
  return {
    time: now,
    host,
    wiki: host.replace('.org', '').replace('www.', ''), // "en.wikipedia", "wikidata"
    title: event.title,
    user: event.user,
    bot: event.bot,
    type: event.type,
    isArticle: event.namespace === 0 && host.endsWith('.wikipedia.org'),
    // Bytes added (+) or removed (-). Not available for every type.
    sizeChange: event.length ? (event.length.new ?? 0) - (event.length.old ?? 0) : null,
    url: event.title_url,
  };
}

// Keeps only the changes that are younger than maxAgeMs.
export function keepRecent(changes, now, maxAgeMs) {
  return changes.filter((change) => now - change.time < maxAgeMs);
}

// Counts changes per wiki and returns the busiest wikis first.
export function topWikis(changes, limit = 10) {
  const counts = {};
  for (const change of changes) {
    if (!counts[change.wiki]) {
      counts[change.wiki] = { wiki: change.wiki, people: 0, bots: 0 };
    }
    if (change.bot) counts[change.wiki].bots += 1;
    else counts[change.wiki].people += 1;
  }
  return Object.values(counts)
    .sort((a, b) => b.people + b.bots - (a.people + a.bots))
    .slice(0, limit);
}

// The four numbers at the top of the page.
export function summarize(changes, now) {
  const lastTenSeconds = changes.filter((change) => now - change.time < 10_000);
  const bots = changes.filter((change) => change.bot).length;
  return {
    perSecond: lastTenSeconds.length / 10,
    botShare: changes.length > 0 ? bots / changes.length : 0,
    newPages: changes.filter((change) => change.type === 'new').length,
    activeWikis: new Set(changes.map((change) => change.wiki)).size,
  };
}

// Entries for the live feed: filtered, newest first.
export function feedEntries(changes, filters, limit = 15) {
  return changes
    .filter((change) => !filters.onlyArticles || change.isArticle)
    .filter((change) => !filters.hideBots || !change.bot)
    .slice(-limit)
    .reverse();
}
