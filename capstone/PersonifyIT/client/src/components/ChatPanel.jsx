import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * ChatPanel
 * Handles conversation UI and CVI session lifecycle.
 *
 * Session is NOT started automatically — the user must click "Start Session"
 * in VideoPanel, which triggers onStart() → passed down from App → calls
 * startSession() exposed via the ref or via the onStartRef prop pattern.
 *
 * Instead we use a simpler approach: App owns a `sessionStarted` boolean.
 * When true, ChatPanel starts the session in a useEffect.
 *
 * Props:
 *   language                      — 'en' | 'es'
 *   sessionStarted                — boolean, flips to true when user clicks Start
 *   onConversationReady(url, id)  — called when CVI session URL is ready
 *   onConversationLoading()       — called while session is starting
 *   onConversationError(msg)      — called if session fails to start
 */

const PLACEHOLDERS = {
  en: 'Type a follow-up question…',
  es: 'Escribe una pregunta de seguimiento…',
};

const SEND_LABELS     = { en: 'Send',      es: 'Enviar'    };
const THINKING_LABELS = { en: 'Thinking…', es: 'Pensando…' };

const ERROR_MSGS = {
  en: '⚠️ Could not start the video session. You can still type your questions below.',
  es: '⚠️ No se pudo iniciar la sesión de video. Aún puedes escribir tus preguntas abajo.',
};

const styles = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    width: 380,
    minWidth: 280,
    flexShrink: 0,
    borderLeft: '1px solid #d1dde8',
    background: '#fff',
    overflow: 'hidden',
  },
  panelFull: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    background: '#fff',
    overflow: 'hidden',
  },
  history: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  bubble: {
    maxWidth: '78%',
    padding: '10px 14px',
    borderRadius: 12,
    fontSize: '0.95rem',
    lineHeight: 1.55,
    wordBreak: 'break-word',
    whiteSpace: 'pre-wrap',
  },
  userBubble: {
    alignSelf: 'flex-end',
    background: '#1a3a5c',
    color: '#fff',
    borderBottomRightRadius: 3,
  },
  botBubble: {
    alignSelf: 'flex-start',
    background: '#eef2f7',
    color: '#1a202c',
    borderBottomLeftRadius: 3,
  },
  systemBubble: {
    alignSelf: 'center',
    background: 'transparent',
    color: '#718096',
    fontSize: '0.85rem',
    fontStyle: 'italic',
    padding: '4px 0',
    maxWidth: '90%',
    textAlign: 'center',
  },
  thinkingBubble: {
    alignSelf: 'flex-start',
    background: '#eef2f7',
    color: '#718096',
    borderBottomLeftRadius: 3,
    fontStyle: 'italic',
  },
  sourcesBubble: {
    alignSelf: 'flex-start',
    background: '#f0f4f8',
    color: '#4a5568',
    borderRadius: 12,
    borderBottomLeftRadius: 3,
    fontSize: '0.82rem',
    lineHeight: 1.6,
    borderLeft: '3px solid #a0aec0',
    maxWidth: '78%',
    padding: '10px 14px',
    wordBreak: 'break-word',
  },
  inputRow: {
    display: 'flex',
    gap: 10,
    padding: '14px 20px',
    borderTop: '1px solid #d1dde8',
    background: '#f8fafc',
    flexShrink: 0,
  },
  input: {
    flex: 1,
    padding: '10px 14px',
    border: '1px solid #c5d0dc',
    borderRadius: 8,
    fontSize: '0.95rem',
    outline: 'none',
    fontFamily: 'inherit',
    resize: 'none',
    lineHeight: 1.4,
  },
  sendButton: {
    padding: '10px 20px',
    background: '#1a3a5c',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.9rem',
    flexShrink: 0,
    transition: 'opacity 0.15s',
  },
};

