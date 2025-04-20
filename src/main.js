import './style.css';
import { getPageviews, getSummary } from './api.js';
import { addSecond, createRateChart, createWikiChart, showViewsChart, updateWikiChart } from './charts.js';
import { feedEntries, keepRecent, summarize, topWikis } from './stats.js';
import { connectToStream } from './stream.js';

const FIVE_MINUTES = 5 * 60 * 1000;

let changes = []; // all changes of the last five minutes
let thisSecond = { people: 0, bots: 0 }; // counted while events arrive, drawn once per second
let feedPaused = false;

const $ = (selector) => document.querySelector(selector);

const rateChart = createRateChart($('#rate-chart'));
const wikiChart = createWikiChart($('#wiki-chart'));

// 1. Receive events from the live stream.
connectToStream(
  (change) => {
    changes.push(change);
    if (change.bot) thisSecond.bots += 1;
    else thisSecond.people += 1;
  },
  (status) => {
    $('#status').textContent = status === 'live' ? 'Live' : 'Reconnecting…';
    $('#status').className = `status ${status}`;
  },
);

// 2. Update numbers, charts and feed once per second.
setInterval(() => {
  const now = Date.now();
  changes = keepRecent(changes, now, FIVE_MINUTES);

  addSecond(rateChart, formatTime(now), thisSecond.people, thisSecond.bots);
  thisSecond = { people: 0, bots: 0 };

  updateWikiChart(wikiChart, topWikis(changes));
  showNumbers(summarize(changes, now));
  if (!feedPaused) showFeed();
}, 1000);

function showNumbers(numbers) {
  $('#per-second').textContent = numbers.perSecond.toFixed(1);
  $('#bot-share').textContent = `${Math.round(numbers.botShare * 100)} %`;
  $('#new-pages').textContent = numbers.newPages;
  $('#active-wikis').textContent = numbers.activeWikis;
}

function showFeed() {
  const filters = {
    onlyArticles: $('#only-articles').checked,
    hideBots: $('#hide-bots').checked,
  };
  $('#feed').replaceChildren(...feedEntries(changes, filters).map(feedItem));
}

// One line in the feed. We use textContent, never innerHTML: titles come from the
// internet and must not be able to inject HTML into the page.
function feedItem(change) {
  const button = document.createElement('button');
  button.append(
    span('time', formatTime(change.time)),
    span('wiki', change.wiki),
    span('title', change.title),
    span('size', formatSize(change.sizeChange)),
  );
  button.title = `Edited by ${change.user}`;
  button.addEventListener('click', () => showDetails(change));

  const item = document.createElement('li');
  item.append(button);
  return item;
}

function span(className, text) {
  const element = document.createElement('span');
  element.className = className;
  element.textContent = text;
  return element;
}

$('#pause').addEventListener('click', () => {
  feedPaused = !feedPaused;
  $('#pause').textContent = feedPaused ? 'Resume' : 'Pause';
});

// 3. On click: load summary and pageviews of the page from the REST API.
let lastRequest = 0;

async function showDetails(change) {
  const request = ++lastRequest;
  $('#detail-title').textContent = change.title;
  $('#detail-meta').textContent = `${change.wiki} · last edit by ${change.user}`;
  $('#detail-link').href = change.url;
  $('#detail-link').hidden = false;
  $('#detail-image').hidden = true;
  $('#detail-description').textContent = '';
  $('#detail-text').textContent = 'Loading…';
  $('#views').hidden = true;

  if (!change.isArticle) {
    $('#detail-text').textContent = 'Summary and pageviews are available for Wikipedia articles.';
    return;
  }

  try {
    const [summary, views] = await Promise.all([
      getSummary(change.host, change.title),
      getPageviews(change.host, change.title),
    ]);
    if (request !== lastRequest) return; // the user clicked another edit in the meantime

    $('#detail-description').textContent = summary?.description ?? '';
    $('#detail-text').textContent = summary?.extract || 'No summary available.';
    if (summary?.thumbnail) {
      $('#detail-image').src = summary.thumbnail.source;
      $('#detail-image').hidden = false;
    }
    if (views.length > 0) {
      const total = views.reduce((sum, day) => sum + day.views, 0);
      $('#views-total').textContent = `${total.toLocaleString('en')} views in total`;
      $('#views').hidden = false;
      showViewsChart($('#views-chart'), views);
    }
  } catch {
    if (request === lastRequest) {
      $('#detail-text').textContent = 'Could not load data from the Wikimedia REST API.';
    }
  }
}

function formatTime(ms) {
  return new Date(ms).toLocaleTimeString('en-GB'); // 14:05:09
}

function formatSize(bytes) {
  if (bytes === null) return '';
  return bytes > 0 ? `+${bytes}` : String(bytes);
}
