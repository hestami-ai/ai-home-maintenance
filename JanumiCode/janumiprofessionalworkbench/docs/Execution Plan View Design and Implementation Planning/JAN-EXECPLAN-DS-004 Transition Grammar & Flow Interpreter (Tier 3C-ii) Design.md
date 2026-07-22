# JAN-EXECPLAN-DS-004 — Transition Grammar & Flow Interpreter (Tier 3C-ii) Design

*Design-first, **v0.2.0** — reconciled against an EXECUTED 3-lens adversarial self-critique (§10; two blockers + majors found and folded into D1–D8 below). Sponsor-ruled 2026-07-21: **reopen** the 3C-ii deferral and **author a fresh execution-scoped condition grammar**; primitive scope = **BRANCH + WAIT + PARALLEL_GROUP**. Grounded by a multi-agent workflow (6 code-grounded lenses → synthesis → completeness critic), then self-critiqued. Awaiting a design confirmation before build (Activate).*

## 1. What it is (one line)

Give the `ExecutionPlan.transitions[]` graph — which **nothing reads today** — real meaning: a guarded directed-edge interpreter that generalizes the shipped linear start-gate into conditional (**BRANCH**), pausing (**WAIT**), and concurrent (**PARALLEL_GROUP**) flow, driven by a fresh, declarative, replay-safe condition grammar.

## 2. What it is NOT (guardrails)

