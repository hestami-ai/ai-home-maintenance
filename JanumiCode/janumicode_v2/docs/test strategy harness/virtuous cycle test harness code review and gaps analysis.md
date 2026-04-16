Reviewer #1

# Test Strategy Harness Code Review

I have reviewed the test strategy harness implementation in `janumicode_v2/src/test/harness` and `janumicode_v2/src/cli` against the specification provided in `docs/test strategy harness/test strategy harness - specification.md`. 

While a substantial portion of the harness is in place—including headless pipeline runners, CLI entry points, mock LLM execution via fixtures, lineage validation, and rule-based gap report enhancement—there are several **critical gaps** where the implementation deviates from or fails to fully realize the specification which would prevent it from achieving its vision as a test-driven virtuous cycle harness.

## 1. Missing LLM-based Gap Suggestion Fix (Gap Collector)

**Specification:** Section 6.2 states that when a gap is detected, the gap collector must make a "single focused LLM API call to generate the `suggested_fix`". It should provide actionable implementation guidance outlining files to edit, schemas to match, and specific LLM completions.

**Implementation Status:** **Missing**
- Currently, `gapReportEnhancer.ts` contains completely hardcoded `generateFix` and `generateCodeSnippet` functions.
- These rules only cover extreme basics: `intent_received`, `intent_classified`, `requirements_extracted`, `architecture_proposed`, `execution_completed`, and `review_decision`. 
- Because there is no LLM call being made using the "primary Reasoning Review LLM provider", the gap report cannot automatically teach an AI coder how to implement the missing phases. This severely undermines the goal of autonomous, self-reinforcing test harness reports.

## 2. Incomplete Hestami-Specific Phase Expectations

**Specification:** Section 4.4 mandates strict, deep assertions for the canonical Hestami test case. For instance, Phase 2 must result in `>= 40 user stories`, with specific references to "accounting", "GL", "DBOS", "ARC", etc. Phase 1 must check intent statement scopes, and Phase 0 must verify collision risk report properties.

**Implementation Status:** **Incomplete**
- In `src/test/harness/hestamiExpectations.ts`, the assertions are exceedingly shallow. 
- The expectations are limited to simple `validateMinRecordCount` and basic syntactic properties (`validateIntentClarity` heuristics, `validateArchitectureComponents` checking for merely `min_components: 2`). 
- None of the required deep semantic checks involving the particular domain of Hestami (e.g., Accounting, Workflow, Real Property) exist. Without them, the harness cannot reliably validate if the AI completed the Phase correctly to specification.

## 3. Absence of CLI Integration Tests

**Specification:** Section 7.3 required "Layer 3 — CLI Integration Tests" living in `src/test/cli/` (containing `hestamiCLI.test.ts` and `cliSmoke.test.ts`), which would execute the CLI out-of-process via standard `child_process.spawn`.

**Implementation Status:** **Missing**
- The `src/test/cli` directory does not exist. Tests currently live in `src/test/e2e/suite` and only execute smoke tests or extension host tests.
- Without these Layer 3 out-of-process tests, any underlying integration flaws with argument parsing or exit codes cannot be automatically caught.

## 4. Missing Formal `AutoApproveAdapter` 

**Specification:** Section 3.5 states the `--auto-approve` flag should inject an `AutoApproveAdapter` that auto-approves all human interactions, making sure they are written to the Governed Stream with `produced_by_agent_role: auto_approve_adapter` so they are fully auditable.

**Implementation Status:** **Deviated / Missing**
- The `AutoApproveAdapter` does not exist as a formal separate actor.
- In `src/lib/orchestrator/orchestratorEngine.ts`, `pauseForDecision` simply short-circuits by fulfilling pending actions with synthetic responses if `this.autoApproveDecisions` is true. 
- These synthetic approvals do not guarantee logging with the strict `auto_approve_adapter` agent role, missing out on proper governed stream lineage traceability that relies on distinguishing AI logic from automatic stubbed execution.

## Summary

The current implementation lacks the dynamic LLM feedback loop in its gap report and lacks the deep semantic fixture tests, breaking the "virtuous cycle" requirement. Addressing these four major missing pieces will ensure the test strategy harness is production-ready.

=====

Reviewer #2

