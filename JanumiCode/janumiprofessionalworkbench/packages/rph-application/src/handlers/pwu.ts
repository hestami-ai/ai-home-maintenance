// PWU (Professional Work Unit) lifecycle handlers. A PWU carries FOUR orthogonal state axes
// (workLifecycleState / executionState / assuranceState / shapeIntegrityState). The authored lifecycle commands
// (propose / begin-shaping / mark-ready / challenge / reshape / invalidate / supersede) move the workLifecycle
// axis and are gated by canAdvanceWorkLifecycle — which enforces BOTH legality AND the cross-axis guards (e.g. the
// only path to SATISFIED requires assuranceState=SATISFIED; INV-5 / property P1). The middle lifecycle states
// (PLANNED, EXECUTING, EVIDENCE_PENDING, UNDER_ASSURANCE, SATISFIED, ...) are set by the controller via
// ChangePwuState.
//
// ⚠ CORRECTED 2026-08-08 (REG-D-029 / DESIGN-pwu-write-path). This sentence used to end: *"keeping
// workLifecycleState a computed rollup of the independently-commanded sub-axes (DOC-002 §5, §7)."* **It is not a
// rollup, and canon says so twice.** JPWB-DOC-003 §6 L171: *"Every PWU carries four ORTHOGONAL state axes … At
// birth the axes initialize INDEPENDENTLY."* A total function of the other three is not a fourth orthogonal
// axis. And the state list settles it empirically: eleven of the twenty values — BLOCKED, CHALLENGED, RESHAPING,
// ESCALATED, INVALIDATED, REJECTED, ABANDONED, SUPERSEDED, RECOMPOSING, RECOMPOSED, BASELINED — are not
// functions of execution, assurance or shape integrity under any reading, so no derivation rule could produce
// them.
//
// THE PROSE MATTERED. Read as a description of intent it made "derive these arrows instead of commanding them"
// look like the design's own plan, and REG-F-079 recorded that as a live option on its strength. The same
// assertion sat in `rph-domain/src/pwuGuards.ts` and is corrected there too.
import type {
	ChallengePwuPayload,
	ChangePwuStatePayload,
	CommandResult,
	DomainCommand,
	InvalidatePwuPayload,
	MarkPwuReadyPayload,
	AbandonPwuPayload,
	BaselinePwuPayload,
	BlockPwuPayload,
	ProposePwuPayload,
	PwuAbandonedPayload,
	EscalatePwuPayload,
	PwuBaselinedPayload,
	PwuBlockedPayload,
	PwuEscalatedPayload,
	PwuRejectedPayload,
	RejectPwuPayload,
	PwuChallengedPayload,
	PwuInvalidatedPayload,
	PwuMarkedReadyPayload,
	PwuProposedPayload,
	PwuReshapingStartedPayload,
	PwuShapingStartedPayload,
	PwuStateChangedPayload,
	PwuSupersededPayload,
	ReshapePwuPayload,
	SupersedePwuPayload
} from '@janumipwb/rph-contracts';
import {
	canAdvanceWorkLifecycle,
	checkPwuShapeReadiness,
	planEvidencesExecutionSuccess,
	satisfiesP1,
	type PwuReadinessFacts
} from '@janumipwb/rph-domain';
import {
	checkTransition,
	commitState,
	loadOrReject,
	makeEvent,
	nextEnvelope,
	preconditionReader,
	reject,
	type CommandHandler,
	type HandlerContext
} from './kit.js';
import { evaluatePrecondition, predicate } from './command-precondition.js';
import { resolveAbandonAuthorization } from './abandon-authorization.js';
import { hasBlockingObservationFor, resolveRejectAuthorization } from './reject-authorization.js';
import { resolveWaiverAuthorization } from './waiver-authorization.js';

const PWU = 'PROFESSIONAL_WORK_UNIT';

/**
 * JAN-CMDPRE DWP-02 (DS-001 D10) — ChangePwuState's vacuity precondition. All four axis targets are
 * payload-derived and this ONE command drives every arrow on four machines PLUS every legitimate hold, so the only
 * state set that would admit it is the machine's entire state list — a declaration whose only correct value is
 * "everything", which no type or lint can flag as vacuous. So the rule is a PREDICATE, not a FROM_STATES set: it
 * refuses a re-issue in which ALL FOUR axes already equal the requested values. Such a command changes nothing yet
 * would append a second PwuStateChanged — carrying, e.g., a fresh contradicting `reasonCode` — over a state that
 * did not move (DOC-002 §27; the same NOOP-admitted-by-checkTransition hole the whole series closes). A hold that
 * advances at least one orthogonal axis is the DOMINANT case (24 of the seed's 67 workLifecycle dispatches) and
 * stays legal. Message names every axis compared, per the roadmap.
 */
const changeNothingPrecondition = predicate(
	'ChangePwuState must move at least one of the four axes',
	({ state, payload }) => {
		const p = payload as ChangePwuStatePayload;
		const a = axesOf(state);
		if (
			p.newState === a.workLifecycleState &&
			p.executionState === a.executionState &&
			p.assuranceState === a.assuranceState &&
			p.shapeIntegrityState === a.shapeIntegrityState
		) {
			return (
				`ChangePwuState changes nothing: all four axes already equal the requested values ` +
				`(workLifecycle=${a.workLifecycleState}, execution=${a.executionState}, ` +
				`assurance=${a.assuranceState}, shapeIntegrity=${a.shapeIntegrityState}). ` +
				`Re-issuing would append a second PwuStateChanged recording a change that did not happen. ` +
				`A hold that advances at least one orthogonal axis is legal; a hold of ALL four is not.`
			);
		}
		return null;
	},
	'RPH_ILLEGAL_STATE_TRANSITION'
);

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

/** The (objectType, pwaId, pwaVersion) projection of both an Undertaking and a PWU Type state row —
 * the only fields RPH-CON-009 ownership binding reads off either object. */
type Con009BindingState = { objectType?: string; pwaId?: string; pwaVersion?: string };

/** RPH-CON-009 rule 4 (non-local branch): a non-local PWU Instance realizes a PUBLISHED PWU Type —
 * pwuKind alone is insufficient — and that type must live in the Undertaking's bound PWA, matched on
 * (pwaId, pwaVersion) so a type from a DIFFERENT VERSION of the same PWA can no longer realize into it.
 * Returns a reject-result on violation, or undefined when the binding is valid. */
