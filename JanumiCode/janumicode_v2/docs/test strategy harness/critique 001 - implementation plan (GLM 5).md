# Implementation Plan Critique

Critical analysis of "Test Strategy Harness - Implementation Strategy & Roadmap (First Proposal)" against the feature description, specification, three critiques, and responses.

## Guiding Principle

**Goal: 100% complete and 100% correct to intent and implementation.** The implementation plan must provide sufficient detail that a developer can implement without guessing, inferring, or making architectural decisions during implementation.

## Summary

The implementation plan **correctly incorporates all 22 mitigations** from the critiques but **lacks implementation detail in 14 critical areas**. Without these details, developers will need to make assumptions during implementation, which will lead to inconsistencies, rework, or subtle bugs that pass tests but violate intent.

---

## 1. Mitigation Coverage: Complete

The plan correctly addresses all 22 mitigations:

| # | Mitigation | Plan Coverage |
|---|------------|---------------|
| 1 | Shared `pipelineRunner.ts` | Wave 1: "Shared Pipeline Runner" |
| 2 | CLI through `ClientLiaisonAgent` | Phase 0: "Headless Ingress Support"; Wave 1: "Authentic CLI Ingress" |
| 3 | Sub-phase IDs match `records.ts` | Phase 0: "Sub-phase Synchronization" |
| 4 | Governed Stream lineage checks | Wave 2: "LineageValidator" |
| 5 | Prompt context drift detection | Wave 3: "False-Positive Prevention" |
| 6 | `semanticKey` field | Wave 1: "LLMCallOptions Enrichment" |
| 7 | Universal vs domain contracts | Wave 2: "Universal Phase Contracts" + "Hestami Domain Contracts" |
| 8 | Decision overrides | Wave 3: "Menu Determinism" |
| 9 | Fixture staleness | Wave 3: "Fixture Staleness Detection" |
| 10 | Simulated token limits | Wave 3: "Token Limit Safeguards" |
| 11 | Test isolation | Wave 2: "Test Isolation" |
| 12 | Error classification | Wave 4: "Rigid Error Decision Tree" |
| 13 | `GapErrorContext` | Wave 4: "Gap Error Context Extractor" |
| 14 | CI cost guard | Wave 4: "CI Spend & Execution Guards" |
| 15 | Semantic assertions as warnings | Wave 2: "Soften subjective metrics... into `semantic_warnings`" |
| 16 | Corpus version lock | Wave 2: "Corpus Version Lock" |
| 17 | `prompt_rendered` not committed | Wave 3: "Repo Hygiene" |
| 18 | Auto-approve trace format | Wave 1: "Auto-Approve Tracing" |
| 19 | Phase 10 commit SHA verification | Wave 5&6: "Phase 10 Integrity Check" |
| 20 | Existing test audit | Phase 0: "Test Coexistence Strategy" |
| 21 | Brownfield Day 2 | Deferred section |
| 22 | Human mutation testing | Deferred section |

**Verdict: Coverage is complete.**

---

## 2. Implementation Detail Gaps: 14 Critical Areas

### 2.1 Missing Interface Definitions

The plan names components but doesn't define their interfaces.

**Problem**: Two developers implementing `pipelineRunner.ts` and `workflowHarness.ts` independently will make different assumptions about function signatures, return types, and error handling.

**Missing definitions**:

```typescript
// What does pipelineRunner.ts export?
interface PipelineRunnerConfig { ??? }
interface PipelineRunnerResult { ??? }
function runPipeline(config: PipelineRunnerConfig): Promise<PipelineRunnerResult>;

// What does LineageValidator check?
interface LineageValidationResult {
  valid: boolean;
  violations: LineageViolation[];
}
interface LineageViolation {
  record_id: string;
  violation_type: 'missing_derived_from' | 'wrong_workflow_run' | 'authority_regression' | 'missing_decision_trace';
  expected: ???;
  actual: ???;
}

// What does FixtureFile look like with new fields?
interface FixtureFile {
  key: string;
  agent_role: string;
  sub_phase_id: string;
  call_sequence: number;
  prompt_template: string;
  prompt_template_hash: string;      // NEW - what algorithm?
  prompt_context_hash: string;       // NEW - what algorithm?
  response_raw: string;
  response_parsed?: object;
  captured_at: string;
  janumicode_version_sha: string;
  llm_provider: string;
  llm_model: string;
  // prompt_rendered removed - correct
}
```

**Required addition**: Define all interface schemas before Wave 1 begins.

---

### 2.2 Missing Algorithm Specifications

The plan mentions algorithms but doesn't specify them.

**Problem**: "Critical input variables" for `prompt_context_hash` is undefined. Developers will guess what's "critical."

