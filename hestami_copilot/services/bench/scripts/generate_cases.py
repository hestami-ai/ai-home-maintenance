#!/usr/bin/env python3
"""
Bench Case Generator - LLM-powered test case generation for Historian.

Generates realistic AdjudicationRequest test cases based on specifications
that the Historian model was trained on.

Multi-stage pipeline:
1. Load cached rules and citations from training pipeline
2. Generate Executor-style proposals using LLM (varying complexity)
3. Determine expected outcomes using LLM
4. Output individual JSON case files

Usage:
    python generate_cases.py --count 50 --output ../cases
    python generate_cases.py --count 20 --complexity hard --verbose
"""

import argparse
import json
import random
import sys
import uuid
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional

# Add training pipeline to path for LLM providers
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "training-data" / "scripts"))
from training_pipeline.llm_providers import OllamaProvider, LLMProvider


# =============================================================================
# Configuration
# =============================================================================

TRAINING_DATA_ROOT = Path(__file__).parent.parent.parent.parent / "training-data"
CACHE_DIR = TRAINING_DATA_ROOT / "cache"
DEFAULT_OUTPUT_DIR = Path(__file__).parent.parent / "cases"

# Complexity distribution (default)
COMPLEXITY_DISTRIBUTION = {
    "simple": 0.30,      # Clear-cut cases
    "moderate": 0.40,    # Requires reasoning
    "nuanced": 0.20,     # Subtle distinctions
    "edge_case": 0.10,   # Boundary conditions
}

# Status distribution (should match what Historian needs to handle)
STATUS_DISTRIBUTION = {
    "CONSISTENT": 0.30,
    "INCONSISTENT": 0.35,
    "CONDITIONAL": 0.20,
    "UNKNOWN": 0.15,
}


# =============================================================================
# Data Structures
# =============================================================================

@dataclass
class CachedRule:
    """Rule loaded from training pipeline cache."""
    citation_id: str
    original_text: str
    normalized_text: str
    requirement_level: str  # MUST, SHOULD, MAY
    section: str
    doc_id: str
    rule_category: str


@dataclass
class BenchCase:
    """A benchmark test case in the format expected by the bench runner."""
    id: str
    name: str
    description: str
    expected_status: str
    proposal: dict  # AdjudicationRequest format
    must_cite: list[str]
    must_not_cite: list[str]
    expected_conflicts: list[str]
    expected_conditions: list[str]

    # Generation metadata (not used by runner but useful for debugging)
    complexity: str
    source_rules: list[str]
    generated_at: str


# =============================================================================
# Stage 1: Load Cached Rules
# =============================================================================

