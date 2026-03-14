/**
 * IntakeScreen
 * ==============
 * Clinical intake form — collects patient context before dipstick capture.
 * Sections: demographics (age + sex) → risk factors → symptoms → physician.
 */

import React, { useState } from 'react';
import AppShell from '../components/AppShell';
import type { ClinicalIntake, BiologicalSex } from '../types';
import { EMPTY_INTAKE, BRAND_TEAL } from '../types';

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
  { field: 'has_diabetes',             title: 'Diabetes (Type 1 or 2)',       subtitle: 'Including pre-diabetes' },
  { field: 'has_hypertension',         title: 'Hypertension',                 subtitle: 'High blood pressure' },
  { field: 'has_ckd_family_history',   title: 'Family history of CKD',        subtitle: 'Parent or sibling with kidney disease' },
  { field: 'has_frequent_utis',        title: 'Frequent UTIs',                subtitle: 'More than 2 per year' },
  { field: 'has_cardiovascular_disease', title: 'Cardiovascular disease',     subtitle: 'Heart disease or stroke history' },
];

const SYMPTOMS: CardOption[] = [
  { field: 'symptom_swelling',           title: 'Swelling in legs or feet' },
  { field: 'symptom_fatigue',            title: 'Fatigue or weakness' },
  { field: 'symptom_urination_changes',  title: 'Changes in urination' },
  { field: 'symptom_back_pain',          title: 'Lower back or flank pain' },
  { field: 'symptom_foamy_urine',        title: 'Foamy or frothy urine' },
  { field: 'symptom_burning_urination',  title: 'Burning when urinating' },
  { field: 'symptom_frequent_urination', title: 'Urinating more frequently' },
  { field: 'symptom_pelvic_pain',        title: 'Pelvic or abdominal pain' },
];

