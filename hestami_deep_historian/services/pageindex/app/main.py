"""
PageIndex Service - Vectorless, Reasoning-based RAG for Historian Agent Platform.

Integrates VectifyAI PageIndex for hierarchical document indexing and
LLM-based reasoning retrieval. No vector database, no embeddings.

https://github.com/VectifyAI/PageIndex
"""

import asyncio
import json
import os
import re
import urllib.parse
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import aiofiles
import structlog
import tiktoken.model
from fastapi import FastAPI, HTTPException
from openai import AsyncOpenAI
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings

# Register Qwen3 model with tiktoken before importing PageIndex
# Qwen3 uses ~152k token BPE vocab, closest to o200k_base (200k vocab)
# This allows PageIndex's token counting to work with our local vLLM model
tiktoken.model.MODEL_TO_ENCODING["qwen3-4b-thinking"] = "o200k_base"
tiktoken.model.MODEL_PREFIX_TO_ENCODING["qwen3-"] = "o200k_base"

# Import PageIndex components (after tiktoken mapping is set)
from pageindex.page_index_md import md_to_tree
from pageindex.utils import ConfigLoader

logger = structlog.get_logger()

# Error messages
ERR_INDEXER_NOT_INITIALIZED = "Indexer not initialized"
ERR_LLM_NOT_AVAILABLE = "LLM service not available"


class Settings(BaseSettings):
    """Service configuration."""

    docs_dir: str = Field(default="/data/specs", alias="PAGEINDEX_DOCS_DIR")
    index_dir: str = Field(default="/data/index", alias="PAGEINDEX_INDEX_DIR")
    host: str = Field(default="0.0.0.0", alias="PAGEINDEX_HOST")
    port: int = Field(default=8080, alias="PAGEINDEX_PORT")

    # vLLM configuration (OpenAI-compatible API)
    openai_api_key: str = Field(default="local-key", alias="OPENAI_API_KEY")
    openai_base_url: str = Field(default="http://vllm:8000/v1", alias="OPENAI_BASE_URL")
    openai_model: str = Field(default="qwen3-4b-thinking", alias="OPENAI_MODEL")

    # Auto-index on startup
    auto_index: bool = Field(default=True, alias="PAGEINDEX_AUTO_INDEX")

    model_config = {"populate_by_name": True}


settings = Settings()


# Request/Response models
class QueryRequest(BaseModel):
    """Document query request."""

    query: str = Field(description="Search query text")
    doc_filter: str | None = Field(default=None, description="Optional document ID filter")
    max_results: int = Field(default=5, ge=1, le=20, description="Maximum results to return")


class QueryResult(BaseModel):
    """Single query result."""

    doc_id: str
    node_id: str
    title: str
    content: str
    toc_path: str
    start_line: int
    end_line: int


class QueryResponse(BaseModel):
    """Document query response."""

    results: list[QueryResult]
    query: str
    total_found: int
    reasoning: str | None = None


class VersionResponse(BaseModel):
    """Index version response."""

    version: str
    docs_indexed: int
    total_nodes: int
    last_updated: str | None


class HealthResponse(BaseModel):
    """Health check response."""

    status: str
    docs_dir_exists: bool
    index_dir_exists: bool
    indexer_ready: bool
    llm_available: bool


class IndexResponse(BaseModel):
    """Indexing response."""

    status: str
    documents_indexed: int
    total_nodes: int
    duration_seconds: float | None = None


class DocumentInfo(BaseModel):
    """Document metadata."""

    doc_id: str
    title: str
    file_path: str
    node_count: int
    indexed_at: str


# Global state
_document_trees: dict[str, dict[str, Any]] = {}  # doc_id -> tree structure
_document_metadata: dict[str, DocumentInfo] = {}  # doc_id -> metadata
_index_version: str = "not_initialized"
_last_indexed: str | None = None
_indexing_in_progress: bool = False
_openai_client: AsyncOpenAI | None = None


def _get_doc_id(file_path: Path, docs_dir: Path) -> str:
    """Generate document ID from file path."""
    try:
        rel_path = file_path.relative_to(docs_dir)
    except ValueError:
        rel_path = file_path

    # Remove extension and sanitize
    doc_id = str(rel_path.with_suffix(""))
    doc_id = re.sub(r"[^a-zA-Z0-9/_-]+", "_", doc_id)
    return doc_id


def _build_toc_path(node: dict, parent_path: str = "") -> str:
    """Build TOC path for a node."""
    title = node.get("title", "Untitled")
    if parent_path:
        return f"{parent_path} > {title}"
    return title


def _count_nodes(tree: dict) -> int:
    """Count total nodes in a tree."""
    count = 1  # Current node
    for child in tree.get("nodes", []):
        count += _count_nodes(child)
    return count


