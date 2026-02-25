"""
Phase 1 Integration Tests - PageIndex Document Retrieval

Verifies PageIndex document indexing and LLM-based reasoning retrieval:
- Document indexing from /data/specs
- LLM reasoning query with relevant results
- TOC path and section hierarchy preservation

This tests the VectifyAI PageIndex integration:
- Vectorless, reasoning-based RAG
- No embeddings, no vector database
- LLM reasons over hierarchical tree structure

Run from orchestrator container:
    docker compose exec orchestrator pytest tests/test_phase1_pageindex.py -v
"""

import pytest
import httpx
from historian.config import get_settings


@pytest.fixture
def settings():
    """Get application settings."""
    return get_settings()


@pytest.fixture
def pageindex_client(settings):
    """HTTP client for PageIndex service."""
    return httpx.Client(
        base_url=settings.pageindex.url,
        timeout=120.0,  # Longer timeout for LLM-based retrieval
    )


# =============================================================================
# Test: PageIndex Health and Version
# =============================================================================

def test_pageindex_health(pageindex_client):
    """Verify PageIndex health endpoint."""
    response = pageindex_client.get("/health")
    assert response.status_code == 200, f"Health endpoint failed: {response.text}"

    data = response.json()
    assert "status" in data, "No 'status' field in response"
    assert "docs_dir_exists" in data, "No 'docs_dir_exists' field in response"
    assert "indexer_ready" in data, "No 'indexer_ready' field in response"
    assert "llm_available" in data, "No 'llm_available' field in response"


def test_pageindex_has_indexed_documents(pageindex_client):
    """Verify PageIndex has indexed documents."""
    response = pageindex_client.get("/version")
    assert response.status_code == 200, f"Version endpoint failed: {response.text}"

    data = response.json()
    assert data["docs_indexed"] > 0, "No documents indexed"
    assert data["total_nodes"] > 0, "No nodes indexed"


def test_pageindex_list_documents(pageindex_client):
    """Verify PageIndex can list indexed documents."""
    response = pageindex_client.get("/documents")
    assert response.status_code == 200, f"Documents endpoint failed: {response.text}"

    data = response.json()
    assert "documents" in data, "No 'documents' field in response"
    assert data["total"] > 0, "No documents in index"

    # Check document structure
    doc = data["documents"][0]
    assert "doc_id" in doc, "Document missing doc_id"
    assert "title" in doc, "Document missing title"
    assert "node_count" in doc, "Document missing node_count"


# =============================================================================
# Test: PageIndex LLM-Based Query
# =============================================================================

def test_pageindex_query_rls(pageindex_client):
    """Query for RLS (Row-Level Security) content using LLM reasoning."""
    print("\n=== Testing PageIndex RLS Query ===")
    print("Query: How should Row-Level Security be implemented in PostgreSQL?")
    print("This will score 66 documents sequentially - expect ~2-5 minutes")
    print("Watch PageIndex container logs for progress...")

    response = pageindex_client.post(
        "/query",
        json={
            "query": "How should Row-Level Security be implemented in PostgreSQL?",
            "max_results": 5,
        },
    )

    print(f"Response status: {response.status_code}")
    assert response.status_code == 200, f"Query failed: {response.text}"

    data = response.json()
    assert "results" in data, "No 'results' field in response"
    assert "reasoning" in data, "No 'reasoning' field in response (LLM reasoning)"

    print(f"Results found: {data['total_found']}")
    print(f"Reasoning (first 200 chars): {data.get('reasoning', '')[:200]}...")

    assert data["total_found"] > 0, "No results found for RLS query"

    # Check result structure (note: node_id instead of section_id, no score)
    result = data["results"][0]
    assert "doc_id" in result, "Result missing doc_id"
    assert "node_id" in result, "Result missing node_id"
    assert "title" in result, "Result missing title"
    assert "content" in result, "Result missing content"
    assert "toc_path" in result, "Result missing toc_path"

    print(f"✓ Test passed - Found {data['total_found']} results")


def test_pageindex_query_database_migration(pageindex_client):
    """Query for database migration content using LLM reasoning."""
    print("\n=== Testing PageIndex Database Migration Query ===")
    print("Query: TIMESTAMPTZ migration plan for PostgreSQL")
    print("Scoring 66 documents sequentially...")

    response = pageindex_client.post(
        "/query",
        json={
            "query": "TIMESTAMPTZ migration plan for PostgreSQL",
            "max_results": 3,
        },
    )

    print(f"Response status: {response.status_code}")
    assert response.status_code == 200, f"Query failed: {response.text}"

    data = response.json()
    # May or may not find results depending on spec content
    assert "results" in data, "No 'results' field in response"
    assert "reasoning" in data, "No 'reasoning' field in response"

    print(f"Results found: {data['total_found']}")
    if data["total_found"] > 0:
        print(f"Top result: {data['results'][0]['doc_id']}")
    print(f"✓ Test passed")


