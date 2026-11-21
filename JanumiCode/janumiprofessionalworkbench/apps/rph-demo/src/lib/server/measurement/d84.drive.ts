// ⭐⭐ `JAN-EXEC` Phase 7 — design D84 (as amended 2026-11-21; `REG-D-189`; the lead's rulings r1, Q7) — THE MEASUREMENT'S LAUNCHER: one step of D84
// (`d84-steps.ts`), run under vitest's module runner as every test of the stage runs, by its own config (`apps/rph-demo/vitest.d84.config.ts`), which
// collects this file alone and loads no live-backend setup file:
//
//   cd apps/rph-demo && JPWB_DEMO_DB=<folder>/copy/demo.sqlite JPWB_D84_FOLDER=<folder> JPWB_D84_STEP=<step> … bunx vitest run --config vitest.d84.config.ts
//
// ⚠ From `apps/rph-demo`, as the app's own `vitest run` is: from the workbench's root SvelteKit's plugin finds no Svelte config and nothing is collected.
// ⭑ WHAT A STEP SAID is printed, and — once the folder is begun — kept, one JSON line a step, in `<folder>/steps.log`: vitest shows a passing test's
// output only in some reporters, and the lead approves by the manifest's sha256 a showing says.
// ⭑ THE REAL PROGRAMS ARE HERE AND NOWHERE ELSE: devin through `execFile`, as its adapters run it; Pi's opener, as the helper loads it; `devin --version`,
// as the Historian's check reads it. ⛔ They are reached only by the call steps, and only with `JPWB_D84_PAID=1` and an approval whose sha256 holds.
// ⛔ NEVER COLLECTED BY THE GATE: its name is no test's, and the gate's configs collect `*.test.ts` alone.
import { execFile, execFileSync } from 'node:child_process';
import { appendFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';
import { stageDepsOf } from '../stage-deps.js';
import { DEVIN_BIN_OVERRIDE, type DevinExec } from '../tools/devin-reviewer.js';
import { D84_LAYOUT } from './d84-files.js';
import { nodeMeasurementHost } from './d84-folder.js';
import { realProbeExec } from './d84-probes.js';
import { runD84Step, type StepHost } from './d84-steps.js';

const run = promisify(execFile);
const DEVIN = DEVIN_BIN_OVERRIDE ?? 'devin';

/** The processes whose parent is `pid`, by id and name: PowerShell's process table on Windows, `ps` elsewhere. ⛔ It stops none. */
async function childrenOf(pid: number): Promise<readonly { readonly pid: number; readonly name: string }[]> {
	if (process.platform === 'win32') {
		const { stdout } = await run(
			'powershell',
			['-NoProfile', '-Command', `Get-CimInstance Win32_Process -Filter "ParentProcessId=${pid}" | ForEach-Object { "$($_.ProcessId) $($_.Name)" }`],
			{ windowsHide: true, timeout: 60_000 }
		);
		return parsed(String(stdout));
	}
	const { stdout } = await run('ps', ['-o', 'pid=,comm=', '--ppid', String(pid)], { timeout: 60_000 }).catch(() => ({ stdout: '' }));
	return parsed(String(stdout));
}

/** `<pid> <name>` lines, read. */
const parsed = (text: string) =>
	text
		.split(/\r?\n/)
		.map((l) => /^\s*(\d+)\s+(.+?)\s*$/.exec(l))
		.filter((m): m is RegExpExecArray => m !== null)
		.map((m) => ({ pid: Number(m[1]), name: m[2]! }));

const host: StepHost = {
	deps: () => stageDepsOf(false),
	transports: {
		devinExec: run as unknown as DevinExec,
		openPi: async (context, modelId, place) => (await import('../tools/pi-executor.js')).openPiExecutionSession(context, modelId, place),
		// As the Historian's own check reads it (`devin-historian.ts`, `devinVersion`): `devin --version`, run with no session and no model.
		devinVersion: async () => String((await run(DEVIN, ['--version'], { timeout: 30_000, windowsHide: true })).stdout)
	},
	probeExec: realProbeExec,
	childrenOf,
	folderHost: nodeMeasurementHost(),
	now: () => new Date().toISOString(),
	checkoutHead: () => String(execFileSync('git', ['--no-optional-locks', 'rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true })).trim()
};

it('D84 — one step of the measurement', async () => {
	const startedAt = new Date().toISOString();
	const outcome = await runD84Step(process.env, host);
	for (const line of outcome.said) console.log(`[D84] ${line}`);
	const folder = process.env.JPWB_D84_FOLDER ?? '';
	// ⭑ Kept only in a folder begun: a refused begin writes nothing there.
	if (folder.trim() !== '' && existsSync(join(folder, D84_LAYOUT.state)))
		appendFileSync(
			join(folder, 'steps.log'),
			`${JSON.stringify({ step: process.env.JPWB_D84_STEP ?? '', role: process.env.JPWB_D84_ROLE, probe: process.env.JPWB_D84_PROBE, startedAt, endedAt: new Date().toISOString(), ...outcome })}\n`,
			'utf8'
		);
	expect(outcome.ok, outcome.said.join('\n')).toBe(true);
});
