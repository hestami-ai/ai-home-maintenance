// ⭐⭐ `JAN-EXEC` Phase 7, package L17a — design D72 (`DESIGN-data-flow-order-and-deliverable-review.md` §12.26, "The link, and its check" and
// "The readers"; `REG-D-166` (1); `REG-F-643`; `REG-F-212`, its remedy (2) for this path) — THE KERNEL'S SUPERSESSION CHECK, THE LINK IT
// WRITES, AND THE KERNEL'S TWO READERS OF START READINESS FOLLOWING IT — driven through `Engine.dispatch`.
//
// ⛔ WHAT WAS WRONG (`REG-F-212`): `SupersedePwu` copied the caller's successor id into its event and never loaded it; a supersession naming a
// successor never created was ACCEPTED, and SUPERSEDED is terminal. ⭑ WHAT MUST HOLD (the lead's, D72): the kernel refuses a supersession whose
// successor is missing, is the unit itself, is of another type or Undertaking, is not PROPOSED or already succeeds another unit, or that cites
// no EFFECTIVE `REPLAN` Decision naming the old unit; it writes the successor to the old unit's state by the lifecycle move, and its event names
// the Decision; and start readiness — the kernel's `MarkPwuReady` and the execution guard on a step's start — reads a dependency through the link.
// ⭑ THE ARRANGEMENT: package M's start-readiness harness — one published PWA, two Undertakings, real commands into a real store — with two
// non-root types, so a successor of another type can be named. A link the READERS are asked about is seeded into the store directly
// (`seedLink`), as package M seeds a producer's state: the reader is the subject, and the seeding lets each reader redden at its own words.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { PwuSupersededPayloadSchema } from '@janumipwb/rph-contracts';
import { replayPwuAxes } from '@janumipwb/rph-projections';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { describe, expect, it } from 'vitest';
import { Engine } from '../index.js';
import { seedPwuWorkLifecycleState_FIXTURE } from './__tests__/pwu-fixtures.js';

const TS = '2026-11-16T00:00:00Z';
const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69S0000';
const ROOT_TYPE = 'pwut_01ARZ3NDEKTSV4RRFFQ69S0001';
const TYPE_A = 'pwut_01ARZ3NDEKTSV4RRFFQ69S0002';
const TYPE_B = 'pwut_01ARZ3NDEKTSV4RRFFQ69S0003';
const UNDERTAKING = 'und_01ARZ3NDEKTSV4RRFFQ69S0004';
const OTHER_UNDERTAKING = 'und_01ARZ3NDEKTSV4RRFFQ69S0005';
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69S0006';
const OLD = 'pwu_01ARZ3NDEKTSV4RRFFQ69S0010';
const NEW = 'pwu_01ARZ3NDEKTSV4RRFFQ69S0011';
const OTHER = 'pwu_01ARZ3NDEKTSV4RRFFQ69S0012';
const CONSUMER = 'pwu_01ARZ3NDEKTSV4RRFFQ69S0013';
const PLAN = 'plan_01ARZ3NDEKTSV4RRFFQ69S0020';
const STEP = `${PLAN}-s1`;
const ACTOR = { actorId: 'u1', actorType: 'HUMAN', displayName: 'Operator' } as const;

