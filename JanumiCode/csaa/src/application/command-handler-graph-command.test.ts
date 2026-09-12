import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
	COMMAND_HANDLER_GRAPH_REPORT_EXECUTION_SELECTION,
	COMMAND_HANDLER_GRAPH_REPORT_OPERATION_VERSION,
	COMMAND_HANDLER_GRAPH_REPORT_PROJECT_CONFIG_PATHS,
	COMMAND_HANDLER_GRAPH_REPORT_REQUEST_SCHEMA_VERSION,
	COMMAND_HANDLER_GRAPH_REPORT_SAFETY_CEILINGS,
	type CommandHandlerGraphReportOutcome
} from '../contracts/command-handler-graph-report.js';
import {
	COMMAND_HANDLER_GRAPH_REPORT_PROGRESS_NONCLAIMS,
	type CommandHandlerGraphReportProgressEvent,
	type RunCommandHandlerGraphReportOptions,
	type runCommandHandlerGraphReport
} from './run-command-handler-graph-report.js';
import { runCommandHandlerGraphCommand } from './run-command-handler-graph-command.js';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const SCRIPT = fileURLToPath(
	new URL('../../../../scripts/csaa-command-handler-graph.ts', import.meta.url)
);

function progressEvent(): CommandHandlerGraphReportProgressEvent {
	return {
		adapterProgress: null,
		deliverySemantics: 'SYNCHRONOUS_TRUSTED_HOST_CALLBACK',
		detailCode: 'SYNTHETIC',
		elapsedMs: 0,
		kind: 'REPORT_STAGE',
		nonclaims: COMMAND_HANDLER_GRAPH_REPORT_PROGRESS_NONCLAIMS,
		observations: [],
		operationVersion: 'jan-csaa-report-command-handler-graph/0.1.0',
		phase: 'RESULT',
		protocolRole: 'PRELIMINARY_TYPESCRIPT_COMMAND_HANDLER_GRAPH_REPORT_TELEMETRY',
		reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY',
		schemaVersion: 'jan-csaa-command-handler-graph-report-progress/0.1.0',
		sequence: 1,
		stage: 'RESULT',
		state: 'COMPLETED',
		wallClockBudgetEffect: 'CALLBACK_TIME_MAY_CONSUME_ACTIVE_DURATION_BUDGET'
	};
}

function partial(): CommandHandlerGraphReportOutcome {
	return {
		analysisAuthority: 'NONE',
		authorityTransfer: 'NONE',
		diagnostics: [],
		gateEffect: 'NONE',
		operationVersion: 'jan-csaa-report-command-handler-graph/0.1.0',
		outcome: 'partial',
		request: { synthetic: true },
		result: {
			evidence: {
				commandHandlerGraph: { nodes: [{ kind: 'COMMAND_REGISTRY_ENTRY' }] },
				observation: { declaredArrows: [{ machine: 'Alpha' }] }
			}
		},
		schemaVersion: 'jan-csaa-command-handler-graph-report/0.1.0',
		stageOutcomes: {},
		state: 'partial',
		subject: { subjectId: 'subject:synthetic' }
	} as unknown as CommandHandlerGraphReportOutcome;
}

