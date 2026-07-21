# JAN-EXECPLAN-DS-001 — Execution Plan View Design

**Status:** DESIGN-FIRST — for sponsor alignment. Nothing built.
**Date:** 2026-07-21
**Scope surface:** the **Undertaking Workbench** (`apps/rph-demo/src/routes/undertakings/[id]`), the "execution" tab.
**Companion:** builds on the JAN-PWADESIGNER simulator (`layerHandoff`) as its *constraint-checker* — the canonical seam that doc flagged (DS-001 §13, Guide §9.1).

---

## 1. What it is (one line)

The surface where an Undertaking's PWU **instances** get their real, temporal **execution plane** made visible (and, in scope-limited ways, authorable): each PWU's **Execution Plan → Steps → state**, plus an Undertaking-level **execution sequence** that (optionally) uses the simulator's hand-off dependency layering as an *advisory* constraint-check. This is the canonical home for execution *order* (Guide §9.1: *"A PWU defines professional work. It does not embed its runtime sequence"* — the sequence lives HERE, over instances, not on the PWA).

## 2. What it is NOT (guardrails — §9.1 is binding)

- **NOT a PWA-design surface.** Execution order belongs to the Undertaking/Plan, never the PWA/PWU-Type (the simulator is the design-time *preview*; this is the real thing).
- **NOT an assurance bypass.** *"A Plan cannot change Intent or Obligations, grant its own privilege, bypass assurance, or make a superseded PWU executable"* (§9.1). The view renders/authors plan+step mechanics; it never asserts assurance, never sets a PWU's `executionState` except through the existing gated command (`ChangePwuState`, backed by a real succeeded step).
- **NOT a temporal *engine*.** The view renders and (scope-limited) authors against the EXISTING command surface. It does not invent branch/loop evaluation, attempt-counting, or step sequencing that the domain does not yet support (see §4 gaps). Where the domain can't represent something (branches, plan completion), the view surfaces that honestly rather than faking it.
- **NOT a schedule with wall-clock time.** Steps carry `stepState`, not timestamps-as-authority; this is a state/dependency ordering, not a Gantt of clock times (unless/until Execution Attempts land, §4).

## 3. Canonical grounding (Coding Agent Guide §9.1 / §9.2)

- **§9.1** — Execution Plan (versioned, governed; steps/transitions, retry, tactic-change, escalation, termination); Execution Step (temporal machinery: model/tool invocation, retrieval, transformation, human interaction, wait, branch, parallel group, assurance invocation); Runtime Binding (role/model/tool/context/sandbox + requested-vs-granted); Execution Attempt (one bounded try). The constraint clause (§2 above).
- **§9.2** — the coordination loop: *load PWU + plan + shape + assurance → execute next eligible step → capture → assess → continue/retry/replan/escalate → impact closure*. The view visualizes exactly this loop's state.

## 4. Data footing — grounded (reuse vs green-field)

**Exists (build on it), file:line-grounded:**
- **Object model:** `ExecutionPlan` (`m1-object-fields.json:1057-1115`) — `workUnitId` (the PWU; **no `undertakingId`** — scope via the PWU), `planVersion`, embedded `steps[]`, `transitions[]`, the four policies, `status`. `ExecutionStep` (`:1730-1791`) — `id, executionPlanId, stepType, purpose, inputBindings, outputBindings, runtimeBindingId?, preconditions, postconditions, stepState`. `RuntimeBinding` (`:1117-1178`). Enums: `ExecutionPlanStatus` 8, `StepType` 9, `StepState` 10, `AuthorizationStatus` 5 (`canonical-vocabulary.json:726-783`).
- **State machines as DATA** (`transitions.data.ts:1355-1515`): the plan/step/binding legal-transition topology + guards (renderable today).
- **Write path + real invariants** (`execution.ts`): propose→approve→activate→start-step→complete-step, with the *one-active-plan-per-PWU* invariant (`:170-186`, derived from event history), the assumption-liveness gate on approve (`:107-126`), the plan-must-be-ACTIVE gate on step start (`:335-342`), and the exec≠assurance **floor gate** on step complete (`:404-433`). The controller→PWU bridge `rejectUnbackedExecutionSuccess` (`pwu.ts:633-661`).
- **UI reuse:** the Undertaking Workbench already runs **Svelte Flow** on this page (`undertakings/[id]/+page.svelte:1-3,75-81`); the generic layered-DAG layout + state-color rule (`lib/toFlow.ts:9-69`); the 7-tab shell + panel/table/rollup patterns; the assurance/traceability projection consumers. The reference drive `shapeAndExecute` (`reference-undertaking.ts:519-617`) is the real command sequence to mirror.

