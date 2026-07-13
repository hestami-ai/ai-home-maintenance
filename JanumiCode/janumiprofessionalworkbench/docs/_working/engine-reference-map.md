# Engine Reference Map (build bible for the RPH-DOC-010 live buildout)

> Condensed from a 4-agent deep read of the code + DOC-002/DOC-008 (2026-07-12). This is the authoring
> reference for handlers/queries/projections. Symbol names + file refs are load-bearing. Survives compaction.

## 0. THE BIG ARCHITECTURAL FACT
DOC-002 §4 defines **20** Professional Work Object types. The contracts package implemented only **17** runtime
objects. The **3 not yet in contracts** are the PWA-authoring/ownership objects:
- `PROFESSIONAL_WORK_ARCHITECTURE` (PWA) — versioned template; publication flow DRAFT→UNDER_REVIEW→VALIDATED→PUBLISHED→DEPRECATED→RETIRED (RPH-DOC-010 §20). Published version immutable.
- `PWU_TYPE` — reusable PWU template owned by a published PWA version.
- `UNDERTAKING` — concrete instantiation bound to ONE PWA version; owns the Professional Work Graph.
CON-009 (DOC-008): a PWU Instance MUST carry `undertakingId` + (`pwuTypeId` or `isLocalExtension`); `pwuKind` alone is insufficient.
→ **P1 = extend the existing contracts/domain** with these 3 objects (vocab→gen), NOT a separate package.

## 1. HANDLER-AUTHORING CONTRACT (rph-application/command-bus.ts)
Pipeline `Engine.dispatch` runs generic pre-stages, then the per-command handler:
- **Pre (generic):** (1) idempotency — `store.getReceipt(idempotencyKey)`; hit ⇒ `DUPLICATE`. (2) payload validate — `COMMANDS[type].payload` via `validateAgainst`; unknown type ⇒ `REJECTED`; parse fail ⇒ `VALIDATION_FAILED`.
- **Handler (per command):** (a) `store.loadObject(id) → StoredObject{objectType,revision,semanticVersion,state}|undefined` (create ⇒ skip; update ⇒ load); (b) semantic checks ⇒ `RPH_VALIDATION_SEMANTIC_FAILED`; (c) produce next state (revision+1 for update; new = revision 0, semver 1) + `DomainEvent`; (d) validate next state vs its object schema (fail-loud ⇒ REJECTED `invariant.produced_state_invalid`); (e) build `CommitInput`; (f) `store.commit` ⇒ map (`REVISION_CONFLICT`⇒`CONFLICT`/`RPH_REVISION_CONFLICT`; ok⇒`ACCEPTED`).

**CommitInput** (rph-ports/src/ports/storage.ts): `{ aggregateType, aggregateId, objectType, expectedRevision (undefined=must-not-exist), newRevision, newSemanticVersion, currentState (whole next object), events:[event], receipt:{ commandId, idempotencyKey, commandType, targetAggregateId, status:'ACCEPTED', producedEventIds:[eventId], resultHash: contentHash(nextState) } }`.
`contentHash` from `@janumipwb/rph-contracts/hash` (Node-only subpath). `mintId`/`newEventId` injected.

**DomainEvent**: `{ eventId, eventType, eventSchemaVersion:1, aggregateType, aggregateId, aggregateRevision (=newRevision), occurredAt:command.issuedAt, recordedAt:now(), actor:command.issuedBy, correlationId, commandId, payload }`.

**StorageAdapter**: `getReceipt`, `loadObject`, `commit`, `readAggregateEvents(aggType,id)`, `readAllEvents()`, `readPendingOutbox`, `markOutboxPublished`, `close`.
**CommandResult.status** ∈ ACCEPTED|REJECTED|CONFLICT|DUPLICATE|UNAUTHORIZED|VALIDATION_FAILED (UNAUTHORIZED unused today → use for authority gates).

**⚠ Normalize:** `COMMANDS[].targetAggregateType` is SCREAMING_SNAKE for cmds #1–24 but PascalCase for #25–43; `EVENTS[].aggregateType` is PascalCase. USE THE CANONICAL SCREAMING_SNAKE objectType as the persistence `aggregateType`/`objectType` in every handler (fix the vocab + regen so both registries agree). `OBJECT_SCHEMAS[objectType].schema` maps objectType→Zod schema.

