/**
 * ProcessingScreen
 * =================
 * Shown while the API call is in flight.
 * Animated step-by-step progress display keeps the user engaged.
 * Matches actual pipeline stages so it feels authentic.
 */

import React, { useEffect, useState } from 'react';
import AppShell from '../components/AppShell';

const PIPELINE_STEPS = [
  { label: 'Reading image…',                icon: '📸', durationMs: 800  },
  { label: 'Detecting dipstick strip…',     icon: '🔍', durationMs: 1000 },
  { label: 'Extracting pad colors…',        icon: '🎨', durationMs: 1200 },
  { label: 'Mapping to clinical values…',   icon: '🧪', durationMs: 800  },
  { label: 'Running clinical rule engine…', icon: '⚙️', durationMs: 900  },
  { label: 'Generating explanation…',       icon: '💬', durationMs: 600  },
  { label: 'Building FHIR resources…',      icon: '📋', durationMs: 500  },
];

interface ProcessingScreenProps {
  previewUrl?: string | null;
}

export default function ProcessingScreen({ previewUrl }: ProcessingScreenProps) {
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

  return (
    <AppShell title="Analyzing…">
      <div style={styles.wrapper}>
        {/* Strip preview */}
        {previewUrl && (
          <div style={styles.previewBox}>
            <img src={previewUrl} alt="Dipstick being analyzed" style={styles.previewImg} />
            {/* Scanning animation overlay */}
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
                    backgroundColor: isDone ? '#4F46E5' : isActive ? '#EEF2FF' : '#F1F5F9',
                    borderColor: isDone ? '#4F46E5' : isActive ? '#4F46E5' : '#E2E8F0',
                  }}
                >
                  {isDone ? (
                    <span style={{ color: '#FFFFFF', fontSize: '12px' }}>✓</span>
                  ) : (
                    <span style={{ fontSize: '14px' }}>{step.icon}</span>
                  )}
                </div>
                <span
                  style={{
                    ...styles.stepLabel,
                    color: isDone ? '#1E293B' : isActive ? '#4F46E5' : '#94A3B8',
                    fontWeight: isActive ? 700 : isDone ? 600 : 400,
                  }}
                >
                  {step.label}
                  {isActive && <span style={styles.spinner}> ⏳</span>}
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
  previewBox: {
    position: 'relative',
    borderRadius: '16px',
    overflow: 'hidden',
    maxHeight: '200px',
    display: 'flex',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
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
    backgroundColor: '#4F46E5',
    boxShadow: '0 0 10px 2px #4F46E580',
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
    backgroundColor: '#4F46E5',
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
  spinner: {
    display: 'inline-block',
    animation: 'spin 1s linear infinite',
  },
  footnote: {
    textAlign: 'center',
    fontSize: '12px',
    color: '#94A3B8',
    margin: 0,
  },
};
