# Phase 9 Implementation Plan

Transform the Phase 9 scaffold into a fully functional execution engine that invokes external coding agents (Claude Code CLI), manages execution traces, runs tests, and handles failures.

---

## Summary

Phase 9 is the most complex phase in JanumiCode. It requires integrating with external CLI tools (Claude Code), capturing full execution traces, running test suites, executing evaluations, and handling failures with retry loops. The current implementation is a scaffold that writes `scaffold: true` records without actual execution.

---

## Current State

### Existing Infrastructure (Reusable)

| Component | File | Status |
|-----------|------|--------|
| `AgentInvoker` | `src/lib/orchestrator/agentInvoker.ts` | **Ready** - supports `claude_code_cli`, `gemini_cli`, `codex_cli` |
| `CLIInvoker` | `src/lib/cli/cliInvoker.ts` | **Ready** - spawns processes, streams output, handles timeouts |
| `ExecutorAgent` | `src/lib/agents/executorAgent.ts` | **Ready** - execution trace capture, file write recording |
| `Phase9Handler` | `src/lib/orchestrator/phases/phase9.ts` | **Scaffold** - writes placeholder records |
| `PHASE9_CONTRACT` | `src/test/harness/phaseContracts.ts` | **Ready** - defines required records and invariants |
| `MockLLMProvider` | `src/test/helpers/mockLLMProvider.ts` | **Ready** - fixture-based mock mode |

### Scaffold Code (Needs Replacement)

```typescript
// Current phase9.ts writes scaffold records:
content: {
  kind: 'execution_summary',
  tasks_attempted: tasks.length,
  scaffold: true,  // <-- This indicates no real execution
}
```

---

## Architecture

### Sub-Phase Flow

```
Phase 9 Entry
    |
    v
9.1 Implementation Task Execution
    |-- For each task in implementation_plan:
    |   |-- Build Context Payload (stdin + detail file)
    |   |-- Invoke Executor Agent (Claude Code CLI)
    |   |-- Capture Execution Trace (reasoning, tool calls, self-corrections)
    |   |-- Record File System Writes
    |   |-- Invariant Check (completion_criteria)
    |   |-- Reasoning Review (implementation_divergence)
    |   |-- Loop Detection Monitor
    |   `-- Quarantine on high-severity flaws
    |
    v
9.2 Test Execution
    |-- Parse test_plan artifact
    |-- Execute test suites in order: unit -> integration -> e2e
    |-- Capture test results
    |-- Route failures (skip dependent tests on failure)
    |
    v
9.3 Evaluation Execution
    |-- Parse evaluation_plan artifacts
    |-- Run evaluation tools
    |-- Capture evaluation results
    |
    v
9.4 Failure Handling (conditional)
    |-- On test/eval failure:
    |   |-- Analyze failure context
    |   |-- Escalate to human with options (retry/rollback/accept)
    |   `-- Optionally invoke Unsticking Agent
    |
    v
9.5 Completion Approval
    |-- Present Mirror of test_results + evaluation_results
    |-- Human approval gate
    `-- Phase Gate evaluation
