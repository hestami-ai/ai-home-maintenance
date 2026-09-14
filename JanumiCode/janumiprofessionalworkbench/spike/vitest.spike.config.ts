import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
const PKG_ROOT = fileURLToPath(new URL('../packages', import.meta.url));
const APP_LIB = fileURLToPath(new URL('../apps/rph-demo/src/lib', import.meta.url));
export default defineConfig({
	resolve: {
		alias: [
			{ find: /^@janumipwb\/([a-z0-9-]+)\/(.+)$/, replacement: `${PKG_ROOT}/$1/src/$2.ts` },
			{ find: /^@janumipwb\/([a-z0-9-]+)$/, replacement: `${PKG_ROOT}/$1/src/index.ts` },
			{ find: /^\$lib\/(.*)$/, replacement: `${APP_LIB}/$1` }
		]
	},
	test: {
		name: 'spike',
		root: '.',
		include: ['spike/**/*.spike.ts'],
		passWithNoTests: false,
		testTimeout: 900_000,
		hookTimeout: 900_000,
		maxWorkers: 1,
		fileParallelism: false
	}
});
