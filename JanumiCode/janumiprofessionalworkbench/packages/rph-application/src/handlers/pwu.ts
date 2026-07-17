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
	CommandResult,
	DomainCommand,
	MarkPwuReadyPayload,
	ProposePwuPayload,
	PwuMarkedReadyPayload,
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
		/** Build the EVENT payload from the committed next state. Without this the event carries
		 * `command.payload` — a command payload masquerading as an event payload, which is the defect
		 * Increment 22 fixed elsewhere. Supply it for any event whose payload is actually specified. */
		readonly eventPayload?: (nextState: Record<string, unknown>) => unknown;
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
		payload: args.eventPayload ? args.eventPayload(next) : command.payload
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

/** MarkPwuReady — SHAPING -> READY. Emits the semantic `PwuMarkedReady`.
 *
 * EVENT BINDING CORRECTED 2026-07-17. This emitted the GENERIC `PwuStateChanged` (DOC-007 §11.5) and could not
 * fill that event's required `reasonCode`, which parked the (d2) event gate on a "sponsor decision" that turned
 * out not to exist. The binding came from §11.4/§11.5 ADJACENCY, and it was wrong. The corpus's own worked
 * example settles it: the Reference Undertaking "# 26. Expected Event Trace" — 72 steps of a real undertaking —
 * emits `PwuMarkedReady` at steps 20 and 33, and `PwuStateChanged` appears in NO worked trace in the corpus.
 * Structurally: §11.5 declares previousState/newState as REQUIRED payload fields, which are meaningless here
 * (they would be the constants SHAPING/READY) and needed only by a generic event; and DOC-007 §33 requires BOTH
 * events, so they were never alternatives. §11 schematizes 2 of ~11 PWU commands — a first-slice sampler
 * (§16 item 6), not an exhaustive pairing.
 *
 * `PwuStateChanged` belongs to `ChangePwuState` (below), which already carries `reasonCode` — the reason a
 * §8.2 EXCEPTION transition needs, because §8.2 is keyed by a Trigger column with no command name to recover
 * it from. §8.1 PRIMARY transitions like this one are keyed by Command: the reason IS "Mark ready".
 *
 * All three PwuMarkedReady fields derive; nothing is minted. (The payload is AUTHORED, not ratified — no corpus
 * doc schematizes it — so this event is outside RATIFIED_EVENT_PAYLOADS and the (d2) gate does not check it.
 * Conforming to our own authored shape is still worth doing; it is just not a ratified claim.)
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
	const p = command.payload as MarkPwuReadyPayload;
	return advancePwuLifecycle(ctx, command, {
		target: 'READY',
		eventType: 'PwuMarkedReady',
		// DOC-007 §11.4 names it shapeReadinessAssessmentId; DOC-002 §34.1 names it shapeReadinessAttestationId.
		// The field-name drift is recorded in the vocab's conflicts[] and is NOT resolved here — this maps the
		// one we receive onto the one the event declares, and does not pretend the two docs agree.
		eventPayload: (next) =>
			({
				...(p.shapeReadinessAssessmentId
					? { shapeReadinessAttestationId: p.shapeReadinessAssessmentId }
					: {}),
				workLifecycleState: next.workLifecycleState as PwuMarkedReadyPayload['workLifecycleState'],
				shapeIntegrityState:
					next.shapeIntegrityState as PwuMarkedReadyPayload['shapeIntegrityState']
			}) satisfies PwuMarkedReadyPayload
	});
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
 * The four `assuranceState` values that ONLY a completed assessment can produce (DOC-002 §18 ratifies the
 * disposition vocabulary: PENDING | ASSESSING | SATISFIED | CONDITIONALLY_SATISFIED | REJECTED | INCONCLUSIVE |
 * WAIVED | ESCALATED).
 *
 * NOT here, deliberately: WAIVED is authorized by a WAIVER, not an assessment (§18.1: "A policy cannot waive its
 * own blocking finding unless waiver authority is separately defined"), and INVALIDATED comes from upstream
 * change / evidence invalidation (§29.1). Both need their own citation and their own guard; an honest gap beats
 * an over-reaching one. INCONCLUSIVE is a ratified §18 assessment disposition that is NOT a value of the PWU's
 * assurance axis at all — so an inconclusive assessment leaves the PWU nowhere to go. Recorded, not resolved.
 */
const ASSESSMENT_BACKED_DISPOSITIONS = new Set([
	'SATISFIED',
	'CONDITIONALLY_SATISFIED',
	'REJECTED',
	'ESCALATED'
]);

