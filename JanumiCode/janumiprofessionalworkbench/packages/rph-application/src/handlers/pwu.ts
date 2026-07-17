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
	ProposePwuPayload,
	PwuProposedPayload,
	PwuStateChangedPayload
} from '@janumipwb/rph-contracts';
import {
	canAdvanceWorkLifecycle,
	checkPwuShapeReadiness,
	satisfiesP1,
	type PwuReadinessFacts
} from '@janumipwb/rph-domain';
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
	// PWU-001 seeded axes — one source for both the object state and the §11.3 event payload, so they cannot drift.
	const seededAxes = {
		workLifecycleState: 'PROPOSED',
		executionState: 'NOT_PLANNED',
		assuranceState: 'UNASSESSED',
		shapeIntegrityState: 'UNKNOWN'
	} as const;
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
		// CON-009 ownership binding: a PWU Instance belongs to an Undertaking and realizes a PWU Type (or is a
		// declared Undertaking-local extension) — pwuKind alone is insufficient.
		...(p.undertakingId ? { undertakingId: p.undertakingId } : {}),
		...(p.pwuTypeId ? { pwuTypeId: p.pwuTypeId } : {}),
		...(p.isLocalExtension !== undefined ? { isLocalExtension: p.isLocalExtension } : {}),
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
		...seededAxes,
		riskProfile: p.riskProfile
	};
	// DOC-007 §11.3: the event payload is the identity + seeded-axes projection, not the ProposePwu command payload
	// (which is what this emitted: it carried description/boundaries/obligationIds/constraintIds/assumptionIds/
	// expectedOutputs/assurancePolicyIds/riskProfile and no axes at all — every one an unrecognized key against the
	// strictObject). §11.3's prose also lists undertakingId/pwuTypeId/isLocalExtension, but the generated
	// PwuProposedPayloadSchema omits all three, and the schema is what runs: emitting them would fail as extra keys.
	const proposedPayload: PwuProposedPayload = {
		pwuId: p.pwuId,
		pwuKind: p.pwuKind,
		title: p.title,
		intentId: p.intentId,
		...(p.parentWorkUnitId ? { parentWorkUnitId: p.parentWorkUnitId } : {}),
		...seededAxes
	};
	const event = makeEvent(ctx, command, {
		eventType: 'PwuProposed',
		aggregateType: PWU,
		aggregateId: p.pwuId,
		aggregateRevision: 0,
		payload: proposedPayload
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
			`Cannot advance PWU ${id} ${axes.workLifecycleState} -> ${args.target}${advance.reason ? ': ' + advance.reason : ''}`
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

/** Reads the §9.1 / §6.3 readiness facts off the stored PWU (and its Intent). The Intent load is the reason
 * this lives at the call site and not in the pure kernel: rph-domain does no I/O. A root PWU whose Intent row
 * is missing entirely yields intentStatus '' — which satisfies no branch of INTENT_AT_LEAST_PROVISIONAL, so
 * the guard fails closed rather than assuming maturity it cannot read. */
function readinessFactsOf(ctx: HandlerContext, state: Record<string, unknown>): PwuReadinessFacts {
	const boundaries = (state.boundaries ?? {}) as { inScope?: string[]; outOfScope?: string[] };
	const intentId = typeof state.intentId === 'string' ? state.intentId : '';
	const intentState = intentId
		? (ctx.store.loadObject(intentId)?.state as { intentStatus?: string } | undefined)
		: undefined;
	return {
		intentId,
		title: typeof state.title === 'string' ? state.title : '',
		description: typeof state.description === 'string' ? state.description : '',
		inScope: boundaries.inScope ?? [],
		outOfScope: boundaries.outOfScope ?? [],
		expectedOutputs: (state.expectedOutputs as unknown[]) ?? [],
		hasRiskProfile: state.riskProfile !== undefined && state.riskProfile !== null,
		// DOC-002 §7.1: `parentWorkUnitId?` — its absence IS rootness.
		isRoot: typeof state.parentWorkUnitId !== 'string' || state.parentWorkUnitId === '',
		intentStatus: intentState?.intentStatus ?? ''
	};
}

/** MarkPwuReady — SHAPING -> READY (emits the generic PwuStateChanged, DOC-007 §11.5).
 *
 * DOC-002 §9 L661: "A PWU may enter `READY` only if its Shape Readiness Profile is satisfied." — so this is
 * NOT a bare legality check. canAdvanceWorkLifecycle answers only "is SHAPING -> READY an arrow on the
 * machine"; it has no `SHAPING->READY` cross-axis entry, and readiness is not a state-axis fact anyway. The
 * §9.1 field contract and the §6.3 L472 root-Intent invariant are checked by the kernel guard, and every
 * unmet limb is named in the rejection (§8.4 L856: gaps are never silent). */
export const markPwuReady: CommandHandler = (ctx, command) => {
	const loaded = loadOrReject(ctx, command, command.targetAggregateId);
	if (!loaded.ok) return loaded.result;
	const readiness = checkPwuShapeReadiness(readinessFactsOf(ctx, loaded.state));
	if (!readiness.ok) {
		return reject(
			command,
			'RPH_VALIDATION_SEMANTIC_FAILED',
			`MarkPwuReady: PWU ${command.targetAggregateId} does not satisfy the shape readiness contract (DOC-002 §9): ${readiness.unmet.join('; ')}`
		);
	}
	return advancePwuLifecycle(ctx, command, { target: 'READY', eventType: 'PwuStateChanged' });
};

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
				`Cannot advance PWU ${id} ${current.workLifecycleState} -> ${p.newState}${advance.reason ? ': ' + advance.reason : ''}`
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
	// DOC-007 §11.5: passthrough is conformant HERE and only here — ChangePwuStatePayload is field-identical to
	// PwuStateChangedPayload (the same 7 fields, same enums), so the command payload already satisfies the event
	// schema. It is NOT conformant at the other PwuStateChanged site: markPwuReady emits this event carrying a
	// MarkPwuReadyPayload, which shares none of the 7 fields — unfixed, as reasonCode is not derivable there.
	const event = makeEvent(ctx, command, {
		eventType: 'PwuStateChanged',
		aggregateType: PWU,
		aggregateId: id,
		aggregateRevision: newRevision,
		payload: p satisfies PwuStateChangedPayload
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
