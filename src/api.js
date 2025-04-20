// Two Wikimedia REST APIs. Both work directly from the browser and need no API key.

function encodeTitle(title) {
  return encodeURIComponent(title.replaceAll(' ', '_'));
}

// Date as YYYYMMDD, `daysAgo` days before `today` (UTC).
function dayString(today, daysAgo) {
  const date = new Date(today);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10).replaceAll('-', '');
}

// Short description, intro text and image of an article.
export function summaryUrl(host, title) {
  return `https://${host}/api/rest_v1/page/summary/${encodeTitle(title)}`;
}

// Views per day for the last 30 days (up to yesterday, today isn't complete yet).
export function pageviewsUrl(host, title, today = new Date()) {
  const project = host.replace('.org', ''); // "en.wikipedia.org" -> "en.wikipedia"
  const range = `${dayString(today, 30)}/${dayString(today, 1)}`;
  return `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${project}/all-access/user/${encodeTitle(title)}/daily/${range}`;
}

export async function getSummary(host, title) {
  const response = await fetch(summaryUrl(host, title));
  if (response.status === 404) return null; // page doesn't exist (anymore)
  if (!response.ok) throw new Error(`Summary request failed: HTTP ${response.status}`);
  return response.json();
}

export async function getPageviews(host, title) {
  const response = await fetch(pageviewsUrl(host, title));
  if (response.status === 404) return []; // no data yet, e.g. for a brand-new page
  if (!response.ok) throw new Error(`Pageviews request failed: HTTP ${response.status}`);
  const data = await response.json();
  return data.items.map((item) => ({
    day: `${item.timestamp.slice(0, 4)}-${item.timestamp.slice(4, 6)}-${item.timestamp.slice(6, 8)}`,
    views: item.views,
  }));
}
