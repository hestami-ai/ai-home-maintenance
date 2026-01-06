import adapter from 'svelte-adapter-bun';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			// Bun adapter options
			out: 'build',
			// Enable precompression for static assets
			precompress: false,
			// Development mode detection
			development: process.env.NODE_ENV !== 'production',
			// Mark Node.js built-ins as external - Bun resolves these at runtime
			// Used by: src/routes/uploads/[...path]/+server.ts, src/lib/server/api/routes/document.ts
			external: ['fs/promises', 'path', 'crypto']
		}),
		alias: {
			$server: 'src/lib/server',
			'$server/*': 'src/lib/server/*'
		}
	}
};

// Note: For proxy header trust (X-Forwarded-*), set these environment variables at runtime:
// - ADDRESS_HEADER=X-Forwarded-For
// - XFF_DEPTH=2 (adjust based on proxy chain depth: Cloudflare -> NAT -> Traefik = 2-3)
// - PROTOCOL_HEADER=X-Forwarded-Proto
// - HOST_HEADER=X-Forwarded-Host

export default config;