**Genuinely unbuilt (the temporal heart — scope carefully):**
- **No execution read-model.** Zero projections fold any `Execution*` event (grep-confirmed). → the view reads `EXECUTION_PLAN` aggregates directly OR a NEW execution projector is built (fork §7-A).
- **Hollow branch/loop machinery.** `transitions[]`, `RetryPolicy`, `*Policy`, `InputBinding`, `OutputBinding`, `Condition` are all "Helper undefined" — unschematized `unknown[]`; no interpreter sequences steps. Steps are a **flat ordered list** today (`transitions:[]` always empty in the reference + demo drives). → a step **DAG has no edge source**; render a flat/ordered step list first (fork §7-B).
- **No Execution Attempt object**, no retry-cap wiring; **no plan-completion handler** (a plan can only be CANCELLED, never COMPLETED) — so live "progress to done" and attempt history can't be shown/authored yet.
- **Execution ⟂ hand-off, by design.** `requiredInputs/Outputs` are on the PWU **Type**; `layerHandoff` is type-level, advisory, and explicitly *"NEVER an execution schedule"*; nothing links a step's bindings to its type's hand-off. → using `layerHandoff` to *constrain-check* instance execution order crosses a deliberate architectural cut (fork §7-C).

## 5. Proposed scope — three tiers (recommend Tier 1 now; Tier 2 behind a fork; Tier 3 deferred)

