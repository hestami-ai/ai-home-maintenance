Let's remove the older approach that was invalid for generating high quality training data because it's hard to keep track of the correct pipeline. What files / components need to be removed?
Let me identify the old vs new components in the training data generation setup.

Bash List all Python and data files in training-data directory
IN
cd "e:\Projects\hestami-ai\hestami_copilot\training-data" && find . -type f \( -name "*.py" -o -name "*.jsonl" -o -name "*.json" \) | grep -v __pycache__ | grep -v cache | head -50

OUT
./benchmark_gold.jsonl
./combined.jsonl
./docs/specs/hestami-ai-os-specs/(Experimental-Hackathon) Photorealistic 3D Scanning SDK - Technical Specification/examples.json
./docs/specs/hestami-ai-os-specs/(Phase 18) File Ingestion, Security and Media Processing/examples.json
./docs/specs/hestami-ai-os-specs/(Phase 19) Staff Onbarding Flow/examples.json
./output/training.jsonl
./raw/combined-normatives.json
./raw/llm-extracted-normatives.json
./raw/normatives.json
./scripts/generate_pairs.py
./scripts/llm_extract_requirements.py
./scripts/merge_normatives.py
./scripts/training_pipeline/llm_providers.py
./scripts/training_pipeline/main.py
./scripts/training_pipeline/schemas.py
./scripts/training_pipeline/stage1_document_analysis.py
./scripts/training_pipeline/stage2_chunking.py
./scripts/training_pipeline/stage3_rule_extraction.py
./scripts/training_pipeline/stage4_citation_ids.py
./scripts/training_pipeline/stage5_scenario_generation.py
./scripts/training_pipeline/stage6_adjudication.py
./scripts/training_pipeline/stage7_validation.py
./scripts/training_pipeline/__init__.py
./synthetic/all_pairs.json
./synthetic/consistent_pairs.json
./synthetic/inconsistent_pairs.json
./synthetic/unknown_pairs.json
./synthetic.jsonl
Bash List scripts directory contents
IN
ls -la "e:\Projects\hestami-ai\hestami_copilot\training-data\scripts\"

