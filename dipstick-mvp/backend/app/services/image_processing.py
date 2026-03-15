"""
Dipstick Image Processing Service
===================================
Phase 2 — Image Processing Module

Pipeline:
  1. Load image from bytes
  2. Detect the dipstick strip via edge/contour detection
  3. Validate the detected region looks like a real strip
  4. Perspective-correct and normalize the strip
  5. Locate the 10 reagent pad ROIs (regions of interest)
  6. Sample the average color in each ROI
  7. Compare sampled colors to reference color tables
  8. Return semi-quantitative readings per pad

Assumptions (Hackathon):
  - Strip orientation: vertical, pads on left or right side
  - Reference colors are hard-coded from Siemens Multistix 10 SG documentation
  - In production you would calibrate per-image using the white/control pad
  - We use LAB color space for perceptual color matching (better than RGB for this)

FAIL-CLOSED POLICY (v0.3):
  - If the image cannot be decoded, return an explicit failure — never mock data.
  - If no strip is detected, return an explicit failure — never center-crop.
  - If confidence is below MIN_CONFIDENCE_THRESHOLD, return an explicit failure.
  - Mock/demo data is ONLY served via get_mock_values() on the /api/demo path.
"""

import cv2
import numpy as np
from dataclasses import dataclass, field
from typing import Dict, Optional, Tuple, List
import logging

from app.models.dipstick import (
    ImageValidation, ImageValidationStatus, CaptureQualityModel,
    MIN_CONFIDENCE_THRESHOLD,
)
from app.services.capture import (
    CaptureMode, assess_capture_quality, CaptureQuality,
)
from app.services.calibration import CalibrationEntry

logger = logging.getLogger(__name__)
LabColor = Tuple[float, float, float]


def _capture_quality_to_model(cq: CaptureQuality) -> CaptureQualityModel:
    """Convert the internal CaptureQuality dataclass to the Pydantic API model."""
    return CaptureQualityModel(
        orientation_ok=cq.orientation_ok,
        orientation_detail=cq.orientation_detail,
        tilt_degrees=cq.tilt_degrees,
        aspect_ratio_ok=cq.aspect_ratio_ok,
        aspect_ratio_detail=cq.aspect_ratio_detail,
        measured_aspect_ratio=cq.measured_aspect_ratio,
        strip_fills_frame_enough=cq.strip_fills_frame_enough,
        strip_area_fraction=cq.strip_area_fraction,
        strip_area_detail=cq.strip_area_detail,
        pad_layout_consistent=cq.pad_layout_consistent,
        pad_transitions_found=cq.pad_transitions_found,
        pad_layout_detail=cq.pad_layout_detail,
        lighting_ok=cq.lighting_ok,
        mean_brightness=cq.mean_brightness,
        brightness_uniformity=cq.brightness_uniformity,
        lighting_detail=cq.lighting_detail,
        background_ok=cq.background_ok,
        background_detail=cq.background_detail,
        template_detected=cq.template_detected,
        markers_found=cq.markers_found,
        template_detail=cq.template_detail,
        overall_quality_score=cq.overall_quality_score,
        capture_mode=cq.capture_mode,
        suggestions=cq.suggestions,
    )


# ---------------------------------------------------------------------------
# Processing result — returned by extract_dipstick_values
# Contains both validation metadata AND (if valid) the pad readings.
# ---------------------------------------------------------------------------

@dataclass
class ImageProcessingResult:
    """
    Return type of extract_dipstick_values().
    Callers MUST check `validation.is_valid` before using `values`.
    """
    validation: ImageValidation
    values: Optional[dict] = None       # populated only when validation.is_valid

# ---------------------------------------------------------------------------
# Reference color tables (LAB space, L 0-100, A -128-127, B -128-127)
# Each entry: (L, A, B) -> semi-quantitative label
# These are approximate values derived from published dipstick color charts.
# In production: calibrate against the reference color bar on the strip itself.
# ---------------------------------------------------------------------------

