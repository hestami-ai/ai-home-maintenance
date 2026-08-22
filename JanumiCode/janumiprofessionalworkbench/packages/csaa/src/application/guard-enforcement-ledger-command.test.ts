import { spawnSync } from 'node:child_process';
import { Buffer } from 'node:buffer';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
	GUARD_ENFORCEMENT_LEDGER_REPORT_EXECUTION_SELECTION,
	GUARD_ENFORCEMENT_LEDGER_REPORT_OPERATION_VERSION,
	GUARD_ENFORCEMENT_LEDGER_REPORT_REQUEST_SCHEMA_VERSION,
	GUARD_ENFORCEMENT_LEDGER_REPORT_SAFETY_CEILINGS,
	type GuardEnforcementLedgerReportOutcome
} from '../contracts/guard-enforcement-ledger-report.js';
import { runGuardEnforcementLedgerCommand } from './run-guard-enforcement-ledger-command.js';
import {
	GUARD_ENFORCEMENT_LEDGER_REPORT_PROGRESS_NONCLAIMS,
	type GuardEnforcementLedgerReportProgressEvent,
	type RunGuardEnforcementLedgerReportOptions,
	type runGuardEnforcementLedgerReport
} from './run-guard-enforcement-ledger-report.js';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const SCRIPT = fileURLToPath(
	new URL('../../../../scripts/csaa-guard-enforcement-ledger.ts', import.meta.url)
);
const PACKAGE_SCRIPT = 'csaa:analyze:guard-enforcement-ledger';

function progressEvent(): GuardEnforcementLedgerReportProgressEvent {
	return {
		adapterProgress: null,
		deliverySemantics: 'SYNCHRONOUS_TRUSTED_HOST_CALLBACK',
		detailCode: 'SYNTHETIC',
		elapsedMs: 0,
		kind: 'REPORT_STAGE',
		nonclaims: GUARD_ENFORCEMENT_LEDGER_REPORT_PROGRESS_NONCLAIMS,
		observations: [],
		operationVersion: 'jan-csaa-report-guard-enforcement-ledger/0.1.0',
		phase: 'RESULT',
		protocolRole: 'PRELIMINARY_GUARD_ENFORCEMENT_LEDGER_REPORT_TELEMETRY',
		reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY',
		schemaVersion: 'jan-csaa-guard-enforcement-ledger-report-progress/0.1.0',
		sequence: 1,
		stage: 'RESULT',
		state: 'COMPLETED',
		wallClockBudgetEffect: 'CALLBACK_TIME_MAY_CONSUME_ACTIVE_DURATION_BUDGET'
	};
}

function nonemptyPartial(): GuardEnforcementLedgerReportOutcome {
	return {
		analysisAuthority: 'NONE',
		authorityTransfer: 'NONE',
		diagnostics: [],
		gateEffect: 'NONE',
		operationVersion: 'jan-csaa-report-guard-enforcement-ledger/0.1.0',
		outcome: 'partial',
		request: { synthetic: true },
		result: {
			evidence: {
				observation: {
					guardedArrows: [{ from: 'A0', guardText: 'guard a', machine: 'Alpha', to: 'A1' }],
					guards: [{ guardText: 'guard a', ledgerState: 'CLASSIFIED' }]
				}
			}
		},
		schemaVersion: 'jan-csaa-guard-enforcement-ledger-report/0.1.0',
		stageOutcomes: {},
		state: 'partial',
		subject: { subjectId: 'subject:synthetic-command' }
	} as unknown as GuardEnforcementLedgerReportOutcome;
}

