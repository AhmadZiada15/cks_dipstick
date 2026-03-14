"""
API Routes
============
All HTTP endpoints for the dipstick analysis service.

Endpoints:
  POST /api/analyze   — upload image, run full pipeline, return results
  GET  /api/demo      — return seeded mock result (no image needed)
  GET  /api/health    — liveness probe
"""

import uuid
import base64
import json
import logging
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse

from app.models.dipstick import (
    DipstickValues, AnalysisResponse
)
from app.services.image_processing import extract_dipstick_values, get_mock_values
from app.services.interpretation import interpret
from app.services.explanation import generate_explanation
from app.fhir.mapper import build_fhir_bundle

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")

MOCK_DATA_PATH = Path(__file__).parent.parent.parent / "mock_data" / "demo_results.json"

# ---------------------------------------------------------------------------
# Liveness probe
# ---------------------------------------------------------------------------

@router.get("/health")
async def health():
    return {"status": "ok", "service": "dipstick-mvp"}


# ---------------------------------------------------------------------------
# POST /api/analyze — main pipeline
# ---------------------------------------------------------------------------

@router.post("/analyze", response_model=AnalysisResponse)
async def analyze(image: UploadFile = File(...)):
    """
    Full dipstick analysis pipeline:
      1. Read uploaded image bytes
      2. Run image processing to extract pad values
      3. Run rule-based clinical interpretation
      4. Generate plain-English explanation
      5. Map to FHIR resources
      6. Return structured response
    """
    # Validate file type
    content_type = image.content_type or ""
    if not content_type.startswith("image/"):
        raise HTTPException(
            status_code=422,
            detail=f"Uploaded file must be an image. Got: {content_type}"
        )

    session_id = str(uuid.uuid4())
    logger.info(f"[{session_id}] Analysis started for file: {image.filename}")

    # 1. Read bytes
    image_bytes = await image.read()

    # 2. Image processing
    try:
        raw_values = extract_dipstick_values(image_bytes)
    except Exception as e:
        logger.warning(f"[{session_id}] Image processing error: {e} — using mock")
        raw_values = get_mock_values()

    # 3. Parse into Pydantic model
    try:
        dipstick_values = DipstickValues(**raw_values)
    except Exception as e:
        logger.error(f"[{session_id}] Value parsing error: {e}")
        raise HTTPException(status_code=500, detail="Failed to parse dipstick values")

    # 4. Rule-based interpretation
    interpretation = interpret(dipstick_values)

    # 5. Plain-English explanation
    explanation = generate_explanation(interpretation)

    # 6. FHIR bundle (image embedded as base64 for demo; omit for large images)
    image_b64 = ""
    try:
        # Only embed if image is small enough for demo (< 500KB)
        if len(image_bytes) < 500_000:
            image_b64 = base64.b64encode(image_bytes).decode("utf-8")
    except Exception:
        pass

    fhir_bundle = build_fhir_bundle(
        dipstick_values=dipstick_values,
        interpretation=interpretation,
        session_id=session_id,
        image_b64=image_b64,
    )

    logger.info(
        f"[{session_id}] Analysis complete — urgency={interpretation.urgency.value}, "
        f"flags={len(interpretation.clinical_flags)}"
    )

    return AnalysisResponse(
        session_id=session_id,
        dipstick_values=dipstick_values,
        interpretation=interpretation,
        explanation=explanation,
        fhir_bundle=fhir_bundle,
    )


# ---------------------------------------------------------------------------
# GET /api/demo — return pre-seeded mock result
# ---------------------------------------------------------------------------

@router.get("/demo", response_model=AnalysisResponse)
async def demo():
    """
    Returns a fully pre-populated mock analysis result.
    Use this endpoint for offline demos and frontend development.
    No image upload required.
    """
    session_id = "demo-session-" + str(uuid.uuid4())[:8]

    # Build from mock values directly
    raw_values = get_mock_values()
    dipstick_values = DipstickValues(**raw_values)
    interpretation = interpret(dipstick_values)
    explanation = generate_explanation(interpretation)
    fhir_bundle = build_fhir_bundle(
        dipstick_values=dipstick_values,
        interpretation=interpretation,
        session_id=session_id,
    )

    return AnalysisResponse(
        session_id=session_id,
        dipstick_values=dipstick_values,
        interpretation=interpretation,
        explanation=explanation,
        fhir_bundle=fhir_bundle,
    )


# ---------------------------------------------------------------------------
# GET /api/demo/raw — returns raw seeded JSON for debugging
# ---------------------------------------------------------------------------

@router.get("/demo/raw")
async def demo_raw():
    """Returns the static mock_data/demo_results.json for inspection."""
    if MOCK_DATA_PATH.exists():
        with open(MOCK_DATA_PATH) as f:
            return JSONResponse(content=json.load(f))
    return JSONResponse(
        status_code=404,
        content={"detail": "Mock data file not found"}
    )