def _create_node_mapping(tree: dict, mapping: dict | None = None, parent_path: str = "") -> dict:
    """Create a flat mapping of node_id -> node data with TOC paths."""
    if mapping is None:
        mapping = {}

    toc_path = _build_toc_path(tree, parent_path)
    node_id = tree.get("node_id", "root")

    mapping[node_id] = {
        **tree,
        "toc_path": toc_path,
    }

    for child in tree.get("nodes", []):
        _create_node_mapping(child, mapping, toc_path)

    return mapping


def _get_tree_for_llm(
    tree: dict,
    include_summary: bool = True,
    include_metadata: bool = False,
    include_thinking: bool = False,
    max_depth: int = -1,
    current_depth: int = 0
) -> dict:
    """Get tree structure without full text content (for LLM reasoning).

    Args:
        tree: The tree node to process
        include_summary: Whether to include summaries (set False for minimal tree)
        include_metadata: Whether to include extractive metadata (keywords, entities)
        include_thinking: Whether to include thinking content (for debugging/quality review)
        max_depth: Maximum depth to include (-1 for unlimited)
        current_depth: Current recursion depth
    """
    result = {
        "title": tree.get("title", "Untitled"),
        "node_id": tree.get("node_id", "root"),
    }

    if include_summary and "summary" in tree:
        result["summary"] = tree["summary"]

    # Include thinking content if requested (for quality review)
    if include_thinking and "thinking" in tree:
        result["thinking"] = tree["thinking"]

    # Include extractive metadata if requested (keywords, entities)
    if include_metadata and "metadata" in tree:
        metadata = tree["metadata"]
        result["metadata"] = {
            "keywords": metadata.get("keywords", []),
            "entities": metadata.get("entities", {}),
        }

    if "start_line" in tree:
        result["start_line"] = tree["start_line"]
    if "end_line" in tree:
        result["end_line"] = tree["end_line"]

    # Check if we should include children
    if tree.get("nodes") and (max_depth == -1 or current_depth < max_depth):
        result["nodes"] = [
            _get_tree_for_llm(child, include_summary, include_metadata, include_thinking, max_depth, current_depth + 1)
            for child in tree["nodes"]
        ]

    return result


def _get_minimal_tree(tree: dict) -> dict:
    """Get minimal tree structure with only titles and IDs (for document selection)."""
    return _get_tree_for_llm(tree, include_summary=False, max_depth=2)


async def _index_document(file_path: Path) -> tuple[str, dict, int]:
    """Index a single markdown document using PageIndex."""
    docs_dir = Path(settings.docs_dir)
    doc_id = _get_doc_id(file_path, docs_dir)

    logger.info("indexing_document", doc_id=doc_id, file_path=str(file_path))

    # Use PageIndex to build tree structure from markdown
    # Note: PageIndex uses string params 'yes'/'no', not booleans
    result = await md_to_tree(
        md_path=str(file_path),
        if_thinning=False,
        if_add_node_summary="yes",
        summary_token_threshold=200,
        model=settings.openai_model,
        if_add_doc_description="no",
        if_add_node_text="yes",
        if_add_node_id="yes",
    )

    # PageIndex returns {'doc_name': ..., 'structure': [...]}
    # Convert to our expected tree format
    doc_name = result.get("doc_name", doc_id)
    structure = result.get("structure", [])

    # Build tree from structure (structure is a list of nodes)
    tree = _build_tree_from_structure(structure, doc_name)

    node_count = _count_nodes(tree)

    logger.info("document_indexed", doc_id=doc_id, node_count=node_count)

    return doc_id, tree, node_count


def _build_tree_from_structure(structure: list, doc_name: str) -> dict:
    """Convert PageIndex structure array to our tree format."""
    if not structure:
        return {
            "title": doc_name,
            "node_id": "root",
            "nodes": [],
        }

    # If structure is a single dict (the root), use it directly
    if isinstance(structure, dict):
        return _normalize_node(structure, "root")

    # If it's a list with one item, use that as root
    if len(structure) == 1 and isinstance(structure[0], dict):
        return _normalize_node(structure[0], "root")

    # If it's a flat list of nodes, wrap them under a root
    root = {
        "title": doc_name,
        "node_id": "root",
        "nodes": [_normalize_node(node, f"node_{i}") for i, node in enumerate(structure)],
    }
    return root