def test_pageindex_query_with_doc_filter(pageindex_client):
    """Query with document filter."""
    # First, get a document ID
    docs_response = pageindex_client.get("/documents")
    assert docs_response.status_code == 200
    docs = docs_response.json()["documents"]

    if len(docs) > 0:
        doc_id = docs[0]["doc_id"]

        response = pageindex_client.post(
            "/query",
            json={
                "query": "implementation requirements",
                "doc_filter": doc_id,
                "max_results": 5,
            },
        )
        assert response.status_code == 200, f"Filtered query failed: {response.text}"

        data = response.json()
        # All results should be from the filtered document
        for result in data["results"]:
            assert result["doc_id"] == doc_id, f"Result from wrong document: {result['doc_id']}"


def test_pageindex_query_toc_path(pageindex_client):
    """Verify TOC path is properly populated."""
    response = pageindex_client.post(
        "/query",
        json={
            "query": "database user setup configuration",
            "max_results": 3,
        },
    )
    assert response.status_code == 200, f"Query failed: {response.text}"

    data = response.json()
    if data["total_found"] > 0:
        result = data["results"][0]
        # TOC path should exist (may or may not have hierarchy separator)
        assert "toc_path" in result, "TOC path missing"
        assert result["toc_path"], "TOC path is empty"


def test_pageindex_reasoning_included(pageindex_client):
    """Verify LLM reasoning is included in query response."""
    response = pageindex_client.post(
        "/query",
        json={
            "query": "What are the security requirements?",
            "max_results": 3,
        },
    )
    assert response.status_code == 200, f"Query failed: {response.text}"

    data = response.json()
    assert "reasoning" in data, "No 'reasoning' field in response"
    # Reasoning should be a non-empty string (LLM's thinking process)
    if data["total_found"] > 0:
        assert data["reasoning"], "Reasoning is empty"


# =============================================================================
# Test: PageIndex Re-indexing
# =============================================================================

def test_pageindex_trigger_reindex(pageindex_client):
    """Trigger re-indexing and verify it completes."""
    response = pageindex_client.post("/index", timeout=300.0)  # Longer timeout for indexing
    assert response.status_code == 200, f"Index trigger failed: {response.text}"

    data = response.json()
    assert data["status"] in ["completed", "already_in_progress"], f"Unexpected status: {data['status']}"

    if data["status"] == "completed":
        assert data["documents_indexed"] > 0, "No documents indexed"
        assert data["total_nodes"] > 0, "No nodes indexed"


# =============================================================================
# Test: Get Document Details
# =============================================================================

def test_pageindex_get_document(pageindex_client):
    """Verify can get individual document details."""
    # First, get a document ID
    docs_response = pageindex_client.get("/documents")
    assert docs_response.status_code == 200
    docs = docs_response.json()["documents"]

    if len(docs) > 0:
        doc_id = docs[0]["doc_id"]

        response = pageindex_client.get(f"/documents/{doc_id}")
        assert response.status_code == 200, f"Get document failed: {response.text}"

        data = response.json()
        assert "doc_id" in data, "Missing doc_id"
        assert "title" in data, "Missing title"
        assert "tree" in data, "Missing tree structure"

        # Tree should have hierarchical structure
        tree = data["tree"]
        assert "title" in tree, "Tree missing title"
        assert "node_id" in tree, "Tree missing node_id"


# =============================================================================
# Summary Test
# =============================================================================

def test_phase1_pageindex_complete(pageindex_client):
    """
    Phase 1 PageIndex Acceptance Criteria.

    Verifies:
    - Documents are indexed from /data/specs
    - LLM reasoning retrieval returns relevant results
    - Section hierarchy (TOC path) is preserved
    - Query results include proper metadata
    - LLM reasoning trace is included
    """
    results = {}

    # 1. Documents are indexed
    try:
        response = pageindex_client.get("/version")
        data = response.json()
        results["documents_indexed"] = data["docs_indexed"] > 0
        results["nodes_indexed"] = data["total_nodes"] > 0
    except Exception:
        results["documents_indexed"] = False
        results["nodes_indexed"] = False

    # 2. LLM reasoning query works
    try:
        response = pageindex_client.post(
            "/query",
            json={"query": "security requirements", "max_results": 3},
        )
        data = response.json()
        results["query_works"] = data["total_found"] > 0
        results["reasoning_included"] = "reasoning" in data and data["reasoning"]
    except Exception:
        results["query_works"] = False
        results["reasoning_included"] = False

    # 3. Results have proper structure
    try:
        response = pageindex_client.post(
            "/query",
            json={"query": "implementation", "max_results": 1},
        )
        data = response.json()
        if data["results"]:
            r = data["results"][0]
            results["result_structure"] = all([
                "doc_id" in r,
                "node_id" in r,
                "title" in r,
                "content" in r,
                "toc_path" in r,
            ])
        else:
            results["result_structure"] = False
    except Exception:
        results["result_structure"] = False

    # Assert all passed
    failed = [k for k, v in results.items() if not v]
    assert not failed, f"Phase 1 PageIndex criteria failed: {failed}"