def load_cached_rules() -> list[CachedRule]:
    """Load extracted rules from training pipeline cache."""
    rules = []

    rules_cache = CACHE_DIR / "stage3_rules"
    citations_cache = CACHE_DIR / "stage4_citation_ids"

    if not rules_cache.exists():
        print(f"Warning: Rules cache not found at {rules_cache}")
        return rules

    # Load all rule files (exclude .meta.json metadata files)
    for rule_file in rules_cache.glob("*.json"):
        # Skip metadata files
        if rule_file.name.endswith(".meta.json"):
            continue

        try:
            with open(rule_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            # Handle both list and dict formats
            rule_list = data if isinstance(data, list) else [data]

            for rule_data in rule_list:
                # Try to get citation ID from stage4 cache
                rule_id = rule_data.get("rule_id", "")
                citation_id = rule_id  # Default to rule_id

                # Look up canonical citation ID if available
                doc_id = rule_data.get("doc_id", "")
                citation_file = citations_cache / f"{doc_id}.json"
                if citation_file.exists():
                    with open(citation_file, 'r', encoding='utf-8') as f:
                        citations = json.load(f)
                    # Stage4 cache is a dict mapping rule_id -> citation data
                    if isinstance(citations, dict) and rule_id in citations:
                        cit_data = citations[rule_id]
                        citation_id = cit_data.get("canonical_id", rule_id) if isinstance(cit_data, dict) else rule_id

                rules.append(CachedRule(
                    citation_id=citation_id,
                    original_text=rule_data.get("original_text", ""),
                    normalized_text=rule_data.get("normalized_text", ""),
                    requirement_level=rule_data.get("requirement_level", "SHOULD"),
                    section=rule_data.get("section", ""),
                    doc_id=doc_id,
                    rule_category=rule_data.get("rule_category", "general"),
                ))
        except Exception as e:
            print(f"Warning: Failed to load {rule_file}: {e}")

    return rules


def load_spec_content(doc_id: str) -> str:
    """Load original spec document content for context."""
    # Try to find the spec file
    specs_dir = TRAINING_DATA_ROOT / "docs" / "specs"

    for spec_file in specs_dir.rglob("*.md"):
        # Match by doc_id pattern in filename
        if doc_id.lower().replace("-", " ") in spec_file.stem.lower().replace("-", " "):
            with open(spec_file, 'r', encoding='utf-8') as f:
                return f.read()

    return ""


# =============================================================================
# Stage 2: Generate Executor Proposals (LLM)
# =============================================================================

PROPOSAL_GENERATION_PROMPT = """You are generating a realistic software development proposal that an Executor agent would submit to a Historian for adjudication.

## Context
The Historian evaluates proposals against specification requirements. You must generate a proposal that would result in a {target_status} adjudication.

## Target Complexity: {complexity}
- simple: Clear-cut case, obvious compliance or violation
- moderate: Requires careful reading of the spec
- nuanced: Subtle interpretation required, edge of compliance
- edge_case: Boundary condition, unusual scenario

## Relevant Specification Rules:
{rules_context}

## Your Task
Generate an AdjudicationRequest that an Executor would realistically submit. The proposal should be something a developer would actually do.

{status_guidance}

## Output Format
Respond with a JSON object:
```json
{{
    "action_id": "AP-XXX",
    "feature": "Feature area name",
    "description": "What the developer wants to do",
    "steps": ["Step 1", "Step 2", "..."],
    "expected_outcome": "What the developer expects to achieve",
    "preconditions": ["Any preconditions"],
    "assumptions": ["Assumptions the developer is making"],
    "invariants": ["System invariants being relied upon"],
    "spec_refs": ["Citation IDs the developer references"],
    "evidence_bundle": [
        {{
            "source": "spec",
            "id": "CITATION-ID",
            "excerpt": "Quoted text from spec"
        }}
    ],
    "case_name": "Short descriptive name for this test case",
    "case_description": "What this case tests"
}}
```

Generate a realistic, plausible proposal now."""

STATUS_GUIDANCE = {
    "CONSISTENT": """For CONSISTENT: The proposal should clearly follow the specification requirements.
- Reference the correct spec sections
- Implement exactly what the spec requires
- Evidence bundle should contain supporting quotes""",

    "INCONSISTENT": """For INCONSISTENT: The proposal should violate one or more requirements.
- The violation can be subtle or obvious depending on complexity
- The developer may be unaware of the conflict
- Evidence bundle might be incomplete or cite wrong sections""",

    "CONDITIONAL": """For CONDITIONAL: The proposal partially complies but needs conditions met.
- Some aspects align with spec, others need clarification
- May depend on runtime conditions or configuration
- Evidence shows partial support""",

    "UNKNOWN": """For UNKNOWN: The proposal addresses something not covered by the spec.
- Novel feature not anticipated by requirements
- Edge case with no clear guidance
- Evidence bundle may be empty or reference tangential sections""",
}


def generate_proposal(
    llm: LLMProvider,
    rules: list[CachedRule],
    target_status: str,
    complexity: str,
    verbose: bool = False
) -> Optional[dict]:
    """Generate an Executor-style proposal using LLM."""

    # Select relevant rules based on target status
    if target_status == "CONSISTENT":
        # Use MUST rules for consistent cases
        relevant = [r for r in rules if r.requirement_level == "MUST"][:3]
    elif target_status == "INCONSISTENT":
        # Use MUST rules to violate
        relevant = [r for r in rules if r.requirement_level == "MUST"][:2]
    elif target_status == "CONDITIONAL":
        # Mix of MUST and SHOULD
        relevant = [r for r in rules if r.requirement_level in ["MUST", "SHOULD"]][:3]
    else:  # UNKNOWN
        # Use MAY rules or less specific ones
        relevant = [r for r in rules if r.requirement_level in ["MAY", "SHOULD"]][:2]

    if not relevant:
        relevant = random.sample(rules, min(3, len(rules)))

    # Build rules context
    rules_context = "\n".join([
        f"- [{r.citation_id}] ({r.requirement_level}): {r.normalized_text}"
        for r in relevant
    ])

    prompt = PROPOSAL_GENERATION_PROMPT.format(
        target_status=target_status,
        complexity=complexity,
        rules_context=rules_context,
        status_guidance=STATUS_GUIDANCE[target_status]
    )

    if verbose:
        print(f"  Generating {complexity} {target_status} proposal...")

    try:
        result, _ = llm.generate_json(prompt, schema=PROPOSAL_SCHEMA)
        if result:
            result["_source_rules"] = [r.citation_id for r in relevant]
            return result
    except Exception as e:
        print(f"  Error generating proposal: {e}")

    return None


PROPOSAL_SCHEMA = {
    "type": "object",
    "properties": {
        "action_id": {"type": "string"},
        "feature": {"type": "string"},
        "description": {"type": "string"},
        "steps": {"type": "array", "items": {"type": "string"}},
        "expected_outcome": {"type": "string"},
        "preconditions": {"type": "array", "items": {"type": "string"}},
        "assumptions": {"type": "array", "items": {"type": "string"}},
        "invariants": {"type": "array", "items": {"type": "string"}},
        "spec_refs": {"type": "array", "items": {"type": "string"}},
        "evidence_bundle": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "source": {"type": "string"},
                    "id": {"type": "string"},
                    "excerpt": {"type": "string"}
                }
            }
        },
        "case_name": {"type": "string"},
        "case_description": {"type": "string"}
    },
    "required": ["action_id", "feature", "description", "steps", "expected_outcome"]
}


