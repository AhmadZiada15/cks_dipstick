/**
 * ProcessingScreen
 * =================
 * Shown while the API call is in flight.
 * 4-step pipeline with pathway context from intake.
 */

import React, { useEffect, useState } from 'react';
import AppShell from '../components/AppShell';
import type { ClinicalIntake } from '../types';

const PIPELINE_STEPS = [
  { label: 'Reading dipstick image…',          durationMs: 1000 },
  { label: 'Extracting biomarker values…',     durationMs: 1400 },
  { label: 'Running clinical rule engine…',    durationMs: 1200 },
  { label: 'Generating guideline-backed report…', durationMs: 800 },
];

const PATHWAY_LABELS: Record<string, string> = {
  ckd: 'CKD Screening',
  uti: 'UTI Screening',
  diabetes: 'Diabetes Screening',
  mixed: 'CKD + UTI Screening',
  general: 'General Screening',
};

interface ProcessingScreenProps {
  previewUrl?: string | null;
  intake?: ClinicalIntake;
}

export default function ProcessingScreen({ previewUrl, intake }: ProcessingScreenProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  useEffect(() => {
    let step = 0;
    const advance = () => {
      if (step < PIPELINE_STEPS.length - 1) {
        setCompletedSteps((prev) => [...prev, step]);
        step++;
        setCurrentStep(step);
        setTimeout(advance, PIPELINE_STEPS[step].durationMs);
      } else {
        setCompletedSteps((prev) => [...prev, step]);
      }
    };
    setTimeout(advance, PIPELINE_STEPS[0].durationMs);
  }, []);

  const progress = Math.round(
    ((completedSteps.length) / PIPELINE_STEPS.length) * 100
  );

  const pathway = intake?.screening_pathway
    ? PATHWAY_LABELS[intake.screening_pathway] ?? 'General Screening'
    : null;

  return (
    <AppShell title="Analyzing…">
      <div style={styles.wrapper}>
        {/* Pathway label */}
        {pathway && (
          <div style={styles.pathwayPill}>
            {pathway} pathway
          </div>
        )}

        {/* Strip preview */}
        {previewUrl && (
          <div style={styles.previewBox}>
            <img src={previewUrl} alt="Dipstick being analyzed" style={styles.previewImg} />
            <div style={styles.scanLine} />
          </div>
        )}

        {/* Progress bar */}
        <div style={styles.progressTrack}>
          <div style={{ ...styles.progressFill, width: `${progress}%` }} />
        </div>
        <div style={styles.progressLabel}>{progress}% complete</div>

        {/* Step list */}
        <div style={styles.stepsCard}>
          {PIPELINE_STEPS.map((step, i) => {
            const isDone = completedSteps.includes(i);
            const isActive = currentStep === i && !isDone;
            return (
              <div
                key={i}
                style={{
                  ...styles.stepRow,
                  opacity: i > currentStep ? 0.35 : 1,
                }}
              >
                <div
                  style={{
                    ...styles.stepIndicator,
                    backgroundColor: isDone ? '#8B6A4D' : isActive ? '#F6EFE8' : '#F1F5F9',
                    borderColor: isDone ? '#8B6A4D' : isActive ? '#8B6A4D' : '#E2E8F0',
                  }}
                >
                  {isDone ? (
                    <span style={{ color: '#FFFFFF', fontSize: '12px' }}>&#10003;</span>
                  ) : (
                    <span style={{ fontSize: '13px', color: isActive ? '#8B6A4D' : '#94A3B8' }}>{i + 1}</span>
                  )}
                </div>
                <span
                  style={{
                    ...styles.stepLabel,
                    color: isDone ? '#1E293B' : isActive ? '#8B6A4D' : '#94A3B8',
                    fontWeight: isActive ? 700 : isDone ? 600 : 400,
                  }}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        <p style={styles.footnote}>
          This usually takes 5–15 seconds depending on image size.
        </p>
      </div>
    </AppShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    paddingTop: '20px',
  },
  pathwayPill: {
    alignSelf: 'center',
    fontSize: '12px',
    fontWeight: 700,
    color: '#8B6A4D',
    backgroundColor: '#F6EFE8',
    border: '1px solid #D8C2AE',
    borderRadius: '20px',
    padding: '4px 14px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  previewBox: {
    position: 'relative',
    borderRadius: '16px',
    overflow: 'hidden',
    maxHeight: '200px',
    display: 'flex',
    justifyContent: 'center',
    backgroundColor: '#6F4E37',
  },
  previewImg: {
    width: '100%',
    objectFit: 'contain',
    maxHeight: '200px',
    opacity: 0.85,
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: '3px',
    backgroundColor: '#8B6A4D',
    boxShadow: '0 0 10px 2px rgba(139,106,77,0.45)',
    animation: 'scan 2s linear infinite',
    top: '50%',
  },
  progressTrack: {
    height: '8px',
    backgroundColor: '#E2E8F0',
    borderRadius: '99px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#8B6A4D',
    borderRadius: '99px',
    transition: 'width 0.5s ease',
  },
  progressLabel: {
    textAlign: 'center',
    fontSize: '13px',
    color: '#64748B',
    fontWeight: 600,
    marginTop: '-8px',
  },
  stepsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    border: '1px solid #E2E8F0',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  stepRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    transition: 'opacity 0.3s ease',
  },
  stepIndicator: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    border: '2px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'all 0.3s ease',
  },
  stepLabel: {
    fontSize: '14px',
    transition: 'color 0.3s ease',
  },
  footnote: {
    textAlign: 'center',
    fontSize: '12px',
    color: '#94A3B8',
    margin: 0,
  },
};
