# JanumiCode Architecture

**Governed Multi-Role Dialogue & Execution System**

This document provides a comprehensive technical overview of the JanumiCode architecture, design patterns, and key implementation decisions.

## Table of Contents

1. [System Overview](#system-overview)
2. [Design Principles](#design-principles)
3. [Component Architecture](#component-architecture)
4. [Data Flow](#data-flow)
5. [Database Schema](#database-schema)
6. [Module Organization](#module-organization)
7. [Design Patterns](#design-patterns)
8. [Key Design Decisions](#key-design-decisions)
9. [Extension Points](#extension-points)

---

## System Overview

JanumiCode is a VS Code extension that implements a governed, auditable framework for AI-assisted software development. It prevents invalid assumptions from reaching execution through a multi-role verification system with explicit human-in-the-loop gates.

### Core Components

```
┌──────────────────────────────────────────────────────────────┐
│                       VS Code Extension                       │
│  ┌────────────┐  ┌──────────────┐  ┌───────────────────┐   │
│  │   UI Layer │  │   Commands   │  │  Status Bar Items │   │
│  └─────┬──────┘  └──────┬───────┘  └─────────┬─────────┘   │
│        │                 │                     │              │
│        └─────────────────┴─────────────────────┘              │
│                          │                                    │
│        ┌─────────────────▼─────────────────────┐             │
│        │   Integration Layer (Phase 9)          │             │
│        │  - Dialogue Orchestrator               │             │
│        │  - Role Connector                      │             │
│        │  - Claude Code Integration             │             │
│        └─────────────────┬─────────────────────┘             │
│                          │                                    │
│        ┌─────────────────▼─────────────────────┐             │
│        │     Workflow Orchestrator              │             │
│        │  - Phase State Machine                 │             │
│        │  - Gate Management                     │             │
│        │  - Resumption Logic                    │             │
│        └──┬───────────────┬──────────────────┬──┘             │
│           │               │                  │                │
│  ┌────────▼──────┐  ┌────▼───────┐  ┌───────▼──────┐        │
│  │   Dialogue    │  │  Context   │  │   Roles      │        │
│  │   System      │  │  Compiler  │  │   System     │        │
│  └────────┬──────┘  └────┬───────┘  └───────┬──────┘        │
│           │               │                  │                │
│           └───────────────┴──────────────────┘                │
│                          │                                    │
│        ┌─────────────────▼─────────────────────┐             │
│        │      Database Layer (SQLite)           │             │
│        │  - Append-Only Event Log               │             │
│        │  - Content-Addressed Blob Storage      │             │
│        │  - Deterministic Projections           │             │
│        └────────────────────────────────────────┘             │
└──────────────────────────────────────────────────────────────┘
```

### Six Roles

The system implements six distinct roles with explicit responsibilities:

```
┌─────────────┐
│    HUMAN    │  ← Final authority, makes critical decisions
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

1. **Executor (Agent)**: Proposes solutions and generates code artifacts
2. **Technical Expert (Agent)**: Provides domain-specific evidence and API documentation
3. **Verifier (Gate)**: Validates claims against evidence and emits verdicts
4. **Historian-Core (Non-Agent)**: Immutable event storage and retrieval
5. **Historian-Interpreter (Agent)**: Detects contradictions and surfaces precedents
6. **Human Authority**: Makes final decisions with full context

---

## Design Principles

JanumiCode is built on seven non-negotiable design principles:

### 1. State Lives Outside the LLM

**Rationale**: LLMs are stateless APIs. Conversation history is not authoritative.

**Implementation**:
- All state stored in SQLite database
- LLMs invoked with deterministic Context Packs, not chat history
- Database is the single source of truth

```typescript
// Context compilation is deterministic
const contextPack = compileContextPack({
  role: Role.EXECUTOR,
  dialogueId: "abc-123",
  tokenBudget: 10000,
  includeHistorical: true
});

// LLM receives context pack, not conversation history
const response = await invokeLLM(contextPack);
```

### 2. Dialogue is Subordinate to State

**Rationale**: Free-form chat transcripts are unreliable for execution decisions.

**Implementation**:
- Every dialogue turn has structured envelope (role, phase, speech_act)
- Dialogue turns reference database entities (claims, verdicts, gates)
- State transitions drive dialogue, not vice versa

```typescript
interface DialogueTurn {
  turn_id: number;
  dialogue_id: string;
  role: Role;
  phase: Phase;
  speech_act: SpeechAct;
  content_ref: string;
  timestamp: string;
}
```

### 3. Execution is Gated by Verification

**Rationale**: Invalid assumptions must not silently reach execution.

**Implementation**:
- All critical claims must be VERIFIED or CONDITIONAL before execution
- UNKNOWN and DISPROVED verdicts trigger human gates
- No execution without explicit verification

```typescript
// Verification blocks execution
if (verdict === VerdictType.UNKNOWN || verdict === VerdictType.DISPROVED) {
  if (claim.criticality === Criticality.CRITICAL) {
    openHumanGate(dialogueId, claimId, verdict);
    return { blocked: true };
  }
}
```

### 4. History is Append-Only

**Rationale**: Audit trail must be immutable and complete.

**Implementation**:
- All database tables are append-only
- Updates create new events, never modify existing records
- Deletions are logical, not physical
- Full replay capability

```sql
-- Claims status changes create events, don't update status
INSERT INTO claim_events (claim_id, event_type, source, timestamp)
VALUES (?, 'VERIFIED', 'VERIFIER', datetime('now'));
```

### 5. Humans are First-Class Authorities

**Rationale**: Critical decisions require human judgment with context.

**Implementation**:
- Human decisions have explicit actions (APPROVE, REJECT, OVERRIDE, REFRAME)
- Rationale is required for audit trail
- Decisions are logged with full context
- Human role has equal standing with AI roles

```typescript
interface HumanDecision {
  decision_id: string;
  gate_id: string;
  action: 'APPROVE' | 'REJECT' | 'OVERRIDE' | 'REFRAME';
  rationale: string; // Required
  attachments_ref?: string;
  timestamp: string;
}
```

### 6. Failure Must Be Explicit

**Rationale**: UNKNOWN is not the same as true. Uncertainty blocks progress.

**Implementation**:
- Result<T> pattern for all operations
- No exceptions in business logic
- UNKNOWN verdict blocks critical claims
- No "helpful" smoothing of failures

```typescript
// Result pattern makes failure explicit
type Result<T> =
  | { success: true; value: T }
  | { success: false; error: Error };

// UNKNOWN blocks progress
if (verdict === VerdictType.UNKNOWN) {
  return {
    success: false,
    error: new CodedError('UNKNOWN_CRITICAL_CLAIM', 'Cannot proceed')
  };
}
```

### 7. Simplest Viable Mechanism Wins

**Rationale**: Avoid over-abstraction and unnecessary frameworks.

**Implementation**:
- SQLite (not complex distributed database)
- Simple state machine (not complex workflow engine)
- Direct LLM API calls (not abstraction layers)
- Minimal dependencies

---

## Component Architecture

### Dialogue System (Phase 2)

**Purpose**: Manage structured conversation between roles.

**Key Files**:
- `src/lib/dialogue/session.ts`: Dialogue session management
- `src/lib/dialogue/turns.ts`: Turn creation and retrieval
- `src/lib/dialogue/claims.ts`: Claim tracking

**Responsibilities**:
- Create dialogue sessions with unique IDs
- Add structured turns with role/phase/speech_act
- Track claims introduced during dialogue
- Query dialogue history

**Design Pattern**: Repository Pattern
```typescript
// Dialogue Session (aggregate root)
interface Dialogue {
  dialogue_id: string;
  created_at: string;
  status: DialogueStatus;
}

// Dialogue Turn (entity)
interface DialogueTurn {
  turn_id: number;
  dialogue_id: string;
  role: Role;
  phase: Phase;
  speech_act: SpeechAct;
  content_ref: string;
}
```

### Context Compiler (Phase 5)

**Purpose**: Generate deterministic context packs for stateless LLM invocation.

**Key Files**:
- `src/lib/context/compiler.ts`: Main compilation logic
- `src/lib/context/truncation.ts`: Token budget management

**Responsibilities**:
- Compile role-specific context from database state
- Apply token budgeting with intelligent truncation
- Include relevant historical findings
- Generate deterministic outputs

**Design Pattern**: Strategy Pattern (role-specific context strategies)
```typescript
interface CompileContextOptions {
  role: Role;
  dialogueId: string;
  goal?: string;
  tokenBudget: number;
  includeHistorical: boolean;
  maxHistoricalFindings?: number;
}

interface CompiledContextPack {
  role: Role;
  goal?: string;
  constraints?: ConstraintManifest;
  claims?: ClaimSummary[];
  verdicts?: VerdictSummary[];
  historical?: HistoricalFinding[];
  estimatedTokens: number;
}
```

### Workflow Orchestrator (Phase 7)

**Purpose**: Manage workflow phase progression and gate handling.

**Key Files**:
- `src/lib/workflow/stateMachine.ts`: Phase state machine
- `src/lib/workflow/gates.ts`: Gate management
- `src/lib/workflow/transitions.ts`: State transitions

**Responsibilities**:
- Initialize and track workflow state
- Execute phase transitions
- Manage gate opening/resolution
- Handle workflow resumption

**Design Pattern**: State Machine Pattern
```typescript
// Workflow phases
enum Phase {
  INTAKE = 'INTAKE',
  PROPOSE = 'PROPOSE',
  ASSUMPTION_SURFACING = 'ASSUMPTION_SURFACING',
  VERIFY = 'VERIFY',
  HISTORICAL_CHECK = 'HISTORICAL_CHECK',
  EXECUTE = 'EXECUTE',
  VALIDATE = 'VALIDATE',
  COMMIT = 'COMMIT',
  REPLAN = 'REPLAN'
}

// State transitions
interface WorkflowState {
  dialogue_id: string;
  current_phase: Phase;
  previous_phase?: Phase;
  gate_status: GateStatus;
  updated_at: string;
}
```

### Role Implementations (Phase 6)

**Purpose**: Implement each role's specific behavior and constraints.

**Key Files**:
- `src/lib/roles/executor.ts`: Executor implementation
- `src/lib/roles/technicalExpert.ts`: Technical Expert implementation
- `src/lib/roles/verifier.ts`: Verifier implementation
- `src/lib/roles/historianInterpreter.ts`: Historian-Interpreter implementation
- `src/lib/roles/historianCore.ts`: Historian-Core (non-agent)
- `src/lib/roles/human.ts`: Human authority integration

**Design Pattern**: Strategy Pattern + Factory Pattern
```typescript
// Role interface
interface RoleInvocationOptions {
  dialogueId: string;
  phase: Phase;
  contextPack: CompiledContextPack;
  config: RoleLLMConfig;
}

// Role-specific implementations
async function invokeExecutor(options: ExecutorInvocationOptions): Promise<Result<ExecutorResponse>>;
async function invokeTechnicalExpert(options: TechnicalExpertInvocationOptions): Promise<Result<EvidencePacket>>;
async function invokeVerifier(options: VerifierInvocationOptions): Promise<Result<VerifierResponse>>;
async function invokeHistorianInterpreter(options: HistorianInvocationOptions): Promise<Result<HistorianInterpreterResponse>>;
```

### LLM Abstraction (Phase 4)

**Purpose**: Provide unified interface to multiple LLM providers.

**Key Files**:
- `src/lib/llm/providers/anthropic.ts`: Anthropic/Claude provider
- `src/lib/llm/providers/openai.ts`: OpenAI/GPT provider
- `src/lib/llm/client.ts`: Unified LLM client

**Responsibilities**:
- Abstract provider-specific APIs
- Handle token counting per provider
- Manage rate limiting and retries
- Support streaming responses

**Design Pattern**: Adapter Pattern
```typescript
// Unified LLM interface
interface LLMProvider {
  name: string;
  invoke(request: LLMRequest): Promise<Result<LLMResponse>>;
  countTokens(text: string): number;
  getMaxTokens(model: string): number;
}

// Provider implementations
class AnthropicProvider implements LLMProvider { /* ... */ }
class OpenAIProvider implements LLMProvider { /* ... */ }
```

### Artifact Management (Phase 3)

**Purpose**: Content-addressed blob storage for generated artifacts.

**Key Files**:
- `src/lib/artifacts/storage.ts`: Blob storage
- `src/lib/artifacts/references.ts`: File tracking
- `src/lib/artifacts/retrieval.ts`: Content retrieval

**Responsibilities**:
- Store artifacts with content-addressable hashing
- Track file system references
- Support deduplication
- Enable artifact retrieval

**Design Pattern**: Repository Pattern + Content-Addressed Storage
```typescript
interface Artifact {
  artifact_id: string;
  content_hash: string; // SHA-256 of content
  content: Buffer;
  mime_type: string;
  size: number;
  created_at: string;
}

interface ArtifactReference {
  reference_id: string;
  artifact_type: 'BLOB' | 'FILE' | 'EVIDENCE';
  file_path?: string;
  content_hash?: string;
  git_commit?: string;
  metadata: Record<string, any>;
}
```

### Database Layer (Phase 1)

**Purpose**: SQLite database with append-only event log.

**Key Files**:
- `src/lib/database/init.ts`: Database initialization
- `src/lib/database/schema.ts`: Schema definitions
- `src/lib/database/migrations.ts`: Migration management
- `src/lib/database/index.ts`: Database instance

**Responsibilities**:
- Initialize SQLite database
- Apply schema migrations
- Provide connection pooling
- Support WAL mode for concurrency

**Design Pattern**: Repository Pattern + Event Sourcing
```typescript
// Database initialization
export function initDatabase(dbPath: string): Result<Database.Database> {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return { success: true, value: db };
}

// Append-only event log
INSERT INTO claim_events (event_id, claim_id, event_type, source, timestamp)
VALUES (?, ?, ?, ?, datetime('now'));
```

### Configuration (Phase 1.5)

**Purpose**: Manage VS Code settings and API keys.

**Key Files**:
- `src/lib/config/settings.ts`: Settings management
- `src/lib/config/validation.ts`: Config validation

**Responsibilities**:
- Read/write VS Code configuration
- Validate API keys and settings
- Support per-role LLM configuration
- Manage token budgets

**Design Pattern**: Configuration Object
```typescript
interface JanumiCodeConfig {
  llm: {
    anthropic: {
      apiKey: string;
    };
    openai: {
      apiKey: string;
    };
    executor: RoleLLMConfig;
    technicalExpert: RoleLLMConfig;
    verifier: RoleLLMConfig;
    historianInterpreter: RoleLLMConfig;
  };
  tokenBudget: number;
  databasePath: string;
}
```

### UI Layer (Phase 8)

**Purpose**: VS Code UI components and webviews.

**Key Files**:
- `src/lib/ui/dialogueView.ts`: Dialogue conversation view
- `src/lib/ui/claimsView.ts`: Claims tracking view
- `src/lib/ui/workflowView.ts`: Workflow status view
- `src/lib/ui/statusBar.ts`: Status bar items

**Responsibilities**:
- Display dialogue turns with role colors
- Show claims and their verification status
- Visualize workflow phase progression
- Display gate decision UI

**Design Pattern**: Observer Pattern (VS Code TreeDataProvider)
```typescript
class DialogueViewProvider implements vscode.TreeDataProvider<DialogueTurnItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: DialogueTurnItem): vscode.TreeItem { /* ... */ }
  getChildren(element?: DialogueTurnItem): DialogueTurnItem[] { /* ... */ }
}
```

### Integration Layer (Phase 9)

**Purpose**: Wire all components together into cohesive system.

**Key Files**:
- `src/lib/integration/dialogueOrchestrator.ts`: Dialogue-workflow coordination
- `src/lib/integration/roleConnector.ts`: Role-context integration
- `src/lib/integration/errorHandler.ts`: Global error handling

**Responsibilities**:
- Coordinate dialogue system with workflow orchestrator
- Connect role invocations with context compiler
- Handle cross-cutting error recovery
- Integrate with Claude Code CLI (Phase 9.3)

**Design Pattern**: Facade Pattern
```typescript
// High-level facade for starting dialogues
export function startDialogueWithWorkflow(
  options: StartDialogueWithWorkflowOptions
): Result<StartDialogueWithWorkflowResult> {
  // 1. Create dialogue session
  const dialogue = createDialogueSession();

  // 2. Add initial turn
  const turn = createAndAddTurn({ /* ... */ });

  // 3. Initialize workflow state
  const workflow = initializeWorkflowState(dialogue.dialogue_id);

  return { dialogue, turn, workflow };
}
```

---

## Data Flow

### End-to-End Workflow

```
┌─────────────┐
│  User Goal  │
└──────┬──────┘
       │
       ▼
┌──────────────────┐
│  INTAKE Phase    │ ← Parse user request
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  PROPOSE Phase   │ ← Executor generates plan with assumptions
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  ASSUMPTION      │ ← Extract claims from proposal
│  SURFACING       │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  VERIFY Phase    │ ← For each claim:
│                  │   1. Verifier normalizes claim
│  ┌────────────┐  │   2. Technical Expert provides evidence
│  │ Normalize  │  │   3. Verifier emits verdict
│  └─────┬──────┘  │
│        │         │   Critical claim UNKNOWN/DISPROVED?
│        ▼         │   ┌────────────────┐
│  ┌────────────┐  │   │  HUMAN GATE    │
│  │ Evidence   │  │   │  - Review      │
│  │ Gathering  │  │   │  - Decision    │
│  └─────┬──────┘  │   │  - Rationale   │
│        │         │   └────────────────┘
│        ▼         │
│  ┌────────────┐  │
│  │ Verdict    │  │
│  └────────────┘  │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  HISTORICAL      │ ← Historian checks for contradictions
│  CHECK Phase     │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  EXECUTE Phase   │ ← Executor generates artifacts
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  VALIDATE Phase  │ ← Final consistency checks
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  COMMIT Phase    │ ← Persist to history
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│   Completed      │ ← Artifacts available
└──────────────────┘
```

### Verification Cycle (Detail)

```
┌────────────────────────────────────────────────────────┐
│              Claim Verification Cycle                  │
└────────────────────────────────────────────────────────┘

1. Claim Identified
   ┌──────────────────────────────┐
   │ Executor emits assumption    │
   │ "Express.js v4.x installed"  │
   └──────────┬───────────────────┘
              │
              ▼
2. Normalization
   ┌──────────────────────────────┐
   │ Verifier normalizes claim    │
   │ Determines criticality       │
   │ Generates search queries     │
   └──────────┬───────────────────┘
              │
              ▼
3. Evidence Gathering
   ┌──────────────────────────────┐
   │ Technical Expert invoked     │
   │ - Searches codebase          │
   │ - Reads package.json         │
   │ - Checks dependencies        │
   └──────────┬───────────────────┘
              │
              ▼
4. Verdict Emission
   ┌──────────────────────────────┐
   │ Verifier analyzes evidence   │
   │ Emits verdict:               │
   │ - VERIFIED                   │
   │ - CONDITIONAL                │
   │ - DISPROVED                  │
   │ - UNKNOWN                    │
   └──────────┬───────────────────┘
              │
              ▼
5. Gate Decision?
   ┌──────────────────────────────┐
   │ If critical + UNKNOWN/DISP:  │
   │ ┌──────────────────────────┐ │
   │ │    Open Human Gate       │ │
   │ │  - Show context          │ │
   │ │  - Request decision      │ │
   │ │  - Require rationale     │ │
   │ └──────────┬───────────────┘ │
   └────────────┼─────────────────┘
                │
                ▼
6. Outcome
   ┌──────────────────────────────┐
   │ Verdict stored in database   │
   │ Claim status updated         │
   │ Workflow continues/blocks    │
   └──────────────────────────────┘
```

### Context Compilation

```
┌────────────────────────────────────────────────────────┐
│            Context Compilation Process                 │
└────────────────────────────────────────────────────────┘

Input: CompileContextOptions
  - role: EXECUTOR
  - dialogueId: "abc-123"
  - tokenBudget: 10000
  - includeHistorical: true

Step 1: Gather Base Context
  ┌──────────────────────────────┐
  │ Query database for:          │
  │ - Dialogue turns             │
  │ - Goal/requirements          │
  │ - Current phase              │
  └──────────┬───────────────────┘
             │
             ▼
Step 2: Add Role-Specific Context
  ┌──────────────────────────────┐
  │ For EXECUTOR:                │
  │ - Constraint manifest        │
  │ - Claims + statuses          │
  │ - Verdicts summary           │
  │ - Human decisions            │
  │                              │
  │ For VERIFIER:                │
  │ - Claims to verify           │
  │ - Evidence collected         │
  │                              │
  │ For HISTORIAN:               │
  │ - Previous decisions         │
  │ - Precedents                 │
  └──────────┬───────────────────┘
             │
             ▼
Step 3: Apply Token Budget
  ┌──────────────────────────────┐
  │ Truncation strategy:         │
  │ 1. Always include goal       │
  │ 2. Always include manifest   │
  │ 3. Include recent context    │
  │ 4. Trim historical if needed │
  │ 5. Truncate old turns last   │
  └──────────┬───────────────────┘
             │
             ▼
Step 4: Format Context Pack
  ┌──────────────────────────────┐
  │ {                            │
  │   role: "EXECUTOR",          │
  │   goal: "...",               │
  │   constraints: {...},        │
  │   claims: [...],             │
  │   verdicts: [...],           │
  │   historical: [...],         │
  │   estimatedTokens: 8453      │
  │ }                            │
  └──────────┬───────────────────┘
             │
             ▼
Output: CompiledContextPack
```

---

## Database Schema

### Entity-Relationship Diagram

```
┌─────────────────────┐
│  dialogue_turns     │
│  ─────────────────  │
│  PK turn_id         │
│     dialogue_id     │────┐
│     role            │    │
│     phase           │    │
│     speech_act      │    │
│     content_ref     │    │
│     timestamp       │    │
└─────────────────────┘    │
                           │
┌─────────────────────┐    │
│  claims             │    │
│  ─────────────────  │    │
│  PK claim_id        │    │
│  FK dialogue_id     │◄───┘
│  FK turn_id         │
│     statement       │
│     introduced_by   │
│     criticality     │
│     status          │
│     created_at      │
└──────────┬──────────┘
           │
           │  ┌─────────────────────┐
           │  │  claim_events       │
           │  │  ─────────────────  │
           │  │  PK event_id        │
           └─►│  FK claim_id        │
              │     event_type      │
              │     source          │
              │     evidence_ref    │
              │     timestamp       │
              └──────────────────────┘

┌─────────────────────┐
│  verdicts           │
│  ─────────────────  │
│  PK verdict_id      │
│  FK claim_id        │◄───┐
│     verdict         │    │
│     constraints_ref │    │
│     evidence_ref    │    │
│     rationale       │    │
│     timestamp       │    │
└─────────────────────┘    │
                           │
┌─────────────────────┐    │
│  gates              │    │
│  ─────────────────  │    │
│  PK gate_id         │    │
│  FK dialogue_id     │    │
│     reason          │    │
│     status          │    │
│     blocking_claims │────┘ (JSON array of claim IDs)
│     created_at      │
│     resolved_at     │
└──────────┬──────────┘
           │
           │  ┌─────────────────────┐
           │  │  human_decisions    │
           │  │  ─────────────────  │
           │  │  PK decision_id     │
           └─►│  FK gate_id         │
              │     action          │
              │     rationale       │
              │     attachments_ref │
              │     timestamp       │
              └──────────────────────┘

┌─────────────────────┐
│  artifacts          │
│  ─────────────────  │
│  PK artifact_id     │
│  UK content_hash    │◄───┐
│     content (BLOB)  │    │
│     mime_type       │    │
│     size            │    │
│     created_at      │    │
└─────────────────────┘    │
                           │
┌─────────────────────┐    │
│  artifact_refs      │    │
│  ─────────────────  │    │
│  PK reference_id    │    │
│     artifact_type   │    │
│     file_path       │    │
│  FK content_hash    │────┘
│     git_commit      │
│     metadata (JSON) │
│     created_at      │
└─────────────────────┘

┌─────────────────────┐
│  constraint_mnfsts  │
│  ─────────────────  │
│  PK manifest_id     │
│     version         │
│     constraints_ref │
│     timestamp       │
└─────────────────────┘
```

### Table Details

#### dialogue_turns
**Purpose**: Append-only log of all dialogue interactions.

| Column | Type | Description |
|--------|------|-------------|
| turn_id | INTEGER PK | Auto-incrementing turn number |
| dialogue_id | TEXT | Dialogue session ID (UUID) |
| role | TEXT | Role that created turn (enum) |
| phase | TEXT | Workflow phase (enum) |
| speech_act | TEXT | Type of utterance (enum) |
| content_ref | TEXT | Reference to artifact content |
| timestamp | TEXT | ISO-8601 timestamp |

**Constraints**:
- role: EXECUTOR, TECHNICAL_EXPERT, VERIFIER, HISTORIAN, HUMAN
- phase: INTAKE, PROPOSE, VERIFY, EXECUTE, etc.
- speech_act: CLAIM, ASSUMPTION, EVIDENCE, VERDICT, DECISION

**Indexes**:
- dialogue_id, role, phase, timestamp

#### claims
**Purpose**: Track all assertions requiring verification.

| Column | Type | Description |
|--------|------|-------------|
| claim_id | TEXT PK | Unique claim ID (UUID) |
| statement | TEXT | Claim statement text |
| introduced_by | TEXT | Role that made the claim |
| criticality | TEXT | CRITICAL or NON_CRITICAL |
| status | TEXT | Current verification status |
| dialogue_id | TEXT FK | Parent dialogue |
| turn_id | INTEGER FK | Turn where introduced |
| created_at | TEXT | ISO-8601 timestamp |

**Constraints**:
- status: OPEN, VERIFIED, CONDITIONAL, DISPROVED, UNKNOWN

**Indexes**:
- dialogue_id, status, criticality, introduced_by

#### claim_events
**Purpose**: Append-only log of claim status changes.

| Column | Type | Description |
|--------|------|-------------|
| event_id | TEXT PK | Unique event ID (UUID) |
| claim_id | TEXT FK | Related claim |
| event_type | TEXT | Type of event |
| source | TEXT | Role that triggered event |
| evidence_ref | TEXT | Reference to evidence |
| timestamp | TEXT | ISO-8601 timestamp |

**Constraints**:
- event_type: CREATED, VERIFIED, DISPROVED, OVERRIDDEN

#### verdicts
**Purpose**: Verifier verdicts on claims with evidence.

| Column | Type | Description |
|--------|------|-------------|
| verdict_id | TEXT PK | Unique verdict ID (UUID) |
| claim_id | TEXT FK | Claim being verified |
| verdict | TEXT | Verdict type |
| constraints_ref | TEXT | Constraints if CONDITIONAL |
| evidence_ref | TEXT | Evidence used |
| rationale | TEXT | Verifier explanation |
| timestamp | TEXT | ISO-8601 timestamp |

**Constraints**:
- verdict: VERIFIED, CONDITIONAL, DISPROVED, UNKNOWN

#### gates
**Purpose**: Human decision points (blocking conditions).

| Column | Type | Description |
|--------|------|-------------|
| gate_id | TEXT PK | Unique gate ID (UUID) |
| dialogue_id | TEXT FK | Parent dialogue |
| reason | TEXT | Why gate was triggered |
| status | TEXT | OPEN or RESOLVED |
| blocking_claims | TEXT | JSON array of claim IDs |
| created_at | TEXT | ISO-8601 timestamp |
| resolved_at | TEXT | Resolution timestamp |

#### human_decisions
**Purpose**: Audit trail of human choices at gates.

| Column | Type | Description |
|--------|------|-------------|
| decision_id | TEXT PK | Unique decision ID (UUID) |
| gate_id | TEXT FK | Gate being resolved |
| action | TEXT | Decision type |
| rationale | TEXT | Human explanation (required) |
| attachments_ref | TEXT | Supporting documents |
| timestamp | TEXT | ISO-8601 timestamp |

**Constraints**:
- action: APPROVE, REJECT, OVERRIDE, REFRAME

#### artifacts
**Purpose**: Content-addressed blob storage.

| Column | Type | Description |
|--------|------|-------------|
| artifact_id | TEXT PK | Unique artifact ID (UUID) |
| content_hash | TEXT UK | SHA-256 of content |
| content | BLOB | Actual content bytes |
| mime_type | TEXT | Content type |
| size | INTEGER | Size in bytes |
| created_at | TEXT | ISO-8601 timestamp |

**Deduplication**: Unique constraint on content_hash ensures identical content is stored once.

#### artifact_references
**Purpose**: Track file system locations and metadata.

| Column | Type | Description |
|--------|------|-------------|
| reference_id | TEXT PK | Unique reference ID (UUID) |
| artifact_type | TEXT | BLOB, FILE, or EVIDENCE |
| file_path | TEXT | File system path |
| content_hash | TEXT FK | Artifact content hash |
| git_commit | TEXT | Git commit if tracked |
| metadata | TEXT | JSON metadata |
| created_at | TEXT | ISO-8601 timestamp |

#### constraint_manifests
**Purpose**: Versioned constraint documents.

| Column | Type | Description |
|--------|------|-------------|
| manifest_id | TEXT PK | Unique manifest ID (UUID) |
| version | INTEGER | Manifest version number |
| constraints_ref | TEXT | Reference to constraints |
| timestamp | TEXT | ISO-8601 timestamp |

### Schema Migration Strategy

**Versioned Migrations**:
```typescript
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: 'Initial schema - Core data model',
    sql: SCHEMA_V1
  },
  // Future migrations added here
];
```

**Migration Application**:
1. Check current schema version in `schema_metadata` table
2. Apply all migrations with version > current version
3. Update schema_version after each migration
4. All migrations are idempotent (CREATE IF NOT EXISTS)

**WAL Mode**: Database uses Write-Ahead Logging for better concurrency.

---

## Module Organization

### Directory Structure

```
src/
├── extension.ts              # VS Code extension entry point
│
├── lib/                      # Core library
│   ├── artifacts/            # Phase 3: Artifact Management
│   │   ├── storage.ts       # Blob storage operations
│   │   ├── references.ts    # File tracking
│   │   ├── retrieval.ts     # Content retrieval
│   │   └── index.ts         # Public exports
│   │
│   ├── claudeCode/           # Phase 9.3: Claude Code CLI integration
│   │   ├── detection.ts     # CLI detection
│   │   ├── invocation.ts    # CLI invocation
│   │   └── index.ts         # Public exports
│   │
│   ├── config/               # Phase 1.5: Configuration
│   │   ├── settings.ts      # VS Code settings
│   │   ├── validation.ts    # Config validation
│   │   └── index.ts         # Public exports
│   │
│   ├── context/              # Phase 5: Context Compilation
│   │   ├── compiler.ts      # Main compilation logic
│   │   ├── truncation.ts    # Token budget management
│   │   ├── historical.ts    # Historical findings
│   │   └── index.ts         # Public exports
│   │
│   ├── database/             # Phase 1.2-1.3: Database Layer
│   │   ├── init.ts          # Database initialization
│   │   ├── schema.ts        # Schema definitions
│   │   ├── migrations.ts    # Migration management
│   │   └── index.ts         # Database instance
│   │
│   ├── dialogue/             # Phase 2: Dialogue System
│   │   ├── session.ts       # Session management
│   │   ├── turns.ts         # Turn operations
│   │   ├── claims.ts        # Claim tracking
│   │   └── index.ts         # Public exports
│   │
│   ├── errorHandling/        # Phase 9.4: Error Recovery
│   │   ├── recovery.ts      # Recovery strategies
│   │   ├── logging.ts       # Error logging
│   │   └── index.ts         # Public exports
│   │
│   ├── events/               # Phase 1.4: Event Logging
│   │   ├── logger.ts        # Event logger
│   │   ├── types.ts         # Event type definitions
│   │   └── index.ts         # Public exports
│   │
│   ├── integration/          # Phase 9.1: Component Wiring
│   │   ├── dialogueOrchestrator.ts  # Dialogue-workflow coordination
│   │   ├── roleConnector.ts         # Role-context integration
│   │   └── index.ts                 # Public exports
│   │
│   ├── llm/                  # Phase 4: LLM Abstraction
│   │   ├── client.ts        # Unified LLM client
│   │   ├── providers/       # Provider implementations
│   │   │   ├── anthropic.ts
│   │   │   ├── openai.ts
│   │   │   └── index.ts
│   │   └── index.ts         # Public exports
│   │
│   ├── roles/                # Phase 6: Role Implementations
│   │   ├── executor.ts      # Executor role
│   │   ├── technicalExpert.ts  # Technical Expert role
│   │   ├── verifier.ts      # Verifier role
│   │   ├── historianCore.ts    # Historian-Core (non-agent)
│   │   ├── historianInterpreter.ts  # Historian-Interpreter
│   │   ├── human.ts         # Human authority
│   │   └── index.ts         # Public exports
│   │
│   ├── types/                # TypeScript Type Definitions
│   │   ├── core.ts          # Core types
│   │   ├── enums.ts         # Enumerations
│   │   ├── errors.ts        # Error types
│   │   └── index.ts         # Public exports
│   │
│   ├── ui/                   # Phase 8: UI Components
│   │   ├── dialogueView.ts  # Dialogue view provider
│   │   ├── claimsView.ts    # Claims view provider
│   │   ├── workflowView.ts  # Workflow view provider
│   │   ├── statusBar.ts     # Status bar items
│   │   └── index.ts         # Public exports
│   │
│   └── workflow/             # Phase 7: Workflow Orchestration
│       ├── stateMachine.ts  # Phase state machine
│       ├── gates.ts         # Gate management
│       ├── transitions.ts   # State transitions
│       └── index.ts         # Public exports
│
└── test/                     # Test Suite
    ├── unit/                # Unit tests
    └── integration/         # Integration tests
```

### Module Dependencies

```
┌──────────────────────────────────────────────────────────┐
│                     extension.ts                         │
└──────────────────────┬───────────────────────────────────┘
                       │
       ┌───────────────┴───────────────────┐
       │                                   │
       ▼                                   ▼
┌──────────────┐                    ┌──────────────┐
│  integration │                    │      ui      │
└──────┬───────┘                    └──────┬───────┘
       │                                   │
       ├────────┬──────────┬───────────────┘
       │        │          │
       ▼        ▼          ▼
┌──────────┐  ┌────────┐  ┌──────────┐
│ workflow │  │dialogue│  │  config  │
└────┬─────┘  └───┬────┘  └────┬─────┘
     │            │            │
     │     ┌──────┴────────────┤
     │     │                   │
     ▼     ▼                   ▼
┌─────────────┐          ┌──────────┐
│   roles     │          │   llm    │
└──────┬──────┘          └────┬─────┘
       │                      │
       │        ┌─────────────┤
       │        │             │
       ▼        ▼             │
┌────────────────┐            │
│    context     │            │
└────────┬───────┘            │
         │                    │
         │     ┌──────────────┘
         │     │
         ▼     ▼
┌─────────────────┐
│    database     │
└─────────────────┘
```

### Layered Architecture

**Layer 1: Foundation**
- database: SQLite operations
- types: Type definitions
- errors: Error handling

**Layer 2: Core Services**
- dialogue: Dialogue system
- workflow: State machine
- config: Configuration
- events: Event logging

**Layer 3: Domain Logic**
- roles: Role implementations
- context: Context compilation
- llm: LLM abstraction
- artifacts: Blob storage

**Layer 4: Integration**
- integration: Component wiring
- ui: VS Code UI

**Layer 5: Application**
- extension.ts: Entry point

**Dependency Rules**:
- Higher layers depend on lower layers
- Lower layers never depend on higher layers
- Each layer has well-defined interfaces

---

## Design Patterns

### Result Pattern (Error Handling)

**Problem**: TypeScript exceptions bypass type checking and make error handling implicit.

**Solution**: Explicit Result<T> type for all operations that can fail.

```typescript
type Result<T> =
  | { success: true; value: T }
  | { success: false; error: Error };

// Usage
function parseConfig(): Result<Config> {
  try {
    const config = readConfigFile();
    return { success: true, value: config };
  } catch (error) {
    return {
      success: false,
      error: new CodedError('CONFIG_PARSE_FAILED', 'Invalid JSON')
    };
  }
}

// Consumer
const result = parseConfig();
if (!result.success) {
  console.error(result.error.message);
  return;
}
const config = result.value; // TypeScript knows this is Config
```

**Benefits**:
- Type-safe error handling
- Explicit failure modes
- No exceptions in business logic
- Composable error handling

### Repository Pattern (Database Access)

**Problem**: Direct database access couples business logic to SQL.

**Solution**: Repository abstractions with clean interfaces.

```typescript
// Repository interface
interface DialogueRepository {
  createSession(): Result<Dialogue>;
  getSession(id: string): Result<Dialogue | null>;
  addTurn(turn: CreateTurnOptions): Result<DialogueTurn>;
  getTurns(dialogueId: string): Result<DialogueTurn[]>;
}

// Implementation
class SQLiteDialogueRepository implements DialogueRepository {
  constructor(private db: Database) {}

  createSession(): Result<Dialogue> {
    // SQL operations
  }

  // ... other methods
}

// Usage (dependency injection)
const repo = new SQLiteDialogueRepository(db);
const dialogue = repo.createSession();
```

**Benefits**:
- Testable (can mock repository)
- Swappable implementations
- Clear boundaries
- Database-agnostic business logic

### State Machine Pattern (Workflow)

**Problem**: Complex workflow logic with many possible states and transitions.

**Solution**: Explicit state machine with defined transitions.

```typescript
// States (phases)
enum Phase {
  INTAKE = 'INTAKE',
  PROPOSE = 'PROPOSE',
  VERIFY = 'VERIFY',
  EXECUTE = 'EXECUTE',
  // ...
}

// Transitions
interface Transition {
  from: Phase;
  to: Phase;
  condition?: (state: WorkflowState) => boolean;
}

const TRANSITIONS: Transition[] = [
  { from: Phase.INTAKE, to: Phase.PROPOSE },
  { from: Phase.PROPOSE, to: Phase.VERIFY },
  {
    from: Phase.VERIFY,
    to: Phase.EXECUTE,
    condition: (state) => allCriticalClaimsVerified(state)
  },
  {
    from: Phase.VERIFY,
    to: Phase.HUMAN_GATE,
    condition: (state) => hasCriticalUnknownClaims(state)
  },
];

// State machine
function transitionPhase(
  currentPhase: Phase,
  state: WorkflowState
): Result<Phase> {
  const validTransitions = TRANSITIONS.filter(t => t.from === currentPhase);

  for (const transition of validTransitions) {
    if (!transition.condition || transition.condition(state)) {
      return { success: true, value: transition.to };
    }
  }

  return {
    success: false,
    error: new CodedError('NO_VALID_TRANSITION', 'Workflow blocked')
  };
}
```

**Benefits**:
- Clear state progression
- Explicit transition conditions
- Easy to visualize
- Prevents invalid states

### Strategy Pattern (Role Implementations)

**Problem**: Different roles need different behavior but same interface.

**Solution**: Strategy pattern with role-specific implementations.

```typescript
// Strategy interface
interface RoleStrategy {
  role: Role;
  compileContext(options: CompileContextOptions): Result<CompiledContextPack>;
  invoke(contextPack: CompiledContextPack): Promise<Result<RoleResponse>>;
}

// Concrete strategies
class ExecutorStrategy implements RoleStrategy {
  role = Role.EXECUTOR;

  compileContext(options): Result<CompiledContextPack> {
    // Executor-specific context
    return compileExecutorContext(options);
  }

  async invoke(contextPack): Promise<Result<ExecutorResponse>> {
    // Executor-specific invocation
    return invokeExecutor(contextPack);
  }
}

class VerifierStrategy implements RoleStrategy {
  role = Role.VERIFIER;

  compileContext(options): Result<CompiledContextPack> {
    // Verifier-specific context
    return compileVerifierContext(options);
  }

  async invoke(contextPack): Promise<Result<VerifierResponse>> {
    // Verifier-specific invocation
    return invokeVerifier(contextPack);
  }
}

// Context
class RoleInvoker {
  constructor(private strategy: RoleStrategy) {}

  async execute(options: InvokeOptions): Promise<Result<RoleResponse>> {
    const contextResult = this.strategy.compileContext(options);
    if (!contextResult.success) return contextResult;

    return this.strategy.invoke(contextResult.value);
  }
}
```

**Benefits**:
- Easy to add new roles
- Role-specific behavior encapsulated
- Testable in isolation
- Clear separation of concerns

### Adapter Pattern (LLM Providers)

**Problem**: Different LLM APIs have incompatible interfaces.

**Solution**: Adapter pattern to provide unified interface.

```typescript
// Target interface
interface LLMProvider {
  name: string;
  invoke(request: LLMRequest): Promise<Result<LLMResponse>>;
  countTokens(text: string): number;
}

// Anthropic adapter
class AnthropicProvider implements LLMProvider {
  name = 'anthropic';

  async invoke(request: LLMRequest): Promise<Result<LLMResponse>> {
    // Translate to Anthropic format
    const anthropicRequest = {
      model: request.model,
      messages: request.messages,
      max_tokens: request.maxTokens,
      // Anthropic-specific fields
    };

    const response = await this.client.messages.create(anthropicRequest);

    // Translate back to common format
    return {
      success: true,
      value: {
        content: response.content[0].text,
        stopReason: response.stop_reason,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens
        }
      }
    };
  }

  countTokens(text: string): number {
    // Anthropic-specific tokenization
    return this.client.countTokens(text);
  }
}

// OpenAI adapter
class OpenAIProvider implements LLMProvider {
  name = 'openai';

  async invoke(request: LLMRequest): Promise<Result<LLMResponse>> {
    // Translate to OpenAI format
    const openaiRequest = {
      model: request.model,
      messages: request.messages,
      max_tokens: request.maxTokens,
      // OpenAI-specific fields
    };

    const response = await this.client.chat.completions.create(openaiRequest);

    // Translate back to common format
    return {
      success: true,
      value: {
        content: response.choices[0].message.content,
        stopReason: response.choices[0].finish_reason,
        usage: {
          inputTokens: response.usage.prompt_tokens,
          outputTokens: response.usage.completion_tokens
        }
      }
    };
  }

  countTokens(text: string): number {
    // OpenAI-specific tokenization
    return tiktoken.encode(text).length;
  }
}
```

**Benefits**:
- Provider-independent code
- Easy to add new providers
- Consistent error handling
- Testable with mocks

### Observer Pattern (UI Updates)

**Problem**: UI needs to update when database state changes.

**Solution**: Observer pattern via VS Code TreeDataProvider.

```typescript
// Subject (VS Code TreeDataProvider)
class DialogueViewProvider implements vscode.TreeDataProvider<DialogueTurnItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  // Notify observers
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: DialogueTurnItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: DialogueTurnItem): DialogueTurnItem[] {
    // Query database for current state
    const turns = getTurns(this.dialogueId);
    return turns.map(turn => new DialogueTurnItem(turn));
  }
}

// Register observer
const provider = new DialogueViewProvider();
vscode.window.registerTreeDataProvider('janumicode.dialogueView', provider);

// Trigger updates
function onNewTurn(turn: DialogueTurn) {
  // Save turn to database
  saveTurn(turn);

  // Notify UI to refresh
  provider.refresh();
}
```

**Benefits**:
- Decoupled UI from business logic
- Reactive updates
- VS Code-native pattern
- Multiple observers supported

### Facade Pattern (Integration Layer)

**Problem**: Complex subsystem interactions require coordination.

**Solution**: Facade provides simplified high-level API.

```typescript
// Complex subsystems
import { createDialogueSession } from '../dialogue';
import { initializeWorkflowState } from '../workflow';
import { compileContextPack } from '../context';
import { invokeExecutor } from '../roles';

// Facade
export function startDialogueWithWorkflow(
  options: StartDialogueWithWorkflowOptions
): Result<StartDialogueWithWorkflowResult> {
  // Coordinate multiple subsystems

  // 1. Create dialogue
  const dialogueResult = createDialogueSession();
  if (!dialogueResult.success) return dialogueResult;

  // 2. Add initial turn
  const turnResult = createAndAddTurn({
    dialogue_id: dialogueResult.value.dialogue_id,
    role: Role.HUMAN,
    phase: Phase.INTAKE,
    speech_act: SpeechAct.CLAIM,
    content_ref: options.goal
  });
  if (!turnResult.success) return turnResult;

  // 3. Initialize workflow
  const workflowResult = initializeWorkflowState(
    dialogueResult.value.dialogue_id
  );
  if (!workflowResult.success) return workflowResult;

  return {
    success: true,
    value: {
      dialogue: dialogueResult.value,
      turn: turnResult.value,
      workflow: workflowResult.value
    }
  };
}
```

**Benefits**:
- Simplified API for common tasks
- Coordinates complex interactions
- Reduces coupling between subsystems
- Single entry point

---

## Key Design Decisions

### 1. SQLite Over Distributed Database

**Decision**: Use SQLite for all persistence.

**Rationale**:
- **Simplicity**: No separate database server to manage
- **Portability**: Database is a single file in workspace
- **Performance**: Fast for single-user workloads
- **ACID guarantees**: Built-in transactions
- **No network overhead**: Eliminates latency

**Trade-offs**:
- Not suitable for multi-user collaboration (not a goal)
- Limited to single machine (acceptable for IDE extension)

**Implementation Details**:
- WAL mode for better concurrency
- Foreign key enforcement enabled
- Versioned schema migrations

### 2. Append-Only Event Log

**Decision**: All tables are append-only; updates create new events.

**Rationale**:
- **Audit trail**: Complete history of all changes
- **Replay capability**: Can reconstruct state at any point
- **Debugging**: Full visibility into what happened
- **Immutability**: Aligns with design principle #4

**Trade-offs**:
- Database grows larger than with updates
- Queries need to aggregate events for current state

**Implementation Details**:
```sql
-- Updates create events, not modify records
INSERT INTO claim_events (claim_id, event_type, source, timestamp)
VALUES (?, 'VERIFIED', 'VERIFIER', datetime('now'));

-- Current state is projection of events
SELECT * FROM claims
WHERE claim_id = ?
ORDER BY created_at DESC LIMIT 1;
```

### 3. Stateless LLM Invocation

**Decision**: Compile deterministic context packs; don't rely on chat history.

**Rationale**:
- **Reliability**: No hidden state in LLM conversation
- **Reproducibility**: Same context → same result
- **Testability**: Can replay with exact same context
- **Provider-agnostic**: Works with any LLM API
- **Token control**: Explicit token budget management

**Trade-offs**:
- More complex context compilation
- Higher token usage than conversation

**Implementation Details**:
```typescript
// Context pack is compiled from database state
const contextPack = compileContextPack({
  role: Role.EXECUTOR,
  dialogueId: "abc-123",
  tokenBudget: 10000,
  includeHistorical: true
});

// LLM invoked with pack, not conversation
const response = await llmProvider.invoke({
  model: "claude-sonnet-4",
  messages: [{ role: "user", content: contextPack }],
  maxTokens: 4000
});
```

### 4. Explicit Human Gates

**Decision**: Critical UNKNOWN/DISPROVED claims trigger blocking gates.

**Rationale**:
- **Safety**: Prevents execution on invalid assumptions
- **Transparency**: Human sees why blocked
- **Accountability**: Decision recorded with rationale
- **Control**: Human retains authority

**Trade-offs**:
- More human interruptions than automated systems
- Workflow can't proceed autonomously

**Implementation Details**:
```typescript
// Open gate when critical claim is UNKNOWN
if (verdict === VerdictType.UNKNOWN && claim.criticality === Criticality.CRITICAL) {
  const gate = openGate({
    dialogueId,
    reason: `Critical claim is UNKNOWN: ${claim.statement}`,
    blockingClaims: [claim.claim_id]
  });

  // Workflow suspended until human resolves gate
  return { blocked: true, gateId: gate.gate_id };
}
```

### 5. Content-Addressed Blob Storage

**Decision**: Store artifacts with SHA-256 content hashing.

**Rationale**:
- **Deduplication**: Identical content stored once
- **Integrity**: Hash verifies content
- **Immutability**: Content can't change without changing hash
- **Traceability**: Artifacts traceable to exact content

**Trade-offs**:
- Slightly more complex storage logic
- Hash computation overhead

**Implementation Details**:
```typescript
// Store with content hash
const hash = createHash('sha256').update(content).digest('hex');
const artifactId = nanoid();

db.run(
  'INSERT INTO artifacts (artifact_id, content_hash, content, mime_type, size) VALUES (?, ?, ?, ?, ?)',
  [artifactId, hash, content, mimeType, content.length]
);

// Deduplication via UNIQUE constraint on content_hash
```

### 6. Per-Role LLM Configuration

**Decision**: Each role can use different LLM provider/model.

**Rationale**:
- **Cost optimization**: Use cheaper models for simpler roles
- **Performance**: Use faster models where speed matters
- **Capability matching**: Use stronger models for complex reasoning

**Trade-offs**:
- More configuration complexity
- User needs to understand role differences

**Implementation Details**:
```typescript
interface RoleLLMConfig {
  provider: 'anthropic' | 'openai';
  model: string;
}

const config = {
  executor: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514' // Strong reasoning
  },
  technicalExpert: {
    provider: 'anthropic',
    model: 'claude-haiku-4-20250731' // Fast, cheap
  },
  verifier: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514' // Precise reasoning
  }
};
```

### 7. Result<T> Over Exceptions

**Decision**: Use Result<T> type for all operations that can fail.

**Rationale**:
- **Type safety**: Errors are part of type signature
- **Explicit handling**: Callers must handle errors
- **No silent failures**: Can't ignore error case
- **Composability**: Results can be chained

**Trade-offs**:
- More verbose than try/catch
- Requires discipline to propagate errors

**Implementation Details**:
```typescript
// Define Result type
type Result<T> =
  | { success: true; value: T }
  | { success: false; error: Error };

