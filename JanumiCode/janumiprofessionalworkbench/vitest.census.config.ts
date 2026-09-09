// The CENSUS lane — JAN-CSAADEC CD-03. The three CSAA tests that measure the WORKBENCH, run on demand.
//
// WHY THIS FILE EXISTS. `packages/csaa` owns 188 test files. 185 of them test CSAA's own logic and are
// indifferent to what we do; three assert over the LIVE WORKBENCH TREE — workspace-manifest and `verif/`
// populations, public TypeScript root populations and their hashes, exact current JPWB source bytes. Those three
// move when WE work. `f35cb69d` — one product commit adding a fifth playwright config — reddened 28 tests, and
// six consecutive programmes moved a pinned population without noticing. This config is where they live now.
//
// ⭑ THE NUMBER IS MEASURED AND MY FIRST TWO ANSWERS WERE WRONG, WHICH IS THE PART WORTH KNOWING. A regex for
// "the test names a repo path" said 46 of 188 — and it carried a control that WORKED (a comparable package
// scored 3 of 33, so it was demonstrably not matching something ubiquitous) and was STILL a fifteenfold
// over-count, because naming a path inside a string fixture is not reading the tree. Reverse-reachability from
// `collect-inventory.ts` said 9 and was wrong in both directions at once: four files it called clean import the
// census module without executing its assertions, and its single seed missed seven of the eight CSAA modules
// that read the live tree. The three in `CSAA_CENSUS` come from perturbing the tree and diffing verdicts across
// two rounds and four dimensions. A control proves an instrument DISCRIMINATES; it does not prove the instrument
// measures the thing you named it after.
//
// ⛔ WHAT THIS IS NOT. It is not a retirement, a skip, or a weakening. All three files are byte-identical to
// what the gate ran yesterday and keep every assertion they had. They are RED on the current tree and MUST BE:
// a census lane that went green by leaving the gate would be a control that cannot fail, and this repository has
// filed that shape often enough to recognise it. What changed is the OBLIGATION — an unrelated product commit is
// no longer required to re-pin them.
//
// ⚠ WHEN TO RUN IT. On changes to `packages/csaa`, and whenever the workbench populations are believed to have
// moved enough that the pins should be refreshed deliberately rather than incidentally. Refreshing a pin is then
// a decision someone makes, with the diff in front of them — which is what these pins were always supposed to
// be, and what running them on every commit had turned them into the opposite of.
//
// ⚠ SOURCE RESOLUTION, MIRRORING `vitest.config.ts`. Declared rather than inherited so the census lane cannot
// silently acquire a different resolution from the mode it used to run under. `censusProjectsFor()` records why
// the DIST half is not reproduced here, and what that gives up.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { censusProjectsFor } from './vitest.projects.js';

const PKG_ROOT = fileURLToPath(new URL('./packages', import.meta.url));

/** The same two anchored patterns `vitest.config.ts` uses, and for the same reason — subpath exports are real
 *  here, so the subpath pattern must be listed first or a bare-package alias swallows it. */
const WORKSPACE_ALIAS = [
	{ find: /^@janumipwb\/([a-z0-9-]+)\/(.+)$/, replacement: `${PKG_ROOT}/$1/src/$2.ts` },
	{ find: /^@janumipwb\/([a-z0-9-]+)$/, replacement: `${PKG_ROOT}/$1/src/index.ts` }
];

export default defineConfig({
	resolve: { alias: WORKSPACE_ALIAS },
	test: {
		env: { RPH_TEST_RESOLVE: 'source' },
		// The census reads and hashes large parts of the tree. The vitest defaults predate these fixtures and
		// expire under ordinary scheduling contention — the same correction `vitest.dist.config.ts` records, and
		// the reason a full-suite run reports six failures where an uncontended one reports three. These are
		// harness watchdogs, not CSAA operation budgets.
		hookTimeout: 120_000,
		testTimeout: 120_000,
		maxWorkers: 4,
		projects: censusProjectsFor(true)
	}
});
