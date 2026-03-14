"""
Tests for the capture standardization module.

Verifies:
  1. CaptureQuality signals are populated for various image types
  2. Lighting assessment works on bright/dark/uneven images
  3. Orientation assessment rejects tilted strips
  4. Aspect ratio assessment validates strip geometry
  5. Area fraction assessment checks strip size in frame
  6. Pad layout assessment counts color transitions
  7. Quality score affects confidence through the pipeline
  8. capture_quality is present in ImageValidation responses
  9. CaptureMode enum and profiles work correctly
 10. API endpoint accepts capture_mode parameter

Run from backend/:
  python -m pytest tests/test_capture_quality.py -v
"""

import numpy as np
import cv2
import pytest

from app.services.capture import (
    CaptureMode, CaptureProfile, CaptureQuality,
    assess_capture_quality, get_profile, CAPTURE_PROFILES,
    _assess_lighting, _assess_orientation, _assess_aspect_ratio,
    _assess_strip_area, _assess_pad_layout, _assess_background,
    _detect_template_markers,
)
from app.services.image_processing import (
    extract_dipstick_values, ImageProcessingResult,
)
from app.models.dipstick import ImageValidationStatus


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_white_image(h=480, w=640):
    """Create a plain white image."""
    return np.full((h, w, 3), 255, dtype=np.uint8)


def _make_dark_image(h=480, w=640):
    """Create a very dark image."""
    return np.full((h, w, 3), 15, dtype=np.uint8)


def _make_overexposed_image(h=480, w=640):
    """Create an overexposed (near-white) image."""
    return np.full((h, w, 3), 250, dtype=np.uint8)


def _make_strip_contour(cx=320, cy=240, w=70, h=420, angle=0):
    """Create a synthetic rotated rectangle contour for testing."""
    rect = ((cx, cy), (w, h), angle)
    box = cv2.boxPoints(rect)
    return box.astype(np.int32)


