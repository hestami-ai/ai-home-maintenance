// Execution Plan lifecycle handlers. The plan machine is PROPOSED → UNDER_REVIEW → APPROVED → ACTIVE →
// {COMPLETED|FAILED|CANCELLED}. ProposeExecutionPlan creates the plan already submitted for review (the
// PROPOSED→UNDER_REVIEW trigger is "proposeExecutionPlan / ExecutionPlanProposed then submitted for review",
// DOC-002 §20.1 — see OPEN-QUESTIONS). ActivateExecutionPlan is gated by canActivatePlan (RPH-EXE-001: at most
// one ACTIVE plan per PWU). Approval grants NO runtime privileges (§20.2). The per-step handlers
// (start/complete/fail/retry) mutate the embedded steps[] array on the plan aggregate, each gated by the
// ExecutionStep.stepState machine + the execution kernel (a succeeded step must record a result, RPH-EXE-006;
// step success ≠ PWU success, §21.1).
import type {
	ActivateExecutionPlanPayload,
	CancelExecutionStepPayload,
	CompleteExecutionStepPayload,
	DomainCommand,
	ExecutionPlanActivatedPayload,
	ExecutionStepSucceededPayload,
	FailExecutionPlanPayload,
	ProposeExecutionPlanPayload,
	SkipExecutionStepPayload
} from '@janumipwb/rph-contracts';
import {
	buildConditionSubject,
	canActivatePlan,
	canAuthorizeNewWork,
	canResumeExecutionOnPwu,
	canSkipStep,
	evaluateGuardExpression,
	planEvidencesExecutionSuccess,
	pruneProvenance,
	prunableStepIds,
	resolveBranchSelection,
	retryDecision,
	startStepGate,
	validateStepCompletion,
	STEP_COMMAND_SPECS,
	validateProposedPlan,
	type AssumptionView,
	type ConditionSubjectEvent,
	type EdgeGuardEvaluator,
	type GatePlan,
	type StepCommandSpec
} from '@janumipwb/rph-domain';
import {
	advanceStatus,
	checkTransition,
	commitState,
	createObject,
	loadOrReject,
	makeEvent,
	newEnvelope,
	nextEnvelope,
	reject,
	type CommandHandler,
	type HandlerContext
} from './kit.js';
import {
	floorGateBlock,
	stepOutputIsAiProduced,
	stepResultSubjects,
	structuredResultHasContent,
	unassessableAiContentBlock
} from './floor-gate.js';
import { fromStates } from './command-precondition.js';
import { resolveSkipAuthorization } from './skip-authorization.js';

const PLAN = 'EXECUTION_PLAN';
const MACHINE = 'ExecutionPlan.status';
const STEP_MACHINE = 'ExecutionStep.stepState';

/** Preserve the read-model's existing String() coercion for a value it treats as a scalar, without S6551 flagging the
 *  possibly-structured argument. The cast is compile-time only — String() runs on the same value with the same result;
 *  this is NOT JSON.stringify. Centralising the union here also avoids repeating it at every projection site (S4323). */
type Stringifiable = string | number | boolean;
const asScalarString = (value: unknown): string => String(value as Stringifiable);

/** Project a plan state bag into the pure transition-graph gate read-model (DR-004 DWP-01). The SAME GatePlan the
 *  read-model builds, so the engine authority (startExecutionStep) and the UI affordance cannot diverge (§19-M2). */
function toGatePlan(plan: Record<string, unknown>): GatePlan {
	const steps = (plan.steps as Array<{ id?: unknown; stepState?: unknown }>) ?? [];
	const transitions = (plan.transitions as Array<Record<string, unknown>>) ?? [];
	return {
		status: asScalarString(plan.status ?? ''),
		steps: (steps as Array<Record<string, unknown>>).map((s) => ({
			id: asScalarString(s.id ?? ''),
			stepState: asScalarString(s.stepState ?? ''),
			// stepType decides which node may branch EXCLUSIVELY (a BRANCH selects ONE arm; every other node's
			// out-edges are independent). Deadness is NOT carried here — it is STRUCTURAL, computed by the gate.
			// selectedTransitionId IS carried: a resolved branch's decision is a recorded fact, not a re-computation.
			...(s.stepType === undefined ? {} : { stepType: asScalarString(s.stepType) }),
			...(s.selectedTransitionId === undefined
				? {}
				: { selectedTransitionId: asScalarString(s.selectedTransitionId) })
		})),
		transitions: transitions.map((t) => ({
			// The edge id is load-bearing: it is how a BRANCH's recorded selection is matched back to its edge.
			...(t.id === undefined ? {} : { id: asScalarString(t.id) }),
			sourceStepId: t.sourceStepId === undefined ? undefined : asScalarString(t.sourceStepId),
			targetStepId: t.targetStepId === undefined ? undefined : asScalarString(t.targetStepId),
			transitionType: t.transitionType === undefined ? undefined : asScalarString(t.transitionType),
			conditionExpression: t.conditionExpression
		}))
	};
}

/** The plan aggregate's current state bag, or an empty one — for a producer that needs the WHOLE plan before
 *  `advanceStep` loads it (prune provenance must be derived BEFORE the step moves, or the cut is already gone). */
function loadPlanState(ctx: HandlerContext, planId: string): Record<string, unknown> {
	return (ctx.store.loadObject(planId)?.state as Record<string, unknown> | undefined) ?? {};
}

/**
 * The CONDITIONAL-edge guard evaluator for a plan, or `undefined` when the plan has no guarded edge at all.
 *
 * Building it folds the plan's condition subject out of the event log, which means reading the WHOLE store. Doing that
 * unconditionally made every StartExecutionStep — the hottest command in the system, and one that previously read no
 * events whatsoever — O(total events across all aggregates), even for a linear plan whose gate never consults a guard
 * (DWP-07, flagged by the audit's completeness sweep). Returning undefined is not a behaviour change: the gate's
 * evaluator parameter is optional and is only ever called for a CONDITIONAL edge, of which there are none here.
 *
 * `pendingEvents` (JAN-EXECREM WP-10 / Rule B1) is what lets a BRANCH see its OWN result. It is the event about to
 * be committed — the real one, byte-identical to what lands in the log, never a re-derivation from the command
 * payload (the event renames `executionStepId`, drops `resultStatus`, and adds `resultingExecutionState`, so a
 * payload-built overlay would be a second, subtly different shape). Empty everywhere except the settlement seam.
 */
function guardEvaluatorFor(
	ctx: HandlerContext,
	planId: string,
	gatePlan: GatePlan,
	pendingEvents: readonly ConditionSubjectEvent[] = []
): EdgeGuardEvaluator | undefined {
	const hasGuard = (gatePlan.transitions ?? []).some(
		(t) => t.conditionExpression !== undefined || t.transitionType === 'CONDITIONAL'
	);
	if (!hasGuard) return undefined;
	const subject = buildConditionSubject(
		gatePlan.steps,
		[...ctx.store.readAllEvents(), ...pendingEvents],
		planId
	);
	// WP-7/SM-5: ONE evaluation rule, shared with the read-model. This body used to be a byte-identical copy of
	// rph-projections' — two copies of a rule that must agree, with nothing making them agree.
	return (edge) => evaluateGuardExpression(edge.conditionExpression, subject);
}

/**
 * Propose-time structural admissibility (JAN-EXECREM WP-6). ONE carrier: `validateProposedPlan` in rph-domain.
 *
 * This replaced three private, transition-scoped validators here. The structural one among them short-circuited on
 * an empty `transitions[]`, so a LINEAR plan received no step validation at all — which is how duplicate step ids
 * (F-10) and an authored NOT_READY step (F-09/F-27) reached storage. The domain module preserves those three
 * rules' exact codes and messages, so their rejection tests are unchanged; it adds the step-set rules nothing owned.
 */
function rejectInadmissiblePlan(
	command: DomainCommand,
	p: ProposeExecutionPlanPayload
): ReturnType<typeof reject> | null {
	const verdict = validateProposedPlan({
		executionPlanId: p.executionPlanId,
		steps: p.steps,
		transitions: p.transitions ?? []
	});
	if (verdict.ok) return null;
	return reject(
		command,
		verdict.code ?? 'RPH_VALIDATION_SEMANTIC_FAILED',
		verdict.message ?? 'ProposeExecutionPlan blocked: the proposed plan is not structurally admissible.',
		[p.executionPlanId]
	);
}

/**
 * The ExecutionPlanProposed event payload — a PROJECTION of the command. It records the RESULTING state:
 * ExecutionPlanProposed declares the plan's identity + `status` (UNDER_REVIEW), and references its steps/transitions
 * by ID (not the full embedded objects the command carries), plus the created status the command omits. The policies
 * ride when non-empty (the reference undertaking supplies `{}`, so they are omitted — not specified, not a fabricated
 * empty). (Pinned defect in emitted-event-conformance; now conforms.)
 */
function proposedPlanEventPayload(p: ProposeExecutionPlanPayload) {
	return {
		workUnitId: p.workUnitId,
		planVersion: 1,
		status: 'UNDER_REVIEW',
		stepIds: p.steps.map((s) => s.id),
		transitionIds: p.transitions.map((t) => (t as { id?: string }).id ?? ''),
		...(p.retryPolicy && Object.keys(p.retryPolicy).length ? { retryPolicy: p.retryPolicy } : {}),
		...(p.tacticalChangePolicy && Object.keys(p.tacticalChangePolicy).length
			? { tacticalChangePolicy: p.tacticalChangePolicy }
			: {}),
		...(p.escalationPolicy && Object.keys(p.escalationPolicy).length
			? { escalationPolicy: p.escalationPolicy }
			: {}),
		...(p.terminationPolicy && Object.keys(p.terminationPolicy).length
			? { terminationPolicy: p.terminationPolicy }
			: {})
	};
}

