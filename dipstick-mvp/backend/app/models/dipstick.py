"""
Pydantic schemas for the dipstick analysis pipeline.

Assumption: dipstick pads are read as semi-quantitative values
using standard clinical scales (e.g., trace/1+/2+/3+).
Numeric mappings are used internally for rule logic.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from enum import Enum


# ---------------------------------------------------------------------------
# Dipstick value scales
# ---------------------------------------------------------------------------

class SemiQuant(str, Enum):
    """Standard semi-quantitative scale used across most dipstick parameters."""
    NEGATIVE = "negative"
    TRACE = "trace"
    PLUS_1 = "1+"
    PLUS_2 = "2+"
    PLUS_3 = "3+"
    PLUS_4 = "4+"


class NitriteResult(str, Enum):
    NEGATIVE = "negative"
    POSITIVE = "positive"


class UrgencyLevel(str, Enum):
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"


# ---------------------------------------------------------------------------
# Raw dipstick extraction (from image processing)
# ---------------------------------------------------------------------------

class BiologicalSex(str, Enum):
    """Used for clinical screening pathway routing (e.g. UTI prevalence differs by sex)."""
    MALE             = "male"
    FEMALE           = "female"
    INTERSEX         = "intersex"
    PREFER_NOT_TO_SAY = "prefer_not_to_say"


class ClinicalIntake(BaseModel):
    """
    Patient context collected before dipstick capture.
    Used to route interpretation and personalise RAG retrieval.
    """
    age: Optional[int] = Field(default=None, ge=5, le=120)

    # Demographics
    sex: Optional[BiologicalSex] = Field(
        default=None,
        description="Biological sex — used for UTI/kidney risk routing"
    )

    # Risk factors
    has_diabetes: bool = False
    has_hypertension: bool = False
    has_ckd_family_history: bool = False
    has_frequent_utis: bool = False
    has_cardiovascular_disease: bool = False

    # Pregnancy — only clinically relevant for female / intersex
    is_pregnant: bool = Field(
        default=False,
        description="Only shown in UI when sex is female or intersex"
    )

    # Current symptoms
    symptom_swelling: bool = False
    symptom_fatigue: bool = False
    symptom_urination_changes: bool = False
    symptom_back_pain: bool = False
    symptom_foamy_urine: bool = False
    symptom_burning_urination: bool = False
    symptom_frequent_urination: bool = False
    symptom_pelvic_pain: bool = False

    # Physician context
    physician_name: Optional[str] = Field(
        default=None,
        max_length=120,
        description="Patient's regular physician name (optional, used in FHIR performer field)"
    )
    has_no_physician: bool = Field(
        default=False,
        description="True when patient indicated they do not have a regular physician"
    )

    # Screening pathway (derived or user-selected)
    screening_pathway: Optional[str] = Field(
        default=None,
        description="ckd | uti | diabetes | mixed | general"
    )


class DipstickValues(BaseModel):
    """
    Structured representation of all reagent pad readings.
    Units and scale match standard UA dipstick references (e.g., Siemens Multistix).
    """
    # Semi-quantitative pads
    protein: SemiQuant = Field(default=SemiQuant.NEGATIVE, description="mg/dL scale")
    blood: SemiQuant = Field(default=SemiQuant.NEGATIVE, description="RBC/μL scale")
    leukocytes: SemiQuant = Field(default=SemiQuant.NEGATIVE, description="WBC esterase scale")
    glucose: SemiQuant = Field(default=SemiQuant.NEGATIVE, description="mg/dL scale")
    ketones: SemiQuant = Field(default=SemiQuant.NEGATIVE, description="mg/dL scale")
    bilirubin: SemiQuant = Field(default=SemiQuant.NEGATIVE, description="EU/dL scale")
    urobilinogen: SemiQuant = Field(default=SemiQuant.NEGATIVE, description="EU/dL scale")

    # Binary pads
    nitrite: NitriteResult = Field(default=NitriteResult.NEGATIVE)

    # Continuous-ish pads (discretized from color)
    ph: float = Field(default=6.0, ge=4.5, le=9.0, description="pH units")
    specific_gravity: float = Field(
        default=1.015, ge=1.001, le=1.030, description="Specific gravity"
    )

    # Metadata about extraction confidence
    confidence: float = Field(
        default=0.85, ge=0.0, le=1.0,
        description="Overall image processing confidence (0-1)"
    )
    pad_confidences: Optional[dict] = Field(
        default=None,
        description="Per-pad confidence scores"
    )


# ---------------------------------------------------------------------------
# Clinical interpretation output
# ---------------------------------------------------------------------------

class ClinicalFlag(BaseModel):
    """A single clinical concern identified by the rule engine."""
    id: str                          # machine-readable key e.g. "protein_elevated"
    label: str                       # human-readable short label
    severity: Literal["info", "warning", "critical"]
    triggered_by: List[str]          # which dipstick fields triggered this flag
    reasoning: str                   # one-sentence clinical rationale


class InterpretationResult(BaseModel):
    """
    Structured output of the rule-based interpretation engine.
    This is the ground truth for all downstream text generation.
    LLM never modifies this — it only converts it to plain English.
    """
    abnormal_findings: List[str] = Field(
        description="List of dipstick fields that are outside normal range"
    )
    clinical_flags: List[ClinicalFlag] = Field(
        description="Specific clinical patterns identified by rule engine"
    )
    urgency: UrgencyLevel = Field(
        description="Overall urgency assessment"
    )
    recommended_provider: str = Field(
        description="Primary provider type to see"
    )
    secondary_provider: Optional[str] = Field(
        default=None,
        description="Secondary / specialist referral if warranted"
    )
    recommended_actions: List[str] = Field(
        description="Ordered list of next-step actions for the patient"
    )
    why: List[str] = Field(
        description="Traceable reasoning: each action maps to a finding"
    )
    screening_pathway: str = Field(
        default="general",
        description="ckd | uti | diabetes | mixed | general"
    )
    risk_score: float = Field(
        default=0.0,
        description="0.0-10.0 composite risk score"
    )
    evidence_links: List[str] = Field(
        default_factory=list,
        description="Optional: URLs to clinical guidelines used"
    )
    disclaimer: str = Field(
        default=(
            "This result is not a medical diagnosis and does not replace evaluation "
            "by a licensed healthcare professional. Please consult a clinician for "
            "any health concerns."
        )
    )


# ---------------------------------------------------------------------------
# Plain-English explanation (LLM output)
# ---------------------------------------------------------------------------

class Explanation(BaseModel):
    """Patient-friendly explanation generated from InterpretationResult."""
    summary: str                     # 1-2 sentence plain-English summary
    finding_explanations: List[str]  # Bullet-point explanations per finding
    next_steps_narrative: str        # Paragraph: what to do next
    urgency_statement: str           # e.g. "You should seek care within 24-48 hours."


# ---------------------------------------------------------------------------
# FHIR Integration Status  (new — InterSystems live server integration)
# ---------------------------------------------------------------------------

class PostedResource(BaseModel):
    """Metadata about a single resource successfully POSTed to the FHIR server."""
    resourceType: str
    id: Optional[str] = None           # server-assigned ID parsed from Location header
    location: Optional[str] = None     # full Location URL returned by InterSystems
    http_status: Optional[int] = None


class FHIRIntegrationStatus(BaseModel):
    """
    Reflects the outcome of posting resources to the InterSystems FHIR server.
    Always present in AnalysisResponse; indicates success/failure without crashing.
    """
    fhir_post_enabled: bool = False
    fhir_server_url: str = ""
    fhir_server_reachable: bool = False
    resources_posted: List[PostedResource] = Field(default_factory=list)
    errors: List[str] = Field(default_factory=list)

    @property
    def fully_successful(self) -> bool:
        return self.fhir_post_enabled and self.fhir_server_reachable and len(self.errors) == 0


# ---------------------------------------------------------------------------
# Full API response
# ---------------------------------------------------------------------------

class AnalysisResponse(BaseModel):
    """Top-level response returned to the frontend."""
    session_id: str
    dipstick_values: DipstickValues
    interpretation: InterpretationResult
    explanation: Explanation
    fhir_bundle: dict                        # Locally constructed FHIR Bundle JSON
    integration_status: FHIRIntegrationStatus = Field(
        default_factory=FHIRIntegrationStatus,
        description="Result of posting resources to the InterSystems FHIR server",
    )
    image_preview_url: Optional[str] = None  # base64 or presigned URL
