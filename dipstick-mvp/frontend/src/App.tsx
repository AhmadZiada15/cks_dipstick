/**
 * App.tsx
 * ========
 * Root component. Manages global app state and screen navigation.
 *
 * Screen flow:
 *   landing → intake → capture → processing → results → next-steps
 *        ↑______________________________________________________|  (start over)
 */

import React, { useState, useCallback } from 'react';
import type { AppState, AppScreen, AnalysisResponse, ClinicalIntake } from './types';
import { EMPTY_INTAKE } from './types';
import { analyzeImage, fetchDemo } from './api/client';

import LandingScreen         from './screens/LandingScreen';
import IntakeScreen          from './screens/IntakeScreen';
import CaptureScreen         from './screens/CaptureScreen';
import ProcessingScreen      from './screens/ProcessingScreen';
import ResultsScreen         from './screens/ResultsScreen';
import NextStepsScreen       from './screens/NextStepsScreen';
import ClinicianDashboard    from './screens/ClinicianDashboard';

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const INITIAL_STATE: AppState = {
  screen: 'landing',
  uploadedFile: null,
  previewUrl: null,
  result: null,
  error: null,
  intake: { ...EMPTY_INTAKE },
};

// ---------------------------------------------------------------------------
// App component
// ---------------------------------------------------------------------------

export default function App() {
  const [state, setState] = useState<AppState>(INITIAL_STATE);

  const goTo = useCallback((screen: AppScreen) => {
    setState((s) => ({ ...s, screen, error: null }));
  }, []);

  const startOver = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  // --- Handle intake completion ---
  const handleIntakeComplete = useCallback((intake: ClinicalIntake) => {
    setState((s) => ({ ...s, intake, screen: 'capture' }));
  }, []);

  // --- Handle image analyze ---
  const handleAnalyze = useCallback(async (file: File) => {
    const previewUrl = URL.createObjectURL(file);
    setState((s) => ({
      ...s,
      screen: 'processing',
      uploadedFile: file,
      previewUrl,
      error: null,
    }));

    try {
      const result: AnalysisResponse = await analyzeImage(file, state.intake);
      setState((s) => ({ ...s, screen: 'results', result }));
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Analysis failed. Please try again.';
      setState((s) => ({
        ...s,
        screen: 'capture',
        error: msg,
      }));
    }
  }, [state.intake]);

  // --- Handle demo mode ---
  const handleDemo = useCallback(async () => {
    setState((s) => ({ ...s, screen: 'processing', error: null }));
    try {
      const result: AnalysisResponse = await fetchDemo();
      setState((s) => ({ ...s, screen: 'results', result }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Demo failed. Is the backend running?';
      setState((s) => ({ ...s, screen: 'landing', error: msg }));
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Render current screen
  // ---------------------------------------------------------------------------

  switch (state.screen) {
    case 'landing':
      return (
        <>
          {state.error && <GlobalError message={state.error} />}
          <LandingScreen
            onStart={() => goTo('intake')}
            onDemo={handleDemo}
            onClinician={() => goTo('clinician')}
          />
        </>
      );

    case 'intake':
      return (
        <IntakeScreen
          onBack={() => goTo('landing')}
          onComplete={handleIntakeComplete}
        />
      );

    case 'capture':
      return (
        <>
          {state.error && <GlobalError message={state.error} />}
          <CaptureScreen
            onBack={() => goTo('intake')}
            onAnalyze={handleAnalyze}
          />
        </>
      );

    case 'processing':
      return <ProcessingScreen previewUrl={state.previewUrl} intake={state.intake} />;

    case 'results':
      if (!state.result) {
        startOver();
        return null;
      }
      return (
        <ResultsScreen
          result={state.result}
          onBack={() => goTo('capture')}
          onNextSteps={() => goTo('next-steps')}
        />
      );

    case 'next-steps':
      if (!state.result) {
        startOver();
        return null;
      }
      return (
        <NextStepsScreen
          result={state.result}
          onBack={() => goTo('results')}
          onStartOver={startOver}
        />
      );

    case 'clinician':
      return <ClinicianDashboard onBack={() => goTo('landing')} />;

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Global error toast (shown above the screen)
// ---------------------------------------------------------------------------

function GlobalError({ message }: { message: string }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        backgroundColor: '#DC2626',
        color: '#FFFFFF',
        borderRadius: '12px',
        padding: '12px 20px',
        fontSize: '14px',
        fontWeight: 600,
        maxWidth: '360px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
      }}
    >
      {message}
    </div>
  );
}
