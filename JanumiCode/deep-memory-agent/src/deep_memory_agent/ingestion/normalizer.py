"""Normalize extracted memory objects — deduplication and ID stabilization.

The normalizer ensures that re-running ingestion on the same dialogue
produces the same object IDs (deterministic from source_table + source_id),
and skips objects that already exist in the memory_objects table.
"""

from __future__ import annotations

import sqlite3

from deep_memory_agent.models.base import BaseMemoryObject


def deduplicate_objects(
    conn: sqlite3.Connection,
    objects: list[BaseMemoryObject],
) -> list[BaseMemoryObject]:
    """Filter out objects that already exist in memory_objects (by object_id).

    Since object IDs are deterministic from source_table + source_id,
    this prevents duplicate insertion on re-extraction.
    """
    if not objects:
        return []

    existing_ids: set[str] = set()
    # Batch check in groups of 100
    for i in range(0, len(objects), 100):
        batch = objects[i : i + 100]
        placeholders = ",".join("?" for _ in batch)
        ids = [obj.object_id for obj in batch]
        rows = conn.execute(
            f"SELECT object_id FROM memory_objects WHERE object_id IN ({placeholders})",
            ids,
        ).fetchall()
        existing_ids.update(row["object_id"] for row in rows)

    return [obj for obj in objects if obj.object_id not in existing_ids]
