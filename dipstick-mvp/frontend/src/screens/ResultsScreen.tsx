/**
 * ResultsScreen
 * ==============
 * Enhanced UroSense results with:
 *   - Pathway label
 *   - RiskScoreCard (inline)
 *   - ActionCTA card
 *   - Enhanced biomarker cards with colored dots
 *   - Numbered next steps with citations
 *   - Share with Provider button (Web Share API + clipboard fallback)
 *   - FHIR tab preserved
 */

import React, { useState } from 'react';
import AppShell from '../components/AppShell';
import DisclaimerCard from '../components/DisclaimerCard';
import type { AnalysisResponse, FHIRIntegrationStatus, UrgencyLevel } from '../types';
import {
  PAD_DISPLAY_NAMES,
  URGENCY_COLOR,
  URGENCY_BG,
  URGENCY_LABEL,
} from '../types';
import { generateReport } from '../api/client';

interface ResultsScreenProps {
  result: AnalysisResponse;
  onBack: () => void;
  onNextSteps: () => void;
}

type Tab = 'summary' | 'findings' | 'fhir';

const PATHWAY_LABELS: Record<string, string> = {
  ckd: 'CKD',
  uti: 'UTI',
  diabetes: 'Diabetes',
  mixed: 'CKD + UTI',
  general: 'General',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function RiskScoreCard({
  riskScore,
  urgency,
  summary,
}: {
  riskScore: number;
  urgency: UrgencyLevel;
  summary: string;
}) {
  const color = URGENCY_COLOR[urgency];
  const bg = URGENCY_BG[urgency];
  const label = URGENCY_LABEL[urgency];

  return (
    <div style={{ ...rscStyles.card, backgroundColor: bg, borderColor: color + '44' }}>
      <div style={rscStyles.topRow}>
        <div style={{ ...rscStyles.scoreBadge, backgroundColor: color }}>
          {riskScore.toFixed(1)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ ...rscStyles.headline, color }}>{label}</div>
          <div style={rscStyles.subtext}>Risk Score {riskScore.toFixed(1)} / 10</div>
        </div>
      </div>
      <p style={rscStyles.summary}>{summary}</p>
    </div>
  );
}

const rscStyles: Record<string, React.CSSProperties> = {
  card: {
    borderRadius: '16px',
    border: '1.5px solid',
    padding: '16px',
  },
  topRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  scoreBadge: {
    width: '48px',
    height: '48px',
    borderRadius: '14px',
    color: '#FFFFFF',
    fontSize: '18px',
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headline: {
    fontSize: '18px',
    fontWeight: 800,
    lineHeight: 1.2,
  },
  subtext: {
    fontSize: '12px',
    color: '#64748B',
    marginTop: '2px',
  },
  summary: {
    fontSize: '14px',
    color: '#374151',
    lineHeight: 1.6,
    margin: '12px 0 0',
  },
};

function ActionCTA({
  urgency,
  provider,
  onNextSteps,
}: {
  urgency: UrgencyLevel;
  provider: string;
  onNextSteps: () => void;
}) {
  const isHigh = urgency === 'high';
  const isMod = urgency === 'moderate';
  const bgColor = isHigh || isMod ? '#0F2744' : '#0D9488';
  const ctaText = isHigh
    ? 'Find urgent care nearby'
    : isMod
    ? 'Schedule appointment'
    : 'View next steps';

  return (
    <div style={{ ...actStyles.card, backgroundColor: bgColor }}>
      <div style={actStyles.providerLabel}>Recommended: {provider}</div>
      <button style={actStyles.ctaBtn} onClick={onNextSteps}>
        {ctaText} &rarr;
      </button>
    </div>
  );
}

const actStyles: Record<string, React.CSSProperties> = {
  card: {
    borderRadius: '16px',
    padding: '16px',
  },
  providerLabel: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.7)',
    fontWeight: 600,
    marginBottom: '10px',
  },
  ctaBtn: {
    width: '100%',
    height: '48px',
    backgroundColor: 'rgba(255,255,255,0.15)',
    border: '1.5px solid rgba(255,255,255,0.3)',
    borderRadius: '12px',
    color: '#FFFFFF',
    fontSize: '16px',
    fontWeight: 700,
    cursor: 'pointer',
  },
};

