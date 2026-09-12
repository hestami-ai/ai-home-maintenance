import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
	MODULE_RESOLUTION_TRACE_REPORT_OPERATION_VERSION,
	MODULE_RESOLUTION_TRACE_REPORT_REQUEST_SCHEMA_VERSION,
	MODULE_RESOLUTION_TRACE_REPORT_SAFETY_CEILINGS
} from '../contracts/module-resolution-trace-report.js';
import {
	MODULE_RESOLUTION_FIXTURE_PACKAGE_NAME,
	createModuleResolutionTraceFixture,
	type ModuleResolutionTraceFixture
} from '../resolution/module-resolution-trace-fixture.test-support.js';
import { runModuleResolutionTraceCommand } from './run-module-resolution-trace-command.js';
import {
	MODULE_RESOLUTION_TRACE_REPORT_PROGRESS_SCHEMA_VERSION,
	MODULE_RESOLUTION_TRACE_REPORT_PROGRESS_NONCLAIMS
} from './run-module-resolution-trace-report.js';
import { MODULE_RESOLUTION_TRACE_PROGRESS_TRANSPORT_SCHEMA_VERSION } from './module-resolution-trace-progress-jsonl.js';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const SCRIPT = fileURLToPath(
	new URL('../../../../scripts/csaa-module-resolution-trace.ts', import.meta.url)
);
const PACKAGE_SCRIPT = 'csaa:analyze:module-resolution-trace';

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

function acceptedRequest(selected: ModuleResolutionTraceFixture): Record<string, unknown> {
	const importerSource = selected.semanticSnapshot.sources.find(
		(source) => source.id === selected.importerSourceId
	)!;
	const importerProject = selected.semanticSnapshot.projects.find(
		(project) => project.id === importerSource.projectId
	)!;
	const importerResolution = selected.semanticSnapshot.moduleResolutions.find(
		(resolution) => resolution.id === selected.importerModuleResolutionId
	)!;
	const specifierNode = selected.semanticSnapshot.astNodes.find(
		(node) => node.id === importerResolution.nodeId
	)!;
	return {
		budgets: MODULE_RESOLUTION_TRACE_REPORT_SAFETY_CEILINGS,
		importer: {
			logicalPath: selected.importerPath,
			projectConfigPath: importerProject.configPath,
			specifierNodeStart: specifierNode.start
		},
		operationVersion: MODULE_RESOLUTION_TRACE_REPORT_OPERATION_VERSION,
		packageName: MODULE_RESOLUTION_FIXTURE_PACKAGE_NAME,
		schemaVersion: MODULE_RESOLUTION_TRACE_REPORT_REQUEST_SCHEMA_VERSION,
		subjectProjectConfigPaths: ['tsconfig.json']
	};
}

interface TerminalProbe {
	readonly result: {
		readonly evidence: {
			readonly conditionalExportResolution: { readonly currentness: string };
			readonly moduleResolutionTrace: { readonly currentness: string };
		};
	};
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

describe('module-resolution-trace command adapter', () => {
	it('keeps the advertised silent package entry point machine-framed and preserves exit codes', () => {
		const invalidArgs = runPackage(['--unknown']);
		expect(invalidArgs.status).toBe(2);
		expect(invalidArgs.stdout).toBe('');
		expect(invalidArgs.stderr.split('\n').filter(Boolean)).toHaveLength(1);
		expect(JSON.parse(invalidArgs.stderr)).toMatchObject({ error: 'request-input-invalid' });

		const selected = createModuleResolutionTraceFixture();
		try {
			const accepted = acceptedRequest(selected);
			const budgets = accepted.budgets as Record<string, unknown>;
			const refused = runPackage(
				['--stdin'],
				JSON.stringify({
					...accepted,
					budgets: {
						...budgets,
						maxResultBytes: MODULE_RESOLUTION_TRACE_REPORT_SAFETY_CEILINGS.maxResultBytes + 1
					}
				})
			);
			expect(refused.status).toBe(3);
			expect(refused.stdout.split('\n').filter(Boolean)).toHaveLength(1);
			expect(JSON.parse(refused.stdout)).toMatchObject({
				code: 'REQUEST_BUDGET_EXCEEDS_SAFETY_CEILING',
				state: 'resource-refused'
			});
			for (const line of refused.stderr.split('\n').filter(Boolean))
				expect(() => JSON.parse(line)).not.toThrow();
		} finally {
			selected.cleanup();
		}
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
					event.schemaVersion === MODULE_RESOLUTION_TRACE_REPORT_PROGRESS_SCHEMA_VERSION &&
					event.protocolRole === 'PRELIMINARY_CAP_011_REPORT_TELEMETRY' &&
					JSON.stringify(event.nonclaims) ===
						JSON.stringify(MODULE_RESOLUTION_TRACE_REPORT_PROGRESS_NONCLAIMS)
			)
		).toBe(true);
	});

