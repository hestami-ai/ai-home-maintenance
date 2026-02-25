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
- **Executor**: Proposes solutions and generates code artifacts
- **Technical Expert**: Provides domain-specific evidence and API documentation
- **Verifier**: Validates claims against evidence and emits verdicts
- **Historian-Interpreter**: Detects contradictions and surfaces precedents
- **Human Authority**: Makes final decisions with full context

### 📊 Complete Audit Trail
- **Append-Only History**: Immutable record of all decisions
- **Traceability**: Every artifact traces back to verified claims and evidence
- **Replay Capability**: Reconstruct decision-making process at any point
- **Export Functionality**: Generate audit reports for compliance

### 🎯 Stateless LLM Design
- **Context Compilation**: Deterministic context packs for each role
- **Token Budget Management**: Intelligent allocation across roles
- **Multi-Provider Support**: Works with Claude (Anthropic) and GPT (OpenAI)
- **No Hidden State**: All context lives in the database, not in conversation history

### 🔄 Workflow Orchestration
- **Phase-Based Execution**: Clear progression through INTAKE → PROPOSE → VERIFY → EXECUTE
- **Gate Management**: Automatic suspension at blocking conditions
- **Resumption Support**: Continue workflows after human decisions
- **Historical Context**: Access to previous similar decisions

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
   Ctrl+Shift+P (Cmd+Shift+P on Mac) → "JanumiCode: Configure"
   ```
   - Enter your Anthropic or OpenAI API key
   - Select which provider to use for each role
   - Save configuration

2. **Start a New Dialogue**
   ```
   Ctrl+Shift+P → "JanumiCode: Start New Dialogue"
   ```
   - Enter your goal (e.g., "Create a REST API client for the GitHub API")
   - The system will begin the INTAKE phase

3. **Monitor Progress**
   - Open the **Dialogue View** to see conversation turns
   - Open the **Claims View** to track assumptions being verified
   - Open the **Workflow View** to see current phase and gates

4. **Handle Human Gates**
   - When a critical claim is UNKNOWN or DISPROVED, you'll see a notification
   - Review the context, evidence, and blocking reason
   - Make a decision: APPROVE, REJECT, OVERRIDE, or REFRAME
   - Provide rationale (required for audit trail)

### Example Workflow

**Goal**: "Add user authentication to my Express.js app"

1. **INTAKE Phase**
   - Executor receives goal and begins planning
   - Generates initial proposal with assumptions

2. **PROPOSE Phase**
   - Executor creates detailed implementation plan
   - Surfaces assumptions: "App uses Express 4.x", "MongoDB for user storage"
   - These become claims to verify

3. **ASSUMPTION SURFACING Phase**
   - System extracts claims from proposal
   - Marks critical claims for verification

4. **VERIFY Phase**
   - Verifier normalizes each claim
   - Technical Expert provides evidence (checks package.json, looks for DB connections)
   - Verifier emits verdicts:
     - "App uses Express 4.x" → VERIFIED (found in package.json)
     - "MongoDB for user storage" → UNKNOWN (no DB configured yet)

5. **HUMAN GATE**
   - Workflow blocks because "MongoDB" claim is UNKNOWN
   - Human reviews context and makes decision:
     - **Option A**: OVERRIDE with rationale: "We'll use PostgreSQL instead"
     - **Option B**: REJECT and REFRAME: "Use file-based auth for MVP"

6. **EXECUTE Phase** (after gate resolution)
   - Executor generates code artifacts based on verified claims
   - Creates auth middleware, routes, database schema
   - Stores artifacts in content-addressed blob storage

7. **VALIDATE Phase**
   - Historian-Interpreter checks for contradictions with past decisions
   - Validates no invariants violated

8. **COMMIT Phase**
   - All decisions persisted to immutable history
   - Artifacts available for export/application
   - Complete audit trail generated

## Configuration

### API Keys

Configure API keys through VS Code settings:

1. **Via UI**:
   - Open Settings (Ctrl+,)
   - Search for "janumicode"
   - Enter API keys under "LLM" section

2. **Via JSON**:
   ```json
   {
     "janumicode.llm.anthropic.apiKey": "sk-ant-...",
     "janumicode.llm.openai.apiKey": "sk-...",
   }
   ```

### Provider Selection

Choose which LLM provider to use for each role:

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

### Token Budget

Configure the token budget for context compilation:

```json
{
  "janumicode.tokenBudget": 10000
}
```

This budget is dynamically allocated across roles based on context needs.

### Database Path

By default, JanumiCode stores data in `.janumicode/database.db` in your workspace. To change:

```json
{
  "janumicode.databasePath": "${workspaceFolder}/.janumicode/db.sqlite"
}
```

## Architecture Overview

### Six Roles

```
┌─────────────┐
│   HUMAN     │ ← Final authority, makes critical decisions
└──────┬──────┘
       │ provides decisions
       ↓
