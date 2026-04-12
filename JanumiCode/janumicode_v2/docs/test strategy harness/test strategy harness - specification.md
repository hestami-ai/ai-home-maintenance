Now I have everything I need. Let me design the full requirements.

---

# JanumiCode v2 — Test Strategy Harness Requirements

**Version 1.0**

---

## 1. Vision

The test strategy harness transforms JanumiCode v2 development from a human-gated, F5-driven loop into an autonomous, self-reinforcing build cycle. The coding agent runs a single command, receives a structured gap report telling it exactly what is unimplemented and how to implement it, fixes the gap, and runs again. The human intervenes only when the gap collector cannot resolve an ambiguity.

The canonical test scenario — the Hestami AI Real Property OS prompt — exercises every phase of the JanumiCode pipeline against a realistic, multi-domain, multi-pillar product description. The full scope of that document (3 pillars, 12 CAM domains, 9 FSM domains, 709 lines) is what makes it an appropriate end-to-end stress test: if the pipeline handles Hestami correctly, it handles the general case.

---

## 2. Architectural Decision: CLI Interface First

The single largest enabler for automated testing is a **JanumiCode CLI interface** that runs the full pipeline outside the VS Code Extension Host. This is a prerequisite to the test harness, not an output of it.

**Why CLI first:**
- The coding agent can run `janumicode run ...` directly without launching a dev host
- The VS Code Extension Host has ~30s startup and cannot be parallelized
- Future IDE plugins (JetBrains, etc.) need an IDE-agnostic engine
- CI/CD pipelines can integrate directly
- Stop-on-failure + gap reporting work cleanly in a CLI context

The test pyramid is built on top of this foundation:

```
Layer 4: VS Code Extension Host Tests     [deferred — UI rendering, card interactions]
Layer 3: CLI Integration Tests             [Hestami full pipeline via CLI]
Layer 2: Extended In-Process Harness      [multi-phase, mock LLM, fast CI]
Layer 1: Unit Tests                       [orchestrator components, schemas, invariants]
```

---

## 3. Requirements: JanumiCode CLI Interface

### 3.1 Command Specification

```
janumicode run
  --intent <string | @filepath>    Raw Intent string or @path to file
  --workspace <path>               Path to workspace root
  --llm-mode <mock | real>         LLM provider mode (default: mock)
  --auto-approve                   Auto-approve all Phase Gates and Menus
  --stop-on-failure                Stop pipeline at first failing phase (default: true)
  --output-format <json | text>    Output format (default: json)
  --gap-report <filepath>          Write gap report JSON to file
  --fixture-dir <path>             Directory for fixture files (mock mode)
  --capture-fixtures               Capture LLM calls as fixtures (real mode)
  --phase-limit <phase_id>         Run only up to and including this phase
```

**Example invocation for the Hestami test:**
```bash
janumicode run \
  --intent '@specs/hestami-ai-real-property-os(2)/Hestami AI Real Property OS and Platform Product Description.md' \
  --workspace . \
  --llm-mode mock \
  --auto-approve \
  --stop-on-failure \
  --gap-report gap-report.json
```

### 3.2 Exit Codes

| Code | Meaning |
|---|---|
| 0 | All phases completed successfully |
| 1 | Pipeline failed at a phase (phase ID in output) |
| 2 | Configuration error (bad arguments, missing files) |
| 3 | LLM API error not recovered by retry protocol |
| 4 | Schema validation error in produced artifact |

### 3.3 Output Structure — Success

```json
{
  "status": "success",
  "phases_completed": ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
  "artifacts_produced": {
    "0": ["workspace_classification", "collision_risk_report"],
    "1": ["intent_quality_report", "scope_classification", "intent_bloom", "intent_statement"]
  },
  "duration_ms": 45210,
  "governed_stream_path": ".janumicode/governed_stream.db"
}
```

### 3.4 Output Structure — Failure