def _extract_keywords_extractive(text: str, max_keywords: int = 10) -> list[str]:
    """
    Extract keywords purely extractively (no interpretation).

    Uses simple heuristics:
    - Capitalized technical terms (PostgreSQL, RLS, Docker)
    - ALL_CAPS identifiers
    - Common technical patterns (snake_case, camelCase, kebab-case)
    """
    if not text:
        return []

    import re

    keywords = set()

    # Pattern 1: Capitalized technical terms (2-30 chars)
    capitalized = re.findall(r'\b[A-Z][A-Za-z0-9]{1,29}\b', text)
    keywords.update(capitalized)

    # Pattern 2: ALL_CAPS identifiers
    all_caps = re.findall(r'\b[A-Z][A-Z_]{2,29}\b', text)
    keywords.update(all_caps)

    # Pattern 3: snake_case identifiers
    snake_case = re.findall(r'\b[a-z]+_[a-z_]+\b', text)
    keywords.update(snake_case)

    # Pattern 4: Quoted technical terms
    quoted = re.findall(r'`([^`]+)`', text)
    keywords.update(quoted)

    # Pattern 5: Common tech acronyms (2-5 uppercase letters)
    acronyms = re.findall(r'\b[A-Z]{2,5}\b', text)
    keywords.update(acronyms)

    # Filter out common words and sort by frequency
    common_words = {'THE', 'AND', 'FOR', 'WITH', 'THIS', 'THAT', 'FROM', 'WILL'}
    keywords = [k for k in keywords if k.upper() not in common_words and len(k) > 1]

    # Return top N by frequency in text
    keyword_counts = [(kw, text.count(kw)) for kw in keywords]
    keyword_counts.sort(key=lambda x: -x[1])

    return [kw for kw, _ in keyword_counts[:max_keywords]]


def _extract_entities_extractive(text: str) -> dict[str, list[str]]:
    """
    Extract technical entities purely extractively (no interpretation).

    Returns:
        {
            "tables": [...],      # SQL table-like patterns
            "functions": [...],   # function_name patterns
            "endpoints": [...],   # /api/path patterns
            "files": [...],       # file.ext patterns
        }
    """
    if not text:
        return {"tables": [], "functions": [], "endpoints": [], "files": []}

    import re

    entities = {
        "tables": [],
        "functions": [],
        "endpoints": [],
        "files": [],
    }

    # Extract SQL table references (common patterns)
    # e.g., "FROM users", "JOIN organizations", "TABLE foo_bar"
    tables = re.findall(r'(?:FROM|JOIN|TABLE|INSERT INTO|UPDATE|DELETE FROM)\s+([a-z_]+)', text, re.IGNORECASE)
    entities["tables"] = list(set(tables))[:10]

    # Extract function-like patterns
    # e.g., "enable_rls()", "create_policy", "getUserById"
    functions = re.findall(r'\b([a-z_][a-z0-9_]*)\s*\(', text, re.IGNORECASE)
    entities["functions"] = list(set(functions))[:10]

    # Extract API endpoint patterns
    # e.g., "/api/users", "/v1/auth/login"
    endpoints = re.findall(r'(/[a-z0-9/_-]+(?:/[a-z0-9_-]+)*)', text, re.IGNORECASE)
    entities["endpoints"] = [e for e in set(endpoints) if '/' in e and len(e) > 3][:10]

    # Extract file references
    # e.g., "config.yaml", "schema.prisma", ".env"
    files = re.findall(r'\b([a-z0-9_.-]+\.[a-z]{2,5})\b', text, re.IGNORECASE)
    entities["files"] = list(set(files))[:10]

    return entities


def _add_extractive_metadata(node: dict) -> dict:
    """
    Add purely extractive metadata to a node.

    Metadata is factual, not interpretive:
    - Keywords: Terms that appear in the text
    - Entities: Technical patterns found in text
    - Structure: Factual tree position data
    """
    # Extract from text if available
    text = node.get("text", "")
    summary = node.get("summary", "")
    combined_text = f"{text}\n{summary}"

    # Extractive keywords
    keywords = _extract_keywords_extractive(combined_text, max_keywords=10)

    # Extractive entities
    entities = _extract_entities_extractive(combined_text)

    # Structural metadata (purely factual)
    metadata = {
        "keywords": keywords,
        "entities": entities,
        "structure": {
            "depth": node.get("depth", 0),
            "has_children": bool(node.get("nodes")),
            "child_count": len(node.get("nodes", [])),
        }
    }

    node["metadata"] = metadata
    return node


def _clean_summary(summary: str, text: str, node_id: str = "unknown") -> tuple[str, str]:
    """
    Clean and validate a summary, handling Qwen3 thinking tags.

    Returns (cleaned_summary, thinking_content).

    Handles two issues:
    1. Extracts thinking content (before </think>) into separate field
    2. Detects when summary is just a copy of text
    """
    if not summary:
        return "", ""

    thinking_content = ""
    cleaned_summary = summary

    # Issue 1: Extract thinking content from Qwen3 </think> tag
    if "</think>" in summary:
        parts = summary.split("</think>", 1)
        thinking_content = parts[0].strip()
        cleaned_summary = parts[1].strip() if len(parts) > 1 else ""

        logger.debug(
            "summary_thinking_extracted",
            node_id=node_id,
            thinking_chars=len(thinking_content),
            summary_chars=len(cleaned_summary),
        )

    # Issue 2: Detect if summary is just a copy of the text
    # Compare after normalizing whitespace
    normalized_summary = " ".join(cleaned_summary.split())
    normalized_text = " ".join(text.split())

    if normalized_summary == normalized_text and len(normalized_summary) > 0:
        logger.warning(
            "summary_is_copy_of_text",
            node_id=node_id,
            text_length=len(text),
        )

        # Summary is identical to text - extract first sentence as fallback
        import re
        sentences = re.split(r'[.!?]\s+', cleaned_summary.strip())
        if sentences and len(sentences[0]) > 10:
            cleaned_summary = sentences[0] + "."
            logger.debug(
                "summary_extracted_first_sentence",
                node_id=node_id,
                sentence_length=len(cleaned_summary),
            )
        else:
            # Text too short or no sentences - use empty summary
            cleaned_summary = ""
            logger.debug("summary_too_short_cleared", node_id=node_id)

    return cleaned_summary, thinking_content


