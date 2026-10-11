// ⭐⭐ THE LANE CONTROL — its two limbs, and the server's segments that make them hold across resets, retries and late
// completions (`JAN-CRITREAD` J1-3; `DESIGN-what-the-tests-prove.md` §4.8; `REG-D-072` D8).
//
// Two halves. The PURE CHECK over planted records: what a stand-in pass may rest on (limb 1) and that nothing else may
// pass (limb 2). Then THE SERVER, driven through its own routes on a real test-mode workbench: every D8 case the
// design's per-test fixture could not see — a run whose first spec never resets, a second test on a fresh engine, a
// violation that passes on retry, a floor that completes after its test's check, and a staged candidate the reset is
// about to discard.
//
// ⚠ THE VIOLATIONS HERE ARE FORGED, AND DELIBERATELY: a SATISFIED reasoning review completed by hand under a validator
// the lane does not run, or read by the real adapter with a clearing reply. The threat the control answers is a
// REGRESSION that produces such a record; forging one is how that record is made to exist in a test.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DomainCommand, DomainEvent } from '@janumipwb/rph-contracts';
import type { StoredObject } from '@janumipwb/rph-ports';
import { SESSION_CREDENTIAL } from './identity.js';
import { laneFindings, type LaneSource } from './lane-control.js';
import { clearingJudgement, withLiveReviewerSeam } from './assurance/clearing-reviewer.testing.js';

const RR = 'floor.reasoning-review';
const STANDIN = 'standin.reasoning-review';

// ── THE PURE CHECK ──────────────────────────────────────────────────────────────────────────────────────────────────

const obj = (objectType: string, state: Record<string, unknown>): StoredObject => ({
	objectType,
	revision: 1,
	semanticVersion: 1,
	state
});
const OBJECTS: Record<string, StoredObject> = {
	[RR]: obj('ASSURANCE_POLICY', {
		criteria: [
			{ id: 'C-1', severityIfNotMet: 'BLOCKING' },
			{ id: 'C-2', severityIfNotMet: 'BLOCKING' },
			{ id: 'C-3', severityIfNotMet: 'BLOCKING' },
			{ id: 'C-ADV', severityIfNotMet: 'ADVISORY' }
		]
	}),
	'pwa-1': obj('PROFESSIONAL_WORK_ARCHITECTURE', {}),
	'art-1': obj('ARTIFACT', { producingPwuId: 'pwu-1' }),
	'pwu-1': obj('PROFESSIONAL_WORK_UNIT', { undertakingId: 'und-1' }),
	'und-1': obj('UNDERTAKING', { pwaId: 'pwa-1' }),
	'evd-1': obj('EVIDENCE', {})
};

let seq = 0;
const ev = (eventType: string, payload: Record<string, unknown>): DomainEvent =>
	({ eventId: `evt-${++seq}`, eventType, payload }) as unknown as DomainEvent;
const completion = (
	a: string,
	subject: string,
	validatorId = STANDIN,
	disposition = 'SATISFIED',
	policy = RR
) =>
	ev('AssuranceAssessmentCompleted', {
		assessmentId: a,
		assurancePolicyId: policy,
		disposition,
		validatorId,
		subjectObjectIds: [subject]
	});
/** One recorded criterion row; `claim` is the test's stipulation BESIDE the result, when there is one. */
const row = (a: string, criterionId: string, result: string, claim?: 'MET') =>
	ev('AssuranceCriterionEvaluated', {
		assessmentId: a,
		criterionId,
		result,
		...(claim ? { stipulated: claim } : {})
	});
const src = (events: DomainEvent[], where = 'canonical'): LaneSource => ({
	where,
	events,
	loadObject: (id) => OBJECTS[id]
});
const GRAPH = { pwaId: 'pwa-1', framing: 'PWA_GRAPH', remaining: 'CLEAN' } as const;
const WP = { pwaId: 'pwa-1', framing: 'WORK_PRODUCT', remaining: 'CLEAN' } as const;
/** What a stand-in pass may rest on: one row a reviewer evaluated, two the test stipulated. */
const honest = (a: string, subject: string) => [
	row(a, 'C-1', 'MET'),
	row(a, 'C-2', 'UNABLE_TO_DETERMINE', 'MET'),
	row(a, 'C-3', 'UNABLE_TO_DETERMINE', 'MET'),
	completion(a, subject)
];
const reasons = (events: DomainEvent[], regs: (typeof GRAPH | typeof WP)[]) =>
	laneFindings([src(events)], regs).map((f) => `${f.limb}: ${f.reason}`);