**Missing specifications**:

| Algorithm | Plan Reference | Missing Detail |
|-----------|---------------|----------------|
| `prompt_context_hash` | Wave 3 | What are "critical input variables"? How are they extracted from the prompt? |
| Token approximation | Wave 3 | "calc token approximations" - what formula? `Math.ceil(prompt.length / 4)`? |
| Context drift threshold | Wave 3 | "drastically diverges" - what threshold? Jaccard distance > 0.3? |
| Lineage validation | Wave 2 | How exactly are authority levels checked? What's the monotonic progression rule? |
| Error classification | Wave 4 | "Exception -> LLM API Error/Timeout -> Missing Records..." - what's the exact decision tree? |

**Required addition**: Define each algorithm with pseudocode or explicit rules.

---

### 2.3 Missing Error Type Taxonomy

The plan names error types but doesn't define them.

**Problem**: `FixtureContextDriftError`, `CorpusDriftError`, `SimulatedTokenLimitExceededError` are mentioned but their properties and handling are undefined.

**Missing definitions**:

```typescript
// What properties do these errors have?
class FixtureContextDriftError extends Error {
  fixtureKey: string;
  expectedHash: string;
  actualHash: string;
  driftScore: number;  // Jaccard distance?
}

class CorpusDriftError extends Error {
  expectedSha: string;
  actualSha: string;
  expectedLineCount: number;
  actualLineCount: number;
}

class SimulatedTokenLimitExceededError extends Error {
  estimatedTokens: number;
  limit: number;
  phase: string;
  subPhase: string;
}
```

**Required addition**: Define error class hierarchy with properties before Wave 3.

---

### 2.4 Missing Headless Ingress Specification

The plan mentions "Headless Ingress Support" but doesn't specify how `ClientLiaisonAgent` supports non-interactive mode.

**Problem**: `ClientLiaisonAgent` currently expects a webview for user interaction. How does it operate without one?

**Missing specification**:

```typescript
// How does ClientLiaisonAgent work in headless mode?
interface HeadlessLiaisonConfig {
  intent: string | { type: 'file_reference'; path: string };
  autoApprove: boolean;
  decisionOverrides?: Record<string, DecisionOverride>;
}

// Does ClientLiaisonAgent need a new method?
class ClientLiaisonAgent {
  // Existing: interactive mode
  async handleUserMessage(message: string, context: ExtensionContext): Promise<void>;
  
  // NEW: headless mode?
  async processHeadlessIntent(config: HeadlessLiaisonConfig): Promise<LiaisonResult>;
}
```

**Required addition**: Specify the headless ingress API before Wave 1.

---

### 2.5 Missing MockLLMProvider Integration

The plan mentions `semanticKey` matching but doesn't specify how `MockLLMProvider` integrates it.

**Problem**: Current `MockLLMProvider` uses substring matching. How does it transition to semantic key matching with context drift detection?

**Missing specification**:

```typescript
class MockLLMProvider {
  // Current
  async call(options: LLMCallOptions): Promise<LLMCallResult> {
    const fixture = this.fixtures.find(f => options.prompt.includes(f.match));
    // ...
  }
  
  // NEW: How does this change?
  async call(options: LLMCallOptions): Promise<LLMCallResult> {
    // 1. Check semantic key exact match
    // 2. Check prompt_context_hash drift
    // 3. Check token limit
    // 4. Fallback to substring match?
    // What's the priority order?
  }
}
```

**Required addition**: Specify the updated `MockLLMProvider.call()` algorithm before Wave 3.

---

### 2.6 Missing Test File Structure

The plan mentions test files but doesn't define their structure.

**Problem**: Where do tests go? What's in each file? How do they interact with the harness?

**Missing structure**:

```
src/test/
  harness/
    workflowHarness.ts        # Core harness - what does it export?
    phaseContracts.ts         # Universal contracts - what's the schema?
    hestamiExpectations.ts    # Domain expectations - what's the schema?
    fixtureGenerator.ts       # Fixture capture - what's the API?
    gapCollector.ts           # Gap analysis - what's the output format?
    lineageValidator.ts       # NEW - not mentioned in plan
  suite/
    hestamiProductDescription.test.ts  # What tests does it contain?
```

**Required addition**: Define test file structure and contents before Wave 2.

---

### 2.7 Missing Fixture Directory Structure

The plan mentions fixtures but doesn't define their storage structure.

**Problem**: Where exactly do fixtures live? How are they loaded? How does the harness find them?

**Missing structure**:

```
src/test/fixtures/
  hestami-product-description/
    manifest.json              # NEW - corpus SHA, fixture count, version?
    phase_00/
      orchestrator__00_4_vocabulary_collision_check__01.json
    phase_01/
      orchestrator__01_0_intent_quality_check__01.json
      ...
```

