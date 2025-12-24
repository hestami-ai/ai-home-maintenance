import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
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