```json
{
  "status": "failed",
  "failed_at_phase": "2",
  "failed_at_sub_phase": "2.1",
  "phases_completed": ["0", "1"],
  "artifacts_produced": {
    "0": ["workspace_classification", "collision_risk_report"],
    "1": ["intent_quality_report", "scope_classification", "intent_bloom", "intent_statement"]
  },
  "gap_report": {
    "phase": "2",
    "sub_phase": "2.1",
    "missing_records": ["functional_requirements"],
    "schema_violations": [],
    "assertion_failures": [],
    "error": {
      "message": "Phase 2 handler produced empty user_stories array",
      "type": "assertion",
      "stack": "..."
    },
    "suggested_fix": "..."
  },
  "duration_ms": 8430
}
```

### 3.5 Auto-Approve Adapter

The CLI's `--auto-approve` flag injects an `AutoApproveAdapter` that satisfies all human interaction points:

- **Phase Gate approval**: auto-approves with `decision_type: phase_gate_approval`
- **Menu selections**: selects the first option (index 0) unless overridden by a decisions fixture
- **Mirror approval**: auto-approves with `decision_type: mirror_approved`
- **Warning acknowledgment**: bulk-acknowledges all warnings
- **Domain attestation**: auto-confirms with `domain_attestation_confirmed: true`
- **System-Proposed Content**: auto-approves all items

All auto-approvals are recorded in the Governed Stream with `produced_by_agent_role: auto_approve_adapter` so they are auditable.

### 3.6 CLI Entry Point Files

| File | Purpose |
|---|---|
| `src/cli/index.ts` | Entry point, argument parsing |
| `src/cli/runner.ts` | Pipeline execution coordinator |
| `src/cli/autoApproveAdapter.ts` | Auto-approval for test mode |
| `src/cli/outputFormatter.ts` | JSON / text output formatting |
| `src/cli/cliLLMResolver.ts` | Resolves mock vs real LLM provider from args |

**Package.json addition:**
```json
"bin": {
  "janumicode": "./dist/cli/index.js"
}
```

---

## 4. Requirements: Extended In-Process Workflow Harness

### 4.1 Overview

`workflowHarness.ts` extends the existing `workflowDriver.ts` to cover all 11 phases. It is pure in-process (no VS Code API), uses MockLLMProvider, and produces structured gap reports.

### 4.2 Core Harness Interface

```typescript
// src/test/harness/workflowHarness.ts

interface HarnessConfig {
  intent: string;
  workspacePath: string;
  llmMode: 'mock' | 'real';
  fixtureDir?: string;
  captureFixtures?: boolean;
  stopOnFailure?: boolean;       // default: true
  phaseLimit?: string;           // stop after this phase
  autoApprove?: boolean;         // default: true for harness
}

interface HarnessResult {
  status: 'success' | 'failed' | 'partial';
  phasesCompleted: string[];
  phasesFailed: string[];
  artifactsProduced: Record<string, string[]>;
  gapReport?: GapReport;
  durationMs: number;
  governedStreamPath: string;
}

async function runHarness(config: HarnessConfig): Promise<HarnessResult>;
```

### 4.3 Phase Expectations Contract

Each phase has a defined contract specifying what the harness verifies. This is the source of truth for gap detection.

```typescript
// src/test/harness/phaseExpectations.ts

interface SubPhaseExpectation {
  subPhaseId: string;
  requiredRecordTypes: string[];           // must appear in Governed Stream
  requiredArtifactTypes?: string[];        // subset that must be schema-valid Artifacts
  assertions?: ArtifactAssertion[];        // content-level checks
  timeoutMs: number;
}

interface PhaseExpectation {
  phaseId: string;
  phaseName: string;
  subPhases: SubPhaseExpectation[];
  phaseGateCriteria: string[];            // human-readable descriptions
  estimatedDurationMs: number;
}

interface ArtifactAssertion {
  artifactType: string;
  field: string;                           // JSON path
  assertion: 'exists' | 'non_empty' | 'min_count' | 'contains_value' | 'matches_pattern';
  value?: unknown;
  description: string;                     // used in gap report
}
```