/** ProposeExecutionPlan — create the plan for a PWU, submitted for review (UNDER_REVIEW). */
export const proposeExecutionPlan: CommandHandler = (ctx, command, payload) => {
	const p = payload as ProposeExecutionPlanPayload;
	// TOTALITY HARDENING (JAN-EXECREM WP-12 / F-28): this asserted only that `workUnitId` RESOLVES, so a plan could
	// name an Artifact or a Decision as its work unit and every downstream PWU read — including the new openness
	// gate — would silently find no lifecycle to check. Asserting the TYPE here makes that read total rather than
	// best-effort. Authoring is not executing, so proposing against an OPEN PWU stays unrestricted (§20.2).
	if (ctx.store.loadObject(p.workUnitId)?.objectType !== 'PROFESSIONAL_WORK_UNIT') {
		return reject(
			command,
			'RPH_VALIDATION_SEMANTIC_FAILED',
			`ProposeExecutionPlan requires an existing PROFESSIONAL_WORK_UNIT ${p.workUnitId}`,
			[p.executionPlanId]
		);
	}
	const inadmissible = rejectInadmissiblePlan(command, p);
	if (inadmissible) return inadmissible;
	const state: Record<string, unknown> = {
		...newEnvelope(command, PLAN, p.executionPlanId, {
			lifecycleStatus: 'UNDER_REVIEW',
			sourceObjectIds: [p.workUnitId]
		}),
		workUnitId: p.workUnitId,
		planVersion: 1,
		steps: p.steps,
		transitions: p.transitions,
		retryPolicy: p.retryPolicy,
		tacticalChangePolicy: p.tacticalChangePolicy,
		escalationPolicy: p.escalationPolicy,
		terminationPolicy: p.terminationPolicy,
		status: 'UNDER_REVIEW'
	};
	return createObject(ctx, command, {
		objectType: PLAN,
		aggregateId: p.executionPlanId,
		state,
		eventType: 'ExecutionPlanProposed',
		eventPayload: proposedPlanEventPayload(p)
	});
};

/** ApproveExecutionPlan — UNDER_REVIEW -> APPROVED (approval grants no runtime privileges). */
/**
 * W3-INC-2 (WP-3-008 / RPH-ASM-006). Approving an execution plan AUTHORIZES new work for its PWU; it must not do
 * so on a dead assumption. Load the plan's PWU, and reject if any assumption it depends on is no longer live
 * (EXPIRED / FALSIFIED / SUPERSEDED per the kernel `canAuthorizeNewWork`). NON-VACUOUS BUT NON-BREAKING: a PWU
 * with no assumptions (the reference undertaking, `assumptionIds: []`) has nothing to check and passes — the gate
 * fires only when the PWU genuinely depends on an assumption that has died. This is the first live wiring of the
 * assumption-impact half of WP-3-008 (the falsification transition + reshape/reassessment loop remain).
 */
function assumptionsAuthorizeNewWork(
	hctx: HandlerContext,
	workUnitId: string
): { assumptionId: string; status: string } | null {
	const pwu = hctx.store.loadObject(workUnitId)?.state as { assumptionIds?: string[] } | undefined;
	for (const assumptionId of pwu?.assumptionIds ?? []) {
		const a = hctx.store.loadObject(assumptionId)?.state as
			| { objectType?: string; status?: string; materiality?: string; affectedObjectIds?: string[] }
			| undefined;
		if (a?.objectType !== 'ASSUMPTION') continue; // unknown status → not gatable (sound)
		const view: AssumptionView = {
			assumptionId,
			materiality: typeof a.materiality === 'string' ? a.materiality : '',
			status: typeof a.status === 'string' ? a.status : '',
			affectedObjectIds: a.affectedObjectIds ?? []
		};
		if (!canAuthorizeNewWork(view)) return { assumptionId, status: view.status };
	}
	return null;
}

export const approveExecutionPlan: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, command, {
		objectType: PLAN,
		statusField: 'status',
		machine: MACHINE,
		target: 'APPROVED',
		eventType: 'ExecutionPlanApproved',
		// The event records the RESULTING status. ExecutionPlanApproved declares `status` (APPROVED), which the
		// empty command payload does not carry — so the default emit recorded nothing of the transition. (Pinned.)
		eventPayload: () => ({ status: 'APPROVED' }),
		// JAN-CMDPRE DWP-05: the sole in-arrow to APPROVED is UNDER_REVIEW (ExecutionPlan.status). Before this, an
		// already-APPROVED re-issue was a NOOP that appended a second ExecutionPlanApproved. Sited ahead of the guard
		// (INV-3), it also corrects a latent mask: a wrong-state plan whose PWU ALSO has a dead assumption used to
		// refuse RPH_INVARIANT_VIOLATION (the guard runs before checkTransition); the state fact now refuses first with
		// RPH_ILLEGAL_STATE_TRANSITION. The RPH-ASM-006 guard is retained for the legitimate UNDER_REVIEW input (INV-3
		// non-example).
		precondition: fromStates('UNDER_REVIEW'),
		// RPH-ASM-006: a plan may not authorize new work on an expired/falsified/superseded assumption.
		guard: (state, hctx) => {
			const workUnitId = typeof state.workUnitId === 'string' ? state.workUnitId : '';
			const dead = assumptionsAuthorizeNewWork(hctx, workUnitId);
			if (dead) {
				return reject(
					command,
					'RPH_INVARIANT_VIOLATION',
					`Cannot approve execution plan ${command.targetAggregateId}: it authorizes new work for a PWU whose assumption ${dead.assumptionId} is ${dead.status} — an expired, falsified, or superseded assumption cannot authorize new work (RPH-ASM-006). Re-establish or supersede the assumption first.`
				);
			}
			return null;
		}
	});

/**
 * Does `workUnitId` already own an ACTIVE plan other than `thisPlanId`? (RPH-EXE-001 / DOC-002 §20.2 "A PWU may
 * have only one active plan at a time.")
 *
 * This is DERIVED from authoritative plan state, never read from a denormalized pointer. The guard previously
 * read `ProfessionalWorkUnit.activeExecutionPlanId` — a field that IS ratified (objects.ts / DOC-002 §19) but
 * that NO handler has ever written. It was therefore permanently `undefined`, making `otherActivePlanExists`
 * permanently `false`: canActivatePlan was called, but its one-active-plan limb was unreachable. The kernel was
 * wired; the fact it decides on was not.
 *
 * Writing that pointer instead was rejected: it hangs off the PWU aggregate while this command targets the
 * Execution aggregate (DOC-002 §3.3, "Aggregate root: Execution Plan"), so maintaining it would mean a
 * cross-aggregate write plus a PWU event type no contract defines — inventing a shape to satisfy a guard.
 * Deriving needs nothing new: `readAllEvents` indexes the candidate plan ids and `loadObject` supplies each
 * plan's authoritative current status, so a SUPERSEDED/CANCELLED/COMPLETED plan drops out on its own status
 * rather than on a pointer somebody remembered to clear.
 */
function otherActivePlanExistsForPwu(
	ctx: HandlerContext,
	workUnitId: string,
	thisPlanId: string
): boolean {
	const candidateIds = new Set<string>();
	for (const event of ctx.store.readAllEvents()) {
		if (event.aggregateType === PLAN && event.aggregateId !== thisPlanId)
			candidateIds.add(event.aggregateId);
	}
	for (const planId of candidateIds) {
		const plan = ctx.store.loadObject(planId)?.state as
			{ workUnitId?: string; status?: string } | undefined;
		if (plan?.workUnitId === workUnitId && plan.status === 'ACTIVE') return true;
	}
	return false;
}

/** ActivateExecutionPlan — APPROVED -> ACTIVE, gated by canActivatePlan (one ACTIVE plan per PWU, RPH-EXE-001). */
export const activateExecutionPlan: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, command, {
		objectType: PLAN,
		statusField: 'status',
		machine: MACHINE,
		target: 'ACTIVE',
		eventType: 'ExecutionPlanActivated',
		// JAN-CMDPRE DWP-05: the sole in-arrow to ACTIVE is APPROVED (ExecutionPlan.status). This was a
		// GUARD_ONLY_ACCIDENTAL site — canActivatePlan routes through canTransition (NOOP-excluding), so an
		// already-ACTIVE re-issue was refused, but with the WRONG code RPH_INVARIANT_VIOLATION. ENUMERATED CODE CHANGE
		// (INV-7): sited ahead of the guard, the wrong-state/NOOP re-issue now refuses RPH_ILLEGAL_STATE_TRANSITION. The
		// one-active-plan-per-PWU rule (RPH-EXE-001) is an INDEPENDENT invariant retained in the guard as
		// RPH_INVARIANT_VIOLATION — an APPROVED plan with a sibling ACTIVE plan passes the precondition and the guard
		// still fires (INV-3 non-example).
		precondition: fromStates('APPROVED'),
		// DOC-007 §15.3 ExecutionPlanActivatedPayload. This emitted the raw ActivateExecutionPlan command payload
		// (§15.2: { approvalDecisionId?, authorizedRuntimeBindingIds }) — three ratified fields missing
		// (executionPlanId, workUnitId, planVersion), `status` missing. Every field derives: the ids/version from the
		// plan aggregate the transition just produced, the bindings from the command, `status` is §15.3's const (= this
		// call's target). Contract-drift fix: approvalDecisionId (WHICH decision authorized this activation — the gate
		// to runtime execution) is §15.2's command field but §15.3 dropped it, so it was validated then discarded; now
		// carried on the event (optional, authored atop the ratified shape) so the governed stream names the authorization.
		eventPayload: (next): ExecutionPlanActivatedPayload => {
			const cmd = command.payload as ActivateExecutionPlanPayload;
			return {
				executionPlanId: command.targetAggregateId,
				workUnitId: String(next.workUnitId),
				planVersion: Number(next.planVersion),
				status: 'ACTIVE',
				authorizedRuntimeBindingIds: cmd.authorizedRuntimeBindingIds,
				...(cmd.approvalDecisionId ? { approvalDecisionId: cmd.approvalDecisionId } : {})
			};
		},
		// JAN-EXECREM WP-14 / F-31. `authorizedRuntimeBindingIds` was carried on the EVENT and never written to the
		// plan aggregate — activation passed an eventPayload but no `mutate`, though advanceStatus supports one. So
		// the ratified allowlist existed only in the log: nothing could read it back to check that a step's binding
		// was among the ones the activation authorized, and any rule citing it would have been dead on arrival.
		mutate: (base) => ({
			...base,
			authorizedRuntimeBindingIds:
				(command.payload as ActivateExecutionPlanPayload).authorizedRuntimeBindingIds ?? []
		}),
		guard: (state, hctx) => {
			// RPH-PWU-010 (JAN-EXECREM WP-12 / F-28). Activation is the command that GRANTS runtime privilege, so
			// it is the other half of the openness gate — gating the step commands alone would leave the hole where
			// a plan was activated before the PWU closed and then simply used. `state.workUnitId` is already in hand
			// for the one-active-plan rule below, so nothing new is loaded.
			const closed = pwuOpennessRefusal(
				hctx,
				command,
				String(state.workUnitId),
				command.targetAggregateId
			);
			if (closed) return closed;
			const otherActivePlanExists = otherActivePlanExistsForPwu(
				hctx,
				String(state.workUnitId),
				command.targetAggregateId
			);
			const check = canActivatePlan({ planStatus: String(state.status), otherActivePlanExists });
			if (!check.ok) {
				return reject(
					command,
					'RPH_INVARIANT_VIOLATION',
					`Cannot activate plan ${command.targetAggregateId}: ${check.reason ?? check.errorCode ?? 'blocked'}`
				);
			}
			return null;
		}
	});

