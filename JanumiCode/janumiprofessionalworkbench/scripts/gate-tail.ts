/**
 * ⭐ `JAN-CRITREAD` J2-3 — `bun run gate:tail`, THE LAST STEP OF `gate:fast` (DESIGN-what-the-tests-prove.md §5.6;
 * ROADMAP J2-3 + J2-4; `REG-D-072` D10).
 *
 * It runs `reviewer:qual:check` from the repository root and the browser tests in `apps/rph-demo`, BOTH, ALWAYS, and
 * exits with the WORSE of the two — so an e2e red cannot skip the check, and a red check cannot hide the browser tests.
 * Chained with `&&` neither placement works: early, a red check blinds every step after it; after e2e, any e2e red
 * skips the check without a word.
 *
 * ⛔ ITS STEPS ARE EXPORTED, AND THAT IS LOAD-BEARING. The sequencing pin (`verif/reviewer-qualification-sequencing
 * .test.ts`) resolves `gate:fast` to the scripts it reaches, following a step runner through `GATE_STEPS` — a runner
 * that kept its steps in code would hide the check from any resolver (D10). Its work stays behind `import.meta.main`,
 * so reading the list runs nothing.
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** A step: a package script, and the directory (repository-relative) whose `package.json` declares it. */
export interface GateStep {
	readonly cwd: string;
	readonly script: string;
}

export const GATE_STEPS: readonly GateStep[] = [
	{ cwd: '.', script: 'reviewer:qual:check' },
	{ cwd: 'apps/rph-demo', script: 'e2e' }
];

/** Runs one step to completion, synchronously: its exit code, or `null` when a signal ended it. */
export type StepRunner = (step: GateStep) => number | null;

/**
 * Every step, in order, whatever the ones before it returned — then the worse exit: the highest code, a step ended by
 * a signal counting as 1. Zero only when every step passed.
 */
export function runGateTail(steps: readonly GateStep[], run: StepRunner): number {
	const codes = steps.map((step) => run(step) ?? 1);
	return Math.max(0, ...codes);
}

if (import.meta.main) {
	const root = fileURLToPath(new URL('../', import.meta.url));
	process.exitCode = runGateTail(GATE_STEPS, (step) => {
		const where = step.cwd === '.' ? '' : step.cwd + ': ';
		process.stdout.write(`gate:tail — ${where}bun run ${step.script}\n`);
		return spawnSync(process.execPath, ['run', step.script], { cwd: join(root, step.cwd), stdio: 'inherit' }).status;
	});
}
