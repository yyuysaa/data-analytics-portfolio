import { useState } from 'react';

/**
 * SessionRating — 1–5 star rating shown at end of session.
 * Low-rating reason field (text) appears only when rating is ≤ 2.
 *
 * Props:
 *   language   — 'en' | 'es'
 *   onSubmit   — (rating: number, reason: string|null) => void
 */

const LABELS = {
  en: {
    title: 'How was your experience?',
    reasonPlaceholder: 'What could we improve?',
    submit: 'Submit',
    thanks: 'Thanks for your feedback!',
  },
  es: {
    title: '¿Cómo fue tu experiencia?',
    reasonPlaceholder: '¿Qué podríamos mejorar?',
    submit: 'Enviar',
    thanks: '¡Gracias por tu opinión!',
  },
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    padding: '32px 24px',
    background: '#f8fafc',
    borderTop: '1px solid #d1dde8',
  },
  title: {
    fontSize: '1.05rem',
    fontWeight: 600,
    color: '#1a202c',
    margin: 0,
  },
  stars: {
    display: 'flex',
    gap: 8,
  },
  star: {
    fontSize: '2rem',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    padding: 0,
    transition: 'transform 0.1s',
    color: '#d4a017',
  },
  reasonInput: {
    width: '100%',
    maxWidth: 360,
    padding: '10px 14px',
    border: '1px solid #c5d0dc',
    borderRadius: 8,
    fontSize: '0.9rem',
    fontFamily: 'inherit',
    resize: 'vertical',
    minHeight: 60,
  },
  submitBtn: {
    padding: '10px 28px',
    background: '#1a3a5c',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  thanks: {
    fontSize: '1rem',
    color: '#2d7a4f',
    fontWeight: 500,
  },
};

export default function SessionRating({ language = 'en', onSubmit }) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const t = LABELS[language] || LABELS.en;

  function handleSubmit() {
    if (rating === 0) return;
    const lowRatingReason = rating <= 2 && reason.trim() ? reason.trim() : null;
    onSubmit(rating, lowRatingReason);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div style={styles.container}>
        <p style={styles.thanks}>{t.thanks}</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <p style={styles.title}>{t.title}</p>

      <div style={styles.stars} role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            style={{
              ...styles.star,
              transform: hovered === star ? 'scale(1.2)' : 'scale(1)',
            }}
            onClick={() => setRating(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
            aria-checked={rating === star}
            role="radio"
          >
            {star <= (hovered || rating) ? '★' : '☆'}
          </button>
        ))}
      </div>

      {rating > 0 && rating <= 2 && (
        <textarea
          style={styles.reasonInput}
          placeholder={t.reasonPlaceholder}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          aria-label={t.reasonPlaceholder}
        />
      )}

      {rating > 0 && (
        <button style={styles.submitBtn} onClick={handleSubmit}>
          {t.submit}
        </button>
      )}
    </div>
  );
}
