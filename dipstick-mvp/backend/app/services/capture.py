"""
Capture Standardization Module
===============================
Assesses image capture quality against expected geometry and layout
constraints for dipstick strip photography.

This module introduces the concept of "capture modes" and produces
structured quality signals that the pipeline uses to:
  1. Boost or penalize confidence based on capture conditions
  2. Provide actionable feedback to the user ("tilt your phone", etc.)
  3. Prepare for a future physical template/frame workflow

Capture Modes:
  - free_capture:          No template. User photographs strip freehand.
  - standardized_capture:  Physical template with fiducial markers expected.
                           (Future: cardboard frame with alignment guides)

Design note:
  This is deliberately lightweight for hackathon. The quality checks use
  basic OpenCV geometry — no ML models, no heavy dependencies.
"""

import cv2
import numpy as np
from dataclasses import dataclass, field
from typing import Optional, Tuple, List
from enum import Enum
import logging

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Capture mode enum — determines which quality checks to apply
# ---------------------------------------------------------------------------

class CaptureMode(str, Enum):
    """
    Capture workflow type. Sent by the client to indicate how the image
    was captured. Determines which quality checks and thresholds apply.
    """
    FREE_CAPTURE = "free_capture"
    STANDARDIZED_CAPTURE = "standardized_capture"


# ---------------------------------------------------------------------------
# Expected capture constraints — central configuration
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class CaptureProfile:
    """
    Defines expected geometric and quality constraints for a capture mode.
    All thresholds in one place — not scattered through the code.
    """
    # Strip geometry
    min_strip_aspect_ratio: float = 3.0        # length / width
    max_strip_aspect_ratio: float = 15.0       # reject if absurdly elongated
    min_strip_area_fraction: float = 0.02      # strip area / image area
    max_strip_area_fraction: float = 0.85      # strip shouldn't fill entire frame
    ideal_strip_area_fraction: float = 0.15    # target: strip ~15% of frame

    # Orientation: max degrees from vertical (0° = perfectly upright)
    max_tilt_degrees: float = 25.0

    # Pad layout: expected number of distinct color zones along strip
    expected_pad_count: int = 10
    min_pad_transitions: int = 3               # minimum color transitions

    # Lighting / color quality
    min_brightness: float = 40.0               # mean luminance (0-255 scale)
    max_brightness: float = 240.0              # reject overexposed
    max_brightness_std: float = 80.0           # reject extreme uneven lighting

    # Background: strip should sit on a reasonably uniform background
    min_background_uniformity: float = 0.3     # 0=chaotic, 1=perfectly uniform

    # Future: fiducial/template marker detection
    expect_template_markers: bool = False       # True for standardized_capture
    marker_count: int = 4                       # corners of template frame


# Pre-built profiles for each capture mode
CAPTURE_PROFILES = {
    CaptureMode.FREE_CAPTURE: CaptureProfile(
        max_tilt_degrees=30.0,
        min_strip_area_fraction=0.01,    # more lenient for freehand
        expect_template_markers=False,
    ),
    CaptureMode.STANDARDIZED_CAPTURE: CaptureProfile(
        max_tilt_degrees=10.0,           # tighter tolerance with template
        min_strip_area_fraction=0.05,    # strip should be more prominent
        ideal_strip_area_fraction=0.20,
        expect_template_markers=True,
        marker_count=4,
    ),
}


def get_profile(mode: CaptureMode) -> CaptureProfile:
    return CAPTURE_PROFILES.get(mode, CAPTURE_PROFILES[CaptureMode.FREE_CAPTURE])


# ---------------------------------------------------------------------------
# Capture quality result — structured quality signals
# ---------------------------------------------------------------------------

@dataclass
class CaptureQuality:
    """
    Structured capture-quality assessment. Each signal is a boolean pass/fail
    plus an optional detail message. The UI can use these to guide the user.
    """
    # Geometry checks
    orientation_ok: bool = False
    orientation_detail: str = ""
    tilt_degrees: float = 0.0

    aspect_ratio_ok: bool = False
    aspect_ratio_detail: str = ""
    measured_aspect_ratio: float = 0.0

    strip_fills_frame_enough: bool = False
    strip_area_fraction: float = 0.0
    strip_area_detail: str = ""

    # Pad layout
    pad_layout_consistent: bool = False
    pad_transitions_found: int = 0
    pad_layout_detail: str = ""

    # Lighting / color
    lighting_ok: bool = False
    mean_brightness: float = 0.0
    brightness_uniformity: float = 0.0
    lighting_detail: str = ""

    # Background
    background_ok: bool = False
    background_detail: str = ""

    # Future: template/marker detection
    template_detected: bool = False
    markers_found: int = 0
    template_detail: str = "No template detection in current version"

    # Overall
    overall_quality_score: float = 0.0   # 0.0-1.0 composite
    capture_mode: str = "free_capture"
    suggestions: list = field(default_factory=list)  # user-facing improvement tips

    @property
    def all_checks_passed(self) -> bool:
        """True if all non-template checks pass."""
        return (
            self.orientation_ok
            and self.aspect_ratio_ok
            and self.strip_fills_frame_enough
            and self.pad_layout_consistent
            and self.lighting_ok
        )


