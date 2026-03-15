"""
Temporary in-memory calibration storage for scan normalization.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, Optional, Tuple


LabColor = Tuple[float, float, float]

CALIBRATION_TTL = timedelta(minutes=10)


@dataclass
class CalibrationEntry:
    baseline_pads: Dict[str, LabColor]
    baseline_background: LabColor
    timestamp: datetime


calibration_store: Dict[str, CalibrationEntry] = {}


def purge_expired_calibrations(now: Optional[datetime] = None) -> None:
    current_time = now or datetime.utcnow()
    expired_ids = [
        session_id
        for session_id, entry in calibration_store.items()
        if current_time - entry.timestamp > CALIBRATION_TTL
    ]
    for session_id in expired_ids:
        calibration_store.pop(session_id, None)


def save_calibration(
    session_id: str,
    baseline_pads: Dict[str, LabColor],
    baseline_background: LabColor,
) -> None:
    purge_expired_calibrations()
    calibration_store[session_id] = CalibrationEntry(
        baseline_pads=baseline_pads,
        baseline_background=baseline_background,
        timestamp=datetime.utcnow(),
    )


def get_calibration(session_id: str) -> Optional[CalibrationEntry]:
    purge_expired_calibrations()
    entry = calibration_store.get(session_id)
    if entry is None:
        return None
    if datetime.utcnow() - entry.timestamp > CALIBRATION_TTL:
        calibration_store.pop(session_id, None)
        return None
    return entry
