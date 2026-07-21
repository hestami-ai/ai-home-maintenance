# JAN-EXECPLAN-DS-003 — Step Interpreter & Transition Grammar (Tier 3C) Design

**Status:** DESIGN-FIRST — for sponsor alignment on §6 forks. Nothing built.
**Date:** 2026-07-21
**Companion:** the deferred **3C** of `JAN-EXECPLAN-DS-002` (Tier 3 temporal engine). 3A (plan lifecycle), 3B (Execution Attempt projection + retry cap), and 3D (attempt-history UI) are DELIVERED (`JAN-EXECPLAN-DR-002`). This designs the last gap: **step sequencing** — driving the steps below QUEUED and the branch/wait/parallel machinery the flat-list model can't.
**Grounding:** the two Tier-3 repository maps + the ratified persistence (DOC-009 §10.2/§10.3) + the step machine (`rph-domain/src/transitions.data.ts`) + Guide §9.1/§9.2 + RPH-EXE-005.

---

## 1. What it is (one line)

The domain work that makes an Execution Plan's steps **sequence themselves**: a step readies when its preconditions are met, queues, runs, and on success readies the next — closing the **15 handler-less step arrows** (NOT_READY→READY→QUEUED, →SKIPPED, →CANCELLED, →WAITING, →SUPERSEDED) and letting a multi-step plan progress without every step being hand-seeded at QUEUED and driven in isolation.

## 2. What it is NOT (guardrails)

- **NOT a free build.** `ExecutionTransition` and `Condition` are `Source-TBD` placeholders (`objects.ts` `z.record(unknown)`); the §10.3 `condition_expression` is an opaque `jsonb`, so the *storage envelope* is ratified but the **predicate grammar inside it is un-authored**. Authoring that grammar is a governed decision (an agent SHALL NOT self-approve a governed shape — `JAN-ENGC-001 §10.1`); the §6 forks are the sponsor's to rule.
- **NOT a new scheduler.** Sequencing is dependency/precondition-driven (RPH-EXE-005: "a step cannot run until all preconditions are satisfied"), not wall-clock.
- **NOT an assurance change.** INV-5 stays intact: step sequencing drives the EXECUTION axis only; the floor gate on `CompleteExecutionStep` and `rejectUnbackedExecutionSuccess` are unchanged.
- **NOT a LOOP construct.** The `StepType` enum (9 values) has BRANCH / PARALLEL_GROUP / WAIT but **no LOOP** — iteration is expressed via BRANCH back-edges over `execution_transitions`; this design does not invent a loop primitive.

## 3. Canonical + governance grounding

- **Ratified storage (build on it):** DOC-009 **§10.2 `execution_steps`** carries `ordinal integer` (a step-ordering field, nullable) + `preconditions jsonb` + `postconditions jsonb` + `step_state`. **§10.3 `execution_transitions`** = `{id, execution_plan_id, source_step_id?, target_step_id?, condition_expression jsonb?, transition_type}`. Both shapes are ratified; the jsonb *contents* (the condition grammar) are not.
- **Ratified step machine** (`transitions.data.ts:1421-1488`): `initialState = NOT_READY`; the below-QUEUED arrows `NOT_READY→READY` (guard: preconditions) and `READY→QUEUED` ("step scheduled") are legal-but-handler-less; likewise `→SKIPPED / →CANCELLED / →WAITING / →SUPERSEDED`. Only 4 of 19 arrows have handlers today (start/complete/fail/retry).
- **Ratified sequencing rule RPH-EXE-005:** "A step cannot run until all preconditions are satisfied." **RPH-EXE-006:** a succeeded step records an output or explicit no-output. **§9.2** coordination loop: "execute the next eligible step."
- **The gap (current state):** `advanceStep` drives ONE step in isolation and **never reads `plan.transitions`** (`execution.ts`); both drives seed every step directly at `stepState:'QUEUED'` (bypassing NOT_READY/READY as pure payload). There is no interpreter, no precondition evaluation, no next-step readying. The `ordinal` field is written-never-read.

## 4. Current-state findings (grounded)

