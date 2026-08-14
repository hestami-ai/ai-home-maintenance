// Intent lifecycle handlers — the Intent.intentStatus machine RAW -> UNDER_DISCOVERY -> PROVISIONAL ->
// FORMALIZED -> APPROVED <-> REVISED (DOC-002 §6). CaptureIntent creates; the rest advance an existing Intent,
// each gated by the state machine (checkTransition) and, for approval, the INT-004 invariant (an approved intent
// must carry at least one desired outcome — DOC-008 INT-004 / DOC-002 §6.3).
import type {
	ApproveIntentPayload,
	CaptureIntentPayload,
	DomainCommand,
	FormalizeIntentPayload,
	ProvisionIntentPayload,
	ReviseIntentPayload,
	SupersedeIntentPayload
} from '@janumipwb/rph-contracts';
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
import {
	evaluatePrecondition,
	fromStates,
	type Precondition
} from './command-precondition.js';

const INTENT = 'INTENT';
const MACHINE = 'Intent.intentStatus';

/** CaptureIntent — (initial) -> RAW. Creates the Intent aggregate. */
export const captureIntent: CommandHandler = (ctx, command, payload) => {
	const p = payload as CaptureIntentPayload;
	const ts = command.issuedAt;
	const actor = command.issuedBy;
	const intent: Record<string, unknown> = {
		id: p.intentId,
		objectType: INTENT,
		schemaVersion: 1,
		semanticVersion: 1,
		revision: 0,
		lifecycleStatus: 'RAW',
		createdAt: ts,
		createdBy: actor,
		updatedAt: ts,
		updatedBy: actor,
		provenance: { originType: 'USER_INPUT', sourceObjectIds: [], sourceEventIds: [] },
		ontologyId: p.ontologyId,
		ontologyVersion: p.ontologyVersion,
		tags: [],
		extensions: [],
		originatingExpression: p.originatingExpression,
		desiredOutcomes: [],
		successConditions: [],
		nonGoals: [],
		ambiguityIds: [],
		constraintIds: [],
		stakeholderIds: [],
		intentStatus: 'RAW'
	};
	// Event payload per DOC-007 §10.3 (IntentCapturedPayload) — was the raw CaptureIntent command payload, which
	// lacks intentStatus. The command's four fields carry over; intentStatus is the 'RAW' the transition lands on.
	const event = makeEvent(ctx, command, {
		eventType: 'IntentCaptured',
		aggregateType: INTENT,
		aggregateId: p.intentId,
		aggregateRevision: 0,
		payload: {
			intentId: p.intentId,
			originatingExpression: p.originatingExpression,
			intentStatus: 'RAW',
			ontologyId: p.ontologyId,
			ontologyVersion: p.ontologyVersion
		}
	});
	return commitState(ctx, command, {
		objectType: INTENT,
		aggregateId: p.intentId,
		expectedRevision: undefined,
		newRevision: 0,
		newSemanticVersion: 1,
		nextState: intent,
		event,
		// THE BIRTH OF `Intent.intentStatus` — REG-F-086, and the other half of REG-F-117. That entry made six
		// arrows visible; a machine with arrows and no birth is `unanalysed`, which means the occupancy census
		// cannot say which of its states are reachable and therefore cannot say which arrows are dead.
		//
		// ⚠ `RAW` IS READ OFF THE STATE COMMITTED ABOVE, NOT OFF `initialState` (REG-F-071: five machines declare
		// one the engine never writes). `commitState` REFUSES if this declaration and that state disagree.
		births: [{ machine: 'Intent.intentStatus', statusField: 'intentStatus', values: ['RAW'] }]
	});
};

