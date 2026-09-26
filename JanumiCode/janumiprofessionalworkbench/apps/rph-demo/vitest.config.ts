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
			]
		}
	})
);
