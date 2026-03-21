"""Test fixture — creates an in-memory SQLite database with JanumiCode schema + sample data."""

from __future__ import annotations

import sqlite3
import uuid
from datetime import datetime, timezone


def _utcnow_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


def _uuid() -> str:
    return str(uuid.uuid4())


DIALOGUE_ID = "d0000000-0000-0000-0000-000000000001"


def create_sample_db() -> sqlite3.Connection:
    """Create an in-memory SQLite database with JanumiCode-like schema and sample data.

    Returns a connection with row_factory set to sqlite3.Row.
    """
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")

    # Create minimal JanumiCode schema (just the tables we read from)
    conn.executescript("""
        CREATE TABLE dialogues (
            dialogue_id TEXT PRIMARY KEY,
            status TEXT NOT NULL DEFAULT 'ACTIVE',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE schema_metadata (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '13');

        CREATE TABLE dialogue_events (
            event_id TEXT PRIMARY KEY,
            dialogue_id TEXT NOT NULL,
            event_type TEXT NOT NULL,
            role TEXT,
            phase TEXT,
            detail TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (dialogue_id) REFERENCES dialogues(dialogue_id)
        );

        CREATE TABLE claims (
            claim_id TEXT PRIMARY KEY,
            dialogue_id TEXT NOT NULL,
            turn_id TEXT,
            claim_text TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'OPEN',
            criticality TEXT DEFAULT 'medium',
            introduced_by TEXT DEFAULT 'technical_expert',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (dialogue_id) REFERENCES dialogues(dialogue_id)
        );

        CREATE TABLE verdicts (
            verdict_id TEXT PRIMARY KEY,
            claim_id TEXT NOT NULL,
            verdict TEXT NOT NULL,
            rationale TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (claim_id) REFERENCES claims(claim_id)
        );

        CREATE TABLE gates (
            gate_id TEXT PRIMARY KEY,
            dialogue_id TEXT NOT NULL,
            gate_type TEXT NOT NULL DEFAULT 'approval',
            description TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (dialogue_id) REFERENCES dialogues(dialogue_id)
        );

        CREATE TABLE human_decisions (
            decision_id TEXT PRIMARY KEY,
            gate_id TEXT NOT NULL,
            action TEXT NOT NULL,
            rationale TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (gate_id) REFERENCES gates(gate_id)
        );

        CREATE TABLE narrative_memories (
            memory_id TEXT PRIMARY KEY,
            dialogue_id TEXT NOT NULL,
            content TEXT NOT NULL,
            topic TEXT,
            curation_mode TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (dialogue_id) REFERENCES dialogues(dialogue_id)
        );

        CREATE TABLE decision_traces (
            trace_id TEXT PRIMARY KEY,
            dialogue_id TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (dialogue_id) REFERENCES dialogues(dialogue_id)
        );

        CREATE TABLE open_loops (
            loop_id TEXT PRIMARY KEY,
            dialogue_id TEXT NOT NULL,
            content TEXT NOT NULL,
            context TEXT,
            priority TEXT DEFAULT 'medium',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (dialogue_id) REFERENCES dialogues(dialogue_id)
        );

        -- FTS5 virtual table (JanumiCode governed stream)
        CREATE VIRTUAL TABLE IF NOT EXISTS fts_stream_content USING fts5(
            content,
            source_table UNINDEXED,
            source_id UNINDEXED,
            dialogue_id UNINDEXED,
            tokenize = 'porter unicode61'
        );

        -- Memory Agent tables (V13)
        CREATE TABLE memory_objects (
            object_id TEXT PRIMARY KEY,
            object_type TEXT NOT NULL,
            dialogue_id TEXT NOT NULL,
            workflow_id TEXT,
            domain TEXT,
            actor TEXT NOT NULL,
            content TEXT NOT NULL,
            confidence REAL NOT NULL DEFAULT 1.0,
            authority_level TEXT NOT NULL DEFAULT 'agent_inference',
            superseded_by TEXT,
            superseded_at TEXT,
            validation_status TEXT DEFAULT 'pending',
            extraction_method TEXT,
            extraction_run_id TEXT,
            recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
            event_at TEXT,
            effective_from TEXT,
            effective_to TEXT,
            source_table TEXT,
            source_id TEXT,
            source_segment TEXT,
            model_id TEXT,
            prompt_version TEXT,
            parent_object_id TEXT,
            FOREIGN KEY (dialogue_id) REFERENCES dialogues(dialogue_id)
        );

        CREATE TABLE memory_edges (
            edge_id TEXT PRIMARY KEY,
            edge_type TEXT NOT NULL,
            from_object_id TEXT NOT NULL,
            to_object_id TEXT NOT NULL,
            confidence REAL NOT NULL DEFAULT 1.0,
            evidence TEXT,
            created_by TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (from_object_id) REFERENCES memory_objects(object_id),
            FOREIGN KEY (to_object_id) REFERENCES memory_objects(object_id)
        );

        CREATE TABLE memory_extraction_runs (
            run_id TEXT PRIMARY KEY,
            dialogue_id TEXT NOT NULL,
            mode TEXT NOT NULL,
            model_id TEXT NOT NULL,
            prompt_version TEXT NOT NULL,
            objects_created INTEGER NOT NULL DEFAULT 0,
            edges_created INTEGER NOT NULL DEFAULT 0,
            started_at TEXT NOT NULL DEFAULT (datetime('now')),
            completed_at TEXT,
            status TEXT NOT NULL DEFAULT 'running'
        );
    """)

    now = _utcnow_iso()

    # Insert sample dialogue
    conn.execute(
        "INSERT INTO dialogues (dialogue_id, status, created_at) VALUES (?, 'ACTIVE', ?)",
        (DIALOGUE_ID, now),
    )

    # Insert sample claims
    claim_ids = []
    for i, (text, status) in enumerate([
        ("The system supports REST APIs", "VERIFIED"),
        ("Authentication uses JWT tokens", "OPEN"),
        ("Database uses PostgreSQL", "DISPROVED"),
    ]):
        cid = f"CLM-{_uuid()[:8]}"
        claim_ids.append(cid)
        conn.execute(
            "INSERT INTO claims (claim_id, dialogue_id, claim_text, status, criticality, introduced_by, created_at) "
            "VALUES (?, ?, ?, ?, 'high', 'technical_expert', ?)",
            (cid, DIALOGUE_ID, text, status, now),
        )

    # Insert sample verdicts
    for i, (claim_id, verdict) in enumerate([
        (claim_ids[0], "VERIFIED"),
        (claim_ids[2], "DISPROVED"),
    ]):
        conn.execute(
            "INSERT INTO verdicts (verdict_id, claim_id, verdict, rationale, created_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (f"VRD-{_uuid()[:8]}", claim_id, verdict, f"Test rationale for {verdict}", now),
        )

    # Insert sample gate + human decision
    gate_id = f"GT-{_uuid()[:8]}"
    conn.execute(
        "INSERT INTO gates (gate_id, dialogue_id, gate_type, description, status, created_at) "
        "VALUES (?, ?, 'approval', 'Approve architecture design', 'resolved', ?)",
        (gate_id, DIALOGUE_ID, now),
    )
    conn.execute(
        "INSERT INTO human_decisions (decision_id, gate_id, action, rationale, created_at) "
        "VALUES (?, ?, 'APPROVE', 'Looks good to proceed', ?)",
        (f"HD-{_uuid()[:8]}", gate_id, now),
    )

    # Insert sample narrative memory
    conn.execute(
        "INSERT INTO narrative_memories (memory_id, dialogue_id, content, topic, curation_mode, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (f"NM-{_uuid()[:8]}", DIALOGUE_ID, "The team decided to use REST APIs for the backend.", "API Design", "INTENT", now),
    )

    # Insert sample decision trace
    conn.execute(
        "INSERT INTO decision_traces (trace_id, dialogue_id, content, created_at) "
        'VALUES (?, ?, ?, ?)',
        (f"DT-{_uuid()[:8]}", DIALOGUE_ID, '{"decision_statement": "Use REST over GraphQL", "rationale": ["Simpler client integration"]}', now),
    )

    # Insert sample open loop
    conn.execute(
        "INSERT INTO open_loops (loop_id, dialogue_id, content, context, priority, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (f"OL-{_uuid()[:8]}", DIALOGUE_ID, "Should we add WebSocket support?", "Real-time features", "medium", now),
    )

    conn.commit()
    return conn
