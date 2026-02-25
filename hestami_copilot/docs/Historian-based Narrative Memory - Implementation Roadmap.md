# Historian-based Narrative Memory - Implementation Roadmap

> **Last Updated**: 2026-01-28
> **Status**: Phase 1 Complete, Deterministic Historian Ready

## Current State Summary

### Completed
- **Phase 0**: All foundational contracts, schemas, and truth substrate components
- **Phase 1**: Deterministic Historian - prompt, validators, and gold benchmarks
- **Infrastructure**: All Docker services built and operational
- **Spec Indexer**: 106 documents synced with 944 sections and 310 normative statements
- **Gold Benchmarks**: 20 test cases (5 CONSISTENT, 5 INCONSISTENT, 5 UNKNOWN, 3 CONDITIONAL, 2 SUPERSEDED)

### Running Services
```
hestami-registry-db      Up (healthy)    port 5433
hestami-historian        Up              port 8000
hestami-bundle-builder   Up              port 3001
hestami-indexer          Up              (background)
```

### Immediate Next Steps
1. **Download/Train Base Model**: Place Qwen 3-8B model files in `./models/base`
2. **Run Benchmarks**: `docker compose restart bench` to validate historian
3. **Begin Phase 2**: Executor contract enforcement and evidence bundle builder integration

### Setup Notes
- **Port 5433**: Registry DB uses external port 5433 (internal 5432) to avoid conflicts with existing PostgreSQL
- **ESM/CJS Interop**: Uses `createRequire` pattern for CommonJS modules in ESM context (AJV, crypto-js)
- **Schema Reserved Words**: PostgreSQL column `references` is quoted in migrations

### Project Structure
```
hestami_copilot/
├── schemas/                    # JSON Schema definitions (v1/v2)
├── packages/
│   ├── contracts/              # TypeScript types + validators
│   └── corpus-tools/           # Spec parsing + hashing
├── services/
│   ├── registry-db/            # PostgreSQL + migrations
│   ├── indexer/                # Spec sync service
│   ├── bundle-builder/         # Evidence bundle API
│   ├── historian-infer/        # vLLM inference server
│   ├── bench/                  # Benchmark runner
│   └── training/               # LoRA training service
├── extension/                  # VS Code extension (Hestami Court)
├── docs/                       # Specifications
└── docker-compose.yml          # Service orchestration
```

---

## Overview

This roadmap outlines the implementation plan for the **Historian-based Narrative Memory** system - a governance subsystem for AI-assisted software development that ensures long-term architectural and policy coherence through a dedicated "Constitutional Court" Historian agent.

### Core Principles
- **No-RAG Adjudication**: Historian relies on internalized invariants + self-contained proposals, not inference-time retrieval
- **Contract-First Design**: Strict JSON schemas govern all agent communication
- **Citation Discipline**: Every normative claim must be grounded in evidence
- **Abstention as Success**: UNKNOWN is a correct outcome when evidence is insufficient
- **Regression-Gated Updates**: No model change without evidence, regression testing, and audit trail

### System Architecture (Hybrid Cloud/Local)

| Role | Hosting | Model | Function |
|------|---------|-------|----------|
| **Executor** | Cloud (API) | Claude 3.5 Sonnet / GPT-4o | Proposes changes, produces ActionProposal |
| **Technical Expert** | Cloud (API) | Claude 3.5 Sonnet | Drafts decisions, assists humans |
| **Historian** | Local (RTX 4090) | Qwen 3-8B/14B | Adjudicates proposals, enforces invariants |

---

## Phase 0: Foundational Contracts & Truth Substrate ✅

**Duration**: ~1-2 weeks
**Status**: **COMPLETE**
**Purpose**: Establish non-negotiable interfaces, schemas, and ground truth before any model training

### Deliverables

#### 0.1 Canonical JSON Schemas
- [x] `ActionProposal.v2.json` - Self-contained proposals with evidence bundles → `schemas/action-proposal.v2.json`
- [x] `AdjudicationResponse.v2.json` - Verdicts with anchor sufficiency → `schemas/adjudication-response.v2.json`
- [x] `DecisionTrace.v1.json` - Human-approved truth records → `schemas/decision-trace.v1.json`
- [x] `SpecCitation.v1.json` - Stable document reference format → `schemas/spec-citation.v1.json`

#### 0.2 Schema Infrastructure
- [x] JSON Schema validators (fail-fast, deterministic errors) → `packages/contracts/src/validator.ts`
- [x] Schema round-trip tests (validate → serialize → deserialize → validate) → `packages/contracts/src/validate-schemas.ts`
- [x] TypeScript type generation from schemas → `packages/contracts/src/types.generated.ts`

