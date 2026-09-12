import { spawnSync } from 'node:child_process';
import { Buffer } from 'node:buffer';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { ArrowCommandCensusReportOutcome } from '../contracts/arrow-command-census-report.js';
import { runArrowCommandCensusCommand } from './run-arrow-command-census-command.js';
import {
	ARROW_COMMAND_CENSUS_REPORT_PROGRESS_NONCLAIMS,
	type ArrowCommandCensusReportProgressEvent,
	type RunArrowCommandCensusReportOptions,
	type runArrowCommandCensusReport
} from './run-arrow-command-census-report.js';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const SCRIPT = fileURLToPath(
	new URL('../../../../scripts/csaa-arrow-command-census.ts', import.meta.url)
);
const PACKAGE_SCRIPT = 'csaa:analyze:arrow-command-census';

function progressEvent(): ArrowCommandCensusReportProgressEvent {
	return {
		adapterProgress: null,
		deliverySemantics: 'SYNCHRONOUS_TRUSTED_HOST_CALLBACK',
		detailCode: 'SYNTHETIC',
		elapsedMs: 0,
		kind: 'REPORT_STAGE',
		nonclaims: ARROW_COMMAND_CENSUS_REPORT_PROGRESS_NONCLAIMS,
		observations: [],
		operationVersion: 'jan-csaa-report-arrow-command-census/0.1.0',
		phase: 'RESULT',
		protocolRole: 'PRELIMINARY_ARROW_COMMAND_CENSUS_REPORT_TELEMETRY',
		reportIdentityEffect: 'EXCLUDED_FROM_REPORT_IDENTITY',
		schemaVersion: 'jan-csaa-arrow-command-census-report-progress/0.1.0',
		sequence: 1,
		stage: 'RESULT',
		state: 'COMPLETED',
		wallClockBudgetEffect: 'CALLBACK_TIME_MAY_CONSUME_ACTIVE_DURATION_BUDGET'
	};
}

function nonemptyPartial(): ArrowCommandCensusReportOutcome {
	return {
		analysisAuthority: 'NONE',
		authorityTransfer: 'NONE',
		diagnostics: [],
		gateEffect: 'NONE',
		operationVersion: 'jan-csaa-report-arrow-command-census/0.1.0',
		outcome: 'partial',
		request: { synthetic: true },
		result: {
			evidence: {
				observation: {
					declaredArrows: [{ from: 'A0', machine: 'Alpha', to: 'A1' }],
					declaredSites: [{ source: { locator: 'execution.ts:1' } }]
				}
			}
		},
		schemaVersion: 'jan-csaa-arrow-command-census-report/0.1.0',
		stageOutcomes: {},
		state: 'partial',
		subject: { subjectId: 'subject:synthetic-command' }
	} as unknown as ArrowCommandCensusReportOutcome;
}

describe('arrow-command-census command adapter', () => {
	it('awaits one nonempty report and keeps progress and terminal JSONL on separate streams', async () => {
		const progress: string[] = [];
		const terminal: string[] = [];
		let release!: (outcome: ArrowCommandCensusReportOutcome) => void;
		const deferred = new Promise<ArrowCommandCensusReportOutcome>((resolve) => {
			release = resolve;
		});
		const runReport = (async (_request: unknown, options: RunArrowCommandCensusReportOptions) => {
			options.onProgress?.(progressEvent());
			return deferred;
		}) as typeof runArrowCommandCensusReport;
		let settled = false;
		const running = runArrowCommandCensusCommand(
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
				evidence: { observation: { declaredArrows: [{ machine: 'Alpha' }] } }
			}
		});
	});

	it('pins the package command to the bounded executable', () => {
		const manifest = JSON.parse(readFileSync(`${REPOSITORY_ROOT}/package.json`, 'utf8')) as {
			scripts: Record<string, string>;
		};
		expect(manifest.scripts[PACKAGE_SCRIPT]).toBe('bun scripts/csaa-arrow-command-census.ts');
	});

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
		const root = mkdtempSync(join(tmpdir(), 'csaa-arrow-command-census-command-'));
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
