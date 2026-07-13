// PWU (Professional Work Unit) lifecycle handlers. A PWU carries FOUR orthogonal state axes
// (workLifecycleState / executionState / assuranceState / shapeIntegrityState). The authored lifecycle commands
// (propose / begin-shaping / mark-ready / challenge / reshape / invalidate / supersede) move the workLifecycle
// axis and are gated by canAdvanceWorkLifecycle — which enforces BOTH legality AND the cross-axis guards (e.g. the
// only path to SATISFIED requires assuranceState=SATISFIED; INV-5 / property P1). The derived lifecycle states
// that fall out of execution/assurance/governance (PLANNED, EXECUTING, EVIDENCE_PENDING, UNDER_ASSURANCE,
// SATISFIED, ...) are set by the controller via ChangePwuState, keeping workLifecycleState a computed rollup of
// the independently-commanded sub-axes (DOC-002 §5, §7).
import type {
	ChangePwuStatePayload,
	DomainCommand,
	ProposePwuPayload
} from '@janumipwb/rph-contracts';
import { canAdvanceWorkLifecycle, satisfiesP1 } from '@janumipwb/rph-domain';
import {
	checkTransition,
	commitState,
	loadOrReject,
	makeEvent,
	nextEnvelope,
	reject,
	type CommandHandler,
	type HandlerContext
} from './kit.js';

const PWU = 'PROFESSIONAL_WORK_UNIT';

interface PwuAxes {
	workLifecycleState: string;
	executionState: string;
	assuranceState: string;
	shapeIntegrityState: string;
}

function axesOf(state: Record<string, unknown>): PwuAxes {
	return {
		workLifecycleState: String(state.workLifecycleState),
		executionState: String(state.executionState),
		assuranceState: String(state.assuranceState),
		shapeIntegrityState: String(state.shapeIntegrityState)
	};
}

/** ProposePwu — (initial) -> PROPOSED. Creates the PWU. Requires the intent (PWU-002) and, if non-root, the
 * parent PWU (PWU-003) to exist. Initial axes: PROPOSED / NOT_PLANNED / UNASSESSED / UNKNOWN (PWU-001). */
export const proposePwu: CommandHandler = (ctx, command, payload) => {
	const p = payload as ProposePwuPayload;
	const intentObj = ctx.store.loadObject(p.intentId);
	if (!intentObj) {
		return reject(
			command,
			'RPH_VALIDATION_SEMANTIC_FAILED',
			`ProposePwu requires an existing intent ${p.intentId} (PWU-002)`,
			[p.pwuId]
		);
	}
	const intentState = intentObj.state as { ontologyId?: string; ontologyVersion?: string };
	if (p.parentWorkUnitId && !ctx.store.loadObject(p.parentWorkUnitId)) {
		return reject(
			command,
			'RPH_VALIDATION_SEMANTIC_FAILED',
			`ProposePwu with a parent requires the parent PWU ${p.parentWorkUnitId} to exist (PWU-003)`,
			[p.pwuId]
		);
	}
	const ts = command.issuedAt;
	const actor = command.issuedBy;
	const pwu: Record<string, unknown> = {
		id: p.pwuId,
		objectType: PWU,
		schemaVersion: 1,
		semanticVersion: 1,
		revision: 0,
		lifecycleStatus: 'PROPOSED',
		createdAt: ts,
		createdBy: actor,
		updatedAt: ts,
		updatedBy: actor,
		provenance: { originType: 'USER_INPUT', sourceObjectIds: [p.intentId], sourceEventIds: [] },
		...(intentState.ontologyId ? { ontologyId: intentState.ontologyId } : {}),
		...(intentState.ontologyVersion ? { ontologyVersion: intentState.ontologyVersion } : {}),
		tags: [],
		extensions: [],
		pwuKind: p.pwuKind,
		title: p.title,
		description: p.description,
		intentId: p.intentId,
		...(p.parentWorkUnitId ? { parentWorkUnitId: p.parentWorkUnitId } : {}),
		boundaries: p.boundaries,
		obligationIds: p.obligationIds,
		constraintIds: p.constraintIds,
		assumptionIds: p.assumptionIds,
		dependencyIds: [],
		inputRequirements: [],
		expectedOutputs: p.expectedOutputs,
		evidenceRequirementIds: [],
		verificationCriterionIds: [],
		assurancePolicyIds: p.assurancePolicyIds,
		workLifecycleState: 'PROPOSED',
		executionState: 'NOT_PLANNED',
		assuranceState: 'UNASSESSED',
		shapeIntegrityState: 'UNKNOWN',
		riskProfile: p.riskProfile
	};
	const event = makeEvent(ctx, command, {
		eventType: 'PwuProposed',
		aggregateType: PWU,
		aggregateId: p.pwuId,
		aggregateRevision: 0,
		payload
	});
	return commitState(ctx, command, {
		objectType: PWU,
		aggregateId: p.pwuId,
		expectedRevision: undefined,
		newRevision: 0,
		newSemanticVersion: 1,
		nextState: pwu,
		event
	});
};

