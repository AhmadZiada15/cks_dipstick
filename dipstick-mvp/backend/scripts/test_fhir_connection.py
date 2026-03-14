#!/usr/bin/env python3
"""
InterSystems FHIR Connection Test Script
==========================================
Standalone CLI utility — run this directly to verify the FHIR server
is up and that your app can successfully POST resources to it.

Usage:
  # From backend/ directory, with venv active:
  python scripts/test_fhir_connection.py

  # Override server URL:
  FHIR_BASE_URL=http://myserver:port/fhir/r4 python scripts/test_fhir_connection.py

  # Disable posting (metadata check only):
  python scripts/test_fhir_connection.py --no-post

Exit codes:
  0 — all checks passed
  1 — one or more checks failed
"""

import sys
import asyncio
import argparse
import os
import json
from datetime import datetime, timezone

# Allow running from backend/ without installing the package
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx

# ---------------------------------------------------------------------------
# ANSI colours for terminal output
# ---------------------------------------------------------------------------
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

def ok(msg):    print(f"  {GREEN}✓{RESET}  {msg}")
def fail(msg):  print(f"  {RED}✗{RESET}  {msg}")
def warn(msg):  print(f"  {YELLOW}⚠{RESET}  {msg}")
def info(msg):  print(f"  {CYAN}→{RESET}  {msg}")
def header(msg): print(f"\n{BOLD}{msg}{RESET}")


# ---------------------------------------------------------------------------
# Test fixtures
# ---------------------------------------------------------------------------

def _minimal_observation(test_run_id: str) -> dict:
    return {
        "resourceType": "Observation",
        "status": "preliminary",
        "code": {
            "coding": [{
                "system":  "http://loinc.org",
                "code":    "5804-0",
                "display": "Protein [Mass/volume] in Urine by Test strip",
            }],
            "text": "Protein dipstick",
        },
        "subject": {"reference": "Patient/demo-patient-anonymous"},
        "effectiveDateTime": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "valueCodeableConcept": {
            "coding": [{
                "system":  "http://snomed.info/sct",
                "code":    "260385009",
                "display": "Negative",
            }],
            "text": "negative",
        },
        "note": [{"text": f"dipstick-mvp test run {test_run_id}"}],
    }


def _minimal_document_reference(test_run_id: str) -> dict:
    return {
        "resourceType": "DocumentReference",
        "status": "current",
        "type": {
            "coding": [{
                "system":  "http://loinc.org",
                "code":    "11502-2",
                "display": "Laboratory report",
            }],
            "text": "Dipstick Urinalysis Image",
        },
        "subject": {"reference": "Patient/demo-patient-anonymous"},
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "description": f"Test DocumentReference — dipstick-mvp test run {test_run_id}",
        "content": [{
            "attachment": {
                "contentType": "image/jpeg",
                "title":       "Test dipstick image",
            }
        }],
    }


# ---------------------------------------------------------------------------
# Test runner
# ---------------------------------------------------------------------------