PROTEIN_REF = {
    "negative":  (85, -3,   5),
    "trace":     (80,  5,  15),
    "1+":        (75, 15,  25),
    "2+":        (65, 25,  30),
    "3+":        (55, 30,  35),
}

BLOOD_REF = {
    "negative":  (85, -3,   5),
    "trace":     (70,  5,  -5),
    "1+":        (55,  5, -20),
    "2+":        (45,  0, -30),
    "3+":        (35, -5, -40),
}

LEUKOCYTE_REF = {
    "negative":  (85, -3,   5),
    "trace":     (78, -8,  -5),
    "1+":        (70,-15, -15),
    "2+":        (60,-20, -25),
    "3+":        (50,-25, -35),
}

NITRITE_REF = {
    "negative":  (85, -3,   5),
    "positive":  (60, 35,  25),
}

GLUCOSE_REF = {
    "negative":  (85, -3,   5),
    "trace":     (65,-10, -10),
    "1+":        (55,-20, -20),
    "2+":        (45,-25, -30),
    "3+":        (35,-30, -35),
}

KETONE_REF = {
    "negative":  (85, -3,   5),
    "trace":     (70, 10,  -5),
    "1+":        (60, 20, -10),
    "2+":        (50, 25, -15),
    "3+":        (40, 30, -20),
}

BILIRUBIN_REF = {
    "negative":  (85, -3,   5),
    "1+":        (70, 20,  30),
    "2+":        (60, 30,  40),
    "3+":        (50, 35,  45),
}

UROBILINOGEN_REF = {
    "negative":  (85, -3,   5),
    "1+":        (75, 10,  30),
    "2+":        (65, 15,  35),
    "3+":        (55, 20,  40),
}

# ---------------------------------------------------------------------------
# Pad layout: (top_fraction, height_fraction) along the strip
# Ordered top-to-bottom matching standard 10-pad Multistix layout
# ---------------------------------------------------------------------------

PAD_LAYOUT = {
    "leukocytes":    (0.05, 0.09),
    "nitrite":       (0.15, 0.09),
    "urobilinogen":  (0.25, 0.09),
    "protein":       (0.35, 0.09),
    "ph":            (0.45, 0.09),
    "blood":         (0.55, 0.09),
    "specific_gravity": (0.63, 0.09),
    "ketones":       (0.71, 0.09),
    "bilirubin":     (0.80, 0.09),
    "glucose":       (0.88, 0.09),
}


# ---------------------------------------------------------------------------
# Color distance utility (Delta E in LAB)
# ---------------------------------------------------------------------------

def compute_delta_e(c1: LabColor, c2: LabColor) -> float:
    """
    Deterministic Delta E implementation.
    Uses CIE76 as a stable fallback in LAB space.
    """
    return float(np.sqrt(sum((a - b) ** 2 for a, b in zip(c1, c2))))


def _lab_distance(c1: LabColor, c2: LabColor) -> float:
    return compute_delta_e(c1, c2)


def _closest_label(sample_lab: LabColor,
                   ref_table: dict) -> Tuple[str, float]:
    """Return (best_label, confidence 0-1) by nearest LAB distance."""
    best_label = "negative"
    best_dist = float("inf")

    for label, ref_lab in ref_table.items():
        d = compute_delta_e(sample_lab, ref_lab)
        if d < best_dist:
            best_dist = d
            best_label = label

    # Convert distance to rough confidence: distance 0 → 1.0, distance 50+ → ~0
    confidence = max(0.0, 1.0 - (best_dist / 50.0))
    return best_label, round(confidence, 2)


# ---------------------------------------------------------------------------
# Strip detection
# ---------------------------------------------------------------------------

@dataclass
class StripDetectionResult:
    """Result of strip detection: the normalized image and the original contour."""
    strip_image: Optional[np.ndarray] = None
    contour: Optional[np.ndarray] = None


