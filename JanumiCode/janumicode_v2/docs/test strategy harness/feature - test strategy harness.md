# Test Strategy Harness for JanumiCode v2

Plan to build a comprehensive test harness that both drives development (TDD/BDD) and catches regressions automatically.

## Summary

Create a multi-phase workflow test harness that exercises the full pipeline from intent submission through all phases, using mock LLM by default for fast CI runs and real Ollama optionally for local debugging.

---

## The Challenge: Manual Testing Bottleneck

### Current Development Workflow

The primary development loop for JanumiCode v2 is:

1. **F5 in VS Code** - Launch Extension Development Host
2. **Run the test prompt**: 
   ```
   Review "specs/hestami-ai-real-property-os(2)/Hestami AI Real Property OS and Platform Product Description.md" and prepare for implementation.
   ```
3. **Watch the phases execute** - Or more likely, watch it fail at the next unimplemented feature
4. **Fix the issue** - Edit code, rebuild
5. **Repeat** - F5 again, run prompt again

This cycle takes **30-60 seconds per iteration** even when nothing is broken, and **minutes** when there's an error to debug. The coding agent (Cascade/Claude) cannot participate in this loop - it requires human intervention to run the dev host and observe results.

### Why This Is Slow

| Problem | Impact |
|---------|--------|
| No automated full-pipeline test | Each manual run discovers one issue |
| Coding agent can't run dev host | Agent can't self-verify changes |
| No fixture capture/playback | Real LLM calls are slow and non-deterministic |
| No gap reporting | Agent doesn't know what's missing without human telling it |
| Phase handlers are stubs | Many phases write empty artifacts and skip real work |

---

## Current Test Infrastructure

### What Exists

| Layer | File | Purpose | Status |
|-------|------|---------|--------|
| **Layer A** | `src/test/helpers/workflowDriver.ts` | In-process workflow harness with mock LLM | **Working** - drives Phase 0 + Phase 1 |
| **Layer A Tests** | `src/test/unit/integration/workflowDriver.test.ts` | Regression tests for harness itself | **Working** - 7 tests |
| **Layer B** | `src/test/unit/webview/cards/*.test.ts` | Svelte component DOM tests | **Partial** - smoke tests only |
| **Layer C** | `src/test/e2e/suite/extension.smoke.test.ts` | VS Code Extension Host tests | **Working** - basic activation |
| **Unit Tests** | `src/test/unit/orchestrator/*.test.ts` | Engine component tests | **Working** - 30+ tests |

### What's Missing

1. **No multi-phase test** - Existing harness only covers Phase 0 + Phase 1
2. **No real-world test case** - No test that mirrors the manual "Hestami Product Description" prompt
3. **No fixture library** - Mock LLM fixtures exist for Phase 1 only
4. **No gap collector** - Failures produce stack traces, not actionable gap reports
5. **No CI integration** - Tests run locally, not in automated pipeline

---

## The Test Prompt: End-to-End Walkthrough

### The Prompt

```
Review "specs/hestami-ai-real-property-os(2)/Hestami AI Real Property OS and Platform Product Description.md" 
and prepare for implementation.
```

### What This Prompt Triggers

When a user submits this prompt in the JanumiCode sidebar, the following **11-phase workflow** should execute:

---

#### **Phase 0: Workspace Initialization**

| Sub-Phase | Action | Expected Output |
|-----------|--------|-----------------|
| 0.1 | Classify workspace (greenfield vs brownfield) | `workspace_classification` artifact |
| 0.2 | *(brownfield only)* Ingest existing artifacts | `ingested_artifact_index` |
| 0.2b | *(brownfield only)* Brownfield continuity check | `prior_decision_summary` |
| 0.3 | *(brownfield only)* Ingestion review | `ingestion_conflict_list` |
| 0.4 | Vocabulary collision check | `collision_risk_report` |

**Phase Gate**: All artifacts schema-valid, vocabulary check passed

**Current Status**: **Working** - Phase 0 handler implemented and tested

---

#### **Phase 0.5: Cross-Run Impact Analysis** *(conditional)*

