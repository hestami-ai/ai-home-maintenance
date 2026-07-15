// The full authorable Assurance Policy lifecycle (guide §8.9 / §17): create -> edit-in-place -> suspend/activate ->
// supersede, plus the LOCK on the de minimis floor policies (§8.4 / INV-5) — they can be created (seed) but never
// edited, suspended, or superseded. Drives the handlers LIVE through the engine.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-12T00:00:00Z';
const actor = { actorId: 'gov-1', actorType: 'HUMAN' as const, displayName: 'Governor' };
const POLICY = 'ASSURANCE_POLICY';

describe('Assurance Policy lifecycle handlers (live)', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ store, now: () => TS, newEventId: () => `e${++seq}` });
	});

	function d(commandType: string, payload: unknown, id: string) {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: POLICY,
			targetAggregateId: id,
			issuedAt: TS,
			issuedBy: actor,
			correlationId: 'corr',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	}
	const status = (id: string) => (store.loadObject(id)?.state as { status: string }).status;

	function create(id: string, name = 'Test Policy') {
		return d(
			'CreateAssurancePolicy',
			{
				policyId: id,
				version: '1.0.0',
				name,
				purpose: 'p',
				rationale: 'r',
				applicableObjectTypes: 'PROFESSIONAL_WORK_UNIT',
				evaluatedClaimTypes: 'CORRECTNESS',
				criteria: [{ id: 'C-01', statement: 's', mandatory: true }],
				evaluatorRole: 'reviewer',
				independenceRequirement: 'DIFFERENT_AGENT',
				findingDefinitions: [{ code: 'F-01', severity: 'MATERIAL', statement: 's' }],
				permittedControlActions: 'CLARIFY'
			},
			id
		);
	}

	it('create -> edit in place -> suspend -> activate -> supersede', () => {
		const P = 'pol_test_01';
		expect(create(P).status).toBe('ACCEPTED');
		expect(status(P)).toBe('ACTIVE');

		// Edit only the payload-present fields; revision bumps, version (content version string) is unchanged.
		expect(d('EditAssurancePolicy', { policyId: P, name: 'Renamed', purpose: 'p2' }, P).status).toBe(
			'ACCEPTED'
		);
		const edited = store.loadObject(P)!.state as Record<string, unknown>;
		expect(edited.name).toBe('Renamed');
		expect(edited.purpose).toBe('p2');
		expect(edited.revision).toBe(1);

		expect(d('SuspendAssurancePolicy', { policyId: P }, P).status).toBe('ACCEPTED');
		expect(status(P)).toBe('SUSPENDED');
		expect(d('ActivateAssurancePolicy', { policyId: P }, P).status).toBe('ACCEPTED');
		expect(status(P)).toBe('ACTIVE');

		// Supersede by a successor: status -> SUPERSEDED, and the successor id is recorded as a tag.
		const SUCC = 'pol_test_01_v2';
		expect(create(SUCC, 'Test Policy v2').status).toBe('ACCEPTED');
		expect(
			d('SupersedeAssurancePolicy', { policyId: P, supersededByPolicyId: SUCC }, P).status
		).toBe('ACCEPTED');
		expect(status(P)).toBe('SUPERSEDED');
		const tags = (store.loadObject(P)!.state as { tags?: string[] }).tags ?? [];
		expect(tags.some((t) => t.includes(SUCC))).toBe(true);

		// A SUPERSEDED policy cannot be edited any further.
		expect(d('EditAssurancePolicy', { policyId: P, name: 'nope' }, P).status).not.toBe('ACCEPTED');
	});

	it('locks the de minimis floor policies: they reject edit / suspend / supersede', () => {
		const FLOOR = 'floor.reasoning-review';
		expect(create(FLOOR, 'Reasoning Review').status).toBe('ACCEPTED');
		expect(d('EditAssurancePolicy', { policyId: FLOOR, name: 'x' }, FLOOR).status).not.toBe(
			'ACCEPTED'
		);
		expect(d('SuspendAssurancePolicy', { policyId: FLOOR }, FLOOR).status).not.toBe('ACCEPTED');
		expect(d('SupersedeAssurancePolicy', { policyId: FLOOR }, FLOOR).status).not.toBe('ACCEPTED');
		// It stays ACTIVE and untouched.
		expect(status(FLOOR)).toBe('ACTIVE');
		expect((store.loadObject(FLOOR)!.state as { name?: string }).name).toBe('Reasoning Review');
	});
});