/** CancelExecutionPlan — APPROVED|ACTIVE -> CANCELLED (emits ExecutionTerminated).
 *  `precondition: fromStates('APPROVED', 'ACTIVE')` (JAN-CMDPRE DWP-05) — the machine's TWO in-arrows to CANCELLED
 *  (ExecutionPlan.status). NONE site: an already-CANCELLED re-issue was a NOOP appending a second ExecutionTerminated.
 *  Both sources are exercised by the mandatory two-source positive fixture (INV-5). */
export const cancelExecutionPlan: CommandHandler = (ctx: HandlerContext, command: DomainCommand) =>
	advanceStatus(ctx, command, {
		objectType: PLAN,
		statusField: 'status',
		machine: MACHINE,
		target: 'CANCELLED',
		eventType: 'ExecutionTerminated',
		precondition: fromStates('APPROVED', 'ACTIVE')
	});

/**
 * CompleteExecutionPlan — ACTIVE -> COMPLETED (JAN-EXECPLAN-DR-002 DWP-01 / §20.1). The completion CONDITION is a
 * SUCCESS ALLOW-LIST, not a negation: a plan completes iff it has ≥1 step, EVERY step is SUCCEEDED or SKIPPED, AND
 * ≥1 step actually SUCCEEDED.
 *
 * Do not change: this is `every(SUCCEEDED || SKIPPED)`, NOT "terminal ∧ ¬FAILED". The reachable terminal step set is
 *   {SUCCEEDED, FAILED, SKIPPED, CANCELLED, SUPERSEDED}, so a negation would silently admit CANCELLED/SUPERSEDED
 *   steps as success (§19 L3-2). The `steps.length > 0` guard blocks the vacuous empty-plan completion — `[].every`
 *   is true (§19 L3-1).
 *
 * The ≥1-SUCCEEDED clause (JAN-EXECPLAN-DR-003 DWP-02 / §19 L3-M7): once 3C-iii's SkipExecutionStep makes SKIPPED
 *   reachable, an ALL-SKIPPED plan would satisfy the allow-list yet have PRODUCED NOTHING — it must not "complete".
 *   The ratified PWU-level `rejectUnbackedExecutionSuccess` (pwu.ts:649) requires a SUCCEEDED step for the PWU to
 *   claim execution success; this clause aligns the plan-level rule with it, so the two planes cannot diverge (a plan
 *   "COMPLETED" whose PWU cannot claim success). Exec ≠ assurance (INV-5): this moves only `status`.
 */
export const completeExecutionPlan: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, command, {
		objectType: PLAN,
		statusField: 'status',
		machine: MACHINE,
		target: 'COMPLETED',
		eventType: 'ExecutionPlanCompleted',
		eventPayload: () => ({ status: 'COMPLETED' }),
		// JAN-CMDPRE DWP-05: the sole in-arrow to COMPLETED is ACTIVE (ExecutionPlan.status). NONE site — an
		// already-COMPLETED re-issue was a NOOP appending a second ExecutionPlanCompleted. Sited ahead of the guard
		// (INV-3): a wrong-state plan (e.g. APPROVED) with non-terminal steps used to refuse the step-guard's
		// RPH_INVARIANT_VIOLATION; the state fact now refuses first with RPH_ILLEGAL_STATE_TRANSITION. The step-success
		// allow-list guard is retained for the legitimate ACTIVE input (INV-3 non-example).
		precondition: fromStates('ACTIVE'),
		// JAN-EXECREM WP-12 / F-08: the three limbs are now `planEvidencesExecutionSuccess` in rph-domain, called
		// HERE and at `rejectUnbackedExecutionSuccess` in pwu.ts. The alignment claim in the docblock above was
		// aspirational: this plane cited the PWU rule, and the PWU rule cited nothing and enforced a strictly weaker
		// one. The rich per-limb messages are preserved — composed from the kernel's verdict rather than restated.
		//
		// The status limb is not re-checked here: `precondition: fromStates('ACTIVE')` already refuses anything but
		// ACTIVE, which is the DECLARED narrowing that distinguishes this site from the PWU one.
		guard: (state) => {
			const steps = Array.isArray(state.steps)
				? (state.steps as Array<{ stepState?: string }>)
				: [];
			const verdict = planEvidencesExecutionSuccess({
				planStatus: String(state.status),
				stepStates: steps.map((s) => String(s.stepState ?? 'undefined'))
			});
			if (verdict.ok) return null;
			const remedy =
				verdict.errorCode === 'RPH_PLAN_STEPS_NOT_TERMINAL_SUCCESS'
					? ' FailExecutionPlan a plan with a failed step.'
					: verdict.errorCode === 'RPH_PLAN_PRODUCED_NOTHING'
						? ' FailExecutionPlan or SupersedeExecutionPlan instead.'
						: '';
			return reject(
				command,
				'RPH_INVARIANT_VIOLATION',
				`CompleteExecutionPlan blocked: plan ${command.targetAggregateId} — ${verdict.reason} (${verdict.errorCode}).${remedy}`
			);
		}
	});

/** FailExecutionPlan — ACTIVE -> FAILED (JAN-EXECPLAN-DR-002 DWP-01 / §36.2). `precondition: fromStates('ACTIVE')`
 *  (JAN-CMDPRE DWP-05) — the machine's single in-arrow to FAILED. checkTransition alone did NOT guard the source: it
 *  admits the FAILED -> FAILED NOOP, so an already-FAILED re-issue appended a second ExecutionPlanFailed. The
 *  precondition closes that NOOP. The event records the failureReason. Exec ≠ assurance (INV-5). */
export const failExecutionPlan: CommandHandler = (ctx, command) => {
	const p = command.payload as FailExecutionPlanPayload;
	return advanceStatus(ctx, command, {
		objectType: PLAN,
		statusField: 'status',
		machine: MACHINE,
		target: 'FAILED',
		eventType: 'ExecutionPlanFailed',
		precondition: fromStates('ACTIVE'),
		eventPayload: () => ({
			status: 'FAILED',
			failureReason: p.failureReason,
			...(p.failureClass ? { failureClass: p.failureClass } : {})
		})
	});
};

/**
 * SupersedeExecutionPlan — {PROPOSED|UNDER_REVIEW|APPROVED|ACTIVE} -> SUPERSEDED (JAN-EXECPLAN-DR-002 DWP-02 /
 * §35.1 / RPH-EXE-002). The machine guards the source (checkTransition); this handler additionally validates that
 * the cited successor resolves to an EXECUTION_PLAN on the SAME PWU — a supersession must name a real successor,
 * not a dangling/foreign id (§19 L3-11). Reuses the existing ExecutionPlanSuperseded event. RPH-EXE-002 (a
 * superseded plan opens no new step OR attempt) is enforced downstream by the plan-ACTIVE prechecks on
 * startExecutionStep AND retryExecutionStep (both reject once the plan leaves ACTIVE). Exec ≠ assurance (INV-5).
 */