#### 0.3 Spec Corpus Normalization
- [x] Markdown spec ingestion pipeline → `packages/corpus-tools/src/parser.ts`
- [x] Stable `doc_id` + `section_id` indexer → `services/indexer/`
- [x] Quote hash generation (`sha256` of normalized excerpts) → `packages/corpus-tools/src/hash.ts`
- [x] Section anchor extraction (headers, code blocks, lists) → `packages/corpus-tools/src/parser.ts`

#### 0.4 Decision Ledger Foundation
- [x] Database schema for decision traces → `services/registry-db/migrations/001_initial_schema.sql`
- [x] Status lifecycle support (`ACTIVE` → `SUPERSEDED` → `RETIRED`) → `decision_status` enum
- [x] Supersession graph structure → `supersedes` foreign key references
- [x] Trust tier enforcement (`HUMAN_APPROVED`, `HUMAN_NOTED`, `MODEL_DRAFT`) → `trust_tier` enum

### Hard Gates
- No schema ambiguity allowed
- No spec section without a stable ID
- No citation that cannot be validated against corpus

### Exit Criteria
A proposal and adjudication can be schema-validated and round-tripped with **zero inference**.

---

## Phase 1: Deterministic Historian (No Training) ✅

**Duration**: ~2-3 weeks
**Status**: **COMPLETE**
**Purpose**: Make the Historian reliable before any learning

### Deliverables

#### 1.1 Baseline Historian Prompt
- [x] System prompt with zero creativity mandate → `services/historian-infer/prompts/system-prompt.md`
- [x] Explicit evaluation checklist format → 6-step evaluation protocol in prompt
- [x] Mandatory abstention rules → "Abstention is Success" section
- [x] JSON-only output enforcement → "Output Format" section

#### 1.2 Anchor Sufficiency Gate
- [x] Proposal completeness validator → `services/historian-infer/src/validators/anchor_sufficiency.py`
- [x] Automatic `UNKNOWN` / `CONDITIONAL` for insufficient anchors → `assess_anchor_sufficiency()`
- [x] Verification query generator for missing evidence → `generate_verification_queries()`

#### 1.3 Hard Guardrails Implementation
- [x] Citation validator (no uncited normative claims) → `services/historian-infer/src/validators/citation_validator.py`
- [x] Conflict validator (no conflicts without citations) → `validate_response_citations()`
- [x] Schema field validator (required fields by status) → `services/historian-infer/src/validators/schema_validator.py`
- [x] ID existence checker against corpus index → `services/historian-infer/src/validators/id_checker.py`

#### 1.4 Static Verifier Pass
- [x] Post-hoc scan for uncited "must/must not" statements → `services/historian-infer/src/validators/static_verifier.py`
- [x] Evidence-claim alignment checker → `check_evidence_claim_alignment()`
- [x] Keyword extraction for conflict detection → `extract_domain_keywords()`

#### 1.5 Minimal Gold Benchmark (20 cases)
- [x] 5 CONSISTENT cases → `services/bench/cases/001*.json, 006-009*.json`
- [x] 5 INCONSISTENT cases → `services/bench/cases/002*.json, 010-013*.json`
- [x] 5 UNKNOWN cases → `services/bench/cases/003*.json, 014-017*.json`
- [x] 3 CONDITIONAL cases → `services/bench/cases/004*.json, 018-019*.json`
- [x] 2 SUPERSEDED decision cases → `services/bench/cases/005*.json, 020*.json`

### Hard Gates
- No hallucinated spec/decision references
- No invalid JSON output
- No normative claim without citation

### Exit Criteria
Historian behaves like a **deterministic rules engine with language**, not an "assistant."

---

## Phase 2: Executor Contract Enforcement

**Duration**: ~2 weeks
**Purpose**: Ensure the Historian never compensates for a weak Executor

### Deliverables

#### 2.1 Executor Output Linter
- [ ] Reject proposals missing required fields:
  - assumptions
  - invariants
  - spec_refs
  - evidence_bundle
- [ ] Validation error messages with remediation hints
- [ ] Pre-submission checklist UI/CLI

#### 2.2 Evidence Bundle Builder
- [ ] Excerpt extraction by stable IDs
- [ ] Size limit enforcement (e.g., max 1200 chars per excerpt)
- [ ] Claim-excerpt linking validator
- [ ] Bundle completeness scorer

