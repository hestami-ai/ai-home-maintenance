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

// ── ⭐⭐ `JAN-EXEC` Phase 7, package L17b2 — design D78 (`REG-D-166` (3)) ─────────────────────────────────────────────────────────────
// THE HISTORIAN'S KINDS EMPTIED, AND THE SEED'S OWN ACCOUNT OF THE FIELD RESTATED. Each catalog policy's `sourceSection` counts
// `appliesToPwuKinds` among its fields "AUTHORED (no ratified source)". For `pol_historical_consistency` that is no longer so: its
// kinds are empty by the sponsor's ruling, so its account strikes the field in that list, in place, and says what ruled it and why.
// ⭑ CONTROL: every other catalog policy keeps its kinds, and still counts them authored.
const AUTHORED_CLAUSE = (sourceSection: string): string => {
	const from = sourceSection.indexOf('AUTHORED (no ratified source): ');
	const to = sourceSection.indexOf(' (DOC-004 §9.1', from);
	return from < 0 || to < 0 ? '' : sourceSection.slice(from, to);
};
const sourceSectionOf = (policyId: string): string => (getSeedPolicy(policyId) as { sourceSection?: string } | undefined)?.sourceSection ?? '';
const D78_RULED =
	"RULED appliesToPwuKinds (REG-D-166 (3), 2026-11-16; design D78): EMPTY, so the policy governs every kind of unit and the harness can assess a rejected unit of any kind under it. It replaces the authored ['ARCHITECTURE_DECISION'], struck from the AUTHORED list above.";

describe('⭐⭐ L17b2 (D78) — the seeded Historian governs every kind of unit, and its account of the field says so', () => {
	it('⛔ RED FIRST — pol_historical_consistency’s kinds are empty, its account strikes the field among the authored ones, in place, and states the ruling', () => {
		const historian = getSeedPolicy('pol_historical_consistency')!;
		const clause = AUTHORED_CLAUSE(sourceSectionOf('pol_historical_consistency'));
		expect(clause, 'arrangement: the account has its AUTHORED clause').not.toBe('');
		expect.soft(historian.appliesToPwuKinds ?? [], 'its kinds').toEqual([]);
		expect.soft(clause, 'the field struck in place in the AUTHORED list').toContain('~~appliesToPwuKinds~~');
		expect.soft(clause.replaceAll('~~appliesToPwuKinds~~', ''), 'the field still counted authored').not.toContain('appliesToPwuKinds');
		expect.soft(sourceSectionOf('pol_historical_consistency'), 'the ruling stated').toContain(D78_RULED);
	});

	it('⭑ CONTROL — every other catalog policy keeps its kinds, and still counts them authored, unstruck; none states D78’s ruling', () => {
		const others = seedPolicies.filter((p) => p.policyId !== 'pol_historical_consistency');
		expect(others, 'arrangement: the eleven').toHaveLength(11);
		for (const p of others) {
			const clause = AUTHORED_CLAUSE(sourceSectionOf(p.policyId));
			expect.soft((p.appliesToPwuKinds ?? []).length, `${p.policyId}: its kinds`).toBeGreaterThan(0);
			expect.soft(clause, `${p.policyId}: the field counted authored`).toContain('appliesToPwuKinds');
			expect.soft(clause, `${p.policyId}: the field struck`).not.toContain('~~appliesToPwuKinds~~');
			expect.soft(sourceSectionOf(p.policyId), `${p.policyId}: D78’s ruling stated`).not.toContain('REG-D-166 (3)');
		}
	});
});