export const supersedeExecutionPlan: CommandHandler = (ctx, command) => {
	const p = command.payload as { supersedingExecutionPlanId: string };
	return advanceStatus(ctx, command, {
		objectType: PLAN,
		statusField: 'status',
		machine: MACHINE,
		target: 'SUPERSEDED',
		eventType: 'ExecutionPlanSuperseded',
		eventPayload: () => ({
			supersedingExecutionPlanId: p.supersedingExecutionPlanId,
			status: 'SUPERSEDED'
		}),
		// JAN-CMDPRE DWP-05: the machine's FOUR in-arrows to SUPERSEDED are PROPOSED, UNDER_REVIEW, APPROVED, ACTIVE
		// (ExecutionPlan.status) — every non-terminal state. NONE site: an already-SUPERSEDED re-issue was a NOOP
		// appending a second ExecutionPlanSuperseded (and, naming a different successor, rewriting the recorded
		// supersedingExecutionPlanId). All four sources are exercised by the widest-in-arrow positive fixture (INV-5).
		// Sited ahead of the guard (INV-3): an already-SUPERSEDED re-issue naming a dangling/foreign successor used to
		// refuse the successor-guard's RPH_VALIDATION_SEMANTIC_FAILED; the state fact now refuses first with
		// RPH_ILLEGAL_STATE_TRANSITION. The successor-validity guard is retained for legitimate inputs (INV-3 non-example).
		precondition: fromStates('PROPOSED', 'UNDER_REVIEW', 'APPROVED', 'ACTIVE'),
		guard: (state) => {
			const successor = ctx.store.loadObject(p.supersedingExecutionPlanId)?.state as
				{ workUnitId?: string } | undefined;
			if (!successor)
				return reject(
					command,
					'RPH_VALIDATION_SEMANTIC_FAILED',
					`SupersedeExecutionPlan blocked: successor plan ${p.supersedingExecutionPlanId} does not exist — a supersession must name a real successor EXECUTION_PLAN (§19 L3-11).`
				);
			if (successor.workUnitId !== state.workUnitId)
				return reject(
					command,
					'RPH_VALIDATION_SEMANTIC_FAILED',
					`SupersedeExecutionPlan blocked: successor plan ${p.supersedingExecutionPlanId} belongs to a different PWU (${String(successor.workUnitId)} ≠ ${String(state.workUnitId)}) — a plan may only be superseded by a successor on the same PWU.`
				);
			return null;
		}
	});
};

/** ApplyTacticalChange — ACTIVE -> ACTIVE (a within-plan tactical adjustment; no plan-status change). The DECLARED
 * HOLD (JAN-CMDPRE DWP-05; DS-001 §5): a tactical change is a legitimate REPEATED action on a live plan, so
 * ACTIVE -> ACTIVE is admitted, not refused. `precondition: fromStates('ACTIVE')` states that honestly — the plan
 * must be ACTIVE. This REPLACES the prior hand-rolled `state.status === 'ACTIVE'` guard, which checked the same fact
 * and returned the same code (RPH_ILLEGAL_STATE_TRANSITION) but as a bespoke guard rather than the standard
 * precondition mechanism; the precondition is now the single authoritative source-state declaration (roadmap DWP-05:
 * "remove it or keep it and say which is authoritative" — removed). */
export const applyTacticalChange: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, command, {
		objectType: PLAN,
		statusField: 'status',
		machine: MACHINE,
		target: 'ACTIVE',
		eventType: 'TacticalChangeApplied',
		precondition: fromStates('ACTIVE')
	});

/** An event payload: a literal, or one DERIVED from the authored step (see `advanceStep`'s `eventPayload`). */
type StepEventPayload =
	| Readonly<Record<string, unknown>>
	| ((step: Record<string, unknown>) => Readonly<Record<string, unknown>>);

/**
 * The two DECLARED authority limbs, read from the command's spec row (JAN-EXECREM WP-12 / F-26 + F-28).
 *
 * Shared by `advanceStep` (all nine step commands) and by `activateExecutionPlan`, which is the OTHER command that
 * grants runtime privilege. Gating the step commands alone would leave the hole where a plan was activated before
 * the PWU closed and then simply used; gating activation alone leaves the symmetric one.
 */
function stepAuthorityRefusal(
	ctx: HandlerContext,
	command: DomainCommand,
	spec: StepCommandSpec,
	plan: Record<string, unknown>,
	stepId: string,
	planId: string
): ReturnType<typeof reject> | null {
	if (spec.planLiveness === 'REQUIRES_ACTIVE_PLAN' && plan.status !== 'ACTIVE')
		return reject(
			command,
			'RPH_ILLEGAL_STATE_TRANSITION',
			`${command.commandType} requires an ACTIVE plan: ${planId} is ${String(plan.status)} — a superseded or terminal plan mints no new success credit (RPH-EXE-002). ${spec.activePlanRationale} Cancel the step instead.`,
			[stepId]
		);
	if (spec.pwuOpenness === 'REQUIRES_OPEN_PWU') {
		const refusal = pwuOpennessRefusal(ctx, command, String(plan.workUnitId), stepId);
		if (refusal) return refusal;
	}
	return null;
}

/**
 * RPH-PWU-010 / §8.3 — the PWU-openness limb, shared by the step commands and by plan activation.
 *
 * Fail-closed on a workUnitId that does not resolve to a PWU: an execution act whose owning unit of work cannot be
 * READ cannot be authorized by it. `proposeExecutionPlan` now asserts the object TYPE too, so this is a total read
 * rather than a best-effort one.
 */
function pwuOpennessRefusal(
	ctx: HandlerContext,
	command: DomainCommand,
	workUnitId: string,
	targetId: string
): ReturnType<typeof reject> | null {
	const pwu = ctx.store.loadObject(workUnitId);
	if (pwu?.objectType !== 'PROFESSIONAL_WORK_UNIT')
		return reject(
			command,
			'RPH_VALIDATION_SEMANTIC_FAILED',
			`${command.commandType} blocked: the plan's workUnitId ${workUnitId} does not resolve to a PROFESSIONAL_WORK_UNIT, so the RPH-PWU-010 openness of the owning work unit cannot be established.`,
			[targetId]
		);
	const lifecycle = String((pwu.state as { workLifecycleState?: unknown }).workLifecycleState);
	const check = canResumeExecutionOnPwu(lifecycle);
	if (check.ok) return null;
	return reject(
		command,
		'RPH_INVARIANT_VIOLATION',
		`${command.commandType} blocked: PWU ${workUnitId} is ${lifecycle} — ${check.reason ?? 'a closed PWU opens no new execution'} (RPH-PWU-010 / §8.3). A successor revision or successor PWU is required; cleanup commands (Cancel / Fail / EnterWait) remain available.`,
		[targetId, workUnitId]
	);
}

/**
 * Advance one embedded step (by id) of a plan's steps[] along the ExecutionStep.stepState machine.
 *
 * Concurrency (DWP-05): several steps of ONE plan may be RUNNING at once (a PARALLEL_GROUP fan-out). Each is advanced
 * by its own command, and this function re-LOADS the aggregate and commits at `expectedRevision` — so N starts against
 * the same plan SERIALIZE on the revision rather than interleaving: each sees its predecessor's committed steps[] and
 * rewrites the array from THAT, never from a stale snapshot (no lost update). Everything downstream is keyed by
 * stepId — the retry cap (attemptsMadeForStep), the floor gate (per-result subjects), the graph gate (per-in-edge) —
 * so no handler assumes a single active step.
 */
