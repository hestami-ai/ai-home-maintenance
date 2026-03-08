# Testing Harness Roadmap

This document defines the implementation roadmap for bringing JanumiCode up to a real harness-engineering standard.

It is deliberately focused on execution, not theory. The goal is to turn JanumiCode from a complex VS Code extension with minimal machine-checkable validation into a governed, testable, empirically steerable system.

## Why This Matters

OpenAI's Harness Engineering article argues that reliability comes less from prompt tuning and more from scaffolding:

- repository-local knowledge
- enforceable boundaries
- deterministic validation loops
- scenario harnesses
- recurring entropy cleanup

JanumiCode already has the right product shape for this:

- governed workflow phases
- persistent SQLite-backed state
- explicit claims, verdicts, and gates
- a large extension-host surface
- external provider and CLI integrations

What it lacks is a harness that makes those behaviors easy to verify, replay, and evolve safely.

## Current State

As of March 8, 2026:

- The extension has real runtime complexity in [src/extension.ts](/mnt/e/Projects/hestami-ai/JanumiCode/janumicode/src/extension.ts), [src/lib/ui/governedStream/GovernedStreamPanel.ts](/mnt/e/Projects/hestami-ai/JanumiCode/janumicode/src/lib/ui/governedStream/GovernedStreamPanel.ts), [src/lib/ui/governedStream/html/script.ts](/mnt/e/Projects/hestami-ai/JanumiCode/janumicode/src/lib/ui/governedStream/html/script.ts), and the workflow/database layers.
- The package already includes `@vscode/test-cli`, `@vscode/test-electron`, and `@types/mocha`.
- The only committed test is the sample scaffold in [src/test/extension.test.ts](/mnt/e/Projects/hestami-ai/JanumiCode/janumicode/src/test/extension.test.ts).
- There is no current harness for deterministic provider behavior, scenario replay, webview logic validation, or architecture invariants.

That means JanumiCode currently has runtime behavior, but not a reliable feedback system.

## Testing Strategy

JanumiCode should not use a generic unit-test pyramid. It needs a layered harness:

1. Fast deterministic core tests
2. Scenario harnesses for governed workflows
3. Thin extension-host smoke tests
4. Structural and entropy checks
5. Recurring cleanup tasks

This reflects the product itself: JanumiCode is an orchestration system, not a pure library.

## Target Test Layers

### 1. Structural Harness

Purpose: stop architectural drift before runtime.

Checks to add:

- file size ceilings for high-churn modules
- forbidden dependency directions between layers
- no direct `vscode` access outside extension and UI boundaries
- no direct CLI process spawning outside provider/integration adapters
- no direct secret storage or env access outside config adapters
- required structured logging patterns

This is the closest analog to the article's custom lints and "golden principles."

### 2. Core Deterministic Tests

Purpose: validate state transitions and logic without a real VS Code host.

Focus areas:

- workflow state machine
- gate creation and resolution
- event writers and readers
- dialogue lifecycle
- stream aggregation
- text command parsing
- claim normalization and verification bookkeeping
- database schema and migrations against temp databases

These should become the largest test layer.

### 3. Scenario Harnesses

Purpose: prove end-to-end governed behavior with controlled fakes.

Each scenario should declare:

- fixture workspace
- initial config
- fake provider outputs
- fake CLI activity events
- expected phase progression
- expected persisted records
- expected human gates
- expected governed-stream output fragments

This is the most important harness layer for JanumiCode because the product promise is workflow correctness.

### 4. Extension-Host Smoke Tests

Purpose: validate the VS Code integration boundary.

These tests should stay intentionally small:

- extension activates
- commands register
- governed stream view resolves
- command handlers trigger expected top-level behaviors
- warnings/errors surface for missing config or invalid setup
- export and clear-history flows work in a fixture workspace

### 5. Webview Logic Tests

Purpose: validate client-side behavior without requiring a full VS Code host for every check.

Current problem:

- [script.ts](/mnt/e/Projects/hestami-ai/JanumiCode/janumicode/src/lib/ui/governedStream/html/script.ts) is a very large injected string, which is hard to test directly.

Target shape:

- extract pure DOM update helpers
- isolate message dispatch from rendering behavior
- test DOM mutations under `jsdom` or equivalent DOM runner
- leave only a thin `acquireVsCodeApi()` shell untested

## Tooling Recommendation

Use two runners, each for the job it is best at.

