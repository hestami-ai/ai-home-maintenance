# JAN-EXECPLAN-DR-002 — Detailed Implementation Roadmap

*Repository-specific implementation authority for the Execution Temporal Engine (Tier 3 — sub-tiers 3A + 3B + 3D), derived per `JAN-ROADMAP-001-A`.*

## 1. Document control and repository identity

| Field | Value |
| :--- | :--- |
| **Document ID** | `JAN-EXECPLAN-DR-002` |
| **Version** | `0.2.0-draft` — reconciled against the **EXECUTED** §3.7 self-critique (§19: three adversarial lenses ran on v0.1.0 and returned real conditions — incl. 6 blockers — folded into the DWP contracts below). |
| **Status** | `FEATURE COMPLETE` — DWP-01…05 `DELIVERED`/`CONFORMANT` (built + gated 2026-07-21); see §21 delivery record. |
| **Generation standard** | `JAN-ROADMAP-001-A` v2.0.0-draft (§4 sections · §5 DWP contract · §6 grounding bar · §3.7 self-critique). |
| **Program model** | Standalone `JAN-EXECPLAN` program-instance adopting `JAN-ROADMAP-001-A` + `JAN-IRP@0.1.0-draft`. No master roadmap; `master_work_packages` bind to `JAN-EXECPLAN-DS-002` sub-tiers. |
| **Design authority** | `JAN-EXECPLAN-DS-002` (Execution Temporal Engine — Tier 3; DESIGN-FIRST, 2026-07-21). Sponsor-ruled 2026-07-21: **scope 3A + 3B + 3D, defer 3C**; **Fork A** = Execution Attempt is a **§10.4 projection** over the event stream (NOT a typed object / no id-prefix ratification); **Fork B** = **extend `StartExecutionStep`** for attempt-open bind; carried: **C** = explicit plan-terminal commands, **D** = retry cap on `attempt_number`, **F** = defer 3C. |
| **Governance** | Tier 3 is **governed ground**. The plan-terminal STATES + completion CONDITION + RPH-EXE-008 are RATIFIED; the §10.4/§10.5 persistence shapes are RATIFIED; the Attempt CONTRACT OBJECT is WITHHELD (§16 item 23) — Fork A (projection) honors the withholding by folding events, minting **no** new object/prefix. New commands/events are AUTHORED under the standing 2026-07-16 execution grant (consistent with the already-authored sibling commands). No `Source-TBD` grammar is authored (3C deferred). |
| **Repository & branch** | `hestami-ai/ai-home-maintenance` / `sonar/jpwb-remediation-2026-07-20` @ `.../janumiprofessionalworkbench` |
| **Revision at grounding** | HEAD `9be1b58f` + the DR-001 Tier-1/2 commit; `dirty_state: true`. |
| **Persistence revision** | `SCHEMA_VERSION` **unchanged** — Fork A makes the Attempt a **projection**, so NO new tables/migrations. Contract change: **new commands/events + a guard extension in `m3-commands-events.json` → `bun run gen`** (then `prettier`); no DB. |
| **Runtime identity** | Turborepo + Bun 1.3.14; `@janumipwb/rph-{contracts,domain,application,projections}`, `apps/rph-demo` (SvelteKit); Vitest + Playwright (msedge, `RPH_DEMO_MODE=test`) + svelte-check + eslint + dependency-cruiser. |
| **Grounding method** | Standard-digest + 2 file:line repository maps (contract/normative + handler/state-machine) + the corpus's staged design (`docs/_working/DESIGN-execution-attempt-staged.md`) + canonical §9.1/§9.7/§20.1/§36.2. |

**Canonical basis:** Guide §9.1/§9.7 (Execution Plan/Step/Attempt/Binding; the Attempt as a mandatory §9.7 retention floor — "one bounded try"); §20.1 completion ("all required steps reach terminal success"); §36.2 failure taxonomy; RPH-EXE-002 (supersession blocks new steps/attempts); RPH-EXE-008 (retry cap → alternate control action); RPH-PWU-005 (active-plan success → executionState SUCCEEDED, PWU EVIDENCE_PENDING — exec ≠ assurance, INV-5).

## 2. Activated scope

**In scope (3A + 3B + 3D):**
- **3A — Plan-terminal lifecycle.** Explicit `CompleteExecutionPlan` / `FailExecutionPlan` / `SupersedeExecutionPlan` commands + handlers driving the ratified `ACTIVE→COMPLETED / →FAILED / →SUPERSEDED` transitions (data-only today), each through the existing `advanceStatus` machinery with a real guard (completion-condition; RPH-EXE-002 supersession).
- **3B — Execution Attempt (§10.4 projection) + retry cap.** A browser-safe projection folding the `Execution*` event stream into the ratified §10.4 attempt shape (`attempt_number` monotonic per step, `runtime_binding_id`, deterministic `idempotency_key`, `provenance` from the contracted `ExecutionProvenance`, `result`/`error`, `state`, timing). `StartExecutionStep` extended to bind `runtime_binding_id` at attempt-open. `retryExecutionStep` wired to the ready-made `retryDecision` kernel reading `attempt_number` → **RPH-EXE-008 enforced** + the exhaustion control actions.
- **3D — Live-progress / attempt-history read-model** (converges with 3B: the attempt projection *is* the read-model) rendered in the Undertaking Workbench execution tab, resolving the Tier-1 "no plan-completion state" honesty note (DR-001 §15 / F-9).

Decomposed into `JAN-EXECPLAN-DWP-01…05` (§9).

**Out of scope (deferred — §15):** **3C** — the `ExecutionTransition`/`Condition` grammar + step interpreter + the 15 handler-less step arrows (NOT_READY→READY→QUEUED, branch/wait/parallel/skip/cancel/supersede-step): `Source-TBD`, needs a fresh authoring grant (Fork F). Also out: a typed `EXECUTION_ATTEMPT` object + id-prefix ratification (Fork A chose projection); a physical `execution_attempts` SQL table + migration; authoring the four policy shapes (only a `maxAttempts` convention is READ from `RetryPolicy`, not authored); the runtime-binding `PARTIALLY_AUTHORIZED` gap.

## 3. Normative-source digest