function advanceStep(
	ctx: HandlerContext,
	command: DomainCommand,
	args: {
		readonly stepId: string;
		/**
		 * The command's DECLARED contract (JAN-EXECREM WP-8 / SM-2): its target, its source set, and its event, read
		 * from `STEP_COMMAND_SPECS` in rph-domain. REQUIRED — the three used to be loose, optional arguments supplied
		 * per call site and declared nowhere a reader or a test could enumerate, which is why four source sets went
		 * unkilled and four plan-ACTIVE omissions went unstated. A new step command cannot now be added without a row.
		 */
		readonly spec: StepCommandSpec;
		readonly precheck?: (
			step: Record<string, unknown>,
			plan: Record<string, unknown>
		) => ReturnType<typeof reject> | null;
		/**
		 * The EVENT payload — a literal, or a function of the AUTHORED STEP (JAN-EXECREM WP-14).
		 *
		 * The function form exists because some recorded facts belong to the PLAN, not to the command: a step's
		 * `runtimeBindingId` is fixed when the plan is authored and approved, so the producer must read it from the
		 * step rather than accept it from the caller. Taking it from the command would create a second, later,
		 * unauthorized source of truth for a fact the approved plan already settled.
		 *
		 * REQUIRED (JAN-EXECREM WP-13 / F-25).
		 *
		 * It used to be optional, defaulting to the raw COMMAND payload — and that implicit default is the defect,
		 * not the two handlers that took it. A command shape is not an event shape: the command says what to DO,
		 * the event records what HAPPENED, and substituting one for the other silently emitted payloads that failed
		 * their own declared schemas. Making it required converts "the author forgot" into a compile error, which
		 * is the only form of that guarantee that survives the next handler.
		 */
		readonly eventPayload: StepEventPayload;
	}
) {
	const planId = command.targetAggregateId;
	const loaded = loadOrReject(ctx, command, planId);
	if (!loaded.ok) return loaded.result;
	const plan = loaded.state;
	const steps = (plan.steps as Array<Record<string, unknown>>) ?? [];
	const idx = steps.findIndex((s) => String(s.id) === args.stepId);
	if (idx < 0) {
		return reject(
			command,
			'RPH_VALIDATION_SEMANTIC_FAILED',
			`Step ${args.stepId} not found in execution plan ${planId}`
		);
	}
	const step = steps[idx] as Record<string, unknown>;
	// ── DECLARED AUTHORITY (JAN-EXECREM WP-12 / F-26 + F-28) ────────────────────────────────────────────────────
	//
	// Both limbs come from the command's own row in STEP_COMMAND_SPECS, and both are evaluated HERE — ahead of the
	// per-command precheck — rather than being hand-inlined at five of nine call sites and absent from the other
	// four with nothing stating which absence was intended.
	//
	// F-26: the axis is "MINTS SUCCESS CREDIT", not "opens new work". Skip and Prune open no work at all yet were
	// both gated, because both mint terminal-success; Complete mints terminal-success AND a durable branch decision
	// AND is the fact the PWU success claim rests on — and was ACCEPTED on a SUPERSEDED plan, writing
	// selectedTransitionId onto dead state. Fail/Cancel/EnterWait stay exempt because a system that makes failure
	// harder to report than success is worse than one that checks neither.
	//
	// F-28: RPH-PWU-010 was ratified and enforced NOWHERE — `canResumeExecutionOnPwu` had no production caller at
	// all, while the conformance manifest certified the rule COVERED on the strength of a pure-predicate unit test.
	const authorityFailure = stepAuthorityRefusal(ctx, command, args.spec, plan, args.stepId, planId);
	if (authorityFailure) return authorityFailure;
	const precheckFailure = args.precheck?.(step, plan);
	if (precheckFailure) return precheckFailure;
	// The source set comes from the DECLARED spec. Evaluation ORDER is deliberately unchanged by WP-8 (precheck ->
	// sourceStates -> checkTransition): this package is a structural enabler, and reordering would change WHICH
	// refusal a caller sees for an input that fails both. The pre-landing survey of all 71 refusal assertions
	// confirmed no site depends on the order today; WP-9 isolates each source set with its own fixture instead.
	const sourceStates = args.spec.sourceStates;
	if (!sourceStates.includes(String(step.stepState) as (typeof sourceStates)[number]))
		return reject(
			command,
			'RPH_ILLEGAL_STATE_TRANSITION',
			`${command.commandType} requires step ${args.stepId} to be ${sourceStates.join(' or ')}, but it is ${String(step.stepState)}. The stepState machine may permit that arrow for a DIFFERENT command; this command declares drivesFrom ${sourceStates.join('|')}.`,
			[args.stepId]
		);
	const illegal = checkTransition(command, STEP_MACHINE, String(step.stepState), args.spec.target);
	if (illegal) return illegal;

	// ── THE SETTLEMENT SEAM (JAN-EXECREM WP-10 / CANONICAL RULE B1) ────────────────────────────────────────────
	//
	// The event is built HERE, after `checkTransition` (so an illegal move never decides) and before `commitState`
	// (so the decision and the move commit in one revision). That ordering is the fix: a BRANCH's arm is chosen
	// against THE PLAN AS OF THE MOVE BEING MADE — the committed steps[] with this step's state replaced by the
	// target, and the committed log extended by exactly the event about to be written.
	//
	// WHAT WAS WRONG. `completeExecutionStep` cloned the gate plan with `stepState: 'SUCCEEDED'`, but the evaluator
	// it passed had already folded its subject from the COMMITTED log — and `buildConditionSubject` reads
	// outputArtifactIds/structuredResult ONLY from a committed `ExecutionStepSucceeded`. So a BRANCH guarded on its
	// own result evaluated PRE-completion facts: RESULT_EQUALS and OUTPUT_COUNT over the completing step were always
	// false and the DEFAULT arm was always recorded. Patching one plane and not the other is why the state overlay
	// looked like a fix while the decision stayed wrong.
	//
	// THE DECISION-REPLAY IDENTITY this establishes: the recorded selection equals what you get by evaluating the
	// branch against the plan's committed state and log at the revision this command produces. stepState is written
	// to exactly `args.spec.target` below; the post-commit log IS `committed ++ [event]`, which is the list passed;
	// every other step is untouched. Today's value is reproducible from the log at NO prefix, which is precisely how
	// it can contradict the event it is recorded beside.
	const newRevision = loaded.revision + 1;
	// ONE payload object, ONE makeEvent call. If a later edit builds the payload twice — once for the overlay, once
	// for the commit — they can drift and the identity silently breaks. `execution-branch-settlement.test.ts` asserts
	// state == event as the standing guard on that.
	const basePayload =
		typeof args.eventPayload === 'function' ? args.eventPayload(step) : args.eventPayload;
	const pendingEvent = makeEvent(ctx, command, {
		eventType: args.spec.eventType,
		aggregateType: PLAN,
		aggregateId: planId,
		aggregateRevision: newRevision,
		payload: basePayload
	});

	// The branch decision, keyed on the command's DECLARED policy (WP-8's table) rather than on which handler
	// happened to remember. `NOT_TERMINAL_SUCCESS` and `NONE_STRUCTURALLY_DEAD` decide nothing, by declaration.
	let selectedTransitionId: string | undefined;
	if (
		args.spec.branchDecision === 'RECORD_AT_SETTLEMENT' &&
		// Never RE-decide: a branch that already recorded its arm settled once, and that is history.
		step.selectedTransitionId === undefined
	) {
		// The settlement view. `stepState` is the ONLY edit — the acting step's `selectedTransitionId` must NOT be
		// projected into it, because that is the OUTPUT of this computation, and the fold never reads it either
		// (pinned in condition-grammar's tests), so no fixpoint can arise.
		const settlementPlan = toGatePlan({
			...plan,
			steps: steps.map((s, i) => (i === idx ? { ...s, stepState: args.spec.target } : s))
		});
		selectedTransitionId = resolveBranchSelection(
			settlementPlan,
			args.stepId,
			guardEvaluatorFor(ctx, planId, settlementPlan, [pendingEvent as ConditionSubjectEvent])
		);
	}

	const nextStep = {
		...step,
		stepState: args.spec.target,
		...(selectedTransitionId === undefined ? {} : { selectedTransitionId })
	};
	const newSteps = steps.map((s, i) => (i === idx ? nextStep : s));
	const next = { ...nextEnvelope(plan, command, newRevision), steps: newSteps };
	// BOTH planes carry the SAME computed value, in one atomic commit. The decision is stamped onto the payload
	// AFTER the subject was folded from it — which is why the folded and committed events differ only on a field
	// the fold does not read.
	const event =
		selectedTransitionId === undefined
			? pendingEvent
			: {
					...pendingEvent,
					payload: { ...(basePayload as Record<string, unknown>), selectedTransitionId }
				};
	return commitState(ctx, command, {
		objectType: PLAN,
		aggregateId: planId,
		expectedRevision: loaded.revision,
		newRevision,
		newSemanticVersion: loaded.semanticVersion,
		nextState: next,
		event
	});
}

/**
 * StartExecutionStep — a step QUEUED -> RUNNING (only under an ACTIVE plan). Two prechecks, in order:
 *  1. plan-ACTIVE (RPH-EXE-002): a superseded/terminal plan opens no new step (mirrors the retry precheck).
 *  2. Linear start-gate (JAN-EXECPLAN-DR-003 DWP-01 / RPH-EXE-005, Fork F): a step may start ONLY when every EARLIER
 *     step (array index in plan.steps) is terminal-success (SUCCEEDED/SKIPPED) — so nothing runs out of order. Array
 *     index IS the order (F-2: the strict ExecutionStep contract has NO `ordinal`; it is persistence-only). This is
 *     the AUTHORITY the read-model `startableStepId` (execution-view.ts) mirrors for the UI — the gate is the backstop
 *     (§19 L3-4c), enforced here at start rather than by which step was "readied" (the pivot from a completion-fold
 *     cascade to a start-gate, §7). Back-compat: a single-step (or first-step) start has no earlier steps → passes.
 *     Exec ≠ assurance (INV-5): the gate reads state, sets nothing.
 */
export const startExecutionStep: CommandHandler = (ctx, command) => {
	const p = command.payload as { stepId: string };
	return advanceStep(ctx, command, {
		stepId: p.stepId,
		// drivesFrom QUEUED (declared in STEP_COMMAND_SPECS). NOT merely "not already RUNNING": the machine also
		// legalises WAITING->RUNNING (the resume arrow), so without this narrowing a Start on a WAITING step performed
		// a resume, burning a retry (RPH-EXE-008) and skipping the ExecutionStepWaitResolved fact. Resuming is
		// ResolveExecutionStepWait's job.
		spec: STEP_COMMAND_SPECS.StartExecutionStep,
		// The event records the RESULTING state, not the command input: ExecutionStepStarted declares `stepState`
		// (the RUNNING it transitioned to), which `command.payload` ({ stepId }) does not carry — so the default
		// emitted `{ stepId }` was missing the one field the event exists to record. The event that says "this step
		// started" now contains the state it started INTO. (Pinned defect in emitted-event-conformance; now conforms.)
		// JAN-EXECREM WP-14 / F-31: the binding is read from the AUTHORED STEP, not from the command.
		//
		// The disposition is ARGUED, not defaulted. `StartExecutionStepPayloadSchema` is a strictObject carrying
		// only `stepId`, so the handler's old `p.runtimeBindingId` read was UNREACHABLE — a command carrying the
		// field was refused at the schema boundary before any handler ran. The tempting repair (widen the command)
		// is the wrong one: the ratified relation is Binding -> Step (RequestRuntimeBinding names an
		// executionStepId), `ExecutionStepSchema` already carries the field, and three consumers already read
		// `step.runtimeBindingId` as authoritative. A per-invocation binding on Start would be a SECOND, LATER,
		// UNAUTHORIZED source of truth for a fact the approved plan already fixed. The strictObject was accidentally
		// preventing exactly that, so it stays — and the producer reads the plan instead.
		eventPayload: (step) => ({
			stepId: p.stepId,
			...(typeof step.runtimeBindingId === 'string' && step.runtimeBindingId !== ''
				? { runtimeBindingId: step.runtimeBindingId }
				: {}),
			stepState: 'RUNNING'
		}),
		precheck: (_step, plan) => {
			// The linear/graph start-gate — the SAME rph-domain predicate the read-model (execution-view.ts
			// startableStepIds) uses, so the UI Start affordance and this engine authority cannot diverge (DR-004
			// §19-M2). Empty transitions[] ⇒ byte-identical linear (every earlier array-index step terminal-success);
			// a graph ⇒ the in-edge barrier (a PENDING in-edge blocks, naming its source). RPH-EXE-005.
			const gatePlan = toGatePlan(plan);
			// DWP-02: a CONDITIONAL in-edge's guard is evaluated against the plan's committed subject (a replay-safe
			// fold of committed step state + this plan's event log). Parse is safe (validated at propose). Built only
			// when the plan actually HAS a guarded edge (DWP-07) — a linear plan must not pay for an event-log scan.
			const gate = startStepGate(
				gatePlan,
				p.stepId,
				guardEvaluatorFor(ctx, command.targetAggregateId, gatePlan)
			);
			if (!gate.ok)
				return reject(
					command,
					'RPH_ILLEGAL_STATE_TRANSITION',
					gate.blockerStepId
						? `Cannot start step ${p.stepId}: a predecessor (${gate.blockerStepId}) is ${String(gate.blockerState)} — a step may not start until its predecessors are terminal-success (${gate.reason}) — the plan runs in order (RPH-EXE-005). Complete, skip, or address it first.`
						: `Cannot start step ${p.stepId}: ${gate.reason} (RPH-EXE-005).`,
					gate.blockerStepId ? [p.stepId, gate.blockerStepId] : [p.stepId]
				);
			return null;
		}
	});
};