## 2. ENGINE SEAM (rph-engine/src/engine.ts)
`createEngine(deps:{ ontology(REQUIRED), validateOntology?, store?, now?, newEventId?, logger? }) → EngineHandle`.
`EngineHandle`: `dispatch(cmd)`, `subscribe(fn)`, `drainOutbox()`, `loadObject(id)`, `readAllEvents()`, `ontology` (prop), `close()`. **No `query`/`getProjection` yet** — ADD a read surface for the UI (or host projections in the SvelteKit server via readAllEvents + rebuildProjection).
Construction gate: ontology must have exactly one root PWU template; runs injected `validateOntology`, throws on any issue.
`EngineOntology = { version, pwuTemplates:{pwuKind,isRoot?}[], seedPolicies:unknown[], conformanceProfiles:unknown[] }`.

## 3. DOMAIN GUARDS (rph-domain) — handlers CALL these
- **PWU lifecycle:** `pwuGuards.canAdvanceWorkLifecycle(from,to,axes)→{ok,reason?}` (legality + cross-axis); `pwuGuards.satisfiesP1(axes)→bool`. Only legal path to SATISFIED = `UNDER_ASSURANCE→SATISFIED` requiring `assuranceState==='SATISFIED'`. `EXECUTING→SATISFIED` is in `illegal[]`.
- **Generic FSM:** `stateMachine.classifyTransition(machine,from,to)→{klass}` (LEGAL/NOOP/ILLEGAL_*); `canTransition`; `assertTransition(machine,from,to,{correlationId,targetObjectIds})` throws `RphErrorException(RPH_ILLEGAL_STATE_TRANSITION)`. Machine names = 'Intent.intentStatus','PWU.workLifecycleState','PWU.executionState','PWU.assuranceState','PWU.shapeIntegrityState','Obligation.status','Constraint.status','Assumption.status','Claim.status','Evidence.status','AssurancePolicy.status','AssuranceAssessment.disposition','AssuranceAssessment.state','AssuranceObservation.disposition','ExecutionPlan.status','ExecutionStep.stepState','RuntimeBinding.authorizationStatus','Decision.status','Baseline.status','DecompositionContract.status','RecompositionContract.status'.
- **Execution (M11):** `canActivatePlan({planStatus,otherActivePlanExists})`; `canStartStep(StepStartInput{planStatus,stepState,bindingAuthorizationStatus,preconditionsSatisfied})`; `validateStepCompletion({hasOutput,explicitNoOutput})`; `retryDecision({attemptsMade,maxAttempts,lastAttemptFailed})`; `executionSuccessOutcome()→{executionState:'SUCCEEDED',workLifecycleState:'EVIDENCE_PENDING',assuranceAutoSatisfied:false}`; `bindingPermitsExecution(status)`; `classifyInterruptedAttempt`, `mayReexecuteWithoutReconciliation`, `resolveIdempotency`.
- **Governance (M10):** `authorizeDecisionEffective(DecisionView{...,authorityHeld})→{ok,errorCode?}` (RPH_AUTHORITY_INSUFFICIENT); `isEffectiveApproval(d)`; `decisionAuthorizesVersions(d,currentSubjectVersions)→{ok,staleSubjects}` (P5); `waiverCovers`, `waiverStillDischarges`, `waiverPreservesFindings`; `canPromoteBaseline(BaselinePromotionInput)→{ok,findings[]}` (the promotion gate — codes: NO_EFFECTIVE_PROMOTION_DECISION, ILLEGAL_PROMOTION_TRANSITION, MISSING_ITEM_VERSION, BASELINE_VERSION_MISMATCH, OPEN_BLOCKING_FINDING, REQUIRED_ASSESSMENT_INCOMPLETE, REQUIRED_ASSESSMENT_NOT_SATISFIED [only SATISFIED|WAIVED pass], CONTESTED_CLAIM, EXPIRED_REQUIRED_WAIVER); `assertBaselineItemSetImmutable(status)→{ok,requiresSuccessor}` (P7); `selectControlAction(recommended[])`; `normalizeControlAction`; `controllerMarksPwuSatisfied({executionState,assuranceState,openBlockingObservations})→bool`.
- **Decomposition (M9):** `validateObligationConservation` (P2); `validateConstraintPropagation` (P3); `evaluateRecomposition`; `validateAssumptionReification`; `assessAcceptance` (ACCEPTED≠VERIFIED); `assessFalsification`; `validateDecomposition→{status:VALID|CONDITIONALLY_VALID|INVALID,findings,permitsParentPlanned}`.
- **Traceability (M6):** `TraceGraph` class; `classifyEvidenceInvalidation(graph,evidenceId)` (P4); `impactedObjects`; `validateLinkDirectionality`.
- **Assurance (M7, rph-assurance):** `dispositionFromFindings`, `aggregateDisposition` (strictest-unresolved, never averaged), `evidenceAdmissibility`, `checkIndependence`, `isWaiverApplicable`, `classifyValidatorResult`; `applicability.ts` DSL evaluator.

