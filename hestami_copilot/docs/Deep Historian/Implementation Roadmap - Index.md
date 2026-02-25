# Historian Agent Platform - Implementation Roadmap

## Overview

This roadmap breaks down the Historian Agent Platform implementation into manageable phases. Each phase builds upon the previous, ensuring incremental progress with verifiable milestones.

Refer to the [Historian Agent Platform Design Blueprint](./Historian%20Agent%20Platform%20Design%20Blueprint.md) for detailed architectural and design specifications.

---

## Current Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 0 | ⬜ Not Started | - |
| Phase 1 | ⬜ Not Started | - |
| Phase 2 | ⬜ Not Started | - |
| Phase 3 | ⬜ Not Started | - |
| Phase 4 | ⬜ Not Started | - |
| Phase 5 | ⬜ Not Started | - |
| Phase 6 | ⬜ Not Started | - |

---

## Phase Documents

| Phase | Title | Description |
|-------|-------|-------------|
| [Phase 0](./Phase%200%20-%20Project%20Setup%20and%20Baseline.md) | Project Setup and Baseline | Repository, Docker Compose, basic service configuration |
| [Phase 1](./Phase%201%20-%20Claim%20Decomposition%20and%20Retrieval%20MVP.md) | Claim Decomposition & Retrieval MVP | Proposal parsing, evidence retrieval, evidence assembly |
| [Phase 2](./Phase%202%20-%20Beads%20Trace%20and%20Reasoning%20Core.md) | Beads Trace & Reasoning Core | Reasoning mechanism, trace structure, preliminary verdicts |
| [Phase 3](./Phase%203%20-%20Truth%20Context%20and%20Advanced%20Reasoning.md) | Truth Context & Advanced Reasoning | Truth context integration, multi-step reasoning, uncertainty handling |
| [Phase 4](./Phase%204%20-%20Robustness%20Determinism%20and%20Caching.md) | Robustness, Determinism & Caching | Stability checks, caching layers, failure recovery |
| [Phase 5](./Phase%205%20-%20Evaluation%20Harness%20and%20Refinement.md) | Evaluation Harness & Refinement | Test suite, metrics collection, documentation |
| [Phase 6](./Phase%206%20-%20Optional%20Enhancements.md) | Optional Enhancements | Multi-user prep, API/UI, performance tuning |

---

## Milestone Summary

| Milestone | Phase | Key Outcome |
|-----------|-------|-------------|
| M1 | End of Phase 1 | Ingest proposal → output relevant spec excerpts (evidence) for each claim |
| M2 | End of Phase 2 | Produce basic verdict (Pass/Block) with reasoning trace |
| M3 | End of Phase 3 | Full reasoning pipeline with truth context, all verdict types (Pass/Block/Revise) |
| M4 | End of Phase 4 | Deterministic, stable, efficient system with failure recovery |
| M5 | End of Phase 5 | System meets evaluation targets, ready for initial deployment |
| M6 | End of Phase 6 | Extended capabilities for scaling and multi-user scenarios |

---

## Key Technologies

### Blueprint (Design Specification)
| Component | Technology | Purpose |
|-----------|------------|---------|
| Orchestrator | Python + DBOS | Durable workflow execution |
| LLM Inference | vLLM | OpenAI-compatible local inference |
| Document Retrieval | PageIndex | Hierarchical TOC-based retrieval |
| Truth Store | Dolt | Git-for-data SQL database |
| Reasoning Ledger | Beads | Append-only trace graph |

### Current Implementation
| Component | Service | Technology | Notes |
|-----------|---------|------------|-------|
| Inference API | `historian-infer` | Python FastAPI | Pre/post validation |
| LLM Backend | `historian-vllm` | vLLM v0.15.0 | LoRA adapter support |
| Document Index | `indexer` | Node.js + corpus-tools | Custom hierarchical indexer |
| Truth Store | `registry-db` | PostgreSQL 16 | *Dolt migration possible* |
| Evidence Builder | `bundle-builder` | Express.js | Keyword-based search |
| Benchmark | `bench` | Python | Hard gates validation |
| Training | `training` | Python + QLoRA | Replay buffer strategy |
| Alt. LLM | `ollama` | Ollama | Development/testing |

### Architecture Differences
The current implementation differs from the blueprint in some key areas:

| Blueprint | Current | Impact |
|-----------|---------|--------|
| Dolt (versioned) | PostgreSQL | No automatic version tracking; manual migration tracking |
| PageIndex | Custom indexer | Similar hierarchical indexing, less sophisticated reasoning |
| Beads CLI | Custom trace | Need to implement trace structure in Phase 2 |
| DBOS | FastAPI | Need to add durable execution if required |

---

## Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Compose                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  historian-  │───▶│  historian-  │    │   ollama     │  │
│  │    infer     │    │    vllm      │    │  (dev/test)  │  │
│  │   :8000      │    │   (GPU)      │    │   :11434     │  │
│  └──────┬───────┘    └──────────────┘    └──────────────┘  │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  registry-db │◀───│   indexer    │    │   bundle-    │  │
│  │  (PostgreSQL)│    │              │    │   builder    │  │
│  │   :5433      │◀───────────────────────│   :3001      │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐                       │
│  │    bench     │───▶│   training   │                       │
│  │              │    │ (GPU profile)│                       │
│  └──────────────┘    └──────────────┘                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Quick Reference

### Start Services
```bash
# Core services (no GPU inference)
docker compose up registry-db indexer bundle-builder -d

# With GPU inference
docker compose up -d

# With training (GPU exclusive)
docker compose --profile training up training
```

### Key Ports
| Service | Port | Purpose |
|---------|------|---------|
| historian-infer | 8000 | Adjudication API |
| bundle-builder | 3001 | Evidence bundle API |
| registry-db | 5433 | PostgreSQL |
| ollama | 11434 | Ollama API |

---

## Notes / Issues

### Architecture Decisions (2025-01)
- **PostgreSQL vs Dolt**: Using PostgreSQL for simpler initial setup. Dolt migration can be considered for version-controlled truth state if needed.
- **Custom Indexer vs PageIndex**: Using custom indexer for tighter integration with existing corpus-tools. PageIndex evaluation possible for Phase 1+.
- **Ollama Addition**: Added Ollama service for development and testing without vLLM GPU requirements.

### Open Questions
- [ ] Should we migrate to Dolt for truth versioning?
- [ ] Should we evaluate PageIndex as alternative to custom indexer?
- [ ] DBOS integration for durable execution needed?

### Cross-Phase Dependencies
- Phase 1 depends on Phase 0 verification complete
- Phase 2 requires Phase 1 evidence retrieval working
- Phase 3 adds truth context to Phase 2 reasoning
- Phase 4 hardens all previous work
- Phase 5 validates entire pipeline

