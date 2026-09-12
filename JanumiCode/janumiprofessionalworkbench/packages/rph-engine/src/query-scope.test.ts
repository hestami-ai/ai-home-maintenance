// JPWB-SPEC-001 SPEC-001-INV-02 / FORK-9 — a subject-bindable query is bound to a declared QueryScope and returns
// nothing outside it.
//
// WHY THIS TEST EXISTS AT THIS LAYER. The defect it guards is user-visible (a new Undertaking rendered the seed's
// 65 assessments, 2 decisions and 2 baselines) and its end-to-end proof is an e2e. But the mutation ledger cannot
// carry an e2e victim — the runner is vitest-only — so a guard proved ONLY end to end is a guard the mutation gate
// cannot measure. This spec puts the same rule where the ledger can reach it.
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { testDirectory } from '@janumipwb/rph-ports/testing';
import { describe, expect, it } from 'vitest';
import {
	createEngine,
	listAssessments,
	listBaselines,
	listDecisions,
	listExecutionPlans,
	listObservations,
	listPwus,
	seedWorkbench,
	SEED_UNDERTAKING
} from './index.js';

// ── THE SESSION THE SEED MUST RUN IN, AND WHY IT IS NOT THE SHARED CREDENTIAL ─────────────────────────────────
// `seedWorkbench` delegates the Undertaking's graph to `driveReferenceUndertaking`, which AUTHORS ITS ACTING
// PARTY into the payloads it sends — `producedBy`, `producer`, `introducedBy`, and, load-bearing here,
// `authority` on `ProposeDecision`. REG-F-014 requires that declared authority to EQUAL the issuing actor, and
// the engine now stamps the issuer from the authenticated session. So the session's principal must BE that
// party — `owner-1`, the Undertaking Owner. Under any other principal the drive is refused at ProposeDecision
// with RPH_AUTHORITY_INSUFFICIENT and its fail-loud `send` throws before the seed finishes.
//
// ⚠ The literal is duplicated from `reference-undertaking.ts`'s module-private ACTOR, which is not exported.
// `executionInstanceId` is carried for the same reason it exists there: with it, the stamped `issuedBy` is the
// exact value the envelope carried before the trust boundary landed, so nothing downstream of the gate moves.
const DIR = testDirectory([
	{
		actorId: 'owner-1',
		actorType: 'HUMAN',
		displayName: 'Undertaking Owner',
		executionInstanceId: 'exec-production',
		tenantId: 'tenant-test',
		organizationId: 'org-test'
	}
]);
const OWNER = DIR.credentialFor('owner-1');

function build() {
	let s = 0;
	const engine = createEngine({
		authenticate: DIR.authenticate,
		ontology,
		now: () => '2026-07-12T00:00:00Z',
		newEventId: () => `e${++s}`
	}).as(OWNER);
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

// ── JAN-PFA R3 S3.3 — listExecutionPlans' TYPE promise, put where the ledger can reach it ──────────────────────
//
// WHY IT IS HERE AND NOT LEFT TO THE e2e. This file's header already records the rule: a guard proved ONLY end to
// end is a guard the mutation gate cannot measure. `listExecutionPlans` had NO vitest reader at all — its only
// assertion was `apps/rph-demo/e2e/execution-plan.e2e.ts`.
//
// ⛔ AND THE CONSEQUENCE WAS MEASURED RATHER THAN PREDICTED. A mutant pointing that export at the wrong aggregate
// type was declared against the e2e, and the run came back **INCONCLUSIVE — TIMED OUT**: with no plans to render,
// the page never reaches the state the spec waits for, so the spec HANGS instead of failing. ⭑ A test that hangs
// when its subject is wrong cannot kill a mutant — neither KILLED nor SURVIVED is available, which is worse than
// a red, because the harness has measured nothing and says so. The runner's own advice is "fix the slow test; do
// not raise the timeout", and the fix is a victim that fails in milliseconds.
describe('JAN-PFA R3 — listExecutionPlans returns EXECUTION_PLAN rows and nothing else', () => {
	it('the seed has plans to get wrong, or the assertion below is vacuous', () => {
		// ⛔ THE VACUITY CONTROL. An empty result satisfies "every row is an EXECUTION_PLAN" perfectly, so a query
		// returning nothing would pass the type assertion while answering no question at all.
		expect(listExecutionPlans(build()).length).toBeGreaterThan(0);
	});

	it('every row it returns is an EXECUTION_PLAN, and the PWUs it could have returned are excluded', () => {
		const e = build();
		const plans = listExecutionPlans(e);
		// ⭑ ASSERTED RELATIONALLY, NOT BY COUNT. The mutation that occasioned this test swapped the aggregate type
		// for PROFESSIONAL_WORK_UNIT — a type the same workspace holds in quantity — so a count or a non-emptiness
		// check would have passed. What cannot pass is a PWU id appearing among the plans.
		const pwuIds = new Set(listPwus(e, SEED_UNDERTAKING).map((r) => r.id));
		expect(pwuIds.size, 'the seed has no PWUs, so the exclusion below is vacuous').toBeGreaterThan(0);
		for (const row of plans)
			expect(pwuIds.has(row.id), `listExecutionPlans returned the PWU ${row.id}`).toBe(false);
	});
});
