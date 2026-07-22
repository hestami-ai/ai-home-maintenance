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
	canSkipStep,
	ConditionExpressionSchema,
	conditionStepRefs,
	evaluateCondition,
	prunableStepIds,
	retryDecision,
	startStepGate,
	validateStepCompletion,
	validateTransitionGraph,
	type AssumptionView,
	type EdgeGuardEvaluator,
	type GatePlan
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
import { floorGateBlock, stepOutputIsAiProduced, stepResultSubjects } from './floor-gate.js';

const PLAN = 'EXECUTION_PLAN';
const MACHINE = 'ExecutionPlan.status';
const STEP_MACHINE = 'ExecutionStep.stepState';

/** Project a plan state bag into the pure transition-graph gate read-model (DR-004 DWP-01). The SAME GatePlan the
 *  read-model builds, so the engine authority (startExecutionStep) and the UI affordance cannot diverge (§19-M2). */
function toGatePlan(plan: Record<string, unknown>): GatePlan {
	const steps = (plan.steps as Array<{ id?: unknown; stepState?: unknown }>) ?? [];
	const transitions = (plan.transitions as Array<Record<string, unknown>>) ?? [];
	return {
		status: String(plan.status ?? ''),
		steps: (steps as Array<Record<string, unknown>>).map((s) => ({
			id: String(s.id ?? ''),
			stepState: String(s.stepState ?? ''),
			// stepType decides which node may branch EXCLUSIVELY; prunedAsUnreachable distinguishes a step SKIPPED
			// because the plan excluded it (dead — satisfies nothing) from one skipped by an operator waiver (DWP-07).
			...(s.stepType === undefined ? {} : { stepType: String(s.stepType) }),
			...(s.prunedAsUnreachable === true ? { prunedAsUnreachable: true } : {})
		})),
		transitions: transitions.map((t) => ({
			sourceStepId: t.sourceStepId === undefined ? undefined : String(t.sourceStepId),
			targetStepId: t.targetStepId === undefined ? undefined : String(t.targetStepId),
			transitionType: t.transitionType === undefined ? undefined : String(t.transitionType),
			conditionExpression: t.conditionExpression
		}))
	};
}

/**
 * The CONDITIONAL-edge guard evaluator for a plan, or `undefined` when the plan has no guarded edge at all.
 *
 * Building it folds the plan's condition subject out of the event log, which means reading the WHOLE store. Doing that
 * unconditionally made every StartExecutionStep — the hottest command in the system, and one that previously read no
 * events whatsoever — O(total events across all aggregates), even for a linear plan whose gate never consults a guard
 * (DWP-07, flagged by the audit's completeness sweep). Returning undefined is not a behaviour change: the gate's
 * evaluator parameter is optional and is only ever called for a CONDITIONAL edge, of which there are none here.
 */
function guardEvaluatorFor(
	ctx: HandlerContext,
	planId: string,
	gatePlan: GatePlan
): EdgeGuardEvaluator | undefined {
	const hasGuard = (gatePlan.transitions ?? []).some(
		(t) => t.conditionExpression !== undefined || t.transitionType === 'CONDITIONAL'
	);
	if (!hasGuard) return undefined;
	const subject = buildConditionSubject(gatePlan.steps, ctx.store.readAllEvents(), planId);
	return (edge) => {
		const parsed = ConditionExpressionSchema.safeParse(edge.conditionExpression);
		return parsed.success && evaluateCondition(parsed.data, subject);
	};
}

