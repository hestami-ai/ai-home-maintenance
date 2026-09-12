import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
	COMMAND_DISPATCH_TOPOLOGY_REPORT_EXECUTION_SELECTION,
	COMMAND_DISPATCH_TOPOLOGY_REPORT_OPERATION_VERSION,
	COMMAND_DISPATCH_TOPOLOGY_REPORT_PROJECT_CONFIG_PATHS,
	COMMAND_DISPATCH_TOPOLOGY_REPORT_REQUEST_SCHEMA_VERSION,
	COMMAND_DISPATCH_TOPOLOGY_REPORT_SAFETY_CEILINGS,
	type CommandDispatchTopologyReportOutcome
} from '../contracts/command-dispatch-topology-report.js';
import { runCommandDispatchTopologyCommand } from './run-command-dispatch-topology-command.js';
import {
	COMMAND_DISPATCH_TOPOLOGY_REPORT_PROGRESS_NONCLAIMS,
	type CommandDispatchTopologyReportProgressEvent,
	type RunCommandDispatchTopologyReportOptions,
	type runCommandDispatchTopologyReport
} from './run-command-dispatch-topology-report.js';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const SCRIPT = fileURLToPath(
	new URL('../../../../scripts/csaa-command-dispatch-topology.ts', import.meta.url)
);

function progressEvent(): CommandDispatchTopologyReportProgressEvent {
	return {
		deliverySemantics: 'SYNCHRONOUS_TRUSTED_HOST_CALLBACK',
		detailCode: 'SYNTHETIC',
		elapsedMs: 0,
		kind: 'REPORT_STAGE',
		nonclaims: COMMAND_DISPATCH_TOPOLOGY_REPORT_PROGRESS_NONCLAIMS,
		observations: [],
		operationVersion: 'jan-csaa-report-command-dispatch-topology/0.1.0',
		phase: 'RESULT',
		predecessorProgress: null,
		protocolRole: 'PRELIMINARY_TYPESCRIPT_COMMAND_DISPATCH_TOPOLOGY_REPORT_TELEMETRY',
		reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY',
		schemaVersion: 'jan-csaa-command-dispatch-topology-report-progress/0.1.0',
		sequence: 1,
		stage: 'RESULT',
		state: 'COMPLETED',
		wallClockBudgetEffect: 'CALLBACK_TIME_MAY_CONSUME_ACTIVE_DURATION_BUDGET'
	};
}

function partial(): CommandDispatchTopologyReportOutcome {
	return {
		analysisAuthority: 'NONE',
		authorityTransfer: 'NONE',
		diagnostics: [],
		gateEffect: 'NONE',
		operationVersion: 'jan-csaa-report-command-dispatch-topology/0.1.0',
		outcome: 'partial',
		request: { synthetic: true },
		result: {
			evidence: {
				commandDispatchTopology: { edges: [{ attribution: 'CANDIDATE' }] },
				commandHandlerGraph: { nodes: [{ kind: 'COMMAND_REGISTRY_ENTRY' }] },
				observation: { declaredArrows: [{ machine: 'Alpha' }] }
			}
		},
		schemaVersion: 'jan-csaa-command-dispatch-topology-report/0.1.0',
		stageOutcomes: {},
		state: 'partial',
		subject: { subjectId: 'subject:synthetic' }
	} as unknown as CommandDispatchTopologyReportOutcome;
}

