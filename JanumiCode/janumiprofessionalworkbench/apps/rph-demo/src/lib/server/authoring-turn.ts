import type { DomainCommand } from '@janumipwb/rph-contracts';
import { contentHash } from '@janumipwb/rph-contracts/hash';
import { newlyReferencedAssurancePolicyIds, validatorNamedBy } from '@janumipwb/rph-application';
import { FLOOR_POLICY_IDS } from '@janumipwb/rph-assurance';
import type { PwaAuthoringBroker } from '@janumipwb/rph-authoring';
import { listPwuTypes, type AuthedEngineHandle, type ForkBase } from '@janumipwb/rph-engine';
import { createActor } from 'xstate';
import { authoringTurnMachine, type AuthoringTurnState } from '$lib/server/authoring-turn-machine';
import { AGENT_CREDENTIAL } from './identity.js';
import { getEngine, makeAuthoringBroker, mintUiId } from '$lib/server/workbench';

type TurnActor = ReturnType<typeof newTurnActor>;

/**
 * One in-process natural-language authoring candidate. `engine` is a point-in-time fork: every agent tool,
 * transcript write, and assurance Command exercises production handlers while canonical state remains unchanged.
 */
export interface AuthoringTurn {
	readonly id: string;
	readonly pwaId: string;
	readonly engine: AuthedEngineHandle;
	readonly broker: PwaAuthoringBroker;
	readonly createdAt: string;
	/** Defensive snapshot; callers cannot mutate the replay log. */
	readonly commands: readonly DomainCommand[];
	readonly status: AuthoringTurnState;
	readonly candidateHash?: string;
	readonly assuredSubjectHash?: string;
	readonly detail?: string;
}

interface MutableAuthoringTurn {
	readonly id: string;
	readonly pwaId: string;
	readonly canonical: AuthedEngineHandle;
	readonly engine: AuthedEngineHandle;
	readonly broker: PwaAuthoringBroker;
	readonly createdAt: string;
	readonly recordedCommands: DomainCommand[];
	/** What the fork was taken from — the position, and every aggregate's revision there — and what it wrote since. */
	readonly forkBase: ForkBase;
	/**
	 * Canonical events this turn's OWN acts produced before acceptance — today only the exchange records its
	 * reviewer's tries write (PER-9). Never reset by a resume, exactly as `forkBase` is not: every try across the
	 * turn's life is its own. See `witnessingEngine`.
	 */
	readonly witnessedEventIds: string[];
	readonly actor: TurnActor;
	candidateHash?: string;
	assuredSubjectHash?: string;
	detail?: string;
}

export interface AuthoringTurnSummary {
	readonly id: string;
	readonly status: AuthoringTurnState;
	readonly candidateHash?: string;
	readonly assuredSubjectHash?: string;
	readonly commandCount: number;
	readonly createdAt: string;
	readonly canonicalUnchanged: true;
}

export type CommitAuthoringTurnResult =
	| { readonly ok: true; readonly candidateHash: string; readonly commandCount: number }
	| {
			readonly ok: false;
			readonly status: 'CONFLICTED' | 'COMMIT_FAILED';
			readonly candidateHash: string;
			readonly detail: string;
	  };

const turnsByPwa = new Map<string, MutableAuthoringTurn>();
/** Every candidate engine a turn hands out — including each `as()` re-binding — to the turn it records for. */
const recorderTurns = new WeakMap<AuthedEngineHandle, () => MutableAuthoringTurn>();

function newTurnActor() {
	return createActor(authoringTurnMachine).start();
}

function stateOf(turn: MutableAuthoringTurn): AuthoringTurnState {
	return String(turn.actor.getSnapshot().value as string | number | boolean) as AuthoringTurnState;
}

function transition(
	turn: MutableAuthoringTurn,
	event: Parameters<TurnActor['send']>[0],
	expected: AuthoringTurnState
): void {
	const before = stateOf(turn);
	turn.actor.send(event);
	const after = stateOf(turn);
	if (after !== expected) {
		throw new Error(
			`Invalid authoring-turn transition ${before} --${event.type}--> ${after}; expected ${expected}.`
		);
	}
}

