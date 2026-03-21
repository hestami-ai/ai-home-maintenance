"""SQLite connection manager for the Deep Memory Agent.

Supports two modes:
- Read-only (MCP server): opens with ?mode=ro URI to prevent accidental writes
- Read-write (ingestion CLI): full access for storing extracted memory objects
"""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Generator


class ConnectionManager:
    """Manages SQLite connections to the JanumiCode database."""

    def __init__(self, db_path: str | Path, *, read_only: bool = True) -> None:
        self._db_path = Path(db_path)
        self._read_only = read_only

        if not self._db_path.exists():
            raise FileNotFoundError(f"Database not found: {self._db_path}")

    @property
    def db_path(self) -> Path:
        return self._db_path

    @property
    def is_read_only(self) -> bool:
        return self._read_only

    def connect(self) -> sqlite3.Connection:
        """Open a new connection to the database."""
        if self._read_only:
            uri = f"file:{self._db_path}?mode=ro"
            conn = sqlite3.connect(uri, uri=True)
        else:
            conn = sqlite3.connect(str(self._db_path))

        # Return rows as sqlite3.Row for dict-like access
        conn.row_factory = sqlite3.Row
        # Enable WAL mode reading (non-blocking reads while JanumiCode writes)
        conn.execute("PRAGMA journal_mode=WAL")
        # Enable foreign keys
        conn.execute("PRAGMA foreign_keys=ON")

        return conn

    @contextmanager
    def session(self) -> Generator[sqlite3.Connection, None, None]:
        """Context manager that provides a connection and ensures cleanup."""
        conn = self.connect()
        try:
            yield conn
        finally:
            conn.close()

    def check_health(self) -> dict:
        """Verify database accessibility and return basic info."""
        try:
            with self.session() as conn:
                # Check we can read
                cursor = conn.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table'")
                table_count = cursor.fetchone()[0]

                # Check for JanumiCode-specific tables
                cursor = conn.execute(
                    "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='dialogues'"
                )
                has_dialogues = cursor.fetchone()[0] > 0

                # Check for memory agent tables
                cursor = conn.execute(
                    "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='memory_objects'"
                )
                has_memory_tables = cursor.fetchone()[0] > 0

                # Get schema version
                schema_version = None
                try:
                    cursor = conn.execute(
                        "SELECT value FROM schema_metadata WHERE key='schema_version'"
                    )
                    row = cursor.fetchone()
                    if row:
                        schema_version = row[0]
                except sqlite3.OperationalError:
                    pass

                return {
                    "status": "ok",
                    "db_path": str(self._db_path),
                    "read_only": self._read_only,
                    "table_count": table_count,
                    "has_dialogues": has_dialogues,
                    "has_memory_tables": has_memory_tables,
                    "schema_version": schema_version,
                }
        except Exception as e:
            return {
                "status": "error",
                "db_path": str(self._db_path),
                "error": str(e),
            }