function harness() {
	const store = new SqliteStorageAdapter({ now: () => TS });
	let seq = 0;
	const engine = new Engine({ authenticate: testAuthenticator(), store, now: () => TS, newEventId: () => `e${++seq}` }).as(TEST_CRED.human);
	const d = (commandType: string, id: string, type: string, payload: unknown) => {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: type,
			targetAggregateId: id,
			issuedAt: TS,
			correlationId: 'l17a',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	};
	const ok = (r: ReturnType<typeof d>, what: string) => expect(r.status, `arrangement: ${what}: ${r.error?.message ?? ''}`).toBe('ACCEPTED');
	ok(d('CreatePwa', PWA, 'PROFESSIONAL_WORK_ARCHITECTURE', { pwaId: PWA, name: 'Supersession PWA', description: 'a PWA of two work types', domain: 'software', version: '1.0.0' }), 'the PWA');
	for (const [id, name] of [[TYPE_B, 'Verification'], [TYPE_A, 'Source Construction']] as const)
		ok(d('DefinePwuType', id, 'PWU_TYPE', { pwuTypeId: id, pwaId: PWA, pwuKind: 'WORK', name, purpose: `do the ${name}`, isRoot: false }), name);
	ok(
		d('DefinePwuType', ROOT_TYPE, 'PWU_TYPE', {
			pwuTypeId: ROOT_TYPE,
			pwaId: PWA,
			pwuKind: 'PRODUCT_REALIZATION',
			name: 'Root',
			purpose: 'the root',
			isRoot: true,
			permittedChildTypeIds: [TYPE_A, TYPE_B]
		}),
		'the root type'
	);
	for (const step of ['SubmitPwaForReview', 'ValidatePwa']) ok(d(step, PWA, 'PROFESSIONAL_WORK_ARCHITECTURE', {}), step);
	ok(d('PublishPwa', PWA, 'PROFESSIONAL_WORK_ARCHITECTURE', { rootPwuTypeId: ROOT_TYPE }), 'publish');
	for (const und of [UNDERTAKING, OTHER_UNDERTAKING])
		ok(
			d('CreateUndertaking', und, 'UNDERTAKING', {
				undertakingId: und,
				name: und,
				description: 'units replaced by successors',
				pwaId: PWA,
				pwaVersion: '1.0.0',
				instantiationProfile: 'Standard',
				objective: 'observe the supersession check',
				intendedOutputProduct: 'a verdict'
			}),
			'an Undertaking'
		);
	ok(d('CaptureIntent', INTENT, 'INTENT', { intentId: INTENT, originatingExpression: 'observe the check', ontologyId: 'o', ontologyVersion: '1' }), 'capture');
	ok(d('BeginIntentDiscovery', INTENT, 'INTENT', {}), 'discover');
	ok(d('ProvisionIntent', INTENT, 'INTENT', { ambiguityIds: [] }), 'provision');
	const propose = (pwuId: string, typeId: string = TYPE_A, extra: Record<string, unknown> = {}, undertakingId = UNDERTAKING) =>
		d('ProposePwu', pwuId, 'PROFESSIONAL_WORK_UNIT', {
			pwuId,
			pwuKind: 'WORK',
			title: pwuId === CONSUMER ? 'Unit Test Suite' : 'Source Construction',
			description: 'a unit of the Undertaking',
			intentId: INTENT,
			undertakingId,
			isLocalExtension: false,
			pwuTypeId: typeId,
			boundaries: { inScope: ['the work'], outOfScope: ['not yet known'], permittedChanges: [], prohibitedChanges: [] },
			obligationIds: [],
			constraintIds: [],
			assumptionIds: [],
			expectedOutputs: [{ outputId: `out_${pwuId}`, kind: 'DOCUMENT' }],
			assurancePolicyIds: [],
			riskProfile: { consequence: 'LOW', uncertainty: 'LOW', irreversibility: 'LOW', securitySensitivity: 'LOW', regulatoryExposure: 'LOW' },
			...extra
		});
	/** A person's Decision of `decisionType`, proposed and — unless `approved` is false — approved, naming `subjects`, the first pinned at 1. */
	const decide = (subjects: readonly string[], decisionType = 'REPLAN', approved = true): string => {
		const id = `dec_01ARZ3NDEKTSV4RRFFQ69S${String(100 + ++seq).padStart(4, '0')}`;
		ok(d('ProposeDecision', id, 'DECISION', { decisionType, subjectObjectIds: [...subjects], selectedOption: 'REPLACE_REACHED_WORK', rationale: 'a person’s choice', authority: ACTOR, consideredObservationIds: [] }), 'propose the Decision');
		if (approved)
			ok(
				d('ApproveDecision', id, 'DECISION', { selectedOption: 'REPLACE_REACHED_WORK', rationale: 'a person’s choice', consideredEvidenceIds: [], consideredObservationIds: [], subjectSemanticVersions: { [subjects[0]!]: 1 } }),
				'approve the Decision'
			);
		return id;
	};
	const supersede = (oldId: string, successorId: string, decisionId: string) =>
		d('SupersedePwu', oldId, 'PROFESSIONAL_WORK_UNIT', { supersedingWorkUnitId: successorId, supersessionDecisionId: decisionId });
	const stateOf = (id: string) => store.loadObject(id)?.state as Record<string, unknown>;
	/**
	 * The ARRANGEMENT a reader is asked about: `oldId` superseded by `successorId`, written straight into the store — the state a supersession
	 * leaves (SUPERSEDED, its successor linked), so the reader, not the kernel's check, is what each test asks.
	 */
	const seedLink = (oldId: string, successorId: string) => {
		const stored = store.loadObject(oldId)!;
		const r = store.commit({
			aggregateType: 'PROFESSIONAL_WORK_UNIT',
			aggregateId: oldId,
			objectType: 'PROFESSIONAL_WORK_UNIT',
			expectedRevision: stored.revision,
			newRevision: stored.revision + 1,
			newSemanticVersion: stored.semanticVersion,
			currentState: { ...(stored.state as Record<string, unknown>), workLifecycleState: 'SUPERSEDED', supersedingWorkUnitId: successorId },
			events: [],
			receipt: {
				commandId: `seed-link-${++seq}`,
				idempotencyKey: `seed-link-${seq}`,
				commandType: 'FixtureSeedSupersessionLink',
				targetAggregateId: oldId,
				status: 'ACCEPTED',
				producedEventIds: []
			}
		});
		expect(r.ok, 'arrangement: the link seeded').toBe(true);
	};
	const markReady = (pwuId: string) => {
		ok(d('BeginPwuShaping', pwuId, 'PROFESSIONAL_WORK_UNIT', {}), `shape ${pwuId}`);
		return d('MarkPwuReady', pwuId, 'PROFESSIONAL_WORK_UNIT', { shapeReadinessAssessmentId: 'assess_shape', expectedSemanticVersion: 1 });
	};
	return { store, d, ok, propose, decide, supersede, stateOf, seedLink, markReady, seed: (id: string, s: string) => seedPwuWorkLifecycleState_FIXTURE(store, id, s) };
}

