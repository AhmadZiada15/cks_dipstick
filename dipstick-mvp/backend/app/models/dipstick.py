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
# Full API response
# ---------------------------------------------------------------------------

class AnalysisResponse(BaseModel):
    """Top-level response returned to the frontend."""
    session_id: str
    dipstick_values: DipstickValues
    interpretation: InterpretationResult
    explanation: Explanation
    fhir_bundle: dict                # Minimal FHIR Bundle JSON
    image_preview_url: Optional[str] = None  # base64 or presigned URL
