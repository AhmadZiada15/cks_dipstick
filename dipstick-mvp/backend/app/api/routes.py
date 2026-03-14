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
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse

from app.models.dipstick import (
    DipstickValues, AnalysisResponse, FHIRIntegrationStatus, PostedResource,
)
from app.services.image_processing import extract_dipstick_values, get_mock_values
from app.services.interpretation import interpret
from app.services.explanation import generate_explanation
from app.fhir.mapper import build_fhir_bundle
from app.fhir.client import post_dipstick_resources, get_fhir_client
from app.fhir.config import get_fhir_config

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")

MOCK_DATA_PATH = Path(__file__).parent.parent.parent / "mock_data" / "demo_results.json"


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
# POST /api/analyze — main pipeline
# ---------------------------------------------------------------------------

@router.post("/analyze", response_model=AnalysisResponse)
async def analyze(image: UploadFile = File(...)):
    """
    Full dipstick analysis pipeline:
      1. Read uploaded image bytes
      2. Image processing → pad values
      3. Rule-based clinical interpretation
      4. Plain-English explanation (LLM or template)
      5. Build FHIR bundle (local)
      6. POST resources to InterSystems FHIR server (if enabled)
      7. Return AnalysisResponse with integration_status
    """
    content_type = image.content_type or ""
    if not content_type.startswith("image/"):
        raise HTTPException(
            status_code=422,
            detail=f"Uploaded file must be an image. Got: {content_type}"
        )

    session_id = str(uuid.uuid4())
    logger.info(f"[{session_id}] Analysis started — file: {image.filename}")

    # 1. Read bytes
    image_bytes = await image.read()

    # 2. Image processing (falls back to mock on failure)
    try:
        raw_values = extract_dipstick_values(image_bytes)
    except Exception as e:
        logger.warning(f"[{session_id}] Image processing error: {e} — using mock")
        raw_values = get_mock_values()

    # 3. Parse values
    try:
        dipstick_values = DipstickValues(**raw_values)
    except Exception as e:
        logger.error(f"[{session_id}] Value parsing error: {e}")
        raise HTTPException(status_code=500, detail="Failed to parse dipstick values")

    # 4. Interpretation
    interpretation = interpret(dipstick_values)

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
        session_id=session_id,
        image_b64=image_b64,
    )

    # 7. POST to InterSystems FHIR server (non-blocking failure)
    logger.info(f"[{session_id}] Posting resources to InterSystems FHIR server…")
    raw_status = await post_dipstick_resources(fhir_bundle)
    integration_status = _parse_integration_status(raw_status)

    logger.info(
        f"[{session_id}] Complete — urgency={interpretation.urgency.value}, "
        f"flags={len(interpretation.clinical_flags)}, "
        f"fhir_posted={len(integration_status.resources_posted)}, "
        f"fhir_errors={len(integration_status.errors)}"
    )

    return AnalysisResponse(
        session_id=session_id,
        dipstick_values=dipstick_values,
        interpretation=interpretation,
        explanation=explanation,
        fhir_bundle=fhir_bundle,
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
    """
    session_id = "demo-" + str(uuid.uuid4())[:8]
    logger.info(f"[{session_id}] Demo mode — building mock result")

    raw_values = get_mock_values()
    dipstick_values = DipstickValues(**raw_values)
    interpretation = interpret(dipstick_values)
    explanation = generate_explanation(interpretation)
    fhir_bundle = build_fhir_bundle(
        dipstick_values=dipstick_values,
        interpretation=interpretation,
        session_id=session_id,
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
        dipstick_values=dipstick_values,
        interpretation=interpretation,
        explanation=explanation,
        fhir_bundle=fhir_bundle,
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