┌─────────────────────────────────────────────────┐
│           WORKFLOW ORCHESTRATOR                 │
│    (State Machine + Gate Management)            │
└─┬──────┬──────┬──────┬──────┬──────────────────┘
  │      │      │      │      │
  ↓      ↓      ↓      ↓      ↓
┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────────────┐
│EXEC│ │T-EX│ │VERI│ │HIST│ │HIST-CORE   │
│UTOR│ │PERT│ │FIER│ │INT │ │(Database)  │
└────┘ └────┘ └────┘ └────┘ └────────────┘
```

1. **Executor (Agent)**: Proposes solutions, generates code
2. **Technical Expert (Agent)**: Provides evidence and explanations
3. **Verifier (Gate)**: Validates claims, emits verdicts
4. **Historian-Core (Non-Agent)**: Immutable event storage
5. **Historian-Interpreter (Agent)**: Detects contradictions, surfaces precedents
6. **Human Authority**: Makes decisions at gates

### Data Flow

```
User Goal
   ↓
[INTAKE] → Extract requirements
   ↓
[PROPOSE] → Executor generates plan with assumptions
   ↓
[ASSUMPTION SURFACING] → Extract claims
   ↓
[VERIFY] → For each claim:
   ├─ Verifier normalizes claim
   ├─ Technical Expert provides evidence
   ├─ Verifier emits verdict
   └─ UNKNOWN/DISPROVED → HUMAN GATE
   ↓
[HISTORICAL CHECK] → Historian checks for contradictions
   ↓
[EXECUTE] → Executor generates artifacts
   ↓
[VALIDATE] → Final consistency checks
   ↓
[COMMIT] → Persist to history
```

### Database Schema

Key tables:

- **dialogue_turns**: Conversation history with roles and speech acts
- **claims**: Assumptions and assertions requiring verification
- **verdicts**: Verification results with evidence references
- **gates**: Blocking conditions requiring human decisions
- **human_decisions**: Audit trail of human choices
- **artifacts**: Content-addressed blob storage
- **artifact_references**: File paths and metadata
- **constraint_manifests**: Versioned rule sets

All tables are append-only for complete auditability.

## Workflow

### Phases

1. **INTAKE**: Receive and parse user goal
2. **PROPOSE**: Generate initial implementation plan
3. **ASSUMPTION_SURFACING**: Extract claims from proposal
4. **VERIFY**: Validate each claim
5. **HISTORICAL_CHECK**: Check for contradictions
6. **EXECUTE**: Generate code artifacts
7. **VALIDATE**: Final consistency checks
8. **COMMIT**: Persist to immutable history

### State Transitions

```
INTAKE
  ↓
PROPOSE
  ↓
ASSUMPTION_SURFACING
  ↓
VERIFY ←───────┐
  ├─ VERIFIED   │
  ├─ CONDITIONAL│ (continue)
  ├─ UNKNOWN ───┼→ HUMAN GATE → [decision] → resume
  └─ DISPROVED ─┘
  ↓
HISTORICAL_CHECK
  ↓
EXECUTE
  ↓
VALIDATE
  ↓
