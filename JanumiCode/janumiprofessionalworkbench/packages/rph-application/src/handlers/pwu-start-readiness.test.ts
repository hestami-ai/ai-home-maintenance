// ⭐⭐ `JAN-EXEC` Phase 7, package M — THE ENGINE REFUSES A UNIT'S READINESS UNTIL EVERY UNIT IT WAITS FOR IS ACCEPTED (design
// `DESIGN-data-flow-order-and-deliverable-review.md` D2; `REG-D-135` (2); `REG-F-578`; enforcement register `RPH-PWU-011`).
//
// Driven through `Engine.dispatch`: two units of one Undertaking, the consumer recording the producer in `dependencyIds`.
// The ARRANGEMENT of the producer's state is seeded (`seedPwuWorkLifecycleState_FIXTURE` — reaching SATISFIED by commands
// is an eight-command chain whose failures would say nothing about this rule); the REFUSAL is driven. Each refusal is
// paired with the same command ACCEPTED when only the producer's state differs, so a handler that refused every readiness
// could not pass.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { OUTSIDE_INPUT, START_REFUSAL_MARKER, UNPRODUCED_INPUT } from '@janumipwb/rph-projections';
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

	// ⛔ MOVED 2026-10-26 (`JAN-EXEC` Phase 7, package O; design D21, revision 3; `REG-F-582`) — ~~"⛔ an ABANDONED producer, and an
	// input nothing produces, each refuse the consumer, named"~~: its second half pinned ~~"nothing in this Undertaking produces its
	// input "market-study""~~ in MarkPwuReady's refusal. An input nothing produces is expected from outside now and refuses nothing
	// (the D21 case below); the abandoned producer still refuses, as here.
	it('⛔ an ABANDONED producer refuses the consumer, named', () => {
		const abandoned = harness();
		abandoned.ok(abandoned.propose(PRODUCER), 'propose the producer');
		abandoned.ok(abandoned.propose(CONSUMER, { dependencyIds: [PRODUCER] }), 'propose the consumer');
		abandoned.seed(PRODUCER, 'ABANDONED');
		expect(abandoned.markReady(CONSUMER).error?.message).toContain('its producer "Requirements" was ABANDONED');
	});

	// ⭐⭐ D21 (package O; `REG-F-582`) — an input no unit of the Undertaking produces is EXPECTED FROM OUTSIDE it, and the engine
	// readies the unit: under D21's status, and under the status a record made before D21 carries (package M's, which refused it).
	it('⭐ D21, THE PREDICTED RED — MarkPwuReady READIES a unit whose only unmatched input is expected from outside, a record made before D21 and one D21 writes alike; ⭑ CONTROL: the same unit beside a PROPOSED producer is refused, the producer alone named', () => {
		for (const status of [UNPRODUCED_INPUT, OUTSIDE_INPUT]) {
			const h = harness();
			h.ok(h.propose(CONSUMER, { inputRequirements: [{ name: 'market-study', status }] }), `propose the consumer (${status})`);
			const admitted = h.markReady(CONSUMER);
			expect(admitted.status, `${status}: ${admitted.error?.message ?? ''}`).toBe('ACCEPTED');
			expect(h.stateOf(CONSUMER).workLifecycleState, status).toBe('READY');
		}
		const control = harness();
		control.ok(control.propose(PRODUCER), 'propose the producer');
		control.ok(
			control.propose(CONSUMER, {
				dependencyIds: [PRODUCER],
				inputRequirements: [{ name: 'market-study', status: OUTSIDE_INPUT }]
			}),
			'propose the consumer'
		);
		const refused = control.markReady(CONSUMER);
		expect(refused.status).toBe('REJECTED');
		expect(refused.error?.message).toContain('it waits for "Requirements" (PROPOSED) to be accepted');
		expect(refused.error?.message, 'the outside input was given as a reason').not.toContain('market-study');
	});

	it('⭑ CONTROL — a unit that waits for nothing enters READY', () => {
		const h = harness();
		h.ok(h.propose(PRODUCER), 'propose');
		expect(h.markReady(PRODUCER).status).toBe('ACCEPTED');
	});
});

