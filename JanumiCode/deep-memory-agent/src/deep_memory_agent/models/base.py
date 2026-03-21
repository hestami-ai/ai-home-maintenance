"""Base memory object — shared fields for all typed memory artifacts."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Optional


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)

from pydantic import BaseModel, Field

from deep_memory_agent.models.authority import AuthorityLevel


class ValidationStatus(str, Enum):
    PENDING = "pending"
    VALIDATED = "validated"
    REJECTED = "rejected"
    UNCERTAIN = "uncertain"


class ExtractionMethod(str, Enum):
    RULE_BASED = "rule_based"
    LLM_EXTRACTION = "llm_extraction"
    HUMAN_INPUT = "human_input"


class ObjectType(str, Enum):
    RAW_RECORD = "raw_record"
    NARRATIVE_SUMMARY = "narrative_summary"
    DECISION_TRACE = "decision_trace"
    CLAIM = "claim"
    CONSTRAINT = "constraint"
    ASSUMPTION = "assumption"
    CORRECTION = "correction"
    RISK = "risk"
    OPEN_QUESTION = "open_question"
    DERIVED_CONCLUSION = "derived_conclusion"


class BaseMemoryObject(BaseModel):
    """Common fields shared by all typed memory objects.

    Every memory artifact in the substrate inherits these fields, providing
    stable identity, bi-temporal tracking, provenance, authority, and
    supersession status.
    """

    object_id: str = Field(description="Stable unique identifier")
    object_type: ObjectType = Field(description="Discriminator for the memory object type")
    dialogue_id: str = Field(description="Dialogue this object belongs to")
    workflow_id: Optional[str] = Field(default=None, description="Workflow/task ID if applicable")
    domain: Optional[str] = Field(default=None, description="Business domain tag")
    actor: str = Field(description="Who produced this object (role, user, system)")

    content: dict = Field(description="Type-specific payload (varies by object_type)")

    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Confidence score")
    authority_level: AuthorityLevel = Field(
        default=AuthorityLevel.AGENT_INFERENCE,
        description="Authority tier for relevance scoring and conflict resolution",
    )

    # Supersession
    superseded_by: Optional[str] = Field(default=None, description="Object ID that supersedes this one")
    superseded_at: Optional[datetime] = Field(default=None)

    # Validation
    validation_status: ValidationStatus = Field(default=ValidationStatus.PENDING)

    # Extraction provenance
    extraction_method: Optional[ExtractionMethod] = Field(default=None)
    extraction_run_id: Optional[str] = Field(default=None)

    # Bi-temporal columns
    recorded_at: datetime = Field(default_factory=_utcnow, description="When stored in the DB")
    event_at: Optional[datetime] = Field(default=None, description="When the described event happened")
    effective_from: Optional[datetime] = Field(default=None, description="When this object became governing")
    effective_to: Optional[datetime] = Field(default=None, description="When this object stopped governing")

    # Source provenance
    source_table: Optional[str] = Field(default=None, description="JanumiCode table this was extracted from")
    source_id: Optional[str] = Field(default=None, description="Row ID in source table")
    source_segment: Optional[str] = Field(default=None, description="Span/offset within source")
    model_id: Optional[str] = Field(default=None, description="LLM model that produced the extraction")
    prompt_version: Optional[str] = Field(default=None)

    # Lineage
    parent_object_id: Optional[str] = Field(default=None, description="Parent object in derivation chain")

    @property
    def is_superseded(self) -> bool:
        return self.superseded_by is not None

    @property
    def is_active(self) -> bool:
        """Object is active if not superseded and within effective period."""
        if self.is_superseded:
            return False
        now = _utcnow()
        if self.effective_from and now < self.effective_from:
            return False
        if self.effective_to and now > self.effective_to:
            return False
        return True
