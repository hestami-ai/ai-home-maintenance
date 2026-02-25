"""
Dolt (Truth Store) client.

Provides an interface to the Dolt SQL database for versioned
truth state management.
"""

from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

import pymysql
import structlog
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from historian.config import DoltConfig, get_settings
from historian.models.artifacts import TruthContext, TruthContextEntry

logger = structlog.get_logger()


class DoltClient:
    """
    Client for Dolt versioned SQL database.

    Dolt is MySQL-compatible, so we use standard MySQL connectors.
    The key feature is its Git-like versioning of data.
    """

    def __init__(self, config: DoltConfig | None = None):
        self.config = config or get_settings().dolt
        self._engine = None
        self._session_factory = None

    async def initialize(self) -> None:
        """Initialize the database connection."""
        # Using aiomysql for async MySQL support
        # Note: Dolt repos don't use traditional MySQL database names
        # The repo directory itself becomes the database
        connection_url = (
            f"mysql+aiomysql://{self.config.user}:{self.config.password}"
            f"@{self.config.host}:{self.config.port}/"
        )
        self._engine = create_async_engine(
            connection_url,
            echo=False,
            pool_pre_ping=True,
            connect_args={
                "autocommit": True,
            },
        )
        self._session_factory = sessionmaker(
            self._engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )
        logger.info("dolt_initialized", host=self.config.host, database=self.config.database)

    async def close(self) -> None:
        """Close the database connection."""
        if self._engine:
            await self._engine.dispose()

    @asynccontextmanager
    async def session(self) -> AsyncIterator[AsyncSession]:
        """Get a database session."""
        if not self._session_factory:
            await self.initialize()
        async with self._session_factory() as session:
            yield session

    async def get_current_commit(self) -> str:
        """Get the current HEAD commit hash."""
        async with self.session() as session:
            result = await session.execute(text("SELECT COMMIT_HASH FROM dolt_log LIMIT 1"))
            row = result.fetchone()
            return row[0] if row else "unknown"

    async def get_spec_version(self) -> str:
        """Get the spec version from metadata."""
        async with self.session() as session:
            result = await session.execute(
                text("SELECT value FROM metadata WHERE key = 'spec_version'")
            )
            row = result.fetchone()
            return row[0] if row else "unknown"

    async def get_interpretations(self, section_id: str) -> list[TruthContextEntry]:
        """Get interpretations for a spec section."""
        entries = []
        async with self.session() as session:
            result = await session.execute(
                text("""
                    SELECT entry_type, text, reference
                    FROM interpretations
                    WHERE section_id = :section_id
                """),
                {"section_id": section_id},
            )
            for row in result.fetchall():
                entries.append(
                    TruthContextEntry(
                        entry_type=row[0],
                        text=row[1],
                        reference=row[2] or "",
                    )
                )
        return entries

    async def get_exceptions(self, requirement_id: str) -> list[TruthContextEntry]:
        """Get known exceptions for a requirement."""
        entries = []
        async with self.session() as session:
            result = await session.execute(
                text("""
                    SELECT 'exception' as entry_type, description as text, ruling_id as reference
                    FROM exceptions
                    WHERE requirement_id = :requirement_id
                    AND is_active = TRUE
                """),
                {"requirement_id": requirement_id},
            )
            for row in result.fetchall():
                entries.append(
                    TruthContextEntry(
                        entry_type=row[0],
                        text=row[1],
                        reference=row[2] or "",
                    )
                )
        return entries

    async def get_prior_rulings(self, topic: str) -> list[TruthContextEntry]:
        """Get prior rulings related to a topic."""
        entries = []
        async with self.session() as session:
            result = await session.execute(
                text("""
                    SELECT 'ruling' as entry_type, summary as text, ruling_id as reference
                    FROM rulings
                    WHERE topic LIKE :topic
                    ORDER BY created_at DESC
                    LIMIT 5
                """),
                {"topic": f"%{topic}%"},
            )
            for row in result.fetchall():
                entries.append(
                    TruthContextEntry(
                        entry_type=row[0],
                        text=row[1],
                        reference=row[2] or "",
                    )
                )
        return entries

    async def build_truth_context(self, section_ids: list[str]) -> TruthContext:
        """
        Build a complete TruthContext for the given sections.

        Args:
            section_ids: List of spec section IDs to look up

        Returns:
            TruthContext with all relevant entries
        """
        spec_version = await self.get_current_commit()
        context_map: dict[str, list[TruthContextEntry]] = {}

        for section_id in section_ids:
            entries = []
            entries.extend(await self.get_interpretations(section_id))
            entries.extend(await self.get_exceptions(section_id))
            if entries:
                context_map[section_id] = entries

        return TruthContext(spec_version=spec_version, context_map=context_map)

    async def health_check(self) -> bool:
        """Check if Dolt server is responsive and accepts authentication."""
        try:
            import asyncio

            def _mysql_check():
                # Use pymysql directly for health check
                conn = pymysql.connect(
                    host=self.config.host,
                    port=self.config.port,
                    user=self.config.user,
                    password=self.config.password or "",
                    database=self.config.database,
                    connect_timeout=5,
                )
                try:
                    with conn.cursor() as cursor:
                        cursor.execute("SELECT 1")
                        cursor.fetchone()
                    return True
                finally:
                    conn.close()

            # Run sync check in thread pool
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(None, _mysql_check)
        except Exception as e:
            logger.error("dolt_health_check_failed", error=str(e))
            return False