describe('guard-enforcement-ledger command adapter', () => {
	it('awaits one nonempty report and keeps progress and terminal JSONL on separate streams', async () => {
		const progress: string[] = [];
		const terminal: string[] = [];
		let release!: (outcome: GuardEnforcementLedgerReportOutcome) => void;
		const deferred = new Promise<GuardEnforcementLedgerReportOutcome>((resolve) => {
			release = resolve;
		});
		const runReport = (async (
			_request: unknown,
			options: RunGuardEnforcementLedgerReportOptions
		) => {
			options.onProgress?.(progressEvent());
			return deferred;
		}) as typeof runGuardEnforcementLedgerReport;
		let settled = false;
		const running = runGuardEnforcementLedgerCommand(
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
		release(nonemptyPartial());
		expect(await running).toBe(3);
		expect(progress).toHaveLength(1);
		expect(JSON.parse(progress[0]!)).toMatchObject({ detailCode: 'SYNTHETIC' });
		expect(terminal).toHaveLength(1);
		expect(terminal[0]!.endsWith('\n')).toBe(true);
		expect(JSON.parse(terminal[0]!)).toMatchObject({
			outcome: 'partial',
			result: {
				evidence: { observation: { guardedArrows: [{ machine: 'Alpha' }] } }
			}
		});
	});

	it('pins the package command to the bounded executable', () => {
		const manifest = JSON.parse(readFileSync(`${REPOSITORY_ROOT}/package.json`, 'utf8')) as {
			scripts: Record<string, string>;
		};
		expect(manifest.scripts[PACKAGE_SCRIPT]).toBe('bun scripts/csaa-guard-enforcement-ledger.ts');
	});

	it.runIf(process.env.CSAA_GUARD_ENFORCEMENT_LEDGER_REPORT_INTEGRATION === '1')(
		'runs one admitted nonempty request through the executable framing',
		() => {
			const result = spawnSync('bun', [SCRIPT, '--stdin'], {
				cwd: REPOSITORY_ROOT,
				encoding: 'utf8',
				input: JSON.stringify({
					budgets: GUARD_ENFORCEMENT_LEDGER_REPORT_SAFETY_CEILINGS,
					executionSelection: GUARD_ENFORCEMENT_LEDGER_REPORT_EXECUTION_SELECTION,
					operationVersion: GUARD_ENFORCEMENT_LEDGER_REPORT_OPERATION_VERSION,
					schemaVersion: GUARD_ENFORCEMENT_LEDGER_REPORT_REQUEST_SCHEMA_VERSION,
					subjectProjectConfigPaths: [
						'packages/rph-application/tsconfig.json',
						'packages/rph-contracts/tsconfig.json',
						'packages/rph-domain/tsconfig.json'
					]
				}),
				maxBuffer: 128 * 1024 * 1024,
				timeout: 600_000,
				windowsHide: true
			});
			expect(result.status, result.stderr).toBe(3);
			const terminalLines = result.stdout.split('\n').filter(Boolean);
			expect(terminalLines).toHaveLength(1);
			const terminal = JSON.parse(terminalLines[0]!);
			expect(terminal).toMatchObject({
				outcome: 'partial',
				result: {
					coverage: { classifiedGuardTexts: expect.any(Number), reconciles: true },
					evidence: { observation: { guardedArrows: expect.any(Array), guards: expect.any(Array) } }
				}
			});
			expect(terminal.result.coverage.classifiedGuardTexts).toBeGreaterThan(0);
			expect(terminal.result.evidence.observation.guardedArrows.length).toBeGreaterThan(0);
			expect(terminal.result.evidence.observation.guards.length).toBeGreaterThan(0);
			const progress = result.stderr
				.split('\n')
				.filter(Boolean)
				.map((line) => JSON.parse(line) as { kind?: string; phase?: string; state?: string });
			expect(progress.some((event) => event.kind === 'RETAINED_ADAPTER')).toBe(true);
			expect(progress).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ phase: 'REQUEST_BIND', state: 'STARTED' }),
					expect.objectContaining({ phase: 'RESULT', state: 'COMPLETED' })
				])
			);
		},
		600_000
	);

	it.each([
		{ args: [] },
		{ args: ['--unknown'] },
		{ args: ['--request'] },
		{ args: ['--stdin', '--stdin'] },
		{ args: ['--request', 'one.json', '--stdin'] }
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

	it('rejects request inputs larger than one MiB without entering the report', () => {
		const result = spawnSync('bun', [SCRIPT, '--stdin'], {
			cwd: REPOSITORY_ROOT,
			encoding: 'utf8',
			input: 'x'.repeat(1024 * 1024 + 1),
			windowsHide: true
		});
		expect(result.status).toBe(2);
		expect(result.stdout).toBe('');
		expect(JSON.parse(result.stderr)).toEqual({
			error: 'request-input-invalid',
			message: 'Request input exceeds 1 MiB.'
		});
	});

	it('bounds and validates request-file input before report execution', () => {
		const root = mkdtempSync(join(tmpdir(), 'csaa-guard-enforcement-ledger-command-'));
		try {
			const requestPath = join(root, 'request.json');
			writeFileSync(requestPath, '{}', 'utf8');
			const fromFile = spawnSync('bun', [SCRIPT, '--request', requestPath], {
				cwd: REPOSITORY_ROOT,
				encoding: 'utf8',
				windowsHide: true
			});
			expect(fromFile.status, fromFile.stderr).toBe(2);
			expect(JSON.parse(fromFile.stdout)).toMatchObject({ code: 'REQUEST_SHAPE_INVALID' });

			const malformedPath = join(root, 'malformed.json');
			writeFileSync(malformedPath, '{not json', 'utf8');
			const malformed = spawnSync('bun', [SCRIPT, '--request', malformedPath], {
				cwd: REPOSITORY_ROOT,
				encoding: 'utf8',
				windowsHide: true
			});
			expect(malformed.status).toBe(2);
			expect(malformed.stdout).toBe('');
			expect(JSON.parse(malformed.stderr)).toMatchObject({
				error: 'request-input-invalid',
				message: 'Request input is not valid JSON.'
			});

			const exactMiBPath = join(root, 'exact-mib.json');
			writeFileSync(exactMiBPath, Buffer.alloc(1024 * 1024, 0x20));
			const exactMiB = spawnSync('bun', [SCRIPT, '--request', exactMiBPath], {
				cwd: REPOSITORY_ROOT,
				encoding: 'utf8',
				windowsHide: true
			});
			expect(exactMiB.status).toBe(2);
			expect(JSON.parse(exactMiB.stderr)).toMatchObject({
				error: 'request-input-invalid',
				message: 'Request input is not valid JSON.'
			});

			const overMiBPath = join(root, 'over-mib.json');
			writeFileSync(overMiBPath, Buffer.alloc(1024 * 1024 + 1, 0x20));
			const overMiB = spawnSync('bun', [SCRIPT, '--request', overMiBPath], {
				cwd: REPOSITORY_ROOT,
				encoding: 'utf8',
				windowsHide: true
			});
			expect(overMiB.status).toBe(2);
			expect(JSON.parse(overMiB.stderr)).toMatchObject({
				error: 'request-input-invalid',
				message: 'Request input exceeds 1 MiB.'
			});

			const directory = spawnSync('bun', [SCRIPT, '--request', root], {
				cwd: REPOSITORY_ROOT,
				encoding: 'utf8',
				windowsHide: true
			});
			expect(directory.status).toBe(2);
			expect(JSON.parse(directory.stderr)).toMatchObject({
				error: 'request-input-invalid',
				message: 'The request path must identify a regular file.'
			});
		} finally {
			rmSync(root, { force: true, recursive: true });
		}
	});
});