// ⭐⭐ THE PLAN-DIRECT PATH (2026-10-26, the independent check of package M, its finding 1). READY is NOT the one door to
// execution for a STEP: a plan's commands ask only that its unit be OPEN (`pwuOpennessRefusal`, RPH-PWU-010), and PROPOSED is
// open — so a host of the engine that never sends `MarkPwuReady` could propose, approve and activate a plan on a consumer whose
// producer is PROPOSED, and start its step RUNNING. The check drove exactly that through the bus. So the rule is also asked at
// the two arrows into RUNNING (`stepAuthorityRefusal`'s fourth declared limb, the `inputReadiness` column), over the plan's
// work unit. Each refusal is paired with the same command ACCEPTED when only the producer's state differs.
describe('⭐ D2 — the step start refuses too: a plan on a waiting unit cannot run, whoever skipped MarkPwuReady (RPH-PWU-011)', () => {
	const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69M0030';
	const STEP = `${PLAN}-s1`;
	/** A plan on the consumer, proposed, approved and activated WITHOUT the consumer ever passing MarkPwuReady. */
	const planOnConsumer = (h: ReturnType<typeof harness>) => {
		const plan = (commandType: string, payload: unknown) => h.d(commandType, PLAN, 'EXECUTION_PLAN', payload);
		h.ok(
			plan('ProposeExecutionPlan', {
				executionPlanId: PLAN,
				workUnitId: CONSUMER,
				steps: [
					{
						id: STEP,
						executionPlanId: PLAN,
						stepType: 'HUMAN_INTERACTION',
						purpose: 'the design',
						inputBindings: [],
						outputBindings: [],
						preconditions: [],
						postconditions: [],
						stepState: 'QUEUED',
						strength: 'ADVISORY'
					}
				],
				transitions: [],
				retryPolicy: {},
				tacticalChangePolicy: {},
				escalationPolicy: {},
				terminationPolicy: {}
			}),
			'propose the plan (authoring is not executing, §20.2)'
		);
		h.ok(plan('ApproveExecutionPlan', {}), 'approve the plan');
		h.ok(plan('ActivateExecutionPlan', { authorizedRuntimeBindingIds: [] }), 'activate the plan');
		return plan;
	};
	const stepState = (h: ReturnType<typeof harness>) =>
		(h.stateOf(PLAN).steps as Array<{ id: string; stepState: string }>).find((s) => s.id === STEP)?.stepState;
	const arranged = () => {
		const h = harness();
		h.ok(h.propose(PRODUCER), 'propose the producer');
		h.ok(h.propose(CONSUMER, { dependencyIds: [PRODUCER] }), 'propose the consumer');
		return h;
	};

	it('⭐ THE PREDICTED RED — StartExecutionStep on a plan whose unit waits for a PROPOSED producer is refused, the producer named; the step stays QUEUED, the unit PROPOSED', () => {
		const h = arranged();
		const plan = planOnConsumer(h);
		const refused = plan('StartExecutionStep', { stepId: STEP });
		expect(refused.status).toBe('REJECTED');
		expect(refused.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(refused.error?.message).toContain(START_REFUSAL_MARKER);
		expect(refused.error?.message).toContain('it waits for "Requirements" (PROPOSED) to be accepted');
		expect(refused.error?.message).toContain(`StartExecutionStep blocked: step ${STEP}`);
		expect(refused.error?.targetObjectIds, 'the refusal names the step, its unit and the unit it waits for').toEqual([
			STEP,
			CONSUMER,
			PRODUCER
		]);
		expect([stepState(h), h.stateOf(CONSUMER).workLifecycleState]).toEqual(['QUEUED', 'PROPOSED']);
	});

	it('⛔ D4 at the step start — an ABANDONED producer refuses the step too, named, its producer among the targets', () => {
		const h = arranged();
		h.seed(PRODUCER, 'ABANDONED');
		const plan = planOnConsumer(h);
		const refused = plan('StartExecutionStep', { stepId: STEP });
		expect(refused.status).toBe('REJECTED');
		expect(refused.error?.message).toContain('its producer "Requirements" was ABANDONED');
		expect(refused.error?.targetObjectIds).toEqual([STEP, CONSUMER, PRODUCER]);
		expect(stepState(h)).toBe('QUEUED');
	});

	it("⭑ CONTROL — the same plan, its unit's producer SATISFIED, starts its step RUNNING", () => {
		const h = arranged();
		h.seed(PRODUCER, 'SATISFIED');
		const plan = planOnConsumer(h);
		const admitted = plan('StartExecutionStep', { stepId: STEP });
		expect(admitted.status, admitted.error?.message).toBe('ACCEPTED');
		expect(stepState(h)).toBe('RUNNING');
	});

	// ⭐⭐ D21 (package O; `REG-F-582`) — THE STEP START'S SEAT READS THE SAME RULE: an input expected from outside refuses nothing.
	it('⭐ D21 at the step start — a plan on a unit whose only unmatched input is expected from outside starts its step RUNNING, a record made before D21 and one D21 writes alike', () => {
		for (const status of [UNPRODUCED_INPUT, OUTSIDE_INPUT]) {
			const h = harness();
			h.ok(h.propose(CONSUMER, { inputRequirements: [{ name: 'market-study', status }] }), `propose the consumer (${status})`);
			const plan = planOnConsumer(h);
			const admitted = plan('StartExecutionStep', { stepId: STEP });
			expect(admitted.status, `${status}: ${admitted.error?.message ?? ''}`).toBe('ACCEPTED');
			expect(stepState(h), status).toBe('RUNNING');
		}
	});

	it('⭐ THE SECOND ARROW INTO RUNNING — a resume after the producer was INVALIDATED is refused, the producer named; the control resumes', () => {
		const run = (producerAfterTheWait: string | null) => {
			const h = arranged();
			h.seed(PRODUCER, 'SATISFIED');
			const plan = planOnConsumer(h);
			h.ok(plan('StartExecutionStep', { stepId: STEP }), 'start, the producer accepted');
			h.ok(plan('EnterExecutionStepWait', { stepId: STEP, waitReason: 'a person is asked' }), 'wait');
			if (producerAfterTheWait) h.seed(PRODUCER, producerAfterTheWait);
			return { resumed: plan('ResolveExecutionStepWait', { stepId: STEP }), state: stepState(h) };
		};
		const refused = run('INVALIDATED');
		expect(refused.resumed.status).toBe('REJECTED');
		expect(refused.resumed.error?.message).toContain(START_REFUSAL_MARKER);
		expect(refused.resumed.error?.message).toContain('it waits for "Requirements" (INVALIDATED) to be accepted');
		expect(refused.state).toBe('WAITING');
		const control = run(null);
		expect(control.resumed.status, control.resumed.error?.message).toBe('ACCEPTED');
		expect(control.state).toBe('RUNNING');
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
