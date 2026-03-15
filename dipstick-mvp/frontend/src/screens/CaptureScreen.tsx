/**
 * CaptureScreen
 * ==============
 * Two-mode capture: "Guided Capture" (live camera viewfinder) or "Upload Photo".
 * Defaults to guided on mobile, upload on desktop.
 * Shows capture quality feedback when the backend returns validation signals.
 */

import React, { useState } from 'react';
import AppShell from '../components/AppShell';
import UploadCard from '../components/UploadCard';
import GuidedCaptureView from '../components/GuidedCaptureView';
import DisclaimerCard from '../components/DisclaimerCard';
import MarkerTemplateCard from '../components/MarkerTemplateCard';
import { Camera, Upload, RefreshCcw, Activity, Info, File as FileIcon, CheckCircle2, Check, X, Sun, Scaling, Target, Clock, AlertTriangle } from 'lucide-react';
import type { CaptureQuality } from '../types';

interface CaptureScreenProps {
  onBack: () => void;
  onAnalyze: (file: File, captureMode?: string) => void;
  error?: string | null;
  captureQuality?: CaptureQuality | null;
}

function isMobileDevice(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
  );
}

type CaptureTab = 'guided' | 'upload';

export default function CaptureScreen({ onBack, onAnalyze, error, captureQuality }: CaptureScreenProps) {
  const [tab, setTab] = useState<CaptureTab>(() => isMobileDevice() ? 'guided' : 'upload');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [capturedViaGuide, setCapturedViaGuide] = useState(false);

  const handleFileSelected = (selectedFile: File) => {
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setCapturedViaGuide(false);
  };

  const handleGuidedCapture = (capturedFile: File) => {
    setFile(capturedFile);
    setPreviewUrl(URL.createObjectURL(capturedFile));
    setCapturedViaGuide(true);
  };

  const handleRetake = () => {
    setFile(null);
    setPreviewUrl(null);
    setCapturedViaGuide(false);
  };

  const handleAnalyze = () => {
    if (file) {
      const mode = capturedViaGuide ? 'standardized_capture' : 'free_capture';
      onAnalyze(file, mode);
    }
  };

  // If guided capture delivered a file, show the review screen
  const showReview = tab === 'guided' && file && previewUrl;

  return (
    <AppShell title="Scan Strip" onBack={onBack} noPadding={tab === 'guided' && !file}>
      <div style={tab === 'guided' && !file ? styles.wrapperNoPad : styles.wrapper}>

        {/* Error banner with quality feedback */}
        {error && (
          <div style={styles.errorBanner}>
            <AlertTriangle style={styles.errorIcon} size={20} />
            <div style={styles.errorContent}>
              <span style={styles.errorTitle}>Strip not recognised</span>
              <span style={styles.errorText}>{error}</span>
            </div>
          </div>
        )}

        {/* Quality breakdown (shown when backend returns quality signals on failure) */}
        {captureQuality && error && (
          <div style={styles.qualityCard}>
            <div style={styles.qualityHeader}>Capture Quality Check</div>
            <QualityRow label="Orientation" ok={captureQuality.orientation_ok} detail={captureQuality.orientation_detail} />
            <QualityRow label="Lighting" ok={captureQuality.lighting_ok} detail={captureQuality.lighting_detail} />
            <QualityRow label="Strip Size" ok={captureQuality.strip_fills_frame_enough} detail={captureQuality.strip_area_detail} />
            <QualityRow label="Aspect Ratio" ok={captureQuality.aspect_ratio_ok} detail={captureQuality.aspect_ratio_detail} />
            <QualityRow label="Background" ok={captureQuality.background_ok} detail={captureQuality.background_detail} />
            <QualityRow label="Pad Layout" ok={captureQuality.pad_layout_consistent} detail={captureQuality.pad_layout_detail} />
            {captureQuality.suggestions.length > 0 && (
              <div style={styles.suggestionsBox}>
                <div style={styles.suggestionsTitle}>Tips to improve:</div>
                {captureQuality.suggestions.map((s, i) => (
                  <div key={i} style={styles.suggestionRow}>
                    <span>💡</span>
                    <span style={styles.suggestionText}>{s}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Mode toggle tabs */}
        <div style={tab === 'guided' && !file ? styles.tabBarFloating : styles.tabBar}>
          <button
            style={{ ...styles.tabBtn, ...(tab === 'guided' ? styles.tabBtnActive : {}) }}
            onClick={() => { setTab('guided'); handleRetake(); }}
          >
            <Camera size={16} style={styles.tabIcon} /> Guided Capture
          </button>
          <button
            style={{ ...styles.tabBtn, ...(tab === 'upload' ? styles.tabBtnActive : {}) }}
            onClick={() => { setTab('upload'); handleRetake(); }}
          >
            <Upload size={16} style={styles.tabIcon} /> Upload Photo
          </button>
        </div>

        {/* High-level title instruction */}
        {(tab !== 'guided' || showReview) && (
          <div style={styles.headerWrap}>
            <p style={styles.headerInstruction}>
              Place the strip on the guide card.
            </p>
          </div>
        )}

        {(tab !== 'guided' || showReview) && (
          <div style={styles.templateCardWrap}>
            <MarkerTemplateCard compact />
          </div>
        )}

        {/* === GUIDED CAPTURE TAB === */}
        {tab === 'guided' && !showReview && (
          <GuidedCaptureView
            onCapture={handleGuidedCapture}
            onCancel={() => setTab('upload')}
          />
        )}

        {/* === GUIDED CAPTURE REVIEW === */}
        {showReview && (
          <div style={styles.reviewSection}>
            <div style={styles.reviewImageWrapper}>
              <img src={previewUrl} alt="Captured strip" style={styles.reviewImage} />
            </div>
            <div style={styles.reviewButtons}>
              <button style={styles.retakeBtn} onClick={handleRetake}>
                <RefreshCcw size={16} style={styles.tabIcon} /> Retake
              </button>
              <button style={styles.analyzeBtn} onClick={handleAnalyze}>
                <Activity size={18} style={styles.tabIcon} /> Analyze Strip
              </button>
            </div>
          </div>
        )}

        {/* === UPLOAD TAB === */}
        {tab === 'upload' && (
          <>
            <UploadCard onFileSelected={handleFileSelected} previewUrl={previewUrl} />

            {file && (
              <div style={styles.fileInfo}>
                <FileIcon size={18} style={{ color: '#64748B' }} />
                <div style={styles.fileDetails}>
                  <span style={styles.fileName}>{file.name}</span>
                  <span style={styles.fileSize}>{(file.size / 1024).toFixed(0)} KB</span>
                </div>
                <CheckCircle2 size={18} style={{ color: '#8B6A4D' }} />
              </div>
            )}

            <button
              style={{
                ...styles.analyzeBtn,
                opacity: file ? 1 : 0.4,
                cursor: file ? 'pointer' : 'not-allowed',
              }}
              onClick={handleAnalyze}
              disabled={!file}
            >
              Continue
            </button>

            <div style={styles.tipsCard}>
              <h3 style={styles.tipsTitle}>Tips</h3>
              {TIPS.map((tip, i) => (
                <div key={i} style={styles.tipRow}>
                  <span style={styles.bullet}>•</span>
                  <span style={styles.tipText}>{tip}</span>
                </div>
              ))}
            </div>

            <DisclaimerCard compact />
          </>
        )}
      </div>
    </AppShell>
  );
}

// Quality check row sub-component
function QualityRow({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div style={styles.qualityRow}>
      <span style={{ ...styles.qualityIcon, color: ok ? '#16A34A' : '#DC2626' }}>
        {ok ? <Check size={16} /> : <X size={16} />}
      </span>
      <div style={{ flex: 1 }}>
        <span style={styles.qualityLabel}>{label}</span>
        <span style={styles.qualityDetail}>{detail}</span>
      </div>
    </div>
  );
}

const TIPS = [
  'Use even lighting',
  'Keep the strip flat',
  'Avoid glare',
  'Capture straight-on',
];

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    paddingTop: '16px',
  },
  wrapperNoPad: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0px',
  },
  headerWrap: {
    padding: '0 12px',
    marginBottom: '-6px',
  },
  headerInstruction: {
    fontSize: '15px',
    color: '#334155',
    margin: 0,
    lineHeight: 1.4,
  },
  // Tab bar
  tabBar: {
    display: 'flex',
    gap: '6px',
    backgroundColor: '#F1F5F9',
    padding: '4px',
    borderRadius: '12px',
  },
  tabBarFloating: {
    display: 'flex',
    gap: '6px',
    backgroundColor: 'rgba(241,245,249,0.95)',
    padding: '4px',
    borderRadius: '12px',
    margin: '8px 12px',
  },
  tabBtn: {
    flex: 1,
    padding: '10px 4px',
    border: 'none',
    borderRadius: '9px',
    background: 'transparent',
    fontSize: '13px',
    fontWeight: 600,
    color: '#64748B',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    color: '#8B6A4D',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
  tabIcon: {
    verticalAlign: 'text-bottom',
    marginRight: '6px',
  },
  // Error
  errorBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    backgroundColor: '#FEF2F2',
    border: '1px solid #FECACA',
    borderRadius: '12px',
    padding: '14px',
    margin: '0 12px',
  },
  errorIcon: { flexShrink: 0, marginTop: '2px' },
  errorContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  errorTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#991B1B',
  },
  errorText: {
    fontSize: '13px',
    color: '#B91C1C',
    lineHeight: 1.45,
  },
  // Quality feedback card
  qualityCard: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '14px',
    padding: '16px',
    margin: '0 12px',
  },
  qualityHeader: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#64748B',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.7px',
    marginBottom: '12px',
  },
  qualityRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '6px 0',
    borderBottom: '1px solid #F1F5F9',
  },
  qualityIcon: {
    fontSize: '16px',
    fontWeight: 700,
    flexShrink: 0,
    width: '20px',
    textAlign: 'center' as const,
  },
  qualityLabel: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#1E293B',
    marginRight: '6px',
  },
  qualityDetail: {
    fontSize: '12px',
    color: '#64748B',
  },
  suggestionsBox: {
    marginTop: '12px',
    backgroundColor: '#EFF6FF',
    borderRadius: '10px',
    padding: '10px 12px',
  },
  suggestionsTitle: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#1D4ED8',
    marginBottom: '6px',
  },
  suggestionRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '6px',
    marginBottom: '4px',
  },
  suggestionText: {
    fontSize: '12px',
    color: '#1E40AF',
    lineHeight: 1.4,
  },
  // Review (post-capture)
  reviewSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    padding: '0 12px',
  },
  templateCardWrap: {
    padding: '0 12px',
  },
  reviewImageWrapper: {
    borderRadius: '14px',
    overflow: 'hidden',
    border: '2px solid #E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  reviewImage: {
    width: '100%',
    maxHeight: '360px',
    objectFit: 'contain',
    display: 'block',
  },
  reviewButtons: {
    display: 'flex',
    gap: '10px',
  },
  retakeBtn: {
    flex: 1,
    padding: '14px',
    border: '2px solid #E2E8F0',
    borderRadius: '12px',
    backgroundColor: '#FFFFFF',
    color: '#64748B',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  // Upload tab
  instructionBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: '#F6EFE8',
    borderRadius: '12px',
    padding: '10px 14px',
  },
  instructionText: {
    fontSize: '13px',
    color: '#6F4E37',
    lineHeight: 1.4,
    fontWeight: 500,
  },
  fileInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: '#F8FAFC',
    borderRadius: '12px',
    padding: '12px',
    border: '1px solid #E2E8F0',
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
    color: '#7C5A3A',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '200px',
  },
  fileSize: {
    fontSize: '12px',
    color: '#64748B',
  },
  checkMark: {
    fontSize: '18px',
    color: '#8B6A4D',
    fontWeight: 700,
  },
  analyzeBtn: {
    padding: '16px',
    border: 'none',
    borderRadius: '14px',
    backgroundColor: '#8B6A4D',
    color: '#FFFFFF',
    fontSize: '17px',
    fontWeight: 600,
    width: '100%',
    transition: 'opacity 0.2s',
    cursor: 'pointer',
  },
  tipsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: '14px',
    border: '1px solid #E2E8F0',
    padding: '16px',
  },
  tipsTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#475569',
    margin: '0 0 12px',
  },
  tipRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    marginBottom: '8px',
    color: '#64748B',
  },
  tipText: {
    fontSize: '13px',
    lineHeight: 1.45,
    color: '#475569',
  },
};