/** CompleteExecutionStep — a step RUNNING -> SUCCEEDED. Must record an output or an explicit no-output result
 * (RPH-EXE-006); step success drives the EXECUTION dimension only — never assurance (INV-5). */
export const completeExecutionStep: CommandHandler = (ctx, command) => {
	// The ratified §16.1 command type, not a local structural guess: the bus validates the payload against
	// CompleteExecutionStepPayloadSchema before this runs, so executionAttemptId/detectedAssumptionIds (which the
	// old cast omitted) and the two id arrays (which it wrongly made optional) are all guaranteed present.
	const p = command.payload as CompleteExecutionStepPayload;
	return advanceStep(ctx, command, {
		stepId: p.executionStepId,
		// drivesFrom RUNNING (declared in STEP_COMMAND_SPECS). A re-issued Complete on a SUCCEEDED step used to be
		// NOOP-absorbed while still emitting a second ExecutionStepSucceeded — and the condition subject folds
		// last-write-wins, so a re-Complete carrying a different structuredResult could retroactively flip an
		// already-resolved BRANCH.
		spec: STEP_COMMAND_SPECS.CompleteExecutionStep,
		// DWP-09's branch-decision recording used to live HERE, as a `mutateStep` closure private to this one handler.
		// It has moved into `advanceStep`'s settlement seam (WP-10), for two reasons that are the finding itself:
		//   1. It read the plan through a SECOND store load and cloned only the step STATE, while the evaluator it
		//      passed had already folded its subject from the committed log — so the branch could not see its own
		//      result and the DEFAULT arm was always recorded (F-02/07/24).
		//   2. Being private to Complete, it left Skip — the OTHER command that drives a step to terminal-success —
		//      recording nothing, and Skip's silence was indistinguishable from the bug (F-15/21/23).
		// The seam is keyed on `spec.branchDecision`, so every settling command's position is declared and total.
		// DOC-007 §16.2 ExecutionStepSucceededPayload. The five id/ref fields are the command's own (§16.1 and §16.2
		// share them verbatim); resultingExecutionState is §16.2's const, and is the EXECUTION dimension only —
		// §16.2 L1244 / INV-5: step success never implies assuranceState=SATISFIED.
		// Contract-drift fix: §16.1's executionProvenance (WHO/WHAT produced this step) and structuredResult (the
		// inline result content) were §16.2-undeclared and so validated then discarded into neither store — the
		// governed stream could not name who produced a high-consequence step nor what it returned. Both now carried
		// (optional, authored atop the ratified §16.2 shape); this is the trace over non-deterministic agent work the
		// system exists to make reasoning-about. resultStatus stays dropped: it is redundant with the const
		// resultingExecutionState. ExecutionProvenance is now a contracted shape (§7.1-grounded, §16 item 23 filled under §0.3), and the
		// floor gate reads it as an authoritative aiProduced signal-0 (see the precheck below).
		eventPayload: {
			executionStepId: p.executionStepId,
			executionAttemptId: p.executionAttemptId,
			outputArtifactIds: p.outputArtifactIds,
			proposedEvidenceIds: p.proposedEvidenceIds,
			detectedAssumptionIds: p.detectedAssumptionIds,
			resultingExecutionState: 'SUCCEEDED',
			executionProvenance: p.executionProvenance,
			...(p.structuredResult !== undefined ? { structuredResult: p.structuredResult } : {}),
			// WP-11: the no-output ASSERTION is carried onto the event, not merely validated. Without it the stream
			// still could not distinguish an explicit no-output from a silent one on replay — the very distinction
			// §2.6 requires — and RPH-EXE-006 would be enforced at the door but unrecorded thereafter.
			...(p.noOutputResult !== undefined ? { noOutputResult: p.noOutputResult } : {})
		} satisfies ExecutionStepSucceededPayload,
		precheck: (step) => {
			// RPH-EXE-006 (JAN-EXECREM WP-11 / F-01 limb A). `explicitNoOutput` is now the CALLER'S ASSERTION, read
			// from the payload — never `!hasOutput`, which made the kernel's disjunction `b || !b` and left a ratified
			// conformance invariant enforced nowhere while this file's prose claimed it enforced it.
			//
			// RESIDUAL, registered rather than carried: an assertion is still a caller's word. `declaresOutputBindings`
			// is the one limb recorded state can contribute — the authored step's own declaration — but a step
			// authored with `outputBindings: []` can assert no-output and nothing in state can disagree. That is the
			// same shape as the `!!waiverOrRevisionId` booleans this programme is elsewhere removing, and it is
			// narrowed, not closed: the assertion is now recorded WITH its reason and detail, so a false one is a
			// durable, attributable claim in the governed stream rather than an absence nobody can see.
			const hasOutput =
				(p.outputArtifactIds?.length ?? 0) > 0 || (p.proposedEvidenceIds?.length ?? 0) > 0;
			const noOutput = p.noOutputResult;
			const outputBindings = step.outputBindings;
			const check = validateStepCompletion({
				hasOutput,
				explicitNoOutput: noOutput !== undefined,
				// TIMEOUT / NO_CANDIDATE_OUTPUT are failure-shaped; the other two reasons are genuine successes that
				// produced nothing downstream-consumable.
				noOutputReasonIsSuccessCompatible:
					noOutput === undefined ||
					noOutput.reason === 'NO_DOWNSTREAM_CONSUMABLE_RESULT' ||
					noOutput.reason === 'SIDE_EFFECT_ONLY',
				// The state-derived corroboration limb: the authored step's own declaration, not the caller's word.
				declaresOutputBindings: Array.isArray(outputBindings) && outputBindings.length > 0
			});
			if (!check.ok)
				// MISSING is the ratified invariant's own case (RPH-EXE-006) → INVARIANT_VIOLATION. The other three
				// mean the payload is internally inconsistent, contradicts the authored step, or names the wrong
				// command → VALIDATION_SEMANTIC_FAILED. The kernel's code is carried INTO the message so a caller can
				// tell the four apart, and so a test can name which cell it killed.
				return reject(
					command,
					check.errorCode === 'RPH_STEP_RESULT_MISSING'
						? 'RPH_INVARIANT_VIOLATION'
						: 'RPH_VALIDATION_SEMANTIC_FAILED',
					`CompleteExecutionStep blocked (${check.errorCode}): ${check.reason ?? 'step result missing'}.`,
					[p.executionStepId]
				);
			// Floor gate (§8.4 step 4), plane-agnostic: a step whose OUTPUT has a recorded de minimis assurance floor
			// must have it SATISFIED (or waived) before the step may SUCCEED — exec != assurance (INV-5); step
			// success drives the EXECUTION dimension only and never grants assurance.
			//
			// `aiProduced` is DERIVED from the step, never asserted. It was the literal `false`, which — with
			// floor-gate's "not AI-produced and never assessed ⇒ permitted" rule — made this gate unreachable for
			// exactly the population it exists to catch: an AI step nobody ever assessed. An AI step was blocked
			// only once someone had already assessed it. §8.4 L841 makes Reasoning Review mandatory "when the
			// transformation is produced by or materially shaped by an AI/agent", and L854: "A missing, stale,
			// malformed, failed, unavailable, or independence-invalid required review cannot satisfy assurance or
			// permit its protected transition." A never-recorded floor over an AI step is that missing review.
			// The authoring plane already derived this honestly (pwa-authoring.ts); the two planes disagreed.
			//
			// THE SUBJECT IS THE RESULT, NOT THE STEP. This comment has always said "the step's OUTPUT" while the
			// code passed `p.executionStepId` — and `stepOutputIsAiProduced` is likewise named for the output. The
			// naming was right; the subject was wrong. A step can never be a legal subject: DOC-004 invariant 2
			// requires every assessment to identify its subject semantic version, and an ExecutionStep has no
			// envelope, no registry row, and no version to identify (see `stepResultSubjects`). So the floor is
			// judged per downstream-consumable result (§8.4 L844), each at its own store-derived version — which
			// also closes the execution plane's stale-floor hole: a floor recorded against v1 no longer authorizes
			// a v2 output.
			const aiProduced = stepOutputIsAiProduced(ctx, step, command, p.executionProvenance);
			const resultIds = [...(p.outputArtifactIds ?? []), ...(p.proposedEvidenceIds ?? [])];
			const { subjects, unresolved } = stepResultSubjects(ctx, resultIds);
			// An output naming no recorded object cannot have been assessed, and §8.4 L854 forbids a missing
			// required review from permitting a protected transition. Failing closed here also stops the obvious
			// bypass: naming a nonexistent artifact id would otherwise yield zero subjects and sail through.
			if (unresolved.length > 0) {
				return reject(
					command,
					'RPH_VALIDATION_SEMANTIC_FAILED',
					`CompleteExecutionStep blocked: step ${p.executionStepId} names result(s) that are not recorded objects (${unresolved.join(', ')}). Record them (RecordArtifact / ProposeEvidence) before completing — an unrecorded output cannot be assured.`,
					[p.executionStepId, ...unresolved]
				);
			}
			// F-01 limb B. The floor gate below is a loop over `subjects`, and a loop over an empty list is not a
			// gate — it is a no-op wearing one's clothes. An AI-produced step naming ZERO results therefore skipped
			// §8.4 entirely (reproduced live), while its sibling naming one real artifact was refused. This is the
			// zero-subject floor: AI-produced content may not enter the governed stream with nothing to assess.
			//
			// COMPOSITION WITH LIMB A, which is what makes the bypass closed rather than narrowed: reaching here with
			// `subjects.length === 0` means the caller ASSERTED no-output (limb A refused the silent case above), so
			// this rule reads "you may not assert you produced nothing while shipping something". A genuine empty
			// attempt — Coding Agent Guide L1964's timeout with no candidate output — is untouched.
			const unassessable = unassessableAiContentBlock({
				aiProduced,
				subjectCount: subjects.length,
				structuredResultHasContent: structuredResultHasContent(p.structuredResult)
			});
			if (unassessable)
				return reject(
					command,
					'RPH_INVARIANT_VIOLATION',
					`CompleteExecutionStep blocked: step ${p.executionStepId} is AI-produced and carries a structuredResult, but names no recorded, assessable result (${unassessable}). Record the content as an Artifact (RecordArtifact) or Evidence (ProposeEvidence) and name it, so its de minimis assurance floor can be judged.`,
					[p.executionStepId]
				);
			for (const subject of subjects) {
				const blocking = floorGateBlock(ctx, subject.subjectId, {
					aiProduced,
					subjectVersion: subject.version,
					now: command.issuedAt
				});
				if (blocking) {
					const detail = blocking.map((b) => `${b.policyId}=${b.disposition}`).join(', ');
					return reject(
						command,
						'RPH_INVARIANT_VIOLATION',
						`CompleteExecutionStep blocked: the de minimis assurance floor is not SATISFIED for result ${subject.subjectId} at v${subject.version}, produced by step ${p.executionStepId} (${detail}). Satisfy or record a waiver over the floor of that result before completing.`,
						[p.executionStepId, subject.subjectId]
					);
				}
			}
			return null;
		}
	});
};

