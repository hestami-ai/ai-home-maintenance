# Test Strategy Harness Specification Critique

Critical analysis of the "JanumiCode v2 Test Strategy Harness Requirements" specification.

## Guiding Principle

**Goal: 100% complete and 100% correct to intent and implementation.** Speed is secondary. This critique evaluates whether the spec achieves completeness and correctness, not whether it's the fastest path to value.

## Summary

The specification is **largely correct in its architecture** but has **three completeness gaps** that would result in partial or incorrect implementation if not addressed.

---

## 1. The CLI-First Decision: Correct for Completeness

### The Claim

> "The single largest enabler for automated testing is a JanumiCode CLI interface that runs the full pipeline outside the VS Code Extension Host. This is a prerequisite to the test harness, not an output of it."

### Assessment: Correct

The CLI-first approach is **correct** for achieving complete and correct implementation:

| Requirement | CLI-First Advantage |
|-------------|---------------------|
| **IDE-agnostic** | Works in VS Code, JetBrains, Vim, CI, standalone |
| **Human-debuggable** | Developer can run `janumicode run` without F5 |
| **CI-native** | Exit codes, JSON output, gap report files |
| **Process isolation** | Each run in clean process, no state leakage |
| **Auditability** | Full command line recorded in CI logs |

### Gap: Missing CLI-In-Process Bridge

The spec correctly identifies CLI as prerequisite, but **doesn't specify how CLI and in-process harness share code**.

**Problem**: If CLI and `workflowDriver.ts` are separate implementations, they will drift and produce different results.

**Required addition**: Define shared core that both CLI and vitest use:

```
src/core/
  pipelineRunner.ts        # Shared engine (no VS Code, no CLI dependencies)
  
src/cli/
  runner.ts                # CLI wrapper around pipelineRunner
  
src/test/harness/
  workflowHarness.ts       # Test wrapper around pipelineRunner
```

This ensures **both paths produce identical results** - critical for correctness.

---

## 2. LLM-Generated Gap Suggestions: Correct for Precision

### The Claim

> "When a gap is detected, the gap collector makes a single focused LLM API call to generate the `suggested_fix`."

### Assessment: Correct

LLM-generated suggestions provide **context-specific guidance** that rule-based templates cannot:

| Error Type | Rule-Based Template | LLM-Generated |
|------------|--------------------|--------------| 
| `assertion` | "Check the prompt template" | "Phase 2.1 produced empty user_stories. The requirements agent needs the intent_statement artifact injected into its Context Payload. See `phase2Handler.ts:45` where the artifact fetch is commented out." |

The LLM-generated suggestion:
- Names the specific file and line
- Identifies the root cause
- Provides actionable steps

### Gap: Missing Error Context for LLM

The spec lists what the LLM receives:

> "The gap type and specific failure details, the relevant Phase specification section, the expected artifact schema, a summary of the current stub implementation, the assertion that failed"

But **doesn't specify how to extract "current stub implementation"**.

**Problem**: If the phase handler doesn't exist, there's no stub to summarize. If it exists but is complex, "first 100 lines" may miss the relevant code.

**Required addition**: Define error context extraction:

```typescript
interface GapErrorContext {
  // If handler doesn't exist
  handlerMissing: true;
  expectedHandlerPath: string;  // e.g., "src/phases/phase2Handler.ts"
  
  // If handler exists but fails
  handlerMissing: false;
  handlerPath: string;
  relevantCodeSnippet: string;  // Lines around the failure point
  failureLine?: number;
}
```

This ensures the LLM has **complete context** to generate correct suggestions.

---

## 3. Semantic Fixture Keys: Correct for Determinism

### The Claim

> "Each LLM call is identified by a semantic key: `{agent_role}__{sub_phase_id}__{call_sequence:02d}`"

### Assessment: Correct

Semantic keys provide **deterministic, unambiguous fixture matching**:

| Approach | Match Behavior | Failure Mode |
|----------|---------------|--------------|
| Substring matching | First match wins | If two prompts share text, wrong fixture may match |
| Semantic keys | Exact match on key | No ambiguity - each call has exactly one fixture |

For **correctness**, semantic keys are superior:
- Same phase run always uses same fixtures
- No accidental cross-phase matches
- Explicit fixture-to-call mapping

### Gap: Missing Key Injection Mechanism

The spec defines the key format but **doesn't specify how the key is passed to LLMProviderAdapter**.

**Problem**: Current `LLMCallOptions` doesn't have a field for semantic key:

