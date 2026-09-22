// ── WHY THIS FILE USES THE DEMO'S OWN AUTHENTICATOR AND NOT THE SHARED TEST FIXTURE ─────────────────────────
// D-1 moved the acting identity out of the command envelope and behind `engine.as(credential)`. The production
// code this suite drives NAMES ITS OWN CREDENTIALS: `makeAuthoringBroker` opens `engine.as(AGENT_CREDENTIAL)`
// and `recordConversation` opens `engine.as(SESSION_CREDENTIAL)`, both imported from `./identity.ts`. A
// `testAuthenticator()`/`testDirectory()` engine resolves NEITHER token — those fixtures mint their own opaque
// credentials — so every broker call and every transcript write would come back UNAUTHORIZED and this suite
// would be testing the refusal path instead of the authoring turn. `standaloneAuthenticator()` is the demo's
// own CLOSED directory (unknown credential ⇒ `{ ok: false }`, never a default), so nothing is weakened by
// using it: it is the same gate the running app passes through.
//
// TWO ACTORS, AND THE SPLIT IS LOAD-BEARING FOR THE COMMIT.
//   • SESSION_CREDENTIAL (HUMAN `local-professional`) — the canonical setup dispatches and every read below.
//   • AGENT_CREDENTIAL  (AGENT `jpwb-authoring-agent`) — the turn's CANONICAL handle, mirroring
//     `beginAuthoringTurn`'s own default (`getEngine().as(AGENT_CREDENTIAL)`).
// The turn's canonical handle must be the AGENT because `commitAuthoringTurn` REPLAYS the broker's recorded
// commands through it, and those commands still declare `issuedBy: { jpwb-authoring-agent, AGENT }`
// (`PwaAuthoringBroker`'s default `actor`). Replaying them through the human session would be a declared-issuer
// DISAGREEMENT and the engine would refuse the batch — so handing the turn a human canonical here would produce
// a red that says nothing about authoring.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import {
	createEngine,
	getConversation,
	listByType,
	listPwuTypes,
	type AuthedEngineHandle,
	type EngineHandle
} from '@janumipwb/rph-engine';
import { AGENT_CREDENTIAL, SESSION_CREDENTIAL, standaloneAuthenticator } from './identity.js';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { StoreBusyError } from '@janumipwb/rph-ports';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	beginAuthoringTurn,
	clearAuthoringTurns,
	commitAuthoringTurn,
	discardAuthoringTurn,
	markAuthoringTurnAssured,
	markAuthoringTurnValid
} from './authoring-turn.js';
import { recordConversation } from './workbench.js';

const TS = '2026-07-18T12:00:00Z';
const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5P00';
const OTHER_PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5P03';

