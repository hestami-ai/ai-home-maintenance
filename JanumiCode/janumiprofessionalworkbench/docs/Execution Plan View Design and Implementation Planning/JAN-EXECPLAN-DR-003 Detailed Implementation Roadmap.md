# JAN-EXECPLAN-DR-003 — Detailed Implementation Roadmap

*Repository-specific implementation authority for the Step Interpreter (Tier 3C-i + 3C-iii), derived per `JAN-ROADMAP-001-A`.*

## 1. Document control and repository identity

| Field | Value |
| :--- | :--- |
| **Document ID** | `JAN-EXECPLAN-DR-003` |
| **Version** | `0.3.0` — DELIVERED. Reconciled against the **EXECUTED** §3.7 self-critique (§19: three adversarial lenses ran on v0.1.0, incl. 6 blockers, driving the completion-fold→start-gate pivot), then BUILT and gated (§20). A post-build multi-agent adversarial verification (§20) surfaced 4 minor confirmed findings, all fixed. |
| **Status** | `DELIVERED` — DWP-01…03 built, full gate green, adversarially verified (§20). |
| **Generation standard** | `JAN-ROADMAP-001-A` v2.0.0-draft (§4 sections · §5 DWP contract · §6 grounding bar · §3.7 self-critique). |
| **Program model** | Standalone `JAN-EXECPLAN` program-instance + `JAN-IRP@0.1.0-draft`. No master roadmap; `master_work_packages` bind to `JAN-EXECPLAN-DS-003` sub-tiers. |
| **Design authority** | `JAN-EXECPLAN-DS-003` (Step Interpreter — Tier 3C; DESIGN-FIRST, 2026-07-21). Sponsor-ruled 2026-07-21: **3C-i (linear sequencing) + 3C-iii (Skip/Cancel step)**; **3C-ii DEFERRED**; Fork B = automatic sequencing (no explicit Ready/Queue commands — realized as a **start-gate**, §7); Fork D = author Skip/Cancel now; Fork F = "preconditions" reads as "earlier steps SUCCEEDED" (linear, disclosed). |
| **Engineering-practice authority** | `JAN-PRPWA-EP-001@0.1.0-draft` (cross-cutting, REUSED): **BINDING** commenting (EP-CMT-1/2/3/**4** — this crosses workflow-engine semantics: the step machine, the start-gate, skip/cancel), testing-as-evidence (EP-TST-1/2/4/**5**/6/7/12), SonarQube (EP-TST-13). **N/A** EP-OBS-* (no new telemetry), EP-TST-8/9 (no LLM/agent authored). |
| **Governance** | 3C-i is a start-gate on the **ratified** step machine (`transitions.data.ts`) + array order (NOT `ordinal` — that is persistence-only, `m11-execution.json:84`, absent from the strict `ExecutionStep` contract, §4 F-2); 3C-iii authors 2 step-lifecycle commands under the standing 2026-07-16 grant on the ratified `→SKIPPED/→CANCELLED` arrows + the ratified `canSkipStep` kernel. **No `Source-TBD` grammar authored** (3C-ii deferred). No contract-schema change (array index; `mandatory` rides the Skip command). |
| **Repository & branch** | `hestami-ai/ai-home-maintenance` / `sonar/jpwb-remediation-2026-07-20` @ `.../janumiprofessionalworkbench` |
| **Revision at grounding** | HEAD = the JAN-EXECPLAN Tier-3 (DR-002) commit; `dirty_state: true`. Every §4 file:line is anchored to this revision. |
| **Persistence revision** | `SCHEMA_VERSION` unchanged — **no tables/migration, no contract-SCHEMA change**. Contract change: 2 new commands (Skip/Cancel step) in `m3-commands-events.json` (events reused) → `bun run gen` → prettier. |
| **Runtime identity** | Turborepo + Bun 1.3.14; `@janumipwb/rph-{contracts,domain,application,projections}`, `apps/rph-demo`; Vitest + Playwright (msedge, `RPH_DEMO_MODE=test`) + svelte-check + eslint + dependency-cruiser. |
| **Grounding method** | Standard-digest + 3-lens code-grounded critique (multi-event feasibility, `ordinal`/`mandatory` sourcing, the readying edges) + the ratified persistence + Guide §9.1/§9.2 + RPH-EXE-002/005/006. |

**Canonical basis:** Guide §9.1/§9.2 (Execution Step; "execute the next eligible step"); RPH-EXE-005 (a step cannot run until preconditions satisfied); RPH-EXE-006 (a succeeded step records output/explicit-no-output); the step machine (`transitions.data.ts:1421-1488`, initialState NOT_READY); `canSkipStep` (`rph-domain/src/execution.ts:194`); `rejectUnbackedExecutionSuccess` (`pwu.ts:633-661`).

## 2. Activated scope

**In scope (3C-i + 3C-iii):**
- **3C-i — Linear start-gate sequencing.** `StartExecutionStep` gains a precheck: a step may only start when **every earlier step (array order) is terminal-success (SUCCEEDED/SKIPPED)** — RPH-EXE-005 read linearly (Fork F). A read-model derives which single step is **startable**, so the UI offers Start only there. A multi-step plan drives itself (complete step N → step N+1 becomes startable) with **no cascade, no readying events, no multi-event commit, no `ordinal` field, no machine change** — steps stay seeded at QUEUED (full back-compat; a single-step plan is unchanged).
- **3C-iii — Terminal step lifecycle.** `SkipExecutionStep` (QUEUED/READY→SKIPPED, guarded by `canSkipStep`, **fail-closed**: an unmarked step defaults to mandatory ⇒ a waiver is required) + `CancelExecutionStep` (→CANCELLED, permitted as cleanup even post-supersession). Makes SKIPPED reachable; the start-gate treats SKIPPED as terminal-success (so skipping the startable step advances the plan — no deadlock).
- **Completion honesty fix (DR-002 follow-up).** Now that SKIPPED is reachable, `CompleteExecutionPlan`'s guard is tightened to require **≥1 SUCCEEDED** step (aligning the plan-level rule with the ratified PWU-level `rejectUnbackedExecutionSuccess`, which SKIPPED does not satisfy) — an all-SKIPPED plan must not "complete" having produced nothing.

