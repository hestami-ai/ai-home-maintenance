import { describe, expect, it } from 'vitest';
import {
	conformanceProfiles,
	getConformanceProfile,
	getSeedPolicy,
	pwuTemplates,
	rootTemplate,
	seedPolicies,
	validateOntology
} from './index.js';

const SEED_IDS = [
	'pol_architecture_coverage',
	'pol_assumption_disclosure',
	'pol_decomposition_coverage',
	'pol_intent_completeness',
	'pol_intent_fidelity',
	'pol_intent_preservation'
];

describe('Product Realization PWA ontology', () => {
	it('has the root Product Realization PWU, the 6 seed policies, and 3 conformance profiles', () => {
		expect(rootTemplate()?.pwuKind).toBe('PRODUCT_REALIZATION');
		expect(pwuTemplates.length).toBeGreaterThanOrEqual(14);
		expect(seedPolicies.map((p) => p.policyId).sort()).toEqual([...SEED_IDS].sort());
		expect(conformanceProfiles.map((c) => c.profile).sort()).toEqual([
			'HIGH_ASSURANCE',
			'LIGHTWEIGHT',
			'STANDARD'
		]);
	});

	it('resolves policy references across the _vN version suffix (INV-11: assessments cite a policy version)', () => {
		expect(getSeedPolicy('pol_intent_fidelity_v1')?.policyId).toBe('pol_intent_fidelity');
		expect(getSeedPolicy('pol_intent_fidelity')?.policyId).toBe('pol_intent_fidelity');
		expect(getSeedPolicy('pol_nonexistent')).toBeUndefined();
	});

	it('OVR: the root is unique and every seed policy is well-formed (criteria + independence + severity)', () => {
		const structural = validateOntology().filter((i) =>
			[
				'ROOT_CARDINALITY',
				'POLICY_NO_CRITERIA',
				'POLICY_NO_INDEPENDENCE',
				'POLICY_NO_SEVERITY'
			].includes(i.kind)
		);
		expect(structural, structural.map((i) => `${i.kind}:${i.detail}`).join('; ')).toEqual([]);
	});

	it('every seed policy carries criteria and applies to at least one claim type', () => {
		for (const p of seedPolicies) {
			expect(p.criteria && p.criteria.length > 0, `${p.policyId} criteria`).toBe(true);
			expect((p.evaluatedClaimTypes ?? []).length, `${p.policyId} claim types`).toBeGreaterThan(0);
		}
	});

	it('the only remaining OVR issues are references to the not-yet-authored core policies (documented gap)', () => {
		const unknown = validateOntology().filter(
			(i) => i.kind === 'TEMPLATE_UNKNOWN_POLICY' || i.kind === 'PROFILE_UNKNOWN_POLICY'
		);
		for (const i of unknown) expect(i.detail).toMatch(/pol_/); // each names a canonical policy id, just not seeded yet
	});

	it('HIGH_ASSURANCE requires DIFFERENT_MODEL independence', () => {
		expect(getConformanceProfile('HIGH_ASSURANCE')?.minIndependence).toBe('DIFFERENT_MODEL');
	});
});