# =============================================================================
# Stage 3: Determine Expected Outcomes (LLM)
# =============================================================================

OUTCOME_DETERMINATION_PROMPT = """You are determining the expected test outcomes for a Historian benchmark case.

## The Proposal
```json
{proposal}
```

## Target Status: {target_status}

## Available Specification Rules
{rules_context}

## Your Task
Determine what the Historian's response SHOULD be for this proposal. This is the "ground truth" for testing.

For status {target_status}, determine:
1. Which citation IDs MUST appear in the evidence (must_cite)
2. Which citation IDs should NOT appear (must_not_cite) - citations that would indicate wrong reasoning
3. For INCONSISTENT: What conflicts should be identified
4. For CONDITIONAL: What conditions should be specified

## Output Format
```json
{{
    "must_cite": ["CITATION-ID-1", "CITATION-ID-2"],
    "must_not_cite": ["WRONG-CITATION"],
    "expected_conflicts": ["Description of conflict 1"],
    "expected_conditions": ["Condition that must be met"]
}}
```

Provide the expected outcomes now."""


def determine_outcomes(
    llm: LLMProvider,
    proposal: dict,
    target_status: str,
    rules: list[CachedRule],
    verbose: bool = False
) -> dict:
    """Determine expected test outcomes using LLM."""

    # Get rules context
    source_rules = proposal.get("_source_rules", [])
    relevant_rules = [r for r in rules if r.citation_id in source_rules]

    rules_context = "\n".join([
        f"- [{r.citation_id}] ({r.requirement_level}): {r.normalized_text}"
        for r in relevant_rules
    ]) or "No specific rules available"

    # Clean proposal for prompt (remove internal fields)
    clean_proposal = {k: v for k, v in proposal.items() if not k.startswith("_")}

    prompt = OUTCOME_DETERMINATION_PROMPT.format(
        proposal=json.dumps(clean_proposal, indent=2),
        target_status=target_status,
        rules_context=rules_context
    )

    if verbose:
        print(f"  Determining expected outcomes...")

    try:
        result, _ = llm.generate_json(prompt, schema=OUTCOME_SCHEMA)
        return result or {}
    except Exception as e:
        print(f"  Error determining outcomes: {e}")
        return {}