describe('⭐ the check — limb 1: a stand-in pass rests on a stipulation, a real judgement, and a registration', () => {
	it('⭐ CONTROL — an honest stand-in pass on each arm, registered for that arm, is clean', () => {
		expect(laneFindings([src(honest('a-1', 'pwa-1'))], [GRAPH])).toEqual([]);
		expect(
			laneFindings([src(honest('a-2', 'art-1'))], [WP]),
			'the work product finds its PWA through its chain'
		).toEqual([]);
	});

	it('⛔ a stand-in pass with NO stipulated row — the stand-in recorded the test’s answers as MET', () => {
		const events = [
			row('a', 'C-1', 'MET'),
			row('a', 'C-2', 'MET'),
			row('a', 'C-3', 'MET'),
			completion('a', 'pwa-1')
		];
		expect(reasons(events, [GRAPH])).toEqual([
			'1: it rests on NO stipulated mandatory row — a stand-in pass the test did not stipulate'
		]);
	});

	it('⛔ a stand-in pass with NO evaluated row — a stipulation over a subject nobody read', () => {
		const events = [
			row('a', 'C-1', 'UNABLE_TO_DETERMINE', 'MET'),
			row('a', 'C-2', 'UNABLE_TO_DETERMINE', 'MET'),
			row('a', 'C-3', 'UNABLE_TO_DETERMINE', 'MET'),
			// An ADVISORY row is not a mandatory one, so it cannot stand in for the missing judgement.
			row('a', 'C-ADV', 'MET'),
			completion('a', 'pwa-1')
		];
		expect(reasons(events, [GRAPH])).toEqual([
			'1: it rests on NO evaluated mandatory row — nobody read the subject'
		]);
	});

	it('⛔ the LATEST recording of a criterion counts — an evaluation later stipulated over is not an evaluation', () => {
		const events = [
			row('a', 'C-1', 'MET'),
			...honest('a', 'pwa-1').slice(1, 3),
			row('a', 'C-1', 'UNABLE_TO_DETERMINE', 'MET'),
			completion('a', 'pwa-1')
		];
		expect(reasons(events, [GRAPH])).toEqual([
			'1: it rests on NO evaluated mandatory row — nobody read the subject'
		]);
	});

	it('⛔ a stand-in pass for a PWA nobody registered, or registered only on the OTHER arm', () => {
		expect(reasons(honest('a', 'pwa-1'), [])).toEqual([
			'1: no test registered a stipulation for pwa-1 on PWA_GRAPH'
		]);
		expect(reasons(honest('a', 'art-1'), [GRAPH])).toEqual([
			'1: no test registered a stipulation for pwa-1 on WORK_PRODUCT'
		]);
	});

	it('⛔ a stand-in pass over a subject no registration can name (a process result) is never clean', () => {
		expect(reasons(honest('a', 'evd-1'), [GRAPH, WP])).toEqual([
			'1: its subject evd-1 is neither a PWA nor a work product with a PWA'
		]);
	});
});

describe('⭐ the check — limb 2: nothing else passes a reasoning review on this lane', () => {
	it('⛔ a SATISFIED — or CONDITIONALLY_SATISFIED — review under any other validator, registered or not', () => {
		const events = [
			...honest('a', 'pwa-1').slice(0, 3),
			completion('a', 'pwa-1', 'agy.reasoning-review'),
			completion('b', 'pwa-1', 'mock.reasoning-review', 'CONDITIONALLY_SATISFIED')
		];
		expect(
			laneFindings([src(events, 'candidate of pwa-1')], [GRAPH]).map((f) => [
				f.limb,
				f.where,
				f.assessmentId,
				f.validatorId
			])
		).toEqual([
			[2, 'candidate of pwa-1', 'a', 'agy.reasoning-review'],
			[2, 'candidate of pwa-1', 'b', 'mock.reasoning-review']
		]);
	});

	it('⭐ CONTROL — a non-positive review, and a positive one under another policy, are not the lane’s business', () => {
		const events = [
			completion('a', 'pwa-1', 'agy.reasoning-review', 'INCONCLUSIVE'),
			completion('b', 'pwa-1', STANDIN, 'REJECTED'),
			completion(
				'c',
				'pwa-1',
				'deterministic.schema-invariant',
				'SATISFIED',
				'floor.schema-invariant'
			)
		];
		expect(laneFindings([src(events)], [])).toEqual([]);
	});
});

