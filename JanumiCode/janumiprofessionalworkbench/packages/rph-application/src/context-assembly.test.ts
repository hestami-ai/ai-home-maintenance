// JAN-CTXPOL / ICP-04 — the id resolves, a wrong id refuses, and the default says something FALSIFIABLE.
//
// ⭑ `ICP-04`'s exit test, verbatim: *"Point a binding at a policy that does not exist. This MUST refuse. ⚠ The
// failure mode to avoid is the one this repository has recorded repeatedly — seeding a permissive default so
// the check can never fire."*
import { describe, expect, it } from 'vitest';
import {
	DEFAULT_CONTEXT_ASSEMBLY_POLICY,
	DEFAULT_CONTEXT_ASSEMBLY_POLICY_ID,
	permits,
	resolveContextAssemblyPolicy
} from './context-assembly.js';

const store = (rows: Record<string, unknown>) => (id: string) => rows[id];

describe('JAN-CTXPOL — the id resolves, or the binding refuses', () => {
	it('⭑ CONTROL — a policy that EXISTS resolves, so the refusals below are not "refuse everything"', () => {
		// Without this the check is satisfiable by refusing unconditionally — which is `D-2`'s first horn:
		// "a fail-closed default breaks every existing binding".
		const p = resolveContextAssemblyPolicy(
			store({ [DEFAULT_CONTEXT_ASSEMBLY_POLICY_ID]: DEFAULT_CONTEXT_ASSEMBLY_POLICY }),
			DEFAULT_CONTEXT_ASSEMBLY_POLICY_ID
		);
		expect(p.policyId).toBe(DEFAULT_CONTEXT_ASSEMBLY_POLICY_ID);
	});

	it('⛔ an id that names NOTHING refuses — ICP-04’s stated exit test', () => {
		// THE MUTANT: return a permissive default when the id does not resolve. That is the SECOND horn — "a
		// permissive seed reproduces the vacuous route" — and it makes this check unable to fire ever again.
		expect(() => resolveContextAssemblyPolicy(store({}), 'ctx-nonexistent')).toThrow(
			/does not resolve/
		);
	});

	it('⛔ and an id that resolves to something which is NOT a policy also refuses', () => {
		// ⚠ THE SAME FAILURE IN BETTER DISGUISE: the id resolved, and what came back cannot govern anything.
		// THE MUTANT: check only for undefined. A malformed row would then be treated as a policy and read for
		// fields it does not have.
		expect(() =>
			resolveContextAssemblyPolicy(store({ 'ctx-default': { notAPolicy: true } }), 'ctx-default')
		).toThrow(/is not a policy/);
	});
});

describe('JAN-CTXPOL — the seeded default is a TRUE statement, not a permissive stub', () => {
	// ── ⚠⚠ THIS BLOCK WAS CORRECTED AT `CP-04`, AND THE CORRECTION IS TO THE CLAIM, NOT TO THE CODE ─────────
	//
	// Its first version asserted the seed permits *"the rendered instruction and NOTHING PRIOR — which is what
	// the code does today"*. ⛔ THAT WAS FALSE WHEN WRITTEN, and had been for two slices: `REG-D-059` sends
	// prior review findings back on a repair turn, and `JAN-EXECSESS` holds the session so that turn also
	// carries the producer's own prior work product and rationale. Nothing could notice, because until `CP-04`
	// nothing consulted the policy.
	//
	// ⭑ FLIPPING AN ASSERTION FROM false TO true IS THE SHAPE OF BENDING A TEST TO MATCH A BUG, so the reason
	// it is not that here has to be stated: the BEHAVIOUR is a sponsor decision, landed and tested
	// (`REG-D-059`, `JAN-EXECLOOP`); what was wrong was this file's statement about it. And the falsifiable
	// content is not lost — it MOVES to the scope boundary below, which is a claim the code can still violate.

	it('⭑⭑ it permits exactly what the execution path assembles — instruction, findings, own prior turns', () => {
		expect(permits(DEFAULT_CONTEXT_ASSEMBLY_POLICY, 'RENDERED_INSTRUCTION', 'THIS_TRY')).toBe(true);
		// `run-model-step.ts` — the findings turn, `REG-D-059`.
		expect(permits(DEFAULT_CONTEXT_ASSEMBLY_POLICY, 'PRIOR_REVIEW_FINDING', 'THIS_WORK_UNIT')).toBe(
			true
		);
		// The held session — `pi-executor.ts` `retainsHistory: true`, `JAN-EXECSESS`.
		expect(permits(DEFAULT_CONTEXT_ASSEMBLY_POLICY, 'PRIOR_WORK_PRODUCT', 'THIS_WORK_UNIT')).toBe(
			true
		);
		expect(permits(DEFAULT_CONTEXT_ASSEMBLY_POLICY, 'PRIOR_RATIONALE', 'THIS_WORK_UNIT')).toBe(
			true
		);
	});

	it('⭑⭑ and it permits NOTHING at THIS_UNDERTAKING — the boundary that survives the correction', () => {
		// ⭑ THE FALSIFIABLE CONTENT, and it is a real claim about the code: the producer's session is opened and
		// disposed PER WORK UNIT (`+page.server.ts` — `getExecutionSession()()` before the loop, `dispose()` in
		// `finally`), so no material crosses into a second unit. The day something does, this policy is wrong
		// until someone updates it.
		//
		// THE MUTANT: seed `THIS_UNDERTAKING` for any source. Every other assertion in this file still passes —
		// which is exactly why the permissive seed `D-2` refuses is a trap rather than a shortcut.
		for (const source of [
			'RENDERED_INSTRUCTION',
			'PRIOR_REVIEW_FINDING',
			'PRIOR_WORK_PRODUCT',
			'PRIOR_RATIONALE'
		] as const)
			expect(
				permits(DEFAULT_CONTEXT_ASSEMBLY_POLICY, source, 'THIS_UNDERTAKING'),
				`${source} must not be drawable across the undertaking`
			).toBe(false);
	});

	it('⚠ scope is part of the permission, not decoration', () => {
		// THE MUTANT: match on `source` alone. A policy permitting an instruction for THIS_TRY would then also
		// permit drawing instructions from across the whole undertaking.
		expect(
			permits(DEFAULT_CONTEXT_ASSEMBLY_POLICY, 'RENDERED_INSTRUCTION', 'THIS_UNDERTAKING')
		).toBe(false);
	});

	it('⛔ the source union cannot express an UNLAWFUL assembly', () => {
		// `PER-12`: volunteered reasoning may never reach an evaluator's context, and `REG-Q-077` — may it be
		// read back at all — is OPEN. So the slot must not exist before the permission does.
		// THE MUTANT: add a `VOLUNTEERED_REASONING` member. Nothing else in the suite would notice, because
		// nothing would yet USE it — the defect would ship as an unused enum member and be discovered later by
		// someone reading it as licence.
		const sources = DEFAULT_CONTEXT_ASSEMBLY_POLICY.permittedSources.map((r) => r.source);
		expect(sources.join(',')).not.toMatch(/REASON|THINK|COT/i);
	});
});
