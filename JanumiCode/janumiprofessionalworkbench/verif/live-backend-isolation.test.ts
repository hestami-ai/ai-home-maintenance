// ⭐ `JAN-SELREV` SR-1 (D8) — THE GATE NEVER INHERITS A LIVE-BACKEND SELECTION, MEASURED IN CHILD PROCESSES.
//
// ⛔ THE DEFECT (`REG-F-457` G8). Every backend switch keys on its variable's ABSENCE: `JPWB_ASSURANCE_TOOL` turns the
// declared stand-in into the real reviewer, `JPWB_EXECUTOR` the fixture into a real executor, `JPWB_AGENT=pi` the mock
// into the live Pi agent. The gate's root vitest configs, a `vitest run` in `apps/rph-demo` and the e2e server all
// inherited the shell, so an operator who exported the selected configuration (`REG-D-084`) turned the gate's stand-ins
// into real, paid runs. (`turbo run test` did not pass them on: its strict env mode withholds undeclared variables.)
//
// ⭑ WHY CHILDREN. The remedy removes the eight when a gate process STARTS, so only a process started with them set can
// show it working: an in-process assertion is green today and proves nothing. Each case below starts one entry point
// with all eight EXPORTED and asks, inside it, what it selected:
//   · the root source config and the root artifact config (`vitest.config.ts`, `vitest.dist.config.ts`), and the app's
//     own `vitest run --passWithNoTests` (the command `turbo run test` runs in `apps/rph-demo`, started directly, since
//     turbo itself would withhold the eight) — each running the probe,
//     `apps/rph-demo/src/lib/server/live-backend-isolation.probe.test.ts`;
//   · the real Playwright runner on the gate's own config, with `--list` and `live-backend-isolation.reporter.ts`, which
//     reports the environment the e2e server would be launched with.
//
// ⛔ HERMETIC. The children search a PATH that is the EMPTY `NO_PROGRAMS` directory; the exported program overrides name
// files that do not exist inside it; the exported models are fixture labels; and the probe runs no review, opens no
// executor and starts no agent — so no child is one mutant away from a real reviewer, executor or agent.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PROBE_MARK, type ServerEnvironmentReport } from './live-backend-isolation.reporter.js';
import { NO_PROGRAMS } from './reviewer-qualification-hermetic.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const APP = join(ROOT, 'apps', 'rph-demo');
const VITEST = join(ROOT, 'node_modules', 'vitest', 'vitest.mjs');
const PLAYWRIGHT = join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js');
const PROBE = 'src/lib/server/live-backend-isolation.probe.test.ts';
const REPORTER = join(ROOT, 'verif', 'live-backend-isolation.reporter.ts');

/**
 * The design's eight (D8), each with a value that would select a live backend if it reached the process — RESTATED
 * here, never imported from the module that removes them, so a name that module forgot is still exported.
 */
const EXPORTED: Readonly<Record<string, string>> = {
	JPWB_ASSURANCE_TOOL: 'devin',
	JPWB_ASSURANCE_MODEL: 'exported-assurance-model',
	JPWB_JUDGE_MODEL: 'exported-judge-model',
	JPWB_EXECUTOR: 'agy',
	JPWB_EXECUTOR_MODEL: 'exported-executor-model',
	JPWB_AGENT: 'pi',
	// ⛔ Paths INSIDE the empty directory, to files that do not exist: were an override to reach an adapter, it would
	// name no program.
	JPWB_DEVIN_BIN: join(NO_PROGRAMS, 'devin-exported-override'),
	JPWB_AGY_BIN: join(NO_PROGRAMS, 'agy-exported-override')
};

/**
 * ⭑ THE CHILD'S RECEIPT, exported beside the eight. The canary is NOT one of them, so no entry point removes it; the flag
 * tells the probe that this instrument started it. A child that did not receive the exported environment has neither:
 * the vitest probe then skips its receipt case, so the child no longer reports five passed of five, and the Playwright
 * probe lists no canary. Without it, a child started WITHOUT the eight would pass exactly as one that removed them — a
 * control that cannot fail.
 */
const CANARY = 'JPWB_LIVE_BACKEND_CANARY';
const RECEIPT: Readonly<Record<string, string>> = { [CANARY]: 'exported', LIVE_BACKEND_PROBE: '1' };

/** This process's environment, less every spelling of PATH and vitest's own worker markers, with PATH = no programs,
 *  the eight exported, and the receipt. */
function exportedEnvironment(): NodeJS.ProcessEnv {
	const env: Record<string, string> = {};
	for (const [k, v] of Object.entries(process.env))
		if (v !== undefined && !/^path$/i.test(k) && !/^VITEST/i.test(k)) env[k] = v;
	return { ...env, PATH: NO_PROGRAMS, ...EXPORTED, ...RECEIPT };
}

