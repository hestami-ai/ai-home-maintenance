# JanumiCode Architecture

This document defines the architectural layers, module boundaries, and dependency rules enforced by structural tests.

## Architecture Overview

JanumiCode follows a **4-layer clean architecture** pattern with strict dependency rules:

```
┌─────────────────────────────────────────┐
│  Layer 1: Presentation                  │
│  (ui/, webview/)                        │
└──────────────┬──────────────────────────┘
               │ depends on ↓
┌──────────────▼──────────────────────────┐
│  Layer 2: Business Logic                │
│  (workflow/, orchestrator/, roles/)     │
└──────────────┬──────────────────────────┘
               │ depends on ↓
┌──────────────▼──────────────────────────┐
│  Layer 3: Infrastructure                │
│  (database/, llm/, cli/, events/)       │
└──────────────┬──────────────────────────┘
               │ depends on ↓
┌──────────────▼──────────────────────────┐
│  Layer 4: Foundation                    │
│  (types/, primitives/, errorHandling/)  │
└─────────────────────────────────────────┘
```

**Key Principle**: Dependencies flow **downward only**. Lower layers never depend on upper layers.

## Layer Definitions

### Layer 1: Presentation
**Purpose**: User interface and client-side rendering

**Modules**:
- `src/lib/ui/` - VS Code webview provider and UI components
- `src/webview/` - Client-side webview JavaScript

**Allowed Dependencies**:
- ✅ Business Logic (Layer 2)
- ✅ Infrastructure (Layer 3) - via public interfaces only
- ✅ Foundation (Layer 4)
- ❌ **FORBIDDEN**: Direct database access, CLI internals

**Example Violations**:
```typescript
// ❌ BAD: UI importing database directly
import { getDatabase } from '../../database/init';

// ✅ GOOD: UI using workflow abstractions
import { getWorkflowState } from '../../workflow/stateMachine';
```

### Layer 2: Business Logic
**Purpose**: Core domain logic and workflows

**Modules**:
- `src/lib/workflow/` - Workflow state machine and orchestration
- `src/lib/orchestrator/` - High-level workflow coordination
- `src/lib/roles/` - LLM role implementations (Executor, Verifier, etc.)
- `src/lib/dialogue/` - Dialogue session management
- `src/lib/curation/` - Narrative curation logic

**Allowed Dependencies**:
- ✅ Infrastructure (Layer 3)
- ✅ Foundation (Layer 4)
- ❌ **FORBIDDEN**: Presentation layer (UI/webview)

**Example Violations**:
```typescript
// ❌ BAD: Workflow importing UI components
import { GovernedStreamPanel } from '../../ui/governedStream';

// ✅ GOOD: Workflow emitting events that UI subscribes to
emitWorkflowStateChanged(dialogueId, newPhase);
```

### Layer 3: Infrastructure
**Purpose**: External integrations and data persistence

**Modules**:
- `src/lib/database/` - SQLite database and stores
- `src/lib/llm/` - LLM provider abstraction (OpenAI, Anthropic, Gemini)
- `src/lib/cli/` - CLI process management and adapters
- `src/lib/events/` - Event bus and event persistence
- `src/lib/config/` - Configuration and secrets management
- `src/lib/integration/` - External system integrations

**Allowed Dependencies**:
- ✅ Foundation (Layer 4)
- ❌ **FORBIDDEN**: Business Logic, Presentation

**Example Violations**:
```typescript
// ❌ BAD: Database importing workflow
import { transitionWorkflow } from '../../workflow/stateMachine';

// ✅ GOOD: Database as passive storage, workflow controls it
export function saveWorkflowState(state: WorkflowState): void {
  // Store data only
}
```

### Layer 4: Foundation
**Purpose**: Shared types, utilities, and primitives

**Modules**:
- `src/lib/types/` - TypeScript type definitions and interfaces
- `src/lib/primitives/` - Pure utility functions
- `src/lib/errorHandling/` - Error types and handlers
- `src/lib/logging/` - Logging infrastructure

