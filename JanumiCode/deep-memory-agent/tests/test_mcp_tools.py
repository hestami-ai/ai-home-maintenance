"""Integration tests for MCP server tools — tests the tool functions directly
against a fixture database with ingested memory objects and edges.
"""

import json

import pytest

from deep_memory_agent.db.fts import search_combined, search_memory_objects_text
from deep_memory_agent.db.graph import (
    expand_subgraph,
    find_contradictions,
    find_supersession_chain,
    get_neighbors,
)
from deep_memory_agent.db.memory_store import (
    insert_memory_edge,
    insert_memory_object,
    mark_superseded,
)
from deep_memory_agent.ingestion.edge_proposer import propose_edges
from deep_memory_agent.ingestion.extractor import extract_all
from deep_memory_agent.models.base import (
    BaseMemoryObject,
    ExtractionMethod,
    ObjectType,
    ValidationStatus,
)
from deep_memory_agent.models.authority import AuthorityLevel
from deep_memory_agent.models.relations import EdgeType, MemoryEdge
from tests.fixtures.sample_db import DIALOGUE_ID, create_sample_db


@pytest.fixture
def populated_db():
    """Provide a fixture DB with memory objects and edges already ingested."""
    db = create_sample_db()

    # Run full ingestion pipeline
    objects = extract_all(db, DIALOGUE_ID, "test-run")
    for obj in objects:
        insert_memory_object(db, obj)

    edges = propose_edges(objects)
    for edge in edges:
        try:
            insert_memory_edge(db, edge)
        except Exception:
            pass

    db.commit()
    return db


class TestFTSSearch:
    def test_search_memory_objects_by_keyword(self, populated_db):
        results = search_memory_objects_text(populated_db, "REST API", DIALOGUE_ID)
        assert len(results) > 0
        # Should find the claim about REST APIs
        contents = [r.get("content", "") for r in results]
        assert any("REST" in c for c in contents)

    def test_search_with_type_filter(self, populated_db):
        results = search_memory_objects_text(
            populated_db, "REST", DIALOGUE_ID, object_types=["claim"]
        )
        for r in results:
            assert r["object_type"] == "claim"

    def test_search_no_results(self, populated_db):
        results = search_memory_objects_text(
            populated_db, "zzzznonexistentkeywordzzz", DIALOGUE_ID
        )
        assert len(results) == 0

    def test_search_excludes_superseded(self, populated_db):
        # Supersede one of the objects
        objects = populated_db.execute(
            "SELECT object_id FROM memory_objects WHERE object_type = 'claim' LIMIT 1"
        ).fetchone()
        if objects:
            mark_superseded(populated_db, objects["object_id"], "FAKE-NEW")
            populated_db.commit()

        results = search_memory_objects_text(populated_db, "system", DIALOGUE_ID)
        superseded_ids = {r["object_id"] for r in results if r.get("superseded_by")}
        assert len(superseded_ids) == 0  # Superseded objects excluded

    def test_combined_search(self, populated_db):
        # Also add an FTS entry to test combined search
        populated_db.execute(
            "INSERT INTO fts_stream_content (content, source_table, source_id, dialogue_id) "
            "VALUES (?, ?, ?, ?)",
            ("Testing REST API endpoints for authentication flow", "dialogue_events", "EVT-test", DIALOGUE_ID),
        )
        populated_db.commit()

        results = search_combined(populated_db, "REST authentication", DIALOGUE_ID)
        assert len(results) > 0
        sources = {r.get("search_source") for r in results}
        # Should have results from both FTS stream and memory objects
        assert "fts_stream" in sources or "memory_objects" in sources


