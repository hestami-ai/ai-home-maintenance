# JAN-EXECREM-DR-001 — Tier 3C-ii Remediation: Detailed Implementation Roadmap

*v0.1.0 · 2026-07-24 · Design authority `JAN-EXECREM-DS-001` v0.1.0. Findings register:
`JAN-EXECPLAN-T3Cii-review-findings-2026-07-24.md` (46 surviving). Working papers:
`JAN-EXECREM-design-working-papers.md`.*

## 1. Scope and land order

Eighteen work packages, **WP-0 → WP-17**, each independently landable and centrally gated. Sponsor decisions:
**all 40 CONFIRMED findings in scope** (+ dispositions for the 6 PLAUSIBLE); **fix forward, no gating**.

**Critical path:** `WP-0/WP-1 → WP-2 → WP-3 → WP-4 → WP-5 → WP-6 → WP-7`, with `WP-8` landing early off WP-1 and
unlocking the `WP-9…WP-15` band, then `WP-16` (anti-recurrence) and `WP-17` (records).

Ordering rationale, stated once: the **two blockers-first exceptions** are deliberate. WP-0 and WP-1 precede
even the BLOCKER fixes because (a) ~35 test arrangements currently seed non-QUEUED step states *through*
`ProposeExecutionPlan`, so landing the at-rest rule first would force weakening the rule to keep tests green —
**the exact inversion that produced this defect family**; and (b) `ExecutionStepSucceeded` is the only step event
in `RATIFIED_EVENT_PAYLOADS`, so emitting a new field before regeneration makes **every BRANCH completion reject
at runtime**, and the reference seed authors no BRANCH, so it would give zero signal.

## 2. Work packages

| WP | Title | Covers | Depends on | Concurrent with |
|---|---|---|---|---|
| **0** | Baseline evidence, test seeding seam, fixture migration (SM-7) | *(enabler)* | — | WP-1 |
| **1** | Vocab + regeneration batch (ALL contract field changes, one commit) | contract half of F-01, F-15/21/23, F-25, F-30, F-31, F-37 | — | WP-0 |
| **2** | `GateContext` + memoization (pure refactor, zero semantic change) (SM-1) | F-34 | WP-0 | WP-1, WP-8 |
| **3** | Entry seeding, one entry definition, graph-incoherence fail-closed floor | **F-03, F-04, F-05** (3 BLOCKERs, one mechanism) | WP-2 | WP-6/7/8 |
| **4** | Canonical 4-valued edge disposition + 3-valued liveness + coherence | **F-06**, F-16, F-17, F-20, F-38, F-46; READ half of F-15/21/23 | WP-3 | WP-6/7/8 |
| **5** | FAILED-arm abandonment across all three planes | *(restores the capability WP-4 removes)*; F-12 negative coverage | WP-4 | WP-6, WP-7 |
| **6** | Propose-time contract validator: one carrier + step-set rules (SM-4) | **F-09, F-10**, F-27 (by prevention), F-33 | WP-0, WP-3 | WP-4/7/8 |
| **7** | Condition-grammar hardening + shared fail-closed wrapper (SM-5) | F-22, F-39, F-41, F-43, F-44, F-32, F-35, F-46 | WP-6 | WP-4/5/8 |
| **8** | `STEP_COMMAND_SPECS` + `advanceStep` v2 (SM-2, SM-3) | *enabler for* F-11/12/13/14/18/19/25/26/28/40/42 | WP-1 | WP-2/3/4/6/7 |
| **9** | `requireFrom` kill-test battery + machine-arrow ledger | F-11, F-12, F-13, F-14, F-18, F-19, F-40 (+2 new gaps) | WP-8 | WP-10, WP-13 |
| **10** | Settlement view + branch-decision totality (*decides once*) | **F-02, F-07, F-24**; WRITE half of F-15/21/23 | WP-1, WP-4, WP-8 | WP-9/11/13 |
| **11** | RPH-EXE-006 explicit result + zero-subject floor gate | **F-01** (both limbs) | WP-1, WP-8 | WP-10/12/13 |
| **12** | Plan liveness, PWU openness, one success definition, skip authorization | **F-08**, F-26, F-28, F-30, F-42 | WP-1, WP-8, WP-10 | WP-11/13/14 |
| **13** | Event-payload projections + total attempt fold | F-25, F-36, F-45 | WP-1, WP-8 | WP-9/10/11/12 |
| **14** | Binding provenance + prune provenance (derived, never asserted) | F-31, F-37 | WP-1, WP-4, WP-8 | WP-12, WP-13 |
| **15** | Affordance fidelity — one plan-aware projection, zero UI conditions (SM-8) | F-29 | WP-5, WP-8 | WP-12/13/14 |
| **16** | Conformance registries + anti-recurrence gates (SM-6) | *(anti-recurrence, all six families)* | WP-0 skeleton; rows accrue from WP-3 | all |
| **17** | Documentation, divergence, residual-record reconciliation | F-38 (doc), F-42 (record), + every disclosed divergence | WP-15, WP-16 | — |

