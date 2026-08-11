import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
		env: {
			privatePrefix: 'JPWB_PRIVATE_',
			publicPrefix: 'JPWB_PUBLIC_'
		}
	}
};

export default config;
