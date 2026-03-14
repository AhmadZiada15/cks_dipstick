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
import type { AnalysisResponse, ClinicalIntake } from '../types';
import { URGENCY_COLOR, URGENCY_BG, URGENCY_LABEL, BRAND_TEAL } from '../types';

interface NextStepsScreenProps {
  result: AnalysisResponse;
  intake: ClinicalIntake;
  onBack: () => void;
  onStartOver: () => void;
}

// Map recommended_provider string → Google Maps search query
function mapsSearchUrl(provider: string): string {
  const lower = provider.toLowerCase();
  let query = 'primary care doctor near me';
  if (lower.includes('nephrol'))   query = 'nephrologist near me';
  else if (lower.includes('urol')) query = 'urologist near me';
  else if (lower.includes('endo')) query = 'endocrinologist near me';
  else if (lower.includes('card')) query = 'cardiologist near me';
  else if (lower.includes('ob') || lower.includes('gyn')) query = 'obgyn near me';
  else if (lower.includes('intern') || lower.includes('general') || lower.includes('primary')) query = 'primary care physician near me';
  return `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
}

export default function NextStepsScreen({ result, intake, onBack, onStartOver }: NextStepsScreenProps) {
  const { interpretation, explanation } = result;

  // Defensive guard: if clinical data is missing, show fallback
  if (!interpretation || !explanation) {
    return (
      <AppShell title="Next Steps" onBack={onBack}>
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1E293B', marginBottom: '8px' }}>
            No Results Available
          </h2>
          <p style={{ fontSize: '14px', color: '#64748B', lineHeight: 1.6, marginBottom: '24px' }}>
            Clinical interpretation is not available. Please go back and try scanning again.
          </p>
          <button onClick={onStartOver} style={{
            padding: '12px 24px', backgroundColor: '#0D9488', color: '#FFFFFF',
            border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 700, cursor: 'pointer',
          }}>
            Start Over
          </button>
        </div>
      </AppShell>
    );
  }

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
              {explanation.urgency_statement}
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

        {/* ── Physician section ───────────────────────── */}
        {intake.physician_name && !intake.has_no_physician ? (
          // Patient has a physician — prompt to share results
          <div style={styles.physicianCard}>
            <div style={styles.physicianRow}>
              <span style={styles.physicianIcon}>👨‍⚕️</span>
              <div style={{ flex: 1 }}>
                <div style={styles.physicianLabel}>Share with your physician</div>
                <div style={styles.physicianName}>{intake.physician_name}</div>
                <p style={styles.physicianHint}>
                  Show or send this report to {intake.physician_name} at your next visit.
                  Your FHIR-formatted results were also submitted to the clinical record.
                </p>
              </div>
            </div>
          </div>
        ) : (
          // Patient has no physician — find one
          <div style={{ ...styles.physicianCard, borderColor: '#FED7AA', backgroundColor: '#FFF7ED' }}>
            <div style={styles.physicianRow}>
              <span style={styles.physicianIcon}>📍</span>
              <div style={{ flex: 1 }}>
                <div style={{ ...styles.physicianLabel, color: '#92400E' }}>
                  Find a {interpretation.recommended_provider} near you
                </div>
                <p style={{ ...styles.physicianHint, color: '#78350F' }}>
                  You indicated you don't have a regular doctor. We recommend
                  finding a {interpretation.recommended_provider.toLowerCase()} to review these results.
                </p>
                <a
                  href={mapsSearchUrl(interpretation.recommended_provider)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.mapsBtn}
                >
                  🗺 Search on Google Maps →
                </a>
                {interpretation.secondary_provider && (
                  <a
                    href={mapsSearchUrl(interpretation.secondary_provider)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ ...styles.mapsBtn, marginTop: '8px', backgroundColor: '#FFF7ED', color: '#92400E', border: '1.5px solid #FED7AA' }}
                  >
                    🗺 Find a {interpretation.secondary_provider} →
                  </a>
                )}
              </div>
            </div>
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
    color: BRAND_TEAL,
    fontSize: '16px',
    fontWeight: 700,
    cursor: 'pointer',
    width: '100%',
    marginBottom: '8px',
  },
  physicianCard: {
    backgroundColor: '#F0FDF4',
    border: `1.5px solid ${BRAND_TEAL}55`,
    borderRadius: '14px',
    padding: '16px',
  },
  physicianRow: {
    display: 'flex', alignItems: 'flex-start', gap: '12px',
  },
  physicianIcon: { fontSize: '26px', flexShrink: 0 },
  physicianLabel: {
    fontSize: '11px', fontWeight: 700, color: '#065F46',
    textTransform: 'uppercase' as const, letterSpacing: '0.7px', marginBottom: '4px',
  },
  physicianName: { fontSize: '16px', fontWeight: 700, color: '#1E293B' },
  physicianHint: {
    fontSize: '13px', color: '#374151', lineHeight: 1.4,
    margin: '6px 0 0',
  },
  mapsBtn: {
    display: 'inline-block',
    marginTop: '10px',
    padding: '10px 16px',
    backgroundColor: BRAND_TEAL,
    color: '#FFFFFF',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: 600,
    textDecoration: 'none',
    cursor: 'pointer',
  },
};