OUT
Exit code 2
/usr/bin/bash: eval: line 1: unexpected EOF while looking for matching `"'
Read e:\Projects\hestami-ai\hestami_copilot\training-data\scripts\generate_pairs.py
Read e:\Projects\hestami-ai\hestami_copilot\training-data\scripts\llm_extract_requirements.py
Read e:\Projects\hestami-ai\hestami_copilot\training-data\scripts\merge_normatives.py
Bash Check examples.json format to determine if old or new
IN
head -20 "e:\Projects\hestami-ai\hestami_copilot\training-data\docs\specs\hestami-ai-os-specs\(Phase 18) File Ingestion, Security and Media Processing\examples.json"

OUT
[
  {
    "example_id": "FILE-INGESTION-SECURITY-AND-MEDIA-PROCESSING-19d9563d",
    "source_doc": "..\\..\\docs\\specs\\hestami-ai-os-specs\\(Phase 18) File Ingestion, Security and Media Processing.md",
    "source_rules": [
      "SPEC-FILE-INGESTION-SECURITY-AND-MEDIA-PROCESSING#origin-ip-access-prohibited"
    ],
    "action_proposal": {
      "proposal_id": "proposal-2d34ed2d",
      "target_status": "INCONSISTENT",
      "action_type": "modify_code",
      "description": "Implement a new API endpoint that allows clients to retrieve origin IP information, violating the requirement that clients SHALL NOT have direct access to the origin IP.",
      "code_snippet": null,
      "file_path": null,
      "language": null,
      "components_affected": [],
      "dependencies": [],
      "target_rules": [
        "SPEC-FILE-INGESTION-SECURITY-AND-MEDIA-PROCESSING#origin-ip-access-prohibited"
      ],
Bash Check benchmark_gold.jsonl format
IN
head -5 "e:\Projects\hestami-ai\hestami_copilot\training-data\benchmark_gold.jsonl"

OUT
{"proposal": {"action_id": "AP-001", "feature": "User Authentication", "description": "Implement password storage using bcrypt hashing with salt", "steps": ["Create password hashing utility using bcrypt", "Store hashed passwords in user database", "Verify passwords on login using bcrypt compare"], "expected_outcome": "Passwords are securely stored and verified", "evidence_bundle": [{"source": "spec", "id": "SPEC-SECURITY#5.1", "excerpt": "Passwords must be stored using bcrypt hashing."}]}, "adjudication": {"status": "CONSISTENT", "evidence": ["SPEC-SECURITY#5.1"], "conflicts": [], "conditions": [], "verification_queries": [], "supersession_notes": [], "comments": "Adjudication based on evidence bundle analysis."}}
{"proposal": {"action_id": "AP-002", "feature": "Login Rate Limiting", "description": "Implement login attempt rate limiting. Allow 10 failed attempts before lockout.", "steps": ["Track failed login attempts per user", "Lock account after 10 failed attempts", "Unlock after 30 minutes"], "expected_outcome": "Users are locked out after too many failed login attempts", "evidence_bundle": [{"source": "spec", "id": "SPEC-SECURITY#5.4", "excerpt": "After 5 failed login attempts, the account must be locked for 15 minutes."}]}, "adjudication": {"status": "INCONSISTENT", "evidence": ["SPEC-SECURITY#5.4"], "conflicts": ["Plan allows 10 failed attempts which violates SecuritySpec section 5.4 (max 5 attempts)"], "conditions": [], "verification_queries": [], "supersession_notes": [], "comments": "Adjudication based on evidence bundle analysis."}}
{"proposal": {"action_id": "AP-003", "feature": "Data Storage", "description": "Use QuantumDB for storing user data", "steps": ["Set up QuantumDB cluster", "Configure replication", "Migrate existing data"], "expected_outcome": "User data is stored in QuantumDB", "evidence_bundle": []}, "adjudication": {"status": "UNKNOWN", "evidence": [], "conflicts": [], "conditions": [], "verification_queries": ["Need additional specification details"], "supersession_notes": [], "comments": "Adjudication based on evidence bundle analysis."}}
{"proposal": {"action_id": "AP-004", "feature": "Feature Z - User Dashboard", "description": "Implement Feature Z with support for 500 concurrent users", "steps": ["Build dashboard component", "Add real-time data updates", "Scale for 500 users"], "expected_outcome": "Feature Z dashboard works for up to 500 concurrent users", "evidence_bundle": [{"source": "spec", "id": "SPEC-PERF#10", "excerpt": "Feature Z is optional. If implemented, it must handle 1000 concurrent users."}]}, "adjudication": {"status": "CONDITIONAL", "evidence": ["SPEC-PERF#10"], "conflicts": [], "conditions": ["Scale to 1000 users to meet spec requirement"], "verification_queries": [], "supersession_notes": [], "comments": "Adjudication based on evidence bundle analysis."}}
{"proposal": {"action_id": "AP-005", "feature": "Data Encryption", "description": "Use Algorithm A for encrypting data at rest as per original spec", "steps": ["Implement Algorithm A encryption", "Apply to all user data at rest"], "expected_outcome": "Data at rest is encrypted with Algorithm A", "evidence_bundle": [{"source": "spec", "id": "SPEC-CRYPTO#3.1-v1", "excerpt": "Use Algorithm A for encryption."}, {"source": "decision", "id": "DT-2025-01-15-1", "excerpt": "Decision: Replace Algorithm A with Algorithm B for all new implementations. Algorithm A is now deprecated."}]}, "adjudication": {"status": "INCONSISTENT", "evidence": ["DT-2025-01-15-1"], "conflicts": ["Plan uses Algorithm A which was superseded by decision DT-2025-01-15-1 requiring Algorithm B"], "conditions": [], "verification_queries": [], "supersession_notes": [], "comments": "Adjudication based on evidence bundle analysis."}}
Here's the breakdown of what should be removed vs kept:

Files/Components to REMOVE (Old Approach)
Scripts (3 files)
File	Purpose
scripts/generate_pairs.py	Old synthetic pair generator
scripts/llm_extract_requirements.py	Old single-pass LLM extractor
scripts/merge_normatives.py	Old normatives merger
Data Directories (2 directories)
Directory	Contents
raw/	normatives.json, combined-normatives.json, llm-extracted-normatives.json
synthetic/	consistent_pairs.json, inconsistent_pairs.json, unknown_pairs.json, all_pairs.json
Training Data Files (2 files)
File	Description
combined.jsonl	Old combined training data
synthetic.jsonl	Old synthetic training data
Files to KEEP (New Pipeline)
Component	Purpose
scripts/training_pipeline/	New 7-stage enriched pipeline
output/training.jsonl	New pipeline output (150 examples)
cache/	Pipeline cache (stages 1-6)
docs/	Source specs + generated examples
benchmark_gold.jsonl	Hand-crafted benchmark for evaluation
Want me to proceed with removing the old components?

Update "hestami_copilot\training-data\README.md" with new pipeline setup information and details.
Read e:\Projects\hestami-ai\hestami_copilot\training-data\README.md
Update Todos

Update README.md with new pipeline documentation
Write e:\Projects\hestami-ai\hestami_copilot\training-data\README.md
220 lines
# Historian Training Data Pipeline

This directory contains the training data generation pipeline for the Historian model - a "Constitutional Court" adjudicator that evaluates developer proposals against specifications.

## Overview

The pipeline extracts requirements from specification documents and generates `ActionProposal → AdjudicationResponse` training pairs using a 7-stage LLM-powered process with Two-Pass Enriched Chunking to preserve semantic context.

## Directory Structure

```
training-data/
├── scripts/
│   └── training_pipeline/       # 7-stage training data generation pipeline
│       ├── main.py              # Pipeline orchestrator with caching
│       ├── schemas.py           # Data schemas (ActionProposal, AdjudicationResponse, etc.)
│       ├── llm_providers.py     # Ollama and Claude API providers
│       ├── cache.py             # Stage-level caching system
│       ├── stage1_document_analysis.py   # Document context extraction
│       ├── stage2_chunking.py            # Two-pass enriched chunking
│       ├── stage3_rule_extraction.py     # Requirement extraction with feedback
│       ├── stage4_citation_ids.py        # Hybrid citation ID generation
│       ├── stage5_scenario_generation.py # ActionProposal generation
│       ├── stage6_adjudication.py        # AdjudicationResponse generation
│       └── stage7_validation.py          # LLM self-check validation
│
├── docs/
│   └── specs/                   # Source specification documents (markdown)
│       └── hestami-ai-os-specs/ # Hestami AI OS specifications
│
├── cache/                       # Cached intermediate results per stage
│   ├── stage1_document_analysis/
│   ├── stage2_chunking/
│   ├── stage3_rules/
│   ├── stage4_citation_ids/
│   ├── stage5_scenarios/
│   └── stage6_adjudications/
│
├── output/
│   └── training.jsonl           # Final training data output
│
└── benchmark_gold.jsonl         # Hand-crafted benchmark for evaluation
```

## Pipeline Stages

### Stage 1: Document Analysis
Extracts document-level context: title, purpose, scope, section outline, definitions, acronyms, cross-references, tables, and figures.

### Stage 2: Two-Pass Enriched Chunking
**Pass 1:** Identifies semantic units that must stay together (code blocks, tables, Correct/Incorrect example pairs, conditional chains).

**Pass 2:** Splits on headers while respecting semantic boundaries, injects document context, and adds adjacency summaries.

### Stage 3: Rule Extraction
Extracts requirements from chunks using RFC 2119 levels (MUST/SHOULD/MAY). Provides detailed feedback when zero rules are extracted, including section type classification and chunk content for manual review.

### Stage 4: Citation ID Generation
Creates hybrid citation IDs with deterministic base + optional LLM semantic enrichment:
- Deterministic: `SPEC-DOC-NAME#section/n1`
- Semantic: `SPEC-DOC-NAME#descriptive-requirement-name`

