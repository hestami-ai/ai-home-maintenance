import { defineConfig, devices } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { laneKeysRefusal, requiredLaneKeys, TEST_TIMEOUT_MS } from './e2e-live-exec/lane-config';

// JAN-LIVEEXEC — the LIVE EXECUTION lane: a work unit runs on a REAL model and is reviewed by a REAL, DIFFERENT
// one. Sibling of playwright.live.config.ts, which runs the real Pi AUTHORING agent; this one exercises the
// EXECUTION plane instead. Run: bun run e2e:live-exec.
//
// ⛔ DELIBERATELY OUTSIDE THE GATE, AND IT MUST STAY THERE. It hits the network, costs money, and is
// non-deterministic — a flaky gate makes every OTHER failure unattributable, which is worse than having no
// live coverage at all. The deterministic lane keeps proving the wiring; this lane exists to produce an
// OBSERVATION about model behaviour that no gate can.
//
// ~~⚠ IT BOOTS IN RPH_DEMO_MODE=test so the harness (reset / introspect / stable ids) survives — only the TOOLS
// are real. That is the same compromise the authoring live lane already documents.~~
// ⭑ `JAN-SELREV` SR-3 — CORRECTED: it boots `RPH_DEMO_MODE=server` with `JPWB_HARNESS=1` (the `webServer.env` below,
// and why). So it runs OUTSIDE test mode, and its reviewer is chosen exactly as a deployed host's is
// (`src/lib/server/assurance/reviewer-selection.ts`): an unset or unknown tool, a missing model or a program override
// (`JPWB_AGY_BIN`, `JPWB_DEVIN_BIN`) is refused, and a model step is refused before its executor opens.
// ⭐ `JAN-SELRES` RS-1 (D1, D3, D4) — AND SO IS ITS EXECUTOR (`src/lib/server/execution/executor-selection.ts`): an unset
// or unknown `JPWB_EXECUTOR`, an unwired one (`devin`), an agy executor whose program `JPWB_AGY_BIN` replaces, or an
// unset `JPWB_EXECUTOR_MODEL` refuses the model step before anything is dispatched. ⚠ WHAT STILL REFUSES AFTER DISPATCH,
// as before: a Pi model Pi cannot resolve (only Pi's SDK can say), a refused sandbox and a refused context policy are
// found when the executor opens, and recorded as a started-then-failed step. `e2e-live-exec/lane-config.ts` restates the
// executor rules and refuses them at boot, with one rule of the lane's own: no agy executor.
const PORT = 4322;

// ⛔ NO MODEL LABEL IS PINNED HERE (REG-D-052: the model is configured, never pinned; REG-F-331 measured what
// pinning costs — a rotted label made EVERY review fail). The keys are passed THROUGH from the operator's
// environment; the app refuses, with its own reasoning, when one is unset. The selected reviewer (REG-D-084, devin
// with glm-5-3-flash-max) is named in the refusal below as the documented configuration, never as a value.
//
// ⭑ THE GUARD BELOW IS OPERATOR UX, NOT A SECOND POLICY. Without it the run boots, drives a browser for a
// minute, and fails deep inside a form submission with a 400 — so it names every missing key at once, up front.
//
// ~~⭐ THE FIFTH KEY, REQUIRED ONLY BY THE TOOL THAT READS IT.
//
// ⛔ THE GUARD BELOW EXISTS SO AN OPERATOR LEARNS EVERYTHING THAT IS MISSING AT ONCE, AND IT MISSED ONE. The
// agy assurance adapter pins `--model judgeModel()`, and `judgeModel()` FAILS CLOSED when `JPWB_JUDGE_MODEL` is
// unset — *“an unconfigured judge has no identity to record, and recording a placeholder is precisely what
// this module was written to stop”*. So `JPWB_ASSURANCE_TOOL=agy` passed this guard, booted a browser, and
// failed a minute later inside a form submission: the exact experience the guard's own comment says it is here
// to prevent.
//
// ⚠ CONDITIONAL, NOT UNCONDITIONAL. Demanding it of a `devin` or `pi` reviewer would refuse a configuration
// that works — a guard that over-refuses teaches operators to bypass it.~~
// ⭑ STRUCK by `JAN-SELREV` SR-3: the four-key list it sat beside demanded `JPWB_ASSURANCE_MODEL` of agy too, which
// agy never reads; and a `pi` reviewer is not a configuration that works — the product refuses it, no reviewer adapter
// being wired for it (`reviewer-selection.ts`).
//
// ⭐ `JAN-SELREV` SR-3 — WHICH KEYS DEPENDS ON THE REVIEWING TOOL, AND `e2e-live-exec/lane-config.ts` SAYS WHICH. This
// list used to demand the devin model variable of EVERY tool, and a conditional added the agy one for agy only — so an
// agy lane was refused a key agy never reads (`docs/_working/DESIGN-the-selected-reviewer.md` §2 G9; `REG-F-461`). The
// helper maps each wired tool to the one variable it reads its model from, refuses a tool the product would refuse and
// a program override the product would refuse for the selected tool, and is held to the product's own selector by
// `verif/live-exec-lane-config.test.ts`. ⚠ Neither this file nor the spec names a reviewer model variable itself:
// that test reddens if either does — and if this file stops throwing the refusal below.
const refusal = laneKeysRefusal(process.env);
if (refusal) throw new Error(refusal);

const passthrough = Object.fromEntries(
	requiredLaneKeys(process.env.JPWB_ASSURANCE_TOOL).map((k) => [k, process.env[k]!.trim()])
) as Record<string, string>;

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
	// ⭐ `JAN-SELREV` SR-3 — FROM THE REVIEWER'S BOUND, NOT FROM "TWO CALLS". This said *"Two real model calls per run
	// (produce, then review)"* and allowed 600 s. The one Begin & Execute POST runs up to 3 tries, each an executor call
	// and a review of at most ~~2~~ ⭐ 4 reviewer calls of 240 s: the reviewer alone may take ~~3 × 2 × 240 = 1,440 s~~
	// ⭐ 3 × 4 × 240 = 2,880 s (`JAN-EXEC` Phase 7 `P7-2b`, 2026-10-09: a call that throws short of its tool's bound is
	// run once more). The wait and its arithmetic live in `e2e-live-exec/lane-config.ts` (~~2,160 s for the POST,
	// 2,280 s for the test~~ ⭐ 3,600 s for the POST, 3,720 s for the test).
	timeout: TEST_TIMEOUT_MS,
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
		// ~~⛔ THIS LANE HAS NEVER RUN.~~ ⭑ `JAN-SELREV` SR-3 — HISTORY, written 2026-09-20 (`ce6000ce`): as then
		// configured, the lane could not run. It ran green later that day (`7a988e2d`), and a passing run of 2026-09-20
		// is recorded in `e2e-results/results-live-exec.json`, git-ignored, on the host that ran it (`REG-F-445` cites
		// it). The spec's header records runs of 2026-09-05, under an earlier arrangement. As then configured, it booted
		// `RPH_DEMO_MODE='test'` with no `JPWB_DEMO_DB`, so
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
