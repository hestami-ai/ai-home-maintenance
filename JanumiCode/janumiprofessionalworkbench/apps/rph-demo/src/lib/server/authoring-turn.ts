import type { DomainCommand } from '@janumipwb/rph-contracts';
import { contentHash } from '@janumipwb/rph-contracts/hash';
import type { PwaAuthoringBroker } from '@janumipwb/rph-authoring';
import {
	getConversation,
	listAssurancePolicies,
	listPwuTypes,
	type EngineHandle
} from '@janumipwb/rph-engine';
import { createActor } from 'xstate';
import { authoringTurnMachine, type AuthoringTurnState } from '$lib/server/authoring-turn-machine';
import { getEngine, makeAuthoringBroker, mintUiId } from '$lib/server/workbench';

type TurnActor = ReturnType<typeof newTurnActor>;

interface RevisionSnapshot {
	readonly revisions: ReadonlyMap<string, number>;
	/** Conservative whole-store position: it detects a concurrent new aggregate that is absent from the vector. */
	readonly eventCount: number;
}

/**
 * One in-process natural-language authoring candidate. `engine` is a point-in-time fork: every agent tool,
 * transcript write, and assurance Command exercises production handlers while canonical state remains unchanged.
 */
export interface AuthoringTurn {
	readonly id: string;
	readonly pwaId: string;
	readonly engine: EngineHandle;
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
	readonly canonical: EngineHandle;
	readonly engine: EngineHandle;
	readonly broker: PwaAuthoringBroker;
	readonly createdAt: string;
	readonly recordedCommands: DomainCommand[];
	readonly base: RevisionSnapshot;
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

function newTurnActor() {
	return createActor(authoringTurnMachine).start();
}

function stateOf(turn: MutableAuthoringTurn): AuthoringTurnState {
	return String(turn.actor.getSnapshot().value) as AuthoringTurnState;
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

function snapshotRevisions(snapshot: EngineHandle, pwaId: string): RevisionSnapshot {
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

/** Record only mutations that really exist in the isolated fork. Failed commands and rolled-back batches never
 * enter the replay log. Any accepted mutation invalidates cached assurance/acceptance bindings. */
function recordingEngine(
	delegate: EngineHandle,
	commands: DomainCommand[],
	currentTurn: () => MutableAuthoringTurn
): EngineHandle {
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
	return {
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
}

/** Begin an isolated candidate. There may be only one pending natural-language turn per PWA in this process. */
export function beginAuthoringTurn(
	pwaId: string,
	canonical: EngineHandle = getEngine()
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
		actor: newTurnActor()
	};
	turnRef.current = turn;
	turnsByPwa.set(pwaId, turn);
	return publicTurn(turn);
}

function mutable(turn: AuthoringTurn): MutableAuthoringTurn {
	const current = turnsByPwa.get(turn.pwaId);
	if (!current || current.id !== turn.id)
		throw new Error(`Authoring turn ${turn.id} is not active.`);
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
	].sort();
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

/**
 * A human accepts the exact preview hash. The engine then checks the revision vector and expected resultant object
 * hashes inside the same transaction as replay. Any conflict/rejection/divergence leaves canonical state unchanged.
 */
export function commitAuthoringTurn(
	turn: AuthoringTurn,
	acceptedCandidateHash: string
): CommitAuthoringTurnResult {
	const current = mutable(turn);
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
	transition(current, { type: 'COMMIT' }, 'COMMITTING');

	const preconditions = new Map<string, number | undefined>(current.base.revisions);
	for (const targetId of current.recordedCommands.map((command) => command.targetAggregateId)) {
		if (!preconditions.has(targetId)) preconditions.set(targetId, undefined);
	}
	const { affectedIds, affectedObjects } = candidateArtifacts(current);
	for (const id of affectedIds) {
		if (!preconditions.has(id)) preconditions.set(id, undefined);
	}

	let result;
	try {
		result = current.canonical.dispatchBatchGuarded(
			current.recordedCommands,
			[...preconditions].map(([aggregateId, expectedRevision]) =>
				expectedRevision === undefined
					? { aggregateId, mustNotExist: true as const }
					: { aggregateId, expectedRevision }
			),
			current.base.eventCount,
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

	if (!result.ok) {
		const rejected =
			result.failedIndex === undefined ? undefined : result.results[result.failedIndex];
		const conflict =
			result.guardConflict ?? (rejected?.status === 'CONFLICT' ? rejected : undefined);
		if (conflict) {
			const detail = result.guardConflict
				? `${result.guardConflict.aggregateId} changed from revision ${String(result.guardConflict.expectedRevision)} to ${String(result.guardConflict.actualRevision)}.`
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
