/**
 * ConsentScreen
 * ==============
 * Simple informed-consent gate before the clinical intake form.
 * All three boxes must be checked to proceed.
 * This is frontend-only — no backend call needed.
 */

import React, { useState } from 'react';
import AppShell from '../components/AppShell';
import { BRAND_TEAL } from '../types';

interface ConsentScreenProps {
  onBack: () => void;
  onConsent: () => void;
}

interface ConsentItem {
  id: string;
  text: string;
}

const CONSENT_ITEMS: ConsentItem[] = [
  {
    id: 'not_diagnosis',
    text: 'I understand that DipCheck does not provide a medical diagnosis. Results are for informational screening purposes only and must be reviewed by a licensed healthcare professional.',
  },
  {
    id: 'data_use',
    text: 'I consent to my anonymized screening data being processed for this analysis. No personally identifiable information is stored or shared.',
  },
  {
    id: 'age',
    text: 'I am 18 years of age or older, or I have parental or guardian consent to use this tool.',
  },
];

export default function ConsentScreen({ onBack, onConsent }: ConsentScreenProps) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const allChecked = CONSENT_ITEMS.every((item) => checked[item.id]);

  return (
    <AppShell title="Before You Begin" onBack={onBack}>
      <div style={styles.wrapper}>

        {/* Progress */}
        <div style={styles.progressRow}>
          <span style={styles.progressLabel}>Step 1 of 4</span>
          <div style={styles.progressTrack}>
            <div style={{ ...styles.progressFill, width: '25%' }} />
          </div>
        </div>

        {/* Intro */}
        <div style={styles.introCard}>
          <div style={styles.introIcon}>🩺</div>
          <p style={styles.introText}>
            DipCheck uses your dipstick photo and health context to generate a structured,
            rule-based screening report. Please review the following before continuing.
          </p>
        </div>

        {/* Consent items */}
        <div style={styles.sectionLabel}>PLEASE CONFIRM EACH OF THE FOLLOWING</div>

        {CONSENT_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => toggle(item.id)}
            style={{
              ...styles.consentCard,
              border: checked[item.id]
                ? `2px solid ${BRAND_TEAL}`
                : '1.5px solid #E2E8F0',
              backgroundColor: checked[item.id] ? '#F0FDF4' : '#FFFFFF',
            }}
          >
            {/* Checkbox */}
            <div style={{
              ...styles.checkbox,
              backgroundColor: checked[item.id] ? BRAND_TEAL : '#FFFFFF',
              borderColor:     checked[item.id] ? BRAND_TEAL : '#CBD5E1',
            }}>
              {checked[item.id] && <span style={styles.checkmark}>✓</span>}
            </div>

            {/* Text */}
            <p style={styles.consentText}>{item.text}</p>
          </button>
        ))}

        {/* Privacy note */}
        <div style={styles.privacyNote}>
          🔒 Your data is processed locally and never sold. See our{' '}
          <span style={styles.privacyLink}>Privacy Policy</span>.
        </div>

        {/* CTA — disabled until all checked */}
        <button
          style={{
            ...styles.agreeBtn,
            backgroundColor: allChecked ? BRAND_TEAL : '#CBD5E1',
            cursor:          allChecked ? 'pointer' : 'not-allowed',
            boxShadow:       allChecked ? '0 4px 14px rgba(13,148,136,0.35)' : 'none',
          }}
          onClick={() => { if (allChecked) onConsent(); }}
          disabled={!allChecked}
        >
          {allChecked ? 'I Agree — Continue →' : `${CONSENT_ITEMS.filter(i => checked[i.id]).length} / ${CONSENT_ITEMS.length} confirmed`}
        </button>

      </div>
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex', flexDirection: 'column', gap: '12px',
    paddingTop: '12px', paddingBottom: '32px',
  },
  progressRow: { display: 'flex', flexDirection: 'column', gap: '6px' },
  progressLabel: { fontSize: '12px', fontWeight: 600, color: BRAND_TEAL },
  progressTrack: {
    height: '6px', backgroundColor: '#E2E8F0',
    borderRadius: '99px', overflow: 'hidden',
  },
  progressFill: {
    height: '100%', backgroundColor: BRAND_TEAL,
    borderRadius: '99px', transition: 'width 0.3s ease',
  },
  introCard: {
    backgroundColor: '#F0FDF4',
    border: `1.5px solid ${BRAND_TEAL}33`,
    borderRadius: '14px',
    padding: '16px',
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
  },
  introIcon: { fontSize: '28px', flexShrink: 0 },
  introText: {
    fontSize: '14px', color: '#334155', lineHeight: 1.5, margin: 0,
  },
  sectionLabel: {
    fontSize: '11px', fontWeight: 700, color: '#94A3B8',
    textTransform: 'uppercase' as const, letterSpacing: '0.8px', marginTop: '4px',
  },
  consentCard: {
    display: 'flex', alignItems: 'flex-start', gap: '14px',
    padding: '16px', borderRadius: '14px', cursor: 'pointer',
    width: '100%', textAlign: 'left' as const,
    transition: 'all 0.15s ease', boxSizing: 'border-box' as const,
  },
  checkbox: {
    width: '24px', height: '24px', borderRadius: '6px', border: '2px solid',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginTop: '1px', transition: 'all 0.15s ease',
  },
  checkmark: { color: '#FFFFFF', fontSize: '15px', fontWeight: 700, lineHeight: 1 },
  consentText: {
    fontSize: '14px', color: '#374151', lineHeight: 1.5, margin: 0,
  },
  privacyNote: {
    fontSize: '12px', color: '#94A3B8', textAlign: 'center' as const,
    lineHeight: 1.4, padding: '4px 0',
  },
  privacyLink: {
    color: BRAND_TEAL, textDecoration: 'underline', cursor: 'pointer',
  },
  agreeBtn: {
    width: '100%', height: '56px',
    color: '#FFFFFF', border: 'none', borderRadius: '14px',
    fontSize: '17px', fontWeight: 700,
    transition: 'all 0.2s ease', marginTop: '8px',
  },
};
