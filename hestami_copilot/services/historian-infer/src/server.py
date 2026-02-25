"""
Historian Inference Server

Serves the Historian model for adjudication requests.
Supports LoRA adapter hot-swapping for model updates.
"""

import os
import json
import logging
import re
from pathlib import Path
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn

from src.validators import (
    # Anchor sufficiency
    assess_anchor_sufficiency,
    generate_verification_queries,
    recommend_status,
    SufficiencyLevel,
    # Citation validation
    validate_response_citations,
    CitationValidationResult,
    # Schema validation
    validate_response_schema,
    validate_json_structure,
    SchemaValidationResult,
    # ID checking
    validate_ids,
    IDValidationResult,
    # Static verifier
    verify_response,
    StaticVerifierResult,
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Environment configuration
MODEL_PATH = os.getenv("MODEL_PATH", "/models/base")
ADAPTER_PATH = os.getenv("ADAPTER_PATH", "/models/adapters/current")
PORT = int(os.getenv("PORT", "8000"))
MAX_TOKENS = int(os.getenv("MAX_TOKENS", "1024"))

# vLLM backend configuration
VLLM_URL = os.getenv("VLLM_URL", "http://localhost:8001")
VLLM_MODEL_NAME = os.getenv("VLLM_MODEL_NAME", "historian")
VLLM_TIMEOUT = int(os.getenv("VLLM_TIMEOUT", "120"))  # seconds

# Schema and prompt paths
SCHEMAS_DIR = Path(__file__).parent.parent.parent / "schemas"
PROMPTS_DIR = Path(__file__).parent.parent / "prompts"

app = FastAPI(
    title="Historian Inference Service",
    description="Adjudication service for the Historian agent",
    version="0.1.0",
)


class AdjudicationRequest(BaseModel):
    """Request for proposal adjudication (mirrors ActionProposal schema)"""
    action_id: str
    feature: str
    description: str
    steps: list[str]
    expected_outcome: str
    preconditions: list[str] = []
    dependencies: list[str] = []
    risks: list[str] = []
    assumptions: list[str] = []
    invariants: list[str] = []
    spec_refs: list[str] = []
    evidence_bundle: list[dict] = []


class AnchorSufficiency(BaseModel):
    """Assessment of evidence bundle sufficiency"""
    sufficient: bool
    missing_anchors: list[str] = []
    reason: Optional[str] = None


class SupersessionNote(BaseModel):
    """Note about superseded decisions or specs"""
    old_id: str
    new_id: str
    note: str


class EvidenceItem(BaseModel):
    """A single piece of evidence"""
    source: str  # spec, guideline, decision, discussion
    id: str
    excerpt: str


class AdjudicationResponse(BaseModel):
    """Response from Historian adjudication"""
    action_id: Optional[str]
    status: str  # CONSISTENT, INCONSISTENT, CONDITIONAL, UNKNOWN
    anchor_sufficiency: Optional[AnchorSufficiency] = None
    evidence: list[EvidenceItem] = []
    conflicts: list[str] = []
    conditions: list[str] = []
    verification_queries: list[str] = []
    supersession_notes: list[SupersessionNote] = []
    comments: str = ""


class ModelInfo(BaseModel):
    """Current model configuration"""
    base_model: str
    adapter_id: Optional[str]
    adapter_path: Optional[str]
    max_tokens: int
    status: str


# Global model state (placeholder)
current_adapter_id: Optional[str] = None


def load_schema(name: str) -> dict:
    """Load a JSON schema from the schemas directory"""
    schema_path = SCHEMAS_DIR / f"{name}.json"
    if schema_path.exists():
        with open(schema_path) as f:
            return json.load(f)
    return {}


def load_system_prompt() -> str:
    """Load the Historian system prompt from file"""
    prompt_path = PROMPTS_DIR / "system-prompt.md"
    if prompt_path.exists():
        with open(prompt_path, "r", encoding="utf-8") as f:
            return f.read()

    # Fallback minimal prompt if file not found
    logger.warning(f"System prompt not found at {prompt_path}, using fallback")
    return """You are the Historian, a constitutional adjudicator.

You MUST respond with valid JSON only. Status values: CONSISTENT, INCONSISTENT, CONDITIONAL, UNKNOWN.
You MUST cite evidence for every normative claim.
If evidence is insufficient, return UNKNOWN with verification_queries.
Never hallucinate specifications."""


# Cache the system prompt on startup
_system_prompt: Optional[str] = None


def get_system_prompt() -> str:
    """Get the cached system prompt"""
    global _system_prompt
    if _system_prompt is None:
        _system_prompt = load_system_prompt()
        logger.info(f"Loaded system prompt ({len(_system_prompt)} chars)")
    return _system_prompt


def format_proposal_for_inference(request: AdjudicationRequest) -> str:
    """Format the proposal as input for the model with explicit evaluation structure"""
    # Format evidence bundle
    evidence_text = "\n## EVIDENCE BUNDLE\n"
    if request.evidence_bundle:
        for i, item in enumerate(request.evidence_bundle, 1):
            source = item.get('source', 'unknown')
            item_id = item.get('id', 'N/A')
            excerpt = item.get('excerpt', '')
            claim = item.get('claim', '')
            evidence_text += f"\n### Evidence #{i}\n"
            evidence_text += f"- **Source**: {source}\n"
            evidence_text += f"- **ID**: {item_id}\n"
            evidence_text += f"- **Excerpt**: \"{excerpt}\"\n"
            if claim:
                evidence_text += f"- **Supports Claim**: {claim}\n"
    else:
        evidence_text += "\n**EMPTY** - No evidence provided.\n"

    # Format spec refs
    spec_refs_text = ""
    if hasattr(request, 'spec_refs') and request.spec_refs:
        spec_refs_text = f"\n## DECLARED SPEC REFERENCES\n{chr(10).join(f'- {ref}' for ref in request.spec_refs)}\n"

    return f"""# ACTION PROPOSAL FOR ADJUDICATION

## METADATA
- **Action ID**: {request.action_id}
- **Feature**: {request.feature}

## DESCRIPTION
{request.description}

## PROPOSED STEPS
{chr(10).join(f'{i}. {step}' for i, step in enumerate(request.steps, 1))}

## EXPECTED OUTCOME
{request.expected_outcome}

## STATED ASSUMPTIONS
{chr(10).join(f'- {a}' for a in request.assumptions) if request.assumptions else '- None declared'}

## STATED INVARIANTS
{chr(10).join(f'- {inv}' for inv in request.invariants) if request.invariants else '- None declared'}
{spec_refs_text}{evidence_text}
---

Execute your evaluation protocol and respond with a JSON object containing:
action_id, status, anchor_sufficiency, evidence, conflicts, conditions, verification_queries, supersession_notes, comments"""


def extract_json_from_response(content: str) -> str:
    """
    Extract JSON from model response, handling various formats:
    1. Qwen3 thinking tags: <think>...</think> followed by JSON
    2. Markdown code blocks: ```json ... ``` or ``` ... ```
    3. Raw JSON
    """
    json_content = content

    # Step 1: Remove Qwen3 thinking tags if present
    if "<think>" in content:
        # Extract everything after </think>
        think_match = re.search(r"</think>\s*(.*)", content, re.DOTALL)
        if think_match:
            json_content = think_match.group(1).strip()
            logger.info(f"Extracted content after </think> tag ({len(json_content)} chars)")
        else:
            # No closing tag - model output was truncated during thinking
            logger.warning("Found <think> tag but no </think> - response may be truncated")
            # Try to find any JSON after the thinking content
            json_content = content

    # Step 2: Handle markdown code blocks
    if "```json" in json_content:
        match = re.search(r"```json\s*(.*?)\s*```", json_content, re.DOTALL)
        if match:
            json_content = match.group(1)
    elif "```" in json_content:
        match = re.search(r"```\s*(.*?)\s*```", json_content, re.DOTALL)
        if match:
            json_content = match.group(1)

    # Step 3: Try to find JSON object if still no valid JSON
    if not json_content.strip().startswith("{"):
        # Look for a JSON object in the content
        brace_match = re.search(r"\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}", json_content, re.DOTALL)
        if brace_match:
            json_content = brace_match.group(0)

    return json_content.strip()


# JSON schema for structured outputs - matches AdjudicationResponse
ADJUDICATION_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "action_id": {"type": "string"},
        "status": {"type": "string", "enum": ["CONSISTENT", "INCONSISTENT", "CONDITIONAL", "UNKNOWN"]},
        "anchor_sufficiency": {
            "type": "object",
            "properties": {
                "sufficient": {"type": "boolean"},
                "missing_anchors": {"type": "array", "items": {"type": "string"}},
                "reason": {"type": ["string", "null"]}
            },
            "required": ["sufficient"]
        },
        "evidence": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "source": {"type": "string"},
                    "id": {"type": "string"},
                    "excerpt": {"type": "string"}
                },
                "required": ["source", "id", "excerpt"]
            }
        },
        "conflicts": {"type": "array", "items": {"type": "string"}},
        "conditions": {"type": "array", "items": {"type": "string"}},
        "verification_queries": {"type": "array", "items": {"type": "string"}},
        "supersession_notes": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "old_id": {"type": "string"},
                    "new_id": {"type": "string"},
                    "note": {"type": "string"}
                }
            }
        },
        "comments": {"type": "string"}
    },
    "required": ["action_id", "status"]
}


