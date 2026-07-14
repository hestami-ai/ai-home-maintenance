// Execution Plan lifecycle handlers. The plan machine is PROPOSED → UNDER_REVIEW → APPROVED → ACTIVE →
// {COMPLETED|FAILED|CANCELLED}. ProposeExecutionPlan creates the plan already submitted for review (the
// PROPOSED→UNDER_REVIEW trigger is "proposeExecutionPlan / ExecutionPlanProposed then submitted for review",
// DOC-002 §20.1 — see OPEN-QUESTIONS). ActivateExecutionPlan is gated by canActivatePlan (RPH-EXE-001: at most
// one ACTIVE plan per PWU). Approval grants NO runtime privileges (§20.2). The per-step handlers
// (start/complete/fail/retry) mutate the embedded steps[] array on the plan aggregate, each gated by the
// ExecutionStep.stepState machine + the execution kernel (a succeeded step must record a result, RPH-EXE-006;
// step success ≠ PWU success, §21.1).
import type { DomainCommand, ProposeExecutionPlanPayload } from '@janumipwb/rph-contracts';
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
import { floorGateBlock } from './floor-gate.js';

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
		eventType: 'ExecutionPlanProposed'
	});
};

/** ApproveExecutionPlan — UNDER_REVIEW -> APPROVED (approval grants no runtime privileges). */
export const approveExecutionPlan: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, command, {
		objectType: PLAN,
		statusField: 'status',
		machine: MACHINE,
		target: 'APPROVED',
		eventType: 'ExecutionPlanApproved'
	});

/** ActivateExecutionPlan — APPROVED -> ACTIVE, gated by canActivatePlan (one ACTIVE plan per PWU, RPH-EXE-001). */
export const activateExecutionPlan: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, command, {
		objectType: PLAN,
		statusField: 'status',
		machine: MACHINE,
		target: 'ACTIVE',
		eventType: 'ExecutionPlanActivated',
		guard: (state, hctx) => {
			const workUnitId = String(state.workUnitId);
			const pwu = hctx.store.loadObject(workUnitId)?.state as
				{ activeExecutionPlanId?: string } | undefined;
			const otherActivePlanExists = Boolean(
				pwu?.activeExecutionPlanId && pwu.activeExecutionPlanId !== command.targetAggregateId
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
		payload: command.payload
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
	const p = command.payload as { stepId: string };
	return advanceStep(ctx, command, {
		stepId: p.stepId,
		target: 'RUNNING',
		eventType: 'ExecutionStepStarted',
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
	const p = command.payload as {
		executionStepId: string;
		outputArtifactIds?: string[];
		proposedEvidenceIds?: string[];
	};
	return advanceStep(ctx, command, {
		stepId: p.executionStepId,
		target: 'SUCCEEDED',
		eventType: 'ExecutionStepSucceeded',
		precheck: () => {
			const hasOutput =
				(p.outputArtifactIds?.length ?? 0) > 0 || (p.proposedEvidenceIds?.length ?? 0) > 0;
			const check = validateStepCompletion({ hasOutput, explicitNoOutput: !hasOutput });
			if (!check.ok)
				return reject(command, 'RPH_INVARIANT_VIOLATION', check.reason ?? 'step result missing');
			// Floor gate (§8.4 step 4), plane-agnostic: a step whose OUTPUT has a recorded de minimis assurance floor
			// must have it SATISFIED (or waived) before the step may SUCCEED — exec != assurance (INV-5); step
			// success drives the EXECUTION dimension only and never grants assurance. Steps with no recorded floor
			// pass (the floor applies once the output is assessed).
			const blocking = floorGateBlock(ctx, p.executionStepId, { aiProduced: false });
			if (blocking) {
				const detail = blocking.map((b) => `${b.policyId}=${b.disposition}`).join(', ');
				return reject(
					command,
					'RPH_INVARIANT_VIOLATION',
					`CompleteExecutionStep blocked: the de minimis assurance floor is not SATISFIED for step ${p.executionStepId} (${detail}). Satisfy or record a waiver over the floor of the step's output before completing.`,
					[p.executionStepId]
				);
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
