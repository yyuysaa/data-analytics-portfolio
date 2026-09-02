/**
 * sources-store.js — shared in-memory store for the most recent KB sources.
 *
 * llm-proxy.js calls setLastSources() after each speech turn.
 * index.js mounts GET /api/sources-stream (SSE) and registers clients here.
 * The moment setLastSources() is called, all connected SSE clients are pushed
 * the new links immediately — no polling needed.
 */

const _sseClients = new Set();
let   _lastSources = [];

/** Register a new SSE response object. Returns an unsubscribe function. */
export function addSseClient(res) {
  _sseClients.add(res);
  return () => _sseClients.delete(res);
}

/** Store links and immediately push them to every connected SSE client. */
export function setLastSources(links) {
  _lastSources = Array.isArray(links) ? links : [];
  if (_sseClients.size === 0 || !_lastSources.length) return;
  const payload = `data: ${JSON.stringify({ links: _lastSources })}\n\n`;
  for (const client of _sseClients) {
    try { client.write(payload); } catch { /* client disconnected */ }
  }
}

export function getLastSources() {
  return _lastSources;
}