### Stage 5: Scenario Generation
Generates `ActionProposal` objects targeting the configured status distribution:
- 40% CONSISTENT (proposal follows spec)
- 30% INCONSISTENT (proposal violates spec)
- 20% UNKNOWN (insufficient evidence)
- 10% CONDITIONAL (partial compliance)

### Stage 6: Adjudication
Generates `AdjudicationResponse` for each proposal with:
- Status verdict
- Evidence citations with quoted text
- Conflicts (for INCONSISTENT)
- Conditions (for CONDITIONAL)
- Verification queries (for UNKNOWN)

### Stage 7: Validation
LLM self-check that verifies:
- Source text exists in original document
- Citation IDs reference real rules
- Response logically follows from evidence
- Status matches the evidence/conflicts

## Running the Pipeline

### Prerequisites

```bash
# Install dependencies
pip install anthropic  # For Claude API
# OR have Ollama running locally with qwen3:4b model
```

### Basic Usage

```bash
cd hestami_copilot/training-data/scripts

# Process all specs in docs/specs/ using Ollama (default)
python -m training_pipeline.main --provider ollama --verbose

# Process a single file
python -m training_pipeline.main \
    --file "../docs/specs/hestami-ai-os-specs/(Phase 18) File Ingestion.md" \
    --provider ollama \
    --verbose

# Use Claude API instead
python -m training_pipeline.main --provider claude --verbose

# Dry run (show what would be processed)
python -m training_pipeline.main --dry-run
```