/** Shared advance of the workLifecycle axis for an authored transition that does not change the sub-axes:
 * load -> canAdvanceWorkLifecycle (legality + cross-axis guard) -> commit. */
function advancePwuLifecycle(
	ctx: HandlerContext,
	command: DomainCommand,
	args: {
		readonly target: string;
		readonly eventType: string;
		readonly mutate?: (current: Record<string, unknown>) => Record<string, unknown>;
	}
) {
	const id = command.targetAggregateId;
	const loaded = loadOrReject(ctx, command, id);
	if (!loaded.ok) return loaded.result;
	const axes = axesOf(loaded.state);
	const advance = canAdvanceWorkLifecycle(axes.workLifecycleState, args.target, axes);
	if (!advance.ok) {
		return reject(
			command,
			'RPH_ILLEGAL_STATE_TRANSITION',
			`Cannot advance PWU ${id} ${axes.workLifecycleState} -> ${args.target}${advance.reason ? `: ${advance.reason}` : ''}`
		);
	}
	const newRevision = loaded.revision + 1;
	const base = nextEnvelope(loaded.state, command, newRevision);
	const mutated = args.mutate ? args.mutate(base) : base;
	const next = { ...mutated, lifecycleStatus: args.target, workLifecycleState: args.target };
	const event = makeEvent(ctx, command, {
		eventType: args.eventType,
		aggregateType: PWU,
		aggregateId: id,
		aggregateRevision: newRevision,
		payload: command.payload
	});
	return commitState(ctx, command, {
		objectType: PWU,
		aggregateId: id,
		expectedRevision: loaded.revision,
		newRevision,
		newSemanticVersion: loaded.semanticVersion,
		nextState: next,
		event
	});
}

/** BeginPwuShaping — PROPOSED -> SHAPING. */
export const beginPwuShaping: CommandHandler = (ctx, command) =>
	advancePwuLifecycle(ctx, command, { target: 'SHAPING', eventType: 'PwuShapingStarted' });

/** MarkPwuReady — SHAPING -> READY (emits the generic PwuStateChanged, DOC-007 §11.5). */
export const markPwuReady: CommandHandler = (ctx, command) =>
	advancePwuLifecycle(ctx, command, { target: 'READY', eventType: 'PwuStateChanged' });

/** ChallengePwu — READY -> CHALLENGED. */
export const challengePwu: CommandHandler = (ctx, command) =>
	advancePwuLifecycle(ctx, command, { target: 'CHALLENGED', eventType: 'PwuChallenged' });

/** ReshapePwu — EXECUTING|UNDER_ASSURANCE -> RESHAPING (material assumption falsified / blocking finding). */
export const reshapePwu: CommandHandler = (ctx, command) =>
	advancePwuLifecycle(ctx, command, { target: 'RESHAPING', eventType: 'PwuReshapingStarted' });

/** InvalidatePwu — SATISFIED|CONDITIONALLY_SATISFIED|RECOMPOSED -> INVALIDATED. */
export const invalidatePwu: CommandHandler = (ctx, command) =>
	advancePwuLifecycle(ctx, command, { target: 'INVALIDATED', eventType: 'PwuInvalidated' });