// ── ⭐⭐ `JAN-EXEC` Phase 7 completion E2 — LIMB 3: a declared stand-in pass rests on a DECLARED_POLICY registration ──────
//
// The declared policies are reviewed now, and in this lane the declared stand-in answers them — with NO checker, so each
// criterion it answers is a stipulation (`declared-policy-review.ts`). So its pass rests on stipulated mandatory rows and
// on a registration for its unit's PWA on the `DECLARED_POLICY` arm; and, judging nothing, it records no evaluated row.

const DECLARED_STANDIN = 'standin.declared-policy-review';
const DECLARED_POLICY_ID = 'pol_declared';
OBJECTS[DECLARED_POLICY_ID] = obj('ASSURANCE_POLICY', {
	criteria: [
		{ id: 'D-1', severityIfNotMet: 'BLOCKING' },
		{ id: 'D-2', severityIfNotMet: 'BLOCKING' }
	]
});
const DECLARED = { pwaId: 'pwa-1', framing: 'DECLARED_POLICY', remaining: 'CLEAN' } as const;
/** What a declared stand-in pass rests on: every criterion of the policy stipulated, over a WORK UNIT. */
const stipulatedDeclared = (a: string, validatorId = DECLARED_STANDIN) => [
	row(a, 'D-1', 'UNABLE_TO_DETERMINE', 'MET'),
	row(a, 'D-2', 'UNABLE_TO_DETERMINE', 'MET'),
	completion(a, 'pwu-1', validatorId, 'SATISFIED', DECLARED_POLICY_ID)
];

describe('⭐⭐ E2 — the check, limb 3: a declared stand-in pass rests on stipulated rows and a DECLARED_POLICY registration', () => {
	it('⭐ CONTROL — a declared stand-in pass, every row stipulated, its unit’s PWA registered on DECLARED_POLICY, is clean', () => {
		expect(laneFindings([src(stipulatedDeclared('d'))], [DECLARED])).toEqual([]);
	});

	it('⛔ a declared stand-in pass for a PWA nobody registered, or registered only on ANOTHER arm', () => {
		// ⛔ PREDICTED RED BEFORE LIMB 3: [] — no declared completion was the lane's business, so a stand-in that stipulated
		// for a PWA nobody registered passed the lane unseen.
		for (const regs of [[], [WP], [GRAPH]] as const)
			expect(laneFindings([src(stipulatedDeclared('d'))], regs).map((f) => [f.limb, f.assessmentId, f.reason])).toEqual([
				[3, 'd', 'no test registered a stipulation for pwa-1 on DECLARED_POLICY']
			]);
	});

	it('⛔ a declared stand-in pass with a mandatory row NOT stipulated — the stand-in judged something it cannot', () => {
		const events = [
			row('d', 'D-1', 'MET'),
			row('d', 'D-2', 'UNABLE_TO_DETERMINE', 'MET'),
			completion('d', 'pwu-1', DECLARED_STANDIN, 'SATISFIED', DECLARED_POLICY_ID)
		];
		expect(laneFindings([src(events)], [DECLARED]).map((f) => [f.limb, f.reason])).toEqual([
			[3, 'it records a mandatory row NOT stipulated (D-1) — the declared stand-in judges nothing']
		]);
	});

	it('⭐ CONTROL — a declared review under another validator, or a non-positive one, is not this limb’s business', () => {
		const events = [
			...stipulatedDeclared('m', 'reviewer.declared-policy'),
			completion('n', 'pwu-1', DECLARED_STANDIN, 'INCONCLUSIVE', DECLARED_POLICY_ID)
		];
		expect(laneFindings([src(events)], [])).toEqual([]);
	});
});

// ── THE SERVER: segments, marks, and what is kept ─────────────────────────────────────────────────────────────────

afterEach(() => {
	vi.unstubAllEnvs();
	vi.resetModules();
});

const PRODUCER = { agentId: 'jpwb-authoring-agent', modelId: 'pi-authoring', providerId: 'janumi' };

