"""Memory graph traversal — edge walking, neighbor expansion, path finding.

Operates on the memory_edges table to explore relationships between
memory objects. Used by MCP tools for drill-down expansion (Stage 4)
and conflict analysis (Stage 5).
"""

from __future__ import annotations

import sqlite3
from typing import Optional


def get_neighbors(
    conn: sqlite3.Connection,
    object_id: str,
    edge_types: Optional[list[str]] = None,
    direction: str = "both",
) -> list[dict]:
    """Get immediate neighbors of an object via edges.

    Args:
        object_id: Center object
        edge_types: Filter by edge type (e.g., ['supports', 'contradicts'])
        direction: 'outgoing', 'incoming', or 'both'

    Returns:
        List of dicts with edge info and neighbor object_id
    """
    conditions = []
    params: list = []

    if direction in ("outgoing", "both"):
        conditions.append("from_object_id = ?")
        params.append(object_id)
    if direction in ("incoming", "both"):
        conditions.append("to_object_id = ?")
        params.append(object_id)

    where = " OR ".join(conditions)

    sql = f"SELECT * FROM memory_edges WHERE ({where})"
    if edge_types:
        placeholders = ",".join("?" for _ in edge_types)
        sql += f" AND edge_type IN ({placeholders})"
        params.extend(edge_types)

    rows = conn.execute(sql, params).fetchall()
    return [dict(row) for row in rows]


def expand_subgraph(
    conn: sqlite3.Connection,
    start_ids: list[str],
    edge_types: Optional[list[str]] = None,
    max_depth: int = 2,
) -> tuple[list[dict], list[dict]]:
    """BFS expansion from start objects to build a subgraph.

    Args:
        start_ids: Starting object IDs
        edge_types: Filter by edge types
        max_depth: Maximum hops (capped at 3)

    Returns:
        Tuple of (objects, edges) found in the subgraph
    """
    max_depth = min(max_depth, 3)
    visited_objects: set[str] = set()
    all_edges: list[dict] = []
    seen_edge_ids: set[str] = set()
    frontier = list(start_ids)

    for _ in range(max_depth):
        if not frontier:
            break

        next_frontier: list[str] = []
        for oid in frontier:
            if oid in visited_objects:
                continue
            visited_objects.add(oid)

            edges = get_neighbors(conn, oid, edge_types)
            for edge in edges:
                if edge["edge_id"] not in seen_edge_ids:
                    seen_edge_ids.add(edge["edge_id"])
                    all_edges.append(edge)

                # Discover new objects
                other = (
                    edge["to_object_id"]
                    if edge["from_object_id"] == oid
                    else edge["from_object_id"]
                )
                if other not in visited_objects:
                    next_frontier.append(other)

        frontier = next_frontier

    # Fetch all discovered objects
    objects: list[dict] = []
    if visited_objects:
        placeholders = ",".join("?" for _ in visited_objects)
        rows = conn.execute(
            f"SELECT * FROM memory_objects WHERE object_id IN ({placeholders})",
            list(visited_objects),
        ).fetchall()
        objects = [dict(row) for row in rows]

    return objects, all_edges


def find_supersession_chain(
    conn: sqlite3.Connection,
    object_id: str,
) -> list[dict]:
    """Follow superseded_by links to build the full chain from oldest to newest.

    Walks forward from the given object. If the given object is the newest,
    also walks backward to find older versions.
    """
    chain: list[dict] = []
    visited: set[str] = set()

    # Walk backward first: find the oldest ancestor
    current_id: Optional[str] = object_id
    ancestors: list[dict] = []

    # Find objects that this one supersedes (walk backward via edges)
    while current_id and current_id not in visited:
        visited.add(current_id)
        row = conn.execute(
            "SELECT * FROM memory_objects WHERE object_id = ?",
            (current_id,),
        ).fetchone()
        if not row:
            break
        ancestors.insert(0, dict(row))

        # Check if any object was superseded by this one
        predecessor = conn.execute(
            "SELECT object_id FROM memory_objects WHERE superseded_by = ?",
            (current_id,),
        ).fetchone()
        current_id = predecessor["object_id"] if predecessor else None

    chain.extend(ancestors)

    # Walk forward: follow superseded_by links
    current_id = object_id
    visited_forward: set[str] = set()
    while current_id and current_id not in visited_forward:
        visited_forward.add(current_id)
        row = conn.execute(
            "SELECT * FROM memory_objects WHERE object_id = ?",
            (current_id,),
        ).fetchone()
        if not row:
            break
        obj = dict(row)
        if obj["object_id"] not in {o["object_id"] for o in chain}:
            chain.append(obj)
        current_id = obj.get("superseded_by")

    return chain


def find_contradictions(
    conn: sqlite3.Connection,
    object_id: str,
) -> tuple[list[dict], list[dict]]:
    """Find all objects that contradict a given object.

    Returns (conflicting_objects, contradiction_edges).
    """
    edges = conn.execute(
        """SELECT * FROM memory_edges
           WHERE edge_type = 'contradicts'
           AND (from_object_id = ? OR to_object_id = ?)""",
        (object_id, object_id),
    ).fetchall()

    contradiction_edges = [dict(e) for e in edges]

    # Collect all involved object IDs
    object_ids: set[str] = set()
    for edge in contradiction_edges:
        object_ids.add(edge["from_object_id"])
        object_ids.add(edge["to_object_id"])

    objects: list[dict] = []
    if object_ids:
        placeholders = ",".join("?" for _ in object_ids)
        rows = conn.execute(
            f"SELECT * FROM memory_objects WHERE object_id IN ({placeholders})",
            list(object_ids),
        ).fetchall()
        objects = [dict(row) for row in rows]

    return objects, contradiction_edges


def get_objects_by_ids(
    conn: sqlite3.Connection,
    object_ids: list[str],
) -> list[dict]:
    """Fetch multiple memory objects by their IDs."""
    if not object_ids:
        return []
    placeholders = ",".join("?" for _ in object_ids)
    rows = conn.execute(
        f"SELECT * FROM memory_objects WHERE object_id IN ({placeholders})",
        object_ids,
    ).fetchall()
    return [dict(row) for row in rows]