Only runs if Phase 1 detects prior decision overrides.

| Sub-Phase | Action | Expected Output |
|-----------|--------|-----------------|
| 0.5.1 | Impact enumeration | `impact_enumeration` |
| 0.5.2 | Refactoring decision | `refactoring_scope` |

**Current Status**: **Stub** - Handler exists but produces empty artifacts

---

#### **Phase 1: Intent Capture and Convergence**

| Sub-Phase | Action | Expected Output |
|-----------|--------|-----------------|
| 1.0 | Intent quality check | `intent_quality_report` |
| 1.1b | Scope classification | `scope_classification` |
| 1.2 | Intent domain bloom (expand to candidate concepts) | `intent_bloom` with candidate_product_concepts |
| 1.3 | Mirror + Menu (prune candidates) | `mirror_presented`, `menu_presented`, decision traces |
| 1.4 | Intent statement synthesis | `intent_statement` |
| 1.5 | Intent statement approval (mirror + human decision) | `phase_gate_approved` |

**For the Hestami prompt**, Phase 1 should:
- Read the attached spec file (709 lines, 12 domains, 3 pillars)
- Bloom into candidate product concepts (e.g., "HOA Management System", "Property Maintenance Tracker", "Full Real Property OS")
- Present a menu to prune/select the target concept
- Synthesize into an `intent_statement` with confirmed assumptions/constraints

**Current Status**: **Working** - Phase 1 handler implemented with real LLM calls

---

#### **Phase 2: Requirements Definition**

| Sub-Phase | Action | Expected Output |
|-----------|--------|-----------------|
| 2.1 | Functional requirements bloom | `functional_requirements` with user_stories |
| 2.2 | Non-functional requirements bloom | `non_functional_requirements` |
| 2.3 | Requirements mirror + menu | `mirror_presented`, decision traces |
| 2.4 | Requirements consistency check | `consistency_report` |
| 2.5 | Requirements approval with domain attestation | `phase_gate_approved` with `domain_attestation_confirmed: true` |

**For the Hestami prompt**, Phase 2 should:
- Derive user stories from the intent statement
- Map to the 12 domains defined in the spec (Accounting, Workflow, Violations, etc.)
- Generate acceptance criteria for each user story
- Check consistency across requirements

**Current Status**: **Stub** - Handler writes empty `user_stories: []`, no real LLM calls

---

#### **Phase 3: System Specification**

| Sub-Phase | Action | Expected Output |
|-----------|--------|-----------------|
| 3.1 | System boundary definition | `system_boundary` |
| 3.2 | External systems specification | `external_systems` |
| 3.3 | Interface contracts | `interface_contracts` |
| 3.4 | System requirements synthesis | `system_requirements` |

**Current Status**: **Stub** - Handler skeleton only

---

#### **Phase 4: Architecture Definition**

| Sub-Phase | Action | Expected Output |
|-----------|--------|-----------------|
| 4.1 | Architectural bloom | `architectural_bloom` with candidate architectures |
| 4.2 | Component model | `component_model` |
| 4.3 | Architecture decisions | `architectural_decisions` |
| 4.4 | Architecture consistency check | `consistency_report` |

**Current Status**: **Stub** - Handler skeleton only

---

#### **Phase 5: Technical Specification**

| Sub-Phase | Action | Expected Output |
|-----------|--------|-----------------|
| 5.1 | Data model specification | `data_models` |
| 5.2 | API definition | `api_definitions` |
| 5.3 | Error handling strategy | `error_handling_strategies` |
| 5.4 | Configuration parameters | `configuration_parameters` |

**Current Status**: **Stub** - Handler skeleton only

---

#### **Phase 6: Implementation Planning**

| Sub-Phase | Action | Expected Output |
|-----------|--------|-----------------|
| 6.1 | Implementation task decomposition | `implementation_plan` with task graph |
| 6.2 | Implementation plan mirror + menu | `mirror_presented`, decision traces |
| 6.3 | Approval | `phase_gate_approved` |

**Current Status**: **Stub** - Handler skeleton only

