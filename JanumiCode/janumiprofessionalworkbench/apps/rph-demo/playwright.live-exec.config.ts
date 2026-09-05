import { defineConfig, devices } from '@playwright/test';

// JAN-LIVEEXEC — the LIVE EXECUTION lane: a work unit runs on a REAL model and is reviewed by a REAL, DIFFERENT
// one. Sibling of playwright.live.config.ts, which runs the real Pi AUTHORING agent; this one exercises the
// EXECUTION plane instead. Run: bun run e2e:live-exec.
//
// ⛔ DELIBERATELY OUTSIDE THE GATE, AND IT MUST STAY THERE. It hits the network, costs money, and is
// non-deterministic — a flaky gate makes every OTHER failure unattributable, which is worse than having no
// live coverage at all. The deterministic lane keeps proving the wiring; this lane exists to produce an
// OBSERVATION about model behaviour that no gate can.
//
// ⚠ IT BOOTS IN RPH_DEMO_MODE=test so the harness (reset / introspect / stable ids) survives — only the TOOLS
// are real. That is the same compromise the authoring live lane already documents.
const PORT = 4322;

// ⛔ NO MODEL LABEL IS PINNED HERE (REG-D-052: the model is configured, never pinned; REG-F-331 measured what
// pinning costs — a rotted label made EVERY review fail). The four keys are passed THROUGH from the operator's
// environment; the app refuses, with its own reasoning, when one is unset.
//
// ⭑ THE GUARD BELOW IS OPERATOR UX, NOT A SECOND POLICY. Without it the run boots, drives a browser for a
// minute, and fails deep inside a form submission with a 400 — so it names all four keys at once, up front.
const REQUIRED = [
	'JPWB_EXECUTOR',
	'JPWB_EXECUTOR_MODEL',
	'JPWB_ASSURANCE_TOOL',
	'JPWB_ASSURANCE_MODEL'
] as const;

const missing = REQUIRED.filter((k) => !process.env[k]?.trim());
if (missing.length > 0)
	throw new Error(
		`The live execution lane needs all four backing-tool keys and is missing: ${missing.join(', ')}.\n` +
			'  JPWB_EXECUTOR / JPWB_EXECUTOR_MODEL  — the tool and model that PRODUCE the work product\n' +
			'  JPWB_ASSURANCE_TOOL / JPWB_ASSURANCE_MODEL — the tool and model that REVIEW it\n' +
			'⚠ The two models must DIFFER, or the reasoning review is refused for non-independence (ASR-13) — ' +
			'which is the check working, not a fault.\n' +
			'Nothing is defaulted: the model is a deployment choice (REG-D-052).'
	);

const passthrough = Object.fromEntries(
	REQUIRED.map((k) => [k, process.env[k]!.trim()])
) as Record<(typeof REQUIRED)[number], string>;

export default defineConfig({
	testDir: './e2e-live-exec',
	testMatch: '**/*.live.ts',
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: 0,
	workers: 1,
	reporter: [['list'], ['json', { outputFile: 'e2e-results/results-live-exec.json' }]],
	outputDir: 'e2e-results/artifacts-live-exec',
	globalSetup: './e2e/global-setup.ts',
	globalTeardown: './e2e/global-teardown.ts',
	// Two real model calls per run (produce, then review), each of which may think for a while.
	timeout: 600_000,
	expect: { timeout: 20_000 },
	use: {
		baseURL: `http://127.0.0.1:${PORT}`,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure'
	},
	projects: [{ name: 'edge', use: { ...devices['Desktop Chrome'], channel: 'msedge' } }],
	webServer: {
		command: `node ../../node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${PORT} --strictPort`,
		url: `http://127.0.0.1:${PORT}/test-api/introspect`,
		reuseExistingServer: false,
		timeout: 120_000,
		env: { RPH_DEMO_MODE: 'test', ...passthrough }
	}
});
