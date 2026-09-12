import { Buffer } from 'node:buffer';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
	COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_EXECUTION_SELECTION,
	COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_OPERATION_VERSION,
	COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_PROJECT_CONFIG_PATHS,
	COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_REQUEST_SCHEMA_VERSION,
	COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_SAFETY_CEILINGS,
	type CommandEventContractOverlayReportOutcome
} from '../contracts/command-event-contract-overlay-report.js';
import { runCommandEventContractOverlayCommand } from './run-command-event-contract-overlay-command.js';
import {
	COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_PROGRESS_NONCLAIMS,
	type CommandEventContractOverlayReportProgressEvent,
	type runCommandEventContractOverlayReport
} from './run-command-event-contract-overlay-report.js';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const SCRIPT = fileURLToPath(
	new URL('../../../../scripts/csaa-command-event-contract-overlay.ts', import.meta.url)
);
const PACKAGE_SCRIPT = 'csaa:analyze:command-event-contract-overlay';

function progressEvent(): CommandEventContractOverlayReportProgressEvent {
	return {
		deliverySemantics: 'SYNCHRONOUS_TRUSTED_HOST_CALLBACK',
		detailCode: 'SYNTHETIC',
		elapsedMs: 0,
		kind: 'REPORT_STAGE',
		nonclaims: COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_PROGRESS_NONCLAIMS,
		observations: [],
		operationVersion: 'jan-csaa-report-command-event-contract-overlay/0.1.0',
		overlayProgress: null,
		phase: 'RESULT',
		predecessorProgress: null,
		protocolRole: 'PRELIMINARY_TYPESCRIPT_COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_TELEMETRY',
		reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY',
		schemaVersion: 'jan-csaa-command-event-contract-overlay-report-progress/0.1.0',
		sequence: 1,
		stage: 'RESULT',
		state: 'COMPLETED',
		wallClockBudgetEffect: 'CALLBACK_TIME_MAY_CONSUME_ACTIVE_DURATION_BUDGET'
	};
}

function partial(): CommandEventContractOverlayReportOutcome {
	return {
		analysisAuthority: 'NONE',
		authorityTransfer: 'NONE',
		diagnostics: [],
		gateEffect: 'NONE',
		operationVersion: 'jan-csaa-report-command-event-contract-overlay/0.1.0',
		outcome: 'partial',
		request: { synthetic: true },
		result: {
			coverage: { commands: 1, eventContracts: 2 },
			evidence: {
				overlay: {
					commands: [{ commandName: 'SyntheticCommand' }],
					eventContracts: [{ eventName: 'SyntheticEvent' }]
				}
			}
		},
		schemaVersion: 'jan-csaa-command-event-contract-overlay-report/0.1.0',
		stageOutcomes: {},
		state: 'partial',
		subject: { subjectId: 'subject:synthetic-command' }
	} as unknown as CommandEventContractOverlayReportOutcome;
}

function run(args: readonly string[], input?: string) {
	return spawnSync('bun', [SCRIPT, ...args], {
		cwd: REPOSITORY_ROOT,
		encoding: 'utf8',
		input,
		windowsHide: true
	});
}

