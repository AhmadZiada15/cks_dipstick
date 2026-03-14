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
// Clinical intake
// ---------------------------------------------------------------------------

export type BiologicalSex = 'male' | 'female' | 'intersex' | 'prefer_not_to_say';

export interface ClinicalIntake {
  age?: number;
  sex?: BiologicalSex;
  has_diabetes: boolean;
  has_hypertension: boolean;
  has_ckd_family_history: boolean;
  has_frequent_utis: boolean;
  has_cardiovascular_disease: boolean;
  is_pregnant: boolean;
  symptom_swelling: boolean;
  symptom_fatigue: boolean;
  symptom_urination_changes: boolean;
  symptom_back_pain: boolean;
  symptom_foamy_urine: boolean;
  symptom_burning_urination: boolean;
  symptom_frequent_urination: boolean;
  symptom_pelvic_pain: boolean;
  // Physician
  physician_name?: string;
  has_no_physician: boolean;
  screening_pathway?: string;
}

export const EMPTY_INTAKE: ClinicalIntake = {
  has_diabetes: false,
  has_hypertension: false,
  has_ckd_family_history: false,
  has_frequent_utis: false,
  has_cardiovascular_disease: false,
  is_pregnant: false,
  symptom_swelling: false,
  symptom_fatigue: false,
  symptom_urination_changes: false,
  symptom_back_pain: false,
  symptom_foamy_urine: false,
  symptom_burning_urination: false,
  symptom_frequent_urination: false,
  symptom_pelvic_pain: false,
  has_no_physician: false,
};

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
  screening_pathway: string;
  risk_score: number;
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
// FHIR integration status
// ---------------------------------------------------------------------------

export interface PostedResource {
  resourceType: string;
  id: string | null;
  location: string | null;
  http_status: number | null;
}

export interface FHIRIntegrationStatus {
  fhir_post_enabled: boolean;
  fhir_server_url: string;
  fhir_server_reachable: boolean;
  resources_posted: PostedResource[];
  errors: string[];
}

// ---------------------------------------------------------------------------
// Image validation (from backend fail-closed pipeline)
// ---------------------------------------------------------------------------

export type ImageValidationStatus =
  | 'valid'
  | 'strip_not_detected'
  | 'image_decode_failed'
  | 'low_confidence'
  | 'processing_error';

export interface ImageValidation {
  status: ImageValidationStatus;
  is_valid: boolean;
  confidence: number;
  strip_detected: boolean;
  failure_reason: string | null;
}

// ---------------------------------------------------------------------------
// Full API response
// ---------------------------------------------------------------------------

export interface AnalysisResponse {
  session_id: string;
  image_validation: ImageValidation;
  // Clinical fields are null when image_validation.is_valid === false
  dipstick_values: DipstickValues | null;
  interpretation: InterpretationResult | null;
  explanation: Explanation | null;
  fhir_bundle: Record<string, unknown> | null;
  image_preview_url?: string;
  integration_status?: FHIRIntegrationStatus;
}

// ---------------------------------------------------------------------------
// Patient history (clinician dashboard)
// ---------------------------------------------------------------------------

export interface PatientHistoryEntry {
  session_id: string;
  date: string;
  protein: SemiQuant;
  blood: SemiQuant;
  leukocytes: string;
  nitrite: NitriteResult;
  glucose: SemiQuant;
  urgency: UrgencyLevel;
  confidence: number;
  fhir_observation_id: string;
}

export interface FhirStatusResponse {
  config: {
    base_url: string;
    post_enabled: boolean;
    post_observations: boolean;
    timeout_seconds: number;
    auth_configured: boolean;
  };
  server: {
    reachable: boolean;
    fhir_version?: string;
    software_name?: string;
    software_version?: string;
    error?: string;
  };
}

// ---------------------------------------------------------------------------
// App navigation state
// ---------------------------------------------------------------------------

export type AppScreen =
  | 'landing'
  | 'consent'
  | 'intake'
  | 'capture'
  | 'processing'
  | 'results'
  | 'next-steps'
  | 'clinician';

export interface AppState {
  screen: AppScreen;
  consentGiven: boolean;
  uploadedFile: File | null;
  previewUrl: string | null;
  result: AnalysisResponse | null;
  error: string | null;
  intake: ClinicalIntake;
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

export const BRAND_TEAL = '#0D9488';
export const BRAND_NAVY = '#0F2744';

export const URGENCY_COLOR: Record<UrgencyLevel, string> = {
  low:      '#0D9488',   // teal
  moderate: '#D97706',   // amber-600
  high:     '#DC2626',   // red-600
};

export const URGENCY_BG: Record<UrgencyLevel, string> = {
  low:      '#F0FDF4',   // green-50
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
