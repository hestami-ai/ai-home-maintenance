#!/usr/bin/env node
import { spawn } from 'node:child_process';

/**
 * Required test gates for CI:
 * 1) Critical regression matrix (direct + sidecar)
 * 2) Critical coverage thresholds
 */

function run(command, args, env) {
	return new Promise((resolve) => {
		const child = spawn(command, args, {
			shell: true,
			stdio: 'inherit',
			env,
		});
		child.on('close', (code) => resolve(code ?? 1));
	});
}

async function main() {
	const envWithArtifacts = {
		...process.env,
		JANUMICODE_TEST_KEEP_ARTIFACTS: process.env.JANUMICODE_TEST_KEEP_ARTIFACTS ?? '1',
	};

	const steps = [
		{
			label: 'critical regression matrix',
			command: 'pnpm',
			args: ['run', 'test:critical:matrix'],
			env: envWithArtifacts,
		},
		{
			label: 'critical coverage',
			command: 'pnpm',
			args: ['run', 'test:coverage:critical'],
			env: process.env,
		},
	];

	for (const step of steps) {
		process.stdout.write(`[required-gates] Running ${step.label}...\n`);
		const code = await run(step.command, step.args, step.env);
		if (code !== 0) {
			process.stderr.write(`[required-gates] Failed at ${step.label} (exit ${code}).\n`);
			process.exit(code);
		}
	}

	process.stdout.write('[required-gates] All required gates passed.\n');
}

main().catch((error) => {
	process.stderr.write(`${String(error)}\n`);
	process.exit(1);
});