#### 2.3 Proposal Completeness Scoring
- [ ] Quantitative "evaluable / non-evaluable" metric
- [ ] Surface coverage checker (schema, backend, frontend, tests, etc.)
- [ ] Invariant coverage checker
- [ ] Dependency chain validator

#### 2.4 Failure Mode Catalog
- [ ] Document common executor omissions
- [ ] Map omissions to historian responses
- [ ] Create training/test cases for each failure mode

### Hard Gates
- Historian never asked to adjudicate incomplete proposals
- Executor never allowed to "hand-wave" evidence

### Exit Criteria
Historian failures are attributable only to **knowledge gaps**, not missing inputs.

---

## Phase 3: Training Data Pipeline (Pre-Model)

**Duration**: ~2-3 weeks
**Purpose**: Generate correct learning material before touching model weights

### Deliverables

#### 3.1 Training Item Schemas
- [ ] SFT items (proposal → adjudication)
- [ ] Abstention items (missing anchors → UNKNOWN)
- [ ] Supersession items (old decision → newer citation)
- [ ] Conflict surfacing items (contradictory rules)
- [ ] Critique items (proposal → conflict report)
- [ ] Repair items (proposal + critique → revised plan)

#### 3.2 Automated Spec Decomposition
- [ ] MUST / MUST NOT extractor (keyword-based)
- [ ] SHOULD / SHOULD NOT extractor
- [ ] Invariant extractor (conditional rules)
- [ ] Scope boundary extractor

#### 3.3 Decision Trace Canonicalizer
- [ ] Human correction → structured DecisionTrace converter
- [ ] Discussion thread → rationale distiller
- [ ] Normative outcome extractor

#### 3.4 Synthetic Pair Generation
- [ ] Evidence-removed variant generator (for UNKNOWN training)
- [ ] Contradiction variant generator
- [ ] Subtle violation generator (near-miss cases)
- [ ] Compliant variant generator

#### 3.5 Trust-Tier Filtering
- [ ] Pipeline to include only `HUMAN_APPROVED` decisions
- [ ] Quarantine for `MODEL_DRAFT` items
- [ ] Promotion workflow for `HUMAN_NOTED` → `HUMAN_APPROVED`

### Hard Gates
- No training item without a verifiable anchor
- No mixing speculative notes into authoritative training

### Exit Criteria
You can regenerate the **entire training corpus deterministically** from specs + decisions.

---

## Phase 4: Historian SFT (LoRA, Controlled)

**Duration**: ~3-4 weeks
**Purpose**: Teach the Historian how to adjudicate, not what to believe

### Deliverables

#### 4.1 Model Selection & Setup
- [ ] Qwen 3-8B baseline download and validation
- [ ] 4-bit quantization setup (QLoRA configuration)
- [ ] LoRA adapter configuration (rank=8, alpha=16)
- [ ] Training environment container (GPU-enabled)

#### 4.2 QLoRA SFT Training
- [ ] Classification task training (CONSISTENT/INCONSISTENT/CONDITIONAL/UNKNOWN)
- [ ] Citation discipline training (cite-or-refuse behavior)
- [ ] Abstention training (refuse when uncertain)
- [ ] Conflict explanation training (structured conflict output)

#### 4.3 Replay Buffer Implementation
- [ ] Core invariants dataset (always included)
- [ ] Historical failure cases (worst mistakes)
- [ ] Evidence-removed abstention pairs
- [ ] Constitutional anchors (JSON formatting, logic preservation)

#### 4.4 Regression Harness
- [ ] Automated benchmark runner
- [ ] Phase-1 gold case validation
- [ ] Metric computation (accuracy, citation precision/recall, abstention rate)
- [ ] Regression detection with configurable thresholds

### Hyperparameters (Starting Point)
```
base_model: Qwen3-8B (4-bit quantized)
lora_rank: 8
lora_alpha: 16
learning_rate: 2e-4
batch_size: 4 (with gradient accumulation)
max_seq_length: 1024
epochs: 3-5
```

### Hard Gates
- Unsupported assertion rate > 1% → FAIL
- UNKNOWN accuracy < 95% on evidence-removed pairs → FAIL
- Any regression on supersession handling → FAIL

### Exit Criteria
Historian is **strict, skeptical, and boring** (this is success).

---

## Phase 5: Preference Tuning (DPO)

**Duration**: ~2 weeks
**Purpose**: Shape judgment quality, not factual content

### Deliverables

#### 5.1 DPO Dataset Generation
- [ ] Good vs bad adjudication pairs
- [ ] Overconfident vs abstaining pairs
- [ ] Well-cited vs poorly-cited pairs
- [ ] Clear conflict vs glossed conflict pairs