function publicTurn(turn: MutableAuthoringTurn): AuthoringTurn {
	return {
		id: turn.id,
		pwaId: turn.pwaId,
		engine: turn.engine,
		broker: turn.broker,
		createdAt: turn.createdAt,
		get commands() {
			return structuredClone(turn.recordedCommands);
		},
		get status() {
			return stateOf(turn);
		},
		get candidateHash() {
			return turn.candidateHash;
		},
		get assuredSubjectHash() {
			return turn.assuredSubjectHash;
		},
		get detail() {
			return turn.detail;
		}
	};
}

const MUTABLE_STATES: ReadonlySet<AuthoringTurnState> = new Set(['COLLECTING', 'ASSURING']);

/** Recoverable staged states: a candidate the human can address WITHOUT discarding — a substantive revision request
 *  (REVISION_REQUIRED) or an external/operational reviewer failure (BLOCKED_EXTERNAL, e.g. a transient reviewer
 *  outage). Both can be reopened for another agent turn over the SAME isolated fork, so no accepted work is lost. */
const RESUMABLE_STATES: ReadonlySet<AuthoringTurnState> = new Set([
	'REVISION_REQUIRED',
	'BLOCKED_EXTERNAL'
]);

export function isResumableAuthoringTurn(status: AuthoringTurnState): boolean {
	return RESUMABLE_STATES.has(status);
}

/** Record only mutations that really exist in the isolated fork. Failed commands and rolled-back batches never
 * enter the replay log. Any accepted mutation invalidates cached assurance/acceptance bindings. */
function recordingEngine(
	delegate: AuthedEngineHandle,
	commands: DomainCommand[],
	currentTurn: () => MutableAuthoringTurn
): AuthedEngineHandle {
	const assertMutable = () => {
		const status = stateOf(currentTurn());
		if (!MUTABLE_STATES.has(status)) {
			throw new Error(`Candidate mutation is closed while the authoring turn is ${status}.`);
		}
	};
	const accepted = (batch: readonly DomainCommand[]) => {
		const turn = currentTurn();
		commands.push(...structuredClone(batch));
		turn.candidateHash = undefined;
		turn.assuredSubjectHash = undefined;
		turn.detail = undefined;
	};
	const recorder: AuthedEngineHandle = {
		// The recorder IS the delegate's identity, not a second one. Anything else would let a surface read one
		// actor off this handle and have its commands recorded as another.
		principal: delegate.principal,
		/**
		 * Re-binding produces a recorder bound to the NEW identity, never this one wearing another name.
		 * Returning `recorder` unchanged would let a caller present any credential and still have the acts
		 * recorded — and later replayed — as the identity this turn happened to open with.
		 */
		as: (credential) => recordingEngine(delegate.as(credential), commands, currentTurn),
		dispatch(command) {
			assertMutable();
			const result = delegate.dispatch(command);
			if (result.status === 'ACCEPTED') accepted([command]);
			return result;
		},
		dispatchBatch(batch) {
			assertMutable();
			const result = delegate.dispatchBatch(batch);
			if (result.ok) {
				accepted(batch.filter((_, index) => result.results[index]?.status === 'ACCEPTED'));
			}
			return result;
		},
		dispatchBatchGuarded() {
			throw new Error('A staged candidate cannot create a nested guarded canonical commit.');
		},
		/**
		 * ⛔ REFUSED, AND FOR THIS RECORDER'S OWN STATED INVARIANT (`JAN-EXEC` `R23`). The note above says it in
		 * terms: *"The recorder IS the delegate's identity, not a second one. Anything else would let a surface
		 * read one actor off this handle and have its commands recorded as another."* A multi-party batch carries
		 * commands issued by a party this turn is NOT bound to — recording them into the turn's replay log would
		 * make exactly that substitution, and the replay would attribute another party's acts to the delegate.
		 *
		 * ⚠ A THROW RATHER THAN A SILENT PASS-THROUGH TO `delegate.dispatchMultiPartyBatch`, which would compile
		 * and would record nothing at all — the staged candidate would then be missing commands it had committed.
		 */
		dispatchMultiPartyBatch() {
			throw new Error(
				'An authoring turn records one party\u2019s commands for replay; a multi-party batch would attribute ' +
					'another party\u2019s acts to this turn\u2019s delegate.'
			);
		},
		subscribe: (handler) => delegate.subscribe(handler),
		drainOutbox: () => delegate.drainOutbox(),
		recoverOutbox: () => delegate.recoverOutbox(),
		loadObject: (id) => delegate.loadObject(id),
		readAllEvents: () => delegate.readAllEvents(),
		fork() {
			throw new Error('Nested candidate forks are not part of an authoring turn.');
		},
		forkBase: () => delegate.forkBase(),
		ontology: delegate.ontology,
		close: () => delegate.close()
	};
	recorderTurns.set(recorder, currentTurn);
	return recorder;
}

