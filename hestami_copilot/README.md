# Hestami Copilot

Historian-based Narrative Memory system for AI-assisted software development governance.

## Overview

This system implements a governance layer for AI-assisted development where a dedicated **Historian agent** acts as a "Constitutional Court" to validate proposals against specifications and guidelines.

### Core Principles

- **No-RAG Adjudication**: Historian relies on internalized invariants + self-contained proposals
- **Contract-First Design**: Strict JSON schemas govern all agent communication
- **Citation Discipline**: Every normative claim must be grounded in evidence
- **Abstention as Success**: UNKNOWN is a correct outcome when evidence is insufficient
- **Regression-Gated Updates**: No model change without evidence, regression testing, and audit trail

### Architecture

| Role | Hosting | Model | Function |
|------|---------|-------|----------|
| **Executor** | Cloud (API) | Claude 3.5 Sonnet / GPT-4o | Proposes changes, produces ActionProposal |
| **Technical Expert** | Cloud (API) | Claude 3.5 Sonnet | Drafts decisions, assists humans |
| **Historian** | Local (RTX 4090) | Qwen 3-8B/14B | Adjudicates proposals, enforces invariants |

## Project Structure

```
hestami_copilot/
├── docs/                     # Specifications and roadmaps
│   ├── specs/               # Normalized spec corpus
│   └── decisions/           # Human-approved decision traces
├── schemas/                  # Canonical JSON schemas
├── packages/
│   ├── contracts/           # TypeScript types + validators
│   └── corpus-tools/        # Spec ingestion and indexing
├── services/
│   ├── registry-db/         # PostgreSQL for registry
│   ├── indexer/             # Spec/decision index builder
│   ├── bundle-builder/      # Evidence bundle API
│   ├── historian-infer/     # Historian inference service
│   ├── training/            # LoRA training jobs
│   └── bench/               # Benchmark runner
├── training-data/           # Training datasets
├── models/                  # Model artifacts and adapters
├── extension/               # VS Code extension (Hestami Court)
└── docker-compose.yml       # Service orchestration
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose
- NVIDIA GPU with CUDA support (for Historian)

### Installation

```bash
# Clone and enter directory
cd hestami_copilot

# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env

# Build packages
pnpm build
```

### Start Services

```bash
# Start core services (database, indexer, bundle-builder, historian)
docker compose up -d

# Check service health
docker compose ps

# View logs
docker compose logs -f historian-infer
```

### Run Benchmarks

```bash
# Run benchmark suite against Historian
docker compose run bench
```

### Training (GPU Mutex)

```bash
# Stop inference service first (GPU mutex)
docker compose stop historian-infer

# Start training
docker compose -f docker-compose.yml -f docker-compose.training.yml up training

# After training, restart inference
docker compose stop training
docker compose up historian-infer -d
```

## Development

### Building Packages

```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter @hestami/contracts build
pnpm --filter @hestami/corpus-tools build
```

### Validating Schemas

```bash
pnpm run schema:validate
```

### Indexing Specs

```bash
pnpm --filter @hestami/corpus-tools run index-specs
```

### VS Code Extension

```bash
# Build extension
cd extension
pnpm build

# Run in development mode
code --extensionDevelopmentPath=.
```

## JSON Schemas

The system uses four core schemas:

| Schema | Description |
|--------|-------------|
| `ActionProposal.v2` | Self-contained proposals from Executor |
| `AdjudicationResponse.v2` | Verdicts with anchor sufficiency |
| `DecisionTrace.v1` | Human-approved truth records |
| `SpecCitation.v1` | Stable document references |

Schemas are located in `schemas/` and TypeScript types are generated via `@hestami/contracts`.

## Benchmarking

The benchmark suite validates the Historian against hard gates:

| Metric | Target | Hard Gate |
|--------|--------|-----------|
| Label Accuracy | ≥ 90% | Yes |
| Citation Precision | ≥ 95% | Yes |
| UNKNOWN Correctness | ≥ 95% | Yes |
| JSON Validity | 100% | Yes |
| Unsupported Claims | ≤ 1% | Yes |

## Documentation

- [Implementation Roadmap](docs/Historian-based%20Narrative%20Memory%20-%20Implementation%20Roadmap.md)
- [Experiment Approach](docs/Experiment%20Approach%20for%20Historian-based%20Narrative%20Memory.md)

## License

UNLICENSED - Proprietary
