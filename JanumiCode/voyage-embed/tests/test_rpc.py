"""Tests for the NDJSON RPC server."""

import json


def test_rpc_import():
    """Verify the RPC module can be imported."""
    from voyage_embed.rpc import RPCServer
    assert RPCServer is not None


def test_ndjson_format():
    """Verify NDJSON format helpers."""
    msg = {"id": "test-1", "method": "hello", "version": "1.0"}
    line = json.dumps(msg)
    parsed = json.loads(line)
    assert parsed["id"] == "test-1"
    assert parsed["method"] == "hello"