/** Shared advance of the Intent.intentStatus machine: load -> optional precheck -> transition guard -> commit. */
function advanceIntent(
	ctx: HandlerContext,
	command: DomainCommand,
	args: {
		readonly target: string;
		readonly eventType: string;
		readonly mutate?: (current: Record<string, unknown>) => Record<string, unknown>;
		readonly precheck?: (current: Record<string, unknown>) => CommandHandlerReject | null;
		readonly bumpSemanticVersion?: boolean;
		/** Build the EVENT payload from the loaded semantic versions. Omitted = pass the command payload through
		 * (correct only where DOC-007 schematizes no event interface — the caller must have checked). */
		readonly eventPayload?: (versions: {
			readonly prior: number;
			readonly next: number;
		}) => unknown;
		/** The precondition under which this command may be issued — see kit.advanceStatus.precondition (JAN-CMDPRE;
		 *  supersedes DWP-00's `requireFrom`). `advanceIntent` is an independent hand-written copy of that primitive,
		 *  so it carries the identical hole and needs the identical enforcement, sited identically (BEFORE `precheck`,
		 *  the local analogue of `guard`): without it a re-issued ReviseIntent is absorbed as a NOOP and still bumps
		 *  semanticVersion, and ApproveIntent rejects unless approvedSemanticVersion matches the current one — so
		 *  replaying a command that changes nothing silently voids an outstanding approval.
		 *  REQUIRED since JAN-CMDPRE DWP-06 (D5), matching kit.advanceStatus — every advanceIntent site declares one. */
		readonly precondition: Precondition;
		/**
		 * The state machine this command drives — REG-F-117, and it is REQUIRED for the same reason `precondition`
		 * is.
		 *
		 * ⚠ IT IS NOT CEREMONY: `checkTransition` reads it, so a wrong value validates the arrow against the wrong
		 * machine. Passing it per call site rather than closing over the module constant is what makes this idiom
		 * structurally identical to `kit.advanceStatus` in exactly the three dimensions the arrow census reads —
		 * `machine`, `target`, and `fromStates` inside `precondition`.
		 *
		 * THAT CONVERGENCE IS THE POINT. REG-F-114 weighed "teach the reader every idiom" (fragile — widening a
		 * reader is how C-0b dropped 30%) against "normalise the handlers onto one idiom" (invasive), and ruled a
		 * third way: make the idiom SELF-DECLARING. For Intent the source set was already declared (`fromStates`)
		 * and already enforced; the only thing the census could not recover was WHICH MACHINE, because this
		 * primitive closed over `MACHINE` instead of being told. One required field closes that without moving any
		 * control flow.
		 */
		readonly machine: string;
	}
) {
	const id = command.targetAggregateId;
	const loaded = loadOrReject(ctx, command, id);
	if (!loaded.ok) return loaded.result;
	if (args.precondition) {
		// Clones, not the live references — see kit.advanceStatus: a predicate must not be able to write into
		// the commit path or the default event payload (critique-B4 ruling, enforced mechanically).
		const refusal = evaluatePrecondition(
			args.precondition,
			{
				state: structuredClone(loaded.state),
				payload: structuredClone(command.payload),
				command,
				read: preconditionReader(ctx)
			},
			{ statusField: 'intentStatus', subject: 'intent', eventType: args.eventType }
		);
		if (refusal) return reject(command, refusal.code, refusal.message, [id]);
	}
	const precheckFailure = args.precheck?.(loaded.state);
	if (precheckFailure) return precheckFailure;
	const from = String(loaded.state.intentStatus);
	// ⚠ `args.machine`, NOT the module constant — that substitution is what makes the declaration load-bearing.
	// Closed over, the field would be a hollow: declared at five call sites, read by nothing, and unkillable.
	const illegal = checkTransition(command, args.machine, from, args.target);
	if (illegal) return illegal;
	const newRevision = loaded.revision + 1;
	const newSemanticVersion = args.bumpSemanticVersion
		? loaded.semanticVersion + 1
		: loaded.semanticVersion;
	const base = nextEnvelope(
		loaded.state,
		command,
		newRevision,
		args.bumpSemanticVersion ? newSemanticVersion : undefined
	);
	const mutated = args.mutate ? args.mutate(base) : base;
	const next = { ...mutated, lifecycleStatus: args.target, intentStatus: args.target };
	const event = makeEvent(ctx, command, {
		eventType: args.eventType,
		aggregateType: INTENT,
		aggregateId: id,
		aggregateRevision: newRevision,
		payload: args.eventPayload
			? args.eventPayload({ prior: loaded.semanticVersion, next: newSemanticVersion })
			: command.payload
	});
	return commitState(ctx, command, {
		objectType: INTENT,
		aggregateId: id,
		expectedRevision: loaded.revision,
		newRevision,
		newSemanticVersion,
		nextState: next,
		event
	});
}

