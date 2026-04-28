# Wave R — Phase 9 Release-Plan Execution Sequencing

> **Status:** Design draft. Not yet implemented.
> **Predecessors:** Wave 6 (Phase 2 recursive requirements decomposition, shipped 2026-04-20). Wave 7 (Phase 4 recursive component decomposition, designed in [`wave7_phase4_recursive_decomposition.md`](wave7_phase4_recursive_decomposition.md)). Wave 8 (Phase 6 recursive task decomposition, deferred).
> **Calibration motivation:** [`cal-22b`](../test-and-evaluation/calibration-workspaces/calibration-workspace-cal-22b/) Phase 9 ran one executor invocation against TASK-001 ("Set up the project structure and implement the primary module"), produced 4 stub files, hit a sandbox block trying to verify, and returned `success`. The reasoning_review reasonably flagged it as `completeness_shortcut`. With Wave 7 / Wave 8 producing hundreds of leaf tasks, the failure surface multiplies; Phase 9 needs a sequencing model, not a `for...of`.

---

## 1. Problem statement

Phase 9 today is `for (const task of orderedTasks) { await executor.execute(task); }`. The ordering is one-shot topological sort by `dependency_task_ids`. Three problems compound at scale:

1. **No release awareness.** [Phase 1.8](../.janumicode/prompts/phases/phase_01_intent_capture/sub_phase_01_8_release_plan_approval/release_plan_approval.product.system.md) produces a `release_plan` artifact with explicit ordered releases (e.g., "Release 1 = minimal end-to-end vendor-matching slice; Release 2 = HOA governance; Release 3 = financial settlement"). Phase 9 ignores it. Every task runs regardless of release_id, in arbitrary topo-sort order. There is no concept of "ship Release 1 first, gate on its acceptance, then start Release 2."
2. **No granularity policy.** With Wave 8's recursive task tree, the leaf task is the executor's natural unit. But Phase 9 has no rule for whether to invoke per leaf, per parent, or in some batched mid-tier shape. It currently iterates whatever it's given.
3. **No failure containment.** A single failed task today aborts the for-loop or skips silently depending on `failureHandler` config. With hundreds of leaves and a non-zero failure rate per leaf (real-world LLM coding agents fail 5–20% of the time on novel tasks), the workflow needs explicit per-task retry budgets, quarantine semantics, and per-wave human-review gates — not a single global "abort or skip" knob.

Plus operational concerns: how does workspace state stay coherent across hundreds of writes? What happens on resume mid-wave? How does the executor know which release / wave it's working on?

## 2. Goal

Replace Phase 9's flat for-loop with a **wave-based execution scheduler** that:

