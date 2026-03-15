/**
 * RecommendationCard
 * ===================
 * Displays a single recommended action with its traceable "why".
 * Used on the NextSteps screen.
 */

import React, { useState } from 'react';

interface RecommendationCardProps {
  index: number;
  action: string;
  why: string;
}

export default function RecommendationCard({ index, action, why }: RecommendationCardProps) {
  const [showWhy, setShowWhy] = useState(false);

  return (
    <div style={styles.card}>
      <div style={styles.topRow}>
        <div style={styles.indexBadge}>{index}</div>
        <p style={styles.actionText}>{action}</p>
      </div>

      <button
        style={styles.whyBtn}
        onClick={() => setShowWhy((p) => !p)}
        aria-expanded={showWhy}
      >
        {showWhy ? '▲ Hide reason' : '▼ Why this?'}
      </button>

      {showWhy && (
        <div style={styles.whyBox}>
          <span style={styles.whyIcon}>🔍</span>
          <p style={styles.whyText}>{why}</p>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '14px',
    padding: '14px',
    marginBottom: '10px',
  },
  topRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
  },
  indexBadge: {
    minWidth: '28px',
    height: '28px',
    borderRadius: '50%',
    backgroundColor: '#8B6A4D',
    color: '#FFFFFF',
    fontSize: '13px',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: '1px',
  },
  actionText: {
    fontSize: '15px',
    color: '#1E293B',
    lineHeight: 1.5,
    margin: 0,
    fontWeight: 500,
  },
  whyBtn: {
    marginTop: '10px',
    marginLeft: '40px',
    padding: '4px 10px',
    border: 'none',
    background: 'none',
    color: '#8B6A4D',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    borderRadius: '6px',
    transition: 'background 0.15s',
  },
  whyBox: {
    marginTop: '8px',
    marginLeft: '40px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    backgroundColor: '#F6EFE8',
    borderRadius: '10px',
    padding: '10px 12px',
  },
  whyIcon: {
    fontSize: '14px',
    flexShrink: 0,
  },
  whyText: {
    fontSize: '13px',
    color: '#7C5A3A',
    lineHeight: 1.5,
    margin: 0,
  },
};
