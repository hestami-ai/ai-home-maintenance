"""Memory graph relations — typed edges between memory objects."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Optional


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)

from pydantic import BaseModel, Field


class EdgeType(str, Enum):
    """Typed relation between two memory objects."""

    SUPPORTS = "supports"
    CONTRADICTS = "contradicts"
    SUPERSEDES = "supersedes"
    DERIVED_FROM = "derived_from"
    IMPLEMENTS = "implements"
    BLOCKED_BY = "blocked_by"
    ANSWERS = "answers"
    RAISES = "raises"
    INVALIDATES = "invalidates"
    DEPENDS_ON = "depends_on"


class MemoryEdge(BaseModel):
    """A typed, directional edge in the memory graph."""

    edge_id: str = Field(description="Stable unique identifier for this edge")
    edge_type: EdgeType = Field(description="The type of relation")
    from_object_id: str = Field(description="Source memory object ID")
    to_object_id: str = Field(description="Target memory object ID")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Confidence in this relation")
    evidence: Optional[str] = Field(default=None, description="Why this edge exists (JSON or text)")
    created_by: str = Field(description="Who created this edge: rule_engine, llm, or human")
    created_at: datetime = Field(default_factory=_utcnow)


class EvidenceLink(BaseModel):
    """A link from a derived object back to its supporting evidence."""

    source_object_id: str = Field(description="The evidence source")
    target_object_id: str = Field(description="The object that cites this evidence")
    relevance: Optional[str] = Field(default=None, description="Why this evidence matters")
    strength: float = Field(default=1.0, ge=0.0, le=1.0, description="How strongly this supports the target")


class SupersedesRelation(BaseModel):
    """Explicit supersession: a newer object replaces an older one."""

    newer_object_id: str = Field(description="The replacing object")
    older_object_id: str = Field(description="The replaced object")
    reason: str = Field(description="Why the old object was superseded")
    superseded_at: datetime = Field(default_factory=_utcnow)


class ContradictionRelation(BaseModel):
    """Two objects that contradict each other."""

    object_a_id: str = Field(description="First conflicting object")
    object_b_id: str = Field(description="Second conflicting object")
    explanation: str = Field(description="How they contradict")
    resolution: Optional[str] = Field(default=None, description="Current governing position, if resolved")
    resolved: bool = Field(default=False)
