// JAN-VERIF V-0 — the POSITIVE proof that source resolution is in effect.
//
// WHY A TEST AND NOT A COMMENT. The entire coverage and mutation programme rests on one claim: that under
// `test:src`, `@janumipwb/rph-domain` resolves to `src/index.ts` rather than `dist/index.js`. If a `conditions`
// typo silently breaks that, the merged coverage report still renders, the numbers still look plausible, and
// every cross-package mutant silently reports GREEN again. **A broken instrument that produces a comfortable
// number is worse than no instrument**, and this repo has already been bitten by exactly that twice: two
// cross-package mutants reported false GREENs in one working session because they read a stale dist.
//
// THE ROOT FACT (JAN-VERIF-DS-001 §2), established by experiment before any of this was built. Mutating
// `packages/rph-domain/src/execution.ts` and NOT rebuilding:
//     rph-domain      (own src)   -> RED    (sees src)
//     rph-application (cross-pkg) -> GREEN  (reads DIST)
//
// HOW THIS TEST DISTINGUISHES THE TWO. It imports the same symbol twice — once through the PACKAGE SPECIFIER
// (`@janumipwb/rph-domain`, which the resolver decides) and once through a RELATIVE SOURCE PATH (which is
// unambiguously src). Under source resolution both specifiers reach the same module instance, so the function
// objects are IDENTICAL. Under dist resolution they are two separately-loaded copies — same behaviour, different
// identity — and `toBe` fails. Identity is the only observable that separates them, which is why this asserts
// identity rather than behaviour: two copies of a correct function behave identically, and that is precisely the
// trap.
//
// IT LIVES AT THE ROOT, and that placement was forced twice over. (a) A package's OWN tests always see their own
// src, so running this inside rph-domain would assert something true either way — a vacuous test; it has to cross
// a package boundary to mean anything. (b) But a relative cross-package import from inside rph-application
// violates that package's `rootDir` and its dependency-cruiser boundary — correctly, since application code must
// never reach into another package's src. This file tests the BUILD/TEST INFRASTRUCTURE, not the application, so
// the repo root is where it belongs.
//
// AND `import.meta.resolve` IS NOT AN OPTION, which was worth discovering by probe rather than assuming: it uses
// Node's resolver, which is blind to Vite's alias, and reports `dist/index.js` even when the alias IS in effect.
// An instrument that returns the same answer in both modes cannot distinguish them. Module identity can.
import { canResumeExecutionOnPwu, STEP_COMMAND_SPECS } from '@janumipwb/rph-domain';
import { canResumeExecutionOnPwu as fromSource } from '../packages/rph-domain/src/execution.js';
import { STEP_COMMAND_SPECS as specsFromSpecModule } from '../packages/rph-domain/src/step-command-spec.js';
import { describe, expect, it } from 'vitest';

const SOURCE_RESOLVED = process.env.RPH_TEST_RESOLVE === 'source';

describe('JAN-VERIF V-0 — the resolution mode is what it claims to be', () => {
	it.runIf(SOURCE_RESOLVED)(
		'under test:src, a cross-package import is the SAME MODULE INSTANCE as the source import',
		() => {
			// The proof. Two specifiers, one module — only possible when the `source` export condition is honoured.
			expect(canResumeExecutionOnPwu, 'the package specifier did NOT resolve to src').toBe(fromSource);
			// The same, for a value exported from a DIFFERENT source module, so the proof is not an artifact of one
			// file's identity. (`STEP_COMMAND_SPECS` lives in step-command-spec.ts; `canResumeExecutionOnPwu` in
			// execution.ts — both re-exported by the package index.)
			expect(STEP_COMMAND_SPECS, 'the barrel did not resolve to src either').toBe(specsFromSpecModule);
		}
	);

	it.runIf(!SOURCE_RESOLVED)(
		'under the default (artifact) mode, the package specifier resolves to the BUILT dist — two instances',
		() => {
			// The mirror image, asserted so the default mode is also PINNED rather than merely assumed. If this ever
			// starts failing, the default `test` has silently stopped validating the shipped artifact — which is the
			// one thing it exists to do.
			expect(canResumeExecutionOnPwu, 'the default mode unexpectedly resolved to src').not.toBe(fromSource);
		}
	);

	it('either way, the two copies AGREE on behaviour — so a divergence here is a build/emit defect', () => {
		// This is the cross-check DS §3-R1 buys: dist and src must behave identically. A disagreement means the
		// emitted artifact differs from the source it was built from — a finding no single-mode suite could see.
		for (const state of ['BASELINED', 'ABANDONED', 'SUPERSEDED', 'EXECUTING', 'READY']) {
			expect(canResumeExecutionOnPwu(state).ok, `${state}: dist and src disagree`).toBe(
				fromSource(state).ok
			);
		}
		// …and the declared authority table agrees field-for-field across the boundary.
		for (const key of Object.keys(specsFromSpecModule) as (keyof typeof specsFromSpecModule)[]) {
			expect(STEP_COMMAND_SPECS[key].bindingAuthority, `${key}.bindingAuthority`).toBe(
				specsFromSpecModule[key].bindingAuthority
			);
			expect(STEP_COMMAND_SPECS[key].planLiveness, `${key}.planLiveness`).toBe(
				specsFromSpecModule[key].planLiveness
			);
			expect(STEP_COMMAND_SPECS[key].pwuOpenness, `${key}.pwuOpenness`).toBe(
				specsFromSpecModule[key].pwuOpenness
			);
		}
	});
});