**Allowed Dependencies**:
- ✅ Other foundation modules only
- ❌ **FORBIDDEN**: Any upper layer

**Example Violations**:
```typescript
// ❌ BAD: Types importing from workflow
import { Phase } from '../../workflow/stateMachine';

// ✅ GOOD: Types are self-contained
export enum Phase {
  INTAKE = 'INTAKE',
  PROPOSE = 'PROPOSE',
  // ...
}
```

## Module Boundary Rules

Beyond layer separation, specific modules have additional isolation requirements:

### Webview Isolation
**Rule**: `src/webview/` is client-side code that cannot import Node.js modules

**Forbidden Imports**:
- ❌ `database/` - Webview runs in browser context
- ❌ `workflow/` - Business logic stays on server
- ❌ `roles/` - LLM role implementations are server-side
- ❌ `cli/` - CLI processes are server-side only

**Communication**: Use message passing via `postMessage` API

### Database Access Patterns
**Rule**: Database modules should only be accessed via store abstractions

**Allowed**:
- ✅ `import { storeWorkflowState } from 'database/workflowStore'`
- ✅ `import { getDatabase } from 'database/init'` (initialization only)

**Discouraged**:
- ⚠️ Direct table access from non-store modules
- ⚠️ Importing internal database helpers

### LLM Provider Access
**Rule**: LLM provider should only be used by authorized modules

**Allowed Importers**:
- ✅ `roles/` - Role implementations need LLM access
- ✅ `cli/` - CLI adapters for LLM integration
- ✅ `documents/` - Document generation
- ✅ `curation/` - Narrative curation

**Forbidden**:
- ❌ Direct LLM access from UI
- ❌ Direct LLM access from database

## Circular Dependencies

**Zero Tolerance Policy**: No circular dependencies allowed

**Why**: Circular dependencies create:
- Tight coupling between modules
- Difficult refactoring
- Complex initialization order
- Hard-to-debug issues

**Detection**: Automated via structural tests

**Example**:
```typescript
// ❌ BAD: Module A imports B, B imports A
// moduleA.ts
import { helperB } from './moduleB';

// moduleB.ts
import { helperA } from './moduleA'; // CIRCULAR!

// ✅ GOOD: Extract shared code to new module
// shared.ts
export function commonHelper() { ... }

// moduleA.ts
import { commonHelper } from './shared';

// moduleB.ts
import { commonHelper } from './shared';
```

## Testing & Validation

### Automated Tests

**Layer Boundary Tests** (`layerBoundaries.test.ts`):
- ✅ Presentation → Database violations
- ✅ Business Logic → UI violations
- ✅ Infrastructure → Business Logic violations
- ✅ Foundation → Upward dependency violations

**Module Boundary Tests** (`moduleBoundaries.test.ts`):
- ✅ Webview isolation
- ✅ Database access patterns
- ✅ LLM provider access control
- ✅ Context builder modularity

**Circular Dependency Tests** (`circularDeps.test.ts`):
- ✅ Codebase-wide cycle detection
- ✅ Per-module cycle detection
- ✅ Strongly connected components

**Dependency Metrics** (`dependencyMetrics.test.ts`):
- ✅ Fan-out constraints (<20 dependencies per module)
- ✅ Coupling metrics (instability, afferent/efferent)
- ✅ Stable dependency principle
- ✅ Architecture health summary

### Running Tests

```bash
# Run structural tests only
pnpm run test:structure

# Run with dependency-cruiser validation
pnpm run arch:validate

# Run all tests (structural + unit)
pnpm run test:all

# Generate architecture diagram
pnpm run arch:graph

# Watch mode for development
pnpm run test:structure:watch
```

### Continuous Integration

Structural tests should run on **every commit**:

