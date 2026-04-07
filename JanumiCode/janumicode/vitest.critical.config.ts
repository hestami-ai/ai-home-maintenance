import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		root: '.',
		include: [
			'src/test/unit/workflow/workflowMetadata.test.ts',
			'src/test/unit/workflow/workflowInvariants.test.ts',
			'src/test/unit/workflow/intakeMmpFlowRegression.test.ts',
			'src/test/unit/ui/panelMmp.test.ts',
			'src/test/unit/ui/panelMmp.failureInjection.test.ts',
			'src/test/unit/contracts/mmpMessageContract.table.test.ts',
			'src/test/unit/webview/mmpSubmitContract.test.ts',
		],
		exclude: ['src/test/host/**', 'src/test/scenarios/**'],
		globals: false,
		setupFiles: ['src/test/helpers/setup.ts'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json-summary', 'lcov'],
			reportsDirectory: path.resolve(__dirname, 'coverage', 'critical'),
			include: [
				'src/lib/workflow/stateMachine.ts',
				'src/lib/ui/governedStream/panelMmp.ts',
				'src/webview/mmp.ts',
				'src/lib/database/init.ts',
				'src/lib/database/rpcClient.ts',
			],
			exclude: ['src/test/**'],
			thresholds: {
				lines: 32,
				functions: 22,
				statements: 31,
				branches: 18,
			},
		},
	},
	resolve: {
		alias: {
			vscode: path.resolve(__dirname, 'src/test/helpers/__mocks__/vscode.ts'),
		},
	},
});
