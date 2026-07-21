# JAN-EXECPLAN-DS-002 — Execution Temporal Engine (Tier 3) Design

**Status:** DESIGN-FIRST — for sponsor alignment on §6 forks. Nothing built.
**Date:** 2026-07-21
**Companion:** the un-deferred Tier 3 flagged by `JAN-EXECPLAN-DS-001` §5 / §7-A / DR-001 §15 (F-9/F-11). The Tier 1+2 view (read-model, plan→steps panel, handler-backed actions, the `layerHandoff` advisory) is DELIVERED; this designs the temporal *engine* it renders.
**Grounding:** two file:line repository maps (contract/normative surface + handler/state-machine surface, HEAD `9be1b58f`) + the corpus's own **staged design** `docs/_working/DESIGN-execution-attempt-staged.md` (2026-07-19) and `DECISION-item23-attempt-record.md`.

---

## 1. What it is (one line)

The domain-side work that makes an Execution Plan actually **temporal**: a plan can reach **COMPLETED/FAILED/SUPERSEDED** (not only CANCELLED), an **Execution Attempt** becomes a real record (closing the retry cap **RPH-EXE-008** and the §9.7 attempt-history floor), a **live-progress read-model** folds the `Execution*` event stream, and — deferred — a **step interpreter** sequences steps via a schematized `transition`/`condition` grammar (branch/wait/parallel; NOT_READY→READY→QUEUED).

## 2. What it is NOT (guardrails)

- **NOT a free build.** The execution surface is **governed ground**: much of it is `UNRATIFIED-AUTHORED` (2026-07-16 sponsor grant, ratification pending) and the pieces this engine needs most are either that or `Source-TBD`. The Execution Attempt object is **explicitly withheld** — `DECISION-item23-attempt-record.md:42` "**Do not ratify a shape today**." An agent SHALL NOT self-approve a governed ratification (`JAN-ENGC-001 §10.1`); the §6 forks are the sponsor's to rule, recorded as delegated authority.
- **NOT an assurance change.** Exec ≠ assurance (INV-5) is preserved: plan completion drives the EXECUTION dimension only. RPH-PWU-005 already maps "active plan succeeds → `executionState=SUCCEEDED`, PWU → EVIDENCE_PENDING (never SATISFIED)" (`m11:201,229`). The floor gate on `CompleteExecutionStep` stays authoritative.
- **NOT a second source of truth.** Attempt content (`executionProvenance`, `executionAttemptId`) is **already** on the emitted `ExecutionStepSucceeded/Started` events. The engine must not double-record it into both `domain_events` and a new store (the hazard `DESIGN-execution-attempt-staged.md §5` names) — which is exactly why Fork A leans projection.
- **NOT wall-clock scheduling.** Attempts carry `started_at`/`completed_at` (DOC-009 §10.4) as records, not a scheduler; step ordering is dependency/precondition-driven, not a Gantt.

## 3. Canonical + governance grounding