/** A precheck returns a rejecting CommandResult or null. (Alias for readability.) */
type CommandHandlerReject = ReturnType<typeof reject>;

/** BeginIntentDiscovery — RAW -> UNDER_DISCOVERY. */
export const beginIntentDiscovery: CommandHandler = (ctx, command) =>
	advanceIntent(ctx, command, {
		machine: MACHINE,
		target: 'UNDER_DISCOVERY',
		// JAN-CMDPRE DWP-03: Intent.intentStatus has a single in-arrow to UNDER_DISCOVERY, from RAW.
		precondition: fromStates('RAW'),
		eventType: 'IntentDiscoveryStarted',
		// The event records the RESULTING status. IntentDiscoveryStarted declares `intentStatus`, which the
		// BeginIntentDiscovery command payload ({}) does not carry — so the default emitted `{}` recorded nothing of
		// the transition it exists to announce. Ambiguities are discovered later (ProvisionIntent), so none here.
		eventPayload: () => ({ intentStatus: 'UNDER_DISCOVERY' })
	});

/** ProvisionIntent — UNDER_DISCOVERY -> PROVISIONAL (records objective + known ambiguities, DOC-002 §6.1). */
export const provisionIntent: CommandHandler = (ctx, command, payload) =>
	advanceIntent(ctx, command, {
		machine: MACHINE,
		target: 'PROVISIONAL',
		// JAN-CMDPRE DWP-03: single in-arrow to PROVISIONAL, from UNDER_DISCOVERY.
		precondition: fromStates('UNDER_DISCOVERY'),
		eventType: 'IntentProvisioned',
		mutate: (c) => {
			const p = payload as ProvisionIntentPayload;
			return { ...c, ambiguityIds: p.ambiguityIds };
		}
	});

/** FormalizeIntent — PROVISIONAL -> FORMALIZED (records objective, outcomes, conditions, non-goals). */
export const formalizeIntent: CommandHandler = (ctx, command, payload) => {
	const p = payload as FormalizeIntentPayload;
	return advanceIntent(ctx, command, {
		machine: MACHINE,
		target: 'FORMALIZED',
		// JAN-CMDPRE DWP-03: single in-arrow to FORMALIZED, from PROVISIONAL.
		precondition: fromStates('PROVISIONAL'),
		eventType: 'IntentFormalized',
		mutate: (c) => ({
			...c,
			formalizedObjective: p.formalizedObjective,
			desiredOutcomes: p.desiredOutcomes,
			successConditions: p.successConditions,
			nonGoals: p.nonGoals,
			ambiguityIds: p.ambiguityIds,
			constraintIds: p.constraintIds,
			stakeholderIds: p.stakeholderIds
		}),
		// Event payload per DOC-007 §10.5 (IntentFormalizedPayload) — was the raw FormalizeIntent command payload,
		// which lacks the two semanticVersion fields + intentStatus and carries three ids the event does not
		// schematize (ambiguityIds/constraintIds/stakeholderIds — they land on the OBJECT via mutate, not the event).
		// prior === next here: FORMALIZED is not a material change, so this command does not bump (no
		// bumpSemanticVersion), and the event reports the versions the handler actually has.
		eventPayload: (v) => ({
			priorSemanticVersion: v.prior,
			newSemanticVersion: v.next,
			formalizedObjective: p.formalizedObjective,
			desiredOutcomes: p.desiredOutcomes,
			successConditions: p.successConditions,
			nonGoals: p.nonGoals,
			intentStatus: 'FORMALIZED'
		})
	});
};