- **§20.1 completion (RATIFIED) — corrected predicate (L3-1/L3-2):** a plan is COMPLETED when "all required steps reach terminal success." Absent a per-step `required` flag, 3A's guard is a **success allow-list, not a negation**: `steps.length > 0 AND steps.every(s => s.stepState ∈ {SUCCEEDED, SKIPPED})`. This blocks FAILED/CANCELLED/SUPERSEDED steps *by construction* (the earlier "terminal ∧ ¬FAILED" wrongly admitted CANCELLED/SUPERSEDED as success), and blocks the **empty plan** (`[].every` is vacuously true — an empty plan must NOT complete). A FAILED step is the controller's ground for `FailExecutionPlan`. Today only SUCCEEDED/FAILED step states are reachable (no skip/cancel/supersede-step handler — 3C); **SKIPPED-permits-completion is a hard dependency on 3C's skip handler enforcing `canSkipStep` (authorized-skip only)** — until then a SKIPPED step is unreachable, and the allow-list is future-safe (§15).
- **RPH-EXE-002 supersession (RATIFIED) — covers START *and* RETRY (L3-5):** "a superseded plan cannot **create new execution attempts** and no new step may begin under it." The plan-ACTIVE precheck exists only on `startExecutionStep`; a **retry re-opens the attempt cycle**, so `retryExecutionStep` (which has NO plan-status precheck today) MUST also reject on a non-ACTIVE plan (DWP-02 adds it, reusing `canStartStepUnderPlan`, `rph-domain/src/execution.ts:60-67`). Blocking start alone is insufficient — the retry itself is the RPH-EXE-002 breach.
- **RPH-EXE-008 (RATIFIED, Conformance §12/§36.2/§37) — MAX-TOTAL-ATTEMPTS, corrected count (L3-3/L3-4/L3-6):** the cap is **policy-driven** — `maxAttempts` read from `plan.retryPolicy.maxAttempts` **iff** `Number.isInteger(x) && x >= 1`, else the disclosed default **`3`** (the Conformance §12 fixture value; `maxAttempts=1` = zero retries is the valid floor; the RetryPolicy *shape* stays `Source-TBD`). `attemptsMade` = **`count(ExecutionStepStarted for the step)` ALONE** — one attempt per RUNNING episode; `ExecutionStepRetried` is a re-queue marker, **not** an attempt (counting both double-counts every retry). The kernel is 1-based MAX-TOTAL-ATTEMPTS (`mayRetry = attemptsMade < maxAttempts`): at `maxAttempts=3` exactly **2 retries proceed** (opening attempts 2 and 3); the retry requested at `attemptsMade=3` is REFUSED with the `RETRY_EXHAUSTION_ACTIONS`. (Not "3 retries / 4th refused" — that is max-*retries*, off by one.)
- **§9.7 Attempt floor (RATIFIED) + Fork A:** the Attempt is a mandatory record but — per Fork A + the staged design — realized as a **rebuildable projection** over events (content is already recorded once on `ExecutionStep{Started,Succeeded,Failed,Retried}`), never a second source of truth, never embedded in immutable plan state (the O(N²) hazard).
- **INV-5 (exec ≠ assurance):** plan completion drives the EXECUTION dimension only; it does NOT touch assuranceState. `rejectUnbackedExecutionSuccess` (`pwu.ts:633-661`) stays the PWU-boundary guard (it checks a SUCCEEDED *step*, not a COMPLETED *plan*); 3A is additive and does not alter it.
- **Engineering practice (`JAN-ENGC-001` + `EP-001`):** BINDING commenting incl. **EP-CMT-4** (this crosses workflow-engine semantics — the plan/step machines, the attempt fold, the retry kernel); testing-as-evidence incl. **EP-TST-5 state-transition layer** (every plan-terminal transition exercised, every invalid one rejected) + **EP-TST-12 no happy-path-only** (the cap-exhaustion + supersession rejections demonstrated); SonarQube (EP-TST-13); browser-safety of the new projection.

## 4. Current-state findings and evidence

All `CONFIRMED` (2-mapper inspection at HEAD `9be1b58f`; machines live in `packages/rph-domain/src/transitions.data.ts`).

