// THE EXCLUSION BRANCHES, EXERCISED — REG-F-029 review finding (b).
//
// ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────────────────────────────────────────
// The selector was landed with the claim that the drive passes the §5.1 precondition "BY CONSTRUCTION, not by
// coincidence", because the drive and the handler run the same kernel over the same data. An adversarial review
// then measured V8 branch coverage over BOTH drive paths and found every exclusion branch at **count = 0**:
// 15/15 and 8/8 selections returned true, the NOT_APPLICABLE arm never ran, the ABSENT and NOT_ACTIVE arms never
// ran, and the empty-selection throw never fired.
//
// So the DETERMINED half was an identity function on every input it had ever had. Stubbing `policyApplicability`
// to always-permit would not have changed either drive — which is the precise definition of a check that agrees
// with itself, and the failure mode this repository names most often. "By construction" was a claim about a
// branch nothing had executed.
//
// This file executes them, against the REAL seeded workbench rather than a hand-built fixture, so what it proves
// is a property of the shipping data and not of a mock.
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { beforeAll, describe, expect, it } from 'vitest';
import { createEngine, type EngineHandle } from './index.js';
import { requireGoverningPolicies, selectGoverningPolicies } from './governing-policies.js';
import { REFERENCE_UNDERTAKING } from './reference-undertaking.js';
import { seedWorkbench } from './seed-workbench.js';

describe('selectGoverningPolicies — the exclusions actually fire (REG-F-029 review finding (b))', () => {
	let engine: EngineHandle;

	beforeAll(() => {
		let n = 0;
		engine = createEngine({
			ontology,
			now: () => '2026-08-05T00:00:00Z',
			newEventId: () => `evt_${++n}`
		});
		seedWorkbench(engine);
	});

	it('EXCLUDES a declared policy whose §5.1 rule refuses the subject — on the real seeded data', () => {
		// THE ROOT PWU IS THE CASE, and it is the one the original claim cited without ever running: the ontology's
		// PRODUCT_REALIZATION template declares `pol_baseline_promotion`, and that policy scopes itself to
		// PRODUCT_BASELINE_PROMOTION. The drive never assesses the root, so this contradiction has always been in
		// the data and never once passed through the selector.
		const { selected, excluded, declared } = selectGoverningPolicies(
			engine,
			REFERENCE_UNDERTAKING.root
		);
		expect(
			declared.length,
			'the root must declare policies, or this test proves nothing'
		).toBeGreaterThan(1);
		expect(
			excluded.map((e) => e.policyId),
			'the declared-but-inapplicable policy must be EXCLUDED, with a reason'
		).toEqual(['pol_baseline_promotion']);
		expect(excluded[0]!.reason).toBe('NOT_APPLICABLE');
		expect(
			selected,
			'and the rest must survive — the exclusion is one policy, not a collapse'
		).not.toContain('pol_baseline_promotion');
		expect(selected.length).toBe(declared.length - 1);
	});

	it('CONTROL: an ASSESSED PWU excludes nothing — the exclusion above is the data, not the selector', () => {
		// If the selector excluded on every subject, the assertion above would be meaningless. The eight PWUs the
		// drive assesses select their full declared set; that is why the drive is green and why this branch had
		// never run.
		const { selected, excluded, declared } = selectGoverningPolicies(
			engine,
			REFERENCE_UNDERTAKING.architecture
		);
		expect(excluded).toEqual([]);
		expect(selected.length).toBe(declared.length);
		expect(declared.length, 'architecture declares four policies').toBeGreaterThan(1);
	});

	it('EXCLUDES a policy that is DECLARED but ABSENT from the store, naming it and the reason', () => {
		// A silent skip here would let a PWU be assessed under a set smaller than it declares, with nothing
		// recorded — the declaration would say four policies govern this work and the engine would run three.
		const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5X01';
		let n = 0;
		engine.dispatch({
			commandId: 'gp-1',
			commandType: 'ProposePwu',
			commandSchemaVersion: 1,
			targetAggregateType: 'PROFESSIONAL_WORK_UNIT',
			targetAggregateId: PWU,
			issuedAt: '2026-08-05T00:00:00Z',
			issuedBy: { actorId: 'gp', actorType: 'HUMAN', displayName: 'GP' },
			correlationId: 'gp',
			idempotencyKey: `gp-idem-${++n}`,
			payload: {
				pwuId: PWU,
				pwuKind: 'ARCHITECTURE_DEFINITION',
				title: 'T',
				description: 'd',
				intentId: REFERENCE_UNDERTAKING.intentId,
				boundaries: { inScope: [], outOfScope: [], permittedChanges: [], prohibitedChanges: [] },
				obligationIds: [],
				constraintIds: [],
				assumptionIds: [],
				expectedOutputs: [],
				// One real, one that was never created.
				assurancePolicyIds: ['pol_architecture_coverage', 'pol_never_created'],
				riskProfile: {
					consequence: 'LOW',
					uncertainty: 'LOW',
					irreversibility: 'LOW',
					securitySensitivity: 'NONE',
					regulatoryExposure: 'NONE'
				}
			}
		});
		const { selected, excluded } = selectGoverningPolicies(engine, PWU);
		expect(selected).toEqual(['pol_architecture_coverage']);
		expect(excluded.map((e) => e.policyId)).toEqual(['pol_never_created']);
		expect(excluded[0]!.reason).toContain('ABSENT');
	});

	it('the empty-selection path is a LOUD failure, not an empty array', () => {
		// `requireGoverningPolicies` is what the drive calls. A PWU nothing can assess must not silently proceed —
		// it would surface later as a missing assessment, or as a PWU driven to SATISFIED with nothing behind it.
		expect(() => requireGoverningPolicies(engine, 'pwu_01ARZ3NDEKTSV4RRFFQ69G5X99')).toThrow(
			/No policy governs/
		);
	});
});