describe('⭐⭐ L17a (D72) — SupersedePwu: the successor and the Decision checked by the kernel, the link written to the old unit’s state', () => {
	it('⛔ RED FIRST — with a PROPOSED successor of its type and Undertaking, under a person’s EFFECTIVE REPLAN naming it, the unit is SUPERSEDED: the link on its state, the successor and the Decision on its event, replay equivalent', () => {
		const h = harness();
		h.ok(h.propose(OLD), 'the old unit');
		h.ok(h.propose(NEW), 'its successor');
		const decision = h.decide([OLD]);
		const r = h.supersede(OLD, NEW, decision);
		expect(r.status, `the supersession, authorized, was refused: ${r.error?.message ?? ''}`).toBe('ACCEPTED');
		expect([h.stateOf(OLD).workLifecycleState, h.stateOf(OLD).supersedingWorkUnitId], 'the link is a lifecycle fact on the old unit').toEqual([
			'SUPERSEDED',
			NEW
		]);
		expect(h.stateOf(NEW).supersedingWorkUnitId, 'the successor carries no link of its own').toBeUndefined();
		const events = h.store.readAggregateEvents('PROFESSIONAL_WORK_UNIT', OLD).filter((e) => e.eventType === 'PwuSuperseded');
		expect(events.map((e) => e.payload), 'its event names the successor and the Decision').toEqual([
			{ supersedingWorkUnitId: NEW, supersessionDecisionId: decision, workLifecycleState: 'SUPERSEDED' }
		]);
		expect(replayPwuAxes(h.store.readAggregateEvents('PROFESSIONAL_WORK_UNIT', OLD))?.workLifecycleState).toBe('SUPERSEDED');
	});

	it('⛔ RED FIRST — refused, the unit untouched, when the successor is the unit itself, is not recorded, or is not a work unit', () => {
		const h = harness();
		h.ok(h.propose(OLD), 'the old unit');
		const decision = h.decide([OLD]);
		for (const [successor, words] of [
			[OLD, 'it names the unit itself as its successor'],
			['pwu_01ARZ3NDEKTSV4RRFFQ69S9999', 'it names pwu_01ARZ3NDEKTSV4RRFFQ69S9999 as its successor, and nothing by that id is recorded'],
			[decision, `it names ${decision} as its successor, a DECISION, not a work unit`]
		] as const) {
			const r = h.supersede(OLD, successor, decision);
			expect([r.status, r.error?.code], successor).toEqual(['REJECTED', 'RPH_VALIDATION_SEMANTIC_FAILED']);
			expect(r.error?.message ?? '', successor).toContain(words);
		}
		expect(h.stateOf(OLD).workLifecycleState, 'nothing moved').toBe('PROPOSED');
	});

	it('⛔ RED FIRST — refused when the successor is of another Undertaking, or of another type', () => {
		const h = harness();
		h.ok(h.propose(OLD), 'the old unit');
		h.ok(h.propose(OTHER, TYPE_A, {}, OTHER_UNDERTAKING), 'a unit of the other Undertaking');
		h.ok(h.propose(NEW, TYPE_B), 'a unit of another type');
		const decision = h.decide([OLD]);
		const elsewhere = h.supersede(OLD, OTHER, decision);
		expect(elsewhere.error?.message ?? '', 'another Undertaking').toContain(
			`its successor ${OTHER} is a unit of Undertaking ${OTHER_UNDERTAKING}, not of this unit's ${UNDERTAKING}`
		);
		const otherType = h.supersede(OLD, NEW, decision);
		expect(otherType.error?.message ?? '', 'another type').toContain(`its successor ${NEW} is of type ${TYPE_B}, not of this unit's ${TYPE_A}`);
		expect(h.stateOf(OLD).workLifecycleState, 'nothing moved').toBe('PROPOSED');
	});

	it('⛔ RED FIRST — refused when the successor is not PROPOSED: a successor is a new unit, not one already at work', () => {
		const h = harness();
		h.ok(h.propose(OLD), 'the old unit');
		h.ok(h.propose(NEW), 'its successor');
		h.ok(h.d('BeginPwuShaping', NEW, 'PROFESSIONAL_WORK_UNIT', {}), 'the successor begun');
		const r = h.supersede(OLD, NEW, h.decide([OLD]));
		expect(r.error?.message ?? '').toContain(`its successor ${NEW} is SHAPING, not PROPOSED`);
	});

	it('⛔ RED FIRST — refused when the successor already succeeds another unit: each successor carries one unit’s work', () => {
		const h = harness();
		h.ok(h.propose(OLD), 'the first old unit');
		h.ok(h.propose(OTHER), 'the second old unit');
		h.ok(h.propose(NEW), 'the successor');
		const decision = h.decide([OLD, OTHER]);
		expect(h.supersede(OLD, NEW, decision).status, 'arrangement: the first supersession').toBe('ACCEPTED');
		const second = h.supersede(OTHER, NEW, decision);
		expect(second.error?.message ?? '').toContain(`its successor ${NEW} already succeeds ${OLD}`);
		expect(h.stateOf(OTHER).workLifecycleState, 'the second unit untouched').toBe('PROPOSED');
	});

	it('⛔ RED FIRST — refused unless it cites a person’s EFFECTIVE REPLAN Decision naming the unit: none recorded, not a Decision, of another kind, only proposed, or about another unit', () => {
		const h = harness();
		h.ok(h.propose(OLD), 'the old unit');
		h.ok(h.propose(NEW), 'its successor');
		h.ok(h.propose(OTHER), 'another unit');
		for (const [decision, words] of [
			['dec_01ARZ3NDEKTSV4RRFFQ69S9998', 'the Decision it cites, dec_01ARZ3NDEKTSV4RRFFQ69S9998, names no recorded object'],
			[OTHER, `the Decision it cites, ${OTHER}, is a PROFESSIONAL_WORK_UNIT, not a DECISION`],
			['APPROVAL', 'decision, not a REPLAN'],
			['PROPOSED', 'is PROPOSED, not EFFECTIVE: a proposed Decision is a request, not an authority'],
			['ABOUT', `does not name ${OLD} among its subjects`]
		] as const) {
			const cited =
				decision === 'APPROVAL'
					? h.decide([OLD], 'APPROVAL')
					: decision === 'PROPOSED'
						? h.decide([OLD], 'REPLAN', false)
						: decision === 'ABOUT'
							? h.decide([OTHER])
							: decision;
			const r = h.supersede(OLD, NEW, cited);
			expect([r.status, r.error?.code], decision).toEqual(['REJECTED', 'RPH_INVARIANT_VIOLATION']);
			expect(r.error?.message ?? '', decision).toContain(words);
		}
		expect(h.stateOf(OLD).workLifecycleState, 'nothing moved').toBe('PROPOSED');
	});

	it('⛔ RED FIRST — a supersession of a unit not recorded is refused by the load, before the check: the aggregate does not exist', () => {
		const h = harness();
		h.ok(h.propose(NEW), 'a successor');
		const r = h.supersede('pwu_01ARZ3NDEKTSV4RRFFQ69S9997', NEW, 'dec_01ARZ3NDEKTSV4RRFFQ69S9996');
		expect(r.status).toBe('REJECTED');
		expect(r.error?.message ?? '').toContain('Aggregate pwu_01ARZ3NDEKTSV4RRFFQ69S9997 does not exist');
	});

	it('⭑ CONTROL — a PwuSuperseded event recorded before this package, with no Decision on it, still parses and replays', () => {
		const h = harness();
		h.ok(h.propose(OLD), 'the unit, its proposal the store’s own event');
		const old = { supersedingWorkUnitId: NEW, workLifecycleState: 'SUPERSEDED' };
		expect(PwuSupersededPayloadSchema.safeParse(old).success, 'the old event’s payload parses').toBe(true);
		const recorded = h.store.readAggregateEvents('PROFESSIONAL_WORK_UNIT', OLD);
		const replayed = replayPwuAxes([
			...recorded,
			{ ...recorded[0]!, eventId: 'e-before-l17a', eventType: 'PwuSuperseded', aggregateRevision: recorded.length, payload: old }
		] as unknown as Parameters<typeof replayPwuAxes>[0]);
		expect(replayed?.workLifecycleState, 'and replays to SUPERSEDED').toBe('SUPERSEDED');
	});
});

