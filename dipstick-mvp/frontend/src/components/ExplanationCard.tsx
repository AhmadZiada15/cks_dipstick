/**
 * ExplanationCard
 * ================
 * Displays the LLM-generated (or template) plain-English explanation
 * in a structured, digestible card layout.
 */

import React from 'react';
import type { Explanation, UrgencyLevel } from '../types';
import { URGENCY_COLOR, URGENCY_BG, URGENCY_LABEL } from '../types';

interface ExplanationCardProps {
  explanation: Explanation;
  urgency: UrgencyLevel;
}

export default function ExplanationCard({ explanation, urgency }: ExplanationCardProps) {
  const urgencyColor = URGENCY_COLOR[urgency];
  const urgencyBg    = URGENCY_BG[urgency];

  return (
    <div style={styles.wrapper}>
      {/* Urgency pill */}
      <div style={{ ...styles.urgencyBanner, backgroundColor: urgencyBg, borderColor: urgencyColor + '44' }}>
        <span style={urgencyDotStyle(urgencyColor)} />
        <span style={{ ...styles.urgencyText, color: urgencyColor }}>
          {URGENCY_LABEL[urgency]}
        </span>
      </div>

      {/* Summary */}
      <div style={styles.summaryCard}>
        <p style={styles.summaryText}>{explanation.summary}</p>
      </div>

      {/* Urgency statement */}
      <div style={{ ...styles.urgencyStatement, backgroundColor: urgencyBg }}>
        <span style={styles.clockIcon}>🕐</span>
        <p style={{ ...styles.urgencyStatText, color: urgencyColor }}>
          {explanation.urgency_statement}
        </p>
      </div>

      {/* Finding explanations */}
      {explanation.finding_explanations.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>What We Found</h3>
          {explanation.finding_explanations.map((text, i) => (
            <div key={i} style={styles.findingRow}>
              <span style={styles.bullet}>•</span>
              <p style={styles.findingText}>{text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Next steps narrative */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>What To Do Next</h3>
        <p style={styles.narrativeText}>{explanation.next_steps_narrative}</p>
      </div>
    </div>
  );
}

// Extracted so it doesn't pollute the typed styles Record
const urgencyDotStyle = (color: string): React.CSSProperties => ({
  width: '10px', height: '10px', borderRadius: '50%',
  backgroundColor: color, flexShrink: 0, display: 'inline-block',
});

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  urgencyBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 14px',
    borderRadius: '12px',
    border: '1.5px solid',
  },
  urgencyDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  urgencyText: {
    fontSize: '14px',
    fontWeight: 700,
    letterSpacing: '0.3px',
  },
  summaryCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: '14px',
    padding: '16px',
  },
  summaryText: {
    fontSize: '15px',
    color: '#1E293B',
    lineHeight: 1.6,
    margin: 0,
    fontWeight: 500,
  },
  urgencyStatement: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    borderRadius: '12px',
    padding: '12px 14px',
  },
  clockIcon: {
    fontSize: '18px',
    flexShrink: 0,
  },
  urgencyStatText: {
    fontSize: '14px',
    fontWeight: 600,
    lineHeight: 1.5,
    margin: 0,
  },
  section: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '14px',
    padding: '14px',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    margin: '0 0 10px',
  },
  findingRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    marginBottom: '8px',
  },
  bullet: {
    color: '#4F46E5',
    fontWeight: 700,
    fontSize: '18px',
    lineHeight: '1.4',
    flexShrink: 0,
  },
  findingText: {
    fontSize: '14px',
    color: '#374151',
    lineHeight: 1.6,
    margin: 0,
  },
  narrativeText: {
    fontSize: '14px',
    color: '#374151',
    lineHeight: 1.7,
    margin: 0,
  },
};