### 4.4 Hestami-Specific Phase Expectations

The following contracts are written specifically for the Hestami test case. They encode what "correct" behavior looks like for this input. These are the assertions the harness checks.

#### Phase 0 — Workspace Initialization

| Sub-Phase | Required Records | Assertions |
|---|---|---|
| 0.1 | `workspace_classification` | `type` = `greenfield` (first run); `janumicode_version_sha` populated |
| 0.4 | `collision_risk_report` | `collisions` array exists; at minimum collision on `domain` (Hestami uses "domain", JanumiCode uses `[JC:Software Domain]`) |

**Phase Gate:** Both artifacts schema-valid.

#### Phase 1 — Intent Capture and Convergence

| Sub-Phase | Required Records | Assertions |
|---|---|---|
| 1.0 | `intent_quality_report` | `overall_status` = `requires_input` (Mission is blank, Vision is incomplete); `completeness_findings` contains `mission` and `vision` with `status: absent`; `system_proposal_offered_for` includes both |
| 1.1b | `scope_classification` | `breadth` = `multi_product_ecosystem`; `depth` = `production_grade`; `pillar_count` ≥ 3 |
| 1.2 | `intent_bloom` | `candidate_product_concepts` length ≥ 3; at least one concept covers full OS scope; `system_proposed_content` array non-empty (mission/vision proposals) |
| 1.3 | `mirror_presented`, `decision_trace` | At least one `decision_trace` produced (auto-approve records a trace) |
| 1.4 | `intent_statement` | `product_concept` populated; `confirmed_assumptions` non-empty; `scope_classification_ref` populated; `system_proposed_content_items` — all items `approved: true` (auto-approve elevates all) |
| 1.5 | `phase_gate_approved` | `phase_id` = `1` |

**Phase Gate:** `intent_statement` schema-valid; all System-Proposed Content approved.

#### Phase 2 — Requirements Definition

| Sub-Phase | Required Records | Assertions |
|---|---|---|
| 2.1 | `functional_requirements` | `user_stories` length ≥ 40 (given domain breadth: 12 CAM + 9 FSM + property assistant); at least one user story references `accounting` or `GL`; at least one references `DBOS` or `workflow`; at least one references `violation`; at least one references `ARC`; each user story has ≥ 1 `acceptance_criteria` entry |
| 2.2 | `non_functional_requirements` | `items` length ≥ 5; at least one item `category: security`; at least one item `category: reliability` (DBOS workflow durability); at least one item `category: performance`; at least one item `measurable_criterion` contains a numeric threshold |
| 2.3 | `mirror_presented`, `decision_trace` | At least one `decision_trace` produced |
| 2.4 | `consistency_report` | `overall_pass: true` OR only `severity: warning` findings (no critical failures blocking gate) |
| 2.5 | `phase_gate_approved` | `domain_attestation_confirmed: true` |

**Phase Gate:** `consistency_report` zero critical failures; `domain_attestation_confirmed: true`.

#### Phase 3 — System Specification

| Sub-Phase | Required Records | Assertions |
|---|---|---|
| 3.1 | `system_boundary` | `in_scope` contains references to all 3 pillars; `external_systems` length ≥ 4 (DBOS, payment processor, email/SMS, accounting integration) |
| 3.2 | `system_requirements` | `items` length ≥ 20; each item has `source_requirement_ids` non-empty |
| 3.3 | `interface_contracts` | `contracts` length ≥ 4; each contract has `protocol` and `error_handling_strategy` |
| 3.4 | `mirror_presented` | Exists |
| 3.5 | `consistency_report`, `phase_gate_approved` | Consistency passes |

#### Phase 4 — Architecture Definition

