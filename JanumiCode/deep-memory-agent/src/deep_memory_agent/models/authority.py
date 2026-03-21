"""Authority levels for memory objects — not all memories vote equally."""

from enum import Enum


class AuthorityLevel(str, Enum):
    """Tiered authority levels for memory objects.

    Higher authority objects take precedence in conflict resolution.
    A speculative brainstorm and a human-approved constraint should not appear as peers.
    """

    EXPLORATORY_DISCUSSION = "exploratory_discussion"
    AGENT_INFERENCE = "agent_inference"
    ACCEPTED_ARTIFACT = "accepted_artifact"
    HUMAN_VALIDATED = "human_validated"
    APPROVED_REQUIREMENT = "approved_requirement"
    APPROVED_DECISION = "approved_decision"
    TEST_EVIDENCE = "test_evidence"
    INCIDENT_EVIDENCE = "incident_evidence"
    POLICY_INVARIANT = "policy_invariant"


# Numeric weight for relevance scoring (higher = more authoritative)
AUTHORITY_WEIGHTS: dict[AuthorityLevel, float] = {
    AuthorityLevel.EXPLORATORY_DISCUSSION: 0.1,
    AuthorityLevel.AGENT_INFERENCE: 0.2,
    AuthorityLevel.ACCEPTED_ARTIFACT: 0.4,
    AuthorityLevel.HUMAN_VALIDATED: 0.6,
    AuthorityLevel.APPROVED_REQUIREMENT: 0.7,
    AuthorityLevel.APPROVED_DECISION: 0.8,
    AuthorityLevel.TEST_EVIDENCE: 0.85,
    AuthorityLevel.INCIDENT_EVIDENCE: 0.9,
    AuthorityLevel.POLICY_INVARIANT: 1.0,
}


def authority_score(level: AuthorityLevel) -> float:
    """Return normalized authority score (0.0–1.0) for relevance scoring."""
    return AUTHORITY_WEIGHTS.get(level, 0.2)
