/**
 * NextStepsScreen
 * ================
 * Displays the full recommended action plan with traceable "why" for each step.
 * Also shows provider recommendation, evidence links, and the full disclaimer.
 */

import React from 'react';
import AppShell from '../components/AppShell';
import RecommendationCard from '../components/RecommendationCard';
import DisclaimerCard from '../components/DisclaimerCard';
import type { AnalysisResponse } from '../types';
import { URGENCY_COLOR, URGENCY_BG, URGENCY_LABEL } from '../types';

interface NextStepsScreenProps {
  result: AnalysisResponse;
  onBack: () => void;
  onStartOver: () => void;
}

export default function NextStepsScreen({ result, onBack, onStartOver }: NextStepsScreenProps) {
  const { interpretation } = result;
  const urgencyColor = URGENCY_COLOR[interpretation.urgency];
  const urgencyBg = URGENCY_BG[interpretation.urgency];

  return (
    <AppShell title="Next Steps" onBack={onBack}>
      <div style={styles.wrapper}>

        {/* Urgency summary bar */}
        <div style={{ ...styles.urgencyBar, backgroundColor: urgencyBg, borderColor: urgencyColor + '55' }}>
          <div style={{ ...styles.urgencyDot, backgroundColor: urgencyColor }} />
          <div>
            <div style={{ ...styles.urgencyTitle, color: urgencyColor }}>
              {URGENCY_LABEL[interpretation.urgency]}
            </div>
            <div style={styles.urgencySubtitle}>
              {result.explanation.urgency_statement}
            </div>
          </div>
        </div>

        {/* Provider recommendation */}
        <div style={styles.providerCard}>
          <div style={styles.providerRow}>
            <span style={styles.providerIcon}>🏥</span>
            <div>
              <div style={styles.providerLabel}>Recommended Provider</div>
              <div style={styles.providerName}>{interpretation.recommended_provider}</div>
            </div>
          </div>

          {interpretation.secondary_provider && (
            <div style={{ ...styles.providerRow, marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #E2E8F0' }}>
              <span style={styles.providerIcon}>👨‍⚕️</span>
              <div>
                <div style={styles.providerLabel}>Also Consider</div>
                <div style={styles.providerName}>{interpretation.secondary_provider}</div>
              </div>
            </div>
          )}
        </div>

        {/* Action plan */}
        <h3 style={styles.sectionHeading}>Your Action Plan</h3>

        {interpretation.recommended_actions.map((action, i) => (
          <RecommendationCard
            key={i}
            index={i + 1}
            action={action}
            why={interpretation.why[i] ?? 'Based on your dipstick findings.'}
          />
        ))}

        {/* Evidence links */}
        {interpretation.evidence_links.length > 0 && (
          <div style={styles.evidenceCard}>
            <h3 style={styles.evidenceTitle}>Clinical References Used</h3>
            <p style={styles.evidenceNote}>
              The rule engine is based on these publicly available guidelines:
            </p>
            {interpretation.evidence_links.map((link, i) => (
              <a
                key={i}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.evidenceLink}
              >
                ↗ {link.replace('https://', '').split('/')[0]}
              </a>
            ))}
          </div>
        )}

        {/* Full disclaimer */}
        <DisclaimerCard />

        {/* Start over */}
        <button style={styles.startOverBtn} onClick={onStartOver}>
          + Scan Another Strip
        </button>
      </div>
    </AppShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    paddingTop: '16px',
  },
  urgencyBar: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '14px',
    borderRadius: '14px',
    border: '1.5px solid',
  },
  urgencyDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    marginTop: '3px',
    flexShrink: 0,
  },
  urgencyTitle: {
    fontSize: '15px',
    fontWeight: 700,
    lineHeight: 1.2,
  },
  urgencySubtitle: {
    fontSize: '13px',
    color: '#374151',
    marginTop: '3px',
    lineHeight: 1.4,
  },
  providerCard: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '14px',
    padding: '16px',
  },
  providerRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
  },
  providerIcon: {
    fontSize: '24px',
    flexShrink: 0,
  },
  providerLabel: {
    fontSize: '11px',
    color: '#64748B',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.7px',
    marginBottom: '2px',
  },
  providerName: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#1E293B',
  },
  sectionHeading: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: '0.7px',
    margin: '4px 0 0',
  },
  evidenceCard: {
    backgroundColor: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '14px',
    padding: '14px',
  },
  evidenceTitle: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    margin: '0 0 6px',
  },
  evidenceNote: {
    fontSize: '12px',
    color: '#64748B',
    margin: '0 0 10px',
    lineHeight: 1.4,
  },
  evidenceLink: {
    display: 'block',
    fontSize: '12px',
    color: '#0D9488',
    textDecoration: 'none',
    padding: '5px 0',
    borderBottom: '1px solid #E2E8F0',
    fontWeight: 500,
  },
  startOverBtn: {
    padding: '16px',
    border: '2px solid #CCFBF1',
    borderRadius: '14px',
    backgroundColor: '#FFFFFF',
    color: '#0D9488',
    fontSize: '16px',
    fontWeight: 700,
    cursor: 'pointer',
    width: '100%',
    marginBottom: '8px',
  },
};