/** ApproveIntent — FORMALIZED|REVISED -> APPROVED. Enforces INT-004: an approved intent needs a desired outcome. */
export const approveIntent: CommandHandler = (ctx, command, payload) => {
	const p = payload as ApproveIntentPayload;
	return advanceIntent(ctx, command, {
		machine: MACHINE,
		target: 'APPROVED',
		// JAN-CMDPRE DWP-03: Intent.intentStatus has TWO in-arrows to APPROVED — FORMALIZED (first approval) and
		// REVISED (re-approval after a revision). Authored from the MACHINE, deliberately WIDER than the vocab's
		// `drivesFrom`, which says FORMALIZED only (DS-001 D4: the vocab has no ratified authority and is narrower
		// than the machine here; the handler's own docstring already says FORMALIZED|REVISED). This refuses a
		// re-issue against an already-APPROVED intent (the stale-version precheck below only fired if the same
		// version was re-sent; now the source-state guard refuses it first) while keeping the legitimate
		// REVISED -> APPROVED re-approval cycle.
		precondition: fromStates('FORMALIZED', 'REVISED'),
		eventType: 'IntentApproved',
		// Event payload per DOC-007 §10.7 (IntentApprovedPayload) — was the raw ApproveIntent command payload, which
		// lacks intentStatus. Contract-drift fix: approvalScope (WHAT the approval authorized) is required on the
		// command but §10.7 dropped it, so it was validated then discarded — the governed stream recorded that the
		// intent was approved and by which decision, but not the scope the approval covered. Now carried (optional
		// atop the ratified §10.7 shape, authored under §0.3; the event stays ratified/gated).
		eventPayload: () => ({
			decisionId: p.decisionId,
			approvedSemanticVersion: p.approvedSemanticVersion,
			intentStatus: 'APPROVED',
			...(p.approvalScope ? { approvalScope: p.approvalScope } : {})
		}),
		precheck: (current) => {
			const outcomes = current.desiredOutcomes;
			if (!Array.isArray(outcomes) || outcomes.length === 0) {
				return reject(
					command,
					'RPH_INVARIANT_VIOLATION',
					'An approved intent must record at least one desired outcome (INT-004)'
				);
			}
			// W3-INC-1 (WP-3-003 / master invariant 7 / W3 exit "human decisions bind exact semantic versions").
			// The approval names the exact intent version it authorizes; it must equal the intent's CURRENT semantic
			// version. Before this, `approvedSemanticVersion` was recorded into the IntentApproved event but never
			// compared — so an approval of v1 could stand after the intent had been revised to v2 (the §19-prohibited
			// "stale approval governs a changed semantic version"). This is the Intent analog of the PromoteBaseline
			// stale-decision guard (WIRE-4 / RPH-GOV-003). markPwuReady already enforces the same for PWUs.
			const currentVersion = current.semanticVersion;
			if (typeof currentVersion === 'number' && p.approvedSemanticVersion !== currentVersion) {
				return reject(
					command,
					'RPH_INVARIANT_VIOLATION',
					`ApproveIntent binds an exact semantic version: the approval names v${p.approvedSemanticVersion} but intent ${command.targetAggregateId} is at v${currentVersion}. A stale or mismatched approval cannot govern this intent version — re-approve the current one (master invariant 7; the Intent analog of RPH-GOV-003).`
				);
			}
			return null;
		}
	});
};

