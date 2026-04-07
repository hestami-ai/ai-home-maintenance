#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

async function run(command, args, cwd) {
	return await new Promise((resolve) => {
		const child = spawn(command, args, {
			cwd,
			shell: true,
			stdio: 'inherit',
			env: process.env,
		});
		child.on('close', (code) => resolve(code ?? 1));
	});
}

async function main() {
	const scriptDir = path.dirname(fileURLToPath(import.meta.url));
	const repoRoot = path.resolve(scriptDir, '..', '..');
	const passThroughArgs = process.argv.slice(2);

	const directCode = await run(
		'node',
		['scripts/test/run-vitest-db-mode.mjs', 'direct', ...passThroughArgs],
		repoRoot,
	);
	if (directCode !== 0) {
		process.exit(directCode);
	}

	const sidecarCode = await run(
		'node',
		['scripts/test/run-vitest-db-mode.mjs', 'sidecar', ...passThroughArgs],
		repoRoot,
	);
	process.exit(sidecarCode);
}

main().catch((err) => {
	process.stderr.write(String(err) + '\n');
	process.exit(1);
});
