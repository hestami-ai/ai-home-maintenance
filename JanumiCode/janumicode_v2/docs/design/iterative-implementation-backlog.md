# Iterative Implementation Backlog — Design

**Status:** Locked design (2026-05-18). Not yet implemented.
**Driver:** Phase 2 budget caps silently filter `deferred` leaves out of the downstream pipeline (verified — `phaseContext.ts` filters `status !== 'atomic'` in all five frozen-leaves builders, with no resumption path beyond `--resume-from-db`). The user-visible symptom is that a release marked for implementation can ship code missing the requirements that hit the cap during decomposition.

This design replaces the linear pipeline (Phase 1 → … → Phase 9 → DONE) with a **release-major iterative** flow that automatically loops Phase 2..9 on each release's deferred frontier until the frontier saturates, then advances to the next release.

---

## 1. Concept and invariants

A run iterates:

```
For each release R in ascending ordinal (Backlog optionally trailing):
  Cycle 0 (initial): Phase 2..Phase 9 on R's roots, deferred frontier accumulates.
  Cycle 1..K (delta): re-decompose R's deferred frontier → delta Phases 3..7 → Phase 9 delta execute.
  Terminate R when: deferred frontier empty | cycle produced 0 new atomic leaves | cycle ceiling hit.
  Advance to next release.
```

A new **`cycle_controller`** sub-phase sits after Phase 9 and decides loop / advance-release / enter ceiling-mirror / DONE.

### Invariants

These are what "100% correct" means. Every test below must enforce them.

- **I1 — Implement-once.** Each atomic leaf is implemented exactly once across the lifetime of a release. A leaf that becomes atomic in cycle N is implemented in cycle N's Phase 9 and never re-implemented in later cycles.
- **I2 — Append-only prior outputs.** Cycle N+1 outputs only extend cycle N's outputs. Prior approved artifacts are immutable except via an explicit operator-confirmed architecture-evolution mirror (§5 Phase 4).
- **I3 — Monotonic workspace.** Workspace state grows monotonically within a release (code added or edited, never reverted).
- **I4 — Regression preservation.** Tests written in cycles 1..N−1 must pass in cycle N (gate enforced before Phase 9 of cycle N completes).
- **I5 — Bounded termination.** Each release's iteration terminates within `max_cycles_per_release` (default 5, configurable).
- **I6 — Identity stability.** A deferred node's `node_id` UUID is preserved across cycles. Cycle N+1's re-bloom produces a new supersession on the same node_id; descendants link through the preserved parent chain.

---

## 2. Data model additions

### New record type — `cycle_iteration`

```ts
interface CycleIterationContent {
  kind: 'cycle_iteration';
  schemaVersion: '1.0';
  release_id: string;
  release_ordinal: number;
  cycle_number: number;             // 0 = initial; 1+ = delta cycles
  started_at: string;               // ISO
  completed_at?: string;
  termination_reason?:
    | 'frontier_empty'              // success — no deferred leaves remain for R
    | 'zero_progress'               // delta cycle produced 0 new atomic leaves
    | 'ceiling_hit'                 // max_cycles_per_release reached
    | 'ceiling_hit_accepted'        // operator chose "accept and advance" at ceiling mirror
    | 'phase_failure';              // a phase hard-failed
  atomic_leaves_produced: number;   // newly-atomic this cycle (FR + NFR)
  deferred_leaves_remaining: number;
  cycle_budget_cap: number;         // per-root budget THIS cycle (flat across cycles)
  phase_records: {
    phase2: string[];
    phase3: string[];
    phase4: string[];
    phase5: string[];
    phase6: string[];
    phase7: string[];
    phase8: string[];
    phase9: string[];
  };
}
```

### Workflow-run columns

```sql
ALTER TABLE workflow_runs ADD COLUMN current_release_ordinal INTEGER;
ALTER TABLE workflow_runs ADD COLUMN current_cycle_number   INTEGER DEFAULT 0;
ALTER TABLE workflow_runs ADD COLUMN max_cycles_per_release INTEGER DEFAULT 5;
ALTER TABLE workflow_runs ADD COLUMN regression_scope       TEXT    DEFAULT 'all_prior'; -- 'all_prior' | 'smoke_only' | custom manifest tag
```

### Content-blob field — `produced_in_cycle`

Every `artifact_produced` and `requirement_decomposition_node` written during a cycle carries:

```ts
produced_in_cycle: {
  release_ordinal: number;
  cycle_number: number;
}
```

