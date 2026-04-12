# Test Strategy Harness — Implementation Strategy & Roadmap

This document outlines the implementation strategy and structured roadmap for the JanumiCode v2 Test Strategy Harness, integrating the 22 mitigations derived from critical reviews, and providing the detailed implementation specifications (interfaces, algorithms) necessary for execution without developer guesswork.

## Core Principles & Architectural Decisions

1. **Pipeline Fidelity over Spec Adherence**: The CLI and test harness will use the canonical `ClientLiaisonAgent` path and adhere strictly to `records.ts:SUB_PHASE_NAMES`. 
2. **Context-Aware Mocks**: Mocks will evaluate incoming prompt context signatures to enforce structural integrity during test runs.
3. **Governance Lineage is Paramount**: Assertions must validate authority derivation, decision traces, and monotonic workflow progression in the Governed Stream.
4. **Test Coexistence (Option B)**: The new `hestamiProductDescription` test suite will **extend** the existing pipeline tests (`fullPipeline.test.ts` and `completePipeline.test.ts`) rather than replace them.
5. **Assertion Tiers**: Assertions are split into **Hard Failures** for universal/corpus-locked rules and **Soft Warnings** for subjective semantic validations.

---

## Detailed Implementation Specification

### 1. Interface Definitions

```typescript
// Pipeline Core
interface PipelineRunnerConfig {
  workspacePath: string;
  llmMode: 'mock' | 'real';
  autoApprove: boolean;
  phaseLimit?: string;
}

interface PipelineRunnerResult {
  status: 'success' | 'failed' | 'partial';
  runId: string;
  phasesCompleted: string[];
  durationMs: number;
  artifactsProduced: Record<string, string[]>;
}

// Lineage Validation
interface LineageValidationResult {
  valid: boolean;
  violations: LineageViolation[];
}

interface LineageViolation {
  record_id: string;
  violation_type: 'missing_derived_from' | 'wrong_workflow_run' | 'authority_regression' | 'missing_decision_trace';
  expected: string;
  actual: string;
}

// Fixtures
interface FixtureFile {
  key: string;  // e.g., "requirements_agent__02_1__01"
  agent_role: string;
  sub_phase_id: string;
  call_sequence: number;
  prompt_template: string;
  prompt_template_hash: string;   // SHA-256 of template file
  prompt_context_hash: string;    // SHA-256 of critical input variables
  response_raw: string;
  response_parsed?: object;
  captured_at: string;
  janumicode_version_sha: string;
  llm_provider: string;
  llm_model: string;
}

// Harness Configuration & Overrides
interface HarnessConfig extends PipelineRunnerConfig {
  fixtureDir: string;
  decisionOverrides?: Record<string, DecisionOverride>;
}

interface DecisionOverride {
  selection: 'index_0' | 'index_1' | 'index_2' | string;
  rationale?: string;
}

// Gap Reporting
interface GapReport {
  phase: string;
  subPhase?: string;
  errorType: 'llm_error' | 'timeout' | 'missing_records' | 'schema_error' | 'assertion';
  message: string;
  context: GapErrorContext;
}

interface GapErrorContext {
  handlerMissing: boolean;
  handlerPath: string;
  relevantCodeSnippet?: string;
  failureLine?: number;
}

// Semantic Warnings
interface SemanticWarning {
  phase: string;
  subPhase: string;
  artifactType: string;
  field: string;
  assertion: string;
  actual: unknown;
  severity: 'advisory';
}
```

### 2. Algorithm Specifications

- **`prompt_context_hash` computation**: Extract all parsed JSON artifacts injected into the prompt payload (ignoring template scaffolding text). Stringify these artifacts deterministically (e.g., sorted keys) and compute a SHA-256 hash.
- **Token approximation formula**: `estimatedTokens = Math.ceil(prompt.length / 4)`
- **Context drift detection**: Jaccard distance between the token sets of the recorded `prompt_context_hash` contents and the incoming context. Threshold > `0.3` triggers a `FixtureContextDriftError`.
- **Lineage validation**: 
  1. For every artifact, assert `derived_from_record_ids.length > 0`.
  2. For every artifact, assert `source_workflow_run_id === currentRunId`.
  3. Traverse workflow lineage to ensure authority strictly progresses or remains equal (e.g., Level `1` -> `2` -> `5`; regression throws error).
  4. Find `phase_gate_approved` records and verify existence of a chronologically preceding `decision_trace`.
- **Error classification decision tree**:
  ```typescript
  function classifyError(error: unknown, stream: GovernedStream, phaseId: string): ErrorType {
    if (error instanceof LLMError) return 'llm_error';
    if (error instanceof TimeoutError) return 'timeout';
    if (missingRecords(stream, phaseId)) return 'missing_records';
    if (schemaViolations(stream, phaseId)) return 'schema_error';
    if (assertionFailures(stream, phaseId)) return 'assertion';
    return 'unknown';
  }
  ```

### 3. Error Class Hierarchy (in `src/test/harness/errors.ts`)