/**
 * ⭐ THE ONE CANONICAL WRITE A TURN MAKES BEFORE ACCEPTANCE, AND THE RECORD OF WHAT IT PRODUCED (`JAN-CRITREAD`
 * `TT-2`, `REG-F-425`). A real reviewer's every try is recorded CANONICALLY as a `MODEL_EXCHANGE` (PER-9: a try
 * that was made survives a discarded turn), so the log grows under the turn. The commit guard used to refuse any
 * growth at all, and every really-reviewed turn refused its own candidate. This handle writes those records and
 * notes the events they produced; the commit admits exactly those, and nothing else.
 *
 * ⛔ ONLY `RecordModelExchange`. Candidate state belongs on `turn.engine`; letting anything else through here
 * would make it a back door to canonical that the commit then admits as the turn's own.
 * ⛔ THE DISPATCH IS UNCONDITIONAL — never refused because of the turn's state (PER-9). Only the NOTING is
 * conditional, on an ACCEPTED result: a DUPLICATE carries an EARLIER act's events, which are not this turn's.
 * ⭑ NOTED ON THIS TURN OBJECT, never on "whichever turn the PWA has now". A discarded turn's late try is noted on
 * the discarded turn, which can never commit, and so is never admitted into a successor's commit. That keying is
 * the whole protection; a liveness check on the noting path would add nothing observable. Nothing here throws.
 */
function witnessingEngine(
	turn: MutableAuthoringTurn,
	delegate: AuthedEngineHandle
): AuthedEngineHandle {
	const closed = (what: string) => () => {
		throw new Error(
			`An authoring turn's canonical witness records exchange tries only; ${what} is not one of its acts.`
		);
	};
	return {
		principal: delegate.principal,
		as: (credential) => witnessingEngine(turn, delegate.as(credential)),
		dispatch(command) {
			if (command.commandType !== 'RecordModelExchange') {
				throw new Error(
					`An authoring turn writes only its exchange records to canonical before acceptance; ` +
						`${command.commandType} belongs on the turn's candidate engine.`
				);
			}
			const result = delegate.dispatch(command);
			if (result.status === 'ACCEPTED') turn.witnessedEventIds.push(...result.producedEventIds);
			return result;
		},
		dispatchBatch: closed('a batch'),
		dispatchBatchGuarded: closed('a guarded batch'),
		dispatchMultiPartyBatch: closed('a multi-party batch'),
		subscribe: (handler) => delegate.subscribe(handler),
		drainOutbox: () => delegate.drainOutbox(),
		recoverOutbox: () => delegate.recoverOutbox(),
		loadObject: (id) => delegate.loadObject(id),
		readAllEvents: () => delegate.readAllEvents(),
		fork: closed('a fork'),
		forkBase: () => delegate.forkBase(),
		ontology: delegate.ontology,
		close: closed('closing canonical')
	};
}

/**
 * The canonical handle an assurance run on `handle` must record its tries through: the witness of the ACTIVE turn
 * whose candidate engine `handle` is (any `as()` re-binding of it included), else `undefined` — `handle` is then
 * not a turn's fork, and its tries are nobody's candidate's business.
 */
export function canonicalActsOf(handle: AuthedEngineHandle): AuthedEngineHandle | undefined {
	const turnOf = recorderTurns.get(handle);
	if (!turnOf) return undefined;
	const turn = turnOf();
	return turnsByPwa.get(turn.pwaId) === turn ? witnessingEngine(turn, turn.canonical) : undefined;
}

