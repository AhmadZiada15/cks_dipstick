/**
 * FindingCard
 * ============
 * Displays a single dipstick pad reading with a colored value badge.
 * Normal values are muted; abnormal values are highlighted.
 */

import React from 'react';
import type { SemiQuant, NitriteResult } from '../types';

interface FindingCardProps {
  padName: string;         // e.g. "Protein"
  value: SemiQuant | NitriteResult | number;
  isAbnormal: boolean;
  confidence?: number;     // 0-1
}

const VALUE_BADGE_COLOR: Record<string, string> = {
  negative: '#16A34A',
  trace:    '#D97706',
  '1+':     '#EA580C',
  '2+':     '#DC2626',
  '3+':     '#9F1239',
  '4+':     '#7C3AED',
  positive: '#DC2626',
};

const VALUE_BADGE_BG: Record<string, string> = {
  negative: '#DCFCE7',
  trace:    '#FEF3C7',
  '1+':     '#FFEDD5',
  '2+':     '#FEE2E2',
  '3+':     '#FFE4E6',
  '4+':     '#EDE9FE',
  positive: '#FEE2E2',
};

function formatValue(value: SemiQuant | NitriteResult | number): string {
  if (typeof value === 'number') return value.toString();
  return value;
}

export default function FindingCard({
  padName,
  value,
  isAbnormal,
  confidence,
}: FindingCardProps) {
  const displayValue = formatValue(value);
  const valueKey = displayValue.toLowerCase();

  const badgeColor = isAbnormal
    ? (VALUE_BADGE_COLOR[valueKey] ?? '#DC2626')
    : '#16A34A';
  const badgeBg = isAbnormal
    ? (VALUE_BADGE_BG[valueKey] ?? '#FEE2E2')
    : '#DCFCE7';

  return (
    <div style={{ ...styles.card, borderColor: isAbnormal ? '#FCA5A5' : '#E2E8F0' }}>
      <div style={styles.left}>
        <span style={styles.padIcon}>{isAbnormal ? '⚠️' : '✓'}</span>
        <div style={styles.padInfo}>
          <span style={styles.padName}>{padName}</span>
          {confidence !== undefined && (
            <span style={styles.confidence}>
              {Math.round(confidence * 100)}% confidence
            </span>
          )}
        </div>
      </div>

      <span
        style={{
          ...styles.valueBadge,
          color: badgeColor,
          backgroundColor: badgeBg,
        }}
      >
        {displayValue}
      </span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 14px',
    backgroundColor: '#FFFFFF',
    border: '1px solid',
    borderRadius: '12px',
    marginBottom: '8px',
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  padIcon: {
    fontSize: '18px',
  },
  padInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  padName: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#1E293B',
  },
  confidence: {
    fontSize: '11px',
    color: '#94A3B8',
    marginTop: '1px',
  },
  valueBadge: {
    fontSize: '13px',
    fontWeight: 700,
    padding: '4px 12px',
    borderRadius: '20px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
};