| Sub-Phase | Required Records | Assertions |
|---|---|---|
| 4.1 | `software_domains` | `domains` length ≥ 8 (corresponding to Hestami CDM domains 1–12); each domain has `ubiquitous_language` non-empty |
| 4.2 | `component_model` | `components` length ≥ 10; no Component Responsibility statement contains conjunctions (Invariant check); at least one component references accounting; at least one references workflow/DBOS |
| 4.3 | `architectural_decisions` | `adrs` length ≥ 3; at least one ADR covers workflow orchestration (DBOS); at least one covers data persistence |
| 4.4 | `mirror_presented` | Exists |
| 4.5 | `consistency_report`, `phase_gate_approved` | No `implementability_violation` flaws |

#### Phase 5 — Technical Specification

| Sub-Phase | Required Records | Assertions |
|---|---|---|
| 5.1 | `data_models` | `models` length ≥ 8; at least one model has entity `Association`; at least one has `WorkOrder`; at least one has `JournalEntry` or `GLAccount` |
| 5.2 | `api_definitions` | `definitions` non-empty; every endpoint has authentication requirement (Invariant check) |
| 5.3 | `error_handling_strategies` | `strategies` non-empty |
| 5.4 | `configuration_parameters` | `params` non-empty |
| 5.5 | `mirror_presented` | Exists |
| 5.6 | `consistency_report`, `phase_gate_approved` | Passes |

#### Phase 6 — Implementation Planning

| Sub-Phase | Required Records | Assertions |
|---|---|---|
| 6.1 | `implementation_plan` | `tasks` length ≥ 20; every task has non-empty `completion_criteria` (Invariant check); every task has `component_responsibility` verbatim from `component_model`; no circular dependencies (Invariant check) |
| 6.2 | `mirror_presented` | Exists |
| 6.3 | `phase_gate_approved` | Exists |

#### Phase 7 — Test Planning

| Sub-Phase | Required Records | Assertions |
|---|---|---|
| 7.1 | `test_plan` | Every Acceptance Criterion from `functional_requirements` has ≥ 1 Test Case (Invariant check); every Test Case has ≥ 1 `precondition` (Invariant check) |
| 7.2 | `test_coverage_report` | `coverage_percentage` > 90 |
| 7.3 | `mirror_presented` | Exists |
| 7.4 | `phase_gate_approved` | Exists |

#### Phase 8 — Evaluation Planning

| Sub-Phase | Required Records | Assertions |
|---|---|---|
| 8.1 | `functional_evaluation_plan` | `criteria` non-empty |
| 8.2 | `quality_evaluation_plan` | Every NFR from `non_functional_requirements` has ≥ 1 criterion (Invariant check); every criterion has `evaluation_tool` |
| 8.3 | `reasoning_evaluation_plan` | Exists if product contains AI components (Hestami has AI agents — should exist) |
| 8.4 | `mirror_presented` | Exists |
| 8.5 | `phase_gate_approved` | Exists |

#### Phase 9 — Execution

For the initial harness, Phase 9 assertions are intentionally shallow — actual code execution is out of scope for the happy-path harness.

| Sub-Phase | Required Records | Assertions |
|---|---|---|
| 9.1 | `agent_invocation` records, `file_system_write_record` | At least one implementation task attempted |
| 9.2 | `test_results` | Record exists |
| 9.3 | `evaluation_results` | Record exists |
| 9.5 | `phase_gate_approved` | Exists |

#### Phase 10 — Commit and Deployment Initiation

| Sub-Phase | Required Records | Assertions |
|---|---|---|
| 10.1 | `pre_commit_consistency_report` | `overall_pass: true` |
| 10.2 | `commit_record` | `commit_sha` populated |
| 10.3 | `workflow_run_summary` | `artifacts_produced` non-empty; `completion_timestamp` populated |

---

## 5. Requirements: Fixture System

### 5.1 Semantic Key Format

Each LLM call is identified by a semantic key:

```
{agent_role}__{sub_phase_id}__{call_sequence:02d}
```

Examples:
- `orchestrator__00_4_vocabulary_collision_check__01`
- `domain_interpreter__01_2_intent_domain_bloom__01`
- `requirements_agent__02_1_functional_requirements__01`
- `architecture_agent__04_2_component_decomposition__01`

The call sequence number handles multiple calls to the same sub-phase template within a single run (e.g., a retry after Invariant violation).

