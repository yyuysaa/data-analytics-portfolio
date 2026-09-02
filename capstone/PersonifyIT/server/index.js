/**
 * PersonifyIT — Express backend (CVI edition)
 *
 * POST /api/start-conversation  → { conversationId, conversationUrl }
 * POST /api/end-conversation    → 204
 * POST /api/chat                → { text }  (text-chat still available alongside CVI)
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { getChatbotResponse } from './chatbot.js';
import { createConversation, endConversation } from './tavus.js';
import { llmProxyHandler } from './llm-proxy.js';
// ── Session storage (email + rating feature) ──
import sessionsRouter from './routes/sessions.js';
import { getLastSources, addSseClient } from './sources-store.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Bypass ngrok's free-tier browser interstitial warning
app.use((req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true');
  next();
});

// ---------------------------------------------------------------------------
// GET /api/sources-stream — SSE endpoint
// Frontend subscribes once; server pushes { links: [...] } after every
// speech turn (llm-proxy.js → setLastSources → broadcast).
// ---------------------------------------------------------------------------
app.get('/api/sources-stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Keep-alive heartbeat every 20 s to prevent proxy/browser timeouts
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 20000);
  const unsubscribe = addSseClient(res);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

// ---------------------------------------------------------------------------
// GET /api/last-sources — one-shot fallback (returns most recent sources)
// ---------------------------------------------------------------------------
app.get('/api/last-sources', (req, res) => {
  res.json({ links: getLastSources() });
});

// ---------------------------------------------------------------------------
// POST /v2/chat/completions  (OpenAI-compatible LLM proxy for Tavus CVI)
// Tavus calls this endpoint when the user speaks to the avatar.
// Only accessible when TAVUS_LLM_PROXY_KEY is set and matches the header.
// ---------------------------------------------------------------------------
app.post('/v2/chat/completions', (req, res) => {
  const proxyKey = process.env.TAVUS_LLM_PROXY_KEY;
  if (proxyKey) {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (token !== proxyKey) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
  return llmProxyHandler(req, res);
});

// ---------------------------------------------------------------------------
// POST /api/start-conversation
// Body:     { language: 'en' | 'es' }
// Response: { conversationId: string, conversationUrl: string }
//
// Creates a Tavus CVI session. The client embeds conversation_url in an iframe
// and the talking-head avatar is live immediately — no polling needed.
// ---------------------------------------------------------------------------
app.post('/api/start-conversation', async (req, res) => {
  const { language } = req.body;

  if (!['en', 'es'].includes(language)) {
    return res.status(400).json({ error: 'language must be "en" or "es"' });
  }

  try {
    const { conversationId, conversationUrl, palId } = await createConversation(language);
    res.json({ conversationId, conversationUrl, palId });
  } catch (err) {
    console.error('[/api/start-conversation]', err);
    res.status(500).json({ error: err.message || 'Failed to start conversation' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/end-conversation
// Body:     { conversationId: string }
// Response: 204 No Content
//
// Ends the Tavus CVI session when the user leaves or resets language.
// ---------------------------------------------------------------------------
app.post('/api/end-conversation', async (req, res) => {
  const { conversationId } = req.body;

  if (!conversationId || typeof conversationId !== 'string') {
    return res.status(400).json({ error: 'conversationId is required' });
  }

  try {
    const { palId } = req.body;
    await endConversation(conversationId, palId || null);
    res.sendStatus(204);
  } catch (err) {
    // Non-fatal — log and still return success so the client can move on
    console.error('[/api/end-conversation]', err);
    res.sendStatus(204);
  }
});

// ---------------------------------------------------------------------------
// POST /api/chat
// Body:     { message: string, language: 'en' | 'es' }
// Response: { text: string }
//
// Text-only chat path — still available as a fallback alongside the CVI panel.
// Returns the rewritten answer immediately; no video job.
// ---------------------------------------------------------------------------
app.post('/api/chat', async (req, res) => {
  const { message, language } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required' });
  }

  const lang = ['en', 'es'].includes(language) ? language : 'en';

  try {
    const pairId = randomUUID();
    const { text, sourcesText } = await getChatbotResponse(message, pairId);
    res.json({ text, sourcesText });
  } catch (err) {
    console.error('[/api/chat]', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// ── Session storage (email + rating feature) ──
app.use(sessionsRouter);

// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`PersonifyIT server running on http://localhost:${PORT}`);
});
