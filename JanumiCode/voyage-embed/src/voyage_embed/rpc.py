"""
NDJSON stdio RPC server for embedding requests.
Protocol:
  - Each line on stdin/stdout is a JSON object (NDJSON)
  - Request: {"id": "...", "method": "...", ...params}
  - Response: {"id": "...", "method": "method.ok", ...result} or {"id": "...", "method": "error", ...}
"""

from __future__ import annotations

import base64
import json
import logging
import sys
import time
from typing import TYPE_CHECKING

import numpy as np

if TYPE_CHECKING:
    from voyage_embed.engine import EmbeddingEngine

logger = logging.getLogger(__name__)


class RPCServer:
    """NDJSON stdio RPC server."""

    def __init__(self, engine: EmbeddingEngine, dimensions: int = 1024) -> None:
        self.engine = engine
        self.dimensions = dimensions
        self.request_count = 0
        self.total_tokens = 0
        self.start_time = time.monotonic()

    def run(self) -> None:
        """Main RPC loop: read lines from stdin, process, write to stdout."""
        logger.info("RPC server starting")

        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue

            try:
                msg = json.loads(line)
            except json.JSONDecodeError as e:
                self._send_error("", "parse_error", f"Invalid JSON: {e}")
                continue

            msg_id = msg.get("id", "")
            method = msg.get("method", "")

            try:
                self._dispatch(msg_id, method, msg)
            except Exception as e:
                logger.exception("RPC handler error for method=%s", method)
                self._send_error(msg_id, "internal_error", str(e))

        logger.info("RPC server shutting down (stdin closed)")

    def _dispatch(self, msg_id: str, method: str, msg: dict) -> None:
        """Dispatch a request to the appropriate handler."""
        handlers = {
            "hello": self._handle_hello,
            "embed": self._handle_embed,
            "stats": self._handle_stats,
            "validate": self._handle_validate,
            "shutdown": self._handle_shutdown,
        }

        handler = handlers.get(method)
        if handler is None:
            self._send_error(msg_id, "unknown_method", f"Unknown method: {method}")
            return

        handler(msg_id, msg)

    def _handle_hello(self, msg_id: str, msg: dict) -> None:
        """Handshake — report capabilities."""
        self._send({
            "id": msg_id,
            "method": "hello.ok",
            "version": "1.0",
            "dimensions": self.dimensions,
            "provider": self.engine.active_provider,
            "max_batch": 128,
        })

    def _handle_embed(self, msg_id: str, msg: dict) -> None:
        """Embed a batch of texts."""
        texts = msg.get("texts", [])
        input_type = msg.get("input_type", "document")
        dims = msg.get("dimensions", self.dimensions)

        if not texts:
            self._send({
                "id": msg_id,
                "method": "embed.ok",
                "embeddings": [],
            })
            return

        start = time.monotonic()
        embeddings, token_counts, truncated_flags = self.engine.embed(
            texts, input_type=input_type, dimensions=dims
        )
        elapsed_ms = (time.monotonic() - start) * 1000

        # Encode as base64 float32
        results = []
        for i, emb in enumerate(embeddings):
            data = base64.b64encode(emb.astype(np.float32).tobytes()).decode("ascii")
            results.append({
                "data": data,
                "tokens": token_counts[i],
                "truncated": truncated_flags[i],
            })

        self.request_count += 1
        self.total_tokens += sum(token_counts)

        self._send({
            "id": msg_id,
            "method": "embed.ok",
            "embeddings": results,
            "elapsed_ms": round(elapsed_ms, 1),
        })

    def _handle_stats(self, msg_id: str, msg: dict) -> None:
        """Return runtime statistics."""
        uptime = time.monotonic() - self.start_time
        self._send({
            "id": msg_id,
            "method": "stats.ok",
            "requests": self.request_count,
            "total_tokens": self.total_tokens,
            "uptime_seconds": round(uptime, 1),
            "provider": self.engine.active_provider,
        })

    def _handle_validate(self, msg_id: str, msg: dict) -> None:
        """Validate embeddings against golden vectors."""
        # Placeholder — golden vector validation
        self._send({
            "id": msg_id,
            "method": "validate.ok",
            "status": "not_implemented",
            "message": "Golden vector validation not yet configured",
        })

    def _handle_shutdown(self, msg_id: str, msg: dict) -> None:
        """Graceful shutdown."""
        self._send({
            "id": msg_id,
            "method": "shutdown.ok",
        })
        logger.info("Shutdown requested — exiting")
        sys.exit(0)

    def _send(self, msg: dict) -> None:
        """Write a JSON line to stdout."""
        sys.stdout.write(json.dumps(msg) + "\n")
        sys.stdout.flush()

    def _send_error(self, msg_id: str, code: str, message: str) -> None:
        """Send an error response."""
        self._send({
            "id": msg_id,
            "method": "error",
            "code": code,
            "message": message,
        })
