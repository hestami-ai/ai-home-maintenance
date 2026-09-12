import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
	SEMANTIC_SOURCE_QUERY_REPORT_OPERATION_VERSION,
	SEMANTIC_SOURCE_QUERY_REPORT_REQUEST_SCHEMA_VERSION,
	SEMANTIC_SOURCE_QUERY_REPORT_SAFETY_CEILINGS,
	type SemanticSourceQueryReportOutcome
} from '../contracts/semantic-source-query-report.js';
import { canonicalSemanticJson } from '../semantic/canonical.js';
import { runSemanticSourceQueryCommand } from './run-semantic-source-query-command.js';
import {
	SEMANTIC_SOURCE_QUERY_REPORT_PROGRESS_NONCLAIMS,
	SEMANTIC_SOURCE_QUERY_REPORT_PROGRESS_SCHEMA_VERSION,
	type SemanticSourceQueryReportProgressEvent,
	type runSemanticSourceQueryReport
} from './run-semantic-source-query-report.js';
import { SEMANTIC_SOURCE_QUERY_PROGRESS_TRANSPORT_SCHEMA_VERSION } from './semantic-source-query-progress-jsonl.js';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const SCRIPT = fileURLToPath(
	new URL('../../../../scripts/csaa-semantic-source-query.ts', import.meta.url)
);
const PACKAGE_SCRIPT = 'csaa:analyze:semantic-source-query';
const EXPECTED_PACKAGE_COMMAND = 'bun scripts/csaa-semantic-source-query.ts';
const FULL_REPOSITORY_TIMEOUT_MS = 45 * 60 * 1_000;
const FULL_PROJECT_CONFIG_PATHS = Object.freeze([
	'packages/rph-application/tsconfig.json',
	'packages/rph-assurance/tsconfig.json',
	'packages/rph-contracts/tsconfig.json',
	'packages/rph-domain/tsconfig.json',
	'packages/rph-persistence/tsconfig.json',
	'packages/rph-ports/tsconfig.json',
	'packages/rph-projections/tsconfig.json'
] as const);

function progressEvent(): SemanticSourceQueryReportProgressEvent {
	return {
		deliverySemantics: 'DEFERRED_UNTIL_TERMINAL_EVIDENCE',
		detailCode: 'SYNTHETIC',
		kind: 'REPORT_STAGE',
		nonclaims: SEMANTIC_SOURCE_QUERY_REPORT_PROGRESS_NONCLAIMS,
		observations: [],
		operationVersion: SEMANTIC_SOURCE_QUERY_REPORT_OPERATION_VERSION,
		phase: 'RESULT',
		protocolRole: 'PRELIMINARY_SEMANTIC_SOURCE_QUERY_REPORT_TELEMETRY',
		reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY',
		schemaVersion: 'jan-csaa-semantic-source-query-report-progress/0.2.0',
		sequence: 1,
		stage: 'RESULT',
		state: 'COMPLETED'
	} as SemanticSourceQueryReportProgressEvent;
}

function partial(): SemanticSourceQueryReportOutcome {
	return {
		analysisAuthority: 'NONE',
		authorityTransfer: 'NONE',
		diagnostics: [],
		gateEffect: 'NONE',
		operationVersion: SEMANTIC_SOURCE_QUERY_REPORT_OPERATION_VERSION,
		outcome: 'partial',
		request: { synthetic: true },
		result: {
			partitions: { supportedMatches: ['semantic-source:synthetic'] },
			population: { retainedRecords: 1 }
		},
		schemaVersion: 'jan-csaa-semantic-source-query-report/0.2.0',
		stageOutcomes: {},
		state: 'partial',
		subject: { subjectId: 'subject:synthetic-semantic-source-query' }
	} as unknown as SemanticSourceQueryReportOutcome;
}

function unavailable(
	state: 'failed' | 'incompatible' | 'resource-refused'
): SemanticSourceQueryReportOutcome {
	return {
		analysisAuthority: 'NONE',
		authorityTransfer: 'NONE',
		code: `SYNTHETIC_${state.toUpperCase()}`,
		diagnostics: [],
		facadeNonclaims: [],
		gateEffect: 'NONE',
		operationVersion: SEMANTIC_SOURCE_QUERY_REPORT_OPERATION_VERSION,
		outcome: 'unavailable',
		schemaVersion: 'jan-csaa-semantic-source-query-report/0.2.0',
		stage: 'RESULT',
		state
	} as unknown as SemanticSourceQueryReportOutcome;
}

