import { useState } from 'react';

/**
 * EndSessionPrompt — asks the user if they'd like a copy of the conversation
 * emailed to them. Declining is a normal path.
 *
 * Self-contained. Reports its outcome via callbacks; does not persist anything
 * itself (the parent decides what to do with the email).
 *
 * Props:
 *   language   — 'en' | 'es'
 *   onProvide  — (email: string) => void   called when user submits an address
 *   onDecline  — () => void                 called when user declines
 */

const LABELS = {
  en: {
    question: 'Would you like a copy of this conversation sent to your email?',
    placeholder: 'you@example.com',
    send: 'Send me a copy',
    decline: 'No thanks',
    invalid: 'Please enter a valid email.',
    sent: "Great — we'll send it over shortly.",
  },
  es: {
    question: '¿Te gustaría recibir una copia de esta conversación por correo?',
    placeholder: 'tu@ejemplo.com',
    send: 'Enviarme una copia',
    decline: 'No, gracias',
    invalid: 'Por favor ingresa un correo válido.',
    sent: 'Perfecto — te la enviaremos en breve.',
  },
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    padding: '8px 4px',
  },
  question: {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: '#1a202c',
    textAlign: 'center',
    margin: 0,
  },
  input: {
    width: '100%',
    maxWidth: 320,
    padding: '10px 14px',
    border: '1px solid #c5d0dc',
    borderRadius: 8,
    fontSize: '0.9rem',
    fontFamily: 'inherit',
  },
  row: {
    display: 'flex',
    gap: 10,
  },
  sendBtn: {
    padding: '9px 18px',
    background: '#1a3a5c',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  declineBtn: {
    padding: '9px 18px',
    background: 'transparent',
    color: '#64748b',
    border: '1px solid #c5d0dc',
    borderRadius: 8,
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  error: {
    fontSize: '0.78rem',
    color: '#c0392b',
    margin: 0,
  },
  sent: {
    fontSize: '0.9rem',
    color: '#2d7a4f',
    fontWeight: 500,
    margin: 0,
  },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EndSessionPrompt({ language = 'en', onProvide, onDecline }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const t = LABELS[language] || LABELS.en;

  function handleSend() {
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setError(t.invalid);
      return;
    }
    setError('');
    setSubmitted(true);
    onProvide(trimmed);
  }

  if (submitted) {
    return <p style={styles.sent}>{t.sent}</p>;
  }

  return (
    <div style={styles.container}>
      <p style={styles.question}>{t.question}</p>
      <input
        type="email"
        style={styles.input}
        placeholder={t.placeholder}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        aria-label={t.question}
      />
      {error && <p style={styles.error}>{error}</p>}
      <div style={styles.row}>
        <button style={styles.sendBtn} onClick={handleSend}>
          {t.send}
        </button>
      </div>
    </div>
  );
}