Decomposed into `JAN-EXECPLAN-DWP-01…03` (§9).

**Out of scope (deferred — §15):** **3C-ii** — `ExecutionTransition` schematization + the `condition_expression` grammar + BRANCH/WAIT/PARALLEL_GROUP interpreter (`Source-TBD`; a fresh grant). No LOOP primitive. No parallel execution (linear-only; disclosed). No `ordinal` contract field. No wall-clock scheduling.

## 3. Normative-source digest

- **RPH-EXE-005 (linear reading, Fork F — enforced at START, §19 L3-4c):** a step may start only when every earlier step (array order) is terminal-success (SUCCEEDED/SKIPPED). The check lives on `StartExecutionStep` (a hard gate), not solely on which step is "readied" — so nothing can run out of order.
- **§9.2 "execute the next eligible step":** the start-gate makes exactly the first non-terminal step eligible; the plan progresses without any explicit Ready/Queue command (Fork B, realized as the gate — §7).
- **Array-order sequencing (NOT ordinal, §19 L2/L3-B1):** `ExecutionStep` is a strict schema with **no `ordinal`** (`objects.ts:231-242`; `m11-execution.json:84` "persistence only; not in the Canonical interface"). The steps' order IS their index in `plan.steps` — which rides in every plan event, so array-index order is deterministic + replay-stable. Sequencing by array index needs **no schema change**.
- **Fail-closed skip (§19 L3-B2):** `canSkipStep({mandatory, hasAuthorizedWaiverOrRevision})` needs `mandatory`, which has **no source on the step** (no contract field). The `SkipExecutionStep` command carries an optional `mandatory` (caller-asserted) + `waiverOrRevisionId?`; **omitted `mandatory` defaults to TRUE** (a waiver is then required) — never fail-open. Disclosed: mandatory-ness is caller-asserted until a step-level field is ratified.
- **Completion needs a real success (§19 L3-M7):** `CompleteExecutionPlan` requires ≥1 SUCCEEDED step (not just all-SUCCEEDED‖SKIPPED) — aligned with `rejectUnbackedExecutionSuccess` (`pwu.ts:649`, which needs a SUCCEEDED step). An all-optional-skipped plan does not complete.
- **RPH-EXE-002 / INV-5:** unchanged — sequencing/skip drive the EXECUTION axis only; the plan-ACTIVE prechecks (start/retry/skip) and the floor gate stay authoritative; **cancel is cleanup** (permitted post-supersession — it opens no new work, §19 L3-M11). INV-5 confirmed structurally intact by Lens 3.
- **Engineering practice (`EP-001`):** EP-CMT-4 boundary comments at the start-gate + skip/cancel seams; EP-TST-5 state-transition layer (every newly-driveable arrow exercised; every invalid one rejected); EP-TST-12 no happy-path-only (out-of-order-start, mandatory-skip, all-skipped-completion rejections demonstrated).

## 4. Current-state findings and evidence

- **F-1 No sequencing; drives seed QUEUED.** `advanceStep` (`execution.ts:364-419`) mutates ONE indexed step + commits ONE event; `plan.transitions` is read by nothing. The reference drive seeds its single step at `stepState:'QUEUED'` (`reference-undertaking.ts:553`); the demo `beginExecute` at `+page.server.ts:430`. `startExecutionStep` (`execution.ts:437-444`) has a plan-ACTIVE precheck but **no predecessor check**.
- **F-2 `ordinal` is persistence-only — NOT on the contract (grep-confirmed).** `ExecutionStepSchema` is a `z.strictObject` (`objects.ts:231-242`) with no `ordinal`; a step carrying one would be REJECTED. `m11-execution.json:84`: `ordinal` "Ordering position (persistence only; not in the Canonical interface)." → sequencing must use **array index**, not `ordinal`.
- **F-3 Below-QUEUED arrows handler-less.** NOT_READY→READY (`ExecutionStepReady` event exists, `m3:4616`), READY→QUEUED (trigger "step scheduled", **no event**), NOT_READY→RUNNING **illegal** (`transitions.data.ts:1421-1488`, must pass through READY). No READY→RUNNING arrow. The start-gate does NOT need these (steps stay QUEUED) — they remain for 3C-ii.
- **F-4 Skip/Cancel-step absent.** No `SkipExecutionStep`/`CancelExecutionStep` command; `→SKIPPED` (from READY/QUEUED; `ExecutionStepSkipped` exists, `m3:4661`) and `→CANCELLED` (from READY/QUEUED/RUNNING/WAITING; `ExecutionStepCancelled` exists, `m3:4564`) unreachable. `canSkipStep` (`rph-domain/src/execution.ts:194`; input `{mandatory, hasAuthorizedWaiverOrRevision}`, `:183-188`) is written + unwired.
- **F-5 `completeExecutionStep` has NO plan-ACTIVE precheck (§19 L3-B3).** `execution.ts:479-537` — only `validateStepCompletion` + the floor gate. (Not a problem for the start-gate, which adds no cascade to completion; recorded so a future cascade design does not inherit it.)
- **F-6 Completion allow-list ≠ PWU success rule (§19 L3-M7).** `completeExecutionPlan` (DR-002) accepts all-`SUCCEEDED‖SKIPPED` (`execution.ts:262-282`); `rejectUnbackedExecutionSuccess` needs a `SUCCEEDED` step (`pwu.ts:649`). Once SKIPPED is reachable (DWP-02), an all-SKIPPED plan could complete while the PWU cannot claim execution success — the divergence to close.