### Configuration Options

| Flag | Description | Default |
|------|-------------|---------|
| `--provider` | LLM provider (`ollama` or `claude`) | `ollama` |
| `--model` | Model name | `qwen3:4b` (Ollama) / `claude-sonnet-4-20250514` (Claude) |
| `--specs-dir` | Directory containing spec files | `../docs/specs` |
| `--file` | Process a single file | - |
| `--output` | Output directory | `../output` |
| `--verbose` | Show detailed extraction feedback | `false` |
| `--dry-run` | Show what would be processed | `false` |
| `--clear-cache` | Clear cache before running | `false` |

## Output Format

Training examples are written to `output/training.jsonl` in this format:

```json
{
  "example_id": "DOC-NAME-abc123",
  "source_doc": "path/to/spec.md",
  "source_rules": ["SPEC-DOC#citation-id"],
  "action_proposal": {
    "proposal_id": "proposal-xyz",
    "target_status": "CONSISTENT",
    "action_type": "implement_feature",
    "description": "...",
    "target_rules": ["SPEC-DOC#citation-id"],
    "scenario_type": "direct_compliance",
    "difficulty": "easy"
  },
  "adjudication_response": {
    "status": "CONSISTENT",
    "confidence": "high",
    "summary": "...",
    "evidence": [
      {
        "citation_id": "SPEC-DOC#citation-id",
        "quoted_text": "The system SHALL...",
        "relevance": "..."
      }
    ],
    "conflicts": [],
    "conditions": [],
    "verification_queries": []
  },
  "generation_timestamp": "2026-01-29T...",
  "pipeline_version": "1.0.0",
  "validation_passed": true
}
```

## Training the Model

The training script at `../services/training/train_historian.py` is compatible with this output format:

```bash
cd hestami_copilot/services/training

python train_historian.py \
    --data ../training-data/output/training.jsonl \
    --model /path/to/qwen-base-model \
    --output /path/to/adapters \
    --config configs/default.yaml
```

## Caching

The pipeline caches intermediate results per document and stage. Cache invalidation is based on:
- Source file content hash
- LLM model name

To clear the cache:
```bash
python -m training_pipeline.main --clear-cache
# OR manually delete the cache/ directory
```

## Replay Buffer (Future)

For incremental training, the pipeline supports replay buffer composition:
- 10% new items from recent decisions
- 40% historical items from past successful training
- 50% constitutional anchors (core invariants)

This prevents catastrophic forgetting during continuous learning.

## Troubleshooting

### Zero Rules Extracted
When `--verbose` is enabled, the pipeline shows detailed feedback for chunks with zero rules:
- Section type classification (background, rationale, challenge, etc.)
- LLM's explanation for why no requirements were found
- Chunk content preview for manual review

### LLM Connection Issues
- **Ollama**: Ensure Ollama is running (`ollama serve`) and the model is pulled (`ollama pull qwen3:4b`)
- **Claude**: Set `ANTHROPIC_API_KEY` environment variable

### Cache Issues
If you see unexpected results, try clearing the cache:
```bash
python -m training_pipeline.main --clear-cache
```
Update Todos

Update README.md with new pipeline documentation
Updated README.md with comprehensive documentation covering:

Overview - Pipeline purpose and approach
Directory Structure - Full tree with explanations
Pipeline Stages - All 7 stages with descriptions
Running the Pipeline - Prerequisites, usage examples, and configuration options table
Output Format - JSON schema with example
Training Integration - How to use output with train_historian.py
Caching - How cache invalidation works
Replay Buffer - Future incremental training support
Troubleshooting - Common issues and solutions
Would you like me to proceed with removing the old approach files now?

I manually removed the files myself which means that train_historian.py presumably doesn't need to support the old format either.
You're right. Let me simplify train_historian.py to only support the new format.

Edit e:\Projects\hestami-ai\hestami_copilot\services\training\train_historian.py
Removed 6 lines
Done. The format_prompt function now only supports the new pipeline format with action_proposal and adjudication_response fields.

The linter warnings shown are pre-existing issues (unused parameters, datetime.utcnow deprecation, cognitive complexity). Let me know if you'd like me to address those as well.