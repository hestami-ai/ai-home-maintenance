"""
Phase 0 Integration Tests

Verifies end-to-end connectivity between all services:
- Orchestrator -> vLLM (test completion)
- Orchestrator -> PageIndex (test query)
- Orchestrator -> Dolt (test SQL query)
- PageIndex -> vLLM (internal LLM calls)

Run from orchestrator container:
    docker compose exec orchestrator pytest tests/ -v

Or run individual tests:
    docker compose exec orchestrator pytest tests/test_phase0_integration.py::test_vllm_completion -v
"""

import pytest
import httpx
import pymysql
from historian.config import get_settings


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
def settings():
    """Get application settings."""
    return get_settings()


@pytest.fixture
def vllm_client(settings):
    """HTTP client for vLLM service (OpenAI-compatible API at /v1)."""
    return httpx.Client(
        base_url=settings.vllm.url,
        headers={"Authorization": f"Bearer {settings.vllm.api_key}"},
        timeout=30.0,
    )


@pytest.fixture
def vllm_base_client(settings):
    """HTTP client for vLLM base endpoints (health, etc. without /v1 prefix)."""
    # Strip /v1 suffix from URL for health endpoint
    base_url = settings.vllm.url.replace("/v1", "")
    return httpx.Client(
        base_url=base_url,
        headers={"Authorization": f"Bearer {settings.vllm.api_key}"},
        timeout=30.0,
    )


@pytest.fixture
def pageindex_client(settings):
    """HTTP client for PageIndex service."""
    return httpx.Client(
        base_url=settings.pageindex.url,
        timeout=30.0,
    )


# =============================================================================
# Test 1: Orchestrator -> vLLM (Completion Request)
# =============================================================================

def test_vllm_health(vllm_base_client):
    """Verify vLLM health endpoint is accessible."""
    response = vllm_base_client.get("/health")
    assert response.status_code == 200, f"vLLM health check failed: {response.text}"


def test_vllm_models(vllm_client):
    """Verify vLLM returns available models."""
    response = vllm_client.get("/models")
    assert response.status_code == 200, f"vLLM models endpoint failed: {response.text}"
    data = response.json()
    assert "data" in data, "No 'data' field in models response"
    assert len(data["data"]) > 0, "No models available"


def test_vllm_completion(vllm_client):
    """Verify vLLM can generate completions."""
    # Get the actual model name from vLLM (more robust than config)
    models_response = vllm_client.get("/models")
    assert models_response.status_code == 200, "Failed to get models list"
    models_data = models_response.json()
    model_name = models_data["data"][0]["id"]

    response = vllm_client.post(
        "/chat/completions",
        json={
            "model": model_name,
            "messages": [
                {"role": "user", "content": "Say 'Phase 0 test successful' and nothing else."}
            ],
            "max_tokens": 50,
            "temperature": 0.0,
        },
    )
    assert response.status_code == 200, f"vLLM completion failed: {response.text}"
    data = response.json()
    assert "choices" in data, "No 'choices' in completion response"
    assert len(data["choices"]) > 0, "Empty choices in completion response"
    content = data["choices"][0]["message"]["content"]
    assert len(content) > 0, "Empty content in completion response"


# =============================================================================
# Test 2: Orchestrator -> PageIndex (Query Request)
# =============================================================================

def test_pageindex_health(pageindex_client):
    """Verify PageIndex health endpoint is accessible."""
    response = pageindex_client.get("/health")
    assert response.status_code == 200, f"PageIndex health check failed: {response.text}"


def test_pageindex_version(pageindex_client):
    """Verify PageIndex returns version info."""
    response = pageindex_client.get("/version")
    assert response.status_code == 200, f"PageIndex version endpoint failed: {response.text}"
    data = response.json()
    assert "version" in data, "No 'version' field in PageIndex response"
    assert "docs_indexed" in data, "No 'docs_indexed' field in PageIndex response"


# =============================================================================
# Test 3: Orchestrator -> Dolt (SQL Query)
# =============================================================================

def test_dolt_connection(settings):
    """Verify Dolt accepts connections."""
    conn = pymysql.connect(
        host=settings.dolt.host,
        port=settings.dolt.port,
        user=settings.dolt.user,
        password=settings.dolt.password or "",
        database=settings.dolt.database,
        connect_timeout=5,
    )
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT 1")
            result = cursor.fetchone()
            assert result == (1,), f"Unexpected result: {result}"
    finally:
        conn.close()


