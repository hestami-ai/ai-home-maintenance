// ⭐⭐ `JAN-EXEC` Phase 7 — design D84 (as amended 2026-11-21; `REG-D-189`; the lead's rulings r1, Q7) — THE MEASUREMENT DRIVER'S OWN CONFIG: the app's
// Vite config (its `$lib`, and better-sqlite3 left to Node), collecting the driver's one launcher (`src/lib/server/measurement/d84.drive.ts`) and
// nothing else.
// ⛔ NO LIVE-BACKEND SETUP FILE: `vitest.config.ts` loads `verif/live-backend-isolation-setup.ts`, which removes the very keys a paid call needs. This
// config is no gate entry point: nothing in the gate runs it, and it collects no test.
// ⭑ THE SERVER'S ENVIRONMENT, as the paid lane gives its server (`playwright.live-exec.config.ts`, `webServer.env`): serving, the empty seed, Pi offline.
// The store is the copy's, named by the operator (`JPWB_DEMO_DB`); the rest of the lane's keys come from the operator's shell, as the lane's do.
// ⚠ RUN FROM `apps/rph-demo`, as the app's own `vitest run` is: SvelteKit's plugin takes the process's folder for the root (it says so, *"The following
// Vite config options will be overridden by SvelteKit: root"*), and from the workbench's root it finds no Svelte config and this config collects no
// file (*"No test files found"*: measured, the builder's smoke, `d84-facts.md` §5).
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
	viteConfig,
	defineConfig({
		test: {
			include: ['src/lib/server/measurement/d84.drive.ts'],
			env: { RPH_DEMO_MODE: 'server', JPWB_SEED: 'empty', PI_OFFLINE: '1' },
			passWithNoTests: false,
			fileParallelism: false,
			maxWorkers: 1,
			// One step's bound: the Historian's call, at most `JPWB_HISTORIAN_CALL_MS`, and the page work around it.
			testTimeout: 6 * 60 * 60 * 1000,
			hookTimeout: 60_000
		}
	})
);