/** ReviseIntent — APPROVED -> REVISED (a material change: increments the semantic version, DOC-002 §6.3). */
export const reviseIntent: CommandHandler = (ctx, command, payload) => {
	const p = payload as ReviseIntentPayload;
	return advanceIntent(ctx, command, {
		machine: MACHINE,
		target: 'REVISED',
		// In-arrow: APPROVED only. Re-issuing from REVISED was absorbed as a NOOP yet still bumped semanticVersion, and
		// ApproveIntent requires approvedSemanticVersion === current — so replaying a command that changed nothing
		// silently VOIDED an outstanding approval, and baseline staleness keys on the same field.
		precondition: fromStates('APPROVED'),
		eventType: 'IntentRevised',
		bumpSemanticVersion: true,
		// Event payload per IntentRevisedPayloadSchema — was the raw ReviseIntent command payload
		// ({changeRationale, impactAnalysisId?}), which carries NEITHER of the two facts the revision produced:
		// the INCREMENTED semanticVersion and the resulting intentStatus. That is the whole point of this event —
		// RPH-INT-006 ("materially revising an approved intent ... increments semantic version, emits IntentRevised")
		// and the stale-approval guard in `approveIntent` both key on the version this revision landed on, and the
		// governed stream did not record it. `v.next` IS the committed newSemanticVersion (bumpSemanticVersion is
		// true, so advanceIntent commits loaded.semanticVersion + 1 and hands the same number here) — read from the
		// commit, not recomputed. The command's two fields carry over unchanged; impactAnalysisId is optional on
		// both shapes and is emitted only when actually sent (never `undefined` into a strictObject).
		eventPayload: (v) => ({
			changeRationale: p.changeRationale,
			...(p.impactAnalysisId !== undefined ? { impactAnalysisId: p.impactAnalysisId } : {}),
			semanticVersion: v.next,
			intentStatus: 'REVISED'
		})
	});
};

/**
 * SupersedeIntent — (any active) -> SUPERSEDED. The first command to reach an Intent terminal state.
 *
 * ── THE NAME IS AUTHORED; NOTHING ELSE HERE IS (REG-F-131, on REG-D-024's precedent) ──────────────────────────
 *
 * `SupersedeIntent` appears NOWHERE in canon — checked, and the only hits in `docs/canon` are the register
 * entries about this work. The EVENT is ratified (`IntentSuperseded` is in the Canonical Domain Model's event
 * list) and so are the six in-arrows, each machine row noting *"VERBATIM §6.2. 'Any active' = any non-terminal
 * state"*.
 *
 * The command is PRESUPPOSED rather than invented: PER-3 states canonical state is mutated *"only through
 * authenticated, authorized, semantically named commands"*, with no bypass — so a ratified state with ratified
 * in-arrows and a ratified event MUST be reached by a command, and the corpus leaves only its NAME unstated.
 * **The asymmetry is the tell: the ratified list names six Intent events and FIVE already had commands.**
 *
 * ── WHY THE GUARD LANDED FIRST, AND WHAT THIS COMMAND CHANGES ─────────────────────────────────────────────────
 *
 * This makes SUPERSEDED reachable for the first time. STA-6's *"a superseded intent cannot authorize new PWUs"*
 * was closed in the enforcement register purely because nothing could produce that state, so shipping this first
 * would have delivered six arrows, a green gate, and a governance rule that had quietly stopped being closed.
 * `proposePwu` already refuses a SUPERSEDED intent (REG-F-129) — landed one increment ahead, deliberately,
 * against an antecedent nothing could yet reach.
 *
 * ── THE SUCCESSOR IS REQUIRED, AND NOT BY MY CHOICE ───────────────────────────────────────────────────────────
 *
 * `IntentSupersededPayloadSchema` declares `supersedingIntentId` REQUIRED, so a supersession names its successor
 * or the event cannot be built. It is NOT checked to EXIST here: REG-F-017's survey found that whether a governed
 * reference may name an object that was never created is a SEPARATE rule (11 of its 13 divergences were exactly
 * that), and bundling it in would make one command carry two. Recorded rather than silently decided.
 *
 * ⚠ NO `WithdrawIntent` SIBLING, DELIBERATELY. WITHDRAWN's three arrows stay uncovered because the corpus
 * ratifies NO event for them — `IntentWithdrawn` occurs nowhere — and minting one would be inventing the very
 * thing this docblock argues was merely UNSTATED for supersede. A state reached by an invented event looks
 * governed; a state nothing can reach stays visible. That is REG-D-024's own reasoning, applied in the refusing
 * direction.
 */
