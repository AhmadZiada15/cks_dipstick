"""
FHIR Integration Configuration
================================
Reads all FHIR-server-related settings from environment variables.
Provides a single FHIRConfig dataclass used by client.py and routes.py.

Defaults are set to the local InterSystems FHIR-AI-Hackathon-Kit values
so the app works out of the box with no .env file needed.

Discovered from live server inspection (2026-03-14):
  - Server: InterSystems IRIS for Health, FHIR R4 (4.0.1)
  - Endpoint: http://localhost:32783/csp/healthshare/demo/fhir/r4
  - Auth: none required on local dev instance
  - POST behaviour: HTTP 201, empty body, resource URL in Location header
"""

import os
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class FHIRConfig:
    # Base URL of the FHIR R4 endpoint (no trailing slash)
    base_url: str

    # Master switch: set False to generate bundles locally only, never POST
    post_enabled: bool

    # HTTP timeout in seconds for individual FHIR requests
    timeout_seconds: float

    # Optional Basic-Auth credentials (not needed for local kit)
    username: Optional[str]
    password: Optional[str]

    # Whether to also POST individual Observations or only DocumentReference
    post_observations: bool

    @property
    def auth(self) -> Optional[tuple]:
        """Returns (user, password) tuple if credentials are configured, else None."""
        if self.username and self.password:
            return (self.username, self.password)
        return None

    @property
    def headers(self) -> dict:
        """Standard FHIR content-type headers for all requests."""
        return {
            "Content-Type": "application/fhir+json",
            "Accept":        "application/fhir+json",
        }


def get_fhir_config() -> FHIRConfig:
    """
    Build FHIRConfig from environment variables.
    Safe to call multiple times — reads env at call time.
    """
    return FHIRConfig(
        base_url=os.environ.get(
            "FHIR_BASE_URL",
            "http://localhost:32783/csp/healthshare/demo/fhir/r4",
        ).rstrip("/"),

        post_enabled=(
            os.environ.get("FHIR_POST_ENABLED", "true").strip().lower() == "true"
        ),

        timeout_seconds=float(os.environ.get("FHIR_TIMEOUT_SECONDS", "10")),

        username=os.environ.get("FHIR_USERNAME") or None,
        password=os.environ.get("FHIR_PASSWORD") or None,

        post_observations=(
            os.environ.get("FHIR_POST_OBSERVATIONS", "true").strip().lower() == "true"
        ),
    )
