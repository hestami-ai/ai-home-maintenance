"""CRUD operations for memory_objects, memory_edges, and memory_extraction_runs tables."""

from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Optional

from deep_memory_agent.models.base import BaseMemoryObject, ObjectType
from deep_memory_agent.models.relations import EdgeType, MemoryEdge


def _utcnow_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


def _new_id(prefix: str = "MO") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


# ── Memory Objects ──


def insert_memory_object(conn: sqlite3.Connection, obj: BaseMemoryObject) -> str:
    """Insert a memory object and return its object_id."""
    content_json = json.dumps(obj.content) if isinstance(obj.content, dict) else obj.content
    conn.execute(
        """INSERT INTO memory_objects (
            object_id, object_type, dialogue_id, workflow_id, domain, actor,
            content, confidence, authority_level, superseded_by, superseded_at,
            validation_status, extraction_method, extraction_run_id,
            recorded_at, event_at, effective_from, effective_to,
            source_table, source_id, source_segment, model_id, prompt_version,
            parent_object_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            obj.object_id,
            obj.object_type.value,
            obj.dialogue_id,
            obj.workflow_id,
            obj.domain,
            obj.actor,
            content_json,
            obj.confidence,
            obj.authority_level.value,
            obj.superseded_by,
            obj.superseded_at.isoformat() if obj.superseded_at else None,
            obj.validation_status.value,
            obj.extraction_method.value if obj.extraction_method else None,
            obj.extraction_run_id,
            obj.recorded_at.isoformat() if obj.recorded_at else _utcnow_iso(),
            obj.event_at.isoformat() if obj.event_at else None,
            obj.effective_from.isoformat() if obj.effective_from else None,
            obj.effective_to.isoformat() if obj.effective_to else None,
            obj.source_table,
            obj.source_id,
            obj.source_segment,
            obj.model_id,
            obj.prompt_version,
            obj.parent_object_id,
        ),
    )
    return obj.object_id


def get_memory_object(conn: sqlite3.Connection, object_id: str) -> Optional[dict]:
    """Retrieve a single memory object by ID."""
    row = conn.execute(
        "SELECT * FROM memory_objects WHERE object_id = ?", (object_id,)
    ).fetchone()
    return dict(row) if row else None


def get_memory_objects_by_dialogue(
    conn: sqlite3.Connection,
    dialogue_id: str,
    object_type: Optional[str] = None,
    include_superseded: bool = False,
) -> list[dict]:
    """Retrieve memory objects for a dialogue, optionally filtered by type."""
    sql = "SELECT * FROM memory_objects WHERE dialogue_id = ?"
    params: list = [dialogue_id]

    if object_type:
        sql += " AND object_type = ?"
        params.append(object_type)

    if not include_superseded:
        sql += " AND superseded_by IS NULL"

    sql += " ORDER BY recorded_at DESC"
    rows = conn.execute(sql, params).fetchall()
    return [dict(row) for row in rows]


def mark_superseded(
    conn: sqlite3.Connection,
    old_object_id: str,
    new_object_id: str,
) -> None:
    """Mark an object as superseded by another."""
    conn.execute(
        "UPDATE memory_objects SET superseded_by = ?, superseded_at = ? WHERE object_id = ?",
        (new_object_id, _utcnow_iso(), old_object_id),
    )


def count_memory_objects(conn: sqlite3.Connection, dialogue_id: str) -> int:
    """Count memory objects for a dialogue."""
    row = conn.execute(
        "SELECT COUNT(*) FROM memory_objects WHERE dialogue_id = ?", (dialogue_id,)
    ).fetchone()
    return row[0] if row else 0


# ── Memory Edges ──


def insert_memory_edge(conn: sqlite3.Connection, edge: MemoryEdge) -> str:
    """Insert a memory edge and return its edge_id."""
    conn.execute(
        """INSERT INTO memory_edges (
            edge_id, edge_type, from_object_id, to_object_id,
            confidence, evidence, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            edge.edge_id,
            edge.edge_type.value,
            edge.from_object_id,
            edge.to_object_id,
            edge.confidence,
            edge.evidence,
            edge.created_by,
            edge.created_at.isoformat() if edge.created_at else _utcnow_iso(),
        ),
    )
    return edge.edge_id


def get_edges_for_object(
    conn: sqlite3.Connection,
    object_id: str,
    edge_type: Optional[str] = None,
) -> list[dict]:
    """Get all edges connected to an object (as source or target)."""
    sql = "SELECT * FROM memory_edges WHERE from_object_id = ? OR to_object_id = ?"
    params: list = [object_id, object_id]

    if edge_type:
        sql += " AND edge_type = ?"
        params.append(edge_type)

    rows = conn.execute(sql, params).fetchall()
    return [dict(row) for row in rows]


def count_memory_edges(conn: sqlite3.Connection, dialogue_id: Optional[str] = None) -> int:
    """Count edges, optionally scoped to objects in a specific dialogue."""
    if dialogue_id:
        row = conn.execute(
            """SELECT COUNT(*) FROM memory_edges e
               JOIN memory_objects o ON e.from_object_id = o.object_id
               WHERE o.dialogue_id = ?""",
            (dialogue_id,),
        ).fetchone()
    else:
        row = conn.execute("SELECT COUNT(*) FROM memory_edges").fetchone()
    return row[0] if row else 0


# ── Extraction Runs ──


def start_extraction_run(
    conn: sqlite3.Connection,
    dialogue_id: str,
    mode: str,
    model_id: str,
    prompt_version: str,
) -> str:
    """Create a new extraction run record and return its run_id."""
    run_id = _new_id("RUN")
    conn.execute(
        """INSERT INTO memory_extraction_runs (
            run_id, dialogue_id, mode, model_id, prompt_version,
            started_at, status
        ) VALUES (?, ?, ?, ?, ?, ?, 'running')""",
        (run_id, dialogue_id, mode, model_id, prompt_version, _utcnow_iso()),
    )
    return run_id


def complete_extraction_run(
    conn: sqlite3.Connection,
    run_id: str,
    objects_created: int,
    edges_created: int,
    status: str = "completed",
) -> None:
    """Mark an extraction run as completed or failed."""
    conn.execute(
        """UPDATE memory_extraction_runs
           SET completed_at = ?, objects_created = ?, edges_created = ?, status = ?
           WHERE run_id = ?""",
        (_utcnow_iso(), objects_created, edges_created, status, run_id),
    )
