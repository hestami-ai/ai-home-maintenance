// ⭐⭐ `JAN-EXEC` Phase 7, package M — THE ENGINE REFUSES A UNIT'S READINESS UNTIL EVERY UNIT IT WAITS FOR IS ACCEPTED (design
// `DESIGN-data-flow-order-and-deliverable-review.md` D2; `REG-D-135` (2); `REG-F-578`; enforcement register `RPH-PWU-011`).
//
// Driven through `Engine.dispatch`: two units of one Undertaking, the consumer recording the producer in `dependencyIds`.
// The ARRANGEMENT of the producer's state is seeded (`seedPwuWorkLifecycleState_FIXTURE` — reaching SATISFIED by commands
// is an eight-command chain whose failures would say nothing about this rule); the REFUSAL is driven. Each refusal is
// paired with the same command ACCEPTED when only the producer's state differs, so a handler that refused every readiness
// could not pass.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { START_REFUSAL_MARKER, UNPRODUCED_INPUT } from '@janumipwb/rph-projections';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { describe, expect, it } from 'vitest';
import { Engine } from '../index.js';
import { seedPwuWorkLifecycleState_FIXTURE } from './__tests__/pwu-fixtures.js';

const TS = '2026-10-25T00:00:00Z';
const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69M0000';
const ROOT_TYPE = 'pwut_01ARZ3NDEKTSV4RRFFQ69M0001';
const UNDERTAKING = 'und_01ARZ3NDEKTSV4RRFFQ69M0002';
const OTHER_UNDERTAKING = 'und_01ARZ3NDEKTSV4RRFFQ69M0003';
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69M0004';
const PRODUCER = 'pwu_01ARZ3NDEKTSV4RRFFQ69M0010';
const CONSUMER = 'pwu_01ARZ3NDEKTSV4RRFFQ69M0011';

function harness() {
	const store = new SqliteStorageAdapter({ now: () => TS });
	let seq = 0;
	const engine = new Engine({
		authenticate: testAuthenticator(),
		store,
		now: () => TS,
		newEventId: () => `e${++seq}`
	}).as(TEST_CRED.human);
	const d = (commandType: string, id: string, type: string, payload: unknown) => {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: type,
			targetAggregateId: id,
			issuedAt: TS,
			correlationId: 'pwu011',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	};
	const ok = (r: ReturnType<typeof d>, what: string) => expect(r.status, `${what}: ${r.error?.message ?? ''}`).toBe('ACCEPTED');
	ok(
		d('CreatePwa', PWA, 'PROFESSIONAL_WORK_ARCHITECTURE', {
			pwaId: PWA,
			name: 'Readiness PWA',
			description: 'a PWA whose Undertaking holds two units',
			domain: 'software',
			version: '1.0.0'
		}),
		'create the PWA'
	);
	ok(
		d('DefinePwuType', ROOT_TYPE, 'PWU_TYPE', {
			pwuTypeId: ROOT_TYPE,
			pwaId: PWA,
			pwuKind: 'PRODUCT_REALIZATION',
			name: 'Root',
			purpose: 'the root',
			isRoot: true
		}),
		'define its root'
	);
	for (const step of ['SubmitPwaForReview', 'ValidatePwa']) ok(d(step, PWA, 'PROFESSIONAL_WORK_ARCHITECTURE', {}), step);
	ok(d('PublishPwa', PWA, 'PROFESSIONAL_WORK_ARCHITECTURE', { rootPwuTypeId: ROOT_TYPE }), 'publish');
	for (const und of [UNDERTAKING, OTHER_UNDERTAKING])
		ok(
			d('CreateUndertaking', und, 'UNDERTAKING', {
				undertakingId: und,
				name: und,
				description: 'two units, one waiting for the other',
				pwaId: PWA,
				pwaVersion: '1.0.0',
				instantiationProfile: 'Standard',
				objective: 'observe the readiness rule',
				intendedOutputProduct: 'a verdict'
			}),
			'create an Undertaking'
		);
	// A root unit enters readiness only under an Intent at least PROVISIONAL (DOC-002 §6.3 L472): both units here are roots.
	ok(
		d('CaptureIntent', INTENT, 'INTENT', {
			intentId: INTENT,
			originatingExpression: 'observe the readiness rule',
			ontologyId: 'o',
			ontologyVersion: '1'
		}),
		'capture'
	);
	ok(d('BeginIntentDiscovery', INTENT, 'INTENT', {}), 'discover');
	ok(d('ProvisionIntent', INTENT, 'INTENT', { ambiguityIds: [] }), 'provision');
	const propose = (pwuId: string, extra: Record<string, unknown> = {}, undertakingId = UNDERTAKING) =>
		d('ProposePwu', pwuId, 'PROFESSIONAL_WORK_UNIT', {
			pwuId,
			pwuKind: 'WORK',
			title: pwuId === PRODUCER ? 'Requirements' : pwuId === CONSUMER ? 'Design' : pwuId,
			description: 'a unit of the Undertaking',
			intentId: INTENT,
			undertakingId,
			isLocalExtension: true,
			boundaries: { inScope: ['the work'], outOfScope: ['not yet known'], permittedChanges: [], prohibitedChanges: [] },
			obligationIds: [],
			constraintIds: [],
			assumptionIds: [],
			expectedOutputs: [{ outputId: `out_${pwuId}`, kind: 'DOCUMENT' }],
			assurancePolicyIds: [],
			riskProfile: {
				consequence: 'LOW',
				uncertainty: 'LOW',
				irreversibility: 'LOW',
				securitySensitivity: 'LOW',
				regulatoryExposure: 'LOW'
			},
			...extra
		});
	const markReady = (pwuId: string) => {
		ok(d('BeginPwuShaping', pwuId, 'PROFESSIONAL_WORK_UNIT', {}), `shape ${pwuId}`);
		return d('MarkPwuReady', pwuId, 'PROFESSIONAL_WORK_UNIT', {
			shapeReadinessAssessmentId: 'assess_shape',
			expectedSemanticVersion: 1
		});
	};
	const stateOf = (id: string) => store.loadObject(id)?.state as Record<string, unknown>;
	return { d, ok, propose, markReady, stateOf, seed: (id: string, s: string) => seedPwuWorkLifecycleState_FIXTURE(store, id, s) };
}