/** Begin an isolated candidate. There may be only one pending natural-language turn per PWA in this process. */
export function beginAuthoringTurn(
	pwaId: string,
	canonical: AuthedEngineHandle = getEngine().as(AGENT_CREDENTIAL)
): AuthoringTurn {
	const existing = turnsByPwa.get(pwaId);
	if (existing) {
		throw new Error(
			`PWA ${pwaId} already has a staged authoring candidate (${stateOf(existing)}). Discard or resolve it before starting another turn.`
		);
	}

	const id = mintUiId('sess');
	const isolated = canonical.fork();
	const forkBase = isolated.forkBase();
	if (!forkBase) throw new Error('An authoring turn needs a fork of canonical to record into.');
	if (!isolated.loadObject(pwaId)) throw new Error(`PWA ${pwaId} does not exist.`);
	const recordedCommands: DomainCommand[] = [];
	const turnRef: { current?: MutableAuthoringTurn } = {};
	const engine = recordingEngine(isolated, recordedCommands, () => {
		if (!turnRef.current) throw new Error('Authoring turn is not initialized.');
		return turnRef.current;
	});
	const turn: MutableAuthoringTurn = {
		id,
		pwaId,
		canonical,
		engine,
		broker: makeAuthoringBroker(pwaId, engine, id),
		createdAt: new Date().toISOString(),
		recordedCommands,
		forkBase,
		witnessedEventIds: [],
		actor: newTurnActor()
	};
	turnRef.current = turn;
	turnsByPwa.set(pwaId, turn);
	return publicTurn(turn);
}

function mutable(turn: AuthoringTurn): MutableAuthoringTurn {
	const current = turnsByPwa.get(turn.pwaId);
	if (current?.id !== turn.id) throw new Error(`Authoring turn ${turn.id} is not active.`);
	return current;
}

/** Exact hash of the complete PWA/PWU-Type semantic subject, including fields omitted by the render export. */
export function hashAuthoringSubject(turn: AuthoringTurn): string {
	const current = mutable(turn);
	const pwa = current.engine.loadObject(current.pwaId);
	if (!pwa) throw new Error(`Candidate PWA ${current.pwaId} does not exist.`);
	const types = listPwuTypes(current.engine, current.pwaId)
		.map((type) => ({ id: type.id, object: current.engine.loadObject(type.id) }))
		.sort((left, right) => left.id.localeCompare(right.id));
	return contentHash({ pwa: { id: current.pwaId, object: pwa }, types });
}

/** Move a collected candidate through deterministic validation and into assurance. */
export function markAuthoringTurnValid(turn: AuthoringTurn): string {
	const current = mutable(turn);
	transition(current, { type: 'VALIDATE' }, 'VALIDATING');
	transition(current, { type: 'VALID' }, 'ASSURING');
	return hashAuthoringSubject(turn);
}

/** A candidate defect requires revision; canonical state remains unchanged. */
export function markAuthoringTurnRevisionRequired(turn: AuthoringTurn, detail: string): void {
	const current = mutable(turn);
	if (stateOf(current) === 'COLLECTING') {
		transition(current, { type: 'VALIDATE' }, 'VALIDATING');
		transition(current, { type: 'INVALID' }, 'REVISION_REQUIRED');
	} else {
		transition(current, { type: 'CANDIDATE_FINDINGS' }, 'REVISION_REQUIRED');
	}
	current.detail = detail;
	finalizeAuthoringTurn(turn);
}

/** An unavailable/misconfigured/independence-invalid assessor is external to candidate content. */
export function markAuthoringTurnExternalBlock(turn: AuthoringTurn, detail: string): void {
	const current = mutable(turn);
	transition(current, { type: 'EXTERNAL_BLOCK' }, 'BLOCKED_EXTERNAL');
	current.detail = detail;
	finalizeAuthoringTurn(turn);
}

/**
 * Reopen a recoverable staged candidate (REVISION_REQUIRED or BLOCKED_EXTERNAL) for another agent turn over its
 * EXISTING isolated fork — the non-destructive path so a substantive revision or a transient reviewer failure never
 * forces the human to discard accepted work. Moves the turn back to a mutable state (REVISE→COLLECTING /
 * RETRY_ASSURANCE→ASSURING) so the next agent run refines the SAME candidate; the prior conversation is preserved
 * (it lives on the fork and grows by append). Returns undefined when there is no resumable turn to reopen.
 */
