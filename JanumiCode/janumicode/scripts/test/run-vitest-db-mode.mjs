#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function nowStamp() {
	const d = new Date();
	const y = d.getUTCFullYear();
	const m = String(d.getUTCMonth() + 1).padStart(2, '0');
	const day = String(d.getUTCDate()).padStart(2, '0');
	const hh = String(d.getUTCHours()).padStart(2, '0');
	const mm = String(d.getUTCMinutes()).padStart(2, '0');
	const ss = String(d.getUTCSeconds()).padStart(2, '0');
	return `${y}${m}${day}-${hh}${mm}${ss}`;
}

function parseArgs(argv) {
	if (argv.length < 1) {
		throw new Error('Usage: node scripts/test/run-vitest-db-mode.mjs <direct|sidecar|auto> [vitest-args...]');
	}
	const mode = argv[0];
	if (mode !== 'direct' && mode !== 'sidecar' && mode !== 'auto') {
		throw new Error(`Invalid DB mode "${mode}". Expected direct, sidecar, or auto.`);
	}
	return { mode, vitestArgs: argv.slice(1) };
}

async function run(command, args, options = {}) {
	return await new Promise((resolve) => {
		const child = spawn(command, args, {
			cwd: options.cwd,
			env: options.env,
			shell: true,
			stdio: ['ignore', 'pipe', 'pipe'],
		});
		child.stdout?.on('data', (buf) => options.onStdout?.(buf.toString()));
		child.stderr?.on('data', (buf) => options.onStderr?.(buf.toString()));
		child.on('close', (code) => resolve(code ?? 1));
	});
}

async function main() {
	const { mode, vitestArgs } = parseArgs(process.argv.slice(2));
	const scriptDir = path.dirname(fileURLToPath(import.meta.url));
	const repoRoot = path.resolve(scriptDir, '..', '..');
	const artifactsDir = path.join(repoRoot, 'test-artifacts', `vitest-${mode}-${nowStamp()}`);
	fs.mkdirSync(artifactsDir, { recursive: true });
	const logPath = path.join(artifactsDir, 'runner.log');
	const log = fs.createWriteStream(logPath, { flags: 'a' });

	const writeLog = (line) => {
		process.stdout.write(line);
		log.write(line);
	};
	const writeErr = (line) => {
		process.stderr.write(line);
		log.write(line);
	};

	const env = {
		...process.env,
		JANUMICODE_TEST_DB_MODE: mode,
		JANUMICODE_TEST_ARTIFACT_DIR: artifactsDir,
		JANUMICODE_TEST_KEEP_DB: '1',
		JANUMICODE_TEST_SEED: process.env.JANUMICODE_TEST_SEED ?? '1337',
	};

	if (mode === 'sidecar') {
		writeLog('[test-runner] Building dist artifacts for sidecar mode...\n');
		const buildCode = await run('node', ['esbuild.js'], {
			cwd: repoRoot,
			env,
			onStdout: writeLog,
			onStderr: writeErr,
		});
		if (buildCode !== 0) {
			writeErr(`[test-runner] Build failed (exit ${buildCode}). Artifacts: ${artifactsDir}\n`);
			process.exit(buildCode);
		}
	}

	const args = ['vitest', 'run', ...vitestArgs];
	writeLog(`[test-runner] Running: npx ${args.join(' ')}\n`);
	const code = await run('npx', args, {
		cwd: repoRoot,
		env,
		onStdout: writeLog,
		onStderr: writeErr,
	});
	log.end();

	if (code !== 0) {
		process.stderr.write(`[test-runner] FAILED. Triage artifacts: ${artifactsDir}\n`);
		process.exit(code);
	}

	if ((process.env.JANUMICODE_TEST_KEEP_ARTIFACTS ?? '') !== '1') {
		try { fs.rmSync(artifactsDir, { recursive: true, force: true }); } catch { /* ignore */ }
	} else {
		process.stdout.write(`[test-runner] PASS. Artifacts kept: ${artifactsDir}\n`);
	}
	process.exit(0);
}

main().catch((err) => {
	process.stderr.write(String(err) + '\n');
	process.exit(1);
});
