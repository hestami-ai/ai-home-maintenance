import { defineConfig, devices } from '@playwright/test';

// LIVE E2E for the FULL faithfulness loop with BOTH real models: the Pi/Codex agent EXECUTES and the agy/Gemini judge
// ASSURES (JPWB_ASSESSOR=agy forces the real judge even under the test harness; a DIFFERENT vendor than the executor).
// Deliberately isolated from the gate AND from the other live config: its own port (4322), its own dir
// (e2e-live-assess/), no retries, very long timeout (up to two Pi turns + two agy calls). Run: bun run e2e:assess-live.
const PORT = 4322;

export default defineConfig({
	testDir: './e2e-live-assess',
	testMatch: '**/*.live.ts',
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: 0,
	workers: 1,
	reporter: [['list'], ['json', { outputFile: 'e2e-results/results-assess-live.json' }]],
	outputDir: 'e2e-results/artifacts-assess-live',
	globalSetup: './e2e/global-setup.ts',
	globalTeardown: './e2e/global-teardown.ts',
	timeout: 1_200_000,
	expect: { timeout: 15_000 },
	use: {
		baseURL: `http://127.0.0.1:${PORT}`,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure'
	},
	projects: [{ name: 'edge', use: { ...devices['Desktop Chrome'], channel: 'msedge' } }],
	webServer: {
		command: 'bun run e2e:server:assess-live',
		url: `http://127.0.0.1:${PORT}`,
		reuseExistingServer: true,
		timeout: 120_000,
		// Test-mode harness (reset/introspect) + the LIVE Pi executor + the LIVE agy judge (JPWB_ASSESSOR=agy).
		env: { RPH_DEMO_MODE: 'test', JPWB_AGENT: 'pi', JPWB_ASSESSOR: 'agy' }
	}
});
