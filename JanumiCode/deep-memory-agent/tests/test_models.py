"""Tests for Pydantic memory object models."""

from datetime import datetime, timedelta, timezone

import pytest

from deep_memory_agent.models import (
    AuthorityLevel,
    BaseMemoryObject,
    BindingConstraint,
    ContextPacket,
    CoverageAssessment,
    MaterialMemory,
    ValidationStatus,
)
from deep_memory_agent.models.authority import authority_score
from deep_memory_agent.models.base import ExtractionMethod, ObjectType
from deep_memory_agent.models.decisions import Claim, Constraint, DecisionTrace
from deep_memory_agent.models.records import NarrativeSummary, RawRecord
from deep_memory_agent.models.relations import EdgeType, MemoryEdge


class TestBaseMemoryObject:
    def test_minimal_construction(self):
        obj = BaseMemoryObject(
            object_id="MO-001",
            object_type=ObjectType.CLAIM,
            dialogue_id="dlg-1",
            actor="technical_expert",
            content={"claim_text": "The API uses REST"},
        )
        assert obj.object_id == "MO-001"
        assert obj.confidence == 1.0
        assert obj.authority_level == AuthorityLevel.AGENT_INFERENCE
        assert obj.validation_status == ValidationStatus.PENDING
        assert obj.is_active is True
        assert obj.is_superseded is False

    def test_superseded_object(self):
        obj = BaseMemoryObject(
            object_id="MO-002",
            object_type=ObjectType.DECISION_TRACE,
            dialogue_id="dlg-1",
            actor="user",
            content={"decision_statement": "Use GraphQL"},
            superseded_by="MO-003",
            superseded_at=datetime.now(tz=timezone.utc),
        )
        assert obj.is_superseded is True
        assert obj.is_active is False

    def test_effective_period(self):
        past = datetime.now(tz=timezone.utc) - timedelta(days=1)
        future = datetime.now(tz=timezone.utc) + timedelta(days=1)

        active = BaseMemoryObject(
            object_id="MO-003",
            object_type=ObjectType.CONSTRAINT,
            dialogue_id="dlg-1",
            actor="system",
            content={"constraint_text": "Must use HTTPS"},
            effective_from=past,
            effective_to=future,
        )
        assert active.is_active is True

        expired = BaseMemoryObject(
            object_id="MO-004",
            object_type=ObjectType.CONSTRAINT,
            dialogue_id="dlg-1",
            actor="system",
            content={"constraint_text": "Old constraint"},
            effective_from=past - timedelta(days=10),
            effective_to=past,
        )
        assert expired.is_active is False

    def test_serialization_roundtrip(self):
        obj = BaseMemoryObject(
            object_id="MO-005",
            object_type=ObjectType.ASSUMPTION,
            dialogue_id="dlg-1",
            actor="executor",
            content={"assumption_text": "Users have stable internet"},
            authority_level=AuthorityLevel.HUMAN_VALIDATED,
            confidence=0.8,
        )
        json_str = obj.model_dump_json()
        restored = BaseMemoryObject.model_validate_json(json_str)
        assert restored.object_id == obj.object_id
        assert restored.authority_level == AuthorityLevel.HUMAN_VALIDATED
        assert restored.confidence == 0.8


class TestDecisionModels:
    def test_decision_trace(self):
        dt = DecisionTrace(
            decision_statement="Use PostgreSQL for persistence",
            context="Database selection phase",
            alternatives_considered=["SQLite", "MySQL", "PostgreSQL"],
            rationale=["Better JSON support", "Full-text search"],
            human_validated=True,
        )
        assert len(dt.alternatives_considered) == 3
        assert dt.human_validated is True

    def test_claim(self):
        claim = Claim(
            claim_text="The system handles 1000 concurrent users",
            status="open",
            criticality="high",
        )
        assert claim.status == "open"

    def test_constraint(self):
        c = Constraint(
            constraint_text="All API endpoints must require authentication",
            is_hard=True,
            source="security policy",
        )
        assert c.is_hard is True


class TestRelations:
    def test_memory_edge(self):
        edge = MemoryEdge(
            edge_id="ME-001",
            edge_type=EdgeType.SUPPORTS,
            from_object_id="MO-001",
            to_object_id="MO-002",
            created_by="rule_engine",
        )
        assert edge.edge_type == EdgeType.SUPPORTS
        assert edge.confidence == 1.0

    def test_edge_types_complete(self):
        assert len(EdgeType) == 10


class TestAuthorityScoring:
    def test_policy_invariant_highest(self):
        assert authority_score(AuthorityLevel.POLICY_INVARIANT) == 1.0

    def test_exploratory_lowest(self):
        assert authority_score(AuthorityLevel.EXPLORATORY_DISCUSSION) == 0.1

    def test_ordering(self):
        scores = [authority_score(level) for level in AuthorityLevel]
        assert scores == sorted(scores)


class TestContextPacket:
    def test_minimal_packet(self):
        packet = ContextPacket(
            current_question="What constraints apply?",
            context_summary="No constraints found.",
            confidence=0.5,
            coverage_assessment=CoverageAssessment(
                areas_searched=["memory_objects"],
                evidence_types_found=[],
                potential_gaps=["No constraints in database"],
            ),
            mode="fast",
            dialogue_id="dlg-1",
            stages_completed=2,
        )
        assert packet.mode == "fast"
        assert len(packet.material_memories) == 0
        assert len(packet.contradictions) == 0

    def test_full_packet(self):
        packet = ContextPacket(
            current_question="Should we use GraphQL?",
            context_summary="Prior decision to use REST exists.",
            material_memories=[
                MaterialMemory(
                    object_id="MO-001",
                    object_type="decision_trace",
                    relevance_score=0.9,
                    why_relevant="Direct prior decision on API style",
                    authority_level=AuthorityLevel.APPROVED_DECISION,
                    content_summary="Decided to use REST for API layer",
                    evidence_ids=["MO-010", "MO-011"],
                )
            ],
            binding_constraints=[
                BindingConstraint(
                    object_id="MO-020",
                    constraint_text="API must be RESTful per architecture document",
                    authority_level=AuthorityLevel.APPROVED_REQUIREMENT,
                )
            ],
            confidence=0.85,
            coverage_assessment=CoverageAssessment(
                areas_searched=["decision_traces", "constraints", "claims"],
                evidence_types_found=["decision_trace", "constraint"],
            ),
            mode="research",
            dialogue_id="dlg-2",
            stages_completed=6,
        )
        assert len(packet.material_memories) == 1
        assert packet.material_memories[0].relevance_score == 0.9
        assert len(packet.binding_constraints) == 1
