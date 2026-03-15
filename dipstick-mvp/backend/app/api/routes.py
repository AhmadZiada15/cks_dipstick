"""
API Routes
============
All HTTP endpoints for the dipstick analysis service.

Endpoints:
  POST /api/analyze        — upload image, run full pipeline, post to FHIR server
  GET  /api/demo           — seeded mock result, also posts to FHIR server
  GET  /api/fhir/status    — probe the InterSystems FHIR server and return metadata
  GET  /api/health         — liveness probe
  GET  /api/demo/raw       — raw mock JSON (debugging)
"""

import uuid
import base64
import json
import logging
from datetime import datetime, timedelta
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from typing import Optional

from app.models.dipstick import (
    DipstickValues, AnalysisResponse, FHIRIntegrationStatus, PostedResource,
    CalibrationResponse, ClinicalIntake, ImageValidation, ImageValidationStatus,
)
from app.services.image_processing import (
    extract_calibration_baseline, extract_dipstick_values, get_mock_values, ImageProcessingResult,
)
from app.services.capture import CaptureMode
from app.services.calibration import get_calibration, save_calibration
from app.services.interpretation import interpret
from app.services.explanation import generate_explanation
from app.fhir.mapper import build_fhir_bundle
from app.fhir.client import post_dipstick_resources, get_fhir_client
from app.fhir.config import get_fhir_config

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")

MOCK_DATA_PATH = Path(__file__).parent.parent.parent / "mock_data" / "demo_results.json"


