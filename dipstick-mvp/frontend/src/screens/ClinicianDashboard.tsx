/**
 * ClinicianDashboard
 * ===================
 * Clinician-facing dashboard showing patient dipstick history,
 * protein trend chart, summary stats, and FHIR/RAG integration status.
 *
 * Data comes from:
 *   GET /api/patients/history   — 10 hardcoded CKD-progression entries
 *   GET /api/fhir/status        — IRIS connectivity + metadata
 */

import React, { useEffect, useState } from 'react';
import type { PatientHistoryEntry, FhirStatusResponse } from '../types';
import { URGENCY_COLOR, URGENCY_BG } from '../types';
import { fetchPatientHistory, fetchFhirStatus } from '../api/client';

interface ClinicianDashboardProps {
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Protein level → numeric value for charting
// ---------------------------------------------------------------------------

const PROTEIN_NUM: Record<string, number> = {
  negative: 0,
  trace: 1,
  '1+': 2,
  '2+': 3,
  '3+': 4,
  '4+': 5,
};

const PROTEIN_LABELS = ['Neg', 'Tr', '1+', '2+', '3+', '4+'];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ClinicianDashboard({ onBack }: ClinicianDashboardProps) {
  const [history, setHistory] = useState<PatientHistoryEntry[] | null>(null);
  const [fhirStatus, setFhirStatus] = useState<FhirStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [hist, fhir] = await Promise.all([
          fetchPatientHistory(),
          fetchFhirStatus().catch(() => null),
        ]);
        if (!cancelled) {
          setHistory(hist);
          setFhirStatus(fhir);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Loading clinician dashboard...</p>
      </div>
    );
  }

  if (error || !history) {
    return (
      <div style={styles.loadingContainer}>
        <p style={{ color: '#DC2626', fontSize: '16px' }}>{error || 'No data available'}</p>
        <button style={styles.backBtn} onClick={onBack}>Back</button>
      </div>
    );
  }

  const irisReachable = fhirStatus?.server?.reachable ?? false;
  const highUrgencyCount = history.filter(e => e.urgency === 'high').length;
  const latestProtein = history[history.length - 1]?.protein ?? 'negative';
  const avgConfidence = history.reduce((s, e) => s + e.confidence, 0) / history.length;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={onBack}>Back</button>
        <h1 style={styles.title}>Clinician Dashboard</h1>
        <div style={{
          ...styles.irisPill,
          backgroundColor: irisReachable ? '#DCFCE7' : '#FEE2E2',
          color: irisReachable ? '#166534' : '#991B1B',
        }}>
          {irisReachable ? 'IRIS Online' : 'IRIS Offline'}
        </div>
      </div>