**Tier 1 — the per-PWU Execution Plan RENDER (buildable now, high value, canon-clean). RECOMMENDED first increment.**
- A NEW read projection (or scoped raw-read) exposing, per PWU instance in the Undertaking, its plan(s): `status`, `planVersion`, and each step's `stepType / purpose / stepState / runtimeBinding(auth) / bindings`, plus the plan's legal-transition topology (from the machine data).
- Replace the flat, **engine-global (bug)** execution tab with an **undertaking-scoped**, per-PWU **plan → steps** panel (reuse the tab shell + `toFlow` layered layout for the step sequence; color by `stepState`, mirroring the graph tab's `executionState` rule).
- Fix the scoping defect (`listExecutionPlans` unscoped, `+page.server.ts:169`) as part of this.
- Read-only first; then (scope-limited) surface the EXISTING authoring actions the handlers already support (start/complete/fail/retry a step, cancel a plan) as buttons that dispatch the real commands — mirroring the route's existing `beginExecute` action.

**Tier 2 — the Undertaking-level execution SEQUENCE + the `layerHandoff` constraint-checker (the systemic payoff; behind sponsor fork §7-C).**
- Arrange the Undertaking's PWU instances by their **types'** hand-off dependency (reuse `layerHandoff` over the bound PWA's type graph), showing each PWU's `executionState` — the "which unit runs when" view.
- **Advisory constraint-check:** flag when a *consumer* PWU is EXECUTING/SUCCEEDED while its *producer* PWU has not produced the artifact — a coherence advisory, never a gate (exactly the simulator's advisory posture). This is the promised bridge: the simulator's dependency order becomes the execution view's *constraint-checker*.

**Tier 3 — the temporal engine (DEFERRED; its own program).** Schematize `transitions[]`/policies/bindings (branch/loop/wait), the Execution Attempt object + retry cap, plan-completion/supersede handlers, and a step interpreter. The view can only *author* branches/loops once the domain represents them. Recorded as the un-defer path; NOT in this design.

## 6. Reuse (don't reinvent)

Svelte Flow + `toFlow.layout()` (layered DAG) + `styleFor`/`labelFor` (state color) — already on this page; the tab/panel/table/rollup shell; the `load()` scoping pattern used by `graph`/`pwuList`/`trace` (apply it to plans — fixes the bug); the reference `shapeAndExecute` sequence as the authoring exemplar; the `changePwuState` guard as the exec≠assurance boundary.

## 7. Open forks — decisions I need from you

- **A. Read-model:** build a NEW execution projector (folds `ExecutionPlanProposed/Approved/Activated`, `ExecutionStep{Started,Succeeded,Failed,Retried}`, `TacticalChangeApplied`, `ExecutionTerminated`) — *recommended*, consistent with the projection seam and live-progress rendering — vs. read `EXECUTION_PLAN` aggregates raw in `load()` (faster, but no event-level progress). *Rec: new projector.*
- **B. Step rendering:** flat ordered **step list/timeline** (honest — `transitions[]` is empty today) *recommended* vs. a step **DAG** (needs `transitions[]` edge data that doesn't exist yet → Tier 3). *Rec: flat list now; DAG when transitions land.*
- **C. The constraint-checker bridge (Tier 2):** may the type-level `layerHandoff` dependency be used as an **advisory** coherence check on instance execution order (never a gate)? This crosses the deliberate `PWA ≠ Execution Workflow` cut — but *advisorily*, which the corpus permits (`conservation`/`delegatedAssurance` are advisory). *Rec: yes, advisory-only, Tier 2 — but it's your ruling.*
- **D. Authoring depth:** read-only render first, then expose only the handler-backed actions (start/complete/fail/retry step, cancel plan)? Full plan *authoring* (branches, completion) is blocked on Tier 3 domain work. *Rec: render → handler-backed actions; defer authoring.*
- **E. Domain-gap disposition:** surface the missing plan-completion path (a plan can't reach COMPLETED today) as a visible "no completion handler" state + a recorded backlog item, rather than papering over it. *Rec: surface honestly.*

## 8. Verification approach

- **Unit** (new projector / raw-read scoping): folds the execution events into a per-PWU plan view; scoped to the undertaking (regression for the global-list bug); step-state color rule.
- **Component:** the plan→steps panel renders steps with their `stepType`/`stepState`; the constraint-checker (Tier 2) flags a consumer-before-producer case (reusing `layerHandoff`).
- **E2E:** open an undertaking whose reference PWU has an active plan (the seed `shapeAndExecute` path) → the execution tab shows the plan's step(s) + state (not just a count); a handler-backed step action dispatches the real command and the engine reflects it (INV-5: `executionState` only via the gated path). Non-authoritative where the view is read-only.
- **Static/EP-001:** svelte-check 0, SonarLint (EP-TST-13), browser-safety of any new projection (`rph-projections` stays pure).

## 9. Increment sketch (each: land → gate → commit; roadmap to follow on alignment)

1. **Execution read projection** (or scoped raw-read) + unit tests — the missing read-model; fixes the scoping bug.
2. **Per-PWU plan → steps panel** (Tier 1 render) replacing the flat table; component tests.
3. **Handler-backed step actions** (start/complete/fail/retry, cancel) — reuse the existing command drive; e2e.
4. **(Fork C) Undertaking execution sequence + `layerHandoff` constraint-checker** (Tier 2) — the simulator bridge; advisory-only.

---

*Design-first; awaiting sponsor alignment on §5 (tier scope) and §7 (forks A–E) before the roadmap. This spec deliberately surfaces that the execution temporal-engine is unbuilt (Tier 3) and that the hand-off↔execution bridge is a design decision (fork C), rather than assuming either.*