::code-comment{title="[P0] Phase contracts are mapped to a different workflow than JanumiCode v2.3" body="`PHASE1_CONTRACT` already shows the problem: it requires `requirements_extracted`, `requirements_clarified`, and `requirements_prioritized`, but JanumiCode Phase 1 is Intent Capture and Convergence, not Requirements Definition. The same mismatch repeats across the file (`PHASE0_CONTRACT`, `PHASE8_CONTRACT`, `PHASE10_CONTRACT`, etc.). If this validator is ever made authoritative, it will report false gaps and miss real regressions because it is checking against a parallel generic workflow rather than the actual phase model implemented in `records.ts` and the phase handlers." file="/E:/Projects/hestami-ai/JanumiCode/janumicode_v2/src/test/harness/phaseContracts.ts" start=92 end=98 priority=0 confidence=0.98}
::code-comment{title="[P0] Hestami expectations assert artifacts the real pipeline does not produce for those phases" body="The Hestami oracle is built on the same wrong phase map. For example, this file expects Phase 1 to produce `requirements_extracted`, Phase 2 to produce `architecture_proposed`, and later phases to produce `commit_created` in Phase 8, while the actual JanumiCode pipeline produces `intent_statement`, `functional_requirements`, `reasoning_evaluation_plan`, etc. Fixing the depth of the semantic assertions alone is not enough; the baseline expectation model itself needs to be realigned to the JanumiCode v2.3 artifact set first." file="/E:/Projects/hestami-ai/JanumiCode/janumicode_v2/src/test/harness/hestamiExpectations.ts" start=67 end=75 priority=0 confidence=0.97}
::code-comment{title="[P0] Runner bypasses the validator and fabricates gap reports heuristically" body="The shared execution path never calls `validateLineage`, `validateExpectations`, or `enhanceGapReport`; those helpers are effectively dead code. Instead, `collectResults()` infers success from a phase having at least two distinct record types and, on failure, emits a generic \"implement Phase N handler\" gap report with `artifact_produced` as the missing record. That means the current loop is not actually checking schemas, artifact contents, or Hestami-specific assertions, so it cannot serve as the virtuous-cycle oracle described in the spec." file="/E:/Projects/hestami-ai/JanumiCode/janumicode_v2/src/cli/runner.ts" start=290 end=341 priority=0 confidence=0.99}
::code-comment{title="[P0] `--phase-limit` is parsed but never enforced" body="The CLI advertises phase-limited runs, but the parsed `phaseLimit` value is only copied into config and is never consumed by the runner or engine. In auto-approve mode the engine keeps chaining forward through later phases, so the spec's incremental workflow (`fix Phase N`, rerun `--phase-limit N`, capture fixtures one phase at a time) cannot work reliably. This blocks both the per-phase harness tests and the documented fixture-capture workflow." file="/E:/Projects/hestami-ai/JanumiCode/janumicode_v2/src/cli/index.ts" start=37 end=57 priority=0 confidence=0.98}
::code-comment{title="[P1] Fixture loading/capture does not match the specified corpus format" body="The fixture system here only loads top-level `.json` files from one directory, while the spec requires a phase-organized corpus (`phase_00/`, `phase_01/`, ...), recursive loading, semantic keys with the sub-phase name, and incremental capture that does not overwrite existing fixtures. In the same module, `generateFixtureKey()` emits abbreviated keys like `requirements_agent__2_1__01`, and `saveCapturedFixtures()` writes flat files directly into the output directory. Even if `fixtureGenerator.ts` were added, this implementation would still be incompatible with the documented Hestami fixture layout." file="/E:/Projects/hestami-ai/JanumiCode/janumicode_v2/src/test/helpers/mockLLMProvider.ts" start=123 end=135 priority=1 confidence=0.98}
::code-comment{title="[P1] CLI output and exit codes violate the published contract" body="The spec defines machine-readable JSON output for both success and failure and reserves distinct exit codes for configuration, unrecovered LLM, and schema-validation failures. This CLI prints human-readable banners, omits `failed_at_phase` / `failed_at_sub_phase`, and only exits with `0`, `1`, or `2`. That means the child-process contract the virtuous cycle depends on is not actually implemented yet, even before considering the missing CLI integration tests." file="/E:/Projects/hestami-ai/JanumiCode/janumicode_v2/src/cli/index.ts" start=59 end=95 priority=1 confidence=0.99}
::code-comment{title="[P2] Headless decision overrides are dead and auto-approve menus resolve to an impossible empty selection" body="The headless adapter stores `decisionOverrides`, but nothing in the engine consults them when a decision is resolved. The fallback auto-approve path therefore drives menu and bundle surfaces with `selected: []` rather than \"first option unless overridden,\" which is the opposite of the spec and can materially change phase behavior. This is a functional gap separate from the missing `AutoApproveAdapter` audit role already identified in the first review." file="/E:/Projects/hestami-ai/JanumiCode/janumicode_v2/src/core/headlessLiaisonAdapter.ts" start=118 end=183 priority=2 confidence=0.97}

