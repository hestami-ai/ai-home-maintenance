# Historian Agent Platform

A **local-first, auditable AI system** for verifying proposals against authoritative specifications.

## Overview

The Historian Agent Platform is a structured verification pipeline that produces **grounded, deterministic judgments** with full traceability. Unlike free-form AI assistants, it operates with strict separation of concerns:

- **Authority Retrieval** (PageIndex) - Hierarchical TOC-based document retrieval
- **Logical Reasoning** (Beads Trace) - Stepwise, auditable chain-of-thought
- **Versioned Truth State** (Dolt) - Git-for-data SQL database

## Key Features

- **Accuracy-First**: Every claim must be backed by evidence from authoritative sources
- **Deterministic**: Same input + same knowledge base = same output
- **Auditable**: Complete reasoning trace with citations for every finding
- **Local-First**: All critical processing runs locally for data security
- **Self-Hosted**: No external API dependencies for core verification

## Architecture

```
[ Executor Proposal ]
         │
         ▼
┌─────────────────────────────┐
│   Historian Orchestrator    │  ← DBOS durable workflows
└─────────────┬───────────────┘
              │
    ┌─────────┴─────────┐
    │                   │
    ▼                   ▼
┌─────────┐       ┌──────────┐
│PageIndex│       │   Dolt   │
│(Retrieval)│     │ (Truth)  │
└────┬────┘       └────┬─────┘
     │                 │
     └────────┬────────┘
              ▼
       Evidence + Context
              │
              ▼
      ┌──────────────┐
      │ Beads Trace  │  ← Reasoning Ledger
      └──────┬───────┘
             │
             ▼
        [ Judgment ]
   (Verdict + Citations)
```

## Quick Start

### Prerequisites

- Docker Desktop with WSL2 (Windows) or Docker Engine (Linux)
- NVIDIA GPU with ~24GB VRAM (RTX 4090 recommended)
- NVIDIA Container Toolkit
- Qwen3-4B-Thinking model weights in `./models/qwen3-4b-thinking/`
NOTE: This model supports only thinking mode. Meanwhile, specifying enable_thinking=True is no longer required.

Additionally, to enforce model thinking, the default chat template automatically includes <think>. Therefore, it is normal for the model's output to contain only </think> without an explicit opening <think> tag.

### Setup

1. **Clone and configure**:
   ```bash
   cd hestami_deep_historian
   cp .env.example .env
   ```

2. **Download model weights**:
   Place Qwen3-4B-Thinking model files in `./models/qwen3-4b-thinking/`

   huggingface-cli download unsloth/Qwen3-4B-Thinking-2507 --local-dir ./models/qwen3-4b-thinking

3. **Start services**:
   ```bash
   docker compose up -d
   ```

4. **Verify health**:
   ```bash
   docker compose exec orchestrator historian health
   ```

### Usage

```bash
# Check service health
historian health

# Show current configuration
historian config

# Verify a proposal (Phase 1+)
historian verify /path/to/proposal.md

# Start API server
historian serve --port 8080
```

## Project Structure

```
hestami_deep_historian/
├── orchestrator/           # Historian orchestrator code
│   └── src/historian/
│       ├── models/         # Pydantic data models
│       ├── services/       # Service clients (vLLM, PageIndex, Dolt)
│       └── workflows/      # DBOS durable workflows
├── services/               # Docker service definitions
│   ├── vllm/              # Qwen3-4B-Thinking inference server
│   ├── pageindex/         # Document retrieval service
│   ├── dolt/              # Versioned truth database
│   └── orchestrator/      # Orchestrator container
├── config/                # Configuration files
├── docs/                  # Documentation and specs
│   ├── Deep Historian/    # Design blueprints and roadmap
│   └── specs/             # Specification documents to verify against
├── models/                # LLM model weights (gitignored)
├── volumes/               # Docker volume data (gitignored)
├── tests/                 # Test files
├── docker-compose.yml     # Service orchestration
├── pyproject.toml         # Python project configuration
└── README.md
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| orchestrator | 8080 | Historian workflow engine |
| vllm | 8000 | Qwen3-4B-Thinking inference server |
| pageindex | 8081 | Document retrieval service |
| dolt | 3306 | MySQL-compatible truth database |

## Implementation Phases

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 0 | ✅ Complete | Project setup and baseline |
| Phase 1 | ⬜ Pending | Claim decomposition & retrieval MVP |
| Phase 2 | ⬜ Pending | Beads trace & reasoning core |
| Phase 3 | ⬜ Pending | Truth context & advanced reasoning |
| Phase 4 | ⬜ Pending | Robustness, determinism & caching |
| Phase 5 | ⬜ Pending | Evaluation harness & refinement |
| Phase 6 | ⬜ Pending | Optional enhancements |

See [Implementation Roadmap](docs/Deep%20Historian/Implementation%20Roadmap%20-%20Index.md) for details.

## Verdicts

The Historian produces one of three verdicts:

- **PASS**: Proposal is compliant with all requirements
- **BLOCK**: Proposal violates one or more requirements
- **REVISE**: Proposal has ambiguities or gaps requiring clarification

Every verdict is backed by:
- Evidence citations from specification documents
- Reasoning trace showing how conclusions were reached
- Truth context from prior interpretations and rulings

## Configuration

Configuration can be set via:
1. Environment variables (highest precedence)
2. `config/historian.yaml` file
3. Built-in defaults

Key settings:

| Setting | Default | Description |
|---------|---------|-------------|
| `HISTORIAN_COVERAGE_THRESHOLD` | 0.9 | Minimum coverage ratio required |
| `HISTORIAN_ALLOW_DEGRADED_MODE` | false | Allow REVISE on coverage gaps |
| `VLLM_TEMPERATURE` | 0.0 | LLM temperature (0=deterministic) |

## Development

### Local Development

```bash
# Install dependencies with uv
uv pip install -e ".[dev]"

# Run tests
pytest

# Type checking
mypy orchestrator/src/historian

# Linting
ruff check orchestrator/src/historian
```

### Docker Development

```bash
# Build all services
docker compose build

# Start with logs
docker compose up

# View specific service logs
docker compose logs -f orchestrator

# Execute commands in container
docker compose exec orchestrator historian health
```

## Documentation

- [Design Blueprint](docs/Deep%20Historian/Historian%20Agent%20Platform%20Design%20Blueprint.md) - Full architectural specification
- [Implementation Roadmap](docs/Deep%20Historian/Implementation%20Roadmap%20-%20Index.md) - Phase-by-phase implementation plan
- [Phase 0 Details](docs/Deep%20Historian/Phase%200%20-%20Project%20Setup%20and%20Baseline.md) - Current phase tasks

## License

MIT License - See LICENSE for details.