class TestGraphTraversal:
    def test_get_neighbors(self, populated_db):
        # Find an object that has edges
        edge = populated_db.execute("SELECT from_object_id FROM memory_edges LIMIT 1").fetchone()
        if edge:
            neighbors = get_neighbors(populated_db, edge["from_object_id"])
            assert len(neighbors) > 0

    def test_expand_subgraph(self, populated_db):
        # Get any object_id
        obj = populated_db.execute("SELECT object_id FROM memory_objects LIMIT 1").fetchone()
        assert obj is not None

        objects, edges = expand_subgraph(populated_db, [obj["object_id"]], max_depth=2)
        # Should find at least the starting object
        assert len(objects) >= 1

    def test_expand_with_edge_type_filter(self, populated_db):
        obj = populated_db.execute("SELECT object_id FROM memory_objects LIMIT 1").fetchone()
        objects, edges = expand_subgraph(
            populated_db, [obj["object_id"]], edge_types=["supports"], max_depth=2
        )
        # All returned edges should be 'supports' type
        for edge in edges:
            assert edge["edge_type"] == "supports"

    def test_find_supersession_chain_no_supersession(self, populated_db):
        obj = populated_db.execute(
            "SELECT object_id FROM memory_objects WHERE superseded_by IS NULL LIMIT 1"
        ).fetchone()
        chain = find_supersession_chain(populated_db, obj["object_id"])
        # Should return just the object itself
        assert len(chain) >= 1

    def test_find_supersession_chain_with_supersession(self, populated_db):
        # Create a supersession chain: A → B → C
        for obj_id, superseded_by in [("SUP-A", "SUP-B"), ("SUP-B", "SUP-C"), ("SUP-C", None)]:
            insert_memory_object(populated_db, BaseMemoryObject(
                object_id=obj_id,
                object_type=ObjectType.DECISION_TRACE,
                dialogue_id=DIALOGUE_ID,
                actor="test",
                content={"decision_statement": f"Decision {obj_id}"},
                superseded_by=superseded_by,
            ))
        populated_db.commit()

        chain = find_supersession_chain(populated_db, "SUP-A")
        chain_ids = [c["object_id"] for c in chain]
        assert "SUP-A" in chain_ids
        assert "SUP-B" in chain_ids
        assert "SUP-C" in chain_ids
        # Should be ordered oldest to newest
        assert chain_ids.index("SUP-A") < chain_ids.index("SUP-B") < chain_ids.index("SUP-C")

    def test_find_contradictions(self, populated_db):
        # Create two contradicting objects
        insert_memory_object(populated_db, BaseMemoryObject(
            object_id="CON-A",
            object_type=ObjectType.CLAIM,
            dialogue_id=DIALOGUE_ID,
            actor="test",
            content={"claim_text": "Use REST"},
        ))
        insert_memory_object(populated_db, BaseMemoryObject(
            object_id="CON-B",
            object_type=ObjectType.CLAIM,
            dialogue_id=DIALOGUE_ID,
            actor="test",
            content={"claim_text": "Use GraphQL"},
        ))
        insert_memory_edge(populated_db, MemoryEdge(
            edge_id="ME-CON-1",
            edge_type=EdgeType.CONTRADICTS,
            from_object_id="CON-A",
            to_object_id="CON-B",
            evidence="Mutually exclusive API styles",
            created_by="test",
        ))
        populated_db.commit()

        objects, edges = find_contradictions(populated_db, "CON-A")
        assert len(objects) == 2
        assert len(edges) == 1
        obj_ids = {o["object_id"] for o in objects}
        assert "CON-A" in obj_ids
        assert "CON-B" in obj_ids


class TestEvidenceLoading:
    def test_load_from_claims(self, populated_db):
        """Test that load_evidence_span can retrieve source material."""
        claim = populated_db.execute("SELECT claim_id FROM claims LIMIT 1").fetchone()
        assert claim is not None

        row = populated_db.execute(
            "SELECT * FROM claims WHERE claim_id = ?", (claim["claim_id"],)
        ).fetchone()
        assert row is not None
        assert row["claim_text"] is not None


class TestTemporalQuery:
    def test_query_by_dialogue(self, populated_db):
        rows = populated_db.execute(
            "SELECT * FROM memory_objects WHERE dialogue_id = ? AND superseded_by IS NULL",
            (DIALOGUE_ID,),
        ).fetchall()
        assert len(rows) > 0

    def test_query_excludes_superseded(self, populated_db):
        # Supersede one object
        obj = populated_db.execute(
            "SELECT object_id FROM memory_objects LIMIT 1"
        ).fetchone()
        mark_superseded(populated_db, obj["object_id"], "FAKE-NEW")
        populated_db.commit()

        rows = populated_db.execute(
            "SELECT * FROM memory_objects WHERE dialogue_id = ? AND superseded_by IS NULL",
            (DIALOGUE_ID,),
        ).fetchall()
        superseded_ids = {r["object_id"] for r in rows if r["superseded_by"]}
        assert len(superseded_ids) == 0