### 5.2 Fixture File Structure

```
src/test/fixtures/
  hestami-product-description/
    phase_00/
      orchestrator__00_4_vocabulary_collision_check__01.json
    phase_01/
      orchestrator__01_0_intent_quality_check__01.json
      orchestrator__01_1b_scope_bounding__01.json
      domain_interpreter__01_2_intent_domain_bloom__01.json
      mirror_generator__01_3_mirror_and_menu__01.json
      domain_interpreter__01_4_intent_statement_synthesis__01.json
    phase_02/
      requirements_agent__02_1_functional_requirements__01.json
      requirements_agent__02_2_nonfunctional_requirements__01.json
      mirror_generator__02_3_mirror_and_menu__01.json
      consistency_checker__02_4_consistency_check__01.json
    phase_03/
      [...]
    phase_04/
      [...]
    phase_05/
      [...]
    phase_06/
      [...]
    phase_07/
      [...]
    phase_08/
      [...]
    phase_09/
      [...]
    phase_10/
      [...]
```

### 5.3 Fixture File Schema

```typescript
interface FixtureFile {
  key: string;                    // semantic key
  agent_role: string;
  sub_phase_id: string;
  call_sequence: number;
  prompt_template: string;        // template file path used
  prompt_rendered: string;        // full rendered prompt (for debugging)
  response_raw: string;           // raw LLM response string
  response_parsed?: object;       // parsed JSON artifact (null if parsing failed)
  captured_at: string;            // ISO 8601
  janumicode_version_sha: string;
  llm_provider: string;
  llm_model: string;
}
```

### 5.4 Fixture Generator

```typescript
// src/test/harness/fixtureGenerator.ts

interface FixtureGeneratorConfig {
  outputDir: string;
  overwriteExisting: boolean;     // default: false (incremental capture)
}

class FixtureGenerator {
  // Wraps LLMProviderAdapter — intercepts all calls and saves fixture files
  wrapProvider(provider: LLMProviderAdapter): LLMProviderAdapter;
  
  // Load a single fixture by key
  loadFixture(key: string): FixtureFile | null;
  
  // Load all fixtures from a directory into MockLLMProvider
  loadAllFixtures(dir: string, mockProvider: MockLLMProvider): void;
  
  // Compute the semantic key for a given call context
  computeKey(agentRole: string, subPhaseId: string, callSequence: number): string;
}
```

### 5.5 Fixture Capture Workflow

```bash
# Step 1: Run with real LLM to capture fixtures (one phase at a time as implemented)
JANUMICODE_TEST_LLM_MODE=real \
janumicode run \
  --intent '@specs/hestami-ai-real-property-os(2)/Hestami AI Real Property OS and Platform Product Description.md' \
  --workspace . \
  --capture-fixtures \
  --fixture-dir src/test/fixtures/hestami-product-description \
  --phase-limit 1 \
  --auto-approve

# Step 2: Commit fixtures
git add src/test/fixtures/
git commit -m "test: capture Phase 1 fixtures for Hestami test"

# Step 3: CI and subsequent runs use mock mode
janumicode run --llm-mode mock --fixture-dir src/test/fixtures/hestami-product-description ...
```

**Incremental capture:** The fixture generator does not overwrite existing fixtures by default. Running capture on an already-captured phase is a no-op. This allows fixture capture to advance one phase at a time as implementation progresses.

---

## 6. Requirements: Gap Collector

### 6.1 Gap Report Schema

```typescript
// src/test/harness/gapCollector.ts

interface GapReport {
  phase: string;
  sub_phase?: string;
  missing_records: string[];           // record types expected but not found in Governed Stream
  schema_violations: SchemaViolation[];
  assertion_failures: AssertionFailure[];
  error?: {
    message: string;
    type: 'not_implemented' | 'schema_error' | 'assertion' | 'llm_error' | 'timeout';
    stack?: string;
  };
  suggested_fix: string;               // LLM-generated implementation guidance
  spec_references: SpecReference[];    // pointers to relevant spec sections
}

interface AssertionFailure {
  artifact_type: string;
  field: string;
  assertion: string;
  expected: unknown;
  actual: unknown;
  description: string;
}

interface SpecReference {
  section: string;                     // e.g., "§4 Phase 2 — Requirements Definition"
  artifact_schema?: string;            // e.g., "functional_requirements.schema.json"
  relevant_excerpt?: string;           // brief quote from spec
}
```

