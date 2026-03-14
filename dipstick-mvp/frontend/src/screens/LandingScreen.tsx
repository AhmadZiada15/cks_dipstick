/**
 * LandingScreen — UroSense branded
 * ==================================
 * Dark navy gradient background with teal accents.
 * "Begin Screening" → intake → capture flow.
 */

import React from 'react';

interface LandingScreenProps {
  onStart: () => void;
  onDemo: () => void;
  onClinician: () => void;
}

export default function LandingScreen({ onStart, onDemo, onClinician }: LandingScreenProps) {
  return (
    <div style={styles.outerWrapper}>
      <div style={styles.phoneFrame}>
        {/* Dark navy hero */}
        <div style={styles.hero}>
          {/* Logo */}
          <div style={styles.logoBox}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <ellipse cx="13" cy="16" rx="9" ry="12" stroke="white" strokeWidth="2" fill="none" />
              <ellipse cx="19" cy="16" rx="9" ry="12" stroke="white" strokeWidth="2" fill="none" opacity="0.6" />
            </svg>
          </div>
          <h1 style={styles.appName}>UroSense</h1>
          <p style={styles.taglineSmall}>Early Kidney Risk Detection</p>

          <p style={styles.description}>
            Detect early signs of kidney disease from home using a standard
            dipstick and your phone camera.
          </p>

          {/* Trust badges */}
          <div style={styles.badgeRow}>
            {['Clinically validated', 'RAG-based guidelines', 'HIPAA compliant'].map((text) => (
              <span key={text} style={styles.badge}>{text}</span>
            ))}
          </div>
        </div>

        {/* White bottom sheet */}
        <div style={styles.bottomSheet}>
          <button style={styles.primaryBtn} onClick={onStart}>
            Begin Screening
          </button>
          <button style={styles.secondaryBtn} onClick={onDemo}>
            Try Demo (no photo needed)
          </button>
          <button style={styles.clinicianLink} onClick={onClinician}>
            Clinician Dashboard &rarr;
          </button>

          <p style={styles.disclaimer}>
            This is a screening tool, not a medical diagnosis.
            Always consult a healthcare professional.
          </p>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  outerWrapper: {
    minHeight: '100vh',
    backgroundColor: '#F0F4F8',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: '24px',
    paddingBottom: '24px',
  },
  phoneFrame: {
    width: '100%',
    maxWidth: '430px',
    minHeight: '844px',
    borderRadius: '40px',
    boxShadow: '0 25px 60px rgba(0,0,0,0.18)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  hero: {
    flex: 1,
    background: 'linear-gradient(160deg, #0F2744 0%, #1a4a6b 100%)',
    padding: '56px 24px 32px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
  },
  logoBox: {
    width: '64px',
    height: '64px',
    borderRadius: '18px',
    backgroundColor: 'rgba(255,255,255,0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    color: '#FFFFFF',
    fontSize: '36px',
    fontWeight: 800,
    margin: 0,
    letterSpacing: '-0.5px',
  },
  taglineSmall: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: '16px',
    margin: 0,
  },
  description: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: '16px',
    textAlign: 'center',
    maxWidth: '300px',
    lineHeight: 1.6,
    margin: '12px 0 16px',
  },
  badgeRow: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '8px',
  },
  badge: {
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: '20px',
    padding: '6px 14px',
    fontSize: '12px',
    color: 'rgba(255,255,255,0.85)',
  },
  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: '24px 24px 0 0',
    padding: '28px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  primaryBtn: {
    width: '100%',
    height: '54px',
    backgroundColor: '#0D9488',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '14px',
    fontSize: '17px',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(13,148,136,0.35)',
  },
  secondaryBtn: {
    width: '100%',
    height: '54px',
    backgroundColor: 'transparent',
    border: '1.5px solid #E2E8F0',
    borderRadius: '14px',
    color: '#1E293B',
    fontSize: '17px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  clinicianLink: {
    width: '100%',
    background: 'none',
    border: 'none',
    color: '#94A3B8',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'center',
    marginTop: '8px',
  },
  disclaimer: {
    fontSize: '11px',
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 1.5,
    margin: '8px 0 0',
  },
};