- **NOT** a re-mint of primitives that already exist. **BRANCH / WAIT / PARALLEL_GROUP are ratified `ExecutionStep.stepType` values** (RPH-DOC-002 §21's 9-value enum; `canonical-vocabulary.json:741-756`; confirmed in `enums.ts`), **not** transition types. DR-003's "BRANCH/WAIT/PARALLEL_GROUP transition interpreter" **conflated node-kind with edge-kind** — corrected here. Flow *semantics* live on the STEP; the *edge* is a plain guarded link.
- **NOT** a self-approved grammar. The condition grammar was deferred behind a **fresh** grant (DS-003 §6/§7; JAN-ENGC-001 §10.1 — an agent SHALL NOT self-approve a governed shape). The sponsor **explicitly reopened** the deferral and granted authoring a fresh grammar (2026-07-21 ruling). This is that grant; all authored shapes are `UNRATIFIED-AUTHORED`, and the git-commit + NO-PUSH boundary remains the ratification control.
- **NOT** a timer/scheduler. WAIT here is **manually resolved** (or external-signal). Timer/wall-clock/condition-driven auto-resolve → the deferred durable-timer/lease backlog (§5).
- **NOT** a behavior change for existing plans. Every shipped plan carries an **empty** `transitions[]`; the interpreter must leave empty-transitions / single-step / linear plans **byte-identical** (the graph is the *generalization* whose degenerate case is today's array-index gate).
- **NOT** an assurance coupling. INV-5 holds (flow drives the EXECUTION axis only; the floor gate + `rejectUnbackedExecutionSuccess` stay authoritative). The condition evaluator reads **only committed state + this plan's own event log** — never wall-clock, random, I/O, or another aggregate (replay determinism).

## 3. Canonical + governance grounding

- **Ratified footing (thin but clean):** an `ExecutionTransition` has exactly one ratified structural anchor — the DOC-009 §10.3 persistence table `execution_transitions`: `{ id, execution_plan_id → execution_plans(id), source_step_id? → execution_steps(id), target_step_id? → execution_steps(id), condition_expression jsonb?, transition_type text NOT NULL }`. There is **no** object schema (generated as opaque `z.record(z.string(), z.unknown())`, `objects.ts:90`), **no** ratified `transition_type` value set, and **no** ratified `condition_expression` grammar (opaque `jsonb`). `ExecutionPlan.transitions` is **embedded** `ExecutionTransition[]` (Contract §15 wins over DOC-002 §20.1 `transitionIds`; `objects.ts:608`).
- **`ExecutionStep.stepType`** is the ratified 9-value enum incl. `WAIT | BRANCH | PARALLEL_GROUP` (RPH-DOC-002 §21; `canonical-vocabulary.json:741-756`). The `ExecutionStep.stepState` machine already has a `WAITING` state with `RUNNING→WAITING` (`ExecutionStepWaiting` event, `m3:4891`) and `WAITING→RUNNING` ("wait resolved", **no event** — a replay hole) but **no handler** for either (`transitions.data.ts:1421-1488`). Steps are seeded **QUEUED at rest** (never NOT_READY) in every shipped drive (`reference-undertaking.ts:553`) — a convention this design **relies on and enforces** (§6 D5).
- **`ApplicabilityExpression`** (DOC-007 §18; `m1-object-fields.json:1851-1904`) is a ratified declarative predicate — the reuse candidate the sponsor **declined** in favor of a fresh execution grammar (it lacks numeric-ordering ops, and its evaluator lives in `rph-assurance`). The fresh grammar **follows its proven structural pattern** (a discriminated union + exhaustiveness-guarded `(expr, subject) → bool` evaluator) with its **own neutral evaluator** — no assurance import (INV-5).
- **Governance:** the reopening is the sponsor's ruling (delegated authority, recorded here). Every authored artifact is `UNRATIFIED-AUTHORED`, citing only its ratified anchor, authored-vs-derived labeled.

## 4. Current-state findings (grounded)

- **F-1 The graph is inert + unexercised.** `ProposeExecutionPlan` persists `p.transitions` and emits `transitionIds` (`execution.ts:66,88`) but `advanceStep` + the linear gate **ignore** it. The only seed carries `transitions: []` (`reference-undertaking.ts:556`), so **the graph path ships unexercised** — new fixtures are obligatory.
- **F-2 The gate is scalar + linear.** `startableStepId` (`execution-view.ts:219-228`) derives a **single** step by array index; the `startExecutionStep` precheck (`execution.ts:471-480`) rejects a start unless every earlier array-index step is terminal-success. PARALLEL needs a **set** frontier; BRANCH needs an **edge-condition, first-match** gate.
- **F-3 `transition_type` NOT NULL, no value set.** "Derive from the target step's `stepType`" is **incoherent** (a BRANCH's target may be an ordinary step). → a **minimal, conditionExpression-keyed** value set (§6 D2).
- **F-4 No transition-mutation command; nothing validates the graph.** Transitions are immutable, supplied at propose-time; the interpreter is a **read-model over the immutable graph** + existing per-step commands. Propose-time validation (dangling ids, one-entry, reachability, **acyclicity**, BRANCH-default, condition-ref resolution) is absent — a correctness hole (§6 D2/D3, §9 DWP-01).
- **F-5 The completion allow-list is a deadlock trap.** `completeExecutionPlan` requires every step `SUCCEEDED‖SKIPPED` **and ≥1 SUCCEEDED** (`execution.ts:281-295`). Any non-taken / unreachable branch step left non-terminal **deadlocks** both frontier and completion; `CANCELLED/SUPERSEDED` are *offenders* that force FAIL. **Pruning must reach SKIPPED — and SKIPPED is legal only from READY|QUEUED** (`transitions.data.ts:1457-1467`), which is why QUEUED-at-rest (§6 D5) is load-bearing.
- **F-6 The one replay hole.** `WAITING→RUNNING` has **no event** (`transitions.data.ts:1447`). Any WAIT slice **must** author the resume event.
- **F-7 Evaluator lives in assurance.** The only working evaluator (`evaluateApplicability`/`resolvePath`, `rph-assurance/.../applicability.ts:35-85`) is assurance-owned and reads `$.riskProfile`. A fresh grammar with its **own** neutral evaluator avoids that cross-domain relocation.

## 5. Proposed scope — a sequenced, back-compat generalization

**In scope (sponsor-ruled): BRANCH + WAIT + PARALLEL_GROUP + a fresh condition grammar.** Delivered as a sequenced set of increments (§9), each back-compat and centrally gated.

**Design spine — the transition graph *generalizes* the linear gate (D1).** A plan's flow is a directed graph of guarded edges over its **QUEUED-at-rest** steps. Each in-edge of a step has a **disposition** derived purely from committed state:

- **SATISFIED** — the edge's `sourceStepId` step is terminal-success (SUCCEEDED/SKIPPED) **and** the edge's guard holds: an unconditional (`SEQUENTIAL`) edge always holds; a `CONDITIONAL` edge holds iff its `conditionExpression` is true **and** it is the **first-match** out-edge among its BRANCH source's out-edges (D3 — evaluated *in the gate*, so exactly one branch arm is ever startable regardless of prune timing).
- **NEUTRALIZED** — the edge can never become satisfied: a not-first-match/false `CONDITIONAL` edge off a terminal-success BRANCH, or a source that reached SKIPPED or a terminal-non-success state (FAILED/CANCELLED/SUPERSEDED).
- **PENDING** — the source is not yet terminal.

**A step is startable when: no in-edge is PENDING, and ≥1 in-edge is SATISFIED** (a *barrier-join*, D7). This one rule unifies every shape: a single-predecessor step (linear), a PARALLEL fan-in (all edges live → all must be SATISFIED), and a BRANCH-merge/JOIN (one edge SATISFIED, the rest NEUTRALIZED → fires). A step **all of whose** in-edges resolve NEUTRALIZED is **unreachable** → pruned to SKIPPED (D5). **The linear plan is the degenerate case**: implicit unconditional edges `step[i-1] → step[i]`; empty `transitions[]` ⇒ the shipped array-index path runs **byte-identical**.

**Deferred (design-first backlog, disclosed):** timer/condition-driven WAIT auto-resolve (durable-timer/lease runtime); assumption-liveness in the condition subject; joins beyond the barrier rule (explicit k-of-n); §10.2 step-level `Condition[]`; transition editing after propose.

## 6. Design forks — sponsor rulings + resolved-with-disclosure

**Ruled by the sponsor (2026-07-21), recorded as delegated authority:**
- **R1 — Conditions:** reopen; **author a fresh execution-scoped condition grammar** (not ApplicabilityExpression reuse). *This document is the fresh grant's design.*
- **R2 — Primitives:** **BRANCH + WAIT + PARALLEL_GROUP.**

**Resolved by me, grounded in the workflow + the §10 self-critique — disclosed for confirmation/redirection at Activate:**

- **D1 — Gate = graph-supersedes-as-generalization.** Empty `transitions[]` → byte-identical linear. Non-empty → the in-edge-disposition gate (§5). *Rejected:* overlay (array-order forbids PARALLEL concurrency) and separate opt-in interpreter (dual authorities).
- **D2 — `transition_type` = `{SEQUENTIAL, CONDITIONAL}` (a two-value, conditionExpression-keyed edge role).** `CONDITIONAL` iff the edge carries a `conditionExpression`, else `SEQUENTIAL`. **PARALLEL is NOT an edge value** — concurrency is a **PARALLEL_GROUP node with ≥2 `SEQUENTIAL` out-edges** (topology, exactly as a JOIN is a node with ≥2 in-edges), which keeps D2 free of the "restate node-kind on the edge" anti-pattern the earlier `{…,PARALLEL}` set fell into (§10 fix). Node kinds stay on `stepType`. Authored `UNRATIFIED-AUTHORED`.
- **D3 — BRANCH selection = first-match, ENFORCED IN THE GATE (load-bearing).** A BRANCH step's out-edges are evaluated in array order; the **first** whose `conditionExpression` is true is the only SATISFIED CONDITIONAL edge — computed **inside the start-gate precheck**, so a losing arm is rejected at start *regardless of command/prune ordering* (closes the §10 double-run window). A BRANCH step **MUST** declare its last out-edge as an unconditional `SEQUENTIAL` **default** (propose-time validated) → exactly one arm is ever startable; zero-true → default. Prune (D5) is then **bookkeeping**, not the sole guarantor of exactly-one.
- **D4 — Condition subject = a thin, replay-safe, in-aggregate projection.** `{ steps: Record<stepId, { stepState, outputArtifactIds, attemptsMade, structuredResult }> }` — folded from committed plan state + **this plan's own event log** (`attemptsMade` = count of `ExecutionStepStarted`, mirroring `attemptsMadeForStep`, `execution.ts:596-607`; `structuredResult`/`outputArtifactIds` from `ExecutionStepSucceeded`, `execution.ts:510-515`). This is still **replay-pure and single-aggregate** (no cross-aggregate reads), and it makes the two flagship BRANCH guards expressible — **numeric** (`attemptsMade < cap`, `outputArtifactIds.length ≥ 1`) and **result-conditioned** (`structuredResult.reviewOutcome == 'REJECT' → remediation`), the §10 gaps. Assumption-liveness stays **deferred** (it alone would force a cross-aggregate read).
- **D5 — Branch-not-taken = system prune → SKIPPED, from QUEUED-at-rest, via a separate controller-issued command.** Steps rest at **QUEUED** (§3 convention; the graph gate — not the stepState — controls startability), so `PruneExecutionStep` drives **QUEUED→SKIPPED**, which the ratified machine permits (the DWP-02 Skip precedent genuinely covers it — the earlier "mirrors DWP-02" anchor is now correct). SKIPPED is the only terminal state satisfying both the completion allow-list and the barrier-join. **Dispatcher:** a pure read-model `prunableStepIds(plan)` (steps all of whose in-edges are NEUTRALIZED) surfaces the work; the **controller issues** `PruneExecutionStep` per step — exactly like Start is controller-issued — so nothing auto-folds into `CompleteExecutionStep` (which would be the forbidden second-event-per-command). **Idempotent** (`checkTransition` no-ops an already-terminal step) and **replay-safe** (prune *events* are folded on replay, never re-dispatched). System-prune does **not** route through fail-closed `canSkipStep` (a not-taken conditional arm is excluded by the plan's own declared logic, not skipped by a controller); its event records `pruned: BRANCH <stepId> selected edge <edgeId>`.
- **D6 — WAIT = manual-resolve only, authoring the resume event.** `EnterExecutionStepWait` (RUNNING→WAITING, reuse `ExecutionStepWaiting`) + `ResolveExecutionStepWait` (WAITING→RUNNING, **mint the missing resume event** — closes F-6). Both plan-ACTIVE-guarded; `WAITING→CANCELLED` cleanup already ships. Timer/condition auto-resolve deferred (§5).
- **D7 — PARALLEL_GROUP + JOIN = set-frontier + barrier-join.** `startableStepId → startableStepIds(plan): string[]` (a **set**). A PARALLEL_GROUP node's ≥2 `SEQUENTIAL` out-edges make several targets startable at once; each start is its **own** `StartExecutionStep` command. The starts **serialize on `UNIQUE(aggregate_revision)`** (one plan aggregate → the dispatcher issues them sequentially / with conflict-retry — they are concurrent *in state*, not in commit; §10 fix). JOIN/merge uses the **barrier rule** (§5: no PENDING in-edge, ≥1 SATISFIED), which correctly neutralizes pruned/branch/non-success in-edges rather than wedging on them.
- **D8 — Edge condition, not step precondition.** The **edge** `conditionExpression` is the precondition mechanism for graph plans; the shipped Fork-F "predecessor SUCCEEDED" reading is the degenerate unconditional edge. The §10.2 step-level `Condition[]` field stays `Source-TBD`/untouched (disclosed).

## 7. Ratified-vs-authored disposition

| Artifact | Disposition |
| :--- | :--- |
| `ExecutionTransition` shape `{id, executionPlanId, sourceStepId?, targetStepId?, conditionExpression?, transitionType}` | **AUTHORED-DERIVED** from the ratified DOC-009 §10.3 columns; replaces the opaque `z.record`. `UNRATIFIED-AUTHORED`. |
| `transitionType` set `{SEQUENTIAL, CONDITIONAL}` (D2) | **AUTHORED-NEW** (no ratified set). `UNRATIFIED-AUTHORED`, disclosed. |
| Condition grammar (discriminated union + neutral evaluator, D4) | **AUTHORED-NEW under the reopened grant (R1).** ApplicabilityExpression *pattern*, own evaluator. `UNRATIFIED-AUTHORED`. |
| `PruneExecutionStep` cmd/event (D5); `EnterExecutionStepWait` + `ResolveExecutionStepWait` cmd + resume event (D6) | **AUTHORED-NEW**, mirroring DWP-02 Skip/Cancel. `UNRATIFIED-AUTHORED`. All `→SKIPPED`/`→WAITING`/`WAITING→RUNNING` targets are on the ratified machine; QUEUED→SKIPPED needs **no new arrow** (D5). |
| `ExecutionStep.stepType` BRANCH/WAIT/PARALLEL_GROUP; `WAITING` state + arrows | **RATIFIED** (RPH-DOC-002 §21) — reused. |
| Frontier scalar→set; in-edge-disposition gate; propose-time graph validation | **CODE/wiring** (generalization of shipped behavior). |

## 8. Verification approach

- **Determinism first:** the evaluator is pure over the D4 projection (committed state + this plan's event fold); **no** `ctx.now()`/random/I/O/cross-aggregate. Replay-stability unit-tested.
- **Back-compat is a test, not a claim:** empty-`transitions[]` / single-step / linear plans prove **byte-identical**. The reference seed stays `transitions: []`; graph behavior is exercised by **new fixtures** (F-1).
- **State-transition ladder (EP-TST-5) + no-happy-path-only (EP-TST-12):** every newly-driveable arrow (RUNNING→WAITING, WAITING→RUNNING, QUEUED→SKIPPED-prune, parallel multi-start) exercised; **rejections demonstrated** — malformed-graph (dangling id, no BRANCH-default, cyclic, unresolved condition-ref, unreachable step), two-true→first-match determinism, mandatory-not-taken prune, barrier-join with a neutralized in-edge, double-run window closed at the gate, WAIT resume replay.
- **Central gate** (never in a sub-agent) + **post-build adversarial verification** (ultracode), as with Tier-3C.

## 9. Increment sketch (DWP land order — DR-004 to follow on Activate)

1. **DWP-01 — Transition schema + graph-aware gate foundation.** Author `ExecutionTransition` (from §10.3) replacing the opaque record; **propose-time graph validation** — all source/target stepIds resolve, exactly one entry, every step reachable by edge-connectivity from entry (conditional/prunable targets pass), **DAG (acyclic, visited-set walk)**, a BRANCH node has a `SEQUENTIAL` default last, every `conditionExpression` stepId reference resolves to a declared (ancestor) step; the unconditional/topology in-edge gate (empty = byte-identical linear). **Co-land the `startableStepId → startableStepIds` set-frontier signature with its UI/e2e consumers here** (server `Record<string,string[]>`, svelte `startableStepByPlan[pl.id]?.includes(s.id)`, e2e counts) so no DWP ships a broken check-types/svelte/Playwright intermediate (§10 land-order fix).
2. **DWP-02 — Fresh condition grammar + evaluator.** The discriminated-union predicate (step-state / artifact presence+count / numeric `attemptsMade` comparisons / `structuredResult` path-equality / ALL·ANY·NOT), a neutral replay-safe `(expr, subject)→bool` evaluator + exhaustiveness guard, the D4 subject projection; wire `conditionExpression` (with in-gate first-match) into the in-edge gate.
3. **DWP-03 — BRANCH.** First-match-in-gate + mandatory-default validation (D3); `prunableStepIds` read-model + controller-issued `PruneExecutionStep` → SKIPPED (D5).
4. **DWP-04 — WAIT.** `EnterExecutionStepWait` + `ResolveExecutionStepWait` + resume event (D6).
5. **DWP-05 — PARALLEL_GROUP + JOIN.** Set-frontier fan-out (N serialized `StartExecutionStep`), barrier-join gate (D7).
6. **DWP-06 — UI.** Execution-tab affordances for branch/wait/parallel + a graph view of `transitions`; multi-startable Start; prune/wait actions.

**Governance note (inherited):** author under the reopened grant; annotate `UNRATIFIED-AUTHORED`; stage only my files by explicit path; NO push (the human commits/pushes); `Co-Authored-By: Claude Opus 4.8 (1M context)`.

## 10. Self-critique and readiness

A **3-lens adversarial self-critique was EXECUTED** on v0.1.0 (governance honesty · correctness/back-compat/invariants · completeness/determinism; 3 code-grounded agents + a ranking synthesis). Verdict `NEEDS_DESIGN_REVISION` — **2 blockers + 6 majors + 3 minors**, all reconciled into §5/§6/§9 above:

- **BLOCKER (D5) → FIXED.** prune→SKIPPED is illegal from `NOT_READY`; v0.1.0 never pinned the pruned step's rest state → permanent completion deadlock (its own F-5 trap). Fix: steps rest **QUEUED**, prune fires the ratified **QUEUED→SKIPPED** (no new arrow; the DWP-02 anchor is now correct), the graph gate controls startability.
- **BLOCKER (D7) → FIXED.** blanket AND-join wedges/dishonest on a pruned/conditional/terminal-non-success in-edge. Fix: per-in-edge **disposition** (SATISFIED/NEUTRALIZED/PENDING) + the **barrier-join** rule (no PENDING, ≥1 SATISFIED), unifying PARALLEL fan-in and BRANCH-merge; all-neutralized → prune.
- **MAJOR (D3/D1) → FIXED.** exactly-one-taken was a read-model claim; a not-yet-pruned losing arm could be started in the window before prune → both arms run. Fix: **first-match evaluated in the start-gate** (a losing CONDITIONAL edge is NEUTRALIZED at the authority); prune becomes bookkeeping.
- **MAJOR (D5 dispatcher) → FIXED.** no driver named. Fix: `prunableStepIds` read-model + **controller-issued** prune (like Start), idempotent, replay-folds events.
- **MAJOR (D4 subject) → FIXED (×2).** `attemptsMade < cap` and `structuredResult`-conditioned BRANCH were inexpressible over a `{stepState, outputArtifactIds}`-only subject. Fix: subject carries replay-safe folded `attemptsMade` + `structuredResult` (still single-aggregate).
- **MAJOR (acyclicity) → FIXED.** a cyclic `transitions[]` yields an empty frontier forever. Fix: DAG validation + visited-set reachability at propose-time.
- **MAJOR (condition-ref) → FIXED.** a guard on a typo'd stepId resolves false silently → wrong branch. Fix: propose-time condition-ref resolution.
- **MAJOR (D2 PARALLEL redundant) → FIXED.** dropped to `{SEQUENTIAL, CONDITIONAL}`; concurrency is a PARALLEL_GROUP node with SEQUENTIAL out-edges.
- **MAJOR (land-order) → FIXED (DR-004-absorbed).** the set-frontier rename must co-land with its UI/e2e consumers — pinned to DWP-01 (§9).
- **MINORs → FIXED:** reachability defined as edge-connectivity-from-entry (conditional targets pass); parallel starts serialize on `aggregate_revision` (disclosed, not "concurrent commits"); StepType cite corrected to **RPH-DOC-002 §21** throughout.

**Readiness (post-critique): `READY_FOR_ACTIVATION`.** Both blockers were design-level and are resolved within the sponsor-ruled scope (R1/R2) — no new sponsor fork emerged; the join-disposition and QUEUED-at-rest refinements are disclosed for confirmation. Nothing built.

---

*Design-first, v0.2.0. R1 + R2 sponsor-ruled; D1–D8 resolved-with-disclosure; the §10 self-critique's two blockers + majors folded in. On Activate I author DR-004 (repository roadmap) + a fresh 3-lens self-critique, then build DWP-01…06 gated. Nothing built yet.*
