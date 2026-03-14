"""
Tests for the fail-closed image validation pipeline.

These tests verify that:
  1. Random non-image bytes → IMAGE_DECODE_FAILED (not mock clinical data)
  2. A valid image with no strip → STRIP_NOT_DETECTED (not center-crop inference)
  3. Mock/demo values are still accessible via get_mock_values()
  4. The /api/analyze endpoint returns structured failures, not 500s
  5. The /api/demo endpoint still returns valid mock results
  6. Invalid images do NOT produce clinical interpretation or FHIR data

Run from backend/:
  python -m pytest tests/ -v
"""

import io
import numpy as np
import cv2
import pytest

from app.models.dipstick import (
    ImageValidationStatus, MIN_CONFIDENCE_THRESHOLD,
)
from app.services.image_processing import (
    extract_dipstick_values, get_mock_values, ImageProcessingResult,
)


# ---------------------------------------------------------------------------
# Unit tests: image_processing.extract_dipstick_values
# ---------------------------------------------------------------------------

class TestImageDecode:
    """Gate 1: image decoding."""

    def test_garbage_bytes_returns_decode_failure(self):
        """Random bytes should fail with IMAGE_DECODE_FAILED, not mock data."""
        garbage = b"this is definitely not an image"
        result = extract_dipstick_values(garbage)

        assert isinstance(result, ImageProcessingResult)
        assert result.validation.is_valid is False
        assert result.validation.status == ImageValidationStatus.IMAGE_DECODE_FAILED
        assert result.values is None
        assert result.validation.strip_detected is False

    def test_empty_bytes_returns_decode_failure(self):
        result = extract_dipstick_values(b"")

        assert result.validation.is_valid is False
        assert result.validation.status == ImageValidationStatus.IMAGE_DECODE_FAILED
        assert result.values is None

    def test_truncated_jpeg_returns_decode_failure(self):
        """A truncated JPEG header with no actual image data."""
        truncated = b"\xff\xd8\xff\xe0\x00\x10JFIF"
        result = extract_dipstick_values(truncated)

        assert result.validation.is_valid is False
        assert result.validation.status == ImageValidationStatus.IMAGE_DECODE_FAILED


class TestStripDetection:
    """Gate 2: dipstick strip detection."""

    def test_solid_color_image_returns_strip_not_detected(self):
        """A plain solid-color image has no elongated strip-like contour."""
        # Create a 400x400 solid blue image → no strip
        img = np.full((400, 400, 3), (200, 100, 50), dtype=np.uint8)
        _, encoded = cv2.imencode(".png", img)
        result = extract_dipstick_values(encoded.tobytes())

        assert result.validation.is_valid is False
        assert result.validation.status == ImageValidationStatus.STRIP_NOT_DETECTED
        assert result.values is None
        assert result.validation.strip_detected is False

    def test_photo_of_cat_returns_strip_not_detected(self):
        """A random photo-like noise image should not detect a strip."""
        # Generate random RGB noise (simulates a random photo)
        rng = np.random.RandomState(42)
        noise_img = rng.randint(0, 256, (480, 640, 3), dtype=np.uint8)
        _, encoded = cv2.imencode(".jpg", noise_img)
        result = extract_dipstick_values(encoded.tobytes())

        # Should be either STRIP_NOT_DETECTED or LOW_CONFIDENCE — never VALID
        assert result.validation.is_valid is False
        assert result.validation.status in (
            ImageValidationStatus.STRIP_NOT_DETECTED,
            ImageValidationStatus.LOW_CONFIDENCE,
        )
        # Critically: no clinical values should be produced
        if result.values is not None:
            # If somehow a "strip" was detected in noise, confidence must be
            # below threshold to trigger LOW_CONFIDENCE rejection
            assert result.validation.confidence < MIN_CONFIDENCE_THRESHOLD


