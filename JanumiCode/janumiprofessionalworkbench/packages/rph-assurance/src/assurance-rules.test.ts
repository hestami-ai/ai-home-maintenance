import { describe, expect, it } from 'vitest';
import {
	aggregateDisposition,
	checkIndependence,
	classifyValidatorResult,
	dispositionFromFindings,
	evidenceAdmissibility,
	isWaiverApplicable
} from './assurance-rules.js';

describe('dispositionFromFindings (§10.3 ladder)', () => {
	const met = { mandatory: true, outcome: 'MET' as const };
	it('SATISFIED when all mandatory criteria met and no blocking findings', () => {
		expect(dispositionFromFindings({ findings: [], criteria: [met, met] })).toBe('SATISFIED');
	});
	it('Test 3: a blocking finding forces REJECTED even if criteria are met (service overrides SATISFIED)', () => {
		expect(
			dispositionFromFindings({ findings: [{ severity: 'BLOCKING', open: true }], criteria: [met] })
		).toBe('REJECTED');
	});
	it('a CRITICAL open finding forces REJECTED', () => {
		expect(
			dispositionFromFindings({ findings: [{ severity: 'CRITICAL', open: true }], criteria: [met] })
		).toBe('REJECTED');
	});
	it('UNABLE_TO_DETERMINE on a mandatory criterion is INCONCLUSIVE, never a pass (Inv-6)', () => {
		expect(
			dispositionFromFindings({
				findings: [],
				criteria: [{ mandatory: true, outcome: 'UNABLE_TO_DETERMINE' }]
			})
		).toBe('INCONCLUSIVE');
	});
	it('a MATERIAL finding or a partially-met mandatory criterion is CONDITIONALLY_SATISFIED', () => {
		expect(
			dispositionFromFindings({ findings: [{ severity: 'MATERIAL', open: true }], criteria: [met] })
		).toBe('CONDITIONALLY_SATISFIED');
		expect(
			dispositionFromFindings({
				findings: [],
				criteria: [{ mandatory: true, outcome: 'PARTIALLY_MET' }]
			})
		).toBe('CONDITIONALLY_SATISFIED');
	});
	it('evidence deficit is INCONCLUSIVE', () => {
		expect(dispositionFromFindings({ findings: [], criteria: [met], evidenceDeficit: true })).toBe(
			'INCONCLUSIVE'
		);
	});
});

describe('aggregateDisposition — strictest unresolved, NEVER a numeric average (§28.2 / Inv-17)', () => {
	it('a rejected required policy dominates a satisfied one (not averaged)', () => {
		expect(
			aggregateDisposition([
				{ required: true, disposition: 'SATISFIED' },
				{ required: true, disposition: 'REJECTED' }
			])
		).toBe('REJECTED');
	});
	it('SATISFIED only when every required policy is satisfied or waived', () => {
		expect(
			aggregateDisposition([
				{ required: true, disposition: 'SATISFIED' },
				{ required: true, disposition: 'WAIVED' }
			])
		).toBe('SATISFIED');
	});
	it('a rejected ADVISORY (non-required) policy does not gate the aggregate', () => {
		expect(
			aggregateDisposition([
				{ required: true, disposition: 'SATISFIED' },
				{ required: false, disposition: 'REJECTED' }
			])
		).toBe('SATISFIED');
	});
	it('a conditional required policy yields CONDITIONALLY_SATISFIED; a missing one yields UNASSESSED', () => {
		expect(aggregateDisposition([{ required: true, disposition: 'CONDITIONALLY_SATISFIED' }])).toBe(
			'CONDITIONALLY_SATISFIED'
		);
		expect(aggregateDisposition([{ required: true, disposition: 'MISSING' }])).toBe('UNASSESSED');
	});
});

