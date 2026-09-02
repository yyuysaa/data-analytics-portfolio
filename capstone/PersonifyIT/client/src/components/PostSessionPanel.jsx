import { useRef } from 'react';
import EndSessionPrompt from './EndSessionPrompt.jsx';
import SessionRating from './SessionRating.jsx';

/**
 * PostSessionPanel — end-of-session flow. Combines two independent features
 * that both live at this moment:
 *   1. EndSessionPrompt — optional "email me a copy" (email/transcript feature)
 *   2. SessionRating    — 1–5 star rating (rating feature)
 *
 * Each posts to its own endpoint, correlated by a shared sessionId:
 *   - transcript + email → POST /api/transcript
 *   - rating + reason    → POST /api/sessions
 *
 * Neither call blocks the user (fire-and-forget); the panel closes when the
 * rating is submitted.
 *
 * Props:
 *   language    — 'en' | 'es'
 *   sessionId   — shared id correlating the two records
 *   transcript  — [{ role, text, ts }] captured during the session
 *   agentId
 *   onDone      — () => void, called after the rating is submitted
 */

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  panel: {
    background: '#fff',
    borderRadius: 12,
    width: '90%',
    maxWidth: 440,
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  title: {
    textAlign: 'center',
    fontSize: '1.15rem',
    fontWeight: 700,
    color: '#1a202c',
    margin: '0 0 4px 0',
  },
  divider: {
    border: 'none',
    borderTop: '1px solid #e2e8f0',
    margin: '16px 0 4px 0',
  },
};

export default function PostSessionPanel({
  language = 'en',
  sessionId,
  transcript = [],
  agentId = 'alex-it-support',
  onDone,
}) {
  // Store the email when provided (transcript still goes with the rating submit)
  const emailRef = useRef(null);

  function handleEmailProvide(email) {
    emailRef.current = email;
  }

  function handleEmailDecline() {
    emailRef.current = null;
  }

  function handleRatingSubmit(rating, lowRatingReason) {
    // Single POST — everything in one record
    fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        agentId,
        language,
        email: emailRef.current,
        rating,
        lowRatingReason,
        transcript,
      }),
    }).catch((err) => console.error('[PostSessionPanel] save failed:', err));

    if (onDone) setTimeout(onDone, 1500);
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.panel}>
        <p style={styles.title}>
          {language === 'es' ? 'Sesión finalizada' : 'Session ended'}
        </p>

        <EndSessionPrompt
          language={language}
          onProvide={handleEmailProvide}
          onDecline={handleEmailDecline}
        />

        <hr style={styles.divider} />

        <SessionRating language={language} onSubmit={handleRatingSubmit} />

        <button
          onClick={onDone}
          style={{
            marginTop: 12,
            padding: '10px 24px',
            background: 'transparent',
            color: '#64748b',
            border: '1px solid #c5d0dc',
            borderRadius: 8,
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            alignSelf: 'center',
          }}
        >
          No thanks
        </button>
      </div>
    </div>
  );
}