## 4. PWU COMPLETION RULE (net)
`SATISFIED ⇐ executionState=SUCCEEDED ∧ required evidence admitted ∧ all mandatory assurance SATISFIED ∧ (root ⇒ intent APPROVED) ∧ no open blocking/critical finding`. Execution success alone → route to `EVIDENCE_PENDING`, NEVER SATISFIED (P1/INV-5). Use `controllerMarksPwuSatisfied` + `canAdvanceWorkLifecycle`.
**Baseline AUTHORITATIVE ⇐** effective PROMOTE_BASELINE decision ∧ required assessments complete+satisfied/waived ∧ no open blocking (unless valid unexpired scoped waiver) ∧ items pinned to id+semver+hash ∧ decision bound to those versions. Use `canPromoteBaseline`.

## 5. THE 43 COMMANDS → handler plan (each: load→guard→transition→event→commit)
Machine/from/to per command are already in the BINDINGS table (messages.ts) + m3 vocab (`drivesMachine/drivesFrom/drivesTo/emitsEvent`). Handler groups:
- **Intent:** CaptureIntent✓(exists), FormalizeIntent, ApproveIntent, ReviseIntent. (Intent chain RAW→UNDER_DISCOVERY→PROVISIONAL→FORMALIZED→APPROVED↔REVISED — may need BeginIntentDiscovery + a provisional command among the 8 missing.)
- **PWU:** ProposePwu, BeginPwuShaping, MarkPwuReady, ChangePwuState, ChallengePwu, ReshapePwu, InvalidatePwu, SupersedePwu. (+ MarkPwuSatisfied missing.)
- **Decomposition/Recomposition:** ProposeDecomposition, ValidateDecomposition, ReviseDecomposition, BeginRecomposition, CompleteRecomposition.
- **Execution:** ProposeExecutionPlan, ApproveExecutionPlan, ActivateExecutionPlan, StartExecutionStep, CompleteExecutionStep, FailExecutionStep, RetryExecutionStep, ApplyTacticalChange, CancelExecutionPlan. (+ RequestRuntimeBinding, AuthorizeRuntimeBinding, Deny/RevokeRuntimeBinding missing.)
- **Assumption/Claim:** DetectAssumption, AssertClaim.
- **Evidence:** ProposeEvidence, AdmitEvidence, InvalidateEvidence.
- **Assurance:** RequestAssuranceAssessment, RecordAssuranceObservation, CompleteAssuranceAssessment. (+ StartAssuranceAssessment missing.)
- **Decision/Waiver:** ProposeDecision, ApproveDecision, RevokeDecision, RequestWaiver, GrantWaiver, DenyWaiver.
- **Baseline:** CreateBaseline, PromoteBaseline, SupersedeBaseline. (+ SubmitBaselineForReview, ApproveBaseline missing.)

**8 missing commands to add via vocab+gen:** BeginIntentDiscovery, StartAssuranceAssessment, MarkPwuSatisfied, RequestRuntimeBinding, AuthorizeRuntimeBinding, SubmitBaselineForReview, ApproveBaseline, DenyRuntimeBinding/RevokeRuntimeCapability. (Plus a provisional-intent command if the fixture path needs it.)

## 6. CONFORMANCE ACCEPTANCE (DOC-008) — the P11 target
Families: CON (schema), INT, PWU, DEC, CNS, ASM, EXE, EVD (claim/evidence), ASR, GOV, BAS, TRC, PER (concurrency/replay/restart), PRJ (projection), CMP (legacy), FIX (fixture), E2E, P1–P8 (property). Key must-holds: PWU-005/E2E-002 (exec success ≠ assurance), GOV-001 (authority), BAS-003/004 (promotion gate), P1–P8. Conformance-manifest gate: `coverageFor(ruleId)` must resolve for all 125 rules; byStatus.COVERED ≥ 40. Mutation must-catch list (DOC-008 §26). Coverage minimums (§27): guards/invariants/disposition/promotion/idempotency 100%.

## 7. UI ARCHITECTURE (P6–P10)
SvelteKit app hosts `createEngine()` on the **Node server** (better-sqlite3). Browser posts commands via `+server.ts`/form actions → `engine.dispatch`; reads via `load()` → projections (readAllEvents + rebuildProjection, or a new query surface). Browser bundle imports only pure `rph-projections` view types. Two visibly-distinct contexts (PWA Design / Undertaking) + workbenches (Execution/Assurance/Decision/Baseline/Diagnostics). Charter vocab (see BUILD-PLAN §3). Design tokens from DESIGN.md → Tailwind theme; @xyflow/svelte canvases.