- **F-1 No sequencing.** `advanceStep` reads/writes a single indexed step; `plan.transitions` is stored but read by nothing. A multi-step plan requires each step seeded QUEUED and driven independently (no "step 1 succeeds → step 2 readies").
- **F-2 The below-QUEUED lifecycle is undriveable.** NOT_READY→READY (guard: preconditions) and READY→QUEUED have no command; the domain's own initial state is a dead-end (surfaced honestly by Tier-1 F-11).
- **F-3 The grammar is Source-TBD.** `ExecutionTransition` (`m1` placeholder; persistence §10.3 envelope) and `Condition` (preconditions/postconditions; §10.2 jsonb) have no field schema — `z.record(unknown)` in generated code. The `condition_expression` predicate language is specified nowhere.
- **F-4 `ordinal` is ratified but unused.** §10.2 `execution_steps.ordinal` gives a linear step order that no code reads — a ratified footing for LINEAR sequencing that needs no condition grammar.
- **F-5 Terminal step arrows absent.** No skip/cancel/supersede-step handler → `→SKIPPED / →CANCELLED / →SUPERSEDED` unreachable; a step can only end SUCCEEDED or FAILED.

## 5. Proposed scope — three sub-tiers (recommend 3C-i + 3C-iii now; 3C-ii behind a grant)

