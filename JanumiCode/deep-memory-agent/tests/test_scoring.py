"""Tests for composite relevance scoring."""

from deep_memory_agent.models.authority import AuthorityLevel
from deep_memory_agent.scoring import (
    RelevanceScores,
    score_authority,
    score_supersession_penalty,
    score_temporal_recency,
)


class TestRelevanceScores:
    def test_composite_calculation(self):
        scores = RelevanceScores(
            semantic=1.0,
            constraint=1.0,
            authority=1.0,
            temporal=1.0,
            causal=1.0,
            contradiction=1.0,
        )
        assert abs(scores.composite - 1.0) < 0.01

    def test_zero_scores(self):
        scores = RelevanceScores()
        assert scores.composite == 0.0

    def test_constraint_weighted_highest(self):
        # Constraint relevance has the highest weight (0.25)
        constraint_only = RelevanceScores(constraint=1.0)
        semantic_only = RelevanceScores(semantic=1.0)
        assert constraint_only.composite > semantic_only.composite


class TestTemporalScoring:
    def test_very_recent(self):
        assert score_temporal_recency(0.0) == 1.0

    def test_very_old(self):
        assert score_temporal_recency(1000.0) == 0.0

    def test_half_life(self):
        score = score_temporal_recency(360.0)  # 15 days out of 30
        assert 0.45 < score < 0.55


class TestSupersessionPenalty:
    def test_not_superseded(self):
        assert score_supersession_penalty(False) == 1.0

    def test_superseded(self):
        assert score_supersession_penalty(True) == 0.1
