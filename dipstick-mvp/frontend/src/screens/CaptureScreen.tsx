/**
 * CaptureScreen
 * ==============
 * Where the user selects or photographs their dipstick.
 * Shows UploadCard + an "Analyze" CTA once a file is selected.
 */

import React, { useState } from 'react';
import AppShell from '../components/AppShell';
import UploadCard from '../components/UploadCard';
import DisclaimerCard from '../components/DisclaimerCard';

interface CaptureScreenProps {
  onBack: () => void;
  onAnalyze: (file: File) => void;
}

export default function CaptureScreen({ onBack, onAnalyze }: CaptureScreenProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileSelected = (selectedFile: File) => {
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
  };

  const handleAnalyze = () => {
    if (file) onAnalyze(file);
  };

  return (
    <AppShell title="Scan Strip" onBack={onBack}>
      <div style={styles.wrapper}>
        {/* Instruction pill */}
        <div style={styles.instructionBadge}>
          <span>📋</span>
          <span style={styles.instructionText}>
            Place your dipstick strip on a flat white surface and photograph it
          </span>
        </div>

        {/* Upload component */}
        <UploadCard onFileSelected={handleFileSelected} previewUrl={previewUrl} />

        {/* File info */}
        {file && (
          <div style={styles.fileInfo}>
            <span style={styles.fileIcon}>📁</span>
            <div style={styles.fileDetails}>
              <span style={styles.fileName}>{file.name}</span>
              <span style={styles.fileSize}>{(file.size / 1024).toFixed(0)} KB</span>
            </div>
            <span style={styles.checkMark}>✓</span>
          </div>
        )}

        {/* Analyze button */}
        <button
          style={{
            ...styles.analyzeBtn,
            opacity: file ? 1 : 0.4,
            cursor: file ? 'pointer' : 'not-allowed',
          }}
          onClick={handleAnalyze}
          disabled={!file}
        >
          {file ? '🔬 Analyze Strip' : 'Select a photo to continue'}
        </button>

        {/* Tips section */}
        <div style={styles.tipsCard}>
          <h3 style={styles.tipsTitle}>Tips for accurate results</h3>
          {TIPS.map((tip, i) => (
            <div key={i} style={styles.tipRow}>
              <span>{tip.icon}</span>
              <span style={styles.tipText}>{tip.text}</span>
            </div>
          ))}
        </div>

        <DisclaimerCard compact />
      </div>
    </AppShell>
  );
}

const TIPS = [
  { icon: '☀️', text: 'Use bright, even lighting — avoid direct sunlight glare' },
  { icon: '📐', text: 'Keep the strip fully visible and flat in the frame' },
  { icon: '🎯', text: 'Photograph straight-on, not at an angle' },
  { icon: '⏱️', text: 'Read within 2 minutes of dipping per package instructions' },
];

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    paddingTop: '16px',
  },
  instructionBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: '#F0FDFA',
    borderRadius: '12px',
    padding: '10px 14px',
  },
  instructionText: {
    fontSize: '13px',
    color: '#115E59',
    lineHeight: 1.4,
    fontWeight: 500,
  },
  fileInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: '#F0FDF4',
    borderRadius: '12px',
    padding: '12px',
    border: '1px solid #BBF7D0',
  },
  fileIcon: { fontSize: '18px' },
  fileDetails: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  fileName: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#166534',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '200px',
  },
  fileSize: {
    fontSize: '12px',
    color: '#16A34A',
  },
  checkMark: {
    fontSize: '18px',
    color: '#16A34A',
    fontWeight: 700,
  },
  analyzeBtn: {
    padding: '16px',
    border: 'none',
    borderRadius: '14px',
    backgroundColor: '#0D9488',
    color: '#FFFFFF',
    fontSize: '17px',
    fontWeight: 700,
    width: '100%',
    transition: 'opacity 0.2s',
    boxShadow: '0 4px 14px rgba(13,148,136,0.35)',
  },
  tipsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: '14px',
    border: '1px solid #E2E8F0',
    padding: '16px',
  },
  tipsTitle: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: '0.7px',
    margin: '0 0 12px',
  },
  tipRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    marginBottom: '8px',
    fontSize: '13px',
  },
  tipText: {
    color: '#374151',
    lineHeight: 1.5,
  },
};
