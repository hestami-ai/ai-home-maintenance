import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
	READ_WRITE_ACCESS_REPORT_OPERATION_VERSION,
	READ_WRITE_ACCESS_REPORT_REQUEST_SCHEMA_VERSION,
	READ_WRITE_ACCESS_REPORT_SAFETY_CEILINGS
} from '../contracts/read-write-access-report.js';
import { READ_WRITE_ACCESS_PROGRESS_TRANSPORT_SCHEMA_VERSION } from './read-write-access-progress-jsonl.js';
import {
	READ_WRITE_ACCESS_REPORT_PROGRESS_NONCLAIMS,
	READ_WRITE_ACCESS_REPORT_PROGRESS_SCHEMA_VERSION
} from './run-read-write-access-report.js';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const SCRIPT = fileURLToPath(
	new URL('../../../../scripts/csaa-read-write-access.ts', import.meta.url)
);
const PACKAGE_SCRIPT = 'csaa:analyze:read-write-access';

function acceptedRequest(): Record<string, unknown> {
	return {
		budgets: READ_WRITE_ACCESS_REPORT_SAFETY_CEILINGS,
		operationVersion: READ_WRITE_ACCESS_REPORT_OPERATION_VERSION,
		schemaVersion: READ_WRITE_ACCESS_REPORT_REQUEST_SCHEMA_VERSION,
		subjectProjectConfigPaths: ['packages/csaa/test-fixtures/project-context-command/tsconfig.json']
	};
}

function run(args: readonly string[], input?: string) {
	return spawnSync('bun', [SCRIPT, ...args], {
		cwd: REPOSITORY_ROOT,
		encoding: 'utf8',
		input,
		windowsHide: true
	});
}

