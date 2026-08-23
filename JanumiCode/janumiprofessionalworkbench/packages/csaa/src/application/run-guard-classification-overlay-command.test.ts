import { Buffer } from 'node:buffer';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
	GUARD_CLASSIFICATION_OVERLAY_REPORT_EXECUTION_SELECTION,
	GUARD_CLASSIFICATION_OVERLAY_REPORT_OPERATION_VERSION,
	GUARD_CLASSIFICATION_OVERLAY_REPORT_PROJECT_CONFIG_PATHS,
	GUARD_CLASSIFICATION_OVERLAY_REPORT_REQUEST_SCHEMA_VERSION,
	GUARD_CLASSIFICATION_OVERLAY_REPORT_SAFETY_CEILINGS,
	type GuardClassificationOverlayReportOutcome
} from '../contracts/guard-classification-overlay-report.js';
import { runGuardClassificationOverlayCommand } from './run-guard-classification-overlay-command.js';
import {
	GUARD_CLASSIFICATION_OVERLAY_REPORT_PROGRESS_NONCLAIMS,
	type GuardClassificationOverlayReportProgressEvent,
	type runGuardClassificationOverlayReport
} from './run-guard-classification-overlay-report.js';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const SCRIPT = fileURLToPath(
	new URL('../../../../scripts/csaa-guard-classification-overlay.ts', import.meta.url)
);
const PACKAGE_SCRIPT = 'csaa:analyze:guard-classification-overlay';

function progressEvent(): GuardClassificationOverlayReportProgressEvent {
	return {
		deliverySemantics: 'SYNCHRONOUS_TRUSTED_HOST_CALLBACK',
		detailCode: 'SYNTHETIC',
		elapsedMs: 0,
		guardProgress: null,
		kind: 'REPORT_STAGE',
		nonclaims: GUARD_CLASSIFICATION_OVERLAY_REPORT_PROGRESS_NONCLAIMS,
		observations: [],
		operationVersion: 'jan-csaa-report-guard-classification-overlay/0.1.0',
		overlayProgress: null,
		phase: 'RESULT',
		predecessorProgress: null,
		protocolRole: 'PRELIMINARY_TYPESCRIPT_GUARD_CLASSIFICATION_OVERLAY_REPORT_TELEMETRY',
		reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY',
		schemaVersion: 'jan-csaa-guard-classification-overlay-report-progress/0.1.0',
		sequence: 1,
		stage: 'RESULT',
		state: 'COMPLETED',
		wallClockBudgetEffect: 'CALLBACK_TIME_MAY_CONSUME_ACTIVE_DURATION_BUDGET'
	};
}