export default function ChatPanel({
  language,
  sessionStarted,
  onConversationReady,
  onConversationLoading,
  onConversationError,
  onMessagesChange, // ── (email/transcript feature) optional: emits message list upward
  fullWidth,
  mode,
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const bottomRef               = useRef(null);
  const conversationIdRef       = useRef(null);
  const palIdRef                = useRef(null);

  // ── (email/transcript feature) mirror messages up to the parent so the
  //    post-session panel can store the transcript. No-op if prop not passed.
  useEffect(() => {
    if (onMessagesChange) onMessagesChange(messages);
  }, [messages, onMessagesChange]);

  // ── SSE: append sources bubble whenever the avatar finishes a speech turn ─
  useEffect(() => {
    const es = new EventSource('/api/sources-stream');

    es.onmessage = (event) => {
      try {
        const { links } = JSON.parse(event.data);
        if (links?.length) {
          setMessages(prev => [...prev, { role: 'sources', links }]);
        }
      } catch { /* malformed event — ignore */ }
    };

    return () => es.close();
  }, []);

  // ── Start CVI session when sessionStarted flips to true ───────────────────
  useEffect(() => {
    if (!sessionStarted) return;

    let cancelled = false;

    async function startSession() {
      onConversationLoading();

      try {
        const res = await fetch('/api/start-conversation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }

        const { conversationId, conversationUrl, palId } = await res.json();
        if (cancelled) return;

        conversationIdRef.current = conversationId;
        palIdRef.current = palId || null;
        onConversationReady(conversationUrl, conversationId);
      } catch (err) {
        if (cancelled) return;
        console.error('[chat] start-conversation failed:', err);
        onConversationError(ERROR_MSGS[language]);
        setMessages([{ role: 'system', text: ERROR_MSGS[language] }]);
      }
    }

    startSession();

    // End session on unmount or language reset
    return () => {
      cancelled = true;
      const id  = conversationIdRef.current;
      const pid = palIdRef.current;
      if (id) {
        fetch('/api/end-conversation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId: id, palId: pid }),
        }).catch(() => {});
        conversationIdRef.current = null;
        palIdRef.current = null;
      }
    };
  }, [sessionStarted, language]);

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // ── Text chat ──────────────────────────────────────────────────────────────
  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    setMessages(prev => [...prev, { role: 'user', text }]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, language, mode: mode || 'video' }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();

      const next = [{ role: 'bot', text: data.text }];
      if (data.sourcesText) {
        const links = data.sourcesText.split('\n').filter(Boolean);
        next.push({ role: 'sources', links });
      }
      setMessages(prev => [...prev, ...next]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          role: 'bot',
          text: language === 'es'
            ? '⚠️ Ocurrió un error. Por favor intenta de nuevo.'
            : '⚠️ Something went wrong. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div style={fullWidth ? styles.panelFull : styles.panel}>
      <div style={styles.history}>
        {messages.map((msg, i) => {
          if (msg.role === 'sources') {
            const label = language === 'es' ? '📄 Fuentes' : '📄 Sources';
            return (
              <div key={i} style={{ ...styles.bubble, ...styles.sourcesBubble }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{label}</div>
                <ol style={{ margin: 0, paddingLeft: 18 }}>
                  {msg.links.map((url, j) => (
                    <li key={j} style={{ marginBottom: 4 }}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#2b6cb0', wordBreak: 'break-all' }}
                      >
                        {url}
                      </a>
                    </li>
                  ))}
                </ol>
              </div>
            );
          }

          const style =
            msg.role === 'user'   ? { ...styles.bubble, ...styles.userBubble }   :
            msg.role === 'system' ? { ...styles.bubble, ...styles.systemBubble } :
                                    { ...styles.bubble, ...styles.botBubble };
          return <div key={i} style={style}>{msg.text}</div>;
        })}
        {loading && (
          <div style={{ ...styles.bubble, ...styles.thinkingBubble }}>
            {THINKING_LABELS[language]}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={styles.inputRow}>
        <textarea
          rows={1}
          style={styles.input}
          placeholder={PLACEHOLDERS[language]}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          aria-label={language === 'es' ? 'Mensaje' : 'Message'}
        />
        <button
          style={{
            ...styles.sendButton,
            opacity: loading || !input.trim() ? 0.5 : 1,
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
          }}
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          aria-label={SEND_LABELS[language]}
        >
          {loading ? '…' : SEND_LABELS[language]}
        </button>
      </div>
    </div>
  );
}