/** One child, run to completion: its exit status and everything it printed. */
function child(cwd: string, args: readonly string[]): { status: number | null; out: string } {
	const r = spawnSync(process.execPath, args, {
		cwd,
		env: exportedEnvironment(),
		encoding: 'utf8',
		maxBuffer: 64 * 1024 * 1024,
		windowsHide: true,
		timeout: 180_000
	});
	return {
		status: r.status,
		out: `${r.stdout ?? ''}${r.stderr ?? ''}${r.error ? `\n${String(r.error)}` : ''}`
	};
}

/** The lines of a vitest child's output that say what failed — the red, quoted rather than summarised. */
const failures = (out: string): string =>
	out
		.split(/\r?\n/)
		.filter((l) => /×|AssertionError|Error:|Tests\s|Test Files/.test(l))
		.slice(0, 40)
		.join('\n');

/**
 * A vitest child's own count of the probe's tests: the probe must have RUN, all five cases, and passed. The fifth is the
 * receipt, which runs only in a child that received the exported environment.
 */
function expectProbePassed(r: { status: number | null; out: string }): void {
	expect(
		r.status,
		`the probe failed in a child started with the eight exported:\n${failures(r.out)}`
	).toBe(0);
	expect(
		r.out,
		`the child ran no probe, or never received the exported environment — a green that observed nothing:\n${failures(r.out)}`
	).toMatch(/Tests\s+5 passed \(5\)/);
}

describe('⭐ D8 — a gate entry point started with the eight live-backend variables EXPORTED still selects the stand-ins', () => {
	it('⭑ CONTROL — the arrangement exports all eight, into a PATH that finds no program', () => {
		const env = exportedEnvironment();
		expect(Object.keys(EXPORTED)).toHaveLength(8);
		for (const [k, v] of Object.entries(EXPORTED)) expect(env[k]).toBe(v);
		expect(Object.keys(env).filter((k) => /^path$/i.test(k))).toEqual(['PATH']);
		expect(env.PATH).toBe(NO_PROGRAMS);
		for (const [k, v] of Object.entries(RECEIPT)) expect(env[k]).toBe(v);
		expect(Object.keys(EXPORTED), 'the canary must not be one of the eight').not.toContain(CANARY);
	});

	it('the root SOURCE config (`vitest.config.ts`)', () => {
		expectProbePassed(
			child(ROOT, [
				VITEST,
				'run',
				'--config',
				'vitest.config.ts',
				'--project',
				'app:rph-demo',
				`apps/rph-demo/${PROBE}`
			])
		);
	}, 200_000);

	it('the root ARTIFACT config (`vitest.dist.config.ts`)', () => {
		expectProbePassed(
			child(ROOT, [
				VITEST,
				'run',
				'--config',
				'vitest.dist.config.ts',
				'--project',
				'app:rph-demo',
				`apps/rph-demo/${PROBE}`
			])
		);
	}, 200_000);

	it('the app’s own `vitest run --passWithNoTests` — what `turbo run test` runs in `apps/rph-demo`', () => {
		expectProbePassed(child(APP, [VITEST, 'run', '--passWithNoTests', PROBE]));
	}, 200_000);

	it('the e2e server’s environment, as the real Playwright runner composes it from the gate’s own config', () => {
		const r = child(APP, [
			PLAYWRIGHT,
			'test',
			'--config',
			'playwright.config.ts',
			'--list',
			'--reporter',
			REPORTER,
			'smoke.e2e.ts'
		]);
		const line = r.out.split(/\r?\n/).find((l) => l.startsWith(PROBE_MARK));
		expect(
			line,
			`the Playwright probe reported nothing (exit ${r.status}):\n${r.out.slice(0, 2000)}`
		).toBeDefined();
		const report = JSON.parse(line!.slice(PROBE_MARK.length)) as ServerEnvironmentReport;
		expect(
			report.jpwbVariables.filter((v) => v in EXPORTED),
			'a live-backend selection would reach the e2e server'
		).toEqual([]);
		// ⭑ CONTROL — the report is the server's environment: it carries the mode the config gives the server, AND the
		// canary the runner inherited from this parent, so it was composed from the environment the eight were exported in.
		expect(report.demoMode).toBe('test');
		expect(
			report.jpwbVariables,
			'the server’s environment lacks the canary: the runner never received the exported environment, or the probe dropped its own'
		).toContain(CANARY);
		expect(r.status).toBe(0);
	}, 200_000);
});