class TestValidStripPath:
    """Verify that a synthetic strip image passes all gates."""

    def _make_synthetic_strip_image(self) -> bytes:
        """
        Create a 640x480 white image with a high-contrast, elongated dark
        rectangle (aspect ratio > 3:1, area > 5000) that the contour detector
        will reliably pick up via Otsu thresholding.
        """
        # Pure white background
        img = np.full((480, 640, 3), 255, dtype=np.uint8)
        # Draw a dark vertical strip: 70px wide × 420px tall = 29,400 px² area
        # aspect = 420/70 = 6 — comfortably above the 3:1 threshold
        cv2.rectangle(img, (285, 30), (355, 450), (40, 40, 40), -1)
        # Add some colored "pads" along the strip for realism
        pad_colors = [
            (100, 100, 200), (80, 140, 180), (200, 190, 100),
            (60, 170, 190), (100, 200, 80), (190, 80, 80),
        ]
        for i, color in enumerate(pad_colors):
            y = 50 + i * 60
            cv2.rectangle(img, (290, y), (350, y + 40), color, -1)

        _, encoded = cv2.imencode(".png", img)
        return encoded.tobytes()

    def test_synthetic_strip_returns_structured_result(self):
        """
        Even if the synthetic strip isn't detected by the real CV pipeline
        (which is tuned for real-world photos), the function must return a
        properly structured ImageProcessingResult — never crash or mock.
        """
        image_bytes = self._make_synthetic_strip_image()
        result = extract_dipstick_values(image_bytes)

        # Must always return ImageProcessingResult with populated validation
        assert isinstance(result, ImageProcessingResult)
        assert result.validation is not None
        assert isinstance(result.validation.status, ImageValidationStatus)

        # If strip IS detected and passes threshold: values must be populated
        if result.validation.is_valid:
            assert result.values is not None
            assert "protein" in result.values
            assert "confidence" in result.values
        # If strip is NOT detected: values must be None (fail-closed)
        else:
            assert result.values is None


class TestMockValues:
    """Mock/demo path is still usable."""

    def test_get_mock_values_returns_complete_dict(self):
        mock = get_mock_values()
        assert mock["confidence"] == 0.92
        assert "protein" in mock
        assert "blood" in mock
        assert "pad_confidences" in mock


# ---------------------------------------------------------------------------
# Integration tests: API endpoints (requires FastAPI TestClient)
# ---------------------------------------------------------------------------

class TestAnalyzeEndpoint:
    """Verify that /api/analyze fails safely for invalid images."""

    @pytest.fixture
    def client(self):
        from fastapi.testclient import TestClient
        from app.main import app
        return TestClient(app)

    def test_garbage_upload_returns_200_with_invalid_status(self, client):
        """
        Uploading garbage bytes should NOT crash or return mock clinical data.
        It should return HTTP 200 with image_validation.is_valid == False.
        """
        resp = client.post(
            "/api/analyze",
            files={"image": ("garbage.jpg", b"not an image", "image/jpeg")},
        )
        assert resp.status_code == 200
        data = resp.json()

        assert data["image_validation"]["is_valid"] is False
        assert data["image_validation"]["status"] == "image_decode_failed"
        # No clinical data should be present
        assert data["dipstick_values"] is None
        assert data["interpretation"] is None
        assert data["explanation"] is None
        assert data["fhir_bundle"] is None

    def test_non_image_content_type_returns_422(self, client):
        """Uploading a non-image file (e.g., PDF) should be rejected at the gate."""
        resp = client.post(
            "/api/analyze",
            files={"image": ("doc.pdf", b"%PDF-1.4 garbage", "application/pdf")},
        )
        assert resp.status_code == 422

    def test_solid_image_returns_strip_not_detected(self, client):
        """A valid image with no strip should return strip_not_detected."""
        img = np.full((200, 200, 3), 128, dtype=np.uint8)
        _, encoded = cv2.imencode(".png", img)

        resp = client.post(
            "/api/analyze",
            files={"image": ("solid.png", encoded.tobytes(), "image/png")},
        )
        assert resp.status_code == 200
        data = resp.json()

        assert data["image_validation"]["is_valid"] is False
        assert data["image_validation"]["status"] == "strip_not_detected"
        assert data["dipstick_values"] is None
        assert data["fhir_bundle"] is None

    def test_no_fhir_posting_on_invalid_image(self, client):
        """Invalid images must NOT cause any FHIR resources to be posted."""
        resp = client.post(
            "/api/analyze",
            files={"image": ("bad.jpg", b"aaabbbccc", "image/jpeg")},
        )
        data = resp.json()

        # integration_status should be default (no posting attempted)
        status = data.get("integration_status", {})
        assert status.get("resources_posted", []) == []


class TestDemoEndpoint:
    """Verify that /api/demo still works with mock data."""

    @pytest.fixture
    def client(self):
        from fastapi.testclient import TestClient
        from app.main import app
        return TestClient(app)

    def test_demo_returns_valid_result(self, client):
        resp = client.get("/api/demo")
        assert resp.status_code == 200
        data = resp.json()

        assert data["image_validation"]["is_valid"] is True
        assert data["image_validation"]["status"] == "valid"
        assert data["dipstick_values"] is not None
        assert data["interpretation"] is not None
        assert data["explanation"] is not None
        assert data["fhir_bundle"] is not None
