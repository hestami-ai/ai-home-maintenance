# JanumiCode

**Governed Multi-Role Dialogue & Execution System for AI-Assisted Software Engineering**

JanumiCode is a VS Code extension that provides a governed, auditable framework for AI-assisted software development. It prevents invalid assumptions from reaching execution, supports long-horizon reasoning with error containment, and integrates AI agents and humans in a single controlled workflow.

## Table of Contents

- [Features](#features)
- [Core Principles](#core-principles)
- [Installation](#installation)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Architecture Overview](#architecture-overview)
- [Workflow](#workflow)
- [Human Gates](#human-gates)
- [Commands](#commands)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Features

### 🔐 Governed Execution
- **Verification Gates**: No code executes without verified assumptions
- **Explicit Failure Handling**: UNKNOWN verdicts block progress instead of being smoothed over
- **Human-in-the-Loop**: Critical decisions require human approval

### 🤖 Multi-Role AI System
- **Executor (MAKER)**: Proposes solutions, decomposes task graphs, manages unit execution, and handles bounded repairs.
- **Technical Expert**: Provides domain-specific evidence, checks toolchain bounds, and retrieves API documents.
- **Verifier**: Validates claims against evidence and emits verdicts.
- **Narrative Curator**: Synthesizes structured memory (Decision Traces, Open Loops) to prevent context fragmentation over long horizons.
- **Historian-Interpreter**: Detects contradictions and surfaces precedents using semantic search.
- **Human Authority**: Makes final decisions with full context.

### 📊 Complete Audit Trail & Context Curation
- **Append-Only History**: Immutable record of all decisions, from CLI activities to LLM invocations
- **Traceability**: Every artifact traces back to verified claims and evidence
- **Vector Search (Embeddings)**: Context is dynamically pulled using semantic similarity over curatable artifacts.
- **Full-Text Search (FTS)**: Quick querying over massive streams of system output.

### 🎯 Stateless LLM Design
- **Context Compilation**: Deterministic context packs crafted for each role from canonical artifacts (Handoff Documents).
- **Token Budget Management**: Intelligent allocation across roles limits budget bloat.
- **Multi-Provider CLI Integrations**: Wrapper support across `Claude Code`, `Gemini CLI`, and `Codex CLI`.
- **No Hidden State**: All context lives in the SQL database, not in an ephemeral conversational turn history.

### 🔄 Workflow Orchestration
- **Phase-Based Execution**: Strict state machine traversing: INTAKE → ARCHITECTURE → PROPOSE → VERIFY → REVIEW → EXECUTE → VALIDATE → COMMIT.
- **Autonomous Sub-Tasking**: Advanced MAKER integration loops through task decomposition, sub-task repairs, and escalation bounds.
- **Gate Management**: Automatic suspension at blocking conditions with visual resolution widgets.
- **Resumption Support**: Continue workflows smoothly after human offline decisions or clarifications.

## Core Principles

JanumiCode is built on seven non-negotiable design principles:

1. **State lives outside the LLM** - Database is the source of truth
2. **Dialogue is subordinate to state** - Conversations don't override verified facts
3. **Execution is gated by verification** - No code runs without validation
4. **History is append-only** - Immutable audit trail
5. **Humans are first-class authorities** - Explicit decision capture with rationale
6. **Failure must be explicit** - UNKNOWN blocks, never smoothed over
7. **Simplest viable mechanism wins** - Avoid over-abstraction

## Installation

### Prerequisites

- **VS Code**: Version 1.85.0 or higher
- **Node.js**: Version 18.0.0 or higher
- **API Keys**: At least one of:
  - Anthropic API key (for Claude models)
  - OpenAI API key (for GPT models)
  - Gemini API Key

### Install from VSIX (Development)

1. Download the latest `.vsix` file from releases
2. In VS Code, go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Click the "..." menu → "Install from VSIX..."
4. Select the downloaded `.vsix` file
5. Reload VS Code when prompted

### Install from Marketplace (Coming Soon)

1. Open VS Code Extensions (Ctrl+Shift+X / Cmd+Shift+X)
2. Search for "JanumiCode"
3. Click "Install"
4. Reload VS Code when prompted

## Getting Started

### Quick Start (5 minutes)

1. **Configure API Keys**
   ```
   Ctrl+Shift+P (Cmd+Shift+P on Mac) → "JanumiCode: Set API Key"
   ```
   - Enter your provider API keys and select the roles they apply to.
   - Alternatively, supply environment variables via a local `.env` file at the extension root.

2. **Start a New Dialogue**
   ```
   Ctrl+Shift+P → "JanumiCode: Start New Dialogue"
   ```
   - Enter your goal (e.g., "Create a REST API client for the GitHub API").
   - This opens the Unified Governed Stream View where AI execution is logged.

3. **Monitor Progress**
   - Use the **Governed Stream Sidebar** to inspect the current Intake Conversational turn, view generated Handoff Documents, and manage CLI tasks in real-time.
   - Active sub-processes (like long-running queries) are denoted in the bottom status bar with the `CLI Activity` monitor.

4. **Handle Human Gates**
   - When a critical claim is UNKNOWN or a MAKER bounds repair fails, an offline gate is raised.
   - Review the context, evidence, and blocking reason inside the streaming UI.
   - Deliver one of the gate resolutions: APPROVE, REJECT, OVERRIDE, or REFRAME. Let the workflow resume seamlessly.

## Configuration

### API Keys & Providers

Choose which LLM provider to use for each role inside `settings.json`:

```json
{
  "janumicode.llm.executor.provider": "anthropic",
  "janumicode.llm.executor.model": "claude-sonnet-4-20250514",

  "janumicode.llm.technicalExpert.provider": "anthropic",
  "janumicode.llm.technicalExpert.model": "claude-haiku-4-20250731",

  "janumicode.llm.verifier.provider": "anthropic",
  "janumicode.llm.verifier.model": "claude-sonnet-4-20250514",

  "janumicode.llm.historianInterpreter.provider": "anthropic",
  "janumicode.llm.historianInterpreter.model": "claude-sonnet-4-20250514"
}
```

**Tip**: Use smaller/faster models (Haiku) for Technical Expert to reduce cost.

### Dynamic Token Budgeting

Configure the top-level token cap:

```json
{
  "janumicode.tokenBudget": 10000
}
```

### Database Management

By default, JanumiCode stores data safely in `.janumicode/database.db` inside your workspace root.

```json
{
  "janumicode.databasePath": "${workspaceFolder}/.janumicode/db.sqlite"
}
```

## Architecture Overview

### Key Agent Integration Network

```
┌─────────────┐
│   HUMAN     │ ← Final authority, reviews Clarification Threads, dictates Constraints
└──────┬──────┘
       │ provides decisions
       ↓
┌────────────────────────────────────────────────────────┐
│           STATE MACHINE & ORCHESTRATOR                 │
│         (Workflow Phases + Gate Management)            │
└─┬──────┬──────┬──────┬──────┬──────────────┬───────────┘
  │      │      │      │      │              │
  ↓      ↓      ↓      ↓      ↓              ↓
┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────────────┐ ┌─────────────┐
│EXEC│ │T-EX│ │VERI│ │HIST│ │NARRATIVE   │ │ MAKER       │
│UTOR│ │PERT│ │FIER│ │INT │ │CURATOR     │ │ TASK ENGINE │
└────┘ └────┘ └────┘ └────┘ └────────────┘ └─────────────┘
```

1. **Executor**: Proposes solutions, architects domain boundaries.
2. **MAKER Task Engine**: Takes over task graphs, delegates sub-units, conducts validations/repairs, runs execution layers.
3. **Technical Expert**: Wraps workspace telemetry & API documentation.
4. **Verifier**: Validates claims, emits verdicts.
5. **Narrative Curator**: Organizes abstract state across long horizons into semantic memories.
6. **Historian-Interpreter**: Detects contradictions during reviews by pulling embeddings.
7. **Human Authority**: Resolves blocks and open loops.

### Vast Database Subsystem
Consisting of nearly 40 interconnected tables. Highlights include:
- **Dialogue & CLI Flow**: `dialogue_events`, `workflow_commands`, `cli_activity_events`.
- **Claims & Evidence**: `claims`, `verdicts`, `evidence_packets`, `human_decisions`.
- **Intake & Memory**: `intake_conversations`, `clarification_threads`, `narrative_memories`, `decision_traces`.
- **Architecture Validation**: `arch_capabilities`, `arch_workflows`, `arch_components`, `arch_implementation_steps`.
- **Task Modeling**: `task_graphs`, `task_units`, `intent_records`, `repair_packets`.

## Workflow

### Operational State Transitions
The State Machine traverses predefined sequential, yet reversible, states:

1. **INTAKE**: Receive user intent. Clarify ambiguities until an Acceptable Contract is synthesized.
2. **ARCHITECTURE**: Construct Component and Domain mappings. Produce robust architecture documents.
3. **PROPOSE**: Executor generates structured blueprints over target codebase sections.
4. **ASSUMPTION_SURFACING**: Deconstruct plans into atomic/composite testable claims.
5. **VERIFY**: Evidentiary checks for all claims (yielding VERIFIED, DISPROVED, etc). 
6. **HISTORICAL_CHECK**: Embed queries across `historical_invariant_packets` to assert continuity.
7. **REVIEW**: Pre-execution synthesis assessing safety and boundaries against `open_loops`.
8. **EXECUTE**: Hand off graphs to MAKER. CLI bounds, multi-attempt repairs, code generation.
9. **VALIDATE**: Ensure generated observables match expected observables.
10. **COMMIT**: Generate Context Handoffs. Persist artifact references and outcome snapshots.

*Note: Any failure cascades into a localized `REPAIR` or broad `REPLAN`, retaining Context Watermarks to prevent cyclical AI blunders.*

## Commands

All commands accessible via Command Palette (Ctrl+Shift+P / Cmd+Shift+P):

| Command | Description |
|---------|-------------|
| `JanumiCode: Start New Dialogue` | Begin a new governed workflow |
| `JanumiCode: Open Governed Stream` | Open unified real-time sidebar tracking |
| `JanumiCode: View Active Claims` | Open Claims tracking view |
| `JanumiCode: Show Workflow Status` | Open Workflow state view |
| `JanumiCode: Find in Stream` | Open FTS query bar in the active stream |
| `JanumiCode: Configure` | Open configuration UI |
| `JanumiCode: Set API Key` | Quick-set LLM provider API credentials |
| `JanumiCode: Validate Config` | Test API keys and configuration bounds |
| `JanumiCode: Export History` | Export audit log (JSON) |
| `JanumiCode: Clear History` | Clear all database state (with confirmation) |
| `JanumiCode: Show Database Stats` | Display underlying SQLite row counts and size |
| `JanumiCode: Confirm Terminate Processes`| Terminate zombie sub-processes linked in workflow commands |

## Troubleshooting

### API Key Issues
**Problem**: `"Missing API keys for: EXECUTOR"`
**Solutions**:
1. Run `JanumiCode: Set API Key` and input required credentials.
2. Verify via `JanumiCode: Validate Config`.

### CLI Processes Clotting Memory
**Problem**: Rogue processes left from massive testing suites executed by MAKER Engine.
**Solutions**:
1. Monitor the right-aligned status bar icon indicating `[N] CLI Processes Active`.
2. Click it or run `JanumiCode: Confirm Terminate Processes` to kill all hanging processes unconditionally.

### High Token Usage & Token Budget Breaches
**Problem**: Long dialogue traces consuming thousands of tokens and hitting API timeouts.
**Solutions**:
1. Reduce `janumicode.tokenBudget` in settings (default: 10000). The context compiler will forcibly trim memories.
2. The system now utilizes Semantic Summaries (`handoff_documents`) over raw logs—clearing history is less commonly needed than in previous versions.

## Development

### Building from Source

```bash
# Clone repository
git clone https://github.com/yourorg/janumicode.git
cd janumicode

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Run in development
# Press F5 in VS Code to launch Extension Development Host
```

### Project Structure

```
janumicode/
├── src/
│   ├── extension.ts           # Extension entry point & initialization routines
│   ├── lib/
│   │   ├── artifacts/         # Blob storage and file tracking
│   │   ├── clarification/     # 'Ask More' threaded context engine
│   │   ├── claudeCode/        # Claude Code specific bridge tooling
│   │   ├── cli/               # Provider abstraction for diverse CLIs (Gemini, Codex, etc)
│   │   ├── config/            # Watchers and Settings validation
│   │   ├── context/           # Advanced context clipping and semantic chunking
│   │   ├── curation/          # Narrative curator artifacts, loop resolutions
│   │   ├── database/          # Complex SQLite abstraction (Schema, Models, ORM equivalents)
│   │   ├── dialogue/          # Abstract Dialogue turn systems
│   │   ├── documents/         # Export logic, Handoff generation tools
│   │   ├── embedding/         # Vector search indexing (Local Voyage RPC handling)
│   │   ├── errorHandling/     # Global fault bounds and cascade recovery
│   │   ├── events/            # Streaming audit trails
│   │   ├── export/            # Reporting and serialization logic
│   │   ├── integration/       # Subsystem interconnection & events bus
│   │   ├── llm/               # Provider normalization layers
│   │   ├── logging/           # High visibility structured logging core
│   │   ├── mcp/               # Machine Control Protocol abstractions
│   │   ├── orchestrator/      # State engine management (Task bounds, Context tracking)
│   │   ├── primitives/        # Low-level data objects
│   │   ├── review/            # Multi-pass structural codebase review hooks
│   │   ├── roles/             # Concrete distinct AI Persona behaviors (Verifier, Maker, etc)
│   │   ├── speech/            # Text act identification / NLP tags
│   │   ├── types/             # Monolithic TS type exports
│   │   ├── ui/                # Core webview extensions and React panels
│   │   └── workflow/          # Phase definitions, Human Gate transitions
│   └── test/                  # Automated integration suite
├── docs/                      # Canonical specification, architecture details
├── package.json               # Extension manifest details
└── tsconfig.json              # TypeScript boundaries
```

### Contributing
See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines.

### Support
- **Issues**: [GitHub Issues](https://github.com/yourorg/janumicode/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourorg/janumicode/discussions)
- **Documentation**: [Full Documentation](./docs/)

---
**Built with ❤️ for governed AI-assisted software engineering**
*JanumiCode: Where verification gates meet execution, and humans remain in control.*
