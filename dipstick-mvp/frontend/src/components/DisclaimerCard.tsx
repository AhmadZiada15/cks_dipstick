/**
 * DisclaimerCard
 * ===============
 * Always-visible medical/legal disclaimer.
 * Must appear on any screen that shows clinical data.
 * Design: clearly visible but non-intrusive.
 */

import React from 'react';
import { ShieldAlert } from 'lucide-react';

interface DisclaimerCardProps {
  compact?: boolean;   // shorter version for inline use
}

export default function DisclaimerCard({ compact = false }: DisclaimerCardProps) {
  if (compact) {
    return (
      <div style={styles.compact}>
        <ShieldAlert size={16} style={{ color: '#64748B', flexShrink: 0, marginTop: '2px' }} />
        <span style={styles.compactText}>
          Not a diagnosis. Consult a healthcare professional for any health concerns.
        </span>
      </div>
    );
  }

  return (
    <div style={styles.full}>
      <div style={styles.headerRow}>
        <ShieldAlert size={18} style={{ color: '#475569' }} />
        <span style={styles.title}>Medical Disclaimer</span>
      </div>
      <p style={styles.text}>
        This app provides <strong>screening information only</strong> and is{' '}
        <strong>not a medical diagnosis</strong>. Results from automated dipstick
        analysis are not a substitute for laboratory urinalysis or evaluation by a
        licensed healthcare professional.
      </p>
      <p style={styles.text}>
        If you are experiencing pain, blood in your urine, fever, or any urgent
        symptoms, <strong>seek medical care immediately</strong>.
      </p>
      <p style={{ ...styles.text, marginBottom: 0, color: '#94A3B8', fontSize: '11px' }}>
        DipCheck · For educational and research use only · Not FDA cleared
      </p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  full: {
    backgroundColor: '#F1F5F9',
    borderRadius: '14px',
    padding: '16px',
    border: '1px solid #CBD5E1',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '10px',
  },
  icon: {
    fontSize: '18px',
  },
  title: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
  },
  text: {
    fontSize: '13px',
    color: '#475569',
    lineHeight: 1.6,
    margin: '0 0 8px',
  },
  compact: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '6px',
    backgroundColor: '#F8FAFC',
    borderRadius: '10px',
    padding: '10px 12px',
    border: '1px solid #E2E8F0',
  },
  compactText: {
    fontSize: '12px',
    color: '#64748B',
    lineHeight: 1.5,
  },
};
