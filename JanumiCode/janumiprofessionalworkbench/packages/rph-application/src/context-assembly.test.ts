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
	it('⭑⭑ it permits the rendered instruction and NOTHING PRIOR — which is what the code does today', () => {
		// ⭑ THIS IS `D-2`'s WHOLE ARGUMENT. A permit-everything default would resolve and mean nothing. This one
		// is FALSIFIABLE: the day the execution path starts assembling prior work, this policy is WRONG until
		// someone updates it — which is the property that makes it worth storing.
		expect(permits(DEFAULT_CONTEXT_ASSEMBLY_POLICY, 'RENDERED_INSTRUCTION', 'THIS_TRY')).toBe(true);
		expect(permits(DEFAULT_CONTEXT_ASSEMBLY_POLICY, 'PRIOR_WORK_PRODUCT', 'THIS_WORK_UNIT')).toBe(false);
		expect(permits(DEFAULT_CONTEXT_ASSEMBLY_POLICY, 'PRIOR_REVIEW_FINDING', 'THIS_WORK_UNIT')).toBe(
			false
		);
		expect(permits(DEFAULT_CONTEXT_ASSEMBLY_POLICY, 'PRIOR_RATIONALE', 'THIS_WORK_UNIT')).toBe(false);
	});

	it('⚠ scope is part of the permission, not decoration', () => {
		// THE MUTANT: match on `source` alone. A policy permitting an instruction for THIS_TRY would then also
		// permit drawing instructions from across the whole undertaking.
		expect(permits(DEFAULT_CONTEXT_ASSEMBLY_POLICY, 'RENDERED_INSTRUCTION', 'THIS_UNDERTAKING')).toBe(
			false
		);
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