## 3. Gate obligations

**Every WP:** central gate only, never in a sub-agent. Run under Node/vitest (the engine's `better-sqlite3`
refuses Bun). No WP lands with a weakened assertion to keep a test green — if a test must change, the change is
enumerated in the commit.

Per-package specifics worth pinning:

- **WP-1** — `bun run gen` + prettier **in the same commit** (regen output is format-stale, not content-stale).
  Assert every new field is OPTIONAL and that no emitter yet produces it.
- **WP-2** — a deterministic **call-count** kill test (the guarded evaluator invoked at most once per edge; 101×
  today at width 100), *not* a wall-clock test.
- **WP-3** — kill test: an entry-edge plan in a MULTI-step graph ⇒ `startable = [s1]`, `prunable = []`, the two
  sets disjoint; plus a persisted cyclic/entry-less plan constructed directly (bypassing propose) ⇒ `prunable = []`
  and `GRAPH_INCOHERENT`. Live through `Engine` + `SqliteStorageAdapter`. E2E: execution-flow + execution-sequencing.
- **WP-4** — property test over an 8-plan fixture matrix **including both seed shapes**; linear/graph parity matrix
  iterated over `STEP_MACHINE.states` (RED on FAILED today); machine-derivation pin; the live six-command F-06
  sequence; a causality assertion for F-16.
- **WP-5** — `bun run gen:transitions` + prettier; full vitest **including** `rph-engine`'s transitions /
  emitted-event / replay-conformance suites; a re-issue kill test plus one positive per widened source state.
- **WP-6** — anti-vacuity test = a duplicate step id on a plan with `transitions: []` (RED under any mutant that
  folds step rules into `validateTransitionGraph`); exhaustive table over all ten `StepStateSchema` values.
- **WP-8** — **mandatory pre-landing grep** of every `error.code` / `error.message).toContain(` assertion on the
  nine step commands across packages *and* `apps/rph-demo/e2e` (survey run, clean).
- **WP-9** — per case: REJECTED + `RPH_ILLEGAL_STATE_TRANSITION` + marker + rendered `drivesFrom` set + **zero**
  new events of any type + unchanged revision + unchanged `stepState`. **Live mutation red-proof required.**
- **WP-12** — matrix generated from the spec table proves **totality only**; the *classification* is proved by
  hardcoded named cases that do **not** read the table (complete-under-superseded REJECTS, fail-under-superseded
  ACCEPTS, cancel-under-superseded ACCEPTS…). This prevents the table and its test agreeing on a wrong value.
- **WP-13** — registry-totality test enumerating `/^ExecutionStep/` from the generated registry (ten types);
  emitted-payload `safeParse` for every step event driven through the **real** dispatch path.
- **WP-15** — both-sides boundary pairs, so the **over-refusal** mutant dies too (`ACTIVE+FAILED ⇒ ['retry']`,
  not merely `CANCELLED+FAILED ⇒ []`).
- **WP-16** — the gate mechanism must itself be **selftested**: each analysis primitive is fed literal synthetic
  input and asserted to REPORT FAILURE. Distinct `(ruleId, refusalMarker)` pairs so two rows cannot be satisfied
  by one refusal.

**Series gate package `G-EXECREM-001`:** check-types · test · lint 0 · boundary 0 · svelte-check 0 · Playwright ·
`rph-engine` 69 (seed unchanged) · the three registry-totality gates · every new/repaired guard live
mutation-red-proofed.

## 4. Verification discipline (non-negotiable, from DS-001 §4)

1. **Live mutation red-proof** for every guard added or repaired — weaken it, watch the *named* test go RED,
   revert. Performed by the implementing engineer, never delegated to a sub-agent.
2. **No vacuous negatives.** Where an earlier guard or the machine itself would refuse the same input, the kill
   test must use a fixture that isolates *this* guard (this is why WP-0's seeding seam exists).
3. **Positive path per change** — the widest legitimate input must still be accepted; the reference seed must
   drive unchanged.
4. **Post-build adversarial verification** before the series is called complete — the obligation Tier 3C-ii
   skipped, and the reason this program exists.

## 5. Disposition of the 6 PLAUSIBLE findings

F-41/43/44 (empty `ALL`/`ANY` operands) → **fixed** in WP-7 (`.min(1)`). F-42 (DWP-04 wait guard vs stated
acceptance) → **dispositioned** in WP-12 + recorded in WP-17. F-45 (attempt read-model drops wait events) →
**fixed** in WP-13. F-46 (`STEP_SUCCEEDED` vs terminal-success on SKIPPED) → **settled and pinned** in WP-4/WP-7.

---

*`READY_TO_BUILD` / v0.1.0 — 18 work packages, 8 shared mechanisms, 14 cross-family conflicts resolved (two
blocking), 19 residual risks disclosed. Nothing built yet.*
