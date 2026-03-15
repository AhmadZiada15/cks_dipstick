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
          borderColor: dragging ? '#8B6A4D' : '#CBD5E1',
          background: dragging ? '#F6EFE8' : '#F8FAFC',
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
            <div style={styles.iconFrame}>
              <UploadGlyph />
            </div>
            <div style={styles.emptyCopy}>
              <p style={styles.primaryText}>Capture the strip.</p>
              <p style={styles.secondaryText}>Keep the strip flat and fully in frame.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function UploadGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 16V7M12 7L8.5 10.5M12 7L15.5 10.5M6 17.5H18"
        stroke="#7C5A3A"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="4.5" y="4.5" width="15" height="15" rx="3" stroke="#CBD5E1" />
    </svg>
  );
}

function CameraGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8 7L9.2 5.5C9.39 5.26 9.68 5.12 10 5.12H14C14.32 5.12 14.61 5.26 14.8 5.5L16 7H18C19.1 7 20 7.9 20 9V16C20 17.1 19.1 18 18 18H6C4.9 18 4 17.1 4 16V9C4 7.9 4.9 7 6 7H8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12.5" r="3.25" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function GalleryGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="4"
        y="5"
        width="16"
        height="14"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M7.5 15L10.25 12.25C10.64 11.86 11.27 11.86 11.66 12.25L13 13.59L14.84 11.75C15.23 11.36 15.86 11.36 16.25 11.75L18 13.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="9.5" r="1.25" fill="currentColor" />
    </svg>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  dropZone: {
    border: '1px solid',
    borderRadius: '12px',
    minHeight: '184px',
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
    maxHeight: '220px',
    objectFit: 'contain',
    borderRadius: '10px',
  },
  changeLabel: {
    marginTop: '10px',
    fontSize: '12px',
    color: '#64748B',
    paddingBottom: '10px',
    fontWeight: 500,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '14px',
    padding: '20px',
    textAlign: 'center',
  },
  iconFrame: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    border: '1px solid #E2E8F0',
    backgroundColor: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCopy: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    alignItems: 'center',
  },
  eyebrow: {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.6px',
    textTransform: 'uppercase',
    color: '#64748B',
    margin: 0,
  },
  primaryText: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#0F172A',
    margin: 0,
  },
  secondaryText: {
    fontSize: '13px',
    color: '#64748B',
    margin: 0,
    lineHeight: 1.4,
    maxWidth: '220px',
  },
};