function rejectInvalidNonLocalPwuType(
	ctx: HandlerContext,
	command: DomainCommand,
	p: ProposePwuPayload,
	undertaking: Con009BindingState
): CommandResult | undefined {
	if (!p.pwuTypeId) {
		return reject(
			command,
			'RPH_VALIDATION_SEMANTIC_FAILED',
			`ProposePwu: a non-local PWU Instance must name a pwuTypeId that resolves to a PWU Type in the Undertaking's bound PWA — pwuKind alone is insufficient (RPH-CON-009). Set isLocalExtension=true for an Undertaking-local extension.`,
			[p.pwuId]
		);
	}
	const pwuType = ctx.store.loadObject(p.pwuTypeId)?.state as Con009BindingState | undefined;
	// RPH-CON-009: the type must resolve to a PWU Type in the Undertaking's bound PWA — matched on
	// (pwaId, pwaVersion), not pwaId alone. pwaVersion is derived onto every type by definePwuType, so a
	// type from a DIFFERENT VERSION of the same PWA (same pwaId) can no longer realize into this Undertaking.
	if (
		!pwuType ||
		pwuType.objectType !== 'PWU_TYPE' ||
		pwuType.pwaId !== undertaking.pwaId ||
		pwuType.pwaVersion !== undertaking.pwaVersion
	) {
		return reject(
			command,
			'RPH_VALIDATION_SEMANTIC_FAILED',
			`ProposePwu: pwuTypeId ${p.pwuTypeId} does not resolve to a PWU Type in the Undertaking's bound PWA ${String(undertaking.pwaId)} @ ${String(undertaking.pwaVersion)} (RPH-CON-009).`,
			[p.pwuId, p.pwuTypeId]
		);
	}
	return undefined;
}

/** RPH-CON-009 — PWU Instance ownership binding, ENFORCED (it was recorded but never validated). Applies when the
 * instance claims an owning Undertaking; a standalone PWU with no undertakingId is exempt (ownership is exactly
 * what CON-009 governs, and createUndertaking requires a published PWA the standalone drive has not stood up).
 * The four ratified rules (RPH spec §6): undertakingId identifies that Undertaking; a non-local instance's
 * pwuTypeId resolves to a PWU Type in the Undertaking's bound PWA; a local instance sets isLocalExtension=true and
 * claims no published pwuTypeId; a pwuKind string alone is insufficient to establish either binding.
 * Returns a reject-result on the first violated rule, or undefined when the ownership binding is valid. */
