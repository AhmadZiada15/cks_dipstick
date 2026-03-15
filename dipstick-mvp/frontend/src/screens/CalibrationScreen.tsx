import React, { useState } from 'react';
import AppShell from '../components/AppShell';
import UploadCard from '../components/UploadCard';

interface CalibrationScreenProps {
  onBack: () => void;
  onContinue: (file: File) => void;
  error?: string | null;
}

export default function CalibrationScreen({
  onBack,
  onContinue,
  error,
}: CalibrationScreenProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileSelected = (selectedFile: File) => {
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
  };

  return (
    <AppShell hideHeader>
      <div style={styles.wrapper}>
        <div style={styles.header}>
          <button style={styles.backBtn} onClick={onBack} aria-label="Go back">
            <BackGlyph />
          </button>
          <div>
            <div style={styles.headerEyebrow}>Calibration</div>
            <h1 style={styles.headerTitle}>Step 1: Scan unused strip</h1>
            <p style={styles.headerSubtitle}>Place the unused strip on a white surface.</p>
          </div>
        </div>

        {error && <div style={styles.errorBanner}>{error}</div>}

        <UploadCard onFileSelected={handleFileSelected} previewUrl={previewUrl} />

        <button
          style={{
            ...styles.primaryButton,
            opacity: file ? 1 : 0.45,
            cursor: file ? 'pointer' : 'not-allowed',
          }}
          onClick={() => file && onContinue(file)}
          disabled={!file}
        >
          Continue
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
    gap: '16px',
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
  errorBanner: {
    border: '1px solid #E7D7C8',
    backgroundColor: '#F9F4EE',
    color: '#7C5A3A',
    borderRadius: '12px',
    padding: '12px 14px',
    fontSize: '13px',
    lineHeight: 1.5,
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
};