#### 5.2 Preference Axes Training
- [ ] Cite-or-refuse preference (penalize uncited assertions)
- [ ] Early conflict surfacing preference
- [ ] Conservative confidence preference
- [ ] Schema compliance preference

#### 5.3 Verifier-Aware Training
- [ ] Penalize outputs that fail verifier checks
- [ ] Reward outputs with high citation precision
- [ ] Penalize overconfident classifications

### Hard Gates
- Any increase in hallucinations → FAIL
- Any decrease in abstention correctness → FAIL
- Any regression on core benchmark → FAIL

### Exit Criteria
Historian prefers **safe refusal over clever guess**.

---

## Phase 6: Narrative Distillation Pipeline (Experimental Core)

**Duration**: ~3-4 weeks
**Purpose**: Enable learning from human corrections without drift

### Deliverables

#### 6.1 Decision-of-Note Trigger System
- [ ] Event detection: human correction
- [ ] Event detection: new invariant
- [ ] Event detection: supersession
- [ ] Trigger queue with batching logic

#### 6.2 Distillation Batch Builder
- [ ] Single decision → multiple training tuples expansion
- [ ] Replay buffer mixing (10% new, 40% historical, 50% constitutional)
- [ ] Batch size enforcement (minimum 10-50 new items)

#### 6.3 Event-Triggered LoRA Training
- [ ] Automated training job scheduler
- [ ] GPU mutex management (stop inference → train → restart)
- [ ] Training progress monitoring
- [ ] Adapter versioning

#### 6.4 Mandatory Regression System
- [ ] Pre-promotion benchmark run
- [ ] Full benchmark suite execution
- [ ] Regression report generation
- [ ] Automated pass/fail decision

#### 6.5 Adapter Promotion Logic
- [ ] Pass → promote to production
- [ ] Fail → archive with failure report
- [ ] Rollback capability to previous adapter

### Hard Gates
- No auto-promotion without regression passing
- No adapter overwrite without lineage record

### Exit Criteria
Historian improves **locally** without degrading globally.

---

## Phase 7: Model Lineage & Auditability

**Duration**: ~2 weeks
**Purpose**: Make the system governable

### Deliverables

#### 7.1 Model Registry
- [ ] Adapter ID tracking
- [ ] Training batch ID linking
- [ ] Benchmark scores storage
- [ ] Promotion/rollback history

#### 7.2 Delta Brief Generator
- [ ] "What changed" summary generator
- [ ] "Why it changed" rationale linker
- [ ] Decision trace → adapter mapping

#### 7.3 Rollback System
- [ ] One-click adapter rollback
- [ ] Rollback audit logging
- [ ] Post-rollback regression verification

#### 7.4 Human-Readable Model Card
- [ ] Included decisions list
- [ ] Known blind spots documentation
- [ ] Training data summary
- [ ] Performance characteristics

### Hard Gates
- No untraceable model state
- No inability to explain why a model changed

### Exit Criteria
You can answer: "Why did the Historian say this?" with evidence.

---

## Phase 8: Packaged Deployment (Ollama)

**Duration**: ~2 weeks
**Purpose**: Freeze and ship without losing guarantees

### Deliverables

#### 8.1 Model Artifact Pipeline
- [ ] Base + adapter merge script
- [ ] Merged FP16 model validation
- [ ] Quantization pipeline (GGUF Q4_K_M)

#### 8.2 Ollama Packaging
- [ ] Modelfile generation
- [ ] `ollama create` automation
- [ ] Model distribution setup

#### 8.3 Inference Parity Testing
- [ ] vLLM vs Ollama output comparison
- [ ] Latency benchmarking
- [ ] Memory usage validation
- [ ] Schema compliance verification

### Hard Gates
- No behavior drift between dev and packaged deployment

### Exit Criteria
Historian is reproducible, local, and portable.

---

## Phase 9: Steady-State Operation

**Duration**: Ongoing
**Purpose**: Continuous correctness, not continuous change

### Operational Capabilities
- [ ] Executor proposes (cloud)
- [ ] Historian adjudicates (local)
- [ ] Human corrects (when needed)
- [ ] Decision recorded (always)
- [ ] Distillation triggered (conditionally)
- [ ] Regression enforced (always)
- [ ] Lineage preserved (always)

### System Invariant
**No model change without evidence, regression, and audit trail.**

---

## Infrastructure: Docker Compose Architecture ✅

**Status**: **OPERATIONAL** (all core services running)

### Container Services