In-content (not a separate column) — keeps the change non-invasive. Delta queries scan governed_stream JSON via SQLite `json_extract`, which is acceptable for our volumes.

---

## 3. State machine changes

Current edges: `phase9 → DONE`.

New edges:

```
phase9            → cycle_controller       (always)
cycle_controller  → phase2                 (loop within same release; bump current_cycle_number)
cycle_controller  → cycle_controller       (advance to next release; bump current_release_ordinal, reset current_cycle_number = 0)
cycle_controller  → ceiling_mirror         (when current_cycle_number + 1 > max_cycles_per_release)
cycle_controller  → backlog_iteration_mirror (when last non-Backlog release saturates AND Backlog has records)
cycle_controller  → DONE                   (all releases saturated)

ceiling_mirror    → phase2                 (operator: extend ceiling by K)
ceiling_mirror    → cycle_controller       (operator: accept and advance)
ceiling_mirror    → DONE                   (operator: abort)

backlog_iteration_mirror → cycle_controller (operator: yes, iterate Backlog as a normal release)
backlog_iteration_mirror → DONE             (operator: no, leave Backlog as documented gap — default)
```

`cycle_controller` writes a `cycle_iteration` record (with termination_reason where applicable) before transitioning.

---

## 4. Cycle controller algorithm

```
on entry (Phase 9 just finished cycle N for release R, or initial entry from setup):

  let frontier_records = governed_stream WHERE
      record_type='requirement_decomposition_node'
      AND is_current_version=1
      AND content.status='deferred'
      AND content.pruning_reason='budget_cap_reached'
      AND content.release_ordinal = R.ordinal
      AND content.produced_in_cycle.cycle_number <= N
  let frontier_count = COUNT(frontier_records)

  let atomic_leaves_produced_this_cycle = COUNT(
      requirement_decomposition_node WHERE
        is_current_version=1
        AND content.status='atomic'
        AND content.release_ordinal = R.ordinal
        AND content.produced_in_cycle.cycle_number = N
  )

  write cycle_iteration (pending) record for (R, N)

  // Decision tree:
  if frontier_count == 0:
    finalize cycle_iteration { termination_reason: 'frontier_empty' }
    if R is the last non-Backlog release AND Backlog records exist:
      transition → backlog_iteration_mirror
    else if R is the absolute last release:
      transition → DONE
    else:
      bump current_release_ordinal; reset current_cycle_number = 0
      transition → cycle_controller (re-entry on next release at cycle 0 — initial phase pipeline)

  else if N >= 1 AND atomic_leaves_produced_this_cycle == 0:
    // Delta cycle could not expand the frontier. Decomposer is stuck.
    finalize cycle_iteration { termination_reason: 'zero_progress' }
    emit operator-visible warning record
    advance release (same logic as frontier_empty branch)

  else if N + 1 > max_cycles_per_release:
    finalize cycle_iteration { termination_reason: 'ceiling_hit' }
    transition → ceiling_mirror

  else:
    finalize cycle_iteration { termination_reason: null }  // ongoing
    bump current_cycle_number
    transition → phase2 (delta-mode entry for cycle N+1 of release R)
```

The zero-progress check ONLY applies to delta cycles (N ≥ 1). Cycle 0 may legitimately produce no atomic leaves yet (still pending decomposition); zero-progress in cycle 0 means the entire decomposer failed to start, which is a phase failure caught elsewhere.

---

## 5. Per-phase delta-mode requirements

Each downstream phase needs an entry point that consumes `(prior_atomic_leaves, new_atomic_leaves)` and produces only the new artifacts.

### Phase 2 — `resumeFromDeferredFrontier(release_ordinal, cycle_number)`

- Gathers `deferred` supersession records for the release whose `pruning_reason === 'budget_cap_reached'`.
- Seeds the saturation queue with them as queue entries — `nodeId`, `parentNodeId`, `depth`, `tierHint` preserved from the deferred record's content.
- The existing `runSaturationLoop` already supports a `resumed?` parameter; extend it with a new mode discriminator:
  - `'process_restart_resume'` (today) — re-opens in-flight nodes after a CLI restart.
  - `'deferred_frontier_resume'` (new) — re-opens closed-as-deferred nodes for a fresh decomposition attempt.
- Fresh per-root LLM budget (`cycle_budget_cap`, flat across cycles).
- All emitted records carry `produced_in_cycle: { R, N }`.
- Identity stability: re-bloomed children attach to the preserved parent_node_id; the deferred-supersession record is itself superseded by a new "re-opened" record at the same node_id.