**3C-i — Linear ordinal sequencing (RATIFIED footing; buildable now). RECOMMENDED first.**
Use the ratified `ordinal` to sequence steps linearly: on `CompleteExecutionStep` (a step SUCCEEDS), auto-ready-and-queue the next step by ordinal (drive its NOT_READY→READY→QUEUED). A plan proposed with steps at NOT_READY (the domain's own initial state) now progresses: the first step readies on Activate, each subsequent readies on its predecessor's success. Closes F-1/F-2 for the LINEAR case — the overwhelmingly common plan shape — with **no condition grammar** (ordinal is ratified; the readying trigger is authored, like DWP-01's plan-terminal commands). The precondition check reduces to "predecessor SUCCEEDED" (a faithful, disclosed reading of RPH-EXE-005 when the grammar is absent).

**3C-ii — Transition-graph + condition grammar (GOVERNED; behind a fresh grant). DEFERRED unless ruled.**
Schematize `ExecutionTransition` from the §10.3 envelope (`sourceStepId?, targetStepId?, conditionExpression?, transitionType`) and author a `condition_expression` grammar (a predicate over step states / artifact presence / assumption liveness), then teach the interpreter to follow the transition graph — BRANCH (conditional next), WAIT (block on a condition/timer), PARALLEL_GROUP (ready several at once). This is the un-ratified heart; the condition grammar is a real language-design decision (Fork C). Recommended DEFERRED behind a grant, with 3C-i as the linear substrate it generalizes.

**3C-iii — Terminal step lifecycle (SKIP / CANCEL step) (small; authored). RECOMMENDED with 3C-i.**
Author `SkipExecutionStep` (READY/QUEUED→SKIPPED, guarded by `canSkipStep` — a mandatory step needs a waiver, per the existing kernel `rph-domain/src/execution.ts`) and `CancelExecutionStep` (→CANCELLED). This makes SKIPPED reachable — the hard dependency DR-002 §15 flagged for the completion allow-list (SUCCEEDED‖SKIPPED) to be honest — and closes F-5. Small, mirrors DWP-01's authored-command pattern.

## 6. Forks — decisions I need from you (sponsor rulings; recorded as delegated authority)

**RULED (sponsor, 2026-07-21):** **E** → 3C-i + 3C-iii now, **3C-ii DEFERRED**. **B** → **auto-fold** the next-step readying into `CompleteExecutionStep`. **D** → author `SkipExecutionStep` + `CancelExecutionStep` now (canSkipStep-guarded). Carried on recommendation: **A** → linear (subsumed by E); **C** → defer the condition grammar; **F** → "preconditions satisfied" reads as "earlier steps SUCCEEDED" (linear), disclosed.

**Fork B RECONCILED at roadmap self-critique (see `JAN-EXECPLAN-DR-003` §7/§15/§19):** the completion-fold cascade was proven unbuildable/unsafe by the 3-lens critique — `commitState` is single-event with a `UNIQUE(aggregate_revision)` constraint; `completeExecutionStep` has no plan-ACTIVE guard (would ready under a superseded plan); NOOP re-completion re-fires it; mixed seeds double-ready; skipping the startable step deadlocks. Realized instead as a **start-gate** (a predecessor precheck on `StartExecutionStep` + a `startableStepId` read-model) — the SAME automatic linear progression (no explicit Ready/Queue commands, the ruling's actual intent) with those five failures structurally avoided, and sequencing by **array index** (not `ordinal`, which is persistence-only / absent from the strict `ExecutionStep` contract). Disclosed for confirmation at activation. Also two grammar-independent facts surfaced: `mandatory` has no step field (→ caller-asserted, fail-closed on the Skip command), and `CompleteExecutionPlan` must require ≥1 SUCCEEDED (aligning with `rejectUnbackedExecutionSuccess`).


- **A. Sequencing model.** **Linear ordinal (3C-i)** — sequence by the ratified `ordinal`, next-readies-on-predecessor-success — *recommended* as the buildable-now substrate — **vs** jump straight to the **full transition-graph (3C-ii)**, which needs the condition grammar authored first. *Rec: 3C-i now, 3C-ii deferred.*
- **B. Readying trigger.** **Auto-fold** the next-step readying into `CompleteExecutionStep` (on a step's success, ready+queue the next by ordinal) — *recommended*, fewer commands, mirrors §9.2 "execute the next eligible step" — **vs** explicit **`ReadyExecutionStep`/`QueueExecutionStep`** commands the controller issues. *Rec: auto-fold, with the readied step surfaced as an event.*
- **C. Condition grammar (only if 3C-ii is ruled in).** A **minimal predicate** (`{ allOf: [{ stepSucceeded: id }], ... }` — a small typed JSON shape over step states/artifacts) **vs** a **richer expression language**. *Rec: DEFER 3C-ii entirely; if activated, minimal predicate first.*
- **D. Terminal step lifecycle (3C-iii).** Author **`SkipExecutionStep` + `CancelExecutionStep`** now (makes SKIPPED reachable + honest) — *recommended* — **vs** defer. *Rec: author now.*
- **E. Scope.** **3C-i + 3C-iii now, 3C-ii deferred** (*recommended*) **vs** narrower **3C-i only** **vs** all three. *Rec: 3C-i + 3C-iii.*
- **F. Precondition reading (3C-i).** With the grammar absent, "preconditions satisfied" (RPH-EXE-005) reads as **"the predecessor step SUCCEEDED"** (linear). Acceptable as a disclosed simplification until 3C-ii authors the real condition grammar? *Rec: yes, disclosed.*

## 7. Ratified-vs-authored disposition

- **3C-i** stands on **ratified** `ordinal` (§10.2) + the ratified step machine's NOT_READY→READY→QUEUED arrows + RPH-EXE-005; only the readying *trigger* (an event/fold) is authored under the standing grant.
- **3C-iii** authors two step-lifecycle commands under the standing grant (like DWP-01), on the ratified step machine's `→SKIPPED/→CANCELLED` arrows + the ratified `canSkipStep` kernel.
- **3C-ii** crosses **Source-TBD** ground — the `condition_expression` grammar is un-authored; genuinely a fresh authoring grant (Fork C), hence DEFERRED.

## 8. Verification approach

- **Unit (3C-i):** a 2-step plan (steps at NOT_READY, ordinals 1,2) → Activate readies step 1 → complete step 1 → step 2 readies+queues automatically → complete step 2 → all terminal (then CompleteExecutionPlan, DWP-01). Precondition gate: step 2 does not ready while step 1 is unfinished. **(3C-iii):** SkipExecutionStep on a non-mandatory step → SKIPPED; on a mandatory step without a waiver → REJECT (canSkipStep); CancelExecutionStep → CANCELLED.
- **E2E:** a multi-step plan progresses through the execution tab without hand-seeding each step at QUEUED; a SKIPPED step lets the plan COMPLETE (SUCCEEDED‖SKIPPED allow-list).
- **Static/EP:** check-types, svelte-check, boundary (no new browser-unsafe code), SonarLint. EP-TST-5 state-transition layer is load-bearing (every newly-driveable step arrow exercised; every invalid one rejected).

## 9. Increment sketch (on alignment; roadmap to follow)

1. **3C-i** — ordinal sequencing: auto-ready+queue the next step on predecessor success (via `CompleteExecutionStep`'s fold, Fork B); a plan may propose steps at NOT_READY; the first readies on Activate. Unit + e2e.
2. **3C-iii** — `SkipExecutionStep` + `CancelExecutionStep` (canSkipStep-guarded); SKIPPED becomes reachable + honest for the completion allow-list.
3. **(3C-ii deferred)** — `ExecutionTransition` schematization + the condition grammar + branch/wait/parallel interpreter, its own program behind Fork C's grant.

---

*Design-first; awaiting sponsor alignment on §6 (Forks A–F) before the roadmap. This spec surfaces that 3C is split like Tier 3 was — linear ordinal sequencing (3C-i) + terminal step lifecycle (3C-iii) stand on ratified ground and are buildable now; the transition-graph + condition grammar (3C-ii) is un-authored and deferred behind a grant — rather than treating the whole interpreter as greenfield.*
