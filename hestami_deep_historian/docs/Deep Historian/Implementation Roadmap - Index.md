# Historian Agent Platform - Implementation Roadmap

## Overview

This roadmap breaks down the Historian Agent Platform implementation into manageable phases. Each phase builds upon the previous, ensuring incremental progress with verifiable milestones.

Refer to the [Historian Agent Platform Design Blueprint](./Historian%20Agent%20Platform%20Design%20Blueprint.md) for detailed architectural and design specifications.

---

## Current Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 0 | 🟡 In Progress | Scaffolding complete; awaiting model weights and service verification |
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

### Implementation Choices (Phase 0)
| Component | Choice | Rationale |
|-----------|--------|-----------|
| LLM Model | Qwen3-4B-Thinking | Thinking-mode model optimized for reasoning tasks |
| vLLM Version | v0.15.0-cu130 | Proven working with Qwen3 |
| Package Manager | uv | Fast, modern Python tooling |
| CLI Framework | Typer + Rich | Modern CLI with good UX |
| Configuration | Pydantic Settings | Type-safe config with env vars |
| Logging | structlog | Structured, contextual logging |

> **Note**: Qwen3-4B-Thinking supports only thinking mode. The default chat template automatically includes `<think>`, so model output will contain only `</think>` without an explicit opening tag.

---

## Quick Start

```bash
# 1. Download Qwen3-4B-Thinking model weights
huggingface-cli download unsloth/Qwen3-4B-Thinking-2507 --local-dir ./models/qwen3-4b-thinking

# 2. Configure environment
cp .env.example .env

# 3. Build and start services
docker compose build
docker compose up -d

# 4. Verify health
docker compose exec orchestrator historian health
```