def _normalize_node(node: dict, default_id: str, depth: int = 0) -> dict:
    """Normalize a PageIndex node to our expected format."""
    normalized = {
        "title": node.get("title", node.get("name", "Untitled")),
        "node_id": node.get("node_id", node.get("id", default_id)),
        "depth": depth,
    }

    # Copy text field
    text = node.get("text", "")
    if text:
        normalized["text"] = text

    # Clean and validate summary, extract thinking content
    raw_summary = node.get("summary", "")
    if raw_summary:
        cleaned_summary, thinking = _clean_summary(
            raw_summary, text, node_id=normalized["node_id"]
        )

        if cleaned_summary:
            normalized["summary"] = cleaned_summary

        # Store thinking content separately for quality review
        if thinking:
            normalized["thinking"] = thinking

    # Copy line numbers
    if "start_line" in node:
        normalized["start_line"] = node["start_line"]
    if "end_line" in node:
        normalized["end_line"] = node["end_line"]

    # Recursively process children
    children = node.get("nodes", node.get("children", node.get("sub_nodes", [])))
    if children:
        normalized["nodes"] = [
            _normalize_node(child, f"{default_id}_{i}", depth + 1)
            for i, child in enumerate(children)
        ]

    # Add extractive metadata (keywords, entities, structure)
    normalized = _add_extractive_metadata(normalized)

    return normalized


async def _index_all_documents() -> dict[str, int]:
    """Index all markdown documents in the docs directory."""
    global _document_trees, _document_metadata, _index_version, _last_indexed

    docs_dir = Path(settings.docs_dir)
    md_files = list(docs_dir.glob("**/*.md"))

    logger.info("indexing_all_documents", count=len(md_files))

    results = {}

    for file_path in md_files:
        try:
            doc_id, tree, node_count = await _index_document(file_path)

            _document_trees[doc_id] = tree
            _document_metadata[doc_id] = DocumentInfo(
                doc_id=doc_id,
                title=tree.get("title", doc_id),
                file_path=str(file_path),
                node_count=node_count,
                indexed_at=datetime.now(timezone.utc).isoformat(),
            )

            results[doc_id] = node_count

        except Exception as e:
            logger.error("indexing_failed", doc_id=str(file_path), error=str(e))

    # Save index to disk
    index_file = Path(settings.index_dir) / "pageindex.json"
    index_file.parent.mkdir(parents=True, exist_ok=True)

    index_data = {
        "trees": _document_trees,
        "metadata": {k: v.model_dump() for k, v in _document_metadata.items()},
        "indexed_at": datetime.now(timezone.utc).isoformat(),
    }

    async with aiofiles.open(index_file, "w", encoding="utf-8") as f:
        await f.write(json.dumps(index_data, indent=2, ensure_ascii=False))

    total_nodes = sum(results.values())
    _index_version = f"v1_{len(results)}docs_{total_nodes}nodes"
    _last_indexed = datetime.now(timezone.utc).isoformat()

    logger.info(
        "indexing_complete",
        documents=len(results),
        total_nodes=total_nodes,
    )

    return results


async def _load_index_from_disk() -> bool:
    """Load existing index from disk if available."""
    global _document_trees, _document_metadata, _index_version, _last_indexed

    index_file = Path(settings.index_dir) / "pageindex.json"

    if not index_file.exists():
        return False

    try:
        async with aiofiles.open(index_file, encoding="utf-8") as f:
            content = await f.read()
            index_data = json.loads(content)

        _document_trees = index_data.get("trees", {})
        _document_metadata = {
            k: DocumentInfo(**v)
            for k, v in index_data.get("metadata", {}).items()
        }
        _last_indexed = index_data.get("indexed_at")

        total_nodes = sum(m.node_count for m in _document_metadata.values())
        _index_version = f"v1_{len(_document_trees)}docs_{total_nodes}nodes"

        logger.info(
            "index_loaded_from_disk",
            documents=len(_document_trees),
            total_nodes=total_nodes,
        )

        return True

    except Exception as e:
        logger.warning("failed_to_load_index", error=str(e))
        return False


