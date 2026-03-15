import React, { useEffect, useMemo, useState } from 'react';
import AppShell from '../components/AppShell';

const TOTAL_SECONDS = 60;
const CIRCLE_RADIUS = 54;
const CIRCLE_LENGTH = 2 * Math.PI * CIRCLE_RADIUS;

interface TimerScreenProps {
  onBack: () => void;
  onContinue: (reactionSkipped: boolean) => void;
}

export default function TimerScreen({ onBack, onContinue }: TimerScreenProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(TOTAL_SECONDS);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSecondsRemaining((current) => (current > 0 ? current - 1 : 0));
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const progress = useMemo(
    () => (TOTAL_SECONDS - secondsRemaining) / TOTAL_SECONDS,
    [secondsRemaining],
  );
  const dashOffset = CIRCLE_LENGTH * (1 - progress);
  const isComplete = secondsRemaining === 0;

  return (
    <AppShell hideHeader>
      <div style={styles.wrapper}>
        <div style={styles.header}>
          <button style={styles.backBtn} onClick={onBack} aria-label="Go back">
            <BackGlyph />
          </button>
          <div>
            <div style={styles.headerEyebrow}>Reaction timer</div>
            <h1 style={styles.headerTitle}>Step 2: Allow strip to react</h1>
            <p style={styles.headerSubtitle}>Wait 60 seconds after dipping before scanning.</p>
          </div>
        </div>

        <div style={styles.timerCard}>
          <div style={styles.timerCircleWrap}>
            <svg width="140" height="140" viewBox="0 0 140 140" aria-hidden="true">
              <circle
                cx="70"
                cy="70"
                r={CIRCLE_RADIUS}
                fill="none"
                stroke="#E2E8F0"
                strokeWidth="10"
              />
              <circle
                cx="70"
                cy="70"
                r={CIRCLE_RADIUS}
                fill="none"
                stroke="#8B6A4D"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={CIRCLE_LENGTH}
                strokeDashoffset={dashOffset}
                transform="rotate(-90 70 70)"
              />
            </svg>
            <div style={styles.timerText}>
              <div style={styles.timerValue}>{secondsRemaining}</div>
              <div style={styles.timerLabel}>seconds</div>
            </div>
          </div>

          <p style={styles.noteText}>
            Scanning after the reaction window helps keep color matching more reliable.
          </p>
        </div>

        <button
          style={{
            ...styles.primaryButton,
            opacity: isComplete ? 1 : 0.45,
            cursor: isComplete ? 'pointer' : 'not-allowed',
          }}
          onClick={() => isComplete && onContinue(false)}
          disabled={!isComplete}
        >
          Continue to scan
        </button>

        <button style={styles.skipLink} onClick={() => onContinue(true)}>
          Skip (not recommended)
        </button>
      </div>
    </AppShell>
  );
}

function BackGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M15 18L9 12L15 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    paddingTop: '8px',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
  },
  backBtn: {
    width: '36px',
    height: '36px',
    border: '1px solid #E2E8F0',
    backgroundColor: '#FFFFFF',
    borderRadius: '10px',
    color: '#7C5A3A',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  },
  headerEyebrow: {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.6px',
    textTransform: 'uppercase',
    color: '#64748B',
    marginBottom: '4px',
  },
  headerTitle: {
    margin: 0,
    fontSize: '24px',
    lineHeight: 1.2,
    fontWeight: 700,
    color: '#7C5A3A',
  },
  headerSubtitle: {
    margin: '6px 0 0',
    fontSize: '14px',
    lineHeight: 1.5,
    color: '#475569',
  },
  timerCard: {
    border: '1px solid #E2E8F0',
    borderRadius: '16px',
    backgroundColor: '#FFFFFF',
    padding: '24px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '18px',
  },
  timerCircleWrap: {
    position: 'relative',
    width: '140px',
    height: '140px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerValue: {
    fontSize: '36px',
    fontWeight: 700,
    lineHeight: 1,
    color: '#7C5A3A',
  },
  timerLabel: {
    marginTop: '6px',
    fontSize: '12px',
    fontWeight: 600,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    color: '#64748B',
  },
  noteText: {
    margin: 0,
    fontSize: '13px',
    lineHeight: 1.5,
    color: '#475569',
    textAlign: 'center',
    maxWidth: '260px',
  },
  primaryButton: {
    height: '48px',
    border: 'none',
    borderRadius: '12px',
    backgroundColor: '#8B6A4D',
    color: '#FFFFFF',
    fontSize: '16px',
    fontWeight: 700,
    boxShadow: '0 6px 16px rgba(111,78,55,0.18)',
  },
  skipLink: {
    border: 'none',
    background: 'transparent',
    color: '#7C5A3A',
    fontSize: '14px',
    fontWeight: 600,
    padding: 0,
    alignSelf: 'center',
    cursor: 'pointer',
  },
};
