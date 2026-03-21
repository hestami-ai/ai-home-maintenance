"""Provenance and citation spine — traceable derivation for every memory object."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)

from pydantic import BaseModel, Field


class ProvenanceCitation(BaseModel):
    """Links a derived memory object back to its exact source material.

    Without traceable derivation, the memory agent will hallucinate
    continuity across lossy summaries.
    """

    source_artifact_id: str = Field(description="ID of the source artifact (event, document, etc.)")
    source_table: str = Field(description="JanumiCode table containing the source")
    segment: Optional[str] = Field(default=None, description="Span/offset within source (e.g., 'turns 3-5')")
    is_inferred: bool = Field(default=False, description="True if this was inferred, not directly quoted")
    human_reviewed: bool = Field(default=False, description="Whether a human validated this citation")
    last_validated_at: Optional[datetime] = Field(default=None)


class ExtractionRun(BaseModel):
    """Audit trail for a batch of memory object extractions.

    Each ingestion invocation creates one ExtractionRun, allowing traceability
    from any memory object back to the process that created it.
    """

    run_id: str = Field(description="Unique run identifier")
    dialogue_id: str = Field(description="Dialogue being processed")
    mode: str = Field(description="incremental, full, or repair")
    model_id: str = Field(description="LLM model used for extraction")
    prompt_version: str = Field(description="Version of extraction prompts used")
    objects_created: int = Field(default=0, description="Number of memory objects created")
    edges_created: int = Field(default=0, description="Number of edges created")
    started_at: datetime = Field(default_factory=_utcnow)
    completed_at: Optional[datetime] = Field(default=None)
    status: str = Field(default="running", description="running, completed, or failed")
