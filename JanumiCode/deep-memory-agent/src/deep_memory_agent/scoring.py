"""Composite relevance scoring for memory objects.

Relevance is multi-dimensional — not just semantic similarity.
A memory can be semantically similar yet irrelevant, or semantically
distant but critically binding because it is an approved policy decision.

Score = 0.20×semantic + 0.25×constraint + 0.20×authority + 0.15×temporal + 0.10×causal + 0.10×contradiction
"""

from __future__ import annotations

from dataclasses import dataclass

from deep_memory_agent.models.authority import AuthorityLevel, authority_score


@dataclass
class RelevanceScores:
    """Individual dimension scores for a memory candidate."""

    semantic: float = 0.0
    constraint: float = 0.0
    authority: float = 0.0
    temporal: float = 0.0
    causal: float = 0.0
    contradiction: float = 0.0

    @property
    def composite(self) -> float:
        """Weighted composite score."""
        return (
            0.20 * self.semantic
            + 0.25 * self.constraint
            + 0.20 * self.authority
            + 0.15 * self.temporal
            + 0.10 * self.causal
            + 0.10 * self.contradiction
        )


def score_authority(level: AuthorityLevel) -> float:
    """Score based on authority tier."""
    return authority_score(level)


def score_temporal_recency(age_hours: float, max_age_hours: float = 720.0) -> float:
    """Score based on how recent the object is. Decays linearly over max_age_hours (default 30 days)."""
    if age_hours <= 0:
        return 1.0
    if age_hours >= max_age_hours:
        return 0.0
    return 1.0 - (age_hours / max_age_hours)


def score_supersession_penalty(is_superseded: bool) -> float:
    """Penalize superseded objects. They get a flat penalty, not zero — they may still provide context."""
    return 0.1 if is_superseded else 1.0
