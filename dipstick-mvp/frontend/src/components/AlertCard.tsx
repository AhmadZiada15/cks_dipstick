/**
 * AlertCard
 * ==========
 * Displays a single ClinicalFlag from the interpretation engine.
 * Color-coded by severity: info / warning / critical.
 * Expandable to show the full clinical reasoning.
 */

import React, { useState } from 'react';
import type { ClinicalFlag, FlagSeverity } from '../types';
import { SEVERITY_COLOR, SEVERITY_BG } from '../types';

const SEVERITY_ICON: Record<FlagSeverity, string> = {
  info:     'ℹ️',
  warning:  '⚠️',
  critical: '🔴',
};

const SEVERITY_LABEL: Record<FlagSeverity, string> = {
  info:     'Info',
  warning:  'Warning',
  critical: 'Attention Needed',
};

interface AlertCardProps {
  flag: ClinicalFlag;
}

export default function AlertCard({ flag }: AlertCardProps) {
  const [expanded, setExpanded] = useState(false);

  const color = SEVERITY_COLOR[flag.severity];
  const bg    = SEVERITY_BG[flag.severity];

  return (
    <div
      style={{
        ...styles.card,
        backgroundColor: bg,
        borderColor: color + '66',  // 40% opacity border
      }}
    >
      {/* Header row */}
      <button
        style={styles.headerRow}
        onClick={() => setExpanded((p) => !p)}
        aria-expanded={expanded}
      >
        <div style={styles.headerLeft}>
          <span style={styles.icon}>{SEVERITY_ICON[flag.severity]}</span>
          <div>
            <div style={{ ...styles.flagLabel, color }}>{flag.label}</div>
            <div style={{ ...styles.severityBadge, color }}>
              {SEVERITY_LABEL[flag.severity]}
            </div>
          </div>
        </div>
        <span style={{ ...styles.chevron, color, transform: expanded ? 'rotate(90deg)' : 'none' }}>
          ›
        </span>
      </button>

      {/* Expanded reasoning */}
      {expanded && (
        <div style={styles.reasoning}>
          <p style={styles.reasoningText}>{flag.reasoning}</p>
          {flag.triggered_by.length > 0 && (
            <div style={styles.triggeredBy}>
              <span style={styles.triggeredLabel}>Triggered by: </span>
              {flag.triggered_by.map((f) => (
                <span key={f} style={{ ...styles.triggerBadge, color, backgroundColor: '#FFFFFF88' }}>
                  {f}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    border: '1.5px solid',
    borderRadius: '14px',
    overflow: 'hidden',
    marginBottom: '10px',
  },
  headerRow: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  icon: {
    fontSize: '22px',
  },
  flagLabel: {
    fontSize: '15px',
    fontWeight: 700,
    lineHeight: 1.2,
  },
  severityBadge: {
    fontSize: '11px',
    fontWeight: 600,
    marginTop: '2px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  chevron: {
    fontSize: '22px',
    fontWeight: 700,
    transition: 'transform 0.2s ease',
    lineHeight: 1,
  },
  reasoning: {
    padding: '0 14px 14px',
  },
  reasoningText: {
    fontSize: '14px',
    color: '#374151',
    lineHeight: 1.6,
    margin: '0 0 10px',
  },
  triggeredBy: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '6px',
  },
  triggeredLabel: {
    fontSize: '12px',
    color: '#6B7280',
    fontWeight: 600,
  },
  triggerBadge: {
    fontSize: '12px',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: '20px',
    textTransform: 'capitalize',
  },
};
