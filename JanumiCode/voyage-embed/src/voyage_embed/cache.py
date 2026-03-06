"""
Model cache management.
Downloads and caches ONNX models from HuggingFace Hub.
"""

from __future__ import annotations

import logging
from pathlib import Path

logger = logging.getLogger(__name__)

DEFAULT_CACHE_DIR = Path.home() / ".cache" / "voyage-embed"


def get_model_path(
    model_repo: str,
    variant: str = "default",
    cache_dir: Path | None = None,
) -> Path:
    """
    Get the local path to a cached ONNX model.
    Downloads from HuggingFace Hub if not cached.

    Args:
        model_repo: HuggingFace repo ID (e.g. 'onnx-community/voyage-4-nano-ONNX')
        variant: Model variant subdirectory (e.g. 'q4f16', 'default')
        cache_dir: Custom cache directory

    Returns:
        Path to the model directory containing the ONNX file and tokenizer
    """
    from huggingface_hub import snapshot_download

    cache = cache_dir or DEFAULT_CACHE_DIR
    cache.mkdir(parents=True, exist_ok=True)

    # Download or use cached version
    local_dir = snapshot_download(
        repo_id=model_repo,
        cache_dir=str(cache / "hub"),
        allow_patterns=[
            f"onnx/{variant}/*",
            "tokenizer.json",
            "tokenizer_config.json",
            "special_tokens_map.json",
        ],
    )

    local_path = Path(local_dir)

    # Check for ONNX file in variant subdirectory
    variant_dir = local_path / "onnx" / variant
    if variant_dir.exists():
        # Copy tokenizer to variant dir if not present
        tok_in_variant = variant_dir / "tokenizer.json"
        tok_in_root = local_path / "tokenizer.json"
        if not tok_in_variant.exists() and tok_in_root.exists():
            import shutil
            shutil.copy2(tok_in_root, tok_in_variant)
        return variant_dir

    return local_path


def find_onnx_file(model_dir: Path) -> Path:
    """Find the .onnx file in a model directory."""
    onnx_files = list(model_dir.glob("*.onnx"))
    if not onnx_files:
        raise FileNotFoundError(f"No .onnx file found in {model_dir}")
    if len(onnx_files) > 1:
        # Prefer model.onnx if available
        for f in onnx_files:
            if f.name == "model.onnx":
                return f
    return onnx_files[0]


def get_cache_info(cache_dir: Path | None = None) -> dict:
    """Get information about cached models."""
    cache = cache_dir or DEFAULT_CACHE_DIR
    hub_dir = cache / "hub"

    if not hub_dir.exists():
        return {"cache_dir": str(cache), "models": []}

    models = []
    for item in hub_dir.iterdir():
        if item.is_dir():
            onnx_files = list(item.rglob("*.onnx"))
            if onnx_files:
                total_size = sum(f.stat().st_size for f in onnx_files)
                models.append({
                    "name": item.name,
                    "path": str(item),
                    "onnx_files": [str(f.name) for f in onnx_files],
                    "size_mb": round(total_size / 1024 / 1024, 1),
                })

    return {"cache_dir": str(cache), "models": models}