function BiomarkerRow({
  name,
  value,
  isAbnormal,
  confidence,
}: {
  name: string;
  value: string | number;
  isAbnormal: boolean;
  confidence?: number;
}) {
  const valStr = typeof value === 'number' ? String(value) : value;
  const isTrace = valStr === 'trace';
  const dotColor = isAbnormal ? '#DC2626' : isTrace ? '#D97706' : '#0D9488';
  const badgeText = isAbnormal ? 'Elevated' : isTrace ? 'Trace' : 'Normal';
  const badgeBg = isAbnormal ? '#FEE2E2' : isTrace ? '#FEF3C7' : '#F0FDF4';
  const badgeColor = isAbnormal ? '#DC2626' : isTrace ? '#D97706' : '#0D9488';

  return (
    <div style={bioStyles.row}>
      <div style={{ ...bioStyles.dot, backgroundColor: dotColor }} />
      <div style={{ flex: 1 }}>
        <div style={bioStyles.padName}>{name}</div>
        {confidence !== undefined && (
          <div style={bioStyles.conf}>{Math.round(confidence * 100)}% conf</div>
        )}
      </div>
      <div style={bioStyles.valueCol}>
        <span style={bioStyles.value}>{valStr}</span>
        <span style={{ ...bioStyles.badge, backgroundColor: badgeBg, color: badgeColor }}>
          {badgeText}
        </span>
      </div>
    </div>
  );
}

const bioStyles: Record<string, React.CSSProperties> = {
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 0',
    borderBottom: '1px solid #F1F5F9',
  },
  dot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  padName: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1E293B',
  },
  conf: {
    fontSize: '11px',
    color: '#94A3B8',
  },
  valueCol: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  value: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#374151',
    minWidth: '60px',
    textAlign: 'right' as const,
  },
  badge: {
    fontSize: '10px',
    fontWeight: 700,
    borderRadius: '10px',
    padding: '2px 8px',
    textTransform: 'uppercase' as const,
  },
};