function rejectInvalidOwnershipBinding(
	ctx: HandlerContext,
	command: DomainCommand,
	p: ProposePwuPayload
): CommandResult | undefined {
	if (!p.undertakingId) return undefined;
	const undertaking = ctx.store.loadObject(p.undertakingId)?.state as
		Con009BindingState | undefined;
	if (!undertaking || undertaking.objectType !== 'UNDERTAKING') {
		return reject(
			command,
			'RPH_VALIDATION_SEMANTIC_FAILED',
			`ProposePwu: undertakingId ${p.undertakingId} does not identify an Undertaking (RPH-CON-009 ownership binding).`,
			[p.pwuId, p.undertakingId]
		);
	}
	if (p.isLocalExtension === true) {
		// A local extension is Undertaking-scoped and MUST NOT claim a published PWU Type.
		if (p.pwuTypeId) {
			return reject(
				command,
				'RPH_VALIDATION_SEMANTIC_FAILED',
				`ProposePwu: an Undertaking-local extension (isLocalExtension=true) must not claim a published pwuTypeId (RPH-CON-009); got ${p.pwuTypeId}.`,
				[p.pwuId, p.pwuTypeId]
			);
		}
		return undefined;
	}
	return rejectInvalidNonLocalPwuType(ctx, command, p, undertaking);
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
	// RPH-CON-009 — PWU Instance ownership binding, ENFORCED (it was recorded but never validated). The full
	// rule set and per-rule rejection order live in rejectInvalidOwnershipBinding; a standalone PWU with no
	// undertakingId is exempt.
	const ownershipRejection = rejectInvalidOwnershipBinding(ctx, command, p);
	if (ownershipRejection) return ownershipRejection;
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
	// DOC-007 §11.3: the event payload is the identity + ownership + seeded-axes projection, not the ProposePwu
	// command payload (which is what this once emitted: description/boundaries/obligationIds/... — every one an
	// unrecognized key against the strictObject, and no axes at all).
	//
	// §11.3 mandates three ownership fields the handler used to drop: undertakingId, pwuTypeId?, isLocalExtension.
	// Two are added here. pwuTypeId is the JOIN KEY the Assurance View's "applicable policies" (§38) needs
	// (pwuTypeId -> PwuType.requiredAssurancePolicyIds), so the drop folded that field to a false empty.
	// isLocalExtension is derived per §11.3's own rule — "an Undertaking-local PWU Instance has no published
	// pwuTypeId" — so a PWU with no type IS a local extension, unless the command states otherwise.
	//
	// undertakingId (§11.3's third field, REQUIRED) is deliberately NOT emitted yet: createUndertaking requires a
	// PUBLISHED PWA, so giving the standalone reference drive a real undertakingId means bootstrapping the whole
	// PWA+Undertaking (seed-workbench already does). Emitting the command's optional undertakingId when absent
	// would write a dangling reference — the exact defect the assurance guards reject elsewhere. Its own increment.
	const proposedPayload: PwuProposedPayload = {
		pwuId: p.pwuId,
		...(p.pwuTypeId ? { pwuTypeId: p.pwuTypeId } : {}),
		isLocalExtension: p.isLocalExtension ?? p.pwuTypeId === undefined,
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

/**
 * REG-F-072 — THE WORKLIFECYCLE TARGETS A SEMANTICALLY NAMED COMMAND OWNS, and which the generic setter
 * therefore may not reach.
 *
 * ⚠ CANON, AND IT IS A RULE ABOUT THE WRITE PATH RATHER THAN ABOUT ANY ONE ARROW.
 * JPWB-DOC-003 §9 PER-3 (L343): *"**One authoritative write path.** Canonical state is mutated only through
 * authenticated, authorized, **semantically named commands** that check expected revision, **validate
 * preconditions and invariants**, enforce required assurance, and atomically persist state, version history,
 * events, outbox, and command receipt. **No generic CRUD/PATCH path**, UI local state, RPH worker, validator,
 * projection worker, broker message, agent output, or informal approval bypasses this pipeline."*
 *
 * Keyed by TARGET because every legal in-arrow to each of these six states is reachable by the one command whose
 * `advancePwuLifecycle({ target })` names it — `canAdvanceWorkLifecycle` accepts any legal `from` — so closing
 * the target closes nothing the owning command cannot still do.
 *
 * ⚠ WHY THIS IS NOT SCOPED TO "§8.2 EXCEPTION TRANSITIONS", WHICH IS WHAT I FIRST BUILT.
 * The comment on `markPwuReady` below asserted that `ChangePwuState` is the vehicle for DOC-002 §8.2 EXCEPTION
 * transitions while §8.1 PRIMARY transitions have their own commands — and I took that as decisive, from a
 * comment in the very file under repair. Its own source admits otherwise: `docs/_working/HARMONIZATION-LOG.md`
 * ends the derivation *"(That §8.2 is its referent is my inference; the corpus never links them.)"* Three
 * independent facts refute it: the machine's own triggers name `challengePwu` / `reshapePwu` / `invalidatePwu`
 * AS the exception commands, so §8.2 is where the NAMED commands already are; all ten production `chg()` sites
 * in the reference undertaking are §8.1 primaries or holds, so scoping the setter TO §8.2 would delete its
 * entire real use; and `ChangePwuState` is `UNRATIFIED-AUTHORED` with the vocab noting *"DOC-007-only generic
 * transition; DOC-002 has no ChangePwuState (uses named per-transition commands)"*. A preference laundered as a
 * rule, believed because it was written down nearby.
 */
export const PWU_SEMANTIC_LIFECYCLE_COMMANDS = {
	SHAPING: 'BeginPwuShaping',
	READY: 'MarkPwuReady',
	CHALLENGED: 'ChallengePwu',
	RESHAPING: 'ReshapePwu',
	INVALIDATED: 'InvalidatePwu',
	SUPERSEDED: 'SupersedePwu',
	// JAN-PWUWP W-1. These two rows are NOT optional garnish on the commit that mints their commands:
	// without them the setter keeps performing both arrows while their authority guards have moved off it,
	// which re-opens REG-F-070 and REG-F-078 until W-7. The review caught that; it is written here so the
	// coupling cannot be undone by deleting one side.
	ABANDONED: 'AbandonPwu',
	REJECTED: 'RejectPwu',
	// W-4.5. Same coupling rule as W-1: the row lands in the commit that mints the command, never
	// later. And note the asymmetry with the two above — those moved an AUTHORITY guard, this moves an
	// EVIDENCE one, so `rejectUnbackedBaselining` leaves `changePwuState` here too.
	BASELINED: 'BaselinePwu',
	// W-5. Neither is a §5.2 act — the rows exist because PER-3 wants a NAMED command for every
	// arrow, not because either needs authority.
	BLOCKED: 'BlockPwu',
	ESCALATED: 'EscalatePwu'
} as const satisfies Readonly<Record<string, string>>;

/**
 * THE ANTI-ROT MECHANISM. `advancePwuLifecycle`'s `target` is narrowed to this union, so a SEVENTH semantic
 * lifecycle command cannot be added without adding its row here — `check-types` fails before the new command's
 * arrow can quietly become reachable through the generic setter as well.
 */
export type OwnedLifecycleTarget = keyof typeof PWU_SEMANTIC_LIFECYCLE_COMMANDS;

/** Shared advance of the workLifecycle axis for an authored transition that does not change the sub-axes:
 * load -> canAdvanceWorkLifecycle (legality + cross-axis guard) -> commit. */
function advancePwuLifecycle(
	ctx: HandlerContext,
	command: DomainCommand,
	args: {
		readonly target: OwnedLifecycleTarget;
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

// THE FIVE AUTHORED LIFECYCLE EVENTS, CONFORMED (Increment 29).
//
// Each of these declares `workLifecycleState` in its payload schema — and every one of them emitted
// `command.payload` instead, so the field was simply absent from the log. PwuShapingStarted was the starkest:
// its command payload is `{}`, so the event that records "this PWU began shaping" recorded NOTHING. The state
// was in the object and nowhere in the stream.
//
// They got away with it because the (d2) event gate only enforces RATIFIED payloads, and these five are
// UNRATIFIED-AUTHORED — outside its scope by design (we do not enforce our own inventions as though the corpus
// had ratified them). That scope is right, and this is its cost: an authored event can violate its own declared
// shape and nothing complains. The answer is not to widen the gate — it is to conform, and to prove the log
// rebuilds the aggregate (RPH-PER-006), which is what actually catches this class.
/** BeginPwuShaping — PROPOSED -> SHAPING. */
export const beginPwuShaping: CommandHandler = (ctx, command) =>
	advancePwuLifecycle(ctx, command, {
		target: 'SHAPING',
		eventType: 'PwuShapingStarted',
		eventPayload: (next) =>
			({
				workLifecycleState:
					next.workLifecycleState as PwuShapingStartedPayload['workLifecycleState']
			}) satisfies PwuShapingStartedPayload
	});

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
 * `PwuStateChanged` belongs to `ChangePwuState` (below), which already carries `reasonCode`.
 *
 * ⚠ CORRECTED 2026-08-08 (REG-F-072). This sentence used to continue: *"— the reason a §8.2 EXCEPTION
 * transition needs, because §8.2 is keyed by a Trigger column with no command name to recover it from. §8.1
 * PRIMARY transitions like this one are keyed by Command: the reason IS 'Mark ready'."* **That was an inference
 * presented as a rule, and its own derivation says so** — `docs/_working/HARMONIZATION-LOG.md` closes the
 * argument with *"(That §8.2 is its referent is my inference; the corpus never links them.)"* It then survived
 * long enough to be quoted BACK as decisive evidence while designing REG-F-072's fix, from inside this file.
 * Three facts refute it: the machine's own triggers name `challengePwu` / `reshapePwu` / `invalidatePwu` as the
 * exception commands, so §8.2 is where the NAMED commands already are; every production `ChangePwuState` call
 * performs a §8.1 primary or a hold, never an exception arrow; and `ChangePwuState` is UNRATIFIED-AUTHORED, the
 * vocab noting *"DOC-007-only generic transition; DOC-002 has no ChangePwuState (uses named per-transition
 * commands)"*. What `reasonCode` is genuinely for is the derived middle of the lifecycle — PLANNED, EXECUTING,
 * EVIDENCE_PENDING, UNDER_ASSURANCE — which has no named command at all. That gap is registered, not fixed here.
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
	const p = command.payload as MarkPwuReadyPayload;
	// Optimistic-concurrency precondition on the SEMANTIC version — distinct from the envelope's expectedRevision
	// (loadOrReject checks that). MarkPwuReady attests readiness of a SPECIFIC shape; expectedSemanticVersion is the
	// caller's assertion of WHICH shape version it reviewed. If the PWU was materially reshaped since (semanticVersion
	// moved), the attestation is stale and must not silently apply to a shape the caller never saw. Contract-drift
	// fix: the command REQUIRED this field yet the handler never compared it, so the intended staleness guard was
	// dead — a caller believed MarkPwuReady was version-guarded when it was not.
	if (p.expectedSemanticVersion !== loaded.semanticVersion) {
		return reject(
			command,
			'RPH_REVISION_CONFLICT',
			`MarkPwuReady: expected semantic version ${p.expectedSemanticVersion}, but PWU ${command.targetAggregateId} is at semantic version ${loaded.semanticVersion} — the shape changed since readiness was attested (stale attestation).`
		);
	}
	const readiness = checkPwuShapeReadiness(readinessFactsOf(ctx, loaded.state));
	if (!readiness.ok) {
		return reject(
			command,
			'RPH_VALIDATION_SEMANTIC_FAILED',
			`MarkPwuReady: PWU ${command.targetAggregateId} does not satisfy the shape readiness contract (DOC-002 §9): ${readiness.unmet.join('; ')}`
		);
	}
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
export const challengePwu: CommandHandler = (ctx, command) => {
	const p = command.payload as ChallengePwuPayload;
	return advancePwuLifecycle(ctx, command, {
		target: 'CHALLENGED',
		eventType: 'PwuChallenged',
		eventPayload: (next) =>
			({
				challengeReason: p.challengeReason,
				...(p.observationIds ? { observationIds: p.observationIds } : {}),
				workLifecycleState: next.workLifecycleState as PwuChallengedPayload['workLifecycleState']
			}) satisfies PwuChallengedPayload
	});
};

/** ReshapePwu — EXECUTING|UNDER_ASSURANCE -> RESHAPING (material assumption falsified / blocking finding). */
export const reshapePwu: CommandHandler = (ctx, command) => {
	const p = command.payload as ReshapePwuPayload;
	return advancePwuLifecycle(ctx, command, {
		target: 'RESHAPING',
		eventType: 'PwuReshapingStarted',
		eventPayload: (next) =>
			({
				reason: p.reason,
				...(p.triggeringObjectId ? { triggeringObjectId: p.triggeringObjectId } : {}),
				workLifecycleState:
					next.workLifecycleState as PwuReshapingStartedPayload['workLifecycleState'],
				shapeIntegrityState:
					next.shapeIntegrityState as PwuReshapingStartedPayload['shapeIntegrityState']
			}) satisfies PwuReshapingStartedPayload
	});
};

/** InvalidatePwu — SATISFIED|CONDITIONALLY_SATISFIED|RECOMPOSED -> INVALIDATED. */
export const invalidatePwu: CommandHandler = (ctx, command) => {
	const p = command.payload as InvalidatePwuPayload;
	// ~~The event types `triggeringObjectId` REQUIRED while the command types it optional — so a command that
	// omits it cannot produce a conformant event. Defaulting to '' would fabricate a reference to nothing;
	// omitting the key fails the strictObject. Recorded rather than papered: the command/event contracts
	// disagree, and the command is the looser one (the same drift as CreateAssurancePolicy's enums).~~
	//
	// CORRECTED 2026-08-04, and struck rather than deleted because the comment DIAGNOSED THE DEFECT AND THEN THE
	// CODE COMMITTED IT: it names `''` as fabricating "a reference to nothing", and the line below it did exactly
	// that. The contracts still disagree — that half stands — but the resolution does not get to be the option the
	// comment condemned.
	//
	// A HANDLER THAT CANNOT EMIT A CONFORMANT EVENT REFUSES THE COMMAND; IT DOES NOT INVENT A VALUE. That is the
	// general rule this site was breaking, and it is worth stating because the EVENT GATE CANNOT CATCH IT: the
	// gate validates the emitted event, and `''` satisfies `z.string()`. A fabricated value is well-formed by
	// construction, so malformation checks are structurally blind to it. Nothing had ever noticed, and nothing
	// could have — until 2026-08-03 no test dispatched this command at all, so the branch had never run.
	//
	// AND THE ID IS RESOLVED (REG-F-014's fourth instance). Requiring it is what the ratified event contract
	// demands; requiring it to NAME SOMETHING is the same judgement `authorityDecisionId` got one commit earlier —
	// a provenance field pointing at nothing is provenance to nothing.
	// ── THE CONTRACTS NOW AGREE (REG-E-023 ratified, 2026-08-05) ───────────────────────────────────────────────
	// The disagreement the struck comment records is RESOLVED: `InvalidatePwuPayload.triggeringObjectId` is now
	// REQUIRED, matching the event, matching the register's stated default, and matching what this handler had
	// already been enforcing since JAN-CMDPRE. An ABSENT field is therefore refused by the SCHEMA now, one layer
	// earlier and structurally.
	//
	// THIS GUARD IS NOT DEAD, AND THE DISTINCTION IS THE WHOLE POINT: `z.string()` accepts `''`. The schema owns
	// ABSENCE; this owns the EMPTY STRING — which is exactly "a reference to nothing", the fabrication the struck
	// comment named and the old code committed. Tightening a schema narrows a guard's population; it does not
	// always empty it, and assuming it does is how a real check gets deleted as redundant.
	if (!p.triggeringObjectId) {
		return reject(
			command,
			'RPH_VALIDATION_SEMANTIC_FAILED',
			`InvalidatePwu ${command.targetAggregateId}: the ratified PwuInvalidated event REQUIRES a ` +
				`triggeringObjectId, so an invalidation must name what triggered it. Supply the Evidence, ` +
				`Assumption or Observation that invalidated this work.`
		);
	}
	if (!ctx.store.loadObject(p.triggeringObjectId)) {
		return reject(
			command,
			'RPH_VALIDATION_SEMANTIC_FAILED',
			`InvalidatePwu ${command.targetAggregateId}: triggeringObjectId ${p.triggeringObjectId} names no ` +
				`object the engine holds. An invalidation records WHY work stopped being valid; a reference to ` +
				`nothing records nothing.`
		);
	}
	// Captured after the guards so the closure below sees a `string`, not `string | undefined`.
	const triggeringObjectId = p.triggeringObjectId;
	return advancePwuLifecycle(ctx, command, {
		target: 'INVALIDATED',
		eventType: 'PwuInvalidated',
		eventPayload: (next) =>
			({
				invalidationReason: p.invalidationReason,
				triggeringObjectId,
				workLifecycleState: next.workLifecycleState as PwuInvalidatedPayload['workLifecycleState']
			}) satisfies PwuInvalidatedPayload
	});
};

/** SupersedePwu — any non-baselined state -> SUPERSEDED. */
export const supersedePwu: CommandHandler = (ctx, command) => {
	const p = command.payload as SupersedePwuPayload;
	return advancePwuLifecycle(ctx, command, {
		target: 'SUPERSEDED',
		eventType: 'PwuSuperseded',
		eventPayload: (next) =>
			({
				supersedingWorkUnitId: p.supersedingWorkUnitId,
				workLifecycleState: next.workLifecycleState as PwuSupersededPayload['workLifecycleState']
			}) satisfies PwuSupersededPayload
	});
};

/**
 * Does this cited object BACK a baselining of `pwuId`? — the predicate `rejectUnbackedBaselining` carried,
 * relocated verbatim in substance by JAN-PWUWP W-4.5 (roadmap R2).
 *
 * ⚠ IT IS NOT RETIRED, AND THE DESIGN WAS WRONG TO SAY IT WOULD BE. §4 of DESIGN-pwu-write-path claimed
 * retiring three "may not be asserted" guards was a strengthening; that is true of one. This one checks a
 * CROSS-AGGREGATE fact — an AUTHORITATIVE Baseline whose `itemObjectVersions` freeze THIS PWU — whose owning
 * discipline is Governance, which none of the design's three propagating planes covers. Retiring it would have
 * turned C-0b's `"Authorized promotion decision"` row from ENFORCED into nothing.
 *
 * Both field names here were GUESSED WRONG on first writing (`baselineStatus`, `itemObjectIds`) and a live drive
 * caught it. Kept as a comment because the real shape is better than the guess: `itemObjectVersions` pins the
 * exact semanticVersion each item was frozen AT, so this proves the baseline froze THIS PWU rather than merely
 * mentioning it.
 */
function baselineBacksPwu(ctx: HandlerContext, pwuId: string, baselineId: string): boolean {
	const obj = ctx.store.loadObject(baselineId);
	if (obj?.objectType !== 'BASELINE') return false;
	const s = obj.state as { status?: string; itemObjectVersions?: { objectId?: string }[] };
	return s.status === 'AUTHORITATIVE' && (s.itemObjectVersions ?? []).some((v) => v.objectId === pwuId);
}

/**
 * BlockPwu — SHAPING | PLANNED | EXECUTING -> BLOCKED. JAN-PWUWP W-5, under REG-D-029.
 *
 * ⚠ NO AUTHORITY GUARD, AND THAT IS THE DESIGN RATHER THAN AN OMISSION. JPWB-DOC-001 §5.2 reserves waiver, risk
 * acceptance, rejection, abandonment and promotion to Governance — **it does not reserve blocking**. The three
 * arrows' VERBATIM corpus triggers are facts: "Missing information" and "Runtime dependency unavailable". This
 * repository states the consequence in terms elsewhere: *"a system that makes failure harder to report than
 * success is worse than one that checks neither"*. A block is how trouble gets reported; gating it would be
 * that defect wearing a governance costume.
 *
 * WHAT IT DOES REQUIRE is `blockReason`, which is the whole substantive contract: an unexplained halt is not a
 * governed record of anything. `missingObjectIds` is OPTIONAL on purpose — the trigger is an ABSENCE, and
 * "missing information" frequently cannot enumerate what is missing. Requiring the list would make the honest
 * case unreportable, which is the same failure one level down.
 *
 * ⚠ AND BLOCKING IS A ONE-WAY DOOR, which the caller cannot discover from the machine's `terminalStates`.
 * BLOCKED is NOT declared terminal, yet its only out-arrows are ABANDONED and SUPERSEDED — there is no recovery
 * arrow. The roadmap's W-5 named an `UnblockPwu`; no such arrow exists to perform. Registered rather than
 * invented (REG-F-083).
 */
export const blockPwu: CommandHandler = (ctx, command) => {
	const p = command.payload as BlockPwuPayload;
	return advancePwuLifecycle(ctx, command, {
		target: 'BLOCKED',
		eventType: 'PwuBlocked',
		eventPayload: (next) =>
			({
				blockReason: p.blockReason,
				...(p.missingObjectIds ? { missingObjectIds: p.missingObjectIds } : {}),
				workLifecycleState: next.workLifecycleState as PwuBlockedPayload['workLifecycleState']
			}) satisfies PwuBlockedPayload
	});
};

/**
 * EscalatePwu — EVIDENCE_PENDING -> ESCALATED. JAN-PWUWP W-5, under REG-D-029.
 *
 * THE ACT IS RATIFIED; ONLY ITS SHAPE WAS MISSING. `ESCALATE` is a member of the §37 ControlAction menu, and
 * JPWB-CON-000 AX-8 calls escalation *"the responsible transfer of unresolved professional responsibility"*.
 * What did not exist was any `PwuEscalated` event — unlike `PwuBlocked`, `PwuAbandoned`, `PwuRejected` and
 * `PwuBaselined`, which were all declared and registered and produced by nothing. This is the first PWU
 * lifecycle event in the programme authored from scratch rather than given a first emitter.
 *
 * `escalationReason` is required for AX-8's reason: a transfer of responsibility with no stated reason
 * transfers nothing. `unobtainableEvidenceIds` is optional on the same absence argument as `BlockPwu`'s —
 * the trigger is *"Evidence impossible to obtain"*, and impossibility is often not itemisable.
 */
export const escalatePwu: CommandHandler = (ctx, command) => {
	const p = command.payload as EscalatePwuPayload;
	return advancePwuLifecycle(ctx, command, {
		target: 'ESCALATED',
		eventType: 'PwuEscalated',
		eventPayload: (next) =>
			({
				escalationReason: p.escalationReason,
				...(p.unobtainableEvidenceIds
					? { unobtainableEvidenceIds: p.unobtainableEvidenceIds }
					: {}),
				workLifecycleState: next.workLifecycleState as PwuEscalatedPayload['workLifecycleState']
			}) satisfies PwuEscalatedPayload
	});
};

/**
 * BaselinePwu — SATISFIED | RECOMPOSED -> BASELINED. JAN-PWUWP W-4.5, under REG-D-029.
 *
 * ⚠ WHY THIS COMMAND HAD TO EXIST BEFORE THE SETTER RETIRES. `promoteBaseline` advances `Baseline.status` and
 * says so in its own comment; NOTHING moved the PWU. The reference undertaking has to dispatch the generic
 * setter separately after promoting, and there was no binding row for `-> BASELINED` at all. Retiring the setter
 * at W-7 without this would make `BASELINED` — a declared TERMINAL state with ratified RPH-PWU-010 over it —
 * unreachable. The design had no table row for it; the adversarial review found the gap.
 *
 * DERIVE-ON-READ (roadmap R1): the caller names WHICH baseline; this handler derives whether it backs the
 * transition. Citation rather than a stored link is not a shortcut — the PWU carries no baseline field, so
 * there is nothing to read but what the caller names.
 */
export const baselinePwu: CommandHandler = (ctx, command) => {
	const id = command.targetAggregateId;
	const loaded = loadOrReject(ctx, command, id);
	if (!loaded.ok) return loaded.result;
	const p = command.payload as BaselinePwuPayload;
	if (!baselineBacksPwu(ctx, id, p.baselineId)) {
		return reject(
			command,
			'RPH_EVIDENCE_MISSING',
			`BaselinePwu ${id}: ${p.baselineId} is not an AUTHORITATIVE BASELINE whose itemObjectVersions ` +
				`include ${id}. DOC-002 §8.1 permits SATISFIED -> BASELINED only on an "Authorized promotion ` +
				`decision", and RPH-BAS-004 rejects promotion with a missing required assessment — so the ` +
				`baseline must already have been promoted, which is what makes this citation an authorization ` +
				`rather than an assertion.`,
			[id, p.baselineId]
		);
	}
	return advancePwuLifecycle(ctx, command, {
		target: 'BASELINED',
		eventType: 'PwuBaselined',
		eventPayload: (next) =>
			({
				pwuId: id,
				baselineId: p.baselineId,
				newState: String(next.workLifecycleState)
			}) satisfies PwuBaselinedPayload
	});
};

/**
 * AbandonPwu — (any active) -> ABANDONED. JAN-PWUWP W-1, under REG-D-029.
 *
 * ⚠ THE ACT FINALLY HAS A COMMAND, and the guard that was bolted onto the generic setter moves onto it. Canon
 * reserves the act by name — JPWB-DOC-001 §5.2: *"Governance … alone authorizes waiver, risk acceptance,
 * rejection or abandonment of governed work, and promotion."* PER-3 requires it be reached by a *semantically
 * named* command, and until now there was none, which is why `changePwuState` was carrying the authority check.
 *
 * DERIVE-ON-READ (roadmap R1): the caller names WHICH decision; this handler derives WHETHER it authorizes, by
 * reading the decision's committed state. Naming an id is not asserting a state.
 *
 * AND IT IS THE FIRST EMITTER OF `PwuAbandoned`, which has been declared and registered and emitted by nothing.
 * Its required `abandonmentDecisionId` is exactly the id this command demands — the contract had been asking for
 * it with no command able to supply it.
 */
export const abandonPwu: CommandHandler = (ctx, command) => {
	const id = command.targetAggregateId;
	const loaded = loadOrReject(ctx, command, id);
	if (!loaded.ok) return loaded.result;
	const p = command.payload as AbandonPwuPayload;
	const verdict = resolveAbandonAuthorization(ctx, {
		pwuId: id,
		authorizationId: p.abandonmentDecisionId,
		pwuSemanticVersion: loaded.semanticVersion
	});
	if (!verdict.ok) {
		return reject(
			command,
			'RPH_INVARIANT_VIOLATION',
			`AbandonPwu ${id}: ${verdict.reason}. Abandonment of governed work is reserved to Governance ` +
				`("It alone authorizes waiver, risk acceptance, rejection or abandonment of governed work, and ` +
				`promotion" — JPWB-DOC-001 §5.2), and authority is checked BEFORE effect (ASR-15).`,
			[id, p.abandonmentDecisionId]
		);
	}
	return advancePwuLifecycle(ctx, command, {
		target: 'ABANDONED',
		eventType: 'PwuAbandoned',
		eventPayload: (next) =>
			({
				abandonmentDecisionId: p.abandonmentDecisionId,
				workLifecycleState: next.workLifecycleState as PwuAbandonedPayload['workLifecycleState']
			}) satisfies PwuAbandonedPayload
	});
};

/**
 * RejectPwu — UNDER_ASSURANCE -> REJECTED. JAN-PWUWP W-1, under REG-D-029.
 *
 * TWO CONJUNCTS, because canon requires both of this act and only of this one. The authority half is §5.2 as
 * above — and the corpus pre-empts the obvious objection in the very sentence §5.2 derives from (Guide L336):
 * *"**Assurance may record a `REJECTED` Assessment disposition under policy;** Governance … alone authorizes …
 * rejection … of governed work."* The disposition is carved OUT of the reserved act. The fact half is the
 * arrow's own VERBATIM corpus trigger, *"Blocking finding"*, plus DOC-001 §6's requirement that governance
 * dispositions be *"version-bound, evidence-backed"*.
 *
 * ⚠ `REJECTION`, not `REJECT` — the latter is the §37 ControlAction spelling and matches no Decision that can
 * exist. Handled in `resolveRejectAuthorization`; noted here because the trap has already been hit once.
 */
export const rejectPwu: CommandHandler = (ctx, command) => {
	const id = command.targetAggregateId;
	const loaded = loadOrReject(ctx, command, id);
	if (!loaded.ok) return loaded.result;
	const p = command.payload as RejectPwuPayload;
	const verdict = resolveRejectAuthorization(ctx, {
		pwuId: id,
		authorizationId: p.rejectionDecisionId,
		pwuSemanticVersion: loaded.semanticVersion
	});
	if (!verdict.ok) {
		return reject(
			command,
			'RPH_INVARIANT_VIOLATION',
			`RejectPwu ${id}: ${verdict.reason}. Rejection of governed work is reserved to Governance ` +
				`(JPWB-DOC-001 §5.2); recording a REJECTED Assessment disposition is Assurance's to do under ` +
				`policy and is a different act.`,
			[id, p.rejectionDecisionId]
		);
	}
	if (!hasBlockingObservationFor(ctx, id, p.blockingObservationIds)) {
		return reject(
			command,
			'RPH_INVARIANT_VIOLATION',
			`RejectPwu ${id}: none of [${p.blockingObservationIds.join(', ') || 'nothing'}] is a BLOCKING or ` +
				`CRITICAL AssuranceObservation whose subjectObjectIds include ${id}. The arrow's trigger is ` +
				`"Blocking finding" and governance dispositions are "version-bound, evidence-backed" ` +
				`(JPWB-DOC-001 §5.2, §6). Severity is read off the stored observation, never from this payload.`,
			[id]
		);
	}
	return advancePwuLifecycle(ctx, command, {
		target: 'REJECTED',
		eventType: 'PwuRejected',
		eventPayload: (next) =>
			({
				blockingObservationIds: p.blockingObservationIds,
				assuranceState: next.assuranceState as PwuRejectedPayload['assuranceState'],
				workLifecycleState: next.workLifecycleState as PwuRejectedPayload['workLifecycleState']
			}) satisfies PwuRejectedPayload
	});
};

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
 * ⚠ `rejectUnbackedBaselining` LIVED HERE AND HAS MOVED (JAN-PWUWP W-4.5) — relocated, not retired.
 *
 * Its predicate is `baselineBacksPwu` above and its refusal is inside `baselinePwu`. The DESIGN said this
 * guard would be retired as a "strengthening"; the adversarial review showed that was wrong — it checks a
 * cross-aggregate Governance fact no propagating plane would check, and retiring it would have turned one of
 * C-0b's fourteen ENFORCED rows into nothing. The roadmap records the correction as R2.
 */


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
/**
 * WAIVED requires a granted WAIVER decision bound to this PWU at this version. JAN-PWUWP W-3, under REG-D-029.
 *
 * ⚠ THIS CLOSES A HOLE THE FILE ITSELF NAMED AND LEFT OPEN. `rejectUnbackedDisposition` short-circuits on
 * `WAIVED` because `ASSESSMENT_BACKED_DISPOSITIONS` deliberately excludes it, and the comment above that set
 * says why: *"WAIVED is authorized by a WAIVER, not an assessment (§18.1 …). Both need their own citation and
 * their own guard."* C-0b then measured the consequence live — `ChangePwuState` reached `WAIVED` from three
 * source states with `supportingObjectIds: []` and no authority of any kind.
 *
 * DOC-001 §5.2 reserves waiver to Governance, and its provenance source names it FIRST: *"Governance … alone
 * authorizes **waiver**, risk acceptance, rejection or abandonment of governed work, and promotion."* Third and
 * last of §5.2's acts to reach the PWU, after REG-F-070's abandonment and REG-F-078's rejection.
 *
 * DERIVE-ON-READ (roadmap R1): the caller names WHICH decision authorizes the waiver; the handler reads that
 * decision's type, status, subjects and version pin. The caller never asserts that a waiver exists.
 *
 * ⚠ WHAT THIS DOES NOT CHECK, STATED SO THE GAP IS NOT MISTAKEN FOR SATISFIED: ASR-14 (repaired 2026-08-09)
 * holds that *"Critical integrity failures … cannot be waived by ordinary product authority — waiver authority
 * is tiered."* **No field on the Decision records an authority tier**, so the tier limb is unenforceable here
 * and is left to a future increment rather than faked with a check that always passes.
 */
function rejectUnauthorizedWaiver(
	ctx: HandlerContext,
	command: DomainCommand,
	id: string,
	p: ChangePwuStatePayload,
	currentAssuranceState: string,
	currentSemanticVersion: number
): CommandResult | undefined {
	if (p.assuranceState !== 'WAIVED') return undefined;
	if (currentAssuranceState === 'WAIVED') return undefined;
	const cited = p.supportingObjectIds ?? [];
	const authorized = cited.some(
		(oid) =>
			resolveWaiverAuthorization(ctx, {
				authorizationId: oid,
				pwuId: id,
				pwuSemanticVersion: currentSemanticVersion
			}).ok
	);
	if (authorized) return undefined;
	const why = cited
		.map(
			(oid) =>
				`${oid}: ${
					(
						resolveWaiverAuthorization(ctx, {
							authorizationId: oid,
							pwuId: id,
							pwuSemanticVersion: currentSemanticVersion
						}) as { ok: false; reason: string }
					).reason
				}`
		)
		.join('; ');
	return reject(
		command,
		'RPH_INVARIANT_VIOLATION',
		`ChangePwuState would set PWU ${id} assuranceState=WAIVED with no authorized waiver to back it. ` +
			`JPWB-DOC-001 §5.2 reserves WAIVER to Governance, and REG-Q-030 (closed 2026-08-09) records that WAIVED ` +
			`enters only through the waiver flow: a version-bound waiver Decision, with the finding preserved. Cite ` +
			`an EFFECTIVE DECISION whose decisionType is WAIVER, whose subjectObjectIds include ${id}, and whose ` +
			`subjectSemanticVersions pin ${id} at ${currentSemanticVersion}. ` +
			`Supplied: [${why || 'nothing'}].`,
		[id, ...cited]
	);
}

function rejectUnbackedExecutionSuccess(
	ctx: HandlerContext,
	command: DomainCommand,
	id: string,
	p: ChangePwuStatePayload,
	currentExecutionState: string
): CommandResult | undefined {
	if (p.executionState !== 'SUCCEEDED' || currentExecutionState === 'SUCCEEDED') return undefined;
	const cited = p.supportingObjectIds ?? [];
	// JAN-EXECREM WP-12 / F-08. This predicate used to be `steps.some(s => s.stepState === 'SUCCEEDED')` — no
	// status term, and `some` rather than `every`. It is the SOLE guard on the premise the entire assurance chain
	// rests on, and it ran a second, strictly weaker definition of "execution succeeded" than the plan plane's own
	// completion allow-list. Consequences, all three reproduced live: one succeeded step out of five backed a full
	// success claim while four sat QUEUED; and a SUPERSEDED, CANCELLED or FAILED plan backed it identically to an
	// ACTIVE one — a plan the sponsor killed, or one the engine records as FAILED, evidencing that execution
	// succeeded. Both planes now call `planEvidencesExecutionSuccess`, so there is one definition to disagree with.
	const failures: string[] = [];
	const backed = cited.some((oid) => {
		const obj = ctx.store.loadObject(oid);
		if (obj?.objectType !== 'EXECUTION_PLAN') return false;
		const s = obj.state as {
			workUnitId?: string;
			status?: string;
			steps?: { stepState?: string }[];
		};
		if (s.workUnitId !== id) return false;
		const verdict = planEvidencesExecutionSuccess({
			planStatus: String(s.status),
			stepStates: (s.steps ?? []).map((step) => String(step.stepState ?? 'undefined'))
		});
		// Collected so the refusal can say WHICH limb each cited plan failed, rather than "nothing backed it".
		if (!verdict.ok) failures.push(`${oid}: ${verdict.reason} (${verdict.errorCode})`);
		return verdict.ok;
	});
	if (backed) return undefined;
	const detail = failures.length ? ` Cited plan(s) rejected — ${failures.join('; ')}.` : '';
	return reject(
		command,
		'RPH_EVIDENCE_MISSING',
		`ChangePwuState would set PWU ${id} executionState=SUCCEEDED with no execution plan evidencing it. ` +
			`"Execution succeeded" is the premise the whole assurance chain rests on (RPH-PWU-006's Given; ` +
			`§8.1's EXECUTING -> EVIDENCE_PENDING condition), not a status the controller may declare. Cite an ` +
			`EXECUTION_PLAN in supportingObjectIds whose workUnitId is ${id}, whose status is ACTIVE or COMPLETED, ` +
			`every one of whose steps is SUCCEEDED or SKIPPED, and at least one of which SUCCEEDED. ` +
			`Supplied: [${cited.join(', ') || 'nothing'}].${detail}`
	);
}


/**
 * ⚠ TWO GUARDS USED TO LIVE HERE AND ARE GONE — deleted, not disabled (JAN-PWUWP W-1).
 *
 * `rejectUnauthorizedAbandonment` (REG-F-070) and `rejectUnauthorizedRejection` (REG-F-078) were authority
 * checks bolted onto the generic setter because the two acts JPWB-DOC-001 §5.2 reserves to Governance had no
 * commands of their own. They now sit on `abandonPwu` and `rejectPwu` above, and the setter refuses both
 * arrows outright through `PWU_SEMANTIC_LIFECYCLE_COMMANDS`.
 *
 * THE SUBSTANCE MOVED INTACT, and deliberately into the modules rather than the handlers: the seven ordered
 * checks are in `abandon-authorization.ts` and `reject-authorization.ts`, and the blocking-finding predicate
 * in `hasBlockingObservationFor`. Nothing about WHAT is required changed in this increment — only WHO asks.
 */

/**
 * THE GENERIC SETTER MAY NOT PERFORM AN ARROW A SEMANTIC COMMAND OWNS (REG-F-072).
 *
 * Not a guard about a fact or an authority — a guard about the WRITE PATH, which is what PER-3 legislates. The
 * finding it closes: `markPwuReady` runs `checkPwuShapeReadiness` (eight limbs, failing closed) and
 * `changePwuState` performed the SAME `SHAPING -> READY` arrow checking none of it, demonstrated by a shipped
 * test that reached READY with empty `inScope`, `outOfScope` and `expectedOutputs` and a RAW intent.
 *
 * ⚠ WHY CLOSE THE ROUTE RATHER THAN COPY THE GUARD, which is what I built first and withdrew.
 * Copying `checkPwuShapeReadiness` into a fifth "may not be asserted" guard fixes ONE arrow and leaves the class
 * open — and it is a no-op for four of the six owning commands, because `beginPwuShaping`, `challengePwu`,
 * `reshapePwu` and `supersedePwu` add NO precondition at all over the shared `advancePwuLifecycle`. Their delta
 * is the EVENT: `PwuChallenged`, `PwuReshapingStarted`, `PwuSuperseded`, `PwuInvalidated` each carry fields
 * (`challengeReason`, `reason`, `supersedingWorkUnitId`, `triggeringObjectId`) that `ChangePwuStatePayload`
 * cannot express — so no precondition could restore them, and every one of those events is currently emitted by
 * NOTHING when the setter is used. Closing the route is the only repair that restores both the precondition and
 * the record.
 *
 * MEASURED BEFORE CHOSEN: the whole structural fix costs ONE test more than the single-arrow one (49 vs 48), and
 * the production surface is zero — the reference undertaking, the demo route and every e2e already reach these
 * six states through the named commands.
 *
 * A HOLD IS NOT A MOVE. `newState === current` is how the setter advances an orthogonal axis while the
 * workLifecycle axis stays put (the dominant case), and it performs no arrow, so it is untouched.
 */
function rejectArrowOwnedBySemanticCommand(
	command: DomainCommand,
	id: string,
	currentWorkLifecycleState: string,
	newState: string
): CommandResult | undefined {
	if (newState === currentWorkLifecycleState) return undefined;
	const owner = (PWU_SEMANTIC_LIFECYCLE_COMMANDS as Readonly<Record<string, string | undefined>>)[
		newState
	];
	if (owner === undefined) return undefined;
	return reject(
		command,
		'RPH_INVARIANT_VIOLATION',
		`ChangePwuState may not perform PWU ${id} ${currentWorkLifecycleState} -> ${newState}: that arrow ` +
			`belongs to ${owner}, which records the act as its own semantic event and enforces the preconditions ` +
			`this generic setter does not. Dispatch ${owner} instead. (JPWB-DOC-003 §9 PER-3 — canonical state is ` +
			`mutated "only through … semantically named commands that … validate preconditions and invariants"; ` +
			`"no generic CRUD/PATCH path … bypasses this pipeline". REG-F-072.)`,
		[id]
	);
}


/**
 * The workLifecycle axis either ADVANCES (a legal transition whose cross-axis guard holds against the NEW
 * sub-axes) or HOLDS (a no-op move that only advances the orthogonal sub-axes) — and a hold must still not park
 * the PWU in a SATISFIED-without-assurance state (property P1 / INV-5). Returns a reject-result when the move is
 * illegal, or undefined when it is permitted.
 */
function rejectIllegalWorkLifecycleMove(
	command: DomainCommand,
	id: string,
	currentWorkLifecycleState: string,
	newState: string,
	nextAxes: PwuAxes
): CommandResult | undefined {
	if (newState === currentWorkLifecycleState) {
		if (!satisfiesP1(nextAxes)) {
			return reject(
				command,
				'RPH_INVARIANT_VIOLATION',
				`PWU ${id} would hold in SATISFIED without assuranceState=SATISFIED (P1/INV-5)`
			);
		}
		return undefined;
	}
	const advance = canAdvanceWorkLifecycle(currentWorkLifecycleState, newState, nextAxes);
	if (!advance.ok) {
		return reject(
			command,
			'RPH_ILLEGAL_STATE_TRANSITION',
			`Cannot advance PWU ${id} ${currentWorkLifecycleState} -> ${newState}${advance.reason ? ': ' + advance.reason : ''}`
		);
	}
	return undefined;
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
	// JAN-CMDPRE DWP-02: refuse an all-axes-equal re-issue BEFORE the sub-axis loop (which would admit it as three
	// NOOPs). Routed through the DWP-01b mechanism so this bespoke handler's rule is a first-class Precondition;
	// the predicate reads only (state, payload), so the reader is inert here — settled by DWP-08.
	const vacuity = evaluatePrecondition(
		changeNothingPrecondition,
		{
			state: structuredClone(loaded.state),
			payload: structuredClone(command.payload),
			command,
			read: preconditionReader(ctx)
		},
		{ statusField: 'workLifecycleState', subject: 'PWU', eventType: 'PwuStateChanged' }
	);
	if (vacuity) return reject(command, vacuity.code, vacuity.message, [id]);
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
	// THE TWO "MAY NOT BE ASSERTED" GUARDS. checkTransition above answers only "is this an arrow on the
	// machine". Three of these answer "is the fact true": a disposition needs an assessment, a baselining needs a
	// promoted baseline, an execution success needs a succeeded step. The fourth answers "WHO SAID SO" —
	// JAN-PWUWP W-1 REMOVED THE FOURTH AND FIFTH. `rejectUnauthorizedAbandonment` and
	// `rejectUnauthorizedRejection` were authority checks bolted onto a generic setter because the acts they
	// govern had no commands. They now live on `abandonPwu` and `rejectPwu`, and the setter refuses both
	// arrows outright via the ownership table — so a caller is told which command to dispatch instead of
	// being asked for a decision the setter should never have been adjudicating.
	const unearned =
		rejectUnbackedDisposition(ctx, command, id, p, current.assuranceState) ??
		rejectUnauthorizedWaiver(
			ctx,
			command,
			id,
			p,
			current.assuranceState,
			loaded.semanticVersion
		) ??
		rejectUnbackedExecutionSuccess(ctx, command, id, p, current.executionState);
	if (unearned) return unearned;
	// The workLifecycle axis either advances (legal transition + cross-axis guard against the NEW sub-axes) or
	// holds (a no-op move that only advances the orthogonal sub-axes) — and a hold must still not park the PWU in
	// a SATISFIED-without-assurance state (property P1 / INV-5).
	const illegalMove = rejectIllegalWorkLifecycleMove(
		command,
		id,
		current.workLifecycleState,
		p.newState,
		nextAxes
	);
	if (illegalMove) return illegalMove;
	// REG-F-072 — LAST, and deliberately so. An arrow that is ILLEGAL should be reported as illegal rather than
	// as owned; a caller redirected to MarkPwuReady for a transition the machine forbids outright would be sent
	// to a command that will refuse it for a different reason.
	const ownedArrow = rejectArrowOwnedBySemanticCommand(
		command,
		id,
		current.workLifecycleState,
		p.newState
	);
	if (ownedArrow) return ownedArrow;
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