```yaml
# .github/workflows/ci.yml
- name: Validate Architecture
  run: pnpm run arch:validate

- name: Run Structural Tests
  run: pnpm run test:structure

- name: Run Unit Tests
  run: pnpm run test:unit
```

## Dependency-Cruiser Configuration

See `.dependency-cruiser.cjs` for the complete rule set.

**Key Rules**:
- `no-presentation-to-database` - UI cannot access database
- `no-workflow-to-ui` - Business logic cannot import UI
- `no-circular-dependencies` - Zero tolerance for cycles
- `no-orphans` - Detect dead code (warning only)

**Rule Severity**:
- `error` - Blocks commit/build
- `warn` - Alerts but allows build

## Common Violations & Fixes

### Violation: UI Importing Database

```typescript
// ❌ Problem
// src/lib/ui/governedStream/GovernedStreamPanel.ts
import { getDatabase } from '../../database/init';

const db = getDatabase();
const claims = db.prepare('SELECT * FROM claims').all();
```

**Fix**: Use workflow abstraction
```typescript
// ✅ Solution
import { getClaimsForDialogue } from '../../workflow/claims';

const claims = getClaimsForDialogue(dialogueId);
```

### Violation: Database Importing Workflow

```typescript
// ❌ Problem
// src/lib/database/workflowStore.ts
import { transitionWorkflow } from '../../workflow/stateMachine';

export function saveState(state) {
  // ...
  transitionWorkflow(state.dialogueId, Phase.EXECUTE);
}
```

**Fix**: Emit events instead
```typescript
// ✅ Solution
import { emitWorkflowEvent } from '../../events/eventBus';

export function saveState(state) {
  // ...
  emitWorkflowEvent('state_saved', { dialogueId: state.dialogueId });
}
```

### Violation: Circular Dependency

```typescript
// ❌ Problem
// contextCompiler.ts imports builders
import { buildExecutorContext } from './builders/executor';

// builders/executor.ts imports compiler
import { compileContext } from '../contextCompiler';
```

**Fix**: Extract shared interface
```typescript
// ✅ Solution
// Create contextTypes.ts with shared types
export interface ContextBuilder {
  build(input: ContextInput): CompiledContext;
}

// Both files import only types
import type { ContextBuilder } from './contextTypes';
```

## Architecture Decision Records

### Why 4 Layers?

**Rationale**: Balances separation of concerns with pragmatism
- Too few layers (2-3): Insufficient separation
- Too many layers (5+): Over-engineering, developer friction

**Trade-off**: Some modules (e.g., `integration/`) could be layer 2 or 3. We chose layer 3 because external integrations are infrastructure concerns.

### Why Zero Circular Dependencies?

**Rationale**: Circular dependencies indicate design flaws
- Hard to unit test in isolation
- Unpredictable initialization order
- Difficult to refactor or extract modules

**Trade-off**: May require more boilerplate (event passing, dependency injection). Worth it for maintainability.

### Why Strict Webview Isolation?

**Rationale**: Security and architecture
- Webview runs in untrusted browser context
- Prevents accidental exposure of Node.js APIs
- Forces clean message-passing interface

**Trade-off**: More verbose communication layer. Essential for security.

## Maintenance

### Adding New Modules

When adding a new module under `src/lib/`:

1. **Determine layer**: Which layer does it belong to?
2. **Update tests**: Add module-specific tests if needed
3. **Document dependencies**: Update this file if new patterns emerge
4. **Run validation**: `pnpm run arch:validate && pnpm run test:structure`

### Refactoring Violations

When structural tests fail:

1. **Understand the violation**: Read error message carefully
2. **Find root cause**: Is it a design issue or just wrong import?
3. **Fix properly**: Don't just suppress warnings - fix the architecture
4. **Update rules**: If rule is wrong (rare), update `.dependency-cruiser.cjs`

### Architecture Reviews

**Quarterly**: Review architecture diagram and metrics
- Are modules growing too large?
- Are there new coupling patterns?
- Should layer definitions be refined?