**Required addition**: Define fixture directory structure and manifest schema before Wave 3.

---

### 2.8 Missing Semantic Warnings Format

The plan mentions "semantic_warnings" but doesn't define the output format.

**Problem**: How are semantic warnings reported? How do they differ from failures?

**Missing definition**:

```typescript
interface HarnessResult {
  status: 'success' | 'failed' | 'partial';
  phasesCompleted: string[];
  phasesFailed: string[];
  artifactsProduced: Record<string, string[]>;
  gapReport?: GapReport;
  semanticWarnings?: SemanticWarning[];  // NEW - what's the schema?
  durationMs: number;
}

interface SemanticWarning {
  phase: string;
  subPhase: string;
  artifactType: string;
  field: string;
  assertion: string;
  expected: unknown;
  actual: unknown;
  description: string;
  severity: 'advisory' | 'concerning';  // Is there a severity level?
}
```

**Required addition**: Define semantic warnings schema before Wave 2.

---

### 2.9 Missing Lineage Validation Algorithm

The plan mentions `LineageValidator` but doesn't specify the validation algorithm.

**Problem**: "Check `derived_from_record_ids`, `source_workflow_run_id`, authority levels, decision traces" - but what exactly is checked?

**Missing specification**:

```typescript
// What exactly does LineageValidator.validate() check?
class LineageValidator {
  async validate(stream: GovernedStream, phaseId: string): Promise<LineageValidationResult> {
    // 1. Every artifact has derived_from_record_ids?
    // 2. derived_from_record_ids points to previous phase artifacts?
    // 3. source_workflow_run_id matches current run?
    // 4. Authority levels are monotonically non-decreasing?
    // 5. phase_gate_approved has matching decision_trace?
    
    // What's the exact logic for each check?
  }
}
```

**Required addition**: Define lineage validation algorithm with pseudocode before Wave 2.

---

### 2.10 Missing Decision Tree Implementation

The plan mentions "Rigid Error Decision Tree" but doesn't provide the decision logic.

**Problem**: "Exception -> LLM API Error/Timeout -> Missing Records -> Schema Violation -> Assertion Failure" is a sequence, not a decision tree.

**Missing specification**:

```typescript
function classifyError(error: unknown, stream: GovernedStream, phaseId: string): ErrorType {
  // What's the exact decision logic?
  // 
  // Is it:
  // if (error instanceof LLMError) return 'llm_error'
  // if (error instanceof TimeoutError) return 'timeout'
  // if (missingRecords(stream, phaseId)) return 'missing_records'
  // if (schemaViolations(stream, phaseId)) return 'schema_error'
  // if (assertionFailures(stream, phaseId)) return 'assertion'
  // return 'unknown'
  //
  // Or is there more nuance?
}
```

**Required addition**: Define error classification algorithm with explicit conditions before Wave 4.

---

### 2.11 Missing CI Integration Details

The plan mentions CI guards but doesn't specify CI integration.

**Problem**: How does the harness run in CI? What's the output format? How are results reported?

**Missing specification**:

```yaml
# GitHub Actions workflow?
name: Test Strategy Harness
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx vitest run src/test/suite/hestamiProductDescription.test.ts
        env:
          CI: true
      - name: Upload gap report
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: gap-report
          path: gap-report.json  # Where does this come from?
```

**Required addition**: Define CI workflow and output format before Wave 5.

---

### 2.12 Missing Decision Override Schema

The plan mentions `decision_overrides` but doesn't define the schema.

**Problem**: How are decision overrides specified? What's the format?

**Missing definition**:

```typescript
interface HarnessConfig {
  // ... existing fields
  decisionOverrides?: Record<string, DecisionOverride>;
}

interface DecisionOverride {
  selection: 'index_0' | 'index_1' | 'index_2' | string;
  rationale?: string;
}

// Example:
// { "1_3": { "selection": "index_2", "rationale": "select Full Real Property OS scope" } }
//
// But what about mirror edits? The plan mentions JSON Patch for mirrors - what's that format?
```

**Required addition**: Define decision override schema before Wave 3.

---

### 2.13 Missing Corpus Lock Implementation

The plan mentions "Corpus Version Lock" but doesn't specify the implementation.

**Problem**: Where is `hestami_corpus_sha` stored? How is it checked?

**Missing specification**:

