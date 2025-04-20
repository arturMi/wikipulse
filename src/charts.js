import Chart from 'chart.js/auto';

// Colors come from style.css, so light and dark mode both work.
const css = getComputedStyle(document.documentElement);
const PEOPLE = css.getPropertyValue('--people').trim();
const BOTS = css.getPropertyValue('--bots').trim();

Chart.defaults.color = css.getPropertyValue('--muted').trim();
Chart.defaults.borderColor = css.getPropertyValue('--grid').trim();
Chart.defaults.maintainAspectRatio = false; // the chart fills its container (.chart in style.css)

const SECONDS = 60;

// Line chart: changes per second for the last 60 seconds.
export function createRateChart(canvas) {
  return new Chart(canvas, {
    type: 'line',
    data: {
      labels: new Array(SECONDS).fill(''),
      datasets: [
        { label: 'People', data: new Array(SECONDS).fill(null), borderColor: PEOPLE, backgroundColor: PEOPLE },
        { label: 'Bots', data: new Array(SECONDS).fill(null), borderColor: BOTS, backgroundColor: BOTS },
      ],
    },
    options: {
      animation: false,
      elements: { point: { radius: 0 }, line: { borderWidth: 2, tension: 0.3 } },
      interaction: { mode: 'index', intersect: false }, // tooltip shows both lines
      scales: {
        x: { ticks: { maxTicksLimit: 7, maxRotation: 0 } },
        y: { beginAtZero: true },
      },
    },
  });
}

// Adds the newest second on the right and removes the oldest one on the left.
export function addSecond(chart, label, people, bots) {
  chart.data.labels.push(label);
  chart.data.labels.shift();
  chart.data.datasets[0].data.push(people);
  chart.data.datasets[0].data.shift();
  chart.data.datasets[1].data.push(bots);
  chart.data.datasets[1].data.shift();
  chart.update();
}

// Horizontal stacked bars: changes per wiki, split into people and bots.
export function createWikiChart(canvas) {
  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [
        { label: 'People', data: [], backgroundColor: PEOPLE },
        { label: 'Bots', data: [], backgroundColor: BOTS },
      ],
    },
    options: {
      indexAxis: 'y',
      animation: { duration: 300 },
      scales: { x: { stacked: true }, y: { stacked: true } },
    },
  });
}

export function updateWikiChart(chart, wikis) {
  chart.data.labels = wikis.map((wiki) => wiki.wiki);
  chart.data.datasets[0].data = wikis.map((wiki) => wiki.people);
  chart.data.datasets[1].data = wikis.map((wiki) => wiki.bots);
  chart.update();
}

// Bar chart: pageviews per day of one article. Replaces the chart of the previous article.
let viewsChart = null;

export function showViewsChart(canvas, days) {
  if (viewsChart) viewsChart.destroy();
  viewsChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: days.map((day) => day.day.slice(5)), // "2026-11-08" -> "11-08"
      datasets: [{ label: 'Views', data: days.map((day) => day.views), backgroundColor: PEOPLE }],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { x: { ticks: { maxTicksLimit: 6, maxRotation: 0 } }, y: { beginAtZero: true } },
    },
  });
}