COMMIT
```

### Verdicts

- **VERIFIED**: Claim is supported by authoritative evidence
- **CONDITIONAL**: Claim is supported if constraints are met
- **DISPROVED**: Claim is contradicted by evidence
- **UNKNOWN**: Insufficient evidence to make determination

**Important**: UNKNOWN and DISPROVED verdicts for **critical claims** trigger human gates.

## Human Gates

### When Gates Trigger

1. **Critical claim is DISPROVED**: Evidence contradicts assumption
2. **Critical claim is UNKNOWN**: Insufficient evidence to proceed
3. **Conflicting precedents detected**: Current decision conflicts with past
4. **Risk acceptance required**: High-impact decision needs approval

### Gate Decision Types

- **APPROVE**: Accept the proposal as-is (must provide rationale)
- **REJECT**: Block this path entirely (must provide rationale)
- **OVERRIDE**: Proceed despite UNKNOWN/DISPROVED (with waiver)
- **REFRAME**: Provide new direction or constraints
- **DELEGATE**: Assign to another person (future feature)
- **ESCALATE**: Request higher-level review (future feature)

### Making Gate Decisions

1. **Review Context**
   - Blocking claim and its criticality
   - Evidence provided by Technical Expert
   - Verifier's rationale for verdict
   - Related past decisions (if any)

2. **Evaluate Options**
   - Can you provide missing evidence?
   - Is the assumption reasonable for this use case?
   - What's the risk of proceeding?
   - Are there alternative approaches?

3. **Make Decision**
   - Select decision type
   - **Provide detailed rationale** (required for audit)
   - Attach any supporting documents (optional)
   - Confirm decision

4. **Workflow Resumes**
   - System records decision with full context
   - Workflow continues from gate point
   - Decision becomes part of historical precedent

## Commands

All commands accessible via Command Palette (Ctrl+Shift+P / Cmd+Shift+P):

| Command | Description |
|---------|-------------|
| `JanumiCode: Start New Dialogue` | Begin a new governed workflow |
| `JanumiCode: View Active Claims` | Open Claims tracking view |
| `JanumiCode: View Workflow Status` | Open Workflow state view |
| `JanumiCode: Configure` | Open configuration UI |
| `JanumiCode: Validate Config` | Test API keys and configuration |
| `JanumiCode: Export History` | Export audit log (JSON) |
| `JanumiCode: Clear History` | Clear all history (with confirmation) |
| `JanumiCode: Show Database Stats` | Display database size and status |

### Keyboard Shortcuts

(Customizable via Keyboard Shortcuts settings)

- No default shortcuts defined yet
- Assign your own via File → Preferences → Keyboard Shortcuts

## Troubleshooting

### Extension Won't Activate

**Problem**: "JanumiCode: Database initialization failed"

**Solutions**:
1. Check workspace permissions (need write access for `.janumicode/` folder)
2. Verify no other process is locking the database
3. Try: `JanumiCode: Clear History` to reset database
4. Check VS Code Output panel (View → Output → JanumiCode) for detailed errors

### API Key Issues

**Problem**: "Missing API keys for: EXECUTOR"

**Solutions**:
1. Run `JanumiCode: Configure` and enter API keys
2. Run `JanumiCode: Validate Config` to test keys
3. Ensure keys are valid and have appropriate permissions
4. Check VS Code settings (Ctrl+,) under "janumicode.llm"

### Workflow Stuck

**Problem**: Workflow not progressing

**Solutions**:
1. Check for open gates: View → JanumiCode: Workflow Status
2. Look for pending human decisions (notification bell icon)
3. Check VS Code Output panel for errors
4. Verify LLM API is responsive (check provider status pages)

### High Token Usage

**Problem**: Exceeding token budget quickly

**Solutions**:
1. Reduce `janumicode.tokenBudget` in settings (default: 10000)
2. Use smaller models for Technical Expert role (e.g., Claude Haiku)
3. Clear older dialogues: `JanumiCode: Clear History`
4. Limit historical context retrieval

### Database Growing Large

**Problem**: `.janumicode/database.db` file is very large

**Solutions**:
1. Export history for archival: `JanumiCode: Export History`
2. Clear old dialogues: `JanumiCode: Clear History`
3. Enable WAL mode (enabled by default) for better write performance
4. Consider backing up and starting fresh for new projects

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
│   ├── extension.ts           # Extension entry point
│   ├── lib/
│   │   ├── artifacts/         # Blob storage and file tracking
│   │   ├── claudeCode/        # Claude Code CLI integration
│   │   ├── config/            # Configuration management
│   │   ├── context/           # Context compilation
│   │   ├── database/          # SQLite layer
│   │   ├── dialogue/          # Dialogue system
│   │   ├── errorHandling/     # Error recovery
│   │   ├── events/            # Event logging
│   │   ├── integration/       # Component wiring
│   │   ├── llm/               # LLM provider abstraction
│   │   ├── roles/             # Role implementations
│   │   ├── types/             # TypeScript type definitions
│   │   ├── ui/                # VS Code UI components
│   │   └── workflow/          # State machine and orchestration
│   └── test/                  # Test suite
├── docs/                      # Documentation
├── package.json               # Extension manifest
└── tsconfig.json              # TypeScript configuration
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- --grep "Context Compiler"
```

### Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines.

**Quick Links**:
- [Technical Specification](./docs/Governed%20Multi-Role%20Dialogue%20&%20Execution%20System%20-%20Technical%20Specification.md)
- [Implementation Roadmap](./docs/Implementation%20Roadmap.md)
- [Architecture Diagrams](./docs/)

## License

[Specify your license here - e.g., MIT, Apache 2.0, etc.]

## Support

- **Issues**: [GitHub Issues](https://github.com/yourorg/janumicode/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourorg/janumicode/discussions)
- **Documentation**: [Full Documentation](./docs/)

---

**Built with ❤️ for governed AI-assisted software engineering**

*JanumiCode: Where verification gates meet execution, and humans remain in control.*
