/**
 * LandingScreen — UroSense branded
 * ==================================
 * Refined medical-tech landing page with a strong vertical rhythm and
 * a single bronze hero surface.
 */

import React from 'react';
import kidneyReference from '../assets/kidney-reference.png';

interface LandingScreenProps {
  onStart: () => void;
  onDemo: () => void;
  onClinician: () => void;
}

const HERO_FEATURES = [
  { label: 'Proactive Risk Assessment', icon: <ValidatedGlyph /> },
  { label: 'RAG-Based Guidelines', icon: <GuidelineGlyph /> },
  { label: 'HIPAA Compliant', icon: <ShieldGlyph /> },
] as const;

export default function LandingScreen({ onStart, onDemo, onClinician }: LandingScreenProps) {
  return (
    <div style={styles.outerWrapper}>
      <div style={styles.phoneFrame}>
        <div style={styles.hero}>
          <div style={styles.heroGlow} />

          <div style={styles.heroTopRow}>
            <div style={styles.logoBox}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <ellipse cx="13" cy="16" rx="9" ry="12" stroke="white" strokeWidth="2" fill="none" />
                <ellipse cx="19" cy="16" rx="9" ry="12" stroke="white" strokeWidth="2" fill="none" opacity="0.6" />
              </svg>
            </div>
            <span style={styles.heroPill}>AT-HOME KIDNEY SCREENING</span>
          </div>

          <div style={styles.headingBlock}>
            <h1 style={styles.appName}>UroSense</h1>
            <p style={styles.taglineSmall}>Early Kidney Risk Detection</p>
          </div>

          <p style={styles.description}>
            Detect early signs of kidney disease from home using a standard
            dipstick and your phone camera.
          </p>

          <div style={styles.featureRow}>
            <div style={styles.featureStack}>
              {HERO_FEATURES.map((item) => (
                <div key={item.label} style={styles.featureBlock}>
                  <span style={styles.featureIcon}>{item.icon}</span>
                  <span style={styles.featureLabel}>{item.label}</span>
                </div>
              ))}
            </div>

            <div style={styles.featureKidneyWrap} aria-hidden="true">
              <img
                src={kidneyReference}
                alt=""
                style={styles.featureKidneyImage}
              />
            </div>
          </div>

          <button style={styles.heroCtaBtn} onClick={onStart}>
            START YOUR FIRST SCAN
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
    backgroundColor: '#F6F3EF',
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
    minHeight: '844px',
    background: 'radial-gradient(circle at top center, #A88363 0%, #8C684A 34%, #6A4C36 100%)',
    padding: '32px 24px 28px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: '-120px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '420px',
    height: '320px',
    background: 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 70%)',
    pointerEvents: 'none',
  },
  heroTopRow: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    position: 'relative',
    zIndex: 1,
  },
  logoBox: {
    width: '70px',
    height: '70px',
    borderRadius: '20px',
    backgroundColor: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.16)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  heroPill: {
    padding: '10px 14px',
    borderRadius: '999px',
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.9px',
    textTransform: 'uppercase',
    color: '#FFF7ED',
    border: '1px solid rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    whiteSpace: 'nowrap',
  },
  headingBlock: {
    marginTop: '26px',
    marginBottom: '12px',
    textAlign: 'center',
    position: 'relative',
    zIndex: 1,
  },
  appName: {
    color: '#FFFFFF',
    fontSize: '40px',
    fontWeight: 800,
    margin: 0,
    letterSpacing: '0.05em',
  },
  taglineSmall: {
    color: 'rgba(255,247,237,0.86)',
    fontSize: '17px',
    margin: '16px 0 0',
    letterSpacing: '0.02em',
  },
  description: {
    color: 'rgba(255,248,240,0.92)',
    fontSize: '16px',
    textAlign: 'center',
    maxWidth: '320px',
    lineHeight: 1.7,
    letterSpacing: '0.01em',
    margin: '0 0 22px',
    position: 'relative',
    zIndex: 1,
  },
  featureRow: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    position: 'relative',
    zIndex: 1,
    marginTop: '18px',
    marginBottom: '22px',
  },
  featureStack: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    minWidth: 0,
    marginLeft: '-24px',
  },
  featureBlock: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: '12px',
    minHeight: '58px',
    padding: 0,
  },
  featureIcon: {
    width: '38px',
    height: '38px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    backgroundColor: 'rgba(255,255,255,0.12)',
    border: '1px solid rgba(255,255,255,0.16)',
    color: '#FFF7ED',
    flexShrink: 0,
  },
  featureLabel: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#FFFFFF',
    letterSpacing: '0.01em',
  },
  featureKidneyWrap: {
    position: 'absolute',
    right: '-50px',
    top: 0,
    bottom: 0,
    width: '180px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'visible',
    pointerEvents: 'none',
  },
  featureKidneyImage: {
    width: '228px',
    maxWidth: 'none',
    opacity: 0.26,
    mixBlendMode: 'multiply',
    filter: 'sepia(0.85) saturate(0.26) hue-rotate(-10deg) brightness(0.92) contrast(0.86)',
    pointerEvents: 'none',
  },
  heroCtaBtn: {
    width: '100%',
    height: '56px',
    backgroundColor: '#FFFFFF',
    color: '#6F4E37',
    border: 'none',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: 800,
    letterSpacing: '0.06em',
    cursor: 'pointer',
    boxShadow: '0 8px 22px rgba(49,31,20,0.18)',
    position: 'relative',
    zIndex: 1,
  },
  secondaryBtn: {
    width: '100%',
    height: '50px',
    backgroundColor: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: '12px',
    color: '#FFF7ED',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: '12px',
    position: 'relative',
    zIndex: 1,
  },
  clinicianLink: {
    width: '100%',
    background: 'none',
    border: 'none',
    color: 'rgba(255,247,237,0.76)',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'center',
    marginTop: '12px',
    position: 'relative',
    zIndex: 1,
  },
  disclaimer: {
    fontSize: '11px',
    color: 'rgba(255,247,237,0.62)',
    textAlign: 'center',
    lineHeight: 1.5,
    margin: '18px 0 0',
    maxWidth: '290px',
    position: 'relative',
    zIndex: 1,
  },
};

function ValidatedGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 6L9 17L4 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GuidelineGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 5.5H17C18.1 5.5 19 6.4 19 7.5V18.5C19 17.67 18.33 17 17.5 17H7C5.9 17 5 16.1 5 15V7.5C5 6.4 5.9 5.5 7 5.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M8.5 9H15.5M8.5 12H15.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ShieldGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3L18.5 5.5V10.8C18.5 15 15.78 18.86 12 20C8.22 18.86 5.5 15 5.5 10.8V5.5L12 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
