# JAN-EXECPLAN-DR-004 — Detailed Implementation Roadmap

*Repository-specific implementation authority for the Transition Grammar & Flow Interpreter (Tier 3C-ii), derived per `JAN-ROADMAP-001-A` from `JAN-EXECPLAN-DS-004 v0.2.0`.*

## 1. Document control and repository identity

| Field | Value |
| :--- | :--- |
| **Document ID** | `JAN-EXECPLAN-DR-004` |
| **Version** | `0.2.0` — reconciled against the EXECUTED §19 roadmap self-critique (2 blockers + 5 majors + 4 minors folded into §5/§8/§9). |
| **Status** | `READY_TO_BUILD` — design-first; DWPs `NOT_STARTED`; sponsor-activated 2026-07-21. |
| **Design authority** | `JAN-EXECPLAN-DS-004 v0.2.0` (sponsor-ruled R1 fresh grammar + R2 BRANCH+WAIT+PARALLEL; D1–D8 resolved; §10 self-critique folded). |
| **Engineering-practice authority** | `JAN-PRPWA-EP-001@0.1.0-draft` (REUSED): BINDING commenting (EP-CMT-1/2/3/**4** — this crosses WORKFLOW-ENGINE SEMANTICS: the graph gate, the condition grammar, branch/wait/parallel/prune); testing-as-evidence (EP-TST-1/2/4/**5**/6/7/**12**); SonarQube (EP-TST-13). **N/A** EP-OBS-*, EP-TST-8/9. |
| **Governance** | 3C-ii's condition grammar is authored under the **sponsor's 2026-07-21 reopening** (R1) — a fresh grant; all authored shapes `UNRATIFIED-AUTHORED` citing ratified anchors; git-commit + NO-PUSH = ratification control (JAN-ENGC-001 §10.1 — no agent self-approval). `ExecutionTransition` derives from ratified DOC-009 §10.3 columns; `stepType` BRANCH/WAIT/PARALLEL_GROUP are RATIFIED (RPH-DOC-002 §21). |
| **Repository & branch** | `hestami-ai/ai-home-maintenance` / `sonar/jpwb-remediation-2026-07-20` @ `.../janumiprofessionalworkbench` (HEAD = the JAN-THEME commit atop Tier-3C `adfec296`). |
| **Persistence revision** | `SCHEMA_VERSION` unchanged — the `execution_transitions` table is ratified persistence (DOC-009 §10.3); no runtime persistence uses it yet (the interpreter reads the embedded `plan.transitions[]`). Contract change: `ExecutionTransition` schema (from opaque record) + new commands/events → `bun run gen` → prettier. |
| **Runtime identity** | Turborepo + Bun 1.3.14; `@janumipwb/rph-{contracts,domain,application,projections}`, `apps/rph-demo`; Vitest + Playwright (msedge, `RPH_DEMO_MODE=test`) + svelte-check + eslint + dependency-cruiser. |
| **Grounding method** | DS-004's 8-agent grounding workflow + its executed 3-lens self-critique (2 blockers reconciled) + the ratified persistence/machine + JAN-ENGC-001 §10.1. |

**Canonical basis:** RPH-DOC-002 §21 (StepType: BRANCH/WAIT/PARALLEL_GROUP are step kinds); DOC-009 §10.3 (`execution_transitions` columns); the `ExecutionStep.stepState` machine (`transitions.data.ts:1421-1488`, QUEUED→SKIPPED legal, WAITING arrows exist); `completeExecutionPlan` allow-list (`execution.ts`); INV-5; RPH-EXE-002/005/006.

## 2. Activated scope

**In scope (R1 + R2):** a guarded-directed-edge interpreter over `ExecutionPlan.transitions[]` that GENERALIZES the shipped linear start-gate — BRANCH (first-match-in-gate + mandatory default + prune-to-SKIPPED), WAIT (manual enter/resolve + the resume event), PARALLEL_GROUP (set-frontier fan-out + barrier-join) — driven by a fresh, replay-safe condition grammar over a thin single-aggregate subject. Decomposed into `JAN-EXECPLAN-DWP-01…06` (§9). **Back-compat is a hard requirement:** empty `transitions[]` / single-step / linear plans stay byte-identical.

**Out of scope (deferred — §15):** timer/condition-driven WAIT auto-resolve (durable-timer/lease runtime); assumption-liveness in the condition subject; explicit k-of-n joins beyond the barrier rule; §10.2 step-level `Condition[]`; post-proposal transition editing.

## 3. Normative-source digest

- **Graph generalizes linear (DS-004 D1/§5).** A step is startable when **no in-edge is PENDING and ≥1 is SATISFIED**; empty `transitions[]` ⇒ implicit `step[i-1]→step[i]` unconditional edges ⇒ byte-identical array-index behavior.
- **In-edge disposition (D7).** SATISFIED = source terminal-success ∧ guard holds (unconditional; or CONDITIONAL first-match-true off a terminal-success BRANCH). NEUTRALIZED = losing/false CONDITIONAL off a terminal BRANCH, or source SKIPPED/FAILED/CANCELLED/SUPERSEDED. PENDING = source not terminal.
- **First-match in the gate (D3).** Only the winning CONDITIONAL edge is SATISFIED — computed in the `startExecutionStep` precheck, so a losing arm is rejected at start regardless of prune timing. Prune is bookkeeping.
- **QUEUED-at-rest (D5).** Steps rest QUEUED; the graph gate (not stepState) controls startability; `PruneExecutionStep` drives the ratified QUEUED→SKIPPED (no new arrow). Controller-issued (like Start), idempotent, replay-folds events.
- **Fresh grammar over a thin subject (D4/R1).** Declarative discriminated union; evaluator pure over `{steps: id → {stepState, outputArtifactIds, attemptsMade, structuredResult}}` folded from committed state + THIS plan's event log — no cross-aggregate/clock/random.
- **RPH-EXE-002 / INV-5 unchanged:** flow drives the EXECUTION axis only; plan-ACTIVE prechecks on start/skip/retry/wait hold; cancel is cleanup; floor gate + `rejectUnbackedExecutionSuccess` authoritative.
- **Engineering practice:** EP-CMT-4 boundary comments at the graph gate, grammar evaluator, and prune/wait/parallel seams; EP-TST-5 state-transition ladder (every newly-driveable arrow + rejection); EP-TST-12 no happy-path-only (malformed-graph, double-run-window, barrier-join-neutralized, prune, WAIT-resume-replay).

## 4. Current-state findings and evidence

- **F-1 `plan.transitions[]` is inert + unexercised.** Persisted + `transitionIds` emitted (`execution.ts:66,88`); read by nothing; the only seed is `transitions: []` (`reference-undertaking.ts:556`). → new graph fixtures obligatory.
- **F-2 `ExecutionTransition` is opaque.** `ExecutionTransitionSchema = z.record(z.string(), z.unknown())` (`objects.ts:90`); `ExecutionPlan.transitions: z.array(ExecutionTransitionSchema)` (`objects.ts:608`). → author the shape from §10.3.
- **F-3 The gate is scalar + linear.** `startableStepId` (`execution-view.ts:219-228`) single-step by array index; `startExecutionStep` precheck (`execution.ts:471-480`) array-index predecessors. UI consumes the scalar: server `startableStepByPlan: Record<string,string>` (`+page.server.ts`), svelte `s.id === startableStepByPlan[pl.id]`, e2e `toHaveCount(1)`. → set-frontier must co-land with these.
- **F-4 QUEUED→SKIPPED is legal; NOT_READY→SKIPPED is not.** `transitions.data.ts:1457-1467` (READY|QUEUED→SKIPPED). Steps rest QUEUED (`reference-undertaking.ts:553`). → prune fires QUEUED→SKIPPED (no new arrow).
- **F-5 WAITING arrows exist, handler-less; resume event missing.** `RUNNING→WAITING` (`ExecutionStepWaiting`, `m3:4891`), `WAITING→RUNNING` (no event, `transitions.data.ts:1447`), `WAITING→CANCELLED` (shipped cleanup). → author `EnterExecutionStepWait` + `ResolveExecutionStepWait` + the resume event.
- **F-6 Completion allow-list is strict.** `completeExecutionPlan` every step SUCCEEDED‖SKIPPED ∧ ≥1 SUCCEEDED (`execution.ts:281-295`). → pruned/unreachable steps MUST reach SKIPPED; barrier-join must not wedge.
- **F-7 Single-event commit.** `advanceStep`/`commitState` one event per command, `UNIQUE(aggregate_revision)` (`kit.ts`). → prune + parallel starts are separate commands; N parallel starts serialize on revision.

## 5. Legacy semantic classification

`ExecutionTransition` schema (opaque→structured) → **GENERALIZE** (fills the ratified §10.3 shape; `conditionExpression` stays opaque jsonb). `TransitionType` enum → **CREATE** (AUTHORED-NEW). The graph gate + `startableStepIds` set-frontier + edge-disposition (rph-domain) → **GENERALIZE** (linear is the degenerate case). The **condition grammar/evaluator** (hand-authored, NOT vocab-generated — §19-B1) → **CREATE** *(under **R1**, the reopened grammar grant)*. `PruneExecutionStep`/`ExecutionStepPruned`, `Enter/ResolveExecutionStepWait` + the resume event → **CREATE** *(under **R2** + the ratified `ExecutionStep.stepState` machine / the standing 2026-07-16 execution grant — **NOT** R1; §19-m3 grant-attribution fix)*. All authored shapes `UNRATIFIED-AUTHORED` with the anchor above. No **REMOVE/RECLASSIFY**; no migration.

## 6. Target-state gap analysis

| Target (DS-004) | Present | Gap (DWP) |
| :--- | :--- | :--- |
| A plan follows a guarded graph | flat array-index linear (F-3) | graph in-edge gate + `startableStepIds` (DWP-01) |
| `ExecutionTransition` has a shape | opaque `z.record` (F-2) | schema from §10.3 (DWP-01) |
| Conditions decide branches | none | fresh grammar + evaluator (DWP-02) |
| BRANCH selects one arm, prunes the rest | none | first-match-in-gate + prune→SKIPPED (DWP-03) |
| A step can WAIT and resume | handler-less arrows (F-5) | enter/resolve + resume event (DWP-04) |
| Steps run concurrently + join | single frontier (F-3) | set-frontier + barrier-join (DWP-05) |
| The tab shows/drives graph flow | linear only | branch/wait/parallel affordances + graph view (DWP-06) |

## 7. Alternatives considered and selected strategy

Per DS-004 §6: **D1** graph-supersedes (not overlay/opt-in); **D2** `{SEQUENTIAL,CONDITIONAL}` (PARALLEL is node-topology); **D3** first-match-in-gate + mandatory default; **D4** thin single-aggregate subject (+attemptsMade+structuredResult; assumption-liveness deferred); **D5** QUEUED-at-rest prune→SKIPPED, controller-issued; **D6** manual WAIT + resume event; **D7** set-frontier + barrier-join. The §10 self-critique's two blockers (NOT_READY-prune deadlock; AND-join wedge) are resolved in these.

## 8. Repository architecture and change map

- **MODIFY:** `packages/rph-contracts/vocab/{m1-object-fields.json` (ExecutionTransition helper — `conditionExpression` stays opaque), `canonical-vocabulary.json` (TransitionType enum), `m3-commands-events.json` (Prune/Wait commands+events)`}` → gen → prettier + `validate.test.ts`. `packages/rph-domain/src/execution.ts` (**pure edge-disposition + startableStepIds + prunableStepIds — the SINGLE gate home** consumed by read-model + authority); `transitions.data.ts` read-only (QUEUED→SKIPPED/WAITING arrows already present). `packages/rph-projections/src/execution-view.ts` (transitions[] on the view input; delegate to the rph-domain predicate; the wait/resolve affordance allowlist). `packages/rph-application/src/handlers/execution.ts` (graph-aware `startExecutionStep`; `pruneExecutionStep`; `enter/resolveExecutionStepWait`; `validateTransitionGraph` + conditionExpression parse in `proposeExecutionPlan`) + `registry.ts`. `apps/rph-demo/src/routes/undertakings/[id]/{+page.server.ts,+page.svelte}` (set-frontier + branch/wait/parallel/prune affordances + graph view).
- **CREATE:** `packages/rph-domain/src/condition-grammar.ts` (**HAND-AUTHORED** ConditionExpression Zod union + type + evaluator — NOT vocab-generated, §19-B1); grammar/evaluator/graph-gate/prune/wait/parallel handler tests; graph fixtures; `apps/rph-demo/e2e/execution-flow.e2e.ts`.
- **NO** DB migration; `ExecutionTransition` (envelope) + Prune/Wait cmds/events are authored contract additions; the **condition grammar is hand-authored in rph-domain** (the generator cannot emit a union); `stepType` reused.

## 9. Detailed work-package register

```yaml
id: JAN-EXECPLAN-DWP-01
title: "ExecutionTransition schema + graph-aware gate foundation (unconditional/topology) + set-frontier co-land + propose-time validation"
master_work_packages: [DS-004:D1, DS-004:D2, DS-004:D7-frontier]
outcome: "ExecutionTransition gains a real shape {id, executionPlanId, sourceStepId?, targetStepId?, conditionExpression?, transitionType} derived from DOC-009 §10.3 (replaces objects.ts:90 z.record); transitionType ∈ {SEQUENTIAL, CONDITIONAL}. startExecutionStep's precheck + a new startableStepIds(plan):string[] read-model interpret the graph for the UNCONDITIONAL case: empty transitions[] ⇒ byte-identical linear (implicit step[i-1]→step[i]); non-empty ⇒ a step is startable when no in-edge is PENDING and ≥1 is SATISFIED (source terminal-success; guards land in DWP-02). ProposeExecutionPlan validates the graph (all stepIds resolve; exactly one entry; every step reachable by edge-connectivity from entry; DAG/acyclic via visited-set; a BRANCH-stepType node has a SEQUENTIAL default out-edge last; condition-ref resolution deferred to DWP-02). The scalar→set rename co-lands with ALL consumers (server Record<string,string[]>, svelte includes(), e2e counts) so no intermediate breaks. Exec ≠ assurance (INV-5); back-compat is a test."
knowledge_status: CONFIRMED
repository_scope:
  files_or_symbols:
    - "packages/rph-contracts/vocab/m1-object-fields.json (ExecutionTransition helper: field the shape) + canonical-vocabulary.json (mint the TransitionType enum {SEQUENTIAL,CONDITIONAL} — same home as StepType) → gen → prettier + validate.test.ts count"
    - "packages/rph-domain/src/execution.ts (NEW pure helpers — the SINGLE home of the gate, consumed by BOTH read-model + authority so they cannot diverge, §19-M2): inEdgeDisposition(step, plan, subject?)→SATISFIED|NEUTRALIZED|PENDING and startableStepIds(plan, subject?)→string[]. Verify the rph-projections→rph-domain import boundary (dependency-cruiser); if disallowed, a shared lower pure module) + execution.test.ts"
    - "packages/rph-projections/src/execution-view.ts (ExecutionPlanInput/View gain a transitions[] field + ExecutionStepView the id/stepType already present; startableStepIds delegates to the rph-domain predicate; unconditional guards only this DWP) + execution-view.test.ts"
    - "packages/rph-application/src/handlers/execution.ts (startExecutionStep precheck delegates to the rph-domain predicate when transitions non-empty, array-index when empty; proposeExecutionPlan: validateTransitionGraph)"
    - "apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts (startableStepByPlan → Record<string,string[]>; load() maps plan.transitions into the view input, mirroring the steps[] mapping) + +page.svelte (Start gate → startableStepByPlan[pl.id]?.includes(s.id)) + ALL frontier-consuming e2e (execution-sequencing.e2e.ts toHaveCount, execution-plan.e2e.ts:216-236 startable-only counts, execution-tier3.e2e.ts:124 step-action-start) stay green"
required_changes:
  - "Author ExecutionTransition {id, executionPlanId, sourceStepId?(nullable=entry), targetStepId?(nullable=exit), conditionExpression?(opaque z.record — §10.3 jsonb), transitionType} in m1-object-fields.json (UNRATIFIED-AUTHORED, cite DOC-009 §10.3); mint TransitionType {SEQUENTIAL,CONDITIONAL} in canonical-vocabulary.json (AUTHORED-NEW); gen + prettier + validate.test.ts count."
  - "rph-domain: the PURE inEdgeDisposition + startableStepIds predicate (empty transitions[] ⇒ byte-identical to today's array-index startableStepId; else the barrier gate — no PENDING in-edge, ≥1 SATISFIED; unconditional edges only here). BOTH execution-view.ts (display) and execution.ts (authority) call it — written once."
  - "execution-view: add transitions[] to ExecutionPlanInput/View; startableStepIds delegates to the rph-domain predicate; +page.server.ts load() populates transitions from the engine plan."
  - "startExecutionStep precheck: when transitions non-empty, use the rph-domain in-edge gate for THIS step; when empty, the shipped array-index path UNCHANGED."
  - "proposeExecutionPlan: validateTransitionGraph — reject (RPH_VALIDATION_SEMANTIC_FAILED) dangling source/target ids, ≠1 entry, unreachable-from-entry (edge-connectivity walk; conditional/prunable targets PASS), cycles (visited-set DAG), a BRANCH node lacking a SEQUENTIAL default-last out-edge."
  - "Co-land the scalar→set frontier across server/svelte/ALL frontier e2e in THIS DWP (no cross-DWP break)."
invariants:
  - "Empty transitions[] ⇒ startableStepIds ≡ [startableStepId] and the precheck ≡ the shipped array-index gate (byte-identical; unit-proven)."
  - "Read-model and authority call the SAME rph-domain predicate (cannot diverge, §19-M2)."
  - "At most the SATISFIED-set is startable; a PENDING in-edge blocks; INV-5 untouched (gate reads, sets nothing)."
  - "A malformed graph never reaches ACTIVE (rejected at propose)."
prohibited_shortcuts:
  - "Do NOT read conditionExpression yet (DWP-02); unconditional edges only."
  - "Do NOT duplicate the gate in execution-view.ts and execution.ts — single rph-domain home."
  - "Do NOT leave the UI on the scalar (breaks check-types/svelte/Playwright) — co-land ALL frontier consumers."
  - "Do NOT invent an ordinal; array index is the linear degenerate only."
tests:
  - "unit: empty-transitions linear regression (byte-identical); a 3-step explicit-linear graph ≡ linear; a diamond (A→B,A→C,B→D,C→D) barrier-join fires D when B,C succeed; REJECT at propose for EACH limb — dangling source id, dangling target id, two-entry (>1 entry), unreachable-from-entry, cyclic, BRANCH-no-default (full EP-TST-5 ladder)."
  - "e2e/regression: execution-sequencing + execution-plan + execution-tier3 specs stay green under the set-frontier."
delivery_state: NOT_STARTED
```

```yaml
id: JAN-EXECPLAN-DWP-02
title: "Fresh condition grammar (HAND-AUTHORED union) + replay-safe evaluator + subject projection; wire into the in-edge gate"
master_work_packages: [DS-004:R1, DS-004:D4]
outcome: "A declarative discriminated-union ConditionExpression grammar (leaf predicates over the D4 subject + ALL/ANY/NOT) with a neutral, replay-pure (expr, subject)→bool evaluator and an exhaustiveness guard. Leaves: STEP_STATE(stepId, state), STEP_SUCCEEDED(stepId), OUTPUT_COUNT(stepId) {==,>=,>,<,<=} n, ATTEMPTS(stepId) {comparisons} n, RESULT_PATH(stepId, jsonPath) EQUALS value. Subject = {steps: id → {stepState, outputArtifactIds, attemptsMade, structuredResult}} folded from committed plan state + this plan's ExecutionStepStarted/Succeeded events. The in-edge gate (DWP-01) now honors CONDITIONAL guards; first-match is DWP-03. Replay-safe: no now()/random/cross-aggregate."
knowledge_status: CONFIRMED
repository_scope:
  files_or_symbols:
    - "packages/rph-domain/src/condition-grammar.ts (NEW, HAND-AUTHORED — NOT vocab-generated): ConditionExpressionSchema (Zod discriminated union, recursive via z.lazy) + ConditionExpression type + evaluateCondition(expr, subject):boolean (pure, exhaustiveness-guarded) + condition-grammar.test.ts. Cite §19-B1: gen-objects.ts CANNOT emit a discriminated union / recursive helper (it forces such helpers to z.record — cf. ApplicabilityExpression at objects.ts:64), so vocab-authoring yields z.record<string,unknown>, not the union the evaluator switches over."
    - "packages/rph-contracts/vocab (NO ConditionExpression helper — ExecutionTransition.conditionExpression STAYS opaque z.record, matching the ratified §10.3 jsonb envelope; the grammar is the hand-authored interpretation layer). NO gen/count change for the grammar."
    - "packages/rph-projections/src/execution-view.ts (buildConditionSubject(plan, events) fold; wire CONDITIONAL edge satisfaction into the disposition via evaluateCondition)"
    - "packages/rph-application/src/handlers/execution.ts (proposeExecutionPlan: parse each edge.conditionExpression with ConditionExpressionSchema.safeParse → reject malformed grammar; condition-ref resolution)"
required_changes:
  - "HAND-AUTHOR ConditionExpressionSchema (Zod discriminated union + z.lazy for ALL/ANY/NOT) + type + evaluateCondition in a NEW pure rph-domain module (UNRATIFIED-AUTHORED under R1, the reopened grammar grant; cite DOC-009 §10.3 condition_expression jsonb as the ratified envelope). Do NOT add it to vocab (the generator can't produce a union — §19-B1)."
  - "evaluateCondition — pure, total over the union (fail-loud on an unknown op via a switch/exhaustiveness never); resolvePath over structuredResult only (no cross-aggregate)."
  - "buildConditionSubject — fold {stepState, outputArtifactIds, attemptsMade(count ExecutionStepStarted), structuredResult(from ExecutionStepSucceeded)} from committed state + event log."
  - "in-edge disposition: a CONDITIONAL edge is SATISFIED iff source terminal-success ∧ evaluateCondition(edge.conditionExpression, subject) (first-match applied in DWP-03)."
  - "proposeExecutionPlan validation: parse each conditionExpression against ConditionExpressionSchema (reject malformed, RPH_VALIDATION_SCHEMA_FAILED); every stepId it references resolves to a declared step (ideally an ancestor; reject RPH_VALIDATION_SEMANTIC_FAILED)."
invariants:
  - "Evaluator is a pure function of (expr, subject); identical inputs → identical output on replay."
  - "Subject reads only committed state + this plan's events (single aggregate); no now()/random/IO."
  - "A malformed OR unresolved-stepId condition is rejected at propose (never silently false at runtime)."
prohibited_shortcuts:
  - "Do NOT import rph-assurance's applicability evaluator (INV-5/domain crossing); author the neutral evaluator."
  - "Do NOT read another aggregate in the subject (assumption-liveness deferred)."
  - "Do NOT try to vocab-generate the union (produces z.record); hand-author it."
tests:
  - "unit: each leaf op true/false; ALL/ANY/NOT; numeric comparisons; RESULT_PATH over structuredResult; replay-stability (same events → same verdict); unknown-op exhaustiveness."
  - "unit (propose reject): a plan whose conditionExpression is malformed REJECTS (RPH_VALIDATION_SCHEMA_FAILED); one referencing an UNDECLARED stepId REJECTS (RPH_VALIDATION_SEMANTIC_FAILED) — never silently false (EP-TST-5)."
delivery_state: NOT_STARTED
```

```yaml
id: JAN-EXECPLAN-DWP-03
title: "BRANCH — first-match-in-gate + mandatory default + prune-to-SKIPPED (controller-issued)"
master_work_packages: [DS-004:D3, DS-004:D5]
outcome: "A BRANCH-stepType node's out-edges evaluate in array order; only the FIRST-MATCH CONDITIONAL edge (or the SEQUENTIAL default) is SATISFIED — computed inside startExecutionStep's precheck (in the rph-domain predicate), so a losing arm is rejected at start regardless of ordering. A pure prunableStepIds(plan) read-model derives steps all of whose in-edges are NEUTRALIZED; a new PruneExecutionStep command drives each QUEUED→SKIPPED (controller-issued, like Start; idempotent via checkTransition; NOT auto-folded into complete). RESOLVED (§19-M1): MINT a fresh ExecutionStepPruned event (do NOT reuse ExecutionStepSkipped — its ratified payload carries no prune-provenance field and routing a system-prune through the waived-skip event conflates it with a user waiver). Exec ≠ assurance (INV-5); no deadlock (QUEUED→SKIPPED is legal + terminal-success)."
knowledge_status: CONFIRMED
repository_scope:
  files_or_symbols:
    - "packages/rph-domain/src/execution.ts (first-match in inEdgeDisposition; prunableStepIds pure predicate) + packages/rph-projections/src/execution-view.ts (expose prunableStepIds via the view)"
    - "packages/rph-application/src/handlers/execution.ts (startExecutionStep precheck first-match; pruneExecutionStep) + registry.ts"
    - "packages/rph-contracts/vocab/m3-commands-events.json (MINT command PruneExecutionStep {stepId, selectedByBranchStepId?, selectedEdgeId?} + event ExecutionStepPruned {stepId, ...(selectedByBranchStepId?/selectedEdgeId?), stepState:'SKIPPED'}) → gen → prettier + validate.test.ts count +2 (1 cmd + 1 event)"
required_changes:
  - "Disposition (in rph-domain): for a CONDITIONAL edge, SATISFIED iff it is the first out-edge (array order) of its terminal-success BRANCH source whose condition is true, else (that source terminal) NEUTRALIZED; the SEQUENTIAL default is the first-match fallback."
  - "pruneExecutionStep: advanceStep(target SKIPPED, event ExecutionStepPruned with eventPayload {stepId, selected…, stepState:'SKIPPED'}) with a plan-ACTIVE precheck; drives QUEUED→SKIPPED (machine-legal); NOT via canSkipStep (system prune ≠ user waiver)."
  - "prunableStepIds(plan): pure; steps whose every in-edge is NEUTRALIZED (and not already terminal); transitive, visited-set (terminates)."
  - "MINT the PruneExecutionStep command + ExecutionStepPruned event (UNRATIFIED-AUTHORED under R2 + the ratified →SKIPPED arrow / standing execution grant — NOT R1); gen + prettier + validate.test.ts count +2."
invariants:
  - "Exactly one BRANCH arm is ever startable (first-match at the gate); a losing arm's start is REJECTED even before prune."
  - "A pruned step reaches SKIPPED (completion-compatible); prune transitivity terminates (visited set); a step reachable via another live edge is NOT pruned."
  - "RPH-EXE-002 respected (prune only under ACTIVE); INV-5 untouched."
prohibited_shortcuts:
  - "Do NOT rely on prune alone for exactly-one (enforce first-match at the gate)."
  - "Do NOT auto-fold prune into CompleteExecutionStep (multi-event-per-command); controller-issued."
  - "Do NOT route system-prune through fail-closed canSkipStep."
tests:
  - "unit: two-true conditions → first arm startable, second REJECTED at start; zero-true → default; prune drives not-taken → SKIPPED; transitive prune terminates; a shared-target (reachable via a live edge) NOT pruned; a BRANCH plan drives to completeExecutionPlan-satisfiable."
delivery_state: NOT_STARTED
```

```yaml
id: JAN-EXECPLAN-DWP-04
title: "WAIT — manual enter/resolve + the missing resume event"
master_work_packages: [DS-004:D6]
outcome: "EnterExecutionStepWait (RUNNING→WAITING, reuse ExecutionStepWaiting m3:4891) + ResolveExecutionStepWait (WAITING→RUNNING, MINT the resume event the machine lacks — closes the F-5/DS-004 F-6 replay hole). Both plan-ACTIVE-guarded. The F-11 read-model allowlist gains 'wait'/'resolve' so the UI (DWP-06) can surface them WITHOUT inventing topology (§19-B2). Manual/external-signal resolve only; timer/condition auto-resolve deferred. WAITING→CANCELLED cleanup already ships. Exec ≠ assurance (INV-5)."
knowledge_status: CONFIRMED
repository_scope:
  files_or_symbols:
    - "packages/rph-contracts/vocab/m3-commands-events.json (EnterExecutionStepWait {stepId, waitReason?}; ResolveExecutionStepWait {stepId, resolutionReason?} + MINT ExecutionStepWaitResolved event) → gen → prettier + validate.test.ts count +3 (2 cmds + 1 event; ExecutionStepWaiting is REUSED, not minted)"
    - "packages/rph-application/src/handlers/execution.ts (enter/resolveExecutionStepWait via advanceStep, plan-ACTIVE) + registry.ts"
    - "packages/rph-projections/src/execution-view.ts (§19-B2: extend the command-backed affordance allowlist — add 'wait' (from RUNNING) + 'resolve' (from WAITING); update the Record<StepState> totality map + its test — mirroring how skip/cancel were co-landed in Tier-3C)"
required_changes:
  - "enterExecutionStepWait: advanceStep(target WAITING, event ExecutionStepWaiting) — OVERRIDE eventPayload to {stepId, ...(waitReason?), stepState:'WAITING'} (§19-m1: ExecutionStepWaitingPayloadSchema is a strictObject REQUIRING stepState; the default command.payload emit is schema-invalid, mirroring startExecutionStep's stepState:'RUNNING' override); plan-ACTIVE precheck."
  - "resolveExecutionStepWait: advanceStep(target RUNNING, event ExecutionStepWaitResolved) — eventPayload {stepId, ...(resolutionReason?), stepState:'RUNNING'} (authored resume event, closing the no-event arrow); plan-ACTIVE precheck."
  - "MINT the resume event + the two commands (UNRATIFIED-AUTHORED under R2 + the ratified WAITING arrows / standing execution grant — NOT R1); gen + prettier + count +3."
  - "execution-view: add 'wait'/'resolve' to the affordance allowlist + the per-stepState map + totality test (so DWP-06 derives the buttons from the read-model, not topology)."
invariants:
  - "WAITING→RUNNING now emits an event (replayable); RUNNING→WAITING reuses the ratified event with a stepState-complete payload."
  - "A step can only enter WAIT from RUNNING and resolve from WAITING (checkTransition); plan-ACTIVE required (RPH-EXE-002)."
  - "The wait/resolve affordances come from the read-model allowlist (F-11), never machine topology."
  - "INV-5 untouched; no timer/clock (replay-safe)."
prohibited_shortcuts:
  - "Do NOT add timer/condition auto-resolve (deferred backlog)."
  - "Do NOT leave WAITING→RUNNING event-less (the replay hole must close)."
  - "Do NOT let DWP-06 mint a Wait button from topology — the allowlist entry lands HERE."
tests:
  - "unit: enter (RUNNING→WAITING) + resolve (WAITING→RUNNING) round-trip; ExecutionStepWaiting emit carries stepState:'WAITING'; resume event present + replays; enter from non-RUNNING REJECT; resolve from non-WAITING REJECT; wait/resolve under non-ACTIVE plan REJECT; WAITING→CANCELLED still works; the affordance map defines wait/resolve for RUNNING/WAITING + totality."
delivery_state: NOT_STARTED
```

```yaml
id: JAN-EXECPLAN-DWP-05
title: "PARALLEL_GROUP + JOIN — set-frontier fan-out + barrier-join"
master_work_packages: [DS-004:D7]
outcome: "A PARALLEL_GROUP-stepType node with ≥2 SEQUENTIAL out-edges makes several targets startable at once (startableStepIds already a set from DWP-01). Each start is its own StartExecutionStep command; the starts SERIALIZE on UNIQUE(aggregate_revision) (dispatcher issues sequentially / conflict-retry). A step with ≥2 in-edges JOINs via the barrier rule (no PENDING in-edge, ≥1 SATISFIED) — already implemented in the DWP-01 disposition; this DWP proves it under real concurrency + the parallel/prune interaction. completeExecutionPlan unchanged (all terminal-success + ≥1 SUCCEEDED)."
knowledge_status: CONFIRMED
repository_scope:
  files_or_symbols:
    - "packages/rph-projections/src/execution-view.ts (confirm set-frontier + barrier-join under parallel/join)"
    - "packages/rph-application/src/handlers/execution.ts (confirm N concurrent RUNNING steps; retryExecutionStep/attemptsMadeForStep/floor-gate are per-step, safe)"
required_changes:
  - "Confirm nothing assumes a single active step: retryExecutionStep precheck (execution.ts), attemptsMadeForStep, the floor gate are per-step — add tests, no logic change expected."
  - "Barrier-join: a JOIN step startable when no in-edge PENDING ∧ ≥1 SATISFIED (neutralized in-edges from pruned/branch/non-success sources do not block)."
  - "Document + test the aggregate_revision serialization of N parallel starts."
invariants:
  - "Multiple steps RUNNING concurrently in one plan aggregate is representable + correct (independent stepStates)."
  - "AND/barrier JOIN fires exactly once when its live in-edges are satisfied; a pruned in-edge neutralizes, never wedges."
  - "N parallel starts serialize on revision (no lost update); INV-5/RPH-EXE-002 hold."
prohibited_shortcuts:
  - "Do NOT add a multi-step StartParallelGroup event (single-event-per-command reused via N commands)."
  - "Do NOT let a neutralized in-edge block a JOIN (barrier rule) nor count as a real contribution."
tests:
  - "unit: PARALLEL_GROUP fans out 2 startable; both drive independently to SUCCEEDED; JOIN fires; a branch-then-join where one arm is pruned still fires the join; a revision-conflict on concurrent start retries; completeExecutionPlan passes."
delivery_state: NOT_STARTED
```

```yaml
id: JAN-EXECPLAN-DWP-06
title: "Execution tab — branch/wait/parallel/prune affordances + transitions graph view"
master_work_packages: [DS-004:D1-D7 UI]
outcome: "The execution tab renders the plan's transition graph (nodes = steps with stepType, edges = transitions with SEQUENTIAL/CONDITIONAL role), offers Start on EACH startable step (set-frontier), surfaces Wait/Resolve (WAIT steps), Prune (prunable steps, or auto-surfaced), and shows branch selection + pruned/waiting states. Allowlist posture (affordances from the read-models, never invented topology, F-11). e2e drives a branch + a parallel + a wait plan."
knowledge_status: CONFIRMED
repository_scope:
  files_or_symbols:
    - "apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts (expose prunableStepIds, wait/resolve/prune form actions)"
    - "apps/rph-demo/src/routes/undertakings/[id]/+page.svelte (multi-startable Start; wait/resolve/prune buttons; a transitions graph view)"
    - "apps/rph-demo/e2e/execution-flow.e2e.ts (NEW: branch selects+prunes, parallel fans out+joins, wait pauses+resumes)"
required_changes:
  - "server: prune/enterWait/resolveWait form actions (dispatchResult); expose startableStepIds + prunableStepIds + the transitions for rendering."
  - "svelte: Start on every startable step (set-frontier from DWP-01); Wait/Resolve buttons derived from the DWP-04 read-model affordance allowlist (NOT topology — F-11); Prune surfaced from prunableStepIds (DWP-03); a simple graph/edge view (reuse the existing flow renderer or a compact list) showing edge roles + conditions."
  - "e2e: stage branch/parallel/wait plans via /test-api/dispatch; assert selection, prune→SKIPPED, parallel concurrency+join, wait→resume."
invariants:
  - "Read-only render + allowlisted commands; undertaking-scoped; Start offered on exactly the startable set."
  - "No affordance the engine would reject (F-11); COMPLETED/terminal ≠ green (INV-5)."
prohibited_shortcuts: ["Do NOT invent affordances from machine topology; derive from the read-models."]
tests: ["e2e: branch plan (condition selects arm, other pruned to SKIPPED, plan completes); parallel plan (2 concurrent, join, complete); wait plan (pause, resolve, complete)."]
delivery_state: NOT_STARTED
```

## 10. Data and persistence changes

No DB migration. `ExecutionTransition` + `ConditionExpression` are authored contract schemas (from the ratified §10.3 columns / the reopened grammar grant); new commands/events → `bun run gen` → prettier → `validate.test.ts` count. `SCHEMA_VERSION` unchanged (the interpreter reads the embedded `plan.transitions[]`, not the persistence table).

## 11. Execution, compatibility, and migration strategy

Land order **01 → 06** (§17). Each: land → central gate → commit by explicit path (human runs git). `bun run gen` + prettier after each vocab edit; rebuild `rph-contracts`/`rph-domain`/`rph-application`/`rph-projections` dists before the app's checks. **Back-compat:** empty-`transitions[]` byte-identical (DWP-01 test); the reference seed stays `transitions: []`.

## 12. Assurance, tests, and evidence plan

Per §9 per-DWP tests + DS-004 §8. Static/EP: check-types, svelte-check 0, boundary 0 (evaluator + read-models browser-safe/pure), SonarLint (EP-TST-13). **EP-TST-5** ladder (every new arrow + rejection); **EP-TST-12** (malformed-graph, two-true→first-match, barrier-join-neutralized, prune, WAIT-resume-replay). EP-CMT-4 at the gate/grammar/prune/wait/parallel seams. **Post-build adversarial verification** (ultracode) before the final commit.

## 13. Security, authority, and tenant-impact analysis

No new authority/secrets/tenant boundary. New commands dispatch through the existing bus + guards; INV-5 confirmed intact (flow drives EXECUTION only; floor gate + `rejectUnbackedExecutionSuccess` unchanged). RPH-EXE-002 respected (start/skip/prune/wait reject post-supersession; cancel cleanup). Replay determinism (evaluator pure, single-aggregate).

## 14. Observability, recovery, and rollback

Each DWP additive + revertible. New events (`ExecutionStepPruned`?, `ExecutionStepWaitResolved`) extend the governed stream; the resume event closes the F-5 replay hole. No new writes beyond the additive commands.

## 15. Risks, assumptions, unknowns, decisions, deferrals, divergences

- **Decisions (sponsor-ruled):** R1 fresh grammar; R2 BRANCH+WAIT+PARALLEL. **Resolved (D1–D8, disclosed):** graph-supersedes; `{SEQUENTIAL,CONDITIONAL}`; first-match-in-gate; thin subject (+attempts+structuredResult); QUEUED-at-rest prune→SKIPPED; manual WAIT; set-frontier + barrier-join.
- **Deferrals:** timer/condition WAIT; assumption-liveness subject; explicit k-of-n join; §10.2 step Condition[]; transition editing.
- **Assumptions:** steps rest QUEUED (`reference-undertaking.ts:553`); `plan.transitions[]` immutable post-proposal; the evaluator's subject is replay-complete from committed state + this plan's events.
- **Risk:** authored grammar/commands must annotate `UNRATIFIED-AUTHORED` under the reopening; the graph path ships unexercised by the seed (mitigated by new fixtures).
- **Divergences from DS-004:** none intended; §19 to disclose any.

## 16. Traceability matrix

| DS-004 authority | DWP | Files | Tests |
| :--- | :--- | :--- | :--- |
| D1 gate / D2 edge role / frontier | DWP-01 | execution.ts, execution-view.ts, vocab, rph-demo | empty≡linear; diamond join; malformed reject |
| R1/D4 grammar+subject | DWP-02 | execution.ts, execution-view.ts, vocab | leaf ops, replay-stability, exhaustiveness |
| D3/D5 branch+prune | DWP-03 | execution.ts, execution-view.ts, vocab | first-match, prune→SKIPPED |
| D6 wait | DWP-04 | execution.ts, vocab | enter/resolve + resume replay |
| D7 parallel/join | DWP-05 | execution.ts, execution-view.ts | concurrency, barrier-join |
| UI | DWP-06 | rph-demo route | branch/parallel/wait e2e |
| Engineering practice | cross-cutting | comments + tests; §12 | ladder · SonarQube |

## 17. Implementation ordering and concurrency plan

Critical path **01 → 02 → 03 → 04 → 05 → 06** (schema+gate foundation → grammar → branch/prune → wait → parallel/join → UI). Gate each centrally (check-types · test · lint · boundary · svelte-check · Playwright); never in a sub-agent. `bun run gen` + prettier after each vocab edit; rebuild dists before the app's checks. SonarLint per-DWP.

## 18. Exit criteria and gate package requirements

**Feature complete when:** DWP-01…06 `DELIVERED`; full gate green (check-types · test · lint 0 · boundary 0 · svelte-check 0 · SonarQube dispositioned · Playwright incl. new flow specs + regression); a branch plan selects+prunes+completes; a parallel plan runs concurrent+joins+completes; a wait plan pauses+resumes; empty-transitions plans byte-identical; INV-5/RPH-EXE-002 unviolated; traceability (§16) reaches code+tests. **Gate package** (`G-EXECPLAN-T3Cii`). Post-build adversarial verification executed + reconciled.

## 19. Self-critique and readiness determination

A **3-lens roadmap-level self-critique was EXECUTED** on v0.1.0 (DWP feasibility/accuracy · sequencing/integration · gate-test-governance completeness; 3 code-grounded agents + a ranking synthesis). Verdict `NEEDS_ROADMAP_REVISION` — **2 blockers + 5 majors + 4 minors**, all reconciled into §5/§8/§9 above (this is a ROADMAP critique; DS-004's design-level critique separately found + fixed 2 design blockers):

- **B1 (DWP-02) → FIXED.** The object-schema generator (`gen-objects.ts`) has **no** `z.union`/`z.discriminatedUnion`/`z.lazy` — it forces recursive helpers to `z.record` (why `ApplicabilityExpression` lands opaque, `objects.ts:64`). So "author the grammar in vocab + gen" would yield an opaque record, not the union the evaluator switches over. Fix: **hand-author** `ConditionExpression` (Zod union + type + evaluator) in a new pure `rph-domain/condition-grammar.ts`; the contract `ExecutionTransition.conditionExpression` stays opaque jsonb (§10.3), validated at `proposeExecutionPlan`.
- **B2 (DWP-04/06) → FIXED.** No DWP authored the F-11 read-model allowlist the UI must derive Wait/Resolve from, yet DWP-06 both surfaced those buttons and forbade topology-invention. Fix: the `'wait'`/`'resolve'` affordance allowlist lands in **DWP-04** (`execution-view.ts`), mirroring the Tier-3C skip/cancel co-land; DWP-06 consumes it.
- **M1 (DWP-03 prune event) → FIXED.** the "mint vs reuse ExecutionStepSkipped" fork gated the count, the command→event binding, and provenance. Fix: **MINT `ExecutionStepPruned`** (+2 registry) carrying `selectedByBranchStepId`/`selectedEdgeId`; do not reuse the waived-skip event.
- **M2 (DWP-01 disposition home) → FIXED.** the read-model + authority gate were headed for duplication (they already are). Fix: the pure `inEdgeDisposition`/`startableStepIds`/`prunableStepIds` predicate lives **once in rph-domain**, consumed by both `execution-view.ts` and `execution.ts` (verify the rph-projections→rph-domain boundary at build).
- **M3-M4 (missing rejection tests) → FIXED.** DWP-01 gains dangling-source/target-id + two-entry rejects (full validate-graph ladder); DWP-02 gains a malformed-grammar + undeclared-condition-ref reject (EP-TST-5).
- **M5 (frontier regression scope) → FIXED.** the set-frontier co-land now enumerates **all** frontier-consuming e2e (execution-sequencing + execution-plan + execution-tier3).
- **m1 (DWP-04 wait payload) → FIXED.** `ExecutionStepWaitingPayloadSchema` requires `stepState`; `enterExecutionStepWait` overrides eventPayload to `{stepId, …, stepState:'WAITING'}` (mirroring `startExecutionStep`); same discipline on the resume event.
- **m2 (DWP-01 view transitions field) → FIXED.** `ExecutionPlanInput/View` gain a `transitions[]` field + the `load()` mapping populates it.
- **m3 (grant attribution) → FIXED.** §5 now anchors Prune/Wait to **R2 + the ratified machine / standing grant** (NOT R1 — R1 is the condition grammar only); each authored-shape bullet carries its `UNRATIFIED-AUTHORED` anchor.
- **m4 (§8 change map) → FIXED.** `canonical-vocabulary.json` (TransitionType) added to MODIFY; `condition-grammar.ts` added to CREATE.

**§3.7 dimensions (post-reconciliation):** coverage (DWP-01…06 → §16); hard-truths (the generator-can't-do-union blocker + the F-11-affordance contradiction surfaced, not glossed); legacy (empty-transitions byte-identical; single gate home); semantic-authority (INV-5/RPH-EXE-002 preserved; hand-authored grammar under R1, Prune/Wait under R2 + machine, all UNRATIFIED-AUTHORED); assurance/evidence (full rejection ladder + replay + back-compat); overengineering (the disposition unified to one home; grammar hand-authored not generator-extended).

**Readiness (post-critique): `READY_TO_BUILD`.** Both blockers were roadmap-level (generator capability + affordance scoping) and are resolved without changing the settled DS-004 D1–D8 or re-consulting the sponsor. Land order 01→06 confirmed dependency-sound (DWP-01 lays the pure gate + set-frontier + schema; DWP-02 adds the hand-authored grammar; DWP-03 branch/prune; DWP-04 wait + affordance; DWP-05 parallel/join; DWP-06 UI). Nothing built; DWP-01…06 `NOT_STARTED`.

---

*`PROPOSED` / v0.2.0 — the §19 roadmap self-critique is EXECUTED and reconciled (2 blockers + majors folded into §5/§8/§9). Design authority DS-004 v0.2.0. `READY_TO_BUILD`. Nothing built.*
