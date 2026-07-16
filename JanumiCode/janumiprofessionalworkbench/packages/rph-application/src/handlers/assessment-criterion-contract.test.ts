// The AssurancePolicy's criteria are the RATIFIED DOC-004 §7 AssessmentCriterion — and the contract ENFORCES it.
//
// WHAT THIS LOCKS, and why it is the point of the whole increment. `AssurancePolicy.criteria` was
// `z.array(z.record(z.string(), z.unknown()))` and the CreateAssurancePolicy payload was weaker still —
// `z.array(z.unknown())`, literally anything. So the codebase invented `{id, statement, mandatory}`: NO overlap
// with the ratified shape beyond `id`, and a FIVE-level `severityIfNotMet` collapsed into a Boolean — the same
// disease §16 item 12 names for waivers ("Never implement waiver as a Boolean"). Four independent restatements
// of the invented shape existed (floor-policies.ts, ontology.ts, seed-workbench.ts, broker.ts) and nothing
// could detect the divergence, because the type said nothing.
//
// That is the MECHANISM behind the governed layer being a projection of code rather than its source: a policy
// object cannot be read by the runtime if its fields are `any`. See docs/_working/AUDIT-placeholder-helpers.md.
//
// These tests fail if anyone loosens the schema back, and they are written from the ATTACKER's side: the first
// one is the exact payload the codebase shipped for its whole life.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-16T00:00:00Z';
const HUMAN: ActorReference = { actorId: 'u1', actorType: 'HUMAN', displayName: 'Author' };
const POL = 'pol_criterion_contract';

/** The RATIFIED shape — DOC-004 §7, all 8 fields. */
const RATIFIED_CRITERION = {
	id: 'C-01',
	name: 'Tenant isolation',
	description: 'Tenant data is isolated.',
	criterionType: 'BOOLEAN',
	evaluationMethod: 'MODEL_JUDGMENT',
	requiredEvidenceIds: [],
	severityIfNotMet: 'BLOCKING',
	mayBeNotApplicable: false
};

/** The INVENTED shape the codebase shipped: no ratified document defines `statement` or `mandatory`. */
const INVENTED_CRITERION = { id: 'C-01', statement: 'Tenant data is isolated.', mandatory: true };

describe('AssessmentCriterion (DOC-004 §7) is enforced, not merely documented', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ store, now: () => TS, newEventId: () => `e${++seq}` });
	});

	function createPolicy(criteria: unknown[], id = POL) {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType: 'CreateAssurancePolicy',
			commandSchemaVersion: 1,
			targetAggregateType: 'ASSURANCE_POLICY',
			targetAggregateId: id,
			issuedAt: TS,
			issuedBy: HUMAN,
			correlationId: 'corr',
			idempotencyKey: `k-${n}`,
			payload: {
				policyId: id,
				version: '1.0.0',
				name: 'Tenant Isolation Review',
				purpose: 'p',
				rationale: 'r',
				applicableObjectTypes: ['PROFESSIONAL_WORK_UNIT'],
				evaluatedClaimTypes: ['CORRECTNESS'],
				criteria,
				evaluatorRole: 'reviewer',
				independenceRequirement: 'DIFFERENT_AGENT',
				findingDefinitions: [],
				permittedControlActions: ['ESCALATE']
			}
		};
		return engine.dispatch(command);
	}

	it('accepts a policy whose criteria carry the ratified 8 fields', () => {
		const r = createPolicy([RATIFIED_CRITERION]);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		const stored = (store.loadObject(POL)!.state as { criteria: unknown[] }).criteria;
		expect(stored).toEqual([RATIFIED_CRITERION]);
	});

	it('REJECTS the invented {id, statement, mandatory} shape — the payload this codebase shipped for its whole life', () => {
		// THE REGRESSION LOCK. This exact object was written by four separate call sites and accepted by the
		// engine every time. If this test ever passes an ACCEPTED again, the schema has been loosened back to
		// `unknown` and the governed layer is hollow again.
		const r = createPolicy([INVENTED_CRITERION]);
		expect(r.status).toBe('VALIDATION_FAILED');
		expect(store.loadObject(POL), 'nothing is persisted').toBeUndefined();
	});

	it('rejects a criterion missing severityIfNotMet — the field `mandatory` was standing in for', () => {
		const { severityIfNotMet: _dropped, ...withoutSeverity } = RATIFIED_CRITERION;
		expect(createPolicy([withoutSeverity]).status).toBe('VALIDATION_FAILED');
	});

	it('rejects a severity outside DOC-004 §7’s five levels', () => {
		// The ratified ladder is INFORMATIONAL|ADVISORY|MATERIAL|BLOCKING|CRITICAL. `true` is not a severity —
		// which is precisely what `mandatory: boolean` was asserting.
		expect(createPolicy([{ ...RATIFIED_CRITERION, severityIfNotMet: 'VERY_BAD' }]).status).toBe(
			'VALIDATION_FAILED'
		);
	});

	it('rejects an unknown extra key — a criterion cannot smuggle un-ratified fields alongside', () => {
		// strictObject: this is what stops the invented shape being re-added *next to* the ratified one, which
		// is how a divergence would otherwise creep back in without failing anything.
		expect(createPolicy([{ ...RATIFIED_CRITERION, mandatory: true }]).status).toBe(
			'VALIDATION_FAILED'
		);
	});

	it('rejects a criterionType / evaluationMethod outside the ratified enums', () => {
		expect(createPolicy([{ ...RATIFIED_CRITERION, criterionType: 'FREEFORM' }]).status).toBe(
			'VALIDATION_FAILED'
		);
		expect(createPolicy([{ ...RATIFIED_CRITERION, evaluationMethod: 'VIBES' }]).status).toBe(
			'VALIDATION_FAILED'
		);
	});

	it('preserves the old `mandatory: false` semantics as ADVISORY, not MATERIAL', () => {
		// The migration maps mandatory:false -> ADVISORY. It must NOT be MATERIAL: assurance-rules maps an open
		// MATERIAL finding to CONDITIONALLY_SATISFIED, whereas a non-mandatory criterion was filtered out of the
		// disposition entirely. ADVISORY is the level that preserves "does not affect the disposition".
		const r = createPolicy([{ ...RATIFIED_CRITERION, severityIfNotMet: 'ADVISORY' }]);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
	});
});
