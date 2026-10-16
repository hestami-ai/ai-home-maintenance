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
	// ⚠ `JAN-SELREV` SR-3 — CHECKED AGAINST A REAL REVIEWER'S WORST CASE: IT DOES NOT COVER IT, AND IS LEFT, SAID SO.
	// This lane boots in test mode, so with no `JPWB_ASSURANCE_TOOL` in the shell its reviewer is the declared
	// stand-in, which calls no model, and 360 s is the Pi agent's allowance. But its server inherits the shell: with a
	// tool exported, a real reviewer judges the turn — up to ~~2 calls~~ ⭐ 4 calls of 240 s per review (the initial one
	// and one repair, ⭐ each run once more when it throws short of its tool's bound: `JAN-EXEC` Phase 7 `P7-2b`,
	// 2026-10-09, which reaches this lane because the authoring floor builds its reviewer through `createFloorRegistry`
	// too, `runPwaFloor` in `src/lib/server/floor.ts`), and up to 2 reviews per turn (the first, and one after the
	// auto-refinement pass). That is ~~4 × 240 s = 960 s~~ ⭐ 8 × 240 s = 1,920 s of reviewer time alone, plus a second
	// agent run, and the agent's run has no time limit to add up (`src/routes/pwa/[id]/agent/+server.ts`). ⛔ Raising
	// this number would change nothing: each spec sets its own `test.setTimeout(360_000)` and polls 340 s for the turn
	// to finish. So run this lane without `JPWB_ASSURANCE_TOOL`; with it exported, a turn that a real reviewer judges
	// can outlast both waits.
	timeout: 360_000,
	expect: { timeout: 15_000 },
	use: {
		baseURL: `http://127.0.0.1:${PORT}`,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure'
	},
	projects: [{ name: 'edge', use: { ...devices['Desktop Chrome'], channel: 'msedge' } }],
	webServer: {
		// Keep the server as Playwright's direct child so Windows teardown cannot strand a Vite listener. A live
		// calibration still requires the test harness mode and therefore must not reuse an arbitrary dev server.
		command:
			'node ../../node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4321 --strictPort',
		// Readiness is itself a harness-mode assertion: this route is 404 outside RPH_DEMO_MODE=test.
		url: `http://127.0.0.1:${PORT}/test-api/introspect`,
		reuseExistingServer: false,
		timeout: 120_000,
		// Test-mode harness (reset/introspect) but the LIVE Pi agent. JPWB_AGENT_MODEL can override the model.
		// ⭐ R3-C (the lead's delegated decision of 2026-10-16, registered as REG-D-114 (19)) — and Pi offline, as the
		// execution lane's server runs it: `playwright.live-exec.config.ts` says what that changes, and that it touches no
		// model call.
		env: { RPH_DEMO_MODE: 'test', JPWB_AGENT: 'pi', PI_OFFLINE: '1' }
	}
});
