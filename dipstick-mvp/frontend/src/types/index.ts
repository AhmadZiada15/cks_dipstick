/**
 * TypeScript types mirroring the backend Pydantic schemas.
 * Single source of truth for the frontend.
 */

// ---------------------------------------------------------------------------
// Dipstick value types
// ---------------------------------------------------------------------------

export type SemiQuant = 'negative' | 'trace' | '1+' | '2+' | '3+' | '4+';
export type NitriteResult = 'negative' | 'positive';
export type UrgencyLevel = 'low' | 'moderate' | 'high';
export type FlagSeverity = 'info' | 'warning' | 'critical';

export interface DipstickValues {
  protein: SemiQuant;
  blood: SemiQuant;
  leukocytes: SemiQuant;
  nitrite: NitriteResult;
  glucose: SemiQuant;
  ketones: SemiQuant;
  bilirubin: SemiQuant;
  urobilinogen: SemiQuant;
  ph: number;
  specific_gravity: number;
  confidence: number;
  pad_confidences?: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Clinical interpretation types
// ---------------------------------------------------------------------------

export interface ClinicalFlag {
  id: string;
  label: string;
  severity: FlagSeverity;
  triggered_by: string[];
  reasoning: string;
}

export interface InterpretationResult {
  abnormal_findings: string[];
  clinical_flags: ClinicalFlag[];
  urgency: UrgencyLevel;
  recommended_provider: string;
  secondary_provider: string | null;
  recommended_actions: string[];
  why: string[];
  evidence_links: string[];
  disclaimer: string;
}

// ---------------------------------------------------------------------------
// Explanation type
// ---------------------------------------------------------------------------

export interface Explanation {
  summary: string;
  finding_explanations: string[];
  next_steps_narrative: string;
  urgency_statement: string;
}

// ---------------------------------------------------------------------------
// Full API response
// ---------------------------------------------------------------------------

export interface AnalysisResponse {
  session_id: string;
  dipstick_values: DipstickValues;
  interpretation: InterpretationResult;
  explanation: Explanation;
  fhir_bundle: Record<string, unknown>;
  image_preview_url?: string;
}

// ---------------------------------------------------------------------------
// App navigation state
// ---------------------------------------------------------------------------

export type AppScreen =
  | 'landing'
  | 'capture'
  | 'processing'
  | 'results'
  | 'next-steps';

export interface AppState {
  screen: AppScreen;
  uploadedFile: File | null;
  previewUrl: string | null;
  result: AnalysisResponse | null;
  error: string | null;
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

export const URGENCY_COLOR: Record<UrgencyLevel, string> = {
  low:      '#16A34A',   // green-600
  moderate: '#D97706',   // amber-600
  high:     '#DC2626',   // red-600
};

export const URGENCY_BG: Record<UrgencyLevel, string> = {
  low:      '#DCFCE7',   // green-100
  moderate: '#FEF3C7',   // amber-100
  high:     '#FEE2E2',   // red-100
};

export const URGENCY_LABEL: Record<UrgencyLevel, string> = {
  low:      'Low Concern',
  moderate: 'Moderate Concern',
  high:     'High Concern',
};

export const SEVERITY_COLOR: Record<FlagSeverity, string> = {
  info:     '#2563EB',  // blue-600
  warning:  '#D97706',  // amber-600
  critical: '#DC2626',  // red-600
};

export const SEVERITY_BG: Record<FlagSeverity, string> = {
  info:     '#EFF6FF',  // blue-50
  warning:  '#FFFBEB',  // amber-50
  critical: '#FFF1F2',  // rose-50
};

export const PAD_DISPLAY_NAMES: Record<string, string> = {
  protein:          'Protein',
  blood:            'Blood',
  leukocytes:       'Leukocytes (WBC)',
  nitrite:          'Nitrite',
  glucose:          'Glucose',
  ketones:          'Ketones',
  bilirubin:        'Bilirubin',
  urobilinogen:     'Urobilinogen',
  ph:               'pH',
  specific_gravity: 'Specific Gravity',
};
