"""Context Packet — the structured output contract for downstream agents.

The ContextPacket is the primary deliverable of the Deep Memory Research Agent.
It provides decision-relevant context with evidence, conflict handling, and
coverage assessment — not a blob of text.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)

from pydantic import BaseModel, Field

from deep_memory_agent.models.authority import AuthorityLevel


class MaterialMemory(BaseModel):
    """A memory object deemed materially relevant to the current question."""

    object_id: str
    object_type: str
    relevance_score: float = Field(ge=0.0, le=1.0, description="Composite relevance score")
    why_relevant: str = Field(description="Explanation of why this memory matters")
    authority_level: AuthorityLevel
    is_superseded: bool = Field(default=False)
    content_summary: str = Field(description="Brief summary of the object's content")
    evidence_ids: list[str] = Field(default_factory=list, description="Supporting evidence object IDs")


class BindingConstraint(BaseModel):
    """A constraint that is currently governing and must be respected."""

    object_id: str
    constraint_text: str
    authority_level: AuthorityLevel
    source: Optional[str] = Field(default=None, description="Where this constraint comes from")


class SupersededItem(BaseModel):
    """A memory object that has been superseded — included for awareness."""

    object_id: str
    reason: str = Field(description="Why it was superseded (e.g., 'Later corrected by COR-14')")
    superseded_by_id: Optional[str] = Field(default=None)


class Contradiction(BaseModel):
    """A detected contradiction between memory objects."""

    object_ids: list[str] = Field(description="The conflicting object IDs")
    explanation: str = Field(description="How they contradict")
    current_governing: Optional[str] = Field(
        default=None, description="Which position currently governs, if resolvable"
    )
    needs_human_review: bool = Field(default=False)


class CoverageAssessment(BaseModel):
    """Assessment of what was searched and what may still be missing."""

    areas_searched: list[str] = Field(description="Topics/domains/tables that were queried")
    evidence_types_found: list[str] = Field(description="Types of evidence found (claims, decisions, etc.)")
    potential_gaps: list[str] = Field(default_factory=list, description="What may still be missing")


class DrilldownRequest(BaseModel):
    """A recommendation to retrieve additional raw source material."""

    target_description: str = Field(description="What to drill into (e.g., 'Full transcript around DEC-203')")
    target_object_id: Optional[str] = Field(default=None, description="Specific object to expand")
    target_table: Optional[str] = Field(default=None, description="Source table to query")
    priority: str = Field(default="medium", description="low, medium, high")


class ContextPacket(BaseModel):
    """The primary output artifact of the Deep Memory Research Agent.

    This structured packet is what downstream agents (Historian, Executor,
    Verifier, etc.) actually consume for decision-making. It provides governed
    memory rather than mere retrieval.
    """

    current_question: str = Field(description="The question that was researched")
    context_summary: str = Field(description="Narrative summary of the decision-relevant context")
    material_memories: list[MaterialMemory] = Field(
        default_factory=list, description="Memories deemed materially relevant"
    )
    binding_constraints: list[BindingConstraint] = Field(
        default_factory=list, description="Currently governing constraints"
    )
    superseded_items: list[SupersededItem] = Field(
        default_factory=list, description="Items that have been superseded"
    )
    contradictions: list[Contradiction] = Field(
        default_factory=list, description="Detected contradictions"
    )
    open_questions: list[str] = Field(
        default_factory=list, description="Unresolved questions"
    )
    recommended_drilldowns: list[DrilldownRequest] = Field(
        default_factory=list, description="Suggestions for deeper investigation"
    )
    evidence_lineage: dict = Field(
        default_factory=dict, description="Mapping from findings to source evidence chains"
    )
    confidence: float = Field(
        ge=0.0, le=1.0, description="Overall confidence in the packet's completeness"
    )
    coverage_assessment: CoverageAssessment = Field(
        description="What was searched and what may be missing"
    )

    # Metadata
    mode: str = Field(description="fast, research, or audit")
    dialogue_id: str = Field(description="Dialogue this packet was generated for")
    policy_key: Optional[str] = Field(default=None, description="Context policy that triggered this research")
    generated_at: datetime = Field(default_factory=_utcnow)
    elapsed_ms: Optional[int] = Field(default=None, description="Wall clock time for generation")
    stages_completed: int = Field(default=0, description="Number of pipeline stages completed")


class ConflictReport(BaseModel):
    """Standalone conflict analysis report — used by the conflict engine."""

    contradictions: list[Contradiction] = Field(default_factory=list)
    supersession_chains: list[list[str]] = Field(
        default_factory=list, description="Chains of object IDs from oldest to newest"
    )
    stale_assumptions: list[str] = Field(
        default_factory=list, description="Object IDs of assumptions that may no longer hold"
    )
    changed_requirements: list[str] = Field(
        default_factory=list, description="Object IDs of requirements that have been modified"
    )
    generated_at: datetime = Field(default_factory=_utcnow)
