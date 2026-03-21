"""Extract typed memory objects from JanumiCode's existing tables.

Maps raw dialogue_events, claims, narrative_memories, decision_traces,
open_loops, human_decisions, and verdicts into canonical BaseMemoryObject
instances for storage in the memory_objects table.
"""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from typing import Optional

from deep_memory_agent.db import queries
from deep_memory_agent.models.authority import AuthorityLevel
from deep_memory_agent.models.base import (
    BaseMemoryObject,
    ExtractionMethod,
    ObjectType,
    ValidationStatus,
)


def _new_id(prefix: str, source_id: str) -> str:
    """Deterministic object ID from source — prevents duplicates on re-extraction."""
    return f"{prefix}-{source_id}"


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


def _parse_json_safe(text: Optional[str]) -> dict:
    """Parse JSON string, returning empty dict on failure."""
    if not text:
        return {}
    try:
        result = json.loads(text)
        return result if isinstance(result, dict) else {"value": result}
    except (json.JSONDecodeError, TypeError):
        return {"raw": text}


def extract_from_claims(
    conn: sqlite3.Connection,
    dialogue_id: str,
    run_id: str,
) -> list[BaseMemoryObject]:
    """Extract claim memory objects from the claims table."""
    rows = queries.get_claims(conn, dialogue_id)
    objects = []

    for row in rows:
        obj = BaseMemoryObject(
            object_id=_new_id("CLM", row["claim_id"]),
            object_type=ObjectType.CLAIM,
            dialogue_id=dialogue_id,
            actor=row.get("introduced_by", "unknown"),
            content={
                "claim_text": row.get("claim_text", ""),
                "status": row.get("status", "open"),
                "criticality": row.get("criticality"),
            },
            confidence=1.0,
            authority_level=AuthorityLevel.AGENT_INFERENCE,
            validation_status=ValidationStatus.VALIDATED if row.get("status") == "VERIFIED" else ValidationStatus.PENDING,
            extraction_method=ExtractionMethod.RULE_BASED,
            extraction_run_id=run_id,
            recorded_at=_utcnow(),
            event_at=_parse_datetime(row.get("created_at")),
            source_table="claims",
            source_id=row["claim_id"],
        )
        objects.append(obj)

    return objects


def extract_from_human_decisions(
    conn: sqlite3.Connection,
    dialogue_id: str,
    run_id: str,
) -> list[BaseMemoryObject]:
    """Extract decision memory objects from human_decisions (joined with gates)."""
    rows = queries.get_human_decisions(conn, dialogue_id)
    objects = []

    for row in rows:
        action = row.get("action", "")
        obj = BaseMemoryObject(
            object_id=_new_id("HDC", row["decision_id"]),
            object_type=ObjectType.DECISION_TRACE,
            dialogue_id=dialogue_id,
            actor="user",
            content={
                "decision_statement": f"Human {action}: {row.get('gate_description', '')}",
                "action": action,
                "rationale": row.get("rationale", ""),
                "gate_type": row.get("gate_type", ""),
            },
            confidence=1.0,
            authority_level=AuthorityLevel.HUMAN_VALIDATED,
            validation_status=ValidationStatus.VALIDATED,
            extraction_method=ExtractionMethod.RULE_BASED,
            extraction_run_id=run_id,
            recorded_at=_utcnow(),
            event_at=_parse_datetime(row.get("created_at")),
            source_table="human_decisions",
            source_id=row["decision_id"],
        )
        objects.append(obj)

    return objects


def extract_from_narrative_memories(
    conn: sqlite3.Connection,
    dialogue_id: str,
    run_id: str,
) -> list[BaseMemoryObject]:
    """Extract narrative summary objects from narrative_memories."""
    rows = queries.get_narrative_memories(conn, dialogue_id)
    objects = []

    for row in rows:
        obj = BaseMemoryObject(
            object_id=_new_id("NAR", row["memory_id"]),
            object_type=ObjectType.NARRATIVE_SUMMARY,
            dialogue_id=dialogue_id,
            actor="narrative_curator",
            content={
                "summary": row.get("content", ""),
                "curation_mode": row.get("curation_mode"),
                "topic": row.get("topic"),
            },
            confidence=0.8,
            authority_level=AuthorityLevel.ACCEPTED_ARTIFACT,
            validation_status=ValidationStatus.VALIDATED,
            extraction_method=ExtractionMethod.RULE_BASED,
            extraction_run_id=run_id,
            recorded_at=_utcnow(),
            event_at=_parse_datetime(row.get("created_at")),
            source_table="narrative_memories",
            source_id=row["memory_id"],
        )
        objects.append(obj)

    return objects