OUTCOME_SCHEMA = {
    "type": "object",
    "properties": {
        "must_cite": {"type": "array", "items": {"type": "string"}},
        "must_not_cite": {"type": "array", "items": {"type": "string"}},
        "expected_conflicts": {"type": "array", "items": {"type": "string"}},
        "expected_conditions": {"type": "array", "items": {"type": "string"}}
    },
    "required": ["must_cite"]
}


# =============================================================================
# Stage 4: Format and Output
# =============================================================================

def create_bench_case(
    proposal: dict,
    outcomes: dict,
    target_status: str,
    complexity: str,
    case_number: int
) -> BenchCase:
    """Create a BenchCase from generated proposal and outcomes."""

    # Generate case ID
    case_id = f"{case_number:03d}_{target_status.lower()}_{complexity}"

    # Extract case metadata
    case_name = proposal.get("case_name", f"{target_status} - {complexity}")
    case_description = proposal.get("case_description", f"Generated {complexity} case for {target_status}")

    # Build the proposal dict (AdjudicationRequest format)
    adjudication_request = {
        "action_id": proposal.get("action_id", f"AP-{case_number:03d}"),
        "feature": proposal.get("feature", "Unknown"),
        "description": proposal.get("description", ""),
        "steps": proposal.get("steps", []),
        "expected_outcome": proposal.get("expected_outcome", ""),
        "preconditions": proposal.get("preconditions", []),
        "assumptions": proposal.get("assumptions", []),
        "invariants": proposal.get("invariants", []),
        "spec_refs": proposal.get("spec_refs", []),
        "evidence_bundle": proposal.get("evidence_bundle", []),
    }

    return BenchCase(
        id=case_id,
        name=case_name,
        description=case_description,
        expected_status=target_status,
        proposal=adjudication_request,
        must_cite=outcomes.get("must_cite", []),
        must_not_cite=outcomes.get("must_not_cite", []),
        expected_conflicts=outcomes.get("expected_conflicts", []),
        expected_conditions=outcomes.get("expected_conditions", []),
        complexity=complexity,
        source_rules=proposal.get("_source_rules", []),
        generated_at=datetime.now().isoformat(),
    )


def save_case(case: BenchCase, output_dir: Path):
    """Save a bench case to a JSON file."""
    output_dir.mkdir(parents=True, exist_ok=True)

    # Convert to dict, excluding generation metadata for cleaner case files
    case_dict = {
        "id": case.id,
        "name": case.name,
        "description": case.description,
        "expected_status": case.expected_status,
        "proposal": case.proposal,
        "must_cite": case.must_cite,
        "must_not_cite": case.must_not_cite,
        "expected_conflicts": case.expected_conflicts,
        "expected_conditions": case.expected_conditions,
    }

    # Add metadata as comment-like field
    case_dict["_metadata"] = {
        "complexity": case.complexity,
        "source_rules": case.source_rules,
        "generated_at": case.generated_at,
    }

    output_path = output_dir / f"{case.id}.json"
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(case_dict, f, indent=2, ensure_ascii=False)

    return output_path


# =============================================================================
# Main Pipeline
# =============================================================================

def select_target_status(distribution: dict) -> str:
    """Randomly select a target status based on distribution."""
    r = random.random()
    cumulative = 0
    for status, prob in distribution.items():
        cumulative += prob
        if r < cumulative:
            return status
    return list(distribution.keys())[-1]


def select_complexity(distribution: dict) -> str:
    """Randomly select complexity based on distribution."""
    r = random.random()
    cumulative = 0
    for complexity, prob in distribution.items():
        cumulative += prob
        if r < cumulative:
            return complexity
    return list(distribution.keys())[-1]


