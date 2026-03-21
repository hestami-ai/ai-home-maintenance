"""Decision-type memory objects — traces, claims, constraints, assumptions, corrections, risks."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class DecisionTrace(BaseModel):
    """A record of a decision that was made, with full rationale and context."""

    decision_statement: str = Field(description="What was decided")
    context: Optional[str] = Field(default=None, description="What prompted this decision")
    assumptions: list[str] = Field(default_factory=list, description="Assumptions that supported the decision")
    constraints: list[str] = Field(default_factory=list, description="Constraints that bounded the decision")
    alternatives_considered: list[str] = Field(default_factory=list, description="Other options evaluated")
    rationale: list[str] = Field(default_factory=list, description="Why this option was chosen")
    risks: list[str] = Field(default_factory=list, description="Identified risks of this decision")
    supersedes_ids: list[str] = Field(default_factory=list, description="Prior decision IDs this replaces")
    supported_by_ids: list[str] = Field(default_factory=list, description="Evidence IDs supporting this decision")
    human_validated: bool = Field(default=False, description="Whether a human reviewed and approved this")


class Claim(BaseModel):
    """An assertion that can be verified, contradicted, or remain open."""

    claim_text: str = Field(description="The claim statement")
    status: str = Field(default="open", description="open, verified, conditional, disproved, unknown")
    criticality: Optional[str] = Field(default=None, description="low, medium, high, critical")
    introduced_by: Optional[str] = Field(default=None, description="Role/actor that introduced the claim")


class Constraint(BaseModel):
    """A binding constraint that limits what is permissible."""

    constraint_text: str = Field(description="The constraint statement")
    scope: Optional[str] = Field(default=None, description="What this constraint applies to")
    source: Optional[str] = Field(default=None, description="Where this constraint comes from")
    is_hard: bool = Field(default=True, description="Hard constraints cannot be violated; soft ones are preferences")


class Assumption(BaseModel):
    """An assumption that underpins reasoning but may not be validated."""

    assumption_text: str = Field(description="The assumption statement")
    basis: Optional[str] = Field(default=None, description="Why this assumption was made")
    validated: bool = Field(default=False, description="Whether this assumption has been confirmed")
    invalidated_by: Optional[str] = Field(default=None, description="Evidence that disproved this assumption")


class Correction(BaseModel):
    """A correction that supersedes or modifies a prior statement or decision."""

    original_object_id: str = Field(description="ID of the object being corrected")
    correction_text: str = Field(description="What the corrected version says")
    reason: str = Field(description="Why the correction was needed")
    corrected_by: Optional[str] = Field(default=None, description="Who made the correction")


class Risk(BaseModel):
    """An identified risk to the project, decision, or implementation."""

    risk_text: str = Field(description="Description of the risk")
    severity: Optional[str] = Field(default=None, description="low, medium, high, critical")
    likelihood: Optional[str] = Field(default=None, description="low, medium, high")
    mitigation: Optional[str] = Field(default=None, description="Proposed mitigation strategy")
    related_decision_ids: list[str] = Field(default_factory=list, description="Decisions this risk relates to")
