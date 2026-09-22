import type { DomainCommand } from '@janumipwb/rph-contracts';
import { contentHash } from '@janumipwb/rph-contracts/hash';
import type { PwaAuthoringBroker } from '@janumipwb/rph-authoring';
import {
	getConversation,
	listAssurancePolicies,
	listPwuTypes,
	type AuthedEngineHandle
} from '@janumipwb/rph-engine';
import { createActor } from 'xstate';
import { authoringTurnMachine, type AuthoringTurnState } from '$lib/server/authoring-turn-machine';
import { AGENT_CREDENTIAL } from './identity.js';
import { getEngine, makeAuthoringBroker, mintUiId } from '$lib/server/workbench';

type TurnActor = ReturnType<typeof newTurnActor>;

interface RevisionSnapshot {
	readonly revisions: ReadonlyMap<string, number>;
	/**
	 * Whole-store position at the fork. The commit guard admits the log's growth past it ONLY by the turn's own
	 * witnessed acts (`witnessedEventIds`), so it still detects a concurrent new aggregate the vector cannot name.
	 */
	readonly eventCount: number;
}

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
	readonly base: RevisionSnapshot;
	/**
	 * Canonical events this turn's OWN acts produced before acceptance — today only the exchange records its
	 * reviewer's tries write (PER-9). Never reset by a resume, exactly as `base` is not: every try across the
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

function snapshotRevisions(snapshot: AuthedEngineHandle, pwaId: string): RevisionSnapshot {
	const revisions = new Map<string, number>();
	const pwa = snapshot.loadObject(pwaId);
	if (!pwa) throw new Error(`PWA ${pwaId} does not exist.`);
	revisions.set(pwaId, pwa.revision);

	for (const type of listPwuTypes(snapshot, pwaId)) {
		const stored = snapshot.loadObject(type.id);
		if (stored) revisions.set(type.id, stored.revision);
	}
	// Policy status/criteria/independence are dependencies of type-reference validation and the assurance floor.
	for (const policy of listAssurancePolicies(snapshot)) {
		const stored = snapshot.loadObject(policy.id);
		if (stored) revisions.set(policy.id, stored.revision);
	}
	const conversation = getConversation(snapshot, pwaId);
	if (conversation) {
		const stored = snapshot.loadObject(conversation.id);
		if (stored) revisions.set(conversation.id, stored.revision);
	}

	return { revisions, eventCount: snapshot.readAllEvents().length };
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
		base: snapshotRevisions(isolated, pwaId),
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

function candidateArtifacts(turn: MutableAuthoringTurn) {
	const stagedEvents = turn.engine.readAllEvents().slice(turn.base.eventCount);
	const affectedIds = [
		...new Set([
			...turn.recordedCommands.map((command) => command.targetAggregateId),
			...stagedEvents.map((event) => event.aggregateId)
		])
	].sort((left, right) => Number(left > right) - Number(left < right));
	const affectedObjects = affectedIds.map((id) => {
		const object = turn.engine.loadObject(id);
		if (!object) throw new Error(`Candidate affected aggregate ${id} is missing.`);
		return { id, contentHash: contentHash(object) };
	});
	return { affectedIds, affectedObjects };
}

/** Bind a digest to the base vector, exact accepted command sequence, and resulting materialized object states. */
export function finalizeAuthoringTurn(turn: AuthoringTurn): string {
	const current = mutable(turn);
	const { affectedObjects } = candidateArtifacts(current);
	current.candidateHash = contentHash({
		pwaId: current.pwaId,
		base: {
			revisions: [...current.base.revisions]
				.map(([id, revision]) => ({ id, revision }))
				.sort((left, right) => left.id.localeCompare(right.id)),
			eventCount: current.base.eventCount
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

/** Build the revision guard vector: captured base revisions plus a mustNotExist guard for every touched aggregate. */
function commitGuardPreconditions(
	current: MutableAuthoringTurn,
	affectedIds: readonly string[]
): GuardPrecondition[] {
	const preconditions = new Map<string, number | undefined>(current.base.revisions);
	for (const targetId of current.recordedCommands.map((command) => command.targetAggregateId)) {
		if (!preconditions.has(targetId)) preconditions.set(targetId, undefined);
	}
	for (const id of affectedIds) {
		if (!preconditions.has(id)) preconditions.set(id, undefined);
	}
	return [...preconditions].map(([aggregateId, expectedRevision]) =>
		expectedRevision === undefined
			? { aggregateId, mustNotExist: true as const }
			: { aggregateId, expectedRevision }
	);
}

/** Classify a failed guarded canonical batch (revision conflict vs commit failure), record the detail, and transition. */
function recordCommitFailure(
	current: MutableAuthoringTurn,
	candidateHash: string,
	result: GuardedBatchResult
): CommitAuthoringTurnResult {
	const rejected =
		result.failedIndex === undefined ? undefined : result.results[result.failedIndex];
	const conflict = result.guardConflict ?? (rejected?.status === 'CONFLICT' ? rejected : undefined);
	if (conflict) {
		// The prefix is byte-identical to what it always was; the suffix names WHOSE act moved the log.
		const unadmitted = result.guardConflict?.unadmitted;
		const detail = result.guardConflict
			? `${result.guardConflict.aggregateId} changed from revision ${String(result.guardConflict.expectedRevision)} to ${String(result.guardConflict.actualRevision)}.` +
				(unadmitted
					? ` First unadmitted event: ${unadmitted.eventType} on ${unadmitted.aggregateType} ${unadmitted.aggregateId}.`
					: '')
			: (rejected?.error?.message ?? 'A replayed command observed a revision conflict.');
		current.detail = detail;
		transition(current, { type: 'CONFLICT' }, 'CONFLICTED');
		return { ok: false, status: 'CONFLICTED', candidateHash, detail };
	}
	const detail = result.postconditionConflict
		? `Canonical replay diverged for ${result.postconditionConflict.aggregateId}; the transaction was rolled back.`
		: (rejected?.error?.message ??
			`Canonical batch rejected at command ${String(result.failedIndex ?? 'unknown')}.`);
	current.detail = detail;
	transition(current, { type: 'COMMIT_ERROR' }, 'COMMIT_FAILED');
	return { ok: false, status: 'COMMIT_FAILED', candidateHash, detail };
}

/**
 * A human accepts the exact preview hash. The engine then checks the revision vector and expected resultant object
 * hashes inside the same transaction as replay. Any conflict/rejection/divergence leaves canonical state unchanged.
 */
export function commitAuthoringTurn(
	turn: AuthoringTurn,
	acceptedCandidateHash: string
): CommitAuthoringTurnResult {
	const current = mutable(turn);
	const candidateHash = assertReadyToCommit(turn, current, acceptedCandidateHash);
	transition(current, { type: 'COMMIT' }, 'COMMITTING');

	const { affectedIds, affectedObjects } = candidateArtifacts(current);
	const preconditions = commitGuardPreconditions(current, affectedIds);

	let result;
	try {
		result = current.canonical.dispatchBatchGuarded(
			current.recordedCommands,
			preconditions,
			// The log may have grown past the fork by exactly the turn's own witnessed acts — nothing else.
			{ position: current.base.eventCount, admittedEventIds: [...current.witnessedEventIds] },
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

	if (!result.ok) return recordCommitFailure(current, candidateHash, result);

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