def generate_cases(
    count: int,
    output_dir: Path,
    model: str = "qwen3:4b-instruct-2507-q8_0",
    complexity_filter: Optional[str] = None,
    status_filter: Optional[str] = None,
    verbose: bool = False,
    start_number: int = 21,  # Start after existing manual cases
) -> list[BenchCase]:
    """Generate benchmark cases using the multi-stage pipeline."""

    print(f"=== Bench Case Generator ===")
    print(f"Target: {count} cases")
    print(f"Output: {output_dir}")
    print(f"Model: {model}")
    print()

    # Initialize LLM
    llm = OllamaProvider(model=model, timeout=300)
    if verbose:
        LLMProvider.set_debug(True)

    # Stage 1: Load cached rules
    print("Stage 1: Loading cached rules...")
    rules = load_cached_rules()
    print(f"  Loaded {len(rules)} rules from cache")

    if not rules:
        print("ERROR: No rules found. Run the training pipeline first.")
        return []

    # Group rules by doc
    rules_by_doc = {}
    for rule in rules:
        if rule.doc_id not in rules_by_doc:
            rules_by_doc[rule.doc_id] = []
        rules_by_doc[rule.doc_id].append(rule)

    print(f"  Rules from {len(rules_by_doc)} documents")
    print()

    # Generate cases
    cases = []
    case_number = start_number

    for i in range(count):
        print(f"Generating case {i+1}/{count}...")

        # Select target status and complexity
        if status_filter:
            target_status = status_filter
        else:
            target_status = select_target_status(STATUS_DISTRIBUTION)

        if complexity_filter:
            complexity = complexity_filter
        else:
            complexity = select_complexity(COMPLEXITY_DISTRIBUTION)

        print(f"  Target: {target_status} ({complexity})")

        # Select rules from a random document
        doc_id = random.choice(list(rules_by_doc.keys()))
        doc_rules = rules_by_doc[doc_id]

        # Stage 2: Generate proposal
        proposal = generate_proposal(llm, doc_rules, target_status, complexity, verbose)
        if not proposal:
            print(f"  SKIP: Failed to generate proposal")
            continue

        # Stage 3: Determine expected outcomes
        outcomes = determine_outcomes(llm, proposal, target_status, doc_rules, verbose)

        # Stage 4: Create and save case
        case = create_bench_case(proposal, outcomes, target_status, complexity, case_number)
        output_path = save_case(case, output_dir)

        cases.append(case)
        case_number += 1

        print(f"  SAVED: {output_path.name}")

    print()
    print(f"=== Generation Complete ===")
    print(f"Generated: {len(cases)} cases")

    # Print distribution summary
    status_counts = {}
    complexity_counts = {}
    for case in cases:
        status_counts[case.expected_status] = status_counts.get(case.expected_status, 0) + 1
        complexity_counts[case.complexity] = complexity_counts.get(case.complexity, 0) + 1

    print("\nStatus distribution:")
    for status, count in sorted(status_counts.items()):
        print(f"  {status}: {count} ({100*count/len(cases):.1f}%)")

    print("\nComplexity distribution:")
    for complexity, count in sorted(complexity_counts.items()):
        print(f"  {complexity}: {count} ({100*count/len(cases):.1f}%)")

    return cases


def main():
    parser = argparse.ArgumentParser(
        description="Generate Historian benchmark cases using LLM",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Generate 50 cases with default settings
    python generate_cases.py --count 50

    # Generate only hard INCONSISTENT cases
    python generate_cases.py --count 20 --status INCONSISTENT --complexity nuanced

    # Verbose mode with custom output
    python generate_cases.py --count 10 --output ./new_cases --verbose
        """
    )

    parser.add_argument("--count", type=int, default=30,
                        help="Number of cases to generate (default: 30)")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_DIR,
                        help=f"Output directory (default: {DEFAULT_OUTPUT_DIR})")
    parser.add_argument("--model", type=str, default="qwen3:4b-instruct-2507-q8_0",
                        help="Ollama model to use")
    parser.add_argument("--complexity", type=str, choices=["simple", "moderate", "nuanced", "edge_case"],
                        help="Filter to specific complexity level")
    parser.add_argument("--status", type=str, choices=["CONSISTENT", "INCONSISTENT", "CONDITIONAL", "UNKNOWN"],
                        help="Filter to specific target status")
    parser.add_argument("--start-number", type=int, default=21,
                        help="Starting case number (default: 21, after manual cases)")
    parser.add_argument("--verbose", "-v", action="store_true",
                        help="Enable verbose output")

    args = parser.parse_args()

    generate_cases(
        count=args.count,
        output_dir=args.output,
        model=args.model,
        complexity_filter=args.complexity,
        status_filter=args.status,
        verbose=args.verbose,
        start_number=args.start_number,
    )


if __name__ == "__main__":
    main()