- Slices the leaf-task set into ordered execution waves derived from the `release_plan`.
- Within each wave, runs leaves in dependency topo-sort.
- Gates on wave completion before advancing (human review of the wave's actual deliverables vs. its release commitment).
- Contains failures via per-leaf retry budgets + quarantine queue + deferred-batch follow-up wave.
- Maintains workspace coherence via strict `write_directory_paths` enforcement plus optional feature-branch isolation.
- Resumes deterministically from any mid-wave point.

**Non-goals (this wave):**
- Recursive task decomposition itself (Wave 8).
- Recursive component decomposition (Wave 7).
- Parallel execution of independent leaves — sequential first; parallelism is a follow-up after the sequential model is calibrated.
- Cross-release rollback / hotfix flows.

## 3. Concept model

```
release_plan (Phase 1.8)
  ├─ Release 1: "Vendor-matching MVP"
  │   └─ release_ordinal: 1
  ├─ Release 2: "HOA governance core"
  │   └─ release_ordinal: 2
  └─ Release 3: "Financial settlement & compliance"
      └─ release_ordinal: 3

implementation_plan (Phase 6 / Wave 8)
  ├─ task tree, each leaf carries:
  │   ├─ release_id (inherited from FR via traces_to → journey → release)
  │   ├─ release_ordinal
  │   ├─ component_id (Wave 7 leaf)
  │   ├─ dependency_task_ids
  │   ├─ write_directory_paths
  │   └─ verification_step

execution_schedule (Wave R — new)
  ├─ Wave 1 — Release 1 leaves, topo-sorted
  │   ├─ leaf-001 → invocation → reasoning_review → ledger
  │   ├─ leaf-002 → ... 
  │   └─ wave_gate (human review of cumulative deliverable)
  ├─ Wave 2 — Release 2 leaves, topo-sorted
  │   └─ ...
  └─ Wave N+1 — Deferred-batch wave (quarantined leaves from prior waves)
      └─ retry with augmented context, surfaces unsticking events
```

Key invariants:

1. **Wave boundary = release boundary.** One wave executes the full set of leaves whose `release_id` matches the current release_ordinal. No spillover.
2. **Wave gate is mandatory.** Even on a fully passing wave, the human approves the wave's cumulative output before the next wave starts. (Auto-approve permitted via `--auto-approve` for unattended calibration; humans see the same gate UI in interactive runs.)
3. **Quarantined leaves move forward, not block.** A leaf that exhausts its retry budget within a wave does NOT block the wave from gating. It lands in the deferred-batch wave with a `quarantine_reason` and full context for the retry.
4. **Workspace state is per-wave snapshotted.** At wave-start, snapshot `write_directory_paths` (already done per-task by `ExecutorAgent.snapshotWriteDirectories`); at wave-end, an aggregated diff is presented in the wave gate. On wave rollback, the snapshot reverts the wave's writes.

## 4. Per-leaf execution loop (within a wave)

```
for leaf in topo_sort(wave.leaves):
  for attempt in 1..retry_budget:
    invocation = executor.execute(leaf, ...)
    review = reasoning_review.review(invocation)

    if review.overall_pass and tests_pass(leaf):
      record success → wave.successful.append(leaf)
      break

    if attempt < retry_budget:
      build retry context (prior invocation + review flaws + tests_failed)
      continue

    # exhausted
    enqueue_quarantine(leaf, reason=last_review.flaws)
    wave.quarantined.append(leaf)
    break
```

Three things are different from today:

1. **Retry budget is explicit** (`config.execution.leaf_retry_budget`, default 3). Today's `failureHandler` is binary (abort vs skip); Wave R replaces it with a counted retry that carries augmented context (prior failure trace, reasoning_review findings, test output) into the next attempt.
2. **`tests_pass(leaf)` is now a real check.** [Phase 9.2's TestRunner](../src/lib/orchestrator/testRunner.ts) currently returns `suite_results: []` regardless of what the executor wrote; this wave moves test execution **into the per-leaf loop** so test failure is part of the retry decision, not a separate Phase 9.2 sub-phase. (Phase 9.2 still exists for whole-suite test reporting at wave gate time.)
3. **Quarantine has structure.** A `task_quarantine` record carries: leaf id, all prior `agent_invocation` ids, all prior reasoning_review findings, last test output, last file diff. Quarantined leaves are NOT failures of the workflow — they're surfaced as candidates for the deferred-batch wave with full context.

## 5. Wave gate UX

Each wave ends with one mirror card:

```
Wave 1 — "Vendor-matching MVP"
  Release ordinal: 1
  Leaves: 47 total
    ✅ Successful: 41
    ⚠ Quarantined: 6 (deferred to retry-batch wave)
  Files written: 89 across 5 components
  Test results: 156 passed / 4 failed (in 4 leaves; all 4 quarantined)
  Cumulative diff: [view]
  Reasoning_review summary:
    completeness_shortcut: 0
    invalid_inference: 1 (in leaf-023, quarantined)
    other: 0

  Next wave: Release 2 — "HOA governance core" (134 leaves)

  [ Approve and advance ]   [ Reject — rollback wave ]   [ Investigate quarantined ]
```

Reject = revert the wave's writes via the snapshot, mark every leaf in the wave as `status='wave_rejected'`, surface a free-form reason input. Investigate = pause for human inspection before deciding; resume returns to the same gate.

## 6. Deferred-batch wave (final wave)

After the last release wave completes, if any leaves are quarantined, a final **deferred-batch wave** runs. Its job is to retry every quarantined leaf with **augmented context**:

```
deferred-batch wave context = {
  leaf_id, original_task_description, prior_attempts: [
    { attempt_n, reasoning_review_flaws, test_failures, file_diff }
  ],
  hint: "This task was quarantined after N attempts in Wave M. The flaws were ..."
}
```

The deferred-batch wave has its own retry budget (`config.execution.deferred_retry_budget`, default 2) and its own gate. Leaves that quarantine again become **terminally deferred** — they're surfaced in the workflow run summary as known gaps requiring human attention.

## 7. Workspace state policy

Two modes, selectable per workflow:

### Mode A — In-place (default for calibration)

- Every leaf writes to its declared `write_directory_paths` directly in the workspace.
- `ExecutorAgent.snapshotWriteDirectories` already pre/post-snapshots; the wave-level aggregator concatenates per-leaf snapshots into a wave-level diff for the gate.
- Wave rejection rollback: reverse-apply the snapshot diff (file content from pre-snapshot if pre exists, delete file if pre doesn't exist).
- **Conflict semantics:** if leaf-A and leaf-B both declare overlapping `write_directory_paths` and both write to the same file, the orchestrator surfaces a merge-conflict event rather than letting the second write silently clobber the first. Topo-sort enforces ordering; if both are at the same topo-rank, an explicit `merge_strategy` field on the second-writer leaf is required (`extend | replace | manual`).

### Mode B — Feature-branch (production / brownfield)

- Each wave runs on its own git branch, branched from the workflow_run's base commit.
- Leaves within a wave commit incrementally; wave gate is the merge commit back to the integration branch.
- Wave rejection = `git branch -D wave-N-branch` after operator confirmation.
- **Not implemented in this wave.** Mode A is sufficient for calibration. Mode B becomes Wave R+1 once Mode A is calibrated and brownfield runs need it.

## 8. Resume semantics

The progress-based quiescence detector (Wave 6 / cal-3) and the `--resume-from-db` mechanism stay. New behavior at Phase 9:

- On resume into Phase 9, the scheduler reads the current `execution_wave` ledger and resumes mid-wave.
- A leaf with a complete `agent_invocation` + `reasoning_review_result` + `task_test_result` triple is treated as **completed-don't-rerun**. A leaf with partial records (e.g., agent_invocation but no reasoning_review) is treated as **interrupted-resume-from-attempt-K** where K is the next attempt index.
- Wave gates already preserve their decision via `decision_trace` records; resuming after an approved gate skips that gate.
- Quarantine ledger persists; on resume, the deferred-batch wave still runs against the right set.

## 9. Schema additions

### New record types

| Record type | Purpose |
|---|---|
| `execution_wave_started` | Wave N kickoff. Carries release_id, release_ordinal, leaf count, per-component leaf distribution. |
| `execution_wave_completed` | Wave N close. Carries success / quarantine / rejected counts, file-write summary, test summary, reasoning_review-flaw summary. |
| `task_quarantine` | One record per quarantined leaf. Carries full retry trace + last failure reason. |
| `task_test_result` | Per-leaf test execution result. Carries pass/fail counts, output, duration. (Today's `test_results` in Phase 9.2 stays as the wave-level aggregate.) |
| `wave_gate_decision` | Approve / reject / investigate decision with reason text. |

### Existing schemas extended

- `implementation_plan_task` — adds `release_id`, `release_ordinal` (already specced for Wave 6 / 8 inheritance; surfacing here for completeness).
- `phase_gate_evaluation` — Phase 9 gate evaluates against wave-completion criteria, not flat task-completion.

### `workflow_runs` columns

- `current_execution_wave INTEGER DEFAULT 0`
- `total_execution_waves INTEGER DEFAULT 0`
- `quarantined_leaf_count INTEGER DEFAULT 0`
- `terminally_deferred_leaf_count INTEGER DEFAULT 0`

## 10. Configuration additions

```jsonc
{
  "execution": {
    "leaf_retry_budget": 3,
    "deferred_retry_budget": 2,
    "workspace_mode": "in_place", // "in_place" | "feature_branch" (latter not yet implemented)
    "auto_approve_wave_gates": false, // calibration may set true via --auto-approve
    "merge_conflict_default_strategy": "manual",
    "tests_per_leaf": {
      "enabled": true, // run tests after each leaf, gate retry on test pass
      "test_command_resolution": "package_json_scripts" // | "explicit_per_leaf" | "framework_autodetect"
    }
  }
}
```

## 11. Files to create / modify

### Create

| Path | Purpose |
|---|---|
| `src/lib/orchestrator/executionScheduler.ts` | Wave-based scheduler — slices leaves by release_ordinal, runs wave loop, manages quarantine queue, fires wave gates. |
| `src/lib/orchestrator/leafTestRunner.ts` | Per-leaf test execution. Resolves a test command from `package.json` / `pyproject.toml` / explicit override; runs in workspace; parses output. Distinct from the wave-aggregate `testRunner.ts`. |
| `src/lib/orchestrator/waveGate.ts` | Wave-completion mirror generation + pauseForDecision integration. |
| `src/lib/orchestrator/quarantineLedger.ts` | Quarantine queue management — enqueue, dequeue for deferred-batch, build augmented context. |
| `src/lib/orchestrator/workspaceSnapshot.ts` | Per-wave aggregated snapshot diff (concatenates per-leaf `ExecutorAgent.snapshotWriteDirectories` outputs). Reverse-apply on wave rejection. |
| `.janumicode/schemas/artifacts/execution_wave_started.schema.json` | New record schema. |
| `.janumicode/schemas/artifacts/execution_wave_completed.schema.json` | New record schema. |
| `.janumicode/schemas/artifacts/task_quarantine.schema.json` | New record schema. |
| `.janumicode/schemas/artifacts/task_test_result.schema.json` | New record schema. |
| `.janumicode/schemas/artifacts/wave_gate_decision.schema.json` | New record schema. |
| `src/webview/components/ExecutionWaveCard.svelte` | Wave gate card UI. |
| `src/webview/components/QuarantineLedgerCard.svelte` | Quarantine queue visualization. |
| `src/test/unit/orchestrator/executionScheduler.test.ts` | Unit tests (slicing, topo-sort, retry budget, quarantine, wave gate, resume). |

### Modify

| Path | Change |
|---|---|
| `src/lib/orchestrator/phases/phase9.ts` | Replace flat for-loop with `executionScheduler.run(waves)`. Phase 9.2 (existing test runner) becomes the wave-aggregate reporter; per-leaf tests move to `leafTestRunner`. |
| `src/lib/orchestrator/testRunner.ts` | Refocus on suite-level aggregation; per-leaf execution lifts to `leafTestRunner.ts`. |
| `src/lib/orchestrator/failureHandler.ts` | Replace abort/skip binary with retry-budget + quarantine semantics. May simplify down to a thin wrapper around the new scheduler. |
| `src/lib/database/schema.ts` | Add four workflow_runs columns + new record_type values. |
| `src/lib/types/records.ts` | Type definitions for new record types. |
| `src/lib/config/configManager.ts` | Add `execution.*` config block. |

## 12. Tests

1. **Single-wave happy path:** one release, three leaves, all pass first try → wave completed event, no quarantine, gate auto-approves under `auto_approve_wave_gates=true`.
2. **Multi-wave sequencing:** three releases with ordinals 1/2/3 → wave 1 runs first; wave 2 doesn't start until wave 1 gates; gates fire in release order.
3. **Topo-sort within wave:** leaf-B depends on leaf-A; both in same wave; A runs before B regardless of input order.
4. **Cross-wave dependency:** leaf-A in wave 1, leaf-B (depends on A) in wave 2; runs correctly. (Cross-wave dependencies should be rare — release_plan structure should keep them within-wave — but the scheduler must handle them correctly when the LLM produces them.)
5. **Retry exhaustion + quarantine:** leaf fails reasoning_review × `retry_budget` times → lands in quarantine ledger; wave still gates; deferred-batch wave runs after final release wave.
6. **Wave rejection rollback:** wave 1 produces 5 file writes; gate rejected; workspace snapshot reverses all 5; resume from same point produces same wave 1 again.
7. **Resume mid-wave:** kill mid-leaf-B execution; resume picks up leaf-B at attempt N+1 with prior failure context; wave still completes correctly.
8. **Resume after wave gate approval:** kill after wave 1 gate approved; resume starts at wave 2.
9. **Conflict detection:** leaf-A and leaf-B declare overlapping `write_directory_paths` and both write the same file → merge_conflict event surfaced; `merge_strategy='manual'` → human resolution required; `replace` → second wins; `extend` → append-merge applied.
10. **Test failure as retry trigger:** leaf-A's invocation passes reasoning_review but `leafTestRunner` reports test failure → counted as failure for retry budget.
11. **Empty wave:** release with zero leaves (Phase 6 produced no tasks for that release_id) → wave skipped; no gate fired; logs explicit reason.
12. **Quarantined leaf rescued in deferred-batch wave:** quarantine + augmented retry context produces a passing run on second pass; ledger updated to "rescued."
13. **Terminally deferred:** deferred-batch wave also fails for a leaf → workflow run summary surfaces it as known gap.

Plus integration tests at `src/test/e2e/harness-suite/`:

14. End-to-end: small fixture (todo-app with 2 releases, 8 leaves) runs through full Phase 9 with mocked LLM → all waves complete, deferred-batch empty.
15. End-to-end with injected failure: same fixture but force one leaf to fail × retry_budget → quarantine ledger entry; deferred-batch wave rescues; final summary correct.

## 13. Calibration plan

- **waveR-cal-1:** small fixture (3 releases, 6 leaves total) — proves wave sequencing, gate UX, retry budget, quarantine flow on a synthetic input where outcomes are predictable.
- **waveR-cal-2:** Hestami-cal-22b's 30-task plan re-run under Wave R scheduler — same input that previously produced one stub file, now should produce per-task verified deliverables across release-sliced waves. Calibrates: actual leaf success rate, average retry count, quarantine rate.
- **waveR-cal-3:** Hestami spec post-Wave-7 (recursively decomposed components → recursively decomposed tasks → real leaf count of ~200–500). Calibrates wave-gate cadence under real scale; informs whether wave size needs further sub-slicing.
- **waveR-cal-4:** brownfield resume from cal-3 mid-wave to validate resume semantics at scale.

## 14. Open design questions

1. **What's the wave size limit before sub-waves?** A 200-leaf wave is operationally unwieldy — humans can't sensibly review a wave gate for that. Options: hard cap at ~30 leaves, splitting a release into multiple sub-waves; or no cap, with the gate UI handling scale via grouping by component. **Tentative:** no hard cap; gate UI groups by component_id with collapse / expand. Calibrate cal-3 outcomes to revisit.
2. **Should test execution itself be a leaf, or implicit per-leaf?** Today's design embeds it in the per-leaf loop. Alternative: tests are themselves Phase 6 leaves the executor authors and runs. **Tentative:** keep tests implicit per-leaf for the production code itself; test-authoring leaves are still leaves but their `verification_step` is "run the test suite of which this leaf's test is a part" (recursive — fine, terminates at concrete test files). Refine via cal-2 outcomes.
3. **Cross-leaf shared dependencies (e.g., a database migration leaf that 10 other leaves depend on).** Handled correctly by topo-sort; question is whether to surface a "blast radius" warning when one leaf has many dependents. **Tentative:** yes, warn when a leaf's `reverse_dependents > 5`; helps the human understand wave-gate impact before approving.
4. **Parallelism within a wave for independent leaves.** Tempting but defers. Sequential first to make the per-leaf debugging story clean; parallelism is an optimization once the model is calibrated. Track as deferred follow-up.
5. **What happens if `release_plan` is empty (no Phase 1.8 artifact)?** Backward-compat: scheduler degrades to single-wave-everything mode, mirroring today's behavior. Detect via `if (releases.length === 0) executionScheduler.runSingleWave(allLeaves)`. Logged warning, not an error.
6. **Permissions in calibration mode.** [Per current discussion]: calibration runs need `--dangerously-skip-permissions` so the executor can self-verify via Bash; production keeps `acceptEdits` to surface permission requests to the human. This belongs in `agentInvoker` not the scheduler, but the scheduler must know about the mode to set retry expectations correctly (a permission denial isn't a retry-eligible failure).
7. **Per-wave reasoning_review at wave gate.** Today reasoning_review fires per leaf. Should there ALSO be a wave-level reasoning_review summarizing "did this wave coherently deliver Release N's commitment"? **Tentative:** yes, optional, gated by `decomposition.wave_reasoning_review_on_gate` flag (off by default until Wave R-cal-3 informs).

## 15. Deferred to later waves

- **Mode B (feature-branch isolation)** — Wave R+1, requires git integration in the executor.
- **Parallelism within a wave** — Wave R+2.
- **Cross-release rollback / hotfix** — separate design (would touch Phase 0.5 cross-run impact too).
- **Wave-level reasoning_review** — gated behind config flag; calibrates in cal-3.

## 16. Acceptance criteria for Wave R close-out

- [ ] All 15 unit + e2e tests pass; full test suite stays green.
- [ ] Hestami calibration (post-Wave-7-Wave-8 recursive trees) runs Phase 9 without single-task abort, producing per-component verifiable artifacts.
- [ ] Wave gates fire in release order; auto-approve mode works for unattended runs.
- [ ] Quarantine ledger captures and rescues at least one leaf in calibration.
- [ ] Resume from mid-wave kill produces identical final output (idempotent).
- [ ] Workspace snapshot rollback validated end-to-end on at least one rejected wave.
- [ ] Phase 9.5 mirror is replaced by wave gates; Phase 9.6 phase gate evaluates wave-completion criteria.
- [ ] `task_quarantine` records carry sufficient context that a human (or the deferred-batch wave) can act on them without re-loading prior phases.

## 17. Relationship to existing Phase 9 design

| Today | Wave R |
|---|---|
| Single phase loop over flat task list | Wave-based scheduler over leaf-grouped tasks |
| `failureHandler.handleTaskFailure(task, err)` returns abort/skip | `executionScheduler` retries with budget, quarantines on exhaust |
| `Phase 9.2 testRunner.run()` reports flat suite results | Per-leaf `leafTestRunner` + wave-aggregate reporter (existing testRunner refocused) |
| `Phase 9.5` execution-completion mirror | Per-wave `wave_gate` + final workflow-closure mirror |
| `Phase 9.6` phase gate (single evaluation) | Per-wave gate decisions logged; final phase gate aggregates |
| Resume from `--resume-at-phase 9` reruns from start | Resume into mid-wave at the leaf's next attempt |

The **phase 9 sub-phase numbering survives** — 9.1 (execution), 9.2 (test reporting), 9.3 (eval), 9.5 (mirror), 9.6 (phase gate). The semantics of each sub-phase shift:

- 9.1 = scheduler-driven wave execution loop
- 9.2 = wave-aggregate test reporting (per-leaf testing happens INSIDE 9.1)
- 9.3 = eval execution (unchanged in shape; gets richer inputs from 9.1)
- 9.5 = wave gates + final workflow-closure mirror
- 9.6 = phase gate aggregating per-wave gate decisions

This keeps the spec's phase ordinals stable while the underlying behavior evolves.