/**
 * A DISPOSITION MAY NOT BE ASSERTED — it must be backed by an assessment that says so.
 *
 * `checkTransition` is a LEGALITY check: it asks only whether from->to is an arrow on the machine. It is not a
 * substance check, and until this guard there was none — so a caller could walk the assurance axis UNASSESSED ->
 * EVIDENCE_REQUIRED -> READY_FOR_ASSESSMENT -> ASSESSING -> SATISFIED one legal hop at a time with no evidence
 * and no assessment, and the PWU would read green. The workbench's own demo seed did exactly that for its entire
 * existence, and every test over it stayed green.
 *
 * WHY NOT ENFORCE THE DECLARED TRIGGERS. `transitions.data.ts` annotates each of these arrows with a `trigger`
 * (e.g. 'AssuranceAssessmentSatisfied'), and enforcing THOSE is tempting and wrong: that machine's own
 * sourceSection says the enum is "VERBATIM" but the "transitions RECONSTRUCTED" — the trigger strings are
 * AUTHORED, and two of them name events this system does not emit (it emits one AssuranceAssessmentCompleted
 * carrying a disposition; DOC-002 names five outcome events; the vocab's conflicts[] says "pick one modeling"
 * and it is unpicked). Enforcing a reconstruction as though it were ratified is the exact error this effort
 * keeps finding.
 *
 * So this enforces the RATIFIED requirement underneath it instead:
 *   §18.1 — "Every disposition must identify evidence considered."
 *   §37 Controller Decision Contract, and ChangePwuState IS a control action — "Every control action must
 *        record: triggering condition; evidence or observations considered; policy authorizing the action;
 *        actor; affected objects; expected outcome." This command recorded `reasonCode: 'CONTROLLER'` and an
 *        empty `supportingObjectIds`: none of those six.
 *   RPH-PWU-006's Given — "required evidence is admitted; all mandatory assurance assessments are satisfied."
 *
 * DOC-007 §11.5 puts `supportingObjectIds` beside `reasonCode` for exactly this: the reason, and what backs it.
 * The controller lever is NOT the defect — RPH-PWU-006's "When" IS the controller evaluating the PWU. The empty
 * Given was.
 */
function rejectUnbackedDisposition(
	ctx: HandlerContext,
	command: DomainCommand,
	id: string,
	p: ChangePwuStatePayload,
	currentAssuranceState: string
): CommandResult | undefined {
	if (p.assuranceState === currentAssuranceState) return undefined;
	if (!ASSESSMENT_BACKED_DISPOSITIONS.has(p.assuranceState)) return undefined;
	const cited = p.supportingObjectIds ?? [];
	const backed = cited.some((oid) => {
		const obj = ctx.store.loadObject(oid);
		if (obj?.objectType !== 'ASSURANCE_ASSESSMENT') return false;
		const s = obj.state as { assessmentState?: string; subjectObjectIds?: string[] };
		return s.assessmentState === p.assuranceState && (s.subjectObjectIds ?? []).includes(id);
	});
	if (backed) return undefined;
	return reject(
		command,
		'RPH_EVIDENCE_MISSING',
		`ChangePwuState would set PWU ${id} assuranceState=${p.assuranceState} with nothing to back it. A ` +
			`disposition is the verdict of an assessment, not a property the controller may assign (§37: every ` +
			`control action must record the evidence considered and the objects affected; RPH-PWU-006 permits the ` +
			`controller to satisfy a PWU only GIVEN its mandatory assessments are satisfied). Cite an ` +
			`ASSURANCE_ASSESSMENT in supportingObjectIds whose assessmentState is ${p.assuranceState} and whose ` +
			`subjectObjectIds include ${id}. Supplied: [${cited.join(', ') || 'nothing'}].`
	);
}

/**
 * BASELINED MAY NOT BE ASSERTED EITHER — the same defect as an asserted disposition, one axis over.
 *
 * DOC-002 §8.1: "SATISFIED/RECOMPOSED | Promote baseline | BASELINED | **Authorized promotion decision**". That
 * Required condition is the Given, and until this guard nothing checked it: the demo seed drove its Architecture
 * PWU to BASELINED with no Baseline object, no decision, and no promotion — colliding with ratified RPH-BAS-004
 * ("Missing required assessment prevents promotion"), while the test asserting "freezes the Architecture PWU
 * into an authoritative baseline" stayed green throughout.
 *
 * So: reaching BASELINED requires citing a BASELINE that has actually been PROMOTED and that contains this PWU
 * among its items. PromoteBaseline's own payload already demanded the promotionDecisionId, the exact expected
 * semantic version of every item, and the requiredAssessmentIds — the contract always asked for the Given;
 * nobody was answering it. Citing the promoted baseline is what connects the two.
 */