const SEX_OPTIONS: { value: BiologicalSex; label: string }[] = [
  { value: 'male',              label: 'Male' },
  { value: 'female',            label: 'Female' },
  { value: 'intersex',          label: 'Intersex' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

// Pregnancy is only clinically relevant for female or intersex
const showPregnancy = (sex?: BiologicalSex) =>
  sex === 'female' || sex === 'intersex';

export default function IntakeScreen({ onBack, onComplete }: IntakeScreenProps) {
  const [intake, setIntake] = useState<ClinicalIntake>({ ...EMPTY_INTAKE });

  const toggle = (field: keyof ClinicalIntake) => {
    setIntake((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const setSex = (sex: BiologicalSex) => {
    setIntake((prev) => ({
      ...prev,
      sex,
      // Reset pregnancy if sex changed to non-applicable
      is_pregnant: showPregnancy(sex) ? prev.is_pregnant : false,
    }));
  };

  const setAge = (val: string) => {
    const n = parseInt(val, 10);
    setIntake((prev) => ({ ...prev, age: isNaN(n) ? undefined : n }));
  };

  const setPhysicianName = (val: string) => {
    setIntake((prev) => ({ ...prev, physician_name: val || undefined }));
  };

  const toggleNoPhysician = () => {
    setIntake((prev) => ({
      ...prev,
      has_no_physician: !prev.has_no_physician,
      // Clear name if they toggle to "no physician"
      physician_name: !prev.has_no_physician ? undefined : prev.physician_name,
    }));
  };

  return (
    <AppShell title="About You" onBack={onBack}>
      <div style={styles.wrapper}>

        {/* Progress */}
        <div style={styles.progressRow}>
          <span style={styles.progressLabel}>Step 2 of 4</span>
          <div style={styles.progressTrack}>
            <div style={{ ...styles.progressFill, width: '50%' }} />
          </div>
        </div>
        <p style={styles.subtitle}>Helps us apply the right screening guidelines</p>

        {/* ── Demographics ─────────────────────────────── */}
        <div style={styles.sectionLabel}>DEMOGRAPHICS</div>

        {/* Age */}
        <input
          type="number"
          placeholder="Age (e.g. 42)"
          value={intake.age ?? ''}
          onChange={(e) => setAge(e.target.value)}
          style={styles.textInput}
        />

        {/* Sex pill selector */}
        <div style={styles.pillRow}>
          {SEX_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSex(opt.value)}
              style={{
                ...styles.pill,
                backgroundColor: intake.sex === opt.value ? BRAND_TEAL : '#F1F5F9',
                color:           intake.sex === opt.value ? '#FFFFFF'  : '#475569',
                border:          intake.sex === opt.value ? `2px solid ${BRAND_TEAL}` : '2px solid transparent',
                fontWeight:      intake.sex === opt.value ? 700 : 500,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Pregnancy — only when female or intersex */}
        {showPregnancy(intake.sex) && (
          <ToggleCard
            selected={intake.is_pregnant}
            title="Currently pregnant"
            subtitle="Including first trimester"
            onToggle={() => toggle('is_pregnant')}
          />
        )}

        {/* ── Risk Factors ─────────────────────────────── */}
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

        {/* ── Symptoms ─────────────────────────────────── */}
        <div style={styles.sectionLabel}>CURRENT SYMPTOMS</div>
        {SYMPTOMS.map((opt) => (
          <ToggleCard
            key={opt.field}
            selected={!!intake[opt.field]}
            title={opt.title}
            onToggle={() => toggle(opt.field)}
          />
        ))}

        {/* ── Physician ────────────────────────────────── */}
        <div style={styles.sectionLabel}>YOUR PHYSICIAN</div>
        <p style={styles.physicianHint}>
          We'll add your doctor's name to the clinical report so they can follow up.
        </p>

        {/* No physician toggle */}
        <ToggleCard
          selected={intake.has_no_physician}
          title="I don't have a regular physician"
          subtitle="We'll help you find one on the next screen"
          onToggle={toggleNoPhysician}
        />

        {/* Physician name input — shown when not "no physician" */}
        {!intake.has_no_physician && (
          <input
            type="text"
            placeholder="Dr. Jane Smith  (optional)"
            value={intake.physician_name ?? ''}
            onChange={(e) => setPhysicianName(e.target.value)}
            style={styles.textInput}
          />
        )}

        {/* ── CTA ──────────────────────────────────────── */}
        <button style={styles.nextBtn} onClick={() => onComplete(intake)}>
          Next: Capture Dipstick →
        </button>
        <button style={styles.skipLink} onClick={() => onComplete({ ...EMPTY_INTAKE })}>
          Skip this step →
        </button>

      </div>
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// ToggleCard sub-component
// ---------------------------------------------------------------------------

function ToggleCard({
  selected, title, subtitle, onToggle,
}: {
  selected: boolean; title: string; subtitle?: string; onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      style={{
        ...cardStyles.card,
        border:          selected ? `2px solid ${BRAND_TEAL}` : '1px solid #E2E8F0',
        backgroundColor: selected ? '#F0FDF4' : '#FFFFFF',
      }}
    >
      <div style={{
        ...cardStyles.checkbox,
        backgroundColor: selected ? BRAND_TEAL : '#FFFFFF',
        borderColor:     selected ? BRAND_TEAL : '#CBD5E1',
      }}>
        {selected && <span style={cardStyles.checkmark}>✓</span>}
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
    display: 'flex', flexDirection: 'column', gap: '10px',
    paddingTop: '12px', paddingBottom: '32px',
  },
  progressRow: { display: 'flex', flexDirection: 'column', gap: '6px' },
  progressLabel: { fontSize: '12px', fontWeight: 600, color: BRAND_TEAL },
  progressTrack: {
    height: '6px', backgroundColor: '#E2E8F0',
    borderRadius: '99px', overflow: 'hidden',
  },
  progressFill: {
    height: '100%', backgroundColor: BRAND_TEAL,
    borderRadius: '99px', transition: 'width 0.3s ease',
  },
  subtitle: { fontSize: '14px', color: '#64748B', margin: 0 },
  sectionLabel: {
    fontSize: '11px', fontWeight: 700, color: '#94A3B8',
    textTransform: 'uppercase' as const, letterSpacing: '0.8px', marginTop: '12px',
  },
  textInput: {
    width: '100%', height: '48px', fontSize: '15px',
    border: '1px solid #E2E8F0', borderRadius: '12px',
    padding: '0 16px', backgroundColor: '#FFFFFF',
    outline: 'none', boxSizing: 'border-box' as const,
    color: '#1E293B',
  },
  pillRow: {
    display: 'flex', flexWrap: 'wrap' as const, gap: '8px',
  },
  pill: {
    flex: '1 1 auto',
    minWidth: '100px',
    padding: '10px 14px',
    borderRadius: '24px',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap' as const,
  },
  physicianHint: {
    fontSize: '13px', color: '#64748B', margin: '0 0 2px', lineHeight: 1.4,
  },
  nextBtn: {
    width: '100%', height: '54px', backgroundColor: BRAND_TEAL,
    color: '#FFFFFF', border: 'none', borderRadius: '14px',
    fontSize: '17px', fontWeight: 700, cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(13,148,136,0.35)', marginTop: '16px',
  },
  skipLink: {
    width: '100%', background: 'none', border: 'none',
    color: '#94A3B8', fontSize: '13px',
    textDecoration: 'underline', cursor: 'pointer', padding: '8px 0',
  },
};

const cardStyles: Record<string, React.CSSProperties> = {
  card: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '14px 16px', borderRadius: '14px', cursor: 'pointer',
    width: '100%', textAlign: 'left' as const,
    transition: 'all 0.15s ease', boxSizing: 'border-box' as const,
  },
  checkbox: {
    width: '22px', height: '22px', borderRadius: '6px', border: '2px solid',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, transition: 'all 0.15s ease',
  },
  checkmark: { color: '#FFFFFF', fontSize: '14px', fontWeight: 700, lineHeight: 1 },
  title:    { fontSize: '15px', color: '#1E293B', fontWeight: 500 },
  subtitle: { fontSize: '12px', color: '#94A3B8', marginTop: '2px' },
};
