// JAN-VERIF V-2d — the ontology validator's NEGATIVE arms, which had never fired.
//
// HOW THIS WAS FOUND, and it is the whole point of V-2d. Chasing branch-coverage gaps, `ontology.ts` sat at 55%
// branch — the worst in the repo. The uncovered branches were every `issues.push(...)` in `validateOntology`:
// its five failure kinds. They were uncovered because the shipped ontology is well-formed AND because each check
// closed over module-level data, so the only ontology the validator could ever see was the good one.
//
// SO THE EXISTING ASSERTION WAS UNFALSIFIABLE. `ontology.test.ts` asserts `validateOntology()` reports no
// structural issues — which is satisfied equally by a working validator and by `return []`. A structural defect
// introduced into the ontology tomorrow would be reported by nothing. That is this programme's recurring shape
// (an instrument only ever observed green), reached from the coverage direction rather than the review direction.
//
// V-2d's DISCIPLINE, from DR-001 §4: an unreachable branch is DELETED or DECLARED, never coloured green. These
// were reachable in principle and unreachable in practice, which is a third case — and the repair is to make the
// subject injectable rather than to write a test that cannot fail.
import { describe, expect, it } from 'vitest';
import {
	conformanceProfiles,
	pwuTemplates,
	seedPolicies,
	validateOntology,
	type OntologySubject
} from './ontology.js';

/** The shipped ontology with one deliberate defect applied. */
const broken = (over: Partial<OntologySubject>): OntologySubject => ({
	pwuTemplates,
	seedPolicies,
	conformanceProfiles,
	...over
});

const kinds = (subject: OntologySubject) => validateOntology(subject).map((i) => i.kind);

describe('V-2d — every ontology failure kind is reachable and fires', () => {
	it('CONTROL: the SHIPPED ontology reports nothing — so each case below is the defect, not the baseline', () => {
		// Also the assertion the old suite made. Kept, because it is what the negative cases are measured against:
		// if this ever reported an issue, every expectation below would be ambiguous.
		expect(validateOntology()).toEqual([]);
		expect(validateOntology(broken({}))).toEqual([]);
	});

	it('ROOT_CARDINALITY fires on NO root template', () => {
		expect(kinds(broken({ pwuTemplates: pwuTemplates.filter((t) => !t.isRoot) }))).toContain(
			'ROOT_CARDINALITY'
		);
	});

	it('ROOT_CARDINALITY fires on TWO root templates — the rule is exactly one, not at least one', () => {
		// The half a `length === 0` check would miss. Two roots is the more dangerous shape: a PWA would load and
		// silently compose from whichever one the traversal reached first.
		const twoRoots = pwuTemplates.map((t) => ({ ...t, isRoot: true }));
		expect(kinds(broken({ pwuTemplates: twoRoots }))).toContain('ROOT_CARDINALITY');
	});

	it('POLICY_NO_CRITERIA fires on a policy with an empty criteria list', () => {
		const [first, ...rest] = seedPolicies;
		expect(kinds(broken({ seedPolicies: [{ ...first!, criteria: [] }, ...rest] }))).toContain(
			'POLICY_NO_CRITERIA'
		);
	});

	it('POLICY_NO_INDEPENDENCE fires when the independence requirement is missing', () => {
		const [first, ...rest] = seedPolicies;
		expect(
			kinds(
				broken({
					seedPolicies: [{ ...first!, independenceRequirement: undefined as never }, ...rest]
				})
			)
		).toContain('POLICY_NO_INDEPENDENCE');
	});

	it('POLICY_NO_SEVERITY fires when the failure severity is missing', () => {
		const [first, ...rest] = seedPolicies;
		expect(
			kinds(broken({ seedPolicies: [{ ...first!, failureSeverity: undefined as never }, ...rest] }))
		).toContain('POLICY_NO_SEVERITY');
	});

	it('TEMPLATE_UNKNOWN_POLICY fires when a template names a policy that does not exist', () => {
		const [first, ...rest] = pwuTemplates;
		expect(
			kinds(
				broken({
					pwuTemplates: [{ ...first!, defaultPolicyIds: ['pol_does_not_exist'] }, ...rest]
				})
			)
		).toContain('TEMPLATE_UNKNOWN_POLICY');
	});

	it('PROFILE_UNKNOWN_POLICY fires when a conformance profile names a policy that does not exist', () => {
		const [first, ...rest] = conformanceProfiles;
		expect(
			kinds(
				broken({
					conformanceProfiles: [{ ...first!, mandatoryPolicyIds: ['pol_does_not_exist'] }, ...rest]
				})
			)
		).toContain('PROFILE_UNKNOWN_POLICY');
	});

	it('resolves references WITHIN the subject, not against the shipped policies', () => {
		// The trap the parameterisation could easily have walked into: if the reference checks had kept calling the
		// module-level `getSeedPolicy`, a subject whose policies were REMOVED would still validate clean, because
		// its templates would resolve against the shipped set. A broken ontology would then look partly fine —
		// worse than not checking, because it reports a verdict it did not earn.
		const noPolicies = broken({ seedPolicies: [] });
		const reported = kinds(noPolicies);
		expect(reported).toContain('TEMPLATE_UNKNOWN_POLICY');
		expect(reported).toContain('PROFILE_UNKNOWN_POLICY');
	});

	it('reports EVERY offending policy, not just the first — one fix per report, not one report per fix', () => {
		const stripped = seedPolicies.map((p) => ({ ...p, criteria: [] }));
		const reported = kinds(broken({ seedPolicies: stripped })).filter(
			(k) => k === 'POLICY_NO_CRITERIA'
		);
		expect(reported.length).toBe(seedPolicies.length);
	});
});