function rejectUnbackedBaselining(
	ctx: HandlerContext,
	command: DomainCommand,
	id: string,
	p: ChangePwuStatePayload,
	currentWorkLifecycleState: string
): CommandResult | undefined {
	if (p.newState !== 'BASELINED' || currentWorkLifecycleState === 'BASELINED') return undefined;
	const cited = p.supportingObjectIds ?? [];
	const backed = cited.some((oid) => {
		const obj = ctx.store.loadObject(oid);
		if (obj?.objectType !== 'BASELINE') return false;
		// Both field names below were GUESSED WRONG on the first attempt (`baselineStatus`, `itemObjectIds`) and
		// the drive caught it. A field name is a fact to look up, not to infer — even in one's own codebase.
		// The real shape is better than the guess: `itemObjectVersions` pins the exact semanticVersion each item
		// was frozen AT, so this checks the baseline froze THIS PWU rather than merely mentioning it.
		const s = obj.state as {
			status?: string;
			itemObjectVersions?: { objectId?: string }[];
		};
		return (
			s.status === 'AUTHORITATIVE' && (s.itemObjectVersions ?? []).some((v) => v.objectId === id)
		);
	});
	if (backed) return undefined;
	return reject(
		command,
		'RPH_EVIDENCE_MISSING',
		`ChangePwuState would baseline PWU ${id} with no promoted baseline to back it. DOC-002 §8.1 permits ` +
			`SATISFIED -> BASELINED only on an "Authorized promotion decision", and RPH-BAS-004 rejects promotion ` +
			`with a missing required assessment. Cite a BASELINE in supportingObjectIds that is AUTHORITATIVE and ` +
			`whose itemObjectVersions include ${id}. Supplied: [${cited.join(', ') || 'nothing'}].`
	);
}

/**
 * EXECUTION SUCCESS MAY NOT BE ASSERTED — the third and last axis that was assigned rather than earned.
 *
 * `executionState: SUCCEEDED` is the premise of everything downstream: RPH-PWU-006's Given opens with "execution
 * succeeded", and §8.1 gates EXECUTING -> EVIDENCE_PENDING on "Execution state is SUCCEEDED". Until this guard,
 * that premise was a string the controller could type. The demo seed drove all thirteen PWUs to SUCCEEDED with
 * one hand-written Execution Plan between them, and never started or completed a single step.
 *
 * So: claiming SUCCEEDED requires citing an EXECUTION_PLAN that is FOR this PWU (`workUnitId`) and that has a
 * step which actually reached SUCCEEDED. That step's own completion is separately and independently guarded —
 * completeExecutionStep requires real output AND, for AI-produced results, a satisfied de minimis floor. Citing
 * the plan is what connects the PWU's claim to that already-defended fact.
 *
 * Only SUCCEEDED is guarded. The other executionState values (PLANNED/QUEUED/RUNNING/WAITING/FAILED) are
 * scheduling facts the controller legitimately owns, and FAILED in particular must never need permission to
 * record — a system that makes failure harder to report than success is worse than one that checks neither.
 */
function rejectUnbackedExecutionSuccess(
	ctx: HandlerContext,
	command: DomainCommand,
	id: string,
	p: ChangePwuStatePayload,
	currentExecutionState: string
): CommandResult | undefined {
	if (p.executionState !== 'SUCCEEDED' || currentExecutionState === 'SUCCEEDED') return undefined;
	const cited = p.supportingObjectIds ?? [];
	const backed = cited.some((oid) => {
		const obj = ctx.store.loadObject(oid);
		if (obj?.objectType !== 'EXECUTION_PLAN') return false;
		const s = obj.state as {
			workUnitId?: string;
			steps?: { stepState?: string }[];
		};
		return s.workUnitId === id && (s.steps ?? []).some((step) => step.stepState === 'SUCCEEDED');
	});
	if (backed) return undefined;
	return reject(
		command,
		'RPH_EVIDENCE_MISSING',
		`ChangePwuState would set PWU ${id} executionState=SUCCEEDED with no succeeded execution step to back ` +
			`it. "Execution succeeded" is the premise the whole assurance chain rests on (RPH-PWU-006's Given; ` +
			`§8.1's EXECUTING -> EVIDENCE_PENDING condition), not a status the controller may declare. Cite an ` +
			`EXECUTION_PLAN in supportingObjectIds whose workUnitId is ${id} and which has a SUCCEEDED step. ` +
			`Supplied: [${cited.join(', ') || 'nothing'}].`
	);
}

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
	// THE THREE "MAY NOT BE ASSERTED" GUARDS. checkTransition above answers only "is this an arrow on the
	// machine". These answer "is the fact true": a disposition needs an assessment, a baselining needs a promoted
	// baseline, an execution success needs a succeeded step. Together they are the difference between a demo that
	// tells the truth because it chooses to and one that could not lie if it tried.
	const unearned =
		rejectUnbackedDisposition(ctx, command, id, p, current.assuranceState) ??
		rejectUnbackedBaselining(ctx, command, id, p, current.workLifecycleState) ??
		rejectUnbackedExecutionSuccess(ctx, command, id, p, current.executionState);
	if (unearned) return unearned;
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
	// DOC-007 §11.5: passthrough is conformant here — ChangePwuStatePayload is field-identical to
	// PwuStateChangedPayload (the same 7 fields, same enums), so the command payload already satisfies the event
	// schema. As of 2026-07-17 this is the ONLY site emitting PwuStateChanged: markPwuReady used to emit it too,
	// carrying a MarkPwuReadyPayload that shares none of the 7 fields, and that mis-binding is what made
	// `reasonCode` look underivable. It is derivable nowhere — it is SUPPLIED, here, by the caller of the generic
	// setter, which is the only command the corpus gives a reason to. See markPwuReady's note above.
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