async def run_tests(base_url: str, do_post: bool, timeout: float) -> bool:
    headers = {
        "Content-Type": "application/fhir+json",
        "Accept":       "application/fhir+json",
    }
    all_ok = True
    test_run_id = datetime.now().strftime("%Y%m%d-%H%M%S")

    async with httpx.AsyncClient(timeout=timeout, headers=headers) as client:

        # ------------------------------------------------------------------
        # 1. Metadata / capability check
        # ------------------------------------------------------------------
        header("1. FHIR Server Metadata Check")
        info(f"GET {base_url}/metadata")
        try:
            resp = await client.get(f"{base_url}/metadata",
                                    headers={"Accept": "application/fhir+json"})
            if resp.status_code == 200:
                data = resp.json()
                fhir_ver  = data.get("fhirVersion", "?")
                software  = data.get("software", {}).get("name", "?")
                ok(f"HTTP 200 — {software}, FHIR {fhir_ver}")

                # Count supported resource types
                rest = data.get("rest", [{}])[0]
                n_resources = len(rest.get("resource", []))
                ok(f"{n_resources} resource types advertised in CapabilityStatement")
            else:
                fail(f"HTTP {resp.status_code}")
                all_ok = False
        except Exception as e:
            fail(f"Connection error: {e}")
            all_ok = False
            return all_ok  # no point continuing if server is down

        if not do_post:
            warn("Skipping POST tests (--no-post flag set)")
            return all_ok

        # ------------------------------------------------------------------
        # 2. POST Observation
        # ------------------------------------------------------------------
        header("2. POST Observation")
        obs = _minimal_observation(test_run_id)
        url = f"{base_url}/Observation"
        info(f"POST {url}")
        try:
            resp = await client.post(url, json=obs)
            location = resp.headers.get("location") or resp.headers.get("Location", "")
            if resp.status_code in (200, 201):
                # Parse server-assigned ID from Location header
                resource_id = location.rstrip("/").split("/")[-3] if "_history" in location \
                              else location.rstrip("/").split("/")[-1]
                ok(f"HTTP {resp.status_code} Created")
                ok(f"Location: {location}")
                ok(f"Server-assigned Observation ID: {resource_id}")

                # Verify we can GET it back
                if resource_id and resource_id.isdigit():
                    get_url = f"{base_url}/Observation/{resource_id}"
                    info(f"GET {get_url}")
                    get_resp = await client.get(get_url)
                    if get_resp.status_code == 200:
                        ok(f"GET confirmed — resource is retrievable")
                    else:
                        warn(f"GET returned HTTP {get_resp.status_code} (resource may not be searchable yet)")
            else:
                fail(f"HTTP {resp.status_code}: {resp.text[:200]}")
                all_ok = False
        except Exception as e:
            fail(f"Error: {e}")
            all_ok = False

        # ------------------------------------------------------------------
        # 3. POST DocumentReference
        # ------------------------------------------------------------------
        header("3. POST DocumentReference")
        doc = _minimal_document_reference(test_run_id)
        url = f"{base_url}/DocumentReference"
        info(f"POST {url}")
        try:
            resp = await client.post(url, json=doc)
            location = resp.headers.get("location") or resp.headers.get("Location", "")
            if resp.status_code in (200, 201):
                resource_id = location.rstrip("/").split("/")[-3] if "_history" in location \
                              else location.rstrip("/").split("/")[-1]
                ok(f"HTTP {resp.status_code} Created")
                ok(f"Location: {location}")
                ok(f"Server-assigned DocumentReference ID: {resource_id}")
            else:
                fail(f"HTTP {resp.status_code}: {resp.text[:200]}")
                all_ok = False
        except Exception as e:
            fail(f"Error: {e}")
            all_ok = False

        # ------------------------------------------------------------------
        # 4. POST a 10-observation dipstick bundle via our app client
        # ------------------------------------------------------------------
        header("4. Full Dipstick Integration Test (via app modules)")
        try:
            # Import app modules (requires running from backend/ with venv)
            from app.services.image_processing import get_mock_values
            from app.models.dipstick import DipstickValues
            from app.services.interpretation import interpret
            from app.fhir.mapper import build_fhir_bundle
            from app.fhir.client import post_dipstick_resources
            from app.fhir.config import FHIRConfig

            cfg = FHIRConfig(
                base_url=base_url,
                post_enabled=True,
                timeout_seconds=timeout,
                username=None,
                password=None,
                post_observations=True,
            )

            raw_vals = get_mock_values()
            dv = DipstickValues(**raw_vals)
            interp = interpret(dv)
            bundle = build_fhir_bundle(dv, interp, session_id=f"test-{test_run_id}")

            info(f"Bundle contains {len(bundle.get('entry', []))} entries")
            status = await post_dipstick_resources(bundle, config=cfg)

            posted = status.get("resources_posted", [])
            errors = status.get("errors", [])
            info(f"Posted:  {len(posted)} resources")
            info(f"Errors:  {len(errors)}")

            if posted:
                ok(f"Successfully posted: " + ", ".join(
                    f"{r['resourceType']}/{r['id']}" for r in posted[:3]
                ) + ("…" if len(posted) > 3 else ""))

            if errors:
                for e in errors:
                    fail(f"Error: {e}")
                all_ok = False
            else:
                ok("All resources posted without errors")

        except ImportError as e:
            warn(f"App module import failed (run from backend/ with venv active): {e}")
        except Exception as e:
            fail(f"Integration test error: {e}")
            all_ok = False

    return all_ok


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Test the InterSystems FHIR server connection from the dipstick MVP"
    )
    parser.add_argument(
        "--base-url",
        default=os.environ.get(
            "FHIR_BASE_URL",
            "http://localhost:32783/csp/healthshare/demo/fhir/r4"
        ),
        help="FHIR R4 base URL (overrides FHIR_BASE_URL env var)",
    )
    parser.add_argument(
        "--no-post",
        action="store_true",
        help="Only check metadata, do not POST any test resources",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=10.0,
        help="Request timeout in seconds (default: 10)",
    )
    args = parser.parse_args()

    print(f"\n{BOLD}{'='*60}{RESET}")
    print(f"{BOLD}  DipCheck — InterSystems FHIR Connection Test{RESET}")
    print(f"{BOLD}{'='*60}{RESET}")
    print(f"  Server : {args.base_url}")
    print(f"  Posting: {'disabled' if args.no_post else 'enabled'}")
    print(f"  Timeout: {args.timeout}s")

    success = asyncio.run(run_tests(
        base_url=args.base_url,
        do_post=not args.no_post,
        timeout=args.timeout,
    ))

    print(f"\n{BOLD}{'='*60}{RESET}")
    if success:
        print(f"{GREEN}{BOLD}  ✓ All tests passed{RESET}")
    else:
        print(f"{RED}{BOLD}  ✗ Some tests failed — check output above{RESET}")
    print(f"{BOLD}{'='*60}{RESET}\n")

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