function FHIRStatusBanner({ status }: { status: FHIRIntegrationStatus }) {
  const posted = status.resources_posted;
  const isReachable = status.fhir_server_reachable && posted.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {isReachable ? (
        <div style={fhirStyles.successBanner}>
          <span style={fhirStyles.successPill}>&#10003; {posted.length} resources posted to InterSystems IRIS</span>
          <div style={fhirStyles.serverUrl}>{status.fhir_server_url}</div>
        </div>
      ) : (
        <div style={fhirStyles.warnBanner}>
          <span style={fhirStyles.warnText}>&#9888; IRIS server offline — bundle generated locally</span>
          <div style={fhirStyles.serverUrl}>{status.fhir_server_url}</div>
        </div>
      )}

      {status.errors.length > 0 && (
        <div style={fhirStyles.errorBanner}>
          {status.errors.map((err, i) => (
            <div key={i} style={fhirStyles.errorText}>&#10005; {err}</div>
          ))}
        </div>
      )}

      {posted.length > 0 && (
        <table style={fhirStyles.table}>
          <thead>
            <tr>
              <th style={fhirStyles.th}>Resource Type</th>
              <th style={fhirStyles.th}>Server ID</th>
              <th style={fhirStyles.th}>HTTP Status</th>
            </tr>
          </thead>
          <tbody>
            {posted.map((r, i) => (
              <tr key={i}>
                <td style={fhirStyles.td}>{r.resourceType}</td>
                <td style={{ ...fhirStyles.td, fontFamily: 'monospace', fontSize: '10px' }}>{r.id ?? '—'}</td>
                <td style={fhirStyles.td}>
                  <span style={{
                    ...fhirStyles.httpBadge,
                    backgroundColor: r.http_status && r.http_status < 300 ? '#DCFCE7' : '#FEE2E2',
                    color: r.http_status && r.http_status < 300 ? '#15803D' : '#DC2626',
                  }}>
                    {r.http_status ?? '—'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main ResultsScreen
// ---------------------------------------------------------------------------

export default function ResultsScreen({ result, onBack, onNextSteps }: ResultsScreenProps) {
  const [tab, setTab] = useState<Tab>('summary');
  const [retestDismissed, setRetestDismissed] = useState(false);
  const [shareStatus, setShareStatus] = useState<'idle' | 'loading' | 'copied' | 'shared' | 'error'>('idle');

  const { dipstick_values, interpretation, explanation } = result;

  // Defensive guard: if clinical data is missing, show a fallback message
  if (!dipstick_values || !interpretation || !explanation) {
    return (
      <AppShell title="Your Results" onBack={onBack}>
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1E293B', marginBottom: '8px' }}>
            Analysis Unavailable
          </h2>
          <p style={{ fontSize: '14px', color: '#64748B', lineHeight: 1.6, marginBottom: '24px' }}>
            {result.image_validation?.failure_reason ??
              'The image could not be analyzed. Please go back and try again with a clear photo of a dipstick strip.'}
          </p>
          <button
            onClick={onBack}
            style={{
              padding: '12px 24px', backgroundColor: '#0D9488', color: '#FFFFFF',
              border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 700, cursor: 'pointer',
            }}
          >
            ← Try Again
          </button>
        </div>
      </AppShell>
    );
  }

  const abnormalSet = new Set(interpretation.abnormal_findings);
  const padEntries = Object.entries(PAD_DISPLAY_NAMES) as [string, string][];
  const showRetestAlert = dipstick_values.confidence < 0.70 && !retestDismissed;
  const pathwayLabel = PATHWAY_LABELS[interpretation.screening_pathway] ?? 'General';

  // Share handler
  const handleShare = async () => {
    setShareStatus('loading');
    try {
      const { report_text } = await generateReport(result);

      if (navigator.share) {
        await navigator.share({
          title: 'UroSense Screening Report',
          text: report_text,
        });
        setShareStatus('shared');
      } else {
        await navigator.clipboard.writeText(report_text);
        setShareStatus('copied');
      }
    } catch (err: unknown) {
      // User cancelled share dialog = not an error
      if (err instanceof Error && err.name === 'AbortError') {
        setShareStatus('idle');
        return;
      }
      // Fallback: try clipboard
      try {
        const { report_text } = await generateReport(result);
        await navigator.clipboard.writeText(report_text);
        setShareStatus('copied');
      } catch {
        setShareStatus('error');
      }
    }
    // Reset after 3 seconds
    setTimeout(() => setShareStatus('idle'), 3000);
  };

  return (
    <AppShell title="Your Results" onBack={onBack}>
      {/* Low-confidence retest alert */}
      {showRetestAlert && (
        <div style={styles.retestBanner}>
          <div style={styles.retestContent}>
            <span style={styles.retestIcon}>&#9888;&#65039;</span>
            <div>
              <div style={styles.retestTitle}>Low image confidence ({Math.round(dipstick_values.confidence * 100)}%)</div>
              <div style={styles.retestMsg}>
                Results may be unreliable. Please re-capture the strip with better lighting and try again.
              </div>
            </div>
          </div>
          <button style={styles.retestDismiss} onClick={() => setRetestDismissed(true)}>&#10005;</button>
        </div>
      )}

      {/* Pathway + date subtitle */}
      <div style={styles.pathwayRow}>
        <span style={styles.pathwayPill}>{pathwayLabel}</span>
        <span style={styles.dateLabel}>
          Today &middot; {pathwayLabel} screening pathway
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
            {t === 'summary' ? 'Summary' : t === 'findings' ? 'Biomarkers' : 'FHIR'}
          </button>
        ))}
      </div>

      {/* --- TAB: Summary --- */}
      {tab === 'summary' && (
        <div style={styles.section}>
          <RiskScoreCard
            riskScore={interpretation.risk_score}
            urgency={interpretation.urgency}
            summary={explanation.summary}
          />

          <ActionCTA
            urgency={interpretation.urgency}
            provider={interpretation.recommended_provider}
            onNextSteps={onNextSteps}
          />

          {/* Clinical flags */}
          {interpretation.clinical_flags.length > 0 && (
            <>
              <h3 style={styles.sectionHeading}>Clinical Alerts</h3>
              {interpretation.clinical_flags.map((flag) => (
                <div
                  key={flag.id}
                  style={{
                    ...styles.flagCard,
                    borderLeftColor:
                      flag.severity === 'critical' ? '#DC2626' :
                      flag.severity === 'warning' ? '#D97706' : '#2563EB',
                  }}
                >
                  <div style={styles.flagLabel}>{flag.label}</div>
                  <div style={styles.flagReasoning}>{flag.reasoning}</div>
                </div>
              ))}
            </>
          )}

          {/* Numbered next steps */}
          <h3 style={styles.sectionHeading}>Recommended Next Steps</h3>
          {interpretation.recommended_actions.map((action, i) => (
            <div key={i} style={styles.stepRow}>
              <div style={styles.stepNum}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={styles.stepText}>{action}</div>
                {interpretation.why[i] && (
                  <div style={styles.stepWhy}>{interpretation.why[i]}</div>
                )}
              </div>
            </div>
          ))}

          {/* Evidence links */}
          {interpretation.evidence_links.length > 0 && (
            <div style={styles.evidenceCard}>
              <div style={styles.evidenceTitle}>Guideline References</div>
              {interpretation.evidence_links.map((link, i) => (
                <a
                  key={i}
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.evidenceLink}
                >
                  &#8599; {link.replace('https://', '').split('/')[0]}
                </a>
              ))}
            </div>
          )}

          {/* Share button */}
          <button
            style={{
              ...styles.shareBtn,
              opacity: shareStatus === 'loading' ? 0.6 : 1,
            }}
            onClick={handleShare}
            disabled={shareStatus === 'loading'}
          >
            {shareStatus === 'loading' ? 'Generating report…' :
             shareStatus === 'copied' ? 'Copied to clipboard!' :
             shareStatus === 'shared' ? 'Shared!' :
             shareStatus === 'error' ? 'Share failed — try again' :
             'Share with Provider'}
          </button>

          <DisclaimerCard />
        </div>
      )}

      {/* --- TAB: Findings (Biomarkers) --- */}
      {tab === 'findings' && (
        <div style={styles.section}>
          <div style={styles.biomarkerCard}>
            {padEntries.map(([key, displayName]) => {
              const rawVal = dipstick_values[key as keyof typeof dipstick_values];
              const isAbnormal = abnormalSet.has(key);
              const conf = dipstick_values.pad_confidences?.[key];
              return (
                <BiomarkerRow
                  key={key}
                  name={displayName}
                  value={rawVal as string | number}
                  isAbnormal={isAbnormal}
                  confidence={conf}
                />
              );
            })}
          </div>

          <div style={styles.confidenceRow}>
            <span style={styles.confLabel}>Overall image confidence:</span>
            <span style={styles.confValue}>{Math.round(dipstick_values.confidence * 100)}%</span>
          </div>

          <DisclaimerCard compact />
        </div>
      )}

      {/* --- TAB: FHIR --- */}
      {tab === 'fhir' && (
        <div style={styles.section}>
          {result.integration_status && (
            <FHIRStatusBanner status={result.integration_status} />
          )}

          <div style={styles.fhirHeader}>
            <span style={styles.fhirBadge}>FHIR R4 Bundle</span>
            <span style={styles.fhirDesc}>
              {result.fhir_bundle?.entry
                ? (result.fhir_bundle.entry as unknown[]).length
                : 0}{' '}
              resources
            </span>
          </div>
          <pre style={styles.fhirJson}>
            {result.fhir_bundle ? JSON.stringify(result.fhir_bundle, null, 2) : 'No FHIR bundle generated.'}
          </pre>
        </div>
      )}
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  pathwayRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    paddingTop: '14px',
    flexWrap: 'wrap',
  },
  pathwayPill: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#0D9488',
    backgroundColor: '#F0FDFA',
    border: '1px solid #99F6E4',
    borderRadius: '20px',
    padding: '2px 10px',
    textTransform: 'uppercase' as const,
  },
  dateLabel: {
    fontSize: '12px',
    color: '#94A3B8',
    fontWeight: 500,
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
    color: '#0D9488',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    paddingTop: '14px',
  },
  sectionHeading: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#94A3B8',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.7px',
    margin: '4px 0 0',
  },
  flagCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    border: '1px solid #E2E8F0',
    borderLeft: '4px solid',
    padding: '12px 14px',
  },
  flagLabel: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#1E293B',
  },
  flagReasoning: {
    fontSize: '12px',
    color: '#64748B',
    marginTop: '4px',
    lineHeight: 1.4,
  },
  stepRow: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
  },
  stepNum: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    backgroundColor: '#0D9488',
    color: '#FFFFFF',
    fontSize: '13px',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepText: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1E293B',
    lineHeight: 1.4,
  },
  stepWhy: {
    fontSize: '12px',
    color: '#64748B',
    marginTop: '2px',
    lineHeight: 1.4,
    fontStyle: 'italic',
  },
  evidenceCard: {
    backgroundColor: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '14px',
    padding: '14px',
  },
  evidenceTitle: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#475569',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.6px',
    marginBottom: '8px',
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
  shareBtn: {
    width: '100%',
    height: '48px',
    backgroundColor: '#0F2744',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '14px',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  biomarkerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: '14px',
    border: '1px solid #E2E8F0',
    padding: '4px 14px',
  },
  confidenceRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
  },
  confLabel: {
    fontSize: '12px',
    color: '#64748B',
  },
  confValue: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#0D9488',
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
  retestBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: '#FEF3C7',
    border: '1px solid #F59E0B',
    borderRadius: '12px',
    padding: '12px 14px',
    marginTop: '12px',
  },
  retestContent: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    flex: 1,
  },
  retestIcon: {
    fontSize: '18px',
    lineHeight: '1',
  },
  retestTitle: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#92400E',
  },
  retestMsg: {
    fontSize: '12px',
    color: '#78350F',
    marginTop: '2px',
    lineHeight: 1.4,
  },
  retestDismiss: {
    background: 'none',
    border: 'none',
    color: '#92400E',
    fontSize: '16px',
    cursor: 'pointer',
    padding: '0 0 0 8px',
    lineHeight: '1',
  },
};