### 6.2 LLM-Generated Suggested Fix

When a gap is detected, the gap collector makes a single focused LLM API call to generate the `suggested_fix`. The call receives:

- The gap type and specific failure details
- The relevant Phase specification section from the JanumiCode spec
- The expected artifact schema
- A summary of the current stub implementation (the first 100 lines of the handler file, if it exists)
- The assertion that failed

The prompt instructs the LLM to produce a specific, actionable implementation suggestion — not a general description. For example:

> "Phase 2 Sub-Phase 2.1 handler is producing `user_stories: []`. Implement the functional requirements bloom by: (1) injecting the intent_statement artifact into the requirements agent's Context Payload, (2) calling the LLM with the `phase_02_requirements/sub_phase_02_1_functional_requirements` prompt template, (3) parsing the response into the `functional_requirements` schema, and (4) writing the artifact to the Governed Stream. The handler stub is at `src/phases/phase2Handler.ts`."

The gap collector uses the primary Reasoning Review LLM provider from config for this call. If LLM is unavailable, it falls back to a rule-based suggestion lookup table keyed on `error.type`.

### 6.3 Rule-Based Fallback Table

| Error Type | Fallback Suggestion Template |
|---|---|
| `not_implemented` | "Implement {phase} handler at `src/phases/phase{N}Handler.ts`. Register it in the phase router. The required output artifacts are: {required_artifacts}." |
| `schema_error` | "The artifact `{artifact_type}` produced by {phase} does not match its JSON Schema at `.janumicode/schemas/artifacts/{artifact_type}.schema.json`. Check the field `{field}` — expected type `{expected_type}`." |
| `assertion` | "The assertion `{description}` failed on `{artifact_type}.{field}`. Expected {expected}, got {actual}. Check the prompt template at `.janumicode/prompts/{template_path}`." |
| `llm_error` | "LLM call failed in {phase}. Check that MockLLMProvider has a fixture for key `{expected_key}`. Run with `--capture-fixtures` against real LLM to generate it." |
| `timeout` | "{phase} did not complete within {timeout_ms}ms. The phase handler may be awaiting a response from a stub LLM call or blocking on an unimplemented interaction." |

---

## 7. Requirements: Test Suite Structure

### 7.1 Layer 1 — Unit Tests (existing, extend as needed)

No structural changes to existing unit tests. As new components are implemented (InvariantChecker, ContextBuilder, CLIOutputParser, etc.), corresponding unit tests are added to `src/test/unit/`.

### 7.2 Layer 2 — In-Process Harness Tests (extend existing)

```
src/test/harness/
  workflowHarness.ts          [extend workflowDriver.ts]
  phaseExpectations.ts        [phase contracts — all 11 phases]
  fixtureGenerator.ts         [fixture capture and loading]
  gapCollector.ts             [gap analysis and LLM-generated suggestions]

src/test/suite/
  hestamiProductDescription.test.ts   [canonical Hestami test — one describe block per phase]
```

**Test structure in `hestamiProductDescription.test.ts`:**

