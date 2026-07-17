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
	CompleteExecutionStepPayload,
	DomainCommand,
	ExecutionPlanActivatedPayload,
	ExecutionStepSucceededPayload,
	ProposeExecutionPlanPayload
} from '@janumipwb/rph-contracts';
import { canActivatePlan, validateStepCompletion } from '@janumipwb/rph-domain';
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
export const approveExecutionPlan: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, command, {
		objectType: PLAN,
		statusField: 'status',
		machine: MACHINE,
		target: 'APPROVED',
		eventType: 'ExecutionPlanApproved',
		// The event records the RESULTING status. ExecutionPlanApproved declares `status` (APPROVED), which the
		// empty command payload does not carry — so the default emit recorded nothing of the transition. (Pinned.)
		eventPayload: () => ({ status: 'APPROVED' })
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

/** Advance one embedded step (by id) of a plan's steps[] along the ExecutionStep.stepState machine. */
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

/** StartExecutionStep — a step READY|QUEUED -> RUNNING (only under an ACTIVE plan). */
export const startExecutionStep: CommandHandler = (ctx, command) => {
	const p = command.payload as { stepId: string; runtimeBindingId?: string };
	return advanceStep(ctx, command, {
		stepId: p.stepId,
		target: 'RUNNING',
		eventType: 'ExecutionStepStarted',
		// The event records the RESULTING state, not the command input: ExecutionStepStarted declares `stepState`
		// (the RUNNING it transitioned to), which `command.payload` ({ stepId }) does not carry — so the default
		// emitted `{ stepId }` was missing the one field the event exists to record. The event that says "this step
		// started" now contains the state it started INTO. (Pinned defect in emitted-event-conformance; now conforms.)
		eventPayload: {
			stepId: p.stepId,
			...(p.runtimeBindingId ? { runtimeBindingId: p.runtimeBindingId } : {}),
			stepState: 'RUNNING'
		},
		precheck: (_step, plan) =>
			plan.status === 'ACTIVE'
				? null
				: reject(
						command,
						'RPH_ILLEGAL_STATE_TRANSITION',
						`Cannot start a step: plan ${command.targetAggregateId} is not ACTIVE (${String(plan.status)})`
					)
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
		// DOC-007 §16.2 ExecutionStepSucceededPayload. The five id/ref fields are the command's own (§16.1 and §16.2
		// share them verbatim); resultingExecutionState is §16.2's const, and is the EXECUTION dimension only —
		// §16.2 L1244 / INV-5: step success never implies assuranceState=SATISFIED.
		// Contract-drift fix: §16.1's executionProvenance (WHO/WHAT produced this step) and structuredResult (the
		// inline result content) were §16.2-undeclared and so validated then discarded into neither store — the
		// governed stream could not name who produced a high-consequence step nor what it returned. Both now carried
		// (optional, authored atop the ratified §16.2 shape); this is the trace over non-deterministic agent work the
		// system exists to make reasoning-about. resultStatus stays dropped: it is redundant with the const
		// resultingExecutionState. (Follow-up: the floor gate still re-derives aiProduced heuristically —
		// stepOutputIsAiProduced — where it could read executionProvenance's resolved provider/model authoritatively.)
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
			const aiProduced = stepOutputIsAiProduced(ctx, step, command);
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
		eventType: 'ExecutionStepFailed'
	});
};

/** RetryExecutionStep — a FAILED step -> QUEUED (re-attempt; the retry cap RPH-EXE-008 is enforced by the
 * execution kernel's retryDecision, wired when attempt counting lands — documented in RESUME-STATE). */
export const retryExecutionStep: CommandHandler = (ctx, command) => {
	const p = command.payload as { stepId: string };
	return advanceStep(ctx, command, {
		stepId: p.stepId,
		target: 'QUEUED',
		eventType: 'ExecutionStepRetried'
	});
};