async def call_vllm_inference(system_prompt: str, user_prompt: str) -> dict:
    """
    Call vLLM backend for model inference.

    Returns the parsed JSON response from the model.
    Raises HTTPException on failure.
    """
    # Configuration options
    use_structured_outputs = os.getenv("VLLM_USE_STRUCTURED_OUTPUTS", "false").lower() == "true"
    disable_thinking = os.getenv("DISABLE_THINKING_MODE", "false").lower() == "true"

    # Optionally add instruction to disable thinking mode for Qwen3
    effective_system_prompt = system_prompt
    if disable_thinking:
        effective_system_prompt = system_prompt + "\n\nIMPORTANT: Do NOT use <think> tags. Output ONLY the JSON response directly."

    request_body = {
        "model": VLLM_MODEL_NAME,
        "messages": [
            {"role": "system", "content": effective_system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": MAX_TOKENS,
        "temperature": 0.1,  # Low temp for consistent JSON output
    }

    # Add structured outputs if enabled (vLLM v0.12+ / v0.15+)
    # For direct HTTP requests, structured_outputs goes at top level (not in extra_body)
    if use_structured_outputs:
        request_body["structured_outputs"] = {
            "json": ADJUDICATION_RESPONSE_SCHEMA
        }
        logger.info("Using vLLM structured outputs for JSON schema enforcement")

    async with httpx.AsyncClient(timeout=VLLM_TIMEOUT) as client:
        try:
            logger.info(f"Sending request to vLLM: max_tokens={MAX_TOKENS}")
            response = await client.post(
                f"{VLLM_URL}/v1/chat/completions",
                json=request_body,
            )
            response.raise_for_status()

        except httpx.TimeoutException:
            logger.error(f"vLLM request timed out after {VLLM_TIMEOUT}s")
            raise HTTPException(
                status_code=504,
                detail=f"Model inference timed out after {VLLM_TIMEOUT} seconds",
            )
        except httpx.HTTPStatusError as e:
            logger.error(f"vLLM returned error: {e.response.status_code}")
            logger.error(f"Error details: {e.response.text[:500]}")
            raise HTTPException(
                status_code=502,
                detail=f"Model backend error: {e.response.text}",
            )
        except httpx.RequestError as e:
            logger.error(f"Failed to connect to vLLM: {e}")
            raise HTTPException(
                status_code=503,
                detail=f"Model backend unavailable: {VLLM_URL}",
            )

    # Extract the model's response content
    result = response.json()
    content = result["choices"][0]["message"]["content"]
    finish_reason = result["choices"][0].get("finish_reason", "unknown")
    usage = result.get("usage", {})

    logger.info(
        f"vLLM response: finish_reason={finish_reason}, "
        f"prompt_tokens={usage.get('prompt_tokens', '?')}, "
        f"completion_tokens={usage.get('completion_tokens', '?')}"
    )

    # Check for truncation
    if finish_reason == "length":
        logger.warning(
            f"Response was truncated (hit max_tokens={MAX_TOKENS}). "
            "Consider increasing MAX_TOKENS."
        )

    logger.debug(f"Raw model response ({len(content)} chars): {content[:500]}...")

    # Parse JSON from the response
    json_content = extract_json_from_response(content)

    try:
        parsed = json.loads(json_content)
        logger.info(f"Successfully parsed JSON response with status: {parsed.get('status', 'unknown')}")
        return parsed
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse model JSON response: {e}")
        logger.error(f"Extracted JSON content was: {json_content[:1000]}")
        logger.error(f"Full raw response was: {content[:2000]}")
        raise HTTPException(
            status_code=500,
            detail=f"Model returned invalid JSON: {str(e)}. finish_reason={finish_reason}",
        )


def model_response_to_adjudication(
    parsed: dict,
    request: AdjudicationRequest,
    anchor_sufficiency: AnchorSufficiency,
) -> AdjudicationResponse:
    """
    Convert parsed model response to AdjudicationResponse.

    Handles various response formats and provides defaults for missing fields.
    """
    # Extract status (required)
    status = parsed.get("status", "UNKNOWN")
    if status not in ("CONSISTENT", "INCONSISTENT", "CONDITIONAL", "UNKNOWN"):
        logger.warning(f"Invalid status '{status}', defaulting to UNKNOWN")
        status = "UNKNOWN"

    # Extract evidence items
    evidence = []
    for e in parsed.get("evidence", []):
        if isinstance(e, dict):
            evidence.append(EvidenceItem(
                source=e.get("source", "spec"),
                id=e.get("id", "unknown"),
                excerpt=e.get("excerpt", ""),
            ))

    # Extract supersession notes
    supersession_notes = []
    for n in parsed.get("supersession_notes", []):
        if isinstance(n, dict):
            supersession_notes.append(SupersessionNote(
                old_id=n.get("old_id", ""),
                new_id=n.get("new_id", ""),
                note=n.get("note", ""),
            ))

    return AdjudicationResponse(
        action_id=parsed.get("action_id", request.action_id),
        status=status,
        anchor_sufficiency=anchor_sufficiency,
        evidence=evidence,
        conflicts=parsed.get("conflicts", []),
        conditions=parsed.get("conditions", []),
        verification_queries=parsed.get("verification_queries", []),
        supersession_notes=supersession_notes,
        comments=parsed.get("comments", ""),
    )


@app.on_event("startup")
async def startup_event():
    """Initialize on startup"""
    # Pre-load and cache the system prompt
    prompt = get_system_prompt()
    logger.info(f"System prompt loaded: {len(prompt)} characters")
    logger.info(f"vLLM backend: {VLLM_URL}")
    logger.info(f"vLLM model: {VLLM_MODEL_NAME}")


@app.get("/health")
async def health_check():
    """Health check endpoint - verifies vLLM backend connectivity"""
    vllm_healthy = False
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            response = await client.get(f"{VLLM_URL}/health")
            vllm_healthy = response.status_code == 200
    except Exception as e:
        logger.warning(f"vLLM health check failed: {e}")

    return {
        "status": "ok" if vllm_healthy else "degraded",
        "vllm_backend": VLLM_URL,
        "vllm_healthy": vllm_healthy,
        "model_name": VLLM_MODEL_NAME,
    }


@app.get("/prompt")
async def get_prompt():
    """Get the current system prompt (for inspection/debugging)"""
    prompt = get_system_prompt()
    return {
        "prompt_length": len(prompt),
        "prompt_path": str(PROMPTS_DIR / "system-prompt.md"),
        "content": prompt,
    }


@app.get("/model", response_model=ModelInfo)
async def get_model_info():
    """Get current model configuration"""
    return ModelInfo(
        base_model=f"{VLLM_URL} ({VLLM_MODEL_NAME})",
        adapter_id=VLLM_MODEL_NAME,
        adapter_path=VLLM_URL,
        max_tokens=MAX_TOKENS,
        status="ready",
    )


@app.post("/adjudicate", response_model=AdjudicationResponse)
async def adjudicate(request: AdjudicationRequest):
    """
    Adjudicate a proposal against specifications.

    Pipeline:
    1. Pre-inference: Anchor sufficiency gate
    2. Inference: Model adjudication (placeholder)
    3. Post-inference: Validation and verification
    """
    logger.info(f"Adjudicating proposal: {request.action_id}")

    # === STEP 1: Pre-inference Anchor Sufficiency Gate ===
    anchor_assessment = assess_anchor_sufficiency(
        spec_refs=request.spec_refs,
        evidence_bundle=request.evidence_bundle,
        assumptions=request.assumptions,
        invariants=request.invariants,
        steps=request.steps,
    )

    logger.info(
        f"Anchor assessment: {anchor_assessment.level.value}, "
        f"coverage={anchor_assessment.coverage_score:.2f}"
    )

    # Generate verification queries for insufficient anchors
    verification_queries = generate_verification_queries(
        assessment=anchor_assessment,
        proposal_description=request.description,
        feature=request.feature,
    )

    # Get recommended status based on pre-inference assessment
    recommended_status = recommend_status(anchor_assessment)

    # Build anchor sufficiency response object
    anchor_sufficiency = AnchorSufficiency(
        sufficient=anchor_assessment.sufficient,
        missing_anchors=anchor_assessment.missing_anchors,
        reason=anchor_assessment.reason,
    )

    # === STEP 2: Model Inference via vLLM ===
    system_prompt = get_system_prompt()
    user_prompt = format_proposal_for_inference(request)
    logger.info(f"Prepared prompts: system={len(system_prompt)}, user={len(user_prompt)} chars")

    # Early return for insufficient anchors (skip model inference)
    if anchor_assessment.level == SufficiencyLevel.INSUFFICIENT:
        logger.info("Skipping model inference due to insufficient anchors")
        return AdjudicationResponse(
            action_id=request.action_id,
            status="UNKNOWN",
            anchor_sufficiency=anchor_sufficiency,
            evidence=[],
            conflicts=[],
            conditions=[],
            verification_queries=verification_queries,
            supersession_notes=[],
            comments=f"Pre-inference gate failed: {anchor_assessment.reason} "
            f"Coverage score: {anchor_assessment.coverage_score:.2f}. "
            "Provide additional evidence before adjudication.",
        )

    # Call vLLM for model inference
    logger.info(f"Calling vLLM at {VLLM_URL} with model {VLLM_MODEL_NAME}")
    parsed_response = await call_vllm_inference(system_prompt, user_prompt)
    logger.info(f"Model returned status: {parsed_response.get('status', 'unknown')}")

    # Convert to AdjudicationResponse
    response = model_response_to_adjudication(
        parsed=parsed_response,
        request=request,
        anchor_sufficiency=anchor_sufficiency,
    )

    # === STEP 3: Post-inference Validation ===
    # Run static verifier on the response
    verify_result = verify_response(
        response=response.model_dump(),
        proposal=request.model_dump(),
    )

    if not verify_result.passed:
        logger.warning(
            f"Post-inference validation warnings: {verify_result.warning_count} warnings, "
            f"{verify_result.error_count} errors"
        )
        # Add validation notes to comments
        if verify_result.error_count > 0:
            response.comments += f" [Validation: {verify_result.error_count} errors detected]"

    return response


class AnchorAssessmentResponse(BaseModel):
    """Response from anchor sufficiency assessment"""
    level: str
    sufficient: bool
    missing_anchors: list[str]
    verification_queries: list[str]
    reason: str
    coverage_score: float
    recommended_status: str


@app.post("/assess-anchors", response_model=AnchorAssessmentResponse)
async def assess_anchors(request: AdjudicationRequest):
    """
    Assess anchor sufficiency without running full adjudication.

    Useful for pre-validation before submitting proposals.
    """
    assessment = assess_anchor_sufficiency(
        spec_refs=request.spec_refs,
        evidence_bundle=request.evidence_bundle,
        assumptions=request.assumptions,
        invariants=request.invariants,
        steps=request.steps,
    )

    queries = generate_verification_queries(
        assessment=assessment,
        proposal_description=request.description,
        feature=request.feature,
    )

    return AnchorAssessmentResponse(
        level=assessment.level.value,
        sufficient=assessment.sufficient,
        missing_anchors=assessment.missing_anchors,
        verification_queries=queries,
        reason=assessment.reason,
        coverage_score=assessment.coverage_score,
        recommended_status=recommend_status(assessment),
    )


class ValidationRequest(BaseModel):
    """Request to validate an adjudication response"""
    response: dict  # The AdjudicationResponse to validate


class ValidationResult(BaseModel):
    """Combined validation result"""
    valid: bool
    schema_valid: bool
    citations_valid: bool
    ids_valid: bool
    schema_violations: list[dict] = []
    citation_issues: list[dict] = []
    missing_ids: list[str] = []
    normative_count: int = 0
    uncited_count: int = 0


@app.post("/validate-response", response_model=ValidationResult)
async def validate_response(request: ValidationRequest):
    """
    Validate an adjudication response against all guardrails.

    Checks:
    1. Schema compliance (required fields by status)
    2. Citation discipline (all normative claims cited)
    3. ID existence (cited IDs exist in corpus)
    """
    response = request.response

    # Schema validation
    schema_result = validate_response_schema(response)

    # Citation validation
    citation_result = validate_response_citations(response)

    # ID validation (async)
    id_result = await validate_ids(response)

    # Combine results
    all_valid = schema_result.valid and citation_result.valid and id_result.valid

    return ValidationResult(
        valid=all_valid,
        schema_valid=schema_result.valid,
        citations_valid=citation_result.valid,
        ids_valid=id_result.valid,
        schema_violations=[
            {"field": v.field, "expected": v.expected, "actual": v.actual, "severity": v.severity}
            for v in schema_result.violations
        ],
        citation_issues=[
            {"type": i.issue_type, "text": i.text, "suggestion": i.suggestion}
            for i in citation_result.issues
        ],
        missing_ids=id_result.missing_ids,
        normative_count=citation_result.normative_count,
        uncited_count=citation_result.uncited_count,
    )


class StaticVerifyRequest(BaseModel):
    """Request for static verification"""
    response: dict  # The AdjudicationResponse to verify
    proposal: Optional[dict] = None  # Optional proposal for context


class StaticVerifyResponse(BaseModel):
    """Response from static verifier"""
    passed: bool
    error_count: int
    warning_count: int
    issues: list[dict] = []
    alignment_scores: list[dict] = []
    keywords: dict[str, list[str]] = {}


@app.post("/verify-static", response_model=StaticVerifyResponse)
async def verify_static(request: StaticVerifyRequest):
    """
    Run static verification pass on an adjudication response.

    Post-inference checks:
    1. Uncited must/must not statements
    2. Evidence-claim alignment
    3. Potential undocumented conflicts
    """
    result = verify_response(
        response=request.response,
        proposal=request.proposal,
    )

    return StaticVerifyResponse(
        passed=result.passed,
        error_count=result.error_count,
        warning_count=result.warning_count,
        issues=[
            {
                "category": i.category,
                "severity": i.severity,
                "text": i.text,
                "location": i.location,
                "suggestion": i.suggestion,
            }
            for i in result.issues
        ],
        alignment_scores=[
            {
                "claim": s.claim,
                "evidence_id": s.evidence_id,
                "score": s.score,
                "matched_keywords": s.matched_keywords,
                "reason": s.reason,
            }
            for s in result.alignment_scores
        ],
        keywords=result.extracted_keywords,
    )


@app.post("/reload-adapter")
async def reload_adapter(adapter_id: Optional[str] = None):
    """
    Hot-reload a LoRA adapter.

    This endpoint is called after training to load a new adapter
    without restarting the service.
    """
    global current_adapter_id

    logger.info(f"Reloading adapter: {adapter_id or 'base model'}")

    # Placeholder: In production, this would:
    # 1. Unload current adapter
    # 2. Load new adapter from ADAPTER_PATH
    # 3. Verify the adapter works with a test inference

    current_adapter_id = adapter_id

    return {"status": "ok", "adapter_id": current_adapter_id}


if __name__ == "__main__":
    logger.info(f"Starting Historian Inference Service on port {PORT}")
    logger.info(f"vLLM backend: {VLLM_URL}")
    logger.info(f"vLLM model: {VLLM_MODEL_NAME}")

    uvicorn.run(app, host="0.0.0.0", port=PORT)