```typescript
describe('Hestami Real Property OS — Full Pipeline', () => {
  const CONFIG: HarnessConfig = {
    intent: readFileSync('specs/hestami-ai-real-property-os(2)/Hestami AI Real Property OS and Platform Product Description.md', 'utf-8'),
    workspacePath: resolve(__dirname, '../../test-workspace'),
    llmMode: process.env.JANUMICODE_TEST_LLM_MODE === 'real' ? 'real' : 'mock',
    fixtureDir: resolve(__dirname, '../fixtures/hestami-product-description'),
    stopOnFailure: true,
    autoApprove: true,
  };

  describe('Phase 0: Workspace Initialization', () => {
    it('classifies workspace and produces vocabulary collision report', async () => {
      const result = await runHarness({ ...CONFIG, phaseLimit: '0' });
      expect(result.status).toBe('success');
      expect(result.phasesCompleted).toContain('0');
    });
  });

  describe('Phase 1: Intent Capture and Convergence', () => {
    it('detects missing Mission and Vision, blooms candidates, synthesizes intent', async () => {
      const result = await runHarness({ ...CONFIG, phaseLimit: '1' });
      expect(result.status).toBe('success');
      
      const intentQuality = getArtifact(result, 'intent_quality_report');
      expect(intentQuality.overall_status).toBe('requires_input');
      
      const bloom = getArtifact(result, 'intent_bloom');
      expect(bloom.candidate_product_concepts.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Phase 2: Requirements Definition', () => {
    it('produces ≥40 user stories covering all Hestami domains', async () => {
      const result = await runHarness({ ...CONFIG, phaseLimit: '2' });
      expect(result.status).toBe('success');
      
      const requirements = getArtifact(result, 'functional_requirements');
      expect(requirements.user_stories.length).toBeGreaterThanOrEqual(40);
      
      const hasAccounting = requirements.user_stories.some(s => 
        s.action.toLowerCase().includes('account') || 
        s.action.toLowerCase().includes('gl') ||
        s.action.toLowerCase().includes('assessment')
      );
      expect(hasAccounting).toBe(true);
    });
  });

  // ... continues through Phase 10
});
```

### 7.3 Layer 3 — CLI Integration Tests

```
src/test/cli/
  hestamiCLI.test.ts          [runs janumicode CLI subprocess, checks exit code and output]
  cliSmoke.test.ts             [basic CLI invocation, --help, --version]
```

These tests spawn the `janumicode` CLI as a child process using Node's `child_process.spawn`. They verify the CLI contract — exit codes, JSON output structure, gap report file — independently of the in-process harness.

```typescript
// src/test/cli/hestamiCLI.test.ts

it('Phase 0+1: CLI exits 0 and produces expected artifacts', async () => {
  const result = await spawnCLI([
    'run',
    '--intent', '@specs/hestami-ai-real-property-os(2)/Hestami AI Real Property OS and Platform Product Description.md',
    '--workspace', TEST_WORKSPACE,
    '--llm-mode', 'mock',
    '--fixture-dir', FIXTURE_DIR,
    '--auto-approve',
    '--phase-limit', '1',
    '--output-format', 'json',
  ]);
  
  expect(result.exitCode).toBe(0);
  const output = JSON.parse(result.stdout);
  expect(output.status).toBe('success');
  expect(output.phases_completed).toContain('0');
  expect(output.phases_completed).toContain('1');
});

it('Phase 2 stub: CLI exits 1 with gap report when Phase 2 is not implemented', async () => {
  const result = await spawnCLI([...baseArgs, '--phase-limit', '2', '--gap-report', GAP_REPORT_PATH]);
  
  expect(result.exitCode).toBe(1);
  const gap = JSON.parse(readFileSync(GAP_REPORT_PATH, 'utf-8'));
  expect(gap.failed_at_phase).toBe('2');
  expect(gap.gap_report.missing_records).toContain('functional_requirements');
  expect(gap.gap_report.suggested_fix).toBeTruthy();
});
```

### 7.4 Layer 4 — VS Code Extension Host Tests (deferred)

Existing `extension.smoke.test.ts` is maintained. Full pipeline Extension Host tests are deferred until CLI integration tests confirm the engine works correctly.

---

## 8. Requirements: Test Workspace

The test workspace mirrors the real JanumiCode workspace structure:

```
test-workspace/
  specs/
    hestami-ai-real-property-os(2)/
      Hestami AI Real Property OS and Platform Product Description.md   [real file — committed]
  .janumicode/                    [created by test run, gitignored]
    governed_stream.db
    context/
    schemas/
    prompts/
```

