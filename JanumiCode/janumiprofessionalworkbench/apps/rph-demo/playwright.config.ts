import { defineConfig, devices } from '@playwright/test';
import { forgetLiveBackendSelections } from '../../verif/live-backend-isolation';

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
// ⚠ OVERRIDABLE SO TWO WORKING TREES CAN RUN E2E AT ONCE, and 4319 stays the default so nothing changes for a
// single tree. `--strictPort` below is deliberate and STAYS: a silent fallback to another port would let a spec
// pass against a server that is not the one this config configured, which is worse than a loud collision. What
// was wrong was not strictness but that the number was fixed in two places at once — the `url` read `PORT` while
// the `command` hardcoded 4319, so they could disagree. Now there is one source.
const PORT = Number(process.env.RPH_E2E_PORT ?? 4319);

// ⭐ `JAN-SELREV` D8 — THE e2e SERVER NEVER INHERITS A LIVE-BACKEND SELECTION. Playwright launches the server below
// from THIS process's environment (`{ ...process.env, ...webServer.env }`), so the live-backend variables
// (`LIVE_BACKEND_VARIABLES`) are removed here, at config load, before it does: exported, `JPWB_ASSURANCE_TOOL` would turn the declared stand-in into
// the real, paid reviewer, `JPWB_EXECUTOR` the fixture into a real executor, and `JPWB_AGENT=pi` the mock into the live
// agent (`REG-F-457` G8). The live lanes have their own configs, which run the real backends and do not import this one.
forgetLiveBackendSelections();

export default defineConfig({
	testDir: './e2e',
	testMatch: '**/*.e2e.ts',
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	// One retry absorbs the occasional interaction-timing flake in the single-worker sequential run (a control
	// clicked a beat before its enhance/hydration settles). A genuine failure still fails both attempts.
	retries: 1,
	workers: 1,
	reporter: [['list'], ['json', { outputFile: 'e2e-results/results.json' }]],
	outputDir: 'e2e-results/artifacts',
	// Review gallery: cleared per run, then built into e2e-results/gallery/index.html from the shots each spec takes.
	globalSetup: './e2e/global-setup.ts',
	// ⭐ `JAN-CRITREAD` J1-3 (`REG-D-072` D8): the gallery's index, then THE LANE CONTROL's final check, which fails the
	// run on any reasoning-review pass the server kept — across every reset and retry, so `retries: 1` cannot hide one.
	// The live configs keep the gallery's teardown alone: they are not this lane.
	globalTeardown: ['./e2e/global-teardown.ts', './e2e/lane-control-teardown.ts'],
	timeout: 30_000,
	expect: { timeout: 7_000 },
	use: {
		baseURL: `http://127.0.0.1:${PORT}`,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure'
	},
	projects: [{ name: 'edge', use: { ...devices['Desktop Chrome'], channel: 'msedge' } }],
	webServer: {
		// Playwright owns the Vite process directly so teardown can terminate the complete server process on
		// Windows. Reusing an arbitrary dev server would silently bypass RPH_DEMO_MODE=test and invalidate the
		// deterministic reset/introspection contract.
		command: `node ../../node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${PORT} --strictPort`,
		// Readiness is itself a test-mode assertion: this route is 404 outside RPH_DEMO_MODE=test.
		url: `http://127.0.0.1:${PORT}/test-api/introspect`,
		reuseExistingServer: false,
		timeout: 120_000,
		env: { RPH_DEMO_MODE: 'test' }
	}
});