### Phase 3 — system spec delta

- Entry point reads `getFrozenFrLeaves({ release_ordinal: R, only_produced_in_cycle: N })` instead of all atomic-for-R.
- Produces system-spec deltas: new system boundaries OR additions to existing boundaries. Existing boundary records are read-only.
- Idempotency assertion: every emitted record must have `produced_in_cycle.cycle_number === N`. Asserted at write time.

### Phase 4 — architecture (with stability policy)

- Reads new frozen FR + NFR leaves for `(R, N)`.
- **Default behavior:** components from cycle 0 are LOCKED at top tier. New leaves allocate to existing components by extending responsibilities + `traces_to`. Tier B/C/D growth under existing components is free.
- **Architecture-evolution flow** (when a new leaf doesn't trivially extend any existing component):
  1. **Deep Memory Research Agent query** — surfaces context for the architectural decision:
     > "For new leaf L, find existing components whose Tier-A business capability overlaps with L's responsibilities. Return: (a) ranked candidate components with affinity scores + cited responsibilities; (b) responsibility-shape comparison against the Single-Service Principle rubric (do L's responsibilities share a business capability with candidate X, or are they a distinct bounded context?); (c) any prior cycle's architectural assumptions touching this concern."
  2. **LLM architectural recommendation** — informed by DMR context, produces ONE of:
     - "Extend component X by adding responsibilities R1..Rn. Capability overlap cited: …"
     - "Introduce new component Y. Boundary distinction from existing components: …. Force-fitting onto X would violate cohesion because …"
     The recommendation includes reasoning that explicitly cites the Single-Service Principle (Tier A cohesion) vs SRP (Tier C/D) rubric established in the component decomposition prompts.
  3. **Architecture-evolution mirror to operator** — presents the LLM's recommendation + reasoning + the alternative option with **no pre-selected default**. Operator confirms the recommendation or explicitly chooses the alternative.
- After operator confirmation, Phase 4 emits the chosen artifact (extended component OR new component) with `produced_in_cycle: { R, N }`.
- If no architectural escalation is needed (leaf fits an existing component trivially), Phase 4 emits the responsibility extension silently — no mirror.

### Phase 5 — tech spec delta

- New data-model fields, new API endpoints, new error contracts — appended to existing tech-spec containers for affected components, OR new containers for newly-added components from Phase 4.
- **Schema migration plan:** any new fields touching tables that prior-cycle code wrote to must produce a migration step. The migration is included in cycle N's task plan (Phase 6) ahead of the dependent feature tasks.

### Phase 6 — implementation tasks delta

- Tasks only for new leaves.
- A task may declare `dependency_task_ids` referencing prior-cycle task ids (those are already implemented — this is an ordering hint for executor context, not a re-execution trigger).

### Phase 7 — test plan delta

- New tests for new leaves.
- **Regression suite manifest:** the test-plan delta must declare which prior-cycle test suites form the regression set for this cycle. Configurable via `workflow_runs.regression_scope`:
  - `'all_prior'` (default) — every test from cycles 0..N−1 is in the regression set.
  - `'smoke_only'` — only tests tagged `smoke: true` are in the regression set.
  - Custom manifest tag — operator-provided regression-scope name resolves to a subset.

### Phase 8 — eval delta

- Per-cycle eval evaluates cycle-N tests.
- The eval includes a regression-pass requirement: all tests in the regression manifest from §Phase 7 must still pass. This is the enforcement of invariant I4.

### Phase 9 — execute delta

- Executes only cycle-N tasks (`produced_in_cycle.cycle_number === N`).
- Workspace is the persistent workspace from cycle 0 onward.
- **Pre-execution regression gate:** before launching cycle-N executor sessions, run the regression manifest from §Phase 7. If any test fails, halt with a mirror — cycle-N hasn't run yet, but prior-cycle state is broken. Operator decides: investigate and rerun pre-gate / abort cycle / accept-and-proceed (rare; explicit).
- **Post-execution regression gate:** after cycle-N tasks complete, re-run the regression manifest UNION cycle-N tests. Failures route to quarantine via the existing `executionScheduler.deferred_batch` mechanism with `cycle_number` carried on the quarantine record so subsequent cycles can find them.

---

## 6. Gate replay and human-decision propagation

- All prior MMP decisions, mirror approvals, narrative-curator handoffs from cycles 0..N−1 remain in the governed stream and are visible to cycle-N phases through normal record reads.
- A cycle-N phase that produces an artifact identical to a prior-cycle artifact does NOT re-present a gate (idempotency assertion catches this).
- New artifacts in cycle N trigger their phase's existing gate logic, with a header band on the mirror card: `Cycle {N} delta — {count} new items for {Release.name}`.
- The **architecture-evolution mirror** (§Phase 4) is the only entirely-new gate type introduced by this design.
- The **ceiling mirror** and **backlog-iteration mirror** are new but follow existing mirror infrastructure.

---

## 7. Termination paths and operator surface

### Ceiling mirror (when `N + 1 > max_cycles_per_release`)

Options presented:

- **Extend** — raise `max_cycles_per_release` for THIS release by K cycles (operator picks K). Workflow re-enters Phase 2 for cycle N+1.
- **Accept and advance** — write `cycle_iteration { termination_reason: 'ceiling_hit_accepted' }`, advance to next release. Deferred frontier remains in the stream as a documented gap; not implemented.
- **Abort** — terminate workflow run.

### Backlog-iteration mirror

Triggered after the last non-Backlog release saturates AND Backlog records exist.

Options:

- **Iterate Backlog** — treat Backlog as a normal release; cycle_controller enters cycle 0 for it.
- **Leave as documented gap** (default) — workflow → DONE. Backlog records stay in the stream for human inspection.

### Harness output

Per-cycle status line:

```
R{ordinal} cycle {N} — phase {P} — atomic +{newly_atomic}, deferred frontier {remaining}, cycles {N}/{ceiling}
```

Plus per-cycle summary on cycle termination listing termination_reason and the next state machine destination.

---

## 8. Failure modes and recovery

| Failure | Detection | Recovery |
|---|---|---|
| Cycle N decomposer produces 0 new atomic leaves on frontier | cycle_controller progress counter | terminate release with `zero_progress`; operator-visible warning; advance to next release |
| Cycle ceiling hit | cycle_controller counter | ceiling_mirror with 3 options |
| Pre-execution regression test fails before cycle-N tasks execute | Phase 9 pre-gate | halt; "prior cycle state broken" mirror; operator decides |
| Cycle-N tasks break prior-cycle behavior | Phase 9 post-gate | quarantine cycle-N failing tasks via existing `deferred_batch`; operator-visible report |
| Architecture-evolution required | Phase 4 surfaces "no clean fit" via DMR context | architecture-evolution mirror with LLM recommendation, no default |
| Process restart mid-cycle | existing `--resume-from-db` | resumes at last completed phase of last in-flight cycle; cycle_iteration record reveals state |
| `produced_in_cycle` field missing on a record produced during a cycle | idempotency assertion in writer | hard fail at write time — design defect |
| Two delta cycles re-decompose the same node | re-bloom check verifies the deferred record is the latest at that node_id | hard fail; design defect |

---

## 9. Files that must change

No code is required at the time this design is saved. The list below is the surface the implementation will touch.

- `src/lib/types/records.ts` — `CycleIterationContent`; `produced_in_cycle` field on existing content interfaces.
- `src/lib/database/schema.ts` — new workflow_runs columns.
- `src/lib/database/init.ts` — migration entries for new columns.
- `src/lib/orchestrator/stateMachine.ts` — `cycle_controller`, `ceiling_mirror`, `backlog_iteration_mirror` sub-phases; new edges.
- `src/lib/orchestrator/phases/cycle_controller.ts` — NEW. §4 algorithm.
- `src/lib/orchestrator/phases/phase2.ts` — `resumeFromDeferredFrontier` entry; deferred-frontier-resume mode in `runSaturationLoop`.
- `src/lib/orchestrator/phases/phase3.ts`..`phase9.ts` — delta-mode entry points; idempotency assertions on `produced_in_cycle`.
- `src/lib/orchestrator/phases/phaseContext.ts` — frozen-leaves filter functions accept an optional `only_produced_in_cycle` parameter.
- `src/lib/orchestrator/phases/phase4_2a.ts` (or saturation driver) — architecture-stability default + Deep Memory Research Agent integration + architecture-evolution mirror.
- `src/lib/orchestrator/phases/phase7.ts` — regression suite manifest output.
- `src/lib/orchestrator/phases/phase9.ts` — pre- and post-execution regression gates.
- `src/lib/orchestrator/executionScheduler.ts` — accept release+cycle scoping for the per-wave run.
- `src/lib/orchestrator/quarantineLedger.ts` — quarantine records carry `cycle_number`.
- New prompts (or extensions):
  - architecture-evolution mirror system prompt
  - ceiling mirror system prompt
  - backlog-iteration mirror system prompt
  - delta-phase header injection ("This is cycle N for release R")
  - cycle_iteration narrative-curator handoff template
- `src/cli/janumicode.ts` (or harness module) — cycle-aware status line.

---

## 10. Tests required

- **Unit — cycle_controller decision logic.** All four exit paths (frontier_empty, zero_progress, ceiling_hit, advance).
- **Unit — `resumeFromDeferredFrontier`.** Queue reconstruction from supersession records; identity preservation (node_id stable across cycles).
- **Unit — each phase's delta-mode entry.** Idempotency assertion rejects re-processing of prior-cycle leaves.
- **Unit — Phase 9 pre/post regression gates.** Manifest resolution; failure routing.
- **Unit — Phase 4 DMR query envelope + mirror rendering** with mocked DMR responses.
- **Integration — minimal cycle round-trip.** A fixture intent that intentionally exhausts cycle-0 per-root budget on one root → asserts cycle 1 picks up exactly that root's frontier → asserts cycle 1 produces new atomic leaves → asserts Phase 9 implements only the new tasks.
- **Integration — ceiling-hit path.** Mocked operator chooses each of `extend` / `accept` / `abort`.
- **Integration — prior-cycle regression failure after cycle-N execution.** Routes through quarantine; operator-visible.
- **Integration — Backlog iteration off.** Default path: workflow terminates DONE with Backlog records intact.
- **Integration — Backlog iteration on.** Operator opt-in path: Backlog iterates as a normal release.
- **Regression — todo-app fixture.** Full pipeline against existing fixture with cycle 0 saturating; must produce identical output to today (cycle 0 → frontier_empty → advance → … → DONE).

---

## 11. Implementation roadmap

Each step is independently testable and shippable. After steps 1–2, the codebase has identical behavior to today; the loop activates in step 4.

1. **Data model + state machine skeleton.** Add `CycleIterationContent`, `produced_in_cycle`, workflow_runs columns, `cycle_controller` sub-phase. cycle_controller always terminates immediately (no looping). Existing tests pass for the no-cycle case (cycle 0 saturates → frontier_empty → DONE).
2. **Delta-mode entry points (no looping yet).** Every phase gets a delta entry point that, in cycle 0, behaves identically to today. Idempotency assertions in place but untested by actual delta input.
3. **Phase 2 deferred-resume mode.** `resumeFromDeferredFrontier` lands with unit tests using fixtures of deferred records.
4. **Loop activation.** cycle_controller actually loops. Integration test with intentionally tight budget.
5. **Architecture-stability policy + DMR-informed architecture-evolution mirror.**
6. **Regression gates in Phase 9** (pre + post).
7. **Ceiling mirror + backlog-iteration mirror.**
8. **Harness + telemetry.**

---

## 12. Locked design decisions (for traceability)

These were resolved during the design discussion on 2026-05-18:

- **Q1 — Backlog iteration:** Operator opts in via mirror after last non-Backlog release saturates. Default is "leave as documented gap." Rationale: Backlog items are by definition things the release_plan could not place; auto-implementing them risks producing code for speculative or out-of-scope features.
- **Q2 — Architecture-evolution default:** No static default. Phase 4 produces an LLM recommendation informed by Deep Memory Research Agent context, grounded in the Single-Service Principle (Tier A) vs SRP (Tier C/D) rubric established in the component decomposition prompts. Operator mirror presents the recommendation + reasoning + alternative with no pre-selection.
- **Q3 — Regression scope:** Configurable via `workflow_runs.regression_scope`. Default `'all_prior'` (every test from prior cycles is in the regression set).
- **Q4 — `produced_in_cycle` storage:** In-content field, not a separate column on governed_stream. Delta queries use SQLite `json_extract`; volumes are acceptable.

Additional locked decisions:

- Loop boundary: cycle_controller sub-phase, not orchestrator-wrapper or in-Phase-2.
- Phase order: Phase 9 of cycle N completes before Phase 2 of cycle N+1 starts (deferred frontier is implementation-backlog, not parallel work).
- Release ordering: release-major (finish Release 1 across all its cycles before touching Release 2).
- State propagation: prior human decisions auto-apply; only new artifacts trigger new gates.
- Identity stability: deferred node's UUID preserved across cycles; new supersession on same node_id.
- Cycle budget: fresh per-root budget per cycle; flat across cycles (no growth/shrink scaling).
- Cycle ceiling: configurable, default 5. Ceiling-hit triggers operator mirror with extend/accept/abort.