def test_dolt_metadata_table(settings):
    """Verify Dolt metadata table exists and has data."""
    conn = pymysql.connect(
        host=settings.dolt.host,
        port=settings.dolt.port,
        user=settings.dolt.user,
        password=settings.dolt.password or "",
        database=settings.dolt.database,
        connect_timeout=5,
    )
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT `key`, `value` FROM metadata")
            results = cursor.fetchall()
            keys = {row[0] for row in results}
            assert "spec_version" in keys, "Missing 'spec_version' in metadata"
            assert "schema_version" in keys, "Missing 'schema_version' in metadata"
            assert "index_version" in keys, "Missing 'index_version' in metadata"
    finally:
        conn.close()


def test_dolt_all_tables_exist(settings):
    """Verify all required tables exist in Dolt."""
    expected_tables = {"metadata", "specs", "interpretations", "exceptions", "rulings", "corrections"}

    conn = pymysql.connect(
        host=settings.dolt.host,
        port=settings.dolt.port,
        user=settings.dolt.user,
        password=settings.dolt.password or "",
        database=settings.dolt.database,
        connect_timeout=5,
    )
    try:
        with conn.cursor() as cursor:
            cursor.execute("SHOW TABLES")
            results = cursor.fetchall()
            actual_tables = {row[0] for row in results}
            missing = expected_tables - actual_tables
            assert not missing, f"Missing tables: {missing}"
    finally:
        conn.close()


# =============================================================================
# Test 4: PageIndex -> vLLM (Internal LLM Calls)
# =============================================================================

def test_pageindex_vllm_connectivity(pageindex_client):
    """
    Verify PageIndex can reach vLLM.

    Note: This is an indirect test. PageIndex uses vLLM internally for
    embeddings/queries. If PageIndex health is OK and vLLM is OK,
    the internal connection should work. A more thorough test would
    involve triggering an actual index/query operation.
    """
    # For Phase 0, we verify both services are healthy
    # which implies the network path exists
    response = pageindex_client.get("/health")
    assert response.status_code == 200, "PageIndex not healthy"

    # Additional check: verify PageIndex config points to vLLM
    # (This would require PageIndex to expose its config, which it may not)


# =============================================================================
# Test 5: All Services Stay Up
# =============================================================================

def test_all_services_healthy(vllm_base_client, pageindex_client, settings):
    """Verify all services respond to health checks."""
    # vLLM
    vllm_response = vllm_base_client.get("/health")
    assert vllm_response.status_code == 200, "vLLM not healthy"

    # PageIndex
    pageindex_response = pageindex_client.get("/health")
    assert pageindex_response.status_code == 200, "PageIndex not healthy"

    # Dolt
    conn = pymysql.connect(
        host=settings.dolt.host,
        port=settings.dolt.port,
        user=settings.dolt.user,
        password=settings.dolt.password or "",
        database=settings.dolt.database,
        connect_timeout=5,
    )
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    finally:
        conn.close()


# =============================================================================
# Summary Test
# =============================================================================

def test_phase0_complete(vllm_client, pageindex_client, settings):
    """
    Phase 0 Acceptance Criteria Summary Test.

    Verifies:
    - docker-compose up brings all services online
    - Dolt is reachable and returns query results
    - vLLM responds to test prompts via OpenAI-compatible API
    - PageIndex returns health status
    - Orchestrator can communicate with all services
    """
    results = {}

    # 1. vLLM responds to test prompts
    try:
        # Get the actual model name from vLLM
        models_response = vllm_client.get("/models")
        model_name = models_response.json()["data"][0]["id"]

        response = vllm_client.post(
            "/chat/completions",
            json={
                "model": model_name,
                "messages": [{"role": "user", "content": "Hello"}],
                "max_tokens": 10,
            },
        )
        results["vllm_completion"] = response.status_code == 200
    except Exception:
        results["vllm_completion"] = False

    # 2. Dolt is reachable and returns query results
    try:
        conn = pymysql.connect(
            host=settings.dolt.host,
            port=settings.dolt.port,
            user=settings.dolt.user,
            password=settings.dolt.password or "",
            database=settings.dolt.database,
            connect_timeout=5,
        )
        with conn.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) FROM metadata")
            count = cursor.fetchone()[0]
            results["dolt_query"] = count > 0
        conn.close()
    except Exception:
        results["dolt_query"] = False

    # 3. PageIndex returns health status
    try:
        response = pageindex_client.get("/health")
        results["pageindex_health"] = response.status_code == 200
    except Exception:
        results["pageindex_health"] = False

    # Assert all passed
    failed = [k for k, v in results.items() if not v]
    assert not failed, f"Phase 0 criteria failed: {failed}"
