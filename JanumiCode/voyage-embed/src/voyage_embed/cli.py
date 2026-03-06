"""
Typer CLI for voyage-embed.
Commands: doctor, warmup, rpc, validate, embed
"""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path
from typing import Optional

import typer

app = typer.Typer(
    name="voyage-embed",
    help="Local ONNX inference for Voyage embedding models",
    no_args_is_help=True,
)


@app.command()
def doctor(
    as_json: bool = typer.Option(False, "--json", help="Output as JSON"),
) -> None:
    """Check system readiness: GPU availability, model cache, dependencies."""
    import importlib

    info: dict = {"status": "ok", "checks": {}}

    # Check onnxruntime
    try:
        import onnxruntime as ort

        providers = ort.get_available_providers()
        info["checks"]["onnxruntime"] = {
            "version": ort.__version__,
            "providers": providers,
            "gpu": "CUDAExecutionProvider" in providers or "DmlExecutionProvider" in providers,
        }
    except ImportError:
        info["checks"]["onnxruntime"] = {"error": "not installed"}
        info["status"] = "error"

    # Check tokenizers
    try:
        import tokenizers

        info["checks"]["tokenizers"] = {"version": tokenizers.__version__}
    except ImportError:
        info["checks"]["tokenizers"] = {"error": "not installed"}
        info["status"] = "error"

    # Check numpy
    try:
        import numpy as np

        info["checks"]["numpy"] = {"version": np.__version__}
    except ImportError:
        info["checks"]["numpy"] = {"error": "not installed"}
        info["status"] = "error"

    # Check model cache
    from voyage_embed.cache import get_cache_info

    info["checks"]["cache"] = get_cache_info()

    # Python version
    info["python"] = sys.version

    if as_json:
        typer.echo(json.dumps(info, indent=2))
    else:
        typer.echo(f"Python: {sys.version}")
        for name, check in info["checks"].items():
            if "error" in check:
                typer.echo(f"  {name}: NOT INSTALLED")
            elif "version" in check:
                typer.echo(f"  {name}: v{check['version']}")
            else:
                typer.echo(f"  {name}: {json.dumps(check)}")
        typer.echo(f"\nStatus: {info['status']}")


@app.command()
def warmup(
    model: str = typer.Option(
        "onnx-community/voyage-4-nano-ONNX",
        help="HuggingFace model repo ID",
    ),
    variant: str = typer.Option("q4f16", help="Model variant"),
) -> None:
    """Download and cache the ONNX model."""
    from voyage_embed.cache import get_model_path, find_onnx_file

    typer.echo(f"Downloading {model} (variant: {variant})...")
    model_dir = get_model_path(model, variant)
    onnx_file = find_onnx_file(model_dir)
    typer.echo(f"Model cached at: {model_dir}")
    typer.echo(f"ONNX file: {onnx_file.name} ({onnx_file.stat().st_size / 1024 / 1024:.1f} MB)")


@app.command()
def rpc(
    model: str = typer.Option(
        "onnx-community/voyage-4-nano-ONNX",
        help="HuggingFace model repo ID",
    ),
    variant: str = typer.Option("q4f16", help="Model variant"),
    provider: str = typer.Option("auto", help="ONNX execution provider (auto/cpu/cuda)"),
    dimensions: int = typer.Option(1024, help="Output embedding dimensions"),
    max_length: int = typer.Option(512, help="Max token sequence length"),
) -> None:
    """Start the NDJSON stdio RPC server."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        stream=sys.stderr,  # Logs go to stderr, RPC goes to stdout
    )

    from voyage_embed.cache import get_model_path, find_onnx_file
    from voyage_embed.engine import EmbeddingEngine
    from voyage_embed.rpc import RPCServer

    logger = logging.getLogger("voyage_embed")
    logger.info("Loading model %s (variant: %s)", model, variant)

    model_dir = get_model_path(model, variant)
    onnx_file = find_onnx_file(model_dir)

    engine = EmbeddingEngine(
        model_path=str(onnx_file),
        tokenizer_path=str(model_dir),
        provider=provider,
        max_length=max_length,
    )
    logger.info("Engine ready (provider: %s)", engine.active_provider)

    server = RPCServer(engine, dimensions=dimensions)
    server.run()


@app.command()
def embed(
    text: str = typer.Option(..., help="Text to embed"),
    mode: str = typer.Option("query", help="Input type: query or document"),
    model: str = typer.Option(
        "onnx-community/voyage-4-nano-ONNX",
        help="HuggingFace model repo ID",
    ),
    variant: str = typer.Option("q4f16", help="Model variant"),
    dimensions: int = typer.Option(1024, help="Output dimensions"),
    provider: str = typer.Option("auto", help="ONNX execution provider"),
) -> None:
    """One-shot embedding for testing."""
    from voyage_embed.cache import get_model_path, find_onnx_file
    from voyage_embed.engine import EmbeddingEngine

    model_dir = get_model_path(model, variant)
    onnx_file = find_onnx_file(model_dir)

    engine = EmbeddingEngine(
        model_path=str(onnx_file),
        tokenizer_path=str(model_dir),
        provider=provider,
    )

    embeddings, tokens, truncated = engine.embed([text], input_type=mode, dimensions=dimensions)

    result = {
        "dimensions": embeddings.shape[1],
        "tokens": tokens[0],
        "truncated": truncated[0],
        "embedding_preview": embeddings[0][:8].tolist(),
        "norm": float(sum(embeddings[0] ** 2) ** 0.5),
    }

    typer.echo(json.dumps(result, indent=2))


@app.command()
def validate(
    suite: str = typer.Option("default", help="Golden vector suite name"),
) -> None:
    """Validate embeddings against golden reference vectors."""
    typer.echo(f"Validation suite '{suite}' — not yet implemented")
    typer.echo("Run 'voyage-embed warmup' first, then re-run validate once golden vectors are generated.")


if __name__ == "__main__":
    app()