# ---------------------------------------------------------------------------
# Quality assessment functions
# ---------------------------------------------------------------------------

def _assess_orientation(contour: np.ndarray, profile: CaptureProfile) -> Tuple[bool, float, str]:
    """
    Check strip orientation relative to vertical.
    Uses the minimum-area bounding rectangle angle.
    Returns (ok, tilt_degrees, detail).
    """
    rect = cv2.minAreaRect(contour)
    angle = rect[2]  # -90 to 0 degrees from OpenCV
    w, h = rect[1]

    # Normalize angle: we want deviation from vertical
    if w > h:
        tilt = abs(angle)
    else:
        tilt = abs(90 + angle)

    # Clamp to 0-45 range (angles wrap)
    if tilt > 45:
        tilt = 90 - tilt

    ok = tilt <= profile.max_tilt_degrees
    if ok:
        detail = f"Strip tilt {tilt:.1f}° within tolerance (max {profile.max_tilt_degrees}°)"
    else:
        detail = f"Strip tilted {tilt:.1f}° — straighten to within {profile.max_tilt_degrees}°"

    return ok, round(tilt, 1), detail


def _assess_aspect_ratio(contour: np.ndarray, profile: CaptureProfile) -> Tuple[bool, float, str]:
    """
    Check that the strip's aspect ratio matches expected dipstick geometry.
    Returns (ok, aspect_ratio, detail).
    """
    rect = cv2.minAreaRect(contour)
    w, h = rect[1]
    if min(w, h) < 1:
        return False, 0.0, "Strip region too small to measure"

    aspect = max(w, h) / min(w, h)
    ok = profile.min_strip_aspect_ratio <= aspect <= profile.max_strip_aspect_ratio

    if ok:
        detail = f"Aspect ratio {aspect:.1f}:1 within range ({profile.min_strip_aspect_ratio}-{profile.max_strip_aspect_ratio})"
    elif aspect < profile.min_strip_aspect_ratio:
        detail = f"Detected shape too square ({aspect:.1f}:1) — may not be a strip"
    else:
        detail = f"Detected shape too elongated ({aspect:.1f}:1)"

    return ok, round(aspect, 1), detail


def _assess_strip_area(contour: np.ndarray, image_shape: Tuple[int, ...],
                       profile: CaptureProfile) -> Tuple[bool, float, str]:
    """
    Check that the strip occupies a reasonable fraction of the frame.
    Too small = far away / poor resolution. Too large = cropped / not full strip.
    Returns (ok, area_fraction, detail).
    """
    strip_area = cv2.contourArea(contour)
    image_area = image_shape[0] * image_shape[1]
    fraction = strip_area / max(image_area, 1)

    ok = profile.min_strip_area_fraction <= fraction <= profile.max_strip_area_fraction

    if fraction < profile.min_strip_area_fraction:
        detail = (
            f"Strip is too small in frame ({fraction:.1%}). "
            "Move the camera closer to the strip."
        )
    elif fraction > profile.max_strip_area_fraction:
        detail = (
            f"Strip fills too much of the frame ({fraction:.1%}). "
            "Move the camera back so the full strip and some background are visible."
        )
    else:
        detail = f"Strip area fraction {fraction:.1%} is good"

    return ok, round(fraction, 4), detail


