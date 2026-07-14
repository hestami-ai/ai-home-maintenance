import { defineConfig, devices } from '@playwright/test';

// LIVE E2E — runs the REAL Pi agent (JPWB_AGENT=pi) against a genuine NL prompt, so it is non-deterministic and
// hits the network. It is DELIBERATELY separate from the deterministic gate (playwright.config.ts): its own port,
// its own test dir (e2e-live/), no retries, long timeouts. It still boots the server in RPH_DEMO_MODE=test so it
// keeps the harness (reset / introspect / stable ids) — only the AGENT is real. Run: bun run e2e:live.
const PORT = 4321;

export default defineConfig({
	testDir: './e2e-live',
	testMatch: '**/*.live.ts',
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: 0,
	workers: 1,
	reporter: [['list'], ['json', { outputFile: 'e2e-results/results-live.json' }]],
	outputDir: 'e2e-results/artifacts-live',
	// Same review gallery (cleared per run) as the gate — this run's artifacts become e2e-results/gallery/index.html.
	globalSetup: './e2e/global-setup.ts',
	globalTeardown: './e2e/global-teardown.ts',
	timeout: 360_000,
	expect: { timeout: 15_000 },
	use: {
		baseURL: `http://127.0.0.1:${PORT}`,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure'
	},
	projects: [{ name: 'edge', use: { ...devices['Desktop Chrome'], channel: 'msedge' } }],
	webServer: {
		command: 'bun run e2e:server:live',
		url: `http://127.0.0.1:${PORT}`,
		reuseExistingServer: true,
		timeout: 120_000,
		// Test-mode harness (reset/introspect) but the LIVE Pi agent. JPWB_AGENT_MODEL can override the model.
		env: { RPH_DEMO_MODE: 'test', JPWB_AGENT: 'pi' }
	}
});