def extract_from_decision_traces(
    conn: sqlite3.Connection,
    dialogue_id: str,
    run_id: str,
) -> list[BaseMemoryObject]:
    """Extract decision trace objects from decision_traces."""
    rows = queries.get_decision_traces(conn, dialogue_id)
    objects = []

    for row in rows:
        content = _parse_json_safe(row.get("content"))
        obj = BaseMemoryObject(
            object_id=_new_id("DTC", row["trace_id"]),
            object_type=ObjectType.DECISION_TRACE,
            dialogue_id=dialogue_id,
            actor="narrative_curator",
            content=content if content else {"decision_statement": row.get("content", "")},
            confidence=0.85,
            authority_level=AuthorityLevel.ACCEPTED_ARTIFACT,
            validation_status=ValidationStatus.VALIDATED,
            extraction_method=ExtractionMethod.RULE_BASED,
            extraction_run_id=run_id,
            recorded_at=_utcnow(),
            event_at=_parse_datetime(row.get("created_at")),
            source_table="decision_traces",
            source_id=row["trace_id"],
        )
        objects.append(obj)

    return objects


def extract_from_open_loops(
    conn: sqlite3.Connection,
    dialogue_id: str,
    run_id: str,
) -> list[BaseMemoryObject]:
    """Extract open question objects from open_loops."""
    rows = queries.get_open_loops(conn, dialogue_id)
    objects = []

    for row in rows:
        obj = BaseMemoryObject(
            object_id=_new_id("OQL", row["loop_id"]),
            object_type=ObjectType.OPEN_QUESTION,
            dialogue_id=dialogue_id,
            actor="narrative_curator",
            content={
                "question": row.get("content", ""),
                "context": row.get("context"),
                "priority": row.get("priority"),
            },
            confidence=0.7,
            authority_level=AuthorityLevel.AGENT_INFERENCE,
            validation_status=ValidationStatus.PENDING,
            extraction_method=ExtractionMethod.RULE_BASED,
            extraction_run_id=run_id,
            recorded_at=_utcnow(),
            event_at=_parse_datetime(row.get("created_at")),
            source_table="open_loops",
            source_id=row["loop_id"],
        )
        objects.append(obj)

    return objects


def extract_from_verdicts(
    conn: sqlite3.Connection,
    dialogue_id: str,
    run_id: str,
) -> list[BaseMemoryObject]:
    """Extract verdict-derived constraint/correction objects from verdicts."""
    rows = queries.get_verdicts(conn, dialogue_id)
    objects = []

    for row in rows:
        verdict_type = row.get("verdict", "")
        # DISPROVED verdicts become corrections
        if verdict_type == "DISPROVED":
            obj_type = ObjectType.CORRECTION
            content = {
                "correction_text": f"Claim disproved: {row.get('claim_text', '')}",
                "original_claim_id": row.get("claim_id"),
                "reason": row.get("rationale", ""),
            }
        else:
            # VERIFIED/CONDITIONAL verdicts reinforce claims as constraints
            obj_type = ObjectType.CLAIM
            content = {
                "claim_text": row.get("claim_text", ""),
                "verdict": verdict_type,
                "rationale": row.get("rationale", ""),
            }

        obj = BaseMemoryObject(
            object_id=_new_id("VRD", row["verdict_id"]),
            object_type=obj_type,
            dialogue_id=dialogue_id,
            actor="verifier",
            content=content,
            confidence=0.9,
            authority_level=AuthorityLevel.TEST_EVIDENCE,
            validation_status=ValidationStatus.VALIDATED,
            extraction_method=ExtractionMethod.RULE_BASED,
            extraction_run_id=run_id,
            recorded_at=_utcnow(),
            event_at=_parse_datetime(row.get("created_at")),
            source_table="verdicts",
            source_id=row["verdict_id"],
        )
        objects.append(obj)

    return objects


def extract_all(
    conn: sqlite3.Connection,
    dialogue_id: str,
    run_id: str,
) -> list[BaseMemoryObject]:
    """Run all extractors and return the combined list of memory objects."""
    all_objects: list[BaseMemoryObject] = []
    all_objects.extend(extract_from_claims(conn, dialogue_id, run_id))
    all_objects.extend(extract_from_human_decisions(conn, dialogue_id, run_id))
    all_objects.extend(extract_from_narrative_memories(conn, dialogue_id, run_id))
    all_objects.extend(extract_from_decision_traces(conn, dialogue_id, run_id))
    all_objects.extend(extract_from_open_loops(conn, dialogue_id, run_id))
    all_objects.extend(extract_from_verdicts(conn, dialogue_id, run_id))
    return all_objects


def _parse_datetime(value: Optional[str]) -> Optional[datetime]:
    """Parse an ISO datetime string, returning None on failure."""
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (ValueError, AttributeError):
        return None
