/**
 * API Client
 * ==========
 * Thin wrapper around fetch/axios for backend communication.
 * All calls return typed responses matching the backend schemas.
 */

import axios, { AxiosError } from 'axios';
import type {
  AnalysisResponse,
  CalibrationResponse,
  PatientHistoryEntry,
  FhirStatusResponse,
  ClinicalIntake,
} from '../types';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';  // empty = use Vite proxy

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60_000,   // Image uploads may be slow on mobile networks
});

/**
 * Extract a human-readable message from an Axios error.
 * Prefers the `detail` field returned by FastAPI's HTTPException.
 */
function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof AxiosError && err.response?.data) {
    const detail = (err.response.data as Record<string, unknown>).detail;
    if (typeof detail === 'string') return detail;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

// ---------------------------------------------------------------------------
// Analyze: POST /api/analyze
// ---------------------------------------------------------------------------

export async function calibrateImage(file: File): Promise<CalibrationResponse> {
  const form = new FormData();
  form.append('image', file);

  try {
    const response = await api.post<CalibrationResponse>('/api/calibrate', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (err) {
    throw new Error(extractErrorMessage(err, 'Calibration failed. Please try again.'));
  }
}

export async function analyzeImage(
  file: File,
  options?: {
    intake?: ClinicalIntake;
    sessionId?: string | null;
    reactionSkipped?: boolean;
    captureMode?: string;
  },
): Promise<AnalysisResponse> {
  const form = new FormData();
  form.append('image', file);
  if (options?.intake) {
    form.append('intake', JSON.stringify(options.intake));
  }
  if (options?.sessionId) {
    form.append('session_id', options.sessionId);
  }
  if (typeof options?.reactionSkipped === 'boolean') {
    form.append('reaction_skipped', String(options.reactionSkipped));
  }
  if (options?.captureMode) {
    form.append('capture_mode', options.captureMode);
  }

  try {
    const response = await api.post<AnalysisResponse>('/api/analyze', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (err) {
    throw new Error(extractErrorMessage(err, 'Analysis failed. Please try again.'));
  }
}

// ---------------------------------------------------------------------------
// Demo: GET /api/demo (no image needed — returns seeded mock result)
// ---------------------------------------------------------------------------

export async function fetchDemo(): Promise<AnalysisResponse> {
  const response = await api.get<AnalysisResponse>('/api/demo');
  return response.data;
}

// ---------------------------------------------------------------------------
// Patient history: GET /api/patients/history
// ---------------------------------------------------------------------------

export async function fetchPatientHistory(): Promise<PatientHistoryEntry[]> {
  const response = await api.get<PatientHistoryEntry[]>('/api/patients/history');
  return response.data;
}

// ---------------------------------------------------------------------------
// FHIR status: GET /api/fhir/status
// ---------------------------------------------------------------------------

export async function fetchFhirStatus(): Promise<FhirStatusResponse> {
  const response = await api.get<FhirStatusResponse>('/api/fhir/status');
  return response.data;
}

// ---------------------------------------------------------------------------
// Report generation: POST /api/report/generate
// ---------------------------------------------------------------------------

export async function generateReport(
  result: AnalysisResponse,
): Promise<{ report_text: string; generated_at: string }> {
  const response = await api.post('/api/report/generate', result);
  return response.data;
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

export async function checkHealth(): Promise<boolean> {
  try {
    await api.get('/api/health');
    return true;
  } catch {
    return false;
  }
}

export default api;