async function host(seed: 'reference' | 'empty', mode = 'test', harness = '') {
	vi.resetModules();
	vi.stubEnv('RPH_DEMO_MODE', mode);
	vi.stubEnv('JPWB_HARNESS', harness);
	vi.stubEnv('JPWB_DEMO_DB', '');
	vi.stubEnv('JPWB_SEED', seed);
	const wb = await import('./workbench.js');
	const turns = await import('./authoring-turn.js');
	const floor = await import('./floor.js');
	const registry = await import('./stipulations.js');
	const resetRoute = await import('../../routes/test-api/reset/+server.js');
	const laneRoute = await import('../../routes/test-api/lane-control/+server.js');
	const introspectRoute = await import('../../routes/test-api/introspect/+server.js');
	const post = (route: { POST: unknown }, body: unknown) =>
		(route.POST as (e: unknown) => Promise<Response>)({
			request: new Request('http://localhost/test-api', {
				method: 'POST',
				body: JSON.stringify(body)
			})
		});
	const lane = async (body: unknown) =>
		(await (await post(laneRoute, body)).json()) as Record<string, never>;
	const session = () => wb.getEngine().as(SESSION_CREDENTIAL);
	let n = 0;
	const send = (commandType: string, aggregateType: string, id: string, payload: unknown) => {
		n += 1;
		const command: DomainCommand = {
			commandId: `lane-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: aggregateType,
			targetAggregateId: id,
			issuedAt: '2026-09-25T09:00:00Z',
			correlationId: 'lane-control-test',
			idempotencyKey: `lane-idem-${n}-${Math.random()}`,
			payload
		};
		const r = session().dispatch(command);
		expect(r.status, `${commandType}: ${JSON.stringify(r.error)}`).toBe('ACCEPTED');
	};
	return {
		wb,
		turns,
		floor,
		registry,
		reset: async (s: 'empty' | 'reference') =>
			expect((await post(resetRoute, { seed: s })).status).toBe(200),
		announce: (test: string) => lane({ announce: test }),
		check: async (test: string) =>
			(await lane({ check: test })).violations as {
				limb: number;
				where: string;
				attributedTo: string[];
				seenAt: string;
			}[],
		final: async () =>
			(await lane({ final: true })) as unknown as {
				marks: { openedBy: string; mark: number }[];
				violations: { limb: number; where: string; attributedTo: string[]; seenAt: string }[];
			},
		introspect: async () =>
			(await (introspectRoute.GET as (e: unknown) => Promise<Response>)({})).json(),
		postLane: (body: unknown) => post(laneRoute, body),
		createPwa: (pwaId: string) =>
			send('CreatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, {
				pwaId,
				name: 'Lane',
				description: 'A DRAFT PWA.',
				domain: 'software',
				version: '1.0.0'
			}),
		/** ⛔ A FORGED PASS: a SATISFIED reasoning review completed by hand under a validator this lane does not run. */
		forgePass: (pwaId: string, assessmentId: string, validatorId = 'forged.reasoning-review') => {
			const assessment = {
				assessmentId,
				assurancePolicyId: RR,
				policyVersion: '1',
				subjectObjectIds: [pwaId],
				subjectSemanticVersions: { [pwaId]: 1 },
				claimIds: []
			};
			send('RequestAssuranceAssessment', 'ASSURANCE_ASSESSMENT', assessmentId, assessment);
			send('BeginAssuranceAssessment', 'ASSURANCE_ASSESSMENT', assessmentId, {});
			send('CompleteAssuranceAssessment', 'ASSURANCE_ASSESSMENT', assessmentId, {
				validatorResult: {
					validatorId,
					validatorVersion: '1',
					policyId: RR,
					policyVersion: '1',
					assessmentId,
					subjectObjectIds: [pwaId],
					subjectSemanticVersions: { [pwaId]: 1 },
					claimResults: [],
					evidenceConsideredIds: [pwaId],
					evidenceRejected: [],
					observations: [],
					dispositionRecommendation: 'SATISFIED',
					recommendedControlActions: [],
					residualUncertainty: [],
					limitations: [],
					executionProvenance: {
						evaluator: {
							actorId: 'forger',
							actorType: 'MODEL',
							displayName: 'Forger',
							modelId: 'forger-model'
						}
					}
				},
				producer: {
					actorId: 'producer',
					actorType: 'MODEL',
					displayName: 'Producer',
					modelId: 'producer-model'
				}
			});
		},
		/** A clean one-type draft reviewed on a real authoring turn, as the agent route reviews it. */
		reviewOnTurn: async (pwaId: string, print?: (prompt: string) => Promise<string>) => {
			const turn = turns.beginAuthoringTurn(pwaId);
			expect(turn.broker.defineType({ name: 'Plan', pwuKind: 'PLAN', isRoot: true }).ok).toBe(true);
			const subjectHash = turns.markAuthoringTurnValid(turn);
			const view = await floor.runPwaFloor(
				pwaId,
				{
					prompt: 'Author the plan.',
					producer: PRODUCER,
					candidateSubjectHash: subjectHash,
					...(print ? { print } : {})
				},
				turn.engine
			);
			return { turn, subjectHash, view: view! };
		}
	};
}

const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5W00';
const FORGED = 'assess_01ARZ3NDEKTSV4RRFFQ69G5W01';

describe('⭐ the server keeps the lane — each case a per-test fixture alone could not see (REG-D-072 D8)', () => {
	it('⛔ a run whose first spec NEVER RESETS: the boot mark falls after the seed, so the seed’s own passes are not the lane’s — and a second test is checked from ITS reset’s mark, not a stale one', async () => {
		const h = await host('reference');
		// THE ARRANGEMENT, ASSERTED: the reference seed holds positive reasoning reviews under a validator the lane
		// does not run. Without them a mark at 0 could not be told from a mark after the seed.
		const seedPasses = h.wb
			.getEngine()
			.readAllEvents()
			.filter(
				(e) =>
					e.eventType === 'AssuranceAssessmentCompleted' &&
					(e.payload as { assurancePolicyId?: string }).assurancePolicyId === RR
			);
		expect(
			seedPasses.length,
			'the reference seed records no reasoning review, so this proves nothing'
		).toBeGreaterThan(0);
		await h.announce('smoke › never resets');
		expect(
			await h.check('smoke › never resets'),
			'the seed was read as the lane’s — the boot mark is not after it'
		).toEqual([]);

		// ⭐ THE SECOND TEST, ON A FRESH ENGINE WHOSE IDS RESTART, IS READ FROM ITS OWN RESET'S MARK.
		const bootMark = h.wb.getEngine().readAllEvents().length;
		await h.announce('second › forges a pass');
		await h.reset('empty');
		h.createPwa(PWA);
		h.forgePass(PWA, FORGED);
		expect(
			h.wb.getEngine().readAllEvents().length,
			'arrangement: a stale mark would skip the whole new segment'
		).toBeLessThan(bootMark);
		expect(
			(await h.check('second › forges a pass')).map((v) => [v.limb, v.where, v.attributedTo])
		).toEqual([[2, 'canonical', ['second › forges a pass']]]);
		const final = await h.final();
		expect(final.marks.map((m) => m.openedBy)).toEqual(['boot', 'reset']);
		expect(final.violations).toHaveLength(1);
	}, 30_000);

	it('⛔ a violation that PASSES ON RETRY is still kept, and fails the run at the final call', async () => {
		const h = await host('empty');
		await h.announce('spec › flaky (attempt 1)');
		await h.reset('empty');
		h.createPwa(PWA);
		h.forgePass(PWA, FORGED);
		expect(await h.check('spec › flaky (attempt 1)')).toHaveLength(1);
		// The retry: a new reset, a new engine, a clean pass of the same test.
		await h.announce('spec › flaky (retry 1)');
		await h.reset('empty');
		h.createPwa(PWA);
		expect(await h.check('spec › flaky (retry 1)'), 'the retry itself is clean').toEqual([]);
		const final = await h.final();
		expect(final.violations.map((v) => [v.limb, v.attributedTo])).toEqual([
			[2, ['spec › flaky (attempt 1)']]
		]);
	});

	it('⛔ a floor that completes AFTER its test’s own check is caught by the next reset, before anything is discarded', async () => {
		const h = await host('empty');
		await h.announce('one › finishes late');
		await h.reset('empty');
		h.createPwa(PWA);
		expect(await h.check('one › finishes late'), 'nothing had completed yet').toEqual([]);
		h.forgePass(PWA, FORGED); // lands after the check — a server action outliving its test
		await h.announce('two › resets');
		await h.reset('empty');
		const final = await h.final();
		expect(final.violations.map((v) => [v.limb, v.seenAt, v.attributedTo])).toEqual([
			[2, 'reset', ['one › finishes late', 'two › resets']]
		]);
	});

	it('⛔ a STAGED candidate’s pass is read by the reset BEFORE the reset discards it', async () => {
		const h = await host('empty');
		await h.announce('stages › a real adapter clears everything');
		await h.reset('empty');
		h.createPwa(PWA);
		// The REG-F-435 / REG-F-441 shape: the real adapter selected, answered by a reply that clears every criterion.
		const criteria = (h.wb.getEngine().loadObject(RR)!.state as { criteria: { id: string }[] })
			.criteria;
		const { view } = await withLiveReviewerSeam(() =>
			h.reviewOnTurn(PWA, async () => clearingJudgement(criteria))
		);
		expect(view.satisfied, 'arrangement: the candidate passed its review').toBe(true);
		// No after-test check: only the reset can see the candidate now, and it must look before it discards.
		await h.announce('next › resets');
		await h.reset('empty');
		const final = await h.final();
		expect(final.violations.map((v) => [v.limb, v.where, v.seenAt])).toEqual([
			[2, `candidate of ${PWA}`, 'reset']
		]);
	});

	it('⭐ CONTROL — a registered clean draft, staged and then accepted, is what the lane may rest on; introspect shows the marks, the registry and what the candidate rests on', async () => {
		const h = await host('empty');
		await h.announce('honest › registered');
		await h.reset('empty');
		h.createPwa(PWA);
		h.registry.registerStipulation(h.wb.getEngine(), {
			pwaId: PWA,
			framing: 'PWA_GRAPH',
			remaining: 'CLEAN'
		});
		const { turn, subjectHash, view } = await h.reviewOnTurn(PWA);
		expect(view.satisfied, 'arrangement: the stand-in passed the registered draft').toBe(true);

		const snap = (await h.introspect()) as {
			stipulations: unknown[];
			lane: { marks: { openedBy: string }[] };
			authoringCandidates: {
				criterionEvents: {
					payload: { assessmentId: string; stipulated?: string; result: string };
				}[];
				completionEvents: {
					payload: {
						assessmentId: string;
						validatorId: string;
						assurancePolicyId: string;
						disposition: string;
					};
				}[];
			}[];
		};
		expect(snap.stipulations).toEqual([{ pwaId: PWA, framing: 'PWA_GRAPH', remaining: 'CLEAN' }]);
		expect(snap.lane.marks.map((m) => m.openedBy)).toEqual(['boot', 'reset']);
		const [staged] = snap.authoringCandidates;
		const review = staged!.completionEvents.filter((e) => e.payload.assurancePolicyId === RR);
		expect(review.map((e) => [e.payload.validatorId, e.payload.disposition])).toEqual([
			[STANDIN, 'SATISFIED']
		]);
		const rows = staged!.criterionEvents.filter(
			(e) => e.payload.assessmentId === review[0]!.payload.assessmentId
		);
		expect(
			rows.filter((e) => e.payload.stipulated === 'MET'),
			'the stipulated remainder'
		).toHaveLength(7);
		expect(
			rows.filter((e) => e.payload.stipulated === undefined && e.payload.result === 'MET'),
			'the checker’s own'
		).toHaveLength(2);

		expect(await h.check('honest › registered'), 'the staged candidate').toEqual([]);
		const committed = h.turns.commitAuthoringTurn(
			turn,
			h.turns.markAuthoringTurnAssured(turn, subjectHash)
		);
		expect(committed, JSON.stringify(committed)).toMatchObject({ ok: true });
		expect(await h.check('honest › registered'), 'the accepted, canonical record').toEqual([]);
		expect((await h.final()).violations).toEqual([]);
	});

	it('⛔ the route is test mode only — 404 on a server that exposes the harness, 422 on a body it does not know', async () => {
		const live = await host('empty', 'server', '1');
		await expect(live.postLane({ final: true })).rejects.toMatchObject({ status: 404 });
		const lane = await host('empty');
		await expect(lane.postLane({ nonsense: true })).rejects.toMatchObject({ status: 422 });
	});
});