describe('evidenceAdmissibility (§6.2, 8 conditions)', () => {
	const good = {
		id: 'evd_1',
		provenance: {},
		contentReference: 'ref',
		scope: 'unit',
		limitations: [],
		status: 'ADMISSIBLE',
		supportsClaimIds: ['clm_1']
	};
	it('admits fully-specified admissible evidence', () => {
		expect(evidenceAdmissibility(good, { claimId: 'clm_1' }).admissible).toBe(true);
	});
	it('rejects invalidated evidence', () => {
		expect(evidenceAdmissibility({ ...good, status: 'INVALIDATED' }).failed).toContain(
			'NOT_INVALIDATED'
		);
	});
	it('rejects evidence missing scope or unrecorded limitations', () => {
		expect(evidenceAdmissibility({ ...good, scope: undefined }).admissible).toBe(false);
		expect(evidenceAdmissibility({ ...good, limitations: undefined }).failed).toContain(
			'LIMITATIONS_RECORDED'
		);
	});
	it('rejects evidence not relevant to the assessed claim', () => {
		expect(evidenceAdmissibility(good, { claimId: 'clm_other' }).failed).toContain('RELEVANT');
	});
});

describe('checkIndependence (§8, multi-dimensional)', () => {
	it('Test 1: DIFFERENT_MODEL is violated when producer and evaluator share a model', () => {
		expect(
			checkIndependence('DIFFERENT_MODEL', { modelId: 'm1' }, { modelId: 'm1' }).independent
		).toBe(false);
		expect(
			checkIndependence('DIFFERENT_MODEL', { modelId: 'm1' }, { modelId: 'm2' }).independent
		).toBe(true);
	});
	it('HUMAN requires a human evaluator; ORGANIZATIONALLY_INDEPENDENT requires different orgs', () => {
		expect(checkIndependence('HUMAN', {}, { actorType: 'AGENT' }).independent).toBe(false);
		expect(checkIndependence('HUMAN', {}, { actorType: 'HUMAN' }).independent).toBe(true);
		expect(
			checkIndependence('ORGANIZATIONALLY_INDEPENDENT', { orgId: 'o1' }, { orgId: 'o1' })
				.independent
		).toBe(false);
	});
});

describe('isWaiverApplicable — exact policy+criterion+object+version binding (Test 7 / Inv-14)', () => {
	const w = { policyId: 'pol_1', criterionId: 'cr_1', objectId: 'pwu_1', objectSemanticVersion: 2 };
	it('applies to the exact bound scope', () => {
		expect(isWaiverApplicable(w, { ...w })).toBe(true);
	});
	it('does NOT apply to a later semantic version (v2 waiver does not cover v3)', () => {
		expect(isWaiverApplicable(w, { ...w, objectSemanticVersion: 3 })).toBe(false);
	});
});

describe('classifyValidatorResult (§34 / Inv-9/10)', () => {
	const valid = {
		schemaValid: true,
		policyVersionMatches: true,
		subjectVersionMatches: true,
		requiredCriteriaPresent: true,
		evidenceExists: true,
		evidenceInvalidated: false,
		independenceSatisfied: true
	};
	it('a validator execution failure is VALIDATOR_FAILED, never a REJECTED disposition', () => {
		expect(classifyValidatorResult({ ...valid, executionFailed: true }).klass).toBe(
			'VALIDATOR_FAILED'
		);
	});
	it('malformed output / version mismatch / missing-or-invalid evidence / independence = BOUNDARY_REJECTED', () => {
		expect(classifyValidatorResult({ ...valid, schemaValid: false }).klass).toBe(
			'BOUNDARY_REJECTED'
		);
		expect(classifyValidatorResult({ ...valid, subjectVersionMatches: false }).reason).toBe(
			'RPH_SUBJECT_VERSION_MISMATCH'
		);
		expect(classifyValidatorResult({ ...valid, evidenceInvalidated: true }).reason).toBe(
			'RPH_EVIDENCE_INVALIDATED'
		);
		expect(classifyValidatorResult({ ...valid, independenceSatisfied: false }).reason).toBe(
			'RPH_VALIDATOR_INDEPENDENCE_VIOLATION'
		);
	});
	it('a SATISFIED recommendation with an unmet mandatory criterion is rejected at the boundary', () => {
		expect(
			classifyValidatorResult({
				...valid,
				recommendation: 'SATISFIED',
				mandatoryCriterionUnmet: true
			}).klass
		).toBe('BOUNDARY_REJECTED');
	});
	it('a coherent result is VALID (then subject to disposition on its merits)', () => {
		expect(classifyValidatorResult(valid).klass).toBe('VALID');
	});
});