function run(args: readonly string[], input?: string | Uint8Array) {
	return spawnSync('bun', [SCRIPT, ...args], {
		cwd: REPOSITORY_ROOT,
		encoding: 'utf8',
		input,
		maxBuffer: 16 * 1024 * 1024,
		windowsHide: true
	});
}

function runPackage(args: readonly string[], input?: string) {
	return spawnSync('bun', ['run', '--silent', PACKAGE_SCRIPT, ...args], {
		cwd: REPOSITORY_ROOT,
		encoding: 'utf8',
		input,
		maxBuffer: 16 * 1024 * 1024,
		windowsHide: true
	});
}

function acceptedRequest(
	subjectProjectConfigPaths: readonly string[] = [
		'packages/csaa/test-fixtures/project-context-command/tsconfig.json'
	],
	expression: Record<string, unknown> = {
		field: 'logicalPath',
		kind: 'LOGICAL_PATH_STARTS_WITH',
		nodeId: 'fixture-alpha',
		value: 'packages/csaa/test-fixtures/project-context-command/left/src/alpha'
	}
): Record<string, unknown> {
	return {
		budgets: SEMANTIC_SOURCE_QUERY_REPORT_SAFETY_CEILINGS,
		executionId: 'semantic-source-query-command-fixture',
		expression,
		operationVersion: SEMANTIC_SOURCE_QUERY_REPORT_OPERATION_VERSION,
		schemaVersion: SEMANTIC_SOURCE_QUERY_REPORT_REQUEST_SCHEMA_VERSION,
		subjectProjectConfigPaths
	};
}

function runWithClosedTerminal(input: string): Promise<{
	readonly progress: string;
	readonly status: number | null;
}> {
	return new Promise((resolve, reject) => {
		const child = spawn('bun', [SCRIPT, '--stdin'], {
			cwd: REPOSITORY_ROOT,
			stdio: ['pipe', 'pipe', 'pipe'],
			windowsHide: true
		});
		let progress = '';
		child.stderr.setEncoding('utf8');
		child.stderr.on('data', (chunk: string) => {
			progress += chunk;
		});
		child.on('error', reject);
		child.on('close', (status) => resolve({ progress, status }));
		child.stdout.destroy();
		child.stdin.end(input);
	});
}