describe('command-dispatch topology command adapter', () => {
	it('awaits one report and separates progress JSONL from the terminal envelope', async () => {
		const progress: string[] = [];
		const terminal: string[] = [];
		let release!: (outcome: CommandDispatchTopologyReportOutcome) => void;
		const deferred = new Promise<CommandDispatchTopologyReportOutcome>((resolve) => {
			release = resolve;
		});
		const runReport = (async (
			_request: unknown,
			options: RunCommandDispatchTopologyReportOptions
		) => {
			options.onProgress?.(progressEvent());
			return deferred;
		}) as typeof runCommandDispatchTopologyReport;
		const running = runCommandDispatchTopologyCommand(
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
			result: {
				evidence: {
					commandDispatchTopology: { edges: [{ attribution: 'CANDIDATE' }] }
				}
			}
		});
	});

	it('pins the package command to the bounded executable', () => {
		const manifest = JSON.parse(readFileSync(`${REPOSITORY_ROOT}/package.json`, 'utf8')) as {
			scripts: Record<string, string>;
		};
		expect(manifest.scripts['csaa:analyze:command-dispatch-topology']).toBe(
			'bun scripts/csaa-command-dispatch-topology.ts'
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

	it.runIf(process.env.CSAA_COMMAND_DISPATCH_TOPOLOGY_REPORT_INTEGRATION === '1')(
		'runs the bounded executable with production dependencies and one terminal envelope',
		() => {
			const result = spawnSync('bun', [SCRIPT, '--stdin'], {
				cwd: REPOSITORY_ROOT,
				encoding: 'utf8',
				input: JSON.stringify({
					budgets: COMMAND_DISPATCH_TOPOLOGY_REPORT_SAFETY_CEILINGS,
					executionSelection: COMMAND_DISPATCH_TOPOLOGY_REPORT_EXECUTION_SELECTION,
					operationVersion: COMMAND_DISPATCH_TOPOLOGY_REPORT_OPERATION_VERSION,
					schemaVersion: COMMAND_DISPATCH_TOPOLOGY_REPORT_REQUEST_SCHEMA_VERSION,
					subjectProjectConfigPaths: COMMAND_DISPATCH_TOPOLOGY_REPORT_PROJECT_CONFIG_PATHS
				}),
				maxBuffer: 256 * 1024 * 1024,
				timeout: 1_800_000,
				windowsHide: true
			});
			expect(result.error).toBeUndefined();
			expect(result.status, result.stderr).toBe(3);
			const terminalLines = result.stdout.split('\n').filter(Boolean);
			expect(terminalLines).toHaveLength(1);
			const terminal = JSON.parse(terminalLines[0]!) as {
				outcome: string;
				result: {
					coverage: { candidateHandlerTargetEdges: number; pipelineNodes: number };
					evidence: {
						commandDispatchTopology: { edges: readonly unknown[]; nodes: readonly unknown[] };
						commandHandlerGraph: { nodes: readonly unknown[] };
						observation: { declaredArrows: readonly unknown[] };
					};
				};
			};
			expect(terminal.outcome).toBe('partial');
			expect(terminal.result.coverage.candidateHandlerTargetEdges).toBeGreaterThan(0);
			expect(terminal.result.coverage.pipelineNodes).toBe(1);
			expect(terminal.result.evidence.commandDispatchTopology.edges.length).toBeGreaterThan(0);
			expect(terminal.result.evidence.commandDispatchTopology.nodes).toHaveLength(1);
			expect(terminal.result.evidence.commandHandlerGraph.nodes.length).toBeGreaterThan(0);
			expect(terminal.result.evidence.observation.declaredArrows.length).toBeGreaterThan(0);
			const progress = result.stderr
				.split('\n')
				.filter(Boolean)
				.map((line) => JSON.parse(line) as { kind?: string; phase?: string; state?: string });
			expect(progress.some((event) => event.kind === 'PREDECESSOR_REPORT')).toBe(true);
			for (const phase of [
				'REQUEST_BIND',
				'PREDECESSOR_PIPELINE',
				'COMMAND_DISPATCH_TOPOLOGY',
				'CURRENTNESS',
				'RESULT'
			])
				expect(
					progress
						.filter((event) => event.kind === 'REPORT_STAGE' && event.phase === phase)
						.map((event) => event.state)
				).toEqual(['STARTED', 'COMPLETED']);
		},
		1_800_000
	);
});