export function resumeAuthoringTurn(pwaId: string): AuthoringTurn | undefined {
	const turn = turnsByPwa.get(pwaId);
	if (!turn) return undefined;
	const status = stateOf(turn);
	if (status === 'REVISION_REQUIRED') transition(turn, { type: 'REVISE' }, 'COLLECTING');
	else if (status === 'BLOCKED_EXTERNAL') transition(turn, { type: 'RETRY_ASSURANCE' }, 'ASSURING');
	else return undefined;
	// The prior candidate/assurance bindings no longer describe the (about to be refined) candidate.
	turn.candidateHash = undefined;
	turn.assuredSubjectHash = undefined;
	turn.detail = undefined;
	return publicTurn(turn);
}

/** Bind a SATISFIED floor to the exact subject hash the reviewer received. */
export function markAuthoringTurnAssured(turn: AuthoringTurn, reviewedSubjectHash: string): string {
	const current = mutable(turn);
	const actualSubjectHash = hashAuthoringSubject(turn);
	if (actualSubjectHash !== reviewedSubjectHash) {
		throw new Error(
			`Assurance is stale: reviewer subject ${reviewedSubjectHash}, current candidate ${actualSubjectHash}.`
		);
	}
	current.assuredSubjectHash = reviewedSubjectHash;
	transition(current, { type: 'ASSURANCE_OK' }, 'READY_TO_COMMIT');
	return finalizeAuthoringTurn(turn);
}

/** Every aggregate the candidate writes: each recorded command's target, and each aggregate the fork's writes touched
 *  (a command may write more than its target — a type edit also bumps its PWA). */
function writeSet(turn: MutableAuthoringTurn): string[] {
	return [
		...new Set([
			...turn.recordedCommands.map((command) => command.targetAggregateId),
			...turn.forkBase.writes().map((write) => write.aggregateId)
		])
	];
}

function candidateArtifacts(turn: MutableAuthoringTurn) {
	const affectedIds = writeSet(turn).sort(
		(left, right) => Number(left > right) - Number(left < right)
	);
	const affectedObjects = affectedIds.map((id) => {
		const object = turn.engine.loadObject(id);
		if (!object) throw new Error(`Candidate affected aggregate ${id} is missing.`);
		return { id, contentHash: contentHash(object) };
	});
	return { affectedIds, affectedObjects };
}

/** Bind a digest to the declared dependencies, exact accepted command sequence, and resulting object states. */
export function finalizeAuthoringTurn(turn: AuthoringTurn): string {
	const current = mutable(turn);
	const { affectedObjects } = candidateArtifacts(current);
	current.candidateHash = contentHash({
		pwaId: current.pwaId,
		base: {
			mark: current.forkBase.mark,
			pins: declaredPreconditions(current).sort((left, right) =>
				left.aggregateId.localeCompare(right.aggregateId)
			)
		},
		commands: current.recordedCommands,
		affectedObjects,
		assuredSubjectHash: current.assuredSubjectHash
	});
	return current.candidateHash;
}

type GuardedBatchResult = ReturnType<AuthedEngineHandle['dispatchBatchGuarded']>;
type GuardPrecondition = Parameters<AuthedEngineHandle['dispatchBatchGuarded']>[1][number];

/** Guard the READY_TO_COMMIT preconditions and re-verify the exact accepted candidate; returns its digest. */
function assertReadyToCommit(
	turn: AuthoringTurn,
	current: MutableAuthoringTurn,
	acceptedCandidateHash: string
): string {
	if (stateOf(current) !== 'READY_TO_COMMIT') {
		throw new Error(`Authoring turn ${turn.id} is ${stateOf(current)}, not READY_TO_COMMIT.`);
	}
	const subjectHash = hashAuthoringSubject(turn);
	if (!current.assuredSubjectHash || subjectHash !== current.assuredSubjectHash) {
		throw new Error('The candidate changed after assurance and must be reviewed again.');
	}
	const candidateHash = finalizeAuthoringTurn(turn);
	if (!acceptedCandidateHash || acceptedCandidateHash !== candidateHash) {
		throw new Error(
			`Acceptance hash does not match the exact candidate (${acceptedCandidateHash || 'missing'} != ${candidateHash}).`
		);
	}
	return candidateHash;
}