def _assess_lighting(image_bgr: np.ndarray,
                     profile: CaptureProfile) -> Tuple[bool, float, float, str]:
    """
    Assess overall lighting quality: brightness and uniformity.
    Returns (ok, mean_brightness, uniformity, detail).
    """
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    mean_b = float(gray.mean())
    std_b = float(gray.std())

    # Uniformity: 1.0 = perfectly even, 0.0 = extreme variation
    uniformity = max(0.0, 1.0 - (std_b / 128.0))

    issues = []
    if mean_b < profile.min_brightness:
        issues.append(f"image too dark (brightness {mean_b:.0f})")
    if mean_b > profile.max_brightness:
        issues.append(f"image overexposed (brightness {mean_b:.0f})")
    if std_b > profile.max_brightness_std:
        issues.append(f"uneven lighting (variation {std_b:.0f})")

    ok = len(issues) == 0
    detail = "Lighting looks good" if ok else "Lighting issues: " + "; ".join(issues)

    return ok, round(mean_b, 1), round(uniformity, 2), detail


def _assess_pad_layout(strip_bgr: np.ndarray,
                       profile: CaptureProfile) -> Tuple[bool, int, str]:
    """
    Count distinct color transitions along the strip to verify pad layout.
    A real dipstick has 8-10 distinct colored zones.
    Returns (ok, transitions_found, detail).
    """
    h, w = strip_bgr.shape[:2]
    if h < 20 or w < 5:
        return False, 0, "Strip region too small for pad analysis"

    strip_lab = cv2.cvtColor(strip_bgr, cv2.COLOR_BGR2Lab)
    num_slices = 20  # finer than the validate_strip check

    slice_colors = []
    for i in range(num_slices):
        y_start = int(i * h / num_slices)
        y_end = int((i + 1) * h / num_slices)
        margin_x = max(1, int(w * 0.2))
        roi = strip_lab[y_start:y_end, margin_x:w - margin_x]
        if roi.size == 0:
            continue
        mean = roi.mean(axis=(0, 1))
        L = float(mean[0]) * 100.0 / 255.0
        A = float(mean[1]) - 128.0
        B = float(mean[2]) - 128.0
        slice_colors.append((L, A, B))

    if len(slice_colors) < 4:
        return False, 0, "Too few analyzable zones on strip"

    # Count significant transitions (> 6 LAB units apart)
    transitions = 0
    for i in range(1, len(slice_colors)):
        dist = float(np.sqrt(sum(
            (a - b) ** 2 for a, b in zip(slice_colors[i - 1], slice_colors[i])
        )))
        if dist > 6.0:
            transitions += 1

    ok = transitions >= profile.min_pad_transitions
    if ok:
        detail = f"Found {transitions} color transitions (min {profile.min_pad_transitions})"
    else:
        detail = (
            f"Only {transitions} color transitions found (need {profile.min_pad_transitions}). "
            "Ensure all pads are visible and strip is fully dipped."
        )

    return ok, transitions, detail


def _assess_background(image_bgr: np.ndarray, contour: np.ndarray,
                       profile: CaptureProfile) -> Tuple[bool, str]:
    """
    Check that the area around the strip is reasonably uniform (light background).
    Helps detect cluttered backgrounds that may confuse detection.
    """
    h, w = image_bgr.shape[:2]
    mask = np.zeros((h, w), dtype=np.uint8)
    cv2.drawContours(mask, [contour], -1, 255, -1)

    # Invert mask to get background
    bg_mask = cv2.bitwise_not(mask)
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    bg_pixels = gray[bg_mask > 0]

    if bg_pixels.size < 100:
        return True, "Insufficient background area to assess"

    bg_mean = float(bg_pixels.mean())
    bg_std = float(bg_pixels.std())

    # Good background: light (>100) and relatively uniform (std < 50)
    is_light = bg_mean > 100
    is_uniform = bg_std < 60

    ok = is_light and is_uniform
    if ok:
        detail = f"Background is clean (brightness {bg_mean:.0f}, uniformity {1 - bg_std/128:.0%})"
    else:
        issues = []
        if not is_light:
            issues.append("background too dark — use a light surface")
        if not is_uniform:
            issues.append("background too cluttered — use a plain surface")
        detail = "; ".join(issues)

    return ok, detail


