# Test Strategy Harness — Implementation Strategy & Roadmap

This document outlines the implementation strategy and structured roadmap for the JanumiCode v2 Test Strategy Harness. It seamlessly weaves the 22 core gap mitigations (from GLM 5, Antigravity) with the exact API bindings, schemas, and headless ingress architectures mandated by the final codebase-fidelity review (GPT-5.4).

## Core Principles & Architectural Decisions

1. **Pipeline Fidelity over Spec Adherence**: The CLI uses the canonical `handleUserInput(input, ctx)` path against `ClientLiaisonAgent`.
2. **Context-Aware Mocks (Payload vs Hash)**: Mocks evaluate incoming structured prompt context payloads directly against recorded payloads—not just blind hashes—to genuinely compute token drift distances and enforce structural pipeline integrity.
3. **Governance Lineage is Paramount**: Assertions validate authoritative derivation, decision traces, and monotonic workflow progression in the Governed Stream.
4. **Test Coexistence**: The new test extends `fullPipeline.test.ts` instead of replacing it. Assertions are split broadly into **Hard Failures** (Universal/Corpus-checks) and **Soft Warnings** (Semantic/Length heuristics).
5. **Canonical Identifiers**: A centralized normalizer enforces a unified `X.Y` dotted sub-phase format standard across runtime, configs, and zero-padded fixture string formulations to prevent dictionary miss lookups.

---

## Detailed Implementation Specification

### 1. Identifier Normalization Strategy
All components standardizing IDs use a shared `IdentifierNormalizer` singleton to ensure configurations, runtime phases, and fixture captures don't diverge via dotted (`1.3`), underscored (`1_3`), or padded (`01_3`) variations.

```typescript
class IdentifierNormalizer {
  // Converts "1_3" or "1.3" strictly to canonical runtime format "1.3"
  static toCanonicalSubPhaseId(input: string): string;
  
  // Converts "1.3", "req", 1 to "req__01_3__01"
  static toFixtureKey(agentRole: string, subPhaseId: string, sequence: number): string;
}
```

### 2. Interface Definitions: Pipeline & Gap Reports

```typescript
// Core Runner (Now Expanded to Full Specification)
interface PipelineRunnerConfig {
  workspacePath: string;
  llmMode: 'mock' | 'real';
  autoApprove: boolean;
  phaseLimit?: string;
  fixtureDir: string;
  decisionOverrides?: Record<string, DecisionOverride>;
}

// Harness Configuration overrides keyed by canonical "X.Y"
interface DecisionOverride {
  selection: 'index_0' | 'index_1' | 'index_2' | string;
  rationale?: string;
}

interface HarnessResult {
  status: 'success' | 'failed' | 'partial';
  phasesCompleted: string[];
  phasesFailed: string[];
  artifactsProduced: Record<string, string[]>;
  gapReport?: GapReport;                     // Only populated if failed/partial
  semanticWarnings: SemanticWarning[];       // Always populated with advisory metrics
  durationMs: number;
  governedStreamPath: string;
}

// GAP REPORT TIER (Restored to full detail from v1 spec)
interface GapReport {
  phase: string;
  sub_phase?: string;
  missing_records: string[];                  // expected but absent stream bounds
  schema_violations: SchemaViolation[];       // JSON schema type mismatch list
  assertion_failures: AssertionFailure[];     // Content threshold mapping mismatch
  error?: {
     message: string;
     type: 'not_implemented' | 'schema_error' | 'assertion' | 'llm_error' | 'timeout';
     stack?: string;
  };
  suggested_fix: string;                      // Synthesized AI remedy
  spec_references: SpecReference[];           // Pointers to the standard Hestami Spec bounds
}

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

### 3. Interface Definitions: Fixtures & Mocks

```typescript
interface FixtureFile {
  key: string;                                 // e.g., "requirements_agent__01_1__01"
  agent_role: string;
  sub_phase_id: string;                        // ALWAYS Canonical "1.1" 
  call_sequence: number;
  prompt_template: string;
  prompt_template_hash: string;                // SHA-256 for template staleness checks
  prompt_context_payload: Record<string, any>; // NEW: The actual JSON/Text contexts injected
  response_raw: string;
  response_parsed?: object;
  captured_at: string;
  janumicode_version_sha: string;
  llm_provider: string;
  llm_model: string;
}