// ── WHAT A DRAFT DEPENDS ON (`JAN-CRITREAD` `DD-3`, `REG-D-070`) ────────────────────────────────────────────────────
//
// A staged draft is refused at acceptance only if something it depends on changed since it was started. Nothing else
// can refuse it — which is what ends `REG-F-430`, where any write anywhere in the store destroyed every open draft.
// It depends on the PINS below, each held at its revision at the fork's position or held absent, and on the GROUPS
// below, keyed sets whose membership it read or whose ranking its commit writes into.

type DeclaredEventLog = Extract<
	Parameters<AuthedEngineHandle['dispatchBatchGuarded']>[2],
	{ readonly groups: unknown }
>;
type DependencyGroup = DeclaredEventLog['groups'][number];
type DependencyViolation = NonNullable<GuardedBatchResult['dependencyViolations']>[number];

/** Why each pinned aggregate is pinned, in the words the disclosure uses. The FIRST role an id earns is the one shown. */
export type PinRole =
	| 'your PWA'
	| 'a floor review policy'
	| 'a policy this draft newly references'
	| 'the validator a recorded review names'
	| 'an object this draft writes';

const FLOOR_POLICIES: readonly string[] = Object.values(FLOOR_POLICY_IDS);

/**
 * The §5.1 pins, each with its role: the PWA; the three floor policies (the floor verdict is computed on the fork and
 * never re-judged at replay); every policy a write newly referenced against the state it replaced — exactly what the
 * replay re-validates, command by command; the validator a recorded review names (the replay reads it by id); and
 * every aggregate the draft writes. ⛔ No longer every policy in the store: an unrelated policy edited mid-draft is
 * not this draft's business.
 */
function declaredPins(current: MutableAuthoringTurn): ReadonlyMap<string, PinRole> {
	const pins = new Map<string, PinRole>();
	const pin = (aggregateId: string, role: PinRole) => {
		if (!pins.has(aggregateId)) pins.set(aggregateId, role);
	};
	pin(current.pwaId, 'your PWA');
	for (const policyId of FLOOR_POLICIES) pin(policyId, 'a floor review policy');
	for (const write of current.forkBase.writes()) {
		for (const { policyIds } of newlyReferencedAssurancePolicyIds(
			write.nextState as Record<string, unknown> | undefined,
			write.priorState as Record<string, unknown> | undefined
		)) {
			for (const policyId of policyIds) pin(policyId, 'a policy this draft newly references');
		}
	}
	for (const command of current.recordedCommands) {
		const validatorId = validatorNamedBy(command);
		if (validatorId !== undefined) pin(validatorId, 'the validator a recorded review names');
	}
	for (const aggregateId of writeSet(current)) pin(aggregateId, 'an object this draft writes');
	return pins;
}

/** Each pin at its revision at the fork's position, or held absent if it did not exist there. */
function declaredPreconditions(current: MutableAuthoringTurn): GuardPrecondition[] {
	return [...declaredPins(current).keys()].map((aggregateId) => {
		const expectedRevision = current.forkBase.revisionAt(aggregateId);
		return expectedRevision === undefined
			? { aggregateId, mustNotExist: true as const }
			: { aggregateId, expectedRevision };
	});
}

/**
 * The §5.1 groups. A key field must never change after its aggregate's birth, or "a member" would depend on when it
 * was read. G1 is the draft's conversation, including a FIRST one another writer creates; G2 is any birth, edit or
 * removal of the PWA's types, NOT resting on the PWA's version bump; G3 is the review records a canonical reader
 * ranks per floor policy, which this draft's commit writes into; G4 is a reviewer's exchange about the PWA — kept by
 * ruling (`REG-D-070` Q2) until `REG-F-433`'s join key lets it go.
 */
