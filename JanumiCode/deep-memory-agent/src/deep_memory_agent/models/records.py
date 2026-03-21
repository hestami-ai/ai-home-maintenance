"""Record-type memory objects — raw records, summaries, conclusions, questions."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class RawRecord(BaseModel):
    """Original unprocessed source material (chat turn, doc fragment, code diff, etc.)."""

    text: str = Field(description="Full text content of the raw record")
    source_type: str = Field(description="Type of source: chat, document, code_diff, ticket, etc.")
    metadata: dict = Field(default_factory=dict, description="Source-specific metadata")


class NarrativeSummary(BaseModel):
    """Derived narrative summary of one or more raw records.

    Summaries are entry points, not truth. The Deep Memory Agent treats them
    as indexes into deeper evidence, not as authoritative on their own.
    """

    summary: str = Field(description="The narrative summary text")
    source_record_ids: list[str] = Field(default_factory=list, description="IDs of source records summarized")
    coverage: Optional[str] = Field(default=None, description="What topics/decisions this summary covers")
    curation_mode: Optional[str] = Field(default=None, description="INTENT, OUTCOME, FAILURE, or FEEDBACK")


class DerivedConclusion(BaseModel):
    """A conclusion derived from analysis of multiple memory objects."""

    conclusion: str = Field(description="The derived conclusion statement")
    supporting_object_ids: list[str] = Field(default_factory=list, description="Objects that support this conclusion")
    reasoning: Optional[str] = Field(default=None, description="How the conclusion was derived")


class OpenQuestion(BaseModel):
    """An unresolved question identified during analysis."""

    question: str = Field(description="The open question text")
    context: Optional[str] = Field(default=None, description="Why this question matters")
    related_object_ids: list[str] = Field(default_factory=list, description="Related memory objects")
    priority: Optional[str] = Field(default=None, description="How urgently this needs resolution")
