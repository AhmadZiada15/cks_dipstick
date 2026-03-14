/**
 * LandingScreen
 * ==============
 * Onboarding / welcome screen.
 * Shows app purpose, a privacy note, and two CTAs:
 *   - "Scan a Test Strip" → capture screen
 *   - "Try Demo" → skip upload, hit /api/demo
 */

import React from 'react';
import AppShell from '../components/AppShell';
import DisclaimerCard from '../components/DisclaimerCard';

interface LandingScreenProps {
  onStart: () => void;
  onDemo: () => void;
}

export default function LandingScreen({ onStart, onDemo }: LandingScreenProps) {
  return (
    <AppShell hideHeader noPadding>
      {/* Hero gradient header */}
      <div style={styles.hero}>
        <div style={styles.appIcon}>💧</div>
        <h1 style={styles.appName}>DipCheck</h1>
        <p style={styles.tagline}>
          Urine dipstick screening,{'\n'}explained in plain language.
        </p>
      </div>

      <div style={styles.body}>
        {/* How it works */}
        <div style={styles.stepsCard}>
          <h2 style={styles.stepsTitle}>How it works</h2>
          {STEPS.map((step, i) => (
            <div key={i} style={styles.stepRow}>
              <div style={styles.stepNum}>{i + 1}</div>
              <div>
                <div style={styles.stepLabel}>{step.label}</div>
                <div style={styles.stepDesc}>{step.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Privacy note */}
        <div style={styles.privacyBox}>
          <span style={styles.privacyIcon}>🔒</span>
          <span style={styles.privacyText}>
            Photos are processed on-device or on a private server.
            No data is stored or shared.
          </span>
        </div>

        {/* CTAs */}
        <button style={styles.primaryBtn} onClick={onStart}>
          📷 Scan a Test Strip
        </button>
        <button style={styles.demoBtn} onClick={onDemo}>
          ▶ Try Demo (no photo needed)
        </button>

        {/* Disclaimer */}
        <DisclaimerCard />
      </div>
    </AppShell>
  );
}

const STEPS = [
  {
    label: 'Take or upload a photo',
    desc: 'Photograph your urine dipstick test strip.',
  },
  {
    label: 'AI reads the strip',
    desc: 'Color analysis extracts pad values automatically.',
  },
  {
    label: 'Rule-based interpretation',
    desc: 'Clinical logic identifies patterns — transparently.',
  },
  {
    label: 'Plain-language guidance',
    desc: 'Understand your results and next steps clearly.',
  },
];

const styles: Record<string, React.CSSProperties> = {
  hero: {
    background: 'linear-gradient(160deg, #4F46E5 0%, #7C3AED 100%)',
    padding: '48px 24px 36px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  appIcon: {
    fontSize: '52px',
    lineHeight: 1,
    filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))',
  },
  appName: {
    color: '#FFFFFF',
    fontSize: '32px',
    fontWeight: 800,
    margin: 0,
    letterSpacing: '-0.5px',
  },
  tagline: {
    color: '#C4B5FD',
    fontSize: '16px',
    textAlign: 'center',
    margin: 0,
    lineHeight: 1.5,
    whiteSpace: 'pre-line',
  },
  body: {
    padding: '20px 16px 32px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  stepsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    border: '1px solid #E2E8F0',
    padding: '18px',
  },
  stepsTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    margin: '0 0 14px',
  },
  stepRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    marginBottom: '12px',
  },
  stepNum: {
    minWidth: '28px',
    height: '28px',
    borderRadius: '50%',
    backgroundColor: '#EEF2FF',
    color: '#4F46E5',
    fontSize: '13px',
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepLabel: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1E293B',
    lineHeight: 1.3,
  },
  stepDesc: {
    fontSize: '13px',
    color: '#64748B',
    lineHeight: 1.4,
    marginTop: '2px',
  },
  privacyBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    backgroundColor: '#F0FDF4',
    borderRadius: '12px',
    padding: '12px',
    border: '1px solid #BBF7D0',
  },
  privacyIcon: {
    fontSize: '16px',
    flexShrink: 0,
  },
  privacyText: {
    fontSize: '13px',
    color: '#166534',
    lineHeight: 1.5,
  },
  primaryBtn: {
    padding: '16px',
    border: 'none',
    borderRadius: '14px',
    backgroundColor: '#4F46E5',
    color: '#FFFFFF',
    fontSize: '17px',
    fontWeight: 700,
    cursor: 'pointer',
    width: '100%',
    boxShadow: '0 4px 14px rgba(79,70,229,0.4)',
    transition: 'transform 0.1s, box-shadow 0.1s',
  },
  demoBtn: {
    padding: '14px',
    border: '2px solid #E0E7FF',
    borderRadius: '14px',
    backgroundColor: '#FFFFFF',
    color: '#4F46E5',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
  },
};