## 5. Legacy semantic classification

- StartExecutionStep predecessor-gate + the read-model startable derivation + reading array order → **CREATE** *(additive; outside the §3.4 taxonomy)*. SkipExecutionStep/CancelExecutionStep → **CREATE** *(additive; outside the taxonomy)*. `completeExecutionPlan` ≥1-SUCCEEDED tightening → **GENERALIZE** (corrects the DR-002 guard to align with the ratified PWU rule). No **REMOVE/RECLASSIFY**; no migration; 3C-ii **DEFERRED**.

## 6. Target-state gap analysis

| Target (DS-003) | Present | Gap |
| :--- | :--- | :--- |
| A plan sequences itself | flat list, each step driven alone (F-1) | StartExecutionStep predecessor-gate (array order) + startable read-model |
| SKIPPED reachable + honest | absent (F-4); allow-list too loose (F-6) | SkipExecutionStep (fail-closed canSkipStep) + ≥1-SUCCEEDED completion |
| Cancel a step | absent (F-4) | CancelExecutionStep (cleanup; post-supersession-permitted) |
| Branch/wait/parallel + condition grammar | Source-TBD | **DEFERRED (3C-ii)** |

## 7. Alternatives considered and selected strategy

Fork resolutions (sponsor-ruled, DS-003 §6): **E** 3C-i + 3C-iii; **D** author Skip/Cancel; **A** linear; **C** defer the grammar; **F** predecessor-terminal-success. **Fork B (readying trigger) — RECONCILED to a start-gate (§19 L2/L3):** the sponsor ruled "automatic sequencing (auto-fold into CompleteExecutionStep) over explicit Ready/Queue commands." The self-critique proved the completion-fold cascade unbuildable/unsafe as designed — `commitState` is single-event with a `UNIQUE(aggregate_revision)` constraint (no clean two-event commit); `completeExecutionStep` has no plan-ACTIVE guard (readies under a superseded plan); NOOP re-completion re-fires it; mixed QUEUED/NOT_READY seeds double-ready; skipping the startable step deadlocks. The **start-gate** (a predecessor precheck on `StartExecutionStep` + a startable read-model) delivers the SAME automatic linear progression (no explicit commands — the sponsor's actual choice) while structurally avoiding all five failures: no readying → no superseded-readying, no re-fire, no double-ready, no deadlock, no multi-event. This is a mechanism refinement within Fork B's "automatic, not controller-driven" ruling, disclosed for confirmation at activation. New commands (Skip/Cancel) are AUTHORED under the standing grant; **no `Source-TBD` grammar** authored.

## 8. Repository architecture and change map

- **MODIFY:** `packages/rph-application/src/handlers/execution.ts` (`startExecutionStep` predecessor-gate; `completeExecutionPlan` ≥1-SUCCEEDED; new `skipExecutionStep`/`cancelExecutionStep`) + `registry.ts`. `packages/rph-projections/src/execution-view.ts` (a `startableStepId` derivation over `plan.steps` in array order) + `.test.ts`. `apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts` (skip/cancel form actions) + `+page.svelte` (Skip/Cancel buttons; Start shown only on the startable step). `packages/rph-contracts/vocab/m3-commands-events.json` (+2 commands; events reused) → gen → prettier + `validate.test.ts` count.
- **CREATE:** step-gate + skip/cancel handler tests; `apps/rph-demo/e2e/execution-sequencing.e2e.ts`.
- **NO** DB migration; **NO** contract-schema change (array index; `mandatory` on the command); **NO** `Source-TBD` grammar (3C-ii).

## 9. Detailed work-package register

```yaml
id: JAN-EXECPLAN-DWP-01
master_wave: EXECPLAN
master_work_packages: [DS-003:3C-i, DS-003:forkB, DS-003:forkF]
title: "Linear start-gate sequencing — StartExecutionStep predecessor precheck (array order) + startable read-model"
outcome: "startExecutionStep gains a precheck: a step may start ONLY when every EARLIER step (array index in plan.steps) is terminal-success (SUCCEEDED/SKIPPED) — RPH-EXE-005 linear (Fork F), enforced at start so nothing runs out of order. A pure read-model derives the single startableStepId (plan ACTIVE + the first non-terminal step, iff all earlier are terminal-success), so the UI offers Start only there. A multi-step plan drives itself (complete step N → step N+1 becomes startable). NO cascade, NO readying events, NO multi-event commit, NO ordinal field, NO machine change — steps stay seeded at QUEUED; a single-step plan (reference/demo) is unchanged (no earlier steps → startable). Exec ≠ assurance (INV-5)."
knowledge_status: CONFIRMED
repository_scope:
  repositories: [hestami-ai/ai-home-maintenance]
  files_or_symbols:
    - "packages/rph-application/src/handlers/execution.ts:437-444 startExecutionStep (add the predecessor precheck, after the plan-ACTIVE one)"
    - "packages/rph-projections/src/execution-view.ts (add startableStepId(plan) — pure, over steps[] array order) + execution-view.test.ts"
    - "packages/rph-domain/src/transitions.data.ts step machine (read-only — QUEUED→RUNNING unchanged)"
  database_objects: []
  runtime_surfaces: ["domain command bus; the execution read-model"]
dependencies: []
required_changes:
  - "startExecutionStep precheck (after plan-ACTIVE): let idx = steps.findIndex(this step); reject (RPH_ILLEGAL_STATE_TRANSITION) if ANY step at a lower index is NOT terminal-success (stepState ∉ {SUCCEEDED, SKIPPED}); name the blocking predecessor. Array index is the order (F-2: no ordinal)."
  - "execution-view: startableStepId(planView) — the first step (array order) whose stepState is non-terminal, iff every earlier step is terminal-success AND the plan is ACTIVE; else undefined. Pure/browser-safe; drives the UI Start affordance."
  - "Determinism: order = array index of plan.steps (rides in every plan event → replay-stable). No sort, no ordinal."
invariants:
  - "At most ONE step is startable at a time (the first non-terminal, all-predecessors-done); enforced by BOTH the read-model (display) AND the startExecutionStep gate (authority)."
  - "A step whose earlier siblings are not terminal-success CANNOT start (RPH-EXE-005), regardless of its stepState — the gate is the backstop, not the read-model."
  - "Back-compat: a single-step or all-QUEUED plan is unaffected (predecessors trivially done / none)."
  - "INV-5 untouched; the gate reads state, sets nothing."
prohibited_shortcuts:
  - "Do NOT read plan.transitions or an ordinal field (3C-ii deferred; ordinal is persistence-only, F-2)."
  - "Do NOT rely on the read-model alone for ordering — enforce the predecessor rule at startExecutionStep (the read-model is an optimization, §19 L3-4c)."
  - "Do NOT add a completion cascade (the self-critique's 5 blockers — §7); sequencing is a start-gate."
tests:
  - "unit (gate): a 2-step plan (both QUEUED) — start step 1 OK; start step 2 while step 1 is QUEUED/RUNNING → REJECT (predecessor not done); complete step 1 → start step 2 OK; a single-step plan starts unchanged (regression)."
  - "unit (read-model): startableStepId = step 1 initially; = step 2 after step 1 SUCCEEDED/SKIPPED; = undefined when the plan is non-ACTIVE or all steps terminal."
evidence: ["gate + read-model unit tests green; multi-step ordering enforced; single-step regression holds; boundary 0; check-types green"]
migration_and_compatibility: ["additive; QUEUED-seeded drives unaffected (0 NOT_READY steps in any existing test/drive — §19 L2-10); no event-stream change"]
rollback_and_recovery: ["revert the precheck + the read-model derivation"]
risks: ["out-of-order start if the gate were omitted — mitigated: the gate is the authority, the read-model only the affordance"]
open_decisions: []
exit_criteria: ["out-of-order start rejected; startableStepId correct across the sequence; single-step regression green"]
delivery_state: NOT_STARTED
conformance_state: UNASSESSED
```

```yaml
id: JAN-EXECPLAN-DWP-02
master_wave: EXECPLAN
master_work_packages: [DS-003:3C-iii, DS-003:forkD]
title: "Skip/Cancel step (fail-closed canSkipStep) + the ≥1-SUCCEEDED completion fix"
outcome: "SkipExecutionStep (QUEUED/READY→SKIPPED) routed through the ratified canSkipStep — FAIL-CLOSED: the command carries mandatory?:boolean (omitted ⇒ TRUE) + waiverOrRevisionId?; a mandatory step without a waiver is REJECTED (canSkipStep) — never fail-open (§19 L3-B2). CancelExecutionStep (→CANCELLED) as cleanup — permitted even under a SUPERSEDED plan (RPH-EXE-002 forbids new work, not termination; §19 L3-M11); the step machine gates the step state. SKIPPED becomes reachable → the start-gate treats it as terminal-success (skipping the startable step advances the plan, no deadlock — §19 L3-M6). completeExecutionPlan (DR-002) is tightened to require ≥1 SUCCEEDED step (§19 L3-M7), aligning with rejectUnbackedExecutionSuccess. Exec ≠ assurance (INV-5)."
knowledge_status: CONFIRMED
repository_scope:
  repositories: [hestami-ai/ai-home-maintenance]
  files_or_symbols:
    - "packages/rph-contracts/vocab/m3-commands-events.json (author SkipExecutionStep {stepId, mandatory?, waiverOrRevisionId?} + CancelExecutionStep {stepId, reason}; REUSE ExecutionStepSkipped/Cancelled) → gen → prettier + validate.test.ts count"
    - "packages/rph-application/src/handlers/execution.ts (skipExecutionStep via advanceStep + canSkipStep guard + plan-ACTIVE; cancelExecutionStep via advanceStep, NO plan-ACTIVE guard) / completeExecutionPlan (add the ≥1-SUCCEEDED clause) / registry.ts"
    - "packages/rph-domain/src/execution.ts:183-194 canSkipStep + StepSkipInput (reused, unchanged)"
  database_objects: []
  runtime_surfaces: ["domain command bus"]
dependencies: [JAN-EXECPLAN-DWP-01]
required_changes:
  - "Author SkipExecutionStep (payload: stepId, mandatory?:boolean, waiverOrRevisionId?:string) + CancelExecutionStep (payload: stepId, reason:string); gen + prettier + validate.test.ts count."
  - "skipExecutionStep: advanceStep(target:'SKIPPED', eventType:'ExecutionStepSkipped') with a plan-ACTIVE precheck + canSkipStep({mandatory: p.mandatory ?? true, hasAuthorizedWaiverOrRevision: !!p.waiverOrRevisionId}); reject a mandatory-no-waiver skip (fail-closed)."
  - "cancelExecutionStep: advanceStep(target:'CANCELLED', eventType:'ExecutionStepCancelled') — NO plan-ACTIVE precheck (cleanup allowed post-supersession); the machine (→CANCELLED from READY/QUEUED/RUNNING/WAITING) gates it."
  - "completeExecutionPlan guard: add `&& steps.some(s => s.stepState === 'SUCCEEDED')` (§19 L3-M7) — an all-SKIPPED plan REJECTS; update the DR-002 completion test to pin it."
  - "The DWP-01 start-gate already treats SKIPPED as terminal-success (predecessor done) — assert a skip advances the sequence."
invariants:
  - "SkipExecutionStep of a mandatory step (asserted or defaulted) without a waiver → REJECTED (fail-closed, never fail-open)."
  - "A superseded/terminal plan opens no new work: skip/start/retry reject; CANCEL is permitted (cleanup)."
  - "CompleteExecutionPlan requires ≥1 SUCCEEDED step (aligned with rejectUnbackedExecutionSuccess)."
  - "INV-5 untouched; skip/cancel move only stepState."
prohibited_shortcuts:
  - "Do NOT default mandatory to false (fail-open assurance bypass, §19 L3-B2) — default TRUE, waiver required."
  - "Do NOT gate CANCEL on plan-ACTIVE (it is cleanup, §19 L3-M11); Do NOT let an all-SKIPPED plan complete (§19 L3-M7)."
  - "Do NOT re-invent the skip guard — route through canSkipStep."
tests:
  - "unit: skip a non-mandatory step (mandatory:false) → SKIPPED; skip a mandatory step (mandatory:true / omitted) without a waiver → REJECT; skip a mandatory step WITH a waiverOrRevisionId → SKIPPED; cancel a RUNNING step → CANCELLED; cancel under a SUPERSEDED plan → CANCELLED (cleanup); skip/start under a SUPERSEDED plan → REJECT; a SKIPPED step advances the start-gate (next becomes startable); completeExecutionPlan of an all-SKIPPED plan → REJECT (≥1-SUCCEEDED); of [SUCCEEDED, SKIPPED] → COMPLETED."
evidence: ["skip/cancel + completion-fix unit tests green; SKIPPED reachable + honest; fail-closed proven; check-types green"]
migration_and_compatibility: ["additive commands; the DR-002 completion test updated (all-SKIPPED now rejects — a stricter, honest change)"]
rollback_and_recovery: ["remove the 2 handlers + registrations + vocab additions; revert the completion clause"]
risks: ["caller-asserted mandatory is weak — mitigated by the fail-closed default + a disclosed note (§15); a step-level mandatory field is a 3C-ii/ratification follow-up"]
open_decisions: []
exit_criteria: ["fail-closed mandatory-skip; cancel-as-cleanup; all-SKIPPED completion rejected; SKIPPED advances the gate; RPH-EXE-002 respected"]
delivery_state: NOT_STARTED
conformance_state: UNASSESSED
```

```yaml
id: JAN-EXECPLAN-DWP-03
master_wave: EXECPLAN
master_work_packages: [DS-003:3C-i, DS-003:3C-iii]
title: "Execution tab — visible sequencing (startable-only Start) + Skip/Cancel step actions"
outcome: "The execution tab uses DWP-01's startableStepId to show Start ONLY on the startable step (the others show their state, no Start) — a multi-step plan visibly progresses. Skip/Cancel-step are form actions dispatching the DWP-02 commands (allowlist posture; rejection surfaced verbatim); the demo Skip asserts mandatory:false (a mandatory/waiver skip is domain-tested, not a demo button). A skipped step visibly advances the plan."
knowledge_status: CONFIRMED
repository_scope:
  repositories: [hestami-ai/ai-home-maintenance]
  files_or_symbols:
    - "apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts (pass startableStepId; skipStep/cancelStep form actions via dispatchResult)"
    - "apps/rph-demo/src/routes/undertakings/[id]/+page.svelte (Start shown only when s.id === startableStepId; Skip/Cancel buttons per non-terminal step)"
    - "apps/rph-demo/e2e/execution-sequencing.e2e.ts (NEW)"
  database_objects: []
  runtime_surfaces: ["Undertaking Workbench execution tab"]
dependencies: [JAN-EXECPLAN-DWP-01, JAN-EXECPLAN-DWP-02]
required_changes:
  - "load(): expose startableStepId per plan (from DWP-01); skipStep/cancelStep form actions dispatching SkipExecutionStep (mandatory:false for the demo) / CancelExecutionStep; dispatchResult surfaces the reason verbatim."
  - "svelte: gate the step-action-start button on s.id === startableStepId; add Skip/Cancel buttons on non-terminal steps; the sequencing is visible via which step is startable."
invariants:
  - "Read-only render; the only writes are the allowlisted step commands; undertaking-scoped (DR-001 F-6 fix stays)."
  - "Start is offered on exactly the startable step (the engine gate rejects any other, but the UI does not tempt it)."
prohibited_shortcuts: ["Do NOT show Start on a non-startable step; Do NOT fabricate a startable state the engine did not compute."]
tests:
  - "e2e: stage a 2-step plan (both QUEUED); the tab shows Start on step 1 only; complete step 1 → Start moves to step 2 automatically; Skip step 1 (fresh plan) → SKIPPED + Start moves to step 2; an out-of-order start is not offered (and, forced via test-api, rejected)."
evidence: ["e2e green; multi-step progression visible; startable-only Start; svelte-check 0"]
migration_and_compatibility: ["additive UI; other tabs untouched; single-step plans render unchanged"]
rollback_and_recovery: ["revert the buttons + startable gating + form actions"]
risks: ["seed reference plans are single-step — the multi-step e2e stages its own plan (test-api dispatch)"]
open_decisions: []
exit_criteria: ["startable-only Start; multi-step progression visible; Skip/Cancel dispatch + reflect engine truth; e2e green"]
delivery_state: NOT_STARTED
conformance_state: UNASSESSED
```

## 10. Data and persistence changes

**No schema/table/migration; no contract-SCHEMA change.** Sequencing is by **array index** (F-2: no `ordinal` field); `mandatory` rides the `SkipExecutionStep` command payload (no step-schema field). Contract change: +2 commands (Skip/Cancel step) — events reused (`ExecutionStepSkipped/Cancelled`) → `bun run gen` → prettier. `SCHEMA_VERSION` unchanged.

## 11. Execution, compatibility, and migration strategy

Land order (§17): **01 → 02 → 03.** The start-gate (01) → skip/cancel + the completion fix (02, which the gate treats as predecessor-done) → UI (03). Each: land → gate → commit. `bun run gen` + prettier after each vocab edit; rebuild `rph-contracts`/`rph-application`/`rph-projections` dists before the app's checks. Back-compat: additive — QUEUED-seeded single-step drives unaffected (no NOT_READY steps exist; the gate is a no-op for a single step).

## 12. Assurance, tests, and evidence plan

- **Unit (01):** the start-gate (out-of-order-start reject; single-step regression) + `startableStepId` across the sequence. **(02):** fail-closed mandatory-skip, cancel-as-cleanup, RPH-EXE-002, SKIPPED-advances-the-gate, all-SKIPPED-completion reject, [SUCCEEDED,SKIPPED]→completable.
- **E2E (03):** a multi-step plan progresses (Start moves with completion); Skip advances; out-of-order start not offered.
- **Static/EP:** check-types, svelte-check 0, boundary 0 (the read-model stays browser-safe), SonarLint (EP-TST-13). **EP-TST-5 state-transition layer** (every newly-driveable arrow — →SKIPPED, →CANCELLED, the start-gate — exercised; every invalid one rejected); **EP-TST-12 no happy-path-only** (out-of-order-start + mandatory-skip + all-SKIPPED-completion rejections). EP-CMT-4 boundary comments at the gate + skip/cancel seams.

## 13. Security, authority, and tenant-impact analysis

No new authority/secrets/tenant boundary/persistence. New commands dispatch through the existing bus + guards; INV-5 confirmed intact (sequencing/skip/cancel drive the EXECUTION axis only; floor gate + `rejectUnbackedExecutionSuccess` unchanged; the ≥1-SUCCEEDED completion fix TIGHTENS honesty). RPH-EXE-002 respected (skip/start reject post-supersession; cancel is cleanup). `canSkipStep` fail-closed prevents a mandatory-skip assurance bypass.

## 14. Observability, recovery, and rollback

The start-gate emits no new events (it rejects an illegal start); skip/cancel emit the existing step events; the completion fix rejects earlier. Each DWP additive + revertible (§9). No new writes beyond the additive commands; no schema change.

## 15. Risks, assumptions, unknowns, decisions, deferrals, divergences

- **Decisions (sponsor-ruled):** 3C-i + 3C-iii; automatic sequencing (start-gate per §7); author Skip/Cancel; linear; defer 3C-ii; predecessor-terminal-success reading.
- **Deferrals (3C-ii):** `ExecutionTransition` schema + `condition_expression` grammar + BRANCH/WAIT/PARALLEL_GROUP + parallel execution + LOOP + a step-level `mandatory`/`ordinal` contract field + wall-clock scheduling.
- **Disclosed readings/refinements:** (a) RPH-EXE-005 "preconditions" = "all earlier (array-index) steps terminal-success" (linear, Fork F), enforced at `startExecutionStep`. (b) **Fork B refined to a start-gate** (not a completion-fold cascade) — the self-critique found the cascade unbuildable/unsafe (§7); the start-gate delivers the same automatic progression. (c) `mandatory` is **caller-asserted with a fail-closed default** (no step field yet). (d) Cancel is permitted post-supersession (cleanup). (e) Skipping a producer step can ready a consumer whose input was never produced — caught at the consumer's own completion (floor gate + unrecorded-output reject), not prevented; 3C-ii closes it (§19 L3-M10).
- **Assumptions:** `plan.steps` array order IS the step order (F-2; rides in every plan event → replay-stable). `canSkipStep` shape is `{mandatory, hasAuthorizedWaiverOrRevision}` (grounded §4 F-4).
- **Risk:** authoring Skip/Cancel commands under the standing grant must annotate `UNRATIFIED-AUTHORED`.
- **Divergences from DS-003:** **Fork B mechanism** — DS-003/the ruling say "auto-fold into CompleteExecutionStep"; realized as a **start-gate on StartExecutionStep** (same automatic linear progression; the completion-fold cascade was proven unsafe by the §19 critique). Disclosed for confirmation at activation. Otherwise 3C-i + 3C-iii as ruled; 3C-ii deferred.

## 16. Traceability matrix

| DS-003 authority | DWP | Files | Tests |
| :--- | :--- | :--- | :--- |
| 3C-i sequencing (fork B→start-gate / F) | DWP-01 | `execution.ts` start-gate; `execution-view.ts` startable | out-of-order reject + startable + single-step regression |
| 3C-iii skip/cancel (fork D) + completion fix | DWP-02 | m3 vocab; `execution.ts`; `canSkipStep` | fail-closed skip + cancel-cleanup + all-SKIPPED reject |
| 3C-i/iii UI | DWP-03 | undertaking route execution tab | e2e multi-step progression + skip |
| 3C-ii grammar/interpreter | **DEFERRED** | — | — |
| Engineering practice (EP-CMT-4/EP-TST-5/12/13) | cross-cutting | comments + tests; §12 | state-transition ladder · SonarQube |

## 17. Implementation ordering and concurrency plan

Critical path: **01 → 02 → 03.** 01 (start-gate + read-model) → 02 (skip/cancel + completion fix; the gate treats SKIPPED as predecessor-done) → 03 (UI, which needs 01's startableStepId + 02's commands). Gate each centrally (check-types · test · lint · boundary · svelte-check · Playwright); never in a sub-agent. `bun run gen` + prettier after each vocab edit; rebuild dists before the app's checks. SonarLint per-DWP.

## 18. Exit criteria and gate package requirements

**Feature complete when:** DWP-01…03 `DELIVERED`; full gate green (check-types · test · lint 0 · boundary 0 · svelte-check 0 · SonarQube dispositioned · Playwright incl. the new spec + regression); a multi-step plan sequences (out-of-order start rejected; unit + e2e); SKIPPED reachable, fail-closed for mandatory, and honest for completion (≥1-SUCCEEDED); cancel-as-cleanup; INV-5 unviolated; traceability (§16) reaches code+tests. **Gate package** (`G-EXECPLAN-T3C`).

## 19. Self-critique and readiness determination

Per `JAN-ROADMAP-001-A §3.7`, a **3-lens adversarial self-critique was EXECUTED** on v0.1.0 (three agents grounding against the repo): **Lens 1 — standards** (`REVISION_REQUIRED`: 1 blocker + 2 major + tidy-ups), **Lens 2 — code-grounding** (2 "blocker-as-written": multi-event NOT supported by `commitState` + the `UNIQUE(aggregate_revision)` hazard; `ordinal` NOT on the contract), **Lens 3 — sequencing/assurance** (`NOT READY`: **INV-5 confirmed structurally intact** but 5 correctness BLOCKERs + 4 major). The verdicts drove the **Fork-B pivot to a start-gate** (§7). Conditions and reconciliation (all applied):

- **L1-BLOCKER (version pre-stamp) → FIXED.** §1 recorded the critique executed while §19 was future-tense; this section is now the real executed critique, version 0.2.0 honest.
- **L1-MAJOR (repo identity/revision missing) → FIXED.** §1 gains Repository & branch, Revision at grounding, Grounding method rows. **L1-MAJOR (EP authority dangling) → FIXED.** §1 gains the Engineering-practice authority row; §3 an EP bullet.
- **L1-MINOR → FIXED:** §5 CREATE annotated "(additive; outside the taxonomy)"; Fork F attributed to the SUCCEEDED limb (SKIPPED-counts-as-done is 3C-iii, §2/§3); F-1/F-2/F-3 given file:line + "grep-confirmed" for the ordinal negative.
- **L2 / L3-B1 (ordinal not on the contract) → FIXED.** Sequencing is by **array index** of `plan.steps` (strict schema has no `ordinal`; `m11:84` persistence-only) — no schema change; §1/§2/§3/§4-F2/§10 corrected (removed the "ratified ordinal footing" claim).
- **L2 / L3-M8 (multi-event unsupported + revision hazard) → RESOLVED BY THE PIVOT.** The start-gate emits no readying event, so no multi-event commit / `UNIQUE(aggregate_revision)` stagger is needed.
- **L3-B2 (mandatory unsourced → toothless canSkipStep → assurance bypass) → FIXED.** `mandatory` rides the `SkipExecutionStep` command, **fail-closed** (omitted ⇒ mandatory ⇒ waiver required); DWP-02 pins the mandatory-no-waiver reject.
- **L3-B3 (completeExecutionStep no plan-ACTIVE guard → superseded cascade) → RESOLVED BY THE PIVOT.** No cascade on completion → nothing readies under a superseded plan; recorded as F-5 so a future cascade design does not inherit the gap.
- **L3-B4 (mixed-seed double-ready / no start-time predecessor check) → FIXED.** The predecessor rule is enforced AT `startExecutionStep` (the authority), the read-model only the affordance; steps stay QUEUED (no readying → no double-ready); DWP-01 tests the mixed/single cases.
- **L3-B5 (NOOP re-completion re-fires cascade) → RESOLVED BY THE PIVOT.** No cascade → no re-fire.
- **L3-M6 (skip deadlock) → RESOLVED.** The start-gate reads SKIPPED as terminal-success, so skipping the startable step makes the next startable — no cascade to miss; DWP-02 pins it.
- **L3-M7 (all-SKIPPED plan completes vs PWU rule) → FIXED.** `completeExecutionPlan` requires ≥1 SUCCEEDED (DWP-02); aligned with `rejectUnbackedExecutionSuccess`.
- **L3-M9 (duplicate/mixed ordinals) → MOOT** (array index, no ordinal).
- **L3-M10 (skip-producer → consumer unmet input) → DISCLOSED** (caught downstream; 3C-ii closes it, §15).
- **L3-M11 (cancel under superseded) → FIXED.** Cancel is cleanup — no plan-ACTIVE precheck (DWP-02); skip/start still reject.

**§3.7 dimensions (post-reconciliation):** (1) coverage — 3C-i/iii → DWPs (§16), 3C-ii deferred; (2) hard-truths — the ordinal/mandatory-sourcing + the cascade's 5 failures surfaced and resolved (pivot), not glossed; (3) legacy — additive; QUEUED-seeded drives unaffected; (4) semantic-authority — INV-5 structurally intact (Lens 3), RPH-EXE-002/005 enforced at the gate, fail-closed skip, ≥1-SUCCEEDED completion, new commands UNRATIFIED-AUTHORED; (5) assurance/evidence — out-of-order + mandatory-skip + all-SKIPPED rejections demonstrated; (6) security — no new authority; (7) data — N/A; (8) overengineering — the pivot REMOVED the cascade complexity (a start-gate + a pure derivation + 2 commands); (9) sequencing — 01→03 revertible; (10) contradictions — grounded file:line; the interpretive tensions (linear precondition; caller-asserted mandatory; skip-producer) disclosed.

**Readiness (post-critique): `READY_FOR_ACTIVATION`.** All blockers reconciled (the mechanism pivot to a start-gate dissolved the cascade's 5 correctness blockers + the multi-event hazard; the ordinal/mandatory/completion fixes are applied); INV-5 confirmed sound. Nothing built; DWP-01…03 `NOT_STARTED`. Process constraints (inherited): stage only my files by path; never signoz/debug/ASPLE; no push (human pushes); `Co-Authored-By: Claude Opus 4.8`.

## 20. Delivery record and post-build adversarial verification

**Delivered 2026-07-21.** DWP-01…03 built under the sponsor activation, land order 01→02→03, each gated centrally.

- **DWP-01 — start-gate.** `startExecutionStep` gained a predecessor precheck (every earlier step by ARRAY INDEX must be terminal-success SUCCEEDED/SKIPPED, else `RPH_ILLEGAL_STATE_TRANSITION` naming the blocker); pure `startableStepId` + `isTerminalSuccessStep` added to `execution-view.ts`. No cascade, no readying events, no `ordinal`, no machine change.
- **DWP-02 — skip/cancel + completion honesty.** `SkipExecutionStep` (fail-closed via ratified `canSkipStep`, `mandatory ?? true`), `CancelExecutionStep` (cleanup — no plan-ACTIVE precheck; `reason` recorded on the event), `completeExecutionPlan` tightened to require ≥1 SUCCEEDED. 2 commands authored `UNRATIFIED-AUTHORED`; events reused (a `reason` field added to `ExecutionStepCancelled`). Registry 314→316.
- **DWP-03 — UI.** Startable-only Start (from `startableStepByPlan`); Skip/Cancel from a new `controlCommands` read-model (skip gated on ACTIVE, cancel always); the three affected `execution-plan.e2e` tests re-fitted to the new allowlist.

**Gate (green):** check-types 21/21 · vitest all packages (rph-application 226, rph-projections 138, +the rest) · lint 0 · boundary 0 · svelte-check 0 · Playwright 43/43.

**Post-build adversarial verification (ultracode).** A multi-agent workflow (5 code-grounded lenses — sequencing, assurance/INV-5, contract-honesty, UI/read-model, roadmap-conformance — each finding cross-examined by 3 distinct skeptics, majority-confirm; 26 agents) ran against the built diff + the ratified corpus. **7 findings surfaced; 3 refuted, 4 confirmed (all minor); all 4 fixed.** The two candidate blockers were REFUTED on solid grounds: the string-presence waiver check is the *ratified* design (§15) and provably cannot breach INV-5 (a SKIPPED step never satisfies `rejectUnbackedExecutionSuccess`); the `WAITING→RUNNING` start is unreachable (no `ExecutionStepWaiting` handler exists). Confirmed + fixed:

1. **Registry-count provenance (validate.test.ts):** the running tally comment stopped at 314 while the assertion is 316 — added the `+2 → 316` tally line documenting the two new commands + the no-new-id event field.
2. **Skip-event transition note (m3-commands-events.json):** the pre-existing `ExecutionStepSkipped` note read `{NOT_READY,READY}→SKIPPED` (wrong on both ends) — corrected to `{READY,QUEUED}→SKIPPED` to match the machine.
3. **Plan Cancel affordance (+page.svelte):** the pre-existing "Cancel plan" button was gated `!== 'CANCELLED'`, tempting a machine-forbidden `CancelExecutionPlan` on terminal plans — re-gated to `ACTIVE || APPROVED` (the machine's actual →CANCELLED sources; same F-11 command-backed-allowlist discipline as the step actions).
4. **Authority test depth (execution-start-gate.test.ts):** the gate was only exercised with 2-step plans (indistinguishable from an immediate-predecessor check) — added a 3-step case (`['QUEUED','SUCCEEDED','QUEUED']` start(3) → REJECT, naming the non-immediate blocker) pinning the transitive "every earlier step" rule at the authority.

Re-gated after the fixes: full suite green (rph-application 226 incl. the +2 authority tests, Playwright 43/43).

**Disclosed (unchanged, by design):** the start-gate realizes Fork B's "automatic sequencing" as a predecessor gate rather than the literal completion-fold cascade (§7/§15 — the cascade was proven unsafe by §19); `mandatory` and the waiver id are caller-asserted with a fail-closed default (a step-level `mandatory` field + waiver resolution are a 3C-ii/ratification follow-up, §15). 3C-ii (transition grammar / BRANCH/WAIT/PARALLEL) remains DEFERRED.

---

*`DELIVERED` / v0.3.0 — DWP-01…03 built, full gate green, post-build adversarial verification executed and reconciled (§20). Fork B realized as a start-gate (disclosed §7/§15/§20). 3C-ii deferred.*
