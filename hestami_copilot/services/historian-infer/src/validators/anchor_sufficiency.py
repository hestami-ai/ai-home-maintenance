"""
Anchor Sufficiency Gate (Phase 1.2)

Validates that a proposal's evidence bundle is sufficient for adjudication.
Implements automatic UNKNOWN/CONDITIONAL responses for insufficient anchors.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class SufficiencyLevel(Enum):
    """Assessment of anchor sufficiency"""
    SUFFICIENT = "sufficient"
    PARTIAL = "partial"
    INSUFFICIENT = "insufficient"


@dataclass
class AnchorAssessment:
    """Result of anchor sufficiency evaluation"""
    level: SufficiencyLevel
    sufficient: bool
    missing_anchors: list[str] = field(default_factory=list)
    verification_queries: list[str] = field(default_factory=list)
    reason: str = ""
    coverage_score: float = 0.0  # 0.0 to 1.0


@dataclass
class EvidenceItem:
    """A single evidence item from the bundle"""
    source: str  # spec, guideline, decision, discussion
    id: str
    excerpt: str
    claim: Optional[str] = None


def assess_anchor_sufficiency(
    spec_refs: list[str],
    evidence_bundle: list[dict],
    assumptions: list[str],
    invariants: list[str],
    steps: list[str],
) -> AnchorAssessment:
    """
    Assess whether the provided evidence is sufficient for adjudication.

    Rules:
    1. If evidence_bundle is empty, return INSUFFICIENT
    2. If spec_refs are declared but not backed by evidence, return PARTIAL
    3. If assumptions/invariants lack supporting evidence, flag them
    4. Calculate coverage score based on claims vs evidence

    Returns:
        AnchorAssessment with sufficiency evaluation
    """
    missing_anchors: list[str] = []
    verification_queries: list[str] = []

    # Parse evidence items
    evidence_items = [
        EvidenceItem(
            source=e.get("source", "unknown"),
            id=e.get("id", ""),
            excerpt=e.get("excerpt", ""),
            claim=e.get("claim"),
        )
        for e in evidence_bundle
    ]

    # Rule 1: Empty evidence bundle
    if not evidence_items:
        return AnchorAssessment(
            level=SufficiencyLevel.INSUFFICIENT,
            sufficient=False,
            missing_anchors=["evidence_bundle is empty"],
            verification_queries=[
                "Provide at least one evidence item supporting this proposal.",
                "Include excerpts from relevant specifications or decisions.",
            ],
            reason="No evidence provided. Cannot adjudicate without supporting documentation.",
            coverage_score=0.0,
        )

    # Rule 2: Check spec_refs coverage
    evidence_ids = {e.id for e in evidence_items}
    uncovered_refs = []
    for ref in spec_refs:
        # Check if any evidence item covers this ref (partial matching)
        covered = any(
            ref in eid or eid in ref or ref.split("#")[0] in eid
            for eid in evidence_ids
        )
        if not covered:
            uncovered_refs.append(ref)

    if uncovered_refs:
        missing_anchors.extend([f"spec_ref:{ref}" for ref in uncovered_refs])
        verification_queries.extend([
            f"Provide evidence excerpt for declared spec reference: {ref}"
            for ref in uncovered_refs[:3]  # Limit to first 3
        ])

    # Rule 3: Check assumptions have some grounding
    # Assumptions should ideally be backed by evidence
    if assumptions and len(assumptions) > len(evidence_items):
        missing_anchors.append(
            f"assumptions_evidence_gap: {len(assumptions)} assumptions but only {len(evidence_items)} evidence items"
        )
        verification_queries.append(
            "Consider providing additional evidence to support stated assumptions."
        )

    # Rule 4: Check invariants are addressed
    if invariants:
        invariant_keywords = set()
        for inv in invariants:
            # Extract key terms from invariants
            words = inv.lower().split()
            invariant_keywords.update(w for w in words if len(w) > 4)

        # Check if evidence excerpts mention invariant concepts
        evidence_text = " ".join(e.excerpt.lower() for e in evidence_items)
        unmentioned = [
            kw for kw in list(invariant_keywords)[:5]
            if kw not in evidence_text
        ]
        if len(unmentioned) > 2:
            missing_anchors.append(
                f"invariant_coverage: key terms not found in evidence: {', '.join(unmentioned[:3])}"
            )

    # Rule 5: Check steps have supporting evidence
    if len(steps) > 3 and len(evidence_items) < 2:
        missing_anchors.append(
            f"step_evidence_ratio: {len(steps)} steps but only {len(evidence_items)} evidence items"
        )
        verification_queries.append(
            "Complex proposals (>3 steps) typically require multiple evidence sources."
        )

    # Calculate coverage score
    total_items = len(spec_refs) + len(assumptions) + len(invariants)
    if total_items == 0:
        coverage_score = 0.5 if evidence_items else 0.0
    else:
        covered_count = total_items - len(uncovered_refs)
        coverage_score = min(1.0, covered_count / total_items)

    # Determine sufficiency level
    if not missing_anchors:
        return AnchorAssessment(
            level=SufficiencyLevel.SUFFICIENT,
            sufficient=True,
            missing_anchors=[],
            verification_queries=[],
            reason="Evidence bundle appears sufficient for adjudication.",
            coverage_score=coverage_score,
        )
    elif len(missing_anchors) <= 2 and coverage_score >= 0.5:
        return AnchorAssessment(
            level=SufficiencyLevel.PARTIAL,
            sufficient=False,
            missing_anchors=missing_anchors,
            verification_queries=verification_queries,
            reason="Partial evidence coverage. Additional anchors recommended for full adjudication.",
            coverage_score=coverage_score,
        )
    else:
        return AnchorAssessment(
            level=SufficiencyLevel.INSUFFICIENT,
            sufficient=False,
            missing_anchors=missing_anchors,
            verification_queries=verification_queries,
            reason="Insufficient evidence for reliable adjudication.",
            coverage_score=coverage_score,
        )


def generate_verification_queries(
    assessment: AnchorAssessment,
    proposal_description: str,
    feature: str,
) -> list[str]:
    """
    Generate specific verification queries based on assessment gaps.

    Returns actionable questions that would resolve the insufficiency.
    """
    queries = list(assessment.verification_queries)

    # Add feature-specific query if coverage is low
    if assessment.coverage_score < 0.3:
        queries.append(
            f"What specifications govern the '{feature}' feature? "
            "Provide relevant excerpts."
        )

    # Add general guidance queries
    if "evidence_bundle is empty" in assessment.missing_anchors:
        queries.append(
            "List the key requirements this proposal addresses, "
            "with citations to supporting documents."
        )

    # Deduplicate while preserving order
    seen = set()
    unique_queries = []
    for q in queries:
        if q not in seen:
            seen.add(q)
            unique_queries.append(q)

    return unique_queries[:5]  # Limit to 5 queries


def recommend_status(assessment: AnchorAssessment) -> str:
    """
    Recommend an adjudication status based on anchor assessment.

    This is a pre-inference recommendation. The actual model may override
    based on evidence analysis.
    """
    if assessment.level == SufficiencyLevel.SUFFICIENT:
        # Let the model decide based on evidence analysis
        return "PENDING_INFERENCE"
    elif assessment.level == SufficiencyLevel.PARTIAL:
        # Likely CONDITIONAL - needs additional evidence
        return "CONDITIONAL"
    else:
        # Insufficient evidence - must be UNKNOWN
        return "UNKNOWN"