```typescript
interface LLMCallOptions {
  prompt: string;
  system?: string;
  model: string;
  provider: string;
  responseFormat?: 'text' | 'json';
  // No semantic key field
}
```

**Required addition**: Extend the interface:

```typescript
interface LLMCallOptions {
  // ... existing fields
  /** Semantic key for fixture matching (test harness only) */
  semanticKey?: string;  // e.g., "requirements_agent__02_1_functional_requirements__01"
}
```

And update `MockLLMProvider.call()`:

```typescript
async call(options: LLMCallOptions): Promise<LLMCallResult> {
  // Prefer exact semantic key match over substring
  if (options.semanticKey) {
    const fixture = this.fixtures.find(f => f.key === options.semanticKey);
    if (fixture) return this.buildResult(options, fixture);
  }
  // Fallback to substring matching for backwards compatibility
  const fixture = this.fixtures.find(f => options.prompt.includes(f.match));
  // ...
}
```

This ensures **deterministic fixture matching** while maintaining backwards compatibility.

---

## 4. Phase Expectations: Correct for Completeness

### The Claim

Section 4.4 defines Hestami-specific assertions:

```
| 2.1 | functional_requirements | user_stories length >= 40; at least one references accounting... |
```

### Assessment: Correct

The spec correctly defines **domain-specific expectations** that verify the pipeline produces correct output for this specific input:

- **40+ user stories** matches the domain breadth (12 CAM + 9 FSM domains)
- **Accounting/GL references** verifies the spec was actually read
- **Acceptance criteria per story** verifies invariant compliance

These are not arbitrary numbers - they're derived from the Hestami spec itself.

### Gap: Missing Contract Layer

The spec defines domain-specific expectations but **doesn't define universal phase contracts**.

**Problem**: If a new test case is added (e.g., different spec document), the expectations would need to be rewritten entirely.

**Required addition**: Define two expectation layers:

```typescript
// src/test/harness/phaseContracts.ts - Universal
const PHASE_CONTRACTS: Record<PhaseId, PhaseContract> = {
  '2': {
    requiredRecords: ['functional_requirements', 'non_functional_requirements', 'consistency_report'],
    requiredArtifacts: {
      'functional_requirements': { schema: 'functional_requirements.schema.json' },
      'non_functional_requirements': { schema: 'non_functional_requirements.schema.json' },
    },
    invariants: [
      'Every user story has at least one acceptance criterion',
      'consistency_report shows zero critical failures',
    ],
  },
};

// src/test/harness/hestamiExpectations.ts - Domain-specific
const HESTAMI_EXPECTATIONS: Record<PhaseId, DomainExpectation[]> = {
  '2': [
    { artifact: 'functional_requirements', field: 'user_stories.length', assertion: '>= 40' },
    { artifact: 'functional_requirements', field: 'user_stories[*].action', assertion: 'contains', value: 'accounting' },
  ],
};
```

This ensures:
- **Universal contracts** are verified for any workflow
- **Domain expectations** are specific to the test case
- **Both layers** are complete and correct

---

## 5. Implementation Roadmap: Correct Sequence

### The Proposed Sequence

```
Wave 1: CLI Interface (5 files)
Wave 2: Extended Harness + Phase Expectations (4 files)
Wave 3: Fixture System + CLI Integration Tests (5+ files)
Wave 4: LLM-Generated Gap Suggestions (1 file)
Wave 5: Rolling Phase Coverage (ongoing)
Wave 6: CI Integration (deferred)
```

### Assessment: Correct

The sequence is correct for achieving complete implementation:

1. **CLI first** - Establishes the IDE-agnostic foundation
2. **Harness second** - Builds on CLI's pipeline runner
3. **Fixtures third** - Requires harness to capture/playback
4. **LLM suggestions fourth** - Requires gap collector to exist
5. **Rolling coverage** - Incremental as phases are implemented
6. **CI last** - Requires all layers to be stable

### Gap: Missing Shared Core Definition

The roadmap doesn't specify **which code is shared between CLI and harness**.

**Problem**: If Wave 1 and Wave 2 are implemented independently, they will have duplicated logic that drifts.

**Required addition**: Define shared core in Wave 1:

```
Wave 1: CLI Interface + Shared Core
  - src/core/pipelineRunner.ts      # Shared engine
  - src/core/pipelineConfig.ts      # Shared config types
  - src/cli/index.ts                # CLI entry
  - src/cli/runner.ts               # CLI wrapper
  - src/cli/outputFormatter.ts      # CLI output
```

Then Wave 2 uses `pipelineRunner`:

```
Wave 2: Extended Harness
  - src/test/harness/workflowHarness.ts  # Uses pipelineRunner
  - src/test/harness/phaseContracts.ts
  - src/test/harness/gapCollector.ts
  - src/test/suite/hestamiProductDescription.test.ts
```

This ensures **single source of truth** for pipeline execution logic.

---

## 6. Completeness Gaps

### 6.1 Fixture Staleness Detection

The spec describes fixture capture but **doesn't define staleness detection**.

**Problem**: When prompt templates change, existing fixtures become stale but are still used. Tests pass with wrong fixtures.

**Required addition**: Add template hash to fixture:

```typescript
interface FixtureFile {
  // ... existing fields
  promptTemplateHash: string;  // SHA-256 of the template file
}

// On load:
const currentHash = hashFile(`.janumicode/prompts/${fixture.prompt_template}`);
if (currentHash !== fixture.promptTemplateHash) {
  throw new Error(`Fixture ${fixture.key} is stale. Re-run with --capture-fixtures.`);
}
```

### 6.2 Test Isolation Strategy

The spec mentions unique `workflow_run_id` and fresh database but **doesn't define the isolation mechanism**.

**Problem**: Vitest runs tests in parallel by default. Filesystem-based databases will conflict.

**Required addition**: Define isolation strategy:

```typescript
// In-memory databases for parallel tests
const db = await createInMemoryDatabase();

// OR: Unique path per test run
const dbPath = `.janumicode/test_${testId}/governed_stream.db`;
```

### 6.3 Error Classification Decision Tree

The spec lists error types but **doesn't define the classification algorithm**.

**Problem**: Is an empty `user_stories` array a `schema_error` or `assertion`? Different developers may classify differently.

**Required addition**: Define decision tree:

```
1. Phase threw exception?
   -> Yes: Was it LLM API error? -> 'llm_error'
   -> Yes: Was it timeout? -> 'timeout'
   -> Yes: 'not_implemented'

2. Required records missing from Governed Stream?
   -> Yes: 'missing_records'

3. Artifacts fail JSON Schema validation?
   -> Yes: 'schema_error'

4. Domain assertions fail?
   -> Yes: 'assertion'

5. Phase took too long?
   -> Yes: 'timeout'
```

### 6.4 Auto-Approve Decision Recording

The spec describes auto-approve behavior but **doesn't define how decisions are recorded for audit**.

**Problem**: Auto-approved decisions should be distinguishable from human decisions in the Governed Stream.

**Required addition**: Define decision trace format:

```typescript
interface AutoApproveDecisionTrace {
  decision_type: 'phase_gate_approval' | 'menu_selection' | 'mirror_approval';
  produced_by_agent_role: 'auto_approve_adapter';
  auto_approved_at: string;  // ISO 8601
  would_have_required_human_input: boolean;
  selected_option?: number;  // For menus
}
```

---

## 7. Strengths of the Specification

The spec does several things well:

1. **Clear vision statement** - "human-gated, F5-driven loop into autonomous, self-reinforcing build cycle"
2. **Exit code contract** - Well-defined exit codes (0-4) for CI integration
3. **Auto-approve adapter** - Complete enumeration of all interaction points
4. **Fixture file schema** - Good metadata fields (janumicode_version_sha, llm_provider, etc.)
5. **Success criteria** - Measurable outcomes, not vague goals
6. **Domain-specific expectations** - Derived from actual spec document, not arbitrary

---

## 8. Summary of Required Additions

To achieve **100% complete and 100% correct** implementation, the spec needs these additions:

| Area | Gap | Required Addition |
|------|-----|-------------------|
| **CLI-Harness Bridge** | No shared core defined | `src/core/pipelineRunner.ts` used by both |
| **Semantic Key Injection** | No field in LLMCallOptions | Add `semanticKey?: string` field |
| **Error Context for LLM** | No extraction mechanism | Define `GapErrorContext` interface |
| **Phase Contracts Layer** | Only domain-specific defined | Add `phaseContracts.ts` for universal checks |
| **Fixture Staleness** | No detection mechanism | Add `promptTemplateHash` field |
| **Test Isolation** | No mechanism defined | Specify in-memory DB or unique paths |
| **Error Classification** | No decision tree | Define classification algorithm |
| **Auto-Approve Audit** | No recording format | Define `AutoApproveDecisionTrace` |

---

## 9. Verdict

**The specification is architecturally correct** but **incomplete in 8 areas** that would result in implementation gaps or inconsistencies.

With the additions listed in Section 8, the spec would provide a complete and correct foundation for implementation.