describe('⭐⭐ L17a (D72) — the kernel’s readers of start readiness follow the link', () => {
	it('⛔ RED FIRST — MarkPwuReady admits a consumer whose recorded producer was superseded by an ACCEPTED successor', () => {
		const h = harness();
		h.ok(h.propose(OLD), 'the producer');
		h.ok(h.propose(NEW), 'its successor');
		h.ok(h.propose(CONSUMER, TYPE_B, { dependencyIds: [OLD] }), 'the consumer, recording the old producer');
		h.seedLink(OLD, NEW);
		h.seed(NEW, 'SATISFIED');
		const r = h.markReady(CONSUMER);
		expect(r.status, `the consumer, its producer’s successor accepted, was refused: ${r.error?.message ?? ''}`).toBe('ACCEPTED');
	});

	it('⛔ RED FIRST — and refuses it while the successor is not accepted, naming the successor', () => {
		const h = harness();
		h.ok(h.propose(OLD), 'the producer');
		h.ok(h.propose(NEW), 'its successor');
		h.ok(h.propose(CONSUMER, TYPE_B, { dependencyIds: [OLD] }), 'the consumer');
		h.seedLink(OLD, NEW);
		const r = h.markReady(CONSUMER);
		expect(r.status).toBe('REJECTED');
		expect(r.error?.message ?? '', 'the refusal names the unit it waits for: the successor').toContain('it waits for "Source Construction" (PROPOSED) to be accepted');
		expect(r.error?.message ?? '').not.toContain('SUPERSEDED');
	});

	it('⛔ RED FIRST — the execution guard on a step’s start reads the same: a step of the consumer starts once the successor is accepted', () => {
		const h = harness();
		h.ok(h.propose(OLD), 'the producer');
		h.ok(h.propose(NEW), 'its successor');
		h.ok(h.propose(CONSUMER, TYPE_B, { dependencyIds: [OLD] }), 'the consumer');
		h.seedLink(OLD, NEW);
		h.ok(
			h.d('ProposeExecutionPlan', PLAN, 'EXECUTION_PLAN', {
				executionPlanId: PLAN,
				workUnitId: CONSUMER,
				steps: [
					{
						id: STEP,
						executionPlanId: PLAN,
						stepType: 'HUMAN_INTERACTION',
						purpose: 'the tests',
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
			'the consumer’s plan'
		);
		h.ok(h.d('ApproveExecutionPlan', PLAN, 'EXECUTION_PLAN', {}), 'approve');
		h.ok(h.d('ActivateExecutionPlan', PLAN, 'EXECUTION_PLAN', { authorizedRuntimeBindingIds: [] }), 'activate');
		const waiting = h.d('StartExecutionStep', PLAN, 'EXECUTION_PLAN', { stepId: STEP });
		expect(waiting.error?.message ?? 'ACCEPTED', 'the successor not accepted: refused, naming it').toContain('"Source Construction" (PROPOSED)');
		h.seed(NEW, 'SATISFIED');
		const started = h.d('StartExecutionStep', PLAN, 'EXECUTION_PLAN', { stepId: STEP });
		expect(started.status, `the successor accepted: the step’s start was refused: ${started.error?.message ?? ''}`).toBe('ACCEPTED');
	});
});