// All functions return Result
function getDialogue(id: string): Result<Dialogue> {
  // ...
}

// Callers must handle both cases
const result = getDialogue(id);
if (!result.success) {
  logError(result.error);
  return;
}
const dialogue = result.value;
```

### 8. VS Code Extension (Not Standalone)

**Decision**: Build as VS Code extension, not standalone tool.

**Rationale**:
- **IDE integration**: Access to workspace, files, git
- **User familiarity**: Developers already use VS Code
- **UI framework**: VS Code provides UI components
- **Distribution**: VS Code Marketplace

**Trade-offs**:
- Locked to VS Code ecosystem
- Can't use in other IDEs

**Implementation Details**:
- Extension API for commands, views, status bar
- TreeDataProvider for custom views
- Workspace API for file access
- SCM API for git integration

---

## Extension Points

### Adding New Roles

To add a new role to the system:

1. **Define role enum** in `src/lib/types/enums.ts`:
```typescript
export enum Role {
  EXECUTOR = 'EXECUTOR',
  TECHNICAL_EXPERT = 'TECHNICAL_EXPERT',
  VERIFIER = 'VERIFIER',
  HISTORIAN = 'HISTORIAN',
  HUMAN = 'HUMAN',
  NEW_ROLE = 'NEW_ROLE' // Add here
}
```

2. **Create role implementation** in `src/lib/roles/newRole.ts`:
```typescript
export interface NewRoleInvocationOptions {
  dialogueId: string;
  contextPack: CompiledContextPack;
  config: RoleLLMConfig;
}