### Fast Tests

Recommended: `vitest`

Use for:

- core deterministic tests
- scenario harnesses
- DOM-level webview tests
- coverage reporting
- structural test scripts

Why:

- much faster local loop
- easy fixture setup
- strong snapshot support
- straightforward fake timers and spies

### Extension-Host Tests

Recommended: keep `@vscode/test-electron` with Mocha-style suites

Use for:

- activation and command registration
- view/provider smoke coverage
- a very small number of top-level extension integration checks

Why:

- this matches the VS Code extension ecosystem
- it already aligns with current dependencies
- it avoids turning all tests into slow host-level tests

## Proposed Directory Layout

```text
src/
  test/
    host/
      activation.test.ts
      commands.test.ts
      governedStreamView.test.ts
    unit/
      workflow/
      database/
      dialogue/
      ui/
    scenarios/
      governed-workflow/
        happy-path.test.ts
        unknown-claim-gate.test.ts
        reject-and-replan.test.ts
    fixtures/
      workspaces/
      providers/
      cli/
      db/
      scenarios/
    helpers/
      tempWorkspace.ts
      tempDatabase.ts
      fakeClock.ts
      fakeIds.ts
      fakeVscodeApi.ts
      fakeProviders.ts
      fakeCliProvider.ts
      scenarioRunner.ts
scripts/
  test/
    structural/
      architecture-check.ts
      file-size-check.ts
      boundary-check.ts
```

If the repo prefers to keep host tests under the current [src/test](/mnt/e/Projects/hestami-ai/JanumiCode/janumicode/src/test) path, retain that folder for VS Code host tests and place unit/scenario tests under [src/test/unit](/mnt/e/Projects/hestami-ai/JanumiCode/janumicode/src/test/unit) and [src/test/scenarios](/mnt/e/Projects/hestami-ai/JanumiCode/janumicode/src/test/scenarios).

## Required Test Seams

Before adding many tests, JanumiCode needs controllable seams around side effects.

### Priority Seams

1. Provider invocation
2. CLI process spawning and streaming
3. Clock and UUID generation
4. Database path and workspace path resolution
5. VS Code notifications and command execution
6. Secret storage and config reads
7. Event bus subscription wiring

### Immediate Refactoring Targets

- [src/extension.ts](/mnt/e/Projects/hestami-ai/JanumiCode/janumicode/src/extension.ts)
- [src/lib/ui/governedStream/GovernedStreamPanel.ts](/mnt/e/Projects/hestami-ai/JanumiCode/janumicode/src/lib/ui/governedStream/GovernedStreamPanel.ts)
- [src/lib/ui/governedStream/html/script.ts](/mnt/e/Projects/hestami-ai/JanumiCode/janumicode/src/lib/ui/governedStream/html/script.ts)
- [src/lib/workflow/orchestrator.ts](/mnt/e/Projects/hestami-ai/JanumiCode/janumicode/src/lib/workflow/orchestrator.ts)

The goal is not abstraction for its own sake. The goal is determinism.

## Scenario Harness Design

Define a scenario as a declarative object, not an ad hoc test body.

Suggested shape:

```ts
type GovernedScenario = {
  id: string;
  goal: string;
  workspaceFixture: string;
  configOverrides?: Partial<TestConfig>;
  fakeRoleOutputs: FakeRoleOutputMap;
  fakeCliEvents?: FakeCliEvent[];
  expected: {
    finalPhase?: string;
    gates: Array<{ kind: string; status: string }>;
    claims: Array<{ statement: string; status: string }>;
    events: Array<{ type: string }>;
    streamContains: string[];
  };
};
```

The scenario runner should:

- provision temp workspace and temp DB
- inject fake providers and fake CLI streams
- execute the workflow through the same orchestration entrypoints used in production
- collect emitted events, persisted rows, and rendered stream state
- assert against the scenario contract

## First 10 Tests To Build

These are the first tests worth writing. They cover the highest-risk behavior for the least harness complexity.

1. Extension activation succeeds with temp DB and fake config.
2. Extension registers expected commands on activation.
3. Workflow state machine rejects invalid phase transitions.
4. Human gate resolution updates gate status and resumes workflow correctly.
5. Event writer persists dialogue turn, claim, verdict, and gate records consistently.
6. Stream aggregator renders the correct health/gate state for a dialogue with mixed verdicts.
7. `startNewDialogue()` abandons an in-flight dialogue before creating a new active one.
8. Text command parser classifies retry/replan/export commands correctly.
9. Scenario: verified happy path progresses from intake to completion without a human gate.
10. Scenario: unknown critical claim triggers a gate and blocks execution until a human decision is applied.

