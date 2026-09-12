import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	PROJECT_CONTEXT_REPORT_OPERATION_VERSION,
	PROJECT_CONTEXT_REPORT_REQUEST_SCHEMA_VERSION,
	PROJECT_CONTEXT_REPORT_SAFETY_CEILINGS
} from '../contracts/project-context-report.js';
import {
	PROJECT_CONTEXT_REPORT_PROGRESS_NONCLAIMS,
	PROJECT_CONTEXT_REPORT_PROGRESS_SCHEMA_VERSION
} from './run-project-context-report.js';
import { PROJECT_CONTEXT_PROGRESS_TRANSPORT_SCHEMA_VERSION } from './project-context-progress-jsonl.js';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const SCRIPT = fileURLToPath(
	new URL('../../../../scripts/csaa-project-context.ts', import.meta.url)
);

interface ProjectContextTerminalProbe {
	readonly result: {
		readonly currentness: { readonly state: string };
		readonly evidence: {
			readonly projectContextGraph: {
				readonly currentness: string;
				readonly memberships: readonly unknown[];
				readonly programs: readonly unknown[];
				readonly projectReferences: readonly unknown[];
				readonly projects: readonly unknown[];
				readonly sources: readonly unknown[];
			};
		};
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

describe('project-context command adapter', () => {
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
			code: 'REQUEST_SHAPE_INVALID',
			outcome: 'unavailable',
			stage: 'REQUEST',
			state: 'incompatible'
		});
		const progress = invalid.stderr
			.split('\n')
			.filter(Boolean)
			.map((line) => JSON.parse(line) as Record<string, unknown>);
		expect(progress).toHaveLength(2);
		expect(progress).toEqual([
			expect.objectContaining({
				kind: 'REPORT_STAGE',
				phase: 'REQUEST_BIND',
				sequence: 1,
				state: 'STARTED'
			}),
			expect.objectContaining({
				detailCode: 'REQUEST_SHAPE_INVALID',
				kind: 'REPORT_STAGE',
				phase: 'REQUEST_BIND',
				sequence: 2,
				state: 'FAILED'
			})
		]);
		expect(
			progress.every(
				(event) =>
					event.schemaVersion === PROJECT_CONTEXT_REPORT_PROGRESS_SCHEMA_VERSION &&
					event.protocolRole === 'PRELIMINARY_CAP_010_REPORT_TELEMETRY' &&
					JSON.stringify(event.nonclaims) ===
						JSON.stringify(PROJECT_CONTEXT_REPORT_PROGRESS_NONCLAIMS)
			)
		).toBe(true);
	});

	it('delivers one accepted partial report and complete report-level stage transcript', () => {
		const result = run(
			['--stdin'],
			JSON.stringify({
				budgets: PROJECT_CONTEXT_REPORT_SAFETY_CEILINGS,
				operationVersion: PROJECT_CONTEXT_REPORT_OPERATION_VERSION,
				schemaVersion: PROJECT_CONTEXT_REPORT_REQUEST_SCHEMA_VERSION,
				subjectProjectConfigPaths: [
					'packages/csaa/test-fixtures/project-context-command/tsconfig.json'
				]
			})
		);
		expect(result.error).toBeUndefined();
		expect(result.status).toBe(3);
		expect(result.stdout.split('\n').filter(Boolean)).toHaveLength(1);
		const terminal = JSON.parse(result.stdout) as ProjectContextTerminalProbe;
		expect(terminal).toMatchObject({
			operationVersion: PROJECT_CONTEXT_REPORT_OPERATION_VERSION,
			outcome: 'partial',
			result: {
				capability: { id: 'JAN-CSAA-CAP-010', status: 'PARTIAL' },
				interpretation: 'SELECTED_VALIDATED_FROZEN_PROJECT_CONTEXT'
			},
			state: 'partial'
		});
		const graph = terminal.result.evidence.projectContextGraph;
		expect(graph.projects).toHaveLength(3);
		expect(graph.projectReferences).toHaveLength(2);
		expect(graph.memberships).toHaveLength(graph.programs.length + graph.sources.length);
		expect(graph.currentness).toBe('NOT_CLAIMED');
		expect(terminal.result.currentness.state).toBe('CURRENT_FOR_CAPTURED_SUBJECT');

		const progress = result.stderr
			.split('\n')
			.filter(Boolean)
			.map((line) => JSON.parse(line) as Record<string, unknown>);
		const admittedSchemas = new Set<string>([
			PROJECT_CONTEXT_REPORT_PROGRESS_SCHEMA_VERSION,
			PROJECT_CONTEXT_PROGRESS_TRANSPORT_SCHEMA_VERSION
		]);
		expect(progress.every((event) => admittedSchemas.has(String(event.schemaVersion)))).toBe(true);
		const reportStages = progress.filter((event) => event.kind === 'REPORT_STAGE');
		expect(reportStages.map(({ phase, stage, state }) => ({ phase, stage, state }))).toEqual(
			(
				[
					['REQUEST_BIND', 'REQUEST'],
					['SUBJECT_PROJECT_PATH_BIND', 'SUBJECT'],
					['SUBJECT_CAPTURE', 'SUBJECT'],
					['SEMANTIC_SNAPSHOT', 'SEMANTIC_SNAPSHOT'],
					['PROJECT_CONTEXT', 'PROJECT_CONTEXT'],
					['CURRENTNESS', 'CURRENTNESS'],
					['RESULT', 'RESULT']
				] as const
			).flatMap(([phase, stage]) => [
				{ phase, stage, state: 'STARTED' },
				{ phase, stage, state: 'COMPLETED' }
			])
		);
		expect(progress.map((event) => event.sequence)).toEqual(progress.map((_, index) => index + 1));
		expect(result.stdout).not.toContain(REPOSITORY_ROOT);
		expect(result.stderr).not.toContain(REPOSITORY_ROOT);
	}, 120_000);

	it('contains closed progress and terminal pipes', async () => {
		const progressClosed = await runWithClosedProgressPipe('{}');
		expect(progressClosed.status).toBe(2);
		expect(progressClosed.stdout.split('\n').filter(Boolean)).toHaveLength(1);
		expect(JSON.parse(progressClosed.stdout)).toMatchObject({
			code: 'REQUEST_SHAPE_INVALID',
			outcome: 'unavailable'
		});

		const terminalClosed = await runWithClosedTerminalPipe('{}');
		expect(terminalClosed.status).toBe(2);
		expect(terminalClosed.stderr).not.toContain('EPIPE');
		const records = terminalClosed.stderr
			.split('\n')
			.filter(Boolean)
			.map((line) => JSON.parse(line) as Record<string, unknown>);
		expect(records).toHaveLength(2);
		expect(records.every((record) => record.kind === 'REPORT_STAGE')).toBe(true);
	});

	it('bounds request-file reads before parsing', () => {
		const root = mkdtempSync(join(tmpdir(), 'csaa-project-context-command-request-'));
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