---

#### **Phase 7: Test Planning**

| Sub-Phase | Action | Expected Output |
|-----------|--------|-----------------|
| 7.1 | Test case generation | `test_plan` with test cases per acceptance criterion |
| 7.2 | Test coverage analysis | `test_coverage_report` |
| 7.3 | Test plan mirror + menu | `mirror_presented` |
| 7.4 | Approval | `phase_gate_approved` |

**Current Status**: **Stub** - Handler skeleton only

---

#### **Phase 8: Evaluation Planning**

| Sub-Phase | Action | Expected Output |
|-----------|--------|-----------------|
| 8.1 | Functional evaluation design | `functional_evaluation_plan` |
| 8.2 | Quality evaluation design | `quality_evaluation_plan` |
| 8.3 | Reasoning evaluation design | `reasoning_evaluation_plan` |
| 8.4 | Evaluation plan mirror + menu | `mirror_presented` |
| 8.5 | Approval | `phase_gate_approved` |

**Current Status**: **Stub** - Handler skeleton only

---

#### **Phase 9: Execution**

| Sub-Phase | Action | Expected Output |
|-----------|--------|-----------------|
| 9.1 | Implementation task execution | `execution_trace` per task, code artifacts |
| 9.2 | Test execution | `test_results` |
| 9.3 | Evaluation execution | `evaluation_results` |
| 9.4 | Failure handling | `failure_report` if any |
| 9.5 | Completion approval | `phase_gate_approved` |

**Current Status**: **Stub** - Handler writes empty `tasks_attempted: 0`

---

#### **Phase 10: Commit and Deployment Initiation**

| Sub-Phase | Action | Expected Output |
|-----------|--------|-----------------|
| 10.1 | Pre-commit verification | `pre_commit_verification` |
| 10.2 | Commit execution | `commit_record` |
| 10.3 | Deployment initiation | `deployment_initiation` |

**Current Status**: **Stub** - Handler skeleton only

---

### What Actually Happens Today

When you run the test prompt today:

1. **Phase 0** - Works, classifies workspace
2. **Phase 1** - Works, produces bloom + intent statement
3. **Phase 2** - **Fails or produces empty artifacts** - `user_stories: []`
4. **Phases 3-10** - **Not reached** or produce stub artifacts

The manual testing cycle discovers **one issue at a time**, requiring human observation and intervention at each step.

---

## User Requirements

| Requirement | Choice |
|------------|--------|
| Primary goal | **Both** regression + development guidance |
| LLM mode | **Hybrid** - mock for CI, real LLM optional |
| Failure handling | **Stop at first failure** - focused debugging |
| Output format | **Pass/fail with stack traces** |

---

## Architecture Overview

```
                    Test Strategy Harness
                           |
         +-----------------+-----------------+
         |                 |                 |
    Layer A           Layer B            Layer C
  (Unit Tests)    (Integration)    (E2E Extension)
         |                 |                 |
   Mock LLM           Mock LLM         Real VS Code
   < 1s/run          < 5s/run          ~30s/run
         |                 |                 |
   Engine only       Full workflow      UI + Extension
   (no DB I/O)       (in-memory DB)    (sidecar DB)
```

---

## Layer 1: Phase-by-Phase Test Suite

### 1.1 Test Structure

```
src/test/
  harness/
    workflowHarness.ts        # Core harness driver
    fixtureGenerator.ts       # Auto-generate mock fixtures from real LLM calls
    phaseExpectations.ts      # Expected outputs per phase
    gapCollector.ts           # Collect implementation gaps
  suite/
    phase0.test.ts            # Phase 0 tests
    phase1.test.ts            # Phase 1 tests  
    phase2.test.ts            # Phase 2 tests (when implemented)
    ...
    fullPipeline.test.ts      # End-to-end workflow test
```

### 1.2 WorkflowHarness API