def _parse_llm_response(response_text: str) -> tuple[str, str]:
    """
    Parse LLM response, handling Qwen3 thinking tags and code blocks.

    Returns (json_text, thinking_content).
    """
    # Handle Qwen3 thinking mode output
    # NOTE: Qwen3-4B-Thinking template adds <think> automatically, so output
    # contains only </think> without opening tag. Content before </think> is
    # the model's reasoning, content after is the actual response.
    thinking_content = ""
    if "</think>" in response_text:
        parts = response_text.split("</think>", 1)
        thinking_content = parts[0].strip()
        response_text = parts[1].strip() if len(parts) > 1 else ""

    # Handle markdown code blocks
    if "```json" in response_text:
        response_text = response_text.split("```json")[1].split("```")[0]
    elif "```" in response_text:
        parts = response_text.split("```")
        if len(parts) >= 2:
            response_text = parts[1]

    # Try to find JSON object in the response
    response_text = response_text.strip()
    if response_text and not response_text.startswith("{"):
        json_match = re.search(r"\{.*\}", response_text, re.DOTALL)
        if json_match:
            response_text = json_match.group(0)

    return response_text, thinking_content


def _build_query_results(node_refs: list, max_results: int) -> list[QueryResult]:
    """Build QueryResult list from node references."""
    results = []
    for ref in node_refs[:max_results]:
        doc_id = ref.get("doc_id")
        node_id = ref.get("node_id")

        if doc_id not in _document_trees:
            continue

        node_mapping = _create_node_mapping(_document_trees[doc_id])

        if node_id not in node_mapping:
            continue

        node = node_mapping[node_id]
        results.append(QueryResult(
            doc_id=doc_id,
            node_id=node_id,
            title=node.get("title", "Untitled"),
            content=node.get("text", node.get("summary", "")),
            toc_path=node.get("toc_path", ""),
            start_line=node.get("start_line", 0),
            end_line=node.get("end_line", 0),
        ))

    return results


async def _score_document_relevance(
    doc_id: str,
    tree: dict,
    query: str,
) -> tuple[str, float, str]:
    """
    Score a single document's relevance to a query.

    Returns (doc_id, relevance_score, reasoning).
    Score is 0.0 to 1.0, where 1.0 is most relevant.

    Since we're scoring one document at a time, we can afford to send
    a richer representation including summaries and deeper hierarchy.
    """
    if _openai_client is None:
        raise HTTPException(status_code=503, detail=ERR_LLM_NOT_AVAILABLE)

    # Use richer tree representation: summaries, metadata, go deeper
    # We have ~90K token budget per doc, so depth 4 with summaries + metadata is fine
    rich_tree = _get_tree_for_llm(tree, include_summary=True, include_metadata=True, max_depth=4)
    tree_json = json.dumps({doc_id: rich_tree}, indent=2)

    scoring_prompt = f"""You are given a question and ONE specification document structure.
The document includes:
- Section titles and hierarchical structure
- Summaries of each section
- Extractive metadata: keywords found in text, technical entities (tables, functions, endpoints, files)

Your task is to rate how likely this document contains information relevant to answering the question.

Question: {query}

Document structure (with summaries and extractive metadata):
{tree_json}

Analyze the document structure to determine relevance.
Consider:
- Does the document title or main sections relate to the question?
- Do any section summaries mention relevant concepts or topics?
- Do the extractive keywords match terms in the question?
- Do the technical entities (tables, functions, endpoints) relate to what's being asked?
- Does the hierarchical organization suggest the document covers the right domain?

Rate the document's relevance on a scale from 0.0 to 1.0:
- 1.0: Highly relevant, very likely to contain the answer
- 0.7-0.9: Relevant, likely contains useful information
- 0.4-0.6: Possibly relevant, might contain related information
- 0.1-0.3: Unlikely to be relevant
- 0.0: Not relevant at all

Reply in the following JSON format:
{{
    "reasoning": "<Brief explanation of why this document is or isn't relevant, citing specific sections/keywords/entities>",
    "relevance_score": <number between 0.0 and 1.0>
}}

Return the JSON directly."""

    try:
        response = await _openai_client.chat.completions.create(
            model=settings.openai_model,
            messages=[{"role": "user", "content": scoring_prompt}],
            temperature=0,
        )

        raw_response = response.choices[0].message.content or "{}"
        json_text, thinking_content = _parse_llm_response(raw_response)

        if not json_text or json_text == "{}":
            # Fallback: score as 0.5 (unknown relevance)
            return doc_id, 0.5, thinking_content or "Scoring failed"

        result_json = json.loads(json_text)
        score = float(result_json.get("relevance_score", 0.5))
        reasoning = result_json.get("reasoning", thinking_content) or thinking_content

        # Clamp score to [0.0, 1.0]
        score = max(0.0, min(1.0, score))

        return doc_id, score, reasoning

    except (json.JSONDecodeError, ValueError, TypeError) as e:
        logger.warning("doc_scoring_failed", doc_id=doc_id, error=str(e))
        # Fallback: score as 0.5 (unknown relevance)
        return doc_id, 0.5, f"Scoring failed: {str(e)}"