/** ProposeExecutionPlan — create the plan for a PWU, submitted for review (UNDER_REVIEW). */
export const proposeExecutionPlan: CommandHandler = (ctx, command, payload) => {
	const p = payload as ProposeExecutionPlanPayload;
	if (!ctx.store.loadObject(p.workUnitId)) {
		return reject(
			command,
			'RPH_VALIDATION_SEMANTIC_FAILED',
			`ProposeExecutionPlan requires an existing work unit ${p.workUnitId}`,
			[p.executionPlanId]
		);
	}
	// DR-004 DWP-01: a malformed transition graph must never reach ACTIVE. A NO-OP for a linear plan (empty
	// transitions[]); a graph plan is validated (dangling ids, one entry, reachability, acyclicity, BRANCH-default).
	const graph = validateTransitionGraph(
		p.steps.map((s) => ({ id: s.id, stepType: s.stepType })),
		(p.transitions ?? []).map((t) => ({
			sourceStepId: t.sourceStepId,
			targetStepId: t.targetStepId,
			transitionType: t.transitionType,
			conditionExpression: t.conditionExpression
		}))
	);
	if (!graph.ok) {
		return reject(
			command,
			'RPH_VALIDATION_SEMANTIC_FAILED',
			`ProposeExecutionPlan blocked: malformed transition graph — ${graph.message} (DR-004 DWP-01).`,
			[p.executionPlanId]
		);
	}
	// DR-004 DWP-02: each edge's conditionExpression must parse against the hand-authored grammar (reject malformed),
	// and every stepId it references must resolve to a declared step — so a guard is never silently false at runtime.
	const declaredStepIds = new Set(p.steps.map((s) => s.id));
	for (const t of p.transitions ?? []) {
		if (t.conditionExpression === undefined) continue;
		const parsed = ConditionExpressionSchema.safeParse(t.conditionExpression);
		if (!parsed.success) {
			return reject(
				command,
				'RPH_VALIDATION_SCHEMA_FAILED',
				`ProposeExecutionPlan blocked: a transition conditionExpression is malformed (DR-004 DWP-02): ${parsed.error.issues[0]?.message ?? 'invalid'}.`,
				[p.executionPlanId]
			);
		}
		const badRef = conditionStepRefs(parsed.data).find((id) => !declaredStepIds.has(id));
		if (badRef) {
			return reject(
				command,
				'RPH_VALIDATION_SEMANTIC_FAILED',
				`ProposeExecutionPlan blocked: a transition condition references step "${badRef}", which is not a declared step in the plan (DR-004 DWP-02).`,
				[p.executionPlanId]
			);
		}
	}
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
		// The event records the RESULTING state. ExecutionPlanProposed declares the plan's identity + `status`
		// (UNDER_REVIEW), and references its steps/transitions by ID (not the full embedded objects the command
		// carries) — so the event is a PROJECTION of the command, plus the created status the command omits. The
		// policies ride when non-empty (the reference undertaking supplies `{}`, so they are omitted — not specified,
		// not a fabricated empty). (Pinned defect in emitted-event-conformance; now conforms.)
		eventPayload: {
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
		}
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
		guard: (state, hctx) => {
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

/** CancelExecutionPlan — APPROVED|ACTIVE -> CANCELLED (emits ExecutionTerminated). */
export const cancelExecutionPlan: CommandHandler = (ctx: HandlerContext, command: DomainCommand) =>
	advanceStatus(ctx, command, {
		objectType: PLAN,
		statusField: 'status',
		machine: MACHINE,
		target: 'CANCELLED',
		eventType: 'ExecutionTerminated'
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
		guard: (state) => {
			const steps = Array.isArray(state.steps)
				? (state.steps as Array<{ stepState?: string }>)
				: [];
			if (steps.length === 0)
				return reject(
					command,
					'RPH_INVARIANT_VIOLATION',
					`CompleteExecutionPlan blocked: plan ${command.targetAggregateId} has no steps — an empty plan cannot be COMPLETED (§20.1 requires all required steps to reach terminal success).`
				);
			const offenders = steps.filter(
				(s) => s.stepState !== 'SUCCEEDED' && s.stepState !== 'SKIPPED'
			);
			if (offenders.length > 0)
				return reject(
					command,
					'RPH_INVARIANT_VIOLATION',
					`CompleteExecutionPlan blocked: plan ${command.targetAggregateId} has ${offenders.length} step(s) not in terminal success (${offenders.map((s) => s.stepState ?? 'undefined').join(', ')}); COMPLETED requires every step SUCCEEDED or SKIPPED (§20.1 success allow-list). FailExecutionPlan a plan with a failed step.`
				);
			if (!steps.some((s) => s.stepState === 'SUCCEEDED'))
				return reject(
					command,
					'RPH_INVARIANT_VIOLATION',
					`CompleteExecutionPlan blocked: plan ${command.targetAggregateId} has no SUCCEEDED step — every step is SKIPPED, so the plan produced nothing to complete on. At least one step must SUCCEED (aligning the plan-level rule with the ratified PWU-level rejectUnbackedExecutionSuccess, §21.1). FailExecutionPlan or SupersedeExecutionPlan instead.`
				);
			return null;
		}
	});

/** FailExecutionPlan — ACTIVE -> FAILED (JAN-EXECPLAN-DR-002 DWP-01 / §36.2). The machine only permits FAILED from
 *  ACTIVE, so checkTransition guards the source; the event records the failureReason. Exec ≠ assurance (INV-5). */
export const failExecutionPlan: CommandHandler = (ctx, command) => {
	const p = command.payload as FailExecutionPlanPayload;
	return advanceStatus(ctx, command, {
		objectType: PLAN,
		statusField: 'status',
		machine: MACHINE,
		target: 'FAILED',
		eventType: 'ExecutionPlanFailed',
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
		guard: (state) => {
			const successor = ctx.store.loadObject(p.supersedingExecutionPlanId)?.state as
				| { workUnitId?: string }
				| undefined;
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

/** ApplyTacticalChange — ACTIVE -> ACTIVE (a within-plan tactical adjustment; no plan-status change). Requires
 * the plan to be ACTIVE and an authorizing policy (tactical changes only when policy authorizes, §20.2). */
export const applyTacticalChange: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, command, {
		objectType: PLAN,
		statusField: 'status',
		machine: MACHINE,
		target: 'ACTIVE',
		eventType: 'TacticalChangeApplied',
		guard: (state) =>
			state.status === 'ACTIVE'
				? null
				: reject(
						command,
						'RPH_ILLEGAL_STATE_TRANSITION',
						`ApplyTacticalChange requires an ACTIVE plan (is ${String(state.status)})`
					)
	});

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
		readonly target: string;
		readonly eventType: string;
		readonly precheck?: (
			step: Record<string, unknown>,
			plan: Record<string, unknown>
		) => ReturnType<typeof reject> | null;
		readonly mutateStep?: (step: Record<string, unknown>) => Record<string, unknown>;
		/** The EVENT payload. Omitted → the raw command payload (the default for the step events DOC-007 leaves
		 * unschematized). Mirrors kit.advanceStatus's `eventPayload`: the command shape is not the event shape. */
		readonly eventPayload?: unknown;
		/**
		 * The step states this command may be issued FROM — the `drivesFrom` its own vocab entry already declares.
		 *
		 * The machine alone is NOT sufficient (DWP-07). It classifies from===to as a NOOP, so a re-issued command was
		 * absorbed while STILL emitting an event; and it legalises every arrow into the target from ANY source, so
		 * StartExecutionStep (drivesFrom QUEUED) was happily accepted on a WAITING step because WAITING→RUNNING is a
		 * legal arrow — silently performing a RESUME, emitting a second ExecutionStepStarted that consumes one of the
		 * plan's retries (RPH-EXE-008), and bypassing the ExecutionStepWaitResolved event minted so a resume would be
		 * replayable. Likewise a re-issued Complete on a SUCCEEDED step was absorbed and REWROTE its structuredResult,
		 * which last-write-wins in the condition subject and can retroactively flip a resolved BRANCH.
		 *
		 * So every step command now states its legal source set explicitly, and the handler enforces the contract the
		 * vocab declares. Genuine transport retries are already absorbed upstream by idempotencyKey dedup, so a command
		 * that reaches here from the wrong state is a DISTINCT request and rejecting it is the honest answer.
		 */
		readonly requireFrom?: readonly string[];
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
	const precheckFailure = args.precheck?.(step, plan);
	if (precheckFailure) return precheckFailure;
	if (args.requireFrom && !args.requireFrom.includes(String(step.stepState)))
		return reject(
			command,
			'RPH_ILLEGAL_STATE_TRANSITION',
			`${command.commandType} requires step ${args.stepId} to be ${args.requireFrom.join(' or ')}, but it is ${String(step.stepState)}. The stepState machine may permit that arrow for a DIFFERENT command; this command declares drivesFrom ${args.requireFrom.join('|')}.`,
			[args.stepId]
		);
	const illegal = checkTransition(command, STEP_MACHINE, String(step.stepState), args.target);
	if (illegal) return illegal;
	const nextStep = { ...(args.mutateStep ? args.mutateStep(step) : step), stepState: args.target };
	const newSteps = steps.map((s, i) => (i === idx ? nextStep : s));
	const newRevision = loaded.revision + 1;
	const next = { ...nextEnvelope(plan, command, newRevision), steps: newSteps };
	const event = makeEvent(ctx, command, {
		eventType: args.eventType,
		aggregateType: PLAN,
		aggregateId: planId,
		aggregateRevision: newRevision,
		payload: args.eventPayload !== undefined ? args.eventPayload : command.payload
	});
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
	const p = command.payload as { stepId: string; runtimeBindingId?: string };
	return advanceStep(ctx, command, {
		stepId: p.stepId,
		target: 'RUNNING',
		eventType: 'ExecutionStepStarted',
		// drivesFrom QUEUED. NOT merely "not already RUNNING": the machine also legalises WAITING->RUNNING (the resume
		// arrow), so without this a Start on a WAITING step performed a resume, burning a retry (RPH-EXE-008) and
		// skipping the ExecutionStepWaitResolved fact. Resuming is ResolveExecutionStepWait's job.
		requireFrom: ['QUEUED'],
		// The event records the RESULTING state, not the command input: ExecutionStepStarted declares `stepState`
		// (the RUNNING it transitioned to), which `command.payload` ({ stepId }) does not carry — so the default
		// emitted `{ stepId }` was missing the one field the event exists to record. The event that says "this step
		// started" now contains the state it started INTO. (Pinned defect in emitted-event-conformance; now conforms.)
		eventPayload: {
			stepId: p.stepId,
			...(p.runtimeBindingId ? { runtimeBindingId: p.runtimeBindingId } : {}),
			stepState: 'RUNNING'
		},
		precheck: (_step, plan) => {
			if (plan.status !== 'ACTIVE')
				return reject(
					command,
					'RPH_ILLEGAL_STATE_TRANSITION',
					`Cannot start a step: plan ${command.targetAggregateId} is not ACTIVE (${String(plan.status)})`
				);
			// The linear/graph start-gate — the SAME rph-domain predicate the read-model (execution-view.ts
			// startableStepIds) uses, so the UI Start affordance and this engine authority cannot diverge (DR-004
			// §19-M2). Empty transitions[] ⇒ byte-identical linear (every earlier array-index step terminal-success);
			// a graph ⇒ the in-edge barrier (a PENDING in-edge blocks, naming its source). RPH-EXE-005.
			const gatePlan = toGatePlan(plan);
			// DWP-02: a CONDITIONAL in-edge's guard is evaluated against the plan's committed subject (a replay-safe
			// fold of committed step state + this plan's event log). Parse is safe (validated at propose). Built only
			// when the plan actually HAS a guarded edge (DWP-07) — a linear plan must not pay for an event-log scan.
			const gate = startStepGate(gatePlan, p.stepId, guardEvaluatorFor(ctx, command.targetAggregateId, gatePlan));
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
		target: 'SUCCEEDED',
		eventType: 'ExecutionStepSucceeded',
		// drivesFrom RUNNING. A re-issued Complete on a SUCCEEDED step used to be NOOP-absorbed while still emitting a
		// second ExecutionStepSucceeded — and the condition subject folds last-write-wins, so a re-Complete carrying a
		// different structuredResult could retroactively flip an already-resolved BRANCH.
		requireFrom: ['RUNNING'],
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
			...(p.structuredResult !== undefined ? { structuredResult: p.structuredResult } : {})
		} satisfies ExecutionStepSucceededPayload,
		precheck: (step) => {
			const hasOutput =
				(p.outputArtifactIds?.length ?? 0) > 0 || (p.proposedEvidenceIds?.length ?? 0) > 0;
			const check = validateStepCompletion({ hasOutput, explicitNoOutput: !hasOutput });
			if (!check.ok)
				return reject(command, 'RPH_INVARIANT_VIOLATION', check.reason ?? 'step result missing');
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
	const p = command.payload as { stepId: string };
	return advanceStep(ctx, command, {
		stepId: p.stepId,
		target: 'FAILED',
		eventType: 'ExecutionStepFailed',
		requireFrom: ['RUNNING'] // drivesFrom RUNNING
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
	const p = command.payload as { stepId: string };
	return advanceStep(ctx, command, {
		stepId: p.stepId,
		target: 'QUEUED',
		eventType: 'ExecutionStepRetried',
		requireFrom: ['FAILED'], // drivesFrom FAILED — a retry re-opens a FAILED attempt, nothing else
		precheck: (step, plan) => {
			if (plan.status !== 'ACTIVE')
				return reject(
					command,
					'RPH_ILLEGAL_STATE_TRANSITION',
					`Cannot retry a step: plan ${command.targetAggregateId} is not ACTIVE (${String(plan.status)}) — a superseded/terminal plan creates no new attempts (RPH-EXE-002).`
				);
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
		target: 'SKIPPED',
		eventType: 'ExecutionStepSkipped',
		requireFrom: ['READY', 'QUEUED'], // drivesFrom READY|QUEUED
		// The event records the RESULTING state + the authorization; `mandatory` is a decision-time assertion, not a
		// recorded fact (the ratified ExecutionStepSkipped shape carries no `mandatory`), so it does not ride the event.
		eventPayload: {
			stepId: p.stepId,
			...(p.waiverOrRevisionId ? { waiverOrRevisionId: p.waiverOrRevisionId } : {}),
			stepState: 'SKIPPED'
		},
		precheck: (_step, plan) => {
			if (plan.status !== 'ACTIVE')
				return reject(
					command,
					'RPH_ILLEGAL_STATE_TRANSITION',
					`Cannot skip a step: plan ${command.targetAggregateId} is not ACTIVE (${String(plan.status)}) — a superseded/terminal plan opens no new work (RPH-EXE-002).`
				);
			// FAIL-CLOSED: an unmarked step defaults to MANDATORY (mandatory ?? true), so it needs an authorized
			// waiver/revision to be skipped — never fail-open. `canSkipStep` is the ratified kernel (rph-domain).
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
		target: 'CANCELLED',
		eventType: 'ExecutionStepCancelled',
		requireFrom: ['READY', 'QUEUED', 'RUNNING', 'WAITING'], // drivesFrom READY|QUEUED|RUNNING|WAITING
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
 * The step is additionally marked `prunedAsUnreachable`, because SKIPPED alone cannot carry the distinction: it is
 * terminal-SUCCESS (so a waived skip lets the plan continue), and without the mark a pruned step's out-edges SATISFIED
 * the rest of its own dead arm — resurrecting it as startable work. Exec != assurance (INV-5): moves only stepState.
 */
export const pruneExecutionStep: CommandHandler = (ctx, command) => {
	const p = command.payload as {
		stepId: string;
		selectedByBranchStepId?: string;
		selectedEdgeId?: string;
	};
	return advanceStep(ctx, command, {
		stepId: p.stepId,
		target: 'SKIPPED',
		eventType: 'ExecutionStepPruned',
		requireFrom: ['READY', 'QUEUED'], // drivesFrom READY|QUEUED
		mutateStep: (step) => ({ ...step, prunedAsUnreachable: true }),
		eventPayload: {
			stepId: p.stepId,
			...(p.selectedByBranchStepId ? { selectedByBranchStepId: p.selectedByBranchStepId } : {}),
			...(p.selectedEdgeId ? { selectedEdgeId: p.selectedEdgeId } : {}),
			stepState: 'SKIPPED'
		},
		precheck: (_step, plan) => {
			if (plan.status !== 'ACTIVE')
				return reject(
					command,
					'RPH_ILLEGAL_STATE_TRANSITION',
					`Cannot prune a step: plan ${command.targetAggregateId} is not ACTIVE (${String(plan.status)}) — a prune is within-execution branch resolution.`
				);
			const gatePlan = toGatePlan(plan);
			if (!prunableStepIds(gatePlan, guardEvaluatorFor(ctx, command.targetAggregateId, gatePlan)).includes(p.stepId))
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
		target: 'WAITING',
		eventType: 'ExecutionStepWaiting',
		requireFrom: ['RUNNING'], // drivesFrom RUNNING
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
 * re-opens RUNNING — the state in which attempts execute — so this DOES apply the plan-ACTIVE precheck, mirroring
 * Start/Retry (RPH-EXE-002 / §35.1); under a superseded plan the correct action is Cancel, not resume. The resume is
 * NOT a new attempt: attemptsMadeForStep counts ExecutionStepStarted only, so a wait/resume cycle continues the SAME
 * attempt and does not consume the retry cap (RPH-EXE-008). Exec != assurance (INV-5): moves only stepState.
 */
export const resolveExecutionStepWait: CommandHandler = (ctx, command) => {
	const p = command.payload as { stepId: string; resolution?: string };
	return advanceStep(ctx, command, {
		stepId: p.stepId,
		target: 'RUNNING',
		eventType: 'ExecutionStepWaitResolved',
		requireFrom: ['WAITING'], // drivesFrom WAITING — an already-RUNNING step never waited, so there is no wait to resolve
		eventPayload: {
			stepId: p.stepId,
			...(p.resolution ? { resolution: p.resolution } : {}),
			stepState: 'RUNNING'
		},
		precheck: (_step, plan) =>
			plan.status === 'ACTIVE'
				? null
				: reject(
						command,
						'RPH_ILLEGAL_STATE_TRANSITION',
						`Cannot resume a waiting step: plan ${command.targetAggregateId} is not ACTIVE (${String(plan.status)}) — resuming re-opens the RUNNING state where attempts execute, and a superseded/terminal plan opens no new work (RPH-EXE-002). Cancel the step instead.`
					)
	});
};
