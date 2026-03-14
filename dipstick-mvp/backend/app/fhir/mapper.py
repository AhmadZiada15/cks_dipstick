"""
FHIR Resource Mapping Utilities
=================================
Phase 5 — FHIR R4 JSON generation

Resources generated:
  1. DocumentReference  — represents the uploaded dipstick image
  2. Observation        — one per dipstick pad reading (LOINC-coded where available)
  3. Bundle             — wraps all resources into a transaction bundle

FHIR version: R4 (4.0.1)
Profile: minimal — enough for hackathon demo + interoperability showcase

LOINC codes sourced from:
  https://loinc.org/panels/24356-8/  (Urinalysis panel)

Assumption: patient identity is anonymous (no PHI) — patient reference
            is a placeholder UUID for demo purposes.
"""

import uuid
from datetime import datetime, timezone
from typing import List

from app.models.dipstick import DipstickValues, InterpretationResult, SemiQuant


# ---------------------------------------------------------------------------
# LOINC code map for each dipstick pad
# ---------------------------------------------------------------------------

LOINC_CODES = {
    "protein":          {"code": "5804-0",  "display": "Protein [Mass/volume] in Urine by Test strip"},
    "blood":            {"code": "5794-3",  "display": "Hemoglobin [Presence] in Urine by Test strip"},
    "leukocytes":       {"code": "5821-4",  "display": "Leukocytes [#/area] in Urine by Test strip"},
    "nitrite":          {"code": "5802-4",  "display": "Nitrite [Presence] in Urine by Test strip"},
    "glucose":          {"code": "25428-4", "display": "Glucose [Presence] in Urine by Test strip"},
    "ketones":          {"code": "2514-8",  "display": "Ketones [Presence] in Urine by Test strip"},
    "bilirubin":        {"code": "5770-3",  "display": "Bilirubin.total [Presence] in Urine by Test strip"},
    "urobilinogen":     {"code": "20405-7", "display": "Urobilinogen [Presence] in Urine by Test strip"},
    "ph":               {"code": "5803-2",  "display": "pH of Urine by Test strip"},
    "specific_gravity": {"code": "5811-5",  "display": "Specific gravity of Urine by Test strip"},
}

# Semi-quantitative SNOMED/FHIR value codes
SEMIQUANT_FHIR = {
    "negative": {"system": "http://snomed.info/sct", "code": "260385009", "display": "Negative"},
    "trace":    {"system": "http://snomed.info/sct", "code": "260405006", "display": "Trace"},
    "1+":       {"system": "http://snomed.info/sct", "code": "260415000", "display": "1+"},
    "2+":       {"system": "http://snomed.info/sct", "code": "260416004", "display": "2+"},
    "3+":       {"system": "http://snomed.info/sct", "code": "260417008", "display": "3+"},
    "4+":       {"system": "http://snomed.info/sct", "code": "260418003", "display": "4+"},
    "positive": {"system": "http://snomed.info/sct", "code": "10828004",  "display": "Positive"},
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _semiquant_value(label: str) -> dict:
    """Return a FHIR valueCodeableConcept for a semi-quantitative result."""
    coding = SEMIQUANT_FHIR.get(label, {"system": "http://snomed.info/sct",
                                        "code": "未知", "display": label})
    return {
        "valueCodeableConcept": {
            "coding": [coding],
            "text": label,
        }
    }


# ---------------------------------------------------------------------------
# Observation builder
# ---------------------------------------------------------------------------

def build_observation(
    pad_name: str,
    value,
    patient_ref: str,
    session_id: str,
    effective_time: str,
) -> dict:
    """
    Build a minimal FHIR R4 Observation resource for one dipstick pad reading.

    Args:
        pad_name:      e.g. "protein"
        value:         SemiQuant enum value or float (for ph, specific_gravity)
        patient_ref:   FHIR Reference string e.g. "Patient/demo-patient-001"
        session_id:    Used as encounter/identifier context
        effective_time: ISO datetime string
    """
    obs_id = str(uuid.uuid4())
    loinc = LOINC_CODES.get(pad_name, {"code": "unknown", "display": pad_name})

    observation = {
        "resourceType": "Observation",
        "id": obs_id,
        "meta": {
            "profile": ["http://hl7.org/fhir/StructureDefinition/Observation"],
        },
        "status": "preliminary",   # screening result, not confirmed
        "category": [
            {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                        "code": "laboratory",
                        "display": "Laboratory",
                    }
                ]
            }
        ],
        "code": {
            "coding": [
                {
                    "system": "http://loinc.org",
                    "code": loinc["code"],
                    "display": loinc["display"],
                }
            ],
            "text": loinc["display"],
        },
        "subject": {"reference": patient_ref},
        "effectiveDateTime": effective_time,
        "identifier": [
            {
                "system": "urn:dipstick-mvp:session",
                "value": session_id,
            }
        ],
        "note": [
            {
                "text": (
                    "Result generated by automated dipstick image analysis. "
                    "Status 'preliminary' — confirm with laboratory urinalysis."
                )
            }
        ],
    }

    # Attach value
    if pad_name == "ph":
        observation["valueQuantity"] = {
            "value": float(value),
            "unit": "pH",
            "system": "http://unitsofmeasure.org",
            "code": "[pH]",
        }
    elif pad_name == "specific_gravity":
        observation["valueQuantity"] = {
            "value": float(value),
            "unit": "ratio",
            "system": "http://unitsofmeasure.org",
            "code": "1",
        }
    elif pad_name == "nitrite":
        observation.update(_semiquant_value(value))
    else:
        # SemiQuant
        label = value.value if isinstance(value, SemiQuant) else str(value)
        observation.update(_semiquant_value(label))

    return observation