- **Guide §9.1** (`Coding Agent Guide.md:1136-1139`): a Plan "contains steps/transitions, retry, tactic-change, escalation, and termination policy"; a Step is temporal machinery (model/tool/retrieval/transformation/human/wait/branch/parallel/assurance); an **Execution Attempt** "records one bounded try, inputs/outputs or explicit no-output, provenance, external operation IDs, errors, and result"; a Runtime Binding selects role/model/tool/context/sandbox and records requested-vs-granted. **§9.7** (`:1340`) makes the Attempt record a **mandatory retention floor** ("each bounded try … is its own record … the Execution Aggregate owns attempts").
- **Ratified persistence** (DOC-009 §10.4/§10.5): `execution_attempts(id, execution_step_id, attempt_number, state, started_at, completed_at, runtime_binding_id, idempotency_key, external_operation_id, reconciliation_state, result, error, provenance, uq(execution_step_id, attempt_number), uq(idempotency_key))` and `runtime_bindings(…)` are **defined in full** — the storage shape is ratified even though the contract *object* is withheld.
- **Ratified invariant RPH-EXE-008** (Conformance §12 / §36.2 / §37, `m11:196,227`): after the retry cap is hit "the controller must not issue a fourth retry; it must select CHANGE_TACTIC / REPLAN_EXECUTION / ESCALATE / REJECT / ABANDON." The cap is **policy-driven** (the plan's `RetryPolicy`), not a hardcoded constant.
- **Ratified completion condition** (§20.1, `m11:37,50`): a plan reaches **COMPLETED** when "all required steps reach terminal success"; **FAILED** per the §36.2 failure taxonomy; **SUPERSEDED** when a successor plan is activated (RPH-EXE-002 — "a superseded plan cannot create new execution attempts and no new step may begin").
- **The prerequisite is met:** `ExecutionProvenance` is now a contracted `z.strictObject` (`objects.ts:216-221`), so §10.4's `provenance jsonb` is losslessly sourceable — the single biggest un-block since item 23 (`DESIGN-execution-attempt-staged.md §3/§6`).

## 4. Current-state map (the five gaps — grounded)

| # | Gap | Evidence | Ratification status |
| :- | :-- | :-- | :-- |
| G-1 | **No Execution Attempt aggregate** — only the id-prefix `'attempt'`; `executionAttemptId` rides the wire + `ExecutionStepSucceeded` + artifact/evidence provenance but persists to no object | `ids.ts:33`; `execution.ts:369`; `artifact.test.ts:94` | object **WITHHELD** (§16 item 23); persistence **RATIFIED** (§10.4) |
| G-2 | **Retry cap RPH-EXE-008 unenforced** — `retryExecutionStep` bare-advances FAILED→QUEUED; the ready-made kernel `retryDecision` is never called; no `attemptsMade` source | `execution.ts:451-458`; kernel `rph-domain/src/execution.ts:266-275` (unit-tested, unwired) | invariant **RATIFIED** (Conformance); `RetryPolicy` shape **Source-TBD** |
| G-3 | **No plan-terminal handlers** — ACTIVE→COMPLETED (`:1389`), ACTIVE→FAILED (`:1390`), all four →SUPERSEDED (`:1393-1416`) are **data-only**; only CANCELLED is command-reachable (no `TERMINATED` state — that's the *event* on the CANCELLED arrow) | `rph-domain/src/transitions.data.ts:1389-1416`; registry `:114-127` | states + condition **RATIFIED**; commands **absent** |
| G-4 | **No step sequencing/interpreter** — `advanceStep` drives one step in isolation, never reads `plan.transitions`; **15 of 19** step arrows (ready/queue/skip/cancel/wait/supersede) have no handler; both drives seed steps directly at `QUEUED` | `execution.ts:262-317`; step machine `transitions.data.ts:1421-1488` | `ExecutionTransition`/`Condition` grammar **Source-TBD** |
| G-5 | **No event-folding read-model** — `execution-view.ts` shapes the aggregate snapshot only; zero projections fold `Execution*` events (no attempt history, no live progress) | `execution-view.ts:5-6`; grep(rph-projections)=0 | additive; safe |

## 5. Proposed scope — four sub-tiers (recommend 3A + 3B + 3D; defer 3C)

**Tier 3A — Plan-terminal lifecycle (closes G-3). Buildable now; ratified condition. RECOMMENDED first.**
Drive the plan's ratified terminal transitions: `ACTIVE→COMPLETED` when every step is in a terminal `stepState` with all *required* steps SUCCEEDED (the ratified "all required steps reach terminal success"); `ACTIVE→FAILED` per the §36.2 taxonomy; `ACTIVE→SUPERSEDED` (+ the pre-ACTIVE supersede arrows) when a successor plan activates (RPH-EXE-002). The **states + condition are ratified**; only the *command/trigger* is authored (like its already-authored siblings). Wires cleanly through the existing `advanceStatus` machinery (`kit.ts:401`). Fork C decides command-vs-auto-fold.

**Tier 3B — Execution Attempt (as a §10.4 record) + retry-cap wiring (closes G-1, G-2). GOVERNED — needs Fork A + Fork B rulings.**
Adopt the corpus's staged design: mint an Attempt at attempt-open (the `StartExecutionStep` QUEUED→RUNNING moment, or a new `StartExecutionAttempt`), carrying `attempt_number` (monotonic per step — the `uq_execution_attempt` key and the RPH-EXE-008 counter), a per-attempt `idempotency_key`, a bound `runtime_binding_id`, and `provenance` serialized from the contracted `ExecutionProvenance`. With `attempt_number` as the source, wire the ready-made `retryDecision` kernel into `retryExecutionStep` → **RPH-EXE-008 enforced**; on exhaustion surface the ratified control actions (CHANGE_TACTIC/REPLAN/ESCALATE/REJECT/ABANDON). **Fork A** decides projection-vs-typed-object; **Fork B** decides the mint/bind contract. Neither can be smuggled in (§16 item 23).

**Tier 3C — Step interpreter + `transition`/`condition` grammar (closes G-4). DEFERRED — needs a fresh authoring grant.**
`ExecutionTransition` and `Condition` are `Source-TBD` (`z.record(unknown)` placeholders, `objects.ts:80,90`). Sequencing steps (evaluate preconditions → NOT_READY→READY→QUEUED; BRANCH/WAIT/PARALLEL_GROUP; loop via BRANCH back-edges — there is no LOOP StepType) requires **authoring that grammar first**, then teaching `advanceStep` to read `plan.transitions`. This is the deepest, most un-ratified piece; deferred to its own sub-program behind a grammar-authoring grant (Fork F).

**Tier 3D — Event-folding read-model (closes G-5). Additive; converges with 3B.**
A browser-safe `rph-projections` projector folding `Execution{PlanProposed,Approved,Activated,Superseded,Terminated}` + `ExecutionStep{Started,Succeeded,Failed,Retried,…}` into a per-plan **live-progress + attempt-history** view. If Fork A picks *projection*, this **is** the Attempt store (the §10.4 shape rebuilt from events) — 3B and 3D become one layer. The Tier-1 view then gains real progress/attempt history (the DS-001 fork-A deferral, now un-deferred).

## 6. Forks — decisions I need from you (sponsor rulings; recorded as delegated authority)

**RULED (sponsor, 2026-07-21):** **E** → 3A + 3B + 3D, defer 3C. **A** → §10.4 **projection** over the event stream (Attempt is a rebuildable read-model, not a typed object; no new ProfessionalWorkObjectType / id-prefix ratification). **B** → **extend `StartExecutionStep`** to carry the attempt-open data (mint the per-attempt `idempotency_key`, bind `runtime_binding_id`). Carried on recommendation: **C** → explicit `CompleteExecutionPlan`/`FailExecutionPlan`/`SupersedeExecutionPlan` commands; **D** → retry cap on `attempt_number` (folded from the projection); **F** → defer the 3C grammar. These feed `JAN-EXECPLAN-DR-002`.


- **A. Execution Attempt home (Decision 1, staged design §5).** A rebuildable **§10.4 projection over the event stream** (*recommended* — content is already recorded once in the events; avoids double-recording and the O(N²)-under-retry-storm hazard of embedding attempts in immutable plan state) **vs** a typed command-sourced **`EXECUTION_ATTEMPT` ProfessionalWorkObjectType** (a new §4 object + a §5.3 id-prefix ratification — the seed already uses a live-undecided `ata`/`attempt`). *Rec: projection.* **This decides whether 3B and 3D are one layer.**
- **B. Attempt-open mint/bind contract (Decision 2, staged design §5).** Extend **`StartExecutionStep`** to construct the Attempt (mint the per-attempt `idempotency_key`, **require + bind** `runtime_binding_id`) — *recommended*, it is already the QUEUED→RUNNING attempt-open moment — **vs** a dedicated **`StartExecutionAttempt`** command. Either must specify *how* the per-attempt `idempotency_key` is derived (distinct from the command-envelope dedup key) and *which* `RuntimeBinding` binds. *Rec: extend StartExecutionStep.*
- **C. Plan completion trigger (3A).** An explicit **`CompleteExecutionPlan`/`FailExecutionPlan`/`SupersedeExecutionPlan`** command the controller issues (*recommended* — observable, mirrors the authored sibling commands, an auditable event) **vs** an **auto-fold** inside `completeExecutionStep` (when the last required step succeeds, auto-drive the plan → COMPLETED). *Rec: explicit commands.*
- **D. Retry-cap counter source (3B/G-2).** Ride RPH-EXE-008 on **`attempt_number`** from 3B's Attempt records (*recommended* — the ratified `uq_execution_attempt` counter) **vs** counting `ExecutionStepRetried/Started` events from history if 3B is deferred. *Rec: attempt_number (couples 3B + the retry cap).*
- **E. Scope this program.** **3A + 3B + 3D now, 3C deferred** (*recommended*) **vs** narrower **3A-only** (plan completion) as a first slice, holding 3B until Forks A/B are ruled. *Rec: 3A + 3B + 3D; defer 3C.*
- **F. 3C grammar.** **Defer** the `ExecutionTransition`/`Condition` grammar + step interpreter to its own grant (*recommended*) **vs** author a minimal grammar now. *Rec: defer.*

## 7. Ratified-vs-authored disposition (what each sub-tier stands on)

- **3A** stands on **ratified** ground (the 8-value `ExecutionPlanStatus`, the §20.1 completion condition, the §36.2 failure taxonomy, RPH-EXE-002 supersession) — only the trigger command is authored, consistent with the existing 2026-07-16 grant covering the sibling execution commands.
- **3B** stands on **ratified persistence** (§10.4) + a **met prerequisite** (contracted `ExecutionProvenance`) + a **ready-made kernel** (`retryDecision`), but crosses the **explicitly-withheld** contract-object ratification (§16 item 23) — hence Forks A/B are true sponsor decisions, not implementation details.
- **3D** is **additive** (a browser-safe projection); no ratification surface beyond consuming already-emitted events.
- **3C** stands on **Source-TBD** grammar — genuinely un-authored; deferred behind a grant.

## 8. Verification approach (per the JPWB gate + EP-001)

- **Unit** (3A): completion fires only when all required steps are terminal-success; FAILED per taxonomy; supersession blocks new steps/attempts (RPH-EXE-002). (3B): `retryDecision` wired — the 4th retry is refused and surfaces a control action (RPH-EXE-008); `attempt_number` monotonic per step. (3D): the event-fold yields per-plan progress + attempt history; browser-safe (`boundary` 0).
- **Component/E2E**: an undertaking's plan drives to COMPLETED through the UI (not stuck ACTIVE); a retry-storm hits the cap and the UI shows the exhaustion control action; the live-progress view reflects attempt history. EP-TST-5 **state-transition layer** is load-bearing here (every plan/step terminal transition exercised; every invalid one rejected) and EP-TST-12 **no happy-path-only** (the cap-exhaustion + supersession rejections demonstrated).
- **Static/EP**: `check-types`, svelte-check, `boundary` (any new projection stays browser-safe), SonarLint (EP-TST-13). If Fork A = projection, EP-CMT-4 boundary comments where the fold crosses the event-stream/attempt-record seam.

## 9. Increment sketch (on alignment; roadmap to follow)

1. **3A** — plan-terminal commands/fold + the terminal-condition guard (COMPLETED/FAILED/SUPERSEDED); unit + e2e (a plan reaches COMPLETED).
2. **3B-i** — the Attempt record per Fork A (projection or object) minted at attempt-open per Fork B; provenance from `ExecutionProvenance`.
3. **3B-ii** — wire `retryDecision` on `attempt_number` → RPH-EXE-008 + the exhaustion control actions.
4. **3D** — the live-progress/attempt-history projector (one layer with 3B-i if Fork A = projection); feed the Tier-1 view real progress.
5. **(3C deferred)** — grammar + interpreter, its own sub-program behind Fork F's grant.

---

*Design-first; awaiting sponsor alignment on §6 (Forks A–F) before the roadmap. This spec deliberately surfaces that Tier 3 is governed ground — 3A is ratified-buildable, 3B needs two staged ratification decisions (the corpus's own `DESIGN-execution-attempt-staged.md`), 3C is un-authored grammar — rather than treating the temporal engine as greenfield.*
