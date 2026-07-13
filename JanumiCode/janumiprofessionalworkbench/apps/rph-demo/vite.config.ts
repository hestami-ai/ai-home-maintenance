import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	// Resolve the workspace @janumipwb/* packages to their TS SOURCE (the "source" export condition each package
	// declares) instead of built dist. This means `bun run dev` picks up engine edits immediately — no `bun run
	// build` in between (fixes the G3 dev-loop footgun). Vite compiles the source on the fly; production `vite build`
	// still works from source too. "source" is listed FIRST but the defaults are preserved so non-workspace deps
	// resolve normally.
	resolve: {
		conditions: ['source', 'module', 'browser', 'development|production']
	},
	ssr: {
		// The engine's native better-sqlite3 driver must stay external to the SSR bundle (and never reach the browser).
		external: ['better-sqlite3'],
		resolve: {
			conditions: ['source', 'module', 'node', 'development|production']
		}
	}
});