// Ensure the real LLM caller knows it has to expose context structured data to the testing layer.
interface LLMCallOptions {
  prompt: string;
  system?: string;
  model: string;
  provider: string;
  semanticKey?: string;
  promptContextPayload?: Record<string, any>;  // Used specifically by MockLLMProvider for drift checks
  phaseContext: string;
}

class MockLLMProvider {
  simulateTokenLimit: number = 128000;
  
  async call(options: LLMCallOptions): Promise<LLMCallResult> {
    const estimatedTokens = Math.ceil(options.prompt.length / 4);
    if (estimatedTokens > this.simulateTokenLimit) {
      throw new SimulatedTokenLimitExceededError(estimatedTokens, this.simulateTokenLimit, options.phaseContext);
    }

    if (options.semanticKey) {
      const fixture = this.fixtures.find(f => f.key === options.semanticKey);
      if (fixture) {
        // Enforce staleness and structured payload divergence
        validateStaleness(fixture); 
        this.validateContextDrift(fixture.prompt_context_payload, options.promptContextPayload);
        return this.buildResult(options, fixture);
      }
    }
    
    // Substring fallback for legacy untested phases
    return this.fallbackSubstringMatch(options.prompt);
  }

  // Drift Algorithm computes exact object property intersection.
  // It converts both payloads into token sets (or recursively checks Jaccard metrics).
  // A Jaccard similarity distance < 0.7 against the canonical context payload throws an Error.
  private validateContextDrift(expected: Record<string, any>, actual?: Record<string, any>): void;
}

class FixtureGenerator {
  // Wraps LLMProviderAdapter inside real-mode. 
  // Intercepts LLM calls, formats the semantic key, extracts the promptContextPayload 
  // and saves the incremental JSON file. Ignores if exact key already exists.
  wrapProvider(provider: LLMProviderAdapter): LLMProviderAdapter;
}
```

### 4. Headless Ingress & Path Resolution Specification

The CLI cannot blindly dump `intent` straight into Phase 1. It must reconstruct `UserInput` to simulate what a Webview provides and feed `ClientLiaisonAgent.handleUserInput`.

```typescript
// Internal CLI bootstrapper executing before Phase 0 officially launches
class HeadlessLiaisonAdapter {
  async bootstrapIntent(intentArg: string, autoApprove: boolean): Promise<LiaisonResult> {
    // 1. Resolve "@filepath" into a Buffer
    const isFile = intentArg.startsWith('@');
    const userPromptText = isFile ? "Execute enclosed document intent" : intentArg;
    
    // 2. Build explicit fake UserInput representing exactly what the frontend DOM emits
    const mockInput: UserInput = {
      text: userPromptText,
      attachments: isFile ? [this.resolveAttachment(intentArg.slice(1))] : []
    };

    // 3. Create mocked VS Code CapabilityContext (no webviews, headless telemetry)
    const mockCtx = this.createHeadlessCapabilityContext(autoApprove);

    // 4. Hook straight into the existing v2 Agent Engine
    const liaison = new ClientLiaisonAgent();
    return liaison.handleUserInput(mockInput, mockCtx);
  }
  