function runPackage(args: readonly string[], input?: string) {
	return spawnSync('bun', ['run', '--silent', PACKAGE_SCRIPT, ...args], {
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

describe('read/write-access command adapter', () => {
	it('keeps the advertised silent package entry point machine-framed and preserves exit codes', () => {
		const invalidArgs = runPackage(['--unknown']);
		expect(invalidArgs.status).toBe(2);
		expect(invalidArgs.stdout).toBe('');
		expect(invalidArgs.stderr.split('\n').filter(Boolean)).toHaveLength(1);
		expect(JSON.parse(invalidArgs.stderr)).toMatchObject({ error: 'request-input-invalid' });

		const accepted = acceptedRequest();
		const budgets = accepted.budgets as typeof READ_WRITE_ACCESS_REPORT_SAFETY_CEILINGS;
		const refused = runPackage(
			['--stdin'],
			JSON.stringify({
				...accepted,
				budgets: {
					...budgets,
					readWriteAccess: {
						...budgets.readWriteAccess,
						maxNodes: READ_WRITE_ACCESS_REPORT_SAFETY_CEILINGS.readWriteAccess.maxNodes + 1
					}
				}
			})
		);
		expect(refused.status).toBe(3);
		expect(refused.stdout.split('\n').filter(Boolean)).toHaveLength(1);
		expect(JSON.parse(refused.stdout)).toMatchObject({
			code: 'REQUEST_BUDGET_EXCEEDS_SAFETY_CEILING',
			stage: 'REQUEST',
			state: 'resource-refused'
		});
		for (const line of refused.stderr.split('\n').filter(Boolean))
			expect(() => JSON.parse(line)).not.toThrow();
	});

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

	it('keeps malformed input and request-admission telemetry on their assigned streams', () => {
		const malformed = run(['--stdin'], '{not json');
		expect(malformed.status).toBe(2);
		expect(malformed.stdout).toBe('');
		expect(JSON.parse(malformed.stderr)).toEqual({
			error: 'request-input-invalid',
			message: 'Request input is not valid JSON.'
		});

		const invalid = run(['--stdin'], '{}');
		expect(invalid.status).toBe(2);
		expect(invalid.stdout.split('\n').filter(Boolean)).toHaveLength(1);
		expect(JSON.parse(invalid.stdout)).toMatchObject({
			analysisAuthority: 'NONE',
			code: 'REQUEST_SHAPE_INVALID',
			gateEffect: 'NONE',
			outcome: 'unavailable',
			stage: 'REQUEST',
			state: 'incompatible'
		});
		const progress = invalid.stderr
			.split('\n')
			.filter(Boolean)
			.map((line) => JSON.parse(line) as Record<string, unknown>);
		expect(progress).toEqual([
			expect.objectContaining({ phase: 'REQUEST_BIND', sequence: 1, state: 'STARTED' }),
			expect.objectContaining({
				detailCode: 'REQUEST_SHAPE_INVALID',
				phase: 'REQUEST_BIND',
				sequence: 2,
				state: 'FAILED'
			})
		]);
		expect(
			progress.every(
				(event) =>
					event.schemaVersion === READ_WRITE_ACCESS_REPORT_PROGRESS_SCHEMA_VERSION &&
					event.protocolRole === 'PRELIMINARY_TYPESCRIPT_READ_WRITE_ACCESS_REPORT_TELEMETRY' &&
					JSON.stringify(event.nonclaims) ===
						JSON.stringify(READ_WRITE_ACCESS_REPORT_PROGRESS_NONCLAIMS)
			)
		).toBe(true);
	});

	it(
		'delivers one accepted full partial graph and a bounded five-stage transcript',
		{ timeout: 120_000 },
		() => {
			const result = run(['--stdin'], JSON.stringify(acceptedRequest()));
			expect(result.error).toBeUndefined();
			expect(result.status, result.stderr).toBe(3);
			expect(result.stdout.split('\n').filter(Boolean)).toHaveLength(1);
			expect(result.stdout.endsWith('\n')).toBe(true);
			const terminal = JSON.parse(result.stdout) as Record<string, any>;
			expect(terminal).toMatchObject({
				analysisAuthority: 'NONE',
				authorityTransfer: 'NONE',
				gateEffect: 'NONE',
				operationVersion: READ_WRITE_ACCESS_REPORT_OPERATION_VERSION,
				outcome: 'partial',
				result: {
					capability: {
						fullJanCsaaCapability007DataFlow: 'NOT_CLAIMED',
						id: 'TYPESCRIPT_READ_WRITE_ACCESS',
						status: 'PARTIAL'
					},
					coverage: { closure: 'OPEN', reconciles: true },
					currentness: { scope: 'SELECTED_CAPTURED_SUBJECT_ONLY' },
					interpretation: 'SELECTED_VALIDATED_CAPTURE_BOUND_PROGRAM_LOCAL_READ_WRITE_ACCESS_GRAPH'
				},
				state: 'partial'
			});
			expect(terminal.result.evidence.readWriteAccessGraph.nodes.length).toBeGreaterThan(0);
			expect(terminal.result.evidence.projectContextGraph.sources.length).toBeGreaterThan(0);

			const progress = result.stderr
				.split('\n')
				.filter(Boolean)
				.map((line) => JSON.parse(line) as Record<string, unknown>);
			const admittedSchemas = new Set<string>([
				READ_WRITE_ACCESS_REPORT_PROGRESS_SCHEMA_VERSION,
				READ_WRITE_ACCESS_PROGRESS_TRANSPORT_SCHEMA_VERSION
			]);
			expect(progress.every((event) => admittedSchemas.has(String(event.schemaVersion)))).toBe(
				true
			);
			const stages = progress.filter((event) => event.kind === 'REPORT_STAGE');
			expect(stages.filter((event) => event.state === 'STARTED')).toHaveLength(5);
			expect(stages.filter((event) => event.state === 'COMPLETED')).toHaveLength(5);
			expect(stages.at(-1)).toMatchObject({
				detailCode: 'PARTIAL',
				phase: 'RESULT',
				state: 'COMPLETED'
			});
			expect(progress.map((event) => event.sequence)).toEqual(
				progress.map((_, index) => index + 1)
			);
			expect(result.stdout).not.toContain(REPOSITORY_ROOT);
			expect(result.stderr).not.toContain(REPOSITORY_ROOT);
		}
	);

	it('contains closed pipes and bounds stdin and request-file reads', async () => {
		const progressClosed = await runWithClosedProgressPipe('{}');
		expect(progressClosed.status).toBe(2);
		expect(JSON.parse(progressClosed.stdout)).toMatchObject({
			code: 'REQUEST_SHAPE_INVALID',
			outcome: 'unavailable'
		});

		const terminalClosed = await runWithClosedTerminalPipe('{}');
		expect(terminalClosed.status).toBe(2);
		expect(terminalClosed.stderr).not.toContain('EPIPE');
		for (const line of terminalClosed.stderr.split('\n').filter(Boolean))
			expect(() => JSON.parse(line)).not.toThrow();

		const oversizedStdin = run(['--stdin'], ' '.repeat(1024 * 1024 + 1));
		expect(oversizedStdin.status).toBe(2);
		expect(oversizedStdin.stdout).toBe('');
		expect(JSON.parse(oversizedStdin.stderr)).toMatchObject({
			error: 'request-input-invalid',
			message: 'Request input exceeds 1 MiB.'
		});

		const root = mkdtempSync(join(tmpdir(), 'csaa-read-write-access-command-request-'));
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
