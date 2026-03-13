import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
	test: {
		root: '.',
		include: [
			'src/test/unit/**/*.test.ts',
			'src/test/scenarios/**/*.test.ts',
			'scripts/test/**/*.test.ts',
		],
		exclude: ['src/test/host/**'],
		globals: false,
		setupFiles: ['src/test/helpers/setup.ts'],
		coverage: {
			provider: 'v8',
			include: ['src/lib/**/*.ts'],
			exclude: ['src/test/**', 'src/webview/**'],
		},
	},
	resolve: {
		alias: {
			vscode: path.resolve(__dirname, 'src/test/helpers/__mocks__/vscode.ts'),
		},
	},
});