      {/* Protein Trend Chart */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Protein Trend (Last 10 Scans)</h2>
        <ProteinTrendChart entries={history} />
      </div>

      {/* Summary Stats */}
      <div style={styles.statsRow}>
        <StatCard label="Total Scans" value={String(history.length)} color="#8B6A4D" />
        <StatCard label="High Urgency" value={String(highUrgencyCount)} color="#DC2626" />
        <StatCard label="Latest Protein" value={latestProtein} color="#D97706" />
      </div>

      {/* Avg Confidence */}
      <div style={styles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', color: '#64748B', fontWeight: 600 }}>Avg Confidence</span>
          <span style={{ fontSize: '20px', fontWeight: 700, color: '#1E293B' }}>
            {(avgConfidence * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Results Table */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Scan History</h2>
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>Protein</th>
                <th style={styles.th}>Blood</th>
                <th style={styles.th}>WBC</th>
                <th style={styles.th}>Nitrite</th>
                <th style={styles.th}>Urgency</th>
                <th style={styles.th}>Conf</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry, i) => (
                <tr key={i} style={i % 2 === 0 ? styles.trEven : undefined}>
                  <td style={styles.td}>{formatDate(entry.date)}</td>
                  <td style={styles.td}>{entry.protein}</td>
                  <td style={styles.td}>{entry.blood}</td>
                  <td style={styles.td}>{entry.leukocytes}</td>
                  <td style={styles.td}>{entry.nitrite}</td>
                  <td style={styles.td}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: URGENCY_BG[entry.urgency],
                      color: URGENCY_COLOR[entry.urgency],
                    }}>
                      {entry.urgency}
                    </span>
                  </td>
                  <td style={styles.td}>{(entry.confidence * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* RAG Status Card */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>RAG Pipeline Status</h2>
        <div style={{ fontSize: '13px', color: '#64748B', lineHeight: 1.6 }}>
          <div><strong>Guideline Chunks:</strong> 18 (KDIGO, NICE, AUA, ADA, USPSTF)</div>
          <div><strong>Retrieval Mode:</strong> TF-IDF (sklearn) / IRIS Vector Search</div>
          <div><strong>Embedding Model:</strong> all-MiniLM-L6-v2 (384-dim)</div>
          <div><strong>Top-K:</strong> 3 chunks per query</div>
        </div>
      </div>

      {/* FHIR-SQL Query Details */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>FHIR-SQL Builder Query</h2>
        <pre style={styles.codeBlock}>{FHIR_SQL_QUERY}</pre>
        <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '8px', marginBottom: 0 }}>
          InterSystems IRIS for Health - FHIR-SQL projection
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Protein Trend Chart (SVG)
// ---------------------------------------------------------------------------

function ProteinTrendChart({ entries }: { entries: PatientHistoryEntry[] }) {
  const W = 340;
  const H = 160;
  const PAD_L = 32;
  const PAD_R = 12;
  const PAD_T = 12;
  const PAD_B = 28;

  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const maxVal = 5; // 4+ = 5

  const points = entries.map((e, i) => {
    const x = PAD_L + (i / (entries.length - 1)) * plotW;
    const y = PAD_T + plotH - ((PROTEIN_NUM[e.protein] ?? 0) / maxVal) * plotH;
    return { x, y, entry: e };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      {/* Y-axis labels */}
      {PROTEIN_LABELS.map((label, i) => {
        const y = PAD_T + plotH - (i / maxVal) * plotH;
        return (
          <g key={label}>
            <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#E2E8F0" strokeWidth={0.5} />
            <text x={PAD_L - 4} y={y + 3} textAnchor="end" fontSize="8" fill="#94A3B8">{label}</text>
          </g>
        );
      })}

      {/* Line */}
      <path d={linePath} fill="none" stroke="#8B6A4D" strokeWidth={2} strokeLinejoin="round" />

      {/* Area fill */}
      <path
        d={`${linePath} L ${points[points.length - 1].x} ${PAD_T + plotH} L ${points[0].x} ${PAD_T + plotH} Z`}
        fill="url(#areaGrad)"
        opacity={0.15}
      />
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8B6A4D" />
          <stop offset="100%" stopColor="#8B6A4D" stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* Data points */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={3.5}
          fill={p.entry.urgency === 'high' ? '#DC2626' : '#8B6A4D'}
          stroke="#fff"
          strokeWidth={1.5}
        />
      ))}

      {/* X-axis date labels (first, middle, last) */}
      {[0, Math.floor(entries.length / 2), entries.length - 1].map(idx => (
        <text
          key={idx}
          x={points[idx].x}
          y={H - 4}
          textAnchor="middle"
          fontSize="7"
          fill="#94A3B8"
        >
          {formatShortDate(entries[idx].date)}
        </text>
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={styles.statCard}>
      <div style={{ fontSize: '22px', fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, marginTop: '4px' }}>{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const FHIR_SQL_QUERY = `SELECT
  obs.Key                   AS observation_id,
  obs.EffectiveDateTime     AS date,
  code.CodingCode           AS loinc_code,
  val.ValueString           AS result_value
FROM
  HSFHIR_X0001_S.Observation obs
  JOIN HSFHIR_X0001_S.Observation_code_coding code
    ON obs.Key = code.Observation
  JOIN HSFHIR_X0001_S.Observation_valueQuantity val
    ON obs.Key = val.Observation
WHERE
  code.CodingSystem = 'http://loinc.org'
  AND code.CodingCode IN (
    '20454-5','57678-3','5799-2','5802-4','2349-9'
  )
ORDER BY obs.EffectiveDateTime ASC`;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '480px',
    margin: '0 auto',
    padding: '16px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    gap: '16px',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #E2E8F0',
    borderTopColor: '#8B6A4D',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    fontSize: '15px',
    color: '#64748B',
    fontWeight: 500,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '20px',
  },
  backBtn: {
    padding: '6px 14px',
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    backgroundColor: '#FFFFFF',
    color: '#8B6A4D',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  title: {
    flex: 1,
    fontSize: '20px',
    fontWeight: 800,
    color: '#1E293B',
    margin: 0,
  },
  irisPill: {
    padding: '4px 10px',
    borderRadius: '9999px',
    fontSize: '11px',
    fontWeight: 700,
    whiteSpace: 'nowrap' as const,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: '14px',
    border: '1px solid #E2E8F0',
    padding: '16px',
    marginBottom: '14px',
  },
  cardTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#1E293B',
    margin: '0 0 12px',
  },
  statsRow: {
    display: 'flex',
    gap: '10px',
    marginBottom: '14px',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: '14px',
    border: '1px solid #E2E8F0',
    padding: '14px 12px',
    textAlign: 'center' as const,
  },
  tableWrapper: {
    overflowX: 'auto' as const,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '12px',
  },
  th: {
    textAlign: 'left' as const,
    padding: '6px 8px',
    borderBottom: '2px solid #E2E8F0',
    color: '#64748B',
    fontWeight: 700,
    fontSize: '11px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  td: {
    padding: '6px 8px',
    borderBottom: '1px solid #F1F5F9',
    color: '#1E293B',
  },
  trEven: {
    backgroundColor: '#F8FAFC',
  },
  codeBlock: {
    backgroundColor: '#1E293B',
    color: '#E2E8F0',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '11px',
    lineHeight: 1.5,
    overflowX: 'auto' as const,
    margin: 0,
    fontFamily: '"SF Mono", "Fira Code", Consolas, monospace',
  },
};