function runWithClosedPipe(
	pipe: 'progress' | 'terminal',
	input: string
): Promise<{ readonly remaining: string; readonly status: number | null }> {
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

describe('command-event-contract overlay command adapter', () => {
	it('awaits one report and separates progress JSONL from the one terminal envelope', async () => {
		const progress: string[] = [];
		const terminal: string[] = [];
		let release!: (outcome: CommandEventContractOverlayReportOutcome) => void;
		const deferred = new Promise<CommandEventContractOverlayReportOutcome>((resolve) => {
			release = resolve;
		});
		const runReport = (async (
			_request: unknown,
			options: Parameters<typeof runCommandEventContractOverlayReport>[1]
		) => {
			options.onProgress?.(progressEvent());
			return deferred;
		}) as typeof runCommandEventContractOverlayReport;
		let settled = false;
		const running = runCommandEventContractOverlayCommand(
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
		release(partial());
		expect(await running).toBe(3);
		expect(progress).toHaveLength(1);
		expect(JSON.parse(progress[0]!)).toMatchObject({ detailCode: 'SYNTHETIC' });
		expect(terminal).toHaveLength(1);
		expect(terminal[0]!.endsWith('\n')).toBe(true);
		expect(JSON.parse(terminal[0]!)).toMatchObject({
			outcome: 'partial',
			result: {
				evidence: { overlay: { commands: [{ commandName: 'SyntheticCommand' }] } }
			}
		});
	});

	it('contains terminal serialization and synchronous or asynchronous sink failures', async () => {
		const runReport = (async () => partial()) as typeof runCommandEventContractOverlayReport;
		const options = {
			repositoryRoot: REPOSITORY_ROOT,
			runReport,
			writeProgress: () => undefined
		};

		expect(
			await runCommandEventContractOverlayCommand(
				{},
				{
					...options,
					writeTerminal: () => {
						throw new Error('synthetic synchronous terminal failure');
					}
				}
			)
		).toBe(4);
		expect(
			await runCommandEventContractOverlayCommand(
				{},
				{
					...options,
					writeTerminal: () => Promise.reject(new Error('synthetic terminal rejection'))
				}
			)
		).toBe(4);

		const cyclic = partial() as unknown as Record<string, unknown>;
		cyclic.cycle = cyclic;
		let terminalWrites = 0;
		expect(
			await runCommandEventContractOverlayCommand(
				{},
				{
					...options,
					runReport: (async () => cyclic) as unknown as typeof runCommandEventContractOverlayReport,
					writeTerminal: () => {
						terminalWrites += 1;
					}
				}
			)
		).toBe(4);
		expect(terminalWrites).toBe(0);
	});

	it('pins the package command to the bounded executable', () => {
		const manifest = JSON.parse(readFileSync(`${REPOSITORY_ROOT}/package.json`, 'utf8')) as {
			scripts: Record<string, string>;
		};
		expect(manifest.scripts[PACKAGE_SCRIPT]).toBe(
			'bun scripts/csaa-command-event-contract-overlay.ts'
		);
	});

	it.each([
		{ args: [] },
		{ args: ['--unknown'] },
		{ args: ['--request'] },
		{ args: ['--stdin', '--stdin'] },
		{ args: ['--request', 'one.json', '--stdin'] }
	] as const)('rejects invalid request-source arguments: $args', ({ args }) => {
		const result = run(args);
		expect(result.status, result.stderr).toBe(2);
		expect(result.stdout).toBe('');
		expect(JSON.parse(result.stderr)).toEqual({
			error: 'request-input-invalid',
			message: 'Use exactly one of --stdin or --request <json-file>.'
		});
	});

	it('keeps malformed and admitted-request refusals machine-framed', () => {
		const malformed = run(['--stdin'], '{not json');
		expect(malformed.status).toBe(2);
		expect(malformed.stdout).toBe('');
		expect(JSON.parse(malformed.stderr)).toEqual({
			error: 'request-input-invalid',
			message: 'Request input is not valid JSON.'
		});

		const invalid = run(['--stdin'], '{}');
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

	it('contains closed progress and terminal pipes without EPIPE leakage', async () => {
		const invalid = '{}';
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
	});

	it('bounds stdin and regular-file request inputs before report execution', () => {
		const exactMiB = run(['--stdin'], ' '.repeat(1024 * 1024));
		expect(exactMiB.status).toBe(2);
		expect(exactMiB.stdout).toBe('');
		expect(JSON.parse(exactMiB.stderr)).toEqual({
			error: 'request-input-invalid',
			message: 'Request input is not valid JSON.'
		});
		const overMiB = run(['--stdin'], ' '.repeat(1024 * 1024 + 1));
		expect(overMiB.status).toBe(2);
		expect(overMiB.stdout).toBe('');
		expect(JSON.parse(overMiB.stderr)).toEqual({
			error: 'request-input-invalid',
			message: 'Request input exceeds 1 MiB.'
		});

		const root = mkdtempSync(join(tmpdir(), 'csaa-command-event-contract-overlay-command-'));
		try {
			const requestPath = join(root, 'request.json');
			writeFileSync(requestPath, '{}', 'utf8');
			const fromFile = run(['--request', requestPath]);
			expect(fromFile.status, fromFile.stderr).toBe(2);
			expect(JSON.parse(fromFile.stdout)).toMatchObject({ code: 'REQUEST_SHAPE_INVALID' });

			const malformedPath = join(root, 'malformed.json');
			writeFileSync(malformedPath, '{not json', 'utf8');
			const malformed = run(['--request', malformedPath]);
			expect(malformed.status).toBe(2);
			expect(malformed.stdout).toBe('');
			expect(JSON.parse(malformed.stderr)).toEqual({
				error: 'request-input-invalid',
				message: 'Request input is not valid JSON.'
			});

			const exactMiBPath = join(root, 'exact-mib.json');
			writeFileSync(exactMiBPath, Buffer.alloc(1024 * 1024, 0x20));
			const exactMiBFile = run(['--request', exactMiBPath]);
			expect(exactMiBFile.status).toBe(2);
			expect(exactMiBFile.stdout).toBe('');
			expect(JSON.parse(exactMiBFile.stderr)).toEqual({
				error: 'request-input-invalid',
				message: 'Request input is not valid JSON.'
			});

			const overMiBPath = join(root, 'over-mib.json');
			writeFileSync(overMiBPath, Buffer.alloc(1024 * 1024 + 1, 0x20));
			const overMiBFile = run(['--request', overMiBPath]);
			expect(overMiBFile.status).toBe(2);
			expect(overMiBFile.stdout).toBe('');
			expect(JSON.parse(overMiBFile.stderr)).toEqual({
				error: 'request-input-invalid',
				message: 'Request input exceeds 1 MiB.'
			});

			const directory = run(['--request', root]);
			expect(directory.status).toBe(2);
			expect(directory.stdout).toBe('');
			expect(JSON.parse(directory.stderr)).toEqual({
				error: 'request-input-invalid',
				message: 'The request path must identify a regular file.'
			});
		} finally {
			rmSync(root, { force: true, recursive: true });
		}
	}, 30_000);

	it.runIf(process.env.CSAA_COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_INTEGRATION === '1')(
		'runs the production dependencies with one terminal envelope and exact retained witnesses',
		() => {
			const result = spawnSync('bun', [SCRIPT, '--stdin'], {
				cwd: REPOSITORY_ROOT,
				encoding: 'utf8',
				input: JSON.stringify({
					budgets: COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_SAFETY_CEILINGS,
					executionSelection: COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_EXECUTION_SELECTION,
					operationVersion: COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_OPERATION_VERSION,
					schemaVersion: COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_REQUEST_SCHEMA_VERSION,
					subjectProjectConfigPaths: COMMAND_EVENT_CONTRACT_OVERLAY_REPORT_PROJECT_CONFIG_PATHS
				}),
				maxBuffer: 512 * 1024 * 1024,
				timeout: 1_800_000,
				windowsHide: true
			});
			expect(result.error).toBeUndefined();
			const terminalLines = result.stdout.split('\n').filter(Boolean);
			expect(terminalLines).toHaveLength(1);
			const terminal = JSON.parse(terminalLines[0]!) as {
				outcome: string;
				result: {
					coverage: Record<string, number | boolean | readonly unknown[]>;
					evidence: {
						overlay: {
							boundContributions: readonly unknown[];
							commands: readonly unknown[];
							declaredLinks: readonly unknown[];
							eventContracts: readonly unknown[];
							frontiers: readonly { readonly frontierKind: string }[];
							pinnedEmissions: readonly unknown[];
						};
					};
				};
			};
			expect(result.status, terminalLines[0]).toBe(3);
			expect(terminal.outcome).toBe('partial');
			expect(terminal.result.coverage).toMatchObject({
				additionalDeclaredLinks: 4,
				boundContributions: 186,
				boundDistinctEvents: 107,
				boundRepeatedContributions: 79,
				commandDeclaredDistinctEvents: 107,
				commandDeclaredLinks: 107,
				commands: 103,
				commandsWithoutTransitionBinding: 27,
				declaredNeitherBoundNorPinned: 32,
				eventContracts: 144,
				frontiers: 64,
				generatedBoundSetDifferences: 0,
				missingEventContracts: 0,
				pinnedEmissions: 112,
				pinnedEmittedNotBound: 5,
				primaryDeclaredLinks: 103,
				reconciles: true,
				retainedBoundNotPinnedEmitted: 0
			});
			expect(terminal.result.evidence.overlay.boundContributions).toHaveLength(186);
			expect(terminal.result.evidence.overlay.commands).toHaveLength(103);
			expect(terminal.result.evidence.overlay.declaredLinks).toHaveLength(107);
			expect(terminal.result.evidence.overlay.eventContracts).toHaveLength(144);
			expect(terminal.result.evidence.overlay.pinnedEmissions).toHaveLength(112);
			expect(terminal.result.evidence.overlay.frontiers).toHaveLength(64);
			const frontierCounts: Record<string, number> = {};
			for (const frontier of terminal.result.evidence.overlay.frontiers)
				frontierCounts[frontier.frontierKind] = (frontierCounts[frontier.frontierKind] ?? 0) + 1;
			expect(frontierCounts).toEqual({
				COMMAND_WITHOUT_TRANSITION_BINDING: 27,
				DECLARED_NEITHER_BOUND_NOR_PINNED_EMITTED: 32,
				PINNED_EMITTED_NOT_RETAINED_BOUND: 5
			});

			const progress = result.stderr
				.split('\n')
				.filter(Boolean)
				.map((line) => JSON.parse(line) as { kind?: string; phase?: string; state?: string });
			expect(progress.some((event) => event.kind === 'PREDECESSOR_REPORT')).toBe(true);
			expect(progress.some((event) => event.kind === 'OVERLAY_BUILDER')).toBe(true);
			for (const phase of [
				'REQUEST_BIND',
				'PREDECESSOR_PIPELINE',
				'COMMAND_EVENT_CONTRACT_OVERLAY',
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
