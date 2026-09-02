import { useEffect } from 'react';

/**
 * VideoPanel
 * Left-hand pane displaying the Tavus CVI talking-head conversation.
 *
 * States:
 *   idle    — session not started yet (avatar + "Start Session" button)
 *   loading — conversation request in flight (spinner)
 *   live    — conversation_url received (iframe with live avatar)
 *   error   — conversation failed to start
 *
 * Props:
 *   conversationUrl  — string | null
 *   language         — 'en' | 'es'
 *   loading          — boolean
 *   error            — string | null
 *   onStart          — () => void  called when user clicks Start Session
 */

const IDLE_LABELS = {
  en: 'Ready to connect with your IT assistant?',
  es: '¿Listo para conectarte con tu asistente de TI?',
};

const START_LABELS = {
  en: 'Start Session',
  es: 'Iniciar Sesión',
};

const LOADING_LABELS = {
  en: 'Starting your session…',
  es: 'Iniciando tu sesión…',
};

const styles = {
  panel: {
    flex: 1,
    minWidth: 0,
    background: '#0f2236',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  placeholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    color: '#7fa8cc',
    textAlign: 'center',
    padding: 24,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #1a3a5c 0%, #2a6496 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '2.8rem',
  },
  label: {
    fontSize: '0.9rem',
    lineHeight: 1.5,
    maxWidth: 260,
    opacity: 0.8,
  },
  errorLabel: {
    fontSize: '0.85rem',
    lineHeight: 1.5,
    maxWidth: 260,
    color: '#fc8181',
    textAlign: 'center',
  },
  badge: {
    position: 'absolute',
    bottom: 12,
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(0,0,0,0.45)',
    color: '#fff',
    fontSize: '0.7rem',
    padding: '3px 10px',
    borderRadius: 20,
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
  },
  startButton: {
    marginTop: 8,
    padding: '12px 32px',
    background: '#1a6496',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  spinner: {
    width: 48,
    height: 48,
    border: '4px solid rgba(127,168,204,0.2)',
    borderTop: '4px solid #7fa8cc',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
};

// Inject keyframes once
if (typeof document !== 'undefined') {
  const spinStyle = document.createElement('style');
  spinStyle.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(spinStyle);
}

export default function VideoPanel({ conversationUrl, language, loading, error, onStart }) {

  // Live CVI session — embed the Tavus conversation URL
  if (conversationUrl) {
    return (
      <div style={styles.panel}>
        <iframe
          key={conversationUrl}
          src={conversationUrl}
          allow="camera; microphone; autoplay; fullscreen; display-capture"
          style={{ width: '100%', height: '100%', border: 'none' }}
          title={language === 'es' ? 'Asistente de TI en vivo' : 'Live IT assistant'}
        />
        <div style={styles.badge}>PersonifyIT · Hartnell College</div>
      </div>
    );
  }

  // Conversation request in flight
  if (loading) {
    return (
      <div style={styles.panel}>
        <div style={styles.placeholder}>
          <div style={styles.spinner} aria-hidden="true" />
          <p style={styles.label}>{LOADING_LABELS[language]}</p>
        </div>
        <div style={styles.badge}>PersonifyIT · Hartnell College</div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={styles.panel}>
        <div style={styles.placeholder}>
          <div style={styles.avatar} role="img" aria-label="avatar">🎓</div>
          <p style={styles.errorLabel}>{error}</p>
          {onStart && (
            <button
              style={styles.startButton}
              onClick={onStart}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              {START_LABELS[language]}
            </button>
          )}
        </div>
        <div style={styles.badge}>PersonifyIT · Hartnell College</div>
      </div>
    );
  }

  // Idle — user must click to start (avoids burning CVI minutes on page load)
  return (
    <div style={styles.panel}>
      <div style={styles.placeholder}>
        <div style={styles.avatar} role="img" aria-label="avatar">🎓</div>
        <p style={styles.label}>{IDLE_LABELS[language]}</p>
        {onStart && (
          <button
            style={styles.startButton}
            onClick={onStart}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            {START_LABELS[language]}
          </button>
        )}
      </div>
      <div style={styles.badge}>PersonifyIT · Hartnell College</div>
    </div>
  );
}
