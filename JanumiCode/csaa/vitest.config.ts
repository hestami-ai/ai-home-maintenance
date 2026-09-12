// CSAA'S OWN TEST HARNESS — JAN-CSAAEXT S7, 2026-09-12.
//
// ⛔ CSAA HAD NO HARNESS OF ITS OWN. It was a workspace of JPWB, so `turbo run test` discovered it through
// `vitest.projects.ts` and JPWB's root config supplied every setting. The move to `JanumiCode/csaa/` took that
// away: no `test` script, no config, and `check-types` reported 594 errors of which 189 were
// `Cannot find module 'vitest'` — the rest cascading from its missing types.
//
// ⚠ THE WATCHDOGS ARE NOT OPTIONAL AND ARE NOT COPIED BY HABIT. `REG-F-024`'s recorded shape is that CSAA's
// suite exceeds default timeouts under load — which is why `JAN-CSAADEC` `CD-03b` added exactly these three to
// JPWB's source config after finding them on only one of two sibling gates. Inheriting them here is the same
// fact, not a new guess.
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		hookTimeout: 60_000,
		include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
		maxWorkers: 4,
		// ⛔ A MODE THAT OBSERVES NOTHING MUST FAIL — N-16's fix, carried over deliberately.
		passWithNoTests: false,
		testTimeout: 60_000
	}
});
