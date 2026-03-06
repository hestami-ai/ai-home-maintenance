"""
ONNX Inference Engine for Voyage embedding models.
Loads the ONNX model, tokenizes input, runs inference, and returns normalized embeddings.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Literal

import numpy as np
from numpy.typing import NDArray

logger = logging.getLogger(__name__)

# Input type prefixes (same as Voyage API)
_PREFIXES: dict[str, str] = {
    "query": "query: ",
    "document": "passage: ",
}


class EmbeddingEngine:
    """ONNX-based embedding engine with mean pooling and L2 normalization."""

    def __init__(
        self,
        model_path: str | Path,
        tokenizer_path: str | Path | None = None,
        provider: str = "auto",
        max_length: int = 512,
    ) -> None:
        import onnxruntime as ort
        from tokenizers import Tokenizer

        self.max_length = max_length

        # Select execution provider
        providers = self._resolve_providers(provider)
        logger.info("Creating ONNX session with providers: %s", providers)
        self.session = ort.InferenceSession(str(model_path), providers=providers)
        self.active_provider = self.session.get_providers()[0]
        logger.info("Active ONNX provider: %s", self.active_provider)

        # Load tokenizer
        tok_path = tokenizer_path or model_path
        if Path(tok_path).is_dir():
            tok_file = Path(tok_path) / "tokenizer.json"
        else:
            tok_file = Path(tok_path)
        self.tokenizer = Tokenizer.from_file(str(tok_file))
        self.tokenizer.enable_truncation(max_length=max_length)
        self.tokenizer.enable_padding(length=max_length)

    def embed(
        self,
        texts: list[str],
        input_type: Literal["query", "document"] = "document",
        dimensions: int = 1024,
    ) -> tuple[NDArray[np.float32], list[int], list[bool]]:
        """
        Embed a batch of texts.

        Returns:
            embeddings: (N, dimensions) float32 array, L2-normalized
            token_counts: list of token counts per input
            truncated: list of booleans indicating if input was truncated
        """
        # Apply prefix
        prefix = _PREFIXES.get(input_type, "")
        prefixed = [prefix + t for t in texts]

        # Tokenize
        encodings = self.tokenizer.encode_batch(prefixed)
        input_ids = np.array([e.ids for e in encodings], dtype=np.int64)
        attention_mask = np.array(
            [e.attention_mask for e in encodings], dtype=np.int64
        )
        token_counts = [sum(e.attention_mask) for e in encodings]
        truncated = [
            len(e.tokens) >= self.max_length for e in encodings
        ]

        # Run ONNX inference
        feeds = {
            "input_ids": input_ids,
            "attention_mask": attention_mask,
        }
        # Some models also accept token_type_ids
        input_names = {inp.name for inp in self.session.get_inputs()}
        if "token_type_ids" in input_names:
            feeds["token_type_ids"] = np.zeros_like(input_ids)

        outputs = self.session.run(None, feeds)
        # outputs[0] is typically (batch, seq_len, hidden_dim)
        hidden_states = outputs[0]

        # Mean pooling
        mask_expanded = attention_mask[:, :, np.newaxis].astype(np.float32)
        sum_embeddings = (hidden_states * mask_expanded).sum(axis=1)
        sum_mask = mask_expanded.sum(axis=1).clip(min=1e-9)
        pooled = sum_embeddings / sum_mask

        # Matryoshka truncation
        if dimensions < pooled.shape[1]:
            pooled = pooled[:, :dimensions]

        # L2 normalization
        norms = np.linalg.norm(pooled, axis=1, keepdims=True).clip(min=1e-12)
        normalized = (pooled / norms).astype(np.float32)

        return normalized, token_counts, truncated

    @staticmethod
    def _resolve_providers(provider: str) -> list[str]:
        """Resolve ONNX execution providers."""
        import onnxruntime as ort

        available = ort.get_available_providers()

        if provider == "auto":
            # Prefer CUDA > DirectML > CPU
            preferred = [
                "CUDAExecutionProvider",
                "DmlExecutionProvider",
                "CPUExecutionProvider",
            ]
            return [p for p in preferred if p in available] or [
                "CPUExecutionProvider"
            ]
        elif provider == "cpu":
            return ["CPUExecutionProvider"]
        elif provider == "cuda":
            if "CUDAExecutionProvider" in available:
                return ["CUDAExecutionProvider", "CPUExecutionProvider"]
            raise RuntimeError("CUDAExecutionProvider not available")
        else:
            return [provider]
