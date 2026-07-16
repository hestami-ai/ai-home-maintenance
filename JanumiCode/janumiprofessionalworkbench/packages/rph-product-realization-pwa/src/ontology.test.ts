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

// DOC-004's COMPLETE catalog — all 12 policies (§15-§26). Was 6: the ratified conformance profiles and PWU
// templates referenced 12 while the ontology shipped half, so validateOntology() reported 21 unresolved
// references and HIGH_ASSURANCE — the profile for security-sensitive, regulated, hard-to-reverse work — named
// 12 mandatory policies of which 6 did not exist. Completed 2026-07-16 on the sponsor's decision.
const SEED_IDS = [
	'pol_architecture_coverage',
	'pol_assumption_disclosure',
	'pol_baseline_promotion',
	'pol_constraint_propagation',
	'pol_decomposition_coverage',
	'pol_fitness_for_purpose',
	'pol_historical_consistency',
	'pol_intent_completeness',
	'pol_intent_fidelity',
	'pol_intent_preservation',
	'pol_requirement_coverage',
	'pol_test_adequacy'
];

describe('Product Realization PWA ontology', () => {
	it('has the root Product Realization PWU, DOC-004’s 12 seed policies, and 3 conformance profiles', () => {
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

	it('the ontology is OVR-CLEAN — every profile + template policy reference resolves', () => {
		// This test used to read: "the only remaining OVR issues are references to the not-yet-authored core
		// policies (documented gap)", and asserted only that each unresolved reference NAMED a pol_ id. It
		// accepted 21 issues. The gap is closed, so the assertion is now the real one: ZERO.
		//
		// This is what lets `createEngine` run the OVR for real — it throws on ANY issue, so the check could not
		// be wired while 21 existed. The composition root now injects validateOntology (workbench.ts), which
		// means deleting a policy, or referencing one that does not exist from a profile or template, fails
		// engine construction instead of silently producing an unsatisfiable profile.
		const issues = validateOntology();
		expect(issues, issues.map((i) => `${i.kind}:${i.detail}`).join('; ')).toEqual([]);
	});

	it('HIGH_ASSURANCE requires DIFFERENT_MODEL independence', () => {
		expect(getConformanceProfile('HIGH_ASSURANCE')?.minIndependence).toBe('DIFFERENT_MODEL');
	});
});