```typescript
class FixtureContextDriftError extends Error {
  constructor(public fixtureKey: string, public expectedHash: string, public actualHash: string, public driftScore: number) { super(); }
}

class CorpusDriftError extends Error {
  constructor(public expectedSha: string, public actualSha: string, public expectedLineCount: number, public actualLineCount: number) { super(); }
}

class SimulatedTokenLimitExceededError extends Error {
  constructor(public estimatedTokens: number, public limit: number, public phase: string) { super(); }
}

class FixtureStalenessError extends Error {
  constructor(public fixtureKey: string, public expectedTemplateHash: string, public actualTemplateHash: string) { super(); }
}
```

### 4. Headless Ingress Specification

```typescript
interface HeadlessLiaisonConfig {
  intent: { type: 'file_reference'; path: string } | string;
  autoApprove: boolean;
  decisionOverrides?: Record<string, DecisionOverride>;
}

class ClientLiaisonAgent {
  // Existing interactive method
  async handleUserMessage(message: string, context: ExtensionContext): Promise<void>;
  
  // New headless execution for CLI/Test routing
  async processHeadlessIntent(config: HeadlessLiaisonConfig): Promise<void> {
     // 1. Resolve @filepath if needed.
     // 2. Classify intent.
     // 3. Kickstart workflow orchestrator without webview UI events.
  }
}
```

### 5. MockLLMProvider Integration

```typescript
class MockLLMProvider {
  async call(options: LLMCallOptions): Promise<LLMCallResult> {
    // 1. Token limit simulation
    const estimatedTokens = Math.ceil(options.prompt.length / 4);
    if (estimatedTokens > this.simulateTokenLimit) {
      throw new SimulatedTokenLimitExceededError(estimatedTokens, this.simulateTokenLimit, options.phaseContext);
    }

    // 2. Exact Semantic Key match (preferred)
    if (options.semanticKey) {
      const fixture = this.fixtures.find(f => f.key === options.semanticKey);
      if (fixture) {
        // 3. Detect Staleness and Context Drift
        validateStaleness(fixture); 
        validateContextDrift(fixture, options.prompt);
        return this.buildResult(options, fixture);
      }
    }
    
    // 4. Substring fallback for legacy Phase 0/1 mocks
    return this.fallbackSubstringMatch(options.prompt);
  }
}
```

### 6. File Structure & Manifests

**TypeScript Files**
```text
src/
  core/
    pipelineRunner.ts
  test/harness/
    workflowHarness.ts
    phaseContracts.ts
    hestamiExpectations.ts
    fixtureGenerator.ts
    gapCollector.ts
    lineageValidator.ts     (Added per architecture review)
    errors.ts               (Added per architecture review)
  test/suite/
    hestamiProductDescription.test.ts
```

**Fixture Layout**
```text
src/test/fixtures/hestami-product-description/
  manifest.json
  phase_01/
    orchestrator__01_0__01.json
```

**Manifest Schema (`manifest.json`)**
```json
{
  "corpus_sha": "abc123456789...",
  "corpus_line_count": 708,
  "fixture_version": "1.0.0"
}
```

### 7. CI Integration

**GitHub Actions Workflow (`.github/workflows/test-harness.yaml`)**
```yaml
name: Test Strategy Harness
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    env:
      CI: 'true'   # Guards LLM gap collector calls automatically
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx vitest run src/test/suite/hestamiProductDescription.test.ts --reporter=json --outputFile=gap-report.json
      - name: Upload gap report
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: gap-report
          path: gap-report.json
```

### 8. Specific Implementation Details

- **Corpus Version Lock Check**: Implemented in test startup hook (`beforeAll` in `hestamiProductDescription.test.ts`). Reads the exact Hestami markdown file, computes `sha256`, and compares it to `manifest.json`. Triggers `CorpusDriftError` immediately if drifting to halt test suite instantly.
- **Decision Overrides**: The auto-approve adapter polls `decisionOverrides[sub_phase_id]`. If present, it executes the explicit `index_X` choice; otherwise, bounds to `index_0`.
- **Phase 10 Integrity Verification**: 
  ```typescript
  async function verifyCommitSha(sha: string, workspacePath: string): Promise<boolean> {
    try {
       // Requires git to be installed on runner. Non-git environments will throw and fail.
       const { stdout } = await exec(`git -C ${workspacePath} cat-file -t ${sha}`);
       return stdout.trim() === 'commit';
    } catch { return false; }
  }
  ```

---

## Roadmap Phases (Updated)

* **Phase 0**: Audit sub-phase IDs & define headless ingress (`processHeadlessIntent`).
* **Wave 1**: Build `pipelineRunner.ts`, CLI wrapper, update `LLMCallOptions` w/ keys.
* **Wave 2**: Implement Universal Contracts (`phaseContracts.ts`, `lineageValidator.ts`), Domain Contracts (`hestamiExpectations.ts`), test isolation, and `CorpusDriftError` checks.
* **Wave 3**: Extend `MockLLMProvider` w/ token limits and context drift hashing. Implement custom `errors.ts` and structured `/fixtures/manifest.json`. Remove `prompt_rendered` bloat.
* **Wave 4**: Enact the Gap Report decision tree, `GapErrorContext` parsing logic, and `CI='true'` cost safeguards.
* **Waves 5 & 6**: Rolling coverage extension and GitHub Actions pipeline hookups.
