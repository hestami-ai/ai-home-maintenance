import type { DomainCommand } from '@janumipwb/rph-contracts';
import {
	createEngine,
	getConversation,
	listPwuTypes,
	type EngineHandle
} from '@janumipwb/rph-engine';
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

describe('isolated authoring turn and guarded commit', () => {
	let engine: EngineHandle;
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
			issuedBy: { actorId: 'setup', actorType: 'HUMAN', displayName: 'Setup' },
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

	beforeEach(() => {
		sequence = 0;
		engine = createEngine({
			ontology,
			now: () => TS,
			newEventId: () => `evt_${++sequence}`
		});
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
		const turn = beginAuthoringTurn(PWA, engine);
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

		const turn = beginAuthoringTurn(PWA, engine);
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
		const turn = beginAuthoringTurn(PWA, engine);
		expect(turn.broker.defineType({ name: 'Plan', pwuKind: 'PLAN', isRoot: true }).ok).toBe(true);
		const candidateHash = markAuthoringTurnAssured(turn, markAuthoringTurnValid(turn));
		expect(() => commitAuthoringTurn(turn, `${candidateHash}-stale`)).toThrow(
			/Acceptance hash does not match/
		);
		expect(turn.status).toBe('READY_TO_COMMIT');
		expect(listPwuTypes(engine, PWA)).toEqual([]);
	});

	it('closes mutation after assurance so unreviewed commands cannot enter the accepted package', () => {
		const turn = beginAuthoringTurn(PWA, engine);
		expect(turn.broker.defineType({ name: 'Plan', pwuKind: 'PLAN', isRoot: true }).ok).toBe(true);
		markAuthoringTurnAssured(turn, markAuthoringTurnValid(turn));
		expect(() => turn.broker.defineType({ name: 'Unreviewed', pwuKind: 'BUILD' })).toThrow(
			/Candidate mutation is closed/
		);
		expect(turn.commands).toHaveLength(1);
	});

	it('detects a concurrent canonical revision and lands none of the candidate commands', () => {
		const turn = beginAuthoringTurn(PWA, engine);
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
		expect(turn.status).toBe('CONFLICTED');
		expect(listPwuTypes(engine, PWA)).toEqual([]);
		expect(engine.readAllEvents()).toHaveLength(beforeCommitEvents);
	});

	it('discards an isolated candidate without compensation or canonical mutation', () => {
		const before = engine.readAllEvents();
		const turn = beginAuthoringTurn(PWA, engine);
		expect(turn.broker.defineType({ name: 'Wrong node', pwuKind: 'PLAN', isRoot: true }).ok).toBe(
			true
		);
		expect(discardAuthoringTurn(PWA)).toBe(true);
		expect(engine.readAllEvents()).toEqual(before);
		expect(listPwuTypes(engine, PWA)).toEqual([]);
	});
});