describe('command-handler-graph command adapter', () => {
	it('awaits one report and separates progress JSONL from the terminal envelope', async () => {
		const progress: string[] = [];
		const terminal: string[] = [];
		let release!: (outcome: CommandHandlerGraphReportOutcome) => void;
		const deferred = new Promise<CommandHandlerGraphReportOutcome>((resolve) => {
			release = resolve;
		});
		const runReport = (async (_request: unknown, options: RunCommandHandlerGraphReportOptions) => {
			options.onProgress?.(progressEvent());
			return deferred;
		}) as typeof runCommandHandlerGraphReport;
		const running = runCommandHandlerGraphCommand(
			{},
			{
				repositoryRoot: REPOSITORY_ROOT,
				runReport,
				writeProgress: (line) => progress.push(line),
				writeTerminal: (line) => terminal.push(line)
			}
		);
		expect(terminal).toEqual([]);
		release(partial());
		expect(await running).toBe(3);
		expect(progress).toHaveLength(1);
		expect(JSON.parse(progress[0]!)).toMatchObject({ detailCode: 'SYNTHETIC' });
		expect(terminal).toHaveLength(1);
		expect(terminal[0]!.endsWith('\n')).toBe(true);
		expect(JSON.parse(terminal[0]!)).toMatchObject({
			outcome: 'partial',
			result: { evidence: { observation: { declaredArrows: [{ machine: 'Alpha' }] } } }
		});
	});

	it('pins the package command to the bounded executable', () => {
		const manifest = JSON.parse(readFileSync(`${REPOSITORY_ROOT}/package.json`, 'utf8')) as {
			scripts: Record<string, string>;
		};
		expect(manifest.scripts['csaa:analyze:command-handler-graph']).toBe(
			'bun scripts/csaa-command-handler-graph.ts'
		);
	});

	it.each([
		{ args: [] },
		{ args: ['--unknown'] },
		{ args: ['--request'] },
		{ args: ['--stdin', '--stdin'] }
	] as const)('rejects invalid request-source arguments: $args', ({ args }) => {
		const result = spawnSync('bun', [SCRIPT, ...args], {
			cwd: REPOSITORY_ROOT,
			encoding: 'utf8',
			windowsHide: true
		});
		expect(result.status, result.stderr).toBe(2);
		expect(result.stdout).toBe('');
		expect(JSON.parse(result.stderr)).toEqual({
			error: 'request-input-invalid',
			message: 'Use exactly one of --stdin or --request <json-file>.'
		});
	});

	it('keeps malformed and admitted-request refusals machine-framed', () => {
		const malformed = spawnSync('bun', [SCRIPT, '--stdin'], {
			cwd: REPOSITORY_ROOT,
			encoding: 'utf8',
			input: '{not json',
			windowsHide: true
		});
		expect(malformed.status).toBe(2);
		expect(malformed.stdout).toBe('');
		expect(JSON.parse(malformed.stderr)).toMatchObject({ error: 'request-input-invalid' });

		const invalid = spawnSync('bun', [SCRIPT, '--stdin'], {
			cwd: REPOSITORY_ROOT,
			encoding: 'utf8',
			input: '{}',
			windowsHide: true
		});
		expect(invalid.status, invalid.stderr).toBe(2);
		expect(invalid.stdout.split('\n').filter(Boolean)).toHaveLength(1);
		expect(JSON.parse(invalid.stdout)).toMatchObject({
			analysisAuthority: 'NONE',
			code: 'REQUEST_SHAPE_INVALID',
			outcome: 'unavailable',
			stage: 'REQUEST',
			state: 'incompatible'
		});
		for (const line of invalid.stderr.split('\n').filter(Boolean))
			expect(() => JSON.parse(line)).not.toThrow();
	});

	it('rejects request inputs larger than one MiB before entering the report', () => {
		const result = spawnSync('bun', [SCRIPT, '--stdin'], {
			cwd: REPOSITORY_ROOT,
			encoding: 'utf8',
			input: 'x'.repeat(1024 * 1024 + 1),
			windowsHide: true
		});
		expect(result.status).toBe(2);
		expect(result.stdout).toBe('');
		expect(JSON.parse(result.stderr)).toMatchObject({
			error: 'request-input-invalid',
			message: 'Request input exceeds 1 MiB.'
		});
	});

	it.runIf(process.env.CSAA_COMMAND_HANDLER_GRAPH_REPORT_INTEGRATION === '1')(
		'runs the bounded executable with production dependencies and one terminal envelope',
		() => {
			const result = spawnSync('bun', [SCRIPT, '--stdin'], {
				cwd: REPOSITORY_ROOT,
				encoding: 'utf8',
				input: JSON.stringify({
					budgets: COMMAND_HANDLER_GRAPH_REPORT_SAFETY_CEILINGS,
					executionSelection: COMMAND_HANDLER_GRAPH_REPORT_EXECUTION_SELECTION,
					operationVersion: COMMAND_HANDLER_GRAPH_REPORT_OPERATION_VERSION,
					schemaVersion: COMMAND_HANDLER_GRAPH_REPORT_REQUEST_SCHEMA_VERSION,
					subjectProjectConfigPaths: COMMAND_HANDLER_GRAPH_REPORT_PROJECT_CONFIG_PATHS
				}),
				maxBuffer: 256 * 1024 * 1024,
				timeout: 1_200_000,
				windowsHide: true
			});
			expect(result.error).toBeUndefined();
			expect(result.status, result.stderr).toBe(3);
			const terminalLines = result.stdout.split('\n').filter(Boolean);
			expect(terminalLines).toHaveLength(1);
			const terminal = JSON.parse(terminalLines[0]!) as {
				outcome: string;
				result: {
					coverage: {
						discoveredCommandRegistryEntries: number;
						discoveredHandlerRegistryEntries: number;
					};
					evidence: {
						commandHandlerGraph: { nodes: readonly unknown[] };
						observation: { declaredArrows: readonly unknown[] };
					};
				};
			};
			expect(terminal.outcome).toBe('partial');
			expect(terminal.result.coverage.discoveredCommandRegistryEntries).toBeGreaterThan(0);
			expect(terminal.result.coverage.discoveredHandlerRegistryEntries).toBeGreaterThan(0);
			expect(terminal.result.evidence.commandHandlerGraph.nodes.length).toBeGreaterThan(0);
			expect(terminal.result.evidence.observation.declaredArrows.length).toBeGreaterThan(0);
			const progress = result.stderr
				.split('\n')
				.filter(Boolean)
				.map((line) => JSON.parse(line) as { kind?: string; phase?: string; state?: string });
			expect(progress.some((event) => event.kind === 'RETAINED_ADAPTER')).toBe(true);
			for (const phase of [
				'REQUEST_BIND',
				'PREDECESSOR_PIPELINE',
				'ARTIFACT_SET',
				'RETAINED_CENSUS',
				'COMMAND_HANDLER_GRAPH',
				'CURRENTNESS',
				'RESULT'
			])
				expect(
					progress
						.filter((event) => event.kind === 'REPORT_STAGE' && event.phase === phase)
						.map((event) => event.state)
				).toEqual(['STARTED', 'COMPLETED']);
		},
		1_200_000
	);
});