describe('semantic-source-query command adapter', () => {
	it('awaits one report and separates bounded progress JSONL from one canonical terminal LF', async () => {
		const progress: string[] = [];
		const terminal: string[] = [];
		let release!: (outcome: SemanticSourceQueryReportOutcome) => void;
		const deferred = new Promise<SemanticSourceQueryReportOutcome>((resolve) => {
			release = resolve;
		});
		const runReport = (async (
			_request: unknown,
			options: Parameters<typeof runSemanticSourceQueryReport>[1]
		) => {
			options.onProgress?.(progressEvent());
			return deferred;
		}) as typeof runSemanticSourceQueryReport;
		let settled = false;
		const running = runSemanticSourceQueryCommand(
			{},
			{
				repositoryRoot: REPOSITORY_ROOT,
				runReport,
				writeProgress: (line) => progress.push(line),
				writeTerminal: (line) => terminal.push(line)
			}
		).then((exitCode) => {
			settled = true;
			return exitCode;
		});
		await Promise.resolve();
		expect(settled).toBe(false);
		expect(terminal).toEqual([]);
		const outcome = partial();
		release(outcome);
		expect(await running).toBe(3);
		expect(progress).toHaveLength(1);
		expect(JSON.parse(progress[0]!)).toMatchObject({ detailCode: 'SYNTHETIC' });
		expect(terminal).toEqual([`${canonicalSemanticJson(outcome)}\n`]);
	});

	it.each([
		{ expected: 2 as const, outcome: unavailable('incompatible') },
		{ expected: 3 as const, outcome: unavailable('resource-refused') },
		{ expected: 4 as const, outcome: unavailable('failed') }
	])('preserves the exact report exit mapping: $expected', async ({ expected, outcome }) => {
		const terminal: string[] = [];
		const exitCode = await runSemanticSourceQueryCommand(
			{},
			{
				repositoryRoot: REPOSITORY_ROOT,
				runReport: (async () => outcome) as typeof runSemanticSourceQueryReport,
				writeProgress: () => undefined,
				writeTerminal: (line) => terminal.push(line)
			}
		);
		expect(exitCode).toBe(expected);
		expect(terminal).toEqual([`${canonicalSemanticJson(outcome)}\n`]);
	});

	it('contains terminal EPIPE, rejection, hostile thenables, and serialization failure', async () => {
		const runReport = (async () => partial()) as typeof runSemanticSourceQueryReport;
		const options = {
			repositoryRoot: REPOSITORY_ROOT,
			runReport,
			writeProgress: () => undefined
		};
		expect(
			await runSemanticSourceQueryCommand(
				{},
				{
					...options,
					writeTerminal: () => {
						throw Object.assign(new Error('closed terminal'), { code: 'EPIPE' });
					}
				}
			)
		).toBe(4);
		expect(
			await runSemanticSourceQueryCommand(
				{},
				{
					...options,
					writeTerminal: () => Promise.reject(new Error('terminal rejection'))
				}
			)
		).toBe(4);
		expect(
			await runSemanticSourceQueryCommand(
				{},
				{
					...options,
					writeTerminal: () =>
						Object.defineProperty({}, 'then', {
							get() {
								throw new Error('hostile terminal then getter');
							}
						})
				}
			)
		).toBe(4);

		const cyclic = partial() as unknown as Record<string, unknown>;
		cyclic.cycle = cyclic;
		let writes = 0;
		expect(
			await runSemanticSourceQueryCommand(
				{},
				{
					...options,
					runReport: (async () => cyclic) as unknown as typeof runSemanticSourceQueryReport,
					writeTerminal: () => {
						writes += 1;
					}
				}
			)
		).toBe(4);
		expect(writes).toBe(0);
	});

	it('returns internal-failure when the executable cannot complete its stdout envelope', async () => {
		const result = await runWithClosedTerminal('{}');
		expect(result.status).toBe(4);
		for (const line of result.progress.split('\n').filter(Boolean))
			expect(() => JSON.parse(line)).not.toThrow();
	});

	it('pins the package command and keeps request-source failures machine-framed', () => {
		const manifest = JSON.parse(readFileSync(`${REPOSITORY_ROOT}/package.json`, 'utf8')) as {
			scripts: Record<string, string>;
		};
		expect(manifest.scripts[PACKAGE_SCRIPT]).toBe(EXPECTED_PACKAGE_COMMAND);

		for (const args of [
			[],
			['--unknown'],
			['--request'],
			['--stdin', '--stdin'],
			['--request', 'one.json', '--stdin']
		]) {
			const result = run(args);
			expect(result.status, result.stderr).toBe(2);
			expect(result.stdout).toBe('');
			expect(JSON.parse(result.stderr)).toEqual({
				error: 'request-input-invalid',
				message: 'Use exactly one of --stdin or --request <json-file>.'
			});
		}

		const malformed = run(['--stdin'], '{not json');
		expect(malformed.status).toBe(2);
		expect(malformed.stdout).toBe('');
		expect(JSON.parse(malformed.stderr)).toEqual({
			error: 'request-input-invalid',
			message: 'Request input is not valid JSON.'
		});

		const malformedUtf8 = run(
			['--stdin'],
			Buffer.concat([Buffer.from('{"executionId":"'), Buffer.from([0xc3, 0x28]), Buffer.from('"}')])
		);
		expect(malformedUtf8.status).toBe(2);
		expect(malformedUtf8.stdout).toBe('');
		expect(JSON.parse(malformedUtf8.stderr)).toEqual({
			error: 'request-input-invalid',
			message: 'Request input is not valid UTF-8.'
		});
	});

	it(
		'executes the silent package entry point against the real bounded semantic pipeline',
		{ timeout: 120_000 },
		() => {
			const result = runPackage(['--stdin'], JSON.stringify(acceptedRequest()));
			expect(result.error).toBeUndefined();
			expect(result.status, result.stderr).toBe(3);
			expect(result.stdout.endsWith('\n')).toBe(true);
			expect(result.stdout.split('\n').filter(Boolean)).toHaveLength(1);
			const terminal = JSON.parse(result.stdout) as Record<string, any>;
			expect(terminal).toMatchObject({
				analysisAuthority: 'NONE',
				authorityTransfer: 'NONE',
				gateEffect: 'NONE',
				operationVersion: SEMANTIC_SOURCE_QUERY_REPORT_OPERATION_VERSION,
				outcome: 'partial',
				result: {
					capability: {
						id: 'IMPLEMENTATION_LOCAL_SEMANTIC_SOURCE_QUERY',
						status: 'IMPLEMENTATION_LOCAL_UNREGISTERED'
					},
					population: {
						evaluationClosure: 'CLOSED_FOR_RETAINED_VALIDATED_SEMANTIC_SOURCES',
						globalClosure: 'OPEN'
					}
				},
				state: 'partial'
			});
			const evaluations = terminal.result.evaluations as Array<Record<string, any>>;
			const matches = new Set(terminal.result.partitions.supportedMatches as string[]);
			expect(
				evaluations.some(
					(evaluation) =>
						matches.has(String(evaluation.source.id)) &&
						evaluation.source.logicalPath ===
							'packages/csaa/test-fixtures/project-context-command/left/src/alpha.ts'
				)
			).toBe(true);

			const progress = result.stderr
				.split('\n')
				.filter(Boolean)
				.map((line) => JSON.parse(line) as Record<string, unknown>);
			const admittedSchemas = new Set<string>([
				SEMANTIC_SOURCE_QUERY_REPORT_PROGRESS_SCHEMA_VERSION,
				SEMANTIC_SOURCE_QUERY_PROGRESS_TRANSPORT_SCHEMA_VERSION
			]);
			expect(progress.length).toBeGreaterThan(0);
			expect(progress.every((event) => admittedSchemas.has(String(event.schemaVersion)))).toBe(
				true
			);
		}
	);

	it.runIf(process.env.CSAA_SEMANTIC_SOURCE_QUERY_REPORT_INTEGRATION === '1')(
		'runs all seven production projects with complete node-total static source evaluation',
		{ timeout: FULL_REPOSITORY_TIMEOUT_MS + 60_000 },
		() => {
			const result = spawnSync('bun', [SCRIPT, '--stdin'], {
				cwd: REPOSITORY_ROOT,
				encoding: 'utf8',
				input: JSON.stringify(
					acceptedRequest(FULL_PROJECT_CONFIG_PATHS, {
						field: 'origin',
						kind: 'EQUALS',
						nodeId: 'authored-production-source',
						value: 'AUTHORED'
					})
				),
				maxBuffer: 512 * 1024 * 1024,
				timeout: FULL_REPOSITORY_TIMEOUT_MS,
				windowsHide: true
			});
			expect(result.error).toBeUndefined();
			const terminalLines = result.stdout.split('\n').filter(Boolean);
			expect(terminalLines).toHaveLength(1);
			expect(result.stdout.endsWith('\n')).toBe(true);
			const terminal = JSON.parse(terminalLines[0]!) as Record<string, any>;
			expect(result.status, terminalLines[0]).toBe(3);
			expect(terminal).toMatchObject({
				analysisAuthority: 'NONE',
				authorityTransfer: 'NONE',
				gateEffect: 'NONE',
				outcome: 'partial',
				result: {
					currentness: { state: 'CURRENT_FOR_CAPTURED_SUBJECT' },
					population: {
						evaluationClosure: 'CLOSED_FOR_RETAINED_VALIDATED_SEMANTIC_SOURCES',
						globalClosure: 'OPEN'
					},
					queryCoverage: { partitionsReconcile: true }
				},
				state: 'partial'
			});
			const partitions = terminal.result.partitions as Record<string, string[]>;
			const partitionRecords = Object.values(partitions).reduce(
				(total, population) => total + population.length,
				0
			);
			expect(terminal.result.population.retainedRecords).toBeGreaterThan(0);
			expect(terminal.result.population.evaluatedRecords).toBe(
				terminal.result.population.retainedRecords
			);
			expect(partitionRecords).toBe(terminal.result.population.retainedRecords);
			expect(terminal.result.partitions.supportedMatches.length).toBeGreaterThan(0);
			expect(terminal.result.queryCoverage.traceNodes).toBe(
				terminal.result.population.retainedRecords
			);

			const admittedSchemas = new Set<string>([
				SEMANTIC_SOURCE_QUERY_REPORT_PROGRESS_SCHEMA_VERSION,
				SEMANTIC_SOURCE_QUERY_PROGRESS_TRANSPORT_SCHEMA_VERSION
			]);
			const progress = result.stderr
				.split('\n')
				.filter(Boolean)
				.map((line) => JSON.parse(line) as Record<string, unknown>);
			expect(progress.length).toBeGreaterThan(0);
			expect(progress.every((event) => admittedSchemas.has(String(event.schemaVersion)))).toBe(
				true
			);
		}
	);
});