  private resolveAttachment(filepath: string): IntentAttachment;
  private createHeadlessCapabilityContext(autoApprove: boolean): CapabilityContext;
}
```

### 5. Lineage Validation Algorithm

The `LineageValidator` executes after each phase (in `workflowHarness.ts`):

1. **Existence**: Every created `Artifact` inside the database phase slice must have `derived_from_record_ids.length > 0`. (Exception: Phase 0 records derive from `raw_intent`).
2. **Provenance**: Iteratively query those IDs. Verify they point exclusively to artifacts minted in `Phase N - 1`. Check `source_workflow_run_id === currentRunId`.
3. **Monotonic Authority**: Walk the derivation tree depth-first. Ensure the Governed Stream recorded authority level transitions progressively `Exploratory(1) -> Asserted(2) -> HumanApproved(5)`. Regressions throw `LineageViolation`.
4. **Proxy Audit**: If `autoApprove = true`, confirm the stream wrote `decision_trace` records tagged `produced_by_agent_role = "auto_approve_adapter"`, and verify that the `phase_gate_approved` marker directly links derived traces back to that proxy.

### 6. Expected File Structure

**Full Executables & Test Coverage Matrix**
```text
src/
  cli/                                  <-- Restored Full CLI Subsystem
    index.ts
    runner.ts
    autoApproveAdapter.ts
    outputFormatter.ts
    cliLLMResolver.ts
  core/
    pipelineRunner.ts
    headlessLiaisonAdapter.ts           <-- New CLI-to-Engine Bridge
    identifierNormalizer.ts             <-- Unified ID definitions
  test/
    cli/                                <-- Restored CLI CLI Integration
      hestamiCLI.test.ts
      cliSmoke.test.ts
    harness/                            <-- Extended Logic Framework
      workflowHarness.ts
      phaseContracts.ts
      hestamiExpectations.ts
      fixtureGenerator.ts
      gapCollector.ts
      lineageValidator.ts     
      errors.ts               
    suite/
      hestamiProductDescription.test.ts <-- Existing Test File
    fixtures/hestami-product-description/
      manifest.json
      phase_00/
        ...
```

### 7. CI Pipeline Automation Model (Native `pnpm`)

The Gap Report is explicitly output using a secondary CLI step rather than relying on generic Vitest runners which do not possess knowledge of `GapReport` schemas natively.

```yaml
# .github/workflows/test-harness.yaml
name: Test Strategy Harness
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    env:
      CI: 'true'   # Blocks LLM expenditure in GapCollector automatically
    steps:
      - uses: actions/checkout@v4
      - run: corepack enable pnpm
      - run: pnpm install --frozen-lockfile
      
      # Step 1: Run the vitest test suite. This guarantees normal generic regressions.
      - run: pnpm test:harness 
      
      # Step 2: Use the newly minted CLI to do a dedicated headless full-pipeline run, capturing gap reports JSON explicitly.
      - name: Generate Machine Readable Gap Analysis
        if: failure()
        run: pnpm janumicode run --intent '@specs/hestami-ai-real-property-os(2)/Hestami...md' --workspace . --llm-mode mock --auto-approve --gap-report gap-report.json
        
      - name: Upload Core Gap Report Trace
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: gap-report
          path: gap-report.json
```

---

## Roadmap Implementation Waves

* **Phase 0 Audits & Foundations**: Define `identifierNormalizer.ts`. Map `SUB_PHASE_NAMES` cleanly to the domain contracts to solve phase mismatch warnings.
* **Wave 1 - Entrypoints**: Build `headlessLiaisonAdapter.ts` parsing `UserInput`. Build out `src/cli/` routing logic. Wire `pipelineRunner.ts`.
* **Wave 2 - Validation Framework**: Implement Universal assertions (`phaseContracts.ts`, `lineageValidator.ts`). Implement domain assertions (`hestamiExpectations.ts`). Implement SQLite file isolation per test run. Ensure `Hestami` corpus hash verification boots quickly and safely prior to any executions.
* **Wave 3 - Advanced Mock Layer**: Expand `MockLLMProvider` with exact parameter mapping context payload distances (`promptContextPayload`). Stand up the `fixtureGenerator.ts` API. Structure the `manifest.json` schemas for snapshot integrity. Ensure zero rendered strings leak into saved git logs.
* **Wave 4 - AI Gap Safety**: Expand the Gap Report outputs natively matching the complex schemas specified above. Guarantee no AI API keys are spent inadvertently when executing within automated PNPM pipelines. Add `CLI='true'` failsafes.
* **Waves 5 & 6**: Drive coverage iterations sequentially from Phase 2 to Phase 10 while retaining existing generic `completePipeline` scripts intact. Integrate the exact GH Actions YAML hook above.