```typescript
interface HarnessConfig {
  intent: string;                    // User prompt
  workspacePath?: string;            // Test workspace with specs
  llmMode: 'mock' | 'real';          // Mock for CI, real for debugging
  stopOnFailure: boolean;            // Default true
  fixtureOverrides?: Record<string, MockFixture>;
  phaseTimeout?: number;             // Default 30000ms per phase
}

interface HarnessResult {
  success: boolean;
  phasesCompleted: PhaseId[];
  failedAt?: {
    phase: PhaseId;
    subPhase?: string;
    error: Error;
    records: SerializedRecord[];     // Records produced before failure
    events: CapturedEvent[];         // Events fired before failure
  };
  duration: number;
  records: SerializedRecord[];
  events: CapturedEvent[];
}

async function runHarness(config: HarnessConfig): Promise<HarnessResult>;
```

### 1.3 Phase Expectations

Each phase has a contract that the harness validates:

```typescript
// src/test/harness/phaseExpectations.ts

const PHASE_EXPECTATIONS: Record<PhaseId, PhaseExpectation> = {
  '0': {
    requiredRecords: [
      'workflow_initiated',
      'workspace_classification',
    ],
    requiredEvents: ['phase:started', 'phase:completed'],
    phaseGateRecords: ['phase_gate_approved'],
    timeout: 5000,
  },
  '1': {
    requiredRecords: [
      'raw_intent_received',
      'intent_quality_report',
      'intent_domain_bloom',
      'mirror_presented',      // Bloom mirror
      'menu_presented',        // Prune menu
      'intent_statement',
    ],
    requiredEvents: [
      'phase:started',
      'mirror:presented',
      'menu:presented',
      'phase_gate:pending',
    ],
    phaseGateRecords: ['phase_gate_approved'],
    timeout: 30000,
  },
  '2': {
    // Requirements Definition
    requiredRecords: [
      'functional_requirements',
      'non_functional_requirements',
      'mirror_presented',
    ],
    // ...
  },
  // ... phases 3-10
};
```

---

## Layer 2: Hestami Product Description Test

### 2.1 The "Real World" Test Case

The harness includes a dedicated test that mirrors your manual testing workflow:

```typescript
// src/test/suite/hestamiProductDescription.test.ts

describe('Hestami Real Property OS - Full Pipeline', () => {
  const WORKSPACE = 'test-workspace/specs/hestami-ai-real-property-os(2)';
  const INTENT = `Review "specs/hestami-ai-real-property-os(2)/Hestami AI Real Property OS and Platform Product Description.md" and prepare for implementation.`;

  it('Phase 0: Workspace classification succeeds', async () => {
    const result = await runHarness({
      intent: INTENT,
      workspacePath: WORKSPACE,
      llmMode: 'mock',
      stopOnFailure: true,
    });
    
    expect(result.phasesCompleted).toContain('0');
    expect(result.failedAt).toBeUndefined();
  });

  it('Phase 1: Intent capture produces bloom and synthesis', async () => {
    // ... continues from Phase 0
  });

  // One test per phase until the full pipeline works
});
```

### 2.2 Fixture Generation

To support mock mode, we need fixtures for each LLM call. The harness includes a fixture generator:

```typescript
// src/test/harness/fixtureGenerator.ts

interface FixtureCapture {
  prompt: string;           // Rendered prompt template
  response: string;         // Raw LLM response
  parsedJson?: object;      // Parsed JSON if applicable
  phase: PhaseId;
  subPhase: string;
  templateName: string;
}

async function captureRealLLMCall(config: HarnessConfig): Promise<FixtureCapture[]>;

// Usage: Run once with real LLM, save fixtures for CI
// npx vitest run --capture-fixtures src/test/suite/hestamiProductDescription.test.ts
```

---

## Layer 3: Gap Collector for Development Guidance

### 3.1 Gap Report Structure

When a phase fails, the harness produces a structured gap report:

```typescript
interface GapReport {
  phase: PhaseId;
  subPhase?: string;
  missingRecords: string[];      // Expected record types not produced
  missingEvents: string[];       // Expected events not fired
  error?: {
    message: string;
    stack: string;
    type: 'not_implemented' | 'schema_error' | 'llm_error' | 'assertion';
  };
  suggestedFix?: string;         // AI-generated suggestion
}
```

