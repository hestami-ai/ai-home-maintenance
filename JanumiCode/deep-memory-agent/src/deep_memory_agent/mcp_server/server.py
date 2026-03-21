"""MCP server entry point for the Deep Memory Agent.

Provides read-only memory research tools to the Deep Agents CLI agent.
The agent calls these tools during its 6-stage retrieval pipeline to
search, expand, analyze conflicts, and synthesize context packets.

Usage:
    deep-memory-mcp                          # stdio transport (default)
    DEEP_MEMORY_DB_PATH=/path/to/db.sqlite deep-memory-mcp

The DB path is read from the DEEP_MEMORY_DB_PATH environment variable,
which is set by JanumiCode's MCP config generation.
"""

from __future__ import annotations

import json
import os
import sys

from mcp.server.fastmcp import FastMCP

from deep_memory_agent.db.connection import ConnectionManager

# Initialize MCP server
mcp = FastMCP(
    "deep-memory-agent",
    description="Deep Research Memory Agent — multi-stage memory adjudication and reconstruction tools",
)

# Global connection manager (initialized from env var)
_conn_manager: ConnectionManager | None = None


def _get_conn() -> ConnectionManager:
    """Lazy-init connection manager from environment."""
    global _conn_manager
    if _conn_manager is None:
        db_path = os.environ.get("DEEP_MEMORY_DB_PATH")
        if not db_path:
            raise RuntimeError(
                "DEEP_MEMORY_DB_PATH environment variable not set. "
                "This MCP server must be launched with the database path configured."
            )
        _conn_manager = ConnectionManager(db_path, read_only=True)
    return _conn_manager


# ── Health / Diagnostic Tool ──


@mcp.tool()
def check_health() -> str:
    """Check database connectivity and return status information.

    Returns a JSON object with database health status including:
    - Connection status
    - Table counts
    - Whether memory agent tables exist
    - Schema version
    """
    conn = _get_conn()
    health = conn.check_health()
    return json.dumps(health, indent=2)


# ── Search Candidates (Stage 2: Broad Harvest) ──


@mcp.tool()
def search_memory_candidates(
    query: str,
    object_types: list[str] | None = None,
    limit: int = 50,
    time_after: str | None = None,
    time_before: str | None = None,
) -> str:
    """Search the memory substrate for candidate objects matching a query.

    This is the primary retrieval tool for Stage 2 (Broad Candidate Harvest).
    Searches across FTS index and memory_objects content.

    Args:
        query: Natural language search query or keywords
        object_types: Filter by object types (e.g., ['claim', 'decision_trace', 'constraint'])
        limit: Maximum number of candidates to return
        time_after: Only include objects with event_at after this ISO timestamp
        time_before: Only include objects with event_at before this ISO timestamp

    Returns:
        JSON array of candidate objects with scores and search source
    """
    from deep_memory_agent.db.fts import search_combined

    conn = _get_conn()
    with conn.session() as db:
        try:
            # 1. FTS + text search across both fts_stream_content and memory_objects
            results = search_combined(db, query, object_types=object_types, limit=limit)

            # 2. Apply time filters if specified
            if time_after or time_before:
                filtered = []
                for r in results:
                    event_at = r.get("event_at") or r.get("recorded_at", "")
                    if time_after and event_at < time_after:
                        continue
                    if time_before and event_at > time_before:
                        continue
                    filtered.append(r)
                results = filtered

            return json.dumps(results[:limit], indent=2, default=str)
        except Exception as e:
            return json.dumps({"error": str(e), "candidates": []})


# ── Expand Neighbors (Stage 4: Drill-down) ──


@mcp.tool()
def expand_memory_neighbors(
    object_id: str,
    edge_types: list[str] | None = None,
    depth: int = 1,
) -> str:
    """Expand a memory object's graph neighbors via typed edges.

    For Stage 4 (Drill-down Expansion): follows memory_edges from a given
    object to find supporting evidence, contradictions, supersession chains, etc.

    Args:
        object_id: The memory object to expand from
        edge_types: Filter by edge types (e.g., ['supports', 'contradicts', 'derived_from'])
        depth: How many hops to traverse (max 3)

    Returns:
        JSON object with discovered objects and edges
    """
    from deep_memory_agent.db.graph import expand_subgraph

    conn = _get_conn()
    with conn.session() as db:
        try:
            objects_found, edges_found = expand_subgraph(
                db, [object_id], edge_types=edge_types, max_depth=depth
            )
            return json.dumps(
                {"objects": objects_found, "edges": edges_found, "visited_count": len(objects_found)},
                indent=2,
                default=str,
            )
        except Exception as e:
            return json.dumps({"error": str(e), "objects": [], "edges": []})


# ── Load Evidence Span (Stage 4: Drill-down) ──


