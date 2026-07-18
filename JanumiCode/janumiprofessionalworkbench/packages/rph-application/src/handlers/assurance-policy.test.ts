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

	function create(id: string, name = 'Test Policy', over: Record<string, unknown> = {}) {
		return d(
			'CreateAssurancePolicy',
			{
				policyId: id,
				version: '1.0.0',
				name,
				purpose: 'p',
				rationale: 'r',
				applicableObjectTypes: ['PROFESSIONAL_WORK_UNIT'],
				evaluatedClaimTypes: ['CORRECTNESS'],
				// A DOC-004 §7 AssessmentCriterion. Was `{ id: 'C-01', statement: 's', mandatory: true }` — a shape no
				// document defines, accepted only because the payload was `z.array(z.unknown())`.
				criteria: [
					{
						id: 'C-01',
						name: 'n',
						description: 's',
						criterionType: 'BOOLEAN',
						evaluationMethod: 'MODEL_JUDGMENT',
						requiredEvidenceIds: [],
						severityIfNotMet: 'BLOCKING',
						mayBeNotApplicable: false
					}
				],
				evaluatorRole: 'reviewer',
				independenceRequirement: 'DIFFERENT_AGENT',
				...over,
				// A DOC-004 §9.1 FindingDefinition. Was `{ code: 'F-01', severity: 'MATERIAL', statement: 's' }` —
				// a shape no document defines, accepted because FindingDefinitionSchema was z.record(...) = any object.
				findingDefinitions: [
					{
						code: 'F-01',
						name: 'F 01',
						description: 's',
						defaultSeverity: 'MATERIAL',
						affectedClaimTypes: ['CORRECTNESS'],
						defaultControlActions: ['CLARIFY']
					}
				],
				permittedControlActions: ['CLARIFY']
			},
			id
		);
	}

	it('create(DRAFT) -> activate -> edit in place -> suspend -> activate -> supersede', () => {
		const P = 'pol_test_01';
		expect(create(P).status).toBe('ACCEPTED');
		// A regular (non-floor) policy is born DRAFT — the ratified AssurancePolicy.status initial state (DOC-002
		// §18) — and governs only once deliberately activated. (It used to be born ACTIVE, bypassing the lifecycle.)
		expect(status(P)).toBe('DRAFT');
		expect(d('ActivateAssurancePolicy', { policyId: P }, P).status).toBe('ACCEPTED');
		expect(status(P)).toBe('ACTIVE');

		// Edit only the payload-present fields; revision bumps, version (content version string) is unchanged.
		expect(
			d('EditAssurancePolicy', { policyId: P, name: 'Renamed', purpose: 'p2' }, P).status
		).toBe('ACCEPTED');
		const edited = store.loadObject(P)!.state as Record<string, unknown>;
		expect(edited.name).toBe('Renamed');
		expect(edited.purpose).toBe('p2');
		expect(edited.revision).toBe(2); // create (rev 0) -> activate (rev 1) -> edit (rev 2)

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
		// Floor policies are born ACTIVE (locked, always-apply) — the exception to the DRAFT-initial lifecycle,
		// because they can never be activated (Activate is one of the transitions the lock rejects).
		expect(status(FLOOR)).toBe('ACTIVE');
		expect(d('EditAssurancePolicy', { policyId: FLOOR, name: 'x' }, FLOOR).status).not.toBe(
			'ACCEPTED'
		);
		expect(d('SuspendAssurancePolicy', { policyId: FLOOR }, FLOOR).status).not.toBe('ACCEPTED');
		expect(d('SupersedeAssurancePolicy', { policyId: FLOOR }, FLOOR).status).not.toBe('ACCEPTED');
		// It stays ACTIVE and untouched.
		expect(status(FLOOR)).toBe('ACTIVE');
		expect((store.loadObject(FLOOR)!.state as { name?: string }).name).toBe('Reasoning Review');
	});

	it('threads requiredEvidence + optionalEvidence (DOC-004 §6.1) through create and patches them on edit', () => {
		// Before Inc B, createAssurancePolicy hardcoded requiredEvidence/optionalEvidence to [] and the command schema
		// had no field to carry them — a policy could declare NONE of the evidence its dispositions/criteria reference.
		// A fully-specified EvidenceRequirement: 7 concrete fields + admissibilityRules (undefined helper, permissive []).
		const P = 'pol_evidence_01';
		const req = {
			id: 'EV-01',
			evidenceType: 'TEST_RESULT',
			description: 'unit tests pass',
			purpose: 'demonstrate correctness',
			cardinality: 'AT_LEAST_ONE',
			admissibilityRules: [],
			requiredForDispositions: 'SATISFIED_ONLY',
			mayBeWaived: false
		};
		const opt = {
			id: 'EV-02',
			evidenceType: 'REVIEW',
			description: 'peer review',
			purpose: 'catch design flaws',
			cardinality: 'ZERO_OR_MORE',
			admissibilityRules: [],
			requiredForDispositions: 'ALL',
			mayBeWaived: true
		};
		expect(create(P, 'Evidence Policy', { requiredEvidence: [req], optionalEvidence: [opt] }).status).toBe(
			'ACCEPTED'
		);
		const created = store.loadObject(P)!.state as {
			requiredEvidence: unknown[];
			optionalEvidence: unknown[];
		};
		expect(created.requiredEvidence).toEqual([req]);
		expect(created.optionalEvidence).toEqual([opt]);

		// Edit patches requiredEvidence only; optionalEvidence is absent from the patch and must survive untouched.
		const req2 = { ...req, id: 'EV-01b', description: 'unit + integration tests pass' };
		expect(d('EditAssurancePolicy', { policyId: P, requiredEvidence: [req2] }, P).status).toBe('ACCEPTED');
		const edited = store.loadObject(P)!.state as {
			requiredEvidence: unknown[];
			optionalEvidence: unknown[];
		};
		expect(edited.requiredEvidence).toEqual([req2]);
		expect(edited.optionalEvidence).toEqual([opt]);
	});
});
