import { defineConfig, devices } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

/**
 * ⭐ THE FIFTH KEY, REQUIRED ONLY BY THE TOOL THAT READS IT.
 *
 * ⛔ THE GUARD BELOW EXISTS SO AN OPERATOR LEARNS EVERYTHING THAT IS MISSING AT ONCE, AND IT MISSED ONE. The
 * agy assurance adapter pins `--model judgeModel()`, and `judgeModel()` FAILS CLOSED when `JPWB_JUDGE_MODEL` is
 * unset — *“an unconfigured judge has no identity to record, and recording a placeholder is precisely what
 * this module was written to stop”*. So `JPWB_ASSURANCE_TOOL=agy` passed this guard, booted a browser, and
 * failed a minute later inside a form submission: the exact experience the guard's own comment says it is here
 * to prevent.
 *
 * ⚠ CONDITIONAL, NOT UNCONDITIONAL. Demanding it of a `devin` or `pi` reviewer would refuse a configuration
 * that works — a guard that over-refuses teaches operators to bypass it.
 */
const assuranceTool = process.env.JPWB_ASSURANCE_TOOL?.trim();
const alsoRequired = assuranceTool === 'agy' ? (['JPWB_JUDGE_MODEL'] as const) : ([] as const);

const missing = [...REQUIRED, ...alsoRequired].filter((k) => !process.env[k]?.trim());
if (missing.length > 0)
	throw new Error(
		`The live execution lane is missing ${missing.length} of the ${REQUIRED.length + alsoRequired.length} keys it needs: ${missing.join(', ')}.
` +
			'  JPWB_EXECUTOR / JPWB_EXECUTOR_MODEL  — the tool and model that PRODUCE the work product\n' +
			'  JPWB_ASSURANCE_TOOL / JPWB_ASSURANCE_MODEL — the tool and model that REVIEW it\n' +
			(assuranceTool === 'agy'
				? '  JPWB_JUDGE_MODEL — agy pins the judge model per call and refuses to invent one; `agy models` lists the labels it knows\n'
				: '') +
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
		// ── ⭐⭐ SERVING **AND** OBSERVABLE — THE ARRANGEMENT `R24` EXISTS TO MAKE SAYABLE ───────────────
		//
		// ⛔ THIS LANE HAS NEVER RUN. It booted `RPH_DEMO_MODE='test'` with no `JPWB_DEMO_DB`, so
		// `durableWorkspaceRoot` returned undefined → an IN_MEMORY workspace → and `openPiExecutionSession`
		// THROWS on a non-FILESYSTEM workspace, because a real runner needs a real `cwd`. The lane failed before
		// it measured anything, and nothing reported it because nothing had run it.
		//
		// ⭑ `RPH_DEMO_MODE=server` buys the durable root, the FILESYSTEM workspace and the REAL process runner;
		// `JPWB_HARNESS=1` keeps `/test-api/introspect` — which this config's own readiness probe hits, and which
		// every spec observes through. Before `R24` those were the two values of ONE variable and this lane could
		// have at most one of them.
		env: {
			RPH_DEMO_MODE: 'server',
			JPWB_HARNESS: '1',
			// ⭐ THE SEED THIS LANE NEEDS, CHOSEN AT BOOT BECAUSE IT CANNOT RESET. The spec asserts the PWA
			// picker holds exactly TWO options — the placeholder and the one it publishes itself — so the
			// reference workbench's own published PWA would break it. `empty` seeds the policy library only.
			JPWB_SEED: 'empty',
			// ⚠ ABSOLUTE AND RUN-SCOPED, AND BOTH HALVES ARE LOAD-BEARING. `resolveUndertakingSandbox` REFUSES a
			// root that resolves against the process (it would put deliverables inside the server's own tree),
			// and `R24`'s reset guard refuses a durable store outright — so a lane that reused one path would be
			// unable to reset AND would accumulate another run's workspaces. A fresh directory per run is what
			// makes “durable” and “disposable” both true.
			JPWB_DEMO_DB: join(mkdtempSync(join(tmpdir(), 'jpwb-live-exec-')), 'demo.sqlite'),
			...passthrough
		}
	}
});