async def _select_relevant_documents(query: str, max_docs: int = 3) -> tuple[list[str], str]:
    """
    Stage 1: Select relevant documents using sequential scoring.

    Scores each document individually (one-by-one) to avoid overwhelming
    the LLM with too many documents at once. This trades performance
    (more LLM calls) for accuracy (focused evaluation per document).

    Returns list of doc_ids and reasoning.
    """
    if _openai_client is None:
        raise HTTPException(status_code=503, detail=ERR_LLM_NOT_AVAILABLE)

    if not _document_trees:
        return [], "No documents indexed"

    total_docs = len(_document_trees)
    start_time = datetime.now(timezone.utc)

    logger.info(
        "stage1_sequential_scoring_start",
        query=query[:100],
        total_docs=total_docs,
        max_docs=max_docs,
    )

    # Score each document individually
    scored_docs: list[tuple[str, float, str]] = []

    for idx, (doc_id, tree) in enumerate(_document_trees.items(), 1):
        try:
            doc_id_result, score, reasoning = await _score_document_relevance(
                doc_id, tree, query
            )
            scored_docs.append((doc_id_result, score, reasoning))

            # Log every document score at info level for observability
            logger.info(
                "doc_scored",
                progress=f"{idx}/{total_docs}",
                percent=f"{(idx/total_docs)*100:.1f}%",
                doc_id=doc_id[:60],  # Truncate long doc IDs
                score=f"{score:.2f}",
            )

            # Log milestone progress every 10 documents
            if idx % 10 == 0:
                elapsed = (datetime.now(timezone.utc) - start_time).total_seconds()
                avg_time_per_doc = elapsed / idx
                remaining_docs = total_docs - idx
                eta_seconds = avg_time_per_doc * remaining_docs

                logger.info(
                    "scoring_progress_milestone",
                    completed=idx,
                    total=total_docs,
                    elapsed_sec=f"{elapsed:.1f}",
                    eta_sec=f"{eta_seconds:.1f}",
                    avg_sec_per_doc=f"{avg_time_per_doc:.2f}",
                )

        except Exception as e:
            logger.warning(
                "doc_scoring_error",
                doc_id=doc_id,
                error=str(e),
            )
            # Add with low score so it's not selected
            scored_docs.append((doc_id, 0.0, f"Error: {str(e)}"))

    # Sort by score (descending) and take top N
    scored_docs.sort(key=lambda x: -x[1])
    top_docs = scored_docs[:max_docs]

    selected_doc_ids = [doc_id for doc_id, _, _ in top_docs]

    # Create combined reasoning showing top scored documents
    reasoning_lines = [
        f"Scored {total_docs} documents individually. Top {len(top_docs)} selected:",
    ]
    for doc_id, score, reason in top_docs:
        reasoning_lines.append(f"- {doc_id} (score: {score:.2f}): {reason[:100]}")

    combined_reasoning = "\n".join(reasoning_lines)

    total_elapsed = (datetime.now(timezone.utc) - start_time).total_seconds()

    logger.info(
        "stage1_sequential_scoring_complete",
        selected_docs=selected_doc_ids,
        top_scores=[f"{score:.2f}" for _, score, _ in top_docs],
        total_elapsed_sec=f"{total_elapsed:.1f}",
        avg_sec_per_doc=f"{total_elapsed/total_docs:.2f}",
    )

    return selected_doc_ids, combined_reasoning


