import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
	MODULE_DEPENDENCY_REPORT_OPERATION_VERSION,
	MODULE_DEPENDENCY_REPORT_REQUEST_SCHEMA_VERSION,
	MODULE_DEPENDENCY_REPORT_SAFETY_CEILINGS
} from '../contracts/module-dependency-report.js';
import { MODULE_DEPENDENCY_PROGRESS_TRANSPORT_SCHEMA_VERSION } from './module-dependency-progress-jsonl.js';
import { MODULE_DEPENDENCY_REPORT_PROGRESS_SCHEMA_VERSION } from './run-module-dependency-report.js';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const SCRIPT = fileURLToPath(
	new URL('../../../../scripts/csaa-module-dependency.ts', import.meta.url)
);
const PACKAGE_SCRIPT = 'csaa:analyze:module-dependency';
const temporaryRoots: string[] = [];

function acceptedRequest(): Record<string, unknown> {
	return {
		budgets: MODULE_DEPENDENCY_REPORT_SAFETY_CEILINGS,
		operationVersion: MODULE_DEPENDENCY_REPORT_OPERATION_VERSION,
		schemaVersion: MODULE_DEPENDENCY_REPORT_REQUEST_SCHEMA_VERSION,
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

function runWithClosedPipe(
	pipe: 'progress' | 'terminal',
	input: string
): Promise<{ readonly status: number | null; readonly remaining: string }> {
	return new Promise((resolve, reject) => {
		const child = spawn('bun', [SCRIPT, '--stdin'], {
			cwd: REPOSITORY_ROOT,
			stdio: ['pipe', 'pipe', 'pipe'],
			windowsHide: true
		});
		const retained = pipe === 'progress' ? child.stdout : child.stderr;
		const closed = pipe === 'progress' ? child.stderr : child.stdout;
		let remaining = '';
		retained.setEncoding('utf8');
		retained.on('data', (chunk: string) => {
			remaining += chunk;
		});
		child.on('error', reject);
		child.on('close', (status) => resolve({ remaining, status }));
		closed.destroy();
		child.stdin.end(input);
	});
}

afterEach(() => {
	for (const root of temporaryRoots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe('module-dependency command adapter', () => {
	it('keeps the silent package entry point machine-framed and preserves refusal exit codes', () => {
		const invalidArgs = runPackage(['--unknown']);
		expect(invalidArgs.status).toBe(2);
		expect(invalidArgs.stdout).toBe('');
		expect(invalidArgs.stderr.split('\n').filter(Boolean)).toHaveLength(1);
		expect(JSON.parse(invalidArgs.stderr)).toMatchObject({ error: 'request-input-invalid' });

		const accepted = acceptedRequest();
		const budgets = accepted.budgets as typeof MODULE_DEPENDENCY_REPORT_SAFETY_CEILINGS;
		const refused = runPackage(
			['--stdin'],
			JSON.stringify({
				...accepted,
				budgets: {
					...budgets,
					moduleDependency: {
						...budgets.moduleDependency,
						maxNodes: MODULE_DEPENDENCY_REPORT_SAFETY_CEILINGS.moduleDependency.maxNodes + 1
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

	it('keeps malformed input and admission telemetry on their assigned streams', () => {
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
	});

	it(
		'delivers one accepted full graph and a bounded five-stage transcript',
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
				operationVersion: MODULE_DEPENDENCY_REPORT_OPERATION_VERSION,
				outcome: 'partial',
				result: {
					capability: {
						fullJanCsaaCapability004DependencyAnalysis: 'NOT_CLAIMED',
						id: 'JAN-CSAA-CAP-004',
						status: 'PARTIAL'
					},
					coverage: { reconciles: true },
					currentness: { scope: 'SELECTED_CAPTURED_SUBJECT_ONLY' },
					interpretation: 'SELECTED_VALIDATED_CAPTURE_BOUND_COMPILER_MODULE_DEPENDENCY_GRAPH'
				},
				state: 'partial'
			});
			expect(terminal.result.evidence.moduleDependencyGraph.nodes.length).toBeGreaterThan(0);
			expect(terminal.result.evidence.projectContextGraph.sources.length).toBeGreaterThan(0);

			const progress = result.stderr
				.split('\n')
				.filter(Boolean)
				.map((line) => JSON.parse(line) as Record<string, unknown>);
			const admittedSchemas = new Set<string>([
				MODULE_DEPENDENCY_REPORT_PROGRESS_SCHEMA_VERSION,
				MODULE_DEPENDENCY_PROGRESS_TRANSPORT_SCHEMA_VERSION
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
			expect(result.stdout).not.toContain(REPOSITORY_ROOT);
			expect(result.stderr).not.toContain(REPOSITORY_ROOT);
		}
	);

	it('contains closed pipes and bounds stream and regular-file request reads', async () => {
		const invalid = JSON.stringify({});
		const progressClosed = await runWithClosedPipe('progress', invalid);
		expect(progressClosed.status).toBe(2);
		expect(JSON.parse(progressClosed.remaining)).toMatchObject({
			code: 'REQUEST_SHAPE_INVALID',
			outcome: 'unavailable'
		});

		const terminalClosed = await runWithClosedPipe('terminal', invalid);
		expect(terminalClosed.status).toBe(2);
		expect(terminalClosed.remaining).not.toContain('EPIPE');
		for (const line of terminalClosed.remaining.split('\n').filter(Boolean))
			expect(() => JSON.parse(line)).not.toThrow();

		const exactMiB = run(['--stdin'], ' '.repeat(1024 * 1024));
		expect(exactMiB.status).toBe(2);
		expect(JSON.parse(exactMiB.stderr)).toMatchObject({
			error: 'request-input-invalid',
			message: 'Request input is not valid JSON.'
		});
		const overMiB = run(['--stdin'], ' '.repeat(1024 * 1024 + 1));
		expect(overMiB.status).toBe(2);
		expect(JSON.parse(overMiB.stderr)).toMatchObject({
			error: 'request-input-invalid',
			message: 'Request input exceeds 1 MiB.'
		});

		const root = mkdtempSync(join(tmpdir(), 'csaa-module-dependency-command-'));
		temporaryRoots.push(root);
		const requestPath = join(root, 'request.json');
		writeFileSync(requestPath, '{}', 'utf8');
		const fromFile = run(['--request', requestPath]);
		expect(fromFile.status).toBe(2);
		expect(JSON.parse(fromFile.stdout)).toMatchObject({ code: 'REQUEST_SHAPE_INVALID' });
		const exactMiBPath = join(root, 'exact-mib.json');
		writeFileSync(exactMiBPath, Buffer.alloc(1024 * 1024, 0x20));
		const exactMiBFile = run(['--request', exactMiBPath]);
		expect(exactMiBFile.status).toBe(2);
		expect(exactMiBFile.stdout).toBe('');
		expect(JSON.parse(exactMiBFile.stderr)).toMatchObject({
			error: 'request-input-invalid',
			message: 'Request input is not valid JSON.'
		});
		const overMiBPath = join(root, 'over-mib.json');
		writeFileSync(overMiBPath, Buffer.alloc(1024 * 1024 + 1, 0x20));
		const overMiBFile = run(['--request', overMiBPath]);
		expect(overMiBFile.status).toBe(2);
		expect(overMiBFile.stdout).toBe('');
		expect(JSON.parse(overMiBFile.stderr)).toMatchObject({
			error: 'request-input-invalid',
			message: 'Request input exceeds 1 MiB.'
		});
		const directory = run(['--request', root]);
		expect(directory.status).toBe(2);
		expect(JSON.parse(directory.stderr)).toMatchObject({
			error: 'request-input-invalid',
			message: 'The request path must identify a regular file.'
		});
	});
});