The `.janumicode/` directory is created fresh for each test run. The `specs/` directory contains the actual Hestami document — a committed fixture file. This supports real filesystem debugging when human intervention is needed to diagnose failures.

**Test isolation:** Each harness run uses a unique `workflow_run_id` and a fresh SQLite database at a test-run-specific path (e.g., `.janumicode/test_{run_id}/governed_stream.db`) to prevent test interference.

---

## 9. Implementation Roadmap

### Wave 1 — CLI Interface

**Goal:** `janumicode run` works end-to-end for Phases 0 and 1 in mock mode.

Files to create or modify:
- `src/cli/index.ts`
- `src/cli/runner.ts`
- `src/cli/autoApproveAdapter.ts`
- `src/cli/outputFormatter.ts`
- `src/cli/cliLLMResolver.ts`
- `package.json` — add `bin` entry

**Success criterion:** `janumicode run --intent '...' --llm-mode mock --phase-limit 1 --auto-approve` exits 0 with valid JSON output.

### Wave 2 — Extended Harness + Phase Expectations

**Goal:** In-process harness covers all 11 phases with defined expectations; Hestami test file structure exists; gap collector produces rule-based suggestions.

Files to create:
- `src/test/harness/workflowHarness.ts` (extend existing `workflowDriver.ts`)
- `src/test/harness/phaseExpectations.ts` (all 11 phases per Section 4.4)
- `src/test/harness/gapCollector.ts` (rule-based fallback only)
- `src/test/suite/hestamiProductDescription.test.ts`

**Success criterion:** Running the Hestami test for Phase 2 (stub) produces a gap report with `missing_records: ['functional_requirements']` and a rule-based `suggested_fix`.

### Wave 3 — Fixture System + CLI Integration Tests

**Goal:** Fixture capture works for Phases 0–1; CLI integration tests run in CI.

Files to create:
- `src/test/harness/fixtureGenerator.ts`
- `src/test/cli/hestamiCLI.test.ts`
- `src/test/cli/cliSmoke.test.ts`
- `src/test/fixtures/hestami-product-description/phase_00/*.json`
- `src/test/fixtures/hestami-product-description/phase_01/*.json`

**Success criterion:** `npx vitest run src/test/cli/` passes without real LLM; fixture files committed.

### Wave 4 — LLM-Generated Gap Suggestions

**Goal:** Gap collector makes a focused LLM API call to generate specific implementation guidance.

Files to modify:
- `src/test/harness/gapCollector.ts` — add LLM call

**Success criterion:** Gap report for Phase 2 stub contains a multi-sentence `suggested_fix` that names the specific handler file, prompt template, and artifact schema to implement.

### Wave 5 — Rolling Phase Coverage

**Goal:** As each phase is implemented, fixtures are captured and assertions are verified. The harness reaches Phase 10 as implementation catches up.

This wave has no single deliverable — it is the ongoing state of the harness during active development. Each phase implementation is preceded by its fixture capture run and followed by verifying its harness assertions pass.

### Wave 6 — CI Integration (deferred)

GitHub Actions workflow running `npx vitest run src/test/suite/ src/test/cli/` in mock mode on every PR. Gap report uploaded as a PR artifact. Deferred until Wave 3 is stable.

---

## 10. Success Criteria

| Criterion | Measurement |
|---|---|
| Coding agent can self-verify a phase implementation | Run `janumicode run --phase-limit N --llm-mode mock` — exit 0 means pass |
| Gap report is actionable without human interpretation | `suggested_fix` field names specific files, templates, and schemas to implement |
| Full Phase 0+1 pipeline runs in < 10 seconds | Measured in mock mode via `duration_ms` in CLI output |
| Adding a new phase requires one file change | Add entry to `phaseExpectations.ts` only |
| Fixture capture is incremental | `--capture-fixtures` with existing fixtures does not overwrite |
| Regression detection works | Breaking a Phase 1 implementation causes CLI exit 1 with specific failure details |