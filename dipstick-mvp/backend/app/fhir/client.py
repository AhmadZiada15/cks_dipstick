"""
InterSystems FHIR Client
=========================
Async httpx-based client for posting FHIR R4 resources to the
InterSystems IRIS for Health server from the FHIR-AI-Hackathon-Kit.

Key behaviours observed from live server (InterSystems IRIS for Health):
  - POST /Resource  →  HTTP 201, EMPTY body, Location header carries assigned ID
      e.g. Location: .../fhir/r4/Observation/3875/_history/1
  - No authentication required on local dev instance
  - Server accepts application/fhir+json content type

Design:
  - All methods are async (matches FastAPI's async route handlers)
  - Every method returns a PostResult dataclass, never raises on server errors
  - Caller decides what to do with errors (route.py logs and continues)
  - Resource ID is parsed from the Location header when body is empty
"""

import re
import logging
from dataclasses import dataclass, field
from typing import Optional

import httpx

from app.fhir.config import FHIRConfig, get_fhir_config

logger = logging.getLogger(__name__)

# Regex to extract /<ResourceType>/<id>/_history from Location URL
_LOCATION_RE = re.compile(r"/([A-Za-z]+)/([^/]+)(?:/_history)?")


# ---------------------------------------------------------------------------
# Result type — always returned, never raises
# ---------------------------------------------------------------------------

@dataclass
class PostResult:
    """Outcome of a single FHIR POST operation."""
    success: bool
    resource_type: str
    assigned_id: Optional[str] = None        # server-assigned resource ID
    location_url: Optional[str] = None        # full Location header value
    http_status: Optional[int] = None
    error: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "resourceType":  self.resource_type,
            "id":            self.assigned_id,
            "location":      self.location_url,
            "http_status":   self.http_status,
            "error":         self.error,
        }


def _parse_location(location_url: Optional[str]) -> Optional[str]:
    """
    Extract the server-assigned resource ID from a FHIR Location header.

    Example:
        http://localhost:32783/csp/healthshare/demo/fhir/r4/Observation/3875/_history/1
        → "3875"
    """
    if not location_url:
        return None
    # Find all /Type/id segments; the last meaningful one is the resource ID
    matches = _LOCATION_RE.findall(location_url)
    for resource_type, resource_id in reversed(matches):
        if resource_type not in ("_history",) and resource_id not in ("", "_history"):
            return resource_id
    return None


# ---------------------------------------------------------------------------
# Core client
# ---------------------------------------------------------------------------

class FHIRClient:
    """
    Thin async client wrapping httpx for FHIR R4 interactions.
    Instantiate once and reuse across requests (shares connection pool).
    """

    def __init__(self, config: Optional[FHIRConfig] = None):
        self.config = config or get_fhir_config()
        self._client: Optional[httpx.AsyncClient] = None

    def _get_client(self) -> httpx.AsyncClient:
        """Lazy-init the httpx client (re-created if closed)."""
        if self._client is None or self._client.is_closed:
            kwargs: dict = {
                "timeout": self.config.timeout_seconds,
                "headers": self.config.headers,
            }
            if self.config.auth:
                kwargs["auth"] = self.config.auth
            self._client = httpx.AsyncClient(**kwargs)
        return self._client

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    # -----------------------------------------------------------------------
    # Metadata / health check
    # -----------------------------------------------------------------------

    async def check_metadata(self) -> dict:
        """
        GET /metadata — FHIR CapabilityStatement.
        Returns a summary dict; never raises.
        """
        url = f"{self.config.base_url}/metadata"
        try:
            client = self._get_client()
            resp = await client.get(url, headers={"Accept": "application/fhir+json"})
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "reachable":    True,
                    "fhir_version": data.get("fhirVersion"),
                    "software":     data.get("software", {}).get("name"),
                    "base_url":     self.config.base_url,
                }
            return {
                "reachable":  False,
                "error":      f"HTTP {resp.status_code}",
                "base_url":   self.config.base_url,
            }
        except Exception as exc:
            return {
                "reachable": False,
                "error":     str(exc),
                "base_url":  self.config.base_url,
            }

    # -----------------------------------------------------------------------
    # Generic POST
    # -----------------------------------------------------------------------

    async def post_resource(self, resource: dict) -> PostResult:
        """
        POST a single FHIR resource to the server.

        InterSystems quirk: 201 response has EMPTY body.
        We extract the assigned resource ID from the Location header.
        """
        resource_type = resource.get("resourceType", "Unknown")
        url = f"{self.config.base_url}/{resource_type}"

        try:
            client = self._get_client()
            resp = await client.post(url, json=resource)

            location = resp.headers.get("location") or resp.headers.get("Location")
            assigned_id = _parse_location(location)

            if resp.status_code in (200, 201):
                logger.info(
                    f"FHIR POST {resource_type} → HTTP {resp.status_code}, "
                    f"id={assigned_id}, Location={location}"
                )
                return PostResult(
                    success=True,
                    resource_type=resource_type,
                    assigned_id=assigned_id,
                    location_url=location,
                    http_status=resp.status_code,
                )
            else:
                # Try to get error detail from body if available
                try:
                    body = resp.text[:400]
                except Exception:
                    body = "<unreadable>"
                logger.warning(
                    f"FHIR POST {resource_type} failed: HTTP {resp.status_code} — {body}"
                )
                return PostResult(
                    success=False,
                    resource_type=resource_type,
                    http_status=resp.status_code,
                    error=f"HTTP {resp.status_code}: {body}",
                )

        except httpx.TimeoutException:
            logger.error(f"FHIR POST {resource_type} timed out (>{self.config.timeout_seconds}s)")
            return PostResult(
                success=False,
                resource_type=resource_type,
                error=f"Request timed out after {self.config.timeout_seconds}s",
            )
        except Exception as exc:
            logger.error(f"FHIR POST {resource_type} error: {exc}")
            return PostResult(
                success=False,
                resource_type=resource_type,
                error=str(exc),
            )

    # -----------------------------------------------------------------------
    # Typed convenience methods (thin wrappers)
    # -----------------------------------------------------------------------

    async def post_document_reference(self, doc_ref: dict) -> PostResult:
        return await self.post_resource(doc_ref)

    async def post_observation(self, obs: dict) -> PostResult:
        return await self.post_resource(obs)

    async def post_bundle(self, bundle: dict) -> PostResult:
        """
        POST a FHIR transaction Bundle to the base endpoint.
        Note: InterSystems may or may not process all entries in one shot.
        For reliability, prefer posting resources individually.
        """
        url = self.config.base_url  # Bundle goes to base URL, not /Bundle
        try:
            client = self._get_client()
            resp = await client.post(url, json=bundle)
            location = resp.headers.get("location") or resp.headers.get("Location")
            if resp.status_code in (200, 201):
                logger.info(f"FHIR Bundle POST → HTTP {resp.status_code}")
                return PostResult(
                    success=True,
                    resource_type="Bundle",
                    location_url=location,
                    http_status=resp.status_code,
                )
            else:
                body = resp.text[:400] if resp.text else "<empty>"
                return PostResult(
                    success=False,
                    resource_type="Bundle",
                    http_status=resp.status_code,
                    error=f"HTTP {resp.status_code}: {body}",
                )
        except Exception as exc:
            logger.error(f"FHIR Bundle POST error: {exc}")
            return PostResult(
                success=False,
                resource_type="Bundle",
                error=str(exc),
            )


