"""FTS5 full-text search wrappers for the Deep Memory Agent.

Searches two FTS sources:
1. fts_stream_content — JanumiCode's governed stream FTS index
2. memory_objects.content — JSON content field (searched via LIKE fallback
   when FTS index on memory_objects is not available)
"""

from __future__ import annotations

import json
import sqlite3
from typing import Optional


def search_fts_stream(
    conn: sqlite3.Connection,
    query: str,
    dialogue_id: Optional[str] = None,
    limit: int = 50,
) -> list[dict]:
    """Search JanumiCode's fts_stream_content FTS5 index.

    Returns rows with source_table, source_id, content, and BM25 rank.
    """
    try:
        # FTS5 MATCH query with BM25 ranking
        sql = """
            SELECT
                source_table,
                source_id,
                dialogue_id,
                snippet(fts_stream_content, 0, '>>>', '<<<', '...', 64) as snippet,
                rank
            FROM fts_stream_content
            WHERE fts_stream_content MATCH ?
        """
        params: list = [_sanitize_fts_query(query)]

        if dialogue_id:
            sql += " AND dialogue_id = ?"
            params.append(dialogue_id)

        sql += " ORDER BY rank LIMIT ?"
        params.append(limit)

        rows = conn.execute(sql, params).fetchall()
        return [dict(row) for row in rows]
    except Exception:
        # FTS table may not exist or query may be malformed
        return []


def search_memory_objects_text(
    conn: sqlite3.Connection,
    query: str,
    dialogue_id: Optional[str] = None,
    object_types: Optional[list[str]] = None,
    limit: int = 50,
) -> list[dict]:
    """Search memory_objects content field using LIKE (fallback when no FTS index).

    Splits query into keywords and matches any containing keyword.
    """
    keywords = [kw.strip() for kw in query.split() if len(kw.strip()) >= 3]
    if not keywords:
        return []

    conditions = ["1=1"]
    params: list = []

    if dialogue_id:
        conditions.append("dialogue_id = ?")
        params.append(dialogue_id)

    if object_types:
        placeholders = ",".join("?" for _ in object_types)
        conditions.append(f"object_type IN ({placeholders})")
        params.extend(object_types)

    # Match any keyword in content
    keyword_conditions = []
    for kw in keywords[:10]:  # Cap at 10 keywords
        keyword_conditions.append("content LIKE ?")
        params.append(f"%{kw}%")

    if keyword_conditions:
        conditions.append(f"({' OR '.join(keyword_conditions)})")

    # Exclude superseded
    conditions.append("superseded_by IS NULL")

    sql = f"""
        SELECT object_id, object_type, dialogue_id, content,
               confidence, authority_level, recorded_at, event_at
        FROM memory_objects
        WHERE {' AND '.join(conditions)}
        ORDER BY recorded_at DESC
        LIMIT ?
    """
    params.append(limit)

    try:
        rows = conn.execute(sql, params).fetchall()
        return [dict(row) for row in rows]
    except Exception:
        return []


def search_combined(
    conn: sqlite3.Connection,
    query: str,
    dialogue_id: Optional[str] = None,
    object_types: Optional[list[str]] = None,
    limit: int = 50,
) -> list[dict]:
    """Search both FTS stream and memory objects, merge and deduplicate results.

    Returns a combined list with source information.
    """
    results: list[dict] = []
    seen_ids: set[str] = set()

    # 1. Search FTS stream content
    fts_hits = search_fts_stream(conn, query, dialogue_id, limit)
    for hit in fts_hits:
        key = f"{hit.get('source_table')}:{hit.get('source_id')}"
        if key not in seen_ids:
            seen_ids.add(key)
            hit["search_source"] = "fts_stream"
            results.append(hit)

    # 2. Search memory objects
    mo_hits = search_memory_objects_text(conn, query, dialogue_id, object_types, limit)
    for hit in mo_hits:
        key = hit.get("object_id", "")
        if key not in seen_ids:
            seen_ids.add(key)
            hit["search_source"] = "memory_objects"
            results.append(hit)

    return results[:limit]


def _sanitize_fts_query(query: str) -> str:
    """Sanitize a query string for FTS5 MATCH syntax.

    Wraps individual words in quotes to prevent FTS5 syntax errors
    from special characters.
    """
    # Split into words, quote each, join with OR
    words = [w.strip() for w in query.split() if w.strip()]
    if not words:
        return '""'
    # Use simple word matching — each word quoted to prevent syntax errors
    return " OR ".join(f'"{w}"' for w in words[:20])
