"""
FastAPI Application Entry Point
=================================
Dipstick MVP — Backend

Run locally:
  uvicorn app.main:app --reload --port 8000

Environment variables:
  ANTHROPIC_API_KEY   — optional; enables LLM explanations (falls back to template)
  ALLOWED_ORIGINS     — comma-separated CORS origins (default: localhost dev origins)
"""

import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router

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
        "rule-based clinical interpretation, and FHIR resource generation."
    ),
    version="0.1.0",
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
    logger.info("Dipstick MVP backend starting up...")
    api_key_set = bool(os.environ.get("ANTHROPIC_API_KEY"))
    logger.info(
        f"LLM explanations: {'ENABLED (Claude)' if api_key_set else 'DISABLED (template fallback)'}"
    )


@app.on_event("shutdown")
async def shutdown():
    logger.info("Dipstick MVP backend shutting down.")