## Milestone Plan

### Milestone 1: Make Testing Real

Goal: replace the placeholder test scaffold with a working split test system.

Deliverables:

- real host test runner wired and documented
- fast test runner added
- coverage output enabled
- `test`, `test:unit`, `test:host`, and `test:ci` scripts defined
- placeholder sample test removed

Exit criteria:

- tests can run locally and in CI
- at least 3 host smoke tests exist
- at least 5 deterministic tests exist

### Milestone 2: Create Deterministic Seams

Goal: make core workflow behavior testable without a live provider or live CLI.

Deliverables:

- fake provider registry
- fake CLI event source
- temp DB helper
- temp workspace helper
- fake clock and deterministic ID helpers

Exit criteria:

- workflow tests run without real network, secrets, or external CLIs
- scenario runner can execute one full governed flow using fakes

### Milestone 3: Cover Workflow Risk

Goal: put the governed workflow under real acceptance-style coverage.

Deliverables:

- happy-path scenario
- unknown-claim gate scenario
- reject-and-replan scenario
- export-history scenario
- command retry scenario

Exit criteria:

- the main workflow can be replayed under at least 5 scenario fixtures
- persisted state and governed-stream output are asserted, not eyeballed

### Milestone 4: Webview and UX Harness

Goal: make the governed stream behavior machine-checkable.

Deliverables:

- extracted message dispatcher
- extracted DOM update helpers
- DOM tests for phase changes, gate resolution, command options, and clarification restoration

Exit criteria:

- major client-side message handlers are covered by DOM tests
- webview regressions no longer require manual visual inspection as the primary check

### Milestone 5: Architecture and Entropy Control

Goal: stop the repo from becoming less testable over time.

Deliverables:

- file size checks
- dependency-direction checks
- forbidden-import checks
- recurring cleanup backlog and autofix tasks

Exit criteria:

- CI fails on architectural violations
- the highest-risk files have explicit size and responsibility limits

## CI Plan

CI should be staged by speed and signal.

### On Every PR

- typecheck
- lint
- structural checks
- deterministic unit tests
- core scenario subset

### On Main or Nightly

- full scenario suite
- extension-host smoke tests
- coverage report publication
- flake report
- cleanup scan for architecture drift

### Flake Policy

- Host tests must stay few and intentionally broad.
- Scenario tests must use fake providers and fake clocks by default.
- Any flaky test should be fixed or quarantined immediately; do not let them accumulate.

## Success Metrics

The harness is working when JanumiCode can answer these questions mechanically:

- Did a workflow take the correct path?
- Was a gate raised when it should have been?
- Did execution remain blocked until the gate was resolved?
- Were the persisted records consistent with the governed stream?
- Did the extension surface the right user-visible state?
- Did a code change violate architecture rules?

If those questions still require manual inspection, the harness is incomplete.

## Recommended Implementation Order

Follow this order. It minimizes wasted work.

1. Wire real test scripts and runners.
2. Replace the sample host test with activation and command-registration smoke tests.
3. Add temp DB and fake provider helpers.
4. Cover workflow state, gate handling, and event persistence.
5. Build the first two scenario harnesses.
6. Refactor the governed stream webview into testable pieces.
7. Add structural checks and recurring cleanup rules.

Do not start with broad end-to-end UI automation. It will be slow, flaky, and low-signal for the current architecture.

## Non-Goals

This roadmap does not propose:

- heavy browser automation as the primary harness
- real external provider calls in CI
- visual snapshot testing as the first line of defense
- replacing governed workflows with generic agent autonomy

The harness should strengthen JanumiCode's existing governance model, not dilute it.

## Immediate Next Actions

The first implementation PR should do only these things:

1. Establish test runner split and scripts.
2. Replace [src/test/extension.test.ts](/mnt/e/Projects/hestami-ai/JanumiCode/janumicode/src/test/extension.test.ts) with real smoke tests.
3. Add temp DB and fake provider fixtures.
4. Add 3 deterministic workflow tests.
5. Add 1 happy-path scenario test.

That is enough to move JanumiCode from "no real testing" to "initial harness in place" without trying to solve the whole architecture in one pass.