/** FailExecutionStep — a step RUNNING -> FAILED. */
export const failExecutionStep: CommandHandler = (ctx, command) => {
	const p = command.payload as { stepId: string; failureReason?: string; failureClass?: string };
	return advanceStep(ctx, command, {
		stepId: p.stepId,
		spec: STEP_COMMAND_SPECS.FailExecutionStep,
		// JAN-EXECREM WP-13 / F-25. This supplied NO eventPayload, so `advanceStep` fell through to the raw COMMAND
		// payload — which omits `stepState`, a field ExecutionStepFailedPayloadSchema declares REQUIRED. Every
		// sibling step command supplies it. The consequence is not cosmetic: FAILED and the post-retry QUEUED were
		// the only two step states in the whole machine a log-driven fold could not observe, and they are exactly
		// the two RPH-EXE-008's retry cap governs — so a rebuilt aggregate showed a clean run of attempts with no
		// failures and no retries. `eventPayload` is REQUIRED on advanceStep now, so this cannot recur silently.
		eventPayload: {
			stepId: p.stepId,
			failureReason: p.failureReason ?? 'failed',
			...(p.failureClass ? { failureClass: p.failureClass } : {}),
			stepState: 'FAILED'
		}
	});
};

/** The default retry cap when the plan's RetryPolicy carries no valid maxAttempts (the Conformance §12 fixture
 *  value; the RetryPolicy shape itself is Source-TBD, so only a conventional `maxAttempts` key is read). */
const DEFAULT_MAX_ATTEMPTS = 3;

/** Attempts made for a step = count of ExecutionStepStarted events (each Started = one RUNNING episode = one
 *  attempt; ExecutionStepRetried is a re-queue MARKER, NOT an attempt — JAN-EXECPLAN §19 L3-3). Mirrors the
 *  execution-attempts projection's attempt_number, counted here from the authoritative event log (replay-stable). */
function attemptsMadeForStep(ctx: HandlerContext, planId: string, stepId: string): number {
	let n = 0;
	for (const e of ctx.store.readAllEvents()) {
		if (
			e.eventType === 'ExecutionStepStarted' &&
			e.aggregateId === planId &&
			(e.payload as { stepId?: string })?.stepId === stepId
		)
			n += 1;
	}
	return n;
}

/** The retry cap, read as a CONVENTION on the Source-TBD RetryPolicy bag: a valid positive integer `maxAttempts`,
 *  else DEFAULT. Guards the degenerate values (absent/NaN/0/negative/non-integer — §19 L3-6). */
function retryCapFor(plan: Record<string, unknown>): number {
	const raw = (plan.retryPolicy as { maxAttempts?: unknown } | undefined)?.maxAttempts;
	return typeof raw === 'number' && Number.isInteger(raw) && raw >= 1 ? raw : DEFAULT_MAX_ATTEMPTS;
}

/**
 * RetryExecutionStep — a FAILED step -> QUEUED (re-attempt). Two prechecks, in order:
 *  1. RPH-EXE-002 / §35.1 (DWP-02, §19 L3-5): a retry RE-OPENS the attempt cycle, so a SUPERSEDED/terminal plan must
 *     reject it — not only StartExecutionStep. Mirrors the start precheck so both reject a non-ACTIVE plan identically.
 *  2. RPH-EXE-008 (DWP-04): the ready-made kernel `retryDecision` caps retries at the plan's RetryPolicy maxAttempts
 *     (MAX-TOTAL-ATTEMPTS, 1-based). attemptsMade = count(ExecutionStepStarted) (NOT +Retried). On exhaustion the
 *     retry is REJECTED (there is no canonical RPH_RETRY_EXHAUSTED code — the cap is an invariant, so
 *     RPH_INVARIANT_VIOLATION) surfacing the permitted control actions {CHANGE_TACTIC, REPLAN_EXECUTION, ESCALATE,
 *     REJECT, ABANDON}. At maxAttempts=3: 2 retries proceed (opening attempts 2,3), the retry at attemptsMade=3 is
 *     refused. Exec ≠ assurance (INV-5): the retry moves only stepState.
 */
export const retryExecutionStep: CommandHandler = (ctx, command) => {
	const p = command.payload as { stepId: string; retryReason?: string };
	return advanceStep(ctx, command, {
		stepId: p.stepId,
		spec: STEP_COMMAND_SPECS.RetryExecutionStep,
		// WP-13 / F-25 (see failExecutionStep). The raw command payload additionally carried `retryReason`, which
		// the ratified strictObject did not declare — so the emitted event failed its own schema on TWO counts,
		// silently, because this event is not in RATIFIED_EVENT_PAYLOADS and the (d2) gate never saw it. WP-1 added
		// `retryReason` to the declared shape; it is now emitted deliberately rather than leaking.
		eventPayload: {
			stepId: p.stepId,
			...(p.retryReason ? { retryReason: p.retryReason } : {}),
			stepState: 'QUEUED'
		},
		precheck: (step, plan) => {
			const attemptsMade = attemptsMadeForStep(ctx, command.targetAggregateId, p.stepId);
			const maxAttempts = retryCapFor(plan);
			const decision = retryDecision({
				attemptsMade,
				maxAttempts,
				lastAttemptFailed: String(step.stepState) === 'FAILED'
			});
			if (decision.mustSelectAlternateAction)
				return reject(
					command,
					'RPH_INVARIANT_VIOLATION',
					`Cannot retry step ${p.stepId}: the retry cap (${maxAttempts} total attempts) is reached after ${attemptsMade} attempt(s) — the controller must not retry again (RPH-EXE-008); select an alternate control action: ${decision.permittedControlActions.join(', ')}.`
				);
			return null;
		}
	});
};

/**
 * SkipExecutionStep — a step READY|QUEUED -> SKIPPED (JAN-EXECPLAN-DR-003 DWP-02 / §21.1). Routed through the ratified
 * `canSkipStep` kernel, FAIL-CLOSED: `mandatory` is CALLER-ASSERTED (no step-level mandatory field is ratified) and
 * defaults to TRUE when omitted, so an unmarked step is treated as MANDATORY and REQUIRES an authorized plan revision
 * or waiver (waiverOrRevisionId) — a mandatory-no-waiver skip is REJECTED, never fail-open (§19 L3-B2). A plan-ACTIVE
 * precheck mirrors start/retry (a superseded/terminal plan opens no new work, RPH-EXE-002). SKIPPED is terminal-success
 * for the start-gate (execution-view.ts startableStepId), so skipping the startable step advances the sequence — no
 * deadlock (§19 L3-M6). Exec ≠ assurance (INV-5): the skip moves only stepState.
 */
