"""Ingestion CLI — deep-memory-ingest command.

Governed write operations for extracting typed memory objects from
JanumiCode's dialogue events, claims, and narrative artifacts.

Usage:
    deep-memory-ingest doctor --db-path /path/to/db.sqlite
    deep-memory-ingest ingest --db-path /path/to/db.sqlite --dialogue-id abc-123
    deep-memory-ingest maintenance --db-path /path/to/db.sqlite
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import typer

from deep_memory_agent.db.connection import ConnectionManager

app = typer.Typer(
    name="deep-memory-ingest",
    help="Deep Memory Agent — ingestion and maintenance CLI",
)


@app.command()
def doctor(
    db_path: str = typer.Option(..., help="Path to JanumiCode SQLite database"),
) -> None:
    """Check database connectivity and report status."""
    try:
        conn = ConnectionManager(db_path, read_only=True)
        health = conn.check_health()
        typer.echo(json.dumps(health, indent=2))
        if health["status"] == "ok":
            raise typer.Exit(0)
        else:
            raise typer.Exit(1)
    except FileNotFoundError as e:
        typer.echo(json.dumps({"status": "error", "error": str(e)}))
        raise typer.Exit(1)


@app.command()
def ingest(
    db_path: str = typer.Option(..., help="Path to JanumiCode SQLite database"),
    dialogue_id: str = typer.Option(..., help="Dialogue ID to ingest events from"),
    mode: str = typer.Option("incremental", help="Ingestion mode: incremental, full, or repair"),
) -> None:
    """Extract typed memory objects from dialogue events.

    Reads from dialogue_events, claims, narrative_memories, decision_traces,
    and open_loops. Produces memory_objects and memory_edges.

    Outputs NDJSON progress lines to stdout for governed stream visibility.
    """
    _emit_progress("started", f"Ingesting dialogue {dialogue_id} in {mode} mode")

    try:
        conn_mgr = ConnectionManager(db_path, read_only=False)
        health = conn_mgr.check_health()

        if health["status"] != "ok":
            _emit_progress("error", f"Database health check failed: {health.get('error', 'unknown')}")
            raise typer.Exit(1)

        if not health.get("has_memory_tables"):
            _emit_progress("error", "Memory tables not found — run schema migration V13 first")
            raise typer.Exit(1)

        from deep_memory_agent.db.memory_store import (
            complete_extraction_run,
            insert_memory_edge,
            insert_memory_object,
            start_extraction_run,
        )
        from deep_memory_agent.ingestion.edge_proposer import propose_edges
        from deep_memory_agent.ingestion.extractor import extract_all
        from deep_memory_agent.ingestion.normalizer import deduplicate_objects

        with conn_mgr.session() as conn:
            # 1. Start extraction run
            run_id = start_extraction_run(
                conn, dialogue_id, mode,
                model_id="rule_based",
                prompt_version="v1",
            )
            conn.commit()
            _emit_progress("running", f"Extraction run {run_id} started")

            # 2. Extract typed objects from all source tables
            _emit_progress("running", "Extracting memory objects from source tables")
            all_objects = extract_all(conn, dialogue_id, run_id)
            _emit_progress("running", f"Extracted {len(all_objects)} raw objects")

            # 3. Deduplicate (skip objects already in memory_objects)
            new_objects = deduplicate_objects(conn, all_objects)
            _emit_progress("running", f"{len(new_objects)} new objects after deduplication ({len(all_objects) - len(new_objects)} skipped)")

            # 4. Insert new objects
            for obj in new_objects:
                insert_memory_object(conn, obj)

            # 5. Propose edges between ALL objects (new + existing in this batch)
            _emit_progress("running", "Proposing edges between objects")
            edges = propose_edges(all_objects)
            _emit_progress("running", f"Proposed {len(edges)} edges")

            # 6. Insert edges (skip duplicates by catching UNIQUE violations)
            edges_inserted = 0
            for edge in edges:
                try:
                    insert_memory_edge(conn, edge)
                    edges_inserted += 1
                except Exception:
                    pass  # Duplicate edge — skip

            # 7. Complete extraction run
            complete_extraction_run(conn, run_id, len(new_objects), edges_inserted)
            conn.commit()

            _emit_progress("completed", (
                f"Ingestion complete for dialogue {dialogue_id}: "
                f"{len(new_objects)} objects, {edges_inserted} edges"
            ))

    except typer.Exit:
        raise
    except Exception as e:
        _emit_progress("error", str(e))
        raise typer.Exit(1)


@app.command()
def maintenance(
    db_path: str = typer.Option(..., help="Path to JanumiCode SQLite database"),
) -> None:
    """Run background maintenance tasks on the memory substrate.

    Tasks include:
    - Re-embedding stale objects
    - Detecting orphan objects with no edges
    - Deduplication / near-duplicate clustering
    - Supersession integrity checks
    """
    # TODO: Implement in Phase 5
    _emit_progress("started", "Running maintenance tasks")
    _emit_progress("completed", "Maintenance complete (no-op in Phase 1)")


def _emit_progress(status: str, message: str) -> None:
    """Emit NDJSON progress line for governed stream visibility."""
    line = json.dumps({"type": "progress", "status": status, "message": message})
    sys.stdout.write(line + "\n")
    sys.stdout.flush()


if __name__ == "__main__":
    app()