**Per-feature**: Check if new features fit architecture
- Does this violate layer separation?
- Does this create circular dependencies?
- Should this be a new module?

## Enhanced Structural Testing

JanumiCode uses a comprehensive structural testing framework with actionable violations, metrics tracking, and agent-specific constraints.

### Violation Severity Levels

All architectural violations are categorized by severity:

- **ERROR** (🔴): Blocks build, must fix immediately
  - Layer boundary violations
  - Circular dependencies
  - Foundation upward dependencies

- **WARN** (🟡): Technical debt, should fix soon
  - High fan-out modules (>20 dependencies)
  - Unauthorized LLM access
  - Direct database access bypassing stores

- **INFO** (🔵): Informational, for awareness
  - Complexity thresholds
  - High instability in volatile modules

### Actionable Fix Suggestions

Every violation includes:
1. **Why it's wrong**: Clear explanation of the architectural principle
2. **How to fix**: Step-by-step remediation instructions
3. **Example**: Before/after code snippets
4. **Documentation link**: Reference to relevant architecture section

### Architecture Metrics & Drift Detection

**Collect Metrics**:
```bash
pnpm run arch:metrics
```

Captures:
- Total violations (errors/warnings/info)
- Circular dependencies count
- High fan-out modules
- Foundation stability
- Health score (0-100)

**Detect Drift**:
```bash
pnpm run arch:drift
```

Compares current metrics against baseline:
- Fails CI if errors increase
- Fails if warnings increase >10%
- Fails if new circular dependencies appear
- Fails if health score drops >10 points

**Set Baseline**:
```bash
pnpm run arch:baseline
```

Captures current state as the acceptable baseline for future comparisons.

### Circular Dependency Visualization

Circular dependencies are displayed with:
- **Mermaid diagrams**: Visual graph of the cycle
- **Fix suggestions**: Ranked by difficulty (low → high)
  - Remove weakest dependency
  - Extract shared types to common module
  - Use dependency injection/events

### Agent-Specific Constraints

For AI-assisted codebases, additional rules enforce:

**Prompt Integrity**:
- No `any` types in prompt/context builders
- System prompts defined as constants
- Strong typing for LLM inputs

**LLM Call Patterns**:
- All LLM calls include retry logic
- Responses validated before use
- PII redaction before external API calls

**Workflow Determinism**:
- No `Date.now()`, `Math.random()` in workflows
- No direct I/O (fs, process.env) in business logic
- Use dependency injection for side effects

**Context Validation**:
- Runtime validation in context builders
- PII redaction where applicable
- Structured logging (no console.log)

### Foundation Covenant

Foundation modules (types/, primitives/) MUST:
- Have **ZERO** dependencies on application layers
- Only import from: Node stdlib, npm packages, other foundation modules
- Be pure, side-effect free
- Be reusable across projects
- Have minimal external dependencies (<10)

Violations of the foundation covenant are treated as **critical errors**.

## Available Scripts

```bash
# Validate architecture with dependency-cruiser
pnpm run arch:validate

# Generate dependency graph (SVG)
pnpm run arch:graph

# Run all structural tests
pnpm run test:structure

# Watch mode for structural tests
pnpm run test:structure:watch

# Collect architecture metrics
pnpm run arch:metrics

# Detect architecture drift vs baseline
pnpm run arch:drift

# Set new baseline
pnpm run arch:baseline

# Run all tests (structural + unit)
pnpm run test:all
```

## Resources

- [Dependency Cruiser Docs](https://github.com/sverweij/dependency-cruiser)
- [Clean Architecture (Uncle Bob)](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Stable Dependencies Principle](https://wiki.c2.com/?StableDependenciesPrinciple)
- [Acyclic Dependencies Principle](https://wiki.c2.com/?AcyclicDependenciesPrinciple)

---

**Last Updated**: 2026-04-06  
**Maintainers**: JanumiCode Team