| Service | Status | Port | Description |
|---------|--------|------|-------------|
| `registry-db` | ✅ Running | 5433 | PostgreSQL for model registry, decisions, and specs |
| `indexer` | ✅ Running | - | Builds spec/decision indices (synced 106 docs, 944 sections, 310 normatives) |
| `bundle-builder` | ✅ Running | 3001 | Creates evidence bundles for executor proposals |
| `historian-infer` | ✅ Running | 8000 | Serves Historian model (vLLM-based, awaiting model files) |
| `bench` | ⏸️ Ready | - | Benchmark/regression suite (runs on demand) |
| `training` | ⏸️ Ready | - | LoRA training jobs (profile: training) |

```yaml
services:
  registry-db:
    # PostgreSQL 16 Alpine with custom schema
    build: ./services/registry-db
    ports: ["5433:5432"]  # External 5433 to avoid conflicts

  indexer:
    # Node.js service - parses specs, populates registry
    build: ./services/indexer
    depends_on: registry-db (healthy)

  bundle-builder:
    # Node.js API - creates evidence bundles
    build: ./services/bundle-builder
    ports: ["3001:3001"]

  historian-infer:
    # Python/vLLM inference server
    build: ./services/historian-infer
    ports: ["8000:8000"]
    deploy:
      resources:
        reservations:
          devices:
            - capabilities: [gpu]

  bench:
    # Python benchmark runner
    build: ./services/bench
    depends_on: [historian-infer, registry-db]

  training:
    # LoRA training service (GPU exclusive)
    build: ./services/training
    profiles: ["training"]
```

### GPU Mutex Model
- GPU is never shared between services
- Either inference OR training runs at any time
- Orchestrator manages handoff via Docker SDK

### Quick Start
```bash
# Start all services
docker compose up -d

# Check status
docker compose ps

# View indexer sync results
docker logs hestami-indexer

# Run benchmarks (requires model)
docker compose restart bench
```

---

## Benchmarking Metrics & Promotion Gates

### Core Metrics

| Metric | Target | Hard Gate |
|--------|--------|-----------|
| Label Accuracy | ≥ 90% | Yes |
| Citation Precision | ≥ 95% | Yes |
| Citation Recall | ≥ 90% | No (soft) |
| Unsupported Claims | ≤ 1% | Yes |
| UNKNOWN Correctness | ≥ 95% | Yes |
| Supersession Detection | ≥ 95% | Yes |
| Contradiction Surfacing | ≥ 90% | Yes |
| JSON Validity | 100% | Yes |

### Promotion Decision
- All hard gates must pass
- No >2% regression on any core benchmark
- Lineage record must be complete

---

## VS Code Extension: Hestami Court

**Status**: Scaffolding complete, integration pending

### Implemented Components

| Component | Status | Location |
|-----------|--------|----------|
| Extension activation | ✅ | `extension/src/extension.ts` |
| Conversation Canvas | ✅ | `extension/src/views/conversation.ts` |
| Feature Panel | ✅ | `extension/src/views/feature.ts` |
| Historian Client | ✅ | `extension/src/historian-client.ts` |
| Commands | ✅ | Link Spec, New Session, Adjudicate |

### Primary UI: Conversation Canvas
- Single chat thread, four personas (Product Manager, Technical Expert, Executor, Historian)
- WebView-based with VS Code theming
- Message handling for submit/adjudicate actions

### Supporting Panels
1. **Feature Panel** - Spec/roadmap links, coverage matrix → `extension/src/views/feature.ts`
2. **Court Panel** - Verdicts, conflicts, verification queries (pending)
3. **Step/Diff Panel** - Current step contract, patch diff (pending)
4. **Command Center** - Planned commands, approvals (pending)

### Workflow Phases
1. BOOTSTRAP - Link spec, compute feature ID
2. REQUIREMENTS_SHAPING - Human + Technical Expert
3. ROADMAP_SYNTHESIS - Generate phased implementation
4. EXECUTION - Step loop with dual adjudication
5. DEBUG - Secondary conversation type
6. NARRATIVE_UPDATE - Override requires DecisionTrace

---

## Success Criteria Summary

The experiment succeeds when:

1. **Historian refuses to guess** - UNKNOWN is the default when evidence is insufficient
2. **Every claim is cited** - No normative assertion without grounded evidence
3. **Supersession is detected** - Outdated decisions are flagged automatically
4. **Drift is prevented** - Regression gates block degrading updates
5. **Decisions are auditable** - Full lineage from human correction to model behavior
6. **System is intolerant of ambiguity** - Without evidence, progress is blocked

**Narrative memory is not recall - it is disciplined judgment under incomplete information.**
