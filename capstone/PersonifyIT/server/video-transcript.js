/**
 * video-transcript.js — In-memory capture of the video-call conversation.
 *
 * The video (Tavus) conversation flows through llm-proxy.js as text:
 * user speech → STT → our proxy → chatbot answer → avatar speaks.
 * We accumulate each exchange here so it can be merged into the session
 * transcript that gets stored/emailed at the end.
 *
 * Prototype-simple: a single in-memory buffer (one active session at a time).
 * For multi-user production this would be keyed by conversationId.
 */

let buffer = [];

/**
 * Record one video-call exchange (user turn + agent turn).
 * @param {string} userText  — what the user said (speech-to-text)
 * @param {string} agentText — what the avatar replied
 */
export function addVideoExchange(userText, agentText) {
  const ts = new Date().toISOString();
  if (userText) buffer.push({ role: 'user', text: userText, ts, via: 'video' });
  if (agentText) buffer.push({ role: 'bot', text: agentText, ts, via: 'video' });
}

/** Return a copy of the captured video transcript. */
export function getVideoTranscript() {
  return [...buffer];
}

/** Clear the buffer (called when a session is saved or a new one starts). */
export function clearVideoTranscript() {
  buffer = [];
}