function partial(): GuardClassificationOverlayReportOutcome {
	return {
		analysisAuthority: 'NONE',
		authorityTransfer: 'NONE',
		diagnostics: [],
		gateEffect: 'NONE',
		operationVersion: 'jan-csaa-report-guard-classification-overlay/0.1.0',
		outcome: 'partial',
		request: { synthetic: true },
		result: {
			coverage: { classifications: 1, occurrences: 2 },
			evidence: {
				overlay: {
					classifications: [{ guardText: 'synthetic guard' }],
					occurrences: [{ classificationId: 'synthetic classification' }]
				}
			}
		},
		schemaVersion: 'jan-csaa-guard-classification-overlay-report/0.1.0',
		stageOutcomes: {},
		state: 'partial',
		subject: { subjectId: 'subject:synthetic-command' }
	} as unknown as GuardClassificationOverlayReportOutcome;
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

describe('guard-classification overlay command adapter', () => {
	it('awaits one report and separates progress JSONL from the one terminal envelope', async () => {
		const progress: string[] = [];
		const terminal: string[] = [];
		let release!: (outcome: GuardClassificationOverlayReportOutcome) => void;
		const deferred = new Promise<GuardClassificationOverlayReportOutcome>((resolve) => {
			release = resolve;
		});
		const runReport = (async (
			_request: unknown,
			options: Parameters<typeof runGuardClassificationOverlayReport>[1]
		) => {
			options.onProgress?.(progressEvent());
			return deferred;
		}) as typeof runGuardClassificationOverlayReport;
		let settled = false;
		const running = runGuardClassificationOverlayCommand(
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
				evidence: { overlay: { classifications: [{ guardText: 'synthetic guard' }] } }
			}
		});
	});

	it('contains terminal serialization and synchronous or asynchronous sink failures', async () => {
		const runReport = (async () => partial()) as typeof runGuardClassificationOverlayReport;
		const options = {
			repositoryRoot: REPOSITORY_ROOT,
			runReport,
			writeProgress: () => undefined
		};

		expect(
			await runGuardClassificationOverlayCommand(
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
			await runGuardClassificationOverlayCommand(
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
			await runGuardClassificationOverlayCommand(
				{},
				{
					...options,
					runReport: (async () => cyclic) as unknown as typeof runGuardClassificationOverlayReport,
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
			'bun scripts/csaa-guard-classification-overlay.ts'
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

		const root = mkdtempSync(join(tmpdir(), 'csaa-guard-classification-overlay-command-'));
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

	it.runIf(process.env.CSAA_GUARD_CLASSIFICATION_OVERLAY_REPORT_INTEGRATION === '1')(
		'runs the production dependencies with one terminal envelope and exact retained witnesses',
		() => {
			const result = spawnSync('bun', [SCRIPT, '--stdin'], {
				cwd: REPOSITORY_ROOT,
				encoding: 'utf8',
				input: JSON.stringify({
					budgets: GUARD_CLASSIFICATION_OVERLAY_REPORT_SAFETY_CEILINGS,
					executionSelection: GUARD_CLASSIFICATION_OVERLAY_REPORT_EXECUTION_SELECTION,
					operationVersion: GUARD_CLASSIFICATION_OVERLAY_REPORT_OPERATION_VERSION,
					schemaVersion: GUARD_CLASSIFICATION_OVERLAY_REPORT_REQUEST_SCHEMA_VERSION,
					subjectProjectConfigPaths: GUARD_CLASSIFICATION_OVERLAY_REPORT_PROJECT_CONFIG_PATHS
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
							anchorSites: readonly unknown[];
							classifications: readonly unknown[];
							commandEvidenceLinks: readonly unknown[];
							frontiers: readonly { readonly frontierKind: string }[];
							handlerLinks: readonly unknown[];
							occurrences: readonly unknown[];
						};
					};
				};
			};
			expect(result.status, terminalLines[0]).toBe(3);
			expect(terminal.outcome).toBe('partial');
			expect(terminal.result.coverage).toMatchObject({
				anchorSites: 14,
				candidateFactoryHandlerLinks: 1,
				classifications: 82,
				commandEvidenceLinks: 115,
				directHandlerLinks: 11,
				frontiers: 39,
				helperFrontiers: 4,
				noCommandEvidenceFrontiers: 34,
				occurrences: 146,
				reconciles: true,
				stateEvidenceRefs: 148
			});
			expect(terminal.result.evidence.overlay.anchorSites).toHaveLength(14);
			expect(terminal.result.evidence.overlay.classifications).toHaveLength(82);
			expect(terminal.result.evidence.overlay.commandEvidenceLinks).toHaveLength(115);
			expect(terminal.result.evidence.overlay.handlerLinks).toHaveLength(12);
			expect(terminal.result.evidence.overlay.occurrences).toHaveLength(146);
			expect(terminal.result.evidence.overlay.frontiers).toHaveLength(39);
			const frontierCounts: Record<string, number> = {};
			for (const frontier of terminal.result.evidence.overlay.frontiers)
				frontierCounts[frontier.frontierKind] = (frontierCounts[frontier.frontierKind] ?? 0) + 1;
			expect(frontierCounts).toEqual({
				FACTORY_HANDLER_ATTRIBUTION_CANDIDATE: 1,
				HELPER_CALL_FLOW_UNRESOLVED: 4,
				NO_RETAINED_DECLARED_ARROW_EVIDENCE: 34
			});

			const progress = result.stderr
				.split('\n')
				.filter(Boolean)
				.map((line) => JSON.parse(line) as { kind?: string; phase?: string; state?: string });
			expect(progress.some((event) => event.kind === 'PREDECESSOR_REPORT')).toBe(true);
			for (const phase of [
				'REQUEST_BIND',
				'PREDECESSOR_PIPELINE',
				'GUARD_ARTIFACT_SET',
				'GUARD_ENFORCEMENT_LEDGER',
				'STATE_TOPOLOGY_OBSERVATION',
				'STATE_MACHINE_GRAPH',
				'GUARD_CLASSIFICATION_OVERLAY',
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
