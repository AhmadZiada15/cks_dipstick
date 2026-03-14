"""
FastAPI Application Entry Point
=================================
Dipstick MVP — Backend (v0.2.0)

Run locally:
  uvicorn app.main:app --reload --port 8000

Environment variables:
  ANTHROPIC_API_KEY      — optional; enables LLM explanations (falls back to template)
  ALLOWED_ORIGINS        — comma-separated CORS origins (default: localhost dev origins)
  FHIR_BASE_URL          — InterSystems FHIR R4 base URL
                           (default: http://localhost:32783/csp/healthshare/demo/fhir/r4)
  FHIR_POST_ENABLED      — true|false  whether to POST resources to the server (default: true)
  FHIR_POST_OBSERVATIONS — true|false  include Observations in posting (default: true)
  FHIR_USERNAME          — optional Basic Auth username
  FHIR_PASSWORD          — optional Basic Auth password
  FHIR_TIMEOUT_SECONDS   — per-request timeout (default: 10)
"""

import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.fhir.client import get_fhir_client, close_fhir_client
from app.fhir.config import get_fhir_config

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Dipstick MVP API",
    description=(
        "Automated urine dipstick analysis — image processing, "
        "rule-based clinical interpretation, FHIR resource generation, "
        "and live posting to InterSystems IRIS for Health."
    ),
    version="0.2.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ---------------------------------------------------------------------------
# CORS — allow the React dev server and any configured origins
# ---------------------------------------------------------------------------

_raw_origins = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173",
)
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

app.include_router(router)


@app.on_event("startup")
async def startup():
    logger.info("=" * 60)
    logger.info("Dipstick MVP backend starting up (v0.2.0)")
    logger.info("=" * 60)

    # LLM status
    api_key_set = bool(os.environ.get("ANTHROPIC_API_KEY"))
    logger.info(
        f"LLM explanations : {'ENABLED (Claude)' if api_key_set else 'DISABLED (template fallback)'}"
    )

    # FHIR integration probe on startup
    cfg = get_fhir_config()
    logger.info(f"FHIR server URL  : {cfg.base_url}")
    logger.info(f"FHIR posting     : {'ENABLED' if cfg.post_enabled else 'DISABLED'}")
    logger.info(f"FHIR observations: {'included' if cfg.post_observations else 'skipped'}")

    if cfg.post_enabled:
        client = get_fhir_client()
        meta = await client.check_metadata()
        if meta.get("reachable"):
            logger.info(
                f"FHIR server      : REACHABLE ✓  "
                f"({meta.get('software')} FHIR {meta.get('fhir_version')})"
            )
        else:
            logger.warning(
                f"FHIR server      : UNREACHABLE ✗  error={meta.get('error')}  "
                f"(posting will fail gracefully at runtime)"
            )
    else:
        logger.info("FHIR server      : not probed (posting disabled)")

    logger.info("Docs        : http://localhost:8000/docs")
    logger.info("FHIR probe  : http://localhost:8000/api/fhir/status")
    logger.info("Demo        : http://localhost:8000/api/demo")
    logger.info("=" * 60)


@app.on_event("shutdown")
async def shutdown():
    logger.info("Dipstick MVP backend shutting down…")
    await close_fhir_client()
    logger.info("FHIR client connection pool closed.")