# ---------------------------------------------------------------------------
# Module-level singleton (shared across requests in a single process)
# ---------------------------------------------------------------------------

_client_singleton: Optional[FHIRClient] = None


def get_fhir_client() -> FHIRClient:
    """
    Return the module-level FHIRClient singleton.
    Config is read from env at first call.
    """
    global _client_singleton
    if _client_singleton is None:
        _client_singleton = FHIRClient(get_fhir_config())
    return _client_singleton


async def close_fhir_client() -> None:
    """Called on app shutdown to cleanly close the httpx connection pool."""
    global _client_singleton
    if _client_singleton is not None:
        await _client_singleton.close()
        _client_singleton = None


# ---------------------------------------------------------------------------
# Standalone integration function used by routes.py
# ---------------------------------------------------------------------------

async def post_dipstick_resources(
    fhir_bundle: dict,
    config: Optional[FHIRConfig] = None,
) -> dict:
    """
    Post all resources from a dipstick FHIR bundle to InterSystems individually.

    Strategy:
      1. Find the DocumentReference entry in the bundle
      2. Find all Observation entries
      3. POST each individually (more reliable than transaction bundle on this server)
      4. Return an integration_status dict

    Never raises — all errors are captured in the status dict.
    """
    cfg = config or get_fhir_config()

    # Base status
    status: dict = {
        "fhir_post_enabled":    cfg.post_enabled,
        "fhir_server_url":      cfg.base_url,
        "fhir_server_reachable": False,
        "resources_posted":     [],
        "errors":               [],
    }

    if not cfg.post_enabled:
        logger.info("FHIR posting disabled (FHIR_POST_ENABLED=false)")
        return status

    client = get_fhir_client()
    client.config = cfg  # update config in case env changed

    # Quick reachability probe
    meta = await client.check_metadata()
    status["fhir_server_reachable"] = meta.get("reachable", False)
    if not meta.get("reachable"):
        err = f"FHIR server unreachable: {meta.get('error')}"
        logger.warning(err)
        status["errors"].append(err)
        return status

    # Walk the bundle entries
    entries = fhir_bundle.get("entry", [])

    for entry in entries:
        resource = entry.get("resource", {})
        rtype = resource.get("resourceType")

        if rtype == "DocumentReference":
            result = await client.post_document_reference(resource)
            _record_result(status, result)

        elif rtype == "Observation" and cfg.post_observations:
            result = await client.post_observation(resource)
            _record_result(status, result)

    posted_count = len(status["resources_posted"])
    error_count  = len(status["errors"])
    logger.info(
        f"FHIR integration complete: {posted_count} posted, {error_count} errors"
    )

    return status


def _record_result(status: dict, result: PostResult) -> None:
    """Append a PostResult to the integration_status dict."""
    if result.success:
        status["resources_posted"].append(result.to_dict())
    else:
        status["errors"].append(
            f"{result.resource_type}: {result.error}"
        )