const fhirStyles: Record<string, React.CSSProperties> = {
  successBanner: {
    backgroundColor: '#DCFCE7',
    border: '1px solid #86EFAC',
    borderRadius: '12px',
    padding: '10px 14px',
  },
  successPill: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#15803D',
  },
  warnBanner: {
    backgroundColor: '#FEF3C7',
    border: '1px solid #FCD34D',
    borderRadius: '12px',
    padding: '10px 14px',
  },
  warnText: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#92400E',
  },
  serverUrl: {
    fontSize: '11px',
    color: '#94A3B8',
    marginTop: '2px',
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    border: '1px solid #FCA5A5',
    borderRadius: '12px',
    padding: '10px 14px',
  },
  errorText: {
    fontSize: '12px',
    color: '#DC2626',
    fontWeight: 600,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '12px',
    borderRadius: '8px',
    overflow: 'hidden',
    border: '1px solid #E2E8F0',
  },
  th: {
    textAlign: 'left',
    padding: '6px 10px',
    backgroundColor: '#F1F5F9',
    color: '#64748B',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  td: {
    padding: '6px 10px',
    borderTop: '1px solid #E2E8F0',
    color: '#334155',
  },
  httpBadge: {
    fontSize: '11px',
    fontWeight: 700,
    borderRadius: '10px',
    padding: '2px 8px',
  },
};
