"""
ID Existence Checker (Phase 1.3)

Validates that cited IDs actually exist in the corpus index.
Connects to the registry database to verify spec/decision references.
"""

import os
import re
from dataclasses import dataclass, field
from typing import Optional
import logging

logger = logging.getLogger(__name__)

# Database connection (lazy initialization)
_db_connection = None

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://hestami:hestami_dev@localhost:5433/historian_registry"
)


@dataclass
class IDCheckResult:
    """Result of checking a single ID"""
    id: str
    exists: bool
    source_type: str  # spec, decision, etc.
    match_type: str = "none"  # exact, partial, none
    matched_id: Optional[str] = None
    suggestion: Optional[str] = None


@dataclass
class IDValidationResult:
    """Result of validating all IDs in a response"""
    valid: bool
    checked_ids: list[IDCheckResult] = field(default_factory=list)
    missing_ids: list[str] = field(default_factory=list)
    db_available: bool = True


async def get_db_connection():
    """Get or create database connection."""
    global _db_connection
    if _db_connection is None:
        try:
            import asyncpg
            _db_connection = await asyncpg.connect(DATABASE_URL)
            logger.info("Connected to registry database")
        except Exception as e:
            logger.warning(f"Could not connect to registry database: {e}")
            return None
    return _db_connection


def extract_ids_from_response(response: dict) -> list[tuple[str, str]]:
    """
    Extract all IDs from an adjudication response.

    Returns list of (id, source_type) tuples.
    """
    ids: list[tuple[str, str]] = []

    # From evidence items
    for ev in response.get("evidence", []):
        if ev.get("id"):
            ids.append((ev["id"], ev.get("source", "spec")))

    # From supersession notes
    for note in response.get("supersession_notes", []):
        if note.get("old_id"):
            ids.append((note["old_id"], "decision"))
        if note.get("new_id"):
            ids.append((note["new_id"], "decision"))

    # Extract from comments and conflicts (inline citations)
    text = response.get("comments", "") + "\n".join(response.get("conflicts", []))

    # Pattern: [spec:ID] or [decision:ID]
    citation_pattern = r"\[(spec|guideline|decision|discussion):([^\]]+)\]"
    for match in re.finditer(citation_pattern, text, re.IGNORECASE):
        source = match.group(1).lower()
        cited_id = match.group(2).strip()
        ids.append((cited_id, source))

    return ids


async def check_spec_id(conn, spec_id: str) -> IDCheckResult:
    """Check if a spec ID exists in the database."""
    # Try exact match on stable_id
    row = await conn.fetchrow(
        "SELECT stable_id, doc_id, sec_id FROM spec_sections WHERE stable_id = $1",
        spec_id
    )
    if row:
        return IDCheckResult(
            id=spec_id,
            exists=True,
            source_type="spec",
            match_type="exact",
            matched_id=row["stable_id"],
        )

    # Try partial match on doc_id
    doc_id = spec_id.split("#")[0] if "#" in spec_id else spec_id
    rows = await conn.fetch(
        "SELECT stable_id FROM spec_sections WHERE doc_id = $1 LIMIT 5",
        doc_id
    )
    if rows:
        suggestions = [r["stable_id"] for r in rows]
        return IDCheckResult(
            id=spec_id,
            exists=False,
            source_type="spec",
            match_type="partial",
            suggestion=f"Did you mean: {', '.join(suggestions[:3])}?",
        )

    # No match
    return IDCheckResult(
        id=spec_id,
        exists=False,
        source_type="spec",
        match_type="none",
        suggestion="ID not found in corpus. Verify the document and section IDs.",
    )


async def check_decision_id(conn, decision_id: str) -> IDCheckResult:
    """Check if a decision ID exists in the database."""
    row = await conn.fetchrow(
        "SELECT decision_id, status FROM decision_traces WHERE decision_id = $1",
        decision_id
    )
    if row:
        status = row["status"]
        return IDCheckResult(
            id=decision_id,
            exists=True,
            source_type="decision",
            match_type="exact",
            matched_id=row["decision_id"],
            suggestion=f"Status: {status}" if status == "SUPERSEDED" else None,
        )

    # Try prefix match
    rows = await conn.fetch(
        "SELECT decision_id FROM decision_traces WHERE decision_id LIKE $1 LIMIT 3",
        f"{decision_id}%"
    )
    if rows:
        suggestions = [r["decision_id"] for r in rows]
        return IDCheckResult(
            id=decision_id,
            exists=False,
            source_type="decision",
            match_type="partial",
            suggestion=f"Similar: {', '.join(suggestions)}",
        )

    return IDCheckResult(
        id=decision_id,
        exists=False,
        source_type="decision",
        match_type="none",
        suggestion="Decision ID not found in ledger.",
    )


async def validate_ids(response: dict) -> IDValidationResult:
    """
    Validate all IDs in a response against the corpus index.

    Requires database connection to registry-db.
    """
    ids = extract_ids_from_response(response)

    if not ids:
        return IDValidationResult(valid=True, checked_ids=[], missing_ids=[])

    conn = await get_db_connection()
    if conn is None:
        # Can't validate without DB - return optimistic result
        logger.warning("ID validation skipped - database unavailable")
        return IDValidationResult(
            valid=True,
            checked_ids=[],
            missing_ids=[],
            db_available=False,
        )

    checked: list[IDCheckResult] = []
    missing: list[str] = []

    for id_value, source_type in ids:
        if source_type in ("spec", "guideline"):
            result = await check_spec_id(conn, id_value)
        elif source_type == "decision":
            result = await check_decision_id(conn, id_value)
        else:
            # Unknown source type - can't validate
            result = IDCheckResult(
                id=id_value,
                exists=True,  # Assume valid
                source_type=source_type,
                match_type="unknown",
                suggestion=f"Cannot validate '{source_type}' source type",
            )

        checked.append(result)
        if not result.exists:
            missing.append(id_value)

    return IDValidationResult(
        valid=len(missing) == 0,
        checked_ids=checked,
        missing_ids=missing,
        db_available=True,
    )


def validate_ids_sync(response: dict) -> IDValidationResult:
    """
    Synchronous wrapper for ID validation.

    For use in non-async contexts. Note: less efficient.
    """
    import asyncio

    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    return loop.run_until_complete(validate_ids(response))