	it(
		'delivers one accepted partial trace and a bounded report-level transcript',
		{ timeout: 120_000 },
		() => {
			const selected = createModuleResolutionTraceFixture();
			try {
				const progressLines: string[] = [];
				const terminalLines: string[] = [];
				const status = runModuleResolutionTraceCommand(acceptedRequest(selected), {
					repositoryRoot: selected.root,
					writeProgress: (line) => progressLines.push(line),
					writeTerminal: (line) => terminalLines.push(line)
				});
				expect(status).toBe(3);
				expect(terminalLines).toHaveLength(1);
				expect(terminalLines[0]!.split('\n').filter(Boolean)).toHaveLength(1);
				const terminal = JSON.parse(terminalLines[0]!) as TerminalProbe;
				expect(terminal).toMatchObject({
					operationVersion: MODULE_RESOLUTION_TRACE_REPORT_OPERATION_VERSION,
					outcome: 'partial',
					result: {
						capability: { id: 'JAN-CSAA-CAP-011', status: 'PARTIAL' },
						currentness: {
							compilerCapture: 'NOT_ASSESSED',
							contextOnlyTarget: 'NOT_ASSESSED'
						},
						importer: {
							logicalPath: selected.importerPath,
							specifier: MODULE_RESOLUTION_FIXTURE_PACKAGE_NAME
						},
						interpretation: 'SELECTED_VALIDATED_CAPTURE_BOUND_MODULE_RESOLUTION_TRACE',
						resolvedTarget: { logicalPath: selected.targetPath }
					},
					state: 'partial'
				});
				expect(terminal.result.evidence.moduleResolutionTrace.currentness).toBe('NOT_CLAIMED');
				expect(terminal.result.evidence.conditionalExportResolution.currentness).toBe(
					'NOT_CLAIMED'
				);

				const progress = progressLines.map((line) => JSON.parse(line) as Record<string, unknown>);
				const admittedSchemas = new Set<string>([
					MODULE_RESOLUTION_TRACE_REPORT_PROGRESS_SCHEMA_VERSION,
					MODULE_RESOLUTION_TRACE_PROGRESS_TRANSPORT_SCHEMA_VERSION
				]);
				expect(progress.every((event) => admittedSchemas.has(String(event.schemaVersion)))).toBe(
					true
				);
				const stages = progress.filter((event) => event.kind === 'REPORT_STAGE');
				expect(stages.filter((event) => event.state === 'STARTED')).toHaveLength(10);
				expect(stages.filter((event) => event.state === 'COMPLETED')).toHaveLength(10);
				expect(terminalLines.join('')).not.toContain(selected.root);
				expect(progressLines.join('')).not.toContain(selected.root);
			} finally {
				selected.cleanup();
			}
		}
	);

	it('contains a closed progress pipe and bounds request-file reads', async () => {
		const progressClosed = await runWithClosedProgressPipe('{}');
		expect(progressClosed.status).toBe(2);
		expect(JSON.parse(progressClosed.stdout)).toMatchObject({
			code: 'REQUEST_SHAPE_INVALID',
			outcome: 'unavailable'
		});

		const root = mkdtempSync(join(tmpdir(), 'csaa-module-resolution-command-request-'));
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
