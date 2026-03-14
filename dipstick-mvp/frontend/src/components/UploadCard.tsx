/**
 * UploadCard
 * ===========
 * Drag-and-drop + tap-to-select file upload area.
 * Supports camera capture on mobile via `accept="image/*" capture="environment"`.
 */

import React, { useRef, useState, DragEvent } from 'react';

interface UploadCardProps {
  onFileSelected: (file: File) => void;
  previewUrl?: string | null;
}

export default function UploadCard({ onFileSelected, previewUrl }: UploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }
    onFileSelected(file);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div style={styles.wrapper}>
      {/* Hidden file input — triggered by tap */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={onInputChange}
      />

      {/* Drop zone / preview */}
      <div
        style={{
          ...styles.dropZone,
          borderColor: dragging ? '#4F46E5' : '#CBD5E1',
          background: dragging ? '#EEF2FF' : '#F8FAFC',
        }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        aria-label="Upload dipstick photo"
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      >
        {previewUrl ? (
          /* Show preview of selected image */
          <div style={styles.previewWrapper}>
            <img src={previewUrl} alt="Dipstick preview" style={styles.previewImg} />
            <div style={styles.changeLabel}>Tap to change photo</div>
          </div>
        ) : (
          /* Empty state */
          <div style={styles.emptyState}>
            <div style={styles.iconCircle}>📸</div>
            <p style={styles.primaryText}>Tap to take or upload a photo</p>
            <p style={styles.secondaryText}>
              Position your dipstick strip against a white background
            </p>
          </div>
        )}
      </div>

      {/* Camera vs. Gallery buttons */}
      <div style={styles.buttonRow}>
        <button
          style={styles.actionBtn}
          onClick={() => {
            // camera button — open camera on mobile
            if (inputRef.current) {
              inputRef.current.setAttribute('capture', 'environment');
              inputRef.current.click();
            }
          }}
        >
          📷 Camera
        </button>
        <button
          style={{ ...styles.actionBtn, ...styles.galleryBtn }}
          onClick={() => {
            if (inputRef.current) {
              inputRef.current.removeAttribute('capture');
              inputRef.current.click();
            }
          }}
        >
          🖼 Gallery
        </button>
      </div>

      {/* Tip */}
      <div style={styles.tipBox}>
        <span style={styles.tipIcon}>💡</span>
        <span style={styles.tipText}>
          For best results, lay the strip flat, use good lighting, and keep the strip
          fully in frame.
        </span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  dropZone: {
    border: '2px dashed',
    borderRadius: '16px',
    minHeight: '220px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    overflow: 'hidden',
  },
  previewWrapper: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  previewImg: {
    width: '100%',
    maxHeight: '260px',
    objectFit: 'contain',
    borderRadius: '12px',
  },
  changeLabel: {
    marginTop: '8px',
    fontSize: '13px',
    color: '#64748B',
    paddingBottom: '8px',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '24px',
  },
  iconCircle: {
    fontSize: '40px',
    lineHeight: 1,
  },
  primaryText: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#1E293B',
    margin: 0,
    textAlign: 'center',
  },
  secondaryText: {
    fontSize: '13px',
    color: '#64748B',
    margin: 0,
    textAlign: 'center',
    maxWidth: '220px',
  },
  buttonRow: {
    display: 'flex',
    gap: '10px',
  },
  actionBtn: {
    flex: 1,
    padding: '12px',
    border: 'none',
    borderRadius: '12px',
    backgroundColor: '#4F46E5',
    color: '#FFFFFF',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  galleryBtn: {
    backgroundColor: '#E0E7FF',
    color: '#4F46E5',
  },
  tipBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    backgroundColor: '#EFF6FF',
    borderRadius: '12px',
    padding: '12px',
  },
  tipIcon: {
    fontSize: '16px',
    flexShrink: 0,
  },
  tipText: {
    fontSize: '13px',
    color: '#1D4ED8',
    lineHeight: 1.5,
  },
};
