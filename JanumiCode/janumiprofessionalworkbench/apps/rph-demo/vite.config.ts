import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	// The engine runs ONLY in the SvelteKit server (`+page.server.ts`); its native better-sqlite3 driver must stay
	// external to the SSR bundle (and never reaches the browser bundle).
	ssr: {
		external: ['better-sqlite3']
	}
});
