import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
	preprocess: vitePreprocess(),
	kit: { 
		adapter: adapter({
			// Increase body size limit for file uploads
			// Default is 512KB, setting to 100MB for media uploads
			bodySize: 100 * 1024 * 1024  // 100MB in bytes
		}),
		csrf: {
			// Disable CSRF protection - not needed because session cookies use SameSite=strict
			// SameSite=strict prevents cookies from being sent in cross-site requests,
			// which is the root cause of CSRF attacks. This also allows mobile apps to work.
			checkOrigin: false
		}
	}
};

export default config;