export const supersedeIntent: CommandHandler = (ctx, command, payload) => {
	const p = payload as SupersedeIntentPayload;

	// ── THE SUCCESSOR IS RESOLVED, NOT TAKEN ON THE CALLER'S WORD (REG-F-134) ────────────────────────────────
	//
	// This arrow DECLARES the guard "Replacement intent identified", and the first version of this handler
	// copied `supersedingIntentId` into the event without ever loading the object it names — the REG-F-014
	// shape, a caller-supplied fact taken as true where the engine could have resolved it. That the guard was
	// unenforced went unnoticed because C-0b scored its row ARROW_UNREACHABLE and nothing checked dismissals.
	//
	// ⚠ AND THE OMISSION WAS A LIVE DEFECT, because of how it composed with the increment ONE COMMIT EARLIER.
	// SUPERSEDED is terminal and REG-F-129 makes `proposePwu` refuse a SUPERSEDED intent, so a supersession
	// naming a successor that does not exist STRANDS THE INTENT PERMANENTLY: no new work is authorized, there
	// is no successor to propose against, and no arrow leaves SUPERSEDED. Neither increment had it alone.
	//
	// ⚠ THE TYPE IS ASSERTED, NOT ONLY EXISTENCE, and that is a DEPARTURE from `proposePwu`'s PWU-002 rather
	// than a copy of it. PWU-002 discloses at `pwu.ts:255` that it is existence-only and that "a non-INTENT id
	// would carry `intentStatus: undefined` and pass this check"; inheriting that shape here would let a PWU
	// supersede an intent. That a command-created intent carries `objectType` at all was DRIVEN through the bus
	// before this guard was written — the literal `objectType: 'INTENT'` occurs elsewhere only in test seeds,
	// so reading it would have been reading a fixture.
	if (p.supersedingIntentId === command.targetAggregateId) {
		return reject(
			command,
			'RPH_VALIDATION_SEMANTIC_FAILED',
			`SupersedeIntent cannot name intent ${command.targetAggregateId} as its own successor: a ` +
				`supersession moves an intent to a TERMINAL state and names what replaces it, so naming itself ` +
				`would end the intent and leave nothing to carry the work forward.`,
			[command.targetAggregateId]
		);
	}
	const successor = ctx.store.loadObject(p.supersedingIntentId);
	if (successor?.objectType !== 'INTENT') {
		const found = successor ? `a ${String(successor.objectType)}` : 'not stored';
		return reject(
			command,
			'RPH_VALIDATION_SEMANTIC_FAILED',
			`SupersedeIntent requires an existing INTENT as the superseding intent, and ` +
				`${p.supersedingIntentId} is ${found}. ` +
				`SUPERSEDED is terminal and a superseded intent authorizes no new work (JPWB-DOC-003 §5 STA-6), ` +
				`so a supersession to an unresolvable successor would strand this intent permanently.`,
			[command.targetAggregateId]
		);
	}

	return advanceIntent(ctx, command, {
		machine: MACHINE,
		target: 'SUPERSEDED',
		// The machine's six in-arrows — "any active" — declared LITERALLY, so the arrow census reads them at this
		// site instead of inferring them from the machine (REG-F-114, and REG-F-122 which deleted the inference).
		precondition: fromStates(
			'RAW',
			'UNDER_DISCOVERY',
			'PROVISIONAL',
			'FORMALIZED',
			'APPROVED',
			'REVISED'
		),
		eventType: 'IntentSuperseded',
		// The event records the RESULTING status alongside the successor, so a log-driven fold can see where the
		// intent went. Omitting it is how FAILED and post-retry QUEUED became unobservable in the execution machine
		// (JAN-EXECREM F-25), and REG-F-020 found the same omission across four handlers.
		eventPayload: () => ({
			supersedingIntentId: p.supersedingIntentId,
			intentStatus: 'SUPERSEDED'
		})
	});
};