function declaredGroups(pwaId: string): DependencyGroup[] {
	return [
		{
			name: 'your PWA’s conversation',
			aggregateType: 'AUTHORING_CONVERSATION',
			key: [{ field: 'pwaId', equals: pwaId }]
		},
		{
			name: 'a type of your PWA',
			aggregateType: 'PWU_TYPE',
			key: [{ field: 'pwaId', equals: pwaId }]
		},
		{
			name: 'your PWA’s review record under a floor policy',
			aggregateType: 'ASSURANCE_ASSESSMENT',
			key: [
				{ field: 'subjectObjectIds', contains: pwaId },
				{ field: 'assurancePolicyId', oneOf: FLOOR_POLICIES }
			]
		},
		{
			name: 'a reviewer exchange about your PWA',
			aggregateType: 'MODEL_EXCHANGE',
			key: [{ field: 'subjectObjectId', equals: pwaId }]
		}
	];
}

/** A draft's declared dependencies as its commit will check them — each pin with its role, and the groups. */
export interface DeclaredDependencies {
	readonly mark: number;
	readonly pins: readonly (GuardPrecondition & { readonly role: PinRole })[];
	readonly groups: readonly DependencyGroup[];
}

/**
 * What an active draft depends on, read-only: the instrument for anything that must check the declaration itself —
 * the pins a scenario earned, and (`DD-6`) whether every by-id read a turn makes is pinned, grouped or advisory.
 */
export function declaredDependenciesOf(turn: AuthoringTurn): DeclaredDependencies {
	const current = mutable(turn);
	const roles = declaredPins(current);
	return {
		mark: current.forkBase.mark,
		pins: declaredPreconditions(current).map((pin) => ({
			...pin,
			role: roles.get(pin.aggregateId)!
		})),
		groups: declaredGroups(current.pwaId)
	};
}

const revisionText = (revision: number | undefined) =>
	revision === undefined ? 'absent' : `revision ${String(revision)}`;

/**
 * ⭑ EVERY CHANGE, WITH ITS ROLE, AND WHAT CHANGED IT (§5.4, FORK-22). A professional told one of three changes
 * discards, reloads and is refused again, so every violation is named — past FORK-22's minimum, and in place of the
 * pseudo-aggregate `@event-log` that told nobody what moved.
 */
function disclose(
	violations: readonly DependencyViolation[],
	roles: ReadonlyMap<string, PinRole>
): string {
	const items = violations.map((violation) => {
		const by = violation.event
			? ` by ${violation.event.eventType} (actor ${violation.event.actorId}, correlation ${violation.event.correlationId})`
			: '';
		if (violation.kind === 'PIN')
			return (
				`${roles.get(violation.aggregateId) ?? 'a pinned object'} ${violation.aggregateId} is at ` +
				`${revisionText(violation.actualRevision)}, not ${revisionText(violation.expectedRevision)}`
			);
		if (violation.kind === 'GROUP')
			return `${violation.name} ${violation.aggregateId} was changed${by}`;
		return (
			`${violation.name}: ${violation.aggregateId} could not be checked (${violation.detail ?? 'unreadable'}), ` +
			`so it is treated as changed${by}`
		);
	});
	return `Changed since this draft began: ${items.join('; ')}.`;
}

/**
 * Classify a failed guarded canonical batch, record the detail, and transition. A declared dependency that changed is
 * a CONFLICT (PER-4: reload and re-form). Anything else — a replay the handlers refused, or one that diverged from the
 * candidate — happened while everything the draft declares HELD, so it is a gap in the rule, not a conflict, and is
 * said so loudly (§5.4).
 */
function recordCommitFailure(
	current: MutableAuthoringTurn,
	candidateHash: string,
	result: GuardedBatchResult,
	roles: ReadonlyMap<string, PinRole>
): CommitAuthoringTurnResult {
	const violations = result.dependencyViolations ?? [];
	if (violations.length > 0) {
		const detail = disclose(violations, roles);
		current.detail = detail;
		transition(current, { type: 'CONFLICT' }, 'CONFLICTED');
		return { ok: false, status: 'CONFLICTED', candidateHash, detail };
	}
	const rejected =
		result.failedIndex === undefined ? undefined : result.results[result.failedIndex];
	const refusal = result.postconditionConflict
		? `the replay of ${result.postconditionConflict.aggregateId} diverged from the candidate and was rolled back`
		: (rejected?.error?.message ??
			`command ${String(result.failedIndex ?? 'unknown')} was ${rejected?.status ?? 'refused'}`);
	const detail =
		'The save step refused this draft although nothing it declares it depends on changed — a gap in the ' +
		`dependency rule (REG-D-070), not a conflict. The refusal: ${refusal}`;
	current.detail = detail;
	transition(current, { type: 'COMMIT_ERROR' }, 'COMMIT_FAILED');
	return { ok: false, status: 'COMMIT_FAILED', candidateHash, detail };
}