export async function invokeNewRole(
  options: NewRoleInvocationOptions
): Promise<Result<NewRoleResponse>> {
  // Implementation
}
```

3. **Add context compilation** in `src/lib/context/compiler.ts`:
```typescript
function compileNewRoleContext(
  options: CompileContextOptions
): Result<CompiledContextPack> {
  // Role-specific context
}
```

4. **Update database schema** to allow new role in enums:
```sql
ALTER TABLE dialogue_turns CHECK(role IN (..., 'NEW_ROLE'));
```

5. **Register in role connector** (`src/lib/integration/roleConnector.ts`):
```typescript
export async function invokeNewRoleWithContext(...) { /* ... */ }
```

### Adding New LLM Providers

To add support for a new LLM provider:

1. **Create provider implementation** in `src/lib/llm/providers/newprovider.ts`:
```typescript
export class NewProvider implements LLMProvider {
  name = 'newprovider';

  async invoke(request: LLMRequest): Promise<Result<LLMResponse>> {
    // Translate request to provider format
    // Call provider API
    // Translate response to common format
  }

  countTokens(text: string): number {
    // Provider-specific tokenization
  }

  getMaxTokens(model: string): number {
    // Return model's context window size
  }
}
```

2. **Register provider** in `src/lib/llm/client.ts`:
```typescript
const PROVIDERS = {
  anthropic: new AnthropicProvider(),
  openai: new OpenAIProvider(),
  newprovider: new NewProvider()
};
```

3. **Add configuration** in `src/lib/config/settings.ts`:
```typescript
interface LLMConfig {
  anthropic: { apiKey: string };
  openai: { apiKey: string };
  newprovider: { apiKey: string }; // Add here
}
```

4. **Update UI** to allow selecting new provider in configuration.

### Adding New Workflow Phases

To add a new phase to the workflow:

1. **Define phase enum** in `src/lib/types/enums.ts`:
```typescript
export enum Phase {
  INTAKE = 'INTAKE',
  // ... existing phases
  NEW_PHASE = 'NEW_PHASE' // Add here
}
```

2. **Define transitions** in `src/lib/workflow/transitions.ts`:
```typescript
const TRANSITIONS: Transition[] = [
  // ... existing transitions
  {
    from: Phase.SOME_PHASE,
    to: Phase.NEW_PHASE,
    condition: (state) => someCondition(state)
  }
];
```

3. **Implement phase handler** in `src/lib/workflow/stateMachine.ts`:
```typescript
async function handleNewPhase(
  dialogueId: string,
  state: WorkflowState
): Promise<Result<PhaseResult>> {
  // Phase logic
}
```

4. **Update database schema** to allow new phase:
```sql
ALTER TABLE dialogue_turns CHECK(phase IN (..., 'NEW_PHASE'));
```

### Adding New UI Views

To add a new view to the VS Code sidebar:

1. **Create view provider** in `src/lib/ui/newView.ts`:
```typescript
export class NewViewProvider implements vscode.TreeDataProvider<NewItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: NewItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: NewItem): NewItem[] {
    // Query database for items
  }
}
```

2. **Register view** in `package.json`:
```json
{
  "contributes": {
    "views": {
      "janumicode": [
        {
          "id": "janumicode.newView",
          "name": "New View"
        }
      ]
    }
  }
}
```

3. **Register provider** in `src/extension.ts`:
```typescript
const newViewProvider = new NewViewProvider();
context.subscriptions.push(
  vscode.window.registerTreeDataProvider('janumicode.newView', newViewProvider)
);
```

---

## Conclusion

This architecture document provides a comprehensive technical overview of JanumiCode's design and implementation. The system is built on solid design principles, uses proven design patterns, and maintains clear separation of concerns across all layers.

Key architectural strengths:
- **Governed execution** with explicit verification gates
- **Auditable** with complete immutable history
- **Testable** with dependency injection and clear interfaces
- **Extensible** with well-defined extension points
- **Maintainable** with modular organization and documentation

For implementation details, see:
- [Technical Specification](./Governed%20Multi-Role%20Dialogue%20&%20Execution%20System%20-%20Technical%20Specification.md)
- [Implementation Roadmap](./Implementation%20Roadmap.md)
- [Getting Started](./Getting%20Started.md)
- [CONTRIBUTING](../CONTRIBUTING.md)
