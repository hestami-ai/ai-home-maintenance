// ⭐ `JAN-CRITREAD` J2-3 — `gate:tail`, THE LAST STEP OF `gate:fast` (DESIGN-what-the-tests-prove.md §5.6; ROADMAP
// J2-3 + J2-4; `REG-D-072` D10).
//
// The tail runs `reviewer:qual:check` and the browser tests, and exits with the WORSE of the two. The position is the
// argument: placed early, a red check would blind every step after it; appended after e2e, any e2e red would skip it
// without a word. So neither may hide the other — both always run, and either red makes the tail red.
//
// Its step list is EXPORTED, because the sequencing pin (`reviewer-qualification-sequencing.test.ts`) resolves
// `gate:fast` through it: a runner that hid its steps in code would hide the check from any resolver (D10).
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { GATE_STEPS, runGateTail, type GateStep } from '../scripts/gate-tail.js';
import { BUN, hermeticEnv } from './reviewer-qualification-hermetic.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const scripts = (pkg: string): Record<string, string> =>
	(JSON.parse(readFileSync(`${ROOT}${pkg}`, 'utf8')) as { scripts: Record<string, string> }).scripts;

/** A step runner that answers from a table and records what it was asked to run, in order. */
const table = (codes: Record<string, number | null>) => {
	const ran: string[] = [];
	return {
		ran,
		run: (step: GateStep) => {
			ran.push(`${step.cwd}:${step.script}`);
			// `in`, not `??`: a `null` in the table is a signal, and must reach the runner as one.
			return step.script in codes ? (codes[step.script] ?? null) : 0;
		}
	};
};

describe('JAN-CRITREAD J2-3 — gate:tail runs the check and the browser tests, and exits with the worse', () => {
	it('⭐ its steps: the check from the root, then the browser tests in apps/rph-demo — each a script that exists', () => {
		expect(GATE_STEPS).toEqual([
			{ cwd: '.', script: 'reviewer:qual:check' },
			{ cwd: 'apps/rph-demo', script: 'e2e' }
		]);
		for (const s of GATE_STEPS)
			expect(scripts(`${s.cwd === '.' ? '' : `${s.cwd}/`}package.json`)[s.script], `${s.cwd}:${s.script}`).toBeTypeOf('string');
		expect(scripts('package.json')['gate:tail']).toBe('bun run scripts/gate-tail.ts');
		expect(scripts('package.json')['reviewer:qual:check']).toBe('bun --conditions=source scripts/reviewer-qual/check.ts');
	});

	it('⭐ CONTROL — both green, the tail is green, and both ran', () => {
		const t = table({});
		expect(runGateTail(GATE_STEPS, t.run)).toBe(0);
		expect(t.ran).toEqual(['.:reviewer:qual:check', 'apps/rph-demo:e2e']);
	});

	it('⛔ a RED CHECK is not hidden by green browser tests — and does not stop them running', () => {
		const t = table({ 'reviewer:qual:check': 1 });
		expect(runGateTail(GATE_STEPS, t.run)).not.toBe(0);
		expect(t.ran, 'the browser tests still ran').toEqual(['.:reviewer:qual:check', 'apps/rph-demo:e2e']);
	});

	it('⛔ RED BROWSER TESTS are not hidden by a green check', () => {
		const t = table({ e2e: 1 });
		expect(runGateTail(GATE_STEPS, t.run)).not.toBe(0);
		expect(t.ran).toEqual(['.:reviewer:qual:check', 'apps/rph-demo:e2e']);
	});

	it('⭐ the worse of two reds, and a step killed by a signal is red', () => {
		expect(runGateTail(GATE_STEPS, table({ 'reviewer:qual:check': 1, e2e: 2 }).run)).toBe(2);
		expect(runGateTail(GATE_STEPS, table({ 'reviewer:qual:check': 2, e2e: 1 }).run)).toBe(2);
		expect(runGateTail(GATE_STEPS, table({ e2e: null }).run)).not.toBe(0);
	});
});

// ⭐ `JAN-CRITREAD` J2-3 — THE EXECUTABLE. `runGateTail` returning the worse is not enough: the script must hand it to the
// PROCESS, or `gate:fast`'s `&&` sees 0 and passes a red check and red browser tests alike. So the real script is
// SPAWNED — copied into a mkdtemp tree whose two steps are stand-ins that say they ran and exit as told. Neither the
// real check nor the browser tests can run from there, whatever the script does: the copy's root holds only them.
describe('JAN-CRITREAD J2-3 — the gate:tail SCRIPT exits with the worse, and neither step hides the other', () => {
	const dirs: string[] = [];
	afterAll(() => {
		for (const d of dirs) rmSync(d, { recursive: true, force: true });
	});
	const tail = (check: number, e2e: number): { status: number | null; out: string } => {
		const root = mkdtempSync(join(tmpdir(), 'jpwb-gatetail-'));
		dirs.push(root);
		mkdirSync(join(root, 'scripts'));
		copyFileSync(`${ROOT}scripts/gate-tail.ts`, join(root, 'scripts', 'gate-tail.ts'));
		const manifest = (dir: string, stepScripts: Record<string, string>) => {
			mkdirSync(dir, { recursive: true });
			writeFileSync(
				join(dir, 'package.json'),
				JSON.stringify({ name: 'jpwb-gate-tail-fixture', private: true, type: 'module', scripts: stepScripts })
			);
		};
		manifest(root, { 'reviewer:qual:check': `echo STAND-IN-CHECK-RAN && exit ${check}` });
		manifest(join(root, 'apps', 'rph-demo'), { e2e: `echo STAND-IN-E2E-RAN && exit ${e2e}` });
		const r = spawnSync(BUN, ['scripts/gate-tail.ts'], { cwd: root, encoding: 'utf8', env: hermeticEnv(), windowsHide: true });
		return { status: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
	};
	const bothRan = (out: string) => {
		expect(out, 'the check ran').toContain('STAND-IN-CHECK-RAN');
		expect(out, 'the browser tests ran').toContain('STAND-IN-E2E-RAN');
	};

	it('⭐ CONTROL — both steps green: the process exits 0, and both ran', () => {
		const r = tail(0, 0);
		expect(r.status, r.out).toBe(0);
		bothRan(r.out);
	});

	it('⛔ a RED CHECK reaches the process — and the browser tests still ran', () => {
		const r = tail(1, 0);
		expect(r.status, r.out).toBe(1);
		bothRan(r.out);
	});

	it('⛔ RED BROWSER TESTS reach the process — and the check ran first', () => {
		const r = tail(0, 1);
		expect(r.status, r.out).toBe(1);
		bothRan(r.out);
		expect(r.out.indexOf('STAND-IN-CHECK-RAN'), 'in order').toBeLessThan(r.out.indexOf('STAND-IN-E2E-RAN'));
	});

	it('⭐ the worse of two reds reaches the process', () => {
		expect(tail(1, 2).status).toBe(2);
		expect(tail(2, 1).status).toBe(2);
	});
});
