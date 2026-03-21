"""Tests for the ingestion pipeline — extraction, normalization, edge proposal."""

import json

import pytest

from deep_memory_agent.db.memory_store import (
    complete_extraction_run,
    count_memory_edges,
    count_memory_objects,
    get_memory_object,
    get_memory_objects_by_dialogue,
    insert_memory_edge,
    insert_memory_object,
    start_extraction_run,
)
from deep_memory_agent.ingestion.edge_proposer import propose_edges
from deep_memory_agent.ingestion.extractor import (
    extract_all,
    extract_from_claims,
    extract_from_decision_traces,
    extract_from_human_decisions,
    extract_from_narrative_memories,
    extract_from_open_loops,
    extract_from_verdicts,
)
from deep_memory_agent.ingestion.normalizer import deduplicate_objects
from deep_memory_agent.models.base import ObjectType
from tests.fixtures.sample_db import DIALOGUE_ID, create_sample_db


@pytest.fixture
def db():
    """Provide a fresh sample database for each test."""
    return create_sample_db()


class TestExtraction:
    def test_extract_from_claims(self, db):
        objects = extract_from_claims(db, DIALOGUE_ID, "test-run")
        assert len(objects) == 3
        types = {obj.object_type for obj in objects}
        assert types == {ObjectType.CLAIM}
        # Check deterministic IDs
        assert all(obj.object_id.startswith("CLM-") for obj in objects)

    def test_extract_from_human_decisions(self, db):
        objects = extract_from_human_decisions(db, DIALOGUE_ID, "test-run")
        assert len(objects) == 1
        assert objects[0].object_type == ObjectType.DECISION_TRACE
        assert objects[0].authority_level.value == "human_validated"
        assert objects[0].content["action"] == "APPROVE"

    def test_extract_from_narrative_memories(self, db):
        objects = extract_from_narrative_memories(db, DIALOGUE_ID, "test-run")
        assert len(objects) == 1
        assert objects[0].object_type == ObjectType.NARRATIVE_SUMMARY
        assert "REST APIs" in objects[0].content["summary"]

    def test_extract_from_decision_traces(self, db):
        objects = extract_from_decision_traces(db, DIALOGUE_ID, "test-run")
        assert len(objects) == 1
        assert objects[0].object_type == ObjectType.DECISION_TRACE
        assert "REST" in objects[0].content.get("decision_statement", "")

    def test_extract_from_open_loops(self, db):
        objects = extract_from_open_loops(db, DIALOGUE_ID, "test-run")
        assert len(objects) == 1
        assert objects[0].object_type == ObjectType.OPEN_QUESTION
        assert "WebSocket" in objects[0].content["question"]

    def test_extract_from_verdicts(self, db):
        objects = extract_from_verdicts(db, DIALOGUE_ID, "test-run")
        assert len(objects) == 2
        # One VERIFIED → CLAIM, one DISPROVED → CORRECTION
        types = {obj.object_type for obj in objects}
        assert ObjectType.CLAIM in types
        assert ObjectType.CORRECTION in types

    def test_extract_all(self, db):
        objects = extract_all(db, DIALOGUE_ID, "test-run")
        # 3 claims + 1 human decision + 1 narrative + 1 decision trace + 1 open loop + 2 verdicts = 9
        assert len(objects) == 9


class TestNormalization:
    def test_deduplication_empty_db(self, db):
        objects = extract_all(db, DIALOGUE_ID, "test-run")
        new_objects = deduplicate_objects(db, objects)
        # All should be new (nothing in memory_objects yet)
        assert len(new_objects) == len(objects)

    def test_deduplication_after_insert(self, db):
        objects = extract_all(db, DIALOGUE_ID, "test-run")
        # Insert them all
        for obj in objects:
            insert_memory_object(db, obj)
        db.commit()

        # Re-extract — all should be deduplicated
        objects2 = extract_all(db, DIALOGUE_ID, "test-run-2")
        new_objects = deduplicate_objects(db, objects2)
        assert len(new_objects) == 0


class TestEdgeProposal:
    def test_propose_edges(self, db):
        objects = extract_all(db, DIALOGUE_ID, "test-run")
        edges = propose_edges(objects)
        # Should have at least some edges:
        # - verdict VERIFIED → supports claim
        # - verdict DISPROVED → invalidates claim
        # - decision trace → derived_from narrative
        assert len(edges) > 0

        edge_types = {e.edge_type.value for e in edges}
        # At least one of these should exist
        assert len(edge_types & {"supports", "invalidates", "derived_from"}) > 0

    def test_all_edges_have_evidence(self, db):
        objects = extract_all(db, DIALOGUE_ID, "test-run")
        edges = propose_edges(objects)
        for edge in edges:
            assert edge.evidence is not None
            assert edge.created_by == "rule_engine"


class TestMemoryStore:
    def test_insert_and_retrieve(self, db):
        objects = extract_all(db, DIALOGUE_ID, "test-run")
        for obj in objects:
            insert_memory_object(db, obj)
        db.commit()

        # Retrieve by dialogue
        stored = get_memory_objects_by_dialogue(db, DIALOGUE_ID)
        assert len(stored) == len(objects)

    def test_count(self, db):
        objects = extract_all(db, DIALOGUE_ID, "test-run")
        for obj in objects:
            insert_memory_object(db, obj)
        db.commit()

        count = count_memory_objects(db, DIALOGUE_ID)
        assert count == len(objects)

    def test_extraction_run_lifecycle(self, db):
        run_id = start_extraction_run(db, DIALOGUE_ID, "incremental", "rule_based", "v1")
        db.commit()
        assert run_id.startswith("RUN-")

        complete_extraction_run(db, run_id, 5, 3)
        db.commit()

        row = db.execute("SELECT * FROM memory_extraction_runs WHERE run_id = ?", (run_id,)).fetchone()
        assert row["status"] == "completed"
        assert row["objects_created"] == 5
        assert row["edges_created"] == 3


class TestFullPipeline:
    def test_end_to_end(self, db):
        """Test the complete ingestion pipeline: extract → deduplicate → store → edges."""
        # 1. Start run
        run_id = start_extraction_run(db, DIALOGUE_ID, "full", "rule_based", "v1")
        db.commit()

        # 2. Extract
        objects = extract_all(db, DIALOGUE_ID, run_id)
        assert len(objects) > 0

        # 3. Deduplicate
        new_objects = deduplicate_objects(db, objects)
        assert len(new_objects) == len(objects)  # First run, all new

        # 4. Store objects
        for obj in new_objects:
            insert_memory_object(db, obj)

        # 5. Propose and store edges
        edges = propose_edges(objects)
        edges_inserted = 0
        for edge in edges:
            try:
                insert_memory_edge(db, edge)
                edges_inserted += 1
            except Exception:
                pass

        # 6. Complete run
        complete_extraction_run(db, run_id, len(new_objects), edges_inserted)
        db.commit()

        # Verify
        assert count_memory_objects(db, DIALOGUE_ID) == len(new_objects)
        assert edges_inserted > 0

        # Re-run should produce 0 new objects
        objects2 = extract_all(db, DIALOGUE_ID, "run-2")
        new2 = deduplicate_objects(db, objects2)
        assert len(new2) == 0
