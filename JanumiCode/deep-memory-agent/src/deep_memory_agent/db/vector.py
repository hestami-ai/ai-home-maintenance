"""sqlite-vector KNN search wrappers for the Deep Memory Agent.

Provides semantic similarity search over the embeddings table using
the same vector_distance() function that JanumiCode's embedding service uses.

Note: Vector search requires sqlite-vector extension to be loaded.
The MCP server degrades gracefully if vectors are unavailable — returns
empty results rather than failing.
"""

from __future__ import annotations

import sqlite3
from typing import Optional


def is_vector_available(conn: sqlite3.Connection) -> bool:
    """Check if sqlite-vector extension is loaded."""
    try:
        conn.execute("SELECT vector_distance(zeroblob(4), zeroblob(4))")
        return True
    except Exception:
        return False


def search_similar_embeddings(
    conn: sqlite3.Connection,
    query_embedding: bytes,
    source_types: Optional[list[str]] = None,
    dialogue_id: Optional[str] = None,
    limit: int = 20,
    min_score: float = 0.3,
) -> list[dict]:
    """Search embeddings table using vector_distance() KNN.

    Args:
        query_embedding: Binary embedding vector (Float32 array as bytes)
        source_types: Filter by source type (e.g., ['memory_object', 'claim'])
        dialogue_id: Filter to a specific dialogue
        limit: Maximum results
        min_score: Minimum similarity score (1 - distance)

    Returns:
        List of dicts with embedding_id, source_type, source_id, dialogue_id,
        content_text, and score.
    """
    if not is_vector_available(conn):
        return []

    conditions: list[str] = []
    params: list = [query_embedding]

    if source_types:
        placeholders = ",".join("?" for _ in source_types)
        conditions.append(f"e.source_type IN ({placeholders})")
        params.extend(source_types)

    if dialogue_id:
        conditions.append("e.dialogue_id = ?")
        params.append(dialogue_id)

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    params.append(limit * 2)  # Fetch extra to filter by min_score

    try:
        rows = conn.execute(
            f"""
            SELECT
                e.embedding_id,
                e.source_type,
                e.source_id,
                e.dialogue_id,
                e.content_text,
                vector_distance(e.embedding, ?) as distance
            FROM embeddings e
            {where_clause}
            ORDER BY distance ASC
            LIMIT ?
            """,
            params,
        ).fetchall()

        results = []
        for row in rows:
            score = 1.0 - row["distance"]
            if score >= min_score:
                results.append({
                    "embedding_id": row["embedding_id"],
                    "source_type": row["source_type"],
                    "source_id": row["source_id"],
                    "dialogue_id": row["dialogue_id"],
                    "content_text": row["content_text"],
                    "score": round(score, 4),
                })
        return results[:limit]
    except Exception:
        return []


def search_memory_object_embeddings(
    conn: sqlite3.Connection,
    query_embedding: bytes,
    dialogue_id: Optional[str] = None,
    limit: int = 20,
    min_score: float = 0.3,
) -> list[dict]:
    """Convenience wrapper: search only memory_object embeddings."""
    return search_similar_embeddings(
        conn,
        query_embedding,
        source_types=["memory_object"],
        dialogue_id=dialogue_id,
        limit=limit,
        min_score=min_score,
    )