**Findings**
Yes. Beyond the first review, I found additional gaps that materially block the harness vision.

- `P0` The harness oracle is aligned to the wrong pipeline. [phaseContracts.ts](/E:/Projects/hestami-ai/JanumiCode/janumicode_v2/src/test/harness/phaseContracts.ts:92), [hestamiExpectations.ts](/E:/Projects/hestami-ai/JanumiCode/janumicode_v2/src/test/harness/hestamiExpectations.ts:67), and the real phase model in [records.ts](/E:/Projects/hestami-ai/JanumiCode/janumicode_v2/src/lib/types/records.ts:100) / [janumicode_spec_v2.3.md](/E:/Projects/hestami-ai/JanumiCode/janumicode_v2/docs/janumicode_spec_v2.3.md:564) do not agree on what each phase produces.
- `P0` The runner never invokes that oracle anyway. [runner.ts](/E:/Projects/hestami-ai/JanumiCode/janumicode_v2/src/cli/runner.ts:242) builds status and gaps from heuristics, and `validateLineage`, `validateExpectations`, and `enhanceGapReport` are unreferenced in the live path.
- `P0` `--phase-limit` is a no-op. [index.ts](/E:/Projects/hestami-ai/JanumiCode/janumicode_v2/src/cli/index.ts:37), [runner.ts](/E:/Projects/hestami-ai/JanumiCode/janumicode_v2/src/cli/runner.ts:30), and [orchestratorEngine.ts](/E:/Projects/hestami-ai/JanumiCode/janumicode_v2/src/lib/orchestrator/orchestratorEngine.ts:341) together mean phase-limited self-verification and incremental capture cannot work.
- `P1` The fixture system is not the specified Hestami corpus. [mockLLMProvider.ts](/E:/Projects/hestami-ai/JanumiCode/janumicode_v2/src/test/helpers/mockLLMProvider.ts:123), [runner.ts](/E:/Projects/hestami-ai/JanumiCode/janumicode_v2/src/cli/runner.ts:124), and the committed [manifest.json](/E:/Projects/hestami-ai/JanumiCode/janumicode_v2/src/test/fixtures/hestami-product-description/manifest.json:1) show flat loading, wrong key semantics, wrong output location, and a non-spec manifest. The committed Hestami corpus still covers only Phases 0-1.
- `P1` The CLI contract is still different from the published contract. [index.ts](/E:/Projects/hestami-ai/JanumiCode/janumicode_v2/src/cli/index.ts:59) prints banners instead of JSON and never uses exit codes `3` or `4`.
- `P1` The canonical Hestami suite is still absent. There is no `src/test/suite/hestamiProductDescription.test.ts`, no `src/test/cli/`, and [package.json](/E:/Projects/hestami-ai/JanumiCode/janumicode_v2/package.json:111) still wires `pnpm test:harness` to the todo-app fixtures instead of the canonical Hestami corpus required by [test strategy harness - specification.md](/E:/Projects/hestami-ai/JanumiCode/janumicode_v2/docs/test%20strategy%20harness/test%20strategy%20harness%20-%20specification.md:545).
- `P2` Headless decision behavior is not deterministic. [headlessLiaisonAdapter.ts](/E:/Projects/hestami-ai/JanumiCode/janumicode_v2/src/core/headlessLiaisonAdapter.ts:118) stores overrides that nothing consumes, and the engine's auto-approve path does not implement the specified "pick option 0 unless overridden" behavior.

**Assumptions**
- I treated [janumicode_spec_v2.3.md](/E:/Projects/hestami-ai/JanumiCode/janumicode_v2/docs/janumicode_spec_v2.3.md:387) plus the actual phase handlers as the source of truth for JanumiCode behavior.
- This was a static code review; I did not execute the harness end to end.

The main pattern is that the repo contains several harness-shaped utilities, but the actual virtuous-cycle loop is not yet wired to the real JanumiCode artifact model, phase-limited execution, or the canonical Hestami corpus.


======

Reviewer 3

Specific validator count: Only 6 validators implemented in lineageValidator.ts vs ~20+ required by spec

Phase name mapping table: Explicit mapping showing the mismatch between phaseContracts.ts names and records.ts names



