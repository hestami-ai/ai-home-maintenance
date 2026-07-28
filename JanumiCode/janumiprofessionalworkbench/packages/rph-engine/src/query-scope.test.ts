// JPWB-SPEC-001 SPEC-001-INV-02 / FORK-9 — a subject-bindable query is bound to a declared QueryScope and returns
// nothing outside it.
//
// WHY THIS TEST EXISTS AT THIS LAYER. The defect it guards is user-visible (a new Undertaking rendered the seed's
// 65 assessments, 2 decisions and 2 baselines) and its end-to-end proof is an e2e. But the mutation ledger cannot
// carry an e2e victim — the runner is vitest-only — so a guard proved ONLY end to end is a guard the mutation gate
// cannot measure. This spec puts the same rule where the ledger can reach it.
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { describe, expect, it } from 'vitest';
import {
	createEngine,
	listAssessments,
	listBaselines,
	listDecisions,
	listObservations,
	listPwus,
	seedWorkbench,
	SEED_UNDERTAKING
} from './index.js';

function build() {
	let s = 0;
	const engine = createEngine({
		ontology,
		now: () => '2026-07-12T00:00:00Z',
		newEventId: () => `e${++s}`
	});
	seedWorkbench(engine);
	return engine;
}

const UNDERTAKING = { kind: 'UNDERTAKING', undertakingId: SEED_UNDERTAKING } as const;
const OTHER = { kind: 'UNDERTAKING', undertakingId: 'und_does_not_exist' } as const;
const WORKSPACE = { kind: 'WORKSPACE' } as const;

describe('QueryScope — subject-bindable queries are bound to their subject', () => {
	it('the seed has records to leak, or every assertion below is vacuous', () => {
		// The arrangement, asserted. A scoped query and a broken one are indistinguishable when the workspace is
		// empty, so this is the precondition every other case in the file depends on.
		const e = build();
		expect(listAssessments(e, WORKSPACE).length).toBeGreaterThan(0);
		expect(listDecisions(e, WORKSPACE).length).toBeGreaterThan(0);
		expect(listBaselines(e, WORKSPACE).length).toBeGreaterThan(0);
	});

	it('an Undertaking that owns nothing sees nothing — the leak', () => {
		const e = build();
		expect(listAssessments(e, OTHER)).toEqual([]);
		expect(listObservations(e, OTHER)).toEqual([]);
		expect(listDecisions(e, OTHER)).toEqual([]);
		expect(listBaselines(e, OTHER)).toEqual([]);
	});

	it('CONTROL: the owning Undertaking still sees its own records', () => {
		// The mirror, and the case that caught a real over-correction: a first implementation scoped to PWU ids
		// alone, which emptied the owning Undertaking's own Assurance tab because the three de-minimis FLOOR
		// assessments per PWU name the EVIDENCE the step produced, not the PWU. INV-02 forbids presenting objects
		// OUTSIDE the scope; it never licenses hiding the subject's own.
		const e = build();
		expect(listAssessments(e, UNDERTAKING).length).toBeGreaterThan(0);
		expect(listBaselines(e, UNDERTAKING).length).toBeGreaterThan(0);
	});

	it('the owning Undertaking sees the FLOOR assessments, which name Evidence rather than a PWU', () => {
		// The specific shape the first implementation lost. Named separately from the CONTROL so a regression says
		// WHICH half broke: a PWU-only closure passes the CONTROL on fitness assessments alone.
		const e = build();
		const pwuIds = new Set(listPwus(e, SEED_UNDERTAKING).map((r) => r.id));
		const scoped = listAssessments(e, UNDERTAKING);
		const floorOnEvidence = scoped.filter(
			(a) =>
				String(a.state.assurancePolicyId ?? '').startsWith('floor.') &&
				!((a.state.subjectObjectIds as string[]) ?? []).some((s) => pwuIds.has(s))
		);
		expect(
			floorOnEvidence.length,
			'floor assessments subject-linked to Evidence must be in the Undertaking scope'
		).toBeGreaterThan(0);
	});

	it('WORKSPACE returns at least as much as any single Undertaking, and the seed leaks nothing to a stranger', () => {
		const e = build();
		expect(listAssessments(e, WORKSPACE).length).toBeGreaterThanOrEqual(
			listAssessments(e, UNDERTAKING).length
		);
		// Every scoped row must also be a workspace row — scoping filters, it never invents.
		const workspaceIds = new Set(listAssessments(e, WORKSPACE).map((r) => r.id));
		for (const r of listAssessments(e, UNDERTAKING)) expect(workspaceIds.has(r.id)).toBe(true);
	});
});