/** SupersedePwu — any non-baselined state -> SUPERSEDED. */
export const supersedePwu: CommandHandler = (ctx, command) =>
	advancePwuLifecycle(ctx, command, { target: 'SUPERSEDED', eventType: 'PwuSuperseded' });

/**
 * ChangePwuState — the controller's authoritative multi-axis setter. It moves the workLifecycle axis to
 * `newState` (validated by canAdvanceWorkLifecycle against the NEW sub-axis values, so the cross-axis guards
 * still hold — e.g. only reaching SATISFIED when assuranceState=SATISFIED) AND moves each sub-axis, each of which
 * must be a legal (or no-op) transition on its own machine. This is how the derived lifecycle states
 * (PLANNED/EXECUTING/EVIDENCE_PENDING/UNDER_ASSURANCE/SATISFIED/...) advance as execution and assurance progress.
 */
export const changePwuState: CommandHandler = (ctx, command, payload) => {
	const p = payload as ChangePwuStatePayload;
	const id = command.targetAggregateId;
	const loaded = loadOrReject(ctx, command, id);
	if (!loaded.ok) return loaded.result;
	const current = axesOf(loaded.state);
	if (current.workLifecycleState !== p.previousState) {
		return reject(
			command,
			'RPH_INVARIANT_VIOLATION',
			`ChangePwuState previousState ${p.previousState} does not match current ${current.workLifecycleState} (stale)`
		);
	}
	const nextAxes: PwuAxes = {
		workLifecycleState: p.newState,
		executionState: p.executionState,
		assuranceState: p.assuranceState,
		shapeIntegrityState: p.shapeIntegrityState
	};
	// Each sub-axis must move legally on its own machine.
	const subAxisChecks: Array<[string, string, string]> = [
		['PWU.executionState', current.executionState, p.executionState],
		['PWU.assuranceState', current.assuranceState, p.assuranceState],
		['PWU.shapeIntegrityState', current.shapeIntegrityState, p.shapeIntegrityState]
	];
	for (const [machine, from, to] of subAxisChecks) {
		const illegal = checkTransition(command, machine, from, to);
		if (illegal) return illegal;
	}
	// The workLifecycle axis either advances (legal transition + cross-axis guard against the NEW sub-axes) or
	// holds (a no-op move that only advances the orthogonal sub-axes) — and a hold must still not park the PWU in
	// a SATISFIED-without-assurance state (property P1 / INV-5).
	if (p.newState === current.workLifecycleState) {
		if (!satisfiesP1(nextAxes)) {
			return reject(
				command,
				'RPH_INVARIANT_VIOLATION',
				`PWU ${id} would hold in SATISFIED without assuranceState=SATISFIED (P1/INV-5)`
			);
		}
	} else {
		const advance = canAdvanceWorkLifecycle(current.workLifecycleState, p.newState, nextAxes);
		if (!advance.ok) {
			return reject(
				command,
				'RPH_ILLEGAL_STATE_TRANSITION',
				`Cannot advance PWU ${id} ${current.workLifecycleState} -> ${p.newState}${advance.reason ? `: ${advance.reason}` : ''}`
			);
		}
	}
	const newRevision = loaded.revision + 1;
	const next = {
		...nextEnvelope(loaded.state, command, newRevision),
		lifecycleStatus: p.newState,
		workLifecycleState: p.newState,
		executionState: p.executionState,
		assuranceState: p.assuranceState,
		shapeIntegrityState: p.shapeIntegrityState
	};
	const event = makeEvent(ctx, command, {
		eventType: 'PwuStateChanged',
		aggregateType: PWU,
		aggregateId: id,
		aggregateRevision: newRevision,
		payload
	});
	return commitState(ctx, command, {
		objectType: PWU,
		aggregateId: id,
		expectedRevision: loaded.revision,
		newRevision,
		newSemanticVersion: loaded.semanticVersion,
		nextState: next,
		event
	});
};
