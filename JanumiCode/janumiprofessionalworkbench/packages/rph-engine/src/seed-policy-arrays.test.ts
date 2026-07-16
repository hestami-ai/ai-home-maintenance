// The seeded policies carry DOC-004's ratified SETS, not a collapsed single value.
//
// WHAT THIS LOCKS. DOC-004 §3.1, DOC-007 and DOC-002 §17.1 all declare `evaluatedClaimTypes: ClaimType[]`,
// `applicableObjectTypes: ProfessionalWorkObjectType[]` and `permittedControlActions: ControlAction[]`. The
// contract emitted all three as SCALARS because BOTH generators (gen-objects.ts and gen-messages.ts) had the
// same bug: `if (enumRef) return …` sat above the `t.endsWith('[]')` check, so any field carrying an enumRef
// silently lost its array. The vocab was right all along (`"type": "ControlAction[]"`).
//
// The consequence was not cosmetic: DOC-004 ratifies a SET of permitted control actions per policy, and every
// seeded policy could hold exactly one. A policy permitting {CLARIFY, REJECT} was unrepresentable.
//
// These tests read the SEEDED OBJECTS out of a live engine — not the source literals — so they prove the sets
// survive the wire (CreateAssurancePolicy payload) and the object schema, which is where the collapse happened.
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { describe, expect, it } from 'vitest';
import { createEngine, getObject } from './index.js';
import { seedAdditivePolicies, seedFloorPolicies } from './seed-workbench.js';

function seeded() {
	let n = 0;
	const engine = createEngine({
		ontology,
		now: () => '2026-07-16T00:00:00Z',
		newEventId: () => `e${++n}`
	});
	seedFloorPolicies(engine);
	seedAdditivePolicies(engine);
	return (id: string) => getObject(engine, id);
}

describe("seeded policies carry DOC-004's ratified sets", () => {
	const load = seeded();

	it('every seeded policy stores the three ratified fields as ARRAYS', () => {
		for (const id of [
			'floor.schema-invariant',
			'floor.identity-provenance',
			'floor.reasoning-review',
			'pol_intent_fidelity',
			'pol_intent_completeness',
			'pol_assumption_disclosure',
			'pol_decomposition_coverage',
			'pol_architecture_coverage',
			'pol_intent_preservation'
		]) {
			const s = load(id);
			expect(s, `${id} seeded`).toBeDefined();
			expect(Array.isArray(s!.applicableObjectTypes), `${id}.applicableObjectTypes`).toBe(true);
			expect(Array.isArray(s!.evaluatedClaimTypes), `${id}.evaluatedClaimTypes`).toBe(true);
			expect(Array.isArray(s!.permittedControlActions), `${id}.permittedControlActions`).toBe(true);
		}
	});

	// The four policies whose control actions DOC-004 ratifies, transcribed byte-for-byte from the doc.
	// §16 (POL-INTENT-COMPLETENESS) and §21 (POL-ARCHITECTURE-COVERAGE) have NO control-actions subsection —
	// verified by direct search of §16.1-16.6 and §21.1-21.6 — so their single values stay, unratified.
	it('pol_intent_fidelity permits DOC-004 §15.10’s five actions, not one', () => {
		expect(load('pol_intent_fidelity')!.permittedControlActions).toEqual([
			'CLARIFY',
			'REVISE_CONTEXT',
			'RESHAPE_PWU',
			'REQUEST_HUMAN_DECISION',
			'REJECT'
		]);
	});

	it('pol_assumption_disclosure permits DOC-004 §17.8’s six actions', () => {
		expect(load('pol_assumption_disclosure')!.permittedControlActions).toEqual([
			'GATHER_EVIDENCE',
			'CLARIFY',
			'RESHAPE_PWU',
			'INVALIDATE_DEPENDENTS',
			'REQUEST_HUMAN_DECISION',
			'ESCALATE'
		]);
	});

	it('pol_decomposition_coverage permits DOC-004 §19.8’s five actions', () => {
		expect(load('pol_decomposition_coverage')!.permittedControlActions).toEqual([
			'REVISE_DECOMPOSITION',
			'RESHAPE_PWU',
			'CLARIFY',
			'REQUEST_HUMAN_DECISION',
			'REJECT'
		]);
	});

	it('pol_intent_preservation permits DOC-004 §23.7’s six actions — and NOT the ESCALATE it used to', () => {
		// A REAL BEHAVIOUR CHANGE, pinned here so it cannot drift back. The seed's single value was 'ESCALATE',
		// which is NOT a member of §23.7's ratified set. The code permitted an action the ratified policy does
		// not list; transcribing removes it.
		const actions = load('pol_intent_preservation')!.permittedControlActions as string[];
		expect(actions).toEqual([
			'RESHAPE_PWU',
			'REVISE_DECOMPOSITION',
			'INVALIDATE_DEPENDENTS',
			'REQUEST_HUMAN_DECISION',
			'REJECT',
			'ABANDON'
		]);
		expect(actions, '§23.7 does not list ESCALATE').not.toContain('ESCALATE');
	});

	it('the two policies DOC-004 leaves silent keep their single value — shape fixed, content untouched', () => {
		// §16 / §21 have no control-actions subsection. Inventing a set for them would be authoring professional
		// content; a 1-element array is the shape fix with the content preserved exactly.
		expect(load('pol_intent_completeness')!.permittedControlActions).toEqual(['GATHER_CONTEXT']);
		expect(load('pol_architecture_coverage')!.permittedControlActions).toEqual(['RESHAPE_PWU']);
	});
});