def _parse_bool_form(value: Optional[str], default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


# ---------------------------------------------------------------------------
# Helper: convert raw integration_status dict → FHIRIntegrationStatus model
# ---------------------------------------------------------------------------

def _parse_integration_status(raw: dict) -> FHIRIntegrationStatus:
    """
    Convert the dict returned by post_dipstick_resources() into a typed model.
    Handles the PostedResource sub-objects.
    """
    posted = [
        PostedResource(
            resourceType=r.get("resourceType", "Unknown"),
            id=r.get("id"),
            location=r.get("location"),
            http_status=r.get("http_status"),
        )
        for r in raw.get("resources_posted", [])
    ]
    return FHIRIntegrationStatus(
        fhir_post_enabled=raw.get("fhir_post_enabled", False),
        fhir_server_url=raw.get("fhir_server_url", ""),
        fhir_server_reachable=raw.get("fhir_server_reachable", False),
        resources_posted=posted,
        errors=raw.get("errors", []),
    )


# ---------------------------------------------------------------------------
# Liveness probe
# ---------------------------------------------------------------------------

@router.get("/health")
async def health():
    return {"status": "ok", "service": "dipstick-mvp"}


# ---------------------------------------------------------------------------
# FHIR server status probe
# ---------------------------------------------------------------------------

@router.get("/fhir/status")
async def fhir_status():
    """
    Check whether the InterSystems FHIR server is reachable and return its metadata.
    Safe to call at any time — does not post any data.
    """
    cfg = get_fhir_config()
    client = get_fhir_client()
    meta = await client.check_metadata()
    return {
        "config": {
            "base_url":       cfg.base_url,
            "post_enabled":   cfg.post_enabled,
            "post_observations": cfg.post_observations,
            "timeout_seconds": cfg.timeout_seconds,
            "auth_configured": cfg.auth is not None,
        },
        "server": meta,
    }


# ---------------------------------------------------------------------------
# POST /api/calibrate — unused strip baseline
# ---------------------------------------------------------------------------

@router.post("/calibrate", response_model=CalibrationResponse)
async def calibrate(
    image: UploadFile = File(...),
):
    content_type = image.content_type or ""
    if not content_type.startswith("image/"):
        raise HTTPException(
            status_code=422,
            detail=f"Uploaded file must be an image. Got: {content_type}"
        )

    calibration_session_id = str(uuid.uuid4())
    image_bytes = await image.read()
    baseline = extract_calibration_baseline(image_bytes)

    if baseline is None:
        logger.warning("[%s] Calibration failed: pads/background not detected", calibration_session_id)
        return CalibrationResponse(
            session_id=calibration_session_id,
            pads_detected=False,
        )

    baseline_pads, baseline_background = baseline
    save_calibration(
        session_id=calibration_session_id,
        baseline_pads=baseline_pads,
        baseline_background=baseline_background,
    )
    logger.info("[%s] Calibration stored successfully", calibration_session_id)

    return CalibrationResponse(
        session_id=calibration_session_id,
        pads_detected=True,
    )


# ---------------------------------------------------------------------------
# POST /api/analyze — main pipeline
# ---------------------------------------------------------------------------

@router.post("/analyze", response_model=AnalysisResponse)
async def analyze(
    image: UploadFile = File(...),
    intake: Optional[str] = Form(default=None),
    capture_mode: Optional[str] = Form(default="free_capture"),
    session_id: Optional[str] = Form(default=None),
    reaction_skipped: Optional[str] = Form(default=None),
):
    """
    Full dipstick analysis pipeline (FAIL-CLOSED):
      1. Read uploaded image bytes
      2. Image processing → validate → pad values
         If validation fails: return immediately with image_validation error.
         NO fallback to mock data. NO FHIR posting.
      3. Rule-based clinical interpretation
      4. Plain-English explanation
      5. Build FHIR bundle + POST to InterSystems (if enabled)
      6. Return AnalysisResponse
    """
    content_type = image.content_type or ""
    if not content_type.startswith("image/"):
        raise HTTPException(
            status_code=422,
            detail=f"Uploaded file must be an image. Got: {content_type}"
        )

    # Parse clinical intake if provided
    clinical_intake = None
    if intake:
        try:
            clinical_intake = ClinicalIntake(**json.loads(intake))
        except Exception as e:
            logger.warning(f"Could not parse intake: {e}")

    analysis_session_id = str(uuid.uuid4())
    reaction_time_verified = not _parse_bool_form(reaction_skipped, default=False)
    calibration = get_calibration(session_id) if session_id else None
    logger.info(f"[{analysis_session_id}] Analysis started — file: {image.filename}")

    # 1. Read bytes
    image_bytes = await image.read()

    # Parse capture mode
    try:
        mode = CaptureMode(capture_mode or "free_capture")
    except ValueError:
        mode = CaptureMode.FREE_CAPTURE

    # 2. Image processing — FAIL-CLOSED
    try:
        result: ImageProcessingResult = extract_dipstick_values(
            image_bytes,
            mode=mode,
            calibration=calibration,
        )
    except Exception as e:
        # Unexpected crash in CV pipeline — return structured error, not mock data
        logger.error(f"[{analysis_session_id}] Image processing crashed: {e}")
        return AnalysisResponse(
            session_id=analysis_session_id,
            image_validation=ImageValidation(
                status=ImageValidationStatus.PROCESSING_ERROR,
                is_valid=False,
                confidence=0.0,
                strip_detected=False,
                failure_reason=f"Image processing failed unexpectedly: {e}",
            ),
            reaction_time_verified=reaction_time_verified,
        )

    # --- GATE: if image validation failed, stop here. ---
    # No interpretation, no explanation, no FHIR posting.
    if not result.validation.is_valid:
        logger.warning(
            f"[{analysis_session_id}] Image rejected: {result.validation.status.value} "
            f"— {result.validation.failure_reason}"
        )
        return AnalysisResponse(
            session_id=analysis_session_id,
            image_validation=result.validation,
            reaction_time_verified=reaction_time_verified,
        )

    # 3. Parse validated values
    try:
        dipstick_values = DipstickValues(**result.values)
    except Exception as e:
        logger.error(f"[{analysis_session_id}] Value parsing error: {e}")
        raise HTTPException(status_code=500, detail="Failed to parse dipstick values")

    # 4. Interpretation (with optional clinical intake context)
    interpretation = interpret(dipstick_values, clinical_intake)

    # 5. Explanation
    explanation = generate_explanation(interpretation)

    # 6. Build local FHIR bundle
    image_b64 = ""
    try:
        if len(image_bytes) < 500_000:
            image_b64 = base64.b64encode(image_bytes).decode("utf-8")
    except Exception:
        pass

    fhir_bundle = build_fhir_bundle(
        dipstick_values=dipstick_values,
        interpretation=interpretation,
        session_id=analysis_session_id,
        image_b64=image_b64,
        intake=clinical_intake,
    )

    # 7. POST to InterSystems FHIR server (non-blocking failure)
    logger.info(f"[{analysis_session_id}] Posting resources to InterSystems FHIR server…")
    raw_status = await post_dipstick_resources(fhir_bundle)
    integration_status = _parse_integration_status(raw_status)

    logger.info(
        f"[{analysis_session_id}] Complete — urgency={interpretation.urgency.value}, "
        f"flags={len(interpretation.clinical_flags)}, "
        f"fhir_posted={len(integration_status.resources_posted)}, "
        f"fhir_errors={len(integration_status.errors)}"
    )

    return AnalysisResponse(
        session_id=analysis_session_id,
        image_validation=result.validation,
        dipstick_values=dipstick_values,
        interpretation=interpretation,
        explanation=explanation,
        fhir_bundle=fhir_bundle,
        reaction_time_verified=reaction_time_verified,
        integration_status=integration_status,
    )


# ---------------------------------------------------------------------------
# GET /api/demo — seeded mock result + live FHIR post
# ---------------------------------------------------------------------------

@router.get("/demo", response_model=AnalysisResponse)
async def demo():
    """
    Returns a fully pre-populated mock analysis result AND posts it to the
    InterSystems FHIR server (if FHIR_POST_ENABLED=true).
    Ideal for offline demos and frontend development.

    NOTE: This endpoint explicitly uses mock data — the image_validation
    is marked VALID with a note that this is synthetic demo data.
    """
    session_id = "demo-" + str(uuid.uuid4())[:8]
    logger.info(f"[{session_id}] Demo mode — building mock result")

    demo_intake = ClinicalIntake(
        age=58,
        has_diabetes=True,
        has_hypertension=True,
        symptom_fatigue=True,
        symptom_urination_changes=True,
    )

    raw_values = get_mock_values()
    dipstick_values = DipstickValues(**raw_values)
    interpretation = interpret(dipstick_values, demo_intake)
    explanation = generate_explanation(interpretation)
    fhir_bundle = build_fhir_bundle(
        dipstick_values=dipstick_values,
        interpretation=interpretation,
        session_id=session_id,
        intake=demo_intake,
    )

    # Demo mode image_validation — explicitly marks this as synthetic data
    demo_validation = ImageValidation(
        status=ImageValidationStatus.VALID,
        is_valid=True,
        confidence=0.92,
        strip_detected=True,
        failure_reason=None,
    )

    # Also post to InterSystems FHIR server
    logger.info(f"[{session_id}] Posting demo resources to InterSystems FHIR server…")
    raw_status = await post_dipstick_resources(fhir_bundle)
    integration_status = _parse_integration_status(raw_status)

    logger.info(
        f"[{session_id}] Demo complete — "
        f"fhir_posted={len(integration_status.resources_posted)}, "
        f"fhir_errors={len(integration_status.errors)}"
    )

    return AnalysisResponse(
        session_id=session_id,
        image_validation=demo_validation,
        dipstick_values=dipstick_values,
        interpretation=interpretation,
        explanation=explanation,
        fhir_bundle=fhir_bundle,
        reaction_time_verified=True,
        integration_status=integration_status,
    )


# ---------------------------------------------------------------------------
# GET /api/demo/raw — static mock JSON for debugging
# ---------------------------------------------------------------------------

@router.get("/demo/raw")
async def demo_raw():
    """Returns the static mock_data/demo_results.json for inspection."""
    if MOCK_DATA_PATH.exists():
        with open(MOCK_DATA_PATH) as f:
            return JSONResponse(content=json.load(f))
    return JSONResponse(status_code=404, content={"detail": "Mock data file not found"})


# ---------------------------------------------------------------------------
# POST /api/report/generate — shareable clinical summary
# ---------------------------------------------------------------------------

@router.post("/report/generate")
async def generate_report(response: AnalysisResponse):
    """Generate a formatted plain-text clinical summary for sharing with a provider."""
    interp = response.interpretation
    vals = response.dipstick_values
    expl = response.explanation

    pathway_labels = {
        "ckd": "CKD", "uti": "UTI", "diabetes": "Diabetes",
        "mixed": "CKD + UTI", "general": "General",
    }

    pad_lines = []
    for pad, display in [
        ("protein", "Protein"), ("blood", "Blood"), ("leukocytes", "Leukocytes"),
        ("nitrite", "Nitrite"), ("glucose", "Glucose"), ("ketones", "Ketones"),
        ("bilirubin", "Bilirubin"), ("urobilinogen", "Urobilinogen"),
        ("ph", "pH"), ("specific_gravity", "Specific Gravity"),
    ]:
        raw = getattr(vals, pad)
        val_str = raw.value if hasattr(raw, "value") else str(raw)
        status = "Normal" if val_str in ("negative",) else "Detected"
        pad_lines.append(f"  - {display}: {val_str} ({status})")

    flags_text = "\n".join(
        f"  {i+1}. [{f.severity.upper()}] {f.label}: {f.reasoning}"
        for i, f in enumerate(interp.clinical_flags)
    ) or "  None identified."

    actions_text = "\n".join(
        f"  {i+1}. {a}" for i, a in enumerate(interp.recommended_actions)
    )

    evidence_text = "\n".join(
        f"  - {link}" for link in interp.evidence_links
    ) or "  None."

    report = f"""UroSense Clinical Summary Report
Generated: {datetime.now().isoformat()}
Session ID: {response.session_id}

SCREENING PATHWAY: {pathway_labels.get(interp.screening_pathway, interp.screening_pathway)}
RISK SCORE: {interp.risk_score}/10
URGENCY: {interp.urgency.value.upper()}

SUMMARY: {expl.summary}

BIOMARKER RESULTS:
{chr(10).join(pad_lines)}

CLINICAL FLAGS:
{flags_text}

RECOMMENDED ACTIONS:
{actions_text}

GUIDELINE REFERENCES:
{evidence_text}

---
This report was generated by UroSense screening software.
This is NOT a medical diagnosis. Please consult a healthcare provider.
LOINC Panel Code: 50556-0 (Urinalysis dipstick panel)"""

    return {"report_text": report, "generated_at": datetime.now().isoformat()}


# ---------------------------------------------------------------------------
# GET /api/patients/history — hardcoded CKD progression timeline
# ---------------------------------------------------------------------------

@router.get("/patients/history")
async def patient_history():
    """
    Returns 10 hardcoded patient history entries showing CKD progression
    over ~90 days with a UTI episode at index 4.

    Data is designed for the Clinician Dashboard protein trend chart
    and results table. Dates are dynamic (relative to now).
    """
    now = datetime.now()

    # Protein progression: negative×2 → trace×5 → 1+×3  (with UTI spike at idx 4)
    entries = [
        {
            "session_id": str(uuid.uuid4()),
            "date": (now - timedelta(days=81)).isoformat(),
            "protein": "negative",
            "blood": "negative",
            "leukocytes": "negative",
            "nitrite": "negative",
            "glucose": "negative",
            "urgency": "low",
            "confidence": 0.92,
            "fhir_observation_id": "obs-3870",
        },
        {
            "session_id": str(uuid.uuid4()),
            "date": (now - timedelta(days=72)).isoformat(),
            "protein": "negative",
            "blood": "negative",
            "leukocytes": "negative",
            "nitrite": "negative",
            "glucose": "negative",
            "urgency": "low",
            "confidence": 0.89,
            "fhir_observation_id": "obs-3871",
        },
        {
            "session_id": str(uuid.uuid4()),
            "date": (now - timedelta(days=63)).isoformat(),
            "protein": "trace",
            "blood": "negative",
            "leukocytes": "negative",
            "nitrite": "negative",
            "glucose": "negative",
            "urgency": "low",
            "confidence": 0.91,
            "fhir_observation_id": "obs-3872",
        },
        {
            "session_id": str(uuid.uuid4()),
            "date": (now - timedelta(days=54)).isoformat(),
            "protein": "trace",
            "blood": "negative",
            "leukocytes": "negative",
            "nitrite": "negative",
            "glucose": "negative",
            "urgency": "low",
            "confidence": 0.88,
            "fhir_observation_id": "obs-3873",
        },
        {
            # Index 4 — UTI episode: leukocytes + nitrite spike
            "session_id": str(uuid.uuid4()),
            "date": (now - timedelta(days=45)).isoformat(),
            "protein": "trace",
            "blood": "trace",
            "leukocytes": "2+",
            "nitrite": "positive",
            "glucose": "negative",
            "urgency": "high",
            "confidence": 0.94,
            "fhir_observation_id": "obs-3874",
        },
        {
            "session_id": str(uuid.uuid4()),
            "date": (now - timedelta(days=36)).isoformat(),
            "protein": "trace",
            "blood": "negative",
            "leukocytes": "trace",
            "nitrite": "negative",
            "glucose": "negative",
            "urgency": "moderate",
            "confidence": 0.90,
            "fhir_observation_id": "obs-3875",
        },
        {
            "session_id": str(uuid.uuid4()),
            "date": (now - timedelta(days=27)).isoformat(),
            "protein": "trace",
            "blood": "negative",
            "leukocytes": "negative",
            "nitrite": "negative",
            "glucose": "negative",
            "urgency": "low",
            "confidence": 0.87,
            "fhir_observation_id": "obs-3876",
        },
        {
            "session_id": str(uuid.uuid4()),
            "date": (now - timedelta(days=18)).isoformat(),
            "protein": "1+",
            "blood": "negative",
            "leukocytes": "negative",
            "nitrite": "negative",
            "glucose": "negative",
            "urgency": "moderate",
            "confidence": 0.93,
            "fhir_observation_id": "obs-3877",
        },
        {
            "session_id": str(uuid.uuid4()),
            "date": (now - timedelta(days=9)).isoformat(),
            "protein": "1+",
            "blood": "negative",
            "leukocytes": "negative",
            "nitrite": "negative",
            "glucose": "negative",
            "urgency": "moderate",
            "confidence": 0.91,
            "fhir_observation_id": "obs-3878",
        },
        {
            "session_id": str(uuid.uuid4()),
            "date": now.isoformat(),
            "protein": "1+",
            "blood": "trace",
            "leukocytes": "negative",
            "nitrite": "negative",
            "glucose": "negative",
            "urgency": "moderate",
            "confidence": 0.86,
            "fhir_observation_id": "obs-3879",
        },
    ]

    # -----------------------------------------------------------------------
    # FHIR-SQL Builder equivalent query (InterSystems IRIS for Health):
    #
    #   SELECT
    #     obs.Key                   AS observation_id,
    #     obs.EffectiveDateTime     AS date,
    #     code.CodingCode           AS loinc_code,
    #     val.ValueString           AS result_value,
    #     val.ValueCodeableConceptText AS interpretation
    #   FROM
    #     HSFHIR_X0001_S.Observation obs
    #     JOIN HSFHIR_X0001_S.Observation_code_coding code
    #       ON obs.Key = code.Observation
    #     JOIN HSFHIR_X0001_S.Observation_valueQuantity val
    #       ON obs.Key = val.Observation
    #   WHERE
    #     obs.SubjectReference = 'Patient/demo-patient'
    #     AND code.CodingSystem = 'http://loinc.org'
    #     AND code.CodingCode IN ('20454-5','57678-3','5799-2','5802-4','2349-9')
    #   ORDER BY
    #     obs.EffectiveDateTime ASC
    # -----------------------------------------------------------------------

    return entries