def _detect_template_markers(image_bgr: np.ndarray,
                             profile: CaptureProfile) -> Tuple[bool, int, str]:
    """
    Placeholder for future fiducial/template marker detection.
    When a physical cardboard template is designed, this function will:
      1. Look for ArUco markers or colored corner dots
      2. Use their positions to compute a precise perspective transform
      3. Extract the strip region using known template geometry

    Currently returns (False, 0, detail) — no physical template exists yet.
    """
    # TODO: Implement when physical template is designed
    # Potential approaches:
    #   - cv2.aruco.detectMarkers() for ArUco fiducial markers
    #   - Color-based detection for simple colored corner dots
    #   - Contour matching against known template shape
    if not profile.expect_template_markers:
        return False, 0, "Template markers not expected in free_capture mode"

    # --- Future implementation hook ---
    # aruco_dict = cv2.aruco.Dictionary_get(cv2.aruco.DICT_4X4_50)
    # params = cv2.aruco.DetectorParameters_create()
    # corners, ids, rejected = cv2.aruco.detectMarkers(gray, aruco_dict, parameters=params)
    # if ids is not None and len(ids) >= profile.marker_count:
    #     return True, len(ids), f"Found {len(ids)} template markers"
    return False, 0, (
        "Template marker detection not yet implemented. "
        "Use free_capture mode or switch to standardized_capture when template is available."
    )


# ---------------------------------------------------------------------------
# Main capture quality assessment
# ---------------------------------------------------------------------------

def assess_capture_quality(
    image_bgr: np.ndarray,
    strip_contour: Optional[np.ndarray],
    strip_bgr: Optional[np.ndarray],
    mode: CaptureMode = CaptureMode.FREE_CAPTURE,
) -> CaptureQuality:
    """
    Run all capture quality checks and return a structured CaptureQuality result.

    Called from the image processing pipeline AFTER strip detection attempts,
    regardless of whether a strip was found. When no strip is found, geometry
    checks default to failed and only image-level checks (lighting) run.

    Args:
        image_bgr:     Full original image (BGR)
        strip_contour: Contour of detected strip (None if not detected)
        strip_bgr:     Perspective-corrected strip image (None if not detected)
        mode:          Capture mode from client request
    """
    profile = get_profile(mode)
    quality = CaptureQuality(capture_mode=mode.value)
    suggestions = []

    # --- Image-level checks (always run) ---
    (quality.lighting_ok, quality.mean_brightness,
     quality.brightness_uniformity, quality.lighting_detail) = _assess_lighting(image_bgr, profile)
    if not quality.lighting_ok:
        suggestions.append(quality.lighting_detail)

    # --- Template detection (future) ---
    (quality.template_detected, quality.markers_found,
     quality.template_detail) = _detect_template_markers(image_bgr, profile)

    # --- Geometry checks (require detected strip) ---
    if strip_contour is not None:
        (quality.orientation_ok, quality.tilt_degrees,
         quality.orientation_detail) = _assess_orientation(strip_contour, profile)
        if not quality.orientation_ok:
            suggestions.append(f"Straighten the strip — tilted {quality.tilt_degrees}°")

        (quality.aspect_ratio_ok, quality.measured_aspect_ratio,
         quality.aspect_ratio_detail) = _assess_aspect_ratio(strip_contour, profile)
        if not quality.aspect_ratio_ok:
            suggestions.append(quality.aspect_ratio_detail)

        (quality.strip_fills_frame_enough, quality.strip_area_fraction,
         quality.strip_area_detail) = _assess_strip_area(strip_contour, image_bgr.shape, profile)
        if not quality.strip_fills_frame_enough:
            suggestions.append(quality.strip_area_detail)

        (quality.background_ok,
         quality.background_detail) = _assess_background(image_bgr, strip_contour, profile)
        if not quality.background_ok:
            suggestions.append(quality.background_detail)
    else:
        quality.orientation_detail = "No strip detected — cannot assess orientation"
        quality.aspect_ratio_detail = "No strip detected — cannot assess aspect ratio"
        quality.strip_area_detail = "No strip detected — cannot assess frame coverage"
        quality.background_detail = "No strip detected — cannot assess background"
        suggestions.append("No strip detected. Place the strip on a light, flat surface and retake.")

    # --- Pad layout checks (require normalized strip image) ---
    if strip_bgr is not None:
        (quality.pad_layout_consistent, quality.pad_transitions_found,
         quality.pad_layout_detail) = _assess_pad_layout(strip_bgr, profile)
        if not quality.pad_layout_consistent:
            suggestions.append(quality.pad_layout_detail)
    else:
        quality.pad_layout_detail = "No strip image — cannot assess pad layout"

    # --- Compute overall quality score ---
    checks = [
        quality.orientation_ok,
        quality.aspect_ratio_ok,
        quality.strip_fills_frame_enough,
        quality.pad_layout_consistent,
        quality.lighting_ok,
        quality.background_ok,
    ]
    passed = sum(1 for c in checks if c)
    quality.overall_quality_score = round(passed / len(checks), 2)
    quality.suggestions = suggestions

    return quality