- **F-1 Plan-terminal transitions are DATA-ONLY.** `ExecutionPlan.status` machine: `ACTIVE→COMPLETED` (`transitions.data.ts:1389`, guard "all steps succeeded"), `ACTIVE→FAILED` (`:1390`), the four `→SUPERSEDED` arrows (`:1393-1416`) — **no handler**. Only `→CANCELLED` (`cancelExecutionPlan :233-240`) is command-reachable. There is **no `TERMINATED` state** ("ExecutionTerminated" is the *event* on the CANCELLED arrow). `registry.ts:114-127` registers 13 execution handlers (5 plan + 4 step + 4 runtime-binding); **none** is a plan-terminal command (no Complete/Fail/Supersede-Plan).
- **F-2 Completion is a derived condition, no dedicated event.** `m11:37,50`: COMPLETED = "all required steps reach terminal success"; the corpus emits it as an inferred transition with no dedicated command OR event. `ExecutionPlanSuperseded` event EXISTS (`m3:4451`, AUTHORED); `ExecutionPlanCompleted`/`Failed` events do **not** exist and must be authored.
- **F-3 `advanceStatus` is the exact machinery.** `kit.ts:401` — `loadOrReject → guard → checkTransition(machine) → commit(eventType)`. The 4 plan-status handlers already route through it (approve/activate/cancel via the status path). A Complete/Fail/Supersede handler is `advanceStatus(ctx, cmd, {objectType:'EXECUTION_PLAN', statusField:'status', machine:'ExecutionPlan.status', target, eventType, guard})`.
- **F-4 No Execution Attempt aggregate; the fold has (almost) everything it needs.** Only the id-prefix `'attempt'` (`ids.ts:33`). `ExecutionStepStarted` echoes the caller `runtimeBindingId` onto the event (`startExecutionStep`, `execution.ts:330-334`; optional — present only when the command supplies it); `ExecutionStepSucceeded` carries `executionAttemptId` + the contracted `executionProvenance` (`objects.ts:224-230`, a `z.strictObject`) + `structuredResult` (`execution.ts:367-376`); `ExecutionStepFailed` carries `failureReason` (populated only when the Fail command supplies it — the demo does, `+page.server.ts:472`). So a projection can fold: per step → **`attempt_number` = `count(ExecutionStepStarted)` ALONE** (one attempt per RUNNING episode — NOT +Retried, which double-counts, L3-3); `runtime_binding_id` from Started (absent for unbound steps); `result`/`error` from Succeeded/Failed; `state` from the latest; timing from event `issuedAt`. `idempotency_key` = deterministic `${stepId}#${attempt_number}` (a real functional key, not fabricated — §10.4's `uq_execution_idempotency`; replay-stable). **Gap (L3-8):** `provenance` is sourced from `ExecutionStepSucceeded.executionProvenance` — a **FAILED** attempt has no provenance on its event, so the projection populates `provenance` only for succeeded attempts (a disclosed divergence from §10.4's `provenance not null`, acceptable for a read-model; §15).
- **F-5 Retry cap unwired; the kernel is ready.** `retryExecutionStep` (`execution.ts:451-458`) bare-advances FAILED→QUEUED, no counting. `retryDecision` (`rph-domain/src/execution.ts:266-275`) is written + unit-tested: `RetryInput{attemptsMade(1-based), maxAttempts, lastAttemptFailed} → {mayRetry, mustSelectAlternateAction, permittedControlActions}`; `RETRY_EXHAUSTION_ACTIONS = [CHANGE_TACTIC, REPLAN_EXECUTION, ESCALATE, REJECT, ABANDON]`. It just needs `attemptsMade` (F-4's projection) + `maxAttempts` (RetryPolicy convention).
- **F-6 No event-folding read-model.** `execution-view.ts` shapes the aggregate snapshot only (`:5-6`); grep(rph-projections, `Execution*` events)=0. The Tier-1 view honestly shows "no plan-completion state" (DR-001 §15) — 3A+3D resolve it.
- **F-7 The reference drive uses a MODEL_INVOCATION step with NO runtime binding.** `reference-undertaking.ts:519-617` shapeAndExecute seeds a `MODEL_INVOCATION` step at `QUEUED` (`:547,553`), `transitions:[]` (`:556`), and never creates a `RuntimeBinding` → its AI attempt has no `runtime_binding_id`. The demo `beginExecute` uses a TRANSFORMATION+HUMAN step (`+page.server.ts:318-390`, step type at `:410`). **Blast-radius correction (L2-1):** a *hard* start-time bind requirement for AI steps would break ~12 test files (3 unit tests that start a binding-less MODEL_INVOCATION expecting ACCEPTED — `execution-detail.test.ts`, `execution-floor-gate-ai.test.ts`, `execution-floor-subject.test.ts` — and 9 reference-drive engine tests, incl. `replay-conformance.test.ts:88-120` which asserts the engine emits **no** `RuntimeBinding*` events). So DWP-03 does **NOT** add a hard guard or change the reference drive; a missing AI binding is surfaced as a projection **advisory** (Fork B realized advisory-side — §7/§15).

## 5. Legacy semantic classification

- Plan-terminal handlers + events → **CREATE** *(additive; outside the §3.4 legacy taxonomy)* — the states/condition pre-exist ratified. `retryExecutionStep` cap wiring + the RPH-EXE-002 retry precheck → **GENERALIZE** (adds the guard the docstring always promised). The attempt projection + read-model + the AI-no-binding advisory → **CREATE** *(additive; outside the taxonomy; browser-safe)*.
- No **REMOVE/RECLASSIFY**; no DB migration; no `Source-TBD` grammar authored (3C **DEFERRED**). *(Fork B softened — no `startExecutionStep` guard / reference-drive change, per L2-1; the earlier "GENERALIZE startExecutionStep bind" is withdrawn.)*

## 6. Target-state gap analysis

| Target (DS-002) | Present at grounding | Gap |
| :--- | :--- | :--- |
| Plan reaches COMPLETED/FAILED | data-only transitions (F-1); no event (F-2) | Complete/Fail commands + events + guard (advanceStatus, F-3) |
| Plan SUPERSEDED on successor | data-only (F-1) | Supersede command + RPH-EXE-002 guard |
| Execution Attempt record | only an id-prefix (F-4) | a §10.4 **projection** folding the event stream (Fork A) |
| Retry cap RPH-EXE-008 | unwired (F-5) | wire `retryDecision` on `attempt_number` + RetryPolicy `maxAttempts` |
| Live progress + attempt history | snapshot-only (F-6) | render the projection in the execution tab |
| Step interpreter / grammar | `Source-TBD` | **DEFERRED (3C, Fork F)** |

## 7. Alternatives considered and selected strategy

Fork resolutions (sponsor-ruled, DS-002 §6): **A** projection (not typed object — honors §16 item 23; no double-recording; no O(N²)); **B** the attempt opens at `StartExecutionStep` (the QUEUED→RUNNING moment) — **realized advisory-side (L2-1):** the projection reads the `runtimeBindingId` the Started event already optionally carries, and surfaces a **coherence advisory** when an AI step (MODEL_INVOCATION/TOOL_INVOCATION) opened an attempt with no recorded binding; **no** hard start-time guard and **no** reference-drive change (a hard bind requirement would break ~12 test files — F-7). This honors "attempt opens at StartExecutionStep" while staying consistent with the codebase's advisory posture (conservation/delegated-assurance/layerHandoff). **C** explicit plan-terminal commands (observable, auditable, mirrors the authored siblings — over an auto-fold that would hide completion inside `completeExecutionStep`); **D** retry cap on `attempt_number` = `count(ExecutionStepStarted)` from the projection (over event-recount); **E** 3A+3B+3D now; **F** defer 3C. New events (`ExecutionPlanCompleted`/`Failed`) are AUTHORED under the standing execution grant, consistent with the already-authored `ExecutionPlanApproved`/`Superseded`. **No `Source-TBD` shape is authored** — `RetryPolicy.maxAttempts` is READ as a convention, not schematized.

## 8. Repository architecture and change map

- **CREATE:** `packages/rph-projections/src/execution-attempts.ts` (+ `.test.ts`) — the §10.4 attempt projection + per-plan progress. New commands/events in `packages/rph-contracts/vocab/m3-commands-events.json` (`CompleteExecutionPlan`/`FailExecutionPlan`/`SupersedeExecutionPlan` + `ExecutionPlanCompleted`/`ExecutionPlanFailed`) → `bun run gen`. New handlers in `execution.ts` + `registry.ts`. `apps/rph-demo/e2e/execution-tier3.e2e.ts`.
- **MODIFY:** `packages/rph-application/src/handlers/execution.ts` (the 3 new plan-terminal handlers; `retryExecutionStep` = DWP-02's plan-non-terminal precheck + DWP-04's cap wiring). `apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts` (fold the attempt projection; plan-terminal form actions) + `+page.svelte` (attempt history + plan-terminal states/actions). `packages/rph-projections/src/index.ts` (export). **No `startExecutionStep` guard, no reference-drive change** (Fork B softened — L2-1).
- **NO** DB schema/table/migration; **NO** new object type / id-prefix; **NO** policy-shape authoring; 3C untouched.

## 9. Detailed work-package register

```yaml
id: JAN-EXECPLAN-DWP-01
master_wave: EXECPLAN
master_work_packages: [DS-002:3A, DS-002:forkC]
title: "Plan completion + failure — CompleteExecutionPlan / FailExecutionPlan (ACTIVE→COMPLETED/FAILED)"
outcome: "Two new AUTHORED commands + events drive the ratified data-only transitions through advanceStatus. CompleteExecutionPlan: guard requires the plan ACTIVE AND steps.length>0 AND every step SUCCEEDED-or-SKIPPED (§20.1 'all required steps reach terminal success' as a SUCCESS allow-list — no per-step required flag exists; this blocks the empty plan and any FAILED/CANCELLED/SUPERSEDED step by construction, L3-1/L3-2) → ACTIVE→COMPLETED, emits ExecutionPlanCompleted. FailExecutionPlan: guard requires ACTIVE → ACTIVE→FAILED (§36.2), emits ExecutionPlanFailed with a failureReason. INV-5 preserved: neither touches assuranceState; rejectUnbackedExecutionSuccess is unchanged (it checks a SUCCEEDED step, not a COMPLETED plan)."
knowledge_status: CONFIRMED
repository_scope:
  repositories: [hestami-ai/ai-home-maintenance]
  files_or_symbols:
    - "packages/rph-contracts/vocab/m3-commands-events.json (NEW CompleteExecutionPlan/FailExecutionPlan commands + ExecutionPlanCompleted/ExecutionPlanFailed events) → bun run gen → prettier"
    - "packages/rph-application/src/handlers/execution.ts (NEW completeExecutionPlan/failExecutionPlan via advanceStatus kit.ts:401)"
    - "packages/rph-application/src/handlers/registry.ts:114-127 (register the 2 commands)"
    - "packages/rph-domain/src/transitions.data.ts:1389-1390 (the ratified target transitions — read-only)"
  database_objects: []
  runtime_surfaces: ["domain command bus"]
dependencies: []
required_changes:
  - "Author CompleteExecutionPlan + FailExecutionPlan commands (payloads: planId; FailExecutionPlan adds failureReason:string, failureClass?:ExecutionFailureClass) + ExecutionPlanCompleted/ExecutionPlanFailed events, under the standing 2026-07-16 execution grant (annotate UNRATIFIED-AUTHORED, like the sibling commands). gen + prettier."
  - "completeExecutionPlan handler: advanceStatus(target:'COMPLETED', eventType:'ExecutionPlanCompleted', guard: SUCCESS ALLOW-LIST — steps.length > 0 AND steps.every(s => s.stepState ∈ {SUCCEEDED, SKIPPED}); else reject RPH_INVARIANT_VIOLATION naming the offending/empty steps). The allow-list (NOT 'terminal ∧ ¬FAILED') blocks FAILED/CANCELLED/SUPERSEDED/non-terminal steps by construction, and blocks the EMPTY plan (L3-1/L3-2)."
  - "failExecutionPlan handler: advanceStatus(target:'FAILED', eventType:'ExecutionPlanFailed', guard: plan ACTIVE)."
invariants:
  - "INV-5: neither handler reads or writes assuranceState; only status (advanceStatus also stamps lifecycleStatus:=target, as the cancel handler does — expected)."
  - "Machine-legal only: advanceStatus checkTransition rejects any non-ACTIVE source (RPH_ILLEGAL_STATE_TRANSITION)."
  - "Completion is a SUCCESS allow-list: COMPLETED requires ≥1 step and EVERY step SUCCEEDED-or-SKIPPED — never a vacuous empty-plan completion, never a CANCELLED/SUPERSEDED step counted as success."
prohibited_shortcuts:
  - "Do NOT auto-fold completion into completeExecutionStep (Fork C = explicit commands; completion must be an observable event)."
  - "Do NOT author a per-step 'required' flag (Source-TBD); use the SUCCESS allow-list (SUCCEEDED||SKIPPED) — NOT the negation 'terminal ∧ ¬FAILED' (which admits CANCELLED/SUPERSEDED, L3-2)."
  - "Do NOT let an empty-step plan complete (L3-1); Do NOT touch assuranceState or rejectUnbackedExecutionSuccess (INV-5)."
tests:
  - "unit: complete an ACTIVE plan whose single step SUCCEEDED → COMPLETED (event emitted); an EMPTY-step plan → REJECT (no vacuous completion, L3-1); a QUEUED/RUNNING step → REJECT; a FAILED step → REJECT; a CANCELLED/SUPERSEDED step → REJECT (allow-list, L3-2); fail an ACTIVE plan → FAILED; complete/fail a non-ACTIVE plan → illegal-transition reject."
evidence: ["execution handler tests green; gen diff is additive; check-types green; SonarLint clean"]
migration_and_compatibility: ["additive commands; existing drives unaffected (they never complete a plan today)"]
rollback_and_recovery: ["remove the 2 handlers + registry entries + revert the vocab additions"]
risks: ["'required steps' reading — mitigated by the disclosed SUCCESS allow-list (SUCCEEDED||SKIPPED, non-empty) + tests pinning the empty-plan and CANCELLED/SUPERSEDED edges (L3-1/L3-2)"]
open_decisions: []
exit_criteria: ["Complete/Fail commands drive COMPLETED/FAILED with the completion guard; illegal + non-terminal rejections asserted; gate green"]
delivery_state: DELIVERED
conformance_state: CONFORMANT
```

```yaml
id: JAN-EXECPLAN-DWP-02
master_wave: EXECPLAN
master_work_packages: [DS-002:3A, DS-002:forkC]
title: "Plan supersession — SupersedeExecutionPlan (ACTIVE/pre-ACTIVE→SUPERSEDED) + RPH-EXE-002 guard"
outcome: "A new AUTHORED SupersedeExecutionPlan command drives the ratified →SUPERSEDED transitions (data-only today) via advanceStatus, reusing the EXISTING ExecutionPlanSuperseded event (m3:4451), citing the successor plan id. RPH-EXE-002 is enforced: a SUPERSEDED plan cannot start a new step (the startExecutionStep plan-ACTIVE precheck already rejects non-ACTIVE; supersession moves it out of ACTIVE) and the attempt projection stops minting for it. Exec≠assurance preserved."
knowledge_status: CONFIRMED
repository_scope:
  repositories: [hestami-ai/ai-home-maintenance]
  files_or_symbols:
    - "packages/rph-contracts/vocab/m3-commands-events.json (NEW SupersedeExecutionPlan command; REUSE ExecutionPlanSuperseded event m3:4451) → gen → prettier"
    - "packages/rph-application/src/handlers/execution.ts (NEW supersedeExecutionPlan via advanceStatus) / startExecutionStep:335-342 (plan-ACTIVE precheck — read-only, confirms RPH-EXE-002)"
    - "packages/rph-application/src/handlers/registry.ts (register)"
    - "packages/rph-domain/src/transitions.data.ts:1393-1416 (→SUPERSEDED arrows — read-only)"
  database_objects: []
  runtime_surfaces: ["domain command bus"]
dependencies: [JAN-EXECPLAN-DWP-01]
required_changes:
  - "Author SupersedeExecutionPlan (payload: planId, successorPlanId:string) + reuse ExecutionPlanSuperseded event; gen + prettier."
  - "supersedeExecutionPlan handler: advanceStatus(target:'SUPERSEDED', eventType:'ExecutionPlanSuperseded', guard: source ∈ {PROPOSED,UNDER_REVIEW,APPROVED,ACTIVE} AND successorPlanId resolves to an EXECUTION_PLAN whose workUnitId matches this plan's — reject a nonexistent/foreign successor, L3-11); record successorPlanId in the event payload."
  - "RPH-EXE-002 covers START *and* RETRY (L3-5): add a plan-non-terminal precheck to retryExecutionStep (reuse canStartStepUnderPlan, rph-domain/src/execution.ts:60-67) so a retry under a SUPERSEDED/terminal plan is REJECTED — a retry re-opens the attempt cycle, which the start-only precheck does NOT cover. (startExecutionStep already rejects a non-ACTIVE plan — no duplication there.)"
invariants:
  - "A SUPERSEDED (or otherwise non-ACTIVE) plan opens no new attempt: neither StartExecutionStep NOR RetryExecutionStep may proceed (RPH-EXE-002 — both paths guarded)."
  - "successorPlanId is validated (same PWU, resolvable) — no dangling supersession reference."
  - "INV-5 untouched."
prohibited_shortcuts:
  - "Do NOT relax the one-active-plan invariant in activateExecutionPlan (supersession is an explicit command here, not an implicit side effect of activating a successor — keep the change surgical)."
  - "Do NOT mint a new SUPERSEDED event type — reuse the existing ExecutionPlanSuperseded."
  - "Do NOT assume the start-precheck covers retry (it does not — L3-5); guard retryExecutionStep explicitly."
tests:
  - "unit: supersede an ACTIVE plan citing a valid same-PWU successor → SUPERSEDED; supersede citing a nonexistent/foreign-PWU successor → REJECT (L3-11); a step under the superseded plan → StartExecutionStep REJECT AND RetryExecutionStep REJECT (both plan-not-ACTIVE, verbatim — RPH-EXE-002 on both paths, L3-5); supersede a terminal plan → illegal-transition reject."
evidence: ["handler tests green; gen additive; check-types green"]
migration_and_compatibility: ["additive; one-active-plan invariant unchanged"]
rollback_and_recovery: ["remove the handler + registry entry + vocab addition"]
risks: ["scope creep into successor-activation auto-supersession — explicitly avoided (surgical explicit command)"]
open_decisions: []
exit_criteria: ["Supersede drives SUPERSEDED; RPH-EXE-002 start-rejection asserted; gate green"]
delivery_state: DELIVERED
conformance_state: CONFORMANT
```

```yaml
id: JAN-EXECPLAN-DWP-03
master_wave: EXECPLAN
master_work_packages: [DS-002:3B, DS-002:3D, DS-002:forkA, DS-002:forkB]
title: "Execution Attempt §10.4 projection (folds the event stream) + AI-no-binding coherence advisory"
outcome: "A NEW browser-safe projection folds Execution* events into the ratified §10.4 attempt shape per step: attempt_number = count(ExecutionStepStarted for the step) ALONE (one attempt per RUNNING episode — NOT +Retried, which double-counts, L3-3), runtime_binding_id (from the Started event, absent when unbound), idempotency_key (deterministic `${stepId}#${attempt_number}` — the §10.4 uq_execution_idempotency functional key, replay-stable), state (from the latest step event), started_at/completed_at (event issuedAt), result/error (from Succeeded/Failed), provenance (from ExecutionStepSucceeded.executionProvenance — succeeded attempts only; a FAILED attempt has no provenance on its event, L3-8). NO new object, NO id-prefix (Fork A = projection; §16 item 23). Fork B realized ADVISORY-side (L2-1): NO startExecutionStep guard, NO reference-drive change — instead the projection flags an AI step (MODEL_INVOCATION/TOOL_INVOCATION) whose attempt has no recorded runtime_binding_id as a coherence advisory (surfaced, never a reject — the codebase's advisory posture)."
knowledge_status: CONFIRMED
repository_scope:
  repositories: [hestami-ai/ai-home-maintenance]
  files_or_symbols:
    - "packages/rph-projections/src/execution-attempts.ts (NEW) + execution-attempts.test.ts (NEW) + index.ts (export)"
    - "packages/rph-contracts DomainEvent + ExecutionProvenance (objects.ts:224-230, z.strictObject) — the fold input (read-only)"
    - "ExecutionStepStarted.runtimeBindingId (execution.ts:330-334, optional) / ExecutionStepSucceeded.executionProvenance (execution.ts:367-376) / ExecutionStepFailed.failureReason (execution.ts:440-447) — the fold sources (read-only)"
  database_objects: []
  runtime_surfaces: ["pure projection (browser-safe)"]
dependencies: []
required_changes:
  - "executionAttempts(events): fold per (executionPlanId, stepId) → ExecutionAttemptView[] in the §10.4 shape; attempt_number = count(ExecutionStepStarted) ONLY (L3-3); idempotency_key deterministic `${stepId}#${attempt_number}`; provenance from Succeeded (succeeded attempts only — failed attempts carry error, no provenance, L3-8); NEVER a second write (projection only)."
  - "planProgress(events, planId): derive live per-plan progress (steps × their latest state + attempt count) for the read-model (3D)."
  - "aiNoBindingAdvisory: flag an attempt whose step is AI (stepType ∈ {MODEL_INVOCATION, TOOL_INVOCATION}) and whose runtime_binding_id is absent — a coherence advisory (display-only; gates nothing). Do NOT add a startExecutionStep guard or change the reference drive (L2-1 blast radius: ~12 test files, incl. replay-conformance.test.ts:88-120)."
invariants:
  - "Pure/browser-safe (no engine import; depcruise projections-browser-safe holds)."
  - "Single source of truth: the projection READS events, writes nothing; attempt content is never re-recorded (staged design §5)."
  - "attempt_number counts Started episodes ONLY (Retried is a re-queue marker, not an attempt) — replay-stable."
  - "idempotency_key is a deterministic function of (stepId, attempt_number) — reproducible on replay, unique per attempt, never random."
  - "The AI-no-binding signal is ADVISORY (display-only) — it gates nothing and blocks no command (no start-time reject)."
prohibited_shortcuts:
  - "Do NOT create an EXECUTION_ATTEMPT object / store row / id-prefix (Fork A = projection; §16 item 23 withholding)."
  - "Do NOT embed attempts in the plan aggregate state (O(N²) under retry storm — staged design §5)."
  - "Do NOT count ExecutionStepRetried as an attempt (double-counts, L3-3); Do NOT add a start-time AI-bind reject (advisory only, L2-1)."
  - "Do NOT fabricate provenance for a failed attempt / a binding for an unbound step — record absence honestly."
tests:
  - "unit: fold a start→succeed step → 1 attempt (attempt_number 1, provenance carried, state SUCCEEDED); a start→fail→retry→start→succeed → 2 attempts (attempt_number 1,2 — count(Started)=2, NOT 3; deterministic distinct idempotency_keys, L3-3); a FAILED-only attempt → error carried, provenance absent (L3-8); an AI (MODEL_INVOCATION) attempt with no runtime_binding_id → the advisory fires; a bound attempt → runtime_binding_id present, no advisory; planProgress reflects per-step latest state."
  - "boundary 0 (browser-safe)."
evidence: ["projection tests green; boundary 0; attempt_number = count(Started) pinned; check-types green"]
migration_and_compatibility: ["ADDITIVE projection only — NO command/handler change, NO reference-drive change, so ZERO blast radius (L2-1); existing drives + tests untouched"]
rollback_and_recovery: ["delete the projection + test + export"]
risks: ["§28.2/RPH-EXE-007 external-dedup needs the same key at the side-effecting call site at runtime — a post-fact projection cannot serve that; DISCLOSED out of scope (§15, L3-9); no real external side effects in the drives today"]
open_decisions: []
exit_criteria: ["attempt projection folds to the §10.4 shape (attempt_number=count(Started), deterministic key, honest failed-provenance + AI-no-binding advisory); boundary 0"]
delivery_state: DELIVERED
conformance_state: CONFORMANT
```

```yaml
id: JAN-EXECPLAN-DWP-04
master_wave: EXECPLAN
master_work_packages: [DS-002:3B, DS-002:forkD]
title: "Retry cap RPH-EXE-008 — wire retryDecision into retryExecutionStep (attempt_number + RetryPolicy)"
outcome: "retryExecutionStep gains a cap precheck (composing with DWP-02's plan-non-terminal precheck on the same handler): attemptsMade = count(ExecutionStepStarted for the step) from the DWP-03 fold (NOT +Retried, L3-3); maxAttempts = plan.retryPolicy.maxAttempts iff Number.isInteger && >=1, else the default 3 (L3-6); call retryDecision({attemptsMade, maxAttempts, lastAttemptFailed:true}). mayRetry → the existing FAILED→QUEUED advance proceeds. Cap reached (mustSelectAlternateAction) → REJECT with a dedicated RPH_RETRY_EXHAUSTED surfacing the permittedControlActions (CHANGE_TACTIC/REPLAN_EXECUTION/ESCALATE/REJECT/ABANDON) verbatim; the controller then selects one (ApplyTacticalChange exists for CHANGE_TACTIC). Kernel is 1-based MAX-TOTAL-ATTEMPTS: @maxAttempts=3, exactly 2 retries proceed (opening attempts 2,3), the retry at attemptsMade=3 is refused (L3-4). RPH-EXE-008 enforced; exec≠assurance untouched."
knowledge_status: CONFIRMED
repository_scope:
  repositories: [hestami-ai/ai-home-maintenance]
  files_or_symbols:
    - "packages/rph-application/src/handlers/execution.ts:451-458 retryExecutionStep (wire the kernel; composes with DWP-02's plan-non-terminal precheck)"
    - "packages/rph-domain/src/execution.ts:266-275 retryDecision + RetryInput; RETRY_EXHAUSTION_ACTIONS at :235-241 (reused, unchanged)"
    - "packages/rph-projections/src/execution-attempts.ts (attempt_number = count(Started) source — DWP-03)"
  database_objects: []
  runtime_surfaces: ["domain command bus"]
dependencies: [JAN-EXECPLAN-DWP-02, JAN-EXECPLAN-DWP-03]
required_changes:
  - "retryExecutionStep cap precheck: attemptsMade = count(ExecutionStepStarted) for the step (the DWP-03 fold, count(Started) ONLY); maxAttempts = (Number.isInteger(plan.retryPolicy.maxAttempts) && plan.retryPolicy.maxAttempts >= 1) ? that : DEFAULT 3 — handles absent/NaN/0/negative/non-integer (L3-6); call retryDecision({attemptsMade, maxAttempts, lastAttemptFailed:true})."
  - "If mustSelectAlternateAction: reject RPH_RETRY_EXHAUSTED with the permittedControlActions listed verbatim (do NOT silently no-op); else proceed with the existing FAILED→QUEUED advance. This precheck runs AFTER DWP-02's plan-non-terminal precheck (a superseded plan rejects before the cap is consulted)."
  - "Read maxAttempts as a CONVENTION on the existing z.record RetryPolicy — do NOT author a RetryPolicy shape (Source-TBD)."
invariants:
  - "The cap is policy-driven (RetryPolicy.maxAttempts), never a hardcoded domain constant; the DEFAULT 3 applies only when the policy is absent/degenerate (RPH-EXE-008; the '3' is the Conformance §12 fixture value; maxAttempts=1 = zero retries is the floor)."
  - "attemptsMade = count(Started), derived deterministically from history (replay-stable); MAX-TOTAL-ATTEMPTS semantics (mayRetry = attemptsMade < maxAttempts)."
  - "INV-5 untouched; the retry moves only stepState."
prohibited_shortcuts:
  - "Do NOT hardcode the cap; read RetryPolicy.maxAttempts (DEFAULT 3 only when absent/degenerate)."
  - "Do NOT treat NaN/0/negative maxAttempts as valid (NaN → all-refused; 0 → forbids all while the initial attempt ran — incoherent); coerce to the DEFAULT."
  - "Do NOT author the RetryPolicy shape (Source-TBD) — read a conventional key only; Do NOT count Retried as an attempt (L3-3); Do NOT silently swallow an over-cap retry."
tests:
  - "unit @maxAttempts=3 (MAX-TOTAL-ATTEMPTS): retry at attemptsMade=1 → proceed (opens attempt 2); at 2 → proceed (attempt 3); at 3 → REJECT RPH_RETRY_EXHAUSTED surfacing the 5 control actions verbatim. i.e. EXACTLY 2 retries proceed, the 3rd refused (NOT '3 proceed / 4th refused', L3-4)."
  - "unit (degenerate, L3-6): retryPolicy absent / maxAttempts=NaN / 0 / -1 / 2.5 → the DEFAULT 3 applies (never all-refused, never infinite); maxAttempts=1 → the first retry is refused (zero-retry floor)."
evidence: ["retry-cap unit tests green (2-retries-@3 boundary + degenerate defaults + exhaustion actions verbatim); check-types green"]
migration_and_compatibility: ["existing single-attempt drives unaffected (never hit the cap)"]
rollback_and_recovery: ["revert retryExecutionStep to the bare advance"]
risks: ["attempts-vs-retries off-by-one — RESOLVED: cap = MAX TOTAL ATTEMPTS, attemptsMade = count(Started), pinned by the 2-retries-@3 test (L3-3/L3-4)"]
open_decisions: []
exit_criteria: ["the 3rd retry refused @max=3 (2 proceed) with the exhaustion actions; degenerate maxAttempts → DEFAULT; policy-driven; gate green"]
delivery_state: DELIVERED
conformance_state: CONFORMANT
```

```yaml
id: JAN-EXECPLAN-DWP-05
master_wave: EXECPLAN
master_work_packages: [DS-002:3D, DS-002:3A]
title: "Execution tab — attempt history + plan-terminal states/actions (resolves the Tier-1 no-completion note)"
outcome: "The Undertaking Workbench execution tab renders, per plan, its terminal STATUS (COMPLETED/FAILED/SUPERSEDED now reachable) and per step its ATTEMPT HISTORY (attempt_number, state, runtime_binding_id where present, provenance actor, result/error) from the DWP-03 projection — replacing the Tier-1 honesty note 'a fully-succeeded plan stays ACTIVE' with real completion. Plan-terminal form actions (Complete / Fail / Supersede plan) dispatch the DWP-01/02 commands via the allowlist posture; surfaced verbatim on rejection. Read path stays undertaking-scoped."
knowledge_status: CONFIRMED
repository_scope:
  repositories: [hestami-ai/ai-home-maintenance]
  files_or_symbols:
    - "apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts (fold execution-attempts projection into the scoped plans; plan-terminal form actions)"
    - "apps/rph-demo/src/routes/undertakings/[id]/+page.svelte (attempt-history rows under each step; plan terminal status + Complete/Fail/Supersede buttons; retire the F-9 'no completion' note)"
    - "apps/rph-demo/e2e/execution-tier3.e2e.ts (NEW)"
  database_objects: []
  runtime_surfaces: ["Undertaking Workbench execution tab"]
dependencies: [JAN-EXECPLAN-DWP-01, JAN-EXECPLAN-DWP-02, JAN-EXECPLAN-DWP-03]
required_changes:
  - "load(): fold executionAttempts for the scoped plans' steps; pass attempt history + plan status."
  - "svelte: under each step, an attempt-history list (+ the AI-no-binding advisory from DWP-03 where it fires); per plan, the terminal status + Complete/Fail/Supersede plan actions (shown only when the plan is ACTIVE/legal, per the allowlist posture); a completed plan shows COMPLETED, not the F-9 note."
  - "plan-terminal form actions dispatch CompleteExecutionPlan/FailExecutionPlan/SupersedeExecutionPlan (DWP-01/02); reject reason surfaced verbatim (exec-error)."
invariants:
  - "Read-only render of the projection; the only writes are the 3 allowlisted plan-terminal commands (Complete/Fail/Supersede — from DWP-01 AND DWP-02)."
  - "INV-5 UI: COMPLETED is rendered as an EXECUTION-axis fact ONLY — never as assurance / SATISFIED / green (exec ≠ assurance; a plan COMPLETED ≠ its PWU assured)."
  - "Undertaking-scoped (the DR-001 F-6 fix stays); other tabs unchanged."
prohibited_shortcuts: ["Do NOT keep the 'no plan-completion state' note once Complete is wired; Do NOT render COMPLETED as green/assured (INV-5); Do NOT fabricate attempt rows for steps with no attempt."]
tests:
  - "e2e: stage an active plan, complete its step, Complete the plan → the tab shows COMPLETED (not the F-9 note) + the step's attempt history; a retry-storm to the cap surfaces the exhaustion action; Fail/Supersede reflect engine truth; illegal plan-terminal action rejected verbatim; COMPLETED is NOT shown as assured/green."
evidence: ["e2e green; svelte-check 0; the F-9 note is gone for a completed plan"]
migration_and_compatibility: ["the Tier-1 panel gains attempt history + terminal states; other tabs untouched. Note: the SEEDED undertaking stamps a constant issuedAt (reference-undertaking.ts:220), so its attempt started_at/completed_at are degenerate/identical — real (non-seed) drives carry distinct timing (L2-8, disclosed)."]
rollback_and_recovery: ["revert the tab additions + form actions"]
risks: ["attempt-history verbosity — mitigated by compact per-step rows; seed timing degenerate (disclosed above)"]
open_decisions: []
exit_criteria: ["completion renders; attempt history renders; plan-terminal actions dispatch + reflect truth; e2e green"]
delivery_state: DELIVERED
conformance_state: CONFORMANT
```

## 10. Data and persistence changes

**No DB schema/table/migration; `SCHEMA_VERSION` unchanged** (Fork A = projection). Contract change: **new commands/events + a guard extension** in `m3-commands-events.json` → `bun run gen` → `prettier` (generated `enums.ts`/`messages.ts`/`objects.ts`/`schemas/` regenerate additively). The Execution Attempt is a **read-model over the event stream**, not a stored object — no `EXECUTION_ATTEMPT` object type, no id-prefix ratification.

## 11. Execution, compatibility, and migration strategy

Land order (§17): **01 → 02 → 03 → 04 → 05.** Plan lifecycle (01 completion/failure → 02 supersession + the RPH-EXE-002 retry precheck) then the attempt engine (03 projection → 04 retry cap) then the UI (05, depends on 01 + 02 + 03). **DWP-02 and DWP-04 both edit `retryExecutionStep`** (02 adds the plan-non-terminal precheck, 04 adds the cap precheck) — serialized 02→04, and 04's cap runs AFTER 02's plan-guard. Each: land → gate → commit. `bun run gen` + `prettier` after each vocab edit; rebuild `rph-contracts`/`rph-domain`/`rph-projections` dists before dependents. Back-compat: all additive — existing drives never completed a plan and used single attempts, so they are unaffected; **no reference-drive change** (Fork B softened to a projection advisory — L2-1, zero blast radius).

## 12. Assurance, tests, and evidence plan

- **Unit (DWP-01/02):** completion guard (SUCCESS allow-list `every(SUCCEEDED||SKIPPED)` + non-empty; empty/CANCELLED/SUPERSEDED/non-terminal rejects); supersession + RPH-EXE-002 start-AND-retry rejection + successor validation. **(DWP-03):** the attempt fold (`attempt_number=count(Started)`, deterministic idempotency_key, succeeded-only provenance, AI-no-binding advisory). **(DWP-04):** the retry cap (@max=3 → 2 retries proceed, 3rd refused; degenerate maxAttempts → default; exhaustion actions verbatim).
- **E2E (DWP-05):** a plan drives to COMPLETED through the UI (the F-9 note gone) with attempt history; a retry-storm hits the cap and surfaces the control action; Fail/Supersede reflect engine truth; illegal plan-terminal action rejected verbatim.
- **Static/EP:** check-types, svelte-check 0, eslint 0, boundary 0 (`rph-projections` browser-safe), SonarLint (EP-TST-13). **EP-TST-5 state-transition layer** (every plan-terminal transition + the cap boundary exercised; every invalid transition rejected); **EP-TST-12 no happy-path-only** (cap-exhaustion + supersession + illegal-completion rejections demonstrated); EP-TST-6 real fixtures, EP-TST-7 assert engine truth. EP-CMT-4 boundary comments at the fold + retry-kernel seams.

## 13. Security, authority, and tenant-impact analysis

No new authority surface, secrets, tenant boundary, or persistence table. New commands dispatch through the existing bus + guards; the attempt projection is a derived read-model (no authority — master invariant 9). §9.1 honored: no assurance bypass (INV-5 intact — completion drives EXECUTION only; the floor gate + `rejectUnbackedExecutionSuccess` unchanged). Supersession enforces RPH-EXE-002. The AI-step bind guard tightens (never loosens) attempt-open.

## 14. Observability, recovery, and rollback

The attempt projection + plan-terminal events are the observability gain (attempt history + real completion, folded from the durable event log — replay-stable). Each DWP additive + independently revertible (§9 rollback lines). No data recovery concerns (no new writes beyond the additive commands/events; no schema change). Per-attempt `idempotency_key` is deterministic → replay yields identical attempts.

## 15. Risks, assumptions, unknowns, decisions, deferrals, divergences

- **Decisions (sponsor-ruled):** Fork A projection, B extend-StartExecutionStep, E 3A+3B+3D; carried C explicit-commands, D attempt_number, F defer-3C (§7).
- **Deferrals (3C, dispositioned):** the `ExecutionTransition`/`Condition` grammar + step interpreter + the 15 handler-less step arrows (NOT_READY→READY→QUEUED, branch/wait/parallel/skip/cancel/supersede-step) — `Source-TBD`, needs a fresh authoring grant. Also: a typed `EXECUTION_ATTEMPT` object + physical SQL table + migration; the four policy shapes (only `RetryPolicy.maxAttempts` read as a convention); the runtime-binding `PARTIALLY_AUTHORIZED` gap.
- **Disclosed reading (completion):** §20.1 "all required steps reach terminal success" is implemented as a **SUCCESS allow-list** — `steps.length>0 && every(SUCCEEDED||SKIPPED)` (no per-step `required` flag exists; authoring one is `Source-TBD`). This blocks the empty plan and any FAILED/CANCELLED/SUPERSEDED step by construction (L3-1/L3-2). **SKIPPED-permits-completion is a hard dependency on 3C**: it is honest only once 3C's skip handler enforces `canSkipStep` (authorized-skip); until 3C, SKIPPED is unreachable, so the allow-list is future-safe (L3-7). Pinned by tests.
- **Disclosed default (retry cap):** `maxAttempts` defaults to **3** (the Conformance §12 fixture value) when the `RetryPolicy` bag lacks a valid `Number.isInteger && >=1` `maxAttempts`; degenerate values (NaN/0/negative/non-integer) coerce to the default (L3-6).
- **Assumption:** the contracted `ExecutionProvenance` (`objects.ts:224-230`; staged design §3) losslessly sources §10.4 `provenance` **for succeeded attempts**; a FAILED attempt has no provenance on its event (L3-8), so the projection's `provenance` is populated only for succeeded attempts — a disclosed divergence from §10.4's `provenance not null`, acceptable for a read-model.
- **Risk:** authoring new commands/events under the standing grant must annotate `UNRATIFIED-AUTHORED` (like siblings) — not claim ratification. Mitigated by mirroring the sibling annotation.
- **Divergences from DS-002 (disclosed, not "none"):** **(a) Fork B softened** — DS-002 §6 Fork B says "require + bind runtime_binding_id"; realized ADVISORY-side (no start-time reject, no reference-drive change) to avoid a ~12-file blast radius (L2-1), while still opening the attempt at StartExecutionStep. **(b) Completion guard** implemented as the SUCCESS allow-list above (a stricter, safer reading of "required steps" than the DS's literal phrasing). **(c) §28.2/RPH-EXE-007 external-dedup out of scope** — the deterministic `idempotency_key` serves §10.4 uniqueness/replay, but runtime external-effect dedup needs the key at the call site, deferred (L3-9). Each is a disclosed implementation-route refinement, not a target-architecture change (no master authority implicated). Otherwise 3A+3B+3D implemented as ruled; 3C deferred as ruled.

## 16. Traceability matrix

| DS-002 authority | DWP | Files (representative) | Tests |
| :--- | :--- | :--- | :--- |
| 3A completion/failure (fork C) | DWP-01 | m3 vocab; `execution.ts` handlers | completion guard + illegal/non-terminal rejects |
| 3A supersession (RPH-EXE-002) | DWP-02 | m3 vocab; `execution.ts` | supersede + start-rejection |
| 3B attempt projection (fork A) + advisory (fork B) | DWP-03 | `execution-attempts.ts` (NEW) | fold shape (`count(Started)`) + AI-no-binding advisory |
| 3B retry cap (fork D, RPH-EXE-008) | DWP-04 | `retryExecutionStep`; `retryDecision` | 3rd-retry refusal @max=3 (2 proceed) + exhaustion actions |
| 3D read-model + 3A UI | DWP-05 | undertaking route execution tab | e2e completion + attempt history |
| 3C interpreter/grammar | **DEFERRED** | — | — |
| Engineering practice (EP-CMT-4/EP-TST-5/12/13) | cross-cutting | comments + tests; §12 | state-transition ladder · SonarQube |

## 17. Implementation ordering and concurrency plan

Critical path: **01 → 02 → 03 → 04 → 05.** 01→02 are the plan-lifecycle pair (02 depends on 01's vocab pattern + adds the RPH-EXE-002 retry precheck); 03→04 the attempt engine (04 reads 03's `attempt_number`); 05 depends on 01 (completion state) + 02 (supersession action) + 03 (attempt projection). **DWP-02 and DWP-04 both modify `retryExecutionStep`** — serialized (02's plan-non-terminal precheck lands first, 04's cap precheck composes after). Gate each centrally (check-types · test · lint · boundary · svelte-check · Playwright); never in a sub-agent. `bun run gen` + `prettier` after each vocab edit; rebuild `rph-contracts`/`rph-domain`/`rph-projections` dists before dependents. **SonarLint per-DWP on changed files (EP-TST-13).**

## 18. Exit criteria and gate package requirements

**Feature complete when:** DWP-01…05 `DELIVERED`; full gate green (check-types · test · lint 0 · boundary 0 · svelte-check 0 · SonarQube dispositioned · Playwright incl. the new spec + regression); a plan reaches COMPLETED through the UI (the F-9 note gone); the retry cap refuses the over-cap retry with the exhaustion actions; the attempt projection folds the event stream to the §10.4 shape; RPH-EXE-002 supersession asserted; INV-5 unviolated; traceability (§16) reaches code+tests. **Gate package** (`G-EXECPLAN-T3`): per-DWP conformance + evidence + SonarQube disposition + readiness (§19), modeled on the DR-001 record.

## 19. Self-critique and readiness determination

Per `JAN-ROADMAP-001-A §3.7`, a **3-lens adversarial self-critique was EXECUTED** on v0.1.0 (three independent agents, each grounding against the repository): **Lens 1 — standards-conformance** (`REVISION_REQUIRED`: 1 blocker + 2 major + tidy-ups), **Lens 2 — code-grounding** (`READY_WITH_CONDITIONS`: 1 critical + precision cites; grounding otherwise validated), **Lens 3 — sequencing/assurance** (`NOT_READY`: **INV-5 confirmed intact** but 5 correctness BLOCKERs + 2 major + minors). All conditions are reconciled into this v0.2.0.

**Conditions and reconciliation (all applied):**

- **L1-BLOCKER (version pre-stamp) → FIXED.** §1 claimed the critique executed while §19 was future-tense. This section now records the real executed conditions; the version reads 0.2.0 honestly. *(§1, §19.)*
- **L1-MAJOR (§15 "Divergences: none" false) → FIXED.** §15 now lists (a) Fork B softened, (b) the completion allow-list reading, (c) §28.2 out of scope. *(§15.)*
- **L1-MAJOR (DWP-05 deps omit DWP-02) → FIXED.** DWP-05 dispatches `SupersedeExecutionPlan` (DWP-02); added to `dependencies` + §11/§17. *(DWP-05, §11, §17.)*
- **L1-MINOR** → FIXED: §5 `CREATE` annotated "(additive; outside the taxonomy)"; F-7 given file:line; `DS-002@1.0` → cite by date/status; template deviation stays flagged. *(§5, §4, §1.)*
- **L2-CRITICAL (AI-bind blast radius) → FIXED by softening Fork B.** The hard `startExecutionStep` bind guard + reference-drive change would break ~12 test files (incl. `replay-conformance.test.ts:88-120`). Dropped entirely; Fork B realized as a projection **advisory** — zero blast radius. *(F-7, §7, DWP-03, §11.)*
- **L2 precision cites → FIXED:** `ExecutionProvenance` `216-221`→`224-230`; Started echo `273-297`→`330-334`; "9 execution commands"→13 handlers (`:114-127`); `RETRY_EXHAUSTION_ACTIONS` `243-275`→`235-241`; `advanceStatus` also stamps `lifecycleStatus` (noted); seed constant `issuedAt` timing degeneracy disclosed. *(§4, DWP-01/03/04/05.)*
- **L3-1 BLOCKER (empty-plan vacuous completion) → FIXED.** The completion guard requires `steps.length > 0`. *(§3, DWP-01.)*
- **L3-2 BLOCKER (completion admits CANCELLED/SUPERSEDED) → FIXED.** The guard is a SUCCESS allow-list `every(SUCCEEDED||SKIPPED)`, not the negation "terminal ∧ ¬FAILED". *(§3, DWP-01.)*
- **L3-3 BLOCKER (attempt_number double-counts) → FIXED.** `attempt_number = count(ExecutionStepStarted)` ALONE; `ExecutionStepRetried` is not counted. *(§3, F-4, DWP-03.)*
- **L3-4 BLOCKER (retry-cap off-by-one) → FIXED.** MAX-TOTAL-ATTEMPTS: @max=3, 2 retries proceed, the retry at `attemptsMade=3` refused. DWP-04's test corrected from "3 proceed/4th refused". *(§3, DWP-04.)*
- **L3-5 BLOCKER (RPH-EXE-002 unguarded on retry) → FIXED.** `retryExecutionStep` gains a plan-non-terminal precheck (a retry re-opens the attempt cycle; the start-only precheck did not cover it); the false "already covered — do NOT duplicate" claim is removed. *(§3, DWP-02.)*
- **L3-6 MAJOR (maxAttempts default undisclosed + degenerate values) → FIXED.** Concrete default 3; `Number.isInteger && >=1` coercion for absent/NaN/0/negative. *(§3, DWP-04.)*
- **L3-7 (SKIPPED couples to unbuilt skip auth) → FIXED (disclosed).** SKIPPED-permits-completion is a hard dependency on 3C's `canSkipStep`; SKIPPED unreachable until then. *(§3, §15.)*
- **L3-8 (failed-attempt provenance) → FIXED (disclosed).** Projection populates `provenance` for succeeded attempts only; failed carry error. *(F-4, DWP-03, §15.)*
- **L3-9 (§28.2 external-dedup) → FIXED (disclosed out of scope).** *(DWP-03, §15.)*
- **L3-11 (unvalidated successorPlanId) → FIXED.** `SupersedeExecutionPlan` validates the successor resolves to a same-PWU EXECUTION_PLAN. *(DWP-02.)*

**§3.7 dimensions (post-reconciliation):** (1) coverage — 3A/3B/3D → DWPs (§16), 3C deferred; (2) hard-truths — governed-ground (Attempt withheld → projection; policy shapes Source-TBD → convention; 'required' has no flag → allow-list) surfaced; (3) legacy — additive; existing drives + tests untouched (Fork B softened → zero blast radius); (4) semantic-authority — **INV-5 confirmed intact by Lens 3** (completion drives EXECUTION only; floor gate + rejectUnbackedExecutionSuccess unchanged), new events UNRATIFIED-AUTHORED, Fork A honors §16 item 23; (5) assurance/evidence — cap-exhaustion + illegal/empty-completion + superseded-retry rejections all demonstrated (not happy-path-only); (6) security — no new authority; (7) data — N/A (projection); (8) overengineering — reuses advanceStatus + retryDecision + ExecutionProvenance + the event stream, only net-new is 3 handlers + 1 retry-precheck + a projection + UI; (9) sequencing — 01→05, 02+04 serialized on retryExecutionStep, each revertible; (10) contradictions — grounded file:line, the interpretive tensions ('required steps', attempts-vs-retries) disclosed + pinned.

**Readiness (post-critique): `READY_FOR_ACTIVATION`.** Lens 1's blocker + Lens 3's 5 correctness blockers + Lens 2's critical are all reconciled into the DWP contracts above; INV-5 was confirmed sound. Nothing built; DWP-01…05 `NOT_STARTED` until sponsor activation. Process constraints (inherited): stage only my files by path; never signoz/debug/ASPLE; no push (human pushes); `Co-Authored-By: Claude Opus 4.8`.

---

## 21. Delivery record (built 2026-07-21)

**All five DWPs DELIVERED + CONFORMANT.** Land order held: DWP-01 → 02 → 03 → 04 → 05, each gated then the next begun.

**Gate package `G-EXECPLAN-T3` (green):** `check-types` 21/21 · unit `test` 21/21 tasks (rph-application **207** incl. 26 new execution-plan tests across completion/supersede/retry-cap; rph-projections **123** incl. 9 new attempt-fold tests; rph-contracts count-guard 314) · `lint` 0 · `boundary` 0 (the new projection stays browser-safe) · svelte-check 0 · **Playwright 40/40** (3 new `execution-tier3.e2e.ts` + all 37 pre-existing — no regression) · SonarLint items addressed as they surfaced.

**Files delivered:**
- `packages/rph-contracts/vocab/m3-commands-events.json` — +3 commands (`CompleteExecutionPlan`, `FailExecutionPlan`, `SupersedeExecutionPlan`) + 2 events (`ExecutionPlanCompleted`, `ExecutionPlanFailed`; supersession reuses the existing event), UNRATIFIED-AUTHORED → `bun run gen` → prettier (regenerated `enums.ts`/`objects.ts`/`messages.ts`/`schemas/`).
- `packages/rph-application/src/handlers/execution.ts` (completeExecutionPlan/failExecutionPlan/supersedeExecutionPlan handlers + the RPH-EXE-002 retry precheck + the RPH-EXE-008 cap wiring) + `registry.ts` (3 registrations). Tests: `execution-plan-completion.test.ts`, `execution-plan-supersede.test.ts`, `execution-retry-cap.test.ts` (NEW).
- `packages/rph-projections/src/execution-attempts.ts` (NEW, the §10.4 fold + AI-no-binding advisory + `attemptsByStep`) + `.test.ts` + `index.ts` (export).
- `apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts` (fold the attempt projection scoped to the undertaking; `completePlan`/`failPlan` form actions) + `+page.svelte` (attempt-history rows, AI-no-binding advisory, plan-terminal Complete/Fail buttons, the F-9 note retired). Test: `apps/rph-demo/e2e/execution-tier3.e2e.ts` (NEW).
- `packages/rph-contracts/src/validate.test.ts` (schema-count guard 309 → 314).

**Build-time refinements (disclosed — none a scope change):**
1. **Retry-cap reject code = `RPH_INVARIANT_VIOLATION`.** There is no canonical `RPH_RETRY_EXHAUSTED` (the 15 error codes are fixed, DOC-007 §25.1); the cap is an invariant, so the exhaustion rejection uses `RPH_INVARIANT_VIOLATION` with the permitted control actions listed verbatim (the roadmap's disclosed fallback).
2. **attempt-counting inlined in the handler** (`attemptsMadeForStep` counts `ExecutionStepStarted` from the event log) rather than importing the projection — avoids an `rph-application → rph-projections` package edge while mirroring the projection's `count(Started)` semantics exactly.
3. **`SupersedeExecutionPlan` is domain-complete + tested but NOT surfaced as a demo UI button** — it needs a successor-plan id (a successor picker is out of the demo's scope); the command/handler/guard are delivered and unit-tested. Disclosed in DWP-05.
4. **Attempt advisory `AI_STEP_TYPES = {MODEL_INVOCATION, TOOL_INVOCATION}`** — deliberately broader than the floor gate's `{MODEL_INVOCATION}` (a tool invocation is also an agent-mediated bounded try, §9.7); pinned in the projection.

**Banking:** uncommitted; staged by explicit path for the human to commit + push (no push authority). `Co-Authored-By: Claude Opus 4.8`.

---

*`FEATURE COMPLETE` / v0.2.0-draft — the §3.7 self-critique was EXECUTED and reconciled (§19); DWP-01…05 built + gated (§21).*
