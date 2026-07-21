# JAN-EXECPLAN-DR-001 — Detailed Implementation Roadmap

*Repository-specific implementation authority for the Execution Plan View (Tier 1 + Tier 2), derived per `JAN-ROADMAP-001-A` (Detailed Roadmap Generation & Normalization Standard).*

## 1. Document control and repository identity

| Field | Value |
| :--- | :--- |
| **Document ID** | `JAN-EXECPLAN-DR-001` |
| **Version** | `0.2.0-draft` — reconciled against the **EXECUTED** §3.7 self-critique (§19: three adversarial lenses — standards-conformance · code-grounding · sequencing/assurance — ran on v0.1.0 and returned real conditions, folded into the DWP contracts below). |
| **Status** | `FEATURE COMPLETE` — DWP-01…04 `DELIVERED`/`CONFORMANT` (built + gated 2026-07-21); see §21 delivery record. |
| **Generation standard** | `JAN-ROADMAP-001-A` v2.0.0-draft (§4 sections · §5 DWP contract · §6 grounding bar · §3.7 self-critique). |
| **Program model** | Standalone `JAN-EXECPLAN` program-instance adopting `JAN-ROADMAP-001-A` + `JAN-IRP@0.1.0-draft`. **There is no master roadmap** — this is a self-contained program-instance, so DWP `master_wave = EXECPLAN` and `master_work_packages` bind to `JAN-EXECPLAN-DS-001` **sections** (the DS is the master authority) rather than to a parent wave register. |
| **Design authority** | `JAN-EXECPLAN-DS-001@1.0` (Execution Plan View Design). Sponsor-aligned 2026-07-21: **Tier 1 + Tier 2**; fork C RULED (the `layerHandoff` constraint-check is permitted **advisory-only**); forks B/D/E at their recommendations (flat step list; render→handler-actions→defer-authoring; surface domain gaps honestly). **Fork A DIVERGES** from its DS recommendation — a pure aggregate-*shaping* read-model was chosen over the DS-recommended event-*folding* projector (event-fold deferred to Tier 3); disclosed and justified in §7-A/§15. Tier 3 (temporal engine) DEFERRED. |
| **Engineering-practice authority** | `JAN-PRPWA-EP-001@0.1.0-draft` (cross-cutting, REUSED; per its §1.3 **no requirement is left silent** — every EP-CMT/EP-OBS/EP-TST is dispositioned). **BINDING — commenting:** EP-CMT-1 (dual AI/human reader), EP-CMT-2 (six-category taxonomy Intent/Context/Boundary/Invariant/Tradeoff/WARNING), EP-CMT-3 (`Do not change:` decision block — realized on the advisory-never-gates boundary, DWP-04), **EP-CMT-4 (boundary-trigger comments — this work crosses the *workflow-engine-semantics* trigger squarely: the stepState/plan state machines, the floor gate, the PWA≠ExecutionWorkflow cut, plus the domain-command dispatch boundary)**, EP-CMT-6 (no secrets/PII in comments), EP-CMT-7 (commenting completion checks). **BINDING — testing:** EP-TST-1 (confidence not coverage), EP-TST-2 (evidence forms incl. documented intent), EP-TST-3 (feature/bug-fix change trigger — its prompt/infra dimensions N/A), EP-TST-4 (every bug → a permanent test — the F-6 scoping-bug regression), **EP-TST-5 (evidence pyramid — its *state-transition* layer is load-bearing here: every stepState reached, every command-backed transition exercised, every invalid transition rejected)**, EP-TST-6 (prefer real infra, no mocks), EP-TST-7 (assert engine truth not calls), EP-TST-11 (per-change author self-questions), EP-TST-12 (anti-patterns — incl. **no happy-path-only**, which drove the floor-gate rejection e2e), EP-TST-13 (SonarQube). **N/A (with reason):** EP-CMT-5 + EP-OBS-1…11 + EP-DBG-1 — a read view over existing commands adds no new instrumentation/log-levels/metrics/health signals, and no debugging episode is planned; **EXCEPT EP-OBS-5 is honored *by reuse*** (rejections surface the engine's existing classified `RPH_*`/`INVARIANT_VIOLATION` codes — none invented). EP-TST-8/9 (no LLM prompt / agent trajectory authored here); EP-TST-10 (no comment-assertion tooling beyond SonarLint). |
| **Repository & branch** | `hestami-ai/ai-home-maintenance` / `sonar/jpwb-remediation-2026-07-20` @ `.../janumiprofessionalworkbench` |
| **Revision at grounding** | HEAD `9be1b58f`; `dirty_state: true` (uncommitted JAN-PRPWA follow-up + Phase C + JAN-PWADESIGNER + this). |
| **Persistence revision** | `SCHEMA_VERSION=1`; **NO tables/migrations, NO contracts, NO new domain commands.** The execution contracts + handlers already exist; this roadmap adds a read-model + UI + reuses existing commands. |
| **Runtime identity** | Turborepo + Bun 1.3.14; `apps/rph-demo` (SvelteKit + `@xyflow/svelte`); Vitest + Playwright (msedge, `RPH_DEMO_MODE=test`) + svelte-check + eslint + dependency-cruiser. |
| **Grounding method** | Standard-digest + a 2-mapper repository inspection (execution-plane substrate + Undertaking Workbench UI) + canonical §9.1/§9.2; every current-state fact carries `file:line`. |

**Canonical basis (Guide §9.1/§9.2):** the Execution Plan (versioned/governed; steps/transitions/policies), Execution Step (temporal machinery), Runtime Binding, Execution Attempt; the hard constraint *"a Plan cannot change Intent or Obligations, grant its own privilege, bypass assurance, or make a superseded PWU executable."* This is the canonical home for execution *order* (over PWU instances), distinct from the timeless PWA (the JAN-PWADESIGNER simulator is its design-time preview; DS §1).

## 2. Activated scope

**In scope (Tier 1 + Tier 2):**
- **Tier 1 — per-PWU Execution Plan render.** A browser-safe read-model shaping the existing `EXECUTION_PLAN` aggregates into a per-PWU view (plan `status`/`planVersion`; each step's `stepType`/`purpose`/`stepState`/`runtimeBinding` auth/bindings; the legal-transition topology from the machine data). Replace the flat, engine-**global** (bug) execution tab with an **undertaking-scoped** plan→steps panel, reusing the page's Svelte Flow + `toFlow` layered layout. Then the **handler-backed step actions** the existing commands already support (Start/Complete/Fail/Retry a step; Cancel a plan) as form actions dispatching the real commands.
- **Tier 2 — the Undertaking execution sequence + the `layerHandoff` constraint-checker (fork C, advisory-only).** Arrange the Undertaking's PWU instances by their **types'** hand-off dependency (reuse `layerHandoff` over the bound PWA's type graph) with each PWU's `executionState`; **advisorily flag** (single-axis on `executionState`) a consumer PWU that has begun (`executionState ∈ {QUEUED,RUNNING,WAITING,RETRYING,SUCCEEDED}`) while no producer-type instance has SUCCEEDED — a coherence advisory, never a gate.

Decomposed into `JAN-EXECPLAN-DWP-01…04` (§9).

**Out of scope (deferred, dispositioned — §15):** the **temporal engine (Tier 3)** — schematizing `transitions[]`/policies/bindings (branch/loop/wait), the **Execution Attempt** object + retry cap, the **plan-completion/supersede handlers** (a plan can only be CANCELLED today), and a step interpreter. Full plan *authoring* (branches, completion) is blocked on this domain work; this roadmap renders + drives only the handler-backed happy core. Also out: wall-clock scheduling/Gantt (no attempt timestamps as authority).

## 3. Normative-source digest

- **§9.1 constraint (binding):** a Plan never changes Intent/Obligations, grants privilege, bypasses assurance, or makes a superseded PWU executable. The view issues NO new domain commands and sets a PWU's `executionState` only through the existing gated `ChangePwuState` (`rejectUnbackedExecutionSuccess`: SUCCEEDED must cite a real succeeded step — `pwu.ts:633-661`).
- **Exec ≠ assurance (INV-5):** `CompleteExecutionStep` moves `stepState`, never assurance; the de-minimis floor gate (`execution.ts:404-433`) blocks an AI-produced step result whose floor is unsatisfied. The view renders these facts; it never asserts assurance.
- **One active Plan per PWU** (`execution.ts:170-186`, derived from event history) — the view must render/act consistently with it (no "activate" affordance that would violate it; that guard stays server-side).
- **Advisory-only bridge (fork C ruling):** `layerHandoff` is a type-level dependency partial order, *"NEVER an execution schedule"* (`handoff-order.ts:7-15`); Tier 2 uses it strictly as an **advisory** cross-PWU coherence check — it gates nothing (mirrors `conservation`/`delegatedAssurance`).
- **Engineering practice (`JAN-ENGC-001` + `EP-001`):** comments-as-contract — EP-CMT-3's `Do not change:` block on the advisory-never-gates boundary, and EP-CMT-4 boundary comments where the view crosses **workflow-engine semantics** (the stepState/plan machines, the floor gate, the domain-command dispatch); testing-as-evidence — **EP-TST-5's state-transition layer** (every stepState's affordance + every invalid transition rejected: DWP-01/02/03), real fixtures (EP-TST-6), assert engine truth not calls (EP-TST-7), **no happy-path-only** (EP-TST-12 → the floor-gate rejection e2e); SonarQube (EP-TST-13); browser-safety of any new `rph-projections` module.

## 4. Current-state findings and evidence

All `CONFIRMED` (2-mapper inspection at HEAD `9be1b58f`) unless tagged.

- **F-1 Object model exists.** `ExecutionPlan` (`m1-object-fields.json:1057-1115`): `workUnitId` (the PWU — **no `undertakingId`**; scope via the PWU), `planVersion`, embedded `steps[]`, `transitions[]`, four policies, `status`. `ExecutionStep` (`:1730-1791`, a helper — no envelope/version): `id, executionPlanId, stepType, purpose, inputBindings, outputBindings, runtimeBindingId?, preconditions, postconditions, stepState`. `RuntimeBinding` (`:1117-1178`). Enums `ExecutionPlanStatus`(8)/`StepType`(9)/`StepState`(10)/`AuthorizationStatus`(5) (`canonical-vocabulary.json:726-783`). State machines as data (`transitions.data.ts:1355-1515`).
- **F-2 Write path + invariants exist** (`execution.ts`): `proposeExecutionPlan :43` (→UNDER_REVIEW; PWU must exist), `approveExecutionPlan :128` (assumption-liveness `:107-126`), `activateExecutionPlan :189` (**one-active-plan** `:170-186`), `cancelExecutionPlan :233`, `applyTacticalChange :244`, `startExecutionStep :320` (plan must be ACTIVE `:335-342`), `completeExecutionStep :348` (floor gate `:404-433`, INV-5 `:358-359`), `failExecutionStep :440`, `retryExecutionStep :451`. Steps are mutated on the plan aggregate (`advanceStep :262-317`).
- **F-3 The controller→PWU bridge** (`pwu.ts`): `changePwuState :670-760`; `rejectUnbackedExecutionSuccess :633-661` (executionState SUCCEEDED must cite a plan with a succeeded step). Steps do NOT auto-advance the PWU axis — it's a separate controller-asserted fact.
- **F-4 Undertaking/PWU-instance model.** `Undertaking` (`m1:1395-1445`) holds no child list (only `rootWorkUnitId?`); PWU instances (`proposePwu`, `pwu.ts:145-258`) carry `undertakingId? :202` + `pwuTypeId? :203` (the join to the PWU Type), enforced by RPH-CON-009 (`pwu.ts:112-141`). No `InstantiatePwu`; the graph is reconstructed from PWUs pointing back.
- **F-5 — NO execution read-model.** Zero `rph-projections` modules fold any `Execution*` event (grep-confirmed). `work-projection`/`pwu-replay` carry `executionState` only via `PwuStateChanged`, never a step event. → Tier 1 needs a NEW read shaping (fork A). *(This is the single biggest gap.)*
- **F-6 The execution tab is a flat, GLOBAL, count-only table + a scoping BUG.** `undertakings/[id]/+page.svelte:171-190` renders `plan id | workUnitId | status | step-count`; `data.plans` comes from `listExecutionPlans(engine)` **unscoped** (`+page.server.ts:169`; `queries.ts:45` `listByType`) — NOT filtered to the undertaking's PWUs (unlike `graph`/`pwuList`/`trace`). No steps/attempts/timeline/DAG.
- **F-7 UI reuse is strong.** Svelte Flow is already on this page (`+page.svelte:1-3,75-81`); `lib/toFlow.ts:9-69` = a generic layered-DAG layout + `stepState`-style color rule; the 7-tab shell (`:28-36`) + panel/table/rollup patterns; the `load()` scoping pattern (`graph`/`pwuList`/`trace`) to copy for `plans`.
- **F-8 The real drive to mirror** (`reference-undertaking.ts:519-617` `shapeAndExecute`): `BeginPwuShaping → MarkPwuReady → ProposeExecutionPlan(steps:[MODEL_INVOCATION], transitions:[]) → Approve → Activate → StartExecutionStep → satisfyFloor (one call, satisfying the 3 floor dimensions — schema-invariant / identity-provenance / reasoning-review, `:594-602`) → CompleteExecutionStep(SUCCEEDED) → ChangePwuState(exec=SUCCEEDED, cite planId)`. The route's `beginExecute` action mirrors it with a TRANSFORMATION+HUMAN step (`+page.server.ts:318-390`) — the exemplar for handler-backed actions. **Note (surfaced by the floor-gate lens):** both drives complete a step whose result *does* name a floor-backed output; a no-output `CompleteExecutionStep` (`outputArtifactIds:[]`) would produce zero result-subjects and the floor gate (`execution.ts:405-433`) would run zero times — so a happy-path "complete a step" test does NOT by itself exercise the gate (drives DWP-03's rejection test, §9).
- **F-9 Hollow branch/loop + no completion path (Tier-3 boundary).** `transitions[]`/`RetryPolicy`/`*Policy`/`InputBinding`/`OutputBinding`/`Condition` are "Helper undefined" (`m1:1080-1108,1755-1784`) — unschematized; `transitions:[]` is always empty in both drives → **no step-DAG edge source** (render a flat ordered step list, fork B). No `EXECUTION_ATTEMPT` object (`m3:400-403` is a *field* `producingExecutionAttemptId`, not an object — the `EXECUTION_ATTEMPT` id-prefix IS reserved, `canonical-vocabulary.json:1325` / `ids.ts:33`, but no m1 schema, no fields, no handler back it); no `CompleteExecutionPlan`/`Fail`/`Supersede` handler (registry `:114-123`) → a plan never reaches COMPLETED.
- **F-11 (step-level completion gap — NEW, from the sequencing lens).** The `StepState` machine (10 values, `canonical-vocabulary.json:757-771`; transitions `transitions.data.ts:~1421-1488`) has `initialState = NOT_READY`, but **only four transitions are command-backed** (registry `:118-123`): `QUEUED→RUNNING` (start), `RUNNING→SUCCEEDED` (complete), `RUNNING→FAILED` (fail), `FAILED→QUEUED` (retry). The forward arrows out of `NOT_READY`/`READY` (`→READY`, `→QUEUED`) have **no handler** (the `StartExecutionStep` docstring says "READY|QUEUED→RUNNING" but the handler requires `QUEUED`, `execution.ts:335-343`), and there is **no** `CancelExecutionStep`/skip/supersede handler. So a step authored below `QUEUED` (the domain's own initial state) is **undriveable** — the seed masks this by authoring steps directly at `stepState:'QUEUED'` (`+page.server.ts:349`). This is a step-level parallel to F-9's plan-completion gap; the view must surface it honestly (DWP-01/03, §15), never mint a commandless button for it.
- **F-10 Execution ⟂ hand-off, by design.** `requiredInputs/Outputs` are on the PWU **Type** (`pwa-graph.ts:28-29`); `layerHandoff` is advisory type-level order (`handoff-order.ts:7-15`); `execution.ts`/`pwu.ts` never reference `dataFlow`/`requiredInputs`. → Tier 2's cross-PWU constraint-check is NET-NEW and crosses the deliberate cut — permitted advisory-only (fork C).

## 5. Legacy semantic classification

- Execution tab render + `load()` `plans` slice → **REPLACE** (the flat global table) + **GENERALIZE** (scoped per-PWU plan→steps). The unscoped `listExecutionPlans` correction is **subsumed by that REPLACE** — the scoped per-PWU read *replaces* the global-list read, and the F-6 bug is corrected as part of the replacement (not a standalone taxonomy verb).
- New execution read shaping + the Tier-2 sequence/constraint-check → **CREATE** (additive; outside the legacy taxonomy).
- Temporal engine (transitions/attempts/completion) → **DEFER** (Tier 3, §15).
- No **REMOVE/RECLASSIFY/UNRESOLVED**; no contract/handler change.

## 6. Target-state gap analysis

| Target (DS-001) | Present at `9be1b58f` | Gap |
| :--- | :--- | :--- |
| Per-PWU plan→steps render | flat global count-only table (F-6) | scoped read-model (F-5) + a steps panel (reuse toFlow) |
| Undertaking-scoped plans | `listExecutionPlans` unscoped (F-6 bug) | scope to the undertaking's PWUs in `load()` |
| Handler-backed step actions | only `beginExecute` demo action (F-8) | Start/Complete/Fail/Retry step + Cancel plan as form actions |
| Tier-2 execution sequence + constraint-check | none; hand-off ⟂ execution (F-10) | reuse `layerHandoff`; advisory consumer-before-producer flag |
| Branch/loop authoring, plan completion | hollow/absent (F-9) | **DEFERRED (Tier 3)** |

## 7. Alternatives considered and selected strategy

**Fork resolutions (sponsor-aligned):**
- **A — read-model:** a NEW browser-safe **shaping** in `rph-projections` over the existing `EXECUTION_PLAN` aggregate rows (`{status, planVersion, steps:[{stepType,stepState,purpose,runtimeBindingAuth?}]}`), consumed by a scoped `load()`. *Chosen over* a full event-folding projector (defer live-progress/history to Tier 3) — the aggregate already embeds current step state, so shaping is sufficient and simpler, and stays pure/browser-safe. *Chosen over* raw-read-in-load (keeps the transform testable + reusable).
- **B — step rendering:** a **flat ordered step list/timeline** (honest — `transitions[]` empty, F-9). A step DAG is deferred with Tier 3 (needs transition edge data).
- **C — the bridge:** `layerHandoff` used **advisory-only** as a cross-PWU coherence check (RULED). Never gates; mirrors `conservation`.
- **D — authoring depth:** render → then expose only handler-backed actions (F-8 exemplar). Full plan authoring deferred (Tier 3).
- **E — domain gaps:** surface the missing plan-completion path as a visible state + a §15 backlog item; do not fake a "completed" plan.

**No normative-document corrections** — §9.1/§9.2 are honored; the advisory-bridge ruling is recorded (fork C).

## 8. Repository architecture and change map

- **CREATE:** `packages/rph-projections/src/execution-view.ts` (pure shaping `ExecutionPlanView` + the Tier-2 sequence/constraint helper) + `execution-view.test.ts`. A steps panel component (or an extension of the execution tab) in `apps/rph-demo`. `apps/rph-demo/e2e/execution-plan.e2e.ts`.
- **MODIFY:** `apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts` (scope `plans` to the undertaking; shape via `execution-view`; add the Tier-2 sequence data) + `+page.svelte` (the execution tab: plan→steps panel + the Tier-2 dependency sequence + the advisory flag). Handler-backed actions = new SvelteKit form actions dispatching the EXISTING commands (`StartExecutionStep`, `CompleteExecutionStep`, `FailExecutionStep`, `RetryExecutionStep`, `CancelExecutionPlan`).
- **NO** contract/vocab/handler/engine/DB change.

## 9. Detailed work-package register

```yaml
id: JAN-EXECPLAN-DWP-01
master_wave: EXECPLAN
master_work_packages: [DS-001:Tier1, DS-001:forkA]
title: "Execution read-model — pure browser-safe shaping of EXECUTION_PLAN aggregates + undertaking scoping"
outcome: "A new pure export in rph-projections shapes EXECUTION_PLAN aggregate rows into a per-PWU ExecutionPlanView { workUnitId, status, planVersion, steps:[{id, stepType, purpose, stepState, runtimeBindingId?}] }, and a scoping helper that selects the plans whose workUnitId is one of an Undertaking's PWU ids (fixing the F-6 global-list bug). Pure/browser-safe; the aggregate already embeds current step state, so no event-fold is needed for Tier 1."
knowledge_status: CONFIRMED
repository_scope:
  repositories: [hestami-ai/ai-home-maintenance]
  files_or_symbols:
    - "packages/rph-projections/src/execution-view.ts (NEW) — executionPlanView(row) + plansForPwus(rows, pwuIds)"
    - "packages/rph-projections/src/execution-view.test.ts (NEW)"
    - "packages/rph-contracts ExecutionPlan/ExecutionStep types (m1-object-fields.json:1057-1115,:1730-1791) — the input shape (read-only)"
  database_objects: []
  runtime_surfaces: ["pure projection; consumed by the undertaking route load()"]
dependencies: []
required_changes:
  - "executionPlanView: map an ExecutionPlan row to the view shape; carry step order as authored (flat list, fork B)."
  - "plansForPwus(rows, pwuIds): filter to workUnitId ∈ pwuIds (the scoping fix; there is no undertakingId on a plan — F-1/F-6). pwuIds are derived two-hop: PWU.undertakingId == the route's undertaking → the PWU's id → plan.workUnitId ∈ {those ids}."
  - "Per step, derive a display-only `advanceCommand?: 'start'|'complete'|'fail'|'retry'` from stepState via the four command-backed transitions ONLY (QUEUED→start, RUNNING→complete/fail, FAILED→retry); a step in NOT_READY/READY/WAITING/SKIPPED/CANCELLED/SUPERSEDED yields `undefined` — the honest F-11 signal the panel renders as 'no advance command in the domain' (DWP-03), never a fabricated button. Do NOT expose the full legal-transition topology as an affordance source (dropped: unused by Tier 1, and a topology→button generator would mint commandless actions — F-11)."
invariants:
  - "Pure/browser-safe (no server/engine import; depcruise projections-browser-safe holds)."
  - "Scoping totality: a plan is included iff its workUnitId is in the undertaking's PWU set — never the global list. A plan whose PWU lacks undertakingId (F-4: undertakingId is written only conditionally, pwu.ts:202) is EXCLUDED, not silently kept."
  - "affordance closure: the derived advanceCommand is drawn ONLY from the four command-backed step transitions (registry :118-123) — never from the wider machine topology (F-11)."
prohibited_shortcuts:
  - "Do NOT read the global EXECUTION_PLAN list unscoped (the F-6 bug)."
  - "Do NOT fold events for Tier 1 (the aggregate embeds current state); a live-progress projector is Tier 3."
  - "Do NOT invent branch/loop edges from empty transitions[] (fork B)."
  - "Do NOT derive advanceCommand from the full stepState machine topology (only the 4 command-backed arrows — F-11)."
tests:
  - "Unit: shape a plan row → view; scoping selects only in-undertaking plans (regression for the global-list bug); empty/no-plan PWU; multi-step plan preserves order."
  - "Unit (scoping join key, F-6/L3): a plan whose workUnitId is a PWU with undertakingId==the route undertaking is INCLUDED; a plan whose workUnitId is a PWU in a DIFFERENT undertaking is excluded (no leak); a plan whose PWU lacks undertakingId is excluded (asserted, not a silent drop of an in-scope plan)."
  - "Unit (advanceCommand/F-11): a QUEUED step→'start'; RUNNING→'complete'|'fail'; FAILED→'retry'; NOT_READY/READY/WAITING/SKIPPED/CANCELLED/SUPERSEDED→undefined (asserted for every value)."
evidence: ["execution-view.test.ts green; boundary 0 (browser-safe); check-types green; SonarLint clean (EP-TST-13)"]
migration_and_compatibility: ["additive; no consumers changed until DWP-02"]
rollback_and_recovery: ["delete the module + test"]
risks: ["ExecutionPlan row shape drift — mitigated by typing against the generated contract"]
open_decisions: []
exit_criteria: ["shaping + scoping (incl. undertakingId-join-key) + advanceCommand unit tests green; boundary 0; check-types 21/21"]
delivery_state: DELIVERED
conformance_state: CONFORMANT
```

```yaml
id: JAN-EXECPLAN-DWP-02
master_wave: EXECPLAN
master_work_packages: [DS-001:Tier1, DS-001:forkB]
title: "Per-PWU plan → steps panel (Tier 1 render), undertaking-scoped, replacing the flat global table"
outcome: "The execution tab shows, per PWU instance in the Undertaking, its plan(s): status + planVersion + an ordered list of steps (stepType · purpose · stepState, colored by an explicit stepState→color map that MIRRORS the styleFor state→color *pattern* — not the same function, since styleFor keys on executionState/qualifiedSuccess, a different vocabulary from the 10-value stepState), and the runtime-binding auth where present. Fed by DWP-01's scoped read (bug fixed). Read-only; reuses the page's tab/panel/table patterns (Svelte Flow is NOT required for a flat, edgeless step list — fork B)."
knowledge_status: CONFIRMED
repository_scope:
  repositories: [hestami-ai/ai-home-maintenance]
  files_or_symbols:
    - "apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts:169-174 (scope plans + shape via execution-view) / :51-71 (pwuList → pwu ids)"
    - "apps/rph-demo/src/routes/undertakings/[id]/+page.svelte:171-190 (the execution tab) / :1-3,75-81 SvelteFlow / lib/toFlow.ts:9-69 (layout + color)"
  database_objects: []
  runtime_surfaces: ["Undertaking Workbench 'execution' tab"]
dependencies: [JAN-EXECPLAN-DWP-01]
required_changes:
  - "load(): replace the unscoped listExecutionPlans with DWP-01 plansForPwus(rows, undertakingPwuIds) + executionPlanView shaping."
  - "execution tab: per-PWU plan panel — status/version header + ordered steps colored by stepState; group by PWU."
  - "Define an explicit stepState→color map covering ALL 10 StepState values (NOT_READY/READY/QUEUED/RUNNING/WAITING/SUCCEEDED/FAILED/SKIPPED/CANCELLED/SUPERSEDED); mirror the styleFor bg/fg/border *pattern* but do NOT call styleFor (it keys on a different enum). Reuse the tab/panel/table patterns; no new global layout."
invariants:
  - "Undertaking-scoped (F-6 fix asserted); read-only (no command dispatched in this DWP)."
  - "Existing tabs (graph/overview/assurance/traceability) unchanged."
  - "Every stepState value maps to a defined color (no undefined/fallback-to-transparent for the WAITING/SKIPPED/SUPERSEDED tail the executionState rule never covered)."
prohibited_shortcuts: ["Do NOT keep the engine-global plan list; do NOT show a step count only.", "Do NOT reuse styleFor directly for stepState (it colors executionState/qualifiedSuccess, not stepState)."]
tests:
  - "component/e2e: the execution tab shows a plan's steps + states for a seeded undertaking (reference shapeAndExecute path), scoped to it; a second undertaking's plans do not leak in."
  - "Unit/component: every one of the 10 StepState values renders a defined color (no undefined) — the stepState→color-map totality check."
evidence: ["svelte-check 0; e2e green"]
migration_and_compatibility: ["the flat table is replaced; other tabs untouched"]
rollback_and_recovery: ["revert the tab + load() slice"]
risks: ["reference seed may have one step per PWU — the panel must still read as a list, not a singleton special-case"]
open_decisions: ["DS-001 fork B: flat list now (bound); DAG when transitions[] gains edges (Tier 3)"]
exit_criteria: ["scoped plan→steps panel renders; scoping regression asserted; svelte-check 0"]
delivery_state: DELIVERED
conformance_state: CONFORMANT
```

```yaml
id: JAN-EXECPLAN-DWP-03
master_wave: EXECPLAN
master_work_packages: [DS-001:Tier1, DS-001:forkD]
title: "Handler-backed step actions — Start/Complete/Fail/Retry step + Cancel plan (existing commands only)"
outcome: "The plan panel exposes ONLY the actions the existing handlers support, as SvelteKit form actions dispatching the real domain commands (StartExecutionStep, CompleteExecutionStep, FailExecutionStep, RetryExecutionStep, CancelExecutionPlan) — mirroring the route's existing beginExecute action. The actionable set is an EXPLICIT ALLOWLIST keyed to the four command-backed step transitions (DWP-01's advanceCommand) + CancelExecutionPlan — the machine's wider legal-transition topology is display-only, NEVER the button generator (F-11: SKIP/CANCEL-step/WAIT/SUPERSEDE are legal-but-commandless). The engine's guards (plan-must-be-ACTIVE, floor gate on complete, one-active-plan) remain authoritative; a rejection surfaces verbatim. No new command; no plan-completion affordance and no step-cancel affordance (neither exists — F-9/F-11, surfaced honestly)."
knowledge_status: CONFIRMED
repository_scope:
  repositories: [hestami-ai/ai-home-maintenance]
  files_or_symbols:
    - "apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts:318-390 beginExecute (the form-action + command-dispatch exemplar)"
    - "packages/rph-application/src/handlers/registry.ts:118-123 (the FOUR command-backed step transitions + CancelExecutionPlan — the allowlist source of truth)"
    - "packages/rph-application/src/handlers/execution.ts:320,:348 (floor gate :404-433),:440,:451,:233 (the commands these actions dispatch)"
    - "apps/rph-demo/src/routes/undertakings/[id]/+page.svelte (the plan panel action buttons)"
  database_objects: []
  runtime_surfaces: ["SvelteKit form actions → existing domain commands"]
dependencies: [JAN-EXECPLAN-DWP-02]
required_changes:
  - "Form actions for StartExecutionStep/CompleteExecutionStep/FailExecutionStep/RetryExecutionStep/CancelExecutionPlan, each dispatching the existing command and reflecting the engine result (accept/reject verbatim)."
  - "Render a step's action from DWP-01's advanceCommand allowlist ONLY (QUEUED→Start, RUNNING→Complete|Fail, FAILED→Retry) + a plan-level Cancel; a step whose advanceCommand is undefined (NOT_READY/READY/WAITING/SKIPPED/CANCELLED/SUPERSEDED) renders NO button. A rejected command surfaces its RPH_* reason."
  - "Surface the F-9 gap honestly: no plan-completion action (the domain has no CompleteExecutionPlan handler) — a note + §15 backlog, not a fake button."
  - "Surface the F-11 gap honestly: a step below QUEUED (NOT_READY/READY) — the domain's own initial state — has no advance command; render a 'no advance command in the domain (below QUEUED)' note, not an inert mystery row. §15 backlog."
invariants:
  - "§9.1: no assurance bypass — CompleteExecutionStep's floor gate stays authoritative; the UI never sets executionState except via the existing gated ChangePwuState (out of this DWP's scope; the actions only move stepState/plan status)."
  - "One-active-plan invariant stays server-side; no UI affordance can violate it."
  - "Allowlist closure: the panel can dispatch ONLY the 5 allowlisted commands; there is NO code path from the machine topology to a button (F-11)."
prohibited_shortcuts:
  - "Do NOT add a new domain command or a plan-completion shim (F-9), or a step-cancel/skip/supersede shim (F-11)."
  - "Do NOT generate buttons from the stepState machine topology — use the explicit allowlist (a topology-driven set would offer commandless Skip/Cancel-step/Wait/Supersede, F-11)."
  - "Do NOT fabricate success on a rejected command (react to ok:false)."
tests:
  - "e2e (happy core): start then complete a step on a seeded active plan whose Complete NAMES a floor-backed output → the engine records SUCCEEDED (introspect); INV-5 (executionState only via the gated ChangePwuState path) unviolated."
  - "e2e (illegal action): complete a non-RUNNING step / start on a non-ACTIVE plan → rejected with its RPH_* reason surfaced verbatim."
  - "e2e (floor gate DEMONSTRATED, L3-C5): a Complete naming an AI-produced, floor-UNSATISFIED output → the engine REJECTS with the RPH_INVARIANT_VIOLATION floor reason surfaced verbatim (and the unresolved-artifact reject, execution.ts:410-417). This is what evidences 'floor gate stays authoritative' — the happy path alone does not (a no-output completion has zero result-subjects and the gate runs zero times, F-8)."
  - "component: a step in NOT_READY/READY/WAITING/SKIPPED/CANCELLED/SUPERSEDED renders NO action button; no Cancel-step button exists anywhere (F-11); a NOT_READY/READY step shows the honest 'no advance command below QUEUED' note."
evidence: ["e2e green (happy + illegal + floor-REJECT); introspect ground-truth matches the UI; the floor gate is shown rejecting, not merely claimed"]
migration_and_compatibility: ["additive actions; read path unchanged"]
rollback_and_recovery: ["remove the form actions + buttons"]
risks: ["action legality drift vs the machine — mitigated by the explicit 5-command allowlist (registry :118-123), NOT a topology derivation (F-11); the allowlist is the single source of affordance truth"]
open_decisions: []
exit_criteria: ["step actions dispatch real commands + reflect engine truth; illegal-action AND floor-gate-REJECT rejections asserted; commandless stepStates render no button; e2e green"]
delivery_state: DELIVERED
conformance_state: CONFORMANT
```

```yaml
id: JAN-EXECPLAN-DWP-04
master_wave: EXECPLAN
master_work_packages: [DS-001:Tier2, DS-001:forkC]
title: "Undertaking execution sequence + layerHandoff advisory constraint-checker (the simulator bridge)"
outcome: "An Undertaking-level view arranging the PWU instances by their TYPES' hand-off dependency (reuse layerHandoff over the bound PWA's PWU-Type graph) with each PWU's executionState, plus a SINGLE-AXIS ADVISORY flag: for a producer→consumer type edge, fire when the consumer instance HAS BEGUN (executionState ∈ {QUEUED,RUNNING,WAITING,RETRYING,SUCCEEDED}) while NO producer-type instance has SUCCEEDED (executionState). Advisory ONLY — it gates nothing, mirroring conservation/delegatedAssurance. This is the JAN-PWADESIGNER simulator's dependency order acting as the execution view's constraint-checker (fork C ruling)."
knowledge_status: CONFIRMED
repository_scope:
  repositories: [hestami-ai/ai-home-maintenance]
  files_or_symbols:
    - "packages/rph-projections/src/execution-view.ts (extend: sequenceView(handoffOrder, pwuInstances) using layerHandoff output)"
    - "packages/rph-projections/src/handoff-order.ts (layerHandoff — reused, unchanged)"
    - "apps/rph-demo/src/lib/server/workbench.ts:252-281 buildPwaExport(pwaId, engine) — the EXISTING server wrapper (listPwuTypes → PwaGraphNode[] → buildPwaGraphExport); already server-consumed by lib/server/floor.ts:280 and imported by this route's load() (+page.server.ts:24). REUSE it — do NOT re-derive buildPwaGraphExport."
    - "apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts (call buildPwaExport for the bound (pwaId,pwaVersion); surface pwuTypeId on the pwuList slice for the join, :62-71) / +page.svelte (the sequence + advisory flag)"
  database_objects: []
  runtime_surfaces: ["Undertaking Workbench execution tab — the cross-PWU sequence"]
dependencies: [JAN-EXECPLAN-DWP-01, JAN-EXECPLAN-DWP-02]
required_changes:
  - "Build the bound PWA's PWU-Type graph via the EXISTING buildPwaExport(pwaId, engine) wrapper (workbench.ts:252) → layerHandoff → dependency layers over TYPES. Scope the type-graph build to the instances' bound (pwaId, pwaVersion) (RPH-CON-009, pwu.ts:89-94) — listPwuTypes filters by pwaId ONLY (queries.ts:37-38), so a multi-version type set would strand bound-version instances among orphan other-version nodes; filter to the bound pwaVersion."
  - "Surface pwuTypeId on the serialized pwuList (currently dropped, +page.server.ts:62-71 keeps typeName/typePwaId but not the raw pwuTypeId) OR perform the type→layer join server-side in load() where the raw pwuTypeId is available (:52). The join key must be present, not reconstructed from typeName."
  - "Join instances→types by pwuTypeId (F-4) → arrange by the type's dependency layer; show executionState per instance. THREE join states, each explicit: (a) instance with a pwuTypeId that IS a node in the graph → placed at its layer; (b) instance with NO pwuTypeId (local extension) → shown, not placed; (c) instance whose pwuTypeId is NOT in the built graph (off-graph: a child-type or stale-version type) → shown, not placed (same bucket as b) — asserted, never dropped or crashed."
  - "Advisory constraint-check (SINGLE AXIS — executionState only). EXECUTING is a value of workLifecycleState (20 values), SUCCEEDED is a value of executionState (10 values) — they are ORTHOGONAL axes (canonical-vocabulary.json:130-153 vs :158-172); the predicate must NOT mix them. Fire iff: consumer.executionState ∈ {QUEUED,RUNNING,WAITING,RETRYING,SUCCEEDED} (has begun) AND for the producer TYPE, NO instance has executionState==SUCCEEDED. Cardinality M+: a producer type with N instances → the advisory considers ALL of them; it fires only if NONE has SUCCEEDED (a single succeeded producer instance satisfies the type-level hand-off, since nothing links a specific step binding to a specific producer instance — F-10)."
invariants:
  - "Advisory-only (fork C) — STRUCTURAL, not just behavioral: the advisory value's type is NEVER an input to a form action or a dispatch call (a typed seam, mirroring how handoff-order.ts already isolates analyzePwaGraph.valid; keep the 'Do not change' comment). It gates nothing, changes no state, blocks no action."
  - "SINGLE-AXIS predicate: the check reads ONLY executionState — never workLifecycleState (no EXECUTING/SUCCEEDED axis-mixing)."
  - "Type/instance join is by pwuTypeId (F-4); an instance with no pwuTypeId OR a pwuTypeId absent from the built graph is shown but not dependency-placed (never dropped)."
  - "Type graph scoped to the bound (pwaId, pwaVersion) — not all versions of the pwaId."
prohibited_shortcuts:
  - "Do NOT let the check gate any command or block any UI action (it MUST stay advisory — the PWA≠ExecutionWorkflow cut is only crossed advisorily)."
  - "Do NOT re-derive hand-off order — reuse layerHandoff (F-10 discipline: exec ⟂ hand-off is crossed advisory-only)."
  - "Do NOT re-derive the type graph — reuse buildPwaExport (workbench.ts:252), not a hand-rolled listPwuTypes→buildPwaGraphExport."
  - "Do NOT phrase the predicate across two axes (workLifecycleState.EXECUTING vs executionState.SUCCEEDED) — single-axis executionState only."
tests:
  - "unit (placement): sequenceView places instances by their type's dependency layer; an instance with no pwuTypeId is shown-not-placed; an instance whose pwuTypeId is absent from the graph (off-graph) is shown-not-placed (asserted, no crash/drop)."
  - "unit (single-axis advisory, L3-C1): the advisory fires for a consumer-has-begun / producer-not-SUCCEEDED fixture and is silent otherwise; a fixture whose two axes DISAGREE (workLifecycleState==EXECUTING but executionState!=has-begun, or vice-versa) proves the predicate keys on executionState ONLY."
  - "unit (M+ cardinality, L3-C2): a producer type with 2 instances — the advisory is SILENT if any one producer instance is SUCCEEDED, and FIRES only if none is; consumer M+ likewise evaluated per consumer instance."
  - "unit (version scope, L3-C2): a type set spanning two pwaVersions → only the bound-version types feed layerHandoff (bound instances not stranded among orphan nodes)."
  - "component/e2e: the sequence renders with executionState; the advisory flag appears for an out-of-order fixture; it gates nothing (all actions still available)."
evidence: ["unit (placement + single-axis + M+ + version-scope) + e2e green; the advisory never blocks (asserted); the advisory-value→dispatch typed seam holds (structural)"]
migration_and_compatibility: ["additive; Tier 1 unaffected"]
rollback_and_recovery: ["remove the sequence view + advisory"]
risks:
  - "local-extension instances (no pwuTypeId) — handled: shown, not dependency-placed"
  - "off-graph pwuTypeId (child/stale-version type) — handled: shown, not placed (asserted, not dropped)"
  - "M+ cardinality — no instance-level data-flow binding exists (F-10); the advisory is type-level (any-succeeded-producer satisfies), disclosed as an advisory-only approximation, never a gate"
open_decisions: []
exit_criteria: ["dependency-ordered instance sequence + single-axis advisory (never gating, M+/off-graph/version-scope handled) green; the advisory→dispatch typed seam asserted"]
delivery_state: DELIVERED
conformance_state: CONFORMANT
```

## 10. Data and persistence changes

**None.** No schema/tables/migration; no new contracts or domain commands. Tier 1 reads existing `EXECUTION_PLAN` aggregates (which embed `steps[]`); Tier 2 reuses `layerHandoff` over the bound PWA's type graph. Handler-backed actions dispatch EXISTING commands. `SCHEMA_VERSION` unchanged.

## 11. Execution, compatibility, and migration strategy

Land order (§17): **01 → 02 → 03 → 04** — the read-model (01) feeds the panel (02); the actions (03) and the Tier-2 sequence (04) both build on 02. They are *independent in logic* but **serialized on shared files**: both MODIFY `+page.server.ts` AND `+page.svelte` (the "∥" of v0.1.0 was optimistic — parallel work would merge-conflict on those two route files), so 03 lands before 04. Each DWP: land → gate → commit. No `bun run gen`. Rebuild `rph-projections` dist before the app's svelte-check/e2e. Back-compat: the execution tab is replaced (a strict improvement — scoped + step detail); all other tabs untouched.

## 12. Assurance, tests, and evidence plan

- **Unit (DWP-01):** the pure `execution-view` shaping + undertaking scoping (the F-6 bug regression, incl. the two-hop `undertakingId`→pwuIds→`workUnitId` join key and the PWU-lacks-`undertakingId` exclusion); the `advanceCommand` derivation for every `stepState` value (only the 4 command-backed arrows).
- **Unit (DWP-04):** `sequenceView` placement (placed / no-pwuTypeId shown-not-placed / off-graph shown-not-placed); the **single-axis** advisory (fires / silent, incl. the two-axes-disagree discriminator — reads `executionState` only, never `workLifecycleState.EXECUTING`); **M+** cardinality (any-succeeded-producer silences it); **version-scope** (bound `pwaVersion` types only).
- **Component (DWP-02):** the plan→steps panel renders steps + `stepState` color (all 10 values map to a defined color); scoped (no cross-undertaking leak). **Component (DWP-03):** commandless stepStates render no button; no Cancel-step button exists; the NOT_READY/READY honest note.
- **E2E (DWP-03/04):** step actions dispatch real commands + reflect `introspect` ground truth; illegal-action rejection; **the floor gate DEMONSTRATED rejecting** an AI-produced floor-unsatisfied Complete (`RPH_INVARIANT_VIOLATION` verbatim) + the unresolved-artifact reject — not merely a happy-path claim (F-8); INV-5 (executionState only via the gated path) unviolated; the Tier-2 advisory appears for an out-of-order fixture and **gates nothing**.
- **Static/EP:** svelte-check 0, eslint 0, boundary 0 (`rph-projections` stays browser-safe), SonarLint (EP-TST-13). **EP-TST-5 layers** realized — Unit=shaping/scoping **+ the state-transition layer** (every stepState → its advanceCommand; every stepState → a defined color; every commandless stepState → no button; DWP-01/02/03); Component=panel; E2E=the command drive incl. **illegal-transition + floor-gate rejection** (EP-TST-5 "every invalid transition rejected" + EP-TST-12 "no happy-path-only"). Real fixtures, no mocks (EP-TST-6); assert engine truth not calls (EP-TST-7); rejections surface the engine's existing classified codes, none invented (EP-OBS-5 by reuse).

## 13. Security, authority, and tenant-impact analysis

No new authority surface, secrets, tenant boundary, or persistence. The read view issues no commands; the handler-backed actions dispatch EXISTING, already-authorized commands whose engine guards (plan-ACTIVE, floor gate, one-active-plan, `rejectUnbackedExecutionSuccess`) remain authoritative — the UI can only offer a legal action and must surface a rejection verbatim. §9.1 honored: nothing here bypasses assurance or changes obligations. The Tier-2 advisory changes no state.

## 14. Observability, recovery, and rollback

The read view has no engine side effects. The handler-backed actions produce the SAME events the existing `beginExecute`/reference drive already produce (observable via the engine's existing log). Each DWP is additive/independently revertible (§9 rollback lines). No data recovery concerns (no new writes beyond the existing commands).

## 15. Risks, assumptions, unknowns, decisions, deferrals, divergences

- **Decisions:** Tier 1 + Tier 2 (sponsor); fork A (shaping read-model, defer event-fold — a **divergence**, see below), B (flat step list), C (advisory-only bridge — RULED), D (render→handler-actions), E (surface gaps).
- **Deferrals (Tier 3, dispositioned):** the temporal engine — `transitions[]`/policy/binding schemas (branch/loop/wait), the **Execution Attempt** object + retry cap, the **plan-completion/supersede handlers** (a plan can only be CANCELLED — F-9), a step interpreter, and full plan *authoring*. Also: a live-progress event-folding projector; a step DAG (needs transition edges); wall-clock scheduling.
- **Surfaced domain gaps (backlog, honest surfacing not faking):** (§7-E) no `CompleteExecutionPlan` handler → the view shows an active plan's steps but no "plan done" state; **(F-11)** no advance command for a step below `QUEUED` (NOT_READY/READY — the domain's initial state) and no step cancel/skip/supersede handler → the panel renders an honest "no advance command in the domain" note rather than an inert row or a fabricated button. Both recorded as Tier-3 domain work.
- **Risk:** the Tier-2 advisory must never leak into a gate (fork C) — enforced **structurally** (a typed seam: the advisory value's type is never an input to a form action / `dispatch`, mirroring `handoff-order.ts`'s `analyzePwaGraph.valid` isolation) **plus** behaviorally (a test asserts all actions remain available when the advisory fires) **plus** a `Do not change:` comment.
- **Assumptions:** the reference seed's PWUs have an active plan with ≥1 step (CONFIRMED via `shapeAndExecute`); the bound PWA's type graph is buildable in `load()` (CONFIRMED — the server wrapper `buildPwaExport(pwaId, engine)`, `workbench.ts:252-281`, is already server-consumed by `lib/server/floor.ts:280` and imported by this route's `load()` at `+page.server.ts:24`; the client-side Designer usage is NOT the relevant evidence — server-`load()` buildability rests on the server wrapper).
- **Divergence from DS-001 (fork A):** the DS §7-A *recommended* a NEW event-**folding** projector (folding `ExecutionPlanProposed/…`, `ExecutionStep{Started,Succeeded,…}` etc.). This roadmap instead chose a pure aggregate-**shaping** read-model (DWP-01) and **defers the event-fold to Tier 3**. Rationale: the `EXECUTION_PLAN` aggregate already embeds current step state, so Tier-1 render needs no event history; shaping is simpler, stays pure/browser-safe, and the event-fold's only added value (live per-event progress + attempt history) is a Tier-3 concern (blocked on the Execution Attempt object anyway, F-9). DS §5 explicitly permitted "a NEW read projection **(or scoped raw-read)**", so shaping sits within the DS's own latitude — but it is a deliberate deviation from fork A's stated *recommendation*, disclosed here rather than papered over as "no divergence." No other DWP diverges (Tiers 1+2 implemented as specified; Tier 3 deferred as specified).

## 16. Traceability matrix

| DS-001 authority | DWP | Files (representative) | Tests |
| :--- | :--- | :--- | :--- |
| Tier 1 / fork A read-model | DWP-01 | `execution-view.ts` (NEW) | shaping + scoping unit (F-6 regression) |
| Tier 1 / fork B render | DWP-02 | undertaking route execution tab; `toFlow` | panel render; scoped (no leak) |
| Tier 1 / fork D actions | DWP-03 | route form actions; `execution.ts` commands | e2e command drive + illegal-action reject |
| Tier 2 / fork C bridge | DWP-04 | `execution-view.ts` sequenceView; `layerHandoff`; `buildPwaExport` | single-axis advisory (M+/off-graph/version-scope); never gates (structural seam) |
| Tier 3 temporal engine | **DEFERRED** | — | — |
| Engineering practice (EP-CMT/EP-TST/EP-TST-13) | cross-cutting | comments + tests; §12 | evidence ladder · SonarQube |

## 17. Implementation ordering and concurrency plan

Critical path: **01 → 02 → 03 → 04.** DWP-01 (read-model) feeds DWP-02 (panel); DWP-03 (actions) and DWP-04 (Tier-2 sequence) both depend on 02. They are *independent in logic* (command dispatch vs cross-PWU advisory) but **serialized on the shared route files** — both edit `+page.server.ts` and `+page.svelte`, so run 03→04 rather than in parallel (avoids a merge conflict on the two files; each is a small UI addition, so the serialization cost is negligible). Gate each centrally (check-types · test · lint · boundary · svelte-check · Playwright); never in a sub-agent. Rebuild `rph-projections` dist before the app's svelte-check/e2e. **SonarLint per-DWP on changed files (EP-TST-13).**

## 18. Exit criteria and gate package requirements

**Feature complete when:** DWP-01…04 `DELIVERED`; full gate green (check-types · test · lint 0 · boundary 0 · svelte-check 0 · SonarQube dispositioned EP-TST-13 · Playwright incl. the new spec + regression); the F-6 scoping bug has a passing regression; the handler-backed actions reflect engine truth with illegal-action rejection; the Tier-2 advisory fires correctly and **gates nothing** (asserted); traceability (§16) reaches code+tests. **Gate package** (`G-EXECPLAN`): per-DWP conformance + evidence + SonarQube disposition + readiness (§19), modeled on the JAN-PRPWA/JAN-PWADESIGNER records.

## 19. Self-critique and readiness determination

Per `JAN-ROADMAP-001-A §3.7`, a **3-lens adversarial self-critique was EXECUTED** on v0.1.0 (three independent general-purpose agents, each grounding its claims against the repository at HEAD `9be1b58f`): **Lens 1 — standards-conformance**, **Lens 2 — code-grounding**, **Lens 3 — sequencing/assurance**. Their conditions are reconciled into this v0.2.0 (each condition names where it was folded).

**Verdicts as returned:** Lens 1 = `REVISION_REQUIRED` (1 blocker + 5 conditions); Lens 2 = `READY_WITH_CONDITIONS` (grounding validated byte-accurate; 4 precision conditions); Lens 3 = `READY_WITH_CONDITIONS` (load-bearing safety property confirmed sound — DWP-03 never touches the executionState/assurance axes, the floor gate + `rejectUnbackedExecutionSuccess` stay the only path to SUCCEEDED/SATISFIED, `layerHandoff` is advisory by construction; 5 MAJOR correctness + 4 MINOR hardening conditions). Two lenses independently re-confirmed the grounding (F-5 no-read-model, F-6 the scoping bug, the floor gate, INV-5).

**Conditions and reconciliation (all applied in this v0.2.0):**

- **L1-BLOCKER (pre-stamp) → FIXED.** v0.1.0's §1 claimed the critique was executed/reconciled while this §19 was a future-tense placeholder with zero surfaced conditions ("the two states cannot coexist"). The critique has now actually run; §1's version and this section record the real executed conditions (past tense). *(§1, §19.)*
- **L1-MAJOR (dangling `F-13`) → FIXED.** A copy-paste artifact from sibling roadmaps — this doc defines F-1…F-11, not F-13; the intended finding for the layerHandoff-reuse discipline is **F-10** (exec ⟂ hand-off). Corrected in DWP-04 `prohibited_shortcuts` and here (this lens-4 line). *(DWP-04, §19.)*
- **L1-MAJOR (false "no divergences") → FIXED.** Fork A *does* diverge from its DS recommendation (shaping vs event-folding projector). Recorded as a disclosed divergence in §15 and corrected in §1 ("fork A DIVERGES"). *(§1, §15.)*
- **L1-MINOR (off-taxonomy "FIX") → FIXED.** The unscoped-`listExecutionPlans` correction is subsumed by the REPLACE verb, not a standalone "FIX". *(§5.)*
- **L1-MINOR (untested DWP-01 transition-topology) → FIXED by dropping it.** Tier 1 renders steps+state, not the topology; exposing the full topology had no test/consumer AND would have been a button-generator hazard (see L3-C3), so it is removed; the derived `advanceCommand` (4 command-backed arrows only) replaces it. *(DWP-01.)*
- **L1-MINOR (master_work_packages / JAN-IRP) → FIXED.** §1 now states there is no master roadmap (standalone program-instance; `master_work_packages` bind to DS sections by design) and pins `JAN-IRP@0.1.0-draft`. *(§1.)*
- **L2-C1 (MED — repoint DWP-04 at the existing wrapper) → FIXED.** DWP-04 now reuses the existing server wrapper `buildPwaExport(pwaId, engine)` (`workbench.ts:252-281`, already consumed by `floor.ts:280`) instead of re-deriving `buildPwaGraphExport` — the reuse-don't-re-derive discipline the roadmap itself preaches. *(DWP-04.)*
- **L2-C2 (LOW — buildability evidence) → FIXED.** §15's buildability assumption now cites the *server* wrapper + its server consumer, not the client-side Designer usage. *(§15.)*
- **L2-C3 (LOW — pwuTypeId join surface) → FIXED.** DWP-04 notes the serialized `pwuList` drops the raw `pwuTypeId` (`:62-71`); the join must surface it or run server-side in `load()`. *(DWP-04.)*
- **L2-C4 (LOW — toFlow reuse wording) → FIXED.** DWP-02 no longer claims literal `styleFor` reuse (it colors `executionState`, not the 10-value `stepState`); it mirrors the *pattern* with a new explicit `stepState→color` map. *(DWP-02.)*
- **L3-C1 (MAJOR — two-axis advisory) → FIXED.** The v0.1.0 predicate mixed `workLifecycleState.EXECUTING` with `executionState.SUCCEEDED` (orthogonal axes, verified `canonical-vocabulary.json:130-153` vs `:158-172` — `executionState` has no EXECUTING). Rewritten single-axis on `executionState`; a two-axes-disagree unit test pins it. *(DWP-04.)*
- **L3-C2 (MAJOR — type/instance join gaps) → FIXED.** DWP-04 now scopes the type graph to the bound `(pwaId, pwaVersion)`, defines M+ cardinality semantics (any-succeeded-producer silences the advisory), and handles the off-graph `pwuTypeId` case (shown-not-placed), each with a fixture. *(DWP-04.)*
- **L3-C3 (MAJOR — commandless step actions) → FIXED.** The action set is an explicit allowlist of the 4 command-backed step transitions (registry `:118-123`) + `CancelExecutionPlan`; the machine topology is display-only, never a button generator (verified only 4 stepState transitions have handlers; no `CancelExecutionStep`). *(DWP-01 `advanceCommand`, DWP-03.)*
- **L3-C4 (MAJOR — step-below-QUEUED gap) → FIXED.** Surfaced as new finding **F-11** and disposed honestly (a "no advance command below QUEUED" note + §15 backlog), parallel to F-9's plan-completion gap. *(F-11, DWP-03, §15.)*
- **L3-C5 (MAJOR — floor-gate claim unexercised) → FIXED.** DWP-03's happy-path completion has zero result-subjects and never exercises the floor gate (F-8); added an e2e that DEMONSTRATES the gate rejecting an AI-produced floor-unsatisfied Complete (`RPH_INVARIANT_VIOLATION` verbatim) + the unresolved-artifact reject. *(DWP-03, §12.)*
- **L3-C6 (MINOR — structural advisory-never-gates) → FIXED.** Elevated from a single behavioral fixture to a structural typed seam (the advisory value's type is never an input to a dispatch), plus the behavioral test + `Do not change` comment. *(DWP-04, §15.)*
- **L3-C7 (MINOR — 03∥04 file contention) → FIXED.** Both edit the same two route files; serialized 03→04. *(§11, §17.)*
- **L3-C8 (MINOR — scoping join key untested) → FIXED.** DWP-01 asserts the two-hop `undertakingId`→pwuIds→`workUnitId` join and that a plan whose PWU lacks `undertakingId` is excluded (not a silent drop). *(DWP-01.)*
- **L3-C9 (MINOR — "timeline" over-claim + color-rule) → FIXED.** Dropped "timeline" (no timestamps/Attempt object — it is an ordered list); an explicit `stepState→color` map with an all-10-values totality test. *(DWP-02.)*

**§3.7 dimensions (post-reconciliation):** (1) normative coverage — Tiers 1+2 + §9.1/§9.2 → DWPs (§16), Tier 3 deferred; (2) omitted-hard-truths — F-5/F-6/F-9/**F-11**/F-10 surfaced and scoped; (3) legacy — the execution tab replaced (strict improvement), other tabs unchanged; (4) semantic-authority — §9.1 honored (no bypass, no new command, executionState only via the gated path), fork C crossed advisory-only (structural + behavioral), **F-10** reuse discipline; (5) assurance/evidence — INV-5 + floor gate authoritative and now DEMONSTRATED rejecting (L3-C5), advisory-never-gates structural; (6) security — no new authority (§13); (7) data — N/A; (8) overengineering — reuses contracts/commands + `layerHandoff` + `buildPwaExport`; only net-new is a pure shaping + UI, event-fold/temporal-engine deferred; (9) sequencing/reversibility — 01→02→03→04, each revertible (§14); (10) contradictions — grounded file:line (§4); the hand-off⟂execution tension resolved by the advisory-only ruling (fork C).

**Readiness (post-critique): `READY_FOR_ACTIVATION`.** Lens 1's blocker is resolved; all 5 MAJOR (L3) + the MED/LOW (L2) + MINOR conditions are folded into the DWP contracts/tests above — none required re-scoping a DWP or touching the DS design; the load-bearing assurance safety property was confirmed sound by the sequencing lens. Nothing built; DWP-01…04 `NOT_STARTED` until sponsor activation. Process constraints (inherited): stage only my files by path; never signoz/debug/ASPLE; no push (human pushes); `Co-Authored-By: Claude Opus 4.8`.

---

## 20. Delivery record (built 2026-07-21)

**All four DWPs DELIVERED + CONFORMANT.** Land order held: DWP-01 → 02 → 03 → 04, each gated then the next begun.

**Gate package `G-EXECPLAN` (green):** `check-types` 21/21 · unit `test` 21/21 tasks (rph-projections **114**, incl. 26 new execution-view tests; rph-demo 101) · `lint` 0 · `boundary` 0 (rph-projections stays browser-safe) · svelte-check 0 · **Playwright 37/37** (8 new `execution-plan.e2e.ts` + all 29 pre-existing specs — no regression from the shared-route edits) · SonarLint items addressed as they surfaced (S5906, S1128, S7763, S3776).

**Files delivered:**
- `packages/rph-projections/src/execution-view.ts` (NEW) + `execution-view.test.ts` (NEW, 26 tests) + `index.ts` (export).
- `apps/rph-demo/src/lib/server/workbench.ts` — `buildPwaExport` gains an optional `pwaVersion` filter (version-scope).
- `apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts` (scoped plans + shaping + step form actions + Tier-2 sequence) + `+page.svelte` (plan→steps panel, allowlist step actions, Tier-2 sequence + advisory).
- `apps/rph-demo/src/routes/test-api/dispatch/+server.ts` (NEW, test-mode-only) + `apps/rph-demo/e2e/execution-plan.e2e.ts` (NEW).

**Build-time refinements (disclosed — each a faithful improvement over the v0.2.0 sketch, none a scope change):**
1. **`advanceCommand` → `advanceCommands` (a SET).** A RUNNING step legitimately affords BOTH `complete` and `fail`; a single optional field would force an arbitrary pick. The read-model exposes `advanceCommands: StepAdvanceCommand[]` (QUEUED→[start], RUNNING→[complete,fail], FAILED→[retry], else []), keyed by a `Record<StepState,…>` so the compiler forces all 10 states to be classified (the EP-TST-5 state-transition discipline baked into the type). The F-11 allowlist discipline is unchanged.
2. **Version-scope enforced at `buildPwaExport` (server), with the pure off-graph test as the safety net.** `PWU_TYPE` carries `pwaVersion` (RPH-CON-009) but the pure `sequenceView` receives an already-built graph, so version filtering lives where `pwaVersion` lives — the `buildPwaExport(pwaId, engine, pwaVersion)` node filter — and the pure layer proves the residual: an instance whose type is absent from the bound-version graph falls to `unplaced` as `off-graph` (the version-skew safety net, unit-tested). Together these satisfy L3-C2.
3. **A test-mode-only `POST /test-api/dispatch` endpoint** (guarded by `isTestMode`, same philosophy as `reset`/`introspect`) lets e2e stage engine states through the real command bus — no production surface, no back door around the invariants.
4. **The Complete affordance carries optional `outputArtifactId` + `aiProduced` inputs** so the floor-gate rejection (L3-C5) is reachable *through the form action in the browser* and surfaced verbatim; the default (empty) is a HUMAN no-output completion the gate admits.

**Grounding correction surfaced during the build (honest record):** the reference seed's Product-Realization PWA is **composition-only** — `DefinePwuType` sets no `requiredInputs`/`requiredOutputs` (`seed-workbench.ts`), so it has zero hand-off edges and the Tier-2 sequence is legitimately EMPTY for it (all instances `unplaced` / `no-dependency-position`, no advisories). The advisory is therefore demonstrated against an **authored hand-off fixture** (a Producer→Consumer PWA staged in the e2e), not the seed. This is disclosed rather than papered over; enriching the seed with hand-off was deliberately NOT done (it would perturb the coherence/floor harness other specs depend on).

**Banking:** uncommitted; staged by explicit path for the human to commit + push (no push authority). `Co-Authored-By: Claude Opus 4.8`.

---

*`FEATURE COMPLETE` / v0.2.0-draft — the §3.7 self-critique was EXECUTED and reconciled (§19); DWP-01…04 built + gated (§20).*
