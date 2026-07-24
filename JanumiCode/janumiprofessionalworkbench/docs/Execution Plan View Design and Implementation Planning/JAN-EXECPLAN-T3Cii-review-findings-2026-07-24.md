# JAN-EXECPLAN Tier 3C-ii — Adversarial Post-Build Review: Raw Findings Register (2026-07-24)

*Machine-generated from the BL-1 review run (`wf_afc37ba9-9ff`): **118 agents, 56 findings raised -> 40 CONFIRMED, 6 PLAUSIBLE, 10 refuted; no lens returned clean.** Every finding below survived TWO independent, perspective-diverse refuters (code-semantics + test-evidence) — a finding either verifier refuted is already excluded. Findings are listed as raised; several are the SAME defect seen by different lenses (the remediation design clusters them).*

> **Scope:** the Tier 3C-ii surface — `condition-grammar.ts`, `transition-gate.ts`, the execution kernel, the plan/step handlers, `execution-view`/`execution-attempts`, and the execution tab. This surface shipped as DWP-01..09 while its roadmap (DR-004) still records every DWP `NOT_STARTED` and its required ultracode post-build verification was never executed. **This register IS that verification.**


---


## F-01 · [CONFIRMED] [BLOCKER] CompleteExecutionStep's RPH-EXE-006 precheck is a TAUTOLOGY, and it disables the §8.4 floor gate entirely for a step that names no outputs

- **Lens:** `anti-vacuity`
- **Site:** `packages/rph-application/src/handlers/execution.ts:801-805 (with packages/rph-domain/src/execution.ts:174-181 and the floor loop at execution.ts:828-856)`

**Claim.** Limb A computes `hasOutput` then passes `explicitNoOutput: !hasOutput`, so validateStepCompletion evaluates `hasOutput || !hasOutput` — a tautology. The reject at :804-805 is unreachable dead code (grep: RPH_STEP_RESULT_MISSING occurs in exactly two places in the repo — rph-domain/src/execution.ts:178 and its own domain unit test; NO application test ever asserts it). CompleteExecutionStepPayloadSchema (rph-contracts/src/messages.ts:163-172) carries no explicit-no-output field for the caller to assert, and outputArtifactIds is a plain z.array with no .min(1). The consequence is not cosmetic: with both id arrays empty, resultIds=[] → stepResultSubjects returns {subjects:[],unresolved:[]} → limb C passes and the limb-D floorGateBlock loop NEVER EXECUTES, so the whole de minimis assurance floor is skipped. The guard is vacuous by construction (CON-000 B7): deleting lines 801-805 outright changes no test.

**Failure scenario.** RUN AND CONFIRMED, not inferred. Take the exact fixture of execution-floor-gate-ai.test.ts:120 — a MODEL_INVOCATION step under a HIGH-risk PWU, executionProvenance.executedBy.actorType='MODEL' with originType 'MODEL_GENERATION', and no ASSURANCE_ASSESSMENT ever recorded — but dispatch CompleteExecutionStep with outputArtifactIds: [] and proposedEvidenceIds: [] instead of naming an artifact. Result: ACCEPTED, stepState becomes SUCCEEDED. The sibling test that names one real artifact gets REJECTED / RPH_INVARIANT_VIOLATION. So the single population the floor gate exists to catch (an unassessed AI output) escapes it by the cheapest possible move: naming nothing. execution-start-gate.test.ts:88-104 already proves the engine accepts this shape — its `complete` helper passes outputArtifactIds: [] on every step and expects ACCEPTED. Worse, floor-gate-ai.test.ts:126-130 asserts in prose that the artifact 'satisfies validateStepCompletion (RPH-EXE-006)' — a claim the code cannot make true, since the empty case satisfies it equally.

**Suggested fix.** Two independent fixes, both needed. (1) Make `explicitNoOutput` a caller ASSERTION rather than a derivation: add an explicit no-output field to CompleteExecutionStepPayloadSchema and pass it, so the reject at :804-805 becomes reachable and RPH-EXE-006 is actually enforced (§2.6: state is explicit, never inferred from absent output). (2) Make the floor gate fail-closed on zero subjects: when `aiProduced` is true and `subjects.length === 0`, refuse — an AI-produced step that names no assessable result cannot have had its mandatory Reasoning Review (§8.4 L854), and today it is admitted silently.

<details><summary>Code-semantics verifier evidence</summary>

I tried hard to refute this and could not. Both limbs hold against the real code, and I reproduced the escape live.

LIMB 1 — the RPH-EXE-006 precheck is literally a tautology (dead code). Call site, `packages/rph-application/src/handlers/execution.ts:801-805`, byte-exact:

    const hasOutput =
        (p.outputArtifactIds?.length ?? 0) > 0 || (p.proposedEvidenceIds?.length ?? 0) > 0;
    const check = validateStepCompletion({ hasOutput, explicitNoOutput: !hasOutput });
    if (!check.ok)
        return reject(command, 'RPH_INVARIANT_VIOLATION', check.reason ?? 'step result missing');

Callee, `packages/rph-domain/src/execution.ts:174-181`:

    export function validateStepCompletion(input: StepCompletionInput): Check {
        if (input.hasOutput || input.explicitNoOutput) return { ok: true };
        return { ok: false, errorCode: 'RPH_STEP_RESULT_MISSING', ... };

So the predicate is `hasOutput || !hasOutput` — provably always true; `check.ok` is never false; lines 804-805 are unreachable. Not a naming/parsing artifact: no delimiter, no split/join, no literal involved (I read the raw source lines, and the two operands are plain array-length comparisons). Grep confirms the reject is unreachable in practice too — `RPH_STEP_RESULT_MISSING` occurs in exactly two places repo-wide: `rph-domain/src/execution.ts:178` and `rph-domain/src/execution.test.ts:122`, which calls `validateStepCompletion({hasOutput:false, explicitNoOutput:false})` DIRECTLY — a combination the application layer can never construct. Deleting execution.ts:801-805 outright breaks no test (CON-000 B7: this is worse than an unkilled mutant — it is dead code). And the caller has no way to make the distinction: `CompleteExecutionStepPayloadSchema` (rph-contracts/src/messages.ts:163-172) is `outputArtifactIds: z.array(z.string())`, `proposedEvidenceIds: z.array(z.string())`, no `.min(1)` and NO explicit-no-output field. RPH-EXE-006 is a ratified conformance invariant (`rph-domain/vocab/m12-conformance.json:126`, `m11-execution.json:225`: "when completion is requested without output or explicit no-output result / then completion is rejected") with ZERO enforcement anywhere in the running engine, while `execution.ts:742-743` claims in prose that it enforces it.

LIMB 2 — the floor gate is skipped entirely for a zero-subject completion. `stepResultSubjects` (`packages/rph-application/src/handlers/floor-gate.ts:120-132`) loops over `resultIds`; with `resultIds = [...[], ...[]] = []` it returns `{subjects: [], unresolved: []}`, so the unresolved reject at execution.ts:833 is skipped and the `for (const subject of subjects)` floorGateBlock loop at execution.ts:841-856 never executes. `advanceStep` (execution.ts:598-676) has no other gate: precheck (645) → requireFrom (647) → checkTransition (654) → commit; RUNNING→SUCCEEDED is legal.

LIVE REPRODUCTION (not inferred). I wrote a temporary probe test that is the exact fixture of `execution-floor-gate-ai.test.ts:120` — MODEL_INVOCATION step, HIGH/HIGH/HIGH/HIGH/HIGH risk PWU, issuedBy AGENT, executionProvenance `{executedBy: MODEL actor, originType:'MODEL_GENERATION'}`, no ASSURANCE_ASSESSMENT ever recorded — changed ONLY `outputArtifactIds: []`/`proposedEvidenceIds: []` (keeping `structuredResult: { architecture: 'generated by the model' }`), dispatched through Engine over SqliteStorageAdapter, then deleted the file. Result:

    Received: "ACCEPTED | undefined | state=SUCCEEDED"

The sibling that names one real recorded Artifact is REJECTED/RPH_INVARIANT_VIOLATION and stays RUNNING. So the single population the §8.4 floor gate exists to catch escapes it by the cheapest possible move: naming nothing. `execution-start-gate.test.ts:88-104` already bakes this shape in as expected-ACCEPTED, and its comment concedes the mechanism ("explicit no-output result (no floor subject → no assurance gate)").

CONSEQUENCE IS NOT INERT — one point the raiser understated. The unassessed AI content still flows downstream: `execution.ts:798` carries `structuredResult` onto ExecutionStepSucceeded, `condition-grammar.ts:197` folds it into the condition subject, and `condition-grammar.ts:128` (`RESULT_EQUALS`) resolves a dot-path over it. So a MODEL step's structuredResult that skipped the floor gate by naming no artifact can still STEER BRANCH SELECTION (DWP-09 resolveBranchSelection). That is unassessed AI output with real control-flow authority — which is why I keep the raiser's BLOCKER rather than downgrading to MAJOR.

PARTIAL CREDIT WHERE DUE (does not refute): `floor-gate.ts:116-118` discloses the adjacent `structuredResult`-carries-content gap, and `JAN-EXECPLAN-DR-001 …Roadmap.md:207/344` records "F-8": "a no-output completion has zero result-subjects and the gate runs zero times". But F-8 was adjudicated purely as a TEST-COVERAGE complaint (fix = add an e2e that demonstrates the gate rejecting a named artifact); nobody registered the bypass itself, and the tautology at 801-805 is disclosed nowhere. Disclosure of a symptom does not make a dead guard live.

ONE CAVEAT ON THE SUGGESTED FIX (2): Coding Agent Guide L1964 says "A timeout/no-output Attempt remains recorded but has no candidate output to review", so a blanket "aiProduced && subjects.length===0 ⇒ refuse" would over-refuse a genuine timeout/no-output attempt. The correct shape is fix (1) first — make explicit-no-output a CALLER ASSERTION in the payload schema — and then fail closed only when the caller did NOT assert no-output (i.e. silently-missing output on an AI step), plus treat a non-empty `structuredResult` on an AI step as professional content that needs a subject. That refines the remedy; it does not touch the finding.

Checks to confirm: packages/rph-application/src/handlers/execution.ts:801-805 beside packages/rph-domain/src/execution.ts:174-181; packages/rph-contracts/src/messages.ts:163-172; packages/rph-application/src/handlers/floor-gate.ts:120-132; packages/rph-domain/src/condition-grammar.ts:128 and :197. Reproduce with the probe described above (run under `bun run vitest run <file>` from packages/rph-application; plain `npx` is blocked by devEngines).

</details>

<details><summary>Test-evidence verifier evidence</summary>

CONFIRMED by live probe + coverage analysis; no existing test refutes it.

(1) VACUITY — airtight without mutation. execution.ts:801-803 computes `hasOutput` then passes `explicitNoOutput: !hasOutput`; rph-domain/src/execution.ts:175 is `if (input.hasOutput || input.explicitNoOutput) return {ok:true}` — i.e. `b || !b`, always true. The reject at :804-805 is unreachable by construction, so deleting 801-805 is provably a no-op on the suite. Coverage confirms independently: repo-wide grep for RPH_STEP_RESULT_MISSING returns exactly two hits — rph-domain/src/execution.ts:178 and its own domain unit test execution.test.ts:120-122. NO application test asserts it. The domain test kills the domain-function mutant; nothing kills the call site (CON-000 B7 unkilled mutant). It is also a contract violation: rph-domain/src/execution.ts:166 documents explicitNoOutput as "distinct from silently missing output" and :172 cites §2.6 "state is explicit, never inferred from absent output" — the application infers it from absent output. CompleteExecutionStepPayloadSchema (rph-contracts/src/messages.ts:163-172) has no field letting a caller assert it, so the distinction is unrepresentable.

(2) FLOOR-GATE ESCAPE — reproduced live. I wrote a temporary probe byte-identical to the fixture at execution-floor-gate-ai.test.ts:120 (HIGH on all five risk axes, MODEL_INVOCATION step, executedBy.actorType='MODEL', originType='MODEL_GENERATION', no ASSURANCE_ASSESSMENT ever recorded) except completing with outputArtifactIds: [] and proposedEvidenceIds: []. Observed output:
  status=ACCEPTED state=SUCCEEDED
  structuredResult={"architecture":"generated by the model"}
  provenance={"executedBy":{"actorId":"model-7","actorType":"MODEL","displayName":"gpt-oss:20b","modelId":"gpt-oss:20b"},"originType":"MODEL_GENERATION"}
The sibling test naming one real recorded artifact gets REJECTED / RPH_INVARIANT_VIOLATION. resultIds=[] -> stepResultSubjects yields no subjects -> the limb-D floorGateBlock loop at execution.ts:841-856 never iterates, so §8.4 is skipped entirely.

HARM IS NOT "nothing was produced": the persisted ExecutionStepSucceeded event carries structuredResult verbatim (execution.ts:798), which the code's own comment at :785-788 calls "the inline result content ... the trace over non-deterministic agent work the system exists to make reasoning-about." AI-generated content therefore enters the governed event stream stamped MODEL/MODEL_GENERATION with zero assurance floor, while the identical content wrapped in a recorded Artifact is refused. §8.4 L854 is unenforced on the cheapest path.

NO REFUTING TEST EXISTS — the opposite. execution-start-gate.test.ts:88-104 codifies the hole: its `complete` helper passes empty arrays on every step with the comment "an explicit no-output result (no floor subject -> no assurance gate)" and expects ACCEPTED. Both execution-floor-gate-ai.test.ts and execution-start-gate.test.ts pass green today (43/43 via `bunx vitest run`) — this is a coverage gap, not a broken build.

SEVERITY CORRECTED BLOCKER -> MAJOR, with two corrections to the finding: (a) INV-5 is NOT breached — the step banks EXECUTION credit only, assuranceState is untouched; (b) because no artifact is named, nothing enters the artifact registry as downstream-consumable, so the leak is confined to the narrower event-stream structuredResult channel. Still MAJOR: a live, reproducible bypass of the exact gate execution-floor-gate-ai.test.ts was written to install, achieved by an agent doing the least possible work.

Both suggested fixes are sound AND independent — making explicitNoOutput a caller assertion does not close the floor hole, and failing closed on (aiProduced && subjects.length===0) does not de-vacuate the RPH-EXE-006 guard. Additionally flag: the prose at execution-floor-gate-ai.test.ts:126-130 claims the named artifact "satisfies validateStepCompletion (RPH-EXE-006)" — a distinguishing claim the code cannot support, since the empty case satisfies it equally; correct that comment with the fix.

HYGIENE: probe file packages/rph-application/src/handlers/zz-probe-empty-output.test.ts was created and DELETED; no source file was modified by me. Note for the parent: `git status` shows packages/rph-application/src/handlers/execution.ts as modified with a temporary mutant at line 1001 (cancelExecutionStep requireFrom gains 'CANCELLED', commented "MUTANT (temporary)") plus untracked zz-probe-cancel-reissue.test.ts / zz-verify-skip-reissue.test.ts / tmp-cancel-verify.test.ts — these belong to a CONCURRENT verifier, are unrelated to the CompleteExecutionStep path, and were left untouched; they must be reverted before commit.

</details>


## F-02 · [CONFIRMED] [BLOCKER] A BRANCH guarded on its OWN result/outputs always records the DEFAULT arm — the branch's own ExecutionStepSucceeded is not yet committed when the decision is taken

- **Lens:** `branch`
- **Site:** `packages/rph-application/src/handlers/execution.ts:762-779 (completeExecutionStep mutateStep), with packages/rph-application/src/handlers/execution.ts:108-122 (guardEvaluatorFor) and packages/rph-domain/src/condition-grammar.ts:208-223 (buildConditionSubject)`

**Claim.** DWP-09 records the branch decision inside `mutateStep`, which runs at advanceStep execution.ts:656 — BEFORE `makeEvent`/`commitState` (execution.ts:660-675). The synthetic `resolved` plan patches ONLY `stepState` to 'SUCCEEDED' (execution.ts:767-772). The condition subject is still folded from `ctx.store.readAllEvents()`, and `buildConditionSubject` seeds every step at `outputArtifactIds: []` / `structuredResult: undefined` and fills them only from a COMMITTED `ExecutionStepSucceeded` (condition-grammar.ts:191-198, :215). At decision time this completion's event does not exist, so for the deciding step itself `RESULT_EQUALS` resolves against `undefined` (condition-grammar.ts:128 → always false) and `OUTPUT_COUNT` reads 0 (condition-grammar.ts:124). Branching on the result the step just produced — the canonical BRANCH use — is therefore always false, first-match falls through to the mandated unconditional SEQUENTIAL default, and DWP-09 makes that wrong answer PERMANENT. Nothing in the suite covers it: the only DWP-09 fixture (execution-start-gate.test.ts:928-936) guards on STEP_STATE of an unrelated step s4, the one op unaffected by the missing event.

**Failure scenario.** VERIFIED through the live command bus (probe run 2026-07-24, packages/rph-application, in-memory SqliteStorageAdapter + Engine). Plan: s1 stepType BRANCH, s2, s3; transitions [ {id:'t1-2', s1→s2, CONDITIONAL, conditionExpression {op:'RESULT_EQUALS', stepId:'s1', path:'outcome', value:'PASS'}}, {id:'t1-3', s1→s3, SEQUENTIAL default last} ]. Propose→Approve→Activate→StartExecutionStep(s1)→CompleteExecutionStep(s1, structuredResult {outcome:'PASS'}). Observed: `steps[s1].selectedTransitionId === 'plan…-t1-3'` (the DEFAULT), not 't1-2'. StartExecutionStep(s2) → REJECTED forever ('every in-edge is neutralized'); StartExecutionStep(s3) → ACCEPTED. The step reported PASS and the plan ran the not-PASS arm; because the decision is now a recorded fact, no later read can correct it. Identical outcome for a guard `{op:'OUTPUT_COUNT', stepId:'s1', cmp:'>=', value:1}` — outputArtifactIds is [] at decision time regardless of what the command carried.

**Suggested fix.** Project the completion's OWN result into the subject, not just its stepState. Either (a) have `mutateStep` build the subject via a variant of `buildConditionSubject` that takes an extra `pendingSucceeded: {stepId, outputArtifactIds, structuredResult}` overlay applied after the event fold, or (b) synthesize the not-yet-committed ExecutionStepSucceeded payload and append it to the event list passed to `buildConditionSubject`. Then add a kill test per op (RESULT_EQUALS and OUTPUT_COUNT on the branch's own stepId).

<details><summary>Code-semantics verifier evidence</summary>

CONFIRMED — traced statically through every cited site and then reproduced LIVE through the command bus.

1) DECISION TIME PRECEDES THE EVENT. `advanceStep` (packages/rph-application/src/handlers/execution.ts:598-676) runs, in order: precheck (:645), requireFrom (:647), checkTransition (:654), `args.mutateStep(step)` (:656), `makeEvent` (:660), `commitState` (:667). `makeEvent` (kit.ts:188-213) is a PURE envelope constructor — it appends nothing; `commitState` (kit.ts:249-377) is the only path to `ctx.store.commit`. So at `mutateStep` time this completion's `ExecutionStepSucceeded` is not in the store.

2) ONLY `stepState` IS PROJECTED FORWARD. execution.ts:762-779:
```ts
mutateStep: (step) => {
  if (step.stepType !== 'BRANCH') return step;
  const gatePlan = toGatePlan(loadPlanState(ctx, command.targetAggregateId));
  const resolved = { ...gatePlan, steps: gatePlan.steps.map((s) =>
      s.id === String(step.id) ? { ...s, stepState: 'SUCCEEDED' } : s) };
  const selected = resolveBranchSelection(resolved, String(step.id),
      guardEvaluatorFor(ctx, command.targetAggregateId, resolved));
  return selected === undefined ? step : { ...step, selectedTransitionId: selected };
}
```
`GateStep` (transition-gate.ts:35-45) carries only id/stepState/stepType/selectedTransitionId — there is nowhere for the result to ride. `guardEvaluatorFor` (execution.ts:108-122) then does `buildConditionSubject(gatePlan.steps, ctx.store.readAllEvents(), planId)`.

3) THE SUBJECT FOLD FILLS RESULT FIELDS ONLY FROM A COMMITTED EVENT. condition-grammar.ts:213-215 seeds every step `{ stepState: s.stepState, outputArtifactIds: [], attemptsMade: 0 }` (no `structuredResult`), and only `foldExecutionEventInto` on eventType `ExecutionStepSucceeded` (:191-198) ever writes `outputArtifactIds` / `structuredResult`. With no committed event for the deciding step, `RESULT_EQUALS` hits `resolvePath(undefined, path)` → `undefined !== value` → false (:128) and `OUTPUT_COUNT` compares `0` (:124). `STEP_SUCCEEDED`/`STEP_STATE` (:120-122) read the patched `stepState` and DO work; `ATTEMPTS` reads already-committed `ExecutionStepStarted` and also works. Exactly the two result-bearing ops are broken.

4) NO EARLIER GUARD INTERCEPTS IT. `rejectMalformedTransitionCondition` (execution.ts:183-210) only parses the grammar and checks that each `stepId` is a DECLARED step — a self-referencing guard is accepted. `validateTransitionGraph`/`checkBranchDefaults` (transition-gate.ts:519-549) says nothing about self-reference. `resolveBranchSelection` (transition-gate.ts:182-196) then returns the first unconditional edge, i.e. the mandated SEQUENTIAL default. `selectBranchEdge` (:109-114) makes the recorded id win over any re-derivation forever, and `inEdgeDisposition` (:228-231) neutralizes every non-selected arm.

5) LIVE REPRODUCTION (probe test written in packages/rph-application/src/handlers, run with `bunx vitest run --reporter=verbose --silent=false`, then deleted). Plan: s1 stepType BRANCH, s2, s3; transitions `[cedge(1,2,{op:'RESULT_EQUALS',stepId:s1,path:'outcome',value:'PASS'}), gedge(1,3)]`. Propose→Approve→Activate→Start(s1)→Complete(s1, structuredResult {outcome:'PASS'}). Output:
```
SELECTED: plan_…-t1-3 expected plan_…-t1-2
start(s2): REJECTED — "Cannot start step plan_…-s2: every in-edge is neutralized — the step is unreachable (it should be pruned) (RPH-EXE-005)."
start(s3): ACCEPTED
CONTROL SELECTED (op STEP_SUCCEEDED on s1): plan_…-t1-2   ← correct
```
The step reported PASS and the engine permanently ran the not-PASS arm. The CONTROL isolates the cause precisely: the op that reads the patched `stepState` resolves correctly, the op that needs the uncommitted event does not.

6) ANTI-VACUITY: no test anywhere drives `RESULT_EQUALS` or `OUTPUT_COUNT` through the bus. `grep -rn "RESULT_EQUALS\|OUTPUT_COUNT"` hits only the pure evaluator unit tests (packages/rph-domain/src/condition-grammar.test.ts:64-77) and the projection's `describeCondition` renderer (rph-projections/src/execution-view.test.ts:478-480). Every bus-level CONDITIONAL fixture in execution-start-gate.test.ts (lines 329, 337, 703, 729, 786, 842, 937) uses STEP_SUCCEEDED, ATTEMPTS or STEP_STATE — i.e. only the three ops the `stepState` patch or the already-committed Started events happen to cover. The DWP-09 fixture (:924-963) guards on STEP_STATE of s4. (Small correction to the raising lens: STEP_STATE-of-s4 is not the ONLY unaffected op — self-referential STEP_SUCCEEDED and ATTEMPTS are exercised and also unaffected. This does not change the verdict.)

Severity BLOCKER stands: the branch's decision is silent, wrong, and — by DWP-09's own design — permanent; the excluded arm can never be started and the plan proceeds down the arm the step's own result contradicted. Fix must overlay the pending `{outputArtifactIds, structuredResult}` onto the subject at `mutateStep` (e.g. an extra `pendingSucceeded` parameter to `buildConditionSubject`, or synthesizing the not-yet-committed `ExecutionStepSucceeded` into the event list), plus one kill test per result-bearing op.

</details>

<details><summary>Test-evidence verifier evidence</summary>

CONFIRMED by live command-bus probe, and the coverage gap is real.

## 1. No existing test covers the claimed-broken behaviour (so nothing REFUTES it)

Repo-wide grep for `RESULT_EQUALS|OUTPUT_COUNT` (`--include=*.test.ts --include=*.e2e.ts`, node_modules excluded) hits exactly ONE test file: `packages/rph-domain/src/condition-grammar.test.ts:64-77`. Those are PURE evaluator tests — `ev({op:'RESULT_EQUALS', ...})` against a hand-built `ConditionSubject` literal. They never touch `advanceStep`, `mutateStep`, or the store, so they are structurally incapable of detecting the commit-ordering defect.

NO test at the application layer or in e2e ever dispatches a plan carrying a `RESULT_EQUALS` or `OUTPUT_COUNT` guard:
- `packages/rph-application/src/handlers/execution-start-gate.test.ts` — every BRANCH fixture uses `STEP_SUCCEEDED` (lines 385, 723, 780, 836) or `STEP_STATE` of an unrelated step (the sole DWP-09 fixture, line 934: `cedge(1, 2, {op:'STEP_STATE', stepId: stepId(4), state:'SKIPPED'})`). Its `complete()` helper hardcodes `structuredResult: {}` and `outputArtifactIds: []` (lines 86-101), so the two result-bearing ops are never exercised end-to-end.
- `apps/rph-demo/e2e/execution-flow.e2e.ts:193` — the DWP-06 BRANCH e2e also uses `{op:'STEP_SUCCEEDED', stepId: BRANCH.stepIds[0]}`.
- `packages/rph-projections/src/execution-view.test.ts:436-547` — all read-model BRANCH cases use `STEP_SUCCEEDED` against hand-seeded plans.

`STEP_SUCCEEDED` (and `STEP_STATE`) are precisely the ops the bug CANNOT touch, because `mutateStep` (`packages/rph-application/src/handlers/execution.ts:767-772`) patches exactly `stepState: 'SUCCEEDED'` forward and nothing else. So the whole existing BRANCH suite is green through the one hole in the projection. That is an unkilled-mutant coverage gap of the JPWB-CON-000 B7 kind, not a proof of correctness.

## 2. Live probe through the real command bus (Engine + SqliteStorageAdapter, in-memory)

I wrote a temporary probe at `packages/rph-application/src/handlers/zzz-testlens-branch-own-result.test.ts` (mirroring the start-gate harness: CaptureIntent → ProposePwu → ProposeExecutionPlan → Approve → Activate), ran `bunx vitest run`, and DELETED it afterwards. No source file was modified (`git status --porcelain packages/` shows no `M` entries). Results:

- **PROBE A — RESULT_EQUALS on the branch's own result: FAILS (defect reproduced).** Plan s1=BRANCH, transitions `[t1-2 CONDITIONAL {op:'RESULT_EQUALS', stepId:s1, path:'outcome', value:'PASS'}, t1-3 SEQUENTIAL default]`. Start(s1) → Complete(s1, `structuredResult:{outcome:'PASS'}`) ACCEPTED. Observed output:
  `PROBE A selectedTransitionId = plan_…K20-t1-3` (the DEFAULT arm — expected `t1-2`)
  `PROBE A start(s2) = "REJECTED"`
  `PROBE A start(s3) = "ACCEPTED"`
  The step reported `outcome:'PASS'` and the plan ran the not-PASS arm. Because DWP-09 records `selectedTransitionId` as a durable fact, no later read corrects it — the wrong arm is permanent and the correct arm is dead.

- **PROBE C — OUTPUT_COUNT on the branch's own outputs: FAILS (defect reproduced).** Same shape with `{op:'OUTPUT_COUNT', stepId:s1, cmp:'>=', value:1}`. First attempt was rejected for an unrelated reason (`outputArtifactIds` must name recorded objects), so I dispatched a real `RecordArtifact` first. Then:
  `PROBE C complete = ACCEPTED undefined`
  `PROBE C selectedTransitionId = plan_…K20-t1-3` (the DEFAULT — expected `t1-2`)
  `PROBE C states = SUCCEEDED QUEUED QUEUED`
  A genuinely recorded output artifact was carried on the completion and the guard still read 0.

- **PROBE B (STEP_SUCCEEDED on own state) — PASSES.** Selected `t1-2`. This is the control showing WHY the suite is green: the projected `stepState` is the one field `mutateStep` forwards.
- **PROBE D (ATTEMPTS on own attempts) — PASSES.** Selected `t1-2`. Control: `ExecutionStepStarted` was already committed before the completion, so the `attemptsMade` fold is correct.
- **PROBE E (RESULT_EQUALS against an EARLIER, already-completed step) — PASSES.** Plan s1 plain → s2=BRANCH, `t2-3` guarded on `{op:'RESULT_EQUALS', stepId:s1, path:'outcome', value:'PASS'}`. After completing s1 with `{outcome:'PASS'}` and then s2, `selectedTransitionId === t2-3`. This scopes the defect precisely: the ops are live and correct for a PRIOR step; only SELF-reference by the deciding BRANCH is broken.

## 3. Why the code path supports it (independent corroboration)

`advanceStep` calls `args.mutateStep(step)` at `packages/rph-application/src/handlers/execution.ts:656` — strictly before `makeEvent` (:660) and `commitState` (:673). `mutateStep`'s `resolved` plan rewrites ONLY `stepState` (:767-772), then calls `guardEvaluatorFor(ctx, planId, resolved)`, which builds the subject via `buildConditionSubject(gatePlan.steps, ctx.store.readAllEvents(), planId)` (execution.ts:116). `buildConditionSubject` seeds every step at `outputArtifactIds: []` with `structuredResult` absent (condition-grammar.ts:215) and fills those two fields ONLY from a committed `ExecutionStepSucceeded` (condition-grammar.ts:191-198). At decision time this completion's event does not exist yet, so `RESULT_EQUALS` resolves against `undefined` (:128 → `undefined === expr.value` → false) and `OUTPUT_COUNT` compares 0 (:124). The in-code comment at execution.ts:764-766 ("ask the plan as if this step had already succeeded") states the intent the projection only half-implements — it forwards the state but not the result the step just produced.

## Severity

BLOCKER stands. It is silent (the command is ACCEPTED, no reject, no warning), it is the canonical BRANCH use case (branch on what the step just returned — the only reason `structuredResult` is carried on the completion payload at all, per the contract-drift note at execution.ts:~700), and DWP-09 makes the wrong answer irreversible: the losing arm is permanently unstartable ("every in-edge is neutralized") while the plan proceeds down the arm the result contradicts. It is narrower than "all branching is broken" — earlier-step references and STEP_STATE/STEP_SUCCEEDED/ATTEMPTS all work — but the broken case is the one an author is most likely to write.

## The kill test to add

In `packages/rph-application/src/handlers/execution-start-gate.test.ts`, DWP-09 describe (~line 913): propose s1=BRANCH with `cedge(1, 2, {op:'RESULT_EQUALS', stepId: stepId(1), path:'outcome', value:'PASS'})` + `gedge(1, 3)` default; start(1); complete(1) with `structuredResult:{outcome:'PASS'}`; assert `stepOf(1)?.selectedTransitionId` toBe `${PLAN}-t1-2`. It yields `${PLAN}-t1-3` today. Add the OUTPUT_COUNT twin (with a preceding RecordArtifact) and keep PROBE E's earlier-step case as the non-regression anchor.

</details>

**Live check needed.** None — settled. Live probe already executed against the real Engine + SqliteStorageAdapter command bus (packages/rph-application, `bunx vitest run`, 2026-07-24); PROBE A and PROBE C both reproduced the defect, PROBE B/D/E passed as controls. The probe file was deleted and no source file was modified.


## F-03 · [CONFIRMED] [BLOCKER] A plan-entry edge (sourceStepId omitted) empties liveStepIds, so the entire graph after the entry step is declared unreachable — the plan prunes itself and reports COMPLETED having executed one step

- **Lens:** `branch`
- **Site:** `packages/rph-domain/src/transition-gate.ts:139 (frontier seeding) vs :76-77 (inEdgesOf) and :483-488 (buildAdjacency) / :467-471 (checkDanglingIds)`

**Claim.** `liveStepIds` seeds its BFS frontier with `plan.steps.filter(s => inEdgesOf(plan, s.id).length === 0)` (transition-gate.ts:139), and `inEdgesOf` matches purely on `targetStepId` (:76-77) — so it counts a SOURCE-LESS plan-entry edge as an in-edge. Propose-time validation disagrees: `buildAdjacency` (:483-488) increments in-degree only for edges with BOTH endpoints, so the same step has in-degree 0 there and the 'exactly one entry' limb passes. `checkDanglingIds` (:467-471) explicitly blesses the shape ('A missing SOURCE is legitimate: that is a plan-entry edge'), `inEdgeDisposition` :209 handles it, and rph-projections/execution-view.test.ts:570 has a fixture for it. Result: for any plan carrying a plan-entry edge, the BFS frontier is EMPTY, `live` is the empty set, and every step is simultaneously (a) NEUTRALIZED at each in-edge (:217) and (b) offered by `prunableStepIds` (:323-334).

**Failure scenario.** VERIFIED through the live command bus (same probe run). Plan: steps s1,s2 both QUEUED; transitions [ {id:'t0', targetStepId:'s1', SEQUENTIAL} (no sourceStepId — legal: ExecutionTransitionSchema makes sourceStepId optional, rph-contracts/src/objects.ts:246), {id:'t1-2', s1→s2, SEQUENTIAL} ]. ProposeExecutionPlan → ACCEPTED. Activate. StartExecutionStep(s1) → ACCEPTED (its only in-edge is the entry edge, always SATISFIED) — while `prunableStepIds` simultaneously offers BOTH s1 and s2 for prune, so the UI renders Prune on the step that is currently startable. CompleteExecutionStep(s1) → ACCEPTED. StartExecutionStep(s2) → REJECTED: 'every in-edge is neutralized — the step is unreachable (it should be pruned)'. PruneExecutionStep(s2) → ACCEPTED → SKIPPED. CompleteExecutionPlan → ACCEPTED. The plan is COMPLETED with s1 SUCCEEDED and every subsequent step silently pruned away as dead. With a BRANCH anywhere in the graph, the branch and both its arms are dead before it ever runs.

**Suggested fix.** Make liveStepIds' entry test agree with buildAdjacency's: seed the frontier with steps having no in-edge FROM A DECLARED SOURCE, e.g. `plan.steps.filter(s => inEdgesOf(plan, s.id).every(e => e.sourceStepId === undefined))`. Add the fixture above as a regression test, and consider having validateTransitionGraph count entry-edge targets as entries so the two planes are pinned together.

<details><summary>Code-semantics verifier evidence</summary>

I attempted to refute this on four fronts (contract rejects the shape / propose rejects it / an earlier precheck catches it / a later re-validation catches it). All four failed. The two planes genuinely disagree.

1. THE SHAPE IS CONTRACT-LEGAL AND EXPLICITLY BLESSED.
- `packages/rph-contracts/src/objects.ts:247` — `sourceStepId: z.string().optional(),` inside `ExecutionTransitionSchema`. Both endpoints optional.
- `transition-gate.ts:468-471` (checkDanglingIds) rejects only a missing TARGET, and the comment on :467 says verbatim: `// A missing SOURCE is legitimate: that is a plan-entry edge.`
- `transition-gate.ts:209` — `if (edge.sourceStepId === undefined) return 'SATISFIED'; // a plan-entry edge is always satisfied`
- `rph-projections/src/execution-view.ts:352-353` renders it (`sourceLabel: labelOf(edge.sourceStepId, '(plan entry)')`), with a green test at `execution-view.test.ts:570` and a domain test at `transition-gate.test.ts:245`. This is a SUPPORTED shape, not a malformed one.

2. THE TWO PLANES DISAGREE — the exact mismatch alleged.
- `transition-gate.ts:139` — `const frontier = plan.steps.filter((s) => inEdgesOf(plan, s.id).length === 0).map((s) => s.id);`
- `transition-gate.ts:76-77` — `inEdgesOf = (plan, stepId) => (plan.transitions ?? []).filter((t) => t.targetStepId === stepId);` — no source test, so the entry edge COUNTS as an in-edge.
- `transition-gate.ts:483-488` (buildAdjacency) — `if (t.sourceStepId !== undefined && t.targetStepId !== undefined) { inCount.set(...) }` — the entry edge does NOT count, so `entries` at :578 is `['s1']` and the exactly-one-entry limb at :579 passes.
So validation sees one entry; the BFS sees none.

3. NO LATER GUARD SAVES IT. `validateTransitionGraph` has exactly one non-test call site — `rejectMalformedTransitionGraph` at execution.ts:129/133, reached only from ProposeExecutionPlan (execution.ts:250). Activate does not re-validate. `pruneExecutionStep` (execution.ts:1028-1070) authorises purely from `prunableStepIds(gatePlan, ...)` at :1057, and its plan-ACTIVE precheck at :1049 passes, so nothing fires ahead of the bad set.

4. EXECUTED PROBE (pure layer, packages/rph-domain, `bun run vitest`), plan = steps s1,s2 + transitions [{id:'t0', targetStepId:'s1'}, {id:'t1', s1→s2}]:
  validate:            { ok: true }        ← propose ACCEPTS
  startable (both QUEUED): ["s1"]
  prunable  (both QUEUED): ["s1","s2"]    ← s1 is SIMULTANEOUSLY startable and prunable
  after s1 SUCCEEDED — startable: []       ← the plan has no legal next move
  after s1 SUCCEEDED — prunable:  ["s2"]
  startStepGate(s2): { ok:false, reason:"every in-edge is neutralized — the step is unreachable (it should be pruned)" }
  CONTROL (same graph, entry edge removed): startable ["s1"], prunable [] — correct. The entry edge is the sole cause.

5. THE DOWNSTREAM DAMAGE IS WORSE THAN "a stuck plan":
- `prunableStepIds` offering s1 while it is QUEUED and on the TAKEN path means PruneExecutionStep will drive a MANDATORY taken-path step to terminal-success SKIPPED with NO waiver — precisely the §21.1 back door the DWP-07 hardening comment at execution.ts:1018-1022 claims to have closed ("the prunability check below closes that back door"). The check is now the thing that opens it.
- With s1 SUCCEEDED and s2 pruned, CompleteExecutionPlan passes both limbs (execution.ts:490 every step SUCCEEDED/SKIPPED; :496 ≥1 SUCCEEDED), so the plan reports COMPLETED having executed one step. Silent wrong terminal state, not a visible deadlock.
- Any BRANCH in such a graph is dead before it runs (the branch and both arms are outside `live`), so DWP-03/08/09 semantics are void for the whole plan.

Latency note (does not change the verdict): no shipped seed authors an entry edge — `apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts:137` only passes through what the aggregate already holds — so nothing in the demo triggers it today. It is reachable through the public ProposeExecutionPlan contract by any author, and it is fail-OPEN (a bad interpretation is accepted, not refused), which is the defect class this surface has already regressed twice.

Suggested fix is sound and I verified its direction: seeding with `plan.steps.filter((s) => inEdgesOf(plan, s.id).every((e) => e.sourceStepId === undefined))` makes :139 agree with :484. It should ship WITH the pinning test above (validate.ok true + startable ['s1'] + prunable [] + s2 startable once s1 SUCCEEDED) — otherwise the anti-vacuity rule (B7) is violated again, since today no test covers a plan carrying an entry edge THROUGH the gate. Probe file was written and deleted; no repo changes remain.

</details>

<details><summary>Test-evidence verifier evidence</summary>

TEST-EVIDENCE LENS — settled independently, both at the pure layer and end-to-end through the real engine. Both probe files were deleted after observation; no source file was modified.

1) COVERAGE GAP (no existing test proves the behaviour works). Exhaustive grep for a transition literal with `targetStepId` and no `sourceStepId` across the whole monorepo returns exactly THREE non-probe sites:
   - packages/rph-domain/src/transition-gate.test.ts:245 — `it('SATISFIED for a plan-entry edge (no source)', () => expect(inEdgeDisposition(p, { targetStepId: 'x' })).toBe('SATISFIED'))`. This unit-tests the very function that makes the shape LOOK satisfiable; it never touches liveStepIds/prunableStepIds/startableStepIds.
   - packages/rph-projections/src/execution-view.test.ts:570-576 — a ONE-step plan with an entry edge, asserting only `transitionRows` labels ('(plan entry)' / disposition SATISFIED). A one-step plan hides the defect (there is no downstream to kill), and prunable/startable are never asserted for it.
   - packages/rph-contracts/vocab/m1-object-fields.json:2345 — vocab prose only ("absent = a plan-entry edge").
   No fixture, unit test, or e2e spec anywhere exercises a MULTI-step plan carrying an entry edge. apps/rph-demo/e2e/execution-flow.e2e.ts:54-57 builds every edge with both endpoints, so no e2e touches it either. So the guard-quality question ("does a test pin this?") answers NO, and the anti-vacuity/B7 standard is unmet for the entry-edge shape.

2) PURE-LAYER PROBE (packages/rph-domain, `bunx vitest run` — 4 tests, ALL PASSED, i.e. every claimed pathological value is exactly what the code produces). Plan: s1,s2,s3 all QUEUED; transitions [t0 → s1 (no sourceStepId), t1 s1→s2, t2 s2→s3]:
   - `validateTransitionGraph(steps, transitions)` === `{ ok: true }`  (propose-time accepts it — buildAdjacency:483-488 ignores the source-less edge, so entries = ['s1'])
   - `startableStepIds(p)` === `['s1']`
   - `prunableStepIds(p)` === `['s1','s2','s3']`  ← s1 is SIMULTANEOUSLY startable and prunable: the read-model/authority contradiction the module exists to prevent
   - after s1 SUCCEEDED: `startableStepIds` === `[]`; `inEdgeDisposition(t1 into s2)` === `'NEUTRALIZED'`; `startStepGate(q,'s2')` === `{ ok:false, reason:'every in-edge is neutralized — the step is unreachable (it should be pruned)' }`; `prunableStepIds` === `['s2','s3']`
   - CONTROL (byte-identical graph with the entry edge deleted) behaves CORRECTLY: startable ['s1'] → after s1 SUCCEEDED startable ['s2'], gate(s2) `{ok:true}`, prunable [] throughout. The entry edge is the sole differentiator, which isolates the cause to the liveStepIds frontier seed (transition-gate.ts:139 `inEdgesOf(...).length === 0` vs inEdgesOf at :76-77 matching on targetStepId alone).

3) END-TO-END PROBE THROUGH THE COMMAND BUS (packages/rph-application, SqliteStorageAdapter + Engine, same harness idiom as execution-start-gate.test.ts — 1 test, PASSED, every assertion below is an assertion that held):
   ProposeExecutionPlan (3 TRANSFORMATION steps + the entry-edge graph) → ACCEPTED; ApproveExecutionPlan → ACCEPTED; ActivateExecutionPlan → ACCEPTED. On the persisted plan state: startableStepIds = [s1] while prunableStepIds = [s1,s2,s3]. StartExecutionStep(s1) → ACCEPTED; CompleteExecutionStep(s1) → ACCEPTED (s1 SUCCEEDED). StartExecutionStep(s2) → REJECTED, message contains 'unreachable'. PruneExecutionStep(s2) → ACCEPTED, PruneExecutionStep(s3) → ACCEPTED (both SKIPPED). CompleteExecutionPlan → ACCEPTED, plan.status === 'COMPLETED'. The plan reports SUCCESS having executed 1 of 3 steps, with the other two silently pruned as dead — no error surfaced anywhere.

4) REACHABILITY. The shape is contract-legal and explicitly blessed, not an accident: `ExecutionTransitionSchema` at packages/rph-contracts/src/objects.ts:247 makes `sourceStepId` optional, and ProposeExecutionPlanPayloadSchema (messages.ts:132-141) takes that schema verbatim; proposeExecutionPlan (packages/rph-application/src/handlers/execution.ts:250-255) adds only graph/duplicate-id/condition checks, none of which rejects it; transition-gate.ts:467 states "A missing SOURCE is legitimate: that is a plan-entry edge"; execution-view.ts:352-353 renders it as '(plan entry)'.

5) SEVERITY CORRECTED BLOCKER → MAJOR. The defect is real and its outcome is worse than a deadlock (a falsely COMPLETED plan, silently), but nothing currently in the repo emits the shape: no seed, no demo authoring path, and no e2e fixture creates a source-less edge, so no shipped plan is broken today. It fires for the first plan an API client authors with a plan-entry edge — a shape the contract and three code sites advertise as supported. (Adjacent, supporting: apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts:137 uses a TRUTHY test `...(t.sourceStepId ? {sourceStepId:...} : {})`, so a stored empty-string source is silently reshaped into an entry edge in the UI plane only — widening the trigger and letting the UI's live set diverge from the engine's.)

6) HOUSEKEEPING. Stray probe test files from other verifier lenses are sitting untracked in the source tree and should be removed before commit: packages/rph-application/src/handlers/zzte-emptyoperands.probe.test.ts, packages/rph-application/src/handlers/zztestevidence-cancelled-downstream.test.ts, packages/rph-application/src/handlers/zzv-verifier-emptyall.test.ts, packages/rph-domain/src/zztestevidence-cancelled.test.ts. (Mine — zzverify-entryedge-probe.test.ts and zzverify-entryedge-e2e.test.ts — are deleted; `git status` confirms.)

</details>

**Live check needed.** None — already executed. Both probes were run live (`bunx vitest run` in packages/rph-domain and packages/rph-application) and passed with the claimed values; the regression test to land alongside the fix is exactly the pure-layer fixture in item 2 (assert startableStepIds/prunableStepIds are disjoint for a multi-step entry-edge plan, plus the control), which will go RED on today's transition-gate.ts:139 and GREEN once the frontier seed is changed to `inEdgesOf(plan, s.id).every(e => e.sourceStepId === undefined)`.


## F-04 · [CONFIRMED] [BLOCKER] A plan-entry edge (no sourceStepId) collapses liveStepIds to EMPTY: the fan-out never fires, every step becomes waiver-free prunable, and the plan reaches COMPLETED having run one step

- **Lens:** `parallel-join`
- **Site:** `packages/rph-domain/src/transition-gate.ts:139 (liveStepIds BFS seed) vs :483-484 (buildAdjacency entry rule); packages/rph-contracts/src/objects.ts:245 (sourceStepId optional)`

**Claim.** `liveStepIds` seeds its BFS with `plan.steps.filter(s => inEdgesOf(plan, s.id).length === 0)` (:139), and `inEdgesOf` (:76-77) filters ONLY on `targetStepId === stepId` — so a SOURCE-LESS plan-entry edge counts as an in-edge. `validateTransitionGraph`'s entry rule uses `buildAdjacency`, which counts an edge only `if (t.sourceStepId !== undefined && t.targetStepId !== undefined)` (:483-484), so the SAME edge does NOT count. The two planes disagree about what an entry is — the exact defect class DWP-07 already fixed once for BRANCH/stepType. A plan-entry edge is contract-legal (`ExecutionTransitionSchema.sourceStepId: z.string().optional()`) and propose-time validation EXPLICITLY blesses it (transition-gate.ts:467-468: "A missing SOURCE is legitimate: that is a plan-entry edge"). When one is present, EVERY step has ≥1 in-edge, the BFS frontier is `[]`, and `liveStepIds` returns the EMPTY SET. Consequences: (a) `inEdgeDisposition` :217 `!liveStepIds().has(source.id)` fires for every real edge once its source is terminal → NEUTRALIZED → no step downstream of the entry can ever start; (b) `prunableStepIds` :329 `!live.has(s.id)` is true for every step → the whole plan is offered for prune, and `pruneExecutionStep`'s precheck IS that set (handlers/execution.ts:1056-1060), so every MANDATORY step on the taken path can be driven to terminal-success SKIPPED with NO waiver — precisely the back door the DWP-07 hardening comment (handlers/execution.ts:1019-1022) claims to have closed. The entry step itself still starts (`inEdgeDisposition` :209 returns SATISFIED for a source-less edge before any liveness test), which masks the collapse until the first fan-out.

**Failure scenario.** VERIFIED END-TO-END through the live engine. Propose steps s1(PARALLEL_GROUP)/s2/s3/s4 all QUEUED with transitions [ {id:'t0', targetStepId:'s1', transitionType:'SEQUENTIAL'}, s1->s2, s1->s3, s2->s4, s3->s4 ]. ProposeExecutionPlan ACCEPTED (validateTransitionGraph sees entries=['s1'], exactly one). Approve, Activate. Start(s1) ACCEPTED, Complete(s1) ACCEPTED. Then Start(s2) is REJECTED: 'Cannot start step ...-s2: every in-edge is neutralized — the step is unreachable (it should be pruned)'. The entire parallel fan-out is dead on arrival. Prune(s2), Prune(s3), Prune(s4) are ALL ACCEPTED with no waiverOrRevisionId and no BRANCH anywhere in the plan. Final step states ['SUCCEEDED','SKIPPED','SKIPPED','SKIPPED'] and CompleteExecutionPlan returns ACCEPTED — the plan reports COMPLETED having executed 1 of its 4 steps, with §21.1's mandatory-skip waiver rule entirely bypassed.

**Suggested fix.** Make the two planes agree on one definition. Either (a) seed liveStepIds from steps whose in-edges are all source-less or absent — e.g. `plan.steps.filter(s => inEdgesOf(plan,s.id).every(e => e.sourceStepId === undefined))` — or (b) reject source-less transitions at propose in checkDanglingIds alongside the half-edge rule, since the contract's optional sourceStepId is otherwise unusable. Add a domain test asserting a plan CONTAINING a plan-entry edge yields a non-empty liveStepIds and an empty prunableStepIds.

<details><summary>Code-semantics verifier evidence</summary>

I tried hard to refute this and could not — it reproduces end-to-end through the live engine, and the control case isolates the plan-entry edge as the sole cause.

CODE PROOF (the two disagreeing definitions of "in-degree 0"):
- `packages/rph-domain/src/transition-gate.ts:76-77` — `const inEdgesOf = (plan, stepId) => (plan.transitions ?? []).filter((t) => t.targetStepId === stepId);` — filters on TARGET only, so a source-less edge counts as an in-edge.
- `:139` (raw bytes verified via `sed | cat -v`, no hidden control chars) — `const frontier = plan.steps.filter((s) => inEdgesOf(plan, s.id).length === 0).map((s) => s.id);` — the BFS seed.
- `:483-484` (raw bytes verified) — `for (const t of transitions) { if (t.sourceStepId !== undefined && t.targetStepId !== undefined) { inCount.set(...) ... } }` — propose-time in-degree counts REAL edges only, so the same edge does NOT count there.
- `:468-471` `checkDanglingIds` rejects only a missing TARGET; the comment at :467 states "A missing SOURCE is legitimate: that is a plan-entry edge." `ExecutionTransitionSchema` (`packages/rph-contracts/src/objects.ts:245-252`) has `sourceStepId: z.string().optional()`, and the projection `packages/rph-projections/src/execution-view.ts:353` renders `sourceLabel: labelOf(edge.sourceStepId, '(plan entry)')` — the shape is first-class in the contract, in propose validation, and in the read-model.
- Consequences follow mechanically: `:217` `if (!liveStepIds(plan, evaluateGuard).has(source.id)) return 'NEUTRALIZED';` and `:329` `!live.has(s.id)` in `prunableStepIds`, whose result IS the prune authority (`packages/rph-application/src/handlers/execution.ts:1055-1070`, `if (!prunableStepIds(gatePlan, ...).includes(p.stepId)) return reject(...)`). `inEdgeDisposition :209 if (edge.sourceStepId === undefined) return 'SATISFIED';` fires before any liveness test, which is why the ENTRY step still starts and masks the collapse.

LIVE ENGINE PROBE (written at packages/rph-application/src/handlers/zz-verify-entry-edge.test.ts, run with `node ../../node_modules/vitest/vitest.mjs run ...`, then deleted). Four TRANSFORMATION steps all QUEUED; transitions [entry->s1 (no sourceStepId), s1->s2, s1->s3, s2->s4, s3->s4]. All commands through `Engine.dispatch` on a real SqliteStorageAdapter:
  PROBE (entry edge present): Propose ACCEPTED, Approve/Activate ACCEPTED, Start(s1) ACCEPTED, Complete(s1) ACCEPTED.
    Start(s2): REJECTED — "Cannot start step ...-s2: every in-edge is neutralized — the step is unreachable (it should be pruned) (RPH-EXE-005)."  → the entire fan-out is dead on arrival.
    Prune(s2), Prune(s3), Prune(s4): ACCEPTED ACCEPTED ACCEPTED, with NO waiverOrRevisionId and NO BRANCH anywhere in the plan.
    Final states ["SUCCEEDED","SKIPPED","SKIPPED","SKIPPED"]; CompleteExecutionPlan ACCEPTED, plan.status === "COMPLETED" — a plan reported COMPLETED having executed 1 of 4 steps.
  CONTROL (identical plan, entry edge removed): Start(s2) ACCEPTED; Prune(s3) REJECTED — "it is still reachable ... A prune is NOT a waiver". So the entry edge alone flips both behaviours.
  WAIVER-BYPASS CONTROL: on the control plan, `SkipExecutionStep {stepId: s3}` with no waiver is REJECTED — "skipping a mandatory step requires an authorized plan revision or waiver (§21.1)". So the prune path in the PROBE genuinely bypasses the §21.1 mandatory-skip rule that Skip enforces (mandatory defaults fail-closed to TRUE) — exactly the back door the DWP-07 hardening comment at handlers/execution.ts:1019-1022 claims to have closed.

REFUTATION ATTEMPTS THAT FAILED:
- No earlier guard intercepts: `validateTransitionGraph` passes (entries=['s1'], one entry; reachability/DAG/BRANCH-default all clean because `buildAdjacency` ignores the source-less edge). Propose-time `rejectMalformedTransitionGraph` (handlers/execution.ts:120-140) is the only graph validation on the write path.
- `toGatePlan` (handlers/execution.ts:66-92) faithfully carries `sourceStepId: undefined` through, so the authority sees exactly the shape validated at propose.
- The linear degenerate (`transitions.length === 0` → all steps live, :137) does not apply.
- Not a string/delimiter/parsing finding; I still ran `cat -v` over :135-145 and :481-489 — no invisible control characters, the code reads as printed.
- Test coverage really is absent: the ONLY source-less-edge test in the repo is `packages/rph-domain/src/transition-gate.test.ts:245`, `it('SATISFIED for a plan-entry edge (no source)', () => expect(inEdgeDisposition(p, { targetStepId: 'x' })).toBe('SATISFIED'))` — a direct unit call that BLESSES the shape while never putting one into a plan-level `liveStepIds`/`prunableStepIds`/`startStepGate` computation.

SEVERITY CORRECTION (BLOCKER -> MAJOR): the consequences are as stated (deadlock + §21.1 waiver bypass + false COMPLETED), but no shipped producer emits a source-less edge today — the only in-repo `ProposeExecutionPlan` caller in apps/rph-demo (`src/routes/undertakings/[id]/+page.server.ts:512`) proposes `transitions: []`, and all four e2e specs author explicit source/target edges. It is a latent trap on a contract-legal, explicitly-documented shape reachable through the public governed command surface, which puts it in the same class as the two MAJOR anti-vacuity gaps already fixed on this surface, not in the ships-broken-on-the-normal-path class.

FIX NOTE: the suggested fix (a) — seeding from `inEdgesOf(...).every(e => e.sourceStepId === undefined)` — is the correct one and is strictly better than (b), because it preserves the plan-entry-edge semantics that `inEdgeDisposition:209`, `checkDanglingIds:467`, and `execution-view.ts:353` all already implement. Whichever is chosen, the two planes must be made to share ONE definition of "entry", and the new domain test must assert non-empty `liveStepIds` and empty `prunableStepIds` for a plan CONTAINING an entry edge.

INCIDENTAL (not part of this finding, flagged for the orchestrator): while reading I observed sibling verifier agents mutating the shared working tree — at one point `packages/rph-application/src/handlers/execution.ts` contained `requireFrom: ['READY','QUEUED','RUNNING','WAITING','CANCELLED'], // MUTANT (temporary)` in `cancelExecutionStep`, and `packages/rph-domain/src_mutant/` plus several `zz-probe-*.test.ts` files exist untracked. That mutant was reverted before I finished and never touched my probe's code path (my scenario issues no Cancel), but the tree should be verified clean before the final commit.

</details>

<details><summary>Test-evidence verifier evidence</summary>

CONFIRMED by live engine execution, with a control, and by a verified coverage gap. I ran a temporary probe (`packages/rph-application/src/handlers/zz-probe-entry-edge.test.ts`, since DELETED) through the real Engine + SqliteStorageAdapter via `node ../../node_modules/vitest/vitest.mjs run ... --disable-console-intercept`.

=== A. THE DEFECT REPRODUCES END-TO-END (exact console output) ===
Plan: s1(PARALLEL_GROUP)/s2/s3/s4 all QUEUED; transitions = [ {id:'...-t0', targetStepId:'s1', transitionType:'SEQUENTIAL'} (NO sourceStepId), s1->s2, s1->s3, s2->s4, s3->s4 ].

  PROPOSE: ACCEPTED {}            <- validateTransitionGraph blesses the source-less entry edge
  APPROVE: ACCEPTED
  ACTIVATE: ACCEPTED
  start s1: ACCEPTED
  complete s1: ACCEPTED
  start s2: REJECTED {"code":"RPH_ILLEGAL_STATE_TRANSITION","message":"Cannot start step ...-s2: every in-edge is neutralized - the step is unreachable (it should be pruned) (RPH-EXE-005)."}
  prune s2: ACCEPTED
  prune s3: ACCEPTED
  prune s4: ACCEPTED
  states: ["SUCCEEDED","SKIPPED","SKIPPED","SKIPPED"]
  CompleteExecutionPlan: ACCEPTED {}
  plan status: COMPLETED

The parallel fan-out is dead on arrival, and every MANDATORY step on the taken path is driven to terminal-success SKIPPED with NO waiverOrRevisionId and NO BRANCH anywhere in the plan - the exact back door the DWP-07 hardening comment (packages/rph-application/src/handlers/execution.ts:1014-1027) claims to have closed. The plan reports COMPLETED having executed 1 of 4 steps; §21.1's mandatory-skip waiver rule is fully bypassed.

=== B. CONTROL: the SAME plan minus the entry edge behaves correctly ===
  CTRL PROPOSE: ACCEPTED / CTRL start s1: ACCEPTED / CTRL complete s1: ACCEPTED
  CTRL start s2: ACCEPTED {}
  CTRL prune s2: REJECTED {"code":"RPH_INVARIANT_VIOLATION","message":"Cannot prune step ...-s2: it is still reachable ... A prune is NOT a waiver ... (§21.1)."}
The ONLY delta between the two runs is the presence of one source-less transition. That isolates the cause to `liveStepIds`' BFS seed, exactly as the finding argues.

=== C. WORSE THAN CLAIMED: the ENTRY step itself is waiver-free prunable ===
Two-step plan [entryEdge->s1, s1->s2], freshly ACTIVE, nothing started:
  2STEP prune s1 (the ENTRY step, QUEUED): ACCEPTED {}
  2STEP states: ["SKIPPED","QUEUED"]
The plan's own entry point - a mandatory, never-run step - is skipped with no waiver on the first command after activation. `prunableStepIds` (transition-gate.ts:329) offers it because `live` is EMPTY, and the handler precheck (execution.ts:1056-1060) IS that set.

=== D. NO EXISTING TEST DISPROVES IT - the coverage gap is real ===
Repo-wide grep for source-less edges yields exactly TWO tests, and NEITHER exercises liveness:
1. packages/rph-domain/src/transition-gate.test.ts:245 - `inEdgeDisposition(p, { targetStepId: 'x' })` passes the edge as a LOOSE ARGUMENT; it is not in `p.transitions`, so `liveStepIds` is never consulted for it.
2. packages/rph-projections/src/execution-view.test.ts:570-576 - the only test that puts a source-less edge INTO a plan. It asserts `sourceLabel === '(plan entry)'` and `disposition === 'SATISFIED'`. That passes today only because `inEdgeDisposition` short-circuits at transition-gate.ts:209 BEFORE the liveness test at :217. It asserts nothing about `liveStepIds`/`startableStepIds`/`prunableStepIds`, so it is blind to the collapse - it is the masking test, not a refutation.
No test in transition-gate.test.ts (13 `prunableStepIds` assertions, all at lines 134/144/204-232/353/361/414/439) or execution-view.test.ts (399-452) constructs a plan CONTAINING an entry edge. Both existing suites are fully green today (execution-start-gate.test.ts 42/42 passed; transition-gate.test.ts 49/49 passed), so the defect ships under a green suite.

=== E. CODE SITES VERIFIED BY READ (independent of the probe) ===
- transition-gate.ts:76-77 `inEdgesOf` filters ONLY on `targetStepId === stepId` -> a source-less edge counts as an in-edge.
- transition-gate.ts:139 BFS seed `plan.steps.filter(s => inEdgesOf(plan, s.id).length === 0)` -> frontier `[]` -> live = EMPTY SET.
- transition-gate.ts:483-484 `buildAdjacency` counts an edge only `if (t.sourceStepId !== undefined && t.targetStepId !== undefined)` -> the SAME edge does NOT count, so `entries === ['s1']` and propose passes. Two planes, two definitions of in-degree-0 - the identical two-planes-disagree defect class DWP-07 already fixed twice here (half-edge, BRANCH/stepType), recurring a third time.
- transition-gate.ts:467-468 comment "A missing SOURCE is legitimate: that is a plan-entry edge" - propose EXPLICITLY blesses the shape.
- packages/rph-contracts/src/objects.ts:244-251 `ExecutionTransitionSchema.sourceStepId: z.string().optional()` - contract-legal (finding cited :245; the field is at :247, immaterial drift).
This is a supported, contract-legal, propose-blessed, projection-rendered shape - not a fabricated input.

Severity BLOCKER stands (arguably understated): a single contract-legal edge silently converts every mandatory step in the plan into a waiver-free skip and lets the plan claim COMPLETED, violating both the §21.1 waiver rule and the terminal-success guarantee.

</details>

**Live check needed.** None - settled live. Reproduction recipe for the permanent regression test (write in packages/rph-application/src/handlers/, run with `node ../../node_modules/vitest/vitest.mjs run <file>`): propose the s1(PARALLEL_GROUP)->{s2,s3}->s4 plan WITH a `{id, executionPlanId, targetStepId: s1, transitionType:'SEQUENTIAL'}` entry edge; assert Start(s2).status === 'ACCEPTED' and Prune(s2).status === 'REJECTED'; both fail today and pass in the control plan without the entry edge. Add the domain-level twin in transition-gate.test.ts asserting `liveStepIds`/`prunableStepIds` for a plan CONTAINING an entry edge (non-empty live, empty prunable) - that is the anti-vacuity kill test the surface lacks. Fix options as stated in the finding: seed the BFS from steps whose in-edges are all source-less (`inEdgesOf(plan,s.id).every(e => e.sourceStepId === undefined)`), or reject source-less transitions in checkDanglingIds alongside the half-edge rule.


## F-05 · [CONFIRMED] [BLOCKER] A plan-entry edge (source-less transition) collapses liveStepIds to EMPTY — Prune becomes a universal waiver bypass and the plan reports COMPLETED having run one step

- **Lens:** `deadness-prune`
- **Site:** `packages/rph-domain/src/transition-gate.ts:139 (liveStepIds frontier seed); accepted by validateTransitionGraph via transition-gate.ts:467-471 + :484; contract allows it at packages/rph-contracts/src/objects.ts:247`

**Claim.** liveStepIds seeds its BFS frontier with `plan.steps.filter((s) => inEdgesOf(plan, s.id).length === 0)`. inEdgesOf (:76) counts EVERY edge whose targetStepId matches — including a plan-entry edge that has no sourceStepId. Propose-time validation counts in-degree with buildAdjacency (:483-488), which SKIPS any edge lacking a source, and checkDanglingIds (:467-471) explicitly blesses a missing source as 'legitimate: that is a plan-entry edge'. The two planes therefore disagree: the step the validator calls the sole entry is NOT a frontier seed at runtime, the BFS starts from an empty frontier, and live = {} — every step of a completely ordinary, fully-reachable chain is classified structurally dead. prunableStepIds (:329) then returns EVERY non-terminal step, and pruneExecutionStep's only authorization is membership in that set (handlers/execution.ts:1056-1067), so Prune drives MANDATORY steps on the TAKEN path to SKIPPED with no waiver — verbatim the back door the DWP-07 hardening comment at handlers/execution.ts:1018-1022 claims it closed. The demo UI renders the Prune button straight from this set (apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts:157 -> +page.svelte:363) with the tooltip 'Not reachable — the branch went the other way', although the plan has no BRANCH at all.

**Failure scenario.** CONFIRMED by execution against the live command bus (Engine + SqliteStorageAdapter). Propose a 3-step chain s1->s2->s3 authored with an explicit plan-entry edge {id:'t-entry', executionPlanId, targetStepId: s1, transitionType:'SEQUENTIAL'} plus s1->s2 and s2->s3; approve; activate. Observed: ProposeExecutionPlan ACCEPTED (validateTransitionGraph returns {ok:true}). SkipExecutionStep(s2) with no waiver -> REJECTED RPH_INVARIANT_VIOLATION (correct, mandatory defaults true). PruneExecutionStep(s2) -> ACCEPTED, stepState SKIPPED. PruneExecutionStep(s3) -> ACCEPTED, SKIPPED. Start+Complete s1, then CompleteExecutionPlan -> ACCEPTED. The governed record now says the plan COMPLETED while 2 of its 3 mandatory steps were waived away by a command that performs no waiver check. Separately (second confirmed run): with the same entry edge on a 2-step plan, after s1 SUCCEEDS, StartExecutionStep(s2) is REJECTED with 'every in-edge is neutralized — the step is unreachable (it should be pruned)' — because inEdgeDisposition(:217) finds source s1 outside the empty live set. So the same defect is simultaneously a deadlock: the remainder of the plan can only be pruned away, never executed.

**Suggested fix.** Seed the frontier on SOURCED in-edges only, so the runtime entry set matches buildAdjacency's in-degree and inEdgeDisposition:209's 'a plan-entry edge is always satisfied': `plan.steps.filter((s) => inEdgesOf(plan, s.id).every((e) => e.sourceStepId === undefined))`. Add a rejection test for the shape at propose-time if plan-entry edges are NOT actually wanted (then delete the :467-471 carve-out and reject a source-less edge outright) — but pick one story; today the validator blesses a shape the gate cannot read.

<details><summary>Code-semantics verifier evidence</summary>

I tried hard to refute this and could not. Every limb of the chain is real code, and I reproduced the full failure through the live Engine + SqliteStorageAdapter (probe files since deleted).

1) THE PLANE DISAGREEMENT IS REAL.
`transition-gate.ts:76-77` — `inEdgesOf` counts EVERY edge by target, with no source test:
    const inEdgesOf = (plan, stepId) => (plan.transitions ?? []).filter((t) => t.targetStepId === stepId);
`transition-gate.ts:139` — the BFS frontier seed uses that count verbatim:
    const frontier = plan.steps.filter((s) => inEdgesOf(plan, s.id).length === 0).map((s) => s.id);
So a source-less plan-entry edge targeting s1 gives s1 in-degree 1 → s1 is NOT seeded → frontier is empty → `live = {}`.
Meanwhile propose-time in-degree comes from `buildAdjacency` (:483-488), which SKIPS source-less edges:
    if (t.sourceStepId !== undefined && t.targetStepId !== undefined) { inCount.set(...) ... }
and `checkDanglingIds` (:467) explicitly blesses the shape: "// A missing SOURCE is legitimate: that is a plan-entry edge." The two planes therefore genuinely disagree about who the entry is.

2) NO EARLIER GUARD CATCHES IT. `proposeExecutionPlan` (handlers/execution.ts:250-255) runs only rejectMalformedTransitionGraph → validateTransitionGraph (returns ok here), rejectDuplicateTransitionId, rejectMalformedTransitionCondition. Transitions are stored verbatim (:264 `transitions: p.transitions`) and `toGatePlan` (:85) preserves `sourceStepId: undefined`. The contract permits it (`ExecutionTransitionSchema`, rph-contracts/src/objects.ts:247 `sourceStepId: z.string().optional()`), and `ProposeExecutionPlanPayloadSchema` (messages.ts:136) uses that schema directly.

3) PRUNE'S ONLY AUTHORIZATION IS THE POISONED SET. handlers/execution.ts:1048-1069: precheck = plan-ACTIVE, then `if (!prunableStepIds(gatePlan, guardEvaluatorFor(...)).includes(p.stepId)) return reject(...)`. `advanceStep` (:598-655) adds only `requireFrom: ['NOT_READY','READY','QUEUED']` and `checkTransition` — and transitions.data.ts:1470-1472 ratifies NOT_READY→SKIPPED (and QUEUED→SKIPPED). Nothing else stands between the command and terminal-success SKIPPED. There is no canSkipStep call on this path by design (:1016-1017).

4) PURE-LAYER REPRODUCTION (rph-domain, vitest). Plan s1→s2→s3 plus {id:'t-entry', targetStepId:'s1', transitionType:'SEQUENTIAL'}:
 - validateTransitionGraph(...) === { ok: true }
 - states [QUEUED, NOT_READY, NOT_READY]: startableStepIds → ['s1'] AND prunableStepIds → ['s1','s2','s3'] — the SAME step is offered for Start and for Prune simultaneously.
 - states [SUCCEEDED, NOT_READY, NOT_READY]: startableStepIds → [], startStepGate(plan,'s2') → { ok:false, reason:'every in-edge is neutralized — the step is unreachable (it should be pruned)' }, prunableStepIds → ['s2','s3'].
 - CONTROL, identical plan with the entry edge removed: prunableStepIds → [] (correct). The entry edge is the sole differentiator.

5) HANDLER-LEVEL REPRODUCTION (rph-application, real Engine + SqliteStorageAdapter, 3-step chain + entry edge, seeded QUEUED, approved+activated):
 - ProposeExecutionPlan → ACCEPTED
 - SkipExecutionStep(s2), no waiver → REJECTED / RPH_INVARIANT_VIOLATION (fail-closed mandatory rule working)
 - PruneExecutionStep(s2) → ACCEPTED, stepState SKIPPED
 - PruneExecutionStep(s3) → ACCEPTED, stepState SKIPPED
 - Start(s1), Complete(s1) → ACCEPTED; CompleteExecutionPlan → ACCEPTED, plan status COMPLETED.
 The governed record says COMPLETED with 2 of 3 mandatory steps waived by a command that performs no waiver check — verbatim the back door the DWP-07 comment at handlers/execution.ts:1018-1022 claims it closed.
 - Deadlock variant (2-step + entry edge): after s1 SUCCEEDED, StartExecutionStep(s2) → REJECTED / RPH_ILLEGAL_STATE_TRANSITION "Cannot start step ...-s2: every in-edge is neutralized — the step is unreachable (it should be pruned) (RPH-EXE-005)." So the remainder can only be pruned away, never run.

6) THE SHAPE IS FIRST-CLASS, NOT EXOTIC. rph-projections/execution-view.ts:353 renders `labelOf(edge.sourceStepId, '(plan entry)')`, and execution-view.test.ts:570-576 is a dedicated passing test for a source-less entry edge asserting disposition SATISFIED. The codebase deliberately supports a shape the reachability gate cannot read.

Severity stands at BLOCKER: it is simultaneously (a) a mandatory-waiver bypass that falsifies the governed record, (b) a plan-completion integrity violation, and (c) a deadlock — all from one contract-legal, validator-blessed authoring shape. Two nuances worth carrying into the fix, neither of which weakens the finding: the reviewer's suggested predicate `inEdgesOf(...).every((e) => e.sourceStepId === undefined)` also correctly re-seeds a step whose only in-edges are entry edges, but note `startStepGate`/`stepAtFrontier` (:285, :385) still treat "zero in-edges" as entry via the unfiltered `inEdgesOf`, so those two sites keep working by a different route — the asymmetry between them and :139 is exactly the bug. Also `unreachableFrom` (:581) walks from the buildAdjacency entry, so propose-time reachability is computed from a different entry notion than runtime liveness; pick ONE story (seed on sourced in-edges, or reject source-less edges outright and delete the :467-471 carve-out plus the execution-view.ts:353 '(plan entry)' affordance and its test).

</details>

<details><summary>Test-evidence verifier evidence</summary>

CONFIRMED by execution at BOTH layers, with a clean single-variable control. No source file modified; both temporary probe files created (packages/rph-domain/src/zzlens-entryedge-probe.test.ts, packages/rph-application/src/handlers/zzlens-entryedge-probe.test.ts) were deleted afterwards (verified via git status — the remaining zz* files belong to other concurrent lenses).

A. PURE LAYER (rph-domain, probe run under `bunx vitest run`). Plan: steps s1,s2,s3 all QUEUED; transitions [{targetStepId:'s1',SEQUENTIAL} (plan-entry edge), s1->s2, s2->s3]; status ACTIVE.
  VALIDATE: {"ok":true}            <- validateTransitionGraph BLESSES the shape
  STARTABLE: ["s1"]
  PRUNABLE:  ["s1","s2","s3"]      <- the SAME step is offered for Start and for Prune at once
  CONTROL (identical chain, entry edge removed): VALIDATE {"ok":true}, STARTABLE ["s1"], PRUNABLE []
  AFTER s1 SUCCEEDED (entry-edge plan): STARTABLE [] , PRUNABLE ["s2","s3"]  <- the deadlock half
The single-edge delta flips PRUNABLE from [] to "every step", exactly as the finding predicts, and matches the code reading: liveStepIds seeds its frontier with `inEdgesOf(...).length === 0` (transition-gate.ts:139) which COUNTS the source-less edge, while buildAdjacency's in-degree (:483-488) SKIPS it and checkDanglingIds (:467-471) explicitly comments "A missing SOURCE is legitimate: that is a plan-entry edge". Frontier empty => live = {} => prunableStepIds (:329 `!live.has(s.id)`) returns everything non-terminal.

B. HANDLER / LIVE COMMAND BUS (rph-application, Engine + SqliteStorageAdapter, real ProposeExecutionPlan/Approve/Activate). 3-step mandatory chain authored WITH the plan-entry edge:
  skip(s2):        REJECTED/RPH_INVARIANT_VIOLATION   <- correct: mandatory defaults true, no waiver
  prune(s2):       ACCEPTED                            <- SAME step, no waiver, no waiver check
  prune(s3):       ACCEPTED
  start(s1)+complete(s1): ACCEPTED
  CompleteExecutionPlan:  ACCEPTED -> planStatus "COMPLETED", states ["SUCCEEDED","SKIPPED","SKIPPED"]
  CONTROL (identical plan, entry edge removed): skip REJECTED/RPH_INVARIANT_VIOLATION **and** prune REJECTED/RPH_INVARIANT_VIOLATION, states untouched ["QUEUED","QUEUED","QUEUED"].
So the governed record reports a plan COMPLETED having actually run 1 of 3 mandatory steps, the other 2 waived by a command whose only authorization is prunableStepIds membership (handlers/execution.ts pruneExecutionStep precheck) — verbatim the back door the DWP-07 hardening comment above that handler claims it closed ("the sole precheck was plan-ACTIVE, so ANY QUEUED/READY step could be driven to terminal-success SKIPPED with no waiver"). Fail-OPEN, and INV-independent: it is a governance-integrity breach, not a cosmetic one.

C. DEADLOCK half, also live: 2-step chain with the entry edge, after s1 SUCCEEDS ->
  start(s2): REJECTED/RPH_ILLEGAL_STATE_TRANSITION "Cannot start step ...-s2: every in-edge is neutralized — the step is unreachable (it should be pruned) (RPH-EXE-005)."
(inEdgeDisposition:217 finds source s1 outside the empty live set.) The remainder of an ordinary chain can only be pruned away, never executed.

D. TEST-EVIDENCE / COVERAGE (the lens question). Nothing existing refutes this — the opposite. I grepped every `targetStepId` construction across packages/rph-domain, rph-application, rph-projections, apps/rph-demo (src + e2e). Exactly ONE source-less edge exists in the whole test corpus: packages/rph-projections/src/execution-view.test.ts:570-576, "labels a plan-entry edge honestly instead of rendering an empty source" — a SINGLE-step plan asserting only `sourceLabel === '(plan entry)'`, `sourceStepId === undefined`, `disposition === 'SATISFIED'`. That disposition comes from inEdgeDisposition's early return at transition-gate.ts:209 and never consults liveStepIds, so that test is structurally incapable of detecting this; it is also the reason the shape LOOKS supported. packages/rph-domain/src/transition-gate.test.ts has zero plan-entry-edge cases (its only source-less-ish case, :456, is the opposite half-edge — source with no target — which IS rejected). packages/rph-application/src/handlers/execution-start-gate.test.ts builds every edge through `gedge`/`cedge`, both of which always set sourceStepId. So there is NO test at any layer that runs liveStepIds/prunableStepIds/startableStepIds or any handler over a plan-entry edge: a total coverage gap on a shape the ratified contract explicitly permits (packages/rph-contracts/src/objects.ts:246 `sourceStepId: z.string().optional()`), the propose-time validator explicitly carves out as "legitimate", and the read-model renders as a first-class row. This is the anti-vacuity (JPWB-CON-000 B7) pattern: the only test touching the shape passes for a reason unrelated to the guard.

Severity: BLOCKER stands. Two distinct governing-rule breaches from one edge — an unwaived skip of MANDATORY steps plus a false COMPLETED (fail-OPEN where the rule demands fail-closed), and a hard deadlock. Mitigating only in reach: apps/rph-demo authors `transitions: []` (+page.server.ts:531) so no current demo fixture emits an entry edge; the trigger is any plan authored through the public ProposeExecutionPlan command in the shape the validator blesses — which propose ACCEPTS today (schema + graph validation both pass).

</details>

**Live check needed.** None — settled by execution. If a fix lands, the regression tests to add are: (1) rph-domain transition-gate.test.ts — `prunableStepIds` on [entry->s1, s1->s2, s2->s3] must equal [] and `startableStepIds` after s1 SUCCEEDED must equal ['s2']; (2) rph-application execution-start-gate.test.ts — on the same activated plan, `PruneExecutionStep(s2)` must be REJECTED (it is ACCEPTED today) alongside the already-rejecting `SkipExecutionStep(s2)`. Both go RED against current HEAD, so they kill the mutant. Note the fix must also pick ONE story: either seed the frontier on sourced in-edges only (matching buildAdjacency), or delete the checkDanglingIds:467-471 carve-out and reject source-less edges at propose — in which case execution-view.test.ts:570 ("(plan entry)" label) becomes dead and must be retired with it.


## F-06 · [CONFIRMED] [BLOCKER] A CANCELLED/SUPERSEDED predecessor leaves its downstream 'live' forever, and the only exit — a waiver-skip — RESURRECTS the dead arm (DWP-08 class, third recurrence)

- **Lens:** `deadness-prune`
- **Site:** `packages/rph-domain/src/transition-gate.ts:169 (branchExcludes requires TERMINAL_SUCCESS) interacting with the liveness check at :217`

**Claim.** branchExcludes is the ONLY way an edge loses reachability, and it returns false immediately unless the source is in TERMINAL_SUCCESS {SUCCEEDED, SKIPPED} (:169). A CANCELLED or SUPERSEDED source is therefore never an exclusion, so liveStepIds keeps its whole downstream LIVE. Meanwhile inEdgeDisposition (:221) neutralizes the edge because the source is terminal-non-success. The code comment at :157-160 justifies the narrowness with 'a FAILED step is retryable (FAILED->QUEUED) and a source that has not finished may still take this edge' — but that justification does NOT hold for CANCELLED/SUPERSEDED: transitions.data.ts:1437-1482 gives those two states NO out-arrow whatsoever, so nothing can ever un-neutralize them. The consequence is the exact defect DWP-08 was written to close, restated at :214-216 ('a step on a not-taken arm is terminal-success whether it was pruned OR waived away, and treating that as done, carry on resurrected the excluded arm'). The :217 liveness test only catches sources liveStepIds EXCLUDED, and liveStepIds never excludes a CANCELLED-descendant — so the waiver-skip route back to life is wide open on this path.

**Failure scenario.** CONFIRMED by execution against the live command bus. Activate a 4-step graph plan s1->s2->s3->s4. Start s1, Complete s1, Start s2, CancelExecutionStep(s2, reason 'operator aborted') -> ACCEPTED, s2 = CANCELLED. StartExecutionStep(s3) -> REJECTED: 'every in-edge is neutralized — the step is unreachable (it should be pruned)'. PruneExecutionStep(s3) -> REJECTED: 'it is still reachable'. The operator's only remaining exit is SkipExecutionStep(s3, {waiverOrRevisionId:'waiver-1'}) -> ACCEPTED, s3 = SKIPPED. Now StartExecutionStep(s4) -> ACCEPTED, s4 = RUNNING. A step whose transitive predecessor was CANCELLED and produced nothing is now executing, because a DIFFERENT command drove the intervening step to SKIPPED — deadness keyed on the wrong axis, exactly as in DWP-07/08. Verified at the kernel too: inEdgeDisposition(plan, s3->s4) flips from PENDING to SATISFIED the moment s3 becomes SKIPPED, and startStepGate(plan,'s4') returns {ok:true}.

**Suggested fix.** Extend branchExcludes with a third exclusion limb: an edge whose source is terminal and NOT retryable (CANCELLED or SUPERSEDED — i.e. terminal with no out-arrow in the ExecutionStep.stepState machine) carries no reachability. That single change makes the downstream structurally dead, which (a) closes this resurrection and (b) makes the downstream genuinely prunable, closing the companion deadlock/contradiction finding. Derive the non-retryable set from the machine rather than re-hardcoding it, so it cannot drift from transitions.data.ts.

<details><summary>Code-semantics verifier evidence</summary>

I tried hard to refute this and could not — I reproduced the exact failureScenario twice (pure kernel and live command bus), and I found an ADDITIONAL fact the original finding did not have that removes the only available "this is intended design" defense.

CODE PATH (verified line by line, no doc/comment trusted)

1. packages/rph-domain/src/transition-gate.ts:167-169 — the only reachability-removing predicate:
   function branchExcludes(...) {
     if (edge.sourceStepId === undefined) return false;
     const source = plan.steps.find((s) => s.id === edge.sourceStepId);
     if (source === undefined || !TERMINAL_SUCCESS.has(source.stepState)) return false; // unsettled ⇒ excludes nothing
   TERMINAL_SUCCESS = {'SUCCEEDED','SKIPPED'} (:17). CANCELLED/SUPERSEDED therefore never exclude an edge, so liveStepIds (:135-151, the only caller at :147) keeps the whole downstream LIVE.

2. transitions.data.ts ('ExecutionStep.stepState' block, raw bytes dumped with `sed | cat -v`, no hidden control chars): the transitions array contains `{ from: 'FAILED', to: 'QUEUED', trigger: 'retryExecutionStep / ExecutionStepRetried' }` but NO entry whose `from` is 'CANCELLED' or 'SUPERSEDED'. So the comment at transition-gate.ts:157-160 ("a FAILED step is retryable (FAILED→QUEUED) and a source that has not finished may still take this edge") is a true justification for FAILED and a FALSE one for CANCELLED/SUPERSEDED — those are irrecoverable, exactly as the finding claims.

3. inEdgeDisposition:221 — `if (!TERMINAL_SUCCESS.has(src)) return 'NEUTRALIZED';` fires for the CANCELLED source, but the transitive liveness test at :217 (`if (!liveStepIds(...).has(source.id)) return 'NEUTRALIZED'`) never sees the downstream as dead, because liveStepIds never excluded it. So the neutralization does NOT propagate.

4. No handler compensates. packages/rph-application/src/handlers/execution.ts:952-988 skipExecutionStep has exactly two gates — plan-ACTIVE and `canSkipStep({ mandatory: p.mandatory ?? true, hasAuthorizedWaiverOrRevision: !!p.waiverOrRevisionId })` — and NO reachability check, unlike pruneExecutionStep:1048-1067 which does call prunableStepIds. cancelExecutionStep:998-1011 has no cascade and leaves plan.status ACTIVE.

REPRODUCTION A — pure kernel (temp vitest in packages/rph-domain, since deleted), graph s1→s2→s3→s4:
  s2 CANCELLED: inEdgeDisposition(s2→s3) = NEUTRALIZED; startStepGate(s3) = {ok:false,"every in-edge is neutralized — the step is unreachable (it should be pruned)"}; prunableStepIds = []; startableStepIds = [].
  s3 SKIPPED: inEdgeDisposition(s3→s4) = SATISFIED; startStepGate(s4) = {ok:true}; startableStepIds = ["s4"].

REPRODUCTION B — live Engine + SqliteStorageAdapter (temp test cloned from execution-start-gate.test.ts's harness, since deleted). Propose/approve/activate a 4-step graph plan with SEQUENTIAL edges 1→2→3→4, then:
  CancelExecutionStep(s2,'operator aborted') -> ACCEPTED, s2 = CANCELLED
  StartExecutionStep(s3)  -> REJECTED "every in-edge is neutralized — the step is unreachable (it should be pruned)"
  PruneExecutionStep(s3)  -> REJECTED "it is still reachable — every in-edge would have to be excluded by the plan's own branch logic"
  SkipExecutionStep(s3,{waiverOrRevisionId:'waiver-1'}) -> ACCEPTED, s3 = SKIPPED
  StartExecutionStep(s4)  -> ACCEPTED, s4 = RUNNING
Byte-for-byte the sequence the finding asserted. (Cheaper still: SkipExecutionStep with `mandatory:false` needs no waiver at all — execution.ts:976.)

THE DECISIVE EXTRA FACT (kills the "intended semantics" defense). I ran the IDENTICAL command sequence against the LINEAR degenerate (transitions: []):
  LIN SkipExecutionStep(s3) -> ACCEPTED; LIN StartExecutionStep(s4) -> REJECTED "a predecessor (…-s2) is CANCELLED — a step may not start until its predecessors are terminal-success (an earlier step is not terminal-success (linear order))" — startStepGate:370-382 scans EVERY earlier step, so a CANCELLED step permanently blocks its whole downstream and no waiver-skip launders it.
So on a linear-shaped graph the two halves of this module disagree about the same plan and the same operator actions. That contradicts the module's own stated contract — :10-12 "an EMPTY transitions[] runs byte-identical to the linear frontier" and :238-240 "byte-identical to the shipped startableStepId" — and the F-11 read-model/authority-cannot-diverge purpose stated at :4-8. Whichever rule is right, they cannot both be, so this is a defect and not a deliberate design choice.

CORRECTIONS TO THE FINDING (do not change the verdict)
- The "third recurrence of the DWP-08 class" framing is inexact: no BRANCH and no branchExcludes exclusion is involved here, and branchExcludes' narrowness is genuinely correct for FAILED (the :411 "a failure is not an exclusion" test in transition-gate.test.ts is sound and must stay green). The real defect is narrower: liveness ignores a NON-RETRYABLE terminal source. The harm shape (a SKIPPED intermediate re-grounds a downstream that had no live path) is the same.
- The suggested fix's clause "(b) makes the downstream genuinely prunable, closing the companion deadlock" is only half true: pruning s3/s4 to SKIPPED still leaves s2 CANCELLED, and completeExecutionPlan's success allow-list (execution.ts:483-491, `every SUCCEEDED || SKIPPED`) still refuses COMPLETED. The plan is un-completable from the moment of the cancel regardless.
- Severity downgraded BLOCKER -> MAJOR: it needs an explicit operator command pair (Cancel then Skip), and it cannot fabricate a COMPLETED plan (allow-list above). What it does do is real and unmitigated — ONE waiver-skip re-opens an ENTIRE downstream (s4, s5, … all start freely afterwards) behind an irrecoverably cancelled predecessor that produced nothing, and startableStepIds returns ["s4"] so the UI actively OFFERS the Start.
- The fix should derive the non-retryable terminal set from transitions.data.ts (states that are terminal AND appear in no transition's `from`) rather than re-hardcoding {CANCELLED,SUPERSEDED}; and it must add the anti-vacuity kill test the class keeps missing: transition-gate.test.ts fixture s1 SUCCEEDED → s2 CANCELLED → s3 SKIPPED → s4 QUEUED asserting startStepGate(p,'s4').ok === false (currently true), plus the handler-level four-command sequence in execution-start-gate.test.ts asserting StartExecutionStep(s4) is REJECTED. A parity test asserting graph-vs-linear agreement on this exact input would have caught it and should be added regardless.

</details>

<details><summary>Test-evidence verifier evidence</summary>

SETTLED BY EXECUTION, BOTH LAYERS. I wrote two throwaway probes (rph-domain + rph-application), ran them, and deleted both; no source file was touched.

(1) COVERAGE GAP IS REAL. Nothing tests a CANCELLED/SUPERSEDED step-state predecessor on the GRAPH path.
- packages/rph-domain/src/transition-gate.test.ts contains no CANCELLED/SUPERSEDED STEP fixture at all — the only two hits (:41, :233) are PLAN.status values. Its nearest neighbour, :411 "does NOT offer the downstream of a FAILED step for prune", covers the retryable case only.
- packages/rph-projections/src/execution-view.test.ts:252 does assert startableStepId(['SUCCEEDED','CANCELLED','QUEUED']) === undefined — but that is the LINEAR (empty transitions[]) degenerate, and my probe shows the linear path is genuinely SAFE. So the one existing test that looks like it covers this exercises the branch that works.
- Handler tests mention a CANCELLED step only in execution-step-skip-cancel.test.ts:168/200, both single-step LINEAR plans, neither with a successor.

(2) DOMAIN PROBE (pure functions, s1->s2->s3->s4 SEQUENTIAL edges), observed values:
  s1 SUCCEEDED / s2 CANCELLED / s3 QUEUED / s4 QUEUED
    startableStepIds = []          prunableStepIds = []
    startStepGate(s3) = {ok:false, reason:"every in-edge is neutralized — the step is unreachable (it should be pruned)"}
    inEdgeDisposition(s2->s3) = NEUTRALIZED
  after the waiver-skip (s3 SKIPPED):
    startableStepIds = ["s4"]      startStepGate(s4) = {ok:true}      inEdgeDisposition(s3->s4) = SATISFIED
  CONTROLS: same shape with s2 SUPERSEDED -> gate(s4).ok = true (same hole); with s2 FAILED -> true (deliberate, per the :157-160 rationale); LINEAR degenerate -> gate(s4).ok = FALSE.

(3) LIVE COMMAND-BUS PROBE (real Engine + SqliteStorageAdapter, ProposeExecutionPlan with transitions [s1->s2, s2->s3, s3->s4], approve, activate, Start s1, Complete s1, Start s2):
    CancelExecutionStep(s2)  -> ACCEPTED, s2 = CANCELLED
    StartExecutionStep(s3)   -> REJECTED "every in-edge is neutralized — the step is unreachable (it should be pruned) (RPH-EXE-005)"
    PruneExecutionStep(s3)   -> REJECTED "it is still reachable — every in-edge would have to be excluded by the plan's own branch logic"
    SkipExecutionStep(s3, mandatory:true, waiverOrRevisionId) -> ACCEPTED, s3 = SKIPPED
    StartExecutionStep(s4)   -> ACCEPTED, s4 = RUNNING
This reproduces the reported scenario verbatim, including the two mutually contradictory rejection messages (start says "it should be pruned"; prune says "it is still reachable").

(4) MECHANISM VERIFIED AGAINST THE MACHINE. transitions.data.ts:1437-1482: CANCELLED and SUPERSEDED appear only as `to` states — zero out-arrows — unlike FAILED->QUEUED at :1456. So the comment at transition-gate.ts:157-160 ("a FAILED step is retryable ... a source that has not finished may still take this edge") does not justify the TERMINAL_SUCCESS-only test at :169 for those two states. branchExcludes is the only exclusion path feeding liveStepIds (:147), so a CANCELLED source keeps its whole downstream in `live`, which simultaneously (a) makes prunableStepIds drop s3 (:329) and (b) makes the :217 liveness veto in inEdgeDisposition a no-op once s3 is SKIPPED.

(5) THE STRONGEST OBJECTIVE STATEMENT OF THE DEFECT, independent of any judgement about waivers: transition-gate.ts:10-12 declares the module's own contract — "an EMPTY transitions[] runs byte-identical to the linear frontier (implicit step[i-1]->step[i] edges)". My probe shows the identical 4 steps in identical states give gate(s4).ok = FALSE on the linear plan and TRUE on the explicit-linear graph. The two halves the module exists to keep identical disagree.

SEVERITY CORRECTED BLOCKER -> MAJOR, for two reasons the finding did not weigh: (a) the resurrection is not automatic — it requires a deliberate, authorized SkipExecutionStep carrying a waiverOrRevisionId, so a human authorization stands between the cancel and the resurrection; and (b) no governed artifact can be laundered to success, because CompleteExecutionPlan uses a terminal-SUCCESS allow-list and a CANCELLED step blocks completion forever (execution-plan-completion.test.ts:160-162, "CANCELLED must not count as success"). What remains, and is unambiguously real, is: real work RUNS on a structurally dead arm whose predecessor produced nothing; the plan is wedged with two authorities contradicting each other; and the linear/graph equivalence contract is broken. The SUPERSEDED limb of the claim is technically true at the pure-function layer but I could not reach it by command — a step reaches SUPERSEDED via plan supersession, after which startExecutionStep's plan-ACTIVE precheck (execution.ts:709) refuses anyway; only the CANCELLED limb is command-reachable.

The suggested fix (derive the non-retryable terminal set from ExecutionStep.stepState rather than re-hardcoding it) is sound and would also flip prunableStepIds to offer s3, closing the deadlock in the same change.

</details>

**Live check needed.** None — already executed. To reproduce: add to packages/rph-domain/src/transition-gate.test.ts the mirror of the :411 test — plan([step('s1','SUCCEEDED'), step('s2','CANCELLED'), step('s3','SKIPPED'), step('s4','QUEUED')], [edge('s1','s2'), edge('s2','s3'), edge('s3','s4')]) and assert startStepGate(p,'s4').ok === false (currently true); plus the intermediate state assert prunableStepIds with s3 QUEUED contains 's3' (currently []). Handler mirror: the six-command sequence in execution-start-gate.test.ts asserting StartExecutionStep(s4) is REJECTED. Run with `cd JanumiCode/janumiprofessionalworkbench/packages/rph-domain && bunx vitest run src/transition-gate.test.ts`.


## F-07 · [CONFIRMED] [BLOCKER] A BRANCH cannot branch on its own result: RESULT_EQUALS / OUTPUT_COUNT over the completing step evaluate against pre-completion facts, so the wrong arm is selected and durably recorded

- **Lens:** `grammar`
- **Site:** `packages/rph-application/src/handlers/execution.ts:762-779 (completeExecutionStep mutateStep) + :117 (guardEvaluatorFor) + packages/rph-domain/src/condition-grammar.ts:124,128`

**Claim.** When a BRANCH step reaches SUCCEEDED, completeExecutionStep resolves the branch inside `mutateStep` (execution.ts:762). It builds `resolved` by patching ONLY `stepState` to 'SUCCEEDED' (:769-771) — the comment at :765-766 explicitly states the intent is to "ask the plan as if this step had already succeeded", which is why the patch exists at all. But the other two self-facts the grammar reads are NOT patched: `guardEvaluatorFor` folds the subject via `buildConditionSubject(gatePlan.steps, ctx.store.readAllEvents(), planId)` (execution.ts:117), and `buildConditionSubject` takes `outputArtifactIds` and `structuredResult` EXCLUSIVELY from a committed `ExecutionStepSucceeded` event (condition-grammar.ts:191-198) — never from the steps argument. In `advanceStep`, `mutateStep` runs at line 656 and `commitState` at :667, so the ExecutionStepSucceeded event for THIS command is not yet in the store when the fold runs. Consequently, for a guard referencing the branch step itself: RESULT_EQUALS resolves `resolvePath(undefined, path)` -> undefined (condition-grammar.ts:128) and OUTPUT_COUNT reads `0` (:124). Both are unconditionally FALSE at the only moment the decision is taken. `resolveBranchSelection` then falls through to the unconditional SEQUENTIAL default (transition-gate.ts:191-195), and DWP-09 writes that wrong choice to `selectedTransitionId` (execution.ts:778), where `selectBranchEdge`'s recorded-decision limb (transition-gate.ts:109-114) makes it permanent and unreviewable — the read model shows the same wrong arm, so display and authority agree on the wrong answer. Self-reference is explicitly permitted: `conditionStepRefs` only requires the stepId to be a DECLARED step (execution.ts:199), and RESULT_EQUALS's dot-path-over-structuredResult design exists precisely for the "branch on the review step's outcome" idiom. Grep confirms NO test anywhere uses RESULT_EQUALS or OUTPUT_COUNT as a live transition guard — the sole branch fixture (execution-start-gate.test.ts:937) uses STEP_STATE over a DIFFERENT, never-completed step, which is exactly the shape that hides this.

**Failure scenario.** Plan: s1 stepType BRANCH ('review'), out-edges in authored order [t1: s1->s2 CONDITIONAL {op:'RESULT_EQUALS', stepId:'s1', path:'outcome', value:'APPROVE'}, t2: s1->s3 SEQUENTIAL default]. Propose is ACCEPTED (grammar parses; 's1' is a declared step; checkBranchDefaults sees one conditional + one unconditional default last). Approve, Activate, StartExecutionStep(s1), then CompleteExecutionStep({executionStepId:'s1', structuredResult:{outcome:'APPROVE'}, outputArtifactIds:[artifactId], ...}). Expected: the APPROVE arm s2 becomes live. Actual: at :773 the subject has s1.structuredResult === undefined, so t1's guard is false; t2 (the reject/default arm) is selected and written to s1.selectedTransitionId. StartExecutionStep(s2) is then REJECTED forever, s2 is offered for Prune as structurally dead, and the plan completes cleanly down the REJECT path while the recorded result says APPROVE. No error, no rejection, no diagnostic — the plan silently executed the opposite of what its own result dictated. The same trace with {op:'OUTPUT_COUNT', stepId:'s1', cmp:'>', value:0} fails identically (count reads 0).

**Suggested fix.** Patch the completing step's result facts into the subject the same way stepState is patched. Either (a) give buildConditionSubject an optional per-step override and pass {outputArtifactIds: p.outputArtifactIds, structuredResult: p.structuredResult} for the completing step, or (b) synthesize the not-yet-committed ExecutionStepSucceeded event and append it to the event list handed to guardEvaluatorFor at execution.ts:776. If self-referencing result guards are instead meant to be illegal, reject them at propose in rejectMalformedTransitionCondition (execution.ts:183-210) by refusing any RESULT_EQUALS/OUTPUT_COUNT whose stepId equals the edge's own sourceStepId — silence is the one option that must not remain.

<details><summary>Code-semantics verifier evidence</summary>

I tried hard to refute this and could not. Every cited line is accurate, no earlier guard intercepts, and I reproduced the wrong outcome by running the engine.

1) THE PATCH IS PARTIAL (verified). `packages/rph-application/src/handlers/execution.ts:762-779`:
   mutateStep: (step) => {
     if (step.stepType !== 'BRANCH') return step;
     const gatePlan = toGatePlan(loadPlanState(ctx, command.targetAggregateId));
     // ...ask the plan as if this step had already succeeded.
     const resolved = { ...gatePlan, steps: gatePlan.steps.map((s) => s.id === String(step.id) ? { ...s, stepState: 'SUCCEEDED' } : s) };
   Only `stepState` is patched. `toGatePlan` (execution.ts:71-81) projects only id/stepState/stepType/selectedTransitionId, so no result facts even exist on the object handed to the evaluator.

2) THE OTHER SELF-FACTS COME ONLY FROM A COMMITTED EVENT (verified). `guardEvaluatorFor` (execution.ts:117) folds `buildConditionSubject(gatePlan.steps, ctx.store.readAllEvents(), planId)`. In `condition-grammar.ts:213-215` every step is seeded `{ stepState: s.stepState, outputArtifactIds: [], attemptsMade: 0 }` (no structuredResult), and the ONLY writer of those two fields is the `ExecutionStepSucceeded` limb of the fold at `condition-grammar.ts:191-198`.

3) ORDERING (verified). In `advanceStep`, mutateStep runs at execution.ts:656, `makeEvent` at :660, `commitState` at :667 — so THIS command's ExecutionStepSucceeded is not in `readAllEvents()` when the branch resolves. `requireFrom: ['RUNNING']` (execution.ts:756) guarantees there is no earlier Succeeded event for the step either. Hence RESULT_EQUALS resolves `resolvePath(undefined, path)` → undefined (grammar :128) and OUTPUT_COUNT reads 0 (:124) at the only moment the decision is taken.

4) NO EARLIER GUARD REFUSES THE SHAPE (verified). `rejectMalformedTransitionCondition` (execution.ts:183-210) only requires each `conditionStepRefs` id to be a DECLARED step (:199); `validateTransitionGraph` / `checkBranchDefaults` (transition-gate.ts:519-550) never look at condition contents. Self-reference is in fact THE ESTABLISHED IDIOM of this surface: every branch fixture in execution-start-gate.test.ts guards the branch on ITSELF — `cedge(1, 2, { op: 'STEP_SUCCEEDED', stepId: stepId(1) })` (:329, :386, :703) and `{ op: 'ATTEMPTS', stepId: stepId(1), ... }` (:337). Those two work (stepState is patched; ATTEMPTS counts already-committed Started events). RESULT_EQUALS and OUTPUT_COUNT are exactly the two leaves the patch misses. Grep over the whole repo confirms RESULT_EQUALS/OUTPUT_COUNT appear ONLY in the grammar, its pure unit test (condition-grammar.test.ts:64-77), and the projection's describeCondition — never as a live transition guard.

5) EXECUTED PROOF. I wrote a throwaway suite (since deleted) in packages/rph-application using the existing fixture harness: s1 stepType BRANCH, edges [t1-2 CONDITIONAL {op:'RESULT_EQUALS', stepId:s1, path:'outcome', value:'APPROVE'}, t1-3 SEQUENTIAL default]; propose→approve→activate→start(1)→complete(1, structuredResult {outcome:'APPROVE'}). Propose was ACCEPTED (the shape is legal). Result:
   SELECTED (RESULT_EQUALS): plan_...-t1-3        <-- the DEFAULT/reject arm
   start(s2) => REJECTED "RPH_ILLEGAL_STATE_TRANSITION"
   AssertionError: expected 'plan_...-t1-3' to be 'plan_...-t1-2'
   The identical plan with `{op:'STEP_SUCCEEDED', stepId:s1}` (control, same run) selected t1-2 and PASSED — so the divergence is the missing result-fact patch, not the fixture.

6) PERMANENCE (verified). The wrong id is written to `selectedTransitionId` (execution.ts:778) and persisted on the step (`nextStep` at :656); `selectBranchEdge`'s recorded-decision limb (transition-gate.ts:109-114) then returns the recorded edge forever, so `inEdgeDisposition` NEUTRALIZES the true arm (:228-231), `liveStepIds` drops it, and `prunableStepIds` offers it for prune. No error, no diagnostic — display and authority agree on the opposite of the step's own recorded result.

SEVERITY CORRECTION: MAJOR, not BLOCKER. The defect is real, silent, and durable, but no plan in the repo (rph-demo, e2e specs, fixtures) currently authors a RESULT_EQUALS/OUTPUT_COUNT guard, so nothing shipped is executing the wrong arm today; it is a latent trap in a propose-ACCEPTED authoring shape that the surface's own idiom invites. It becomes a BLOCKER the first time an author writes the "branch on my own result" edge the RESULT_EQUALS dot-path design exists for. Note also the OUTPUT_COUNT direction cuts both ways: `{cmp:'==', value:0}` over the completing step is unconditionally TRUE at decision time regardless of how many artifacts the completion carries (same fold, same ordering) — a fail-OPEN reading of "produced nothing".

The finding's suggested fix (a) — an optional per-step override on buildConditionSubject carrying {outputArtifactIds, structuredResult} from the command payload — or an explicit propose-time refusal of a self-referencing RESULT_EQUALS/OUTPUT_COUNT in rejectMalformedTransitionCondition, is the right shape. Whichever is chosen, the fix needs the anti-vacuity test the surface currently lacks: the probe above, asserting stepOf(1).selectedTransitionId === the CONDITIONAL edge id.

</details>

<details><summary>Test-evidence verifier evidence</summary>

CONFIRMED by live probe, not by code-reading. I wrote a temporary probe test in packages/rph-application/src/handlers/ (deleted after the run; no source file touched) that drove the exact scenario through the real Engine + SqliteStorageAdapter.

PROBE A — RESULT_EQUALS over the branch's OWN step. Plan: s1 stepType BRANCH, out-edges in authored order [t1-2: CONDITIONAL {op:'RESULT_EQUALS', stepId:s1, path:'outcome', value:'APPROVE'}, t1-3: SEQUENTIAL default]. Propose/Approve/Activate all ACCEPTED (the grammar parses, s1 is a declared step, checkBranchDefaults is happy). Start(s1) ACCEPTED. Complete(s1) with structuredResult {outcome:'APPROVE'} ACCEPTED. Observed output:
  PROBE A selectedTransitionId = plan_…-t1-3        <- the DEFAULT/reject arm, not the APPROVE arm
  PROBE A start(s2 APPROVE arm) = REJECTED "Cannot start step …-s2: every in-edge is neutralized — the step is unreachable (it should be pruned) (RPH-EXE-005)."
  PROBE A start(s3 default arm) = ACCEPTED
So the plan durably recorded and then executed the OPPOSITE of its own result, with no error and no diagnostic. That is precisely the failureScenario as written.

PROBE B — OUTPUT_COUNT over the branch's own step, with a genuinely RecordArtifact'd artifact passed as outputArtifactIds (my first attempt used a fake evidence id and was correctly rejected by the recorded-object gate, so I re-ran it properly):
  PROBE B selectedTransitionId = plan_…-t1-3        <- same wrong arm; the count read 0.

PROBE C — CONTROL, ATTEMPTS >= 1 over the branch's own step: PASSED, selectedTransitionId = t1-2. This isolates the mechanism exactly as the finding claims: ATTEMPTS folds from ExecutionStepStarted, which IS already committed when mutateStep runs, so a self-referencing ATTEMPTS guard works. RESULT_EQUALS/OUTPUT_COUNT fold only from ExecutionStepSucceeded (condition-grammar.ts:191-198 — the sole writer of rec.outputArtifactIds and rec.structuredResult; the seed at :215 is {outputArtifactIds: [], no structuredResult}), and that event is not in the store yet: advanceStep runs mutateStep at execution.ts:656 and commitState at :667. The patch at execution.ts:767-772 lifts ONLY stepState, so those two facts stay at their empty seed.

COVERAGE GAP (the anti-vacuity half). Repo-wide grep for RESULT_EQUALS|OUTPUT_COUNT returns 5 files and NOT ONE is a live guard test:
- packages/rph-domain/src/condition-grammar.test.ts — pure evaluator unit tests against a hand-built subject; never goes through completeExecutionStep.
- packages/rph-projections/src/execution-view.test.ts:475-481 — describeCondition RENDERING only ("outputs >= 2", "result.a.b = true"); no evaluation.
- packages/rph-projections/src/execution-view.ts:306-322 — the renderer itself.
- the DR-004 roadmap doc.
Every live branch fixture in execution-start-gate.test.ts (:329, :337, :370, :386, :931) uses STEP_SUCCEEDED or STEP_STATE or ATTEMPTS — i.e. exactly the three ops that read stepState (patched) or ExecutionStepStarted (already committed). That is the shape that hides this: the two ops whose facts arrive only with the not-yet-committed ExecutionStepSucceeded event are the two with zero end-to-end coverage.

No existing test proves the claimed-broken behaviour works; the probe proves it is broken in both limbs, and the control probe proves the diagnosis of the mechanism is right rather than coincidental. REFUTED is not available here.

Severity BLOCKER stands and is arguably understated by "wrong arm selected": DWP-09 writes the wrong id to selectedTransitionId, and selectBranchEdge's recorded-decision limb (transition-gate.ts:109-114) then makes it authoritative and unreviewable — the read model renders the same wrong arm, so display and authority agree on the wrong answer, the correct arm is offered for Prune as structurally dead, and the plan completes CLEANLY down the wrong path. Silent, durable, self-consistent corruption of the flow decision. Also note the propose-time gate is fully permissive here: conditionStepRefs at execution.ts:199 only requires the stepId to be declared, so self-reference is accepted, and RESULT_EQUALS's dot-path-over-structuredResult design exists for no other idiom than "branch on this step's result".

</details>

**Live check needed.** None — settled live. Reproduction (for the fixer): add to packages/rph-application/src/handlers/execution-start-gate.test.ts, inside the existing `BRANCH + prune (DWP-03)` describe (helpers `cedge`/`gedge`/`start`/`complete`/`stepId` are already in scope), a plan with steps [s1 BRANCH, s2, s3] and transitions [cedge(1,2,{op:'RESULT_EQUALS',stepId:stepId(1),path:'outcome',value:'APPROVE'}), gedge(1,3)]; start(1); complete(1) carrying structuredResult {outcome:'APPROVE'}; assert the plan's s1.selectedTransitionId === `${PLAN}-t1-2`. It is `${PLAN}-t1-3` today. Add the OUTPUT_COUNT twin (cmp '>' value 0 with a RecordArtifact'd artifact in outputArtifactIds — an unrecorded id is rejected by the recorded-object gate before the branch logic is reached) and keep an ATTEMPTS self-reference case as the passing control so a future regression cannot be mistaken for "self-reference is just unsupported".


## F-08 · [CONFIRMED] [BLOCKER] A non-ACTIVE or barely-started execution plan backs a PWU `executionState=SUCCEEDED` claim — the plan-level completion allow-list is bypassable

- **Lens:** `invariants`
- **Site:** `packages/rph-application/src/handlers/pwu.ts:670-698 (`rejectUnbackedExecutionSuccess`, esp. :686), call site :791; contrast packages/rph-application/src/handlers/execution.ts:459-500 (`completeExecutionPlan`) and its docstring at :453-457`

**Claim.** The three-limb completion allow-list on `completeExecutionPlan` (>=1 step, EVERY step SUCCEEDED|SKIPPED, >=1 SUCCEEDED) is the surface's authoritative statement of "this plan produced work". Its own docstring says the >=1-SUCCEEDED clause exists so "the two planes cannot diverge (a plan 'COMPLETED' whose PWU cannot claim success)". That alignment is one-directional and the converse is wide open. `rejectUnbackedExecutionSuccess` — the sole guard on the premise the entire assurance chain rests on — accepts any cited object where `objectType === 'EXECUTION_PLAN' && s.workUnitId === id && (s.steps ?? []).some(step => step.stepState === 'SUCCEEDED')` (pwu.ts:686). It reads `steps`, and never reads `s.status`. So (a) `some`, not `every`: one succeeded step out of N backs the claim while the other N-1 sit QUEUED; and (b) no status check: a SUPERSEDED, CANCELLED, FAILED, UNDER_REVIEW or APPROVED plan backs it identically to an ACTIVE one. The plan-level rule the codebase wrote to stop exactly this is simply not consulted.

**Failure scenario.** PWU pwu_A, plan P with steps s1..s5 (all QUEUED). Activate P, Start s1, CompleteExecutionStep(s1) -> s1 SUCCEEDED, s2..s5 still QUEUED. Now dispatch `CompleteExecutionPlan(P)` -> REJECTED, RPH_INVARIANT_VIOLATION, "has 4 step(s) not in terminal success". Then dispatch `ChangePwuState(pwu_A, { executionState: 'SUCCEEDED', supportingObjectIds: [P] })` -> ACCEPTED. The PWU now asserts execution success, unlocking §8.1's EXECUTING -> EVIDENCE_PENDING and RPH-PWU-006's Given, on a plan the engine itself refuses to call complete. Worse variant: SupersedeExecutionPlan(P -> P2) first, so P.status = 'SUPERSEDED'; the same ChangePwuState is still ACCEPTED — a plan the sponsor explicitly killed backs the success claim of the PWU it was killed on.

**Suggested fix.** Make the backing predicate cite the plan-level rule rather than re-implement a weaker one: require `s.status === 'COMPLETED'` (the state the allow-list guard already earned), or at minimum `s.status === 'ACTIVE' || s.status === 'COMPLETED'` AND reuse the same allow-list limbs (`every(SUCCEEDED|SKIPPED) && some(SUCCEEDED)`) so the two planes have one definition of execution success instead of two.

<details><summary>Code-semantics verifier evidence</summary>

I tried hard to refute this and could not: I traced every guard in `changePwuState` and then reproduced BOTH claimed scenarios live against the real engine (temporary vitest probe in packages/rph-application, since deleted).

CODE FACTS (verified by Read, not by docstring):
1. `rejectUnbackedExecutionSuccess` — packages/rph-application/src/handlers/pwu.ts:679-687:
   const backed = cited.some((oid) => {
     const obj = ctx.store.loadObject(oid);
     if (obj?.objectType !== 'EXECUTION_PLAN') return false;
     const s = obj.state as { workUnitId?: string; steps?: { stepState?: string }[] };
     return s.workUnitId === id && (s.steps ?? []).some((step) => step.stepState === 'SUCCEEDED');
   });
   The predicate reads `workUnitId` and `steps` only. There is NO `s.status` term, and the inner quantifier is `.some`, not `.every`. Both halves of the finding are literally present in the source.
2. The full `changePwuState` body (pwu.ts:741-835) was read end-to-end. The only things ahead of this guard are: stale-previousState (:747), the `changeNothingPrecondition` all-axes-equal vacuity refusal (:757-767 — inert here, executionState changes), and per-sub-axis `checkTransition` (:780-783). `PWU.executionState` has a legal `RUNNING -> SUCCEEDED` arrow (transitions.data.ts:504-509), so nothing upstream intercepts. Nothing downstream re-checks the plan either — `rejectIllegalWorkLifecycleMove` (:706) consults only the axes bag.

LIVE REPRODUCTION (5-step linear plan on pwu_A; only s1 started + CompleteExecutionStep'd; s2..s5 QUEUED):
  CompleteExecutionPlan -> REJECTED RPH_INVARIANT_VIOLATION "plan exp_… has 4 step(s) not in terminal success (QUEUED, QUEUED, QUEUED, QUEUED); COMPLETED requires every step SUCCEEDED or SKIPPED (§20.1 success allow-list)."
  ChangePwuState(executionState:'SUCCEEDED', supportingObjectIds:[planId]) -> ACCEPTED ; PWU executionState now = SUCCEEDED
  ChangePwuState(newState:'EVIDENCE_PENDING') -> ACCEPTED ; PWU workLifecycleState = EVIDENCE_PENDING while plan status = ACTIVE
The downstream consequence is real and load-bearing: packages/rph-domain/src/pwuGuards.ts:20 is exactly `'EXECUTING->EVIDENCE_PENDING': (a) => a.executionState === 'SUCCEEDED'`, so the false premise is the ONLY thing gating entry to the assurance chain.

CASE B (superseded) also reproduces verbatim: after ProposeExecutionPlan(successor) + SupersedeExecutionPlan(P -> P2), plan status = SUPERSEDED, and the same ChangePwuState -> ACCEPTED, executionState = SUCCEEDED.

CORROBORATION that `.some`/no-status is a gap rather than a design choice: the canon machine's own arrow annotation is `{ from: 'RUNNING', to: 'SUCCEEDED', trigger: 'ExecutionStepSucceeded (all steps)' }` (transitions.data.ts:504-509), and packages/rph-domain/src/execution.ts:289-294 states the rule as "When a PWU's **active plan succeeds**…". The implemented bar is one succeeded step on any plan in any status.

ANTI-VACUITY: both mutants are unkilled today. The only negative coverage is pwu.test.ts:589-619 (no plan cited at all) and :621-658 (another PWU's plan) — neither varies plan status nor step completeness. My probe shows both variants ACCEPT.

TWO CORRECTIONS to the finding, neither of which rescues the code:
- The title overstates: the completion allow-list is not *bypassed* (the plan genuinely stays non-COMPLETED and CompleteExecutionPlan keeps refusing). What is true is that the PWU plane runs a second, strictly weaker definition of "execution succeeded" that never consults the plan-level rule. Downgrading BLOCKER -> MAJOR: an attacker/controller still cannot manufacture success from nothing (>=1 genuinely succeeded step on THIS PWU's plan is still required, and the succeeding step is itself floor-guarded), and assurance SATISFIED remains independently guarded by `rejectUnbackedDisposition`. It is an integrity gap in a premise, not an open door.
- The suggested fix `s.status === 'COMPLETED'` would break the existing fixture `succeededPlanFor` (pwu.test.ts:159-243), which deliberately never issues CompleteExecutionPlan and leaves the plan ACTIVE. The workable form is to reuse the plan-level limbs on the cited plan — `(s.status === 'ACTIVE' || s.status === 'COMPLETED') && steps.length > 0 && steps.every(SUCCEEDED|SKIPPED) && steps.some(SUCCEEDED)` — so the two planes share one definition.

CHECK TO CONFIRM (reproducible): 5-step linear plan, complete only s1, assert CompleteExecutionPlan REJECTS *and* ChangePwuState(executionState:'SUCCEEDED', supportingObjectIds:[planId]) REJECTS. Today the first rejects and the second ACCEPTS. Second case: SupersedeExecutionPlan(P -> P2) then re-run — still ACCEPTS.

</details>

<details><summary>Test-evidence verifier evidence</summary>

SETTLED BY LIVE PROBE, not by code reading. I wrote a temporary vitest file (packages/rph-application/src/handlers/zz-probe-unbacked.test.ts), ran it against the real Engine + SqliteStorageAdapter, and DELETED it (verified gone; the other zz-* files in git status belong to sibling verifiers and were untouched). No source file was modified.

OBSERVED BEHAVIOUR (bunx vitest run --reporter=verbose --silent=false; 4/4 probes green; output verbatim):

PROBE A — the completeness limb (`.some` not `.every`). 5-step plan; s1 started+completed with real evidence; s2..s5 left QUEUED:
  PROBE A plan.status = ACTIVE steps = ["SUCCEEDED","QUEUED","QUEUED","QUEUED","QUEUED"]
  PROBE A CompleteExecutionPlan -> REJECTED  "...has 4 step(s) not in terminal success (QUEUED, QUEUED, QUEUED, QUEUED); COMPLETED requires every step SUCCEEDED or SKIPPED (§20.1 success allow-list)."
  PROBE A ChangePwuState(SUCCEEDED) -> ACCEPTED  (error: undefined)
  PROBE A pwu.executionState = SUCCEEDED
In one store the engine refuses to call the plan complete and simultaneously accepts the PWU's assertion that its execution SUCCEEDED on that same plan. Exactly the claimed divergence.

PROBE B — the status limb (SUPERSEDED). Same 1-step succeeded plan; real successor proposed on the same PWU; SupersedeExecutionPlan dispatched:
  PROBE B SupersedeExecutionPlan -> ACCEPTED
  PROBE B plan.status = SUPERSEDED steps = ["SUCCEEDED"]
  PROBE B ChangePwuState(SUCCEEDED) -> ACCEPTED
  PROBE B pwu.executionState = SUCCEEDED

PROBE D — the sharpest variant, which the lens did not name. 2-step plan, s1 SUCCEEDED, s2 QUEUED, then FailExecutionPlan (ACTIVE -> FAILED; `precondition: fromStates('ACTIVE')`, NO step guard, execution.ts:503-520):
  PROBE D FailExecutionPlan -> ACCEPTED
  PROBE D plan.status = FAILED steps = ["SUCCEEDED","QUEUED"]
  PROBE D ChangePwuState(SUCCEEDED) -> ACCEPTED
  PROBE D pwu.executionState = SUCCEEDED
A plan the engine itself records as FAILED backs the PWU claim "execution succeeded" — the premise RPH-PWU-006's Given opens with and §8.1 gates EXECUTING -> EVIDENCE_PENDING on.

COVERAGE GAP (why no existing test refutes this). Grep for the guard's reject string `no succeeded execution step` hits exactly one test: pwu.test.ts:617 (no plan cited at all). The only other negative is pwu.test.ts:641 (another PWU's plan — rejects on the `workUnitId` term). Every plan any application test ever cites is built by ONE fixture, `succeededPlanFor` (pwu.test.ts:164-245), used at :367, :538, :641 — and it always builds a SINGLE-step plan whose one step reaches SUCCEEDED, leaving the plan ACTIVE (confirmed by PROBE C: "plan.status at the moment the PWU claims success = ACTIVE"). Both mutants are therefore unkilled:
  * `.some` -> `.every` at pwu.ts:686 — suite stays GREEN (1-of-1 succeeded satisfies `every`). No test distinguishes some from every.
  * adding `s.status === 'ACTIVE' || s.status === 'COMPLETED'` — suite stays GREEN (fixture plan is ACTIVE). No test distinguishes checked-status from unchecked.
Neither limb of the predicate is pinned by any test — an anti-vacuity (CON-000 B7) hole, not merely a missing case.

THREE CORRECTIONS, which is why I downgrade BLOCKER -> MAJOR:
(1) The lens's primary suggested fix (require `s.status === 'COMPLETED'`) would BREAK ratified behaviour. PROBE C shows the accepted happy path (pwu.test.ts:367-377) cites an ACTIVE, never COMPLETED, plan; the guard is deliberately usable mid-flight and pwu.ts:661-664 documents that intent. Only the fallback (allow ACTIVE|COMPLETED, reject terminal-non-success) is compatible with what is already ratified.
(2) The APPROVED/UNDER_REVIEW variants in the claim are unreachable: StartExecutionStep requires an ACTIVE plan, so any plan carrying a SUCCEEDED step was once ACTIVE. Reachable bad statuses are SUPERSEDED, FAILED, CANCELLED — still three, two demonstrated live.
(3) Exploiting it needs a controller to actively cite a killed/incomplete plan; nothing corrupts state or deadlocks. A guard measurably weaker than the invariant it enforces, with zero test pressure on the gap = MAJOR, not BLOCKER.

SCOPE NOTE: pwu.ts is not on the enumerated Tier 3C-ii surface. It is the PWU-axis guard that execution.ts:453-457 names and claims alignment with — so the defect is real and the ALIGNMENT CLAIM inside 3C-ii code is false, but the fix site sits one module outside the reviewed surface.

</details>

**Live check needed.** None — settled live. To re-derive: rebuild the probe (5-step plan; complete only s1 via ProposeExecutionPlan/Approve/Activate/StartExecutionStep/ProposeEvidence/CompleteExecutionStep), assert CompleteExecutionPlan REJECTS and that ChangePwuState(executionState:'SUCCEEDED', supportingObjectIds:[planId]) also REJECTS — the second assertion fails today. Repeat with SupersedeExecutionPlan and with FailExecutionPlan applied first. Any regression test added to packages/rph-application/src/handlers/pwu.test.ts must also give `succeededPlanFor` a multi-step / non-ACTIVE variant, or it will inherit the same 1-of-1 blind spot.


## F-09 · [CONFIRMED] [BLOCKER] DS-004's blocker fix "steps rest QUEUED — a convention this design relies on and ENFORCES" is enforced nowhere; an authored NOT_READY step deadlocks the plan

- **Lens:** `doc-fidelity`
- **Site:** `packages/rph-application/src/handlers/execution.ts:240-278 (proposeExecutionPlan) vs DS-004 §3 + §10 BLOCKER(D5), DR-004 §15`

**Claim.** DS-004 §3 states of QUEUED-at-rest: "a convention this design **relies on and enforces** (§6 D5)", and §10 records "BLOCKER (D5) → FIXED. prune→SKIPPED is illegal from NOT_READY; v0.1.0 never pinned the pruned step's rest state → permanent completion deadlock ... Fix: steps rest **QUEUED**". DR-004 §15 demotes the same thing to an unverified "Assumption: steps rest QUEUED (reference-undertaking.ts:553)". The shipped propose path enforces NOTHING about stepState: proposeExecutionPlan checks work-unit existence (:242), rejectMalformedTransitionGraph (:250), rejectDuplicateTransitionId (:252) and rejectMalformedTransitionCondition (:254), then persists `steps: p.steps` verbatim (:265). ExecutionStepSchema accepts every StepStateSchema value, and NOT_READY is the machine's declared initialState (transitions.data.ts:1435). Meanwhile no command in registry.ts:123-140 drives NOT_READY→READY ('ExecutionStepReady', transitions.data.ts:1438) or READY→QUEUED ('step scheduled', :1444) — those two arrows are handler-less, so the design's load-bearing precondition is an unchecked authoring convention.

**Failure scenario.** Propose a two-step linear plan with steps [{id:'s1',stepState:'QUEUED'},{id:'s2',stepState:'NOT_READY'}] (accepted — no stepState validation), approve, activate, start+complete s1. Now s2 is on the taken path and permanently stuck: StartExecutionStep is refused (requireFrom ['QUEUED'], execution.ts:698), SkipExecutionStep is refused (requireFrom ['READY','QUEUED'], :958), CancelExecutionStep is refused (requireFrom excludes NOT_READY, :1004, and the machine has no NOT_READY→CANCELLED arrow), PruneExecutionStep is refused (prunableStepIds returns [] — s2 is reachable, :1055-1067). CompleteExecutionPlan then refuses forever ("1 step(s) not in terminal success", :483-491). The plan's only exits are Fail/Cancel/Supersede — exactly the F-5 deadlock DS-004 §10 claims it fixed.

**Suggested fix.** Enforce the convention where the doc says it is enforced: reject at proposeExecutionPlan any step whose authored stepState is not QUEUED (or not in an explicit at-rest allow-list), with RPH_VALIDATION_SEMANTIC_FAILED citing DS-004 D5 — plus a negative test. Alternatively mint the missing NOT_READY→READY / READY→QUEUED commands; do not leave the deadlock reachable from a valid propose.

<details><summary>Code-semantics verifier evidence</summary>

I tried to refute this five ways and could not; then I reproduced it end-to-end through the real command bus.

WHAT I TRIED TO REFUTE WITH, AND WHY EACH FAILED

1. "Propose validates stepState." It does not. `proposeExecutionPlan` (E:\Projects\hestami-ai\JanumiCode\janumiprofessionalworkbench\packages\rph-application\src\handlers\execution.ts:241-278) runs exactly three validators and none of them reads `stepState`: `rejectMalformedTransitionGraph` (:129-151) projects steps to `{ id, stepType }` only; `rejectDuplicateTransitionId` (:158-176) touches transitions; `rejectMalformedTransitionCondition` (:183-210) touches `conditionExpression`. Then `steps: p.steps` is persisted verbatim (:263). `ExecutionStepSchema` (packages\rph-contracts\src\objects.ts:230-242) declares `stepState: StepStateSchema`, i.e. all ten values incl. `NOT_READY`.

2. "The command bus adds a semantic layer." It does not — packages\rph-application\src\command-bus.ts:118-140 is idempotency -> `validateAgainst(spec.payload, ...)` -> handler. No third phase.

3. "Activate normalizes step states." It does not. `activateExecutionPlan` (execution.ts:378-427) is a plain `advanceStatus` on the PLAN's `status` field; it never touches `steps`. `ApplyTacticalChange` (:578-586) is likewise status-only. `supersedeExecutionPlan` (:531-569) also never drives steps.

4. "Some command drives NOT_READY out." None exists. The machine declares the arrows `{from:'NOT_READY', to:'READY', trigger:'ExecutionStepReady'}` and `{from:'READY', to:'QUEUED', trigger:'step scheduled'}` (packages\rph-domain\src\transitions.data.ts:1439-1445), but `HANDLERS` (packages\rph-application\src\handlers\registry.ts, execution block) registers no such command — and the read-model states this outright: `ADVANCE_BY_STEP_STATE = { NOT_READY: [], READY: [], ... }` and `CONTROL_BY_STEP_STATE = { NOT_READY: [], ... }` with the comment "Below the domain's driveable floor (NOT_READY/READY — the initial state, no advance command)" and `isBelowQueued`'s own doc "the initial state that has no advance command (distinct from a terminal state ... which is legitimately done, **not stuck**)" (packages\rph-projections\src\execution-view.ts:103, 120-137, 181-184). The code itself names the condition "stuck".

5. "Prune rescues it." Only if unreachable. `prunableStepIds` (packages\rph-domain\src\transition-gate.ts:323-334) requires `!live.has(s.id)` in addition to `PRUNABLE_SOURCE_STATES.has(s.stepState)`; its doc pins "Empty transitions[] => [] (a linear plan never prunes)". A NOT_READY step on the taken path (or the sole step of a linear plan) is live, so prune is refused.

EMPIRICAL REPRODUCTION (temporary vitest probe against the real `Engine` + `SqliteStorageAdapter`, since deleted). Both shapes proposed ACCEPTED, then every exit refused:

Linear plan `[QUEUED, NOT_READY]`, s1 driven to SUCCEEDED:
- PROPOSE: ACCEPTED
- start:            REJECTED RPH_ILLEGAL_STATE_TRANSITION "requires step ...-s2 to be QUEUED, but it is NOT_READY"
- skip (no waiver): REJECTED RPH_INVARIANT_VIOLATION (mandatory precheck)
- skip (waived, mandatory:false): REJECTED RPH_ILLEGAL_STATE_TRANSITION "requires ... READY or QUEUED, but it is NOT_READY"
- cancel:           REJECTED RPH_ILLEGAL_STATE_TRANSITION "requires ... READY or QUEUED or RUNNING or WAITING, but it is NOT_READY"
- prune:            REJECTED RPH_INVARIANT_VIOLATION "it is still reachable"
- CompleteExecutionPlan: REJECTED RPH_INVARIANT_VIOLATION "has 1 step(s) not in terminal success (NOT_READY)"
- final s2 state: NOT_READY

Single-step plan authored at the machine's own `initialState: 'NOT_READY'` (transitions.data.ts:1435): identical — start/skip/cancel/prune/CompleteExecutionPlan all REJECTED; the plan is wholly inert from the moment it is activated.

So the failureScenario holds byte-for-byte, and the DS-004 claim that QUEUED-at-rest is a convention the design "relies on and ENFORCES" is false: it is relied on and enforced nowhere. (The already-fixed prior finding — the missing NOT_READY->SKIPPED arrow — closed this only for UNREACHABLE steps; the reachable case was never closed.)

SEVERITY CORRECTION: BLOCKER -> MAJOR. It is a genuine permanent completion deadlock reachable from a schema-valid `ProposeExecutionPlan`, but (a) no shipped caller triggers it — the reference undertaking authors `stepState: 'QUEUED'` (packages\rph-engine\src\reference-undertaking.ts:553) and the demo authors `stepState: 'QUEUED'` (apps\rph-demo\src\routes\undertakings\[id]\+page.server.ts:528); (b) every refusal is fail-CLOSED — nothing advances wrongly, no invariant is violated, INV-5 is intact, no state is corrupted; (c) the plan remains terminable via FailExecutionPlan / CancelExecutionPlan / SupersedeExecutionPlan, so the harm is bounded to "this plan can never COMPLETE" rather than a wedged system. The suggested fix (reject a non-at-rest authored `stepState` at `proposeExecutionPlan` with a negative test, or mint the two missing readying/scheduling commands) is correct as written.

MINOR CITATION CORRECTIONS to the original finding (do not change the verdict): the registry is at `packages\rph-application\src\handlers\registry.ts` (not `src\registry.ts`); the prune precheck is at execution.ts:1046-1070 (`requireFrom` at :1041); and the no-waiver Skip is refused by the mandatory precheck (RPH_INVARIANT_VIOLATION) BEFORE `requireFrom` fires — a waived skip is what exposes the `requireFrom` refusal. Both paths still refuse.

</details>

<details><summary>Test-evidence verifier evidence</summary>

REPRODUCED against the real engine with a temporary probe (`packages/rph-application/src/handlers/zz-probe-notready.test.ts`, since DELETED; no source file modified). Verbatim probe output:

PROPOSE: ACCEPTED {}                      // steps [s1 QUEUED, s2 NOT_READY], transitions: []
COMPLETE s1: ACCEPTED {}
s1= SUCCEEDED s2= NOT_READY
  start2:        REJECTED RPH_ILLEGAL_STATE_TRANSITION :: StartExecutionStep requires step ...-s2 to be QUEUED, but it is NOT_READY
  skip2NoWaiver: REJECTED RPH_INVARIANT_VIOLATION      :: skipping a mandatory step requires an authorized plan revision or waiver
  skip2Waived:   REJECTED RPH_ILLEGAL_STATE_TRANSITION :: SkipExecutionStep requires step ...-s2 to be READY or QUEUED, but it is NOT_READY
  cancel2:       REJECTED RPH_ILLEGAL_STATE_TRANSITION :: CancelExecutionStep requires ... READY or QUEUED or RUNNING or WAITING, but it is NOT_READY
  prune2:        REJECTED RPH_INVARIANT_VIOLATION      :: Cannot prune step ...-s2: it is still reachable
  completePlan:  REJECTED RPH_INVARIANT_VIOLATION      :: has 1 step(s) not in terminal success (NOT_READY)
FINAL s2= NOT_READY

Every escape the finding enumerated is refused, including the WAIVED skip (mandatory:false + waiverOrRevisionId — so this is not merely the §21.1 mandatory rule firing first; it is a genuine machine-arrow hole). The plan's only exits are Fail/Cancel/Supersede. The deadlock is exactly as claimed.

WHY NO EXISTING TEST REFUTES IT (the coverage gap):
- Grep for `NOT_READY` across the repo finds exactly two test families touching it, and NEITHER covers a NOT_READY step on the LIVE path:
  (1) `packages/rph-application/src/handlers/execution-start-gate.test.ts:773` "prunes a NOT_READY interior step of a dead arm" — that step is on a BRANCH-EXCLUDED arm, so `liveStepIds` omits it and `prunableStepIds` returns it. That is the one NOT_READY case that IS escapable; it is the CMDPRE fix, and it silently gives the false impression NOT_READY is handled.
  (2) `packages/rph-projections/src/execution-view.test.ts:129,169-178` — asserts NOT_READY offers NO action and `isBelowQueued` is true. These CODIFY the undriveability rather than testing an escape.
- Grep for any propose-time stepState assertion (`rest QUEUED|at-rest|RPH_VALIDATION_SEMANTIC_FAILED.*stepState`) across `packages/` returns ONE hit, and it is a COMMENT, not a check: `execution-start-gate.test.ts:6` "steps stay seeded at QUEUED". The convention is documented in a test header and enforced nowhere.
- `packages/rph-application/src/handlers/registry.ts:123-140` registers no command for `NOT_READY→READY` (`ExecutionStepReady`, `transitions.data.ts:1439`) or `READY→QUEUED` (`transitions.data.ts:1444`) — confirmed independently by grepping the whole of `rph-application/src` for `ExecutionStepReady`/`'READY'`: the only `'READY'` occurrences in `execution.ts` are `requireFrom` lists (:958, :1004, :1041). Both arrows are handler-less, so once a step is authored NOT_READY nothing can ever lift it.
- `packages/rph-domain/src/transition-gate.ts:323-334` `prunableStepIds` filters on `!live.has(s.id)`; a NOT_READY step on the taken path is live, so `[]` — the prune refusal is structural, not incidental.

CORROBORATION FROM THE SHIPPED FIXTURE: `apps/rph-demo/e2e/execution-plan.e2e.ts:150` stages, through the REAL `ProposeExecutionPlan` command, `steps: [mkStep(STEP1,'QUEUED'), mkStep(STEP2,'QUEUED'), mkStep(STEP3,'NOT_READY')]` with `transitions: []` (:151). That is a shipped demo plan that can NEVER reach COMPLETED. The e2e at :227-232 asserts "NO action at all" on step3 — it documents the deadlock as expected UI behaviour instead of catching it.

SECOND, MORE SEVERE CONSEQUENCE OF THE SAME MISSING VALIDATION (also probed, verbatim):
  authored stepState=NOT_READY / READY / RUNNING / SUCCEEDED / SUPERSEDED / FAILED: propose ACCEPTED (all six)
  completePlan(all authored SUCCEEDED): ACCEPTED
i.e. proposing `['SUCCEEDED','SUCCEEDED']`, approving and activating, then `CompleteExecutionPlan` is ACCEPTED with ZERO work performed — no step ever started, no attempt, no result, no floor gate. `proposeExecutionPlan` (execution.ts:240-278) persists `steps: p.steps` verbatim (:263) after only work-unit/graph/duplicate-id/condition checks, and `completeExecutionPlan`'s guard (execution.ts:483-497) reads only the authored `stepState` strings. So the same absent propose-time check is BOTH a deadlock (fail-closed direction) AND a fabricated-success bypass (fail-open direction). The fail-open half is the worse of the two and is not in the original finding.

FIX CAVEAT worth flagging to the parent: many existing suites seed arbitrary states through propose (`activePlan(['SUCCEEDED','QUEUED'])`, `['FAILED','QUEUED']`, `['SKIPPED','QUEUED']` — execution-start-gate.test.ts:209,216,221,232,241). A strict "propose rejects non-QUEUED" rule would go RED across those, which is itself the anti-vacuity proof that nothing enforces the convention today; the fix needs a test-only seeding seam (or an explicit at-rest allow-list) rather than a naive rejection.

Severity held at BLOCKER: a terminal-success-unreachable plan from a fully valid propose, plus an authored-SUCCEEDED completion bypass, both on the ratified §20.1 success path.

</details>

**Live check needed.** None — settled by execution. To re-derive: recreate the probe from `execution-start-gate.test.ts`'s harness with `activePlan(['QUEUED','NOT_READY'])`, drive s1 to SUCCEEDED, and assert Start/Skip(waived)/Cancel/Prune on s2 and CompleteExecutionPlan are all REJECTED; then `activePlan(['SUCCEEDED','SUCCEEDED'])` + CompleteExecutionPlan → ACCEPTED. Run with `cd JanumiCode/janumiprofessionalworkbench/packages/rph-application && bunx vitest run <file> --silent=false --reporter=verbose` (console output is swallowed without `--silent=false`).


## F-10 · [CONFIRMED] [BLOCKER] No lens examined ProposeExecutionPlan's step-id uniqueness: a duplicate step id is accepted and creates a step no command can ever address — a permanent, unrecoverable plan deadlock

- **Lens:** `completeness`
- **Site:** `packages/rph-application/src/handlers/execution.ts:636 (advanceStep `steps.findIndex`) and :240-278 (proposeExecutionPlan — three semantic rejects, all about TRANSITIONS); schema at packages/rph-contracts/src/objects.ts:616 (`steps: z.array(ExecutionStepSchema)`, no refinement); packages/rph-domain/src/transition-gate.ts:570 (validateTransitionGraph short-circuits on `transitions.length === 0`)`

**Claim.** Thirteen lenses covered the surface and not one checked `proposeExecutionPlan` for step-id uniqueness — even though `rejectDuplicateTransitionId` (execution.ts:158-176) exists for EDGE ids with the rationale 'a BRANCH records its decision by transition id'. The identical hazard on STEP ids is unguarded: `ExecutionPlanSchema.steps` is a plain `z.array` with no uniqueness refinement, propose runs only three semantic checks (graph well-formedness, duplicate transition id, malformed condition) and all three are transition-scoped, and `validateTransitionGraph` returns `{ok:true}` immediately for a linear plan — so a LINEAR plan receives NO structural validation whatsoever. `advanceStep` then resolves every step command by `steps.findIndex(s => String(s.id) === args.stepId)`, which always returns index 0. The second copy is therefore addressable by NO command in the registry, while `completeExecutionPlan`'s allow-list (execution.ts:483-491) counts it. Note `buildConditionSubject` (condition-grammar.ts:213-215) collapses the duplicate too, since its accumulator is a Map keyed by step id.

**Failure scenario.** EMPIRICALLY CONFIRMED via a throwaway engine test (probe H1, since deleted). Propose a linear plan with `steps: [{id:'plan-x-s1', stepState:'QUEUED'}, {id:'plan-x-s1', stepState:'QUEUED'}]`, `transitions: []` -> ACCEPTED. Approve, Activate. StartExecutionStep('plan-x-s1') -> ACCEPTED; step states are now `["RUNNING","QUEUED"]` — only copy 0 moved. Every subsequent command aimed at that id also hits copy 0: Start -> REJECTED ('requires QUEUED, but it is RUNNING'), Skip -> REJECTED (same), Cancel -> ACCEPTED (drives copy 0 to CANCELLED), Prune -> REJECTED ('still reachable'). Final observed state `["CANCELLED","QUEUED"]`. CompleteExecutionPlan -> REJECTED forever: 'plan ... has 2 step(s) not in terminal success (CANCELLED, QUEUED)'. Copy 1 is permanently QUEUED with no legal exit; the plan can only ever be Failed/Cancelled/Superseded. This is the exact deadlock class the review's own terminal-success governing rule names, and it needs no graph, no branch and no exotic state — a two-step linear plan with a copy-pasted step id does it.

**Suggested fix.** Add `rejectDuplicateStepId` alongside `rejectDuplicateTransitionId` in proposeExecutionPlan (execution.ts, before the graph checks), rejecting with RPH_VALIDATION_SEMANTIC_FAILED on the first repeat — and/or a `.superRefine` uniqueness rule on `ExecutionPlanSchema.steps` so the contract carries it. Add the propose-time rejection test as the kill test.

<details><summary>Code-semantics verifier evidence</summary>

REAL, UNCOVERED, CODE-GROUNDED — every load-bearing claim verified against the source; severity corrected BLOCKER -> MAJOR.

(1) NO UNIQUENESS IN THE CONTRACT. packages/rph-contracts/src/objects.ts:616 `steps: z.array(ExecutionStepSchema),` and :230-231 `ExecutionStepSchema = z.strictObject({ id: z.string(), ... })`; the command payload repeats it at packages/rph-contracts/src/messages.ts:135 `steps: z.array(ExecutionStepSchema),`. No .refine/.superRefine on any of the three. EXECUTION_PLAN registers `schema: ExecutionPlanSchema` (objects.ts:791-795), so persistence validation inherits the same permissiveness.

(2) PROPOSE'S THREE SEMANTIC CHECKS ARE ALL TRANSITION-SCOPED. packages/rph-application/src/handlers/execution.ts:250-255: rejectMalformedTransitionGraph / rejectDuplicateTransitionId / rejectMalformedTransitionCondition. rejectDuplicateTransitionId (execution.ts:158-176) iterates `p.transitions` ONLY, rejecting with "transition id \"${id}\" is declared more than once — transition ids must be unique (a BRANCH records its decision by transition id)." Repo-wide grep for `rejectDuplicate` yields exactly two hits (definition + call site). There is no step-id analogue anywhere in packages/.

(3) A LINEAR PLAN RECEIVES NO STRUCTURAL VALIDATION. packages/rph-domain/src/transition-gate.ts:570 `if (transitions.length === 0) return { ok: true }; // linear plan — no graph to validate`. With `transitions: []` the only other reachable check (rejectMalformedTransitionCondition) loops over the same empty array. Confirmed as claimed.

(4) ADDRESSING COLLAPSE. execution.ts:636 `const idx = steps.findIndex((s) => String(s.id) === args.stepId);` — first match only; :657 `const newSteps = steps.map((s, i) => (i === idx ? nextStep : s));` mutates that index alone. Every step command in the registry funnels through this single advanceStep primitive, so the second copy is addressable by NO command.

(5) THE DEADLOCK FOLLOWS DETERMINISTICALLY. completeExecutionPlan's guard counts the raw array: execution.ts:483-485 `const offenders = steps.filter((s) => s.stepState !== 'SUCCEEDED' && s.stepState !== 'SKIPPED');` -> rejects while copy 1 remains QUEUED, and copy 1 can never leave QUEUED because nothing can select it. COMPLETED becomes permanently unreachable; only Fail/Cancel/Supersede remain. This is exactly the terminal-success deadlock class the review's governing rules name, and it needs no graph, no BRANCH, no exotic state. The static chain (no refinement -> no propose check -> linear short-circuit -> findIndex -> completion filter) closes without execution, so the critic's deleted probe is corroborative, not load-bearing.

(6) ANTI-VACUITY ASYMMETRY. The sibling hazard has a kill test — execution-start-gate.test.ts:1007 `expect(r.error?.message).toContain('declared more than once')`. Grep across packages/ for any duplicate-STEP-id assertion returns nothing: no guard and no test.

SEVERITY CORRECTION (BLOCKER -> MAJOR, not a refutation). No in-repo caller can produce the input: apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts:500-501 mints ids (`const stepId = mintUiId('step')`) for a single step, and the reference undertaking likewise; the trigger is malformed authored payload, and the plan retains Fail/Cancel/Supersede exits, so "unrecoverable" overstates it. What keeps it a genuine defect: (a) precedent inconsistency — the kernel already spends a propose-time RPH_VALIDATION_SEMANTIC_FAILED on the IDENTICAL hazard one field over, for a strictly weaker consequence (ambiguous BRANCH selection/render) than this one (an uncompletable plan); (b) fail-open by absence — an unstated uniqueness constraint currently defaults to ACCEPT, the inverse of the fail-closed default this surface is governed by. Fix as suggested: `rejectDuplicateStepId` alongside rejectDuplicateTransitionId in proposeExecutionPlan, ahead of the graph checks, plus the propose-time rejection kill test.

</details>

**Live check needed.** None required — settled statically. Optional confirmation: add to packages/rph-application/src/handlers/execution-start-gate.test.ts a linear plan with two steps sharing one id and assert r.status === 'REJECTED' (ACCEPTED today); run from packages/rph-application with `node ../../node_modules/vitest/vitest.mjs run <file> --reporter=verbose --disable-console-intercept` (better-sqlite3 refuses the Bun runtime).


## F-11 · [CONFIRMED] [MAJOR] ResolveExecutionStepWait's requireFrom['WAITING'] — the QUEUED exclusion (which carries RPH-EXE-005 AND RPH-EXE-008) has no test; only the RUNNING NOOP mutant is killed

- **Lens:** `anti-vacuity`
- **Site:** `packages/rph-application/src/handlers/execution.ts:1113`

**Claim.** The single negative test (execution-start-gate.test.ts:610, 'a resume from a non-WAITING state') resumes from RUNNING, killing only the deletion mutant via the RUNNING→RUNNING NOOP. It does not touch the widening mutant. The ExecutionStep.stepState machine legalises QUEUED→RUNNING (transitions.data.ts, `{ from: 'QUEUED', to: 'RUNNING' }`), so for a QUEUED step requireFrom is again the SOLE refuser — verified live: dispatching ResolveExecutionStepWait on a never-waiting QUEUED step is rejected with requireFrom's own verbatim message ('...requires step ... to be WAITING, but it is QUEUED ... this command declares drivesFrom WAITING'), i.e. checkTransition never fired. Grep-proven that no test dispatches Resolve on a QUEUED step: the only sites in the whole repo are the `resolve` helper at execution-start-gate.test.ts:557 and :663, all against WAITING or RUNNING.

**Failure scenario.** Widen requireFrom to ['WAITING','QUEUED'] — the entire suite stays GREEN, while a 'resume' of a step that never waited becomes ACCEPTED, with two distinct bypasses. (a) RPH-EXE-008: the step reaches RUNNING emitting only ExecutionStepWaitResolved, and attemptsMadeForStep (execution.ts:880) counts ExecutionStepStarted ONLY — so a RUNNING episode executes with the attempt counter untouched and the retry cap silently over-spent. (b) RPH-EXE-005: unlike startExecutionStep (execution.ts:708-738), resolveExecutionStepWait has NO start-gate precheck at all — only plan-ACTIVE. So on a linear plan ['QUEUED','QUEUED','QUEUED','QUEUED','QUEUED'], dispatching ResolveExecutionStepWait on step 5 drives it straight to RUNNING while steps 1-4 are still QUEUED — an out-of-order start that startStepGate exists to refuse, and that no assertion anywhere detects.

**Suggested fix.** Add the QUEUED-source kill test above. Separately, consider whether resolveExecutionStepWait should also run startStepGate — today the guard's sole defence against an out-of-order resume is the requireFrom string set, with no independent gate behind it.

<details><summary>Code-semantics verifier evidence</summary>

CONFIRMED against the real code path; every cited line read.

(1) ORDERING — requireFrom is reached and is the SOLE refuser for a QUEUED source. advanceStep (packages/rph-application/src/handlers/execution.ts:645-655):
    const precheckFailure = args.precheck?.(step, plan);
    if (precheckFailure) return precheckFailure;
    if (args.requireFrom && !args.requireFrom.includes(String(step.stepState)))
        return reject(command, 'RPH_ILLEGAL_STATE_TRANSITION', `${command.commandType} requires step ${args.stepId} to be ${args.requireFrom.join(' or ')}, but it is ${String(step.stepState)}. The stepState machine may permit that arrow for a DIFFERENT command; this command declares drivesFrom ${args.requireFrom.join('|')}.`, [args.stepId]);
    const illegal = checkTransition(command, STEP_MACHINE, String(step.stepState), args.target);
Order is precheck -> requireFrom -> machine, so the finding's "verified live" claim is settled STATICALLY: on an ACTIVE plan the precheck passes and requireFrom rejects before checkTransition is consulted. No live check needed.

(2) NO GUARD BEHIND IT. resolveExecutionStepWait's precheck (execution.ts:1119-1126) is plan-ACTIVE ONLY: `plan.status === 'ACTIVE' ? null : reject(... 'Cancel the step instead.')`. By contrast startExecutionStep (execution.ts:708-738) runs plan-ACTIVE AND `startStepGate(gatePlan, p.stepId, guardEvaluatorFor(ctx, command.targetAggregateId, gatePlan))` rejecting with the RPH-EXE-005 message. Resolve has NO start-gate. Also no independent precondition layer exists: the command registry entry (packages/rph-contracts/src/messages.ts:1793-1798) carries only payload/targetAggregateType/emitsEvent/firstSlice — no fromStates.

(3) THE MACHINE LEGALISES THE WIDENED ARROW. STEP_MACHINE = 'ExecutionStep.stepState' (execution.ts:56); that machine block is transitions.data.ts:1421-1483, and its legal list contains `{ from: 'QUEUED', to: 'RUNNING', trigger: 'startExecutionStep / ExecutionStepStarted' }` (transitions.data.ts:1445). So widening requireFrom to ['WAITING','QUEUED'] produces ACCEPTED, not a machine refusal — precisely the hole advanceStep's own doc-comment (execution.ts:616-621) says requireFrom exists to close.

(4) NO TEST DISPATCHES RESOLVE ON A QUEUED STEP. Repo-wide grep for ResolveExecutionStepWait|resolveExecutionStepWait yields exactly two test dispatch sites: the `resolve` helper (execution-start-gate.test.ts:555-561) and the direct dispatch at :663 — both against WAITING or RUNNING. The three positives (:564, :576, :597) all `start(1)` then `wait(1)` first. The only negatives are :610 (`expect(resolve(1).status, 'RUNNING has no →RUNNING resume arrow').toBe('REJECTED')` — kills only the DELETION mutant via the RUNNING→RUNNING NOOP; unaffected by widening) and :624 (WAITING under a CANCELLED plan — kills the PRECHECK, not the source set). execution-step-reissue-guard.test.ts never mentions Resolve. The e2e assertions at apps/rph-demo/e2e/execution-plan.e2e.ts:245-248 ("neither is offered on a QUEUED/NOT_READY step", `step-action-resolve` toHaveCount(0)) test the UI AFFORDANCE, computed independently of this guard — they stay green under the mutant too.

(5) BOTH BYPASSES SUBSTANTIATED.
  - RPH-EXE-008: attemptsMadeForStep (execution.ts:880-890) counts ExecutionStepStarted ONLY; retryExecutionStep's precheck (execution.ts:925-931) feeds that count to retryDecision. A widened QUEUED→RUNNING resume emits only ExecutionStepWaitResolved, so the RUNNING episode leaves attemptsMade at 0 — with maxAttempts=3 the step can occupy RUNNING 4 times (1 resume + 3 starts).
  - RPH-EXE-005: with no startStepGate, on activePlan(['QUEUED','QUEUED','QUEUED','QUEUED','QUEUED']) a Resolve on step 5 drives it to RUNNING while steps 1-4 are QUEUED. Nothing in the handler chain detects it.

ONE CORRECTION TO THE FINDING (does not change the verdict): it understates existing coverage — the outright DELETION mutant IS killed by :610 (delete requireFrom and RUNNING→RUNNING is NOOP-admitted, so the assertion goes from REJECTED to ACCEPTED = RED). The unkilled mutant is specifically the WIDENING one, which is the load-bearing one here because QUEUED→RUNNING is a legal machine arrow and requireFrom is the only thing refusing it. This is narrower than the already-fixed Fail/Retry cases (where deletion itself survived) but the same class, and the guard carries two invariants with nothing behind it — MAJOR stands.

FIX/KILL TEST (as proposed, verified to be the right shape): in the 'WAIT + resume (DWP-04)' describe of packages/rph-application/src/handlers/execution-start-gate.test.ts, add: activePlan(['QUEUED','QUEUED']); const r = resolve(2); expect(r.status).toBe('REJECTED'); expect(r.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION'); expect(r.error?.message).toContain('drivesFrom WAITING'); expect(stepStateOf(2)).toBe('QUEUED'); expect(startedCount(2)).toBe(0). Separately worth considering whether resolveExecutionStepWait should run startStepGate as a defence-in-depth behind the string set.

</details>

<details><summary>Test-evidence verifier evidence</summary>

CONFIRMED as a real, test-grounded coverage gap; severity corrected MAJOR -> MINOR.

WHAT I RAN (temporary probe at packages/rph-application/src/handlers/zz-probe-tmp.test.ts, created, run, DELETED; git status confirms it is gone and I modified no source file):
  A resolve(5) on ACTIVE linear ['QUEUED' x5] -> REJECTED / RPH_ILLEGAL_STATE_TRANSITION / "ResolveExecutionStepWait requires step ...-s5 to be WAITING, but it is QUEUED. ... this command declares drivesFrom WAITING."
  A start(5) same state -> REJECTED / "Cannot start step ...-s5: a predecessor (...-s1) is QUEUED ... (RPH-EXE-005)."
  B activePlan(['QUEUED','QUEUED']); start(1); complete(1); resolve(2) -> REJECTED with the SAME requireFrom verbatim message; then start(2) -> ACCEPTED.
  C resolve(1) from QUEUED -> REJECTED (same message); ExecutionStepStarted count = 0, stepState still QUEUED.

WHY B SETTLES IT (sole-refuser proof, independent of the code-reading argument): in the exact state where resolve(2) is refused, StartExecutionStep on the same step is ACCEPTED. That empirically proves the plan-ACTIVE precheck passes, startStepGate passes, and checkTransition(QUEUED->RUNNING) admits (machine arrow at transitions.data.ts:1445). requireFrom['WAITING'] (execution.ts:1113) is therefore the ONLY thing refusing a QUEUED-source resume. Widening it to ['WAITING','QUEUED'] would ACCEPT.

COVERAGE GAP (grep-proven, whole repo): ResolveExecutionStepWait is dispatched from exactly three test sites, all in packages/rph-application/src/handlers/execution-start-gate.test.ts -- the `resolve` helper (:555-561) used at :570, :580, :601, :624, plus the inline dispatch at :663. Every one targets step 1 in state WAITING or RUNNING. No test in any package, and no e2e spec, ever dispatches it on a QUEUED step (the only other caller in the repo is the UI action apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts:628). So the widening mutant changes no assertion: the suite stays GREEN.

CONSEQUENCE OF THE MUTANT IS REAL (both bypasses verified): (a) RPH-EXE-008 -- probe C shows the resolve path emits no ExecutionStepStarted, and attemptsMadeForStep (execution.ts:880) counts ExecutionStepStarted only, so a widened guard opens a RUNNING episode with the attempt counter untouched; (b) RPH-EXE-005 -- probe A shows Start on an out-of-order step is caught by startStepGate while Resolve is caught only by requireFrom (resolve's precheck, execution.ts:1119-1126, is plan-ACTIVE ONLY, vs start's gate at :708-738), so a widened guard turns Resolve into a gate-free out-of-order start.

WHY SEVERITY DROPS TO MINOR: execution-step-reissue-guard.test.ts:1-15 records the project's own accepted requireFrom mutation standard -- widen the set to admit the TARGET state. For resolveExecutionStepWait (target RUNNING) that mutant is ['WAITING','RUNNING'], and it IS killed by execution-start-gate.test.ts:610, which resumes a RUNNING step and expects REJECTED (weakened -> checkTransition NOOP-admits -> test RED). The deletion mutant is killed by the same test, and for the RIGHT reason (requireFrom's own message fires; the precheck does not pre-empt it). So unlike the two sibling MAJORs (FailExecutionStep/RetryExecutionStep, which had NO kill test at all), this guard is not vacuous -- only the non-target-state widening survives. There is also no live defect: no legal route reaches WAITING out-of-order (EnterExecutionStepWait requires RUNNING, which requires the start-gate; a SUCCEEDED predecessor cannot be re-opened since Complete/Fail require RUNNING and Retry requires FAILED), and resume under a non-ACTIVE plan is already covered at :613-629. The fix is a one-case test addition, exactly as the finding proposes.

BASELINE: `bunx vitest run src/handlers/execution-start-gate.test.ts src/handlers/execution-step-reissue-guard.test.ts` -> 2 files, 44 tests, all passing.

</details>

**Live check needed.** Live mutation red-proof (temporarily widening execution.ts:1113 to ['WAITING','QUEUED'] and running the full rph-application suite) was NOT performed: the verifier brief forbids modifying source, and concurrent verifier agents currently hold uncommitted mutations in the same file (skipExecutionStep:958, cancelExecutionStep:1004, enterExecutionStepWait:1087 were observed mutated mid-session). The grep census of all three Resolve dispatch sites makes the outcome deterministic, but if a definitive red-proof is wanted, run it on a clean tree once the sibling agents finish.


## F-12 · [CONFIRMED] [MAJOR] CancelExecutionStep's requireFrom has ZERO negative tests anywhere in the repo — deleting it appends a second, contradicting ExecutionStepCancelled with the suite green

- **Lens:** `anti-vacuity`
- **Site:** `packages/rph-application/src/handlers/execution.ts:1004`

**Claim.** cancelExecutionStep has NO precheck at all (deliberately, so cleanup works under a terminal plan), so requireFrom ['READY','QUEUED','RUNNING','WAITING'] is the only guard other than checkTransition — and checkTransition classifies from===to as NOOP and ADMITS it (kit.ts:171-185). Its declared set is byte-identical to the machine's in-arrow set to CANCELLED (transitions.data.ts: READY/QUEUED/RUNNING/WAITING → CANCELLED), so its ONLY live effect is refusing the CANCELLED→CANCELLED re-issue — and nothing tests that. Grep-proven: the only CancelExecutionStep dispatches in the entire repo outside the app are execution-step-skip-cancel.test.ts:168 and :178, both POSITIVE; no test anywhere asserts a refusal of this command. This is the identical class to the two MAJORs already fixed on FailExecutionStep/RetryExecutionStep, and is the cleanest remaining instance.

**Failure scenario.** RUN AND CONFIRMED. start(s1) → CancelExecutionStep(s1, reason:'operator aborted') ACCEPTED → re-issue CancelExecutionStep(s1, reason:'plan superseded'). Today it is REJECTED and exactly one ExecutionStepCancelled exists — and the rejection message is verbatim requireFrom's ('...but it is CANCELLED ... this command declares drivesFrom READY|QUEUED|RUNNING|WAITING'), proving requireFrom is the sole refuser. Delete requireFrom (or widen it to include 'CANCELLED') and the whole suite stays GREEN while that second dispatch is ACCEPTED: a SECOND ExecutionStepCancelled carrying a CONTRADICTING reason is appended to the append-only governed stream and the plan revision is bumped for a transition that did not happen — exactly the INV-2/INV-6 harm execution-step-reissue-guard.test.ts was written to close for its two siblings.

**Suggested fix.** Add the CANCELLED→CANCELLED re-issue kill test to execution-step-reissue-guard.test.ts (which already documents the mutation red-proof protocol for this exact class), asserting the code AND the no-second-append property so it cannot be satisfied by a different layer rejecting.

<details><summary>Code-semantics verifier evidence</summary>

CONFIRMED by static trace AND a live mutation run. Every link in the claim holds.

1) `cancelExecutionStep` has NO precheck — requireFrom is the only handler-layer guard.
`packages/rph-application/src/handlers/execution.ts:998-1011`:
```
export const cancelExecutionStep: CommandHandler = (ctx, command) => {
	const p = command.payload as CancelExecutionStepPayload;
	return advanceStep(ctx, command, {
		stepId: p.stepId, target: 'CANCELLED', eventType: 'ExecutionStepCancelled',
		requireFrom: ['READY', 'QUEUED', 'RUNNING', 'WAITING'], // execution.ts:1004
		eventPayload: { stepId: p.stepId, reason: p.reason, stepState: 'CANCELLED' }
	});
};
```
No `precheck` key at all (deliberate — the doc comment says cancel is cleanup permitted under a SUPERSEDED plan). Contrast `skipExecutionStep` (execution.ts:966+) which does carry a plan-ACTIVE + canSkipStep precheck.

2) `advanceStep` order (execution.ts:645-655): `precheck` (absent here) → `requireFrom` (647) → `checkTransition` (654). Nothing earlier can refuse the re-issue.

3) `checkTransition` ADMITS the self-edge. `packages/rph-application/src/handlers/kit.ts:171-185`: `if (c.klass === 'LEGAL' || c.klass === 'NOOP') return null;`. `classifyTransition` (packages/rph-domain/src/stateMachine.ts:38-56) consults `m.illegal` first, then `if (from === to) return { klass: 'NOOP' }`. The `ExecutionStep.stepState` machine's `illegal` table (transitions.data.ts:1484-1491) contains exactly ONE entry — `NOT_READY -> RUNNING` — so CANCELLED→CANCELLED classifies NOOP and is admitted.

4) requireFrom is byte-identical to the machine's in-arrow set to CANCELLED (transitions.data.ts:1474-1477: READY/QUEUED/RUNNING/WAITING → CANCELLED), so every non-listed source other than CANCELLED itself is already refused by checkTransition as ILLEGAL_UNDEFINED. The guard's ONLY live effect is refusing the CANCELLED→CANCELLED re-issue.

5) LIVE PROOF (ran under vitest/bun x, not Bun-run engine). Temp probe: propose+approve+activate plan, start(s1), Cancel(reason 'operator aborted') → ACCEPTED, then re-issue Cancel(reason 'plan superseded') with a distinct commandId/idempotencyKey.
- BASELINE: `SECOND CANCEL STATUS = REJECTED`, error code `RPH_ILLEGAL_STATE_TRANSITION`, message verbatim requireFrom's ("CancelExecutionStep requires step ... to be READY or QUEUED or RUNNING or WAITING, but it is CANCELLED ... this command declares drivesFrom READY|QUEUED|RUNNING|WAITING"), `CANCEL EVENT COUNT = 1`. Proves requireFrom is the sole refuser.
- MUTANT (widened requireFrom to include 'CANCELLED', execution.ts:1004): `SECOND CANCEL STATUS = ACCEPTED`, `CANCEL EVENT COUNT = 2`, `REASONS = ["operator aborted","plan superseded"]` — a second, CONTRADICTING ExecutionStepCancelled appended to the append-only stream, plan revision bumped, for a transition that did not happen.
- ANTI-VACUITY: with the mutant in place the ENTIRE genuine rph-application suite is GREEN — `Test Files 45 passed (45) / Tests 352 passed | 1 skipped`. (Run excluded three `zz*.test.ts` probe files a concurrent sibling agent left in the tree; they are not part of the committed suite. execution.ts has been restored — `git diff` on it is now empty.)

6) No other layer kills it: `packages/rph-contracts/src/messages.ts:270-274` / :1775-1780 validate only `{stepId, reason}` shape — no state guard. The read-model `packages/rph-projections/src/execution-view.ts:138-141` offers `cancel` only from READY/QUEUED/RUNNING/WAITING, but that is an advisory affordance in a different package and its test (execution-view.test.ts:110-119) asserts affordances, not refusals — so neither the UI nor any e2e drives a double-cancel. Grep confirms the only CancelExecutionStep dispatches outside the app are execution-step-skip-cancel.test.ts:88 (helper) used at the two POSITIVE tests ('cancels a RUNNING step → CANCELLED', 'cancels a step under a SUPERSEDED plan'); `execution-step-reissue-guard.test.ts` contains exactly two `it(` blocks, :126 (Fail) and :150 (Retry), and zero Cancel/CANCELLED references.

This is the identical unkilled-mutant class as the two already-fixed MAJORs on FailExecutionStep/RetryExecutionStep (CON-000 B7). Severity MAJOR stands: the guard is correct today, but nothing pins it, and the harm on weakening is a contradicting duplicate governed event (INV-2/INV-6). Fix as proposed: add the CANCELLED→CANCELLED kill test to execution-step-reissue-guard.test.ts asserting REJECTED + code `RPH_ILLEGAL_STATE_TRANSITION` + `eventsOfType('ExecutionStepCancelled')` still length 1.

</details>

<details><summary>Test-evidence verifier evidence</summary>

SETTLED BY LIVE EXECUTION, BOTH DIRECTIONS. I wrote a temporary probe (packages/rph-application/src/handlers/zz-probe-cancel-reissue.test.ts, now DELETED — confirmed absent; I modified no source file) that drives the real Engine: activate a 1-step plan -> StartExecutionStep -> CancelExecutionStep('operator aborted') -> re-issue CancelExecutionStep('plan superseded - a CONTRADICTING reason'). The probe also prints the LIVE registered handler source via HANDLERS['CancelExecutionStep'] so the observation cannot be confused about which code ran.

(1) BASELINE (source verified unmutated: `git diff --stat` clean for execution.ts, and the printed handler source reads requireFrom ["READY","QUEUED","RUNNING","WAITING"]) — the re-issue is REJECTED:
  REISSUE: REJECTED {"code":"RPH_ILLEGAL_STATE_TRANSITION", ... "message":"CancelExecutionStep requires step plan_...-s1 to be READY or QUEUED or RUNNING or WAITING, but it is CANCELLED. The stepState machine may permit that arrow for a DIFFERENT command; this command declares drivesFrom READY|QUEUED|RUNNING|WAITING."}
  ExecutionStepCancelled count: 1 ; reasons: ["operator aborted"]
That message is byte-for-byte advanceStep's requireFrom refusal (packages/rph-application/src/handlers/execution.ts:647-653), NOT checkTransition's ("Illegal transition on ..."), so requireFrom is the SOLE live refuser. Confirmed structurally: cancelExecutionStep (execution.ts:998-1011) passes NO `precheck` (deliberately, so cleanup works post-supersession), and the probe printed classifyTransition('ExecutionStep.stepState','CANCELLED','CANCELLED') = {"klass":"NOOP"} — and checkTransition (kit.ts:171-185) returns null for LEGAL **or** NOOP, i.e. it ADMITS it. The machine's in-arrows to CANCELLED (transitions.data.ts:1474-1477: READY/QUEUED/RUNNING/WAITING) are byte-identical to requireFrom, so refusing the same-state re-issue is requireFrom's ONLY live effect (SUCCEEDED->CANCELLED and NOT_READY->CANCELLED both print ILLEGAL_UNDEFINED, i.e. already caught by the machine).

(2) MUTANT (a concurrent verifier agent had, at that moment, widened the set to ['READY','QUEUED','RUNNING','WAITING','CANCELLED'] — `git diff` showed "+ requireFrom: [...,'CANCELLED'], // MUTANT (temporary)"; the printed handler source confirmed the five-element array was what actually executed). Same probe, same sequence:
  REISSUE: ACCEPTED (no error)
  ExecutionStepCancelled count: 2 ; reasons: ["operator aborted","plan superseded — a CONTRADICTING reason"]
A SECOND ExecutionStepCancelled carrying a contradicting reason is appended to the append-only governed stream and the plan revision is bumped for a transition that did not happen — exactly the INV-2/INV-6 harm.

(3) THE KILL-TEST GAP (the anti-vacuity point). With that mutant LIVE I ran the ENTIRE rph-application suite (`bunx vitest run`, excluding only my own probe): **Test Files 46 passed (46) | Tests 355 passed | 1 skipped (356) — ZERO failures. GREEN.** Nothing in the repo kills the mutation. Corroborated by coverage search: the only CancelExecutionStep dispatches outside the demo app are execution-step-skip-cancel.test.ts:168 (cancel a RUNNING step) and :178 (cancel under a SUPERSEDED plan) — both POSITIVE, no negative anywhere. The near-miss files do NOT cover it: command-reissue-guard.test.ts covers only RuntimeBinding/Intent; dwp05-precondition-coverage.test.ts:186 covers CancelExecution**Plan** (plan status machine), not the step; execution-step-reissue-guard.test.ts covers only Fail and Retry (the two already-fixed siblings). rph-projections/src/execution-view.test.ts:129-130 ("offers NO control action from ... any terminal state") only asserts the READ-MODEL withholds the button — a UI affordance, not a command refusal — and stays green under the mutant. No e2e drives a double-cancel either: apps/rph-demo/e2e/execution-plan.e2e.ts:232/243/265/271 only assert which cancel buttons are rendered.

CONCLUSION: the guard at execution.ts:1004 is real, live, and load-bearing (baseline proves it is the sole refuser); its removal/weakening is a genuine INV-2/INV-6 defect (mutant proves the harm); and NO test in the repository goes red when it is weakened (full-suite green under the mutant proves the vacuity). This is the identical class to the two MAJORs already fixed on FailExecutionStep/RetryExecutionStep. Fix as proposed: add the CANCELLED->CANCELLED kill test to execution-step-reissue-guard.test.ts asserting REJECTED + code RPH_ILLEGAL_STATE_TRANSITION + eventsOfType('ExecutionStepCancelled') length still 1 (the no-second-append property, so it cannot be satisfied by a different layer).

CAVEAT ON PROVENANCE: the mutant in step (2)/(3) was applied and later reverted by a CONCURRENT reviewer agent, not by me — I only observed it. At the 18:20:00 full-suite run a second unrelated mutant (enterExecutionStepWait requireFrom widened with 'WAITING') was also live; that does not weaken the conclusion, since zero repo tests failed under either.

</details>

**Live check needed.** None — settled by live execution. (Note for the orchestrator: other concurrent agents currently leave zz-probe-entry-edge.test.ts, zz-probe-join-retry.test.ts, zz-testevidence-wait-probe.test.ts, zz-verifier-rewait.test.ts, zz-verify-entry-edge.test.ts, zz-verify-join-tmp.test.ts, rph-domain/src/zz-tmp-lte-probe.test.ts, rph-domain/src_mutant/ and an in-flight edit to packages/rph-application/src/handlers/execution.ts in the tree. None are mine — my probe file was deleted and verified gone — but they must be cleaned up before commit.)


## F-13 · [CONFIRMED] [MAJOR] SkipExecutionStep's requireFrom has no re-issue kill test; its only 'negative' (start-gate:699) is refused by canSkipStep, a different check

- **Lens:** `anti-vacuity`
- **Site:** `packages/rph-application/src/handlers/execution.ts:958`

**Claim.** requireFrom ['READY','QUEUED'] is the sole refuser of a SKIPPED→SKIPPED re-issue: precheck limb A (plan-ACTIVE) passes on a live plan and precheck limb B (canSkipStep) passes outright on mandatory:false, then checkTransition ADMITS the NOOP. Verified live — the re-issue rejection message is verbatim requireFrom's ('...but it is SKIPPED ... declares drivesFrom READY|QUEUED'). Every skip in the suite skips a QUEUED step exactly once: execution-step-skip-cancel.test.ts:129/:136/:144/:151/:158, execution-start-gate.test.ts:694/:826/:976. The existing refusal tests are all class-(b) vacuous with respect to THIS guard — :136/:144 reject via canSkipStep's RPH_INVARIANT_VIOLATION, :203 via the plan-ACTIVE precheck, :699 via canSkipStep again. None of them flips if requireFrom is removed.

**Failure scenario.** RUN AND CONFIRMED. skip(s1,{mandatory:false}) ACCEPTED → re-issue skip(s1,{mandatory:false}). Today REJECTED with requireFrom's message and exactly one ExecutionStepSkipped. Delete requireFrom and the suite stays GREEN while the second dispatch appends a SECOND ExecutionStepSkipped and bumps the revision for a non-transition. A second, subtler mutation also survives: widening to ['NOT_READY','READY','QUEUED'] is green today, because the review's own NOT_READY→SKIPPED arrow (added for prune) makes that a LEGAL machine transition — silently giving Skip a second route into prune's territory, reachable on a step that was never scheduled.

**Suggested fix.** Add the SKIPPED→SKIPPED re-issue kill test, and a second case pinning the NOT_READY exclusion (skip a NOT_READY step with mandatory:false and assert REJECTED naming drivesFrom READY|QUEUED) — otherwise the widening mutant remains unkilled even after the re-issue test lands.

<details><summary>Code-semantics verifier evidence</summary>

I tried to refute this on three independent routes (an earlier guard, an existing kill test elsewhere, and a machine-level refusal) and all three failed. It holds.

1) ORDER OF GUARDS — requireFrom really is the LAST line before the machine, and the machine admits the NOOP.
`packages/rph-application/src/handlers/execution.ts:644-655`:
```
const step = steps[idx] as Record<string, unknown>;
const precheckFailure = args.precheck?.(step, plan);
if (precheckFailure) return precheckFailure;
if (args.requireFrom && !args.requireFrom.includes(String(step.stepState)))
    return reject(command,'RPH_ILLEGAL_STATE_TRANSITION', `${command.commandType} requires step ... but it is ${String(step.stepState)}. ...`, [args.stepId]);
const illegal = checkTransition(command, STEP_MACHINE, String(step.stepState), args.target);
```
`kit.ts:177-178`: `const c = classifyTransition(...); if (c.klass === 'LEGAL' || c.klass === 'NOOP') return null;` and `stateMachine.ts:48-50` consults the `illegal` table then `if (from === to) return { klass: 'NOOP' }`. The `ExecutionStep.stepState` machine's `illegal` array (verified raw via `sed | cat -v`, transitions.data.ts:1484-1491) contains ONLY `NOT_READY -> RUNNING` — no SKIPPED self-edge. So SKIPPED->SKIPPED classifies NOOP and checkTransition admits it.

2) NO EARLIER GUARD CATCHES IT. skipExecutionStep's precheck (execution.ts:966-986) has exactly two limbs: `plan.status !== 'ACTIVE'` (passes on a live plan) and `canSkipStep({mandatory: p.mandatory ?? true, ...})` (passes outright on `mandatory:false`). The bus pipeline (command-bus.ts:1-9) is idempotency -> payload zod -> handler; a re-issue with a fresh idempotencyKey is a distinct request; registry.ts:135 routes straight to `skipExecutionStep` with no JAN-CMDPRE `precondition` layer (that lives on kit.advanceStatus, which Skip does not use).

3) LIVE PROBE (written, run under the repo's vitest/Node, then deleted; my temporary source mutation was reverted — `git diff` now shows no change on the skip line):
- PROBE-A: activate plan, `skip(s1,{mandatory:false})` ACCEPTED, then re-issue `skip(s1,{mandatory:false,waiverOrRevisionId:'dec_contradicting'})` ->
  `status= REJECTED code= RPH_ILLEGAL_STATE_TRANSITION`, message verbatim requireFrom's: "SkipExecutionStep requires step ... to be READY or QUEUED, but it is SKIPPED. ... this command declares drivesFrom READY|QUEUED." `ExecutionStepSkipped` count = 1. => requireFrom is the SOLE refuser, exactly as claimed.
- PROBE-B: `skip(NOT_READY step,{mandatory:false})` -> REJECTED with the SAME requireFrom message ("...but it is NOT_READY"), skipped-event count 0. Since transitions.data.ts:1469-1473 declares a real `NOT_READY -> SKIPPED` arrow (added for prune), the widening mutant ['NOT_READY','READY','QUEUED'] would be machine-LEGAL and canSkipStep-clean — i.e. also silent.

4) NO KILL TEST EXISTS. `execution-step-reissue-guard.test.ts` (the CMDPRE remediation file) covers ONLY FailExecutionStep (line 126) and RetryExecutionStep (line 150) — its own header says so. Every other Skip dispatch in the repo is on a QUEUED step: execution-step-skip-cancel.test.ts:131/:138/:146/:153/:160 (the refusals at :138/:146 are canSkipStep RPH_INVARIANT_VIOLATION, and :217 is the plan-ACTIVE precheck), execution-start-gate.test.ts:693-699 (mandatory omitted -> canSkipStep), :826 helper, :976. All class-(b) vacuous w.r.t. requireFrom.

5) The one place a re-issue DOES occur asserts nothing about it — extra proof the mutant is silent. execution-start-gate.test.ts:867 is `expect(skip(2).status, JSON.stringify(skip(2))).toBe('ACCEPTED');` — JS evaluates both arguments, so `skip(2)` is dispatched TWICE and the second (on the now-SKIPPED step) is used only as the failure MESSAGE. Under the mutation that second dispatch would be ACCEPTED, appending a second ExecutionStepSkipped and bumping the revision, while :868 (`stepStateOf(2) === 'SKIPPED'`), :869-873 (structural deadness of s4) and :878 (CompleteExecutionPlan) all still pass. Since the only machine-legal non-{READY,QUEUED} sources into SKIPPED are NOT_READY and the SKIPPED NOOP, and no test exercises either with an assertion, both the deletion mutant and the ['NOT_READY',...] widening mutant survive the whole suite.

Severity MAJOR is correct and consistent with the two already-fixed siblings (Fail/Retry requireFrom), which were the identical class on the identical primitive. The suggested fix is right: a SKIPPED->SKIPPED re-issue kill test (REJECTED + RPH_ILLEGAL_STATE_TRANSITION + ExecutionStepSkipped count still 1) plus a NOT_READY-exclusion case, since the re-issue test alone does not kill the widening mutant. Worth also fixing execution-start-gate.test.ts:867's accidental double dispatch while there.

</details>

<details><summary>Test-evidence verifier evidence</summary>

TEST-EVIDENCE lens, settled independently. Two halves: (1) no existing test proves the behaviour, (2) live probe + code path show requireFrom is the sole refuser.

COVERAGE HALF — exhaustive enumeration of every `SkipExecutionStep` dispatch site in the repo (grep across packages/ + apps/):
- execution-step-skip-cancel.test.ts:129/:136/:144/:151/:158 — all skip a QUEUED step exactly once. :136/:144 reject via canSkipStep (RPH_INVARIANT_VIOLATION, mandatory fail-closed); :203 rejects via the plan-ACTIVE precheck. None touches a SKIPPED or NOT_READY source state.
- execution-start-gate.test.ts:694 (rejects via canSkipStep — mandatory defaults TRUE), :826 helper, :890, :976 — all QUEUED, `mandatory:false`.
- execution-plan-completion.test.ts — only a comment; it seeds SKIPPED directly, never dispatches Skip.
- execution-step-reissue-guard.test.ts (the CMDPRE remediation file, read in full) covers ONLY FailExecutionStep and RetryExecutionStep re-issues. Skip is absent.
- command-reissue-guard.test.ts, command-precondition.test.ts, dwp03/04/05/06/08-precondition-coverage.test.ts: `grep -n "Skip"` returns ZERO hits — the step family is guarded by advanceStep's requireFrom, not by the JAN-CMDPRE precondition registry, so none of that machinery covers it.
- `grep -rn "ExecutionStepSkipped" --include=*.test.ts packages apps` → ZERO assertions anywhere on the skipped-event count. e2e execution-plan.e2e.ts:231 only asserts the UI does not RENDER a skip button below QUEUED (read-model), which is unaffected by requireFrom.
NOTE (strengthens the finding): execution-start-gate.test.ts:867 is `expect(skip(2).status, JSON.stringify(skip(2))).toBe('ACCEPTED')` — the message argument dispatches skip(2) a SECOND time on the now-SKIPPED step. So an accidental SKIPPED→SKIPPED re-issue already occurs in the suite today, is silently REJECTED, and nothing observes it (only `.status` of the FIRST call is asserted, and line 868 only checks state === 'SKIPPED'). Under the mutant that second dispatch would be ACCEPTED and the test would still pass.

BEHAVIOUR HALF — temporary probe (written, run, then DELETED; no source file modified), `bunx vitest run … --silent=false`:
  PROBE A first: ACCEPTED state= SKIPPED events= 1 rev= 3
  PROBE A re-issue: REJECTED code= RPH_ILLEGAL_STATE_TRANSITION msg= "SkipExecutionStep requires step …-s1 to be READY or QUEUED, but it is SKIPPED. The stepState machine may permit that arrow for a DIFFERENT command; this command declares drivesFrom READY|QUEUED." events= 1 rev= 3
  PROBE B (mandatory:false skip of a NOT_READY step): REJECTED, same verbatim requireFrom message ("…but it is NOT_READY…")
  PROBE C (prune of that same NOT_READY step, for contrast): REJECTED RPH_INVARIANT_VIOLATION "…still reachable…"
The rejection text is byte-identical to execution.ts:648-653 — i.e. BOTH prechecks passed (plan is ACTIVE; canSkipStep returns ok on mandatory:false) and requireFrom fired. Nothing upstream refuses.

COUNTERFACTUAL, fully determined by code (mutation not run — editing source was forbidden): advanceStep runs precheck (execution.ts:645) → requireFrom (:647) → checkTransition (:654); everything after (:656-675) is unconditional state-build + commitState. kit.ts:178 admits `LEGAL || NOOP`; stateMachine.ts:48-50 returns NOOP for from===to unless a self-edge is DECLARED illegal, and ExecutionStep.stepState's `illegal` list (transitions.data.ts:1484-1491) contains exactly one entry, NOT_READY→RUNNING. So SKIPPED→SKIPPED is a NOOP: delete requireFrom and the re-issue is ACCEPTED, appending a SECOND ExecutionStepSkipped and bumping the revision for a transition that did not happen — with the whole suite still green. The widening mutant is equally live: NOT_READY→SKIPPED is a LEGAL declared arrow (transitions.data.ts:1469-1473), so widening to ['NOT_READY','READY','QUEUED'] is admitted by the machine and gives Skip+mandatory:false a route to terminate a step that Prune itself REFUSES (probe C), with no test observing it.

Verdict: the claim holds on both axes — the guard is live and correct, and it is an UNKILLED MUTANT (CON-000 B7). Same class and same severity as the two already-fixed Fail/Retry siblings. Fix: add to execution-step-reissue-guard.test.ts a SKIPPED→SKIPPED case (assert REJECTED + RPH_ILLEGAL_STATE_TRANSITION + ExecutionStepSkipped count still 1) and a NOT_READY boundary case (skip mandatory:false on NOT_READY → REJECTED naming drivesFrom READY|QUEUED), which kills both mutants.

</details>

**Live check needed.** None. Settled by a live probe (since deleted) plus exhaustive grep of every Skip dispatch site and every ExecutionStepSkipped assertion. The only thing not executed is the mutation itself (source edits were out of scope for this lens); its outcome is pinned by kit.ts:178 + stateMachine.ts:48-50 + transitions.data.ts:1484-1491 and can be re-verified in 30s by deleting execution.ts:958 and re-running the rph-application suite.


## F-14 · [CONFIRMED] [MAJOR] EnterExecutionStepWait's requireFrom — its only negative test is VACUOUS (the machine rejects that same input on its own), leaving the WAITING re-issue unguarded by any assertion

- **Lens:** `anti-vacuity`
- **Site:** `packages/rph-application/src/handlers/execution.ts:1087 (test: execution-start-gate.test.ts:606-611)`

**Claim.** The test at :606 is titled 'REJECTS a wait from a non-RUNNING state and a resume from a non-WAITING state (the machine gates both)' — and for the wait half its own title is accurate: :608 waits from QUEUED, and the ExecutionStep.stepState machine has NO QUEUED→WAITING arrow (transitions.data.ts declares only RUNNING→WAITING), so checkTransition classifies it ILLEGAL_UNDEFINED and rejects it regardless of requireFrom. Removing requireFrom leaves that assertion green. Since RUNNING is the machine's ONLY in-arrow to WAITING, the sole live effect of requireFrom ['RUNNING'] is refusing the WAITING→WAITING re-issue, and nothing exercises it. Compounding it, :608 and :610 assert only `.status === 'REJECTED'` — no error code, no event count — so even where a guard does fire the test cannot distinguish which layer produced the refusal (lens class (c)).

**Failure scenario.** RUN AND CONFIRMED. start(s1) → EnterExecutionStepWait(s1,'blocked on approval') ACCEPTED → re-issue EnterExecutionStepWait(s1,'blocked on vendor'). Today REJECTED with requireFrom's verbatim message and exactly one ExecutionStepWaiting. Delete requireFrom and the entire suite stays GREEN while checkTransition admits the WAITING→WAITING NOOP and a SECOND ExecutionStepWaiting is appended carrying a CONTRADICTING waitReason — the governed stream then records two mutually inconsistent explanations of why the same step is blocked, for one transition that never occurred.

**Suggested fix.** Add the WAITING→WAITING re-issue kill test, and strengthen :606/:610 to assert error.code and the event count so they name the layer that refused rather than merely that something did.

<details><summary>Code-semantics verifier evidence</summary>

CONFIRMED by static trace AND a live mutation experiment (mutant applied, run, then fully reverted — `git diff` on execution.ts is empty; my temporary probe file was deleted).

1. requireFrom is the ONLY handler-level guard on this command. `enterExecutionStepWait` (packages/rph-application/src/handlers/execution.ts:1081-1096) passes NO `precheck` — the doc comment says so explicitly ("there is DELIBERATELY no plan-ACTIVE precheck ... The machine (checkTransition, from RUNNING) alone gates the source") — and only `requireFrom: ['RUNNING'], // drivesFrom RUNNING` (execution.ts:1087).

2. requireFrom runs BEFORE the machine, so the machine cannot be the backstop for the same-state case. advanceStep (execution.ts:645-655):
   `const precheckFailure = args.precheck?.(step, plan); if (precheckFailure) return precheckFailure;`
   `if (args.requireFrom && !args.requireFrom.includes(String(step.stepState))) return reject(command,'RPH_ILLEGAL_STATE_TRANSITION', ...)`
   `const illegal = checkTransition(command, STEP_MACHINE, String(step.stepState), args.target); if (illegal) return illegal;`

3. The machine ADMITS the WAITING→WAITING re-issue. kit.ts:177-178 `const c = classifyTransition(...); if (c.klass === 'LEGAL' || c.klass === 'NOOP') return null;` and stateMachine.ts:48-50 `const explicit = m.illegal.find(...); if (explicit) return {klass:'ILLEGAL_EXPLICIT'...}; if (from === to) return { klass: 'NOOP' };` — the ExecutionStep.stepState block declares no illegal self-edge, so WAITING→WAITING is NOOP → admitted.

4. RUNNING is the only in-arrow to WAITING: transitions.data.ts:500 `{ from: 'RUNNING', to: 'WAITING', trigger: 'ExecutionStepWaiting' }` is the sole `to: 'WAITING'` edge in the ExecutionStep.stepState block (487-528). So requireFrom['RUNNING'] adds exactly one live refusal over the machine: the WAITING→WAITING re-issue. The cited test's wait half (execution-start-gate.test.ts:608, `expect(wait(1).status, 'QUEUED has no →WAITING arrow').toBe('REJECTED')`) exercises QUEUED→WAITING, which the machine rejects as ILLEGAL_UNDEFINED on its own — vacuous w.r.t. requireFrom. Both :608 and :610 assert only `.status`, never `error.code` or an event count, so they cannot name the refusing layer.

5. NOTHING else covers it. `grep -rn EnterExecutionStepWait` over non-dist sources yields only execution-start-gate.test.ts:550 (the `wait` helper), :635 (a single wait inside the "REFUSES StartExecutionStep on a WAITING step" test), the +page.server.ts UI dispatch, registry.ts, contracts. execution-step-reissue-guard.test.ts covers Fail and Retry ONLY (no "Wait"/"WAITING" hit in the file). No FROM_STATES precondition exists for this command (no `EnterExecutionStepWait` in command-precondition.ts or any dwp0*-precondition-coverage test). e2e only asserts the UI hides the Wait button on WAITING (execution-plan.e2e.ts:271) — an affordance, not an engine assertion, and it cannot go red from a handler mutation.

6. LIVE MUTATION RESULT. Probe (built from the execution-step-reissue-guard fixture): activePlan → StartExecutionStep → EnterExecutionStepWait(waitReason 'blocked on approval') → EnterExecutionStepWait(waitReason 'blocked on vendor').
   - BASELINE: `PROBE status= REJECTED | code= RPH_ILLEGAL_STATE_TRANSITION | msg= EnterExecutionStepWait requires step ...-s to be RUNNING, but it is WAITING... | waitingEvents= 1 | reasons= ["blocked on approval"]` — the refusal is requireFrom's verbatim message, confirming requireFrom (not the machine) is the live refuser.
   - MUTANT `requireFrom: ['RUNNING','WAITING']`: `PROBE status= ACCEPTED | waitingEvents= 2 | reasons= ["blocked on approval","blocked on vendor"]` — a SECOND ExecutionStepWaiting carrying a contradicting waitReason is appended for a transition that never occurred.
   - Under that same mutant the ENTIRE rph-application handler suite stayed green (`bun x vitest run src/handlers`: 46/47 files passing, the one failure being an unrelated concurrently-created scratch file `zz-probe-cancel-reissue.test.ts` failing on `Cannot find module './registry.js'`; the clean baseline run was 47 files / 354 tests passing). No wait-related assertion went RED.

So the guard is LIVE and CORRECT but is an UNKILLED MUTANT (JPWB-CON-000 B7). Note the resume half is NOT affected: deleting `resolveExecutionStepWait`'s `requireFrom: ['WAITING']` would let the machine admit RUNNING→RUNNING as a NOOP and ACCEPT the resolve, turning :610 RED — that half is genuinely killed. Only the wait half is vacuous, exactly as the finding states.

Fix: add a WAITING→WAITING kill test asserting REJECTED + `error.code === 'RPH_ILLEGAL_STATE_TRANSITION'` + `ExecutionStepWaiting` count still 1 (natural home: execution-step-reissue-guard.test.ts, alongside the Fail/Retry kill tests), and strengthen execution-start-gate.test.ts:608/:610 to assert error.code so they name the layer that refused.

</details>

<details><summary>Test-evidence verifier evidence</summary>

TEST-EVIDENCE LENS — CONFIRMED. No existing test can distinguish the guarded code from the mutant; four independent checks, three of them run live.

(1) CURRENT BEHAVIOUR (temp probe, now deleted; `bunx vitest run` in packages/rph-application, unmodified source):
  start(s1) -> EnterExecutionStepWait(s1,'blocked on approval') ACCEPTED, stepState=WAITING
  -> re-issue EnterExecutionStepWait(s1,'blocked on vendor') => REJECTED, code RPH_ILLEGAL_STATE_TRANSITION,
     message "EnterExecutionStepWait requires step ...-s1 to be RUNNING, but it is WAITING. The stepState machine may
     permit that arrow for a DIFFERENT command; this command declares drivesFrom RUNNING."  ExecutionStepWaiting count = 1.
  So requireFrom IS the refuser today, and it is the ONLY refuser (no precheck on this handler; execution.ts:1081-1096).

(2) THE ONLY NEGATIVE WAIT TEST IS MACHINE-KILLED, NOT GUARD-KILLED. Live call of the domain classifier:
     classifyTransition('ExecutionStep.stepState','QUEUED','WAITING')    = {"klass":"ILLEGAL_UNDEFINED"}
     classifyTransition('ExecutionStep.stepState','WAITING','WAITING')   = {"klass":"NOOP"}      <-- admitted
     classifyTransition('ExecutionStep.stepState','RUNNING','WAITING')   = {"klass":"LEGAL"}
     SUCCEEDED/FAILED -> WAITING = ILLEGAL_UNDEFINED.
  execution-start-gate.test.ts:608 waits from QUEUED — checkTransition rejects that on its own, so the assertion stays
  GREEN with requireFrom deleted. RUNNING is the machine's only in-arrow to WAITING (transitions.data.ts:500), so the
  guard's sole live effect is refusing the WAITING->WAITING NOOP — and nothing exercises it.

(3) EXHAUSTIVE COVERAGE GREP. `EnterExecutionStepWait` is dispatched in exactly three non-temporary places:
  execution-start-gate.test.ts (call sites :567, :579, :600, :608, :620, :652), apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts:623,
  and rph-contracts/src/validate.test.ts (schema-count only). Every test wait is issued from RUNNING (positive) except
  :608 (from QUEUED, machine-killed per (2)). NO test anywhere issues a wait on an already-WAITING step. Both e2e specs
  (execution-flow.e2e.ts:357-366, execution-plan.e2e.ts:265-274) assert `step-action-wait` has COUNT 0 while WAITING —
  i.e. the UI deliberately never re-issues it, so the e2e layer cannot kill the mutant either; it only proves the
  read-model affordance table (execution-view.ts:140 / execution-view.test.ts:119), not the handler authority.

(4) OBSERVED MUTANT BEHAVIOUR (accidental but direct). An earlier probe run — while a concurrent process had the guard
  transiently absent — produced exactly the predicted harm on the same fixture: re-wait ACCEPTED, then a third wait
  ACCEPTED, ExecutionStepWaiting count = 3 with payload waitReasons ['blocked on approval','blocked on vendor','third
  reason'] all stepState:'WAITING', stepState still WAITING, plan revision advanced — three mutually contradicting
  governed-stream explanations for one RUNNING->WAITING transition that happened once. (Source is byte-identical to
  HEAD now: `git diff -- packages` is empty; HEAD:execution.ts:1087 carries requireFrom ['RUNNING'].)

(5) SIBLING PRECEDENT MAKES THE GAP EXPLICIT. packages/rph-application/src/handlers/execution-step-reissue-guard.test.ts
  is the CMDPRE remediation file for this exact defect class on this exact family; its header states advanceStep runs
  requireFrom before checkTransition and "requireFrom is the SOLE guard against a same-state re-issue on the step
  machine". It adds kill tests for FailExecutionStep (FAILED->FAILED) and RetryExecutionStep (QUEUED->QUEUED) only.
  EnterExecutionStepWait (WAITING->WAITING) is the third member of the same family and was NOT covered.

CONTRAST — the resume half is genuinely covered, so the finding is right to scope this to the wait half only:
  execution-start-gate.test.ts:610 resolves from RUNNING, and RUNNING->RUNNING classifies NOOP (admitted by the machine),
  so requireFrom ['WAITING'] is the sole refuser there and that assertion does go RED under the mutant.

Baseline: `bunx vitest run src/handlers/execution-start-gate.test.ts src/handlers/execution-step-reissue-guard.test.ts`
= 44 passed / 2 files, with the guard intact — and nothing in those 44 touches a WAITING-state wait.

SEVERITY: MAJOR, matching the two identical-class findings already remediated in execution-step-reissue-guard.test.ts.
The guard is live and correct today, so this is a B7 anti-vacuity / regression-exposure defect rather than a live
runtime break; reachability is by direct command dispatch or a stale/replayed form POST, not the normal UI (the
projection withholds the wait affordance on WAITING).

FIX (as proposed, plus one addition): add a WAITING->WAITING kill test asserting REJECTED + error.code
'RPH_ILLEGAL_STATE_TRANSITION' + ExecutionStepWaiting count still 1 (site it next to the Fail/Retry kills in
execution-step-reissue-guard.test.ts so the family is complete), and strengthen execution-start-gate.test.ts:608/:610
from bare `.status === 'REJECTED'` to also assert error.code so each names the layer that refused.

</details>

**Live check needed.** None outstanding. All three live checks were run and are reported above (current-behaviour probe, classifyTransition matrix, two-suite baseline). The one remaining mechanical step a fixer should perform is the RED-proof after adding the kill test: delete `requireFrom: ['RUNNING']` at packages/rph-application/src/handlers/execution.ts:1087, confirm the new test goes RED and no other test changes status, then restore.


## F-15 · [CONFIRMED] [MAJOR] A BRANCH driven to terminal-success by Skip or Prune records no selection, so its decision keeps re-deriving — a later state change re-resolves the branch and BOTH arms run

- **Lens:** `branch`
- **Site:** `packages/rph-application/src/handlers/execution.ts:952-988 (skipExecutionStep — no mutateStep) and :1028-1071 (pruneExecutionStep — no mutateStep); packages/rph-domain/src/transition-gate.ts:109-114 (selectBranchEdge recorded-decision limb)`

**Claim.** `selectedTransitionId` is written in exactly ONE place: completeExecutionStep's `mutateStep` (execution.ts:762-779). SKIPPED is in TERMINAL_SUCCESS (transition-gate.ts:17), so `branchExcludes` (:169-172) treats a SKIPPED BRANCH as settled and asks `selectBranchEdge`, which — with no recorded id — falls through to a FRESH first-match evaluation on every read (:115-118). That is exactly the re-derivation instability DWP-09 was built to close; the fix covers only the Complete path. skipExecutionStep additionally has no start-gate precheck at all (its prechecks are plan-ACTIVE + canSkipStep, :966-985), so any QUEUED BRANCH is skippable at will. execution-step-skip-cancel.test.ts and execution-start-gate.test.ts never skip or prune a BRANCH step.

**Failure scenario.** VERIFIED through the live command bus (same probe run). Plan: s1 BRANCH, s2, s3; transitions [ {id:'t1-2', s1→s2, CONDITIONAL, {op:'ATTEMPTS', stepId:'s3', cmp:'>=', value:1}}, {id:'t1-3', s1→s3, SEQUENTIAL default} ]. Activate, then SkipExecutionStep(s1, {mandatory:false}) → ACCEPTED, `selectedTransitionId` undefined. StartExecutionStep(s2) → REJECTED (guard false: attempts(s3)=0, default arm selected). StartExecutionStep(s3) → ACCEPTED. That start emits ExecutionStepStarted for s3, so ATTEMPTS(s3) is now 1, the conditional guard flips TRUE, and the branch RE-RESOLVES to t1-2. StartExecutionStep(s2) → **ACCEPTED**. Final states: s1 SKIPPED, s2 RUNNING, s3 RUNNING — both arms of an exclusive BRANCH executing concurrently, the double-run window §10-M-D3 exists to close. (Contrast: with `selectedTransitionId:'t1-3'` recorded, the same probe at the domain layer keeps startable=['s3'] and s2 prunable.)

**Suggested fix.** Give skipExecutionStep and pruneExecutionStep the same `mutateStep` branch-recording as completeExecutionStep (a BRANCH that reaches terminal-success by ANY route has decided), or — cleaner — refuse to skip/prune an unresolved BRANCH that has conditional out-edges and require the operator to prune its arms explicitly. Either way add the kill test above; the current DWP-09 tests only exercise the Complete path.

<details><summary>Code-semantics verifier evidence</summary>

REPRODUCED THROUGH THE LIVE COMMAND BUS (independent probe, vitest/Node, temp file since deleted). Plan: s1 stepType BRANCH, s2, s3; transitions [cedge(1,2,{op:'ATTEMPTS',stepId:s3,cmp:'>=',value:1}), gedge(1,3) SEQUENTIAL default]. Propose/Approve/Activate all ACCEPTED (validateTransitionGraph passes: one entry, reachable, DAG, default LAST).

Probe A output verbatim:
  SKIP s1 = ACCEPTED
  s1 state = SKIPPED  selected = undefined
  start(2) before = REJECTED "every in-edge is neutralized - the step is unreachable"
  start(3) = ACCEPTED
  start(2) AFTER = ACCEPTED
  FINAL: SKIPPED RUNNING RUNNING          <- both arms of an exclusive BRANCH running

Probe B (control, same plan, Complete instead of Skip):
  selected = plan_...-t1-3
  start(3) = ACCEPTED ; CONTROL start(2) AFTER = REJECTED
  FINAL: SUCCEEDED QUEUED RUNNING

So the DWP-09 fix is Complete-path-only, exactly as claimed.

CODE PROVING IT (I read every cited line):
- packages/rph-application/src/handlers/execution.ts:762-779 — `mutateStep` writing `selectedTransitionId` exists ONLY on completeExecutionStep (`return selected === undefined ? step : { ...step, selectedTransitionId: selected }`). Grep for `selectedTransitionId` across packages/rph-application/src/handlers confirms exactly one write site.
- execution.ts:952-988 skipExecutionStep — `requireFrom: ['READY','QUEUED']`, and its precheck (:966-985) is ONLY `plan.status !== 'ACTIVE'` + `canSkipStep({ mandatory: p.mandatory ?? true, ... })`. No start-gate, no mutateStep. So a QUEUED BRANCH is skippable with `mandatory:false` and records nothing.
- packages/rph-domain/src/transition-gate.ts:17 `TERMINAL_SUCCESS = new Set(['SUCCEEDED','SKIPPED'])` — a SKIPPED BRANCH is "settled", so transition-gate.ts:169-172 (`branchExcludes`) and :228-231 (`inEdgeDisposition`) both call `selectBranchEdge`.
- transition-gate.ts:109-119 `selectBranchEdge` — the recorded-decision limb `if (source?.selectedTransitionId !== undefined)` is skipped (undefined), so control falls into the FRESH first-match loop `for (const e of outEdges) { if (!isConditionalEdge(e)) return e; if (evaluateGuard?.(e, plan)) return e; }` on EVERY read. StartExecutionStep(s3) emits ExecutionStepStarted, condition-grammar.ts:188-190 folds `rec.attemptsMade += 1`, ATTEMPTS(s3)>=1 flips TRUE, and the branch silently re-resolves from t1-3 to t1-2 — making the already-excluded arm SATISFIED.
- The reject the operator sees BEFORE start(3) (startStepGate :394-398) is the only thing standing in the way, and it is a re-derivation, not a fact.

REFUTATION ATTEMPTS THAT FAILED: (a) no start-gate precheck on skip — checked :966-985; (b) requireFrom does not help — s1 is QUEUED, a legal skip source; (c) the DWP-08 structural-deadness limb (transition-gate.ts:217) does NOT save this case, because a SKIPPED *entry* BRANCH is still LIVE (liveStepIds seeds the frontier from in-degree-0 steps, :139), so its unrecorded selection IS consulted; (d) propose-time validation accepts the plan (verified ACCEPTED); (e) the existing DWP-09 tests (execution-start-gate.test.ts:913-1009) drive the branch only via start+complete.

ONE CORRECTION TO THE FINDING'S SCOPE — the PRUNE half is NOT exploitable. Probe C: `PruneExecutionStep(s1)` = REJECTED ("it is still reachable"), because prunableStepIds (transition-gate.ts:323-334) requires `!live.has(s.id)`. A BRANCH can only be pruned when it is ALREADY structurally dead, and inEdgeDisposition checks `!liveStepIds(...).has(source.id) -> NEUTRALIZED` at :217 BEFORE it ever reaches the branch-selection limb at :228, while liveStepIds never expands the out-edges of a node not already in `live` (:144). So a pruned BRANCH's missing selection is never consulted. The defect is the SKIP path only; a fix should target skipExecutionStep (adding mutateStep to pruneExecutionStep is harmless but not load-bearing).

CHECK TO CONFIRM / KILL TEST: add to the `DWP-09 - a resolved BRANCH does not re-resolve` describe in packages/rph-application/src/handlers/execution-start-gate.test.ts (~line 913): activate the plan above, `SkipExecutionStep(s1,{mandatory:false})`, assert `stepOf(1)?.selectedTransitionId` is defined (fails today: undefined), `start(3)` ACCEPTED, then `expect(start(2).status).toBe('REJECTED')` (fails today: ACCEPTED). Sites to read: execution.ts:952-988, execution.ts:762-779, transition-gate.ts:109-119, transition-gate.ts:162-175, transition-gate.ts:217.

</details>

<details><summary>Test-evidence verifier evidence</summary>

CONFIRMED by live-bus probe with an A/B control, plus a total coverage gap.

COVERAGE GAP (checked, not assumed):
- packages/rph-application/src/handlers/execution-start-gate.test.ts — the DWP-09 describe has three tests and ALL drive the BRANCH to terminal-success via start(1)+complete(1). No test skips or prunes a BRANCH.
- packages/rph-domain/src/transition-gate.test.ts — grep for `selectedTransitionId` returns ZERO hits; every BRANCH fixture is step('s1','SUCCEEDED','BRANCH'). The recorded-decision limb (transition-gate.ts:109-114) has no domain-level coverage and no fixture ever has a SKIPPED BRANCH.
- packages/rph-application/src/handlers/execution-step-skip-cancel.test.ts — grep for BRANCH: no hits.

PROBE (temporary file, now deleted; no source file modified). Used the EXACT shipped DWP-09 fixture activeLateFlipPlan (s1 BRANCH; t1-2 CONDITIONAL STEP_STATE(s4,'SKIPPED'); t1-3 SEQUENTIAL default; t3-4), varying only how s1 reaches terminal-success:
  [CONTROL] selected after complete: plan_...-t1-3
  [CONTROL] start(2) after flip: REJECTED            <- shipped Complete route holds
  [PROBE] skip(BRANCH s1): ACCEPTED
  [PROBE] s1 state: SKIPPED  selected: undefined     <- no decision recorded
  [PROBE] start(2) BEFORE flip: REJECTED
  [PROBE] start(3): ACCEPTED ; complete(3): ACCEPTED
  [PROBE] skip(4) (flips guard TRUE): ACCEPTED
  [PROBE] >>> start(2) AFTER flip: ACCEPTED          <- branch RE-RESOLVED to t1-2
  [PROBE] final states: 1:SKIPPED 2:RUNNING 3:SUCCEEDED 4:SKIPPED  <- BOTH arms ran
The reported ATTEMPTS variant reproduces and is worse (both arms live CONCURRENTLY):
  [PROBE-B] skip(1): ACCEPTED  selected: undefined
  [PROBE-B] start(2) before: REJECTED ; start(3): ACCEPTED
  [PROBE-B] >>> start(2) after s3 started: ACCEPTED
  [PROBE-B] final: 1:SKIPPED 2:RUNNING 3:RUNNING

CODE CORROBORATION: selectedTransitionId is written in exactly one place — completeExecutionStep's mutateStep at packages/rph-application/src/handlers/execution.ts:762-779. skipExecutionStep (execution.ts:952-988) and pruneExecutionStep (execution.ts:1028-1071) pass no mutateStep. SKIPPED is in TERMINAL_SUCCESS (packages/rph-domain/src/transition-gate.ts:17), so branchExcludes (:169-172) treats the skipped BRANCH as settled and calls selectBranchEdge, which without a recorded id falls through to a FRESH first-match (:115-118) on every read. skipExecutionStep's only prechecks are plan-ACTIVE + canSkipStep, so a QUEUED BRANCH is skippable with mandatory:false.

TWO CORRECTIONS TO THE FINDING AS FILED:
1) The PRUNE half is NOT independently exploitable and should be dropped from the claim. pruneExecutionStep's precheck requires the step to be in prunableStepIds (already structurally dead), and a dead BRANCH's out-edges are never traversed by liveStepIds' BFS, so its downstream stays dead. Probe confirms prune of a reachable step is rejected: RPH_INVARIANT_VIOLATION "...still reachable". SKIP is the live vector.
2) AGGRAVATING: after the re-resolution, prune(2) is refused as "still reachable", so the operator also loses the honest close-out for the arm — the only way forward is to actually run it.

KILL TEST (RED today): in the DWP-09 describe of execution-start-gate.test.ts, reuse activeLateFlipPlan but replace start(1)+complete(1) with skip(1) {mandatory:false}; assert stepOf(1)?.selectedTransitionId is defined (it is undefined today), then after start(3)/complete(3)/skip(4) assert start(2).status === 'REJECTED' (it is 'ACCEPTED' today).

FIX: give skipExecutionStep the same BRANCH mutateStep branch-recording as completeExecutionStep (a BRANCH that reaches terminal-success by ANY route has decided), or refuse to skip an unresolved BRANCH carrying conditional out-edges.

</details>

**Live check needed.** None — settled by executing a probe through the real command bus (bunx vitest, packages/rph-application). Probe file deleted; no source modified.


## F-16 · [CONFIRMED] [MAJOR] The barrier releases a JOIN on a FAILED arm, and the sanctioned retry of that arm then lets the plan COMPLETE — a fully-SUCCEEDED plan whose join provably ran before one of its inputs existed

- **Lens:** `parallel-join`
- **Site:** `packages/rph-domain/src/transition-gate.ts:221 (terminal-non-success ⇒ NEUTRALIZED) + :287 (barrier: !anyPending && anySatisfied); packages/rph-application/src/handlers/execution-start-gate.test.ts:527`

**Claim.** `inEdgeDisposition` :221 neutralizes a FAILED source so a JOIN 'does not wedge behind a failed arm (D7)', while `branchExcludes` :157-160 deliberately does NOT treat a failure as an exclusion because 'a FAILED step is retryable (FAILED→QUEUED) and a source that has not finished may still take this edge'. Both statements are about the same fact and they contradict: the barrier declares the arm settled while the prune rule declares it still undecided. Because `startStepGate` (:384-399) consults ONLY the target's in-edges and never whether a successor is already terminal, the retried arm can also start and run AFTER the join has already SUCCEEDED. The single test that covers this shape (execution-start-gate.test.ts:527) defends the release with 'but the PLAN cannot complete' — that mitigation evaporates the moment the operator uses the engine's own sanctioned recovery, RetryExecutionStep, which is legal on a FAILED step under an ACTIVE plan (handlers/execution.ts:911-941).

**Failure scenario.** VERIFIED END-TO-END. Plan s1(PARALLEL_GROUP) -> s2 ∥ s3 -> s4(join), edges [s1->s2, s1->s3, s2->s4, s3->s4]. Start/Complete s1. Start s2, Start s3. Complete s2 (SUCCEEDED). Fail s3 (FAILED). Start(s4) is ACCEPTED — the join runs having received nothing from arm s3. Complete(s4) ACCEPTED. Now Retry(s3) ACCEPTED (FAILED->QUEUED), Start(s3) ACCEPTED, Complete(s3) ACCEPTED. Final states are ['SUCCEEDED','SUCCEEDED','SUCCEEDED','SUCCEEDED'] and CompleteExecutionPlan returns ACCEPTED, plan.status === 'COMPLETED'. The governed stream records a fully successful plan in which ExecutionStepSucceeded(s4) precedes ExecutionStepStarted(s3, attempt 2) — the join consumed partial input and nothing anywhere records that.

**Suggested fix.** Decide which rule owns a FAILED arm and make both agree. Either treat a FAILED in-edge as PENDING for a JOIN (wedge until the controller retries, fails the plan, or explicitly abandons the arm), or — if release must stay — refuse RetryExecutionStep once any out-edge target of that step is already terminal, and record on the join's ExecutionStepStarted which in-edges were NEUTRALIZED at the time it fired so the partial-input fact is in the governed stream.

<details><summary>Code-semantics verifier evidence</summary>

REPRODUCED EXACTLY, end-to-end, against the real engine (vitest probe in packages/rph-application/src/handlers, run under Node via `node ../../node_modules/vitest/vitest.mjs run` — npx/bun are blocked by devEngines; probe file deleted after the run). Plan s1(PARALLEL_GROUP) -> s2 ∥ s3 -> s4, edges [s1->s2, s1->s3, s2->s4, s3->s4]. Console output:

  start(4) = ACCEPTED ; complete(4) = ACCEPTED ; retry(3) = ACCEPTED ; start(3 attempt2) = ACCEPTED ; complete(3) = ACCEPTED
  states = ['SUCCEEDED','SUCCEEDED','SUCCEEDED','SUCCEEDED']
  CompleteExecutionPlan = ACCEPTED ; plan.status = COMPLETED

Governed stream (aggregateRevision:eventType:stepId), proving the join ran before one of its declared inputs existed:
  8:ExecutionStepFailed:s3 → 9:ExecutionStepStarted:s4 → 10:ExecutionStepSucceeded:s4 → 11:ExecutionStepRetried:s3 → 12:ExecutionStepStarted:s3 → 13:ExecutionStepSucceeded:s3 → 14:ExecutionPlanCompleted
The join's Succeeded (rev 10) precedes the retried arm's second Started (rev 11), exactly as the finding asserts.

CODE PATH TRACED, every cited site read:
1. transition-gate.ts:213-221 — `if (!TERMINAL.has(src)) return 'PENDING';` … `if (!TERMINAL_SUCCESS.has(src)) return 'NEUTRALIZED';` — the FAILED s3 in-edge is NEUTRALIZED, not PENDING.
2. transition-gate.ts:286-287 (`stepAtFrontier`) and :386-399 (`startStepGate`): `const b = barrierState(...); if (b.firstPending) …; if (!b.anySatisfied) …; return { ok: true };` — with s2 SATISFIED and s3 NEUTRALIZED there is no PENDING edge, so s4 is startable. `startStepGate` consults ONLY `inEdgesOf(plan, stepId)` (:384) — it never looks at whether a SUCCESSOR of the step being started is already terminal, so nothing blocks the retried s3's second start either (s3's only in-edge, s1, is still SATISFIED).
3. handlers/execution.ts:911-941 `retryExecutionStep` — the only gates are `requireFrom: ['FAILED']` (:917), the plan-ACTIVE precheck (:919-924, plan is ACTIVE), and `retryDecision` against the cap (:925-937; attemptsMade=1 < DEFAULT_MAX_ATTEMPTS=3). Nothing consults the graph. Retry is ACCEPTED with a terminal successor.
4. handlers/execution.ts:459-500 `completeExecutionPlan` — the allow-list `steps.filter(s => s.stepState !== 'SUCCEEDED' && s.stepState !== 'SKIPPED')` finds zero offenders once s3 is re-succeeded, and ≥1 SUCCEEDED holds, so the plan COMPLETES. The mitigation the existing test relies on is state-based only, and the retried arm erases the state it keyed on.
5. execution-start-gate.test.ts:527-542 — the sole test for this shape asserts the release is safe *because* "the PLAN cannot complete" (`expect(done.status, 'a FAILED step is not terminal-success').toBe('REJECTED')`). That defence is verified false the moment the engine's own sanctioned recovery (RetryExecutionStep) is used; no test anywhere extends past `fail(3)`.
6. Nothing records the partial input: grep for NEUTRALIZED across packages/ returns only transition-gate.ts + its tests — no handler writes a neutralized-in-edge set onto ExecutionStepStarted, so the governed stream carries no trace that s4 consumed nothing from s3. The read-model half is equally affected: `startableStepIds` uses the same `stepAtFrontier`, so the UI offers Start(s4) too.

WHERE THE FINDING OVERSTATES (does not change the verdict): the claimed "contradiction" between `inEdgeDisposition`:221 and `branchExcludes`:157-160 is rhetorical rather than itself a defect — those two functions answer genuinely different questions (may this join proceed? vs. may this arm be pruned to SKIPPED?), and transition-gate.ts:157-160 says so explicitly. The real, verified defect is narrower and concrete: the barrier's release of a FAILED arm is coordinated with NOTHING downstream, so `retryExecutionStep` may re-open an arm whose join is already terminal, and the plan then reports unqualified success for a join that provably ran before one of its declared inputs.

RAW-BYTE CHECK: not applicable — no string parsing, delimiter, split/join or suspicious literal is involved in this finding; it is pure control flow over enum sets.

</details>

<details><summary>Test-evidence verifier evidence</summary>

SETTLED BY EXECUTION, not by re-reading the code argument.

1) NO EXISTING TEST DEFENDS THE CLAIMED-BROKEN BEHAVIOUR — the coverage gap is total.
`grep -rn "RetryExecutionStep" --include=*.test.ts --include=*.e2e.ts packages apps` across the whole workbench returns SIX non-probe files: execution-step-reissue-guard, execution-retry-cap, execution-plan-supersede, execution-detail, execution-start-gate, plus one other agent's temp probe. NOT ONE of them exercises a retry against a plan carrying a JOIN. The only file that has both a join shape and a retry helper is packages/rph-application/src/handlers/execution-start-gate.test.ts, and its single retry test (:511-525, "keeps retry + the attempt cap PER STEP") retries s2 BEFORE the join s4 is ever started — the join never fires in that test. So the exact sequence in the finding has zero coverage anywhere.

The domain-level counterpart, packages/rph-domain/src/transition-gate.test.ts:64-70, does the OPPOSITE of defending: despite the title "a NEUTRALIZED (FAILED-source) in-edge does not, by itself, make a join startable", its body asserts `startableStepIds(...)` === ['s4'] — i.e. it LOCKS IN the release of the join over a FAILED arm. It says nothing about what happens afterwards.

2) THE SOLE COVERING TEST'S MITIGATION IS FALSE AS A GUARANTEE.
execution-start-gate.test.ts:527-542 is the only test on this shape. Its comment claims "That is not a fabricated success: the plan-completion allow-list independently refuses to close a plan holding a FAILED step, so the failure still has to be dealt with." I ran the engine to see what happens when the failure IS dealt with, via the engine's own sanctioned recovery.

3) TEMPORARY PROBE — RUN AND OBSERVED (file since DELETED; no source touched).
Wrote packages/rph-application/src/handlers/zz-probe-join-retry.test.ts reusing the exact `activeParallelPlan()` fixture from execution-start-gate.test.ts:443-473 (s1 PARALLEL_GROUP -> s2 ∥ s3 -> s4, edges [1->2,1->3,2->4,3->4]).
`bunx vitest run src/handlers/zz-probe-join-retry.test.ts --silent=false` output, verbatim:

  start(s4) over a FAILED arm => ACCEPTED
  complete(s4) => ACCEPTED
  retry(s3) AFTER s4 SUCCEEDED => ACCEPTED
  start(s3) attempt 2 AFTER s4 SUCCEEDED => ACCEPTED
  complete(s3) => ACCEPTED
  final step states => [ 'SUCCEEDED', 'SUCCEEDED', 'SUCCEEDED', 'SUCCEEDED' ]
  CompleteExecutionPlan => ACCEPTED
  plan.status => COMPLETED

The governed event stream, with aggregate revisions, printed by the same probe:
  8   ExecutionStepFailed     ...-s3
  9   ExecutionStepStarted    ...-s4
  10  ExecutionStepSucceeded  ...-s4
  11  ExecutionStepRetried    ...-s3
  12  ExecutionStepStarted    ...-s3      <- second attempt of the arm
  13  ExecutionStepSucceeded  ...-s3
  14  ExecutionPlanCompleted

ExecutionStepSucceeded(s4) at rev 10 provably precedes ExecutionStepStarted(s3, attempt 2) at rev 12. The plan is permanently recorded as fully SUCCEEDED with a join that ran before one of its declared inputs existed. Exactly the finding's failureScenario, end to end, no source modification, no seeded state — every move a sanctioned command.

4) CONTROL PROBE (B) shows the window is even wider than claimed: with the join only RUNNING (not yet SUCCEEDED), `retry(s3)` => ACCEPTED and `start(s3)` => ACCEPTED, leaving states ['SUCCEEDED','SUCCEEDED','RUNNING','RUNNING'] — the join and its own input arm running concurrently. Nothing anywhere refuses it.

5) WHY THE CODE PATH ALLOWS IT (corroboration, not the basis of the verdict).
- retryExecutionStep (handlers/execution.ts:911-941) has exactly two prechecks: plan ACTIVE, and the RPH-EXE-008 cap. attemptsMade(s3)=1 < 3, plan ACTIVE. No successor/out-edge consideration exists — `grep -n "out-edge|successor" handlers/execution.ts` finds nothing on the retry path.
- startStepGate (transition-gate.ts:351-400) consults only the TARGET's in-edges; s3's single in-edge s1->s3 is SATISFIED, so the second start passes.
- completeExecutionPlan's guard (handlers/execution.ts:473-499) is a pure STATE SNAPSHOT — `steps.filter(s => s.stepState !== 'SUCCEEDED' && s.stepState !== 'SKIPPED')` — with no ordering/causality dimension, so once s3 reaches SUCCEEDED the plan closes.
- The ExecutionStepStarted payload (handlers/execution.ts:694-705) records only stepId + resulting stepState; nothing records which in-edges were NEUTRALIZED when the join fired, so the partial-input fact is unrecoverable from the stream.

6) THE DESIGN ITSELF STATES THE UNIMPLEMENTED HALF.
JAN-EXECPLAN-DR-004 Detailed Implementation Roadmap.md:223 requires: "Do NOT let a neutralized in-edge block a JOIN (barrier rule) **nor count as a real contribution**." The code implements the first clause (transition-gate.ts:221) and implements NOTHING for the second — no marker, no record, no bar on the arm's later resurrection. This is a specified requirement with no implementation and no test, on a surface whose own exit criterion ("Post-build adversarial verification (ultracode) before the final commit", DR-004:262) was never executed.

Severity held at MAJOR (not BLOCKER): the resulting state is internally consistent and reaching it requires an operator fail-then-retry after the join, but it is reachable through sanctioned commands only, it permanently corrupts the governed record of a COMPLETED plan, and it is defended by a test whose stated safety property is provably temporary.

Files: e:\Projects\hestami-ai\JanumiCode\janumiprofessionalworkbench\packages\rph-domain\src\transition-gate.ts (:157-160 vs :204-235, :351-400); e:\Projects\hestami-ai\JanumiCode\janumiprofessionalworkbench\packages\rph-application\src\handlers\execution.ts (:473-499, :694-705, :911-941); e:\Projects\hestami-ai\JanumiCode\janumiprofessionalworkbench\packages\rph-application\src\handlers\execution-start-gate.test.ts (:511-542); e:\Projects\hestami-ai\JanumiCode\janumiprofessionalworkbench\packages\rph-domain\src\transition-gate.test.ts (:64-70).

</details>

**Live check needed.** None — settled live. The temporary probe was executed under `bunx vitest run` in packages/rph-application and then deleted (verified absent; `git status` shows no modification to any source or test file by this lens). To re-derive: append to the `PARALLEL_GROUP + JOIN (DWP-05)` block of packages/rph-application/src/handlers/execution-start-gate.test.ts, after the :527 body (complete(2), fail(3), start(4), complete(4)): retry(3), start(3), complete(3), CompleteExecutionPlan — all five return ACCEPTED today and plan.status becomes COMPLETED.


## F-17 · [CONFIRMED] [MAJOR] Join-neutralized deadlock in a fan-out: the engine refuses the start saying 'it should be pruned' and refuses the prune saying 'it is still reachable'

- **Lens:** `parallel-join`
- **Site:** `packages/rph-domain/src/transition-gate.ts:394-398 (startStepGate all-neutralized limb) vs :162-175 (branchExcludes) / :323-334 (prunableStepIds)`

**Claim.** `branchExcludes` (:169) returns false unless the source is in TERMINAL_SUCCESS, so a CANCELLED, SUPERSEDED or FAILED source never removes reachability — its downstream stays in `liveStepIds` and is therefore NOT in `prunableStepIds` (:329). But `inEdgeDisposition` :221 neutralizes exactly those sources, so the downstream's barrier has anyPending=false and anySatisfied=false, and `startStepGate` :394-398 refuses it with the message 'every in-edge is neutralized — the step is unreachable (it should be pruned)'. Two exported functions of the SAME module reach contradictory verdicts about the same step, and the engine's own remediation instruction is refused by the engine. For a FAILED arm this is recoverable via retry, but the message is actively wrong; for a CANCELLED arm the machine has NO out-arrow from CANCELLED (transitions.data.ts:1437-1482), so the arm can never be revived and the join's only exit is a SkipExecutionStep-with-waiver that the refusal message never mentions.

**Failure scenario.** VERIFIED END-TO-END, two shapes. (a) All arms cancelled: plan s1(PARALLEL_GROUP) -> s2 ∥ s3 -> s4(join). Start/Complete s1. CancelExecutionStep(s2, 'operator abort'), CancelExecutionStep(s3, 'operator abort') — both ACCEPTED (cancel has no plan-ACTIVE precheck, handlers/execution.ts:998-1011). Now Start(s4) is REJECTED with '...every in-edge is neutralized — the step is unreachable (it should be pruned)' and Prune(s4) is REJECTED with 'Cannot prune step ...-s4: it is still reachable'. s4 is permanently stuck at QUEUED unless someone guesses that a waiver-skip is the exit. (b) Downstream of a failed arm: add s5 with edge s3->s5 only. Start/Complete s1, Start/Complete s2, Start s3, Fail s3 — Start(s5) and Prune(s5) are BOTH REJECTED with the same contradictory pair of messages. (c) Related: cancelling ONE parallel arm still releases the join (Start(s4) ACCEPTED) but silently converts the plan into one that can never COMPLETE — CompleteExecutionPlan is refused forever with 'has 1 step(s) not in terminal success (CANCELLED)', and Prune(s3)/Skip(s3) are both refused because s3 is already terminal.

**Suggested fix.** Pick one axis. Either extend `branchExcludes` to treat an UNRECOVERABLE terminal source (CANCELLED/SUPERSEDED — no out-arrow in the machine) as an exclusion so the downstream becomes genuinely prunable, keeping FAILED (retryable) live as today; or, at minimum, make `startStepGate`'s all-neutralized message name the actual exit — distinguish 'unreachable, prune it' from 'its predecessors terminated without success; retry them, waiver-skip this step, or fail the plan' — so the refusal never instructs a command the engine will refuse.

<details><summary>Code-semantics verifier evidence</summary>

CONFIRMED — reproduced twice, purely in domain and end-to-end through the real Engine. Every cited line number is exact.

## 1. The contradiction is real, and it is in the code as written

`transition-gate.ts:162-175 branchExcludes`:
```ts
if (source === undefined || !TERMINAL_SUCCESS.has(source.stepState)) return false; // :169 — unsettled ⇒ excludes nothing
```
`TERMINAL_SUCCESS = new Set(['SUCCEEDED','SKIPPED'])` (:17). So a CANCELLED / SUPERSEDED / FAILED source excludes NOTHING → its target stays in `liveStepIds` (:147) → `prunableStepIds` (:329 `!live.has(s.id)`) never offers it.

`transition-gate.ts:204-235 inEdgeDisposition` neutralizes exactly those same sources:
```ts
if (!TERMINAL_SUCCESS.has(src)) return 'NEUTRALIZED'; // :221
```
→ `barrierState` yields anyPending=false, anySatisfied=false → `startStepGate` :394-398:
```ts
if (!b.anySatisfied) return { ok: false, reason: 'every in-edge is neutralized — the step is unreachable (it should be pruned)' };
```

## 2. Empirical proof (pure domain, temp test since deleted)
Plan s1(PARALLEL_GROUP)→s2‖s3→s4(join), states SUCCEEDED/CANCELLED/CANCELLED/QUEUED:
```
(a) startStepGate(s4) = {"ok":false,"reason":"every in-edge is neutralized — the step is unreachable (it should be pruned)"}
(a) prunableStepIds  = []
```
Both hold simultaneously — exactly the claimed contradiction.

## 3. Empirical proof end-to-end (real Engine + SqliteStorageAdapter, via the raising lens's `packages/rph-application/src/handlers/zz-probe-join-neutralized.test.ts`, which I ran)
```
(a) start(s4) = REJECTED RPH_ILLEGAL_STATE_TRANSITION Cannot start step ...-s4: every in-edge is neutralized — the step is unreachable (it should be pruned) (RPH-EXE-005).
(a) prune(s4) = REJECTED RPH_INVARIANT_VIOLATION Cannot prune step ...-s4: it is still reachable ... A prune is NOT a waiver
(a) s4 state = QUEUED
```
Both `CancelExecutionStep(s2)`/`(s3)` from QUEUED were ACCEPTED — `handlers/execution.ts:998-1011` has `requireFrom: ['READY','QUEUED','RUNNING','WAITING']` and, by design (:991-997), NO plan-ACTIVE precheck. The engine literally emits a remediation instruction for a command it then refuses.

**It is simpler than the finding claims — no fan-out is needed.** The probe's (c) shape is a plain 3-node linear GRAPH `s1→s2→s3`; cancel s2 and s3 is equally stuck with the identical contradictory message pair. Any graph plan with one cancelled step wedges its whole downstream.

## 4. The code's own justification does not cover CANCELLED
`branchExcludes`'s doc (:156-160) justifies the narrowness as *"a FAILED step is retryable (FAILED→QUEUED)"*. I checked `transitions.data.ts` `ExecutionStep.stepState` (:1432-1483): the ONLY out-arrow from a terminal state in the whole machine is
```ts
{ from: 'FAILED', to: 'QUEUED', trigger: 'retryExecutionStep / ExecutionStepRetried' }, // :1456
```
`grep "from: 'CANCELLED'\|from: 'SUPERSEDED'"` over the file returns nothing. So the retryability rationale is provably false for CANCELLED/SUPERSEDED, yet :169 lumps them in with FAILED. The code is broader than its own stated reason.

## 5. Anti-vacuity gap (JPWB-CON-000 B7)
`transition-gate.test.ts:409-416` covers only the single-chain FAILED variant and asserts BOTH ingredients of the contradiction as CORRECT — `expect(prunableStepIds(p, guard)).toEqual([])` and `expect(inEdgeDisposition(p, t[1]!, guard)).toBe('NEUTRALIZED')` — while never asking what `startStepGate` simultaneously says. The suite cannot see the divergence.

## 6. Why MAJOR despite a working exit (corrections to the finding)
- **"permanently stuck / can never be revived" is an OVERSTATEMENT.** The probe shows `SkipExecutionStep(s4, mandatory:false)` = **ACCEPTED**, and `CancelExecutionPlan` = ACCEPTED. It is not a hard deadlock.
- But the only exits are *governance falsifications*: assert `mandatory:false` on a step nobody declared optional, or mint a waiver — for a condition that is purely **structural**. That is precisely the distinction `pruneExecutionStep` exists to preserve (`handlers/execution.ts:1016-1021`, and its own refusal text at :1065 "A prune is NOT a waiver"). The engine forces the operator to launder a structural exclusion through the waiver plane because the honest command is refused.
- Independently, this violates the module's *stated raison d'être* — `transition-gate.ts:4-8` and `:318-321` ("without this gate the read-model offered a Prune the engine would refuse — precisely the read-model/authority divergence this single gate home exists to prevent (DR-004 §19-M2)"). Here the divergence runs the other way and is unguarded.
- **Sub-claim (b) is DELIBERATE, not a logic defect.** Probe (d): after `Fail(s2)`, `Retry(s2)`→`Start`→`Complete`→`Start(s3)` all ACCEPTED — full recovery. For FAILED the defect is the MESSAGE only ("it should be pruned" when the real remedy is retry).
- **Sub-claim (c) is design-consistent, not a defect.** `completeExecutionPlan`'s allow-list deliberately excludes CANCELLED (`handlers/execution.ts:447-451`, :483-491) and its own text points at FailExecutionPlan.

## 7. Suggested fix — endorse the finding's first axis, narrowed
Treat an **UNRECOVERABLE terminal source** (CANCELLED/SUPERSEDED — no out-arrow in `transitions.data.ts`) as an exclusion in `branchExcludes` so the downstream becomes genuinely prunable, keeping FAILED live (retryable) exactly as today. Separately fix the :397 message to distinguish "unreachable — prune it" from "predecessors terminated without success — retry them or waiver-skip this step", so the engine never names a command it refuses. Pin both halves with the assertion the suite is missing: on the same fixture, assert `startStepGate(...).ok === false` AND `prunableStepIds(...)` — they must not disagree.

**Incidental (NOT a finding, no action):** while reading I caught `handlers/execution.ts:1087` transiently carrying `requireFrom: ['RUNNING', 'WAITING'], // MUTANT (verifier probe)` — a concurrent verifier's in-flight edit. It has since been reverted; the file now matches HEAD (`git diff HEAD` clean, line reads `requireFrom: ['RUNNING'], // drivesFrom RUNNING`). Flagging only so it is not mistaken for shipped code if another agent re-injects it.

Files: e:\Projects\hestami-ai\JanumiCode\janumiprofessionalworkbench\packages\rph-domain\src\transition-gate.ts, e:\Projects\hestami-ai\JanumiCode\janumiprofessionalworkbench\packages\rph-domain\src\transitions.data.ts, e:\Projects\hestami-ai\JanumiCode\janumiprofessionalworkbench\packages\rph-domain\src\transition-gate.test.ts, e:\Projects\hestami-ai\JanumiCode\janumiprofessionalworkbench\packages\rph-application\src\handlers\execution.ts

</details>

<details><summary>Test-evidence verifier evidence</summary>

SETTLED BY RUNNING CODE, BOTH LAYERS. I wrote two throwaway probes (rph-domain/src/zz-probe-join-neutralized.test.ts and rph-application/src/handlers/zz-probe-join-neutralized.test.ts), ran them, and DELETED both. No source file was modified.

APPLICATION-LAYER OUTPUT (real engine, SqliteStorageAdapter, full Propose->Approve->Activate), shape s1(PARALLEL_GROUP)->s2 || s3 ->s4(join):
  start(1) ACCEPTED; complete(1) ACCEPTED; CancelExecutionStep(s2) ACCEPTED; CancelExecutionStep(s3) ACCEPTED
  start(s4)  = REJECTED RPH_ILLEGAL_STATE_TRANSITION "Cannot start step ...-s4: every in-edge is neutralized — the step is unreachable (it should be pruned) (RPH-EXE-005)."
  prune(s4)  = REJECTED RPH_INVARIANT_VIOLATION      "Cannot prune step ...-s4: it is still reachable — every in-edge would have to be excluded by the plan's own branch logic..."
  s4 state   = QUEUED
Same contradictory PAIR reproduces verbatim for a single chain s1->s2->s3 with s2 CANCELLED, and for s2 FAILED. DOMAIN-LAYER probe confirms it is intrinsic to the module: startStepGate(p,'s4') = {ok:false, reason:'every in-edge is neutralized — the step is unreachable (it should be pruned)'} while prunableStepIds(p) = [] and startableStepIds(p) = [] and inEdgeDisposition(s2->s4) = 'NEUTRALIZED'.

So the CORE claim holds exactly as written: two exported functions of transition-gate.ts return contradictory verdicts about the same step, and the engine's own refusal message instructs a command (PruneExecutionStep) that the engine immediately refuses with the OPPOSITE reason. That is precisely the read-model/authority divergence this module's header (transition-gate.ts:4-8) and prunableStepIds' own docblock (:318-321, "without this gate the read-model offered a Prune the engine would refuse") declare it exists to prevent.

MECHANISM VERIFIED IN CODE: branchExcludes (transition-gate.ts:169) returns false unless the source is in TERMINAL_SUCCESS, so a FAILED/CANCELLED source never removes reachability -> target stays in liveStepIds -> excluded from prunableStepIds (:329). inEdgeDisposition (:221) neutralizes exactly those sources -> barrier anyPending=false, anySatisfied=false -> startStepGate (:394-398). I also confirmed the divergence is UNIQUE to line 221: every OTHER NEUTRALIZED limb (:217 non-live source, :229 BRANCH not-taken, :234 false guard off a settled source) has a matching branchExcludes limb, so the target also drops out of liveStepIds and IS prunable. CANCELLED is terminal with no out-arrow (transitions.data.ts:1436 terminalStates; in-arrows only at :1474-1477), and no step-level Supersede command exists, so FAILED and CANCELLED are the only two reachable neutralizers.

COVERAGE GAP IS REAL (no existing test refutes it): transition-gate.test.ts:411-417 is the only test in the neighbourhood. It asserts prunableStepIds === [] for the FAILED single-chain as CORRECT and asserts inEdgeDisposition === 'NEUTRALIZED' — but never asks startStepGate what IT says, so the contradiction is invisible to it. `grep -rn "should be pruned|is unreachable" packages apps` returns ZERO hits outside transition-gate.ts and its .d.ts: no test anywhere asserts that message. No test in any package drives a CANCELLED step as a graph predecessor. execution-start-gate.test.ts:527 ("the JOIN still fires when one arm FAILED") covers only the anySatisfied=true join, never the all-neutralized one.

BUT THE CONSEQUENCE IS OVERSTATED — hence MINOR, not MAJOR. Two of the finding's claims are REFUTED by the same run:
1. "the join's only exit is a SkipExecutionStep-with-waiver that the refusal never mentions" — the waiver-skip IS accepted (skip(s4) mandatory:false = ACCEPTED; skip(s4) with no waiver = REJECTED fail-closed, as designed), and the refusal message DOES already say "to skip a reachable step use SkipExecutionStep". So the step has a legal way out; by the review's own definition ("a step that can get stuck in a non-terminal state with NO legal way out is a DEADLOCK") this is not a deadlock.
2. "permanently stuck / the plan is wedged" — the contradiction is never the BINDING constraint. It can only arise when a predecessor is FAILED or CANCELLED, and that predecessor independently blocks completion under the ratified §20.1 allow-list. Observed after the successful waiver-skip of s4: CompleteExecutionPlan = REJECTED "has 2 step(s) not in terminal success (CANCELLED, CANCELLED)". CancelExecutionPlan = ACCEPTED. And for the FAILED variant the plan recovers FULLY: retry(s2) ACCEPTED -> s2 QUEUED -> start(s2) ACCEPTED -> complete(s2) ACCEPTED -> start(s3) ACCEPTED. Sub-claim (c) is likewise just the already-tested and already-documented §20.1 rule (execution-start-gate.test.ts:527-542), not a new defect.

NET: the defect is a self-contradictory verdict plus an actively-wrong operator instruction on an untested path — a correctness/consistency defect in the module whose stated purpose is preventing exactly this, with a genuine anti-vacuity hole (deleting nothing, but the joint verdict is unasserted anywhere). It is NOT a liveness/deadlock defect. Fix per the finding's second suggested axis (make the all-neutralized message name the real exit and distinguish 'unreachable, prune it' from 'its predecessors terminated without success'); the first axis (making CANCELLED an exclusion) would silently launder a cancelled arm's downstream into terminal-success SKIPPED, which is the very laundering transition-gate.ts:158-160 deliberately refuses.

</details>

**Live check needed.** None — settled by execution. To lock it in, add to packages/rph-domain/src/transition-gate.test.ts (beside the existing :411 case): plan s1 SUCCEEDED / s2 CANCELLED / s3 CANCELLED / s4 QUEUED with edges s1->s2, s1->s3, s2->s4, s3->s4, then assert startStepGate(p,'s4').ok === false AND that its reason does NOT tell the caller to prune while prunableStepIds(p) === [] — i.e. assert the two exported verdicts are CONSISTENT. That assertion fails today and is the kill test the surface lacks.


## F-18 · [CONFIRMED] [MAJOR] ResolveExecutionStepWait's requireFrom ['WAITING'] is the sole barrier against a full start-gate bypass, and no test kills a widening mutant

- **Lens:** `wait-resume`
- **Site:** `packages/rph-application/src/handlers/execution.ts:1113 (requireFrom) with the only negative at packages/rph-application/src/handlers/execution-start-gate.test.ts:610`

**Claim.** resolveExecutionStepWait's precheck (:1119-1126) checks ONLY plan.status — it never calls startStepGate and never mints an ExecutionStepStarted. Its target is RUNNING, and the machine legalises QUEUED->RUNNING (transitions.data.ts:1445). So requireFrom:['WAITING'] is the single thing preventing this command from driving any QUEUED step straight to RUNNING out of order with no attempt record. The only negative test, execution-start-gate.test.ts:610, resolves from RUNNING — and its own assertion message ('RUNNING has no →RUNNING resume arrow') and the test title ('the machine gates both') are factually wrong: checkTransition classifies from===to as NOOP and ADMITS it (kit.ts:181), so requireFrom is the actual refuser there too. That test kills only the DELETION mutant; every WIDENING mutant survives the entire suite, and widening is the one that matters here because the states omitted from the set are the dangerous ones. This is the same anti-vacuity class (CON-000 B7) already fixed twice on this surface for FailExecutionStep and RetryExecutionStep.

**Failure scenario.** Mutate execution.ts:1113 to `requireFrom: ['WAITING','QUEUED']`. Run the full suite — it stays GREEN (no test ever dispatches ResolveExecutionStepWait against a QUEUED step). Now the live behaviour: activate a linear plan with steps s1,s2,s3 all QUEUED. Dispatch ResolveExecutionStepWait({stepId:'s3'}) -> ACCEPTED. s3 goes QUEUED->RUNNING having never waited, with (a) RPH-EXE-005 ordering never evaluated — s1 and s2 are still QUEUED and startStepGate was never called; (b) zero ExecutionStepStarted emitted, so attemptsMadeForStep(s3) stays 0 and the RPH-EXE-008 retry cap can never be consumed for that step (retryDecision at :927 sees attemptsMade 0 forever); (c) executionAttempts (execution-attempts.ts:76-98 keys on ExecutionStepStarted) shows NO attempt row for a step that ran and can now be Completed with outputs. The attempt history for a step that produced real artifacts is simply empty.

**Suggested fix.** Add a kill test alongside execution-start-gate.test.ts:606 that dispatches ResolveExecutionStepWait on a QUEUED step which has NEVER waited, asserting REJECTED with RPH_ILLEGAL_STATE_TRANSITION, a message containing 'drivesFrom WAITING', stepStateOf still 'QUEUED', and zero ExecutionStepWaitResolved events. Also correct the misleading assertion message at :610 ('RUNNING has no →RUNNING resume arrow') and the title's 'the machine gates both' — the machine gates the wait half only; requireFrom gates the resume half.

<details><summary>Code-semantics verifier evidence</summary>

Every mechanical claim was verified against the real code, and both mutants were run LIVE. I could not refute it — but I am correcting the severity, because the finding's "same class as the two already-fixed MAJORs" framing does not survive the mutation data.

WHAT IS TRUE (verified)

1. The precheck really does read only plan.status. packages/rph-application/src/handlers/execution.ts:1107-1128:
   `requireFrom: ['WAITING'], // drivesFrom WAITING — an already-RUNNING step never waited...`
   `precheck: (_step, plan) => plan.status === 'ACTIVE' ? null : reject(...)`
   No startStepGate call, no ExecutionStepStarted mint. Contrast startExecutionStep (execution.ts:688-700) which carries the linear start-gate.

2. advanceStep's guard order makes requireFrom the SOLE source-state barrier (execution.ts:641-655): `precheck` -> `requireFrom` -> `checkTransition`. Nothing else inspects the source state.

3. The machine legalises QUEUED->RUNNING: transitions.data.ts:1444 `{ from: 'QUEUED', to: 'RUNNING', trigger: 'startExecutionStep / ExecutionStepStarted' }`. So checkTransition is no backstop for a widened resolve.

4. NOOP is admitted, so the cited test's rationale IS wrong. stateMachine.ts:50 `if (from === to) return { klass: 'NOOP' };` and kit.ts:178 `if (c.klass === 'LEGAL' || c.klass === 'NOOP') return null;`. Proven live: with requireFrom DELETED, the RUNNING resume at execution-start-gate.test.ts:610 flips to ACCEPTED — so "RUNNING has no →RUNNING resume arrow" and the title's "the machine gates both" are both factually wrong; requireFrom is the refuser.

5. THE WIDENING MUTANT SURVIVES — run live. Set `requireFrom: ['WAITING','QUEUED']` in execution.ts:1113, ran `bunx vitest run` in packages/rph-application: **46 files passed, 355 passed | 1 skipped, GREEN**. No test anywhere dispatches ResolveExecutionStepWait against a QUEUED step (grep over the repo: only execution-start-gate.test.ts:557/663 and zzz-probe-complete-superseded.test.ts:206, all from WAITING or RUNNING). The e2e assertions at apps/rph-demo/e2e/execution-plan.e2e.ts:247-248 only assert the resolve BUTTON is not rendered on a QUEUED step — a different code path (affordance predicate), so they do not kill the handler-layer mutant. Under the mutant the described bypass is real: precheck passes, requireFrom passes, QUEUED->RUNNING is LEGAL, stepState becomes RUNNING with zero ExecutionStepStarted (so attemptsMadeForStep stays 0 and execution-attempts.ts has no row) and RPH-EXE-005 never evaluated.

WHY I DOWNGRADE TO MINOR (the part the finding overstates)

6. The DELETION mutant IS killed — run live. Removing the `requireFrom` line entirely produced exactly one failure: `execution-start-gate.test.ts:610 AssertionError: RUNNING has no →RUNNING resume arrow: expected 'ACCEPTED' to be 'REJECTED'`. So the guard is NOT vacuous.

7. More decisively, the standard the two prior fixes set is already MET here. execution-step-reissue-guard.test.ts:1-15 states the class it closed: guards where "deleting requireFrom (or widening it to admit **the target**) left the whole suite green", with the red-proof mutants being fail->['RUNNING','FAILED'] and retry->['FAILED','QUEUED'] — i.e. target-widening = the same-state re-issue. For resolveExecutionStepWait the target is RUNNING, so the target-widening mutant is ['WAITING','RUNNING'] — and the test at :610 dispatches resolve from RUNNING, so that mutant IS killed too. Both mutants of the named class are dead. What survives is a widening to a NON-target sibling source state (QUEUED), which no test on this surface has ever been required to pin. Real coverage gap, worth a cheap test; not the grade of the two guards that had zero kill tests.

RECOMMENDED FIX (unchanged in substance, reduced in urgency): add one case dispatching ResolveExecutionStepWait on a never-waited QUEUED step asserting REJECTED / RPH_ILLEGAL_STATE_TRANSITION / message contains "drivesFrom WAITING" / stepStateOf still QUEUED / zero ExecutionStepWaitResolved; and correct the two false rationale strings at execution-start-gate.test.ts:606 (title "the machine gates both") and :610 ("RUNNING has no →RUNNING resume arrow") — the machine gates only the wait half.

SIDE NOTE (debris, not part of this finding): two UNTRACKED probe test files are sitting in the suite and will run in CI — packages/rph-application/src/handlers/zzz-tev-resolve-queued-probe.test.ts (self-labelled "TEMPORARY PROBE — delete after observation") and packages/rph-application/src/handlers/zzv-rewait-verify.test.ts. They are console.log observation probes and do not kill the mutant. They should be deleted or promoted to real assertions.

Raw-byte check performed per the anti-false-positive rule: `sed -n '1108,1116p' ... | cat -v` shows the guard line contains only `M-bM-^@M-^T` (a normal em dash) — no control characters, nothing hidden. Source file restored byte-exact after both mutation runs (git diff --stat clean).

</details>

<details><summary>Test-evidence verifier evidence</summary>

TEST-EVIDENCE VERDICT: the coverage gap is REAL (one specific widening mutant is uncovered and unbackstopped), but the finding overstates it — the deletion mutant AND the canonical same-state widening mutant are both already killed by an existing test. Corrected MAJOR -> MINOR. Live behaviour is provably correct today; no user-visible defect exists.

WHAT I RAN (temporary probe, since deleted; no source file modified — `git diff --stat` on execution.ts / rph-domain/src is empty, `git status` shows none of my files remain):
Probe = 3-QUEUED linear ACTIVE plan, dispatch ResolveExecutionStepWait on a never-waited step. Deterministic across 5 runs:
  RESOLVE-ON-QUEUED  = REJECTED / RPH_ILLEGAL_STATE_TRANSITION
    msg: "ResolveExecutionStepWait requires step ...-s3 to be WAITING, but it is QUEUED. ... this command declares drivesFrom WAITING."
  step3 state after = QUEUED (unchanged)
  StartExecutionStep on the same QUEUED step = ACCEPTED -> RUNNING  (proves QUEUED->RUNNING is a LEGAL machine arrow)
Baseline suites green: execution-start-gate.test.ts + execution-step-reissue-guard.test.ts = 44/44 passed.

1) THE GUARD IS THE SOLE REFUSER — proven behaviourally, not by code-reading:
   - The rejection text is advanceStep's requireFrom message (execution.ts:647-653), NOT kit.ts checkTransition's "Illegal transition on ..." text. advanceStep runs precheck -> requireFrom -> checkTransition, so a requireFrom message proves the plan-ACTIVE precheck returned null (plan was ACTIVE).
   - The probe's second half proves checkTransition is no backstop: QUEUED->RUNNING is LEGAL (transitions.data.ts:1445, and StartExecutionStep rides it successfully in the same probe).
   => widening execution.ts:1113 to ['WAITING','QUEUED'] yields ACCEPTED, QUEUED->RUNNING, an ExecutionStepWaitResolved with NO ExecutionStepStarted, and startStepGate never consulted. I incidentally OBSERVED exactly that outcome once (status ACCEPTED, step3 = RUNNING, no error) during a window when a concurrent verifier agent evidently had execution.ts mutated — the tree also churned other agents' probe files (zzz-probe-complete-superseded.test.ts vanished mid-session). Flagging the provenance honestly: that observation is corroborating, not primary; the primary proof is the layer-attribution above.

2) NO EXISTING TEST PROVES THE QUEUED CASE WORKS. Repo-wide grep for ResolveExecutionStepWait hits only docs, vocab/messages/registry, apps/rph-demo/+page.server.ts:630, and ONE tracked test file. All six dispatch sites in execution-start-gate.test.ts (helper at :557):
   :570 WAITING->ACCEPTED · :580 WAITING->ACCEPTED · :601 WAITING->ACCEPTED · :663 WAITING->ACCEPTED
   :610 RUNNING->REJECTED · :624 WAITING under a CANCELLED plan->REJECTED (precheck)
   Covered source states = {WAITING, RUNNING}. QUEUED is never exercised. execution-step-reissue-guard.test.ts covers only Fail and Retry; dwp03/04/05/06/08-precondition-coverage.test.ts and command-precondition.ts never mention this command; there is no table-driven conformance test binding requireFrom to JAN-CMDPRE-SPEC-001 row 84. So the ['WAITING','QUEUED'] mutant survives the whole suite.

3) WHY THE GAP IS EXACTLY ONE MUTANT WIDE (this is where the finding is wrong). classifyTransition (rph-domain/src/stateMachine.ts:38-55) returns ILLEGAL_UNDEFINED for any arrow not in the matrix, and checkTransition admits only LEGAL|NOOP. In-arrows to RUNNING on ExecutionStep.stepState: QUEUED (LEGAL, 1445), WAITING (LEGAL, 1447), NOT_READY (ILLEGAL_EXPLICIT, ~1487); everything else is ILLEGAL_UNDEFINED. Probe confirmed READY->RUNNING is refused by requireFrom and would be machine-refused if widened. And the RUNNING widening — the canonical anti-vacuity mutant, "widen to admit the target", which is the exact standard execution-step-reissue-guard.test.ts:12-15 applies — IS killed by :610, because checkTransition classifies RUNNING->RUNNING as NOOP and admits it. So the finding's claim "every WIDENING mutant survives the entire suite" is FALSE; precisely one does: QUEUED. That single residual is why this is MINOR rather than the MAJOR its FailExecutionStep/RetryExecutionStep siblings earned (those had ZERO kill coverage — deletion itself survived).

4) THE SECONDARY CLAIM IS TRUE. At :610 the refusal comes from requireFrom, not the machine — the probe's RESOLVE-ON-RUNNING output is verbatim the requireFrom message. So the assertion rationale "RUNNING has no ->RUNNING resume arrow" and the test title "(the machine gates both)" are both factually wrong: the machine gates the wait half (QUEUED->WAITING is ILLEGAL_UNDEFINED) but NOT the resume half. This is a comment/label inaccuracy on a test that nonetheless does its job.

REMEDIATION (one assertion): in execution-start-gate.test.ts near :606, dispatch ResolveExecutionStepWait against a QUEUED step that never waited; assert REJECTED / RPH_ILLEGAL_STATE_TRANSITION / message contains "drivesFrom WAITING" / stepStateOf still QUEUED / zero ExecutionStepWaitResolved events; and correct the :610 rationale and the title.

</details>

**Live check needed.** None to settle the verdict. If the maintainer wants the mutant survival demonstrated end-to-end rather than deduced, apply `requireFrom: ['WAITING','QUEUED']` at packages/rph-application/src/handlers/execution.ts:1113 and run `bunx vitest run` in packages/rph-application — it will stay green (I could not run this myself: modifying source was out of scope, and the tree was being concurrently mutated by other verifier agents, so any transient result there is untrustworthy).


## F-19 · [CONFIRMED] [MAJOR] EnterExecutionStepWait's requireFrom ['RUNNING'] is an unkilled mutant — a re-wait appends a second, contradicting ExecutionStepWaiting

- **Lens:** `wait-resume`
- **Site:** `packages/rph-application/src/handlers/execution.ts:1087 (requireFrom) with the only negative at packages/rph-application/src/handlers/execution-start-gate.test.ts:608`

**Claim.** The machine's only in-arrow to WAITING is RUNNING->WAITING (transitions.data.ts:1446), so requireFrom:['RUNNING'] has exactly one live effect: refusing the WAITING->WAITING re-issue, which checkTransition admits as a NOOP (kit.ts:181). No test exercises that. The only negative, execution-start-gate.test.ts:608, waits from QUEUED — refused independently by checkTransition because no QUEUED->WAITING arrow exists — and the test title ('the machine gates both') credits the machine, confirming the masking. `grep -rn "EnterExecutionStepWait" packages/*/src` shows dispatch sites only at execution-start-gate.test.ts:550 and :635; neither issues a second wait. This is byte-identical to the FailExecutionStep/RetryExecutionStep unkilled mutants the prior review fixed, whose kill tests live in execution-step-reissue-guard.test.ts:126 and :150.

**Failure scenario.** Delete `requireFrom: ['RUNNING']` from execution.ts:1087 (or widen it to include 'WAITING'). The full suite stays GREEN. Then: activate a plan, StartExecutionStep(s1) -> RUNNING, EnterExecutionStepWait(s1,{waitReason:'blocked on external approval'}) -> ACCEPTED, step is WAITING. Re-issue EnterExecutionStepWait(s1,{waitReason:'blocked on vendor delivery'}) -> now also ACCEPTED: checkTransition admits WAITING->WAITING as a NOOP, advanceStep appends a SECOND ExecutionStepWaiting carrying a CONTRADICTING waitReason to an append-only stream, bumps the plan revision, and rewrites steps[] for a transition that did not happen. Any reader folding the stream sees two distinct wait-entry facts for one suspension, with no way to tell which reason is authoritative — the exact INV-2/INV-6 harm execution-step-reissue-guard.test.ts was written to close.

**Suggested fix.** Add a re-wait kill test to execution-step-reissue-guard.test.ts mirroring its existing :126 shape: start s1, wait s1 with reason A (ACCEPTED), re-issue wait s1 with a contradicting reason B, assert REJECTED / RPH_ILLEGAL_STATE_TRANSITION / message contains 'drivesFrom RUNNING' / exactly ONE ExecutionStepWaiting event in the store / the recorded waitReason is still A / the plan revision did not advance.

<details><summary>Code-semantics verifier evidence</summary>

I tried to refute this and could not — every candidate earlier guard is absent, and I killed the mutant empirically (twice) with the suite staying GREEN.

1) requireFrom is the ONLY guard on this command. `enterExecutionStepWait` (packages/rph-application/src/handlers/execution.ts:1081-1096) passes NO `precheck` — unlike its sibling `resolveExecutionStepWait` (:1120-1127, plan-ACTIVE precheck) and unlike `pruneExecutionStep` (:1048). Its own doc comment says so: "there is DELIBERATELY no plan-ACTIVE precheck ... The machine (checkTransition, from RUNNING) alone gates the source." In `advanceStep` the order is precheck (:645) -> requireFrom (:647-653) -> checkTransition (:654) -> unconditional event append + revision bump (:656-675). With requireFrom gone, nothing else stands between a re-wait and the append.

2) The machine ADMITS WAITING->WAITING. `classifyTransition` (packages/rph-domain/src/stateMachine.ts:38-56) consults `illegal` first, then `if (from === to) return { klass: 'NOOP' }`. The `ExecutionStep.stepState` machine's illegal table (transitions.data.ts:1484-1491) contains exactly ONE entry, NOT_READY->RUNNING — no WAITING self-edge. `checkTransition` (kit.ts:171-185) returns null for `LEGAL || NOOP`. I asserted this live: `classifyTransition('ExecutionStep.stepState','WAITING','WAITING').klass === 'NOOP'` PASSES.

3) Dynamic proof that requireFrom is the refuser today (temp probe, since deleted): activate plan -> Start -> EnterExecutionStepWait(reason A) ACCEPTED -> re-issue EnterExecutionStepWait(reason B) with a distinct idempotencyKey -> REJECTED with the requireFrom message verbatim: "EnterExecutionStepWait requires step ...-s to be RUNNING, but it is WAITING. ... this command declares drivesFrom RUNNING." (not the machine's "Illegal transition on ..." message). Exactly one ExecutionStepWaiting event, revision 4, stepState WAITING.

4) MUTATION RUNS (packages/rph-application, `node ../../node_modules/vitest/vitest.mjs run`):
   - baseline (HEAD): 47 files / 358 passed, 0 failed.
   - MUTANT-B, widen to `requireFrom: ['RUNNING','WAITING']`: 46 files / 356 passed, 0 FAILED — GREEN.
   - MUTANT-C, requireFrom line DELETED entirely: 46 files / 353 passed, 0 FAILED — GREEN.
   (File/test counts drift between runs only because parallel agents were adding/removing their own zz* probe files; zero failures in every run. execution.ts is now restored — `git diff` on it is empty.)

5) The masking is exactly as claimed. `grep -rn EnterExecutionStepWait packages/*/src` yields only execution.ts, registry.ts:138, contracts messages.ts, and execution-start-gate.test.ts. All six `wait(...)` call sites in that test (lines 567, 579, 600, 608, 620, 652) act on a step that is RUNNING or QUEUED — none issues a SECOND wait. The single negative, :608 `expect(wait(1).status, 'QUEUED has no →WAITING arrow').toBe('REJECTED')`, asserts status ONLY (no code, no message), and QUEUED->WAITING is ILLEGAL_UNDEFINED at the machine layer — so it rejects with or without requireFrom, and its own title credits the machine ("the machine gates both"). That is why MUTANT-C also survives.

6) The UI/e2e cannot kill it either: the "WAITING affords Resume but no longer Wait" assertions (execution-flow.e2e.ts:363-364, execution-plan.e2e.ts:271-272) read `controlCommands`, computed by an INDEPENDENT table in packages/rph-projections/src/execution-view.ts:140 (`RUNNING: ['cancel','wait']`) — a projection constant with no link to the handler's requireFrom. Mutating the handler leaves those green (and Playwright is not in the vitest run at all).

7) The harm is real under the mutant: advanceStep appends the event and bumps the revision unconditionally once the guards pass, so a re-wait writes a SECOND ExecutionStepWaiting carrying a contradicting `waitReason` to an append-only stream with no retraction mechanism, plus a revision bump and a steps[] rewrite for a transition that did not occur — byte-identical to the Fail/Retry harm that execution-step-reissue-guard.test.ts:126/:150 was written to close (its own header states the same reasoning: "requireFrom is the SOLE guard against a same-state re-issue on the step machine").

Correction to the finding's citation only: advanceStep's requireFrom check is at execution.ts:647-653 (the header comment in execution-step-reissue-guard.test.ts:6 cites the older 601-608). Contrast worth recording: `resolveExecutionStepWait`'s `requireFrom: ['WAITING']` IS killed — execution-start-gate.test.ts:610 resumes from RUNNING, and RUNNING->RUNNING would classify NOOP, so only requireFrom refuses it. The wait half is the one with no kill test.

Suggested fix stands as written: add a re-wait kill test to execution-step-reissue-guard.test.ts asserting REJECTED / RPH_ILLEGAL_STATE_TRANSITION / message contains 'drivesFrom RUNNING' / exactly ONE ExecutionStepWaiting in the store / waitReason still A / revision unchanged. Note it must assert the CODE+MESSAGE (or event count), not status alone, or it will mask MUTANT-C the same way :608 does.

</details>

<details><summary>Test-evidence verifier evidence</summary>

CONFIRMED from the test/behaviour side. I wrote a temporary probe (packages/rph-application/src/handlers/zzzverify-wait-reissue.probe.test.ts, since DELETED — `git status` confirms it is gone; the other zz*/zzz* probes in that directory belong to concurrent lenses, not me) and modified NO source file.

1) THE GUARD IS THE SOLE DEFENCE, AND THE MACHINE WOULD ADMIT THE RE-WAIT. Probe assertion, PASSED: `classifyTransition('ExecutionStep.stepState','WAITING','WAITING').klass === 'NOOP'`. Same probe, PASSED: for every other source state (NOT_READY, READY, QUEUED, SUCCEEDED, FAILED, SKIPPED, CANCELLED, SUPERSEDED) the classification into WAITING is neither LEGAL nor NOOP. So RUNNING is the only LEGAL in-arrow (transitions.data.ts:1446) and WAITING is the only NOOP one — `requireFrom:['RUNNING']` at execution.ts:1087 has exactly ONE live effect: refusing the WAITING->WAITING re-issue. Confirmed against the code path: advanceStep runs `requireFrom` at execution.ts:648-655 BEFORE `checkTransition` at :656, and checkTransition (kit.ts:171-185) returns null for `NOOP`.

2) LIVE BEHAVIOUR TODAY (probe console output, run under `bunx vitest run … --silent=false`):
   RE-WAIT status: REJECTED code: RPH_ILLEGAL_STATE_TRANSITION msg: "EnterExecutionStepWait requires step …-s to be RUNNING, but it is WAITING. … this command declares drivesFrom RUNNING."
   ExecutionStepWaiting count: 1; plan events before/after re-wait: 5 -> 5.
   i.e. the guard is live and correct — and it is the requireFrom message, not checkTransition's "Illegal transition on …" message, that fires. Remove it and the re-wait becomes a NOOP-admitted append.

3) NO TEST EXERCISES IT — the coverage gap is real. Every `EnterExecutionStepWait` dispatch site in the repo: execution-start-gate.test.ts:550 (helper, used at :568, :579, :600, :608, :620) and :635 (helper, used at :652); apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts:623 (form action). NONE issues a second wait against an already-WAITING step. execution-step-reissue-guard.test.ts covers only Fail (:126) and Retry (:150).

4) THE ONLY NEGATIVE IS MASKED — and the finding's mechanism needs one correction that does NOT change the conclusion. The finding claims execution-start-gate.test.ts:608 is "refused independently by checkTransition". My probe shows the QUEUED wait is actually refused BY requireFrom today (message: "…requires step … to be RUNNING, but it is QUEUED…"). But under the mutation the outcome is unchanged: per (1), QUEUED->WAITING classifies neither LEGAL nor NOOP, so checkTransition rejects it instead, and :608 asserts only `.status === 'REJECTED'` (the string is a vitest assertion label, not an error-message assertion). The test stays GREEN under both deletion and widening to ['RUNNING','WAITING'] — the mutant survives.

5) THE E2E CANNOT KILL IT EITHER. apps/rph-demo/e2e/execution-plan.e2e.ts:273 asserts `step-action-wait` has count 0 on a WAITING step — but that affordance comes from the hardcoded projection table `CONTROL_BY_STEP_STATE` at packages/rph-projections/src/execution-view.ts:136-147 (`WAITING: ['cancel','resolve']`), which never consults the handler's requireFrom. Deleting requireFrom leaves the affordance render byte-identical, so the e2e stays green too. (This does mean the UI does not expose the double-wait; the harm is reachable via a direct dispatch / form POST to the `enterWaitStep` action at +page.server.ts:621-627.)

CONSEQUENCE, as the finding states: a second ExecutionStepWaiting with a contradicting `waitReason` appended to an append-only stream for a transition that did not occur, plus a plan-revision bump and a steps[] rewrite. Structurally byte-identical to the two MAJOR unkilled mutants the prior CMDPRE review fixed, so MAJOR is the consistent grade — noting the harm is stream/replay integrity (INV-2/INV-6), not state corruption: stepState is unchanged, no attempt is minted, and the retry cap is untouched.

FIX: the suggested kill test is right — add to execution-step-reissue-guard.test.ts, mirroring its :126 shape: start -> wait(reason A, ACCEPTED) -> re-wait(reason B) asserting REJECTED / RPH_ILLEGAL_STATE_TRANSITION / message contains 'drivesFrom RUNNING' / exactly one ExecutionStepWaiting whose waitReason is still A. NOTE for the parent: a concurrent lens left `zzv-rewait-verify.test.ts` in that directory covering the same ground — dedupe before landing.

INCIDENTAL: mid-review `git diff` showed an uncommitted live source mutation in packages/rph-application/src/handlers/execution.ts:1113 (`requireFrom: ['WAITING', 'QUEUED'], // MUTANT-PROBE (revert)`) left by another lens. It has since been reverted (execution.ts is clean as of my final `git status`), but the parent should verify the tree is clean before committing.

</details>

**Live check needed.** None — settled. The one thing I could not do under the "no source modification" rule is run the literal mutant; the conclusion is instead proven deductively from (a) the complete enumeration of EnterExecutionStepWait dispatch sites and (b) the probe-verified classifyTransition results showing that every state the mutation would newly admit is either already refused by checkTransition (all non-RUNNING, non-WAITING sources) or is precisely the untested WAITING->WAITING NOOP. If the parent wants the literal red-proof, delete `requireFrom: ['RUNNING']` at execution.ts:1087 and run `cd packages/rph-application && bunx vitest run` — it will pass.


## F-20 · [CONFIRMED] [MAJOR] startStepGate and prunableStepIds directly contradict each other on the same step, and the prune refusal message states the opposite of the truth

- **Lens:** `deadness-prune`
- **Site:** `packages/rph-domain/src/transition-gate.ts:394-398 vs :323-334; refusal text at packages/rph-application/src/handlers/execution.ts:1062-1067`

**Claim.** For a step whose in-edges all come from CANCELLED/SUPERSEDED sources, startStepGate returns not-ok with reason 'every in-edge is neutralized — the step is unreachable (it should be pruned)' (:394-398), while prunableStepIds returns [] for that same step (:329, because liveStepIds still holds it). pruneExecutionStep's precheck (handlers/execution.ts:1056) reads prunableStepIds and refuses with 'Cannot prune step X: it is still reachable — every in-edge would have to be excluded by the plan's own branch logic'. Two exported functions of one module give opposite answers about the same step, and the user-facing refusal asserts reachability that the gate has just denied. The map's own claim that these two halves 'cannot diverge' (:5-8, :348-349) is false in this direction. This is what drives an operator to the waiver-skip that produces the resurrection in the preceding finding.

**Failure scenario.** CONFIRMED by execution. Activate a 3-step graph plan s1->s2->s3; Start+Complete s1; Start s2; Cancel s2. Then: StartExecutionStep(s3) -> REJECTED, message ends '...the step is unreachable (it should be pruned) (RPH-EXE-005)'. PruneExecutionStep(s3) -> REJECTED, message 'Cannot prune step ...-s3: it is still reachable...'. The engine tells the operator to prune, then refuses the prune on the ground that the step is reachable. CompleteExecutionPlan -> REJECTED ('2 step(s) not in terminal success (CANCELLED, QUEUED)'). The plan has no legal path to COMPLETED and the diagnostics point in two directions at once.

**Suggested fix.** Make the two share one predicate. Either derive the 'unreachable' branch of startStepGate from !liveStepIds(...).has(stepId) (so the gate and the prune set are the same fact), or fix the underlying liveness rule per the preceding finding. Whichever is chosen, add a property-style test that for every step of a fixture set, startStepGate's 'every in-edge is neutralized' verdict implies membership in prunableStepIds when the step is in PRUNABLE_SOURCE_STATES.

<details><summary>Code-semantics verifier evidence</summary>

REPRODUCED at the domain layer (temporary vitest probe in packages/rph-domain/src, since deleted; run with `bun x vitest run <file> --disable-console-intercept`). Plan {status:ACTIVE, steps:[s1 SUCCEEDED, s2 CANCELLED, s3 QUEUED], transitions:[s1->s2, s2->s3]} yields verbatim:

  CANCELLED gate(s3)  = {"ok":false,"reason":"every in-edge is neutralized — the step is unreachable (it should be pruned)"}
  CANCELLED prunable  = []
  CANCELLED startable = []
  CANCELLED disp      = NEUTRALIZED

The trace behind it:
- transition-gate.ts:221 `if (!TERMINAL_SUCCESS.has(src)) return 'NEUTRALIZED';` — a CANCELLED source neutralizes the in-edge, so barrierState gives anyPending=false/anySatisfied=false and startStepGate falls to :394-398 with the "(it should be pruned)" reason.
- transition-gate.ts:169 `if (source === undefined || !TERMINAL_SUCCESS.has(source.stepState)) return false; // unsettled ⇒ excludes nothing` — branchExcludes returns FALSE for the same CANCELLED source, so liveStepIds (:147) still pushes s3, and prunableStepIds' `!live.has(s.id)` (:329) filters s3 out.
- handlers/execution.ts:1056-1067 reads that same empty set and rejects with the literal `Cannot prune step ${p.stepId}: it is still reachable — every in-edge would have to be excluded by the plan's own branch logic ...`. So the engine literally says "it should be pruned", then "it is still reachable" for one step. CompleteExecutionPlan is also refused (handlers/execution.ts:483-491, `every SUCCEEDED||SKIPPED`), because s2 is CANCELLED. ExecutionStep CANCELLED has no out-arrow (transitions.data.ts:1436-1483), so s3 truly never becomes startable.

WORSE VARIANT the finding did not name, same probe: a FAILED source produces the IDENTICAL string —
  FAILED gate(s3) = {"ok":false,"reason":"every in-edge is neutralized — the step is unreachable (it should be pruned)"}
  FAILED prunable = []
Here the message is factually FALSE: FAILED->QUEUED is retryable (transitions.data.ts:1456), so s3 is not unreachable, and transition-gate.test.ts:410-417 ("a retryable failure must not launder into SKIPPED") shows the prune refusal is DELIBERATE and tested. Control case: for a genuine branch-excluded arm the two DO agree (probe: `BRANCH gate(a2) ok=false` and `BRANCH prunable = ["a2"]`).

WHAT I REFUTE IN THE FINDING (why MAJOR -> MINOR):
1. The "cannot diverge" contract is misquoted. transition-gate.ts:5-8 and :348-349 assert startStepGate mirrors **startableStepIds** (authority vs read-model), not prunableStepIds. Those two agree exactly here (probe: `startable = []` and `gate(s3).ok = false`). No documented invariant is violated.
2. prunableStepIds' behaviour is CORRECT and intentional, not the other half of a contradiction: refusing to prune a non-branch-excluded step is what stops a prune laundering into an unwaived SKIPPED (handlers/execution.ts:1013-1027 rationale; test at transition-gate.test.ts:411-417). The defect is one-sided — startStepGate's reason string overreaches, being emitted for {branch-excluded, FAILED-source, CANCELLED-source} while only the first is prunable.
3. "The plan has no legal path to COMPLETED and ... deadlock" is true but misattributed: non-completability is caused by s2 being CANCELLED (a step state that is terminal and not in the success allow-list), not by the prune refusal — pruning s3 would not make the plan completable either. And the plan is not wedged: ExecutionPlan.status ACTIVE->CANCELLED/FAILED/SUPERSEDED all exist (transitions.data.ts:1391-1413), and the completion refusal itself says "FailExecutionPlan a plan with a failed step."

Residual real defect: a false/self-contradicting operator diagnostic that can induce a waiver-skip (the only command the engine will accept there) — which in the FAILED case would destroy a live retry path. Fix = narrow the message, e.g. distinguish "no in-edge is currently satisfied (a predecessor was cancelled/failed)" from `!liveStepIds(plan,g).has(stepId)` "structurally excluded — prune it", and add the property test the finding proposes (gate's "prune it" verdict IMPLIES membership in prunableStepIds), which today has no coverage: transition-gate.test.ts only asserts the pair agrees in the startable direction (:166) and never in the unreachable direction.

</details>

<details><summary>Test-evidence verifier evidence</summary>

REPRODUCED BY EXECUTION, then downgraded on impact.

1) THE DIVERGENCE IS REAL. I wrote a temporary probe (packages/rph-domain/src/zzprobe-testlens-gate.test.ts, since DELETED; no source file touched) and ran `bunx vitest run`. Plan ACTIVE, steps [s1 SUCCEEDED, s2 <X>, s3 QUEUED], edges s1->s2, s2->s3. Actual output:
 - X=CANCELLED:  startStepGate(s3) = {"ok":false,"reason":"every in-edge is neutralized — the step is unreachable (it should be pruned)"} ; prunableStepIds = []
 - X=SUPERSEDED: identical (gate not-ok "…should be pruned"; prunable = [])
 - X=FAILED:     identical (gate not-ok "…should be pruned"; prunable = [])
 - CONTROL, BRANCH not-taken arm: same gate reason AND prunableStepIds = ['s3'] — the two functions agree there.
So the two exported halves of transition-gate.ts genuinely disagree whenever every in-edge of a step comes from a terminal-NON-success source, and the module comment's claim that they "cannot diverge" (transition-gate.ts:5-8, :348-349) is false in that direction. Mechanism verified by reading: inEdgeDisposition returns NEUTRALIZED for a terminal-non-success source (transition-gate.ts:221) while branchExcludes deliberately returns false for such a source (:169), so liveStepIds still contains the target and prunableStepIds filters it out (:329). The operator-facing contradiction is real: handlers/execution.ts:1056-1067 refuses the prune with "it is still reachable", the exact opposite of what the gate just said.

2) TEST-EVIDENCE / COVERAGE. The lens's coverage claim is CORRECT. Grep over packages/ + apps/ (excluding dist and .svelte-kit) shows 'every in-edge is neutralized' / 'should be pruned' appears ONLY at transition-gate.ts:397 — zero test references anywhere. The branch IS executed by the suite (transition-gate.test.ts:360 and :371, s2 SKIPPED on a dead arm), but in every test that reaches it the two functions AGREE (:361 asserts prunable=['s4']). transition-gate.test.ts:166-172 asserts only the one-directional `startStepGate(p,id).ok || !startable.has(id)`, which passes vacuously for every not-ok step. The two application-layer prune-refusal tests (execution-start-gate.test.ts:690 and :708) exercise genuinely REACHABLE steps (a linear plan; a BRANCH's taken arm) — correct behaviour, not this scenario. No existing test refutes the finding, and none asserts agreement in the 'unreachable' direction.

3) WHY MINOR, NOT MAJOR — the failureScenario's causal framing does not survive checking. The finding says the divergence leaves the plan with "no legal path to COMPLETED". That deadlock is caused by the CANCEL, not by this divergence: completeExecutionPlan requires every step SUCCEEDED or SKIPPED (handlers/execution.ts:490), so the moment s2 is CANCELLED the plan is already uncompletable regardless of s3, and the legal disposition is CancelExecutionPlan (transitions.data.ts:1392) or FailExecutionPlan. Enumerating the reachable shapes: a step is all-in-edges-NEUTRALIZED-but-still-live only if a live in-edge source is FAILED, CANCELLED or SUPERSEDED. CANCELLED/SUPERSEDED have no out-arrows (verified — transitions.data.ts step block has no `from: 'CANCELLED'`/`from: 'SUPERSEDED'`), so those plans are already doomed independently. FAILED is retryable (transitions.data.ts:1456 FAILED->QUEUED), the plan is fully recoverable, and refusing the prune is PROVABLY the intended, tested behaviour — transition-gate.test.ts:411-417 "does NOT offer the downstream of a FAILED step for prune… a retryable failure must not launder into SKIPPED", which also asserts inEdgeDisposition = NEUTRALIZED on that same edge, i.e. the suite already ratifies the asymmetry deliberately. There is therefore NO plan shape where this divergence strands an otherwise-completable plan, admits an illegal transition, or corrupts state. The confirmed defect is diagnostic: the gate instructs the operator to prune a step the engine will (correctly, for FAILED) refuse to prune, and answers with the opposite assertion — plus a false "cannot diverge" comment and an untested direction (anti-vacuity gap, JPWB-CON-000 B7).

4) FIX DIRECTION MATTERS. Only one arm of the suggested fix is safe: derive the gate's 'unreachable' branch from !liveStepIds(...) — i.e. stop CLAIMING unreachable when the source merely FAILED/CANCELLED, and say "every in-edge predecessor terminated without success" instead. Making prunableStepIds include the step would directly break transition-gate.test.ts:414 and re-open the launder-a-retryable-failure-into-SKIPPED hole that test exists to close.

HYGIENE (unrelated, not mine): other lenses left untracked probe files at packages/rph-domain/src/zz-probe-cancel.test.ts, zzprobe-cancelled-arm.test.ts, zzlens-entryedge-probe.test.ts and zzverify-entry-edge.test.ts — they will fail the domain suite if left in place.

</details>

**Live check needed.** None outstanding. Reproduced live with a temporary vitest probe under packages/rph-domain (deleted after the run, no source modified); the application-layer contradiction is settled by handlers/execution.ts:1056-1067 read against the confirmed prunableStepIds = [] result.


## F-21 · [CONFIRMED] [MAJOR] A BRANCH terminated by Skip or Prune never records selectedTransitionId, so its selection is re-derived on every read — a later guard flip resurrects an already-pruned arm and strands the arm that ran

- **Lens:** `deadness-prune`
- **Site:** `packages/rph-application/src/handlers/execution.ts:762-779 (mutateStep is on completeExecutionStep ONLY) with packages/rph-domain/src/transition-gate.ts:109-119 and :171-172`

**Claim.** selectBranchEdge honours a recorded selectedTransitionId (:109-113) and otherwise re-derives first-match against the CURRENT condition subject (:115-118). The only writer of selectedTransitionId is completeExecutionStep's mutateStep (handlers/execution.ts:762-779), gated on `step.stepType !== 'BRANCH' ? step : ...` and reachable only from requireFrom ['RUNNING']. skipExecutionStep (:952-988) and pruneExecutionStep (:1028-1071) supply NO mutateStep and perform no stepType check, so a BRANCH driven to SKIPPED by either command is terminal-SUCCESS (in TERMINAL_SUCCESS, so branchExcludes :169 engages it) with NO recorded decision. From then on its arm selection is recomputed from live state on every single read — precisely the instability DWP-09 exists to remove, per the comment at :104-108 ('a step reachable only through a not-taken edge can still change state, and an ATTEMPTS or STEP_STATE guard over it will flip').

**Failure scenario.** CONFIRMED at the kernel. Plan: e -> b(BRANCH) and e -> sz (parallel); b --CONDITIONAL(eA, guard STEP_STATE(sz,'SUCCEEDED'))--> x ; b --SEQUENTIAL default(eB)--> y ; y -> z. SkipExecutionStep(b, {mandatory:false}) while sz is QUEUED — accepted, b = SKIPPED, no selection recorded. Guard is false, so first-match falls to default eB: prunableStepIds returns ['x'], and the operator prunes x to SKIPPED. Work proceeds down y; y reaches SUCCEEDED and z is startable (observed startable = ['z','sz']). Now sz SUCCEEDS on the parallel arm, flipping the guard true. Re-derivation now picks eA: observed inEdgeDisposition(b->x) = SATISFIED (the pruned arm is LIVE again) and inEdgeDisposition(b->y) = NEUTRALIZED, so prunableStepIds returns ['y'] in the QUEUED case and ['z'] in the y-already-SUCCEEDED case. The downstream of a step that genuinely executed and succeeded is now offered for prune-to-SKIPPED with no waiver, and the arm the plan actually excluded is resurrected. Control: the same fixture with selectedTransitionId:'eB' recorded returns prunable ['x'] regardless of the flip — proving the recorded-decision limb works and that only the skip/prune path is exposed.

**Suggested fix.** Record the point-in-time selection wherever a BRANCH reaches terminal-success, not only on Complete: give skipExecutionStep and pruneExecutionStep the same mutateStep resolution used at :762-779. Alternatively make a BRANCH whose selection is unresolved NEUTRALIZE all of its arms (fail-closed) rather than silently re-deriving, and refuse Skip on a BRANCH step outright. Either way, add the domain-layer resolved-once tests (recorded id honoured; recorded id matching no out-edge selects nothing).

<details><summary>Code-semantics verifier evidence</summary>

I tried hard to refute this and could not. I read every cited site, traced the control flow, and then EXECUTED the scenario through the real engine (a temporary probe suite in packages/rph-application, run with `bunx vitest run` — removed afterwards). It reproduces exactly as claimed, and worse.

CODE FACTS (verified, not inferred)

1. The recorder is Complete-ONLY. packages/rph-application/src/handlers/execution.ts:762-779 — `mutateStep: (step) => { if (step.stepType !== 'BRANCH') return step; ... return selected === undefined ? step : { ...step, selectedTransitionId: selected }; }` is an argument of `completeExecutionStep` only, and that handler carries `requireFrom: ['RUNNING']` (:756).

2. skipExecutionStep (execution.ts:952-988) passes `stepId/target/eventType/requireFrom: ['READY','QUEUED']/eventPayload/precheck` — NO `mutateStep`, and no `stepType` inspection anywhere in the handler. Its precheck (:966-986) checks only plan-ACTIVE and `canSkipStep({ mandatory: p.mandatory ?? true, ... })`. pruneExecutionStep (execution.ts:1028-1071) is the same: `requireFrom: ['NOT_READY','READY','QUEUED']`, precheck = plan-ACTIVE + `prunableStepIds(...).includes(stepId)`, no `mutateStep`. `advanceStep` (:656) applies `args.mutateStep ? args.mutateStep(step) : step` — so with no mutator the step is written back verbatim and `selectedTransitionId` is never set.

3. Nothing upstream refuses a Skip on a BRANCH. The machine has `{ from: 'QUEUED', to: 'SKIPPED', trigger: 'ExecutionStepSkipped' }` (transitions.data.ts:1463-1468); `canSkipStep` (rph-domain/src/execution.ts:194-201) returns `{ ok: true }` on the first limb when `!input.mandatory`. `grep -rn "BRANCH" packages/rph-application/src/` shows the ONLY stepType==='BRANCH' test in the whole application layer is execution.ts:763 (the Complete-path recorder).

4. The re-derivation limb then engages. transition-gate.ts:169 `if (source === undefined || !TERMINAL_SUCCESS.has(source.stepState)) return false;` — SKIPPED IS in TERMINAL_SUCCESS (:17), so a skipped BRANCH is "settled". :171-172 routes to `selectBranchEdge`, whose recorded-decision limb (:109-113) is skipped because `selectedTransitionId` is undefined, falling through to the live first-match loop (:115-118) — re-evaluated on EVERY read, which is precisely what the :104-108 comment says must not happen.

EXECUTED PROOF (real engine, SqliteStorageAdapter + Engine.dispatch)
Fixture: s1(entry) -> s2(BRANCH) and s1 -> s6 (parallel); s2 --COND[STEP_STATE(s6,'SUCCEEDED')]--> s3 ; s2 --SEQ default--> s4 ; s4 -> s5 ; (variant) s3 -> s7. Proposes/approves/activates cleanly — one entry, DAG, default last, conditional only off the BRANCH.

CONTROL (Complete path) — PASSES: start(2)+complete(2) records `selectedTransitionId = plan…-t2-4`; after s6 succeeds and flips the guard, start(5) is still ACCEPTED. The recorded-decision limb works.

DEFECT (Skip path) — start(1), complete(1), then SkipExecutionStep(s2, mandatory:false):
  SKIP branch: ACCEPTED
  recorded selection after skip: undefined
  prune(s3) [not-taken arm]: ACCEPTED        <- pruned under the default selection
  start(s5) BEFORE flip: ACCEPTED            <- the taken arm is genuinely live
Then s6 SUCCEEDS (guard flips true):
  start(s5) AFTER flip: REJECTED  RPH_ILLEGAL_STATE_TRANSITION "Cannot start step …-s5: every in-edge is neutralized — the step is unreachable (it should be pruned) (RPH-EXE-005)."
  prune(s5) AFTER flip: ACCEPTED             <- downstream of s4, which genuinely SUCCEEDED, is now offered for an unwaived system prune
  final states: 1=SUCCEEDED 2=SKIPPED 3=SKIPPED 4=SUCCEEDED 5=SKIPPED 6=SUCCEEDED

WORSE THAN REPORTED — the pruned arm actually RESURRECTS AND RUNS. With s7 hanging off s3:
  start(s7) BEFORE flip (excluded interior): REJECTED
  start(s7) AFTER flip (was on the PRUNED arm): ACCEPTED
  final states: 1=SUCCEEDED 2=SKIPPED 3=SKIPPED 4=SUCCEEDED 5=QUEUED 6=SUCCEEDED 7=RUNNING
s3 was pruned to SKIPPED as a not-taken arm, yet its interior s7 is now RUNNING while the arm that actually executed (s4/s5) is declared unreachable. This is the DWP-07/DWP-08 resurrection class recurring for the third time, through a third route (unrecorded selection rather than command-keyed deadness).

OPERATOR REACHABILITY IS ONE CLICK. apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts:598-604 dispatches SkipExecutionStep with `mandatory: false` hardcoded; +page.svelte:344-355 renders that button from `s.controlCommands`, and `controlCommandsFor` in packages/rph-projections/src/execution-view.ts is keyed on stepState ONLY (READY|QUEUED) — it never inspects stepType, so a QUEUED BRANCH row shows "Skip".

ANTI-VACUITY GAP CORROBORATED. `grep -rn "selectedTransitionId|resolveBranchSelection"` over all test files: the only assertions live at execution-start-gate.test.ts:958 and :962, both on the Complete path. packages/rph-domain/src/transition-gate.test.ts references neither — the resolved-once rule has ZERO domain-layer coverage, and no test anywhere terminates a BRANCH by Skip or Prune.

SEVERITY: MAJOR is right, not BLOCKER — it needs a guard whose subject sits outside the branch's own subtree and changes state after the branch settles (the exact shape DWP-09's own fixture uses), plus an operator skipping the BRANCH itself. But INSIDE that shape the outcome is a hard correctness violation: an excluded arm runs, and terminal-success is reached with the wrong arms.

Note on the suggested fix: giving skip/prune the same mutateStep is only half-right for PRUNE — a pruned BRANCH sits inside an already-dead region (liveStepIds never reaches its out-edges), so the exposure is the SKIP path. The cleaner fail-closed option is to refuse Skip on a BRANCH outright (a BRANCH must DECIDE, and a waiver is not a decision) — or, if Skip must be allowed, record the selection at that moment exactly as Complete does. Either way the domain-layer resolved-once tests (recorded id honoured; recorded id matching no out-edge selects nothing) are missing and should be added.

</details>

<details><summary>Test-evidence verifier evidence</summary>

SETTLED BY RUNNING IT. I built a temporary probe (now deleted) that is byte-for-byte the shipped DWP-09 fixture from execution-start-gate.test.ts:924-954 — s1 BRANCH --COND[STEP_STATE(s4,'SKIPPED')]--> s2 ; --SEQ default--> s3 --> s4 — plus one extra edge s2 --> s5 so the not-taken arm has an interior. Two runs of the SAME fixture, differing only in how the BRANCH reaches terminal-success.

CONTROL (Complete path, the covered one), observed output:
  CONTROL.selectedTransitionId = plan_...-t1-3 | CONTROL.afterFlip.start(2) = REJECTED | CONTROL.afterFlip.start(5) = REJECTED
The decision is recorded and HOLDS across the guard flip. This is what execution-start-gate.test.ts:965 already proves.

PROBE (Skip path, the uncovered one), observed output verbatim:
  skip(BRANCH s1).status = ACCEPTED | skip(BRANCH s1).error = {} | s1.stepState = SKIPPED | s1.selectedTransitionId = undefined | beforeFlip.start(2) = REJECTED | beforeFlip.start(5) = REJECTED | beforeFlip.start(3) = ACCEPTED | beforeFlip.complete(3) = ACCEPTED | beforeFlip.prune(2) = ACCEPTED | s2.stepState = SKIPPED | skip(4) = ACCEPTED | s4.stepState = SKIPPED | afterFlip.start(5) = ACCEPTED | afterFlip.s5.stepState = RUNNING | afterFlip.prune(5) = REJECTED

Read that sequence: SkipExecutionStep{mandatory:false} on a BRANCH step is ACCEPTED with NO stepType check and records selectedTransitionId = undefined. The gate then re-derives first-match on every read: before the flip s2/s5 are correctly excluded (start REJECTED) and the operator legitimately PRUNES s2 to SKIPPED. Then s4 (the guard subject, on the arm that actually ran) is skipped, flipping STEP_STATE(s4,'SKIPPED') true — and the already-settled, already-pruned arm comes back to life: s5, the interior of the arm the plan excluded and the operator pruned, is STARTED and is RUNNING. Real work executes on a dead arm. Simultaneously prune(5) flips from available to REJECTED ("still reachable"), so the plan can no longer be closed out through the prune path it was on. The identical fixture through Complete returns REJECTED for exactly the same call. This is the DWP-07/DWP-08 resurrection class recurring a third time, via a third vector.

COVERAGE GAP (the test-lens half). A repo-wide grep for `selectedTransitionId|resolveBranchSelection` over every *.test.ts and *.e2e.ts returns exactly TWO non-probe assertions, both in packages/rph-application/src/handlers/execution-start-gate.test.ts (:958, :962), and both DWP-09 tests (:956, :965) drive the branch with start(1);complete(1). No test anywhere reaches a BRANCH's terminal-success by any other command. packages/rph-domain/src/transition-gate.test.ts (480 lines, the DWP-03/07/08 home) never once sets selectedTransitionId, so the recorded-decision limb at transition-gate.ts:109-114 has ZERO domain-layer coverage — it is killed only by the single application-layer test at :965.

REACHABILITY IS ONE CLICK, NOT A CONTRIVANCE. apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts:598-604 — the shipped `skipStep` form action hardcodes `mandatory: false` for whatever stepId it is given; +page.svelte:344-355 renders that Skip button for every step whose controlCommands include 'skip' (a stepState-derived set) with NO stepType filter. So a QUEUED BRANCH row shows "Skip", and clicking it issues precisely the command my probe issued.

SCOPE CORRECTION to the finding. The claim names skip AND prune as exposed writers; only SKIP is actually reachable. pruneExecutionStep requires the target to be absent from liveStepIds (transition-gate.ts:323-333), and liveStepIds is a forward BFS from the entries (:135-151) — a BRANCH that is itself dead is never visited, so its out-edges are never traversed and its downstream is dead too; and inEdgeDisposition checks the source's liveness (:217) BEFORE consulting branchExcludes. A pruned BRANCH therefore cannot resurrect anything. The defect is Skip-on-a-live-BRANCH only. CancelExecutionStep is also safe (CANCELLED is not in TERMINAL_SUCCESS, so :169 short-circuits). MAJOR, not BLOCKER: it needs an operator Skip of a BRANCH plus a later guard flip, and it does not corrupt an already-completed plan — but it silently runs excluded work and violates the resolved-once rule DWP-09 exists to enforce.

Cleanup honoured: my probe packages/rph-application/src/handlers/zzprobe-testlens-branchskip.test.ts is deleted (git status clean for it); no source file was modified. The zzprobe-branch-skip.test.ts / zzverify-*.test.ts left in that directory are other lenses' artifacts, not mine.

</details>

**Live check needed.** None — settled live. To reproduce: copy the DWP-09 fixture at packages/rph-application/src/handlers/execution-start-gate.test.ts:924-954, add edge s2->s5 and step 5, replace `start(1); complete(1)` with `dispatch('SkipExecutionStep', {stepId: stepId(1), mandatory:false}, ...)`, then prune(2), start+complete(3), skip(4), and assert start(5) is REJECTED — it comes back ACCEPTED with s5 RUNNING. The permanent regression test should live in execution-start-gate.test.ts beside :965, plus a domain-layer pair in packages/rph-domain/src/transition-gate.test.ts covering transition-gate.ts:109-114 (recorded id honoured across a guard flip; recorded id matching no out-edge selects nothing), which today has no test at all.


## F-22 · [CONFIRMED] [MAJOR] STEP_STATE.state is an unvalidated free string — a typo'd or off-contract state is accepted at propose and is permanently unsatisfiable (and permanently TRUE under NOT)

- **Lens:** `grammar`
- **Site:** `packages/rph-domain/src/condition-grammar.ts:35 (schema) and :120 (evaluator); propose-time gap at packages/rph-application/src/handlers/execution.ts:183-210`

**Claim.** The schema types STEP_STATE's `state` as a bare `z.string()` (condition-grammar.ts:35) and the evaluator does a raw strict comparison `step?.stepState === expr.state` (:120). Nothing anywhere validates that `state` is a real StepState, even though `StepStateSchema` is the ratified enum used for exactly this field on every step and event payload (rph-contracts/src/objects.ts:240, messages.ts:1123-1160). This is an inconsistency inside a single validator: `rejectMalformedTransitionCondition` goes to the trouble of resolving every referenced stepId against the declared step set (execution.ts:199-207) — protecting against precisely this class of authoring typo — but leaves the state value unchecked. The consequence is asymmetric and worse under negation: a leaf that can never be satisfied is fail-closed and merely dead, but NOT(that leaf) is unconditionally TRUE (condition-grammar.ts:134), so a single typo can turn a guard into an always-open arm rather than an always-closed one. No test covers an off-contract state value.

**Failure scenario.** Take the repo's own live fixture guard and typo it: `{op:'STEP_STATE', stepId: s4, state:'SKIPED'}` (one missing P; cf. execution-start-gate.test.ts:937 which uses 'SKIPPED'). ProposeExecutionPlan is ACCEPTED — the schema parses and s4 is a declared step. At branch resolution the guard is false no matter what s4 does, so the BRANCH silently takes the SEQUENTIAL default and DWP-09 records that as a durable decision; the intended arm is never reachable and is offered for Prune. Now negate the same typo — `{op:'NOT', operand:{op:'STEP_STATE', stepId:s4, state:'SKIPED'}}` — and the arm is unconditionally taken instead, with equally no diagnostic. Both outcomes are silent wrong-flow, and both survive the entire propose-time validation battery.

**Suggested fix.** Validate the state value where the layering permits it: add a check in rejectMalformedTransitionCondition (execution.ts, alongside the existing conditionStepRefs resolution) that every STEP_STATE leaf's `state` parses against StepStateSchema, rejecting with RPH_VALIDATION_SEMANTIC_FAILED naming the offending value. Add a matching propose-time rejection test next to execution-start-gate.test.ts:349 (the sibling undeclared-step-ref rejection).

<details><summary>Code-semantics verifier evidence</summary>

I could not refute it — I tried the three plausible refutation routes (a schema-level enum, a sibling propose-time check, a layering excuse) and all three fail against the real code. I then proved it empirically with a live dispatch probe.

STATIC TRACE

1. The schema really is a bare string. `packages/rph-domain/src/condition-grammar.ts:35` (raw bytes verified with `cat -v` — no hidden control chars, the literal is exactly `z.string()`):
   `z.strictObject({ op: z.literal('STEP_STATE'), stepId: z.string(), state: z.string() }),`
   and the evaluator at :119-120 is a raw strict compare: `case 'STEP_STATE': return step?.stepState === expr.state;`
   NOT at :134 is `return !evaluateCondition(expr.operand, subject);` — so an unsatisfiable leaf under NOT is unconditionally true.

2. The ratified enum exists and is reachable from this package. `packages/rph-contracts/src/enums.ts:699` `export const StepStateSchema = z.enum([...10 values...])`, used for exactly this field at `objects.ts:240` (`stepState: StepStateSchema`) and on every step event payload (`messages.ts:1123-1197`). `packages/rph-domain/package.json` lists `"@janumipwb/rph-contracts": "workspace:*"` as a runtime dependency, so there is no layering reason the grammar could not bind the enum. Grep for `StepStateSchema` across packages/ + apps/ returns hits ONLY in rph-contracts — nothing in rph-domain, rph-application, rph-projections or the demo validates a condition's `state`.

3. The only propose-time condition validator is `rejectMalformedTransitionCondition` (`packages/rph-application/src/handlers/execution.ts:183-210`), and it does exactly two things: `ConditionExpressionSchema.safeParse` (:190) and a stepId ref-resolution (:199-207 — `conditionStepRefs(parsed.data).find((id) => !declaredStepIds.has(id))`). The state value is never inspected. The asymmetry the finding names is real and visible in one function: the authoring-typo class is defended for `stepId` and undefended for `state`. `ExecutionTransitionSchema` (`objects.ts:249-254`) types `conditionExpression: z.unknown().optional()`, so the message layer does not constrain it either. No later gate re-checks it: `transition-gate.ts` treats `conditionExpression` as opaque (`GateTransition.conditionExpression?: unknown`, :54) and `validateTransitionGraph` (:566-589) checks only dangling ids / single entry / reachability / acyclicity / BRANCH defaults.

4. No test covers an off-contract state. `condition-grammar.test.ts:36-47` rejects an unknown `op`, a MISSING `state`, an extra field, a bad comparator — but never a bad state VALUE. `execution-start-gate.test.ts:344-355` has the sibling `ghost_step` undeclared-ref rejection with no state-value analogue; the live DWP-09 fixture at :937 uses the correctly spelled `'SKIPPED'`.

EMPIRICAL PROOF (dispatch probe through the real Engine + SqliteStorageAdapter, since deleted)
Plan: s1 `stepType:'BRANCH'` --CONDITIONAL--> s2, --SEQUENTIAL default--> s3, s3-->s4; s4 seeded SKIPPED. All three cases passed as asserted:
- A. `ProposeExecutionPlan` carrying `{op:'STEP_STATE', stepId:s4, state:'SKIPED'}` (one missing P) is **ACCEPTED** — the full propose battery (graph validation, duplicate-id, condition validation) lets the off-contract value through.
- B. Correct spelling `NOT(STEP_STATE(s4,'SKIPPED'))` with s4 SKIPPED: guard FALSE -> `selectedTransitionId === "<plan>-t1-3"` (the SEQUENTIAL default), `start(s2)` REJECTED, `start(s3)` ACCEPTED.
- C. One-character typo `NOT(STEP_STATE(s4,'SKIPED'))`, everything else identical: guard unconditionally TRUE -> `selectedTransitionId === "<plan>-t1-2"`, `start(s2)` **ACCEPTED**, `start(s3)` **REJECTED**.

So a single-character authoring typo silently inverts which arm a BRANCH takes, with zero diagnostic anywhere in the pipeline. It is worse than a plain mis-flow because DWP-09 makes the wrong decision DURABLE: `selectBranchEdge` (transition-gate.ts:109-114) returns the recorded edge and never re-derives, and `liveStepIds`/`branchExcludes` then compute the correct arm as structurally dead — `prunableStepIds` offers it for prune. The plan cannot recover. Under the bare (un-negated) form the failure is fail-CLOSED (permanently-false leaf, dead arm); under NOT it is fail-OPEN (permanently-true guard, wrong arm taken) — a violation of the fail-closed rule for this surface.

Severity MAJOR stands: silent, durable wrong flow; a defended sibling (stepId) proves the intended contract; zero test coverage; and the fix is a three-line check next to the existing ref resolution (parse each STEP_STATE leaf's `state` against `StepStateSchema`, reject `RPH_VALIDATION_SEMANTIC_FAILED`), plus a rejection test beside execution-start-gate.test.ts:349.

Note: the finding's cited line numbers are accurate as given (condition-grammar.ts:35 / :120 / :134; execution.ts:183-210 / :199-207; objects.ts:240; messages.ts:1123-1160; execution-start-gate.test.ts:937). Its `checkToConfirm` was executed verbatim and produced the predicted ACCEPTED.

</details>

<details><summary>Test-evidence verifier evidence</summary>

SETTLED EMPIRICALLY. I wrote a throwaway probe suite (packages/rph-application/src/handlers/zz-probe-stepstate.test.ts, modelled on execution-start-gate.test.ts's `activeLateFlipPlan` fixture at :924-954) and ran it with `bunx vitest run --disable-console-intercept`. Verbatim output (5/5 passed, i.e. current behaviour is exactly as the grammar lens claimed):

  PROBE A propose status = ACCEPTED undefined            <- {op:'STEP_STATE', stepId:s4, state:'SKIPED'} (one missing P)
  PROBE E propose status = ACCEPTED undefined            <- state:'NOT_A_STATE', fully off-contract
  PROBE B selectedTransitionId = ...-t1-3                <- typo'd guard: BRANCH silently takes the SEQUENTIAL default
  PROBE B start(2) = REJECTED  start(3) = ACCEPTED       <- the intended arm s2 is permanently dead
  PROBE C selectedTransitionId = ...-t1-2                <- NOT(typo): guarded arm taken UNCONDITIONALLY
  PROBE C start(2) = ACCEPTED  start(3) = REJECTED
    "Cannot start step ...-s3: every in-edge is neutralized - the step is unreachable (it should be pruned) (RPH-EXE-005)."

So both halves of the claimed failure scenario reproduce end-to-end through the real Engine: propose ACCEPTS an off-contract state, and DWP-09 then RECORDS the wrong selection durably (selectedTransitionId), which by the resolved-once rule is unrecoverable. The NOT arm is the fail-OPEN case the governing rules name as a defect class: an always-true guard, no diagnostic.

TEST-COVERAGE GAP (the anti-vacuity half). No test anywhere kills the loose `z.string()`:
- packages/rph-domain/src/condition-grammar.test.ts:36-47 is the schema's negative battery - it rejects an unknown op (:37), a missing required field (:40), an unknown extra field (:43), and a BAD NUMERIC COMPARATOR (:46, `cmp:'!='`). That last one is the exact sibling: `cmp` IS enum-validated via NumericComparatorSchema (condition-grammar.ts:16) and HAS a kill test; `state` is neither. There is no `state:'<bad>'` case in the file.
- Grepping STEP_STATE across the whole repo returns only valid enum values: condition-grammar.test.ts:30/59/60/80/120 ('FAILED','SUCCEEDED'), execution-start-gate.test.ts:937 ('SKIPPED'), execution-view.test.ts:477 ('FAILED'). Nothing off-contract anywhere.
- The propose-time rejection tests at execution-start-gate.test.ts:343 (malformed op) and :349 (undeclared stepId ref) prove the surrounding validator IS tested for this authoring-error class - which is precisely why the missing state check is a gap, not a design choice: rejectMalformedTransitionCondition (application/handlers/execution.ts:183-210) resolves every referenced stepId against the declared step set (:199-207) but never touches the state value.
- Tightening condition-grammar.ts:35 to `state: StepStateSchema` would break ZERO existing tests (every fixture uses a real StepState), i.e. the guard is an UNKILLED MUTANT in the exact sense of JPWB-CON-000 B7.

ADDITIONAL EVIDENCE the grammar lens did not cite - the read-model actively launders the typo. packages/rph-projections/src/execution-view.ts:300-303 `describeCondition` only prints "unparseable condition" when `ConditionExpressionSchema.safeParse` FAILS; the typo parses, so :309 renders `step ...-s4 is SKIPED` as a legitimate guard. Its own doc-comment (:298-299) states "the UI must never present an uninterpretable guard as though it were understood" - the free-string schema defeats that stated contract too.

Severity held at MAJOR: silent, durable wrong-flow (recorded by DWP-09, therefore not self-correcting), fail-OPEN under NOT, no diagnostic at any layer, and the defect sits inside a validator that already guards the identical authoring-typo class for stepIds. The one mitigating fact - it requires an authoring error to trigger - is exactly what every sibling check in rejectMalformedTransitionCondition/rejectDuplicateTransitionId exists to catch.

Suggested fix is sound as written (validate each STEP_STATE leaf's `state` against StepStateSchema inside rejectMalformedTransitionCondition alongside conditionStepRefs, rejecting RPH_VALIDATION_SEMANTIC_FAILED naming the value; add the propose-time rejection test next to execution-start-gate.test.ts:349, plus a schema-level kill test next to condition-grammar.test.ts:46 so the mutant dies at both layers).

</details>

**Live check needed.** None - settled by execution. Probe file deleted; no source file modified. To reproduce: recreate a BRANCH plan per execution-start-gate.test.ts:924-954 with the guard's state typo'd to 'SKIPED' and assert ProposeExecutionPlan is REJECTED (it is ACCEPTED today).


## F-23 · [CONFIRMED] [MAJOR] A BRANCH terminated by Skip or Prune records no decision, so its arm is re-derived from current state on every read — the DWP-09 defect, still live

- **Lens:** `determinism-replay`
- **Site:** `packages/rph-application/src/handlers/execution.ts:762-779 (mutateStep, completeExecutionStep ONLY) + packages/rph-domain/src/transition-gate.ts:109-114 (selectBranchEdge) and :162-175 (branchExcludes)`

**Claim.** `selectedTransitionId` is written by exactly one code path — `completeExecutionStep`'s `mutateStep` (execution.ts:762, which returns `step` unchanged unless `step.stepType === 'BRANCH'` and it is reached only from CompleteExecutionStep). No other step handler records a selection. But `branchExcludes` (transition-gate.ts:169) engages for ANY source whose stepState is in TERMINAL_SUCCESS = {SUCCEEDED, SKIPPED}, and SkipExecutionStep (execution.ts:952, requireFrom READY|QUEUED) and PruneExecutionStep (execution.ts:1028) both drive a step — including a BRANCH step; neither handler inspects stepType — to SKIPPED. Such a BRANCH is therefore terminal-success WITH `selectedTransitionId === undefined`, so `selectBranchEdge` skips its recorded-decision limb (transition-gate.ts:109) and falls through to fresh first-match evaluation (`:115-118`) on EVERY subsequent call to liveStepIds / inEdgeDisposition / prunableStepIds / startableStepIds. That is precisely the re-derivation the DWP-09 comment at execution.ts:757-761 says 'was not stable'. The condition subject keeps moving after the branch settles (buildConditionSubject folds ExecutionStepStarted counts and current stepStates, condition-grammar.ts:186-219), so a later state change flips the guard and re-resolves a branch that already acted.

**Failure scenario.** Reuse the existing DWP-09 fixture (execution-start-gate.test.ts:924 `activeLateFlipPlan`): s1 is a BRANCH with out-edges [cond: STEP_STATE(s4,'SKIPPED') -> s2 ; SEQ default -> s3], plus s3->s4. Activate, then instead of start(s1)/complete(s1), issue SkipExecutionStep{stepId:s1, mandatory:false} — ACCEPTED (plan is ACTIVE, s1 is QUEUED, canSkipStep passes on mandatory:false). s1 is now SKIPPED with no selectedTransitionId. First-match re-derives: STEP_STATE(s4,'SKIPPED') is false (s4 is QUEUED), so the SEQ default is 'selected', s2 is excluded and prunable, s3 is live. Start and complete s3, then start and complete s4... or simply SkipExecutionStep{stepId:s4, mandatory:false}. Now STEP_STATE(s4,'SKIPPED') is TRUE, so selectBranchEdge re-resolves to the cond edge: s2 becomes live and `start(s2)` is now ACCEPTED (the line that the sibling test at :980 asserts must be REJECTED), while s3 — already SUCCEEDED — drops out of liveStepIds, making every in-edge of its downstream NEUTRALIZED. Both arms have now run, and completed work has been retroactively declared structurally dead.

**Suggested fix.** Record the branch selection wherever a BRANCH reaches a terminal-success state, not only on Complete: hoist the resolveBranchSelection mutateStep into a shared helper applied by skipExecutionStep and pruneExecutionStep as well. Alternatively make branchExcludes fail-closed for an UNRESOLVED BRANCH (a terminal-success BRANCH with no recorded selectedTransitionId excludes nothing / blocks), so an unrecorded decision can never be invented from the current subject.

<details><summary>Code-semantics verifier evidence</summary>

I tried to refute this and could not — I executed the exact failure scenario against the real engine and it reproduced verbatim.

## 1. The claim's premises, verified in the code

**(a) `selectedTransitionId` has exactly ONE writer.** `grep -n "selectedTransitionId" packages/rph-application/src/handlers/execution.ts` returns only lines 76-80 (the read-side projection in `toGatePlan`) and line 778 — inside `completeExecutionStep`'s `mutateStep` (execution.ts:762-779):
```ts
mutateStep: (step) => {
    if (step.stepType !== 'BRANCH') return step;
    ...
    return selected === undefined ? step : { ...step, selectedTransitionId: selected };
},
```
`skipExecutionStep` (execution.ts:952-988) and `pruneExecutionStep` (execution.ts:1028-1071) pass **no `mutateStep` at all** — I read both handlers in full. Neither inspects `stepType`. `skipExecutionStep`'s only guards are `requireFrom: ['READY','QUEUED']` (:958), a plan-ACTIVE precheck (:967), and `canSkipStep({ mandatory: p.mandatory ?? true, ... })` (:975) — a `BRANCH` step asserted `mandatory:false` passes all three.

**(b) The machine permits it.** `transitions.data.ts:1464` declares `{ from: 'QUEUED', to: 'SKIPPED', ... }`, so `checkTransition` (execution.ts:654) admits it.

**(c) `branchExcludes` engages on SKIPPED and re-derives.** transition-gate.ts:169 `if (source === undefined || !TERMINAL_SUCCESS.has(source.stepState)) return false;` — and `TERMINAL_SUCCESS = new Set(['SUCCEEDED','SKIPPED'])` (:17). It then calls `selectBranchEdge` (:172), whose recorded-decision limb is gated on `if (source?.selectedTransitionId !== undefined)` (:109) — undefined here, so control falls to the fresh first-match loop at :115-118 on **every** call.

## 2. Empirical proof (probe test, written, run, then deleted)

I built a self-contained vitest file replicating `execution-start-gate.test.ts`'s `activeLateFlipPlan` fixture (:924) exactly — s1 `stepType:'BRANCH'`, `cedge(1,2,{op:'STEP_STATE',stepId:s4,state:'SKIPPED'})`, `gedge(1,3)`, `gedge(3,4)` — and replaced `start(1); complete(1)` with `SkipExecutionStep{stepId:s1, mandatory:false}`. Run with `bun x vitest run --silent=false`, actual stdout:

```
skip(BRANCH s1): ACCEPTED undefined
s1 state: SKIPPED selectedTransitionId: undefined
start(3) [default arm]: ACCEPTED undefined
complete(3): ACCEPTED undefined
skip(4): ACCEPTED undefined s4 = SKIPPED
start(2) AFTER FLIP: ACCEPTED undefined
states: 1=SKIPPED 2=RUNNING 3=SUCCEEDED 4=SKIPPED
```
Baseline control (same skip, guard NOT flipped): `start(2) -> REJECTED`, `start(3) -> ACCEPTED` — proving the first-match default really was selected at that instant, and that the later `skip(4)` is what re-resolved the branch.

The end state `2=RUNNING 3=SUCCEEDED` is **both arms of an exclusive BRANCH having run**. The sibling test at execution-start-gate.test.ts:965 asserts precisely this line must be `REJECTED` ("the branch already decided; it must not re-resolve") — it holds only because that test drives the branch through `complete`, the one path that records the decision. Swap in `Skip` and the DWP-09 guarantee evaporates. This is an unkilled-mutant-shaped hole: the DWP-09 suite covers the Complete path only, so the entire Skip-terminated BRANCH population is untested.

## 3. One refinement to the finding (does not change the verdict)

The claim also names `pruneExecutionStep` as a driver. That limb is **already defused** and should be dropped from the write-up: a prune requires the step to be in `prunableStepIds` (execution.ts:1056-1061), i.e. `!live.has(s.id)` (transition-gate.ts:329). A non-live BRANCH is never reached by `liveStepIds`' forward BFS (:140-149, which only expands out-edges of nodes already in `live`), and `inEdgeDisposition` returns `NEUTRALIZED` at :217 (`if (!liveStepIds(...).has(source.id)) return 'NEUTRALIZED'`) **before** the terminal-success test — the DWP-08 ordering that comment explicitly calls out. So a pruned BRANCH cannot resurrect anything. **`SkipExecutionStep` is the sole live vector** — which is exactly the DWP-08 lesson recurring a third time: reachability was made structural so no command could bypass it, but the branch *decision* was left keyed to one command.

Both suggested fixes are sound. The narrower and safer one is the fail-closed variant: in `branchExcludes` (transition-gate.ts:171-172), a terminal-success BRANCH with `selectedTransitionId === undefined` must not have a decision invented for it from the current subject. Note that `selectBranchEdge` already has fail-closed precedent at :110-113 (a recorded id matching no out-edge selects NOTHING rather than falling back to fresh evaluation) — the unresolved case is the same hazard and deserves the same answer. Recording the selection in `skipExecutionStep` too (hoisting the `mutateStep` from execution.ts:762-779) is the complete fix; the two are complementary. Whichever lands, the anti-vacuity test is the probe above, asserting `start(2) === 'REJECTED'`.

</details>

<details><summary>Test-evidence verifier evidence</summary>

CONFIRMED by direct execution, not by code-reading alone. I wrote a temporary probe (packages/rph-application/src/handlers/zzz-tev-branch-skip-probe.test.ts, since DELETED; no source file modified) that reuses the DWP-09 fixture shape from execution-start-gate.test.ts:924 (s1 BRANCH --COND[STEP_STATE(s4,'SKIPPED')]--> s2 ; --SEQ default--> s3 ; s3-->s4) and differs from the shipped test in exactly one respect: the BRANCH is terminated by Skip rather than Complete.

CONTROL (probe C — the covered path): start(1); complete(1) => stepOf(1).selectedTransitionId = "plan_...-t1-3"; then skip(4) flips the guard TRUE; start(2) => REJECTED. The recorded-decision limb of selectBranchEdge (transition-gate.ts:109-114) genuinely works when the branch COMPLETES.

DEFECT (probe A — the uncovered path), verbatim run output:
  skip(BRANCH s1) => ACCEPTED
  s1 state = SKIPPED   selectedTransitionId = undefined
  start(2) [not-taken arm] => REJECTED
  start(3) [default arm] => ACCEPTED  -> complete(3) => s3 SUCCEEDED
  skip(4) => ACCEPTED  (guard STEP_STATE(s4,'SKIPPED') now TRUE)
  AFTER FLIP start(2) => ACCEPTED ; s2 state = RUNNING
The assertion `expect(start(2)).toBe('REJECTED')` — byte-equivalent to the shipped sibling assertion at execution-start-gate.test.ts:980 — FAILED with "expected 'ACCEPTED' to be 'REJECTED'". Both arms of an exclusive BRANCH ran.

ADDITIONAL consequence the finding did not claim (probe B): if the losing arm is NOT started after the flip, the plan DEADLOCKS. prune(2) => REJECTED "Cannot prune step ...-s2: it is still reachable" (it re-entered liveStepIds), and CompleteExecutionPlan => REJECTED "has 1 step(s) not in terminal success (QUEUED)". The only exits are running the losing arm or a waivered Skip.

COVERAGE GAP (why no existing test refutes it): no test in the repo terminates a BRANCH step by Skip or Prune. In execution-start-gate.test.ts SkipExecutionStep appears only at :694 (linear plan, mandatory-skip refusal), :826 (skip helper applied to non-BRANCH s2) and :976 (the DWP-09 flip, applied to s4). execution-step-skip-cancel.test.ts contains ZERO occurrences of "BRANCH". packages/rph-domain/src/transition-gate.test.ts has no BRANCH+skip case. The DWP-09 describe block (execution-start-gate.test.ts:911-985) drives s1 exclusively via start/complete, so completeExecutionStep's mutateStep (packages/rph-application/src/handlers/execution.ts:762-779) is both the sole writer of selectedTransitionId and the only route any test exercises — an unkilled-mutant-shaped hole in the JPWB-CON-000 B7 sense: the DWP-09 fix is only proven on one of the three commands that can drive a BRANCH to a TERMINAL_SUCCESS state (transition-gate.ts:17 TERMINAL_SUCCESS = {SUCCEEDED, SKIPPED}; branchExcludes admits SKIPPED at :169).

Severity confirmed MAJOR (unchanged): it is a double-run of mutually exclusive arms plus a plan-level deadlock, reachable by a single ordinary operator command (SkipExecutionStep with mandatory:false) on an ACTIVE plan.

</details>

**Live check needed.** Reproduce by copying the DWP-09 test 'HOLDS the decision when a later state change would have flipped the guard' (packages/rph-application/src/handlers/execution-start-gate.test.ts:965) and replacing `start(1); complete(1)` with `dispatch('SkipExecutionStep', { stepId: stepId(1), mandatory: false }, PLAN, 'EXECUTION_PLAN')`; the final `start(2)` assertion flips REJECTED -> ACCEPTED. Run: cd JanumiCode/janumiprofessionalworkbench/packages/rph-application && bunx vitest run src/handlers/execution-start-gate.test.ts. NOTE for the orchestrator: while I worked, concurrent lenses left uncommitted artifacts in the tree — probe test files packages/rph-application/src/handlers/zz*.test.ts, packages/rph-projections/src/zzz-verify-wait-attempt.test.ts, packages/rph-application/probe-out.json — and at one point execution.ts carried a 'MUTANT-PROBE-2 deletion' removing resolveExecutionStepWait's `requireFrom: ['WAITING']` (line ~1113); it had been reverted by the end of my run. None of that touched the BRANCH path my probe exercised, but the tree should be swept clean before any commit.


## F-24 · [CONFIRMED] [MAJOR] A BRANCH resolves its arm against a subject that excludes its own step result — the ExecutionStepSucceeded event is not committed yet, so self-referential guards are always false

- **Lens:** `determinism-replay`
- **Site:** `packages/rph-application/src/handlers/execution.ts:762-779 (mutateStep) vs advanceStep's commit order at :656 (mutateStep) / :660 (makeEvent) / :667 (commitState)`

**Claim.** `mutateStep` resolves the branch by calling `guardEvaluatorFor(ctx, planId, resolved)` (:776), which builds the condition subject from `ctx.store.readAllEvents()` (:117). advanceStep invokes `mutateStep` at line 656, BEFORE `makeEvent` (:660) and `commitState` (:667) — so the store does not yet contain the ExecutionStepSucceeded event this very command is emitting. The `resolved` clone at :767-772 patches ONLY `stepState`, and buildConditionSubject seeds `outputArtifactIds: []` / `structuredResult: undefined` for every step and populates them exclusively from committed ExecutionStepSucceeded events (condition-grammar.ts:191-198, :215). So for the completing BRANCH step itself, `structuredResult` is undefined and `outputArtifactIds.length` is 0 at decision time, even though the command payload carries both (p.structuredResult, p.outputArtifactIds — emitted at :793/:798). The comment at :765-766 claims it asks 'the plan as if this step had already succeeded', which is only true for stepState. Propose-time validation cannot catch this: conditionStepRefs (condition-grammar.ts:155) resolves the ref against declared steps and has no self-reference check, so a guard on the branch's own result is accepted.

**Failure scenario.** BRANCH step b with out-edges in authored order [e1 = CONDITIONAL {op:'RESULT_EQUALS', stepId:b, path:'decision', value:'APPROVE'} -> approveStep ; e2 = SEQUENTIAL default -> rejectStep] — the most natural branch idiom (branch on the result of the deciding step). Dispatch CompleteExecutionStep{executionStepId:b, structuredResult:{decision:'APPROVE'}, outputArtifactIds:[art1]}. resolveBranchSelection evaluates e1 against a subject whose steps[b].structuredResult is undefined, so resolvePath returns undefined, `undefined === 'APPROVE'` is false; first-match falls to e2 and `selectedTransitionId = e2` is recorded. The plan permanently takes the REJECT arm on an APPROVE result, approveStep is offered for Prune as structurally unreachable, and DWP-09's resolved-once rule makes the wrong decision unrecoverable. An OUTPUT_COUNT(b, '>=', 1) guard fails identically (0 >= 1 at decision time). Worse, the read-model's own evaluator (execution-view.ts:255-264, fed the full committed log by +page.server.ts:154) evaluates the same guard as TRUE, so resolveBranchSelection and conditionEvaluatorFor now disagree about the same plan over the same log.

**Suggested fix.** Either (a) patch the `resolved` clone at :767-772 with the completing step's own pending result — set outputArtifactIds/structuredResult on the subject from the command payload, which requires threading an override into buildConditionSubject; or (b) reject a self-referencing conditionExpression on a BRANCH's own out-edge at propose time (extend rejectMalformedTransitionCondition at execution.ts:183 to refuse an out-edge of step X whose conditionStepRefs include X for the result-bearing ops), so the un-evaluable idiom is refused rather than silently resolved false.

<details><summary>Code-semantics verifier evidence</summary>

CONFIRMED by static trace AND a live engine probe.

CONTROL FLOW (all quotes byte-verified):
1. advanceStep, packages/rph-application/src/handlers/execution.ts:656-667 —
   `const nextStep = { ...(args.mutateStep ? args.mutateStep(step) : step), stepState: args.target };`
   ...then :660 `const event = makeEvent(ctx, command, {...})` and :667 `return commitState(ctx, command, {...});`
   kit.ts:188-213 shows makeEvent ONLY builds a DomainEvent envelope (no store write); the append happens inside commitState. So mutateStep runs strictly BEFORE this command's ExecutionStepSucceeded exists in the log.
2. completeExecutionStep's branch mutateStep, execution.ts:762-779 — the clone patches ONLY stepState:
   `steps: gatePlan.steps.map((s) => s.id === String(step.id) ? { ...s, stepState: 'SUCCEEDED' } : s)`
   then `resolveBranchSelection(resolved, String(step.id), guardEvaluatorFor(ctx, command.targetAggregateId, resolved))`.
3. guardEvaluatorFor, execution.ts:117 — `const subject = buildConditionSubject(gatePlan.steps, ctx.store.readAllEvents(), planId);`
4. condition-grammar.ts:213-215 seeds EVERY step `{ stepState, outputArtifactIds: [], attemptsMade: 0 }` (no structuredResult), and :191-198 populates outputArtifactIds/structuredResult ONLY from committed `ExecutionStepSucceeded` events. Hence for the completing BRANCH itself: structuredResult === undefined, outputArtifactIds.length === 0 at decision time.
5. No self-reference guard exists: rejectMalformedTransitionCondition (execution.ts:183-210) checks only Zod parse + "every conditionStepRefs id is a declared step"; conditionStepRefs (condition-grammar.ts:155-171) has no self check. So the idiom is ACCEPTED at propose.

LIVE PROBE (temporary vitest file under packages/rph-application/src/handlers/, run with `node ../../node_modules/vitest/vitest.mjs run ... --disable-console-intercept`; file deleted after the run):
- Plan: s1 stepType BRANCH, transitions [cedge(1,2,{op:'RESULT_EQUALS',stepId:s1,path:'decision',value:'APPROVE'}), gedge(1,3)]. Propose => ACCEPTED (no propose-time refusal).
- `CompleteExecutionStep{executionStepId:s1, structuredResult:{decision:'APPROVE'}}` => ACCEPTED.
- OUTPUT: `selectedTransitionId = plan_...-t1-3` — i.e. the SEQUENTIAL DEFAULT (reject arm), not `-t1-2` (the APPROVE arm).
- `start(2)` [the APPROVE arm] => REJECTED; `start(3)` [default arm] => ACCEPTED; s2 left QUEUED (and therefore offered by prunableStepIds as structurally dead). The plan permanently takes the wrong arm, and DWP-09's recorded-decision rule (transition-gate.ts:109-114 `if (source?.selectedTransitionId !== undefined) { return outEdges.find(e => e.id === source.selectedTransitionId); }`) makes it unrecoverable.
- CONTROL 1 (same shape, guard `{op:'STEP_SUCCEEDED',stepId:s1}` — the ONLY branch idiom any shipped test uses: execution-start-gate.test.ts:329/350/362/370/386/703 and apps/rph-demo/e2e/execution-flow.e2e.ts:193): selectedTransitionId = `-t1-2`, the conditional arm. It works ONLY because the clone patches stepState — proving the asymmetry is the whole defect.
- CONTROL 2 (RESULT_EQUALS against an UPSTREAM already-completed step): selects the conditional edge correctly. So the breakage is confined to result-bearing ops (RESULT_EQUALS, OUTPUT_COUNT) that reference the branch's OWN step.
- Grep confirms no handler/e2e test uses RESULT_EQUALS or OUTPUT_COUNT at all (only condition-grammar.test.ts:64-77, which feeds a hand-built subject directly and therefore cannot see this). Every start-gate fixture completes with `structuredResult: {}` (execution-start-gate.test.ts:99), so nothing in the suite would go red.

ONE SUB-CLAIM OVERSTATED (does not change the verdict): the finding's "worse" clause — that resolveBranchSelection and the read-model's conditionEvaluatorFor then disagree over the same log — is REFUTED. Post-commit the read-model does NOT re-derive: selectBranchEdge honours the recorded selectedTransitionId (transition-gate.ts:104-114), and the projection carries the field through (execution-view.ts:193; apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts:127-128). Both planes therefore agree on the WRONG arm. The defect is the wrong point-in-time decision, frozen by resolved-once — not a read-model/authority divergence.

SEVERITY: MAJOR upheld. It is a silent, unrecoverable wrong-arm selection in the flow interpreter, accepted at propose, with zero test coverage — the same anti-vacuity/fail-closed class as the three already-fixed defects. It is latent only in the sense that no shipped plan authors this guard yet; the grammar publishes RESULT_EQUALS/OUTPUT_COUNT and propose validation invites the self-referential form. Either patch the `resolved` clone at execution.ts:767-772 with the pending payload's outputArtifactIds/structuredResult (via a buildConditionSubject override), or extend rejectMalformedTransitionCondition (execution.ts:183) to refuse an out-edge of step X whose conditionStepRefs include X for the result-bearing ops — and add the kill test either way.

</details>

<details><summary>Test-evidence verifier evidence</summary>

RUN-CONFIRMED by a temporary probe (created, run, and DELETED; no source file modified by me).

PROBE (packages/rph-application, real Engine + SqliteStorageAdapter, fixture copied from execution-start-gate.test.ts):
plan = [s1 BRANCH, s2, s3]; transitions = [CONDITIONAL s1->s2 guarded, SEQUENTIAL default s1->s3].

  PROBE A  guard {op:'RESULT_EQUALS', stepId:s1, path:'decision', value:'APPROVE'}
           Start s1; CompleteExecutionStep{executionStepId:s1, structuredResult:{decision:'APPROVE'}}
           -> complete status = ACCEPTED
           -> selectedTransitionId = plan_…K20-t1-3   (the SEQUENTIAL DEFAULT / reject arm)
              expected                = plan_…K20-t1-2   (the APPROVE arm)
           -> start(s2 approve arm) = REJECTED ; start(s3 reject arm) = ACCEPTED
           -> final states: s1 SUCCEEDED, s2 QUEUED (dead), s3 RUNNING
           The plan took the REJECT arm on an APPROVE result. Exactly the claimed failure.

  PROBE B  guard {op:'OUTPUT_COUNT', stepId:s1, cmp:'>=', value:1}, completed with one properly RecordArtifact-ed
           output artifact (so the output-existence gate passes) -> complete = ACCEPTED,
           selectedTransitionId = t1-3 (default), expected t1-2. Same failure for the second result-bearing op.

  PROBE C  (CONTROL) guard {op:'ATTEMPTS', stepId:s1, cmp:'>=', value:1} — self-referential but folded from
           ExecutionStepStarted, which IS already committed -> selectedTransitionId = t1-2 (CORRECT).

  PROBE D  (CONTROL) RESULT_EQUALS on a PRIOR step (s1 TRANSFORMATION -> s2 BRANCH, guard on s1's result)
           -> selectedTransitionId = t2-3 (CORRECT).

C and D isolate the cause precisely: the mechanism is sound in general and self-reference is sound for
already-committed facts; it breaks only for the SELF-referenced RESULT-BEARING facts (structuredResult /
outputArtifactIds), which are carried by the ExecutionStepSucceeded event that this very command has not yet
appended when mutateStep runs (execution.ts:656 mutateStep -> :660 makeEvent -> :667 commitState). The `resolved`
clone at :767-772 patches only `stepState`; buildConditionSubject seeds outputArtifactIds:[] / structuredResult:
undefined and fills them only from committed ExecutionStepSucceeded (condition-grammar.ts foldExecutionEventInto).

COVERAGE GAP (anti-vacuity, JPWB-CON-000 B7) — nothing existing disproves it:
- grep for RESULT_EQUALS/OUTPUT_COUNT across the repo hits only condition-grammar.ts(+.d.ts), condition-grammar.test.ts,
  execution-view.ts, execution-view.test.ts. ZERO hits in any rph-application handler test.
- condition-grammar.test.ts is a pure evaluator test over hand-built subjects — structurally incapable of catching a
  commit-order bug.
- execution-view.test.ts:478-480 only exercises `describeCondition` (LABEL RENDERING), not evaluation.
- Every rph-application BRANCH fixture uses STEP_SUCCEEDED / STEP_STATE / ATTEMPTS only
  (execution-start-gate.test.ts:329, :337, :386, :729, :786, :842, :937) — i.e. exactly the ops the stepState patch
  or the already-committed Started fold makes work. Self-reference IS the tested, blessed idiom
  (:329 / :405 `cedge(1,2,{op:'STEP_SUCCEEDED',stepId:stepId(1)})`), so "reject self-reference at propose" is not a
  live design option — the result-bearing ops are simply the untested corner of a supported idiom.
- Every start-gate completion passes `structuredResult: {}` (execution-start-gate.test.ts:99) and
  `outputArtifactIds: []`, so no fixture could ever have observed the difference.

ONE SUB-CLAIM OF THE FINDING IS WRONG (does not change the verdict or severity): the finding says
resolveBranchSelection and the read-model's conditionEvaluatorFor "now disagree about the same plan over the same
log". They do not. transition-gate.ts:109-114 (selectBranchEdge) short-circuits on a recorded
`selectedTransitionId`, so the read-model honours the wrong recorded edge rather than re-evaluating — PROBE A shows
the two planes agreeing (s2 refused, s3 startable). The behaviour is consistently WRONG, not divergent. Severity
stays MAJOR because DWP-09's resolved-once rule then makes the wrong decision permanent and unrecoverable, and the
losing (correct) arm is offered for Prune as structurally unreachable.

Suggested fix (a) from the finding is the right shape: patch the `resolved` clone at execution.ts:767-772 with the
completing step's own pending outputArtifactIds/structuredResult from the command payload, so the subject really is
"as if this step had already succeeded" — which is what the comment at :765-766 already claims.

NOTE: `git status` shows packages/rph-application/src/handlers/execution.ts as modified — that is ANOTHER lens's
in-flight mutant probe (`requireFrom: ['RUNNING','WAITING'] // MUTANT-PROBE-B` on enterExecutionStepWait:1087),
an unrelated code path that does not touch mutateStep/completeExecutionStep/the condition subject. My probe results
are unaffected by it. I left it alone.

</details>

**Live check needed.** None — settled by execution. To reproduce: add to execution-start-gate.test.ts's branch fixture `cedge(1, 2, { op: 'RESULT_EQUALS', stepId: stepId(1), path: 'decision', value: 'APPROVE' })` with `gedge(1, 3)`, start s1, complete s1 with `structuredResult: { decision: 'APPROVE' }`, then assert `stepOf(1)?.selectedTransitionId === `${PLAN}-t1-2``; it observes `${PLAN}-t1-3`. That assertion is the missing kill test and should be added alongside the fix.


## F-25 · [CONFIRMED] [MAJOR] ExecutionStepFailed and ExecutionStepRetried emit the raw command payload, omitting the schema-REQUIRED stepState — the retry cycle is invisible to replay and unvalidated

- **Lens:** `determinism-replay`
- **Site:** `packages/rph-application/src/handlers/execution.ts:863-871 (failExecutionStep) and :911-941 (retryExecutionStep); packages/rph-contracts/src/messages.ts:1133-1139, :1145-1150, :2474-2490`

**Claim.** `advanceStep` emits `args.eventPayload !== undefined ? args.eventPayload : command.payload` (execution.ts:665). failExecutionStep (:863-871) and retryExecutionStep (:911-941) supply NO eventPayload, so the emitted payloads are the raw command payloads: FailExecutionStepPayloadSchema = {stepId, failureReason, failureClass?} (messages.ts:258) and RetryExecutionStepPayloadSchema = {stepId, retryReason?} (messages.ts:458). But the ratified EVENT shapes both declare `stepState: StepStateSchema` as REQUIRED — ExecutionStepFailedPayloadSchema (messages.ts:1133-1138) and ExecutionStepRetriedPayloadSchema (messages.ts:1145-1149). Every sibling step command supplies it explicitly (Started :703-707, Skipped :961-965, Cancelled :1005-1009, Pruned :1042-1047, Waiting :1090-1094, WaitResolved :1114-1118). Neither event appears in RATIFIED_EVENT_PAYLOADS (messages.ts:2474-2490), so the runtime event gate never validates them and the violation is silent. Consequence for this lens: FAILED and the post-retry QUEUED are the only two step states in the whole machine that a log-driven fold cannot observe — and they are exactly the two states RPH-EXE-008's retry cap governs.

**Failure scenario.** Drive s1: Start (ExecutionStepStarted{stepState:'RUNNING'}) -> Fail (ExecutionStepFailed{stepId,failureReason} — no stepState) -> Retry (ExecutionStepRetried{stepId} — no stepState) -> Start. A replay reducer that rebuilds steps[].stepState from the resulting-state field every other Execution* event carries reads RUNNING, then nothing, then nothing, then RUNNING — the rebuilt aggregate never shows the step as FAILED and never shows the retry, so the reconstructed retry history is a straight run of attempts with no failures, and any RPH-PER-006-style comparison of rebuilt vs materialized stepState is unfalsifiable because the events do not carry the field. Add `ExecutionStepFailed: ExecutionStepFailedPayloadSchema` to RATIFIED_EVENT_PAYLOADS today and the existing retry-cap suite goes RED at commit time.

**Suggested fix.** Give both handlers an explicit eventPayload mirroring their siblings — `{stepId, failureReason, ...(failureClass?), stepState:'FAILED'}` and `{stepId, ...(attemptNumber?), stepState:'QUEUED'}` — and register both event types in RATIFIED_EVENT_PAYLOADS so the (d2) gate keeps them conformant.

<details><summary>Code-semantics verifier evidence</summary>

EMPIRICALLY CONFIRMED by executing the real pipeline. I wrote a throwaway test (since deleted) in packages/rph-application/src/handlers/ that drove a real Engine over SqliteStorageAdapter: ProposeExecutionPlan -> Approve -> Activate -> StartExecutionStep -> FailExecutionStep{stepId,failureReason:'boom',failureClass:'TRANSIENT'} -> RetryExecutionStep{stepId,retryReason:'again'} (all three ACCEPTED), then read store.readAllEvents() and safeParsed the emitted payloads against their own declared schemas. Output verbatim:

  FAILED PAYLOAD  = {"stepId":"...-s","failureReason":"boom","failureClass":"TRANSIENT"}   -> parse ok = FALSE
      issue: path ["stepState"] invalid_value (expected one of NOT_READY|READY|QUEUED|RUNNING|WAITING|SUCCEEDED|FAILED|SKIPPED|CANCELLED|SUPERSEDED)
  RETRIED PAYLOAD = {"stepId":"...-s","retryReason":"again"}                                -> parse ok = FALSE
      issues: ["stepState"] invalid_value  AND  unrecognized_keys ["retryReason"]
  STARTED PAYLOAD = {"stepId":"...-s","stepState":"RUNNING"}                                (sibling conforms)

Every cited line checks out against the real code:
- packages/rph-application/src/handlers/execution.ts:665 — `payload: args.eventPayload !== undefined ? args.eventPayload : command.payload`.
- execution.ts:862-871 failExecutionStep and :911-941 retryExecutionStep pass NO `eventPayload`. `grep -n eventPayload execution.ts` returns 276,319,400,466,515,539,703,790,961,1005,1042,1090,1114 — every other step handler supplies one; fail and retry are the only two step handlers that do not.
- packages/rph-contracts/src/messages.ts:1133-1138 ExecutionStepFailedPayloadSchema = z.strictObject({stepId, failureReason, failureClass?, stepState: StepStateSchema}) — stepState REQUIRED; :1145-1149 ExecutionStepRetriedPayloadSchema = z.strictObject({stepId, attemptNumber?, stepState}) — stepState REQUIRED and `retryReason` is NOT a member (so the emitted key is rejected outright — a violation the finding did not even claim).
- messages.ts:2474-2490 RATIFIED_EVENT_PAYLOADS contains neither event, so the (d2) runtime gate at packages/rph-application/src/handlers/kit.ts:301 (`const ratifiedEventPayload = RATIFIED_EVENT_PAYLOADS[args.event.eventType]; if (ratifiedEventPayload) {...}`) is a no-op for both — the violation is silent, as claimed.
- The vacuity claim is also correct: packages/rph-engine/src/emitted-event-conformance.test.ts sweeps the FULL `EVENTS` registry (not just ratified) and PINS `expect(violations.map(v=>v.eventType).sort()).toEqual([])` — "0 event types emit a payload their own declared shape rejects (register CLEARED)". `grep -n "FailExecutionStep|RetryExecutionStep" packages/rph-engine/src/reference-undertaking.ts` returns NOTHING, so driveReferenceUndertaking never fails or retries a step and the pinned register is green only because it never reaches this path. That is exactly the CON-000 B7 unkilled-mutant shape this review exists to find.

WHERE THE FINDING OVERSTATES (why I corrected MAJOR -> MINOR): no live consumer misbehaves today.
- packages/rph-projections/src/execution-attempts.ts:115-127 `applyStepFailed` sets `draft.state = 'FAILED'` keyed on the EVENT TYPE via STEP_APPLIERS (:141-145), not on payload.stepState — so the attempts read-model observes the failure fine; and ExecutionStepRetried is intentionally absent from that map (:137). So "the retry cycle is invisible to replay" is not true of the projection that exists.
- RPH-PER-006 aggregate-replay-equivalence is implemented only for the PWU (packages/rph-projections/src/pwu-replay.ts, packages/rph-engine/src/replay-equivalence.test.ts). There is NO execution-plan stepState replay fold in the tree, so the "rebuilt vs materialized stepState comparison is unfalsifiable" consequence is hypothetical rather than a broken artifact.
- The suggested fix is partly unexecutable as written: RATIFIED_EVENT_PAYLOADS is GENERATED (packages/rph-contracts/src/gen/gen-messages.ts:202-228 — an event is in iff its vocab sourceSection is present and not UNRATIFIED-AUTHORED and payloadFields is non-empty). packages/rph-contracts/vocab/m3-commands-events.json marks ExecutionStepFailed, ExecutionStepRetried AND ExecutionStepStarted all "UNRATIFIED-AUTHORED", so hand-adding either to the map is reverted by the next `bun run gen`; enforcing them is a vocab/governance act, not a code edit. Also `stepState:'QUEUED'` alone does not fix Retried — `retryReason` must be dropped or mapped to `attemptNumber`, else the strict schema still rejects.

NET: the defect is real, code-grounded and reproducible — two events emit payloads their own declared strict shapes reject (one missing a required field, one missing it AND carrying an unrecognized key), while the identically-unratified sibling ExecutionStepStarted supplies it, and the project's own CLEARED defect register cannot see it. Harm today is contract/observability, not a wrong runtime outcome; it becomes a hard runtime break (FailExecutionStep rejected with RPH_VALIDATION_SCHEMA_FAILED) the moment the vocab entry is ratified. Fix: give failExecutionStep `eventPayload: {stepId, failureReason, ...(failureClass?), stepState:'FAILED'}` and retryExecutionStep `eventPayload: {stepId, stepState:'QUEUED'}` (drop retryReason or carry attemptNumber), mirroring :703-707/:961-965, and add the fail/retry cycle to driveReferenceUndertaking so the conformance register stops being vacuous here.

</details>

<details><summary>Test-evidence verifier evidence</summary>

SETTLED BY RUNNING REAL BEHAVIOUR, not by re-reading the code argument.

PROBE (temporary test in packages/rph-application/src/handlers/, dispatched through the real Engine + SqliteStorageAdapter, then read back store.readAllEvents(); file deleted afterwards, no source touched). Sequence: ProposeExecutionPlan -> Approve -> Activate -> StartExecutionStep -> FailExecutionStep{stepId,failureReason:'boom',failureClass:'TRANSIENT'} -> RetryExecutionStep{stepId,retryReason:'try again'}. Actual committed payloads:

  ExecutionStepStarted  { stepId, stepState: "RUNNING" }                        -> ExecutionStepStartedPayloadSchema.safeParse = TRUE
  ExecutionStepFailed   { stepId, failureReason: "boom", failureClass: "TRANSIENT" } -> ExecutionStepFailedPayloadSchema.safeParse = FALSE
        issue: path ["stepState"], invalid_value (expected one of NOT_READY|READY|QUEUED|RUNNING|WAITING|SUCCEEDED|FAILED|SKIPPED|CANCELLED|SUPERSEDED) — the field is absent
  ExecutionStepRetried  { stepId, retryReason: "try again" }                     -> ExecutionStepRetriedPayloadSchema.safeParse = FALSE
        issue 1: path ["stepState"], invalid_value — absent
        issue 2: unrecognized_keys ["retryReason"] — the raw COMMAND field is not on the strict EVENT schema

So the emitted payloads are literally the raw command payloads and both events are rejected by their own declared shapes. The finding is empirically true, and it UNDERSTATES the retry case: ExecutionStepRetried has a SECOND violation (`retryReason` is an extra key under z.strictObject), so the suggested fix must STRIP retryReason as well as add stepState — supplying `{stepId, stepState:'QUEUED'}` only.

WHY NO EXISTING TEST CATCHES IT (the coverage gap, checked exhaustively):
1. packages/rph-application/src/handlers/execution-retry-cap.test.ts — drives exactly this Start/Fail/Retry cycle four times (attemptThenRetry(), :76-85) but asserts ONLY CommandResult.status and error text (:124-157). Zero assertion on any emitted payload.
2. packages/rph-application/src/handlers/execution-step-reissue-guard.test.ts — the only other suite that names these events; it asserts eventsOfType('ExecutionStepFailed'/'ExecutionStepRetried').toHaveLength(1) (:135,:147,:162,:170) — COUNTS only, never shape.
3. packages/rph-engine/src/emitted-event-conformance.test.ts is the one test that would catch this class, and it is BLIND here — verified two ways: (a) EVENTS does register both schemas (messages.ts:2292-2300), so the sweep WOULD flag them if it saw them; (b) grep for FailExecutionStep|RetryExecutionStep over packages/rph-engine/src returns NO matches — reference-undertaking.ts only sends StartExecutionStep (:567) and CompleteExecutionStep (:604). The step never fails, so neither event ever enters the swept stream. Its PIN `expect(violations.map(...)).toEqual([])` (:96) and its prose claim "every event this system emits conforms to its own declared shape" (:84) are therefore VACUOUS for these two event types — this is precisely the Increment-29 defect class ("emits command.payload while the vocab declares the RESULTING status") still live on two events, in a register documented as CLEARED.
4. RATIFIED_EVENT_PAYLOADS (messages.ts:2474-2490) contains neither (nor ExecutionStepStarted; only ExecutionStepSucceeded of the step family), so the runtime (d2) kit gate never validates them — the violation commits silently. Confirmed by probe: both dispatches returned ACCEPTED.
5. packages/rph-projections/src/execution-attempts.test.ts:56-57,72,120-121 constructs its ExecutionStepFailed/Retried fixtures WITHOUT stepState — the test suite has baked the non-conforming shape in as the expected input, so it can never diverge from it.

SEVERITY / SCOPE CORRECTION (fairness to the code): the finding's "the retry cycle is invisible to replay" framing is partly overstated. execution-attempts.ts folds by EVENT TYPE (applyStepFailed hardcodes state='FAILED', :125; ExecutionStepRetried is deliberately absent, :137), so the live attempts read-model is NOT broken and no current consumer regresses. The real, proven defect is the contract violation itself plus the total absence of any test that would go red if it were fixed or further broken — i.e. an unkilled-mutant / anti-vacuity gap on the two events that carry RPH-EXE-008's retry cycle. That is MAJOR under JPWB-CON-000 B7 (a declared shape no test enforces, in a program whose conformance register asserts the opposite), not a data-loss BLOCKER.

CHECK TO REPRODUCE (one line, no new file needed): append to execution-retry-cap.test.ts after any attemptThenRetry(): `expect(ExecutionStepFailedPayloadSchema.safeParse(store.readAllEvents().find(e=>e.eventType==='ExecutionStepFailed')!.payload).success).toBe(true)` — fails today on the missing stepState.

</details>

**Live check needed.** None — settled by running the real engine. If a fix is applied, also register both events in RATIFIED_EVENT_PAYLOADS AND add a Fail+Retry leg to driveReferenceUndertaking (reference-undertaking.ts), otherwise emitted-event-conformance.test.ts stays blind to any future regression on this exact pair.


## F-26 · [CONFIRMED] [MAJOR] CompleteExecutionStep and FailExecutionStep have no plan-ACTIVE precheck and no positive test declaring the omission — a superseded plan still records new success facts

- **Lens:** `invariants`
- **Site:** `packages/rph-application/src/handlers/execution.ts:744-860 (`completeExecutionStep`, precheck at :800-858) and :863-871 (`failExecutionStep`); denominator: the five plan-ACTIVE prechecks at :709, :919, :967, :1049, :1119`

**Claim.** Enumerating RPH-EXE-002 across the surface: Start(:709), Retry(:919), Skip(:967), Prune(:1049) and ResolveWait(:1119) each hand-inline `plan.status !== 'ACTIVE'`. Cancel(:998) and EnterWait(:1081) omit it and BOTH carry an explicit written rationale plus a positive test asserting the omission is intended (skip-cancel:178, start-gate:613). Complete and Fail omit it with NO rationale comment and NO test either way — the policy is undeclared. Complete is not a benign omission the way Cancel is: it is the only command that (i) mints a positive ExecutionStepSucceeded governed fact, (ii) records a BRANCH `selectedTransitionId` (mutateStep, :762-779), and (iii) is the surface's de minimis floor protected transition. The surface therefore refuses the LESSER act on a dead plan — ResolveExecutionStepWait rejects with "a superseded/terminal plan opens no new work ... Cancel the step instead" (:1119-1126) — while permitting the GREATER one. This is also the upstream half of the unbacked-success finding above: it is how a SUCCEEDED step gets minted on an already-superseded plan.

**Failure scenario.** Plan P1 ACTIVE on pwu_A, step s1 (a BRANCH) RUNNING. Dispatch SupersedeExecutionPlan(P1 -> P2); P1.status = 'SUPERSEDED' and s1 stays RUNNING (nothing supersedes the steps — see the machine's NOT_READY|READY|QUEUED|RUNNING|WAITING -> SUPERSEDED arrows at transitions.data.ts:1478-1482, whose trigger 'plan revised/superseded' has no command). Activate P2. Now dispatch CompleteExecutionStep(P1, s1) -> ACCEPTED: P1 gains an ExecutionStepSucceeded at revision+1 and s1 records `selectedTransitionId`, i.e. a branch DECISION is written onto a plan the sponsor superseded. Immediately after, ResolveExecutionStepWait(P1, anyWaitingStep) -> REJECTED for the same plan, same instant. Same plan status, opposite answers, with the permissive answer on the more consequential command.

**Suggested fix.** Pick one and make it testable. Either (a) add the plan-ACTIVE precheck to completeExecutionStep (recording success under a killed plan is exactly the 'new work' RPH-EXE-002 exists to stop, and Cancel remains the honest exit), or (b) keep the omission and add the same shape of positive test Cancel/EnterWait have, plus the rationale comment saying why terminating an already-open attempt with a SUCCESS verdict is not opening work. Either way, also mint the step-level supersede command the machine already ratifies so a superseded plan's live steps do not stay RUNNING forever.

<details><summary>Code-semantics verifier evidence</summary>

CONFIRMED for CompleteExecutionStep; the FailExecutionStep half is largely refuted (see "Corrections").

=== 1. The code facts hold exactly as claimed ===

`advanceStep` (packages/rph-application/src/handlers/execution.ts:598-676) supplies NO plan-status term. Its only gates are, in order: `loadOrReject` (kit.ts:126-160 — existence + optional `expectedRevision` only; no status), the caller's `precheck`, `requireFrom`, then `checkTransition(STEP_MACHINE, ...)` which knows nothing of `plan.status`.

`completeExecutionStep` precheck (execution.ts:800-858) contains exactly three tests: `validateStepCompletion` (:803), the unresolved-result-id check (:833), and the floor-gate loop (:841-856). There is no `plan.status` term anywhere in it. Compare the five siblings that DO hand-inline it verbatim: start :709, retry :919, skip :967, prune :1049, resolveWait :1119-1126.

`SupersedeExecutionPlan` (execution.ts:531-569) moves ONLY `status` — it never touches `steps[]`. Its own docblock at :528-529 claims the invariant is "enforced downstream by the plan-ACTIVE prechecks on startExecutionStep AND retryExecutionStep" — it names exactly two commands, and Complete is not one of them. The step machine's five `-> SUPERSEDED` arrows (transitions.data.ts:1478-1482, trigger "plan revised/superseded") have no command behind them, so a RUNNING step survives the supersession intact.

=== 2. The failureScenario REPRODUCES LIVE (measured, not inferred) ===

I ran the scenario as a real vitest against the real Engine + SqliteStorageAdapter (plan on PWU with 2 steps; Start s1 -> RUNNING; RecordArtifact + satisfied floor; SupersedeExecutionPlan -> PLAN_B; then Complete / Fail / EnterWait+ResolveWait). Actual measured results:

  { stepAfterSupersede: 'RUNNING',
    completeStatus: 'ACCEPTED', completeError: null,
    stepAfterComplete: 'SUCCEEDED',
    succeededEvents: 1,
    planStatus: 'SUPERSEDED' }

  { failStatus: 'ACCEPTED', failError: null, stepAfterFail: 'FAILED' }

  { enterWait: 'ACCEPTED', resolveWait: 'REJECTED', resolveErr: 'RPH_ILLEGAL_STATE_TRANSITION' }

So on a SUPERSEDED plan an `ExecutionStepSucceeded` governed fact IS minted at revision+1 and the step IS driven to terminal-success SUCCEEDED — while `ResolveExecutionStepWait` on the SAME plan at the SAME status is REJECTED with "a superseded/terminal plan opens no new work (RPH-EXE-002). Cancel the step instead." The claimed asymmetry (lesser act refused, greater act permitted) is real and measured. (Probe file deleted after the run; the sibling `zz-probe-complete-superseded.test.ts` / `zz-verify-notready.test.ts` in that directory are other lenses' and were left untouched.)

=== 3. The BRANCH limb also holds ===

`mutateStep` (execution.ts:762-779) is gated only on `step.stepType !== 'BRANCH'` — nothing about plan status — so a BRANCH step completing under a superseded plan writes a durable `selectedTransitionId` decision onto a plan the sponsor killed. Inert within that plan (start/prune/resolve are all refused there), but it is a recorded decision on dead state.

=== 4. Why MAJOR and not cosmetic — the downstream authority leak ===

`rejectUnbackedExecutionSuccess` (packages/rph-application/src/handlers/pwu.ts:670-698) is the PWU-level premise gate for `executionState: SUCCEEDED`. Its backing test is:

    return s.workUnitId === id && (s.steps ?? []).some((step) => step.stepState === 'SUCCEEDED');

`workUnitId` and step state ONLY — no `status` term. So the SUCCEEDED step minted above on the SUPERSEDED plan is valid backing for the PWU to claim execution success. That is precisely why Complete is NOT in the benign Cancel/EnterWait class: those mint nothing any downstream guard consumes as authority; Complete mints the one fact the whole assurance chain rests on (pwu.ts:656-657, "the premise of everything downstream"). pwu.ts:662-664 explicitly delegates: the step's completion is "separately and independently guarded" — and that independent guard is the one shown here to lack the plan-ACTIVE term.

=== 5. The anti-vacuity gap is real ===

Grepping the whole handler suite: no test dispatches CompleteExecutionStep or FailExecutionStep against a non-ACTIVE plan. execution-plan-supersede.test.ts:155-166 ("RPH-EXE-002: after supersession, neither StartExecutionStep NOR RetryExecutionStep may proceed") covers exactly Start and Retry. The policy for Complete is neither declared nor tested in either direction — adding the precheck breaks no test, and deleting it later would break no test.

=== CORRECTIONS to the finding ===

(a) "Complete and Fail omit it with NO rationale comment" is WRONG for Fail. execution.ts:1076-1079 states: "A wait SUSPENDS work already RUNNING rather than opening any, so — like Cancel/Fail and UNLIKE Start/Retry/Resolve — there is DELIBERATELY no plan-ACTIVE precheck." Fail IS enumerated as an intentional omission (sited in EnterWait's docblock rather than its own — a siting nit, not a policy gap), and it is substantively right per pwu.ts:666-668: "FAILED in particular must never need permission to record — a system that makes failure harder to report than success is worse than one that checks neither." Complete is named in NEITHER enumeration (:992-996, :1076-1079) — that is the genuinely undeclared case. The Fail limb should be dropped.

(b) The rider "mint the step-level supersede command so live steps do not stay RUNNING forever" is a separate gap and should not ride on this finding. Note that gating Complete introduces NO deadlock: `cancelExecutionStep` (requireFrom READY|QUEUED|RUNNING|WAITING, deliberately no plan-ACTIVE precheck, :998-1011) remains the legal exit for a live step on a dead plan.

NET: CONFIRMED at MAJOR, scoped to `completeExecutionStep` (packages/rph-application/src/handlers/execution.ts:744-860).

</details>

<details><summary>Test-evidence verifier evidence</summary>

RAN A TEMPORARY PROBE (now deleted: `packages/rph-application/src/handlers/zz-probe-complete-superseded.test.ts`, run with `bunx vitest run … --disable-console-intercept`). No source file was modified by me.

OBSERVED BEHAVIOUR (real engine, SqliteStorageAdapter + Engine dispatch), plan PLAN_A ACTIVE on PWU with a BRANCH step b1 RUNNING (two out-edges: CONDITIONAL tA -> a1 with `{op:'STEP_SUCCEEDED', stepId:b1}`, SEQUENTIAL tB -> a2) and a second RUNNING step r2, then `SupersedeExecutionPlan(PLAN_A -> PLAN_B)` = ACCEPTED:

  POST-SUPERSEDE steps: b1 stepState=RUNNING, r2=RUNNING, w1=WAITING, q1=QUEUED  (supersession does NOT move any step; the machine's *->SUPERSEDED step arrows at transitions.data.ts:1478-1482 have no command — `target: 'SUPERSEDED'` at execution.ts:537 is the PLAN via advanceStatus)
  COMPLETE(BRANCH b1): **ACCEPTED**, error undefined
    -> step b1 = {"stepState":"SUCCEEDED","selectedTransitionId":"plan_…K20-tA"}   <- a DWP-09 point-in-time BRANCH DECISION written onto a superseded plan
    -> ExecutionStepSucceeded events = 1 (plan revision bumped to 5)
  FAIL(r2, failureReason:'boom'): **ACCEPTED** -> stepState=FAILED, ExecutionStepFailed = 1
  RESOLVE-WAIT(w1): REJECTED RPH_ILLEGAL_STATE_TRANSITION "…is not ACTIVE (SUPERSEDED) … opens no new work (RPH-EXE-002). Cancel the step instead."
  SKIP(q1): REJECTED RPH_ILLEGAL_STATE_TRANSITION (RPH-EXE-002)
  RETRY(r2): REJECTED RPH_ILLEGAL_STATE_TRANSITION (RPH-EXE-002)

Same probe against a TERMINAL plan (`CancelExecutionPlan` -> status CANCELLED) gives the identical result: COMPLETE **ACCEPTED** with `selectedTransitionId` recorded, FAIL **ACCEPTED**. So the hole is not supersession-specific — it is every non-ACTIVE plan status, including terminal.

This reproduces the finding's failureScenario verbatim: the same plan, at the same instant, REFUSES the lesser act (resume a wait) and PERMITS the greater one (mint a positive ExecutionStepSucceeded plus a branch decision).

COVERAGE GAP (the test-evidence half, independent of the code reading):
- No test anywhere dispatches CompleteExecutionStep or FailExecutionStep against a non-ACTIVE plan. The seven files that dispatch CompleteExecutionStep (artifact.test.ts, execution-detail, execution-floor-gate-ai, execution-floor-signal0-live, execution-floor-subject, execution-start-gate, pwu.test.ts) contain exactly ONE `CancelExecutionPlan`/`SupersedeExecutionPlan` occurrence between them — execution-start-gate.test.ts:617 — and that one belongs to the EnterWait/ResolveWait test, not to a Complete. So no existing test proves the behaviour works, and none declares it intended. Nothing REFUTES the finding.
- The finding's denominator is verified exactly. Plan-ACTIVE prechecks are hand-inlined at execution.ts:709 (Start), :919 (Retry), :967 (Skip), :1049 (Prune), :1119 (ResolveWait). The two other omissions are each declared in code AND positively tested: Cancel (comment execution.ts:991-997 "DELIBERATELY no plan-ACTIVE precheck"; test execution-step-skip-cancel.test.ts:178 "cancels a step under a SUPERSEDED plan — cleanup is permitted post-supersession") and EnterWait (comment :1074-1080; test execution-start-gate.test.ts:613 "permits a wait under a NON-ACTIVE plan but REFUSES the resume"). Complete (:744-860) and Fail (:863-871) have neither a rationale nor a test — the policy is genuinely undeclared, and on this surface the convention for a deliberate omission is a written rationale plus a positive test.
- The JAN-CMDPRE precondition layer does NOT cover this: `command-precondition.ts` is a 150-line leaf used only by `advanceStatus` (plan-level `precondition: fromStates(...)`); step-level commands go through `advanceStep`, which has only `requireFrom` + `precheck` (execution.ts:645-655). So there is no second layer that catches it.
- Corroborating self-contradiction in the code's own prose: `supersedeExecutionPlan`'s doc comment (execution.ts:527-529) enumerates the enforcement as "RPH-EXE-002 … is enforced downstream by the plan-ACTIVE prechecks on startExecutionStep AND retryExecutionStep" — an enumeration that silently omits the one command that mints success.

WHY MAJOR STANDS (not MINOR): Complete is not a benign "terminate an already-open attempt" the way Cancel is. It (i) mints a positive ExecutionStepSucceeded governed fact at revision+1 on a plan the sponsor killed, (ii) writes `selectedTransitionId` — the DWP-09 resolved-once decision that exists precisely because it "cannot be reconstructed later" — onto that dead plan, and (iii) is the surface's de minimis-floor protected transition. Refusing it would NOT deadlock anything: RUNNING -> CANCELLED remains available and is exactly what ResolveWait's own refusal message prescribes ("Cancel the step instead").

CAVEAT / SIDE-OBSERVATION (not mine, flag to the parent): during this session another agent left an uncommitted one-line mutation in the target file — `git diff packages/rph-application/src/handlers/execution.ts` shows `+ assuranceState: 'SATISFIED',` added to the ExecutionStepSucceeded eventPayload at :797. It is an INV-5 mutant probe from a sibling lens, does not affect any result above (my probe turns on plan.status, not payload fields), and MUST be reverted before commit. Also present and not mine: `packages/rph-application/src/handlers/zz-verify-notready.test.ts`, `zz-verify-scratch.test.ts`, `zz-verify-unbacked-exec.test.ts`.

</details>

**Live check needed.** None — settled by execution. To re-derive: seed an ACTIVE plan with a RUNNING BRANCH step, dispatch SupersedeExecutionPlan (or CancelExecutionPlan), then dispatch CompleteExecutionStep and FailExecutionStep on the RUNNING steps and assert the result. Today both return ACCEPTED and the BRANCH gains selectedTransitionId. Whichever policy is chosen, that test is the one that must exist (mirroring execution-step-skip-cancel.test.ts:178 / execution-start-gate.test.ts:613). Separately worth minting: the step-level supersede command the machine already ratifies (transitions.data.ts:1478-1482), so a superseded plan's live steps do not stay RUNNING forever.


## F-27 · [CONFIRMED] [MAJOR] A NOT_READY step on a reachable path is a permanent deadlock — no command drives NOT_READY out, and every terminal-success exit refuses it

- **Lens:** `invariants`
- **Site:** `packages/rph-domain/src/transitions.data.ts:1435 (initialState 'NOT_READY'), :1439-1444 (the two commandless arrows); packages/rph-application/src/handlers/execution.ts:698 / :958 / :1004 / :1041 (the four requireFrom sets); packages/rph-contracts/src/messages.ts:132-141 + :230-242 (propose accepts any StepStateSchema value)`

**Claim.** The completion oracle (`completeExecutionPlan`, execution.ts:483-491) requires EVERY step in {SUCCEEDED, SKIPPED}, so any step that can get stuck outside that set with no legal way out is a deadlock. NOT_READY is such a state and it is the machine's DECLARED initialState. The machine's only out-arrows from NOT_READY are -> READY (trigger 'ExecutionStepReady'), -> SKIPPED (prune) and -> SUPERSEDED (trigger 'plan revised/superseded'). Of those, `ExecutionStepReady` exists only as a ratified EVENT payload schema (messages.ts:1140, registered :2296) with NO command anywhere that emits it; step-level SUPERSEDED likewise has no command. That leaves prune, which is gated on `prunableStepIds` (structural unreachability) and so refuses a step on the LIVE path. The other three step commands all exclude NOT_READY by requireFrom: start is ['QUEUED'] (:698), skip is ['READY','QUEUED'] (:958), cancel is ['READY','QUEUED','RUNNING','WAITING'] (:1004). Meanwhile ProposeExecutionPlanPayloadSchema takes `steps: z.array(ExecutionStepSchema)` and ExecutionStepSchema's `stepState: StepStateSchema` accepts all ten values verbatim — so the contract lets a proposer author exactly this. The sibling case is softer but still wrong: a READY step on the live path has no path to RUNNING either (READY -> QUEUED has no command), so its only route to terminal-success is a WAIVED skip — i.e. the system forces an operator to record a waiver for a step it fully intends to execute.

**Failure scenario.** Propose a two-step linear plan with steps [{id:'s1', stepState:'QUEUED'}, {id:'s2', stepState:'NOT_READY'}] and no transitions. Approve, Activate. Start(s1), Complete(s1) -> s1 SUCCEEDED. Now for s2: StartExecutionStep -> REJECTED ('requires step s2 to be QUEUED, but it is NOT_READY'). SkipExecutionStep -> REJECTED (requireFrom READY|QUEUED). CancelExecutionStep -> REJECTED (requireFrom excludes NOT_READY, and the machine has no NOT_READY->CANCELLED arrow). PruneExecutionStep -> REJECTED ('it is still reachable' — s2 is live, transitions[] is empty so liveStepIds returns everything). CompleteExecutionPlan -> REJECTED forever ('1 step(s) not in terminal success (NOT_READY)'). The plan has no exit except Fail/Cancel/Supersede. The already-fixed NOT_READY->SKIPPED arrow only rescued the structurally-dead-arm case; the reachable case is still wedged.

**Suggested fix.** Either close the machine (mint MarkExecutionStepReady / ScheduleExecutionStep commands so NOT_READY -> READY -> QUEUED is drivable, which is what the ratified `stepMayBecomeReady` + `ExecutionStep.preconditions` were written for), or close the door (refine ExecutionStepSchema/ProposeExecutionPlanPayloadSchema so a proposed step's stepState must be 'QUEUED', rejecting an undriveable authored state at propose-time). Do not widen skip's requireFrom to NOT_READY — that makes Skip a second route into prune's territory without the reachability proof.

<details><summary>Code-semantics verifier evidence</summary>

I could not refute it — I reproduced the exact failureScenario live against the real engine.

LIVE REPRODUCTION (scratch vitest in packages/rph-application, since deleted; step 1 seeded SUCCEEDED at propose to avoid a concurrent agent's in-flight `assuranceState:'SATISFIED'` mutation of completeExecutionStep, which is unrelated contamination in the working tree). Plan = 2 steps, `transitions: []`, s1 SUCCEEDED, s2 NOT_READY, plan ACTIVE. Verbatim engine output:

  START    REJECTED RPH_ILLEGAL_STATE_TRANSITION "StartExecutionStep requires step ...-s2 to be QUEUED, but it is NOT_READY."
  SKIP     REJECTED RPH_ILLEGAL_STATE_TRANSITION "SkipExecutionStep requires step ...-s2 to be READY or QUEUED, but it is NOT_READY."
  CANCEL   REJECTED RPH_ILLEGAL_STATE_TRANSITION "CancelExecutionStep requires step ...-s2 to be READY or QUEUED or RUNNING or WAITING, but it is NOT_READY."
  PRUNE    REJECTED RPH_INVARIANT_VIOLATION "Cannot prune step ...-s2: it is still reachable ..."
  COMPLETE REJECTED RPH_INVARIANT_VIOLATION "CompleteExecutionPlan blocked: plan ... has 1 step(s) not in terminal success (NOT_READY) ..."
  s2 state NOT_READY

The READY sibling claim also reproduced verbatim: START REJECTED ("requires ... QUEUED, but it is READY"), unwaived SKIP REJECTED ("skipping a mandatory step requires an authorized plan revision or waiver (§21.1)"), PRUNE REJECTED ("still reachable"). So a READY step's ONLY route to terminal-success is a waived skip — an operator must record a waiver for a step the plan fully intends to execute.

STATIC CORROBORATION (every cited fact checked against real code, raw-byte-inspected via `cat -v` — no invisible-delimiter artifact anywhere here):

1. The four requireFrom sets are exactly as claimed — packages/rph-application/src/handlers/execution.ts:698 `requireFrom: ['QUEUED']` (start), :958 `['READY','QUEUED']` (skip), :1004 `['READY','QUEUED','RUNNING','WAITING']` (cancel), :1041 `['NOT_READY','READY','QUEUED']` (prune). advanceStep enforces them at :647-653 before checkTransition.

2. The machine's only out-arrows from NOT_READY, packages/rph-domain/src/transitions.data.ts:1435 (`initialState: 'NOT_READY'`), :1439-1443 (→READY, trigger 'ExecutionStepReady'), :1469-1473 (→SKIPPED, trigger 'pruneExecutionStep'), :1478 (→SUPERSEDED, 'plan revised/superseded'), plus an explicit `illegal` NOT_READY→RUNNING entry. There is NO NOT_READY→CANCELLED arrow.

3. No command can emit `ExecutionStepReady` or drive →READY/→QUEUED-from-READY. The handler registry (packages/rph-application/src/handlers/registry.ts:131-139) lists exactly nine step commands: Start/Complete/Fail/Retry/Skip/Cancel/Prune/EnterWait/ResolveWait. Repo-wide grep for `ExecutionStepReady` hits only the event schema (packages/rph-contracts/src/messages.ts:1140), its registration (:2296), the machine trigger string (transitions.data.ts:1441) and vocab JSON. `stepMayBecomeReady` (packages/rph-domain/src/execution.ts:129) and `ExecutionStep.preconditions` exist but no handler calls the former for a state change. Step-level SUPERSEDED likewise has no command.

4. Prune genuinely cannot rescue a live-path step: packages/rph-domain/src/transition-gate.ts:137 `if (transitions.length === 0) return new Set(plan.steps.map((s) => s.id)); // linear plan: everything is reachable`, and prunableStepIds (:323-333) filters on `!live.has(s.id)`. So for a linear plan prunable is always [].

5. The door is open at propose-time: packages/rph-contracts/src/objects.ts:230-242 `ExecutionStepSchema = z.strictObject({ ... stepState: StepStateSchema ... })` with StepStateSchema = all ten values (packages/rph-contracts/src/enums.ts:699-710); ProposeExecutionPlanPayloadSchema (messages.ts:131-140) takes `steps: z.array(ExecutionStepSchema)`; and proposeExecutionPlan (execution.ts:240-278) validates the GRAPH, duplicate edge ids and condition expressions but never the authored `stepState` — it stores `steps: p.steps` verbatim at :263.

6. Not theoretical: the repo's own e2e authors this shape — apps/rph-demo/e2e/execution-plan.e2e.ts:150 `steps: [mkStep(STEP1,'QUEUED'), mkStep(STEP2,'QUEUED'), mkStep(STEP3,'NOT_READY')]`, then Approve+Activate. That plan can never COMPLETE.

CORRECTIONS / REFINEMENTS to the finding (substance unchanged):
- Citation slip: the ExecutionStepSchema site is packages/rph-contracts/src/objects.ts:230-242 (and enums.ts:699-710), NOT `messages.ts:230-242`. Only ProposeExecutionPlanPayloadSchema lives in messages.ts (:131-140).
- The suggested fix "refine ExecutionStepSchema" would be wrong as stated: that same schema is the PERSISTED step shape (objects.ts:616 `ExecutionPlanSchema.steps`), so pinning it to 'QUEUED' would forbid persisting any advanced step. The propose-time guard belongs in `proposeExecutionPlan` (alongside rejectMalformedTransitionGraph at execution.ts:250-255), or a new payload-level schema.
- The defect class is WIDER than NOT_READY/READY. Propose accepts any of the ten — I demonstrated `stepState:'SUCCEEDED'` is accepted verbatim. Authoring a step at CANCELLED/SUPERSEDED/FAILED is equally accepted; CANCELLED and SUPERSEDED are terminal-non-success, so they permanently block CompleteExecutionPlan's allow-list (execution.ts:483-491) with no command able to move a terminal step. So the root cause is "propose does not constrain the authored stepState at all", of which the NOT_READY deadlock is the instance the finding names.

MITIGATING CONTEXT (why not BLOCKER, and why the reviewer should know it is partly disclosed): this is the un-closed remainder of documented finding F-11 (docs/.../JAN-EXECPLAN-DR-001 Detailed Implementation Roadmap.md:55, :298 — "a step authored below QUEUED (the domain's own initial state) is undriveable … the seed masks this by authoring steps directly at stepState:'QUEUED'", disposed as "Tier-3 domain work"). Tier 3 closed the sibling halves (skip/cancel in DR-003 DWP-02/03, wait/resolve in DR-004 DWP-04, and the NOT_READY→SKIPPED prune arrow in the recent JAN-CMDPRE pass) but never the readying/scheduling half. What exists today is a UI-honesty affordance only — `isBelowQueued` (packages/rph-projections/src/execution-view.ts:181-185) and empty ADVANCE/CONTROL rows for NOT_READY (:120, :137) — which surfaces the dead end but does not prevent it, and the shipped authoring path sidesteps it by hardcoding QUEUED (apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts:528). MAJOR stands: a ratified command payload with no propose-time guard produces a plan that can never reach COMPLETED, and the disclosed-gap note covers affordance honesty, not the deadlock.

</details>

<details><summary>Test-evidence verifier evidence</summary>

CONFIRMED by executed probe. I wrote a temporary vitest probe (`packages/rph-application/src/handlers/zz-probe-notready.test.ts`, since DELETED; no source file modified) reusing the `execution-start-gate.test.ts` harness verbatim, and ran it with `bunx vitest run ... --silent=false --reporter=verbose`. Real engine output:

PROBE A — linear 2-step plan, transitions: [], steps [s1 QUEUED, s2 NOT_READY], approved+activated:
- start(1) -> ACCEPTED; complete(1) -> ACCEPTED; state `s1=SUCCEEDED s2=NOT_READY`
- start(2) -> REJECTED RPH_ILLEGAL_STATE_TRANSITION "requires step ...-s2 to be QUEUED, but it is NOT_READY"
- skip(2) no waiver -> REJECTED RPH_INVARIANT_VIOLATION (mandatory/waiver precheck fires first)
- skip(2) WITH waiverOrRevisionId -> REJECTED RPH_ILLEGAL_STATE_TRANSITION "requires ... READY or QUEUED, but it is NOT_READY"
- cancel(2) -> REJECTED "requires ... READY or QUEUED or RUNNING or WAITING, but it is NOT_READY"
- prune(2) -> REJECTED RPH_INVARIANT_VIOLATION "Cannot prune step ...-s2: it is still reachable"
- final state `s2=NOT_READY`; CompleteExecutionPlan -> REJECTED "has 1 step(s) not in terminal success (NOT_READY)"
So the step has NO legal exit and the plan can never reach COMPLETED — only Fail/Cancel/Supersede. Exactly the claimed scenario, verbatim.

PROBE C — the NOT_READY step is the FIRST step: start(1), prune(1), cancel(1) and even a WAIVED skip(1) all REJECTED; `s1=NOT_READY` permanently. So the deadlock is not an interior-step artifact; a plan whose first step is authored NOT_READY is unfinishable from birth.

PROBE B — the READY sibling claim is also confirmed as stated (and is correctly the softer one): start(2) from READY -> REJECTED (requireFrom ['QUEUED'], execution.ts:698); prune(2) -> REJECTED (still reachable); skip(2) no waiver -> REJECTED (mandatory default TRUE); skip(2) WITH waiver -> ACCEPTED, s2=SKIPPED, CompleteExecutionPlan -> ACCEPTED. So a READY step on the live path is not a deadlock but its only route to terminal success is an operator waiver for a step the plan fully intends to execute.

NO existing test refutes any of this — the corpus AFFIRMS the dead-end rather than disproving it:
- `packages/rph-projections/src/execution-view.test.ts:169-175` — "is true ONLY for the **undriveable** initial states (NOT_READY/READY)"; :92-96 asserts NO advance command for NOT_READY/READY; :129-132 asserts NO control command from NOT_READY. These lock the absence in.
- `apps/rph-demo/e2e/execution-plan.e2e.ts:150` STAGES a real ACTIVE plan `[STEP1 QUEUED, STEP2 QUEUED, STEP3 NOT_READY]` and :227-230 asserts step3 shows the `step-belowqueued` note and no action at all. The shipped reference demo therefore contains a plan that can never be COMPLETED.
- The ONLY test that drives a step OUT of NOT_READY is `packages/rph-application/src/handlers/execution-start-gate.test.ts:773-817` ("prunes a NOT_READY interior step of a dead arm"), added by the 2026-07-24 CMDPRE review. It covers exclusively the STRUCTURALLY-DEAD arm (BRANCH s1, false CONDITIONAL guard, s2 head pruned first). There is NO test anywhere for a NOT_READY step on a LIVE path — that is the coverage gap, and my probe shows the uncovered path is broken.

Code path corroboration (all read, not inferred): machine `transitions.data.ts:1435` initialState NOT_READY; out-arrows only :1439 ->READY (trigger `ExecutionStepReady`), :1470 ->SKIPPED (prune), :1478 ->SUPERSEDED. Repo-wide grep for `ExecutionStepReady` yields ONLY the event schema (`packages/rph-contracts/src/messages.ts:1140`, registered :2296), the machine trigger string, and vocab JSON — no command, no handler, no emitter. requireFrom sets: start ['QUEUED'] (execution.ts:698), skip ['READY','QUEUED'] (:958), cancel ['READY','QUEUED','RUNNING','WAITING'] (:1004), prune ['NOT_READY','READY','QUEUED'] (:1041) but gated by `prunableStepIds` structural reachability. Completion oracle at execution.ts:483-491 demands every step in {SUCCEEDED, SKIPPED}. Contract door is open: `ProposeExecutionPlanPayloadSchema` (messages.ts:132-141) takes `steps: z.array(ExecutionStepSchema)` and `ExecutionStepSchema.stepState: StepStateSchema` (`packages/rph-contracts/src/objects.ts:230-242`) accepts all ten values; `proposeExecutionPlan` (execution.ts:263) stores `steps: p.steps` verbatim with no normalization or state validation.

Severity held at MAJOR, with one qualification the raiser did not note (and which does not refute it): the *state* is partially DISCLOSED as a design finding — `JAN-EXECPLAN-DS-003 §F-2`: "The below-QUEUED lifecycle is undriveable. NOT_READY→READY ... and READY→QUEUED have no command; the domain's own initial state is a dead-end", plus DR-001 F-11 / §15 backlog. But those disclosures are scoped to UI AFFORDANCE honesty ("render an honest note, not a fabricated button"); nowhere is the PLAN-LEVEL consequence recorded — that a plan containing such a step can never reach COMPLETED. That consequence was created by later work (the DR-002 completion allow-list and the DWP-05 prune reachability guard), and the builders explicitly held the anti-deadlock rule while closing only the dead-arm half of it: execution.ts:1038-1040 "NOT_READY is included because a step on an excluded arm that never became ready must still be prunable, or the plan can never reach terminal-success and deadlocks (D5)". The reachable half was left open and untested. Mitigating (why not BLOCKER): nothing in the system MINTS a NOT_READY step — every seeded step is authored QUEUED (execution-start-gate.test.ts header: "steps stay seeded at QUEUED and the plan drives itself"), so the deadlock requires a proposer to author NOT_READY/READY — which the contract permits and the shipped e2e demo actually does.

</details>

**Live check needed.** None — settled by executed probe against the real engine (SqliteStorageAdapter + Engine.dispatch). Note for the record: while I ran, a concurrent sibling verifier had `packages/rph-application/src/handlers/execution.ts` modified with an unrelated one-line INV-5 mutation (`+ assuranceState: 'SATISFIED'` in the ExecutionStepSucceeded payload at :797). It does not affect these results — complete(1) still returned ACCEPTED and s1 reached SUCCEEDED in every probe, and all five rejections observed are on s2/s1's own state, independent of that payload field. To re-settle from a clean tree, re-run the same drive on a stashed working copy.


## F-28 · [CONFIRMED] [MAJOR] RPH-PWU-010 is unenforced: a BASELINED PWU can have a new execution plan activated and steps started

- **Lens:** `invariants`
- **Site:** `packages/rph-domain/src/execution.ts:73 (`canResumeExecutionOnPwu`, no production caller); packages/rph-application/src/handlers/execution.ts:240-278 (propose), :378-427 (activate), :689-740 (start)`

**Claim.** The ratified rule 'a BASELINED PWU opens no new execution' has a written, unit-tested kernel — `canResumeExecutionOnPwu` (RPH-PWU-010 / §8.3, rejecting with RPH_BASELINED_PWU_NO_RESUME). A repo-wide grep finds its only references are its own definition and its own unit test (execution.test.ts:11, :50-51); nothing in rph-application imports or calls it. Tracing the actual open-work path: `proposeExecutionPlan` loads the work unit only to assert it EXISTS (:242) and reads no lifecycle field; `activateExecutionPlan`'s guard is `canActivatePlan` over {planStatus, otherActivePlanExists} only (:411-426); `startExecutionStep`'s prechecks are plan-ACTIVE plus the graph gate (:708-738). No handler on this surface reads the PWU's `workLifecycleState`. So the invariant that a closed/baselined unit of work admits no new execution is enforced nowhere, while the ratified predicate that would enforce it sits fully built and dead. This is the same 'opens new work' family as RPH-EXE-002 and belongs to the same denominator, but is the axis nobody wired.

**Failure scenario.** Drive pwu_A all the way to BASELINED (the demo's own drive does this: SATISFIED -> BASELINED with an AUTHORITATIVE baseline citing the PWU). Then dispatch ProposeExecutionPlan(P3, workUnitId: pwu_A, steps:[s1 QUEUED]) -> ACCEPTED; ApproveExecutionPlan -> ACCEPTED (the assumption guard passes on an empty assumptionIds); ActivateExecutionPlan -> ACCEPTED (no other ACTIVE plan on that PWU); StartExecutionStep(s1) -> ACCEPTED; CompleteExecutionStep(s1) -> ACCEPTED. New professional work has been opened and completed against a baselined, frozen unit of work, and the resulting ExecutionStepSucceeded can then be cited to move the PWU's executionState (see the unbacked-success finding).

**Suggested fix.** Wire `canResumeExecutionOnPwu` into `activateExecutionPlan`'s guard (the narrowest correct site — activation is where runtime privilege is granted, and it already loads the PWU id via state.workUnitId), and add a rejection test. If the rule is deliberately deferred, record that as a disclosed residual rather than leaving a live ratified predicate with no caller, since a dead allowlist reads as an enforced one.

<details><summary>Code-semantics verifier evidence</summary>

I tried to refute this three ways (an earlier guard on propose, a guard on activate, a bus/precondition-layer gate) and could not. I then settled it with a LIVE drive, not by reading.

1) The kernel is dead. Repo-wide grep for `canResumeExecutionOnPwu` returns only: `packages/rph-domain/src/execution.ts:73` (definition), `packages/rph-domain/src/execution.test.ts:11,50-53` (its own unit test), the `mutant-src/` mirror, plus two DOCS (`docs/_working/dead-kernel-census.txt:17` "canResumeExecutionOnPwu DEAD (tests only)" and the W1 hollow-kernel triage). Zero production callers.

2) No handler on the surface reads the PWU lifecycle. Grep for `workLifecycleState` / `BASELINED` / `RPH_BASELINED_PWU_NO_RESUME` across `packages/rph-application` returns ZERO hits in `src/handlers/execution.ts`. Tracing each cited site confirms it:
- `proposeExecutionPlan` (execution.ts:240-249) loads the PWU only for existence: `if (!ctx.store.loadObject(p.workUnitId)) return reject(... 'requires an existing work unit')` — no field is read.
- `approveExecutionPlan` (:310-340) has `precondition: fromStates('UNDER_REVIEW')` + the RPH-ASM-006 assumption guard only; a PWU with `assumptionIds: []` passes trivially.
- `activateExecutionPlan` (:378-427): `precondition: fromStates('APPROVED')`, guard = `canActivatePlan({ planStatus, otherActivePlanExists })` — the PWU is touched only as `String(state.workUnitId)` fed to `otherActivePlanExistsForPwu`.
- `startExecutionStep` (:689-740): precheck is `plan.status !== 'ACTIVE'` then `startStepGate(...)` — plan-scoped only.
- The DWP-01b precondition mechanism (`handlers/command-precondition.ts`) is per-command and declares nothing PWU-lifecycle-related; there is no cross-cutting bus gate.

3) LIVE PROOF. I wrote a throwaway probe in `packages/rph-engine/src/` that runs `driveReferenceUndertaking(engine)` (which the existing `reference-undertaking.test.ts:157` already asserts leaves the Architecture PWU at `workLifecycleState: 'BASELINED'`), then opened brand-new execution against that frozen PWU. Verbatim output:

  ARCH PWU axes: BASELINED SUCCEEDED
  existing plan exp_...0023 ACTIVE
    CompleteExecutionPlan -> ACCEPTED
    ProposeExecutionPlan  -> ACCEPTED
    ApproveExecutionPlan  -> ACCEPTED
    ActivateExecutionPlan -> ACCEPTED
    StartExecutionStep    -> ACCEPTED
    CompleteExecutionStep -> ACCEPTED
  NEW PLAN state ACTIVE [ 'SUCCEEDED' ]

Every command in the finding's failureScenario was ACCEPTED against a BASELINED (terminal-lifecycle) PWU, and the new plan's step really reached SUCCEEDED. The probe file has been deleted (`packages/rph-engine/src/zz-probe-baselined-newwork.test.ts`, removed; working tree clean of it).

One correction to the reported scenario (does not change the verdict): the reference drive leaves the PWU's ORIGINAL plan in ACTIVE, so a naive second activation on that fixture would be refused by RPH-EXE-001 (`otherActivePlanExists`) — the WRONG rule, and only incidentally. I retired the old plan first (`CompleteExecutionPlan` — itself ACCEPTED on a BASELINED PWU), after which nothing at all stood in the way. So RPH-EXE-001 is not a substitute guard: it is bypassed by the ordinary lifecycle of the prior plan.

Two mitigating facts the parent should weigh when ranking, neither of which changes the code fact:
- This is PRE-EXISTING, not introduced by Tier 3C-ii; and it is a RECORDED deferral — `docs/Recursive Professional Harness/JAN-ROADMAP-001-v2/detailed-roadmaps/W1/evidence/hollow-kernel-triage.md:45` lists `canResumeExecutionOnPwu` under "§4. DEFER → W2/W3 ... W2 idempotency / recovery (WP-2-004/007)". So it is disclosed somewhere — but in another program's evidence file, not in this surface's residual register, and the runtime guarantee is absent either way.
- The severity is real regardless: a frozen/baselined unit of work admits new professional work end-to-end, and the resulting `ExecutionStepSucceeded` is exactly what `rejectUnbackedExecutionSuccess` (pwu.ts:670-698) accepts as backing for a PWU execution-success claim, so the fabricated work is citable downstream.

Keeping MAJOR. Narrowest correct fix remains `activateExecutionPlan` (it already has `state.workUnitId` in hand), with a rejection test asserting RPH_BASELINED_PWU_NO_RESUME — or an explicit disclosed residual on THIS surface.

</details>

<details><summary>Test-evidence verifier evidence</summary>

SETTLED BEHAVIOURALLY — a live end-to-end probe reproduced the exact failureScenario with no shortcuts, and no existing test contradicts it.

1) COVERAGE GAP (no test proves the behaviour works).
- `grep -rn canResumeExecutionOnPwu` over all .ts/.svelte (node_modules excluded): exactly three source hits — `packages/rph-domain/src/execution.ts:73` (definition), `packages/rph-domain/dist/execution.d.ts:24`, and `packages/rph-domain/src/execution.test.ts:11,50-51` (its own pure-function unit test). ZERO callers.
- `grep -rn RPH_BASELINED_PWU_NO_RESUME` over `packages/rph-application`, `packages/rph-projections`, `apps/rph-demo/src`, `apps/rph-demo/e2e`: ZERO hits. No handler test, no e2e, anywhere, asserts that a baselined PWU refuses new execution.
- `packages/rph-application/src/handlers/execution.ts` imports from `@janumipwb/rph-domain` (lines 20-37): canActivatePlan, canAuthorizeNewWork, canSkipStep, ConditionExpressionSchema, conditionStepRefs, evaluateCondition, prunableStepIds, resolveBranchSelection, retryDecision, startStepGate, validateStepCompletion, validateTransitionGraph — `canResumeExecutionOnPwu` is NOT among them. Grep for `workLifecycleState` and `BASELINED` in that file: ZERO hits.
- AGGRAVATING: `packages/rph-domain/src/conformance-manifest.ts:32` maps `'RPH-PWU-010': 'packages/rph-domain/src/execution.test.ts'` — the conformance record asserts the rule is covered, while the only evidence is a pure-predicate unit test with no production caller. A dead allowlist reading as an enforced one.

2) LIVE PROBE (temporary test, since deleted; no source file modified). I drove the FULL legitimate path in `packages/rph-application` (vitest, SqliteStorageAdapter + Engine): CaptureIntent→BeginIntentDiscovery→ProvisionIntent; ProposePwu→BeginPwuShaping→MarkPwuReady; a REAL succeeded execution plan (PLAN1: propose/approve/activate/start/ProposeEvidence/CompleteExecutionStep) then CompleteExecutionPlan so PLAN1 = COMPLETED (removing the one-ACTIVE-plan confound); a REAL satisfied assurance assessment; the seven ChangePwuState hops READY→PLANNED→EXECUTING→EVIDENCE_PENDING→UNDER_ASSURANCE→SATISFIED (all guards — rejectUnbackedExecutionSuccess, the assessment-citation guard — satisfied with real objects); then a REAL governance baseline: ProposeDecision(PROMOTE_BASELINE)→ApproveDecision→CreateBaseline(itemObjectIds:[PWU])→Submit→Approve→PromoteBaseline; then ChangePwuState SATISFIED→BASELINED citing that baseline.

Observed console output (bunx vitest run, --disable-console-intercept):
  PLAN1 status = COMPLETED
  PWU semanticVersion at SATISFIED = 1
  BASE status = AUTHORITATIVE
  === PWU IS NOW BASELINED (terminal, frozen) ===
  ProposeExecutionPlan on BASELINED PWU -> ACCEPTED
  ApproveExecutionPlan -> ACCEPTED
  ActivateExecutionPlan -> ACCEPTED
  StartExecutionStep -> ACCEPTED
  CompleteExecutionStep -> ACCEPTED
  PLAN2 status = ACTIVE step state = SUCCEEDED
  PWU workLifecycleState after new execution = BASELINED

Every one of the five open-work commands was ACCEPTED against a PWU sitting in the machine's own TERMINAL state (`transitions.data.ts` PWU.workLifecycleState terminalStates: ['BASELINED','ABANDONED','SUPERSEDED']), backed by a genuine AUTHORITATIVE baseline whose itemObjectVersions freeze that PWU. New professional work was opened AND completed on a frozen unit of work, and a second ExecutionStepSucceeded now sits in the governed stream available for citation.

3) PROBE FIDELITY. A concurrent verifier agent is live-mutating this worktree (untracked `mutant-src/`, `pristine-src/`, `vitest.mutant.config.ts`, and transient `M execution.ts`). My FIRST probe run failed on an unrelated injected mutant (an `assuranceState:'SATISFIED'` key on the ExecutionStepSucceeded payload → RPH_VALIDATION_SCHEMA_FAILED) and did not reproduce. Runs 2-4 were consistent and pristine: I verified the persisted event payload keys were exactly `executionStepId,executionAttemptId,outputArtifactIds,proposedEvidenceIds,detectedAssumptionIds,resultingExecutionState,executionProvenance,structuredResult` — byte-identical to the committed source at execution.ts:790-799 — proving the accepting run executed against unmutated code. `packages/rph-application/src/handlers/execution-start-gate.test.ts` also passes 42/42 on the same tree.

4) NO REFUTING EVIDENCE. The only candidate refutation would be a test showing the gate works; none exists. The kernel predicate is correct and correctly unit-tested — it is simply never called. This is the "built, ratified, and dead" wiring class, not a false positive. Severity MAJOR stands (same 'opens new work' family as RPH-EXE-002, plus a conformance-manifest claim of coverage that the wiring does not back).

</details>

**Live check needed.** None — settled live. Reproduce with the drive described in (2); assert ActivateExecutionPlan (or StartExecutionStep) REJECTS with RPH_BASELINED_PWU_NO_RESUME. That test goes RED today at every one of the five commands.


## F-29 · [CONFIRMED] [MAJOR] DWP-06's invariant "No affordance the engine would reject (F-11)" is violated by the Retry button, which is rendered with no plan-status gate

- **Lens:** `doc-fidelity`
- **Site:** `apps/rph-demo/src/routes/undertakings/[id]/+page.svelte:336-341 vs packages/rph-application/src/handlers/execution.ts:919-924`

**Claim.** DR-004 DWP-06 invariants: "Read-only render + allowlisted commands ... **No affordance the engine would reject (F-11)**", and prohibited_shortcuts: "Do NOT invent affordances from machine topology; derive from the read-models." The step-action block renders `advanceCommands` through an unconditional `{:else}` branch (+page.svelte:336-341) — start is gated by `startableStepByPlan` (:329, plan-ACTIVE-gated in the read-model), control commands are gated by `ctl === 'cancel' || ctl === 'wait' || pl.status === 'ACTIVE'` (:351), and prune by `prunableStepByPlan` (:363, plan-ACTIVE-gated at transition-gate.ts:324) — but retry gets nothing. retryExecutionStep REQUIRES an ACTIVE plan (execution.ts:919-924, RPH-EXE-002), and advanceCommandsFor's map (rph-projections/src/execution-view.ts:119-130) returns ['retry'] for FAILED with no plan input and, unlike controlCommandsFor, no docstring telling the caller to gate it. The file's own comment at +page.svelte:276-279 claims this surface follows "the same command-backed-allowlist discipline as the step actions (F-11)".

**Failure scenario.** Activate a plan, start s1, FailExecutionStep(s1) → FAILED. SupersedeExecutionPlan (or CancelExecutionPlan). The execution tab still renders `step-action-retry` for s1; clicking it dispatches RetryExecutionStep, which the engine rejects with RPH_ILLEGAL_STATE_TRANSITION ("plan ... is not ACTIVE"). That is precisely the read-model/authority divergence the plan-ACTIVE gate on prunableStepIds was added to prevent, reintroduced on the retry path.

**Suggested fix.** Gate the advance-command branch on `pl.status === 'ACTIVE'` for retry (and document the obligation on advanceCommandsFor as controlCommandsFor already does), or move the plan-status input into the read-model so the affordance cannot be offered off an inactive plan. Add the e2e assertion.

<details><summary>Code-semantics verifier evidence</summary>

I tried four refutation routes and all four failed.

**1. Is the `{:else}` branch really ungated?** Yes. `E:\Projects\hestami-ai\JanumiCode\janumiprofessionalworkbench\apps\rph-demo\src\routes\undertakings\[id]\+page.svelte` lines 336-342 (raw bytes verified with `cat -v` — no hidden control characters, no elided `{#if}`):
```
											{:else}
												<form method="POST" action="?/{STEP_ACTION[cmd]}" use:enhance class="inlineform">
													<input type="hidden" name="planId" value={pl.id} />
													<input type="hidden" name="stepId" value={s.id} />
													<button class="mini" data-testid="step-action-{cmd}">{STEP_LABEL[cmd]}</button>
												</form>
											{/if}
```
The only two guarded arms are `cmd === 'complete'` (:297) and `cmd === 'start'` (:325, gated on `data.startableStepByPlan`). `retry` and `fail` fall through the ungated `{:else}`. Contrast the very next block, :349: `{#if ctl === 'cancel' || ctl === 'wait' || pl.status === 'ACTIVE'}` — the control commands DO consult `pl.status`; the advance commands never do.

**2. Does the read-model gate it upstream?** No. `packages\rph-projections\src\execution-view.ts:164-165`: `export function advanceCommandsFor(stepState: string)` → `ADVANCE_BY_STEP_STATE[stepState] ?? []`, and the table at :126 is `FAILED: ['retry']`. It takes **stepState only** — no plan input. `:195` populates `advanceCommands: advanceCommandsFor(s.stepState)` with the plan status (`:110 readonly status: string`) sitting right there unused. This is exactly the asymmetry the finding names: `transition-gate.ts:242` (`startableStepIds`) and `:324` (`prunableStepIds`) both open with `if (plan.status !== 'ACTIVE') return [...]`, and :318-319 documents *why*: "mirroring startableStepIds (DWP-06). This is not cosmetic symmetry: pruneExecutionStep REJECTS a non-ACTIVE plan ... so without this gate the read-model [would offer a prune the engine refuses]." The retry path got no such gate.

**3. Does supersede/cancel cascade the step out of FAILED (so `advanceCommands` would be empty)?** No. `packages\rph-application\src\handlers\execution.ts:531` `supersedeExecutionPlan` calls `advanceStatus` with `statusField: 'status'` and an `eventPayload` carrying only `{supersedingExecutionPlanId, status:'SUPERSEDED'}` — `steps[]` is untouched; its own docstring says RPH-EXE-002 "is enforced downstream by the plan-ACTIVE prechecks on startExecutionStep AND retryExecutionStep." `cancelExecutionPlan` (:433-441) is a bare `advanceStatus` to CANCELLED with `precondition: fromStates('APPROVED','ACTIVE')` — no step mutation either. So the step stays FAILED and keeps rendering Retry.

**4. Are non-ACTIVE plans even rendered?** Yes. `+page.server.ts:107-145 shapeExecutionPlanInput` passes `status` straight through with no filter, and the template itself proves it: `:263 {#if pl.status === 'ACTIVE'}` and `:275 {#if pl.status === 'ACTIVE' || pl.status === 'APPROVED'}` only exist because non-ACTIVE plans reach that markup.

**Engine side confirms the divergence is real and retry-specific.** `execution.ts:919-924` (inside `retryExecutionStep`'s `precheck`):
```
			if (plan.status !== 'ACTIVE')
				return reject(command,'RPH_ILLEGAL_STATE_TRANSITION',
					`Cannot retry a step: plan ${command.targetAggregateId} is not ACTIVE (${String(plan.status)}) — a superseded/terminal plan creates no new attempts (RPH-EXE-002).`);
```
The `requireFrom: ['FAILED']` guard at :918 does NOT pre-empt it — the step genuinely is FAILED, so the command reaches the precheck and is refused there. I also checked the other two commands that share the ungated `{:else}`/complete arm, and they are correctly ungated: `failExecutionStep` (:863-871) has `requireFrom:['RUNNING']` and **no** plan-status precheck, and `completeExecutionStep` (:744+) has only the §8.4 floor gate — both are accepted under a terminal plan (consistent with the :346-348 comment that cleanup on already-running work stays available). So `retry` is the single advance command carrying a plan-ACTIVE precondition, and it is the single one the UI fails to gate.

**Reachable through the UI alone** (no fixture surgery): activate plan → Start s1 → Fail s1 (`step-action-fail`, from the same `{:else}`) → Cancel plan (`plan-cancel`, offered at :275 while ACTIVE) → plan is CANCELLED, s1 is FAILED, `step-action-retry` still renders; clicking it dispatches RetryExecutionStep and the engine refuses with RPH_ILLEGAL_STATE_TRANSITION.

**Severity correction, MAJOR → MINOR.** The failure is fail-closed: the engine is authoritative and refuses correctly, the rejection surfaces verbatim, and no invariant, state, or event stream is corrupted. What is breached is DWP-06's declared F-11 invariant and the read-model/authority symmetry the codebase enforces everywhere else — a real, code-grounded inconsistency, but its worst outcome is a button that errors, not a deadlock or an illegal state. That is the same weight as the already-fixed `PruneExecutionStep` NOT_READY machine/command inconsistency, which was graded MINOR.

**checkToConfirm as stated is sound**: read `+page.svelte:336-342` against `execution.ts:919-924`; the Playwright assertion (stage FAILED step, cancel or supersede the plan, expect `[data-testid="step-action-retry"]` count 0) fails today. Note `apps\rph-demo\e2e\execution-tier3.e2e.ts:155,162` are the only two references to `step-action-retry` anywhere and both merely *click* it on an ACTIVE plan — there is no negative-affordance test, which is why this shipped.

</details>

<details><summary>Test-evidence verifier evidence</summary>

CONFIRMED by live behaviour, not just code reading. I wrote a temporary Playwright probe (apps/rph-demo/e2e/zz-probe-retry-gate.e2e.ts, since DELETED; no source file modified) reusing execution-tier3.e2e.ts's stageActivePlan fixture: stage ACTIVE plan -> UI Start -> UI Fail (step FAILED, plan ACTIVE) -> UI "Fail plan" (plan FAILED, step still FAILED) -> count affordances. Output: `PROBE retry-button-count-under-FAILED-plan = 1`, `PROBE start-button-count-under-FAILED-plan = 0`, and clicking the rendered Retry produced `RetryExecutionStep rejected - RPH_ILLEGAL_STATE_TRANSITION: Cannot retry a step: plan plan_01ARZ...GT310 is not ACTIVE (FAILED) - a superseded/terminal plan creates no new attempts (RPH-EXE-002).` with the step remaining FAILED. So the UI offers an affordance the engine rejects: exactly the F-11 read-model/authority divergence, while the sibling Start affordance is correctly gone (plan-ACTIVE gate in the read-model).

Reachability is BROADER/simpler than the finding stated: `plan-fail` is itself only rendered on an ACTIVE plan (+page.svelte:263-273), so "step fails -> operator fails the plan" is the ordinary flow, no supersession needed. CANCELLED/SUPERSEDED reach the same place.

TEST-EVIDENCE (no test proves the claimed-correct behaviour; the gap is real):
- `step-action-retry` occurs in exactly two places repo-wide - apps/rph-demo/e2e/execution-tier3.e2e.ts:155 and :162 - both inside the retry-cap test, both under an ACTIVE plan. No e2e asserts retry absence under a non-ACTIVE plan (I grepped every execution-*.e2e.ts for toHaveCount(0)/SUPERSEDED/CANCELLED; the absence assertions cover start, skip, cancel, wait, resolve, prune, plan-complete - never retry).
- The sibling gate IS tested for start: packages/rph-projections/src/execution-view.test.ts:245 `startableStepId(ex(['QUEUED','QUEUED'],'SUPERSEDED'))` -> undefined.
- The engine half IS tested: packages/rph-application/src/handlers/execution-plan-supersede.test.ts:155 "RPH-EXE-002: after supersession, neither StartExecutionStep NOR RetryExecutionStep may proceed (L3-5)".
So retry is the ONLY command carrying a plan-ACTIVE precheck (handlers/execution.ts:918-924) whose UI affordance has neither a gate nor a test.

Refutation paths checked and eliminated:
- supersedeExecutionPlan (handlers/execution.ts:531-569) and failExecutionPlan (:506-521) write ONLY plan status - no cascade of step states, so the step really does stay FAILED (confirmed live via /__introspect in the probe).
- The demo load does not fold or override stepState: +page.server.ts:107-146 shapes the aggregate verbatim and :149-163 computes only startableStepByPlan/prunableStepByPlan/transitionRowsByPlan.
- advanceCommandsFor takes no plan input (rph-projections/src/execution-view.ts:119-130 ADVANCE_BY_STEP_STATE.FAILED = ['retry']; :164-166), and executionPlanView (:205-214) does not filter by status.
- The template branch is genuinely unconditional: +page.svelte:336-341 `{:else}` renders `?/{STEP_ACTION[cmd]}` for retry (and fail) with no `pl.status` test; only 'complete' (:297) and 'start' (:325-335) have their own branches, and of the four advance commands only retry has a plan-ACTIVE precheck in the engine (completeExecutionStep :744-800 and failExecutionStep :863-869 deliberately have none), so retry is the single mismatch.

Severity corrected MAJOR -> MINOR: the invariant violation is real and untested, but the engine fails closed with a verbatim rejection and no state is corrupted - the harm is a dead-end affordance on a terminal plan, the same calibration the program gave the earlier machine/command inconsistency. Fix as proposed: gate the advance-command branch on `pl.status === 'ACTIVE'` for retry (or thread plan status into the read-model), document the caller obligation on advanceCommandsFor as controlCommandsFor already does at execution-view.ts:168-171, and add the e2e absence assertion (which is the anti-vacuity kill test that is missing today).

</details>

**Live check needed.** None - the live check was already performed. The probe file was deleted and its e2e-results artifacts removed; `git status` shows no modified source and no leftover probe file from this lens.


## F-30 · [CONFIRMED] [MAJOR] The fail-closed lens verified `mandatory ?? true` but nobody checked the OTHER input to canSkipStep: `waiverOrRevisionId` is never resolved, so §21.1's 'authorized waiver' is satisfied by any non-empty string

- **Lens:** `completeness`
- **Site:** `packages/rph-application/src/handlers/execution.ts:975-985 (`hasAuthorizedWaiverOrRevision: !!p.waiverOrRevisionId`); schema at packages/rph-contracts/src/messages.ts:267 (`waiverOrRevisionId: z.string().optional()`); kernel at packages/rph-domain/src/execution.ts:194 (canSkipStep)`

**Claim.** `canSkipStep` takes two inputs. Every lens and every test interrogated the first (`mandatory`, correctly fail-closed at `?? true`, with the OMITTED case tested separately at execution-step-skip-cancel.test.ts:144). Nobody interrogated the second. `hasAuthorizedWaiverOrRevision` is computed as `!!p.waiverOrRevisionId` — a truthiness test on a free `z.string().optional()`. The id is never passed to `ctx.store.loadObject`, never checked for `objectType`, never checked for an authorization status, and never checked to be a DECISION/WAIVER at all. Grep confirms `waiverOrRevisionId` appears in exactly four places repo-wide: the two schemas, the truthiness test, and the single positive test that passes the plausible-looking literal `'dec_waiver_1'` — which is itself not a recorded object in that fixture. This is the same fail-open shape the review already flagged for a dangling assumptionId, and it is the load-bearing half: `mandatory ?? true` only routes the decision TO the waiver check; the waiver check is what actually authorizes.

**Failure scenario.** EMPIRICALLY CONFIRMED (probe G3, since deleted). Activate a two-step linear plan, then dispatch SkipExecutionStep{stepId:'s1', mandatory:true, waiverOrRevisionId:'not-a-real-object'} -> ACCEPTED, step becomes SKIPPED, and SKIPPED is terminal-SUCCESS for both the start-gate and completeExecutionPlan's allow-list. So any caller that can reach the command bus can retire a MANDATORY step — with no waiver, no revision, no decision object, no approver — by typing an arbitrary string, and the plan then reports COMPLETED as though the mandatory work were properly waived. This composes with the READY finding below: a step the engine can never execute is disposed of by the same fabricated string.

**Suggested fix.** Resolve `waiverOrRevisionId` in the precheck: load the object, require an expected `objectType` (DECISION/waiver or plan-revision), require an authorized status, and require it to reference this plan or step; reject with RPH_VALIDATION_SEMANTIC_FAILED otherwise — mirroring stepResultSubjects. Add the fabricated-id rejection as the kill test alongside the existing `mandatory`-omitted one.

<details><summary>Code-semantics verifier evidence</summary>

The gap is real, code-grounded, and stronger than the critic argued — the codebase has a ratified waiver-resolution kernel that this one path bypasses.

1. NO RESOLUTION EXISTS. `packages/rph-application/src/handlers/execution.ts:975-978`:
   const check = canSkipStep({ mandatory: p.mandatory ?? true, hasAuthorizedWaiverOrRevision: !!p.waiverOrRevisionId });
   That truthiness test is the ONLY consumer of the value. Repo-wide grep (src only) finds `waiverOrRevisionId` at exactly: `rph-contracts/src/messages.ts:267` and `:1153` (command + event schemas, both bare `z.string().optional()`), `execution.ts:963` (verbatim passthrough onto the event), `execution.ts:977` (the truthiness test), and `execution-step-skip-cancel.test.ts:153` (the single positive test). No `ctx.store.loadObject(p.waiverOrRevisionId)` anywhere. The kernel at `rph-domain/src/execution.ts:194` takes only a `boolean`, so it cannot check anything either.

2. THE "CALLER-ASSERTED / NOT-YET-IMPLEMENTABLE" DEFENSE FAILS. The handler comment (execution.ts:945-947) excuses `mandatory` as caller-asserted because "no step-level mandatory field is ratified" — but it makes NO such claim for the waiver; it asserts the skip "REQUIRES an authorized plan revision or waiver." And the waiver DOES have a ratified home: `rph-contracts/src/objects.ts:779` registers `DECISION: { schema: DecisionObjectSchema, idPrefixEntity: 'DECISION' }`, and `rph-domain/src/governance.ts:112` states "A waiver is a Decision of decisionType WAIVER," with `WaiverView`, `waiverCovers()` (the exact criterion/object/version triple, :127-138) and `waiverStillDischarges()` (EFFECTIVE ∧ ¬expired, :145-147).

3. THE SAME PACKAGE ALREADY DOES IT PROPERLY — SKIP IS THE OUTLIER. `rph-application/src/handlers/floor-gate.ts:277-294` (`waiverDischargesFloorPolicy`) loads the decisions, builds `WaiverView`s, and routes through `waiverStillDischarges` + `waiverCovers`, with explicitly enumerated fail-closed branches ("a WAIVER Decision carrying no `waiver` detail (legacy/malformed) names no criterion → discharges nothing"). The critic's other two norm citations also verify: `execution.ts:829-839` (`stepResultSubjects` → rejects unresolved result ids with RPH_VALIDATION_SEMANTIC_FAILED, "naming a nonexistent artifact id would otherwise yield zero subjects and sail through") and `execution.ts:552-565` (supersede resolves the successor via `loadObject` AND cross-checks `workUnitId`). So execution-skip is the one waiver-authorized bypass in the system that resolves nothing.

4. IT CONTRADICTS RATIFIED CANON VERBATIM. `docs/canon/JPWB-REG-005 Decision and Divergence Register.md:230` (REG-Q-012 safe default): "**Never implement waiver as a Boolean** — require a version-bound Decision with scope, expiry, rationale, controls, and the preserved finding." The code implements it as exactly a Boolean. `JPWB-DOC-003:203` (STA-8): "Skipping a mandatory plan step is a governed act requiring an authorized plan revision or waiver, never a silent omission."

5. NOTHING UPSTREAM COVERS IT. `rph-application/src/command-bus.ts` calls `loadObject` only at :220/:233 for optimistic-concurrency revision pre/postconditions — no generic reference resolution and no authority gate. The schema is a free `z.string().optional()`. So the truthiness test is the entire authorization.

6. CONSEQUENCE CONFIRMED. SKIPPED is terminal-SUCCESS in `completeExecutionPlan`'s allow-list (`execution.ts:484`: `s.stepState !== 'SUCCEEDED' && s.stepState !== 'SKIPPED'`) and in the start-gate. So a mandatory step is retired, and the plan can report COMPLETED, on an arbitrary string.

ONE REFINEMENT to the critic's failureScenario (it does not weaken the finding): the `≥1-SUCCEEDED` clause at `execution.ts:493-496` blocks an ALL-SKIPPED plan from completing, so the concrete repro must be: activate a 2-step plan → `SkipExecutionStep{stepId:'s1', mandatory:true, waiverOrRevisionId:'not-a-real-object'}` (ACCEPTED, s1 SKIPPED) → start+complete s2 → `CompleteExecutionPlan` → COMPLETED, with the mandatory s1 retired under a fabricated waiver.

ANTI-VACUITY NUANCE, stated precisely so the fix is scoped right: the BOOLEAN kernel is NOT an unkilled mutant — `execution-step-skip-cancel.test.ts:136` (mandatory:true, no waiver → REJECTED) and `:144` (mandatory omitted → REJECTED) both drive `hasAuthorizedWaiverOrRevision=false` and would go red if the branch were weakened. The defect is not a missing test over existing code; it is MISSING ENFORCEMENT — there is no resolution logic to test, and the sole positive test (`:151`) enshrines the fail-open by asserting ACCEPTED for an unrecorded id. Fix: resolve the id in the precheck (load object, require objectType DECISION with decisionType WAIVER or a plan-revision, require EFFECTIVE/unexpired, require it to scope to this plan/step), rejecting with RPH_VALIDATION_SEMANTIC_FAILED as `stepResultSubjects` does; then REWRITE `:151` to record a real waiver Decision, and add the fabricated-id rejection as the kill test.

</details>

**Live check needed.** None — settled empirically. The suite's own existing test already is the proof: `node ../../node_modules/vitest/vitest.mjs run src/handlers/execution-step-skip-cancel.test.ts -t "waiverOrRevisionId"` (from packages/rph-application) → 1 passed. That test skips a MANDATORY step with `waiverOrRevisionId: 'dec_waiver_1'`, an id recorded nowhere in the fixture, and it is ACCEPTED today.


## F-31 · [CONFIRMED] [MAJOR] No lens examined the RuntimeBinding axis: StartExecutionStep's payload is a strictObject with NO runtimeBindingId field, so the handler's binding branch is unreachable, the event can never record a binding, and the aiNoBinding advisory can never be silenced in production

- **Lens:** `completeness`
- **Site:** `packages/rph-contracts/src/messages.ts:254-256 (`StartExecutionStepPayloadSchema = z.strictObject({ stepId: z.string() })`) vs packages/rph-application/src/handlers/execution.ts:690 and :705 (the handler reads and spreads `p.runtimeBindingId`); event schema at messages.ts:1159; advisory at packages/rph-projections/src/execution-attempts.ts:164; the fiction test at packages/rph-projections/src/execution-attempts.test.ts:100`

**Claim.** The Map flagged `bindingPermitsExecution` (RPH-EXE-003) as DEAD IN PRODUCTION and no lens followed it up — the invariants lens took the sibling case (RPH-PWU-010) and stopped. The reality is worse than 'uncalled': the command CANNOT carry the datum. `StartExecutionStepPayloadSchema` is a `z.strictObject` containing only `stepId`, so a command carrying `runtimeBindingId` is rejected at the schema boundary before any handler runs. Therefore (i) `execution.ts:690`'s `runtimeBindingId?` read and `:705`'s conditional spread are unreachable dead code; (ii) `ExecutionStepStarted.runtimeBindingId` (messages.ts:1159, `.optional()`) has NO producer and can never be populated; (iii) `aiNoBinding = AI_STEP_TYPES.has(...) && a.runtimeBindingId === undefined` is therefore TRUE for every AI attempt the engine will ever emit — an advisory that is unconditionally on carries zero information; and (iv) execution-attempts.test.ts:100 ('is SILENT for an AI step that DID bind a runtime binding') proves that branch by hand-crafting an event shape no producer can emit, so it is a vacuous test of a production-unreachable path.

**Failure scenario.** EMPIRICALLY CONFIRMED (probes G4/H3, since deleted). Propose a one-step plan with `stepType: 'MODEL_INVOCATION'`, activate. Dispatch StartExecutionStep{stepId:'s1', runtimeBindingId:'rb_1'} -> VALIDATION_FAILED / RPH_VALIDATION_SCHEMA_FAILED (strictObject rejects the extra key). Dispatch StartExecutionStep{stepId:'s1'} -> ACCEPTED, and the emitted event payload is exactly `{"stepId":"plan-x-s1","stepState":"RUNNING"}`. So every MODEL_INVOCATION attempt in the attempt-history UI renders the AI-no-binding advisory forever, on every replay, regardless of how the plan was authorized — and ActivateExecutionPlan's `authorizedRuntimeBindingIds` list can never be connected to the attempt that used a binding. RPH-EXE-003 is not merely unenforced; the evidence it would need is structurally unrecordable.

**Suggested fix.** Decide the axis explicitly. Either add `runtimeBindingId: z.string().optional()` to StartExecutionStepPayloadSchema and wire `bindingPermitsExecution` (load the binding, require AUTHORIZED/PARTIALLY_AUTHORIZED, and require membership in the plan's `authorizedRuntimeBindingIds`) — which makes RPH-EXE-003 real and the advisory meaningful; or delete the dead handler branch, the unpopulatable event field, the advisory and its fiction test, and record the omission as a disclosed residual. Do not leave an always-true advisory in the UI.

<details><summary>Code-semantics verifier evidence</summary>

CONFIRMED — and the live run makes it SHARPER than the critic argued, while correcting one overstatement.

## 1. The schema/handler mismatch is real (verified by code + live dispatch)

`packages/rph-contracts/src/messages.ts:254-256`:
```
export const StartExecutionStepPayloadSchema = z.strictObject({
	stepId: z.string()
});
```
`packages/rph-application/src/handlers/execution.ts:690` reads a field that schema does not declare:
```
const p = command.payload as { stepId: string; runtimeBindingId?: string };
```
and `:705` spreads it: `...(p.runtimeBindingId ? { runtimeBindingId: p.runtimeBindingId } : {}),`

The schema IS enforced before the handler: `command-bus.ts:133` `validateAgainst(spec.payload, command.payload, ...)` → `:138` `return { ...base, status: 'VALIDATION_FAILED' }`, with the registry binding at `messages.ts:1757-1758` (`StartExecutionStep.payload = StartExecutionStepPayloadSchema`). RPH-CON-002 is the ratified rule (`rph-domain/vocab/m12-conformance.json:74`: "A canonical command payload with an undeclared property fails validation with RPH_VALIDATION_SCHEMA_FAILED").

**LIVE PROBE A output:** `PROBE A status= VALIDATION_FAILED code= RPH_VALIDATION_SCHEMA_FAILED`

So `execution.ts:690`'s read and `:705`'s conditional spread are **unreachable dead code**, and `ExecutionStepStarted.runtimeBindingId` (`messages.ts:1159`, `.optional()`) has **no producer**.

## 2. The advisory is unconditionally TRUE — and it CONTRADICTS the same page (the critic understated this)

The critic claimed the binding evidence is "structurally unrecordable". That part is **overstated**: `objects.ts:230-243` `ExecutionStepSchema` includes `runtimeBindingId: z.string().optional()` (`:237`), and `ProposeExecutionPlanPayloadSchema.steps` uses it (`messages.ts:132-135`). So a step object CAN carry a binding; `floor-gate.ts:74` reads `step.runtimeBindingId`, `execution-view.ts:200` projects it, and the UI renders it at `+page.svelte:293` (`rb {s.runtimeBindingId.slice(0,10)}…`).

That makes the defect **worse**, not milder. I proposed a `MODEL_INVOCATION` step WITH `runtimeBindingId: rb_…`, activated with `authorizedRuntimeBindingIds: [rb_…]`, and started it.

**LIVE PROBE B output:**
```
PROBE B start status= ACCEPTED
PROBE B emitted ExecutionStepStarted payload= {"stepId":"step_01ARZ3NDEKTSV4RRFFQ69G5T30","stepState":"RUNNING"}
PROBE B step.runtimeBindingId (object) = rb_01ARZ3NDEKTSV4RRFFQ69G5T60
PROBE B attempt.runtimeBindingId= undefined  aiNoBinding= true
```
The emitted event payload is byte-for-byte what the critic predicted. So `execution-attempts.ts:164`
```
aiNoBinding: AI_STEP_TYPES.has(stepTypeById[a.stepId] ?? '') && a.runtimeBindingId === undefined
```
is TRUE for **every** MODEL_INVOCATION/TOOL_INVOCATION attempt the engine can ever emit, on every replay. The demo page then renders, for the SAME step: the step row showing `rb rb_01ARZ3…` (`+page.svelte:293`) and the attempt row showing the AI-no-binding advisory (`+page.svelte:388`, `data-testid="attempt-ai-nobinding"`). A self-contradicting UI, provable today.

## 3. The anti-vacuity violation (CON-000 B7) — the core of why this belongs in this review

`packages/rph-projections/src/execution-attempts.test.ts:100-104` ("is SILENT for an AI step that DID bind a runtime binding") passes only because the helper at `:88-93` hand-crafts `ExecutionStepStarted` with a `runtimeBindingId` key **no producer in the system can emit**. Deleting the `&& a.runtimeBindingId === undefined` conjunct would go RED only in that fiction test; nothing in production distinguishes the two branches. This is precisely the "unkilled mutant / test proving a production-unreachable path" class the two already-fixed `requireFrom` defects belonged to — a third instance, in the same surface.

## 4. RPH-EXE-003 is dead, as claimed

`rph-domain/src/execution.ts:89` `bindingPermitsExecution` has exactly one caller — `:154`, inside `canStartStep` (`:151`) — and `canStartStep` has **no caller outside its own test file** (`execution.test.ts:96-114`). Grep over all `*.ts` returns only those sites. `authorizedRuntimeBindingIds` is recorded onto `ExecutionPlanActivated` (`handlers/execution.ts:407`) but never read by any guard; every test and the reference undertaking (`rph-engine/src/reference-undertaking.ts:563`) pass `[]`.

## Severity

MAJOR stands. It is not BLOCKER — the advisory gates nothing (`execution-attempts.ts:22` "ADVISORY (display-only)"), and DR-002:185 explicitly ruled "Do NOT add a startExecutionStep guard", so the *unenforced* RPH-EXE-003 is arguably a scoped omission. But three things are defects on their own terms and none is disclosed anywhere I could find: (a) unreachable handler code reading a field its own schema forbids, (b) a production UI advisory that is unconditionally on and directly contradicts adjacent displayed data for the same step, and (c) a vacuous test certifying a branch no producer can reach.

## Recommended fix (narrow, honest)

Cheapest coherent fix that keeps DR-002's "no new guard" ruling: make the advisory read the datum that actually exists. Pass the step-level binding into `executionAttempts` (the caller already holds the plan aggregate — it supplies `stepTypeById` the same way) and compute `aiNoBinding` from the step's `runtimeBindingId`, OR have `startExecutionStep` copy `step.runtimeBindingId` (the loaded step, not `command.payload`) onto the emitted event — the handler already has the step in `advanceStep`. Either kills the always-true advisory and makes `execution-attempts.test.ts:100` non-vacuous. Then delete the dead `p.runtimeBindingId` read at `execution.ts:690/705`, and record the still-unenforced `bindingPermitsExecution`/RPH-EXE-003 as a disclosed residual alongside its RPH-PWU-010 sibling.

</details>

**Live check needed.** None — I ran the live check myself (probe test, since deleted). Both probes reproduced against the real Engine + SqliteStorageAdapter.


## F-32 · [CONFIRMED] [MINOR] The '<=' comparator of numericCompare has zero coverage anywhere in the repo — a mutant rewriting it survives the whole suite

- **Lens:** `anti-vacuity`
- **Site:** `packages/rph-domain/src/condition-grammar.ts:93-94`

**Claim.** Grep-proven: the token `'<='` appears in exactly two places in the entire repository — the NumericComparatorSchema enum at condition-grammar.ts:16 and its own case label at :93. No test, no fixture, no authored plan, and no e2e uses it. condition-grammar.test.ts covers '>=', '>' and '==' via OUTPUT_COUNT (:64-68) and '>=' and '<' via ATTEMPTS (:69-72), leaving '<=' as the one comparator whose behaviour is entirely unasserted. This is a live flow-control operator on a BRANCH guard, not dead code: it is reachable from any authored conditionExpression and it decides which arm a plan takes.

**Failure scenario.** Mutate `case '<=': return actual <= expected` to `return actual < expected` (a one-character off-by-one, the classic edit) or to `return false` — the entire rph-domain, rph-application, rph-projections and e2e suite stays GREEN. A plan whose BRANCH arm is guarded by `{op:'ATTEMPTS', stepId:'s1', cmp:'<=', value:2}` then evaluates FALSE at exactly attemptsMade === 2, so the boundary attempt silently falls through to the SEQUENTIAL default instead of the retry arm, and the arm the author intended is marked NEUTRALIZED and offered for prune. Confirmed correct today by direct evaluation (2<=2 true, 2<=1 false) — the code is right, but nothing holds it right.

**Suggested fix.** Add the '<=' boundary pair (equal and just-below) to the ATTEMPTS or OUTPUT_COUNT case in condition-grammar.test.ts, so all five comparators of NumericComparatorSchema have at least one true and one false assertion.

<details><summary>Code-semantics verifier evidence</summary>

I tried hard to refute this and could not. Every load-bearing claim survived tracing.

1) RAW-BYTE CHECK FIRST (per the anti-false-positive rule). `sed -n '91,98p' packages/rph-domain/src/condition-grammar.ts | cat -v` renders clean — no control characters, no hidden delimiter:
```
		case '<':
			return actual < expected;
		case '<=':
			return actual <= expected;
		default:
			return assertNever(cmp);
```
And line 16 verbatim: `const NumericComparatorSchema = z.enum(['==', '>=', '>', '<', '<=']);`. So the code is real and, as the finding concedes, semantically CORRECT today.

2) THE GREP CLAIM IS EXACT. `grep -rn "'<='" packages apps --include=*.ts --include=*.tsx --include=*.svelte --include=*.json` (dist/node_modules excluded) returns exactly two hits — condition-grammar.ts:16 and :93. The double-quoted form `"<="` returns ZERO hits anywhere in packages/*/src, apps/rph-demo/src, apps/rph-demo/e2e (so no JSON fixture or authored-plan seed uses it either). Every `cmp:` occurrence in the entire repo is enumerable and none is `'<='`:
- condition-grammar.test.ts:31 `'<'`, :46 `'!='` (reject case), :65 `'>='`, :66 `'>'`, :67 `'=='`, :70 `'>='`, :71 `'<'`, :121 `'<'`
- execution-start-gate.test.ts:337/729/786/842 — all `'>'`
- execution-view.test.ts:478 `'>='`, :479 `'>'`
That is 4 of 5 comparators exercised; `'<='` has zero assertions.

3) NO GENERATIVE TEST RESCUES IT. `grep -rn "NumericComparator"` returns hits ONLY inside condition-grammar.ts (lines 16,17,24,25,40,46,83) — no test imports the enum, so no table-driven loop over `NumericComparatorSchema.options` exists. properties.test.ts uses fast-check but its arbitraries are `fc.constantFrom` over lifecycle states / assurance verdicts / id strings (lines 30, 38, 49, 69, 121, 165-168) — it never generates a ConditionExpression or a comparator. There is no Stryker/mutation-testing config in the repo root.

4) IT IS LIVE FLOW CONTROL, NOT DEAD CODE. `'<='` is admitted at propose time — rph-application/src/handlers/execution.ts:190 validates each edge with `ConditionExpressionSchema.safeParse(t.conditionExpression)`, and that schema embeds `NumericComparatorSchema` (condition-grammar.ts:40,46), which includes `'<='`. From there it reaches `numericCompare` through BOTH authorities: the engine gate at execution.ts:119-120 (`const parsed = ConditionExpressionSchema.safeParse(edge.conditionExpression); return parsed.success && evaluateCondition(parsed.data, subject);`) and the read-model at execution-view.ts:261-262 (identical closure in `conditionEvaluatorFor`).

5) THE STATED CONSEQUENCE CHAIN IS CORRECT, verified in transition-gate.ts. A guard returning false makes `selectBranchEdge` skip the arm (:117 `if (evaluateGuard?.(e, plan)) return e; // the first true conditional`), so selection falls through to the default; `inEdgeDisposition` then yields NEUTRALIZED (:229-231 and :234 `return evaluateGuard?.(edge, plan) === true ? 'SATISFIED' : 'NEUTRALIZED'`), and `prunableStepIds` (:323, over `liveStepIds`) offers the arm for prune. So an off-by-one at the `<=` boundary silently takes the wrong arm AND marks the intended arm prunable — exactly the failureScenario described.

6) MUTANT SURVIVAL IS TYPE-SAFE. Rewriting `case '<=': return actual <= expected` to `return actual < expected` (or `return false`) still type-checks — the `assertNever(cmp)` exhaustiveness guard at :96 only catches DELETION of the case label, not corruption of its return expression. So `tsc` will not catch it and no runtime assertion exercises it: the rph-domain, rph-application, rph-projections and e2e suites all stay GREEN.

SEVERITY holds at MINOR (not raised): this is a pure anti-vacuity/coverage gap under JPWB-CON-000 B7 — the behaviour is correct today, no user-visible defect exists now, and it can only bite via a future regressing edit or an author writing a `<=` guard. Note also that `describeCondition` (execution-view.ts:313-315) renders `c.cmp` verbatim, so a `<=` guard would display correctly — there is no second defect in the rendering path. The fix as proposed (a two-line equal/just-below boundary pair on ATTEMPTS or OUTPUT_COUNT) is sufficient and kills every mutation of the branch; worth noting while there that `'>='` (:65, :70) and `'<'` (:71) currently have TRUE-only assertions, so a `return true` mutant on those arms also survives — the same edit should add their false side.

</details>

<details><summary>Test-evidence verifier evidence</summary>

CONFIRMED by direct mutation experiment, not by code-reading alone.

1) NO existing test proves the behaviour. Exhaustive grep over packages/ and apps/ (excluding dist/node_modules):
   - token `<=` appears in only 4 places repo-wide: condition-grammar.ts:16 (the enum), :93 (case label), :94 (the body), plus two unrelated arithmetic uses (rph-application/src/handlers/floor-gate.ts:250 expiry check; apps/rph-demo .../pwa/[id]/+page.svelte:726 scroll math).
   - grep for `cmp:` finds every literal comparator ever constructed: condition-grammar.test.ts:31/46/65/66/67/70/71/121, execution-view.test.ts:478/479, execution-start-gate.test.ts:337/729/786/842. Comparators used: '>=', '>', '==', '<', and the invalid '!='. NEVER '<='.
   - No comparator is ever built dynamically: packages/rph-domain/src/properties.test.ts is the only fast-check file and its `fc.constantFrom` generators (lines 30/38/49/74/260/291) cover states/assurance only, never NumericComparator. No JSON fixture, seed, or e2e (apps/rph-demo/e2e/execution-flow.e2e.ts condEdge helper) carries a `<=` condition.

2) MUTATION EXPERIMENT (throwaway copy `packages/rph-domain/src_mutant/`, no source file modified; copy deleted afterwards, `git status` on packages/rph-domain shows no residue from me and condition-grammar.ts:83-98 is byte-identical to HEAD):
   - Mutant A, `case '<=': return actual < expected;`  -> `bunx vitest run src_mutant`: Test Files 11 passed, Tests 220 passed | 1 skipped. SURVIVES.
   - Mutant B, `case '<=': return false;`  -> 11 passed, 220 passed | 1 skipped. SURVIVES.
   - CONTROL (proves the harness is meaningful, not a broken runner): `case '>=': return actual > expected;` -> 1 file failed, 2 tests failed (condition-grammar.test.ts:65 and the ATTEMPTS block at :70-71). KILLED.
   So the branch at condition-grammar.ts:93-94 is genuinely never executed by any test, and every mutation of it is an unkilled mutant. Post-cleanup control run: `bunx vitest run --root packages/rph-domain` -> 13 files passed, 227 passed | 1 skipped, source intact.

3) The finding's correctness claim also holds: a temporary probe (deleted) asserting `ATTEMPTS s1 <= 2` with attemptsMade=2 -> true, `<= 1` -> false, `OUTPUT_COUNT <= 2` with 2 outputs -> true, passed against the unmodified source. So the code is RIGHT today but nothing holds it right — exactly the anti-vacuity (JPWB-CON-000 B7) shape.

Severity MINOR is correct and should not be raised: no shipped behaviour is wrong, no plan can currently deadlock from this, and no authored plan uses '<='. It is a latent-regression / unkilled-mutant gap on a live BRANCH-guard operator reachable from any authored conditionExpression.

SCOPE CORRECTION worth folding into the fix (found while running the control): '<=' is not the only under-killed comparator. `case '==':` at condition-grammar.ts:85-86 has exactly one assertion (condition-grammar.test.ts:67, `OUTPUT_COUNT s3 == 0` over an empty array, i.e. 0==0 -> true). Mutating it to `return actual <= expected` also SURVIVES the full domain suite (11 files / 220 tests green, measured). Likewise '<' at :71 has only a TRUE assertion (2 < 3), so '<' -> '<=' survives. The remediation should therefore add a true/false boundary PAIR for '<=', '==' and '<' — not just '<=' — so all five members of NumericComparatorSchema have both polarities asserted at the boundary.

</details>

**Live check needed.** None — settled empirically. Reproduce with: cp -r packages/rph-domain/src packages/rph-domain/src_mutant; sed -i "94s/actual <= expected/actual < expected/" packages/rph-domain/src_mutant/condition-grammar.ts; (cd packages/rph-domain && bunx vitest run src_mutant) -> green (mutant survives); then the same edit on line 88 ('>=') -> 2 failures (control kills). Delete src_mutant afterwards.


## F-33 · [CONFIRMED] [MINOR] An edge tagged transitionType CONDITIONAL with no conditionExpression is accepted at propose and is a permanently dead BRANCH arm

- **Lens:** `branch`
- **Site:** `packages/rph-application/src/handlers/execution.ts:189 (rejectMalformedTransitionCondition skips undefined) with packages/rph-domain/src/transition-gate.ts:88-89 (isConditionalEdge) and packages/rph-application/src/handlers/execution.ts:119-120 (guardEvaluatorFor)`

**Claim.** `rejectMalformedTransitionCondition` opens with `if (t.conditionExpression === undefined) continue` (execution.ts:189), so an edge carrying `transitionType:'CONDITIONAL'` and no expression is never validated. `isConditionalEdge` is an OR (transition-gate.ts:88-89) so that edge IS conditional for selection purposes; `checkBranchDefaults`'s `isDefaultEdge` (:523-524) correspondingly does NOT count it as the default, so it satisfies the exactly-one-default rule while contributing nothing. At runtime `guardEvaluatorFor` does `ConditionExpressionSchema.safeParse(undefined)` → failure → `false` (execution.ts:119-120), so `selectBranchEdge` (:117) can never take it. The arm is authored, validated, rendered, and unreachable — with no diagnostic anywhere.

**Failure scenario.** Plan: s1 BRANCH; edge A = {id:'tA', s1→s2, transitionType:'CONDITIONAL'} with conditionExpression omitted (ExecutionTransitionSchema makes it optional, rph-contracts/src/objects.ts:248); edge B = {id:'tB', s1→s3, SEQUENTIAL} last. ProposeExecutionPlan → ACCEPTED: validateTransitionGraph sees exactly one default, last; rejectMalformedTransitionCondition skips edge A entirely. Start+Complete s1 → resolveBranchSelection evaluates edge A's guard as false and records tB. s2 is then pruned as unreachable on every single run — the author's guarded arm can never be taken, and the only signal is silence.

**Suggested fix.** In rejectMalformedTransitionCondition, reject an edge whose `transitionType === 'CONDITIONAL'` but whose `conditionExpression` is undefined (a guarded arm with no guard), before the `continue`. This mirrors the existing half-edge rule — a shape the two planes read differently should be refused at propose rather than silently neutralized at runtime.

<details><summary>Code-semantics verifier evidence</summary>

Every limb of the claim holds, and I settled it EMPIRICALLY (temporary vitest probe against the real Engine + SqliteStorageAdapter, since removed).

1. CONTRACT permits the shape. `packages/rph-contracts/src/objects.ts` ExecutionTransitionSchema: `conditionExpression: z.unknown().optional(), transitionType: TransitionTypeSchema` — no refinement pairing them. TransitionType = ["SEQUENTIAL","CONDITIONAL"] (canonical-vocabulary.json:759).

2. PROPOSE never validates it. `packages/rph-application/src/handlers/execution.ts:188-189`:
   `for (const t of p.transitions ?? []) { if (t.conditionExpression === undefined) continue;`
   — the edge is skipped entirely by rejectMalformedTransitionCondition. No other propose limb looks at the pairing: rejectMalformedTransitionGraph → validateTransitionGraph, whose only relevant limb is checkBranchDefaults (transition-gate.ts:519-548), where `isDefaultEdge = e.conditionExpression === undefined && e.transitionType !== 'CONDITIONAL'` (:523-524) returns FALSE for this edge, so it is counted as a guarded arm and the SEQUENTIAL edge remains the sole, last default → `{ok:true}`. Reachability (:493-508) is raw edge-connectivity, so the target passes too.

3. RUNTIME can never take it. `isConditionalEdge = e.conditionExpression !== undefined || e.transitionType === 'CONDITIONAL'` (transition-gate.ts:88-89) → TRUE. `guardEvaluatorFor` (execution.ts:113-121) builds an evaluator because `hasGuard` is true, then `ConditionExpressionSchema.safeParse(edge.conditionExpression)` with `conditionExpression === undefined` — the schema is `z.lazy(() => z.discriminatedUnion('op', [...]))` (condition-grammar.ts:33-59), which rejects `undefined` → evaluator returns false. `selectBranchEdge` (:115-118) therefore always falls through to the SEQUENTIAL default; `resolveBranchSelection` (:191-194) records the default's id.

4. EMPIRICAL RUN (steps s1 BRANCH / s2 / s3; edges [t1-2 = {s1→s2, transitionType:'CONDITIONAL', conditionExpression OMITTED}, t1-3 = {s1→s3, SEQUENTIAL}]):
   PROPOSE: ACCEPTED
   START s1: ACCEPTED · COMPLETE s1: ACCEPTED
   selectedTransitionId: plan_…-t1-3  (the default, deterministically, on every run)
   START s2: REJECTED — "every in-edge is neutralized — the step is unreachable (it should be pruned) (RPH-EXE-005)"
   PRUNE s2: ACCEPTED → SKIPPED
   So the authored guarded arm is unreachable on 100% of runs and its subtree prunes away.

5. NO diagnostic anywhere. The transitions read-model (`packages/rph-projections/src/execution-view.ts:355-358`) sets `role: edge.transitionType ?? …` → renders "CONDITIONAL", and emits `conditionText` only when `conditionExpression !== undefined` → the UI shows a guarded arm with no guard text and no warning. No test in the repo covers this shape: every `transitionType: 'CONDITIONAL'` occurrence (transition-gate.test.ts:119/178/304/313/326, execution-view.test.ts:444/462/553, execution-start-gate.test.ts:120, e2e/execution-flow.e2e.ts:65) pairs it with a conditionExpression.

The asymmetry is exactly the one the codebase already legislates against for half-edges (transition-gate.ts:464-471, "reject it rather than let the two planes disagree"): checkBranchDefaults counts this edge as a guarded arm, while the runtime treats it as permanently false. Severity MINOR is correct — the plan still reaches a terminal-success set (no deadlock, no invariant break); the damage is silent loss of an authored arm plus a validation gap that the sibling half-edge rule shows is meant to be closed at propose.

</details>

<details><summary>Test-evidence verifier evidence</summary>

RUNTIME OBSERVATION (temporary probe, since deleted; no source file touched). I wrote `packages/rph-application/src/handlers/zzz-testevid-condnoexpr.probe.test.ts` modelled on the existing `proposeBranch` fixture (execution-start-gate.test.ts:303-318), with edge A = {id:'…-t1-2', s1→s2, transitionType:'CONDITIONAL', conditionExpression OMITTED} and edge B = {id:'…-t1-3', s1→s3, SEQUENTIAL} last, s1 stepType BRANCH. Ran `bunx vitest run … --disable-console-intercept` in packages/rph-application. Verbatim output:

  PROPOSE STATUS = ACCEPTED ERR = undefined
  START1 = ACCEPTED
  COMPLETE1 = {"commandId":"c-13","status":"ACCEPTED","producedEventIds":["e14"]}
  RECORDED selectedTransitionId = plan_…K20-t1-3
  START2 (guarded arm) = REJECTED "Cannot start step …-s2: every in-edge is neutralized — the step is unreachable (it should be pruned) (RPH-EXE-005)."
  START3 (default arm) = ACCEPTED undefined
  states: SUCCEEDED QUEUED RUNNING
  CONTROL recorded = plan_…K20-t1-2      <- same plan shape with a real guard {op:'STEP_SUCCEEDED'} DOES select the arm
  CONTROL START2 = ACCEPTED

So every limb of the claim reproduces: propose ACCEPTS with `error === undefined` (no diagnostic at all), the BRANCH resolves to the default t1-3 even with s1 SUCCEEDED (the maximally-satisfying state), and the authored arm s2 is refused as "unreachable". Because `guardEvaluatorFor` does `ConditionExpressionSchema.safeParse(edge.conditionExpression)` on `undefined` (execution.ts:119-120), the guard is `false` for EVERY subject on EVERY run — the arm is not merely false-this-time, it is unconditionally dead. The control case proves the fixture is otherwise sound.

COVERAGE GAP (no existing test proves it works). All 45 tracked test files under packages/rph-application/src/handlers were grepped for CONDITIONAL; every CONDITIONAL-edge fixture in the tracked suite supplies a conditionExpression by construction — execution-start-gate.test.ts:114-122 (`cedge(from,to,condition)` takes the expression as a required arg), transition-gate.test.ts:178 (`cond(result)` always emits one), execution-view.test.ts:444/462. The propose-rejection battery at execution-start-gate.test.ts:343-373 covers exactly four shapes — malformed grammar (:343), dangling stepId ref (:349), CONDITIONAL out-edge from a non-BRANCH step (:359), default-not-LAST (:369) — and NOT the guardless-CONDITIONAL shape. Nothing anywhere in the repo exercises `transitionType:'CONDITIONAL'` with the expression omitted, so no test refutes the finding and none would go red if the (absent) guard were added.

DESIGN-DOC CORROBORATION, which the branch lens did not cite and which strengthens it: JAN-EXECPLAN-DS-004 §6 D2 states the pairing is BICONDITIONAL — "`CONDITIONAL` iff the edge carries a `conditionExpression`, else `SEQUENTIAL`." The accepted shape therefore violates the authored D2 invariant, and the two code planes read that violation in opposite directions (`isConditionalEdge` is an OR at transition-gate.ts:88-89, so the edge IS conditional for selection; `isDefaultEdge` is the AND-negation at :523-524, so it is NOT the default for validation) — precisely the propose/runtime-drift class DWP-07 was built to close (the "not BRANCH" rule at :528). The one residual signal an author gets actively misdirects: the start rejection says the arm "should be pruned", pointing them at deleting the arm they meant to guard rather than at the missing expression.

Severity MINOR is right: it requires an authoring mistake, corrupts no state, and the plan still terminates via the default arm — but the arm is silently unwinnable and the only feedback misattributes the cause.

Cleanup verified: `git status --short packages/rph-application/src/handlers/` shows my probe file gone; no source file was modified.

</details>

**Live check needed.** None — settled by direct execution. To re-derive: add to execution-start-gate.test.ts alongside the :343-373 battery a case proposing a BRANCH with an out-edge carrying transitionType 'CONDITIONAL' and no conditionExpression plus a SEQUENTIAL default last, and assert REJECTED. It is ACCEPTED today (observed). Fix per DS-004 D2: in rejectMalformedTransitionCondition (execution.ts:183-210), before the `if (t.conditionExpression === undefined) continue` at :189, reject an edge whose transitionType === 'CONDITIONAL' with no expression.


## F-34 · [CONFIRMED] [MINOR] liveStepIds is recomputed inside every in-edge evaluation, so the barrier check is cubic in fan-out width — 244 ms of pure CPU per start-gate call at width 200, against the module's own O(V+E) claim

- **Lens:** `parallel-join`
- **Site:** `packages/rph-domain/src/transition-gate.ts:217 (liveStepIds called per edge inside inEdgeDisposition), reached from :265-273 barrierState and :307 startableStepIds`

**Claim.** The module header at :132-134 claims 'Forward BFS from the entries ... so this is O(V+E) — the previous nested fixpoint was cubic and re-ran the guard evaluator per edge per pass.' But `inEdgeDisposition` :217 calls `liveStepIds(plan, evaluateGuard)` on EVERY edge evaluation, with no memoisation. `barrierState` calls it per in-edge, `stepAtFrontier` per step, so a width-W fan-out/join costs O(W) BFS passes per barrier check and O(W²)-O(W³) per `startableStepIds`. Each BFS also re-runs `branchExcludes` per edge, which for a BRANCH source re-invokes the guard evaluator (a `ConditionExpressionSchema.safeParse` per call in both the engine, handlers/execution.ts:118-121, and the read-model). The cubic behaviour the fixpoint removal was meant to fix is back, just relocated. `prunableStepIds` :325 gets this right — it calls liveStepIds ONCE.

**Failure scenario.** MEASURED. Pure-domain plan: one PARALLEL_GROUP entry fanning out to W arms all SUCCEEDED, all rejoining at one QUEUED join. Timings for `startStepGate(plan,'join')` / `startableStepIds(plan)`: W=10 → 1 ms / 1 ms; W=50 → 13 ms / 10 ms; W=100 → 87 ms / 75 ms; W=200 → 244 ms / 225 ms. Growth is clearly super-linear. In production `startStepGate` runs inside startExecutionStep's precheck (handlers/execution.ts:723) — so every Start on a wide join burns a quarter-second of CPU inside the command handler — and `startableStepIds` runs per plan on every undertaking page render (apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts:155). With a guarded edge present each of those BFS passes additionally re-parses the condition expression.

**Suggested fix.** Hoist the liveness computation: compute `liveStepIds` once per public entry point (`startableStepIds`, `startStepGate`, `prunableStepIds`) and thread the resulting Set into `inEdgeDisposition`/`barrierState`/`stepAtFrontier` as a parameter, keeping the current single-argument `inEdgeDisposition` signature as a thin wrapper for the projection layer. Also memoise the parsed condition expression per edge inside `guardEvaluatorFor` / `conditionEvaluatorFor`.

<details><summary>Code-semantics verifier evidence</summary>

Every cited line checked in the real code, and the measurement independently reproduced. Nothing refutes it; the real code is in fact WORSE than the finding states.

1) The un-memoised call is real, at the exact cited site. `packages/rph-domain/src/transition-gate.ts:217`, inside `inEdgeDisposition`:
	`if (!liveStepIds(plan, evaluateGuard).has(source.id)) return 'NEUTRALIZED';`
There is no cache, no parameter threading, no module-level memo — `liveStepIds` (:135) is a private function invoked fresh on each edge.

2) The nesting is real. `barrierState` :265-266 loops `for (const e of inEdges) { const d = inEdgeDisposition(plan, e, evaluateGuard); ... }`; `stepAtFrontier` :286 calls `barrierState` per step; `startableStepIds` :307 is `plan.steps.filter((s) => stepAtFrontier(plan, s, evaluateGuard))`; `startStepGate` :386 calls `barrierState`. So a W-wide join costs W full BFS passes per barrier check.

3) The contradicted claim is verbatim and byte-clean. `transition-gate.ts:132-133` (checked with `sed -n '132,134p' | cat -v` — only UTF-8 em-dashes, no control chars):
	`Forward BFS from the entries (the graph is a validated DAG), so this is O(V+E) — the previous nested fixpoint was cubic and re-ran the guard evaluator per edge per pass.`

4) The contrast case is real: `prunableStepIds` :325 hoists it — `const live = liveStepIds(plan, evaluateGuard);` once, then a single `plan.steps.filter`.

5) MEASURED (reproduced independently, temp vitest bench in packages/rph-domain/src, since deleted; plan = one entry fanning to W SUCCEEDED arms rejoining at one QUEUED `join`, no guards so no evaluator cost at all):
   W=10  → startStepGate 0.3 ms / startableStepIds 0.2 ms / prunableStepIds 0.0 ms / per-edge disposition (transitionRows shape) 0.3 ms
   W=50  → 9.6 / 6.3 / 0.1 / 11.2 ms
   W=100 → 39.9 / 38.5 / 0.4 / 76.2 ms
   W=200 → 226.6 / 228.6 / 1.1 / 495.2 ms
   W=400 → 1750.3 / 1746.1 / 4.2 / 3573.6 ms
Doubling W multiplies cost ~8x (200→400), i.e. cubic — matching the finding's claimed 244 ms/225 ms at W=200 to within noise. The 200x gap between `startStepGate` (226 ms) and `prunableStepIds` (1.1 ms) on the IDENTICAL plan isolates the cause to the un-hoisted `liveStepIds` exactly as claimed, since those two differ in nothing else.

6) Production reach confirmed, and one site the finding missed:
   - `packages/rph-application/src/handlers/execution.ts:723` — `startStepGate(gatePlan, p.stepId, guardEvaluatorFor(...))` inside `startExecutionStep`'s `precheck`, so the cost is inside the command handler.
   - `apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts:155,157` — `startableStepIds(pl, evalGuard)` then `prunableStepIds(pl, evalGuard)` per plan per page load.
   - ADDITIONAL (not in the finding): `+page.server.ts:159` → `transitionRows(pl, evalGuard)`, which at `packages/rph-projections/src/execution-view.ts:359` calls `inEdgeDisposition(plan, edge, evaluateGuard)` for EVERY edge (2W of them), not just the join's in-edges. That is the 495 ms column above — the page render pays roughly 3x the barrier cost, so the render total at W=200 is ~0.7 s of pure CPU.

7) The re-parse sub-claim is real: `handlers/execution.ts:119` `const parsed = ConditionExpressionSchema.safeParse(edge.conditionExpression);` inside the returned closure, and the identical body at `execution-view.ts:261`. `branchExcludes` :171-174 invokes that evaluator per edge per BFS pass, so a guarded plan adds a Zod parse to every one of those O(W²) edge visits. (The bench above used NO guards, so the measured numbers are a floor, not a ceiling.)

8) The finding UNDERSTATES the single-pass cost, which strengthens it. `liveStepIds` is not O(V+E) even once: :139 `plan.steps.filter((s) => inEdgesOf(plan, s.id).length === 0)` runs `inEdgesOf` (a full `plan.transitions.filter`, :77) per step → O(V·E); :144 `outEdgesOf(plan, id)` is another full scan per node; and `branchExcludes` :170 calls `outEdgesOf` again per edge → O(E²). So one "O(V+E)" pass is really O(V·E + E²), and the nesting makes the gate ~O(E³). That is why growth is cubic rather than the quadratic the finding's own reasoning would predict.

9) No earlier guard bounds W. `ProposeExecutionPlanPayloadSchema` (`packages/rph-contracts/src/messages.ts:132-141`) declares `steps: z.array(ExecutionStepSchema)` and `transitions: z.array(ExecutionTransitionSchema)` with NO `.max()`, and `validateTransitionGraph` (transition-gate.ts:566) enforces only dangling-ids / one-entry / reachability / acyclicity / BRANCH-default — no size cap. So nothing refuses a wide plan before it reaches the gate.

Correctness is unaffected — results are right, just recomputed — so MINOR is the correct severity, as the finding states. The suggested fix (thread a hoisted `live` Set into `inEdgeDisposition`/`barrierState`/`stepAtFrontier`, keeping the current signature as a wrapper for `execution-view.ts:359`, plus memoising the parsed expression per edge in `guardEvaluatorFor`/`conditionEvaluatorFor`) is the right shape and mirrors what `prunableStepIds` already does.

</details>

<details><summary>Test-evidence verifier evidence</summary>

CONFIRMED from the test/behaviour side, independently of the code-reading argument.

COVERAGE GAP IS TOTAL. grep for `performance|perf|bench|hrtime|O(V+E)` across packages/rph-domain/src and packages/rph-application/src *.test.ts returns ZERO perf/complexity tests. grep for `toHaveBeenCalledTimes|callCount|calls.length` in packages/rph-domain/src/transition-gate.test.ts and packages/rph-projections/src/*.test.ts returns ZERO — nothing constrains how many times the guard evaluator or liveStepIds is invoked. Hoisting liveStepIds would turn no existing test red. The "so this is O(V+E)" claim at transition-gate.ts:132-134 is an UNVERIFIED COMMENT — no test backs it.

INDEPENDENTLY REPRODUCED. I wrote a temporary probe (packages/rph-domain/src/zz-testevidence-fanout-bench.test.ts, run via `node ../../node_modules/vitest/vitest.mjs run <file> --disable-console-intercept`, SINCE DELETED — `git status --porcelain` on rph-domain/rph-projections/rph-application is clean, no source modified). Plan: one PARALLEL_GROUP entry -> W arms all SUCCEEDED -> one QUEUED join.
  W=10:  gate=0.2ms  startable=0.4ms  prunable=0.1ms  transitionRows-equiv=0.1ms
  W=50:  gate=9.6ms  startable=9.5ms  prunable=0.2ms  transitionRows-equiv=8.1ms
  W=100: gate=39ms   startable=31ms   prunable=0.3ms  transitionRows-equiv=64ms
  W=200: gate=233ms  startable=237ms  prunable=1.1ms  transitionRows-equiv=465ms
  W=400: gate=1977ms startable=1962ms prunable=5.0ms
Doubling 200->400 costs ~8.5x — clearly super-linear, not O(V+E). My numbers land within noise of the originating lens's (234/230 vs its claimed 244/225 at W=200): two independent measurements agree.

THE INTERNAL CONTROL SETTLES IT. prunableStepIds is 1.1ms on the BYTE-IDENTICAL plan where startStepGate is 233ms — a 200x gap on the same input computing the same liveness over the same graph. The only difference is transition-gate.ts:325 calls liveStepIds ONCE while :217 calls it PER IN-EDGE. This is a same-input A/B, not an inference from reading code.

GUARD-EVALUATOR RE-RUN DIRECTLY OBSERVED. With a SINGLE CONDITIONAL in-edge, one startStepGate call invoked my instrumented evaluator W+1 times (11 / 26 / 51 / 101 / 201), scaling linearly with fan-out width. Each invocation re-runs ConditionExpressionSchema.safeParse (handlers/execution.ts:118-121; execution-view.ts:260-263). The header's boast that "the previous nested fixpoint ... re-ran the guard evaluator per edge per pass" describes exactly what the code STILL does, relocated one layer up.

PRODUCTION REACHABILITY VERIFIED, NOT ASSUMED. (a) packages/rph-application/src/handlers/execution.ts:723 — startStepGate inside startExecutionStep's precheck, so a Start on a wide join burns a quarter-second of synchronous CPU inside the command handler. (b) apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts:155/157/159 — buildExecutionReadModels runs startableStepIds AND prunableStepIds AND transitionRows per plan per render: ~700ms per plan at W=200, WORSE than reported (the lens missed transitionRows at execution-view.ts:359, a second per-edge inEdgeDisposition site). (c) No cap bounds W: grep for `.max(` in packages/rph-contracts/src returns nothing; `steps: z.array(ExecutionStepSchema)` (objects.ts:616, messages.ts:135) and transitions are unbounded.

PROPOSED FIX IS OBSERVATIONALLY SAFE. guardEvaluatorFor (handlers/execution.ts:108-122) and conditionEvaluatorFor (execution-view.ts:255-264) are pure closures over a pre-folded `subject` with no mutable state, and `plan` is not mutated during a gate call — so liveStepIds(plan, evaluateGuard) is referentially transparent within one entry-point call. Hoisting it cannot change any verdict.

SEVERITY CORRECTED TO MINOR (agrees with the lens). This is a throughput/complexity defect plus a FALSE complexity claim in the header comment. It violates no correctness invariant on this surface — no wrong start, no deadlock, no resurrection of a dead arm, no INV-5 or RPH-EXE-002 breach. The prunableStepIds control shows the correct answer is still computed, just expensively. Real-world impact depends on fan-out width, and no seeded/demo plan approaches W=200; the risk is that nothing bounds it.

NOT REPORTED SEPARATELY (same root cause): transitionRows at packages/rph-projections/src/execution-view.ts:359 is a second per-edge inEdgeDisposition site on the same render; and liveStepIds itself is O(V*E) rather than the claimed O(V+E) because inEdgesOf/outEdgesOf (transition-gate.ts:76-85) are O(E) array filters called per node.

</details>

**Live check needed.** None — settled live. I built and ran a temporary probe under vitest in packages/rph-domain (timings and evaluator call counts above), verified all four production call sites by reading them (handlers/execution.ts:723, +page.server.ts:155/157/159, execution-view.ts:359), confirmed the absence of any perf or call-count test by grep, and confirmed the absence of any step/transition count cap in rph-contracts. Probe file deleted; `git status --porcelain` on the three packages is clean, so no source file was modified. The only thing NOT settled is whether any deployed plan actually reaches a fan-out width where this matters — that is a data question about production plan shapes, not a code question, and it bears only on priority, not on whether the defect holds.


## F-35 · [CONFIRMED] [MINOR] The '<=' comparator has zero test coverage — an unkilled mutant in the grammar's only numeric primitive (CON-000 B7)

- **Lens:** `grammar`
- **Site:** `packages/rph-domain/src/condition-grammar.ts:93-94`

**Claim.** numericCompare implements five comparators (condition-grammar.ts:83-98). condition-grammar.test.ts exercises only '>=', '>' and '==' via OUTPUT_COUNT (:64-68) and '>=', '<' via ATTEMPTS (:69-72). '<=' appears in exactly two places in the whole repo — the enum at condition-grammar.ts:16 and its own case label at :93 — with no test, no fixture, and no authored plan using it (grep confirms). Every guard on this surface routes through numericCompare, so a defect here silently mis-resolves OUTPUT_COUNT and ATTEMPTS guards and, through resolveBranchSelection, silently picks a different BRANCH arm. This is the exact anti-vacuity shape the two already-fixed requireFrom findings had: correct code with no test that goes red when it is broken.

**Failure scenario.** Rewrite `case '<=': return actual <= expected;` as `return actual < expected;` (an off-by-one a hand-edit easily produces). The entire vitest suite stays GREEN. In production, a retry-budget arm authored as {op:'ATTEMPTS', stepId:'s1', cmp:'<=', value:2} against a step with attemptsMade===2 flips from true to false at the boundary, so the BRANCH takes the SEQUENTIAL default (e.g. the escalate arm) instead of the retry arm — and because the branch resolution is recorded by DWP-09, the wrong arm is permanent. Mutating it to `return false` outright is equally undetected.

**Suggested fix.** Add the two boundary assertions above (equal-value and one-below) so both the comparator and its off-by-one edge are pinned; the '<' and '>' cases would benefit from the same equal-value boundary case, which the current '>' test at :66 does happen to cover.

<details><summary>Code-semantics verifier evidence</summary>

I tried hard to refute this and could not. Every load-bearing claim checks out against the real code.

1) The comparator exists and is a live, distinct branch. Raw bytes (`sed -n '83,98p' packages/rph-domain/src/condition-grammar.ts | cat -v` — no hidden control characters, the file is clean ASCII):
```
function numericCompare(actual: number, cmp: NumericComparator, expected: number): boolean {
	switch (cmp) {
		case '==':  return actual === expected;
		case '>=':  return actual >= expected;
		case '>':   return actual > expected;
		case '<':   return actual < expected;
		case '<=':  return actual <= expected;
		default:    return assertNever(cmp);
	}
}
```
(condition-grammar.ts:83-98, reformatted for compactness; the real file puts each `return` on its own line.)

2) Zero coverage, repo-wide — not just in the cited test file. `grep -rn "'<='"` and `grep -rn '"<="'` over the whole repo excluding node_modules returns exactly two source hits: `condition-grammar.ts:16` (`z.enum(['==', '>=', '>', '<', '<='])`) and `condition-grammar.ts:93` (the case label). The only other hit anywhere is the generated `packages/rph-domain/dist/condition-grammar.d.ts:8`. I then widened the search to *every* file type (`grep -rn "cmp" -l . --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git --exclude-dir=docs`) to catch fixtures/seeds: the only non-build files are `execution-start-gate.test.ts` (`cmp:'>'` ×4), `zz-verify-selfref.test.ts` (`cmp:'=='`), `zz-probe-vacuous-all.test.ts` (`cmp:'>='`), `condition-grammar.test.ts`, and `execution-view.ts/.test.ts` (`describeCondition` merely interpolates `c.cmp` into a string, never compares). None supplies `'<='`.

3) The "some generative test covers it" refutation fails. `packages/rph-domain/src/properties.test.ts` is the only fast-check file; its imports (lines 6-22) are the M12 assurance kernels (`satisfiesP1`, `validateObligationConservation`, `TraceGraph`, …) — it never imports `evaluateCondition` or `NumericComparatorSchema`, and no arbitrary generates a comparator. `numericCompare` is module-private and reachable ONLY from `evaluateCondition`'s `OUTPUT_COUNT`/`ATTEMPTS` cases (lines 124/126) via `expr.cmp`, and every `cmp` value in the repo is a hard-coded literal. So `case '<='` is provably unexecutable by the current suite — the mutant `return actual < expected;` (or `return false;`) cannot turn any test red.

4) The path is genuinely live in production, not dead code. `'<='` is a member of `NumericComparatorSchema` (line 16), so propose-time validation ACCEPTS it: `rejectMalformedTransitionCondition` (rph-application/src/handlers/execution.ts:190) only rejects on `!parsed.success`, and a `'<='` expression parses. It then flows to the guard evaluator at execution.ts:118-121 (`parsed.success && evaluateCondition(parsed.data, subject)`) and to the read-model at rph-projections/src/execution-view.ts:261-262. So any author can ship a `'<='` guard today and it will be interpreted by untested code.

5) The downstream consequence in the failureScenario is real. transition-gate.ts:93-95 documents first-match: "…guard is true, else the first unconditional (SEQUENTIAL default) — so exactly ONE arm is ever selected", and propose validation forces a SEQUENTIAL default as the LAST out-edge (transition-gate.ts:535-546). A boundary flip on `'<='` therefore silently falls through to the default arm rather than erroring, and DWP-09 records the selection as a point-in-time fact — the wrong arm is permanent.

Partial mitigation (why MINOR, not MAJOR, is right): one mutant form IS caught statically. Deleting `case '<='` entirely narrows `cmp` in the `default` branch to `'<='`, so `assertNever(cmp)` (line 96, `function assertNever(x: never)` at line 79) fails `tsc`. The gate's type check kills deletion. It does NOT kill the two mutants the finding actually names — rewriting the body to `actual < expected` or `return false` both typecheck cleanly and both survive the suite. Combined with the fact that no authored plan currently uses `'<='` (blast radius is latent, not active), MINOR is the correct severity — this is a genuine CON-000 B7 anti-vacuity gap on an authorable public contract surface, of exactly the shape as the two already-fixed `requireFrom` findings, but with a smaller live footprint.

Note beyond the finding: the `'<'` case has the same weakness in the other direction — its only assertion (condition-grammar.test.ts:71, `attemptsMade 2 < 3 → true`) is not a boundary, so mutating `case '<'` to `actual <= expected` also stays green. The suggested fix's parenthetical about adding equal-value boundary cases to `'<'` is warranted; the `'>'` case at :66 (`outputs 2 > 2 → false`) does already pin its boundary, as the finding states.

</details>

<details><summary>Test-evidence verifier evidence</summary>

SETTLED EMPIRICALLY BY MUTANT-SURVIVAL EXPERIMENT — the mutant survives the entire authored suite.

1) Coverage gap is total (grep, whole repo, excluding dist/):
   - `'<='` occurs in exactly TWO places: the enum at packages/rph-domain/src/condition-grammar.ts:16 and its own case label at :93. No test, no fixture, no authored/seeded plan.
   - Every other `cmp:` site in the repo uses only '>=', '>' or '<': condition-grammar.test.ts:31,46,65,66,67,70,71,121; execution-view.test.ts:478,479; execution-start-gate.test.ts:337,729,786,842; zz-probe-vacuous-all.test.ts:190. So NO suite anywhere — domain, application, projections, or e2e — can execute condition-grammar.ts:94.

2) Mutant-survival run (no source file modified; probe copies only, since deleted):
   Copied condition-grammar.ts -> src/zzprobe-mut-grammar.ts with the exact mutant the finding proposes (`case '<=': return actual < expected;`), and copied condition-grammar.test.ts -> src/zzprobe-mut.test.ts re-pointed at the mutated module. Result of `bunx vitest run src/zzprobe-mut.test.ts` in packages/rph-domain:
     Test Files  1 passed (1)
     Tests  15 passed (15)
   The module's OWN complete authored suite is 15/15 GREEN with '<=' broken. Combined with (1), no other suite touches the operator, so the mutant is unkilled repo-wide. This is exactly the anti-vacuity (CON-000 B7) shape of the two already-fixed `requireFrom` findings.

3) The code is CORRECT today (so this is a pure test-evidence gap, not a live wrong-answer bug). A probe against the REAL module (src/zzprobe-real.test.ts, since deleted) passed 2/2:
     evaluateCondition({op:'ATTEMPTS', stepId:'s2', cmp:'<=', value:4}, {s2: attemptsMade 4}) === true   (boundary)
     ... value:3 === false ; ... value:5 === true

4) The operator is LIVE-PATH REACHABLE, not dead: `conditionExpression` arrives as opaque jsonb on the ProposeExecutionPlan payload (packages/rph-application/src/handlers/execution.ts:88, :139) and is validated by ConditionExpressionSchema, which accepts cmp '<=' (probe assertion 2 above: safeParse success === true). It is then evaluated at execution.ts:119-120 through evaluateCondition -> numericCompare, and feeds BRANCH first-match selection whose outcome DWP-09 records as a point-in-time fact. So an authored retry-budget arm `{op:'ATTEMPTS', cmp:'<=', value:N}` at the boundary would take the wrong arm PERMANENTLY under the mutant, with the suite green.

5) No mitigating coverage elsewhere: describeCondition (packages/rph-projections/src/execution-view.ts:300-303) only string-interpolates `cmp` and never re-implements the comparison, so its tests (execution-view.test.ts:472-496) cannot pin numericCompare either.

Severity stands at MINOR (the finding's own rating): correct code, no current in-repo caller of '<=', but a guard on the surface's only numeric primitive with zero kill test. Adjacent (not re-reported, same file): '==' has only a true-case at :67, '<' only a true-case at :71, and '>=' only true-cases at :65,:70 — none has an equal-value/one-off boundary pair, so `>=`->`>` and `<`->`<=` style mutants deserve the same two-assertion treatment the fix proposes.

Confirming check for a reviewer: add at condition-grammar.test.ts:71 `expect(ev({op:'ATTEMPTS', stepId:'s2', cmp:'<=', value:4})).toBe(true)` and `expect(ev({op:'ATTEMPTS', stepId:'s2', cmp:'<=', value:3})).toBe(false)`, then mutate condition-grammar.ts:94 to `actual < expected` — the new assertions go RED while today's suite does not.

Cleanup: all three probe files I created were deleted; `git status --porcelain -- packages/rph-domain` shows condition-grammar.ts unmodified. (Unrelated pre-existing untracked probe leftovers not created by me and left alone: packages/rph-domain/src/zz-probe-verifier.test.ts and packages/rph-application/src/handlers/zz-probe-vacuous-all.test.ts.)

</details>

**Live check needed.** None — settled by execution. Mutant `case '<=': return actual < expected;` applied to a copy of the module ran the module's full authored suite: 15/15 PASS (bunx vitest run, rph-domain, vitest 4.1.10). Repo-wide grep proves no other test/fixture uses the '<=' comparator, so no other suite could have killed it either.


## F-36 · [CONFIRMED] [MINOR] executionAttempts never closes an attempt terminated by Cancel — the attempt history reports RUNNING forever, on every replay

- **Lens:** `determinism-replay`
- **Site:** `packages/rph-projections/src/execution-attempts.ts:141-145 (STEP_APPLIERS) and :177-186 (attemptsByStep.latestState)`

**Claim.** STEP_APPLIERS folds exactly three event types — ExecutionStepStarted, ExecutionStepSucceeded, ExecutionStepFailed. ExecutionStepCancelled is not folded (the header at :137 explains only why ExecutionStepRetried is absent; Cancelled is simply unconsidered). But CancelExecutionStep's requireFrom is ['READY','QUEUED','RUNNING','WAITING'] (execution.ts:1004), so cancelling a RUNNING step is a first-class, tested path (execution-step-skip-cancel.test.ts:168, :178 — including under a SUPERSEDED plan). The draft opened by applyStepStarted (:87-97, `state: 'RUNNING'`) is then never closed: `completedAt` stays undefined and `state` stays 'RUNNING' permanently. This is deterministic and replay-stable, but it is deterministically WRONG — the projection permanently contradicts the aggregate, which says CANCELLED. attemptsByStep (:184) propagates it as `latestState: 'RUNNING'`, which the execution tab renders (apps/rph-demo/e2e/execution-tier3.e2e.ts:110).

**Failure scenario.** Start s1 (RUNNING), then dispatch CancelExecutionStep{stepId:s1, reason:'operator aborted'} — ACCEPTED, step is CANCELLED, ExecutionStepCancelled{stepId, reason, stepState:'CANCELLED'} is appended. Now `executionAttempts(engine.readAllEvents(), stepTypes)` returns one attempt with `state:'RUNNING'` and no completedAt, and `attemptsByStep(...)` reports `latestState:'RUNNING'`. The UI's attempt history shows a live in-flight attempt for a step that was aborted, for the rest of the plan's life and after any rebuild. The same holds for a plan cancelled/superseded with a step mid-flight — the operator-facing record of what happened is false exactly where a control action was taken.

**Suggested fix.** Add an applier for ExecutionStepCancelled (payload key `stepId`, execution.ts:1005-1009) that closes the current draft with `state:'CANCELLED'` and `completedAt = event.occurredAt`, mirroring applyStepFailed; consider ExecutionStepWaiting/WaitResolved too if the attempt record is meant to show suspension, and state explicitly in the header which control events do and do not close an attempt.

<details><summary>Code-semantics verifier evidence</summary>

I tried to refute this three ways (an earlier guard blocking RUNNING->CANCELLED; some other applier closing the draft; a design doc disclosing the omission as intentional). All three fail — the claim holds against the real code.

1) The applier table really folds exactly three event types. `packages/rph-projections/src/execution-attempts.ts:137-145`:
```
// ExecutionStepRetried is intentionally absent (a re-queue marker; the next Started opens attempt n+1).
// A Map (not an object literal) so a hostile/degenerate event.eventType ...
const STEP_APPLIERS = new Map<string, StepApplier>([
	['ExecutionStepStarted', applyStepStarted],
	['ExecutionStepSucceeded', applyStepSucceeded],
	['ExecutionStepFailed', applyStepFailed]
]);
```
and the fold at :158-160 is `STEP_APPLIERS.get(event.eventType)?.(...)` — an unmatched eventType is silently ignored. A repo-wide grep for `ExecutionStepCancelled` (excluding node_modules/dist) returns only: execution.ts:1003, contracts messages.ts:1120/1125/1778/2284-2285, transitions.data.ts:520-523 & 1474-1477, and two test files. There is NO reference anywhere in rph-projections. So no other applier, no post-pass, closes the draft.

2) The RUNNING->CANCELLED path is real, unguarded, and tested — no earlier precheck refutes the scenario. `packages/rph-application/src/handlers/execution.ts:998-1011`:
```
export const cancelExecutionStep: CommandHandler = (ctx, command) => {
	const p = command.payload as CancelExecutionStepPayload;
	return advanceStep(ctx, command, {
		stepId: p.stepId,
		target: 'CANCELLED',
		eventType: 'ExecutionStepCancelled',
		requireFrom: ['READY', 'QUEUED', 'RUNNING', 'WAITING'],
		eventPayload: { stepId: p.stepId, reason: p.reason, stepState: 'CANCELLED' }
	});
};
```
There is deliberately NO plan-ACTIVE precheck (the docstring at :991-997 says cancel is CLEANUP, permitted post-supersession), so nothing intercepts before the event is appended. The machine backs it: `transitions.data.ts:1476` `{ from: 'RUNNING', to: 'CANCELLED', trigger: 'ExecutionStepCancelled' }`. And it is a tested first-class path: `execution-step-skip-cancel.test.ts:168` "cancels a RUNNING step -> CANCELLED (records the reason on the event)" and :197-200 the post-supersession variant. The payload key is `stepId` (contracts `ExecutionStepCancelledPayloadSchema`, messages.ts:1120), i.e. exactly the key `applyStepFailed` reads at :122 — so an applier is a trivial mirror, and its absence is not a key-shape subtlety.

3) The draft therefore stays open forever. `applyStepStarted` (:87-97) pushes `{ state: 'RUNNING', startedAt, ... }` with no `completedAt`; only `applyStepSucceeded` (:110-111) and `applyStepFailed` (:125-127) ever mutate `state`/`completedAt`. Nothing else touches the draft. `attemptsByStep` (:180-185) then reports `latestState: list.at(-1)?.state` = `'RUNNING'`.

4) It is operator-visible and self-contradictory in the SAME row. `apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts:166-181` folds `executionAttempts(events, stepTypeById)` into `attemptsByStepId` with no filter beyond plan scoping (:175), and `+page.svelte:378-393` renders `<span class="st {attemptTone(at.state)}">{at.state}</span>` verbatim — so the step line shows stepState CANCELLED while its attempt list shows "#1 RUNNING", permanently and across any rebuild.

5) No design disclosure. `docs/_working/DESIGN-execution-attempt-staged.md` contains ZERO occurrences of "cancel"/"CANCELLED" (grep returned nothing), and the module header (:9-22) discloses only the Retried and provenance divergences. The ratified DDL (`Persistence, Migration, Dual-Run, and Cutover Design.md:842-868`) has `state text not null` + `completed_at` with no vocabulary restricting it to SUCCEEDED/FAILED. So the omission is unconsidered, not ruled.

6) Anti-vacuity: `packages/rph-projections/src/execution-attempts.test.ts` has 12 tests (grep of `it(`/`describe(`) — none mentions Cancel/CANCELLED. Folding `[Started, Cancelled]` today yields `state:'RUNNING'`, `completedAt: undefined`.

Severity stays MINOR, not raised: the attempts projection is display-only. Its only consumers are the page loader and the Svelte render (repo-wide grep for `executionAttempts|attemptsByStep` outside dist/node_modules hits only those two files plus its own test), and the one derived signal `aiNoBinding` (:164) is explicitly advisory and gates nothing — no gate, guard, retry-cap, or completion rule reads it. `attemptsMade` for RPH-EXE-008 is computed independently in the handler layer, not from this projection, so the retry cap is unaffected.

Note on the anti-false-positive rule: this finding involves no string parsing, delimiter, split/join, or suspicious literal — the mechanism is a missing Map entry, verified by grep across the whole repo — so a raw-byte inspection is not the settling check here.

CHECK TO REPRODUCE: add to `packages/rph-projections/src/execution-attempts.test.ts`:
`executionAttempts([ev('ExecutionStepStarted', PLAN, {stepId: STEP, stepState:'RUNNING'}), ev('ExecutionStepCancelled', PLAN, {stepId: STEP, reason:'operator aborted', stepState:'CANCELLED'}, '2026-07-12T00:05:00Z')])` — asserting `state:'CANCELLED'` with a `completedAt` goes RED today (actual: `'RUNNING'`, `completedAt` undefined).

</details>

<details><summary>Test-evidence verifier evidence</summary>

TEST-EVIDENCE lens settles this as CONFIRMED. Two independent probes (both written, run, and DELETED; no source touched).

1) COVERAGE GAP — no existing test proves the behaviour works.
`grep -rn "ExecutionStepCancelled"` across the whole repo returns hits ONLY in docs/vocab/contracts, `packages/rph-domain/src/transitions.data.ts:1474-1477`, `packages/rph-application/src/handlers/execution.ts:1003`, and `packages/rph-application/src/handlers/execution-step-skip-cancel.test.ts:174`. It appears NOWHERE in `packages/rph-projections/`. The full projection suite `packages/rph-projections/src/execution-attempts.test.ts` (129 lines, read in full) folds only Started/Succeeded/Failed/Retried — there is no Cancelled (or Skipped) fold test at all, so nothing goes RED if the claimed behaviour is wrong. `apps/rph-demo/e2e/execution-tier3.e2e.ts:128-129` asserts only that ONE attempt renders and is SUCCEEDED on the happy path; no e2e cancels a RUNNING step and inspects the attempt row.

2) PURE PROBE (packages/rph-projections, temp file, deleted). Folding `[ExecutionStepStarted{stepId}, ExecutionStepCancelled{stepId,reason,stepState:'CANCELLED'}]`:
  attempt = { attemptNumber:1, idempotencyKey:'step_1#1', startedAt:'2026-07-12T00:00:00Z', state:'RUNNING' } — no completedAt.
  attemptsByStep(...) = { attemptCount:1, latestState:'RUNNING' }.
  Control case `ExecutionStepSkipped` after Started: identical — state 'RUNNING'. (So the gap is broader than the finding claimed: Skipped is unfolded too.)

3) INTEGRATION PROBE (packages/rph-application, real Engine + SqliteStorageAdapter, temp copy of the skip-cancel harness, deleted). Propose→Approve→Activate, `StartExecutionStep` then `CancelExecutionStep{reason:'operator aborted'}` — both ACCEPTED. Observed:
  eventTypes = ['ExecutionStepStarted','ExecutionStepCancelled']
  aggregateStepState = 'CANCELLED'
  executionAttempts(store.readAllEvents(), …)[0] = { state:'RUNNING', startedAt:'2026-07-12T00:00:00Z', … } — no completedAt
  attemptsByStep(...)[0].latestState = 'RUNNING'
This is the real dispatch path, real payload shape (`stepId`), real aggregateId — the projection permanently contradicts the aggregate.

4) OPERATOR-VISIBLE CONTRADICTION IS REAL. `apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts:166-181` folds `executionAttempts` into `attemptsByStepId` for every step regardless of stepState; `+page.svelte:290` renders `data-testid="step-state"` = CANCELLED and `:378-393` renders `data-testid="step-attempt"` with `{at.state}` = RUNNING in the SAME row. (Minor correction to the finding: the UI consumes `executionAttempts` directly — `attemptsByStep` is exported but currently used only by the projection test — so the rendered wrongness comes from `at.state`, not `latestState`; both are wrong identically.)

5) NOT A DISCLOSED DIVERGENCE. The module header (execution-attempts.ts:9-22) discloses exactly two seam rulings — Retried-is-not-an-attempt and FAILED-has-no-provenance. Cancelled/Skipped are simply unconsidered. Nor is the fix spec-blocked: the ratified DDL (`…Persistence, Migration, Dual-Run, and Cutover Design.md:842-868`) declares `state text not null` with no enum constraint, so 'CANCELLED' is a legal attempt state.

SEVERITY UPHELD AT MINOR (not raised): nothing gates on the attempt projection. `executionAttempts` has exactly one non-test consumer (`+page.server.ts:174`), display-only; the retry cap reads `attemptsMade` from the aggregate/event count, not from this read-model. So the defect is a false operator-facing record, not a control-flow or invariant breach.

</details>

**Live check needed.** None — settled by execution. Regression test to add (permanent, not a probe): in packages/rph-projections/src/execution-attempts.test.ts, fold [ExecutionStepStarted, ExecutionStepCancelled] and assert state==='CANCELLED' with a completedAt; add the same for ExecutionStepSkipped, which this lens found is equally unfolded and was NOT in the original finding.


## F-37 · [CONFIRMED] [MINOR] ExecutionStepPruned's prune provenance — the sole justification for minting the event instead of reusing ExecutionStepSkipped — is never populated by any producer

- **Lens:** `doc-fidelity`
- **Site:** `packages/rph-application/src/handlers/execution.ts:1028-1047 + apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts:616 vs DR-004 §19-M1, DS-004 §6 D5`

**Claim.** DR-004 §19-M1: "**MINT `ExecutionStepPruned`** (+2 registry) carrying `selectedByBranchStepId`/`selectedEdgeId`; do not reuse the waived-skip event", justified because "its ratified payload carries no prune-provenance field and routing a system-prune through the waived-skip event conflates it with a user waiver" (DWP-03 outcome). DS-004 D5: "its event records `pruned: BRANCH <stepId> selected edge <edgeId>`". Shipped: both fields are OPTIONAL on the command and event (messages.ts:277-278, :1128-1129), the handler only forwards whatever the caller passed (execution.ts:1044-1045), and the ONLY production dispatcher sends stepId alone: `dispatchResult('PruneExecutionStep', str(f,'planId'), { stepId: str(f,'stepId') })` (+page.server.ts:616). A repo-wide grep for `selectedEdgeId`/`selectedByBranchStepId` outside dist/node_modules returns only the schema, the vocab, and those two spread lines — no test and no producer ever supplies a value.

**Failure scenario.** Drive the DWP-06 branch e2e (execution-flow.e2e.ts:183): the branch resolves, the operator clicks Prune on the not-taken arm, and the emitted ExecutionStepPruned payload is `{stepId, stepState:'SKIPPED'}`. An auditor replaying the governed stream cannot tell WHICH branch decision excluded the step or via which edge — the exact information DR-004 §19-M1 minted a whole new event to preserve. The two events differ only by type, not by content.

**Suggested fix.** Derive the provenance in the handler rather than trusting the caller: the prunability precheck already computes the gate plan, so record the resolving BRANCH step id and its selectedTransitionId on the event; or downgrade the doc claim and state that prune provenance is structural (recomputed), not recorded.

<details><summary>Code-semantics verifier evidence</summary>

CONFIRMED on its factual core, with its stated harm materially narrowed.

WHAT HOLDS (code-proven):
1. handlers/execution.ts:1029-1046 — the handler derives nothing, it only forwards what the caller passed:
   `const p = command.payload as { stepId: string; selectedByBranchStepId?: string; selectedEdgeId?: string };`
   `eventPayload: { stepId: p.stepId, ...(p.selectedByBranchStepId ? {...} : {}), ...(p.selectedEdgeId ? {...} : {}), stepState: 'SKIPPED' }`
2. The ONLY production dispatcher is +page.server.ts:616 — `return dispatchResult('PruneExecutionStep', str(f,'planId'), { stepId: str(f,'stepId') });`. A non-dist grep for `PruneExecutionStep` finds dispatches ONLY there and in two tests (execution-start-gate.test.ts:377/637/824/914, zzcs-notready-deadlock.test.ts:153/200), all `{ stepId }` alone.
3. The read-model cannot supply provenance even in principle: `prunableStepIds` (transition-gate.ts:323) returns `string[]`; the demo stores it as `Record<string,string[]>` (+page.server.ts:151-158) and the Svelte prune button is driven by `data.prunableStepByPlan[pl.id]?.includes(s.id)` (+page.svelte:363) — the branch/edge that excluded the step is never in the UI's hands.
4. `ExecutionStepPruned` has NO test whatsoever: a non-dist grep returns only vocab (m3:4722), messages.ts:1126/2288, the handler, and docs. The two optional fields are unasserted, dead schema surface.
5. Raw-byte check per the anti-false-positive rule: `sed -n '1035,1050p' handlers/execution.ts | cat -v` and `sed -n '610,620p' +page.server.ts | cat -v` show no hidden control characters (only M-bM-^@M-^T em-dashes in comments). The spreads and the `{ stepId: str(f,'stepId') }` literal are exactly as they render — this is not an invisible-delimiter false positive.
So the emitted payload after a BRANCH-driven prune is exactly `{stepId, stepState:'SKIPPED'}`, differing from ExecutionStepSkipped by TYPE only, not content. That half of the failureScenario is real.

WHAT I REFUTE (why MINOR, not MAJOR):
a) No contract is violated. Both fields are `"required": false` in the vocab (m3-commands-events.json:947,953 command; 4733,4739 event) and `.optional()` in messages.ts:277-278/1128-1129 — and DR-004's own build task line 154 specifies them optional (`{stepId, selectedByBranchStepId?, selectedEdgeId?}`). Omitting an optional field violates no ratified shape, no invariant, no gate.
b) The auditor is NOT blind, contrary to the failureScenario's second half. The excluding decision is durably recorded elsewhere by DWP-09: completeExecutionStep's `mutateStep` (execution.ts:62-78) writes `selectedTransitionId` onto the BRANCH step (`return selected === undefined ? step : { ...step, selectedTransitionId: selected };`), `toGatePlan` carries it (execution.ts:76-80), execution-view.ts:193 and +page.server.ts:127-128 surface it, and object state persists across process restarts (rph-engine/src/durability-roundtrip.test.ts:37-45). An auditor joins pruned step -> in-edges -> source BRANCH step -> its `selectedTransitionId` to obtain exactly "which BRANCH selected which edge". rph-engine/src/replay.ts is a hand-authored fixture trace oracle, not an event-sourced state rebuild, so nothing in the system depends on the prune event carrying the fact.
c) The mint itself is still justified independently: DR-004 §19-M1's other stated reason — "routing a system-prune through the waived-skip event conflates it with a user waiver" — IS delivered by the distinct event type, and the prune's authorisation is structural (execution.ts:1055-1067 `prunableStepIds(...).includes(p.stepId)`), not provenance-dependent.

RESIDUAL DEFECT (what actually needs fixing): DS-004 §6 D5's sentence "its event records `pruned: BRANCH <stepId> selected edge <edgeId>`" is unmet by every shipped path, and two optional fields exist that no producer and no test ever populates. Fix is either (i) derive provenance in the prunability precheck — it already builds the gate plan, so it can name the resolving BRANCH and its `selectedTransitionId` — plus a test asserting the emitted payload carries them, or (ii) amend DS-004 D5 / DR-004 §19-M1 to state that prune provenance is structural (joined via the BRANCH step's recorded `selectedTransitionId`) and drop the two dead fields from the vocab. Behavioural impact today: none — no deadlock, no invariant breach, no unkilled guard.

</details>

<details><summary>Test-evidence verifier evidence</summary>

SETTLED BY EXECUTION, NOT BY CODE-READING. I wrote a temporary probe (packages/rph-application/src/handlers/zzprobe-prune-provenance.test.ts, since DELETED; no source file modified — `git status --porcelain` shows no `M` entries) that built a real BRANCH plan (s1 BRANCH --COND[ATTEMPTS>99, never true]--> s2 --> s4 ; s1 --SEQ--> s3), started+completed the branch, then pruned the not-taken arm with EXACTLY the payload the sole production dispatcher sends (`{stepId}`, +page.server.ts:616).

OBSERVED OUTPUT (bunx vitest run --reporter=verbose --silent=false, 2 passed):
  PRUNED EVENT PAYLOAD = {"stepId":"plan_...-s2","stepState":"SKIPPED"}
  BRANCH SUCCEEDED PAYLOAD = {"executionStepId":"...-s1","executionAttemptId":"...","outputArtifactIds":[],"proposedEvidenceIds":[],"detectedAssumptionIds":[],"resultingExecutionState":"SUCCEEDED","executionProvenance":{},"structuredResult":{}}
  PERSISTED BRANCH STEP = {... "stepState":"SUCCEEDED","selectedTransitionId":"plan_...-t1-3"}
  ALL EVENT TYPES = ["ExecutionPlanProposed","ExecutionPlanApproved","ExecutionPlanActivated","ExecutionStepStarted","ExecutionStepSucceeded","ExecutionStepPruned"]
  STREAM CONTAINS selectedTransitionId = false

1) THE CLAIM HOLDS EMPIRICALLY. The emitted ExecutionStepPruned carries `{stepId, stepState:'SKIPPED'}` and nothing else — content-identical to a waived skip, differing only by event type. Exactly the failureScenario described.

2) THE STRONGEST AVAILABLE REFUTATION FAILS, AND THE DEFECT IS WORSE THAN CLAIMED. The natural rebuttal is "provenance is recoverable from the stream, because DWP-09 records the branch decision." It is not: `STREAM CONTAINS selectedTransitionId = false`. The decision is written by `mutateStep` onto the ACGREGATE STATE SNAPSHOT only (execution.ts:762-778); the `ExecutionStepSucceeded` payload (execution.ts:790-799) omits it. So NO domain event in the entire governed stream names which arm any BRANCH took. A pure event replay cannot reconstruct it — and the code's own comment forecloses re-derivation: execution.ts:761 states "Unlike reachability (structural, deliberately NOT persisted), a point-in-time decision cannot be reconstructed later." Structural recomputation (`prunableStepIds`) can say a step IS unreachable, but only by consuming the recorded `selectedTransitionId` it cannot get from the stream.

3) CONTROL PROVES IT IS A PRODUCER GAP, NOT BROKEN PLUMBING. Supplying the fields explicitly yields:
  CONTROL prune status = ACCEPTED
  CONTROL PRUNED PAYLOAD = {"stepId":"...-s2","selectedByBranchStepId":"...-s1","selectedEdgeId":"...-t1-3","stepState":"SKIPPED"}
The schema and the handler forwarding (execution.ts:1044-1045) work; nothing ever calls them that way.

4) COVERAGE GAP / ANTI-VACUITY (JPWB-CON-000 B7). `grep -rn 'selectedEdgeId|selectedByBranchStepId' --include=*.test.ts packages apps` (excluding node_modules) returns ZERO hits once my probe is removed. `ExecutionStepPruned` appears in exactly one non-probe test file — validate.test.ts:93 — and only as a registry COUNT (+2), never a payload assertion. The two ternaries at execution.ts:1044-1045 therefore always take the `{}` branch under the shipped suite: deleting both lines leaves every test green — an unkilled mutant. The only `selectedTransitionId` assertions that exist (execution-start-gate.test.ts:958, :962) assert on the PERSISTED STATE bag, never on an event, so no existing test proves the claimed-broken behaviour works.

CONCLUSION: no existing test refutes the finding; observed runtime behaviour confirms it. Severity MINOR upheld — this is an audit/doc-fidelity and dead-branch defect, not an execution-correctness one: no wrong state transition, no deadlock, no INV-5 or RPH-EXE violation, and the provenance is still readable from the mutable state snapshot even though it never reaches the immutable stream. The concrete unrealized claim is DR-004 §19-M1's justification for MINTING a second event ("carrying selectedByBranchStepId/selectedEdgeId; do not reuse the waived-skip event") — shipped, the mint buys a type discriminator only.

</details>

**Live check needed.** None — already executed. The settling run was: cd JanumiCode/janumiprofessionalworkbench/packages/rph-application && bunx vitest run <probe> --reporter=verbose --silent=false. To re-derive without the probe, note the permanent artifacts: (a) grep for selectedEdgeId/selectedByBranchStepId across *.test.ts returns nothing; (b) apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts:616 sends {stepId} alone; (c) execution.ts:790-799 omits selectedTransitionId from ExecutionStepSucceeded while execution.ts:762-778 writes it to state only. If the finding is actioned, the regression test to add is an assertion that a BRANCH-driven prune emits selectedByBranchStepId/selectedEdgeId (fails today) — and, if the stream is to be self-sufficient, that ExecutionStepSucceeded for a BRANCH carries the selected edge.


## F-38 · [CONFIRMED] [MINOR] The ratified in-edge disposition rule "NEUTRALIZED = ... source SKIPPED" is implemented as its opposite (SKIPPED is terminal-SUCCESS → SATISFIED), undisclosed

- **Lens:** `doc-fidelity`
- **Site:** `packages/rph-domain/src/transition-gate.ts:204-240 + :17 (TERMINAL_SUCCESS) vs DS-004 §5, DR-004 §3`

**Claim.** DS-004 §5 and DR-004 §3 both spell the disposition rule as: "NEUTRALIZED = losing/false CONDITIONAL off a terminal BRANCH, **or source SKIPPED**/FAILED/CANCELLED/SUPERSEDED". Code does the reverse: TERMINAL_SUCCESS = {SUCCEEDED, SKIPPED} (transition-gate.ts:17), and inEdgeDisposition returns SATISFIED for an unconditional edge off a LIVE SKIPPED source (:224-232) — NEUTRALIZED only if the source is structurally dead (:217). DS-004 is internally inconsistent here (D5 asserts the opposite: "SKIPPED is the only terminal state satisfying **both** the completion allow-list **and the barrier-join**"), and the code silently picked D5's reading. DR-004 §15 states "Divergences from DS-004: none intended; §19 to disclose any" and §19 discloses none, so the surviving §5/§3 rule is a live, wrong normative statement about shipped behaviour.

**Failure scenario.** Linear-graph plan s1→s2→s3. Waive-skip s2 (SkipExecutionStep with mandatory:false). Per the §5/§3 rule the s2→s3 edge is NEUTRALIZED, s3's only in-edge is neutralized, so s3 is unreachable and should be pruned to SKIPPED. Per the code s3 is startable and the plan continues through it (pinned by transition-gate.test.ts:374). Two readers of the same normative digest predict opposite outcomes for the same operator action; anyone implementing a second consumer (or a k-of-n join, per the deferred backlog) from §3 will build the wrong predicate.

**Suggested fix.** Correct DS-004 §5 / DR-004 §3 to "NEUTRALIZED = source FAILED/CANCELLED/SUPERSEDED, or a source that is structurally dead (however it reached SKIPPED); a LIVE SKIPPED source is terminal-success and SATISFIES its out-edges", and record it in DR-004 §19 as a disclosed divergence.

<details><summary>Code-semantics verifier evidence</summary>

CONFIRMED as a doc-vs-shipped-behaviour inaccuracy (code is correct; the docs are wrong). I could not refute either half.

CODE (verified by full control-flow trace of transition-gate.ts):
- :17 `const TERMINAL_SUCCESS = new Set<string>(['SUCCEEDED', 'SKIPPED']);`
- inEdgeDisposition :204-235 order of guards: :211 dangling→PENDING; :213 `if (!TERMINAL.has(src)) return 'PENDING';`; :217 `if (!liveStepIds(plan, evaluateGuard).has(source.id)) return 'NEUTRALIZED';` (STRUCTURAL deadness ONLY — strictly narrower than "reached SKIPPED"); :221 `if (!TERMINAL_SUCCESS.has(src)) return 'NEUTRALIZED';` — SKIPPED PASSES this; :228 BRANCH first-match; :233 `if (!isConditionalEdge(edge)) return 'SATISFIED';`.
- So for s1→s2→s3 with s2 waive-skipped while LIVE, edge s2→s3 = SATISFIED, s3 is startable via stepAtFrontier :278-288 / startableStepIds :301-308, and prunableStepIds :323-334 returns [] because it filters on `!live.has(s.id)`.
- The empty-transitions degenerate agrees: linearFrontier :244 `if (TERMINAL_SUCCESS.has(s.stepState)) continue;`.
- Single home confirmed: grep for isTerminalSuccessStepState/TERMINAL_SUCCESS across packages hits only transition-gate.ts and rph-projections/src/execution-view.ts:228, which delegates. No second predicate rescues the doc reading.
- Waiver path is reachable: rph-application/src/handlers/execution.ts:952-983 skipExecutionStep admits `mandatory ?? true` = false with no waiver → SKIPPED.
- Behaviour is PINNED as intended by rph-domain/src/transition-gate.test.ts: "but a waived skip of a REACHABLE step still satisfies its successors (the plan carries on)" → `expect(startableStepIds(live, guard)).toContain('s5')`, and the DWP-08 sibling test "keeps the arm dead even when the excluded step was SKIPPED by an operator WAIVER, not a prune".

DOC (headers grepped, not inferred from line numbers; raw bytes inspected with od -c — NO control characters, no negation, no split artifact):
- DS-004 §5 (header "## 5. Proposed scope", line 34; bullet at line 41): "**NEUTRALIZED** — the edge can never become satisfied: a not-first-match/false `CONDITIONAL` edge off a terminal-success BRANCH, or a source that reached SKIPPED or a terminal-non-success state (FAILED/CANCELLED/SUPERSEDED)."
- DR-004 §3 (header "## 3. Normative-source digest", line 28; bullet at line 31): "NEUTRALIZED = losing/false CONDITIONAL off a terminal BRANCH, or source SKIPPED/FAILED/CANCELLED/SUPERSEDED."
- DR-004 §15 line 279: "**Divergences from DS-004:** none intended; §19 to disclose any." §19 (line 300+) lists B1, B2, M1-M5, m1-m4 — none concerns SKIPPED disposition. So the divergence is undisclosed, as claimed.

QUALIFICATIONS that hold the severity at MINOR (not raised):
1. The CODE is the correct side. Implementing the §5/§3 wording would cascade-prune the entire downstream of any waived step (s3 pruned to SKIPPED after an operator waives s2) — precisely the deadlock/structural-deadness class this review hunts. So the fix is doc-only; no code change is warranted.
2. DS-004 §5 is INTERNALLY self-contradictory rather than uniformly wrong: the adjacent SATISFIED bullet (line 40) already says "terminal-success (SUCCEEDED/SKIPPED)", and §6 D5 (line 60) says "SKIPPED is the only terminal state satisfying both the completion allow-list and the barrier-join". A DS-004 reader has the correct rule two bullets away.
3. The residual real risk is DR-004 §3: a one-sentence digest with no counterweight, from which a second-consumer implementer derives `terminal-success = SUCCEEDED` only — a wrong predicate. That is what keeps this a live (if minor) normative inaccuracy rather than a pure nit.
4. In the case the doc primarily contemplated (D5 branch-prune of a not-taken arm) code and doc AGREE, because a pruned arm IS structurally dead and hits :217. The divergence bites only for a waived skip of a still-reachable step.

</details>

<details><summary>Test-evidence verifier evidence</summary>

SETTLED FROM THE TEST/BEHAVIOUR SIDE. The claimed direction holds: shipped behaviour is "a LIVE SKIPPED source SATISFIES its out-edges", and the ratified digests state the opposite rule, undisclosed. Tests do NOT refute the finding — they are the strongest proof of it, because they pin the code's reading as INTENDED while the docs assert the inverse.

1) OBSERVED BEHAVIOUR (temporary probe, run then DELETED; no source modified). Wrote packages/rph-domain/src/zzz-probe-skipped-disposition.test.ts with exactly the finding's shape as an explicit GRAPH plan (not the linear degenerate, so the §5 disposition rule literally applies): ACTIVE plan, steps s1=SUCCEEDED, s2=SKIPPED (waived, structurally live), s3=QUEUED; edges e1 s1→s2, e2 s2→s3, both SEQUENTIAL. Result: `bunx vitest run src/zzz-probe-skipped-disposition.test.ts` → 1 passed, asserting inEdgeDisposition(plan, e2) === 'SATISFIED', startableStepIds === ['s3'], prunableStepIds === []. The DS-004 §5 bullet-2 / DR-004 §31 rule predicts NEUTRALIZED → s3 unreachable → prunable. Two readers of the same normative digest do get opposite outcomes, as claimed. File removed (verified absent).

2) EXISTING TESTS PIN THE CODE READING AS DELIBERATE, at two layers, both green now:
 - packages/rph-domain/src/transition-gate.test.ts (49/49 pass): 'but a waived skip of a REACHABLE step still satisfies its successors (the plan carries on)' — s3 SKIPPED by waiver on the TAKEN arm, asserts startableStepIds contains s5, with the in-test comment "this is the case the structural rule must NOT break, and the reason deadness cannot simply mean SKIPPED."
 - packages/rph-application/src/handlers/execution-step-skip-cancel.test.ts:158 (8/8 pass): 'a SKIPPED step advances the DWP-01 start-gate (the next step becomes startable)' — skip(1,{mandatory:false}) ACCEPTED then start(2) ACCEPTED → RUNNING. Its file header (line 5) states outright: "A SKIPPED step advances the DWP-01 start-gate (SKIPPED is terminal-success)."
 So there is no coverage gap on the CODE side; the gap is that nothing anywhere asserts the DOC'S rule, and the doc was never reconciled to what shipped.

3) CODE PATH CORROBORATES (transition-gate.ts): :17 TERMINAL_SUCCESS = {'SUCCEEDED','SKIPPED'}; :217 NEUTRALIZED only when the source is structurally DEAD (liveStepIds); :221 NEUTRALIZED only for non-terminal-success; :233 unconditional edge off a live terminal-success source → SATISFIED. Also :244 linearFrontier skips over SKIPPED for the empty-transitions degenerate.

4) THE DOC DEFECT IS REAL AND UNDISCLOSED, and is INTERNAL to DS-004 §5, not merely §5-vs-D5 as the finding framed it: DS-004 line 38 (bullet 1) defines SATISFIED as "source ... is terminal-success (SUCCEEDED/SKIPPED)"; line 41 (bullet 2, three lines later) lists NEUTRALIZED as "... or a source that reached SKIPPED or a terminal-non-success state". The two bullets contradict each other outright. DS-004 line 60 (D5) sides with the code: "SKIPPED is the only terminal state satisfying both the completion allow-list and the barrier-join." DR-004 line 31 repeats the wrong rule verbatim. DR-004 line 278: "Divergences from DS-004: none intended; §19 to disclose any", and §19 (lines 300-317) discloses B1/B2/M1-M5/m1-m4 — none of them this.

5) NOT A RUNTIME DEFECT — severity MINOR is correct, not higher. I checked whether any second consumer implemented the doc reading and thereby diverged from the kernel: packages/rph-projections/src/execution-view.ts:225 explicitly delegates the terminal-success predicate to the shared rph-domain helper rather than re-deriving it, so read-model and authority agree. The doc's rule is also the unsafe one: adopting it would make every waived skip in a linear plan neutralize its successor, cascade-prune the remainder, and defeat waiver-skip entirely — so the code is right and the prose is wrong. Suggested remedy stands: correct DS-004 §5 bullet 2 and DR-004 §3 to "NEUTRALIZED = source FAILED/CANCELLED/SUPERSEDED, or a source that is structurally dead (however it reached SKIPPED); a LIVE SKIPPED source is terminal-success and satisfies its out-edges", and record it in DR-004 §19.

</details>

**Live check needed.** None — settled. Behaviour was directly observed via a probe (created, run, deleted) and by running the two existing suites: rph-domain transition-gate.test.ts (49/49) and rph-application execution-step-skip-cancel.test.ts (8/8), both green.


## F-39 · [CONFIRMED] [MINOR] DWP-02's invariant "never silently false at runtime" is unmet for STEP_STATE.state — a typo'd state value is accepted at propose and evaluates false forever

- **Lens:** `doc-fidelity`
- **Site:** `packages/rph-domain/src/condition-grammar.ts:34 + :119 vs DR-004 §9 DWP-02, DS-004 §10`

**Claim.** DR-004 DWP-02 invariant: "A malformed OR unresolved-stepId condition is rejected at propose (**never silently false at runtime**)", and DS-004 §10 records "MAJOR (condition-ref) → FIXED. a guard on a typo'd stepId resolves false silently → wrong branch. Fix: propose-time condition-ref resolution." Only the stepId half shipped: rejectMalformedTransitionCondition resolves conditionStepRefs against declared steps (execution.ts:199-206), but the grammar declares `state: z.string()` (condition-grammar.ts:34) rather than the ratified StepStateSchema, and evaluateCondition compares it with `step?.stepState === expr.state` (:119). A state value outside the 10-value enum parses, propose accepts it, and it is unsatisfiable forever — the identical failure mode the §10 MAJOR was closed for.

**Failure scenario.** Author a BRANCH whose first CONDITIONAL arm is `{op:'STEP_STATE', stepId:'s1', state:'SUCCEDED'}` (typo) with the SEQUENTIAL remediation default last. ProposeExecutionPlan ACCEPTS. At resolve time the guard is false for every possible s1 state, first-match falls through to the default, and the plan permanently takes the wrong arm — silently, with no rejection and no diagnostic, exactly what the invariant forbids.

**Suggested fix.** Type STEP_STATE.state as the ratified StepState enum in the grammar (or validate it in rejectMalformedTransitionCondition alongside the stepId refs) and add a propose-rejection test, closing the state half of the same MAJOR.

<details><summary>Code-semantics verifier evidence</summary>

I traced every cited site and then proved the scenario empirically with a throwaway engine test (now deleted).

1) The grammar really does type the state as a free string — raw bytes checked with `sed | cat -v`, nothing invisible:
`packages/rph-domain/src/condition-grammar.ts:35`
    z.strictObject({ op: z.literal('STEP_STATE'), stepId: z.string(), state: z.string() }),
and `:22` `| { op: 'STEP_STATE'; stepId: string; state: string }`. Evaluation at `:119-120`:
    case 'STEP_STATE':
        return step?.stepState === expr.state;
The ratified enum exists and is NOT used here: `packages/rph-contracts/src/enums.ts:699-711` `StepStateSchema = z.enum([... 10 values ...])`.

2) No earlier guard catches it. Full propose chain in `packages/rph-application/src/handlers/execution.ts:250-255` is exactly three checks — `rejectMalformedTransitionGraph` (`:129`, delegates to `validateTransitionGraph`, which treats `conditionExpression` as OPAQUE: `transition-gate.ts:47-55, :523-524` only ever test `=== undefined`), `rejectDuplicateTransitionId` (`:158`), and `rejectMalformedTransitionCondition` (`:183-210`). The last one does the schema parse (`:190`) and then ONLY the stepId-ref resolution:
    const badRef = conditionStepRefs(parsed.data).find((id) => !declaredStepIds.has(id));
`conditionStepRefs` (condition-grammar.ts:155-171) returns stepIds only — the `state` value is never inspected anywhere in the repo. Grep for `STEP_STATE` across the monorepo returns no validation site; the only other consumer is `execution-view.ts:308-309` `renderCondition`, which happily prints the typo as `step … is SUCCEDED` (a human-visible string, not a guard).

3) Empirical proof. I added a temporary test in packages/rph-application (same fixtures as execution-start-gate.test.ts: BRANCH s1, CONDITIONAL s1→s2, SEQUENTIAL default s1→s3 last) and all three assertions PASSED (`bunx vitest run` — 3/3):
   - `ConditionExpressionSchema.safeParse({op:'STEP_STATE',stepId:'s1',state:'SUCCEDED'}).success === true`
   - control, correct spelling `'SUCCEEDED'`: start(1) → complete(1) → **start(2) ACCEPTED, start(3) REJECTED**, states [SUCCEEDED, RUNNING, QUEUED] — the guarded arm wins.
   - typo `'SUCCEDED'`: ProposeExecutionPlan **ACCEPTED**, Approve ACCEPTED, Activate ACCEPTED; then start(1) → complete(1) → **start(2) REJECTED, start(3) ACCEPTED**, states [SUCCEEDED, QUEUED, RUNNING] — the plan silently takes the DEFAULT arm, no rejection, no diagnostic. That is the reported failureScenario verbatim (temp file removed; `git status` clean).

So this is a genuine fail-OPEN authoring gap: an unsatisfiable-forever guard is admitted at propose and resolves the branch to the wrong arm. It is the same failure mode DS-004 §10 closed as MAJOR for the stepId half of the same predicate (`rejectMalformedTransitionCondition` was written precisely so "a guard is never silently false at runtime" — its own docstring at execution.ts:178-181), and the anti-vacuity note in the finding is also accurate: `execution-start-gate.test.ts:343` covers only `op:'NONSENSE'` (schema shape) and `:349` only an undeclared stepId — nothing pins the state value, so tightening the schema today breaks no test.

I raise severity MINOR → MAJOR for parity with the already-fixed stepId half: identical mechanism (unresolvable leaf → permanently false → wrong exclusive arm), identical blast radius (the plan executes the wrong path for its whole life), and the same governing invariant ("never silently false at runtime", fail-closed defaults). The only mitigant is that describeCondition renders the bad literal to a human reviewer during UNDER_REVIEW — a human safety net, not a guard.

Fix (one line + one test): validate `parsed.data`'s STEP_STATE `state` against `StepStateSchema` inside `rejectMalformedTransitionCondition` (rph-application already imports rph-contracts), or type it as `StepStateSchema` in the grammar; add a propose-rejection test alongside execution-start-gate.test.ts:343/:349.

</details>

<details><summary>Test-evidence verifier evidence</summary>

SETTLED BY EXECUTION, not by re-reading the code argument. I wrote a temporary probe (`packages/rph-application/src/handlers/zz-probe-state-typo.test.ts`, now DELETED — `git status` confirms no source file touched) that drove the real Engine + SqliteStorageAdapter through the full propose/approve/activate/start/complete flow.

RUN OUTPUT (`bunx vitest run ... --reporter=verbose --disable-console-intercept`, 3/3 passed):
  P1 safeParse.success = true
  P2 propose status = ACCEPTED {}
  P2 s1 state = SUCCEEDED
  P2 start(s2 guarded arm) = REJECTED start(s3 default) = ACCEPTED
  P3 start(s2 guarded arm) = ACCEPTED start(s3 default) = REJECTED

P2 is the failure scenario verbatim: a BRANCH plan (s1 BRANCH, arms `CONDITIONAL {op:'STEP_STATE', stepId:s1, state:'SUCCEDED'}` -> s2, `SEQUENTIAL` default -> s3). ProposeExecutionPlan returned ACCEPTED with an EMPTY error — no schema reject, no semantic reject, no diagnostic anywhere. s1 then really reached SUCCEEDED, the guarded arm s2 was refused, and the default s3 was taken. P3 is the control: the ONLY delta is the spelling `SUCCEEDED`, and the outcome flips (s2 ACCEPTED, s3 REJECTED). So the arm selection is decided silently by a one-character authoring typo that the propose gate lets through — exactly the "silently false at runtime" mode DR-004 DWP-02 forbids.

TEST-COVERAGE SIDE — no existing test refutes it; the gap is total:
- `packages/rph-domain/src/condition-grammar.test.ts:39-41` — the only STEP_STATE negative is a MISSING `state` field ("no state"). Nothing asserts an out-of-enum VALUE is rejected. Positive cases (:30, :59-60, :80, :120) all use legal values, so they stay green either way.
- `packages/rph-application/src/handlers/execution-start-gate.test.ts:343` (malformed op `NONSENSE` -> RPH_VALIDATION_SCHEMA_FAILED) and `:349` (undeclared `ghost_step` -> RPH_VALIDATION_SEMANTIC_FAILED) are the ONLY propose-reject condition tests. Both are killed by a different code path (`ConditionExpressionSchema` discriminated-union parse; `conditionStepRefs` ref resolution at `packages/rph-application/src/handlers/execution.ts:199`). Neither touches `state`.
- Repo-wide grep for `STEP_STATE` finds no other propose-rejection or state-validation test in rph-application, rph-domain, rph-projections, or the rph-demo e2e specs. `packages/rph-projections/src/execution-view.test.ts:477` only renders `describeCondition({state:'FAILED'})` — a typo would render "is SUCCEDED" with no complaint, so the UI is not a backstop either.

CODE CORROBORATION: `packages/rph-domain/src/condition-grammar.ts:35` declares `state: z.string()` while the ratified 10-value enum exists as `StepStateSchema` at `packages/rph-contracts/src/enums.ts:699-711`; the evaluator at `:120` is a bare `step?.stepState === expr.state`. `rejectMalformedTransitionCondition` (`execution.ts:183-210`) resolves stepId refs only — the state half was never implemented. The suggested fix is boundary-legal: rph-domain already imports rph-contracts (`packages/rph-domain/src/stateMachine.ts:4`).

Severity held at MINOR: it requires an authoring typo rather than an ordinary command sequence, and it cannot corrupt a correctly-authored plan. It is not a NONE, because the guarded edge is authored input, the wrong arm is taken permanently and silently, and this is the same defect class DS-004 §10 closed as MAJOR for the stepId half.

</details>

**Live check needed.** None — settled live. The probe was run against the real engine and deleted; to re-confirm, re-add a test asserting `ProposeExecutionPlan` REJECTS an edge carrying `{op:'STEP_STATE', stepId:<declared>, state:'SUCCEDED'}` — it fails today (propose returns ACCEPTED).


## F-40 · [CONFIRMED] [MINOR] Machine-arrow audit: 8 of the 20 declared ExecutionStep arrows have no test at all — and WAITING->CANCELLED, which has none, is the exact remediation the resume refusal instructs and the basis on which this review refuted a wait/supersede defect

- **Lens:** `completeness`
- **Site:** `packages/rph-domain/src/transitions.data.ts:1437-1482 (the 20 arrows) vs the only two CancelExecutionStep dispatch sites in the repo, packages/rph-application/src/handlers/execution-step-skip-cancel.test.ts:168 (from RUNNING) and :178 (from QUEUED); refusal text at packages/rph-application/src/handlers/execution.ts:1119-1126`

**Claim.** Cross-checking the machine against the test inventory arrow-by-arrow (task item (c)) leaves eight uncovered: READY->QUEUED, READY->SKIPPED, READY->CANCELLED (covered by the finding above), WAITING->CANCELLED, and the five ->SUPERSEDED arrows (NOT_READY/READY/QUEUED/RUNNING/WAITING), none of which any command targets — grep of registry.ts:123-139 finds no step-level supersede command. The sharpest of these is WAITING->CANCELLED. `cancelExecutionStep`'s requireFrom is ['READY','QUEUED','RUNNING','WAITING'], but the only two Cancel dispatches in the entire repo cancel from RUNNING and from QUEUED. WAITING is never cancelled by any test — yet `resolveExecutionStepWait`'s refusal under a non-ACTIVE plan literally ends with 'Cancel the step instead.' (execution.ts:1119-1126, asserted at execution-start-gate.test.ts:613/:624). The documented recovery path for a suspended step under a terminated plan is therefore entirely unverified, and this review's own wait-resume lens REFUTED a supersede/orphan defect on the strength of that untested arrow.

**Failure scenario.** EMPIRICALLY CONFIRMED that the arrow currently works (probe G6, since deleted): start s1, EnterExecutionStepWait, CancelExecutionPlan{reason}, ResolveExecutionStepWait -> REJECTED with '...plan is not ACTIVE (CANCELLED) ... Cancel the step instead.', then CancelExecutionStep(s1) -> ACCEPTED, final stepState CANCELLED. The defect is the anti-vacuity gap, not today's behaviour: because no test drives it, narrowing `requireFrom` to ['READY','QUEUED','RUNNING'] — a plausible edit, since RUNNING is the only cancel source any test exercises — leaves the whole suite GREEN while stranding every WAITING step under a terminated plan with no exit at all (resolve needs ACTIVE, wait needs RUNNING, skip/prune exclude WAITING). That turns a refuted finding into a live one with nothing going red.

**Suggested fix.** Add the WAITING->CANCELLED kill test (it is the sanctioned cleanup path and currently has none). For the five ->SUPERSEDED arrows and READY->QUEUED, either mint the commands or delete the arrows from transitions.data.ts and record them as disclosed residuals — a declared arrow with no command and no test is exactly the F-6-class unreachable-state hole DWP-04 was created to close.

<details><summary>Code-semantics verifier evidence</summary>

CONFIRMED but NARROWED to its first half: `cancelExecutionStep.requireFrom = ['READY','QUEUED','RUNNING','WAITING']` (packages/rph-application/src/handlers/execution.ts:1004) has positive coverage for only TWO of its four sources; READY and WAITING are entirely untested.

DISPOSITIVE TEST INVENTORY. Repo-wide grep for `CancelExecutionStep` (--include=*.ts,*.svelte) returns four non-contract sites: registry.ts:136 (registration), apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts:607 (app dispatch), and exactly two test dispatches, both through the `cancel(i)` helper at execution-step-skip-cancel.test.ts:87-88:
  - :168 "cancels a RUNNING step → CANCELLED" — `activePlan(['QUEUED']); start(1); cancel(1)` → source RUNNING.
  - :178 "cancels a step under a SUPERSEDED plan" — `activePlan(['QUEUED']); ...Supersede...; cancel(1)` → source QUEUED (the step is never started).
No e2e drives it either: the only `step-action-cancel` references are execution-plan.e2e.ts:232 and :243, both `toHaveCount(...)` affordance assertions — nothing `.click()`s cancel anywhere in e2e/.

WHY WAITING IS THE MATERIAL ONE. resolveExecutionStepWait's precheck (execution.ts:1119-1126) refuses under a non-ACTIVE plan with a message ending "Cancel the step instead.", and that exact string is ASSERTED at execution-start-gate.test.ts:627 (`expect(r.error?.message).toContain('Cancel the step instead')`) inside the test at :613 "permits a wait under a NON-ACTIVE plan but REFUSES the resume". So the suite asserts a documented remediation instruction whose target path it never exercises. Mutating requireFrom to ['READY','QUEUED','RUNNING'] leaves the whole suite GREEN while (a) making that asserted instruction false and (b) stranding a WAITING step under a terminated plan with no exit at all: resolve requires ACTIVE (execution.ts:1120), wait requires RUNNING (execution.ts:1087), skip requires ACTIVE + canSkipStep (execution.ts:966-984), prune is requireFrom ['NOT_READY','READY','QUEUED'] + plan-ACTIVE (execution.ts:1041,1049). The projection does NOT cover the gap: CONTROL_BY_STEP_STATE (execution-view.ts:136-147, `WAITING: ['cancel','resolve']`) is a hand-authored table with no binding to the handler, and its test (execution-view.test.ts:118-119) asserts the table against itself — after the mutation the UI would keep rendering a cancel button the engine refuses, and nothing goes red.

THE OBLIGATION IS THE REPO'S OWN, NOT INVENTED. dwp05-precondition-coverage.test.ts:8-10 states it verbatim: "2. Positive (widest-in-arrow) test: EACH reachable source in the set is ACCEPTED (two-source Cancel; the three reachable sources of the four-source Supersede...)". That sweep covered the 7 plan-level + 4 PWA sites only. The ExecutionStep family received only the NEGATIVE half, in the CMDPRE remediation (execution-step-reissue-guard.test.ts:1-15, Fail and Retry re-issue kills). The positive per-source obligation was never applied to the step family, and cancel's WAITING source is the concrete casualty.

WHAT I REFUTE IN THE CLAIM. The second half — READY->QUEUED plus the five ExecutionStep ->SUPERSEDED arrows (transitions.data.ts:1444, 1478-1482) having no command — is factually true (I confirmed supersedeExecutionPlan, execution.ts:524-550, is a plan-level advanceStatus with NO step cascade, which is exactly why cancel-from-QUEUED still succeeds at skip-cancel.test.ts:198; and `ExecutionStepSuperseded` exists nowhere in contracts, while ExecutionStepReady has a schema at messages.ts:1140/2296 with no emitter). But this is NOT a defect. A machine broader than the command set is the DESIGNED relationship on this surface and is the stated reason requireFrom exists at all (execution-step-reissue-guard.test.ts:6-8: "requireFrom is the SOLE guard against a same-state re-issue on the step machine (which declares NO illegal self-edge)"). The F-6 class DWP-04 closed was an arrow that was reachable-in-practice yet unrecorded; a catalogue arrow no command drives is a residual-register hygiene item, not a live hole. That half should be dropped from the finding rather than carried at MINOR.

NET: one real, actionable gap — add the WAITING->CANCELLED positive test (Start -> EnterExecutionStepWait -> CancelExecutionPlan -> CancelExecutionStep, assert ACCEPTED + stepState CANCELLED) and prove it red by dropping 'WAITING' from requireFrom; optionally the READY source in the same sweep (READY is reachable only by authoring stepState:'READY' at propose time, so it is lower-stakes). MINOR: today's behaviour is correct; the defect is the unpunished narrowing mutant on a path the codebase's own refusal text advertises and on which this review's wait/supersede refutation rests.

</details>


## F-41 · [PLAUSIBLE] [MAJOR] ALL with an empty operand list is vacuously TRUE — a fail-OPEN guard the schema and propose-time validation both accept

- **Lens:** `grammar`
- **Site:** `packages/rph-domain/src/condition-grammar.ts:130 (and the schema at :55)`

**Claim.** `ALL` is implemented as `expr.operands.every(...)` (condition-grammar.ts:130), and `[].every()` is true. The schema declares `operands: z.array(ConditionExpressionSchema)` with NO `.min(1)` (:55), so `{op:'ALL', operands:[]}` parses successfully; `conditionStepRefs` returns [] for it, so `rejectMalformedTransitionCondition` (execution.ts:199-207) finds no bad ref and accepts the plan. The result is a guard that is unconditionally true regardless of any plan state — a fail-OPEN default in a surface whose stated rule is that an absent/unmarked value takes the SAFE interpretation. The polarity contrast makes it an oversight rather than a decision: ANY([]) is `[].some()` = false (:132), the fail-closed answer, and NOT(ANY([])) reaches the same unconditional true by a second route. The projection even renders it honestly as `all of ()` (execution-view.ts:319), so the shape was anticipated in the display layer but never guarded in the evaluator or the schema. Neither condition-grammar.test.ts nor execution-view.test.ts asserts an empty-operands case anywhere.

**Failure scenario.** An authored (or LLM-generated) plan emits a BRANCH s1 whose out-edges are [t1: s1->s2 CONDITIONAL {op:'ALL', operands:[]}, t2: s1->s3 SEQUENTIAL default]. Propose is ACCEPTED. When s1 succeeds, selectBranchEdge's first-match loop (transition-gate.ts:115-118) evaluates t1 first, gets true, and selects the s2 arm — regardless of every fact in the plan. The default arm s3 and every later conditional arm become permanently unreachable and are offered for Prune. Because a model asked to express 'no additional conditions' plausibly emits an empty ALL, the guard system silently degrades to 'always take the first arm' with no propose-time rejection and no runtime signal.

**Suggested fix.** Add `.min(1)` to both the ALL and ANY operand arrays at condition-grammar.ts:55-56 so an empty combinator is REJECTED at propose (RPH_VALIDATION_SCHEMA_FAILED) rather than silently evaluating true, and add the two empty-operand assertions to condition-grammar.test.ts so the polarity is pinned.

<details><summary>Code-semantics verifier evidence</summary>

MECHANISM VERIFIED END-TO-END BY EXECUTION, not just by reading. I wrote a throwaway engine-level test (`packages/rph-application/src/handlers/zz-verify-vacuousall.test.ts`, since deleted) that drives the REAL `Engine.dispatch` path: ProposeExecutionPlan of a BRANCH plan `s1(BRANCH) -> [t1-2 CONDITIONAL {op:'ALL',operands:[]}, t1-3 SEQUENTIAL default]`, then Approve/Activate/Start(1)/Complete(1). Result (all assertions passed, 2/2):
- propose status === 'ACCEPTED' (no propose-time rejection);
- after the branch succeeded, `plan.state.steps[0].selectedTransitionId === '<PLAN>-t1-2'` — the VACUOUS arm was selected and RECORDED;
- `start(2)` ACCEPTED, `start(3)` REJECTED — the mandatory default arm was neutralized;
- control case `{op:'ANY',operands:[]}` recorded `-t1-3` and start(3) was ACCEPTED — the polarity contrast the finding asserts is real.

Code proving each link (raw bytes checked with `cat -A`/`cat -v` at condition-grammar.ts:54-57 and 128-133 — no hidden characters, no `.min(...)`):
- schema, condition-grammar.ts:55-56 — `z.strictObject({ op: z.literal('ALL'), operands: z.array(ConditionExpressionSchema) })`; `z.array` with no `.min(1)` accepts `[]`.
- evaluator, :129-130 — `case 'ALL': return expr.operands.every((o) => evaluateCondition(o, subject));` → `[].every()` === true; :131-132 `ANY` → `[].some()` === false.
- propose-time validation, rph-application/src/handlers/execution.ts:190-207 — parse succeeds, and `conditionStepRefs(parsed.data)` (condition-grammar.ts:163-165, `flatMap` over `[]`) returns `[]`, so `.find(...)` is `undefined` and no reject fires.
- graph validation never inspects expression CONTENT: `isConditionalEdge` (transition-gate.ts:88-89) keys only on `conditionExpression !== undefined`, and `checkBranchDefaults` (:519-549) is satisfied because the SEQUENTIAL default is present and last.
- selection, transition-gate.ts:115-118 — `for (const e of outEdges) { if (!isConditionalEdge(e)) return e; if (evaluateGuard?.(e, plan)) return e; }` → t1-2 wins first-match unconditionally.
- no test anywhere pins either empty-operand polarity (condition-grammar.test.ts has none; execution-view.ts:319/321 renders `all of ()` / `any of ()` but execution-view.test.ts asserts neither).

WHY I DOWNGRADE MAJOR -> MINOR (the finding's framing overreaches on three points):
1. NO governing rule is violated. INV-5, RPH-EXE-002, RPH-EXE-008, terminal-success/no-deadlock, structural deadness (DWP-07/08) and resolved-once (DWP-09) all hold in the observed run: the branch resolved ONCE, recorded its decision, the losing arm was NEUTRALIZED and prunable, and the plan can complete. The outcome is "the author's guard said always", not a corrupted flow.
2. The "fail-OPEN default" characterization conflates VACUOUS TRUTH with an ABSENT-VALUE default. The absent-value cases on this surface are in fact fail-closed and I verified each: an absent `conditionExpression` makes the edge unconditional/SEQUENTIAL (transition-gate.ts:88-89, 523-524); a missing step ref evaluates FALSE via `step?.` (condition-grammar.ts:120-128); a CONDITIONAL edge with NO evaluator supplied is NOT satisfied (transition-gate.ts:234, `evaluateGuard?.(edge, plan) === true`). `ALL([]) === true` is the standard semantics of universal quantification over an empty set and of `Array.prototype.every` — an explicitly authored expression, not an unmarked value.
3. The suggested `.min(1)` does NOT close the hazard class it claims to. A constant-true guard that shadows the default arm is expressible in forms `.min(1)` cannot touch: `{op:'OUTPUT_COUNT', stepId:'s1', cmp:'>=', value:0}` and `{op:'ATTEMPTS', stepId:'s1', cmp:'>=', value:0}` both parse, both resolve a DECLARED step (so `rejectMalformedTransitionCondition` passes), and both make `numericCompare(x,'>=',0)` true for every possible subject (condition-grammar.ts:83-98, with `?? 0` floors at :124/:126) — producing byte-identically the outcome my test observed. Rejecting only the empty combinator hardens one syntactic form, not the hazard.

Residual exposure is also narrow: nothing in-repo authors condition expressions (the demo route at apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts:140-142 only passes `conditionExpression` through to the read-model; there is no authoring affordance), so the entry point is an external `ProposeExecutionPlan` caller. What genuinely remains is (a) a small propose-time strictness gap against a degenerate combinator and (b) a real ANTI-VACUITY hole: the empty-operand behaviour of BOTH combinators is unpinned, so the `every`/`some` polarity could be inverted in a refactor with the suite staying green. Both are worth fixing at MINOR — add the `.min(1)` (or a "a condition must reference ≥1 declared step" propose check, which subsumes it) plus the two polarity assertions in condition-grammar.test.ts.

</details>

<details><summary>Test-evidence verifier evidence</summary>

Every FACTUAL claim in the finding is true, but the characterisation as a MAJOR fail-OPEN guard defect does not survive a behavioural probe.

WHAT I RAN. I wrote a temporary probe `packages/rph-application/src/handlers/zz-probe-vacuous-all.test.ts` (full engine: CaptureIntent -> ProposePwu -> ProposeExecutionPlan -> Approve -> Activate -> Start/Complete/Prune, copied from the harness in execution-start-gate.test.ts) with a BRANCH s1 -> [t1-2 CONDITIONAL <guard>, t1-3 SEQUENTIAL default LAST], four guards. All four propose-accepted; observed results (probe since DELETED, repo clean — `git status` shows no file of mine):
- `{op:'ALL',operands:[]}`: PROPOSE ACCEPTED; complete(1) records selection = t1-2; start(s2)=ACCEPTED, start(s3)=REJECTED "every in-edge is neutralized". Exactly the claimed behaviour.
- `{op:'ANY',operands:[]}`: selection = t1-3 (default), start(s2) REJECTED, prune(s2) ACCEPTED -> SKIPPED. The claimed polarity contrast is real.
- `{op:'NOT',operand:{op:'ANY',operands:[]}}`: identical to ALL([]) — selection t1-2.
- **`{op:'ATTEMPTS', stepId:s1, cmp:'>=', value:0}` — a NON-EMPTY, fully schema-legal expression — produced a byte-identical outcome to ALL([]): selection t1-2, s3 neutralized.** This is the fact that refutes the finding.

WHY REFUTED.
1. The proposed fix does not close the class. `attemptsMade` and `outputArtifactIds.length` are non-negative by construction (condition-grammar.ts:124-126), so `ATTEMPTS >= 0` and `OUTPUT_COUNT >= 0` are unconditional truths that `.min(1)` on the ALL/ANY operand arrays cannot reject. "The guard system degrades to always take the first arm" is therefore a property of ANY tautological predicate in a general predicate language, not of the empty combinator. Blocking one syntactic instance of an infinite class is hardening, not a defect fix.
2. No invariant is broken and there is no wrong outcome. The probe shows the plan is coherent end to end: exactly one arm is selected, the decision is RECORDED (`selectedTransitionId` = t1-2, so DWP-09 resolve-once holds), the losing arm is correctly NEUTRALIZED and prunable, nothing deadlocks, nothing is resurrected, and the plan can reach the terminal-success set. Contrast the two already-fixed MAJOR defects on this surface, each of which produced a WRONG state (unkilled guard / deadlocked prune).
3. The fail-closed rule cited does not reach this shape. It governs an *absent/unmarked* value (e.g. `mandatory` undefined). Here the author supplied an explicit expression and the evaluator returns its standard boolean meaning. The "no condition" encoding the grammar actually provides is omitting `conditionExpression` (rejectMalformedTransitionCondition skips it at execution.ts:189, and checkBranchDefaults treats it as the default edge at transition-gate.ts:523-524) — an LLM emitting `ALL([])` for "no additional conditions" is speculation, not evidence.
4. The claimed "oversight polarity" is the ratified sibling's semantics. `rph-assurance/src/applicability.ts:52-54` — the DOC-007 §18 ApplicabilityExpression DSL — is the same `.every()`/`.some()` fold with no `.min(1)`. ALL([])=true / ANY([])=false is one consistent fold, not an asymmetric mistake. And `execution-view.ts:319/321` renders it honestly as `all of ()`, so a reviewer looking at the plan sees the vacuity.

WHAT THE FINDING GETS RIGHT (why MINOR, not NONE). The coverage gap is real and I verified it: `grep -rn "operands: \[\]|all of \(\)|any of \(\)"` across all `*.test.ts` and the rph-demo e2e specs returns NOTHING outside other reviewers' zz- scratch files. condition-grammar.test.ts:79-84 exercises ALL/ANY/NOT only with non-empty operand lists; execution-view.test.ts:486-487 likewise. So the `: 'all of ()'` / `: 'any of ()'` fallback branches at execution-view.ts:319/321 are uncovered, and the evaluator's degenerate case is unpinned. That is worth two assertions in condition-grammar.test.ts to pin the polarity — a test-hygiene item, not a shipped defect, and it should not be reported as a MAJOR fail-open guard.

</details>


## F-42 · [PLAUSIBLE] [MAJOR] DWP-04's "Both plan-ACTIVE-guarded" is implemented as one guard, and the shipped test asserts the OPPOSITE of DWP-04's stated acceptance test

- **Lens:** `doc-fidelity`
- **Site:** `packages/rph-application/src/handlers/execution.ts:1081-1096 (enterExecutionStepWait) vs DR-004 §9 DWP-04, DS-004 §6 D6`

**Claim.** DS-004 D6: "`EnterExecutionStepWait` (RUNNING→WAITING ...) + `ResolveExecutionStepWait` ... **Both plan-ACTIVE-guarded**." DR-004 DWP-04 repeats it three times: outcome "Both plan-ACTIVE-guarded"; required_changes "enterExecutionStepWait: ... plan-ACTIVE precheck"; invariant "plan-ACTIVE required (RPH-EXE-002)"; and its test list demands "wait/resolve under non-ACTIVE plan REJECT". Shipped: enterExecutionStepWait (execution.ts:1081-1096) has NO precheck at all — only requireFrom ['RUNNING'] — and its comment overrules the design in prose ("there is DELIBERATELY no plan-ACTIVE precheck"). resolveExecutionStepWait (:1119) does have it. The acceptance test was inverted rather than satisfied: execution-start-gate.test.ts:613 is titled "permits a wait under a NON-ACTIVE plan but REFUSES the resume" and asserts `wait(1,'blocked').status === 'ACCEPTED'` on a CANCELLED plan. DR-004 §15 records "Divergences from DS-004: none intended; §19 to disclose any" and §19 discloses none, so this reversal is nowhere on the record.

**Failure scenario.** Activate a plan, start s1 (RUNNING), CancelExecutionPlan (status CANCELLED). Dispatch EnterExecutionStepWait{stepId:s1} — ACCEPTED. A new ExecutionStepWaiting fact is appended to a terminal plan's governed stream and s1 lands in WAITING, from which the only legal moves are Cancel or a Resolve the engine now refuses. Anyone auditing DWP-04's acceptance criteria ("wait ... under non-ACTIVE plan REJECT") reads a criterion that the suite proves false.

**Suggested fix.** Pick one and record it: either add the plan-ACTIVE precheck to enterExecutionStepWait and flip the test, or amend DS-004 D6 / DR-004 DWP-04 (and add the divergence to DR-004 §19) to state that suspend is cleanup-shaped like Cancel/Fail and is deliberately ungated.

<details><summary>Code-semantics verifier evidence</summary>

Every factual claim traced to real code and verified; the harm claim does NOT survive, so severity drops MAJOR -> MINOR. This is an undisclosed doc/roadmap divergence, not a runtime defect.

WHAT IS TRUE (code, verified byte-exact):
1. `packages/rph-application/src/handlers/execution.ts:1081-1096` — `enterExecutionStepWait` calls `advanceStep` with ONLY `stepId/target:'WAITING'/eventType:'ExecutionStepWaiting'/requireFrom:['RUNNING']/eventPayload`. There is no `precheck` key. Its comment (:1076-1078) says: "like Cancel/Fail and UNLIKE Start/Retry/Resolve — there is DELIBERATELY no plan-ACTIVE precheck: RPH-EXE-002 forbids OPENING work under a superseded/terminal plan, not recording that a running step is blocked."
2. `resolveExecutionStepWait` (:1109-1131) DOES carry the plan-ACTIVE precheck ("Cancel the step instead").
3. No hidden upstream gate exists. `advanceStep` (:598-676) reads the plan, runs `precheck` (absent here), then `requireFrom`, then `checkTransition` — it never consults `plan.status`. JAN-CMDPRE `precondition: fromStates(...)` is used ONLY on plan-level `advanceStatus` calls (:326, 392, 440, 472, 514, 550, 585); no step command has one. `EnterExecutionStepWait` has no precondition in `packages/rph-contracts/vocab/m3-commands-events.json:961`.
4. The test is real and GREEN — I ran it: `bun run vitest run packages/rph-application/src/handlers/execution-start-gate.test.ts -t "NON-ACTIVE plan"` → 1 passed. `execution-start-gate.test.ts:613` "permits a wait under a NON-ACTIVE plan but REFUSES the resume" asserts `wait(1,'blocked').status === 'ACCEPTED'` after `CancelExecutionPlan`, and `stepStateOf(1) === 'WAITING'`.
5. The docs say the opposite, verbatim: DS-004 §6 D6 line 61 "Both plan-ACTIVE-guarded"; DR-004 line 177 outcome "Both plan-ACTIVE-guarded"; line 185 "enterExecutionStepWait: ... plan-ACTIVE precheck."; line 35 "plan-ACTIVE prechecks on start/skip/retry/wait hold"; line 199 tests "wait/resolve under non-ACTIVE plan REJECT". DR-004 §15 line 278 states "Divergences from DS-004: none intended; §19 to disclose any" and §19 (lines 300-319) discloses B1/B2/M1-M5/m1-m4 — nothing about the wait gate. So the reversal is genuinely nowhere on the record.

WHY THE HARM CLAIM FAILS (severity correction):
- No deadlock. `cancelExecutionStep` (:1000-1010) has `requireFrom: ['READY','QUEUED','RUNNING','WAITING']` and DELIBERATELY no plan-ACTIVE precheck (:993) — so a step parked in WAITING under a CANCELLED/SUPERSEDED plan always has a legal terminal exit. The finding itself concedes Cancel remains available.
- No RPH-EXE-002 breach on the rule's own wording ("opens NO new work"): a wait opens nothing, mints no attempt (`attemptsMadeForStep` counts `ExecutionStepStarted` only — proven by the sibling test at :597 "does NOT count the resume as an attempt"), and the plan is already terminal so no completion invariant is affected.
- The behaviour is precedented and internally consistent at FOUR sites, not an accident: `cancelExecutionStep`'s identical cleanup exemption is a ratified prior ruling (DR-003 line 141 "cancelExecutionStep: ... NO plan-ACTIVE precheck (cleanup allowed post-supersession)", line 266 "L3-M11 (cancel under superseded) → FIXED"); the read-model states the same split independently at `packages/rph-projections/src/execution-view.ts:170-171` — "Caller-side: skip and resolve need an ACTIVE plan; cancel is cleanup and wait suspends already-running work, so neither does."; plus the handler comment and the named test.
- Anti-vacuity is NOT violated: the guard that exists (`resolveExecutionStepWait`'s precheck) has a real kill test — :613 asserts REJECTED with code `RPH_ILLEGAL_STATE_TRANSITION` and message "Cancel the step instead", and the step stays WAITING.

RESIDUAL DEFECT (the MINOR): DR-004 DWP-04's required_changes/invariants/acceptance-tests assert a guard the shipped code deliberately omits, while §15/§19 affirmatively certify "no divergences". An auditor reconciling the roadmap against the code reads an acceptance criterion the green suite disproves. Fix = record it: amend DS-004 D6 / DR-004 line 177/185/199 to state that suspend is cleanup-shaped like Cancel (citing DR-003 L3-M11) and add the divergence to DR-004 §19. Changing the CODE to match the doc would be the wrong direction — it would strip a running step of the ability to record honestly that it is blocked on a plan that was just cancelled.

</details>

<details><summary>Test-evidence verifier evidence</summary>

TEST-EVIDENCE LENS — the behavioural half of the claim is disproved by an existing, deliberate, passing test; only a documentation-record residual survives.

1) An existing test already asserts the shipped behaviour AS INTENDED (not an accidental gap).
`packages/rph-application/src/handlers/execution-start-gate.test.ts:613-629` — "permits a wait under a NON-ACTIVE plan but REFUSES the resume (suspend != opening work, RPH-EXE-002)": activate plan, start s1, CancelExecutionPlan, then `wait(1,'blocked')` ACCEPTED / state WAITING, then `resolve(1)` REJECTED with `RPH_ILLEGAL_STATE_TRANSITION` + message containing "Cancel the step instead". The code carries the matching rationale in prose at `packages/rph-application/src/handlers/execution.ts:1074-1080` ("like Cancel/Fail and UNLIKE Start/Retry/Resolve — there is DELIBERATELY no plan-ACTIVE precheck"). I ran the suite: `bunx vitest run src/handlers/execution-start-gate.test.ts` -> 42/42 passed. So this is a recorded design decision with a covering test, not an unguarded/untested path.

2) Anti-vacuity is satisfied for the guard that DOES exist. `resolveExecutionStepWait`'s plan-ACTIVE precheck (execution.ts:1119-1127) is killed by that same test: line 625-627 asserts REJECTED + the exact message, so deleting/weakening the precheck turns it ACCEPTED and the suite goes RED. No unkilled mutant of the CMDPRE `requireFrom` kind here.

3) I wrote and RAN a temporary probe (created then deleted: `packages/rph-application/src/handlers/zz-probe-wait-gate.test.ts`; no source file modified; `git status` confirms it is gone) to test the finding's failureScenario directly. Observed output:
- PROBE A: after CancelExecutionPlan the plan is CANCELLED and the step is still RUNNING (plan cancel does NOT cascade steps). `EnterExecutionStepWait` -> ACCEPTED, step WAITING. Then `CancelExecutionStep` from WAITING under the CANCELLED plan -> ACCEPTED, step CANCELLED. **There is no deadlock**: the escape hatch the finding calls into question actually works, and the plan is already terminal so no terminal-success set has to be reached.
- PROBE B: `FailExecutionStep` on a RUNNING step under a CANCELLED plan -> ACCEPTED (step FAILED). i.e. the ungated close-out family (cancel at execution.ts:998-1011, fail at :863-869, wait at :1081-1096) is internally consistent, long-shipped behaviour — wait is not an outlier that uniquely violates RPH-EXE-002.
- RPH-EXE-002 is "opens NO new work". A wait opens none and consumes no attempt: `execution-start-gate.test.ts:597-604` proves a wait/resume cycle emits exactly one `ExecutionStepStarted` (retry cap untouched, RPH-EXE-008). The refused move is precisely the one that re-opens RUNNING (resolve). The invariant is upheld, not breached.

4) What actually survives is a DOC-RECORD gap, not a code defect. The doc quotes are accurate — `docs/Execution Plan View Design and Implementation Planning/JAN-EXECPLAN-DR-004 Detailed Implementation Roadmap.md` line 177 ("Both plan-ACTIVE-guarded"), line 185 ("enterExecutionStepWait ... plan-ACTIVE precheck"), line 191 ("plan-ACTIVE required"), line 199 tests list ("wait/resolve under non-ACTIVE plan REJECT"), and line 35. A repo-wide grep for the rationale phrases ("suspend != opening work", "DELIBERATELY no plan-ACTIVE") finds them ONLY in code/tests (execution.ts:993, execution.ts:1077, execution-start-gate.test.ts:613) and in no doc — so the divergence is genuinely undisclosed. But its weight is small and its severity mis-set: DR-004 records EVERY DWP as `delivery_state: NOT_STARTED` with a "Nothing built" footer, so the doc is wholesale stale about this build (that staleness is the premise of this review, and is presumably being reported once, program-wide). One more stale acceptance-criterion line inside an already-known-stale roadmap is a MINOR record-reconciliation item, not a MAJOR guard defect.

Bottom line: the claim "the acceptance test was inverted rather than satisfied" is literally true as a paper fact, but the behaviour it points at is safe, intentional, invariant-consistent, escape-complete and explicitly covered. Nothing in the runtime is broken, so the MAJOR framing is refuted; downgrade to a MINOR doc/divergence-register reconciliation (amend DS-004 D6 / DR-004 DWP-04 + add a §19 divergence entry stating suspend is cleanup-shaped like Cancel/Fail).

</details>

**Live check needed.** None for this finding — settled by running the shipped suite (42/42 pass) plus a deleted probe. One INCIDENTAL, out-of-scope observation from the probe worth a separate look by another lens: PROBE D showed `EnterExecutionStepWait` ACCEPTED on an UNDER_REVIEW (never-activated) plan whose step was seeded `stepState: 'RUNNING'` at ProposeExecutionPlan time — the same ungated family as cancel/fail, reachable only because propose accepts a non-QUEUED seeded stepState. That is a proposal-time seeding question, not the DWP-04 wait guard.


## F-43 · [PLAUSIBLE] [MINOR] ALL with an empty operands array is an untested, always-TRUE guard the schema accepts — a fail-OPEN default in a fail-closed grammar

- **Lens:** `anti-vacuity`
- **Site:** `packages/rph-domain/src/condition-grammar.ts:129-130 (schema at :55-56)`

**Claim.** ALL/ANY are declared `z.array(ConditionExpressionSchema)` with no `.min(1)`, so `{op:'ALL',operands:[]}` parses; evaluateCondition returns `expr.operands.every(...)`, and `[].every(...)` is TRUE. Verified live: ConditionExpressionSchema.safeParse({op:'ALL',operands:[]}).success === true and evaluateCondition({op:'ALL',operands:[]}, subject) === true, while ANY([]) === false. proposeExecutionPlan's rejectMalformedTransitionCondition (execution.ts:183-210) accepts it — the expression parses and conditionStepRefs returns [], so there is no dangling ref to catch. Grep-proven zero coverage: the string `operands: []` appears NOWHERE in the repo, so neither branch is tested; condition-grammar.test.ts:79-84 exercises ALL/ANY only with two operands. The polarity asymmetry with ANY([]) (correctly false) shows this is an unconsidered default, not a decision, and it contradicts the surface's stated rule that an absent value takes the SAFE interpretation.

**Failure scenario.** Author a BRANCH whose FIRST conditional out-edge carries `{op:'ALL',operands:[]}` (the natural shape produced by a generator that built an empty conjunction, e.g. a template whose operand list came back empty). Propose ACCEPTS it. At runtime selectBranchEdge's first-match takes that arm unconditionally on every evaluation, so the SEQUENTIAL default and every later conditional arm become permanently unreachable, and branchExcludes marks them dead — the plan's declared branching silently degenerates to one fixed path, with the not-taken arms offered for prune. `NOT(ANY([]))` reaches the same always-true a second way. No test detects any of it, and execution-view.ts:319 renders it honestly as 'all of ()' without flagging it.

**Suggested fix.** Add `.min(1)` to both ALL and ANY operand arrays in ConditionExpressionSchema so an empty combinator is refused at propose (RPH_VALIDATION_SCHEMA_FAILED), and add the two evaluator cases as regression tests. If an empty ALL must remain parseable for some authoring reason, make evaluateCondition return false for it explicitly and say so in the comment — the fail-closed direction.

<details><summary>Code-semantics verifier evidence</summary>

The finding's mechanical facts are real but its defect framing collapses on four independent grounds; the failureScenario describes correct declared semantics, not a code defect.

(a) CODE FACTS CONFIRMED (raw bytes clean, `sed -n '54,57p;128,133p' … | cat -v` shows no control chars). condition-grammar.ts:55-56 `z.strictObject({ op: z.literal('ALL'), operands: z.array(ConditionExpressionSchema) })` (no .min(1)); :129-132 `case 'ALL': return expr.operands.every(...)` / `case 'ANY': return expr.operands.some(...)`. NOTE the finding mis-cites the propose guard as "execution.ts:183-210" in rph-domain — that range is `StepSkipInput`/`canSkipStep`; the real guard is packages/rph-application/src/handlers/execution.ts:183-210 `rejectMalformedTransitionCondition`, and it does accept an empty combinator (safeParse succeeds; `conditionStepRefs` returns [] so the dangling-ref check at :199 finds nothing).

(b) ALL([])=true / ANY([])=false is the CORRECT identity of conjunction/disjunction over the empty set, not an unconsidered default. The finding cites the polarity asymmetry as evidence of accident; it is precisely what correctness requires. The repo's RATIFIED sibling grammar is identical: packages/rph-assurance/src/applicability.ts:52-54 `case 'ALL': return expr.operands.every(...)` / `case 'ANY': return expr.operands.some(...)`, also with no min(1) (DOC-007 §18 DSL). And this very surface EXPLICITLY handles the empty case in its renderer — execution-view.ts:319 `return c.operands.length ? `all of (${...})` : 'all of ()';` — proving the empty combinator was considered here, which directly contradicts the "unconsidered default" premise the finding rests on.

(c) The fail-closed rule cited ("an unmarked/ABSENT value defaults to the SAFE interpretation", e.g. `mandatory` undefined ⇒ TRUE) governs an absent value. `operands: []` is a PRESENT value with defined meaning; no default is being selected, so the rule is not engaged.

(d) DECISIVE — the proposed fix closes nothing. The grammar neither can nor attempts to forbid tautological guards. `{op:'ATTEMPTS',stepId:'s1',cmp:'>=',value:0}` and `{op:'OUTPUT_COUNT',stepId:'s1',cmp:'>=',value:0}` are unambiguously well-formed and unconditionally true against ANY subject (condition-grammar.ts:124-126: `numericCompare(step?.outputArtifactIds.length ?? 0, cmp, value)` / `numericCompare(step?.attemptsMade ?? 0, cmp, value)`). Therefore the entire stated failureScenario — first CONDITIONAL arm of a BRANCH always matches at selectBranchEdge (transition-gate.ts:115-118 `for (const e of outEdges) { if (!isConditionalEdge(e)) return e; if (evaluateGuard?.(e, plan)) return e; }`), later arms + the SEQUENTIAL default become permanently NEUTRALIZED/dead via branchExcludes (:171-172) — is fully reachable through indisputably valid expressions with or without `.min(1)`. That outcome is the AUTHOR'S declared branch logic executing exactly as specified (a BRANCH selects one arm; the not-taken arms are legitimately offered for prune), not a kernel fault. `.min(1)` would ban one spelling of a tautology out of infinitely many.

(e) NO UNKILLED GUARD (CON-000 B7). `.every` is a combinator, not a guard, and it IS mutation-killed by existing tests: mutating `.every`→`.some` makes condition-grammar.test.ts:81 (`ev({op:'ALL',operands:[{STEP_SUCCEEDED s1},{STEP_SUCCEEDED s3}]})` expected `false`, with s3 QUEUED) go RED. What is genuinely untested is one edge case of a total function — a coverage nit, explicitly out of scope for this review's "no style nits" rule.

(f) The claimed origin ("a generator that built an empty conjunction") does not exist in this repo. Grep for `operands`/`conditionExpression` across apps/rph-demo yields only e2e fixtures (e2e/execution-flow.e2e.ts:63 `condEdge`) and a pass-through projection (src/routes/undertakings/[id]/+page.server.ts:140-141). Conditions arrive verbatim in the authored ProposeExecutionPlan payload and are stored unmodified (handlers/execution.ts:264 `transitions: p.transitions`); every consumer only `safeParse`s (handlers/execution.ts:119, execution-view.ts:261/301), so no path can turn a non-empty operand list into an empty one.

Conclusion: no state/command sequence produces an outcome that violates a governing rule; the behaviour is the standard, repo-consistent vacuous-truth identity of a correctly-polarized combinator, and the only real residue is an untested edge case of a mutation-killed pure function.

</details>

<details><summary>Test-evidence verifier evidence</summary>

TEST-EVIDENCE VERDICT: CONFIRMED. No existing test proves the behaviour works; a live end-to-end probe reproduced exactly the claimed failure, and the coverage gap is total.

=== 1. COVERAGE GAP — proven exhaustively, not sampled ===
Repo-wide grep for every combinator construction site (`op: 'ALL'|'ANY'|'NOT'`, excluding node_modules/dist/.svelte-kit) returns only FIVE test constructions of ALL/ANY on this surface, and EVERY one carries >=1 operand:
- packages/rph-domain/src/condition-grammar.test.ts:27-34 (ALL with 3 operands, schema-parse), :80-82 (ALL x2 / ANY x2 operands, evaluator), :117-121 (ALL with 3, conditionStepRefs)
- packages/rph-projections/src/execution-view.test.ts:486-487 (describeCondition, ALL[leaf,leaf] / ANY[leaf])
The string `operands: []` appears NOWHERE outside my probe. packages/rph-domain/src/properties.test.ts contains zero references to the condition grammar (grep for "condition|Condition" returns nothing), so there is no fast-check generator that could stumble into an empty array either. Therefore mutating `evaluateCondition`'s ALL case from `expr.operands.every(...)` to `expr.operands.length > 0 && expr.operands.every(...)` — the only input on which the two differ is the empty array — CANNOT turn any test red. That is an unkilled mutant by construction (JPWB-CON-000 B7).
Near-miss that does NOT cover it: execution-view.test.ts:491 lists `{ op: 'ALL' }` (operands field ABSENT) among unparseable inputs — a different case (missing required field). And execution-view.ts:319-321 renders `'all of ()' / 'any of ()'` for the empty list, i.e. the RENDERER author handled empty gracefully, but that is a display concern and is itself untested; it is not a semantic decision about truth polarity.

=== 2. LIVE BEHAVIOUR — temporary probe (written, run, then DELETED; no source file touched) ===
Probe at packages/rph-application/src/handlers/zz-probe-empty-all.test.ts, run with `bunx vitest run ... --disableConsoleIntercept`, real SqliteStorageAdapter + Engine, verbatim output:
  ALL[] parses: true
  ANY[] parses: true
  eval ALL[]: true
  eval ANY[]: false
  eval NOT(ANY[]): true
  stepRefs ALL[]: []
  PROPOSE status: ACCEPTED {}
  selectedTransitionId: plan_...K20-t1-2
  start s2 (empty-ALL arm): ACCEPTED
  start s3 (genuinely-true arm): REJECTED — RPH_ILLEGAL_STATE_TRANSITION "every in-edge is neutralized — the step is unreachable (it should be pruned) (RPH-EXE-005)"
  start s4 (SEQ default): REJECTED
  prune s3: ACCEPTED SKIPPED
  prune s4: ACCEPTED SKIPPED
  PROPOSE NOT(ANY[]) status: ACCEPTED {}
Plan shape: s1 BRANCH -> [ CONDITIONAL{op:'ALL',operands:[]} -> s2 ; CONDITIONAL{op:'STEP_SUCCEEDED',stepId:s1} -> s3 ; SEQUENTIAL default -> s4 ]. After start(1)+complete(1), arm s3's guard is GENUINELY TRUE, yet the vacuous empty-ALL arm wins first-match, is RECORDED as `selectedTransitionId` (DWP-09 makes it permanent, not re-derivable), and both the genuinely-true arm and the SEQUENTIAL default are neutralized and pruned to SKIPPED. The declared 3-way branch silently degenerates to one fixed path. `NOT(ANY([]))` reaches the same always-true a second way and also proposes ACCEPTED.

=== 3. WHY NOTHING CATCHES IT ===
- packages/rph-domain/src/condition-grammar.ts:55-56 — `operands: z.array(ConditionExpressionSchema)` with no `.min(1)`.
- packages/rph-domain/src/condition-grammar.ts:129-130 — `expr.operands.every(...)`; `[].every` is vacuously true (asymmetric with ANY at :131-132, correctly false).
- packages/rph-application/src/handlers/execution.ts:183-210 `rejectMalformedTransitionCondition` — the expression PARSES, and `conditionStepRefs` returns `[]`, so there is no dangling ref to catch; both limbs pass.
- packages/rph-domain/src/transition-gate.ts:519-550 `checkBranchDefaults` — validates only edge SHAPE (one unconditional default, last); it never inspects the condition's content, so a degenerate always-true first arm is well-formed to it.

=== 4. HONEST COUNTER-ARGUMENT (why MINOR, not higher) ===
`ALL([]) === true` is the canonical vacuous-truth convention, and the sibling packages/rph-assurance/src/applicability.ts:52 uses the identical `.every` semantics — so a reviewer can argue the polarity itself is conventional rather than a bug. What is NOT defensible is the pair of gaps that convention leaves open on THIS surface: (a) propose accepts a degenerate branch guard that can never be false, against the surface's stated fail-closed rule (an absent/unmarked value takes the SAFE interpretation), and (b) zero tests pin either polarity, so the behaviour can silently flip in either direction. The finding's own MINOR rating is right — triggering it needs a degenerate authored expression, no live plan is corrupted, and the plan still reaches a terminal-success completion (it just takes the wrong single path). It is not a deadlock and not a fail-open on an authorization boundary.

</details>

**Live check needed.** None — settled live. Confirming steps if re-verification is wanted: (1) `cd JanumiCode/janumiprofessionalworkbench/packages/rph-domain && bunx vitest run src/condition-grammar.test.ts` and observe no test supplies an empty operands array; (2) add `.min(1)` to packages/rph-domain/src/condition-grammar.ts:55-56 and run the full rph-domain + rph-application + rph-projections suites — they stay GREEN, proving no existing test depends on the empty-combinator behaviour in either direction (the mutation-kill proof). Suggested fix as filed: `.min(1)` on both ALL and ANY operand arrays so propose rejects with RPH_VALIDATION_SCHEMA_FAILED, plus regression tests asserting the refusal and the ANY([]) polarity; if empty must stay parseable, make evaluateCondition return false for ALL([]) explicitly and say so in the comment.


## F-44 · [PLAUSIBLE] [MINOR] A vacuously-true guard (ALL with empty operands) is accepted at propose and makes a BRANCH's mandated LAST default permanently unreachable

- **Lens:** `branch`
- **Site:** `packages/rph-domain/src/condition-grammar.ts:55 (z.array with no .min(1)) and :130 (ALL evaluation); packages/rph-domain/src/transition-gate.ts:519-548 (checkBranchDefaults)`

**Claim.** `ConditionExpressionSchema` accepts `{op:'ALL', operands:[]}` (:55 — plain `z.array`, no `.min(1)`), and `evaluateCondition` returns `[].every(...)` === TRUE (:130). `conditionStepRefs` returns [] so propose's ref-resolution (execution.ts:199) finds nothing to reject. `checkBranchDefaults` goes to real trouble to guarantee first-match always resolves — exactly one unconditional default, and it must be LAST, precisely so 'an earlier default makes every conditional arm after it unreachable' (transition-gate.ts:546) — but a constant-true conditional arm in first position defeats that rule from the other side. `ANY` with empty operands is FALSE, which is the correct polarity, so the pair looks like an oversight rather than a decision. `describeCondition` (execution-view.ts:319-321) renders it as 'all of ()'.

**Failure scenario.** VERIFIED: `ConditionExpressionSchema.safeParse({op:'ALL',operands:[]}).success === true` and `evaluateCondition({op:'ALL',operands:[]}, {steps:{}}) === true`. Plan: s1 BRANCH; edge A = s1→s2 CONDITIONAL with conditionExpression {op:'ALL',operands:[]}; edge B = s1→s3 SEQUENTIAL default (last). ProposeExecutionPlan → ACCEPTED (both the graph and the condition limbs pass). At resolution `selectBranchEdge` returns edge A unconditionally, so s3 is pruned on every run and the declared default the validator insisted on is dead code. `NOT({op:'ANY',operands:[]})` reaches the same constant true by a second route.

**Suggested fix.** Add `.min(1)` to both ALL and ANY operand arrays in condition-grammar.ts:55-56 (an empty combinator is an authoring error, not a constant), or reject a guard whose truth value is independent of the subject during rejectMalformedTransitionCondition. Either way add the empty-operands cases to condition-grammar.test.ts, which currently tests ALL/ANY only at arity 2.

<details><summary>Code-semantics verifier evidence</summary>

Every literal code fact in the finding is TRUE (I ran them), but the harm it infers does not hold — the behaviour is the correct, intended semantics of an author-written constant-true guard, not a defect. Raw bytes of condition-grammar.ts:45-59 and :125-135 inspected with `cat -v`: no hidden control characters, `z.array(...)` genuinely has no `.min(1)`.

EXECUTED PROBE (temporary vitest file in packages/rph-application/src/handlers, run under Node — `node node_modules/vitest/vitest.mjs run`; file deleted after):
  ALL[] parse = true / ANY[] parse = true / ALL[] eval = true / ANY[] eval = false   ← as claimed
  P1 (BRANCH s1; cedge s1→s2 CONDITIONAL {op:'ALL',operands:[]}; gedge s1→s3 SEQUENTIAL last):
    propose = ACCEPTED; after complete(s1): selectedTransitionId = t1-2; start(s2)=ACCEPTED;
    start(s3)=REJECTED "every in-edge is neutralized — the step is unreachable (it should be pruned) (RPH-EXE-005)";
    prune(s3)=ACCEPTED; final states = SUCCEEDED / RUNNING / SKIPPED.
So: no deadlock, no invariant breach, no lost step — the plan reaches the terminal-success set normally.

WHY THIS IS NOT A DEFECT (three independent refutations):

1. The suggested fix does not close the class the finding names, because the class is not "empty operands" — it is "a constant-true guard", which is an authoring choice the grammar exists to express. CONTROL P2 in the same probe: `{op:'ATTEMPTS', stepId:s1, cmp:'>=', value:0}` — arity-correct, ref-resolving, survives any `.min(1)` — gives the IDENTICAL outcome: `P2 propose = ACCEPTED; P2 selectedTransitionId = t1-2`. `.min(1)` on lines 55-56 would change nothing about the described failure.

2. The idiom is already SHIPPED AND ASSERTED as intended. `packages/rph-application/src/handlers/zzz-testlens-branch-own-result.test.ts:170-177` guards a BRANCH on its own step: `{op:'STEP_SUCCEEDED', stepId: stepId(1)}` … `expect(stepOf(1)?.selectedTransitionId).toBe(`${PLAN}-t1-2`)`. That guard is constant-true in every reachable evaluation, because branch resolution only ever runs once the source is terminal-success — `transition-gate.ts:169`: `if (source === undefined || !TERMINAL_SUCCESS.has(source.stepState)) return false; // unsettled ⇒ excludes nothing`, and `execution.ts:773-778` records the selection at CompleteExecutionStep. If "propose accepts a guard that is true at every evaluation" were a defect, this deliberate, tested idiom would be the first instance of it.

3. The finding misreads the rule it says is defeated. `checkBranchDefaults` (transition-gate.ts:515-517) states its own contract: "First-match returns on the first unconditional edge it meets, so an earlier default would make every later conditional arm dead" — i.e. it forbids a STRUCTURAL, statically-decidable shadowing so that "branch first-match always RESOLVES" (:538). With a constant-true first arm first-match still resolves — to arm A — and `selectBranchEdge` (:115-119) returns the default only as the fallback it was declared to be. The default's contract is resolution-guarantee, not take-guarantee; a never-taken default is not "dead code the validator insisted on", it is the declared fallback of a guard the author wrote as always-true.

Also incorrect in the finding's reasoning: "ANY with empty operands is FALSE, which is the correct polarity, so the pair looks like an oversight". ALL=[]→true and ANY=[]→false are the two standard identity elements of conjunction/disjunction; the pair is mathematically consistent, which is evidence AGAINST oversight, not for it. And the fail-closed rule is honoured where it actually applies: a missing step yields false at every leaf (`step?.` at :120-128) and a runtime-unparseable expression yields false (`execution.ts:120` — `parsed.success && evaluateCondition(...)`).

Residual, non-defect observation (not worth a finding): `{op:'ALL',operands:[]}` is more plausibly an authoring slip than a deliberate constant, so an advisory authoring lint ("this guard's value is independent of the subject") would be a usability improvement — but it must cover ATTEMPTS>=0 and NOT(ANY[]) too (P3 confirmed: `P3 propose = ACCEPTED; selectedTransitionId = t1-2`), and it is an ergonomics nicety, not a correctness gap on this surface.

</details>

<details><summary>Test-evidence verifier evidence</summary>

RAN A TEMPORARY PROBE (packages/rph-application/src/handlers/zzte-emptyoperands.probe.test.ts, since DELETED; no source file touched). Every mechanical claim reproduced exactly, and NO existing test refutes any of it.

Probe output (bunx vitest run --silent=false):
[A] parse ALL[]: true   parse ANY[]: false-negative? no — parse ANY[]: true
[A] eval ALL[]: TRUE    eval ANY[]: false    eval NOT(ANY[]): TRUE    refs ALL[]: []
[B] ProposeExecutionPlan (s1 BRANCH; edge1 = s1->s2 CONDITIONAL with conditionExpression {op:'ALL',operands:[]}; edge2 = s1->s3 SEQUENTIAL default LAST) -> ACCEPTED, no error
[C] start s1 ACCEPTED -> complete s1 ACCEPTED -> s1.selectedTransitionId = "...-t1-2" (the constant-true arm is RECORDED as the decision) -> start s2 ACCEPTED -> start s3 REJECTED: "Cannot start step ...-s3: every in-edge is neutralized — the step is unreachable (it should be pruned) (RPH-EXE-005)." -> prune s3 ACCEPTED -> s3 = SKIPPED.
So the LAST unconditional default that checkBranchDefaults (transition-gate.ts:536-547) insists every BRANCH declare is unreachable on every run of this plan, and the branch's recorded decision permanently freezes that.

COVERAGE GAP (the test-evidence half): `grep -rn "operands: \[\]" packages/ apps/` over the whole repo returns ZERO hits. condition-grammar.test.ts exercises ALL/ANY only at arity >= 1 (line 80-82 arity 2; lines 30 and 121 arity 1). Nothing anywhere pins the truth value of an empty combinator, so the ALL[]-is-true / ANY[]-is-false asymmetry at condition-grammar.ts:129-132 is entirely unpinned — you can flip either polarity and the suites stay green. That is the coverage gap the finding asserts, verified.

GOVERNING-RULE HOOK that makes this a defect rather than a nit: fail-closed. An absent operand list is an unmarked value, and it defaults to the arm-TAKING (open) direction for ALL while its sibling ANY defaults closed. `conditionStepRefs` returns [] so the propose-time ref-resolution at rph-application/src/handlers/execution.ts:199 has nothing to reject, and ConditionExpressionSchema (condition-grammar.ts:55-56) has no `.min(1)`. An empty combinator is far more likely a construction/serialization slip (an author or UI built the operand array and never pushed into it) than an intended constant, and today it silently becomes "always take this arm".

IMPORTANT CORRECTION TO THE FINDING'S FRAMING AND ITS PROPOSED FIX — probe D: the SAME outcome is reachable through a fully well-formed, non-empty guard. `{op:'ATTEMPTS', stepId:s1, cmp:'>=', value:0}` on the first arm is also ACCEPTED at propose and is also constant-true, and `.min(1)` would not catch it. So the durable claim is NOT "a constant-true guard defeats checkBranchDefaults" (tautology detection is undecidable in general, and that validator only ever claimed the STRUCTURAL property that first-match always RESOLVES — which still holds: selectBranchEdge never returns undefined here). The durable claim is narrower: an EMPTY combinator is an authoring error accepted as a fail-OPEN constant, with zero test coverage of its polarity. Fix accordingly: `.min(1)` on both ALL and ANY operand arrays at condition-grammar.ts:55-56, plus arity-0 cases in condition-grammar.test.ts, plus a propose-rejection test in execution-start-gate.test.ts (today that propose is ACCEPTED).

NO SAFETY BREACH BEYOND THAT: the probe shows no deadlock (s3 prunes to SKIPPED, and the existing passing test "selects one arm (first-match), prunes the not-taken arm to SKIPPED, and completes" at execution-start-gate.test.ts:401-419 proves the plan then completes), no arm resurrection, no INV-5 crossing, and the DWP-09 resolved-once behaviour is intact. Hence MINOR, confirming the raiser's own severity.

</details>

**Live check needed.** None — settled by direct execution. The probe file was deleted; to re-observe, recreate it or add to packages/rph-domain/src/condition-grammar.test.ts: expect(evaluateCondition({op:'ALL',operands:[]}, {steps:{}})).toBe(false) — RED today (returns true) — and in packages/rph-application/src/handlers/execution-start-gate.test.ts: proposeBranch([cedge(1,2,{op:'ALL',operands:[]}), gedge(1,3)]) expecting REJECTED — RED today (ACCEPTED).


## F-45 · [PLAUSIBLE] [MINOR] The attempt read-model drops both wait events — a WAITING step's open attempt renders as RUNNING, contradicting the step row on the same page

- **Lens:** `wait-resume`
- **Site:** `packages/rph-projections/src/execution-attempts.ts:141-145 (STEP_APPLIERS) and apps/rph-demo/src/routes/undertakings/[id]/+page.svelte (step-attempt render of `at.state`)`

**Claim.** executionAttempts folds the Execution* stream through a three-entry STEP_APPLIERS map — ExecutionStepStarted, ExecutionStepSucceeded, ExecutionStepFailed. ExecutionStepWaiting and ExecutionStepWaitResolved are absent, and unlike ExecutionStepRetried (whose omission is documented as deliberate at :137) there is no comment acknowledging them. DWP-04's stated purpose (execution.ts:1100-1102) is that the resume becomes 'a governed-stream FACT rather than a state change invisible to replay' — but the only consumer that folds that stream ignores both halves, so the wait is still invisible to every event-derived read-model. buildConditionSubject (condition-grammar.ts:208+) likewise folds only Started/Succeeded. The UI then renders two views of the same step from two different sources: the step row's tone comes from the aggregate's stepState (execution-view.ts:154, WAITING -> 'pending'), while the attempt row beneath it renders `at.state` from this fold.

**Failure scenario.** Activate a plan, StartExecutionStep(s1), EnterExecutionStepWait(s1,'blocked on external approval'). Load the undertaking page: the step row shows WAITING, and directly beneath it the attempt list shows '#1 RUNNING' — the same step in two contradictory states one line apart. If the plan is then superseded (see the SUPERSEDED-unreachable finding), attempt #1 stays 'RUNNING' with no completedAt permanently, so the attempt read-model reports an open, executing attempt on a dead plan indefinitely. attemptsByStep(...).latestState (execution-attempts.ts:184) reports 'RUNNING' for the same step.

**Suggested fix.** Either register appliers for the two events (Waiting -> draft.state = 'WAITING'; WaitResolved -> draft.state = 'RUNNING') so the attempt record tracks the suspension the events exist to make replayable, or — if §10.4 deliberately treats a suspended attempt as still RUNNING — add an explicit comment next to the ExecutionStepRetried note at :137 stating that omission and its rationale, and add a test pinning it, so the choice is declared rather than inferred from silence.

<details><summary>Code-semantics verifier evidence</summary>

I tried to refute this and could not — the mechanism is real, and I proved it by execution, not by reading. Two of the finding's supporting claims are wrong, but neither is load-bearing; the core defect stands at MINOR.

## 1. The applier gap is real (verbatim, `packages/rph-projections/src/execution-attempts.ts:137-145`)

```
// ExecutionStepRetried is intentionally absent (a re-queue marker; the next Started opens attempt n+1).
// A Map (not an object literal) so a hostile/degenerate event.eventType — e.g. "__proto__" — resolves to
// undefined and is ignored, exactly as the original if/else-if chain did (an object literal would surface
// Object.prototype and throw on the ?.() invocation).
const STEP_APPLIERS = new Map<string, StepApplier>([
	['ExecutionStepStarted', applyStepStarted],
	['ExecutionStepSucceeded', applyStepSucceeded],
	['ExecutionStepFailed', applyStepFailed]
]);
```

Three entries. `ExecutionStepWaiting` / `ExecutionStepWaitResolved` are absent, and — unlike `ExecutionStepRetried`, whose omission is declared on line 137 — nothing declares theirs. The fold at :159 is `STEP_APPLIERS.get(event.eventType)?.(...)`, so an unregistered event is a silent no-op and `draft.state` keeps the `'RUNNING'` set at :92.

The event types are the right ones: `packages/rph-application/src/handlers/execution.ts:1086` emits `eventType: 'ExecutionStepWaiting'` and `:1112` emits `'ExecutionStepWaitResolved'`.

## 2. Empirically confirmed (I ran it, then deleted the probe)

Temp test `packages/rph-projections/src/zzz-verify-wait-attempt.test.ts`, run under `bunx vitest run --silent=false` (npm is blocked by devEngines; bun works here):

```
[PROBE] attempts after wait = [{"executionPlanId":"plan-1","stepId":"s1","attemptNumber":1,
  "idempotencyKey":"s1#1","state":"RUNNING","runtimeBindingId":"rb-1",
  "startedAt":"2026-01-01T00:00:00Z","aiNoBinding":false}]
[PROBE] latestState = [... "attemptCount":1,"latestState":"RUNNING"}]
```

`[ExecutionStepStarted, ExecutionStepWaiting]` → `state: "RUNNING"`, no `completedAt`, `latestState: "RUNNING"`. Exactly as the finding predicts.

## 3. The UI contradiction is real

- `apps/rph-demo/src/routes/undertakings/[id]/+page.svelte:290` — step row: `<span class="st {s.tone}" data-testid="step-state">{s.stepState}</span>` (from the aggregate; `execution-view.ts:154` maps `WAITING: 'pending'`).
- Same file `:383`, inside the `{#if data.attemptsByStepId[s.id]?.length}` block opened at `:378` — attempt row: `<span class="st {attemptTone(at.state)}">{at.state}</span>`, fed by `executionAttempts(events, stepTypeById)` at `+page.server.ts:174` with no post-processing.

So on one page, one line apart: step `WAITING`, attempt `#1 RUNNING`. No e2e pins it — `execution-plan.e2e.ts:251-275` and `execution-flow.e2e.ts:336-371` click wait/resolve and assert only `stepStateOf(...)`, never `step-attempt`. `execution-attempts.test.ts` has no wait test (its 10 cases cover start/succeed/fail/retry/advisory/rollup only).

## 4. Two of the finding's claims are WRONG — correct them before filing

- **REFUTED sub-claim:** "buildConditionSubject (condition-grammar.ts:208+) likewise folds only Started/Succeeded." The interpreter is *not* blind to WAITING. `buildConditionSubject(steps, events, planId)` seeds the accumulator from the **aggregate**, not the fold: `for (const s of steps) acc.set(s.id, { stepState: s.stepState, outputArtifactIds: [], attemptsMade: 0 })` (condition-grammar.ts:~214). The event fold only adds `attemptsMade` and outputs. `stepState` in the condition subject is correctly `WAITING`.
- **Overstated:** "the wait is still invisible to every event-derived read-model" / DWP-04's replay purpose defeated. The event *is* in the governed stream, and `advanceStep` (execution.ts:656-675) persists `stepState: args.target` on the aggregate alongside it. The suspension is recorded and replayable; only this one projection ignores it.

## 5. Why MINOR is the right severity (not higher)

I grepped every consumer of attempt `state` / `latestState` across `packages/**` and `apps/**` (excluding dist/.svelte-kit): the only reader is the Svelte render at `:383`. `attemptsByStep` is called by nothing but its own test. **No guard, gate, retry cap, or transition condition reads `attempt.state`** — `attemptsMadeForStep` counts `ExecutionStepStarted` events, untouched by this. The impact is display incoherence plus an undeclared modelling choice, not a wrong decision.

There is also a defensible reading under which `RUNNING` is *correct*: execution.ts:1104-1105 states "a wait/resume cycle continues the SAME attempt and does not consume the retry cap," and DOC-009 §10.4 declares `state text not null` with **no ratified attempt-state vocabulary** (verified in the Persistence design doc DDL, lines 842-868) — so a suspended-but-open try legitimately has no `completedAt`. That is precisely why this is a *declaredness* defect: the choice may be right, but it is inferred from silence next to a sibling omission (`Retried`) that *was* declared, and it produces a visible contradiction with no test pinning either interpretation. The finding's own suggested fix (register the appliers, OR add a declaring comment + pinning test) correctly offers both branches.

## 6. Corroboration the finding missed (same gap, terminal rather than transient)

My second probe case: `[ExecutionStepStarted, ExecutionStepCancelled]` → `{"state":"RUNNING", ...}` with no `completedAt`. `ExecutionStepCancelled` is likewise unregistered, so an attempt on a **terminally cancelled** step reports as an open, executing attempt forever. That is a strictly stronger instance of the finding's own "permanently RUNNING on a dead plan" scenario and should be folded into whichever fix is chosen (`execution-attempts.ts:141-145`).

**checkToConfirm as filed is sound** — read execution-attempts.ts:137-145; write the `[Started, Waiting]` projection test in execution-attempts.test.ts and assert `state`; it is `'RUNNING'` today. I have already run exactly that and it is.

(Note for the parent: the working tree currently carries other verifiers' probe artifacts — `packages/rph-application/src/handlers/zzz-*.test.ts`, `packages/rph-domain/{mutant,pristine}-src/`, and an uncommitted MUTANT-PROBE edit at execution.ts:1113 widening `resolveExecutionStepWait`'s `requireFrom` to `['WAITING','QUEUED']`. None affect this finding — `execution-attempts.ts` is unmodified — but that execution.ts line needs reverting.)

</details>

<details><summary>Test-evidence verifier evidence</summary>

I reproduced the behaviour empirically with a temporary probe (`packages/rph-projections/src/zzy-testevidence-probe.test.ts`, RUN then DELETED — `git status --porcelain packages/rph-projections/` is clean of it; no source file was modified). Observed output, verbatim:

  [A] after wait:  [{"stepId":"s1","attemptNumber":1,"idempotencyKey":"s1#1","state":"RUNNING","runtimeBindingId":"rb1","startedAt":"...","aiNoBinding":false}]
  [A] latestState: ["RUNNING"]
  [B] start→wait→resolve→succeed: ONE attempt, final state SUCCEEDED, completedAt set
  [C] start→cancel:     state "RUNNING", no completedAt
  [D] start→superseded: state "RUNNING", no completedAt

So the raw mechanical claim is true: the fold ignores both wait events and the attempt reads RUNNING. But the claim that this is a DEFECT does not survive the test/behaviour evidence.

1. THE "INVISIBLE TO REPLAY" PREMISE IS DISPROVED BY AN EXISTING TEST. `packages/rph-application/src/handlers/execution-start-gate.test.ts:576-595` — "records BOTH halves as governed-stream facts carrying the RESULTING state (the replay hole)" — asserts `ExecutionStepWaiting` payload `{stepId, waitReason, stepState:'WAITING'}` and `ExecutionStepWaitResolved` payload `{stepId, resolution, stepState:'RUNNING'}`, and the surrounding tests assert `stepStateOf(1)` is WAITING then RUNNING. `advanceStep` (execution.ts:657-673) writes `nextStep.stepState = target` into the committed aggregate AND emits the event in the same `commitState`, so the suspension is carried by BOTH the aggregate and the stream. DWP-04's stated purpose is therefore served; the attempt projection is a different read-model at a different granularity, not "the only consumer that folds that stream".

2. THERE IS NO CANONICAL ATTEMPT-STATE VOCABULARY TO VIOLATE. Persistence §10.4 (`docs/.../Persistence, Migration, Dual-Run, and Cutover Design.md:842-869`) declares `state text not null` with no enum, and the domain-model vocab records the open item verbatim: "Execution Attempt not in the Canonical interface … its fields are only defined by the persistence table" (`packages/rph-domain/vocab/m11-execution.json:270`). Nothing specifies WAITING as a legal attempt state; the suggested fix would MINT vocabulary. Conversely Persistence §35 (quoted at m11-execution.json:205) explicitly models attempts that stay NONTERMINAL — "classify each nonterminal attempt as one of {definitely not started; running with observable external ID; …}" — i.e. an open attempt with no completedAt on a suspended or dead plan is the MODELLED state, not a leak. The [D] "open attempt on a dead plan indefinitely" scenario is precisely what §35 reconciliation exists to consume.

3. THE OMISSION IS UNIFORM, NOT WAIT-SPECIFIC — evidence of design, not oversight. Probe [C]/[D] show `ExecutionStepCancelled` and `ExecutionPlanSuperseded` are equally absent from STEP_APPLIERS, as are Skipped/Pruned. The fold tracks exactly the three events that OPEN or CLOSE a bounded try, matching the module's stated contract (execution-attempts.ts:3-12: "one record per bounded try (§9.7)", "attempt_number = count(ExecutionStepStarted) ALONE"). A wait-only applier would make the projection inconsistent with its own siblings. And probe [B] confirms the wait/resume cycle correctly does NOT open a second attempt — the RPH-EXE-008 property the module actually guarantees is intact.

4. THE UI "CONTRADICTION" IS NOT A CODE DEFECT. `+page.svelte:378-393` renders the attempt list from `data.attemptsByStepId` (`+page.server.ts:173-180`) — these are attempt records, a different object from the step. "Step WAITING / attempt #1 RUNNING (open, unfinished)" is two facts about two objects, both true. Further, `attemptsByStep(...).latestState` cited in the failureScenario has NO production consumer at all: `grep -rn "latestState" --include=*.ts --include=*.svelte apps packages` returns only execution-attempts.ts and its own test, so that half of the scenario is inert.

5. ANTI-VACUITY (B7) DOES NOT APPLY. B7 governs GUARDS — a guard must have a test that goes red when weakened. There is no guard here; there is no mutant to kill. `execution-attempts.test.ts` (129 lines, 10 tests) pins every behaviour the module claims: attempt counting excluding Retried (:53), succeeded-only provenance (:69), replay stability (:78), the AI-no-binding advisory (:87-114), and the rollup (:116). The absence of a test for an event the fold deliberately does not consume is a documentation gap at most, and the reporting rules exclude style/doc nits.

RESIDUAL (not a defect, not reported): the only defensible remnant is the finding's own alternative — add a comment beside the ExecutionStepRetried note at :137 naming the wider "non-attempt-lifecycle events are not folded" rule. That is a comment, not a behaviour change.

</details>

**Live check needed.** TWO ENVIRONMENT HAZARDS from concurrent lenses, unrelated to this finding but they must be cleaned up before any gate run: (1) `packages/rph-application/src/handlers/execution.ts:1113` currently has SOURCE MUTATED IN THE WORKING TREE — `git diff` shows `requireFrom: ['WAITING']` on `resolveExecutionStepWait` replaced by the marker `// MUTANT-PROBE-2 deletion (revert)`. This is a live mutant, not committed code; it must be reverted (`git checkout -- JanumiCode/janumiprofessionalworkbench/packages/rph-application/src/handlers/execution.ts`) or the ResolveExecutionStepWait source guard is genuinely absent on disk. (2) An untracked probe file `packages/rph-projections/src/zzz-verify-wait-attempt.test.ts` ("TEMP verifier probe — delete after run") was left behind by another agent; I did not touch it. My own probe was deleted.


## F-46 · [PLAUSIBLE] [MINOR] STEP_SUCCEEDED and the gate's terminal-success set disagree about SKIPPED — two definitions of 'that predecessor is done', undocumented and untested

- **Lens:** `grammar`
- **Site:** `packages/rph-domain/src/condition-grammar.ts:122 vs packages/rph-domain/src/transition-gate.ts:17,26`

**Claim.** The interpreter has two distinct notions of a satisfied predecessor and they are not the same set. The barrier uses TERMINAL_SUCCESS = {SUCCEEDED, SKIPPED} (transition-gate.ts:17, isTerminalSuccessStepState :26) — SKIPPED is deliberately IN, which is load-bearing enough that inEdgeDisposition must test structural deadness BEFORE it (:217, the DWP-08 correction). The grammar's STEP_SUCCEEDED is literally `step?.stepState === 'SUCCEEDED'` (condition-grammar.ts:122) and excludes SKIPPED. So a predecessor that was legitimately waiver-skipped satisfies the barrier (the downstream BRANCH runs) but fails a STEP_SUCCEEDED guard over it (the arm flips). Nothing in the module comments, the DR-004 roadmap, or any test names this asymmetry, and the grammar offers no operator that means 'terminal-success' — an author who wants the barrier's notion has to hand-write {op:'ANY', operands:[STEP_SUCCEEDED(x), STEP_STATE(x,'SKIPPED')]}, which nothing documents.

**Failure scenario.** Plan: s0 -> s1(BRANCH) with s1's out-edges [t1: s1->s2 CONDITIONAL {op:'STEP_SUCCEEDED', stepId:'s0'}, t2: s1->s3 SEQUENTIAL default]. s0 is a mandatory:false step that the operator legitimately SKIPS (SkipExecutionStep, accepted). The in-edge barrier treats s0 as terminal-success (transition-gate.ts:217-226), so s1 is startable and runs. But the guard STEP_SUCCEEDED(s0) is FALSE, so the branch takes the default arm s3 — the author who wrote 'if s0 is done' gets the not-done branch, and DWP-09 records it permanently. The plan proceeds down the wrong arm with no error.

**Suggested fix.** Either add a STEP_TERMINAL_SUCCESS op that delegates to isTerminalSuccessStepState (so the grammar and the barrier share one definition, matching how isTerminalSuccessStep is re-exported rather than re-implemented in the projections), or — at minimum — document the asymmetry on STEP_SUCCEEDED at condition-grammar.ts:121 and add the paired assertion above so the distinction is a pinned decision.

<details><summary>Code-semantics verifier evidence</summary>

The finding's FACTS are right but its DEFECT claim is not: the two sets answer two different questions, and STEP_SUCCEEDED does exactly what its name, its spec, and its UI rendering all say. Raw-byte check first (`sed -n '110,130p' … | cat -v`): no hidden control characters, the literal is a plain `'SUCCEEDED'`.

1) The divergence is real but is a DELIBERATE difference of question, not two definitions of one thing.
- `packages/rph-domain/src/transition-gate.ts:16-17` scopes TERMINAL_SUCCESS to the EDGE question: "/** The terminal-SUCCESS step states — **a satisfied predecessor**. */ const TERMINAL_SUCCESS = new Set<string>(['SUCCEEDED','SKIPPED']);" — i.e. "does flow continue past this node".
- `condition-grammar.ts:121-122` answers an AUTHORED predicate about a specific committed fact: "case 'STEP_SUCCEEDED': return step?.stepState === 'SUCCEEDED';". It sits directly beside `case 'STEP_STATE': return step?.stepState === expr.state;` (:119-120) — the grammar is a family of literal-state predicates. There is no place in the codebase where the runtime uses the grammar to compute "predecessor satisfied": the barrier calls `isTerminalSuccessStepState`, never the evaluator, and the only consumers of the grammar are author-supplied `conditionExpression` envelopes.

2) The operator's contract is documented — the finding's "nothing names this" is a search claim, not a fact.
- DR-004 line 116 (the DWP-02 outcome) enumerates the leaves as "STEP_STATE(stepId, state), **STEP_SUCCEEDED(stepId)**, OUTPUT_COUNT…, ATTEMPTS…, RESULT_PATH…". Listing STEP_SUCCEEDED as a sibling of STEP_STATE specifies it as a literal-state predicate; nothing anywhere specifies it as "terminal-success".
- The human-facing rendering is literal too: `packages/rph-projections/src/execution-view.ts:310-311` → "case 'STEP_SUCCEEDED': return `step ${shortId(c.stepId)} succeeded`;", pinned by `execution-view.test.ts:476` (`/^step step_01ARZ3N… succeeded$/`) and asserted end-to-end at `apps/rph-demo/e2e/execution-flow.e2e.ts:203` (`transition-condition` contains 'succeeded'). An author reading the flow panel is told "succeeded", not "done". No mislabel exists for the hypothetical author to be misled by, and there is no condition-authoring UI in `apps/rph-demo/src` at all (grep for STEP_SUCCEEDED there returns only an unrelated test string) — every conditionExpression is hand-authored by someone who chose the op by name.

3) The failureScenario's "wrong outcome" is the CORRECT outcome for the predicate written. I traced it: with s0 an entry step (no in-edges) it stays in `liveStepIds` (transition-gate.ts:139), so edge s0→s1 passes the deadness test at :217, is terminal-success at :221, is unconditional → SATISFIED at :233, and s1 starts. `selectBranchEdge` (:115-118) then finds t1's guard false and returns the SEQUENTIAL default t2. That is precisely "s0 did not SUCCEED, take the default" — the arm the authored predicate selects. The scenario only reads as a defect under the assumption that the author meant "done" while typing an op called SUCCEEDED; a code-grounded defect cannot be manufactured from an author misreading an accurately-named, accurately-rendered, accurately-specified operator.

4) The "no operator means terminal-success" complaint is refuted by the grammar itself: `{op:'ANY', operands:[{op:'STEP_SUCCEEDED',…},{op:'STEP_STATE',…,state:'SKIPPED'}]}` is exactly the composition ALL/ANY/NOT exist for (`condition-grammar.ts:27-29`), and the finding concedes it works. A missing convenience alias for a two-term composition is an ergonomics wish, not a defect.

5) Anti-vacuity (B7) is satisfied for line 122 in the sense B7 governs. B7 targets guards that REFUSE; STEP_SUCCEEDED is a leaf predicate, and its negative case is covered: the subject at `condition-grammar.test.ts:54` has `s3: st('QUEUED')` and `:62` asserts `ev({op:'STEP_SUCCEEDED', stepId:'s3'}) === false`, plus `:86` covers the missing-step false and `:59-60` pin STEP_STATE's exact-match. Deleting or broadening the comparison to anything permissive goes RED. The single mutant that survives is the substitution of one SPECIFIED semantics for a DIFFERENT specified semantics (`=== 'SUCCEEDED'` → `isTerminalSuccessStepState(...)`) — that is a spec change, not a weakened guard, and B7 does not require a test per alternative semantics or every enum comparison in the codebase would be an unkilled mutant.

Residual after refutation: adding the paired assertion the finding suggests would be harmless, but it is a documentation/pinning preference over correct, specified, correctly-rendered behavior — explicitly outside this review's "no style nits" scope. Nothing here can put a step in a non-terminal state with no way out, resurrect a dead arm, re-resolve a settled branch, or fail open.

</details>

<details><summary>Test-evidence verifier evidence</summary>

CONFIRMED as an anti-vacuity (B7) coverage defect; the finding's "wrong outcome" framing is REFUTED — the behaviour itself is correct.

EMPIRICAL PROBE (temp test, since deleted). evaluateCondition({op:'STEP_SUCCEEDED',stepId:'s0'}) over a SKIPPED s0 = false, while isTerminalSuccessStepState('SKIPPED') = true. Driving the finding's exact plan shape (s0 -> s1[BRANCH]; t1 COND STEP_SUCCEEDED(s0) -> s2; t2 SEQ default -> s3) through the real gate: with s0 SKIPPED, inEdgeDisposition(s0->s1) = SATISFIED, startableStepIds = ['s1']; after s1 SUCCEEDED, resolveBranchSelection(s1) = 't2' (default arm), startableStepIds = ['s3'], prunableStepIds = ['s2']. Control with s0 SUCCEEDED resolves to 't1'. The divergence and the arm-flip are both real.

MUTATION EXPERIMENT (decisive, test-side). Copied condition-grammar.ts to a throwaway dir, weakened line 122 to `step?.stepState === 'SUCCEEDED' || step?.stepState === 'SKIPPED'`, and ran every suite against it via temporary vitest alias configs (no source file modified):
  - rph-domain      220 passed / 0 failed
  - rph-application 357 passed / 0 failed (byte-identical to a pristine-aliased baseline run)
  - rph-projections 157 passed / 0 failed
734 tests, ZERO killed. HARNESS SENSITIVITY CONTROL: the same alias config with `return false` substituted killed 20 tests in execution-start-gate.test.ts (e.g. :970 "s3 is the taken arm" Expected ACCEPTED / Received REJECTED), proving the alias was live and the green result is not an artifact. So STEP_SUCCEEDED's exclusion of SKIPPED is an UNKILLED MUTANT monorepo-wide.

WHY NO TEST KILLS IT. Exhaustive grep of all 4 STEP_SUCCEEDED-bearing test files: condition-grammar.test.ts references s1=SUCCEEDED, s3=QUEUED, s2=FAILED, 'nope'=missing — the string SKIPPED does not appear in that file at all; execution-start-gate.test.ts (:329,337,350,362,370,386,703) and execution-flow.e2e.ts:193 reference the BRANCH's OWN source step, necessarily SUCCEEDED when the guard evaluates; execution-view.test.ts:445,554,593 use s1=SUCCEEDED. No fixture anywhere pairs a SKIPPED step with a STEP_SUCCEEDED guard. Neither condition-grammar.ts nor DR-004 line 116 (the DWP-02 outcome text) documents the asymmetry.

WHAT IS REFUTED. The claimed harm ("the author who wrote 'if s0 is done' gets the not-done branch") is not a code defect: the op is named STEP_SUCCEEDED and execution-view.ts:311 renders it to the UI as literally "step X succeeded", so the surfaced semantics are truthful; a SKIPPED step did not succeed. The grammar already expresses the other notion — STEP_STATE(x,'SKIPPED') exists and is used for exactly that in the DWP-09 fixture at execution-start-gate.test.ts:937. Propose validation guarantees a SEQUENTIAL default so the branch always resolves: no deadlock, no fail-open, and no INV-5 / RPH-EXE-002 / RPH-EXE-008 / resolved-once / structural-deadness breach. Severity stays MINOR and the defect is the missing pin, not the behaviour.

FIX THAT SETTLES IT: add to condition-grammar.test.ts the paired assertion evaluateCondition({op:'STEP_SUCCEEDED',stepId:'x'}, subject with x=SKIPPED) === false alongside isTerminalSuccessStepState('SKIPPED') === true, and a one-line note at condition-grammar.ts:121 that STEP_SUCCEEDED is deliberately NARROWER than the gate's TERMINAL_SUCCESS (transition-gate.ts:17). That assertion goes RED against the mutant above.

CLEANUP: all probe/config/copy artifacts deleted (src/zz-probe-verifier.test.ts, mutant-src/, pristine-src/, vitest.mutant.config.ts x2, vitest.pristine.config.ts); rph-domain re-verified 220 passed. NOT MINE: the modified packages/rph-application/src/handlers/execution.ts and the untracked zzz-probe-*.test.ts files in that directory belong to sibling verifiers in this sweep; they polluted two intermediate runs, and my reported measurements are from clean reproducible runs whose domain/projections evidence is independent of that package.

</details>

**Live check needed.** None. Settled empirically by a mutation run with a positive sensitivity control; no further live check required.
