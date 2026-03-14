/**
 * ResultsScreen
 * ==============
 * Displays the full analysis result:
 *   - ExplanationCard (LLM summary + urgency)
 *   - AlertCard per clinical flag
 *   - FindingCard per dipstick pad
 *   - "See Next Steps" CTA
 */

import React, { useState } from 'react';
import AppShell from '../components/AppShell';
import ExplanationCard from '../components/ExplanationCard';
import AlertCard from '../components/AlertCard';
import FindingCard from '../components/FindingCard';
import DisclaimerCard from '../components/DisclaimerCard';
import type { AnalysisResponse } from '../types';
import { PAD_DISPLAY_NAMES } from '../types';

interface ResultsScreenProps {
  result: AnalysisResponse;
  onBack: () => void;
  onNextSteps: () => void;
}

type Tab = 'summary' | 'findings' | 'fhir';

export default function ResultsScreen({ result, onBack, onNextSteps }: ResultsScreenProps) {
  const [tab, setTab] = useState<Tab>('summary');

  const { dipstick_values, interpretation, explanation } = result;
  const abnormalSet = new Set(interpretation.abnormal_findings);

  const padEntries = Object.entries(PAD_DISPLAY_NAMES) as [string, string][];

  return (
    <AppShell title="Your Results" onBack={onBack}>
      {/* Session ID */}
      <div style={styles.sessionRow}>
        <span style={styles.sessionLabel}>Session:</span>
        <span style={styles.sessionId}>{result.session_id.slice(0, 16)}…</span>
        <span style={styles.confidencePill}>
          {Math.round(dipstick_values.confidence * 100)}% image confidence
        </span>
      </div>

      {/* Tab bar */}
      <div style={styles.tabBar}>
        {(['summary', 'findings', 'fhir'] as Tab[]).map((t) => (
          <button
            key={t}
            style={{
              ...styles.tabBtn,
              ...(tab === t ? styles.tabBtnActive : {}),
            }}
            onClick={() => setTab(t)}
          >
            {t === 'summary' ? '📋 Summary' : t === 'findings' ? '🧪 Findings' : '🏥 FHIR'}
          </button>
        ))}
      </div>

      {/* --- TAB: Summary --- */}
      {tab === 'summary' && (
        <div style={styles.section}>
          <ExplanationCard explanation={explanation} urgency={interpretation.urgency} />

          {interpretation.clinical_flags.length > 0 && (
            <>
              <h3 style={styles.sectionHeading}>Clinical Alerts</h3>
              {interpretation.clinical_flags.map((flag) => (
                <AlertCard key={flag.id} flag={flag} />
              ))}
            </>
          )}

          <DisclaimerCard />

          <button style={styles.nextStepsBtn} onClick={onNextSteps}>
            View Next Steps →
          </button>
        </div>
      )}

      {/* --- TAB: Findings --- */}
      {tab === 'findings' && (
        <div style={styles.section}>
          <div style={styles.findingsLegend}>
            <span style={styles.legendItem}><span style={{ color: '#DC2626' }}>⚠️</span> Abnormal</span>
            <span style={styles.legendItem}><span style={{ color: '#16A34A' }}>✓</span> Normal</span>
          </div>

          {padEntries.map(([key, displayName]) => {
            const rawVal = dipstick_values[key as keyof typeof dipstick_values];
            const isAbnormal = abnormalSet.has(key);
            const conf = dipstick_values.pad_confidences?.[key];
            return (
              <FindingCard
                key={key}
                padName={displayName}
                value={rawVal as string | number}
                isAbnormal={isAbnormal}
                confidence={conf}
              />
            );
          })}

          <DisclaimerCard compact />
        </div>
      )}

      {/* --- TAB: FHIR --- */}
      {tab === 'fhir' && (
        <div style={styles.section}>
          <div style={styles.fhirHeader}>
            <span style={styles.fhirBadge}>FHIR R4 Bundle</span>
            <span style={styles.fhirDesc}>
              {result.fhir_bundle.entry
                ? (result.fhir_bundle.entry as unknown[]).length
                : 0}{' '}
              resources
            </span>
          </div>
          <pre style={styles.fhirJson}>
            {JSON.stringify(result.fhir_bundle, null, 2)}
          </pre>
        </div>
      )}
    </AppShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sessionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    paddingTop: '12px',
    flexWrap: 'wrap',
  },
  sessionLabel: {
    fontSize: '11px',
    color: '#94A3B8',
    fontWeight: 600,
    textTransform: 'uppercase',
  },
  sessionId: {
    fontSize: '11px',
    color: '#64748B',
    fontFamily: 'monospace',
    flex: 1,
  },
  confidencePill: {
    fontSize: '11px',
    backgroundColor: '#EEF2FF',
    color: '#4F46E5',
    borderRadius: '20px',
    padding: '2px 8px',
    fontWeight: 600,
  },
  tabBar: {
    display: 'flex',
    gap: '6px',
    marginTop: '14px',
    backgroundColor: '#F1F5F9',
    padding: '4px',
    borderRadius: '12px',
  },
  tabBtn: {
    flex: 1,
    padding: '9px 4px',
    border: 'none',
    borderRadius: '9px',
    background: 'transparent',
    fontSize: '12px',
    fontWeight: 600,
    color: '#64748B',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    color: '#4F46E5',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    paddingTop: '14px',
  },
  sectionHeading: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: '0.7px',
    margin: '4px 0 0',
  },
  findingsLegend: {
    display: 'flex',
    gap: '16px',
    justifyContent: 'flex-end',
  },
  legendItem: {
    fontSize: '12px',
    color: '#64748B',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  nextStepsBtn: {
    padding: '16px',
    border: 'none',
    borderRadius: '14px',
    backgroundColor: '#4F46E5',
    color: '#FFFFFF',
    fontSize: '17px',
    fontWeight: 700,
    cursor: 'pointer',
    width: '100%',
    boxShadow: '0 4px 14px rgba(79,70,229,0.35)',
  },
  fhirHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  fhirBadge: {
    fontSize: '12px',
    fontWeight: 700,
    backgroundColor: '#DCFCE7',
    color: '#15803D',
    padding: '4px 10px',
    borderRadius: '20px',
  },
  fhirDesc: {
    fontSize: '12px',
    color: '#64748B',
  },
  fhirJson: {
    fontSize: '10px',
    color: '#334155',
    backgroundColor: '#F8FAFC',
    borderRadius: '12px',
    padding: '14px',
    overflowX: 'auto',
    border: '1px solid #E2E8F0',
    lineHeight: 1.6,
    maxHeight: '480px',
    overflowY: 'auto',
  },
};