@mcp.tool()
def load_evidence_span(
    source_table: str,
    source_id: str,
) -> str:
    """Load raw source material that a memory object was extracted from.

    Retrieves the original record from the JanumiCode database for evidence
    verification and drill-down.

    Args:
        source_table: The JanumiCode table (e.g., 'dialogue_events', 'claims', 'narrative_memories')
        source_id: The primary key value in the source table

    Returns:
        JSON object with the raw source record
    """
    # Allowlist of readable tables to prevent injection
    allowed_tables = {
        "dialogue_events": "event_id",
        "claims": "claim_id",
        "verdicts": "verdict_id",
        "human_decisions": "decision_id",
        "narrative_memories": "memory_id",
        "decision_traces": "trace_id",
        "open_loops": "loop_id",
        "gates": "gate_id",
        "handoff_documents": "doc_id",
    }

    if source_table not in allowed_tables:
        return json.dumps({"error": f"Table '{source_table}' not in allowlist: {list(allowed_tables.keys())}"})

    pk_column = allowed_tables[source_table]
    conn = _get_conn()
    with conn.session() as db:
        try:
            row = db.execute(
                f"SELECT * FROM {source_table} WHERE {pk_column} = ?",
                [source_id],
            ).fetchone()
            if row:
                return json.dumps(dict(row), indent=2, default=str)
            return json.dumps({"error": f"No record found in {source_table} with {pk_column}={source_id}"})
        except Exception as e:
            return json.dumps({"error": str(e)})


# ── Supersession Chain (Stage 5: Conflict Analysis) ──


@mcp.tool()
def get_supersession_chain(object_id: str) -> str:
    """Follow superseded_by links to build the full supersession chain.

    Returns the chain from the given object to the current governing version,
    or the full chain from oldest to newest if starting from a superseded object.

    Args:
        object_id: Starting memory object ID

    Returns:
        JSON array of objects in the chain, oldest to newest
    """
    from deep_memory_agent.db.graph import find_supersession_chain

    conn = _get_conn()
    with conn.session() as db:
        try:
            chain = find_supersession_chain(db, object_id)
            return json.dumps(chain, indent=2, default=str)
        except Exception as e:
            return json.dumps({"error": str(e), "chain": []})


# ── Conflict Set (Stage 5: Conflict Analysis) ──


@mcp.tool()
def get_conflict_set(object_id: str) -> str:
    """Find all objects that contradict a given memory object.

    Follows 'contradicts' edges in the memory graph to build the full
    conflict set for analysis.

    Args:
        object_id: The memory object to check for contradictions

    Returns:
        JSON object with the conflict set and edge evidence
    """
    from deep_memory_agent.db.graph import find_contradictions

    conn = _get_conn()
    with conn.session() as db:
        try:
            objects, edges = find_contradictions(db, object_id)
            return json.dumps(
                {"conflicts": objects, "edges": edges},
                indent=2,
                default=str,
            )
        except Exception as e:
            return json.dumps({"error": str(e), "conflicts": [], "edges": []})


# ── Temporal Query (Stage 2: Harvest) ──


@mcp.tool()
def temporal_query(
    dialogue_id: str | None = None,
    event_after: str | None = None,
    event_before: str | None = None,
    effective_at: str | None = None,
    object_types: list[str] | None = None,
    limit: int = 50,
) -> str:
    """Query memory objects using temporal filters.

    Supports bi-temporal queries: filter by when events happened (event_at)
    and when objects were effective (effective_from/effective_to).

    Args:
        dialogue_id: Filter to a specific dialogue
        event_after: Objects with event_at after this ISO timestamp
        event_before: Objects with event_at before this ISO timestamp
        effective_at: Objects that were effective at this point in time
        object_types: Filter by object types
        limit: Maximum results

    Returns:
        JSON array of matching objects
    """
    conn = _get_conn()
    with conn.session() as db:
        sql = "SELECT * FROM memory_objects WHERE 1=1"
        params: list = []

        if dialogue_id:
            sql += " AND dialogue_id = ?"
            params.append(dialogue_id)

        if object_types:
            placeholders = ",".join("?" for _ in object_types)
            sql += f" AND object_type IN ({placeholders})"
            params.extend(object_types)

        if event_after:
            sql += " AND event_at >= ?"
            params.append(event_after)

        if event_before:
            sql += " AND event_at <= ?"
            params.append(event_before)

        if effective_at:
            sql += " AND (effective_from IS NULL OR effective_from <= ?)"
            sql += " AND (effective_to IS NULL OR effective_to >= ?)"
            params.extend([effective_at, effective_at])

        # Exclude superseded objects by default
        sql += " AND superseded_by IS NULL"

        sql += " ORDER BY event_at DESC LIMIT ?"
        params.append(limit)

        try:
            rows = db.execute(sql, params).fetchall()
            return json.dumps([dict(row) for row in rows], indent=2, default=str)
        except Exception as e:
            return json.dumps({"error": str(e), "results": []})


def main() -> None:
    """Entry point for the MCP server (stdio transport)."""
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