def _make_image_with_strip(bg_brightness=255, strip_brightness=40,
                           strip_w=70, strip_h=420, num_pads=6):
    """Create a white image with a dark strip and colored pads."""
    img = np.full((480, 640, 3), bg_brightness, dtype=np.uint8)
    x1 = 320 - strip_w // 2
    x2 = 320 + strip_w // 2
    y1 = 240 - strip_h // 2
    y2 = 240 + strip_h // 2
    cv2.rectangle(img, (x1, y1), (x2, y2), (strip_brightness,) * 3, -1)

    # Add colored pads
    pad_colors = [
        (100, 100, 200), (80, 140, 180), (200, 190, 100),
        (60, 170, 190), (100, 200, 80), (190, 80, 80),
        (120, 60, 180), (180, 120, 60), (60, 200, 120),
        (200, 60, 60),
    ]
    for i in range(min(num_pads, len(pad_colors))):
        py = y1 + 10 + i * (strip_h // (num_pads + 1))
        cv2.rectangle(img, (x1 + 5, py), (x2 - 5, py + 30), pad_colors[i], -1)

    return img


# ---------------------------------------------------------------------------
# Unit tests: CaptureMode and CaptureProfile
# ---------------------------------------------------------------------------

class TestCaptureConfig:
    """Verify capture mode configuration."""

    def test_free_capture_profile_exists(self):
        profile = get_profile(CaptureMode.FREE_CAPTURE)
        assert isinstance(profile, CaptureProfile)
        assert profile.expect_template_markers is False

    def test_standardized_capture_profile_exists(self):
        profile = get_profile(CaptureMode.STANDARDIZED_CAPTURE)
        assert isinstance(profile, CaptureProfile)
        assert profile.expect_template_markers is True
        assert profile.max_tilt_degrees < 15  # tighter tolerance

    def test_standardized_mode_has_tighter_constraints(self):
        free = get_profile(CaptureMode.FREE_CAPTURE)
        std = get_profile(CaptureMode.STANDARDIZED_CAPTURE)
        assert std.max_tilt_degrees < free.max_tilt_degrees
        assert std.min_strip_area_fraction > free.min_strip_area_fraction


# ---------------------------------------------------------------------------
# Unit tests: individual quality checks
# ---------------------------------------------------------------------------

class TestLightingAssessment:
    """Lighting quality checks."""

    def test_well_lit_image_passes(self):
        img = _make_white_image()
        # Draw some variation so it's not pure white
        cv2.rectangle(img, (100, 100), (540, 380), (200, 200, 200), -1)
        profile = get_profile(CaptureMode.FREE_CAPTURE)
        ok, brightness, uniformity, detail = _assess_lighting(img, profile)
        assert ok is True
        assert brightness > profile.min_brightness

    def test_dark_image_fails(self):
        img = _make_dark_image()
        profile = get_profile(CaptureMode.FREE_CAPTURE)
        ok, brightness, uniformity, detail = _assess_lighting(img, profile)
        assert ok is False
        assert "dark" in detail.lower()

    def test_overexposed_image_fails(self):
        img = _make_overexposed_image()
        profile = get_profile(CaptureMode.FREE_CAPTURE)
        ok, brightness, uniformity, detail = _assess_lighting(img, profile)
        assert ok is False
        assert "overexposed" in detail.lower()


class TestOrientationAssessment:
    """Strip orientation checks."""

    def test_upright_strip_passes(self):
        contour = _make_strip_contour(angle=0)
        profile = get_profile(CaptureMode.FREE_CAPTURE)
        ok, tilt, detail = _assess_orientation(contour, profile)
        assert ok is True
        assert tilt <= profile.max_tilt_degrees

    def test_severely_tilted_strip_fails(self):
        contour = _make_strip_contour(angle=40)
        profile = get_profile(CaptureMode.FREE_CAPTURE)
        ok, tilt, detail = _assess_orientation(contour, profile)
        assert ok is False
        assert "tilt" in detail.lower() or "straighten" in detail.lower()


class TestAspectRatioAssessment:
    """Strip aspect ratio checks."""

    def test_elongated_strip_passes(self):
        contour = _make_strip_contour(w=70, h=420)  # 6:1 ratio
        profile = get_profile(CaptureMode.FREE_CAPTURE)
        ok, ratio, detail = _assess_aspect_ratio(contour, profile)
        assert ok is True
        assert ratio >= profile.min_strip_aspect_ratio

    def test_square_shape_fails(self):
        contour = _make_strip_contour(w=100, h=100)  # 1:1 ratio
        profile = get_profile(CaptureMode.FREE_CAPTURE)
        ok, ratio, detail = _assess_aspect_ratio(contour, profile)
        assert ok is False
        assert "square" in detail.lower() or ratio < profile.min_strip_aspect_ratio


class TestStripAreaAssessment:
    """Strip area in frame checks."""

    def test_reasonable_strip_size_passes(self):
        # Strip area = ~29400 px², image area = 307200 px², fraction = ~9.6%
        contour = _make_strip_contour(w=70, h=420)
        profile = get_profile(CaptureMode.FREE_CAPTURE)
        ok, fraction, detail = _assess_strip_area(contour, (480, 640, 3), profile)
        assert ok is True

    def test_tiny_strip_fails(self):
        contour = _make_strip_contour(w=10, h=30)  # tiny
        profile = CaptureProfile(min_strip_area_fraction=0.02)
        ok, fraction, detail = _assess_strip_area(contour, (480, 640, 3), profile)
        assert ok is False
        assert "small" in detail.lower() or "closer" in detail.lower()


class TestPadLayoutAssessment:
    """Pad color transition checks."""

    def test_strip_with_pads_has_transitions(self):
        strip_img = _make_image_with_strip(num_pads=6)
        # Crop to just the strip region
        strip_crop = strip_img[30:450, 285:355]
        profile = get_profile(CaptureMode.FREE_CAPTURE)
        ok, transitions, detail = _assess_pad_layout(strip_crop, profile)
        assert transitions > 0

    def test_uniform_strip_has_few_transitions(self):
        # Solid gray strip — no pads
        strip_img = np.full((400, 60, 3), 128, dtype=np.uint8)
        profile = CaptureProfile(min_pad_transitions=5)
        ok, transitions, detail = _assess_pad_layout(strip_img, profile)
        assert ok is False
        assert transitions < 5


class TestTemplateDetection:
    """Template/fiducial marker detection (placeholder)."""

    def test_free_capture_skips_markers(self):
        profile = get_profile(CaptureMode.FREE_CAPTURE)
        ok, count, detail = _detect_template_markers(
            _make_white_image(), profile
        )
        assert ok is False
        assert "not expected" in detail.lower()

    def test_standardized_capture_returns_not_implemented(self):
        profile = get_profile(CaptureMode.STANDARDIZED_CAPTURE)
        ok, count, detail = _detect_template_markers(
            _make_white_image(), profile
        )
        assert ok is False
        assert "not yet implemented" in detail.lower()


# ---------------------------------------------------------------------------
# Integration tests: full quality assessment
# ---------------------------------------------------------------------------

class TestFullQualityAssessment:
    """Test the complete assess_capture_quality function."""

    def test_quality_without_strip_still_runs(self):
        """Even when no strip is found, image-level checks should run."""
        img = _make_white_image()
        quality = assess_capture_quality(img, None, None, CaptureMode.FREE_CAPTURE)

        assert isinstance(quality, CaptureQuality)
        assert quality.capture_mode == "free_capture"
        # Lighting should be assessed even without a strip
        assert quality.lighting_detail != ""
        # Geometry checks should indicate no strip
        assert quality.orientation_ok is False
        assert "No strip" in quality.orientation_detail

    def test_quality_with_strip_populates_all_fields(self):
        img = _make_image_with_strip()
        contour = _make_strip_contour()
        strip_crop = img[30:450, 285:355]

        quality = assess_capture_quality(img, contour, strip_crop, CaptureMode.FREE_CAPTURE)

        assert isinstance(quality, CaptureQuality)
        assert quality.overall_quality_score >= 0.0
        assert quality.overall_quality_score <= 1.0
        # All detail strings should be populated
        assert quality.orientation_detail != ""
        assert quality.aspect_ratio_detail != ""
        assert quality.lighting_detail != ""

    def test_quality_score_is_normalized(self):
        img = _make_image_with_strip()
        contour = _make_strip_contour()
        strip_crop = img[30:450, 285:355]

        quality = assess_capture_quality(img, contour, strip_crop, CaptureMode.FREE_CAPTURE)
        assert 0.0 <= quality.overall_quality_score <= 1.0


# ---------------------------------------------------------------------------
# Integration: capture quality in image processing pipeline
# ---------------------------------------------------------------------------

class TestCaptureQualityInPipeline:
    """Verify capture_quality is populated in ImageValidation responses."""

    def test_strip_not_detected_includes_capture_quality(self):
        """When no strip is found, capture_quality should still be present."""
        img = np.full((400, 400, 3), (200, 100, 50), dtype=np.uint8)
        _, encoded = cv2.imencode(".png", img)
        result = extract_dipstick_values(encoded.tobytes())

        assert result.validation.is_valid is False
        assert result.validation.status == ImageValidationStatus.STRIP_NOT_DETECTED
        # capture_quality should be populated with at least lighting info
        assert result.validation.capture_quality is not None
        assert result.validation.capture_quality.lighting_detail != ""

    def test_decode_failure_has_no_capture_quality(self):
        """When image can't be decoded, capture_quality should be None."""
        result = extract_dipstick_values(b"not an image")

        assert result.validation.is_valid is False
        assert result.validation.status == ImageValidationStatus.IMAGE_DECODE_FAILED
        # Can't assess quality if we can't decode the image
        assert result.validation.capture_quality is None

    def test_capture_mode_parameter_accepted(self):
        """extract_dipstick_values should accept capture_mode parameter."""
        img = np.full((400, 400, 3), 200, dtype=np.uint8)
        _, encoded = cv2.imencode(".png", img)

        # Should not crash with either mode
        result_free = extract_dipstick_values(
            encoded.tobytes(), CaptureMode.FREE_CAPTURE
        )
        result_std = extract_dipstick_values(
            encoded.tobytes(), CaptureMode.STANDARDIZED_CAPTURE
        )

        assert isinstance(result_free, ImageProcessingResult)
        assert isinstance(result_std, ImageProcessingResult)


# ---------------------------------------------------------------------------
# API integration: capture_mode in /api/analyze
# ---------------------------------------------------------------------------

class TestCaptureQualityAPI:
    """Verify capture quality is returned via the API."""

    @pytest.fixture
    def client(self):
        from fastapi.testclient import TestClient
        from app.main import app
        return TestClient(app)

    def test_analyze_returns_capture_quality_on_failure(self, client):
        """Invalid image should still return capture_quality signals."""
        img = np.full((200, 200, 3), 128, dtype=np.uint8)
        _, encoded = cv2.imencode(".png", img)

        resp = client.post(
            "/api/analyze",
            files={"image": ("solid.png", encoded.tobytes(), "image/png")},
        )
        assert resp.status_code == 200
        data = resp.json()

        assert data["image_validation"]["is_valid"] is False
        cq = data["image_validation"].get("capture_quality")
        assert cq is not None
        assert "overall_quality_score" in cq
        assert "suggestions" in cq
        assert isinstance(cq["suggestions"], list)

    def test_analyze_accepts_capture_mode_form_field(self, client):
        """API should accept capture_mode as a form field."""
        img = np.full((200, 200, 3), 128, dtype=np.uint8)
        _, encoded = cv2.imencode(".png", img)

        resp = client.post(
            "/api/analyze",
            files={"image": ("solid.png", encoded.tobytes(), "image/png")},
            data={"capture_mode": "standardized_capture"},
        )
        assert resp.status_code == 200
        data = resp.json()
        cq = data["image_validation"].get("capture_quality")
        if cq:
            assert cq["capture_mode"] == "standardized_capture"

    def test_analyze_handles_invalid_capture_mode_gracefully(self, client):
        """Invalid capture_mode value should default to free_capture."""
        img = np.full((200, 200, 3), 128, dtype=np.uint8)
        _, encoded = cv2.imencode(".png", img)

        resp = client.post(
            "/api/analyze",
            files={"image": ("solid.png", encoded.tobytes(), "image/png")},
            data={"capture_mode": "invalid_mode"},
        )
        assert resp.status_code == 200
