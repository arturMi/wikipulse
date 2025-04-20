import { parseChange } from './stats.js';

// Public stream of all changes on Wikipedia, Wikidata, Commons and the other Wikimedia wikis.
// It uses Server-Sent Events (SSE): the server keeps the connection open and pushes events.
const STREAM_URL = 'https://stream.wikimedia.org/v2/stream/recentchange';

// Opens the stream. EventSource is built into the browser and reconnects by itself
// after network errors, so we only need to show the status.
export function connectToStream(onChange, onStatus) {
  const source = new EventSource(STREAM_URL);

  source.onopen = () => onStatus('live');
  source.onerror = () => onStatus('reconnecting');
  source.onmessage = (message) => {
    const change = parseChange(message.data, Date.now());
    if (change) onChange(change);
  };

  return source;
}