/**
 * A human accepts the exact preview hash. The engine then checks every declared dependency and the expected resultant
 * object hashes inside the same transaction as the replay. Any conflict/rejection/divergence leaves canonical state
 * unchanged.
 */
export function commitAuthoringTurn(
	turn: AuthoringTurn,
	acceptedCandidateHash: string
): CommitAuthoringTurnResult {
	const current = mutable(turn);
	const candidateHash = assertReadyToCommit(turn, current, acceptedCandidateHash);
	transition(current, { type: 'COMMIT' }, 'COMMITTING');

	const { affectedObjects } = candidateArtifacts(current);
	const roles = declaredPins(current);

	let result;
	try {
		result = current.canonical.dispatchBatchGuarded(
			current.recordedCommands,
			declaredPreconditions(current),
			// Refused only by a change to something declared; the turn's own witnessed tries are admitted by id.
			{
				mark: current.forkBase.mark,
				admittedEventIds: [...current.witnessedEventIds],
				groups: declaredGroups(current.pwaId)
			},
			affectedObjects.map(({ id: aggregateId, contentHash: expectedContentHash }) => ({
				aggregateId,
				expectedContentHash
			}))
		);
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		current.detail = detail;
		transition(current, { type: 'COMMIT_ERROR' }, 'COMMIT_FAILED');
		return { ok: false, status: 'COMMIT_FAILED', candidateHash, detail };
	}

	if (!result.ok) return recordCommitFailure(current, candidateHash, result, roles);

	// Canonical state is committed at this point. Projection delivery/cleanup failure must never turn this into a
	// retryable COMMIT_FAILED state and accidentally replay an already-successful turn.
	transition(current, { type: 'COMMIT_OK' }, 'COMMITTED');
	try {
		current.canonical.drainOutbox();
	} catch (error) {
		current.detail = `Committed; outbox drain needs retry: ${error instanceof Error ? error.message : String(error)}`;
	}
	try {
		current.engine.close();
	} catch {
		// Candidate cleanup cannot change the already-committed disposition.
	}
	current.actor.stop();
	turnsByPwa.delete(current.pwaId);
	return { ok: true, candidateHash, commandCount: current.recordedCommands.length };
}

/** Discard an uncommitted overlay. No compensating Command is needed because canonical state never changed. */
export function discardAuthoringTurn(pwaId: string): boolean {
	const turn = turnsByPwa.get(pwaId);
	if (!turn) return false;
	if (stateOf(turn) === 'COMMITTING')
		throw new Error('A candidate cannot be discarded during commit.');
	if (stateOf(turn) !== 'DISCARDED') transition(turn, { type: 'DISCARD' }, 'DISCARDED');
	try {
		turn.engine.close();
	} finally {
		turn.actor.stop();
		turnsByPwa.delete(pwaId);
	}
	return true;
}

export function getPendingAuthoringTurn(pwaId: string): AuthoringTurn | undefined {
	const turn = turnsByPwa.get(pwaId);
	return turn ? publicTurn(turn) : undefined;
}

export function summarizeAuthoringTurn(turn: AuthoringTurn): AuthoringTurnSummary {
	return {
		id: turn.id,
		status: turn.status,
		candidateHash: turn.candidateHash,
		assuredSubjectHash: turn.assuredSubjectHash,
		commandCount: turn.commands.length,
		createdAt: turn.createdAt,
		canonicalUnchanged: true
	};
}

/** Test/reset seam: abandon every process-local overlay before replacing the canonical engine. */
export function clearAuthoringTurns(): void {
	for (const pwaId of [...turnsByPwa.keys()]) discardAuthoringTurn(pwaId);
}