```

---

## Implementation Waves

### Wave 1: Context Payload Construction

**Goal:** Build the Context Payload (stdin + detail file) for Executor Agent invocations.

**Files to create/modify:**
- `src/lib/context/executionContextBuilder.ts` (new) - Builds context for execution tasks
- `src/lib/orchestrator/phases/phase9.ts` - Wire context builder

**Context Payload includes:**
- Implementation Task details (component, responsibility, completion_criteria)
- Governing artifacts (ADR, component_model, technical_spec)
- Test Case specifications for the component
- Relevant code context (existing files in write_directory_paths)

**Detail File:** `.janumicode/context/{task_id}_{invocation_id}.md`

---

### Wave 2: Executor Agent Integration

**Goal:** Invoke Claude Code CLI for each implementation task.

**Files to modify:**
- `src/lib/orchestrator/phases/phase9.ts` - Replace scaffold with real invocations
- `src/lib/agents/executorAgent.ts` - Ensure full integration with AgentInvoker

**Execution Flow:**
1. Load `implementation_plan` artifact
2. For each task in dependency order:
   - Build Context Payload
   - Invoke `AgentInvoker.invoke({ backingTool: 'claude_code_cli', ... })`
   - Capture execution trace events
   - Record file writes
   - Emit real-time events for webview

**Mock Mode:**
- Use `MockLLMProvider` with fixtures
- Simulate file writes (no actual filesystem changes)
- Capture simulated execution traces

**Real Mode:**
- Spawn Claude Code CLI process
- Real file writes to workspace
- Full execution trace capture

---

### Wave 3: Execution Trace Capture

**Goal:** Capture and store full execution traces for Reasoning Review.

**Record Types:**
- `agent_invocation` - Invocation start/end
- `agent_reasoning_step` - Thinking/reasoning content
- `agent_self_correction` - Self-correction events
- `tool_call` - Tool invocation (name + params)
- `tool_result` - Tool output (stored but excluded from Reasoning Review)

**Files to modify:**
- `src/lib/agents/executorAgent.ts` - Ensure all event types captured
- `src/lib/cli/outputParser.ts` - Parse Claude Code stream-json output

**Claude Code Output Format:**
```json
{"type":"thinking","content":"..."}
{"type":"tool_use","name":"Write","input":{...}}
{"type":"tool_result","tool_use_id":"...","content":"..."}
{"type":"text","content":"..."}
```

---

### Wave 4: Test Execution (9.2)

**Goal:** Execute test suites and capture results.

**Files to create:**
- `src/lib/agents/testRunner.ts` (new) - Test suite execution

**Test Runner Logic:**
1. Parse `test_plan` artifact
2. Group test suites by type (unit, integration, e2e)
3. Execute in order: unit -> integration -> e2e
4. On failure:
   - Skip dependent tests per spec rules
   - Record failure context
5. Produce `test_results` artifact

**Vitest Integration:**
```typescript
// Parse test_plan.runner_command for each suite
// Example: "npx vitest run --testPathPattern=src/auth"
const result = await spawn('npx', ['vitest', 'run', '--testPathPattern=...', '--reporter=json']);
```

**Mock Mode:**
- Parse test_plan
- Generate simulated passing test results
- No actual test invocation

---

### Wave 5: Evaluation Execution (9.3)

**Goal:** Run evaluation tools and capture results.

**Files to create:**
- `src/lib/agents/evalRunner.ts` (new) - Evaluation execution

**Evaluation Types:**
- **Functional:** Custom scripts defined in evaluation_plan
- **Quality:** Linting, type checking, bundle analysis
- **Reasoning:** LLM-as-judge evaluation of agent outputs

**Output:** `evaluation_results` artifact with pass/fail per criterion

---

### Wave 6: Failure Handling (9.4)

**Goal:** Handle test/eval failures with retry loops and human escalation.

**Files to modify:**
- `src/lib/orchestrator/phases/phase9.ts` - Add failure handling logic

**Failure Flow:**
1. Analyze failure context (which test, which component)
2. Check if failure is from implementation or test specification
3. Options presented to human:
   - **Retry:** Re-invoke Executor for specific task
   - **Rollback:** Dependency Closure Rollback to prior phase
   - **Accept:** Document exception and proceed

**Unsticking Agent:** (already implemented at `src/lib/agents/unstickingAgent.ts`)
- Invoked when Tool Result Misinterpretation suspected
- Has access to full execution trace including tool results
- Two modes: Socratic Elicitation + Environmental Detective

---

### Wave 7: Reasoning Review Integration

**Goal:** Wire existing Reasoning Review into Phase 9 execution flow.

**Files to modify:**
- `src/lib/orchestrator/phases/phase9.ts` - Wire `ReasoningReview.review()` after each task

**Existing Implementation:** `src/lib/review/reasoningReview.ts` (225 lines) - fully functional

**Review Triggers:**
- After each implementation task completes
- On `implementation_divergence` check against governing ADR
- On `completeness_shortcut` check against `completion_criteria`

**Quarantine:**
- High-severity flaws -> `quarantined: true` flag
- Retry context receives flaw findings only (not quarantined output)

---

### Wave 8: Loop Detection Monitor

**Goal:** Detect and handle stuck agent situations.

**Detection Patterns:**
- **CONVERGING:** Identical tool invocations within one invocation
- **STALLED:** Alternating between same two tools >= 3 times
- **DIVERGING:** Each retry creates new problems
- **SCOPE_BLIND:** Available tools not called when needed

**Actions:**
- CONVERGING/STALLED -> Invoke Unsticking Agent (Socratic mode)
- DIVERGING -> Invoke Unsticking Agent (Detective mode)
- SCOPE_BLIND -> Invoke Unsticking Agent (Environmental Detective mode)

---

### Wave 9: Test Harness Integration

**Goal:** Update test harness expectations for Phase 9.

**Files to modify:**
- `src/test/harness/phaseContracts.ts` - Expand PHASE9_CONTRACT
- `src/test/harness/hestamiExpectations.ts` - Add Phase 9 expectations

**Mock Mode Fixtures:**
- Capture execution traces as fixtures
- Capture test results as fixtures
- Capture evaluation results as fixtures

**Fixture Directory:**
```
src/test/fixtures/hestami-product-description/
  phase_09/
    executor__09_1_implementation_task_01__01.json
    executor__09_1_implementation_task_02__01.json
    test_runner__09_2_test_execution__01.json
    eval_runner__09_3_eval_execution__01.json