```typescript
// Where is the corpus SHA stored?
// Option A: In the test file itself
const EXPECTED_CORPUS_SHA = 'abc123...';

// Option B: In a manifest file
// src/test/fixtures/hestami-product-description/manifest.json
// { "corpus_sha": "abc123...", "corpus_line_count": 708 }

// Option C: Computed at runtime and compared to fixture metadata?

// How is it checked?
beforeAll(async () => {
  const corpusPath = 'test-workspace/specs/hestami-ai-real-property-os(2)/Hestami...md';
  const actualSha = sha256(await readFile(corpusPath));
  if (actualSha !== EXPECTED_CORPUS_SHA) {
    throw new CorpusDriftError(...);
  }
});
```

**Required addition**: Define corpus lock storage and check mechanism before Wave 2.

---

### 2.14 Missing Phase 10 Verification Implementation

The plan mentions "git cat-file -t {commit_sha}" but doesn't specify the implementation.

**Problem**: How is this check implemented? What happens if git is not available?

**Missing specification**:

```typescript
// How is Phase 10 commit verification implemented?
async function verifyCommitSha(sha: string, workspacePath: string): Promise<boolean> {
  // Option A: Spawn git process
  const result = await exec(`git -C ${workspacePath} cat-file -t ${sha}`);
  return result.stdout.trim() === 'commit';
  
  // Option B: Use isomorphic-git?
  // Option C: Check .git/objects directly?
  
  // What if git is not available (e.g., in a container)?
  // What if the commit is in a different branch?
}
```

**Required addition**: Define commit verification implementation before Wave 5.

---

## 3. Architectural Gaps: 3 Areas

### 3.1 Missing `lineageValidator.ts` in File List

The plan mentions `LineageValidator` but doesn't list `src/test/harness/lineageValidator.ts` in any wave's file list.

**Required addition**: Add to Wave 2 file list.

### 3.2 Missing `manifest.json` in Fixture Structure

The plan mentions corpus SHA but doesn't define a fixture manifest file.

**Required addition**: Add `manifest.json` to fixture directory structure.

### 3.3 Missing Error Class File

The plan defines new error types but doesn't specify where they live.

**Required addition**: Add `src/test/harness/errors.ts` to Wave 3 file list.

---

## 4. Verdict

### Is the plan of sufficient detail to implement 100% correctly and completely?

**No.** The plan has:

- **Complete mitigation coverage** - All 22 mitigations are addressed
- **Correct architectural decisions** - CLI through liaison, shared pipeline runner, lineage validation
- **Correct wave sequencing** - Dependencies are correctly ordered

But **lacks implementation detail** in:

- **14 critical areas** requiring interface definitions, algorithm specifications, or implementation details
- **3 architectural gaps** requiring additional files or structures

### What's needed before implementation can begin?

A **Detailed Implementation Specification** that provides:

1. All interface schemas (pipelineRunner, LineageValidator, FixtureFile, etc.)
2. All algorithm specifications (prompt_context_hash, token approximation, lineage validation, error classification)
3. All error class definitions with properties
4. Headless ingress API specification
5. MockLLMProvider integration specification
6. Test file structure and contents
7. Fixture directory structure and manifest schema
8. Semantic warnings output format
9. Decision override schema
10. Corpus lock implementation
11. CI workflow specification
12. Phase 10 verification implementation

Without these details, developers will make assumptions during implementation, leading to:
- Inconsistent interfaces between components
- Incorrect algorithm implementations
- Missing error handling
- Integration failures between waves

---

## 5. Recommended Next Step

Create a **Detailed Implementation Specification** document that provides all missing interface definitions, algorithm specifications, and implementation details. This document should be reviewed and approved before any code is written.

The specification should follow this structure:

```
1. Interface Definitions
   - PipelineRunner
   - LineageValidator
   - FixtureFile
   - HarnessConfig
   - HarnessResult
   - GapReport
   - SemanticWarning
   - DecisionOverride

2. Algorithm Specifications
   - prompt_context_hash computation
   - Token approximation formula
   - Context drift detection
   - Lineage validation
   - Error classification decision tree

3. Error Class Hierarchy
   - FixtureContextDriftError
   - CorpusDriftError
   - SimulatedTokenLimitExceededError
   - FixtureStalenessError

4. Headless Ingress Specification
   - HeadlessLiaisonConfig
   - ClientLiaisonAgent.processHeadlessIntent()

5. MockLLMProvider Integration
   - Updated call() algorithm
   - Semantic key matching
   - Context drift detection
   - Token limit simulation

6. File Structure
   - Test files
   - Fixture files
   - Manifest schema

7. CI Integration
   - GitHub Actions workflow
   - Output format
   - Artifact upload

8. Implementation Details
   - Corpus lock
   - Decision overrides
   - Phase 10 verification
```

With this specification, implementation can proceed with confidence that all details are defined and no assumptions are needed.
