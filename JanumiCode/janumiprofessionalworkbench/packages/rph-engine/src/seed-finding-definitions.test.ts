// The seeded policies' findings are DOC-004 §9.1 FindingDefinitions — and a finding cannot out-claim its policy.
//
// `FindingDefinition` was `z.record(z.string(), z.unknown())` — any object — so the codebase invented
// `{code, severity, statement}`: no overlap with §9.1 beyond `code`. Same story as AssessmentCriterion (§7),
// and the vocab note again cited the very section that defines it ("NOT field-defined; DOC-004 §9.1 supplies
// defaultSeverity + defaultControlActions + affectedClaimTypes. Source TBD.").
//
// HONEST SPLIT of the six fields, because two of them are authored:
//   TRANSCRIBED : code, description (<- statement), defaultSeverity (<- severity)
//   MECHANICAL  : name — humanizeCode(code); a finding code IS its name in SCREAMING_SNAKE
//   AUTHORED    : affectedClaimTypes, defaultControlActions — DOC-004 ratifies each policy's finding CODES but
//                 never these. They take the OWNING POLICY's own sets: the widest reading the ratified model
//                 permits, and the only non-invented values available.
//
// Nothing reads findingDefinitions today (zero readers repo-wide), so this is documentation-grade. The tests
// below therefore lock the two things that could still be WRONG rather than merely unread: the transcription is
// faithful, and the authored fields cannot exceed what their own policy declares.
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { describe, expect, it } from 'vitest';
import { createEngine, getObject } from './index.js';
import { seedAdditivePolicies, seedFloorPolicies } from './seed-workbench.js';

interface Finding {
	code: string;
	name: string;
	description: string;
	defaultSeverity: string;
	affectedClaimTypes: string[];
	defaultControlActions: string[];
}

function seeded() {
	let n = 0;
	const engine = createEngine({
		ontology,
		now: () => '2026-07-16T00:00:00Z',
		newEventId: () => `e${++n}`
	});
	seedFloorPolicies(engine);
	seedAdditivePolicies(engine);
	return (id: string) =>
		getObject(engine, id) as
			| {
					findingDefinitions: Finding[];
					evaluatedClaimTypes: string[];
					permittedControlActions: string[];
			  }
			| undefined;
}

const ALL = [
	'floor.schema-invariant',
	'floor.identity-provenance',
	'floor.reasoning-review',
	'pol_intent_fidelity',
	'pol_intent_completeness',
	'pol_assumption_disclosure',
	'pol_decomposition_coverage',
	'pol_architecture_coverage',
	'pol_intent_preservation'
];