async def _query_within_documents(
    query: str,
    doc_ids: list[str],
    max_results: int = 5,
) -> tuple[list[QueryResult], str]:
    """
    Stage 2: Query within specific documents using full tree structure.
    """
    if _openai_client is None:
        raise HTTPException(status_code=503, detail=ERR_LLM_NOT_AVAILABLE)

    # Get full tree structure for selected documents only
    trees_for_llm = {
        doc_id: _get_tree_for_llm(_document_trees[doc_id], include_summary=True)
        for doc_id in doc_ids
        if doc_id in _document_trees
    }

    if not trees_for_llm:
        return [], "No valid documents to search"

    trees_json = json.dumps(trees_for_llm, indent=2)
    search_prompt = f"""You are given a question and tree structures of specification documents.
Each node contains a node_id, title, and optionally a summary.
Your task is to find all nodes that are likely to contain the answer to the question.

Question: {query}

Document tree structures:
{trees_json}

Please reply in the following JSON format:
{{
    "thinking": "<Your reasoning about which nodes are relevant to the question>",
    "results": [
        {{"doc_id": "<document_id>", "node_id": "<node_id>"}},
        ...
    ]
}}

Return at most {max_results} most relevant nodes.
Directly return the final JSON structure. Do not output anything else."""

    logger.info(
        "stage2_prompt_size",
        trees_json_bytes=len(trees_json),
        prompt_chars=len(search_prompt),
        num_docs=len(trees_for_llm),
        doc_ids=list(trees_for_llm.keys()),
    )

    try:
        response = await _openai_client.chat.completions.create(
            model=settings.openai_model,
            messages=[{"role": "user", "content": search_prompt}],
            temperature=0,
        )

        raw_response = response.choices[0].message.content or "{}"
        logger.debug("llm_node_search_response", response=raw_response[:500])

        json_text, thinking_content = _parse_llm_response(raw_response)

        if not json_text or json_text == "{}":
            logger.warning("llm_empty_response")
            return [], thinking_content or "No results found"

        result_json = json.loads(json_text)
        reasoning = result_json.get("thinking", thinking_content) or thinking_content
        node_refs = result_json.get("results", [])

        results = _build_query_results(node_refs, max_results)
        return results, reasoning

    except json.JSONDecodeError as e:
        logger.error("llm_json_parse_failed", error=str(e))
        return [], f"Failed to parse LLM response: {str(e)}"
    except Exception as e:
        logger.error("llm_query_failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"LLM query failed: {str(e)}")


async def _query_with_llm_reasoning(
    query: str,
    doc_filter: str | None = None,
    max_results: int = 5,
) -> tuple[list[QueryResult], str]:
    """
    Query documents using LLM reasoning over tree structure.

    Uses a two-stage hierarchical approach:
    1. Stage 1: Select relevant documents using minimal tree (titles only)
    2. Stage 2: Search within selected documents using full tree

    This keeps the prompt within context limits while maintaining quality.
    """
    if _openai_client is None:
        raise HTTPException(status_code=503, detail=ERR_LLM_NOT_AVAILABLE)

    if not _document_trees:
        return [], "No documents indexed"

    # If specific document requested, skip stage 1
    if doc_filter and doc_filter in _document_trees:
        doc_ids = [doc_filter]
        stage1_reasoning = f"User specified document: {doc_filter}"
    else:
        # Stage 1: Select relevant documents
        logger.info("query_stage1_doc_selection", query=query[:100])
        doc_ids, stage1_reasoning = await _select_relevant_documents(query, max_docs=3)
        logger.info("query_stage1_complete", selected_docs=doc_ids)

    # Stage 2: Query within selected documents
    logger.info("query_stage2_node_search", query=query[:100], doc_ids=doc_ids)
    results, stage2_reasoning = await _query_within_documents(query, doc_ids, max_results)

    # Combine reasoning from both stages
    combined_reasoning = f"Document selection: {stage1_reasoning}\n\nNode search: {stage2_reasoning}"

    return results, combined_reasoning


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    global _openai_client

    logger.info(
        "pageindex_startup",
        docs_dir=settings.docs_dir,
        index_dir=settings.index_dir,
        llm_base=settings.openai_base_url,
    )

    # Ensure directories exist
    Path(settings.docs_dir).mkdir(parents=True, exist_ok=True)
    Path(settings.index_dir).mkdir(parents=True, exist_ok=True)

    # Initialize OpenAI client pointing to local vLLM
    _openai_client = AsyncOpenAI(
        api_key=settings.openai_api_key,
        base_url=settings.openai_base_url,
    )

    # Try to load existing index
    loaded = await _load_index_from_disk()

    # Auto-index if enabled and no documents loaded
    if settings.auto_index and not loaded:
        logger.info("auto_indexing_on_startup")
        try:
            await _index_all_documents()
        except Exception as e:
            logger.error("auto_indexing_failed", error=str(e))

    logger.info(
        "pageindex_ready",
        documents=len(_document_trees),
        total_nodes=sum(m.node_count for m in _document_metadata.values()),
    )

    yield

    # Cleanup
    logger.info("pageindex_shutdown")


app = FastAPI(
    title="PageIndex Service",
    description="Vectorless, Reasoning-based RAG for Historian Agent Platform",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint."""
    llm_available = False
    if _openai_client:
        try:
            # Quick check if vLLM is reachable
            await _openai_client.models.list()
            llm_available = True
        except Exception:
            pass

    return HealthResponse(
        status="ok" if _document_trees and llm_available else "degraded",
        docs_dir_exists=Path(settings.docs_dir).exists(),
        index_dir_exists=Path(settings.index_dir).exists(),
        indexer_ready=len(_document_trees) > 0,
        llm_available=llm_available,
    )


@app.get("/version", response_model=VersionResponse)
async def version():
    """Get current index version and stats."""
    return VersionResponse(
        version=_index_version,
        docs_indexed=len(_document_trees),
        total_nodes=sum(m.node_count for m in _document_metadata.values()),
        last_updated=_last_indexed,
    )


@app.get("/debug/prompt-sizes")
async def debug_prompt_sizes():
    """
    Debug endpoint: Show prompt sizes for queries without making LLM calls.

    This helps diagnose context length issues.
    """
    if not _document_trees:
        return {"error": "No documents indexed"}

    # Stage 1: Minimal trees (titles only, depth 2)
    minimal_trees = {
        doc_id: _get_minimal_tree(tree)
        for doc_id, tree in _document_trees.items()
    }
    minimal_json = json.dumps(minimal_trees, indent=2)

    # Stage 2: Full trees for first 3 docs (simulating selected docs)
    sample_doc_ids = list(_document_trees.keys())[:3]
    sample_full_trees = {
        doc_id: _get_tree_for_llm(_document_trees[doc_id], include_summary=True)
        for doc_id in sample_doc_ids
    }
    sample_full_json = json.dumps(sample_full_trees, indent=2)

    # Calculate per-document sizes
    per_doc_sizes = {
        doc_id: len(json.dumps(_get_tree_for_llm(tree, include_summary=True)))
        for doc_id, tree in _document_trees.items()
    }

    return {
        "stage1_minimal_trees": {
            "num_docs": len(minimal_trees),
            "json_bytes": len(minimal_json),
            "estimated_tokens": len(minimal_json) // 4,  # rough estimate
        },
        "stage2_sample_full_trees": {
            "num_docs": len(sample_full_trees),
            "doc_ids": sample_doc_ids,
            "json_bytes": len(sample_full_json),
            "estimated_tokens": len(sample_full_json) // 4,
        },
        "per_document_sizes_bytes": per_doc_sizes,
        "total_full_index_bytes": sum(per_doc_sizes.values()),
        "largest_docs": sorted(per_doc_sizes.items(), key=lambda x: -x[1])[:5],
    }


@app.post("/query", response_model=QueryResponse)
async def query(request: QueryRequest):
    """
    Query documents for relevant sections.

    Uses LLM reasoning over hierarchical tree structure to find
    the most relevant document sections.
    """
    if not _document_trees:
        raise HTTPException(status_code=503, detail=ERR_INDEXER_NOT_INITIALIZED)

    logger.info(
        "pageindex_query",
        query=request.query[:100],
        doc_filter=request.doc_filter,
        max_results=request.max_results,
    )

    results, reasoning = await _query_with_llm_reasoning(
        query=request.query,
        doc_filter=request.doc_filter,
        max_results=request.max_results,
    )

    return QueryResponse(
        results=results,
        query=request.query,
        total_found=len(results),
        reasoning=reasoning,
    )


@app.post("/index", response_model=IndexResponse)
async def trigger_index():
    """
    Trigger re-indexing of all documents.

    This rebuilds the entire index from the documents directory.
    """
    global _indexing_in_progress

    if _indexing_in_progress:
        return IndexResponse(
            status="already_in_progress",
            documents_indexed=0,
            total_nodes=0,
        )

    logger.info("pageindex_reindex_triggered")

    try:
        _indexing_in_progress = True
        start_time = datetime.now(timezone.utc)

        results = await _index_all_documents()

        duration = (datetime.now(timezone.utc) - start_time).total_seconds()

        logger.info(
            "pageindex_reindex_complete",
            documents=len(results),
            total_nodes=sum(results.values()),
            duration=duration,
        )

        return IndexResponse(
            status="completed",
            documents_indexed=len(results),
            total_nodes=sum(results.values()),
            duration_seconds=round(duration, 2),
        )

    except Exception as e:
        logger.error("pageindex_reindex_failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Indexing failed: {str(e)}")

    finally:
        _indexing_in_progress = False


@app.get("/documents")
async def list_documents():
    """List all indexed documents."""
    if not _document_metadata:
        raise HTTPException(status_code=503, detail=ERR_INDEXER_NOT_INITIALIZED)

    return {
        "documents": [
            {
                "doc_id": doc.doc_id,
                "title": doc.title,
                "node_count": doc.node_count,
                "indexed_at": doc.indexed_at,
            }
            for doc in _document_metadata.values()
        ],
        "total": len(_document_metadata),
    }


@app.get("/documents/{doc_id:path}")
async def get_document(doc_id: str):
    """Get metadata and tree structure for a specific document."""
    if not _document_metadata:
        raise HTTPException(status_code=503, detail=ERR_INDEXER_NOT_INITIALIZED)

    # URL decode the doc_id
    doc_id = urllib.parse.unquote(doc_id)

    if doc_id not in _document_metadata:
        raise HTTPException(status_code=404, detail=f"Document not found: {doc_id}")

    metadata = _document_metadata[doc_id]
    tree = _document_trees.get(doc_id, {})

    return {
        "doc_id": metadata.doc_id,
        "title": metadata.title,
        "file_path": metadata.file_path,
        "node_count": metadata.node_count,
        "indexed_at": metadata.indexed_at,
        "tree": _get_tree_for_llm(tree),  # Return tree without full text
    }
