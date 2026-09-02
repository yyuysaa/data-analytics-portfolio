import { useState, useEffect, useRef } from 'react';
import ModeSelect from './components/ModeSelect.jsx';
import ChatPanel from './components/ChatPanel.jsx';
import VideoPanel from './components/VideoPanel.jsx';
// ── Post-session (email + rating feature) ──
import PostSessionPanel from './components/PostSessionPanel.jsx';

const styles = {
  app: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
  },
  header: {
    background: '#1a3a5c',
    color: '#fff',
    padding: '12px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: '1.1rem',
    fontWeight: 600,
    letterSpacing: '0.02em',
  },
  headerSub: {
    fontSize: '0.75rem',
    opacity: 0.7,
    marginTop: 2,
  },
  main: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
    gap: 0,
  },
  mainTextOnly: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
};

export default function App() {
  // mode is null until user picks — gates the UI
  const [mode, setMode] = useState(null); // 'video' | 'text' | null

  // CVI session state (only used in video mode)
  const [sessionStarted, setSessionStarted]           = useState(false);
  const [conversationUrl, setConversationUrl]         = useState(null);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [conversationError, setConversationError]     = useState(null);
  // ── Post-session state (email + rating feature) ──
  const [sessionEnded, setSessionEnded]               = useState(false);
  const [transcript, setTranscript]                   = useState([]);
  const [sessionId]                                   = useState(() =>
    (crypto?.randomUUID?.() ?? `sess-${Date.now()}`)
  );

  // ── Idle timeout: end video session after 2 minutes of no user activity ────
  const IDLE_TIMEOUT_MS = 2 * 60 * 1000;
  const idleTimerRef = useRef(null);

  useEffect(() => {
    if (mode !== 'video' || !sessionStarted || sessionEnded) return;

    function resetIdleTimer() {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        console.log('[idle] 5 minutes idle — ending video session');
        setSessionStarted(false);
        setConversationUrl(null);
        setSessionEnded(true);
      }, IDLE_TIMEOUT_MS);
    }

    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'pointerdown', 'scroll'];
    events.forEach(e => window.addEventListener(e, resetIdleTimer));
    resetIdleTimer();

    return () => {
      events.forEach(e => window.removeEventListener(e, resetIdleTimer));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [mode, sessionStarted, sessionEnded]);

  function handleModeSelect(selected) {
    setMode(selected);
    setSessionStarted(false);
    setConversationUrl(null);
    setConversationLoading(false);
    setConversationError(null);
    setSessionEnded(false);
  }

  function handleReset() {
    setMode(null);
    setSessionStarted(false);
    setConversationUrl(null);
    setConversationLoading(false);
    setConversationError(null);
    setSessionEnded(false);
  }

  function handleStartSession() {
    setSessionStarted(true);
  }

  // Gate: show mode picker
  if (!mode) {
    return (
      <div style={styles.app}>
        <header style={styles.header}>
          <div>
            <div style={styles.headerTitle}>PersonifyIT</div>
            <div style={styles.headerSub}>Hartnell College IT Support</div>
          </div>
        </header>
        <ModeSelect onSelect={handleModeSelect} />
      </div>
    );
  }

  // Text-only mode: full-screen chat, no video panel
  if (mode === 'text') {
    return (
      <div style={styles.app}>
        <header style={styles.header}>
          <div>
            <div style={styles.headerTitle}>PersonifyIT</div>
            <div style={styles.headerSub}>Hartnell College IT Support</div>
          </div>
          <button
            onClick={handleReset}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 6,
              color: '#fff',
              cursor: 'pointer',
              fontSize: '0.8rem',
              padding: '4px 12px',
            }}
            title="Change mode"
          >
            💬 Text Chat
          </button>
        </header>

        <main style={styles.mainTextOnly}>
          <ChatPanel
            language="en"
            sessionStarted={false}
            onConversationReady={() => {}}
            onConversationLoading={() => {}}
            onConversationError={() => {}}
            onMessagesChange={setTranscript}
            fullWidth
            mode="text"
          />
        </main>

        {sessionEnded ? (
          <PostSessionPanel
            language="en"
            sessionId={sessionId}
            transcript={transcript}
            agentId="alex-it-support"
            onDone={() => { setSessionEnded(false); handleReset(); }}
          />
        ) : (
          <button
            onClick={() => setSessionEnded(true)}
            style={{
              flexShrink: 0,
              padding: '10px 0',
              background: '#c53030',
              border: 'none',
              borderTop: '1px solid #d1dde8',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            End Session
          </button>
        )}
      </div>
    );
  }

  // Video mode: side-by-side video + chat
  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div>
          <div style={styles.headerTitle}>PersonifyIT</div>
          <div style={styles.headerSub}>Hartnell College IT Support</div>
        </div>
        <button
          onClick={handleReset}
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: 6,
            color: '#fff',
            cursor: 'pointer',
            fontSize: '0.8rem',
            padding: '4px 12px',
          }}
          title="Change mode"
        >
          🎥 Video Assistant
        </button>
      </header>

      <main style={styles.main}>
        <VideoPanel
          conversationUrl={conversationUrl}
          language="en"
          loading={conversationLoading}
          error={conversationError}
          onStart={handleStartSession}
        />
        <ChatPanel
          language="en"
          sessionStarted={sessionStarted}
          onMessagesChange={setTranscript}
          onConversationReady={(url) => {
            setConversationUrl(url);
            setConversationLoading(false);
            setConversationError(null);
          }}
          onConversationLoading={() => {
            setConversationUrl(null);
            setConversationLoading(true);
            setConversationError(null);
          }}
          onConversationError={(msg) => {
            setConversationUrl(null);
            setConversationLoading(false);
            setConversationError(msg);
          }}
          mode="video"
        />
      </main>

      {/* ── Post-session panel (email + rating feature) ─────────────────── */}
      {sessionEnded ? (
        <PostSessionPanel
          language="en"
          sessionId={sessionId}
          transcript={transcript}
          agentId="alex-it-support"
          onDone={() => { setSessionEnded(false); handleReset(); }}
        />
      ) : (
        <button
          onClick={() => {
            setSessionStarted(false);
            setConversationUrl(null);
            setSessionEnded(true);
          }}
          style={{
            flexShrink: 0,
            padding: '10px 0',
            background: '#c53030',
            border: 'none',
            borderTop: '1px solid #d1dde8',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 600,
          }}
        >
          End Session
        </button>
      )}
    </div>
  );
}
