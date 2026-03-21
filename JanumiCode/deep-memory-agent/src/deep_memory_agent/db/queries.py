"""Parameterized queries for reading existing JanumiCode tables.

These queries retrieve raw source data that the ingestion pipeline
transforms into typed memory objects and edges.
"""

from __future__ import annotations

import sqlite3
from typing import Optional


def get_dialogue_events(
    conn: sqlite3.Connection,
    dialogue_id: str,
    event_types: Optional[list[str]] = None,
    since_event_id: Optional[str] = None,
    limit: int = 500,
) -> list[dict]:
    """Retrieve dialogue events, optionally filtered by type and watermark."""
    sql = "SELECT * FROM dialogue_events WHERE dialogue_id = ?"
    params: list = [dialogue_id]

    if event_types:
        placeholders = ",".join("?" for _ in event_types)
        sql += f" AND event_type IN ({placeholders})"
        params.extend(event_types)

    if since_event_id:
        sql += " AND event_id > ?"
        params.append(since_event_id)

    sql += " ORDER BY created_at ASC LIMIT ?"
    params.append(limit)

    return [dict(row) for row in conn.execute(sql, params).fetchall()]


def get_claims(
    conn: sqlite3.Connection,
    dialogue_id: str,
    status: Optional[str] = None,
) -> list[dict]:
    """Retrieve claims for a dialogue."""
    sql = "SELECT * FROM claims WHERE dialogue_id = ?"
    params: list = [dialogue_id]

    if status:
        sql += " AND status = ?"
        params.append(status)

    sql += " ORDER BY created_at ASC"
    return [dict(row) for row in conn.execute(sql, params).fetchall()]


def get_verdicts(
    conn: sqlite3.Connection,
    dialogue_id: str,
) -> list[dict]:
    """Retrieve verdicts joined with their claims for a dialogue."""
    sql = """
        SELECT v.*, c.claim_text, c.status as claim_status, c.criticality
        FROM verdicts v
        JOIN claims c ON v.claim_id = c.claim_id
        WHERE c.dialogue_id = ?
        ORDER BY v.created_at ASC
    """
    return [dict(row) for row in conn.execute(sql, [dialogue_id]).fetchall()]


def get_human_decisions(
    conn: sqlite3.Connection,
    dialogue_id: str,
) -> list[dict]:
    """Retrieve human decisions joined with their gates for a dialogue."""
    sql = """
        SELECT hd.*, g.gate_type, g.description as gate_description
        FROM human_decisions hd
        JOIN gates g ON hd.gate_id = g.gate_id
        WHERE g.dialogue_id = ?
        ORDER BY hd.created_at ASC
    """
    return [dict(row) for row in conn.execute(sql, [dialogue_id]).fetchall()]


def get_narrative_memories(
    conn: sqlite3.Connection,
    dialogue_id: str,
) -> list[dict]:
    """Retrieve narrative memories for a dialogue."""
    sql = "SELECT * FROM narrative_memories WHERE dialogue_id = ? ORDER BY created_at ASC"
    return [dict(row) for row in conn.execute(sql, [dialogue_id]).fetchall()]


def get_decision_traces(
    conn: sqlite3.Connection,
    dialogue_id: str,
) -> list[dict]:
    """Retrieve decision traces for a dialogue."""
    sql = "SELECT * FROM decision_traces WHERE dialogue_id = ? ORDER BY created_at ASC"
    return [dict(row) for row in conn.execute(sql, [dialogue_id]).fetchall()]


def get_open_loops(
    conn: sqlite3.Connection,
    dialogue_id: str,
) -> list[dict]:
    """Retrieve open loops for a dialogue."""
    sql = "SELECT * FROM open_loops WHERE dialogue_id = ? ORDER BY created_at ASC"
    return [dict(row) for row in conn.execute(sql, [dialogue_id]).fetchall()]


def get_gates(
    conn: sqlite3.Connection,
    dialogue_id: str,
) -> list[dict]:
    """Retrieve gates for a dialogue."""
    sql = "SELECT * FROM gates WHERE dialogue_id = ? ORDER BY created_at ASC"
    return [dict(row) for row in conn.execute(sql, [dialogue_id]).fetchall()]


def get_last_extraction_watermark(
    conn: sqlite3.Connection,
    dialogue_id: str,
) -> Optional[str]:
    """Get the event_id watermark from the most recent completed extraction run.

    Returns None if no prior extraction exists (meaning full extraction needed).
    """
    try:
        row = conn.execute(
            """SELECT MAX(mo.source_id) as last_source_id
               FROM memory_objects mo
               WHERE mo.dialogue_id = ? AND mo.source_table = 'dialogue_events'""",
            (dialogue_id,),
        ).fetchone()
        return row["last_source_id"] if row and row["last_source_id"] else None
    except Exception:
        return None