describe('seeded finding definitions are DOC-004 §9.1', () => {
	const load = seeded();

	it('every seeded finding carries §9.1’s six fields — the invented {code, severity, statement} is gone', () => {
		for (const id of ALL) {
			const s = load(id);
			expect(s, `${id} seeded`).toBeDefined();
			for (const f of s!.findingDefinitions) {
				expect(f.name, `${id}/${f.code}.name`).toBeTruthy();
				expect(f.description, `${id}/${f.code}.description`).toBeTruthy();
				expect(f.defaultSeverity, `${id}/${f.code}.defaultSeverity`).toBeTruthy();
				expect(Array.isArray(f.affectedClaimTypes)).toBe(true);
				expect(Array.isArray(f.defaultControlActions)).toBe(true);
				// The invented fields cannot ride along: FindingDefinitionSchema is a strictObject.
				expect(f as unknown as Record<string, unknown>).not.toHaveProperty('statement');
				expect(f as unknown as Record<string, unknown>).not.toHaveProperty('severity');
			}
		}
	});

	it('A FINDING CANNOT OUT-CLAIM ITS POLICY — the structural guarantee, not a convention', () => {
		// This is the load-bearing test. `affectedClaimTypes`/`defaultControlActions` are AUTHORED, so the one
		// thing that must hold is that the authoring cannot assert something the policy itself does not declare:
		// a finding recommending an action its own policy forbids would be incoherent on its face, and DOC-004
		// §15.10/§17.8/§19.8/§23.7 now ratify four of those permitted sets.
		//
		// It holds because findingsFor() derives both from the policy at construction, rather than each finding
		// repeating them — which is what makes this structural rather than a rule someone must remember.
		for (const id of ALL) {
			const s = load(id)!;
			const claims = new Set(s.evaluatedClaimTypes);
			const actions = new Set(s.permittedControlActions);
			for (const f of s.findingDefinitions) {
				for (const c of f.affectedClaimTypes)
					expect(
						claims.has(c),
						`${id}/${f.code} affects claim '${c}' its policy does not evaluate`
					).toBe(true);
				for (const a of f.defaultControlActions)
					expect(
						actions.has(a),
						`${id}/${f.code} defaults to action '${a}' its policy does not permit`
					).toBe(true);
			}
		}
	});

	it('humanizes the code into §9.1’s name mechanically — SOLUTION_SUBSTITUTION -> "Solution substitution"', () => {
		const f = load('pol_intent_fidelity')!.findingDefinitions.find(
			(x) => x.code === 'SOLUTION_SUBSTITUTION'
		);
		expect(f?.name).toBe('Solution substitution');
	});

	it('preserves the invented `severity` values verbatim as defaultSeverity — a rename, not a re-judgement', () => {
		// The migration must not quietly re-grade a finding. SCHEMA_INVALID was CRITICAL and stays CRITICAL.
		const fs = load('floor.schema-invariant')!.findingDefinitions;
		expect(fs.find((f) => f.code === 'SCHEMA_INVALID')?.defaultSeverity).toBe('CRITICAL');
		expect(fs.find((f) => f.code === 'INVARIANT_VIOLATION')?.defaultSeverity).toBe('BLOCKING');
	});

	it('seeds ALL of a policy’s ratified finding codes, in document order — not a two-code sample', () => {
		// This asserted exactly the two codes the old hand-maintained seed happened to carry, and called the other
		// 89 "a demo-subset question, surfaced, not decided here". It was not a demo subset: the seed's copy of the
		// catalog was simply shorter than the ratified one, and this test pinned the short version as correct.
		// Seeding now reads the ontology, so the codes ARE DOC-004 §15.7 — all seven, in the doc's order.
		expect(load('pol_intent_fidelity')!.findingDefinitions.map((f) => f.code)).toEqual([
			'SOLUTION_SUBSTITUTION',
			'UNAUTHORIZED_SCOPE_EXPANSION',
			'MISSING_USER_CONSTRAINT',
			'FALSELY_CLOSED_AMBIGUITY',
			'INFERRED_NEED_PRESENTED_AS_FACT',
			'OUTCOME_EROSION',
			'NON_GOAL_CONFLICT'
		]);
	});

	it('resolves the two fields §9.1 mandates and DOC-004 never ratifies — WITHOUT inventing them', () => {
		// §9.1 requires description + defaultSeverity per FindingDefinition. DOC-004 ratifies neither, for any of
		// its 99 codes (each occurs exactly once corpus-wide, as a bare bullet). An ANNOTATED code keeps its
		// authored text; an UNANNOTATED one inherits its policy's own failureSeverity and the humanized code,
		// rather than a severity someone made up.
		const fidelity = load('pol_intent_fidelity')!.findingDefinitions;
		const annotated = fidelity.find((f) => f.code === 'SOLUTION_SUBSTITUTION')!;
		expect(annotated.description).toBe('An inferred solution replaced the stated need.');
		expect(annotated.defaultSeverity).toBe('BLOCKING');

		const fallback = fidelity.find((f) => f.code === 'FALSELY_CLOSED_AMBIGUITY')!;
		expect(fallback.description).toBe('Falsely closed ambiguity');
		// pol_intent_fidelity.failureSeverity — the policy's own declared severity, not a per-finding invention.
		expect(fallback.defaultSeverity).toBe('BLOCKING');
	});
});