describe('isolated authoring turn and guarded commit', () => {
	/** The UNAUTHENTICATED host, kept so each caller can open the session that matches WHO IT IS. */
	let host: EngineHandle;
	/** The canonical store itself — held only to play a writer that bypasses the command handlers. */
	let store: SqliteStorageAdapter;
	/** The workbench human's session: canonical setup + every assertion read below. */
	let engine: AuthedEngineHandle;
	let sequence: number;

	function command(
		commandType: string,
		targetAggregateType: string,
		targetAggregateId: string,
		payload: unknown
	): DomainCommand {
		sequence += 1;
		return {
			commandId: `setup-${sequence}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType,
			targetAggregateId,
			issuedAt: TS,
			correlationId: 'setup',
			idempotencyKey: `setup-idem-${sequence}`,
			payload
		};
	}

	function dispatch(
		commandType: string,
		targetAggregateType: string,
		targetAggregateId: string,
		payload: unknown
	) {
		return engine.dispatch(command(commandType, targetAggregateType, targetAggregateId, payload));
	}

	/** The turn's canonical handle — the AGENT, for the replay reason in the header note. */
	const beginTurn = () => beginAuthoringTurn(PWA, host.as(AGENT_CREDENTIAL));

	beforeEach(() => {
		sequence = 0;
		store = new SqliteStorageAdapter({ now: () => TS });
		host = createEngine({
			store,
			authenticate: standaloneAuthenticator(),
			ontology,
			now: () => TS,
			newEventId: () => `evt_${++sequence}`
		});
		engine = host.as(SESSION_CREDENTIAL);
		expect(
			dispatch('CreatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', PWA, {
				pwaId: PWA,
				name: 'SDLC PWA',
				description: 'Software delivery',
				domain: 'software',
				version: '1.0.0'
			}).status
		).toBe('ACCEPTED');
	});

	afterEach(() => {
		clearAuthoringTurns();
		engine.close();
	});

	it('keeps tools, transcript, and assurance candidate-only until exact human acceptance', () => {
		const beforeEvents = engine.readAllEvents().length;
		const turn = beginTurn();
		const defined = turn.broker.defineType({
			name: 'Full SDLC',
			pwuKind: 'SOFTWARE_DELIVERY',
			purpose: 'Govern the complete lifecycle',
			isRoot: true,
			requiredInputs: ['product-intent'],
			requiredOutputs: ['released-product']
		});
		expect(defined.ok, defined.error).toBe(true);
		const reviewedSubjectHash = markAuthoringTurnValid(turn);
		recordConversation(
			PWA,
			[
				{ role: 'USER', kind: 'message', text: 'Create the full SDLC.' },
				{ role: 'AGENT', kind: 'tool_result', text: 'Defined Full SDLC', success: true }
			],
			turn.engine,
			turn.id
		);
		const candidateHash = markAuthoringTurnAssured(turn, reviewedSubjectHash);

		expect(listPwuTypes(engine, PWA)).toEqual([]);
		expect(getConversation(engine, PWA)).toBeUndefined();
		expect(engine.readAllEvents()).toHaveLength(beforeEvents);
		expect(listPwuTypes(turn.engine, PWA)).toHaveLength(1);
		expect(getConversation(turn.engine, PWA)?.state.entries).toHaveLength(2);

		const committed = commitAuthoringTurn(turn, candidateHash);
		expect(committed.ok).toBe(true);
		expect(listPwuTypes(engine, PWA).map((type) => type.state.name)).toEqual(['Full SDLC']);
		expect(getConversation(engine, PWA)?.state.entries).toHaveLength(2);
	});

	it('replays sequential PWU edits and their shared PWA version bumps to candidate-equivalent state', () => {
		const firstId = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5P01';
		const secondId = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5P02';
		for (const [id, name] of [
			[firstId, 'Discovery'],
			[secondId, 'Delivery']
		] as const) {
			expect(
				dispatch('DefinePwuType', 'PWU_TYPE', id, {
					pwuTypeId: id,
					pwaId: PWA,
					pwuKind: name.toUpperCase(),
					name,
					purpose: name,
					isRoot: name === 'Discovery',
					permittedChildTypeIds: [],
					requiredInputs: [],
					requiredOutputs: [],
					requiredAssurancePolicyIds: []
				}).status
			).toBe('ACCEPTED');
		}

		const turn = beginTurn();
		expect(turn.broker.editType(firstId, { purpose: 'Understand the governed intent' }).ok).toBe(
			true
		);
		expect(turn.broker.editType(secondId, { purpose: 'Build and release safely' }).ok).toBe(true);
		const subjectHash = markAuthoringTurnValid(turn);
		const candidateHash = markAuthoringTurnAssured(turn, subjectHash);
		const expected = [PWA, firstId, secondId].map((id) => turn.engine.loadObject(id));

		expect(commitAuthoringTurn(turn, candidateHash).ok).toBe(true);
		expect([PWA, firstId, secondId].map((id) => engine.loadObject(id))).toEqual(expected);
	});

	it('rejects a stale acceptance hash before entering COMMITTING', () => {
		const turn = beginTurn();
		expect(turn.broker.defineType({ name: 'Plan', pwuKind: 'PLAN', isRoot: true }).ok).toBe(true);
		const candidateHash = markAuthoringTurnAssured(turn, markAuthoringTurnValid(turn));
		expect(() => commitAuthoringTurn(turn, `${candidateHash}-stale`)).toThrow(
			/Acceptance hash does not match/
		);
		expect(turn.status).toBe('READY_TO_COMMIT');
		expect(listPwuTypes(engine, PWA)).toEqual([]);
	});

	it('closes mutation after assurance so unreviewed commands cannot enter the accepted package', () => {
		const turn = beginTurn();
		expect(turn.broker.defineType({ name: 'Plan', pwuKind: 'PLAN', isRoot: true }).ok).toBe(true);
		markAuthoringTurnAssured(turn, markAuthoringTurnValid(turn));
		expect(() => turn.broker.defineType({ name: 'Unreviewed', pwuKind: 'BUILD' })).toThrow(
			/Candidate mutation is closed/
		);
		expect(turn.commands).toHaveLength(1);
	});

	it('detects a concurrent canonical revision and lands none of the candidate commands', () => {
		const turn = beginTurn();
		expect(turn.broker.defineType({ name: 'Plan', pwuKind: 'PLAN', isRoot: true }).ok).toBe(true);
		const candidateHash = markAuthoringTurnAssured(turn, markAuthoringTurnValid(turn));
		expect(
			dispatch('EditPwa', 'PROFESSIONAL_WORK_ARCHITECTURE', PWA, {
				pwaId: PWA,
				name: 'Concurrent canonical edit'
			}).status
		).toBe('ACCEPTED');
		const beforeCommitEvents = engine.readAllEvents().length;

		const result = commitAuthoringTurn(turn, candidateHash);
		expect(result).toMatchObject({ ok: false, status: 'CONFLICTED' });
		expect(result.ok ? '' : result.detail).toBe(
			`Changed since this draft began: your PWA ${PWA} is at revision 1, not revision 0.`
		);
		expect(turn.status).toBe('CONFLICTED');
		expect(listPwuTypes(engine, PWA)).toEqual([]);
		expect(engine.readAllEvents()).toHaveLength(beforeCommitEvents);
	});

	// ⭐ G1 — THE PWA'S CONVERSATION, INCLUDING A FIRST ONE (`JAN-CRITREAD` `DD-3`, `REG-D-070`; this was the whole-log
	// limb's own job, `TT-0`). A second writer creates the PWA's FIRST conversation on canonical while the turn records
	// its own on the fork. Nothing pins an ABSENT conversation — the turn's own is a new id, and the PWA is untouched —
	// so only the declared group can refuse, and without it the commit lands TWO conversations for one PWA. The refusal
	// names the group's role, the conversation, and the act that created it.
	it('PR-2 — a concurrent first conversation is refused by G1, naming the conversation and what created it', () => {
		expect(
			getConversation(engine, PWA),
			'precondition: no conversation exists to be pinned'
		).toBeUndefined();
		const turn = beginTurn();
		expect(turn.broker.defineType({ name: 'Plan', pwuKind: 'PLAN', isRoot: true }).ok).toBe(true);
		const subjectHash = markAuthoringTurnValid(turn);
		recordConversation(
			PWA,
			[{ role: 'USER', kind: 'message', text: 'Author the plan.' }],
			turn.engine,
			turn.id
		);
		const candidateHash = markAuthoringTurnAssured(turn, subjectHash);
		const pwaRevision = engine.loadObject(PWA)?.revision;

		recordConversation(
			PWA,
			[{ role: 'USER', kind: 'message', text: 'A second writer, elsewhere.' }],
			engine,
			'other-writer'
		);
		const phantom = getConversation(engine, PWA);
		expect(phantom, 'the concurrent writer created a conversation').toBeDefined();
		expect(phantom!.id, 'the phantom is NOT the id the turn will commit').not.toBe(
			getConversation(turn.engine, PWA)!.id
		);
		expect(engine.loadObject(PWA)?.revision, 'the PWA pin has nothing to see').toBe(pwaRevision);
		const beforeCommitEvents = engine.readAllEvents().length;

		const result = commitAuthoringTurn(turn, candidateHash);

		expect(result).toMatchObject({ ok: false, status: 'CONFLICTED' });
		expect(result.ok ? '' : result.detail).toBe(
			`Changed since this draft began: your PWA’s conversation ${phantom!.id} was changed by ` +
				`ConversationEntriesAppended (actor ${engine.principal!.actorId}, correlation other-writer).`
		);
		expect(listByType(engine, 'AUTHORING_CONVERSATION'), 'one PWA, one conversation').toHaveLength(
			1
		);
		expect(listPwuTypes(engine, PWA)).toEqual([]);
		expect(engine.readAllEvents()).toHaveLength(beforeCommitEvents);
	});

	// ⭐ G2 — ANY BIRTH, EDIT OR REMOVAL OF THE PWA'S TYPES, NOT RESTING ON THE PWA'S VERSION BUMP (§5.1, job (c)).
	// Every type command today ALSO bumps the PWA, so the PWA pin sees it too — but that bump is recorded as violating
	// AGG-1 (`REG-F-046`) and may go. A writer that births a type WITHOUT the bump is played here by committing straight
	// to the store, so the PWA's revision cannot move and only G2 can refuse.
	it('G2 — a type born for the PWA by a writer that does not bump it is refused, naming the type', () => {
		const turn = beginTurn();
		expect(turn.broker.defineType({ name: 'Plan', pwuKind: 'PLAN', isRoot: true }).ok).toBe(true);
		const candidateHash = markAuthoringTurnAssured(turn, markAuthoringTurnValid(turn));
		const pwaRevision = engine.loadObject(PWA)?.revision;
		const latent = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5P09';
		const committed = store.commit({
			aggregateType: 'PWU_TYPE',
			aggregateId: latent,
			objectType: 'PWU_TYPE',
			expectedRevision: undefined,
			newRevision: 0,
			newSemanticVersion: 1,
			currentState: { id: latent, pwaId: PWA, name: 'Born without the bump' },
			events: [
				{
					eventId: 'evt_latent',
					eventType: 'PwuTypeDefined',
					eventSchemaVersion: 1,
					aggregateType: 'PWU_TYPE',
					aggregateId: latent,
					aggregateRevision: 0,
					occurredAt: TS,
					recordedAt: TS,
					actor: { actorId: 'latent-writer', actorType: 'SERVICE', displayName: 'No bump' },
					correlationId: 'latent',
					payload: {}
				}
			],
			receipt: {
				commandId: 'latent',
				idempotencyKey: 'latent',
				commandType: 'DefinePwuType',
				targetAggregateId: latent,
				status: 'ACCEPTED',
				producedEventIds: ['evt_latent']
			}
		});
		expect(committed.ok, 'arrangement: the latent writer committed').toBe(true);
		expect(engine.loadObject(PWA)?.revision, 'the PWA pin has nothing to see').toBe(pwaRevision);

		const result = commitAuthoringTurn(turn, candidateHash);

		expect(result).toMatchObject({ ok: false, status: 'CONFLICTED' });
		expect(result.ok ? '' : result.detail).toBe(
			`Changed since this draft began: a type of your PWA ${latent} was changed by PwuTypeDefined ` +
				'(actor latent-writer, correlation latent).'
		);
		expect(listPwuTypes(engine, PWA).map((type) => type.id)).toEqual([latent]);
	});

	// ⭐ THE WRITE SET (§5.1 pin 5): every aggregate the draft writes, held at its revision at the fork or held ABSENT.
	// A group cannot see an object that is not its member — here the draft's own NEW conversation id, taken on
	// canonical by another writer for ANOTHER PWA, so G1 (keyed on this PWA) does not match it. Only the pin can name
	// it; without the pin the replay's own append meets a stranger's object and the draft is lost as COMMIT_FAILED.
	it('the write set — an object the draft creates, taken by another writer under the same id, is refused by name', () => {
		expect(
			dispatch('CreatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', OTHER_PWA, {
				pwaId: OTHER_PWA,
				name: 'Another PWA',
				description: 'Another professional’s',
				domain: 'software',
				version: '1.0.0'
			}).status
		).toBe('ACCEPTED');
		const turn = beginTurn();
		expect(turn.broker.defineType({ name: 'Plan', pwuKind: 'PLAN', isRoot: true }).ok).toBe(true);
		const subjectHash = markAuthoringTurnValid(turn);
		recordConversation(
			PWA,
			[{ role: 'USER', kind: 'message', text: 'Author the plan.' }],
			turn.engine,
			turn.id
		);
		const candidateHash = markAuthoringTurnAssured(turn, subjectHash);
		const mine = getConversation(turn.engine, PWA)!.id;
		expect(
			dispatch('AppendConversationEntries', 'AUTHORING_CONVERSATION', mine, {
				conversationId: mine,
				pwaId: OTHER_PWA,
				entries: [{ role: 'USER', kind: 'message', text: 'The same id, for another PWA.' }]
			}).status,
			'arrangement: another writer took the id'
		).toBe('ACCEPTED');

		const result = commitAuthoringTurn(turn, candidateHash);

		expect(result).toMatchObject({ ok: false, status: 'CONFLICTED' });
		expect(result.ok ? '' : result.detail).toBe(
			`Changed since this draft began: an object this draft writes ${mine} is at revision 0, not absent.`
		);
	});

	// ⭐ A REFUSAL WHILE EVERYTHING DECLARED HELD IS A GAP IN THE RULE, SAID LOUDLY (§5.4). The replay also reads what
	// no rule declares — here the idempotency receipt of a recorded command (§3.1), claimed on canonical by another
	// writer under the same key for another target. Nothing the draft depends on changed, so this is not a conflict and
	// must not be presented as one; the draft is lost, and the refusal says the rule has a gap.
	it('a replay refused while every declared dependency held is COMMIT_FAILED, and says it is a gap in the rule', () => {
		const turn = beginTurn();
		expect(turn.broker.defineType({ name: 'Plan', pwuKind: 'PLAN', isRoot: true }).ok).toBe(true);
		const candidateHash = markAuthoringTurnAssured(turn, markAuthoringTurnValid(turn));
		const key = turn.commands[0]!.idempotencyKey;
		const stranger = 'scr_01ARZ3NDEKTSV4RRFFQ69G5P10';
		const committed = store.commit({
			aggregateType: 'SCRATCH',
			aggregateId: stranger,
			objectType: 'SCRATCH',
			expectedRevision: undefined,
			newRevision: 0,
			newSemanticVersion: 1,
			currentState: { id: stranger },
			events: [
				{
					eventId: 'evt_stranger',
					eventType: 'Scratched',
					eventSchemaVersion: 1,
					aggregateType: 'SCRATCH',
					aggregateId: stranger,
					aggregateRevision: 0,
					occurredAt: TS,
					recordedAt: TS,
					actor: { actorId: 'stranger', actorType: 'SERVICE', displayName: 'Another writer' },
					correlationId: 'stranger',
					payload: {}
				}
			],
			receipt: {
				commandId: 'stranger',
				idempotencyKey: key,
				commandType: 'DefinePwuType',
				targetAggregateId: stranger,
				status: 'ACCEPTED',
				producedEventIds: ['evt_stranger'],
				payloadHash: 'sha256:another-payload'
			}
		});
		expect(committed.ok, 'arrangement: the key is claimed on canonical').toBe(true);

		const result = commitAuthoringTurn(turn, candidateHash);

		expect(result).toMatchObject({ ok: false, status: 'COMMIT_FAILED' });
		const detail = result.ok ? '' : result.detail;
		expect(
			detail.startsWith(
				'The save step refused this draft although nothing it declares it depends on changed — a gap in the ' +
					'dependency rule (REG-D-070), not a conflict. The refusal: '
			),
			detail
		).toBe(true);
		expect(detail, 'the refusal is the replay’s own').toContain(key);
		expect(listPwuTypes(engine, PWA)).toEqual([]);
	});

	// ⭐ ONE PRINCIPAL PER TURN (`REG-D-070` §5.2). The replay runs every recorded command through the turn's ONE
	// canonical session; a command recorded under another identity would be replayed — and attributed — as the turn's.
	it('the recorder writes only under the turn’s own principal; a re-bound handle may read, never write', () => {
		const turn = beginTurn();
		const human = turn.engine.as(SESSION_CREDENTIAL);
		expect(human.loadObject(PWA), 'a re-bound handle reads').toBeDefined();
		const before = turn.engine.readAllEvents().length;
		const refusal =
			`An authoring turn records only its own principal's commands (${turn.engine.principal!.actorId}); this ` +
			`handle acts as ${engine.principal!.actorId}. Re-binding a turn's engine is for reading.`;
		const edit = (name: string) =>
			command('EditPwa', 'PROFESSIONAL_WORK_ARCHITECTURE', PWA, { pwaId: PWA, name });

		expect(() => human.dispatch(edit('By someone else'))).toThrow(refusal);
		expect(() => human.dispatchBatch([edit('By someone else, in a batch')])).toThrow(refusal);

		expect(turn.commands, 'nothing recorded').toHaveLength(0);
		expect(turn.engine.readAllEvents(), 'nothing written to the fork').toHaveLength(before);
		expect(
			turn.engine.as(AGENT_CREDENTIAL).dispatch(edit('By the turn')).status,
			'the turn’s own identity, re-bound, still writes'
		).toBe('ACCEPTED');
		expect(turn.commands).toHaveLength(1);
	});

	// ⭐ A BUSY STORE IS NOT A FAILED COMMIT (`REG-D-070` §5.4). Nothing was read or written, so the draft goes back to
	// READY_TO_COMMIT exactly as accepted — no automatic retry; the professional accepts again and every check re-runs.
	it('a store that cannot take its write lock returns the draft to READY_TO_COMMIT, and accepting again commits', () => {
		let busy = true;
		const agent = host.as(AGENT_CREDENTIAL);
		const canonical: AuthedEngineHandle = {
			...agent,
			dispatchBatchGuarded: (...args) => {
				if (busy) throw new StoreBusyError();
				return agent.dispatchBatchGuarded(...args);
			}
		};
		const turn = beginAuthoringTurn(PWA, canonical);
		expect(turn.broker.defineType({ name: 'Plan', pwuKind: 'PLAN', isRoot: true }).ok).toBe(true);
		const candidateHash = markAuthoringTurnAssured(turn, markAuthoringTurnValid(turn));

		const first = commitAuthoringTurn(turn, candidateHash);

		expect(first).toEqual({
			ok: false,
			status: 'READY_TO_COMMIT',
			code: 'RPH_STORE_BUSY',
			candidateHash,
			detail: new StoreBusyError().message
		});
		expect(turn.status).toBe('READY_TO_COMMIT');
		expect(listPwuTypes(engine, PWA), 'nothing was written').toEqual([]);

		busy = false;
		expect(commitAuthoringTurn(turn, candidateHash)).toMatchObject({ ok: true });
		expect(listPwuTypes(engine, PWA).map((type) => type.state.name)).toEqual(['Plan']);
	});

	// ⭐ A TURN'S CONVERSATION KEY IS THE TURN'S, NOT THE PROCESS'S (§3.1). The replay re-dispatches each append under
	// its original key; a process-wide counter restarts at 1 with the process and would meet an older receipt.
	it('a turn’s conversation appends carry turn-scoped keys, never the process-wide counter', () => {
		const turn = beginTurn();
		recordConversation(PWA, [{ role: 'USER', kind: 'message', text: 'one' }], turn.engine, turn.id);
		recordConversation(
			PWA,
			[{ role: 'AGENT', kind: 'message', text: 'two' }],
			turn.engine,
			turn.id
		);
		const conversationId = getConversation(turn.engine, PWA)!.id;

		expect(
			turn.commands
				.filter((recorded) => recorded.commandType === 'AppendConversationEntries')
				.map((recorded) => recorded.idempotencyKey)
		).toEqual([
			`${turn.id}:conversation:${conversationId}:0`,
			`${turn.id}:conversation:${conversationId}:1`
		]);
	});

	it('discards an isolated candidate without compensation or canonical mutation', () => {
		const before = engine.readAllEvents();
		const turn = beginTurn();
		expect(turn.broker.defineType({ name: 'Wrong node', pwuKind: 'PLAN', isRoot: true }).ok).toBe(
			true
		);
		expect(discardAuthoringTurn(PWA)).toBe(true);
		expect(engine.readAllEvents()).toEqual(before);
		expect(listPwuTypes(engine, PWA)).toEqual([]);
	});
});
