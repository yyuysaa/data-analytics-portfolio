/**
 * llm-proxy.js — OpenAI-compatible /v2/chat/completions endpoint
 *
 * Tavus calls this endpoint when the user speaks to the avatar.
 * We intercept the user's message, send it to the Hartnell chatbot,
 * rewrite the answer with Gemini, then stream it back in OpenAI SSE format.
 *
 * Tavus expects:
 *   POST /v2/chat/completions
 *   Body: OpenAI ChatCompletion request { model, messages, stream: true }
 *
 * We respond with:
 *   Content-Type: text/event-stream
 *   data: { id, object, choices: [{ delta: { content: "..." } }] }
 *   data: [DONE]
 */

import { randomUUID } from 'crypto';
import { getChatbotResponse } from './chatbot.js';
import { conversationalRewrite } from './rewrite.js';
import { setLastSources } from './sources-store.js';
// ── (email/transcript feature) capture the spoken video conversation ──
import { addVideoExchange } from './video-transcript.js';

/**
 * Extract the latest user message from an OpenAI messages array.
 * Skips system messages (those are our own context injections).
 */
function extractUserMessage(messages) {
  // Walk backwards to find the most recent user turn
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      const content = messages[i].content;
      // content can be a string or an array of parts
      if (typeof content === 'string') return content;
      if (Array.isArray(content)) {
        return content
          .filter(p => p.type === 'text')
          .map(p => p.text)
          .join(' ');
      }
    }
  }
  return null;
}

/**
 * Detect language from the model name (hartnell-chatbot-en / hartnell-chatbot-es)
 * or fall back to scanning system messages.
 */
function detectLanguage(model, messages) {
  // Primary: model name carries the language
  if (typeof model === 'string') {
    if (model.endsWith('-es')) return 'es';
    if (model.endsWith('-en')) return 'en';
  }
  // Fallback: scan system messages
  for (const msg of messages) {
    if (msg.role === 'system') {
      const c = typeof msg.content === 'string' ? msg.content : '';
      if (c.includes('español') || c.includes('Siempre responde en español')) return 'es';
    }
  }
  return 'en';
}

/**
 * Stream a text string back as OpenAI-compatible SSE chunks.
 * Breaks the text into ~6-word chunks to start streaming quickly
 * so Tavus TTS can begin speaking before the full answer arrives.
 */
function streamText(res, text, completionId) {
  const words = text.split(' ');
  const CHUNK_SIZE = 6;

  for (let i = 0; i < words.length; i += CHUNK_SIZE) {
    const chunk = words.slice(i, i + CHUNK_SIZE).join(' ') + (i + CHUNK_SIZE < words.length ? ' ' : '');
    const payload = {
      id: completionId,
      object: 'chat.completion.chunk',
      choices: [{ delta: { content: chunk }, index: 0, finish_reason: null }],
    };
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }

  // Final chunk with finish_reason
  const finalPayload = {
    id: completionId,
    object: 'chat.completion.chunk',
    choices: [{ delta: {}, index: 0, finish_reason: 'stop' }],
  };
  res.write(`data: ${JSON.stringify(finalPayload)}\n\n`);
  res.write('data: [DONE]\n\n');
  res.end();
}

/**
 * Express route handler for POST /v2/chat/completions
 * Mount this in index.js as:
 *   app.post('/v2/chat/completions', llmProxyHandler);
 */
export async function llmProxyHandler(req, res) {
  const { messages, model } = req.body || {};

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const userMessage = extractUserMessage(messages);
  const language    = detectLanguage(model, messages);

  if (!userMessage) {
    // No user turn found — return an empty completion so Tavus doesn't error
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.write('data: [DONE]\n\n');
    return res.end();
  }

  // Set up SSE headers before any async work
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const completionId = `chatcmpl-${randomUUID()}`;

  // Send an initial empty chunk immediately to keep the connection alive
  // while we fetch from Bedrock + Gemini (can take 5-8s)
  const keepAlive = setInterval(() => {
    res.write(`: keepalive\n\n`);
  }, 2000);

  try {
    console.log(`[llm-proxy] user said: "${userMessage.slice(0, 80)}…" (lang=${language}, model=${model || 'unknown'})`);

    const pairId    = randomUUID();
    const { text: rawAnswer, sourcesText } = await getChatbotResponse(userMessage, pairId);

    // Store sources so the frontend can fetch them after the speech turn
    setLastSources(sourcesText ? sourcesText.split('\n').filter(Boolean) : []);

    const spoken = await conversationalRewrite(rawAnswer, language);

    clearInterval(keepAlive);
    // ── (email/transcript feature) record this video exchange for the transcript ──
    addVideoExchange(userMessage, spoken);
    console.log(`[llm-proxy] streaming ${spoken.length} chars back to Tavus (lang=${language})`);
    streamText(res, spoken, completionId);
  } catch (err) {
    clearInterval(keepAlive);
    console.error('[llm-proxy] error:', err.message);

    // Stream a graceful fallback so the avatar says something instead of freezing
    const fallback = language === 'es'
      ? 'Lo siento, tuve un problema al obtener esa información. Por favor intenta de nuevo.'
      : 'Sorry, I had trouble getting that information. Please try again.';
    streamText(res, fallback, completionId);
  }
}
