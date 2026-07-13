import { defineConfig, devices } from '@playwright/test';

// E2E harness for the PWA Designer + Undertaking Workbench.
//
// A spec here drives the FULL stack — headless browser -> SvelteKit server action/load -> RPH engine
// -> SQLite -> pure projection -> DOM — so a green spec proves the UX actually OPERATES the event-sourced
// engine, not merely that a route returns 200. Three assertion planes are used across the suite:
//   1. visual   — screenshots (an agent can read the PNGs back to see the rendered UX)
//   2. semantic — DOM roles/text (the control exists, the Charter label is right, no dead-ends)
//   3. truth    — the /__introspect endpoint's event-log/object state matches what the UI claims (INV-5)
//
// The browser is the SYSTEM Edge (Chromium) via `channel`, so no Playwright browser download is required.
// RPH_DEMO_MODE=test makes the server spin up a fresh, deterministic engine per boot (see
// src/lib/server/workbench.ts): a throwaway temp SQLite DB + an injected monotonic clock and ULID sequence,
// which keeps ids and screenshots stable and diffable.
const PORT = 4319;

export default defineConfig({
	testDir: './e2e',
	testMatch: '**/*.e2e.ts',
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: 0,
	workers: 1,
	reporter: [['list'], ['json', { outputFile: 'e2e-results/results.json' }]],
	outputDir: 'e2e-results/artifacts',
	timeout: 30_000,
	expect: { timeout: 7_000 },
	use: {
		baseURL: `http://127.0.0.1:${PORT}`,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure'
	},
	projects: [{ name: 'edge', use: { ...devices['Desktop Chrome'], channel: 'msedge' } }],
	webServer: {
		command: 'bun run e2e:server',
		url: `http://127.0.0.1:${PORT}`,
		reuseExistingServer: true,
		timeout: 120_000,
		env: { RPH_DEMO_MODE: 'test' }
	}
});
