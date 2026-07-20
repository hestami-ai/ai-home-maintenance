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
	// verified by direct search of §16.1-16.6 and §21.1-21.6 — so their sets are AUTHORED, not ratified; both
	// were raised to the control-action floor on 2026-07-18 (see the dedicated test below).
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

	it('the two once-silent policies now include the control-action floor — the escalate-and-reshape minimum', () => {
		// §16 / §21 have no control-actions subsection. They once kept a single authored value (GATHER_CONTEXT /
		// RESHAPE_PWU) on the stance that a prior authored judgement outranked a derivation. But GATHER_CONTEXT
		// alone is a policy that can raise a blocking finding yet cannot escalate to a human — incoherent against
		// the "escalate rather than invent" minimum. Raised on 2026-07-18 under the sponsor's grant to include the
		// floor {REQUEST_HUMAN_DECISION, RESHAPE_PWU}, prior value RETAINED. (The other six silent policies —
		// §18/§20/§22/§24/§25/§26 — already carried the derived floor; the conformance test pins the universal
		// minimum now.)
		expect(load('pol_intent_completeness')!.permittedControlActions).toEqual([
			'GATHER_CONTEXT',
			'RESHAPE_PWU',
			'REQUEST_HUMAN_DECISION'
		]);
		expect(load('pol_architecture_coverage')!.permittedControlActions).toEqual([
			'RESHAPE_PWU',
			'REQUEST_HUMAN_DECISION'
		]);
	});
});

describe('the seeded policy objects ARE the ontology — one catalog, not two', () => {
	const load = seeded();

	// THE LOCK. seedAdditivePolicies used to iterate its own copy of the catalog; validateOntology and the
	// conformance profiles read ontology.seedPolicies. Nothing compared them, so nothing noticed that the copy
	// being seeded — the one the app, the agent and the UI read — held 17 of the catalog's 81 criteria and 11 of
	// its 99 findings, in paraphrase, with IP-01/IP-02 bound to different claims than the ontology binds them to.
	// Deduping fixed today's divergence; this is what stops tomorrow's, by failing the moment the seeded object
	// stops being the ontology's own content.
	it('every ratified policy in the ontology is seeded as an ACTIVE object', () => {
		expect(ontology.seedPolicies).toHaveLength(12);
		for (const p of ontology.seedPolicies) {
			const seededObject = load(p.policyId);
			expect(seededObject, `${p.policyId} is in the ontology but is NOT seeded`).toBeDefined();
			expect(seededObject!.status).toBe('ACTIVE');
		}
	});

	it('carries the ontology’s criteria verbatim — every id, name and description', () => {
		for (const p of ontology.seedPolicies) {
			expect(load(p.policyId)!.criteria).toEqual(p.criteria);
		}
	});

	it('carries the ontology’s finding codes verbatim, in order', () => {
		for (const p of ontology.seedPolicies) {
			const codes = (load(p.policyId)!.findingDefinitions as { code: string }[]).map((f) => f.code);
			expect(codes, p.policyId).toEqual([...p.findingTypes]);
		}
	});

	it('seeds all 81 ratified criteria and all 99 ratified finding codes', () => {
		// The headline number, asserted on the OBJECTS rather than the source data: 17/81 and 11/99 was the state
		// of the store, not of the ontology, and the store is what the system reads.
		const ids = ontology.seedPolicies.map((p) => p.policyId);
		const criteria = ids.reduce((n, id) => n + (load(id)!.criteria as unknown[]).length, 0);
		const findings = ids.reduce(
			(n, id) => n + (load(id)!.findingDefinitions as unknown[]).length,
			0
		);
		expect(criteria).toBe(81);
		expect(findings).toBe(99);
	});
});