describe('a promotion cites EVERY assessment that permitted it (REG-F-029 review finding (d))', () => {
	it('the seeded baselines carry the whole governing set, not the first of it', () => {
		// §24 asks a promotion to carry its required assessments. `driveToSatisfied` returned ONE assessment id —
		// the primary — so `assuranceAssessmentIds` named 1 of 3 and 1 of 4: the promotion gate verified a single
		// policy's verdict and took the other governing policies on trust, at the one moment the corpus asks for
		// them. Counts read from the committed EVENT, keyed by the event's OWN field name.
		//
		// (The first probe of this used the COMMAND's field name, `requiredAssessmentIds`, against the EVENT —
		// which carries `assuranceAssessmentIds` — and reported 0 for both. A blind reader, one more time; the
		// numbers below are from the field the event actually has.)
		let n = 0;
		const engine = createEngine({
			ontology,
			now: () => '2026-08-05T00:00:00Z',
			newEventId: () => `evt_${++n}`
		});
		seedWorkbench(engine);
		const cited = engine
			.readAllEvents()
			.filter((e) => e.eventType === 'BaselinePromoted')
			.map((e) => {
				const p = e.payload as { baselineType?: string; assuranceAssessmentIds?: string[] };
				return { type: p.baselineType, count: (p.assuranceAssessmentIds ?? []).length };
			});
		expect(cited, 'the drive promotes two baselines').toHaveLength(2);
		expect(cited).toEqual([
			{ type: 'INTENT', count: 3 },
			{ type: 'ARCHITECTURE', count: 4 }
		]);
		// CONTROL: those counts must equal what the SELECTOR says governs each subject, or the promotion is
		// citing a set unrelated to the determination that produced it.
		expect(selectGoverningPolicies(engine, REFERENCE_UNDERTAKING.intentDef).selected).toHaveLength(
			3
		);
		expect(
			selectGoverningPolicies(engine, REFERENCE_UNDERTAKING.architecture).selected
		).toHaveLength(4);
	});
});