```

---

## Key Interfaces

### ExecutionTask (from implementation_plan)

```typescript
interface ImplementationTask {
  id: string;
  component_id: string;
  component_responsibility: string;
  description: string;
  backing_tool: 'claude_code_cli' | 'gemini_cli' | 'codex_cli';
  completion_criteria: { criterion_id: string; description: string }[];
  dependency_task_ids: string[];
  estimated_complexity: 'low' | 'medium' | 'high';
  write_directory_paths: string[];
  task_type: 'standard' | 'refactoring';
  // Refactoring fields
  expected_pre_state_hash?: string;
  verification_step?: string;
}
```

### ExecutionResult

```typescript
interface ExecutionResult {
  task_id: string;
  success: boolean;
  files_written: FileWriteRecord[];
  skipped_idempotent: boolean;
  execution_trace_id: string;
  reasoning_review_result?: ReasoningReviewResult;
  error?: string;
}
```

### TestResults

```typescript
interface TestResults {
  suite_results: SuiteResult[];
  total_passed: number;
  total_failed: number;
  total_skipped: number;
  execution_order: ('unit' | 'integration' | 'e2e')[];
}

interface SuiteResult {
  suite_id: string;
  component_id: string;
  test_type: 'unit' | 'integration' | 'e2e';
  test_results: TestResult[];
  runner_command: string;
  duration_ms: number;
}

interface TestResult {
  test_case_id: string;
  status: 'passed' | 'failed' | 'skipped';
  output?: string;
  timestamp: string;
}
```

---

## Configuration

### package.json additions

```json
{
  "janumicode": {
    "execution": {
      "defaultBackingTool": "claude_code_cli",
      "timeoutSeconds": 600,
      "idleTimeoutSeconds": 120,
      "maxRetries": 3,
      "quarantineOnHighSeverity": true
    },
    "testRunner": {
      "command": "npx vitest run",
      "reporter": "json",
      "timeoutSeconds": 300
    }
  }
}
```

---

## Success Criteria

| Criterion | Verification |
|-----------|--------------|
| Phase 9.1 executes implementation tasks via Claude Code CLI | Run harness with real LLM, verify `file_system_write_record`s |
| Execution traces captured for all invocations | Query `agent_reasoning_step`, `tool_call` records |
| Test execution runs Vitest suites | Run harness with test_plan, verify `test_results` artifact |
| Mock mode produces valid artifacts without real execution | Run harness with `--llm-mode mock --phase-limit 9` |
| Failure handling presents options on test failure | Force a test failure, verify human gate with options |
| Reasoning Review catches implementation_divergence | Intentionally diverge from ADR, verify quarantine |
| Loop Detection Monitor detects STALLED pattern | Force repeated tool calls, verify Unsticking Agent invocation |

---

## Estimated Scope

| Wave | Files | LoC Estimate | Notes |
|------|-------|--------------|-------|
| Wave 1: Context Payload | 2 new, 1 mod | ~300 | Execution-specific context builder |
| Wave 2: Executor Integration | 2 mod | ~200 | Wire existing AgentInvoker + implement idempotency |
| Wave 3: Execution Trace | 2 mod | ~150 | Ensure all event types captured |
| Wave 4: Test Execution | 1 new, 1 mod | ~250 | Vitest runner integration |
| Wave 5: Evaluation Execution | 1 new, 1 mod | ~200 | Eval runner for functional/quality/reasoning |
| Wave 6: Failure Handling | 1 mod | ~100 | Wire existing UnstickingAgent |
| Wave 7: Reasoning Review | 1 mod | ~100 | Wire existing ReasoningReview |
| Wave 8: Loop Detection | 1 mod | ~100 | Detection logic + UnstickingAgent invocation |
| Wave 9: Test Harness | 2 mod | ~150 | Fixtures + expectations |
| **Total** | **4 new, 9 mod** | **~1,550** |

**Reduced scope** due to existing implementations:
- ReasoningReview: 225 lines already complete
- UnstickingAgent: 208 lines already complete
- ContextBuilder: 451 lines already complete

---

## Implementation Status (Confirmed)

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| **Reasoning Review** | `src/lib/review/reasoningReview.ts` | ✅ **FULLY IMPLEMENTED** (225 lines) | Complete: trace selection, LLM call, flaw parsing, all flaw types |
| **Unsticking Agent** | `src/lib/agents/unstickingAgent.ts` | ✅ **IMPLEMENTED** (208 lines) | Two modes: Socratic + Environmental Detective, Tool Result Misinterpretation detection |
| **Context Builder** | `src/lib/orchestrator/contextBuilder.ts` | ✅ **FULLY IMPLEMENTED** (451 lines) | Two-channel payload (stdin + detail file), token budgeting, trace selection |
| **Refactoring Idempotency** | `src/lib/agents/executorAgent.ts:223` | ⚠️ **STUB** | Returns `'proceed'` default; needs hash verification implementation |

**Conclusion:** 3 of 4 components are production-ready. Only Refactoring Idempotency needs implementation (Wave 2 scope).

---

## Dependencies

- **Phase 6** must produce valid `implementation_plan` artifact
- **Phase 7** must produce valid `test_plan` artifact
- **Phase 8** must produce valid `evaluation_plan` artifacts
- Claude Code CLI must be installed and available in PATH
- Vitest must be installed for test execution