def detect_strip(image: np.ndarray) -> StripDetectionResult:
    """
    Attempt to locate and perspective-correct the dipstick strip.
    Returns a StripDetectionResult with the normalized strip image and
    the original contour (needed for capture quality assessment).

    Strategy:
      1. Convert to grayscale → blur → threshold
      2. Find contours → select largest elongated rectangle
      3. Apply perspective transform to get a straight-on view
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return StripDetectionResult()

    # Sort by area descending; pick contours that are plausibly strip-shaped
    contours = sorted(contours, key=cv2.contourArea, reverse=True)

    for cnt in contours[:5]:  # check top-5 largest
        peri = cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, 0.02 * peri, True)
        area = cv2.contourArea(cnt)
        x, y, w, h = cv2.boundingRect(cnt)

        # Strip should be elongated: aspect ratio > 3:1
        aspect = max(w, h) / max(min(w, h), 1)
        if aspect > 3 and area > 5000:
            # Perspective warp if we have a quad, otherwise just crop
            if len(approx) == 4:
                src_pts = approx.reshape(4, 2).astype(np.float32)
                strip_w, strip_h = 100, 600   # normalized output size
                dst_pts = np.array([[0, 0], [strip_w, 0],
                                    [strip_w, strip_h], [0, strip_h]],
                                   dtype=np.float32)
                M = cv2.getPerspectiveTransform(src_pts, dst_pts)
                warped = cv2.warpPerspective(image, M, (strip_w, strip_h))
                return StripDetectionResult(strip_image=warped, contour=cnt)
            else:
                # Fall back to bounding-box crop
                return StripDetectionResult(
                    strip_image=image[y:y+h, x:x+w],
                    contour=cnt,
                )

    return StripDetectionResult()  # detection failed


# ---------------------------------------------------------------------------
# Strip validation — reject non-strip images that pass contour detection
# ---------------------------------------------------------------------------

MIN_DISTINCT_ZONES = 3
ZONE_COLOR_DIFF_THRESHOLD = 8.0
BACKGROUND_LIGHTNESS_MIN = 55.0

def validate_strip(strip_bgr: np.ndarray) -> bool:
    """
    Secondary validation on a candidate strip region.
    A real dipstick has multiple discrete colored pads separated by a light
    background. Random objects / artwork generally fail these checks.

    Returns True if the region looks like a plausible dipstick strip.
    """
    h, w = strip_bgr.shape[:2]
    if h < 40 or w < 10:
        return False

    strip_lab = cv2.cvtColor(strip_bgr, cv2.COLOR_BGR2Lab)

    num_slices = 10
    slice_colors: List[Tuple[float, float, float]] = []
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
        return False

    # Count how many adjacent slices differ significantly in color.
    # A strip should have abrupt transitions between pads.
    distinct_transitions = 0
    for i in range(1, len(slice_colors)):
        dist = _lab_distance(slice_colors[i - 1], slice_colors[i])
        if dist > ZONE_COLOR_DIFF_THRESHOLD:
            distinct_transitions += 1

    if distinct_transitions < MIN_DISTINCT_ZONES:
        return False

    # Check that the strip's background (interstitial area between pads)
    # has reasonable lightness — real strips are white / light tan plastic.
    edge_margin = max(1, int(w * 0.05))
    left_edge = strip_lab[:, :edge_margin]
    right_edge = strip_lab[:, w - edge_margin:]
    edges = np.concatenate([left_edge, right_edge], axis=1)
    mean_edge_L = float(edges[:, :, 0].mean()) * 100.0 / 255.0
    if mean_edge_L < BACKGROUND_LIGHTNESS_MIN:
        return False

    return True


# ---------------------------------------------------------------------------
# Sample a pad ROI
# ---------------------------------------------------------------------------

def _sample_pad_color(strip_bgr: np.ndarray,
                      top_frac: float,
                      height_frac: float) -> LabColor:
    """
    Sample the average LAB color from a pad region on the strip.
    Uses a center 60% crop of the ROI to avoid edge noise.
    """
    h, w = strip_bgr.shape[:2]
    y_start = int(top_frac * h)
    y_end   = int((top_frac + height_frac) * h)
    roi_bgr = strip_bgr[y_start:y_end, :]

    # Center 60% horizontally and vertically to avoid shadow edges
    margin_x = int(w * 0.20)
    margin_y = int((y_end - y_start) * 0.20)
    roi_cropped = roi_bgr[margin_y:-margin_y or None,
                          margin_x:-margin_x or None]

    if roi_cropped.size == 0:
        return (85.0, 0.0, 0.0)  # default: near-white / negative

    # Convert to LAB
    roi_lab = cv2.cvtColor(roi_cropped, cv2.COLOR_BGR2Lab)
    mean_lab = roi_lab.mean(axis=(0, 1))
    # OpenCV LAB range: L 0-255, A 0-255, B 0-255 → map to standard ranges
    L = float(mean_lab[0]) * 100.0 / 255.0
    A = float(mean_lab[1]) - 128.0
    B = float(mean_lab[2]) - 128.0
    return (L, A, B)


def extract_pad_labs(strip_bgr: np.ndarray) -> Dict[str, LabColor]:
    """Extract LAB samples for all configured pad ROIs."""
    pad_labs: Dict[str, LabColor] = {}
    for pad_name, (top_frac, height_frac) in PAD_LAYOUT.items():
        pad_labs[pad_name] = _sample_pad_color(strip_bgr, top_frac, height_frac)
    return pad_labs


def extract_background_lab(strip_bgr: np.ndarray) -> Optional[LabColor]:
    """
    Estimate strip background LAB from the outer plastic margins.
    Uses a median sample to reduce shadow and reflection noise.
    """
    h, w = strip_bgr.shape[:2]
    if h < 40 or w < 10:
        return None

    edge_margin = max(2, int(w * 0.08))
    left_edge = strip_bgr[:, :edge_margin]
    right_edge = strip_bgr[:, w - edge_margin:]
    edges = np.concatenate([left_edge, right_edge], axis=1)
    if edges.size == 0:
        return None

    edges_lab = cv2.cvtColor(edges, cv2.COLOR_BGR2Lab)
    median_lab = np.median(edges_lab.reshape(-1, 3), axis=0)
    return (
        float(median_lab[0]) * 100.0 / 255.0,
        float(median_lab[1]) - 128.0,
        float(median_lab[2]) - 128.0,
    )


def extract_calibration_baseline(
    image_bytes: bytes,
) -> Optional[Tuple[Dict[str, LabColor], LabColor]]:
    """
    Build a per-session calibration profile from an unused strip photo.
    Returns None when a usable strip/background cannot be extracted.
    """
    try:
        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    except Exception as exc:
        logger.warning(f"Calibration image decode failed: {exc}")
        return None

    if image is None:
        return None

    detection = detect_strip(image)
    if detection.strip_image is None or not validate_strip(detection.strip_image):
        return None

    strip = detection.strip_image
    background_lab = extract_background_lab(strip)
    if background_lab is None:
        return None

    pad_labs = extract_pad_labs(strip)
    if len(pad_labs) != len(PAD_LAYOUT):
        return None

    return pad_labs, background_lab


def _subtract_lab(c1: LabColor, c2: LabColor) -> LabColor:
    return (c1[0] - c2[0], c1[1] - c2[1], c1[2] - c2[2])


def _apply_calibrated_matching(
    strip_bgr: np.ndarray,
    calibration: CalibrationEntry,
    pad_results: dict,
    pad_confidences: dict,
) -> bool:
    """
    Re-score semi-quantitative pads using session calibration if available.
    Falls back cleanly when any calibration signal is missing.
    """
    scan_background_lab = extract_background_lab(strip_bgr)
    if scan_background_lab is None:
        return False

    raw_pad_labs = extract_pad_labs(strip_bgr)
    if len(raw_pad_labs) != len(PAD_LAYOUT):
        return False

    global_delta = _subtract_lab(scan_background_lab, calibration.baseline_background)
    baseline_deltas: List[float] = []

    semi_pads = [
        ("protein", PROTEIN_REF),
        ("blood", BLOOD_REF),
        ("leukocytes", LEUKOCYTE_REF),
        ("glucose", GLUCOSE_REF),
        ("ketones", KETONE_REF),
        ("bilirubin", BILIRUBIN_REF),
        ("urobilinogen", UROBILINOGEN_REF),
    ]

    for pad_name, ref_table in semi_pads:
        raw_lab = raw_pad_labs.get(pad_name)
        baseline_lab = calibration.baseline_pads.get(pad_name)
        if raw_lab is None or baseline_lab is None:
            return False

        corrected_lab = _subtract_lab(raw_lab, global_delta)
        baseline_deltas.append(compute_delta_e(corrected_lab, baseline_lab))
        label, conf = _closest_label(corrected_lab, ref_table)
        pad_results[pad_name] = label
        pad_confidences[pad_name] = conf

    nitrite_lab = raw_pad_labs.get("nitrite")
    nitrite_baseline = calibration.baseline_pads.get("nitrite")
    if nitrite_lab is None or nitrite_baseline is None:
        return False

    corrected_nitrite = _subtract_lab(nitrite_lab, global_delta)
    baseline_deltas.append(compute_delta_e(corrected_nitrite, nitrite_baseline))
    nit_label, nit_conf = _closest_label(corrected_nitrite, NITRITE_REF)
    pad_results["nitrite"] = nit_label
    pad_confidences["nitrite"] = nit_conf

    logger.info(
        "Applied session calibration with mean baseline delta %.2f",
        float(np.mean(baseline_deltas)) if baseline_deltas else 0.0,
    )
    return True


# ---------------------------------------------------------------------------
# pH estimation from color (hue-based)
# ---------------------------------------------------------------------------

def _estimate_ph(strip_bgr: np.ndarray,
                 top_frac: float,
                 height_frac: float) -> float:
    """
    pH pad transitions through orange→yellow→green→blue as pH rises.
    We estimate pH from the hue channel of the HSV-converted ROI.
    """
    h, w = strip_bgr.shape[:2]
    y_start = int(top_frac * h)
    y_end   = int((top_frac + height_frac) * h)
    roi_bgr = strip_bgr[y_start:y_end, :]
    roi_hsv = cv2.cvtColor(roi_bgr, cv2.COLOR_BGR2HSV)
    mean_hue = float(roi_hsv[:, :, 0].mean())  # 0-179 in OpenCV

    # Rough hue→pH mapping (calibrated from Multistix chart)
    # Hue ~15 = orange (pH 5.0), ~30 = yellow (pH 6.0),
    # ~60 = yellow-green (pH 6.5), ~90 = green (pH 7.0), ~120 = blue-green (pH 8.5)
    if mean_hue < 20:
        return 5.0
    elif mean_hue < 35:
        return 6.0
    elif mean_hue < 65:
        return 6.5
    elif mean_hue < 95:
        return 7.0
    elif mean_hue < 120:
        return 7.5
    else:
        return 8.5


def _estimate_specific_gravity(strip_bgr: np.ndarray,
                                top_frac: float,
                                height_frac: float) -> float:
    """
    Specific gravity pad: tan→darker brown as SG increases.
    We use lightness as a rough proxy.
    """
    lab = _sample_pad_color(strip_bgr, top_frac, height_frac)
    L = lab[0]  # 0-100
    # Lighter = lower SG, darker = higher SG
    if L > 80:   return 1.005
    elif L > 70: return 1.010
    elif L > 60: return 1.015
    elif L > 50: return 1.020
    elif L > 40: return 1.025
    else:        return 1.030


# ---------------------------------------------------------------------------
# Main extraction function
# ---------------------------------------------------------------------------

def extract_dipstick_values(
    image_bytes: bytes,
    capture_mode: CaptureMode = CaptureMode.FREE_CAPTURE,
    calibration: Optional[CalibrationEntry] = None,
) -> ImageProcessingResult:
    """
    Entry point: takes raw image bytes, returns an ImageProcessingResult.

    FAIL-CLOSED: returns a failure result (with no pad values) when:
      - Image bytes cannot be decoded
      - No dipstick strip is detected in the image
      - Overall confidence falls below MIN_CONFIDENCE_THRESHOLD

    Only returns values when a strip is found and confidence is acceptable.

    Capture quality signals are always populated when the image can be decoded,
    even when the overall result is invalid. This lets the frontend show the
    user actionable feedback ("move closer", "improve lighting", etc.).
    """

    # --- Gate 1: decode ------------------------------------------------
    try:
        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    except Exception as exc:
        logger.error(f"Image decode crashed: {exc}")
        return ImageProcessingResult(
            validation=ImageValidation(
                status=ImageValidationStatus.IMAGE_DECODE_FAILED,
                is_valid=False,
                confidence=0.0,
                strip_detected=False,
                failure_reason=f"Image bytes could not be decoded: {exc}",
            )
        )

    if image is None:
        logger.warning("cv2.imdecode returned None — not a valid image")
        return ImageProcessingResult(
            validation=ImageValidation(
                status=ImageValidationStatus.IMAGE_DECODE_FAILED,
                is_valid=False,
                confidence=0.0,
                strip_detected=False,
                failure_reason=(
                    "The uploaded file could not be read as an image. "
                    "Please upload a JPEG or PNG photo of a dipstick strip."
                ),
            )
        )

    # --- Gate 2: strip detection ----------------------------------------
    detection = detect_strip(image)
    strip = detection.strip_image
    strip_contour = detection.contour

    if strip is None:
        # Still run capture quality on the image to give actionable feedback
        quality = assess_capture_quality(image, strip_contour, None, capture_mode)
        quality_model = _capture_quality_to_model(quality)

        logger.warning("No dipstick strip detected in image — rejecting")
        return ImageProcessingResult(
            validation=ImageValidation(
                status=ImageValidationStatus.STRIP_NOT_DETECTED,
                is_valid=False,
                confidence=0.0,
                strip_detected=False,
                failure_reason=(
                    "No dipstick test strip was detected in this image. "
                    "Please take a photo with the strip on a flat, light-colored "
                    "surface and ensure the full strip is visible."
                ),
                capture_quality=quality_model,
            )
        )

    # --- Read each pad from the detected strip --------------------------
    detection_confidence = 0.90
    pad_results = {}
    pad_confidences = {}

    semi_pads = [
        ("protein",       PROTEIN_REF),
        ("blood",         BLOOD_REF),
        ("leukocytes",    LEUKOCYTE_REF),
        ("glucose",       GLUCOSE_REF),
        ("ketones",       KETONE_REF),
        ("bilirubin",     BILIRUBIN_REF),
        ("urobilinogen",  UROBILINOGEN_REF),
    ]

    for pad_name, ref_table in semi_pads:
        top_frac, h_frac = PAD_LAYOUT[pad_name]
        sampled_lab = _sample_pad_color(strip, top_frac, h_frac)
        label, conf = _closest_label(sampled_lab, ref_table)
        pad_results[pad_name] = label
        pad_confidences[pad_name] = conf

    # Nitrite (binary)
    nit_top, nit_h = PAD_LAYOUT["nitrite"]
    nit_lab = _sample_pad_color(strip, nit_top, nit_h)
    nit_label, nit_conf = _closest_label(nit_lab, NITRITE_REF)
    pad_results["nitrite"] = nit_label
    pad_confidences["nitrite"] = nit_conf

    if calibration is not None:
        if not _apply_calibrated_matching(strip, calibration, pad_results, pad_confidences):
            logger.info("Calibration provided but unusable; falling back to raw matching")

    # pH (hue-based)
    ph_top, ph_h = PAD_LAYOUT["ph"]
    pad_results["ph"] = _estimate_ph(strip, ph_top, ph_h)
    pad_confidences["ph"] = detection_confidence

    # Specific gravity (lightness-based)
    sg_top, sg_h = PAD_LAYOUT["specific_gravity"]
    pad_results["specific_gravity"] = _estimate_specific_gravity(strip, sg_top, sg_h)
    pad_confidences["specific_gravity"] = detection_confidence

    # Overall confidence = detection × mean pad confidence
    mean_pad_conf = float(np.mean(list(pad_confidences.values())))
    overall_confidence = round(detection_confidence * mean_pad_conf, 2)

    # --- Capture quality assessment ------------------------------------
    quality = assess_capture_quality(image, strip_contour, strip, capture_mode)
    quality_model = _capture_quality_to_model(quality)

    # Apply quality-based confidence adjustment:
    # Poor capture quality penalizes confidence (max -15% penalty).
    # This makes borderline reads fail-closed when capture is poor.
    quality_penalty = (1.0 - quality.overall_quality_score) * 0.15
    adjusted_confidence = round(max(0.0, overall_confidence - quality_penalty), 2)

    logger.info(
        f"Capture quality: {quality.overall_quality_score:.0%} | "
        f"Raw confidence: {overall_confidence} | "
        f"Adjusted: {adjusted_confidence} | "
        f"Suggestions: {quality.suggestions}"
    )

    # --- Gate 3: confidence threshold -----------------------------------
    if adjusted_confidence < MIN_CONFIDENCE_THRESHOLD:
        logger.warning(
            f"Confidence {adjusted_confidence} < threshold {MIN_CONFIDENCE_THRESHOLD} "
            "— rejecting read"
        )
        # Include quality suggestions in the failure reason
        tip = ""
        if quality.suggestions:
            tip = " Tips: " + "; ".join(quality.suggestions[:2])
        return ImageProcessingResult(
            validation=ImageValidation(
                status=ImageValidationStatus.LOW_CONFIDENCE,
                is_valid=False,
                confidence=adjusted_confidence,
                strip_detected=True,
                failure_reason=(
                    f"A strip was detected but the pad readings are unreliable "
                    f"(confidence {adjusted_confidence:.0%}). Try better lighting, "
                    f"ensure the strip is fully dipped, and avoid shadows.{tip}"
                ),
                capture_quality=quality_model,
            )
        )

    # --- All gates passed: return valid result --------------------------
    values = {
        **pad_results,
        "confidence": adjusted_confidence,
        "pad_confidences": pad_confidences,
    }

    return ImageProcessingResult(
        validation=ImageValidation(
            status=ImageValidationStatus.VALID,
            is_valid=True,
            confidence=adjusted_confidence,
            strip_detected=True,
            failure_reason=None,
            capture_quality=quality_model,
        ),
        values=values,
    )


# ---------------------------------------------------------------------------
# Mock fallback (demo / testing)
# ---------------------------------------------------------------------------

def _mock_values(confidence: float = 0.85) -> dict:
    """
    Returns a realistic-looking abnormal mock result for demo purposes.
    Represents: possible UTI with trace protein (mild kidney flag).
    """
    return {
        "protein":       "trace",
        "blood":         "trace",
        "leukocytes":    "2+",
        "nitrite":       "positive",
        "glucose":       "negative",
        "ketones":       "negative",
        "bilirubin":     "negative",
        "urobilinogen":  "negative",
        "ph":            6.5,
        "specific_gravity": 1.018,
        "confidence":    confidence,
        "pad_confidences": {
            "protein": 0.82, "blood": 0.78, "leukocytes": 0.91,
            "nitrite": 0.95, "glucose": 0.88, "ketones": 0.85,
            "bilirubin": 0.80, "urobilinogen": 0.83, "ph": 0.87,
            "specific_gravity": 0.84,
        },
    }


def get_mock_values() -> dict:
    """Public accessor for mock/demo mode."""
    return _mock_values(confidence=0.92)
