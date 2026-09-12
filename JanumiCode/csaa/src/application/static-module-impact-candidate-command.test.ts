import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	STATIC_MODULE_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION,
	STATIC_MODULE_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION,
	STATIC_MODULE_IMPACT_CANDIDATE_SEED_SCHEMA_VERSION
} from '../contracts/static-module-impact-candidate-report.js';
import {
	STRUCTURAL_MODULE_REACHABILITY_REPORT_PROGRESS_NONCLAIMS,
	STRUCTURAL_MODULE_REACHABILITY_REPORT_PROGRESS_SCHEMA_VERSION
} from './run-structural-module-reachability-report.js';
import { STRUCTURAL_MODULE_REACHABILITY_PROGRESS_TRANSPORT_SCHEMA_VERSION } from './structural-module-reachability-progress-jsonl.js';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const SCRIPT = fileURLToPath(
	new URL('../../../../scripts/csaa-static-module-impact-candidates.ts', import.meta.url)
);

function run(args: readonly string[], input?: string | Uint8Array) {
	return spawnSync('bun', [SCRIPT, ...args], {
		cwd: REPOSITORY_ROOT,
		encoding: 'utf8',
		input,
		windowsHide: true
	});
}

function predecessorRefusalRequest(): string {
	return JSON.stringify({
		budgets: {
			maxCandidateWitnessHops: 1,
			maxResultBytes: 1,
			reachability: {},
			semantic: {},
			subject: {}
		},
		operationVersion: STATIC_MODULE_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION,
		schemaVersion: STATIC_MODULE_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION,
		seed: {
			basis: 'CALLER_DECLARED_WORKING_CHANGE_SET',
			expectedArtifactSha256: '0'.repeat(64),
			id: 'seed:adapter',
			logicalPath: 'packages/csaa/src/index.ts',
			operation: 'EDIT',
			projectConfigPath: 'packages/csaa/tsconfig.json',
			schemaVersion: STATIC_MODULE_IMPACT_CANDIDATE_SEED_SCHEMA_VERSION,
			scope: 'WHOLE_SOURCE',
			workingChangeSetId: 'working-change:adapter'
		},
		subjectProjectConfigPaths: ['packages/csaa/tsconfig.json']
	});
}

describe('static module impact-candidate command adapter', () => {
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

	it('keeps malformed stdin off stdout', () => {
		const result = run(['--stdin'], '{not json');
		expect(result.status).toBe(2);
		expect(result.stdout).toBe('');
		expect(JSON.parse(result.stderr)).toEqual({
			error: 'request-input-invalid',
			message: 'Request input is not valid JSON.'
		});
	});

	it('rejects malformed UTF-8 bytes from stdin without leaking input details', () => {
		const result = run(['--stdin'], Buffer.from([0xc3, 0x28]));
		expect(result.status).toBe(2);
		expect(result.stdout).toBe('');
		expect(JSON.parse(result.stderr)).toEqual({
			error: 'request-input-invalid',
			message: 'Request input is not valid UTF-8.'
		});
	});

	it('keeps predecessor progress on stderr and one terminal envelope on stdout', () => {
		const result = run(['--stdin'], predecessorRefusalRequest());
		expect(result.status).toBe(2);
		expect(result.stdout.split('\n').filter(Boolean)).toHaveLength(1);
		expect(JSON.parse(result.stdout)).toMatchObject({
			code: 'REQUEST_SHAPE_INVALID',
			outcome: 'unavailable',
			stage: 'PREDECESSOR_REPORT',
			state: 'incompatible'
		});
		const progress = result.stderr
			.split('\n')
			.filter(Boolean)
			.map((line) => JSON.parse(line) as Record<string, unknown>);
		expect(progress).toHaveLength(2);
		const admittedSchemas = new Set<string>([
			STRUCTURAL_MODULE_REACHABILITY_REPORT_PROGRESS_SCHEMA_VERSION,
			STRUCTURAL_MODULE_REACHABILITY_PROGRESS_TRANSPORT_SCHEMA_VERSION
		]);
		expect(progress.every((event) => admittedSchemas.has(String(event.schemaVersion)))).toBe(true);
		expect(
			progress.every(
				(event) =>
					event.deliverySemantics === 'SYNCHRONOUS_TRUSTED_HOST_CALLBACK' &&
					event.protocolRole === 'PRELIMINARY_CAP_027_REPORT_TELEMETRY' &&
					event.reportIdentityEffect === 'EXCLUDED_FROM_REPORT_IDENTITY' &&
					JSON.stringify(event.nonclaims) ===
						JSON.stringify(STRUCTURAL_MODULE_REACHABILITY_REPORT_PROGRESS_NONCLAIMS)
			)
		).toBe(true);
		expect(result.stderr).not.toContain(REPOSITORY_ROOT);
		expect(result.stderr).not.toContain(REPOSITORY_ROOT.replaceAll('\\', '/'));
	});

	it('bounds request-file reads before parsing', () => {
		const root = mkdtempSync(join(tmpdir(), 'csaa-static-impact-command-'));
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

	it('rejects malformed UTF-8 bytes from a request file without leaking its path', () => {
		const root = mkdtempSync(join(tmpdir(), 'csaa-static-impact-command-'));
		const requestPath = join(root, 'malformed-utf8.json');
		try {
			writeFileSync(requestPath, Buffer.from([0xc3, 0x28]));
			const result = run(['--request', requestPath]);
			expect(result.status).toBe(2);
			expect(result.stdout).toBe('');
			expect(JSON.parse(result.stderr)).toEqual({
				error: 'request-input-invalid',
				message: 'Request input is not valid UTF-8.'
			});
			expect(result.stderr).not.toContain(requestPath);
		} finally {
			rmSync(root, { force: true, recursive: true });
		}
	});
});