describe('⭐ D2 — MarkPwuReady REFUSES a unit until every unit it waits for is ACCEPTED (RPH-PWU-011)', () => {
	it('⭐ THE PREDICTED RED — a consumer whose producer is PROPOSED is refused, the producer named; it stays SHAPING', () => {
		const h = harness();
		h.ok(h.propose(PRODUCER), 'propose the producer');
		h.ok(h.propose(CONSUMER, { dependencyIds: [PRODUCER] }), 'propose the consumer');
		const refused = h.markReady(CONSUMER);
		expect(refused.status).toBe('REJECTED');
		expect(refused.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(refused.error?.message).toContain(START_REFUSAL_MARKER);
		expect(refused.error?.message).toContain('it waits for "Requirements" (PROPOSED) to be accepted');
		expect(h.stateOf(CONSUMER).workLifecycleState).toBe('SHAPING');
	});

	it.each(['SATISFIED', 'RECOMPOSED', 'BASELINED'])('⭑ CONTROL — the same consumer, its producer %s, enters READY', (state) => {
		const h = harness();
		h.ok(h.propose(PRODUCER), 'propose the producer');
		h.ok(h.propose(CONSUMER, { dependencyIds: [PRODUCER] }), 'propose the consumer');
		h.seed(PRODUCER, state);
		const admitted = h.markReady(CONSUMER);
		expect(admitted.status, admitted.error?.message).toBe('ACCEPTED');
		expect(h.stateOf(CONSUMER).workLifecycleState).toBe('READY');
	});

	it('⛔ CONDITIONALLY_SATISFIED does not count (DEC-6): the consumer is refused, the producer named in that state', () => {
		const h = harness();
		h.ok(h.propose(PRODUCER), 'propose the producer');
		h.ok(h.propose(CONSUMER, { dependencyIds: [PRODUCER] }), 'propose the consumer');
		h.seed(PRODUCER, 'CONDITIONALLY_SATISFIED');
		const refused = h.markReady(CONSUMER);
		expect(refused.status).toBe('REJECTED');
		expect(refused.error?.message).toContain('"Requirements" (CONDITIONALLY_SATISFIED)');
	});

	it('⛔ an ABANDONED producer, and an input nothing produces, each refuse the consumer, named', () => {
		const abandoned = harness();
		abandoned.ok(abandoned.propose(PRODUCER), 'propose the producer');
		abandoned.ok(abandoned.propose(CONSUMER, { dependencyIds: [PRODUCER] }), 'propose the consumer');
		abandoned.seed(PRODUCER, 'ABANDONED');
		expect(abandoned.markReady(CONSUMER).error?.message).toContain('its producer "Requirements" was ABANDONED');

		const unproduced = harness();
		unproduced.ok(
			unproduced.propose(CONSUMER, { inputRequirements: [{ name: 'market-study', status: UNPRODUCED_INPUT }] }),
			'propose the consumer'
		);
		expect(unproduced.markReady(CONSUMER).error?.message).toContain(
			'nothing in this Undertaking produces its input "market-study"'
		);
	});

	it('⭑ CONTROL — a unit that waits for nothing enters READY', () => {
		const h = harness();
		h.ok(h.propose(PRODUCER), 'propose');
		expect(h.markReady(PRODUCER).status).toBe('ACCEPTED');
	});
});

describe('⭐ D1 — ProposePwu records what a unit waits for, and refuses what cannot be one', () => {
	it('records dependencyIds and inputRequirements as given', () => {
		const h = harness();
		h.ok(h.propose(PRODUCER), 'propose the producer');
		h.ok(
			h.propose(CONSUMER, {
				dependencyIds: [PRODUCER],
				inputRequirements: [{ name: 'market-study', status: UNPRODUCED_INPUT }]
			}),
			'propose the consumer'
		);
		expect([h.stateOf(CONSUMER).dependencyIds, h.stateOf(CONSUMER).inputRequirements]).toEqual([
			[PRODUCER],
			[{ name: 'market-study', status: UNPRODUCED_INPUT }]
		]);
	});

	it('⛔ refuses a unit naming itself, a unit named twice, a unit of another Undertaking, and dependencies without an Undertaking', () => {
		const h = harness();
		h.ok(h.propose(PRODUCER, {}, OTHER_UNDERTAKING), 'a unit of the other Undertaking');
		const messageOf = (extra: Record<string, unknown>) => h.propose(CONSUMER, extra).error?.message ?? 'ACCEPTED';
		expect(messageOf({ dependencyIds: [CONSUMER] })).toContain('a unit is never its own dependency');
		expect(messageOf({ dependencyIds: ['pwu_x', 'pwu_x'] })).toContain('names a unit more than once');
		expect(messageOf({ dependencyIds: [PRODUCER] })).toContain(`is not a work unit of Undertaking ${UNDERTAKING}`);
		expect(messageOf({ dependencyIds: ['pwu_x'], undertakingId: undefined })).toContain('names no undertakingId');
		expect(h.stateOf(CONSUMER), 'a refused proposal stored the unit').toBeUndefined();
	});
});

describe('⭐ D1, DEC-2 — ProposeDecomposition records its sibling dependencies, and refuses one that dangles', () => {
	const CONTRACT = 'dec_01ARZ3NDEKTSV4RRFFQ69M0020';
	const decompose = (h: ReturnType<typeof harness>, extra: Record<string, unknown> = {}) =>
		h.d('ProposeDecomposition', CONTRACT, 'DECOMPOSITION_CONTRACT', {
			parentWorkUnitId: PRODUCER,
			childWorkUnitIds: [CONSUMER],
			rationale: 'the root and the one unit beneath it',
			...extra
		});

	it('⛔ refuses a sibling dependency that is no child of it, and a member waiting for a unit of no Undertaking of its own — a forward reference ProposePwu admitted and nothing closed', () => {
		const stranger = harness();
		stranger.ok(stranger.propose(PRODUCER), 'propose the parent');
		stranger.ok(stranger.propose(CONSUMER), 'propose the child');
		expect(decompose(stranger, { siblingDependencyIds: ['pwu_stranger'] }).error?.message ?? 'ACCEPTED').toContain(
			'siblingDependencyIds names pwu_stranger, which is no child of this decomposition'
		);

		const dangling = harness();
		dangling.ok(dangling.propose(PRODUCER), 'propose the parent');
		// ⭑ Admitted: a parent is proposed before its children (PWU-003), so ProposePwu admits an id not stored yet.
		dangling.ok(dangling.propose(CONSUMER, { dependencyIds: ['pwu_never_proposed'] }), 'propose the child');
		expect(decompose(dangling).error?.message ?? 'ACCEPTED').toContain(
			`${CONSUMER} waits for pwu_never_proposed, which is no work unit of its Undertaking`
		);
		expect(dangling.stateOf(CONTRACT), 'a refused contract was stored').toBeUndefined();
	});

	it('⭑ CONTROL — the same contract, each dependency a unit of its Undertaking and each sibling dependency a child, is accepted and records them', () => {
		const h = harness();
		h.ok(h.propose(PRODUCER), 'propose the parent');
		h.ok(h.propose(CONSUMER, { dependencyIds: [PRODUCER] }), 'propose the child');
		h.ok(decompose(h, { siblingDependencyIds: [CONSUMER] }), 'propose the decomposition');
		expect(h.stateOf(CONTRACT).siblingDependencyIds).toEqual([CONSUMER]);
	});
});