### 3.2 Integration with Coding Agent

The harness outputs a machine-readable JSON report that the coding agent can consume:

```bash
# Run harness and output JSON report
npx vitest run --reporter=json --outputFile=gap-report.json

# Gap report structure:
{
  "summary": {
    "phasesPassed": ["0", "1"],
    "phasesFailed": ["2"],
    "totalGaps": 3
  },
  "gaps": [
    {
      "phase": "2",
      "subPhase": "2.1",
      "missingRecords": ["functional_requirements"],
      "error": {
        "message": "Phase 2 handler not registered",
        "type": "not_implemented"
      },
      "suggestedFix": "Implement Phase2Handler and register in engine"
    }
  ]
}
```

---

## Layer 4: Hybrid LLM Mode

### 4.1 Mock Mode (Default for CI)

```typescript
// Mock fixtures are loaded from JSON files
const fixtures = await loadFixtures('fixtures/hestami-product-description/');
const mockLLM = new MockLLMProvider();
for (const [key, fixture] of Object.entries(fixtures)) {
  mockLLM.setFixture(key, fixture);
}
```

### 4.2 Real LLM Mode (Optional for Debugging)

```typescript
// Environment variable to enable real LLM
const llmMode = process.env.JANUMICODE_TEST_LLM_MODE ?? 'mock';

if (llmMode === 'real') {
  // Requires Ollama running with qwen3.5:9b
  config.llmMode = 'real';
}
```

### 4.3 Fixture Capture Workflow

```bash
# Step 1: Capture fixtures from real LLM run
JANUMICODE_TEST_LLM_MODE=real npx vitest run --capture-fixtures

# Step 2: Commit fixtures to repo
git add src/test/fixtures/

# Step 3: CI runs with mock fixtures (fast, deterministic)
npx vitest run
```

---

## Implementation Plan

### Phase 1: Core Harness (Wave 1)

1. **Create `workflowHarness.ts`**
   - Extend existing `workflowDriver.ts`
   - Add phase-by-phase validation
   - Add stop-on-failure logic
   - Add gap collection

2. **Create `phaseExpectations.ts`**
   - Define required records/events per phase
   - Define timeout per phase
   - Define phase gate criteria

3. **Create `hestamiProductDescription.test.ts`**
   - Single test case for Phase 0
   - Expand to Phase 1 as implementation progresses

### Phase 2: Fixture System (Wave 2)

1. **Create `fixtureGenerator.ts`**
   - Capture real LLM calls
   - Save to JSON files
   - Load fixtures for mock mode

2. **Create fixture files**
   - `src/test/fixtures/hestami-product-description/`
   - One JSON file per LLM call

### Phase 3: Gap Reporting (Wave 3)

1. **Create `gapCollector.ts`**
   - Parse failure errors
   - Generate gap reports
   - Suggest fixes

2. **Integrate with vitest**
   - Custom JSON reporter
   - Machine-readable output

### [DEFRRED] Phase 4: CI Integration (Wave 4)

1. **GitHub Actions workflow**
   - Run on every PR
   - Mock mode (fast)
   - Upload gap reports as artifacts

2. **Pre-commit hook**
   - Run relevant tests before commit
   - Fast feedback loop

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/test/harness/workflowHarness.ts` | Core harness driver |
| `src/test/harness/phaseExpectations.ts` | Per-phase contracts |
| `src/test/harness/fixtureGenerator.ts` | Capture/load fixtures |
| `src/test/harness/gapCollector.ts` | Gap analysis |
| `src/test/suite/hestamiProductDescription.test.ts` | Real-world test case |
| `src/test/fixtures/hestami-product-description/*.json` | Mock fixtures |

---

## Success Criteria

1. **Development velocity**: Coding agent can run harness and get actionable gap report in < 10s
2. **Regression detection**: CI catches any phase breakage automatically
3. **Coverage**: All 11 phases have test coverage when fully implemented
4. **Maintainability**: Adding new phases requires only updating `phaseExpectations.ts`
