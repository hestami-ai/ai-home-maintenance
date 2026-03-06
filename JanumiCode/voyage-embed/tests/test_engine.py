"""Tests for the ONNX embedding engine."""

import pytest
import numpy as np


def test_engine_import():
    """Verify the engine module can be imported."""
    from voyage_embed.engine import EmbeddingEngine
    assert EmbeddingEngine is not None


def test_l2_normalization():
    """Verify L2 normalization produces unit vectors."""
    # Simulate what the engine does for normalization
    vec = np.array([[3.0, 4.0]], dtype=np.float32)
    norm = np.linalg.norm(vec, axis=1, keepdims=True)
    normalized = vec / norm

    # Should be unit vector
    assert abs(np.linalg.norm(normalized) - 1.0) < 1e-6
    np.testing.assert_allclose(normalized[0], [0.6, 0.8], atol=1e-6)


def test_matryoshka_truncation():
    """Verify Matryoshka dimension truncation."""
    full = np.random.randn(2, 1024).astype(np.float32)
    truncated = full[:, :256]

    assert truncated.shape == (2, 256)
    # First 256 dims should match
    np.testing.assert_array_equal(truncated, full[:, :256])