export const skipExecutionStep: CommandHandler = (ctx, command) => {
	const p = command.payload as SkipExecutionStepPayload;
	return advanceStep(ctx, command, {
		stepId: p.stepId,
		spec: STEP_COMMAND_SPECS.SkipExecutionStep,
		// The event records the RESULTING state + the authorization; `mandatory` is a decision-time assertion, not a
		// recorded fact (the ratified ExecutionStepSkipped shape carries no `mandatory`), so it does not ride the event.
		eventPayload: {
			stepId: p.stepId,
			...(p.waiverOrRevisionId ? { waiverOrRevisionId: p.waiverOrRevisionId } : {}),
			stepState: 'SKIPPED'
		},
		precheck: () => {
			// §21.1 RESOLVED, not assumed (JAN-EXECREM WP-12 / F-30). `hasAuthorizedWaiverOrRevision` used to be
			// `!!p.waiverOrRevisionId`, so a governed act was satisfied by ANY NON-EMPTY STRING — `'x'` retired a
			// mandatory step. The id is now resolved to an EFFECTIVE REPLAN/WAIVER decision that names this plan
			// and THIS step; see skip-authorization.ts for the six ordered checks and why the authorization is
			// execution-scoped rather than routed through the assurance plane's WaiverDetail.
			//
			// Sited AHEAD of canSkipStep so a supplied-but-invalid id is refused as the category/scope error it is
			// (RPH_VALIDATION_SEMANTIC_FAILED) rather than surfacing as "you need a waiver" when one was offered.
			if (p.waiverOrRevisionId) {
				const authorized = resolveSkipAuthorization(ctx, {
					planId: command.targetAggregateId,
					stepId: p.stepId,
					authorizationId: p.waiverOrRevisionId,
					now: command.issuedAt
				});
				if (!authorized.ok)
					return reject(
						command,
						'RPH_VALIDATION_SEMANTIC_FAILED',
						`Cannot skip step ${p.stepId}: ${authorized.reason} (§21.1 requires an AUTHORIZED plan revision or waiver — a bare id is not an authorization).`,
						[p.stepId, p.waiverOrRevisionId]
					);
			}
			// FAIL-CLOSED: an unmarked step defaults to MANDATORY (mandatory ?? true), so it needs an authorized
			// waiver/revision to be skipped — never fail-open. `canSkipStep` is the ratified kernel (rph-domain).
			// Its second input is now a RESOLVED fact rather than a truthiness test.
			const check = canSkipStep({
				mandatory: p.mandatory ?? true,
				hasAuthorizedWaiverOrRevision: !!p.waiverOrRevisionId
			});
			if (!check.ok)
				return reject(
					command,
					'RPH_INVARIANT_VIOLATION',
					`Cannot skip step ${p.stepId}: ${check.reason ?? 'skipping a mandatory step requires an authorized plan revision or waiver'} (§21.1). Provide waiverOrRevisionId, or assert mandatory:false only for a genuinely optional step.`
				);
			return null;
		}
	});
};

/**
 * CancelExecutionStep — a step READY|QUEUED|RUNNING|WAITING -> CANCELLED (JAN-EXECPLAN-DR-003 DWP-02 / §26.4). Cancel
 * is CLEANUP, not new work: it is permitted even under a SUPERSEDED/terminal plan (RPH-EXE-002 forbids OPENING new
 * work/attempts, not terminating an existing step), so there is DELIBERATELY no plan-ACTIVE precheck — the
 * ExecutionStep.stepState machine (checkTransition, from READY/QUEUED/RUNNING/WAITING) alone gates the source state
 * (§19 L3-M11). The `reason` is recorded on the event so the governed stream names the control action. Exec ≠
 * assurance (INV-5): the cancel moves only stepState.
 */
export const cancelExecutionStep: CommandHandler = (ctx, command) => {
	const p = command.payload as CancelExecutionStepPayload;
	return advanceStep(ctx, command, {
		stepId: p.stepId,
		spec: STEP_COMMAND_SPECS.CancelExecutionStep,
		eventPayload: {
			stepId: p.stepId,
			reason: p.reason,
			stepState: 'CANCELLED'
		}
	});
};

/**
 * PruneExecutionStep — a not-taken/unreachable step QUEUED -> SKIPPED (JAN-EXECPLAN-DR-004 DWP-03 / D5, hardened DWP-07).
 *
 * A SYSTEM prune of a BRANCH's not-taken arm (or its transitively-unreachable downstream). It does NOT route through
 * canSkipStep because the plan's own declared branch logic — not an operator — excludes the step, so no waiver applies.
 * That exemption is only defensible if the step really IS excluded, and it was NOT checked: the sole precheck was
 * plan-ACTIVE, so ANY QUEUED/READY step could be driven to terminal-success SKIPPED with no waiver, including a
 * MANDATORY step on the taken path of a plan with no transitions at all. That is precisely the outcome §21.1's
 * canSkipStep exists to refuse. The prunability check below closes that back door: prune is now authorised by the SAME
 * pure read-model the UI offers it from, exactly as startExecutionStep is authorised by startStepGate.
 *
 * Deadness itself is NOT recorded (DWP-08): it is STRUCTURAL — the gate computes reachability from the graph — so it
 * cannot be bypassed by reaching SKIPPED through some other command, and needs no persisted flag (which also means
 * plans written by earlier builds read correctly). Exec != assurance (INV-5): the prune moves only stepState.
 */
export const pruneExecutionStep: CommandHandler = (ctx, command) => {
	const p = command.payload as { stepId: string };
	// JAN-EXECREM WP-14 / F-37 — prune provenance is DERIVED from the graph that AUTHORIZED the prune.
	//
	// The provenance is the SOLE justification DR-004 §19-M1 gave for minting `ExecutionStepPruned` rather than
	// reusing the waived-skip event ("do not conflate a system prune with a user waiver"). No producer ever
	// populated it, so the two events differed only by TYPE and never by CONTENT: an auditor replaying the stream
	// could not tell which decision excluded the step, which is exactly what the new event existed to preserve.
	//
	// A CORRECTION TO THE FINDING, which claimed both fields were optional on the COMMAND and merely forwarded.
	// They are not: `PruneExecutionStepPayloadSchema` is a strictObject carrying only `stepId`, so the handler's
	// `p.selectedByBranchStepId` / `p.selectedEdgeId` reads were UNREACHABLE DEAD CODE — the same shape as F-31's
	// unreachable `p.runtimeBindingId`, in the same file, which the finding did not notice. So there was never a
	// caller to distrust; there was simply no producer. Deriving it is the only way it can be recorded at all.
	const gatePlanForPrune = toGatePlan(loadPlanState(ctx, command.targetAggregateId));
	const provenance = pruneProvenance(
		gatePlanForPrune,
		p.stepId,
		guardEvaluatorFor(ctx, command.targetAggregateId, gatePlanForPrune)
	);
	return advanceStep(ctx, command, {
		stepId: p.stepId,
		spec: STEP_COMMAND_SPECS.PruneExecutionStep,
		eventPayload: {
			stepId: p.stepId,
			...(provenance === undefined
				? {}
				: {
						selectedByBranchStepId: provenance.branchStepId,
						...(provenance.selectedEdgeId === undefined
							? {}
							: { selectedEdgeId: provenance.selectedEdgeId }),
						...(provenance.excludedEdgeId === undefined
							? {}
							: { excludedEdgeId: provenance.excludedEdgeId })
					}),
			stepState: 'SKIPPED'
		},
		precheck: (_step, plan) => {
			const gatePlan = toGatePlan(plan);
			if (
				!prunableStepIds(
					gatePlan,
					guardEvaluatorFor(ctx, command.targetAggregateId, gatePlan)
				).includes(p.stepId)
			)
				return reject(
					command,
					'RPH_INVARIANT_VIOLATION',
					`Cannot prune step ${p.stepId}: it is still reachable — every in-edge would have to be excluded by the plan's own branch logic (or come from an already-pruned step). A prune is NOT a waiver: to skip a reachable step use SkipExecutionStep, which enforces the mandatory/waiver rule (§21.1).`,
					[p.stepId]
				);
			return null;
		}
	});
};

/**
 * EnterExecutionStepWait — a step RUNNING -> WAITING (JAN-EXECPLAN-DR-004 DWP-04 / D6). The machine declared WAITING and
 * the ExecutionStepWaiting event was pre-authored, but NO command could emit it: WAITING was an unreachable state
 * (DS-004 F-6). A wait SUSPENDS work already RUNNING rather than opening any, so — like Cancel/Fail and UNLIKE
 * Start/Retry/Resolve — there is DELIBERATELY no plan-ACTIVE precheck: RPH-EXE-002 forbids OPENING work under a
 * superseded/terminal plan, not recording that a running step is blocked. The machine (checkTransition, from RUNNING)
 * alone gates the source. Exec != assurance (INV-5): the wait moves only stepState.
 */
export const enterExecutionStepWait: CommandHandler = (ctx, command) => {
	const p = command.payload as { stepId: string; waitReason?: string };
	return advanceStep(ctx, command, {
		stepId: p.stepId,
		spec: STEP_COMMAND_SPECS.EnterExecutionStepWait,
		// The event records the RESULTING state (mirroring Started/Skipped/Pruned): the command payload carries no
		// stepState, and the ratified event declares it required.
		eventPayload: {
			stepId: p.stepId,
			...(p.waitReason ? { waitReason: p.waitReason } : {}),
			stepState: 'WAITING'
		}
	});
};

/**
 * ResolveExecutionStepWait — a step WAITING -> RUNNING (JAN-EXECPLAN-DR-004 DWP-04 / D6). The machine ratifies this
 * arrow but names its trigger only as the bare phrase "wait resolved"; DWP-04 MINTS ExecutionStepWaitResolved so the
 * resume is a governed-stream FACT rather than a state change invisible to replay (the DS-004 F-6 hole). Resuming
 * re-opens RUNNING — the state in which attempts execute — so it DECLARES planLiveness REQUIRES_ACTIVE_PLAN in
 * STEP_COMMAND_SPECS (RPH-EXE-002 / §35.1); under a superseded plan the correct action is Cancel, not resume. The resume is
 * NOT a new attempt: attemptsMadeForStep counts ExecutionStepStarted only, so a wait/resume cycle continues the SAME
 * attempt and does not consume the retry cap (RPH-EXE-008). Exec != assurance (INV-5): moves only stepState.
 */
export const resolveExecutionStepWait: CommandHandler = (ctx, command) => {
	const p = command.payload as { stepId: string; resolution?: string };
	return advanceStep(ctx, command, {
		stepId: p.stepId,
		spec: STEP_COMMAND_SPECS.ResolveExecutionStepWait,
		eventPayload: {
			stepId: p.stepId,
			...(p.resolution ? { resolution: p.resolution } : {}),
			stepState: 'RUNNING'
		},
		// The plan-ACTIVE check that used to be inlined here is now its declared row in STEP_COMMAND_SPECS
		// (planLiveness: REQUIRES_ACTIVE_PLAN), enforced by advanceStep for all nine commands uniformly.
	});
};
