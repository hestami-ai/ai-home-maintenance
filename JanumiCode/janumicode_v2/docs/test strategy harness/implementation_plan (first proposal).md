# Test Strategy Harness — Implementation Strategy & Roadmap

This document outlines the implementation strategy and structured roadmap for the JanumiCode v2 Test Strategy Harness. It natively incorporates the 22 mitigations derived from the critical reviews (GLM 5, Antigravity, GPT-5.4) layered over the original specification.

## Core Principles

1. **Pipeline Fidelity over Spec Adherence**: The CLI and test harness will not invent a new pipeline ingress. They must use the canonical `ClientLiaisonAgent` path and adhere strictly to `records.ts:SUB_PHASE_NAMES`. 
2. **Context-Aware Mocks**: Stubbing LLMs with static semantic keys creates dangerous false positives. Mocks will evaluate incoming prompt context signatures to enforce structural integrity during test runs.
3. **Governance Lineage is Paramount**: Assertions are not merely about JSON schema validity. They must validate authority derivation, decision traces, and monotonic workflow progression in the Governed Stream.
4. **Universal vs. Domain Contracts**: Clear separation between what makes JanumiCode "correct" universally vs. what makes the "Hestami" pipeline output specific.

## Architectural Decisions

> [!NOTE]
> **Test Coexistence (Option B)**
> The new `hestamiProductDescription` test suite will **extend** the existing pipeline tests (`fullPipeline.test.ts` and `completePipeline.test.ts`) rather than replace them. This allows focusing the Hestami tests on the complex multi-domain logic while retaining the baseline generic pipeline coverage.
>
> **Assertion Tiers**
> Assertions are officially split into two tiers: **Hard Failures** for universal and corpus-locked rules (e.g., structure integrity, exactly 12 CAM domains) and **Soft Warnings** for subjective semantic validations (e.g., minimum user story checks or specific keywords).

## Implementation Roadmap

### Phase 0: Prerequisite Audits & Architecture Corrections
*Must be resolved before continuous execution code is written.*

* **Sub-phase Synchronization**: Audit `records.ts:SUB_PHASE_NAMES` and assure that harness expectations map exactly to the codebase reality. Do not invent new sub-phases just for the test harness.
* **Test Coexistence Strategy**: Ensure the new Hestami test is structured to run alongside existing full-pipeline tests without clashing configurations.
* **Headless Ingress Support**: Refactor or wrap `ClientLiaisonAgent` so the CLI can invoke file resolution, attachment parsing, and query classification without invoking VS Code webviews.

---

### Wave 1: The Core Execution Engine
*Establishes the IDE-agnostic foundation and fixes critical architectural routing.*

* **Shared Pipeline Runner (`src/core/pipelineRunner.ts`)**: Abstract process execution logic so both CLI and `workflowHarness.ts` share the exact identical run loop.
* **Authentic CLI Ingress**: Route CLI invocation through the Headless `ClientLiaisonAgent` instead of injecting raw intent straight to Phase 1.
* **`LLMCallOptions` Enrichment**: Add `semanticKey?: string` to parameter interfaces so exact matches bypass substring fallbacks.
* **Auto-Approve Tracing**: Explicitly define auto-approvals in the stream via `decision_trace` records (mark as `auto_approved: true` with `selected_option_index`).

---

### Wave 2: Extended Harness & True Assertions
*Builds the testing logic, but does it correctly by decoupling Universal Rules from Domain Heuristics.*

* **Universal Phase Contracts (`src/test/harness/phaseContracts.ts`)**: Implement universal schemas and invariants. Crucially, add the `LineageValidator` to check `derived_from_record_ids`, `source_workflow_run_id`, monotonically increasing authority levels, and matching decision traces.
* **Hestami Domain Contracts (`src/test/harness/hestamiExpectations.ts`)**: Soften subjective metrics (like keyword tests) from test failures into `semantic_warnings`. Retain hard failures for rigid inputs mapped against the corpus (e.g., 12 CDM domains).
* **Test Isolation**: Guarantee database isolation. Run contexts will use unique paths `.janumicode/test_{randomUUID}/governed_stream.db`.
* **Corpus Version Lock**: Hash the `Hestami` document (`hestami_corpus_sha`) at test startup. Hard-fail `CorpusDriftError` if the doc size or hash changes to prevent silent oracle drift.

---

### Wave 3: Intelligent Fixtures & Mock Providers
*Ensuring the mock system does not mask true application breakage.*

* **False-Positive Prevention**: Introduce `prompt_context_hash` inside `FixtureFile`. If real input drastically diverges from the snapshot's context composition, the test must throw `FixtureContextDriftError`.
* **Fixture Staleness Detection**: Add `prompt_template_hash` to detect when core engine templates evolve out-of-sync with saved fixtures.
* **Token Limit Safeguards**: Enforce `simulateTokenLimit` inside `MockLLMProvider` (calc token approximations). Break the build if Phase 6 attempts to inject 200k+ tokens through a mock that would otherwise pass silently.
* **Repo Hygiene**: Expunge `prompt_rendered` from checked-in Git `FixtureFile` assets. Output them asynchronously into `.janumicode/.debug/rendered_prompts/*.txt` locally instead.
* **Menu Determinsm**: Implement `decision_overrides` configuration logic in `HarnessConfig` to simulate deliberate user menu picks over default-index-0 picks.

---

### Wave 4: Defensive Gap Reporting
*Integrating the AI Gap Collector but wrapping it in safety mechanisms.*

* **Gap Error Context Extractor**: Implement `GapErrorContext` with explicit rules: `handlerMissing` vs. `handlerPath` and exact failure line anchors, rather than arbitrary 100-line slice truncations.
* **Rigid Error Decision Tree**: Wire deterministic error sorting: Exception → LLM API Error/Timeout → Missing Records → Schema Violation → Assertion Failure.
* **CI Spend & Execution Guards**: Guarantee the CLI + Gap Collector halts API feedback loops automatically when `process.env.CI === 'true'` or when passing `--disable-ai-suggestions`.

---

### Wave 5 & 6: Rolling Coverage & Output Validation
*Continuous process milestones as implementation sweeps across Phases 2 through 10.*

* **Rolling Phases**: Continually run fixture capture, validation, and extension as Phase handlers are fleshed out.
* **Phase 10 Integrity Check**: Ensure success criteria for completion requires verifying `git cat-file -t {commit_sha}` returns valid tree data, avoiding synthetic success tokens.

## Deferred (Future Roadmap)
* **Brownfield / Day 2 Scenario**: Re-run the harness on the resulting Phase 10 workspace with a modifier prompt to evaluate Context Ingestion / Refactoring loops (`refactoring_scope`).
* **Human Mutation Vectors**: Employ deterministic JSON Patch overrides on `mirror_presented` payloads to check if the phase gracefully adapts to human modifications.

