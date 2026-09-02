/**
 * ModeSelect
 * Full-screen gate shown before any interaction.
 * Calls onSelect('video') or onSelect('text') and is then unmounted by App.
 */

const styles = {
  overlay: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    background: '#f0f4f8',
    padding: 24,
  },
  heading: {
    fontSize: '1.4rem',
    fontWeight: 600,
    color: '#1a3a5c',
    textAlign: 'center',
  },
  sub: {
    fontSize: '0.95rem',
    color: '#4a5568',
    textAlign: 'center',
    marginTop: -16,
  },
  buttonRow: {
    display: 'flex',
    gap: 20,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  button: {
    padding: '18px 48px',
    fontSize: '1.1rem',
    fontWeight: 600,
    borderRadius: 12,
    border: '2px solid #1a3a5c',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    minWidth: 200,
    textAlign: 'center',
  },
  video: {
    background: '#1a3a5c',
    color: '#fff',
  },
  text: {
    background: '#fff',
    color: '#1a3a5c',
  },
};

export default function ModeSelect({ onSelect }) {
  return (
    <div style={styles.overlay}>
      <h1 style={styles.heading}>Welcome to PersonifyIT</h1>
      <p style={styles.sub}>
        How would you like to get help today?
      </p>
      <div style={styles.buttonRow}>
        <button
          style={{ ...styles.button, ...styles.video }}
          onClick={() => onSelect('video')}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          🎥 &nbsp;Video Assistant
        </button>
        <button
          style={{ ...styles.button, ...styles.text }}
          onClick={() => onSelect('text')}
          onMouseEnter={e => (e.currentTarget.style.background = '#eef2f7')}
          onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
        >
          💬 &nbsp;Text Chat
        </button>
      </div>
    </div>
  );
}
