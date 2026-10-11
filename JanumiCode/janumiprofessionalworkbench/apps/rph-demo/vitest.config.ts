// `apps/rph-demo`'s own `vitest run` — the app's vite config, plus what only vitest reads.
//
// ⭐ `JAN-SELREV` D8 — THIS APP'S OWN `vitest run` starts every test file with the eight live-backend variables
// REMOVED, as both root configs' projects do: see `verif/live-backend-isolation.ts`. (Under `turbo run test` they never
// arrive — turbo's strict env mode withholds them — but the same command started here inherits the shell.)
//
// ⭑ A SEPARATE FILE, MERGED OVER `vite.config.ts`, rather than a `test` key in it. vitest types that key on ITS OWN
// nested vite (8.x) while `vite.config.ts` is typed by the app's vite (7.x), so the key there needed a hand-written
// `declare module 'vite'` — which would collide with vitest's own declaration (TS2717) the day the two versions
// converge. Here `mergeConfig` and `defineConfig` both come from `vitest/config`, so nothing is declared by hand.
// ⚠ vitest prefers this file to `vite.config.ts` when started in this directory, so every setting the app's vite
// config carries (the SvelteKit plugin, the `source` resolution) reaches the tests only THROUGH the merge below.
import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
	viteConfig,
	defineConfig({
		test: {
			setupFiles: [
				fileURLToPath(new URL('../../verif/live-backend-isolation-setup.ts', import.meta.url))
			],
			// ⭑⭑ `REG-F-556` — THE SAME WATCHDOGS BOTH ROOT CONFIGS CARRY (`vitest.config.ts`, `vitest.dist.config.ts`;
			// `JAN-CSAADEC` CD-03), AND THEY WERE MISSING HERE FOR THE REASON CD-03 RECORDS: a correction applied to some
			// of the configs one suite runs under (`REG-F-024`: a gate that covers one of two writers is not a gate). This
			// config is what `gate:fast`'s `rph-demo` test step runs, and on vitest's 5 s default it went red on a
			// DIFFERENT workbench-booting test in nearly every gate run of 2026-10-10 and -11 — each one green alone, each
			// one budgeted after the fact — while the root's projects, on 60 s, did not. ⚠ THE NUMBERS ARE COPIED, NOT
			// CHOSEN, as CD-03 copied them: 60 s is a harness watchdog, not a performance claim, and `maxWorkers: 4` bounds
			// the contention that trips it.
			hookTimeout: 60_000,
			testTimeout: 60_000,
			maxWorkers: 4
		}
	})
);
