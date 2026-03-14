/**
 * IntakeScreen
 * ==============
 * Clinical intake form — collects patient context before dipstick capture.
 * Risk factors, symptoms, and age feed the interpretation engine.
 */

import React, { useState } from 'react';
import AppShell from '../components/AppShell';
import type { ClinicalIntake } from '../types';
import { EMPTY_INTAKE } from '../types';

interface IntakeScreenProps {
  onBack: () => void;
  onComplete: (intake: ClinicalIntake) => void;
}

interface CardOption {
  field: keyof ClinicalIntake;
  title: string;
  subtitle?: string;
}

const RISK_FACTORS: CardOption[] = [
  { field: 'has_diabetes', title: 'Diabetes (Type 1 or 2)', subtitle: 'Including pre-diabetes' },
  { field: 'has_hypertension', title: 'Hypertension', subtitle: 'High blood pressure' },
  { field: 'has_ckd_family_history', title: 'Family history of CKD', subtitle: 'Parent or sibling with kidney disease' },
  { field: 'has_frequent_utis', title: 'Frequent UTIs', subtitle: 'More than 2 per year' },
  { field: 'has_cardiovascular_disease', title: 'Cardiovascular disease', subtitle: 'Heart disease or stroke history' },
  { field: 'is_pregnant', title: 'Currently pregnant', subtitle: 'Including first trimester' },
];

const SYMPTOMS: CardOption[] = [
  { field: 'symptom_swelling', title: 'Swelling in legs or feet' },
  { field: 'symptom_fatigue', title: 'Fatigue or weakness' },
  { field: 'symptom_urination_changes', title: 'Changes in urination' },
  { field: 'symptom_back_pain', title: 'Lower back or flank pain' },
  { field: 'symptom_foamy_urine', title: 'Foamy or frothy urine' },
  { field: 'symptom_burning_urination', title: 'Burning when urinating' },
  { field: 'symptom_frequent_urination', title: 'Urinating more frequently' },
  { field: 'symptom_pelvic_pain', title: 'Pelvic or abdominal pain' },
];

export default function IntakeScreen({ onBack, onComplete }: IntakeScreenProps) {
  const [intake, setIntake] = useState<ClinicalIntake>({ ...EMPTY_INTAKE });

  const toggle = (field: keyof ClinicalIntake) => {
    setIntake((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const setAge = (val: string) => {
    const n = parseInt(val, 10);
    setIntake((prev) => ({ ...prev, age: isNaN(n) ? undefined : n }));
  };

  return (
    <AppShell title="Clinical Intake" onBack={onBack}>
      <div style={styles.wrapper}>
        {/* Progress bar */}
        <div style={styles.progressRow}>
          <span style={styles.progressLabel}>Step 1 of 3</span>
          <div style={styles.progressTrack}>
            <div style={{ ...styles.progressFill, width: '33%' }} />
          </div>
        </div>

        <p style={styles.subtitle}>This helps us apply the right screening guidelines</p>

        {/* Age */}
        <div style={styles.sectionLabel}>AGE</div>
        <input
          type="number"
          placeholder="e.g. 58"
          value={intake.age ?? ''}
          onChange={(e) => setAge(e.target.value)}
          style={styles.ageInput}
        />

        {/* Risk Factors */}
        <div style={styles.sectionLabel}>RISK FACTORS</div>
        {RISK_FACTORS.map((opt) => (
          <ToggleCard
            key={opt.field}
            selected={!!intake[opt.field]}
            title={opt.title}
            subtitle={opt.subtitle}
            onToggle={() => toggle(opt.field)}
          />
        ))}

        {/* Symptoms */}
        <div style={styles.sectionLabel}>CURRENT SYMPTOMS</div>
        {SYMPTOMS.map((opt) => (
          <ToggleCard
            key={opt.field}
            selected={!!intake[opt.field]}
            title={opt.title}
            onToggle={() => toggle(opt.field)}
          />
        ))}

        {/* CTA */}
        <button style={styles.nextBtn} onClick={() => onComplete(intake)}>
          Next: Capture Dipstick &rarr;
        </button>
        <button style={styles.skipLink} onClick={() => onComplete({ ...EMPTY_INTAKE })}>
          Skip this step &rarr;
        </button>
      </div>
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// ToggleCard sub-component
// ---------------------------------------------------------------------------

function ToggleCard({
  selected,
  title,
  subtitle,
  onToggle,
}: {
  selected: boolean;
  title: string;
  subtitle?: string;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      style={{
        ...cardStyles.card,
        border: selected ? '2px solid #0D9488' : '1px solid #E2E8F0',
        backgroundColor: selected ? '#F0FDF4' : '#FFFFFF',
      }}
    >
      <div
        style={{
          ...cardStyles.checkbox,
          backgroundColor: selected ? '#0D9488' : '#FFFFFF',
          borderColor: selected ? '#0D9488' : '#CBD5E1',
        }}
      >
        {selected && <span style={cardStyles.checkmark}>&#10003;</span>}
      </div>
      <div>
        <div style={cardStyles.title}>{title}</div>
        {subtitle && <div style={cardStyles.subtitle}>{subtitle}</div>}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    paddingTop: '12px',
    paddingBottom: '24px',
  },
  progressRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  progressLabel: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#0D9488',
  },
  progressTrack: {
    height: '6px',
    backgroundColor: '#E2E8F0',
    borderRadius: '99px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0D9488',
    borderRadius: '99px',
    transition: 'width 0.3s ease',
  },
  subtitle: {
    fontSize: '14px',
    color: '#64748B',
    margin: 0,
  },
  sectionLabel: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#94A3B8',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.8px',
    marginTop: '12px',
  },
  ageInput: {
    width: '100%',
    height: '48px',
    fontSize: '14px',
    border: '1px solid #E2E8F0',
    borderRadius: '12px',
    padding: '0 16px',
    backgroundColor: '#FFFFFF',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  nextBtn: {
    width: '100%',
    height: '54px',
    backgroundColor: '#0D9488',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '14px',
    fontSize: '17px',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(13,148,136,0.35)',
    marginTop: '16px',
  },
  skipLink: {
    width: '100%',
    background: 'none',
    border: 'none',
    color: '#94A3B8',
    fontSize: '13px',
    textDecoration: 'underline',
    cursor: 'pointer',
    padding: '8px 0',
  },
};

const cardStyles: Record<string, React.CSSProperties> = {
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 16px',
    borderRadius: '14px',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left' as const,
    transition: 'all 0.15s ease',
    boxSizing: 'border-box' as const,
  },
  checkbox: {
    width: '22px',
    height: '22px',
    borderRadius: '6px',
    border: '2px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'all 0.15s ease',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: '14px',
    fontWeight: 700,
    lineHeight: 1,
  },
  title: {
    fontSize: '15px',
    color: '#1E293B',
    fontWeight: 500,
  },
  subtitle: {
    fontSize: '12px',
    color: '#94A3B8',
    marginTop: '2px',
  },
};
