import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	STRUCTURAL_MODULE_REACHABILITY_REPORT_PROGRESS_NONCLAIMS,
	STRUCTURAL_MODULE_REACHABILITY_REPORT_PROGRESS_SCHEMA_VERSION
} from './run-structural-module-reachability-report.js';
import { STRUCTURAL_MODULE_REACHABILITY_PROGRESS_TRANSPORT_SCHEMA_VERSION } from './structural-module-reachability-progress-jsonl.js';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const SCRIPT = fileURLToPath(
	new URL('../../../../scripts/csaa-structural-module-reachability.ts', import.meta.url)
);

function run(args: readonly string[], input?: string) {
	return spawnSync('bun', [SCRIPT, ...args], {
		cwd: REPOSITORY_ROOT,
		encoding: 'utf8',
		input,
		windowsHide: true
	});
}

function runWithClosedProgressPipe(
	input: string
): Promise<{ readonly status: number | null; readonly stdout: string }> {
	return new Promise((resolve, reject) => {
		const child = spawn('bun', [SCRIPT, '--stdin'], {
			cwd: REPOSITORY_ROOT,
			stdio: ['pipe', 'pipe', 'pipe'],
			windowsHide: true
		});
		let stdout = '';
		child.stdout.setEncoding('utf8');
		child.stdout.on('data', (chunk: string) => {
			stdout += chunk;
		});
		child.on('error', reject);
		child.on('close', (status) => resolve({ status, stdout }));
		child.stderr.destroy();
		child.stdin.end(input);
	});
}

function runWithClosedTerminalPipe(
	input: string
): Promise<{ readonly status: number | null; readonly stderr: string }> {
	return new Promise((resolve, reject) => {
		const child = spawn('bun', [SCRIPT, '--stdin'], {
			cwd: REPOSITORY_ROOT,
			stdio: ['pipe', 'pipe', 'pipe'],
			windowsHide: true
		});
		let stderr = '';
		child.stderr.setEncoding('utf8');
		child.stderr.on('data', (chunk: string) => {
			stderr += chunk;
		});
		child.on('error', reject);
		child.on('close', (status) => resolve({ status, stderr }));
		child.stdout.destroy();
		child.stdin.end(input);
	});
}

describe('structural module reachability command adapter', () => {
	it.each([
		{ args: [] },
		{ args: ['--unknown'] },
		{ args: ['--request'] },
		{ args: ['--stdin', '--stdin'] },
		{ args: ['--request', 'one.json', '--stdin'] }
	] as const)('rejects invalid request-source arguments: $args', ({ args }) => {
		const result = run(args);
		expect(result.status, args.join(' ')).toBe(2);
		expect(result.stdout).toBe('');
		expect(JSON.parse(result.stderr)).toEqual({
			error: 'request-input-invalid',
			message: 'Use exactly one of --stdin or --request <json-file>.'
		});
	});

	it('keeps malformed stdin off stdout and returns one structured diagnostic', () => {
		const result = run(['--stdin'], '{not json');
		expect(result.status).toBe(2);
		expect(result.stdout).toBe('');
		expect(result.stderr.split('\n').filter(Boolean)).toHaveLength(1);
		expect(JSON.parse(result.stderr)).toEqual({
			error: 'request-input-invalid',
			message: 'Request input is not valid JSON.'
		});
	});

	it('keeps versioned progress on stderr and one terminal envelope on stdout', () => {
		const result = run(['--stdin'], '{}');
		expect(result.status).toBe(2);
		expect(result.stdout.split('\n').filter(Boolean)).toHaveLength(1);
		expect(JSON.parse(result.stdout)).toMatchObject({
			code: 'REQUEST_SHAPE_INVALID',
			outcome: 'unavailable',
			stage: 'REQUEST',
			state: 'incompatible'
		});
		const progress = result.stderr
			.split('\n')
			.filter(Boolean)
			.map((line) => JSON.parse(line) as Record<string, unknown>);
		expect(progress).toHaveLength(2);
		const admittedSchemas = new Set<string>([
			STRUCTURAL_MODULE_REACHABILITY_REPORT_PROGRESS_SCHEMA_VERSION,
			STRUCTURAL_MODULE_REACHABILITY_PROGRESS_TRANSPORT_SCHEMA_VERSION
		]);
		expect(progress.every((event) => admittedSchemas.has(String(event.schemaVersion)))).toBe(true);
		expect(
			progress.every(
				(event) =>
					event.deliverySemantics === 'SYNCHRONOUS_TRUSTED_HOST_CALLBACK' &&
					event.protocolRole === 'PRELIMINARY_CAP_027_REPORT_TELEMETRY' &&
					event.reportIdentityEffect === 'EXCLUDED_FROM_REPORT_IDENTITY' &&
					event.wallClockBudgetEffect === 'CALLBACK_TIME_MAY_CONSUME_ACTIVE_DURATION_BUDGET' &&
					JSON.stringify(event.nonclaims) ===
						JSON.stringify(STRUCTURAL_MODULE_REACHABILITY_REPORT_PROGRESS_NONCLAIMS)
			)
		).toBe(true);
		expect(progress).toEqual([
			expect.objectContaining({
				kind: 'REPORT_STAGE',
				schemaVersion: STRUCTURAL_MODULE_REACHABILITY_REPORT_PROGRESS_SCHEMA_VERSION,
				sequence: 1,
				phase: 'REQUEST_BIND',
				stage: 'REQUEST',
				state: 'STARTED'
			}),
			expect.objectContaining({
				detailCode: 'REQUEST_SHAPE_INVALID',
				kind: 'REPORT_STAGE',
				schemaVersion: STRUCTURAL_MODULE_REACHABILITY_REPORT_PROGRESS_SCHEMA_VERSION,
				sequence: 2,
				phase: 'REQUEST_BIND',
				stage: 'REQUEST',
				state: 'FAILED'
			})
		]);
		expect(result.stderr).not.toContain(REPOSITORY_ROOT);
		expect(result.stderr).not.toContain(REPOSITORY_ROOT.replaceAll('\\', '/'));
	});

	it('keeps the terminal stdout envelope when the progress pipe is closed', async () => {
		const result = await runWithClosedProgressPipe('{}');
		expect(result.status).toBe(2);
		expect(result.stdout.split('\n').filter(Boolean)).toHaveLength(1);
		expect(JSON.parse(result.stdout)).toMatchObject({
			code: 'REQUEST_SHAPE_INVALID',
			outcome: 'unavailable'
		});
	});

	it('contains a closed terminal pipe without emitting an EPIPE stack', async () => {
		const result = await runWithClosedTerminalPipe('{}');
		expect(result.status).toBe(2);
		expect(result.stderr).not.toContain('EPIPE');
		const records = result.stderr
			.split('\n')
			.filter(Boolean)
			.map((line) => JSON.parse(line) as Record<string, unknown>);
		expect(records).toHaveLength(2);
		expect(records.every((record) => record.kind === 'REPORT_STAGE')).toBe(true);
	});

	it('bounds request-file reads before parsing', () => {
		const root = mkdtempSync(join(tmpdir(), 'csaa-command-request-'));
		const requestPath = join(root, 'oversized.json');
		try {
			writeFileSync(requestPath, Buffer.alloc(1024 * 1024 + 1, 0x20));
			const result = run(['--request', requestPath]);
			expect(result.status).toBe(2);
			expect(result.stdout).toBe('');
			expect(JSON.parse(result.stderr)).toEqual({
				error: 'request-input-invalid',
				message: 'Request input exceeds 1 MiB.'
			});
		} finally {
			rmSync(root, { force: true, recursive: true });
		}
	});
});
