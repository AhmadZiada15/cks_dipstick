/**
 * AppShell
 * =========
 * Outermost wrapper that constrains the app to a phone-like viewport.
 * On desktop it renders as a centered phone frame.
 * On mobile it fills the screen edge-to-edge.
 *
 * Props:
 *   children       — screen content
 *   title          — header bar title (optional)
 *   onBack         — if provided, shows a back button in the header
 *   hideHeader     — omit the top bar (landing screen)
 */

import React from 'react';

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
  onBack?: () => void;
  hideHeader?: boolean;
  noPadding?: boolean;
}

export default function AppShell({
  children,
  title,
  onBack,
  hideHeader = false,
  noPadding = false,
}: AppShellProps) {
  return (
    /* Outer centering wrapper (desktop only) */
    <div style={styles.outerWrapper}>
      {/* Phone frame */}
      <div style={styles.phoneFrame}>
        {/* Status bar strip */}
        <div style={styles.statusBar}>
          <span style={styles.statusTime}>
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span style={styles.statusIcons}>●●● ▲</span>
        </div>

        {/* App header */}
        {!hideHeader && (
          <header style={styles.header}>
            {onBack ? (
              <button style={styles.backBtn} onClick={onBack} aria-label="Go back">
                ←
              </button>
            ) : (
              <div style={{ width: 40 }} />
            )}
            <span style={styles.headerTitle}>{title ?? 'DipCheck'}</span>
            <div style={{ width: 40 }} />
          </header>
        )}

        {/* Scrollable content area */}
        <main style={{ ...styles.content, padding: noPadding ? 0 : '0 16px 32px' }}>
          {children}
        </main>

        {/* Bottom safe-area spacer */}
        <div style={styles.bottomSpacer} />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  outerWrapper: {
    minHeight: '100vh',
    backgroundColor: '#F1F5F9',
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
    backgroundColor: '#FFFFFF',
    borderRadius: '40px',
    boxShadow: '0 25px 60px rgba(0,0,0,0.18)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  },
  statusBar: {
    height: '44px',
    backgroundColor: '#4F46E5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: '20px',
    paddingRight: '20px',
    flexShrink: 0,
  },
  statusTime: {
    color: '#FFFFFF',
    fontSize: '13px',
    fontWeight: 600,
  },
  statusIcons: {
    color: '#FFFFFF',
    fontSize: '12px',
    letterSpacing: '2px',
  },
  header: {
    height: '56px',
    backgroundColor: '#4F46E5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: '8px',
    paddingRight: '8px',
    flexShrink: 0,
  },
  backBtn: {
    width: '40px',
    height: '40px',
    border: 'none',
    background: 'rgba(255,255,255,0.15)',
    borderRadius: '50%',
    color: '#FFFFFF',
    fontSize: '20px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: '17px',
    fontWeight: 700,
    letterSpacing: '0.3px',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
  },
  bottomSpacer: {
    height: '20px',
    backgroundColor: '#FFFFFF',
    flexShrink: 0,
  },
};