# ---------------------------------------------------------------------------
# DocumentReference builder
# ---------------------------------------------------------------------------

def build_document_reference(
    session_id: str,
    patient_ref: str,
    image_b64: str = "",
    content_type: str = "image/jpeg",
    effective_time: str = "",
) -> dict:
    """
    Build a FHIR R4 DocumentReference representing the uploaded dipstick image.

    In production: image_b64 would be replaced with a URL to a secure object store.
    For hackathon: we embed the base64 directly or leave it as a placeholder.
    """
    return {
        "resourceType": "DocumentReference",
        "id": str(uuid.uuid4()),
        "meta": {
            "profile": ["http://hl7.org/fhir/StructureDefinition/DocumentReference"],
        },
        "status": "current",
        "type": {
            "coding": [
                {
                    "system": "http://loinc.org",
                    "code": "11502-2",
                    "display": "Laboratory report",
                }
            ],
            "text": "Dipstick Urinalysis Image",
        },
        "subject": {"reference": patient_ref},
        "date": effective_time or _now_iso(),
        "description": "Uploaded urine dipstick test strip image for automated screening",
        "identifier": [
            {"system": "urn:dipstick-mvp:session", "value": session_id}
        ],
        "content": [
            {
                "attachment": {
                    "contentType": content_type,
                    "data": image_b64 if image_b64 else "[base64-encoded-image]",
                    "title": "Dipstick Strip Photo",
                    "creation": effective_time or _now_iso(),
                }
            }
        ],
        "context": {
            "event": [
                {
                    "coding": [
                        {
                            "system": "http://snomed.info/sct",
                            "code": "27171005",
                            "display": "Urinalysis",
                        }
                    ]
                }
            ]
        },
    }


# ---------------------------------------------------------------------------
# Bundle builder
# ---------------------------------------------------------------------------

def build_fhir_bundle(
    dipstick_values: DipstickValues,
    interpretation: InterpretationResult,
    session_id: str,
    image_b64: str = "",
) -> dict:
    """
    Assemble all FHIR resources into a transaction Bundle.

    Bundle contains:
      - 1 DocumentReference (the image)
      - N Observations (one per dipstick pad)
    """
    patient_ref = "Patient/demo-patient-anonymous"
    effective_time = _now_iso()
    entries = []

    # 1. DocumentReference for the image
    doc_ref = build_document_reference(
        session_id=session_id,
        patient_ref=patient_ref,
        image_b64=image_b64,
        effective_time=effective_time,
    )
    entries.append({
        "fullUrl": f"urn:uuid:{doc_ref['id']}",
        "resource": doc_ref,
        "request": {"method": "POST", "url": "DocumentReference"},
    })

    # 2. Observations for each pad
    pad_map = {
        "protein":       dipstick_values.protein,
        "blood":         dipstick_values.blood,
        "leukocytes":    dipstick_values.leukocytes,
        "nitrite":       dipstick_values.nitrite,
        "glucose":       dipstick_values.glucose,
        "ketones":       dipstick_values.ketones,
        "bilirubin":     dipstick_values.bilirubin,
        "urobilinogen":  dipstick_values.urobilinogen,
        "ph":            dipstick_values.ph,
        "specific_gravity": dipstick_values.specific_gravity,
    }

    for pad_name, value in pad_map.items():
        obs = build_observation(
            pad_name=pad_name,
            value=value,
            patient_ref=patient_ref,
            session_id=session_id,
            effective_time=effective_time,
        )
        entries.append({
            "fullUrl": f"urn:uuid:{obs['id']}",
            "resource": obs,
            "request": {"method": "POST", "url": "Observation"},
        })

    # 3. Bundle wrapper
    return {
        "resourceType": "Bundle",
        "id": str(uuid.uuid4()),
        "type": "transaction",
        "timestamp": effective_time,
        "meta": {
            "tag": [
                {
                    "system": "urn:dipstick-mvp",
                    "code": "screening-result",
                    "display": "Automated Dipstick Screening Result",
                }
            ]
        },
        "entry": entries,
    }
