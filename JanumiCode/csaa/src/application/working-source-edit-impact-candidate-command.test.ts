import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION,
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION,
	WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_SEED_SCHEMA_VERSION
} from '../contracts/working-source-edit-impact-candidate-report.js';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const SCRIPT = fileURLToPath(
	new URL('../../../../scripts/csaa-working-source-edit-impact-candidates.ts', import.meta.url)
);

function run(args: readonly string[], input?: string | Uint8Array) {
	return spawnSync('bun', [SCRIPT, ...args], {
		cwd: REPOSITORY_ROOT,
		encoding: 'utf8',
		input,
		timeout: 30_000,
		windowsHide: true
	});
}

function headOid(): string {
	const result = spawnSync('git', ['rev-parse', '--verify', 'HEAD^{commit}'], {
		cwd: REPOSITORY_ROOT,
		encoding: 'utf8',
		windowsHide: true
	});
	if (result.status !== 0) throw new Error('Unable to resolve fixture HEAD.');
	return result.stdout.trim();
}

function unchangedSourceRequest(): string {
	return JSON.stringify({
		budgets: {
			maxResultBytes: 32 * 1024 * 1024,
			observation: {
				maxGitMetadataBytes: 1024 * 1024,
				maxGitOperationDurationMs: 30_000,
				maxPathCharacters: 4_096,
				maxSourceBytes: 8 * 1024 * 1024
			},
			staticImpact: {
				maxCandidateWitnessHops: 16_000,
				maxResultBytes: 16 * 1024 * 1024,
				reachability: {
					maxDiagnostics: 1_000,
					maxEdges: 10_000,
					maxFrontierRecords: 10_000,
					maxInputRecords: 1_000_000,
					maxInputStringCharacters: 10_000_000,
					maxNodes: 10_000,
					maxReachableNodes: 10_000,
					maxTraversalSteps: 20_000,
					maxWitnessEdges: 10_000
				},
				semantic: {
					maxAstDepth: 256,
					maxAstNodes: 100_000,
					maxCompilerFacts: 100_000,
					maxCompilerInputMetadataBytes: 16 * 1024 * 1024,
					maxCompilerQueries: 100_000,
					maxCompilerQueryInvocations: 1_000_000,
					maxContextBytes: 32 * 1024 * 1024,
					maxContextFileBytes: 8 * 1024 * 1024,
					maxContextFiles: 10_000,
					maxDiagnosticCharacters: 1_000_000,
					maxDiagnostics: 10_000,
					maxDirectoryEntries: 1_000_000,
					maxDurationMs: 60_000,
					maxLiteralCharacters: 10_000,
					maxPathCharacters: 2_000,
					maxProjects: 10,
					maxScopes: 100_000,
					maxSnapshotBytes: 64 * 1024 * 1024,
					maxSources: 10_000
				},
				subject: {
					maxBytes: 32 * 1024 * 1024,
					maxConfigDepth: 32,
					maxDiagnostics: 1_000,
					maxDurationMs: 30_000,
					maxFiles: 10_000,
					maxProjects: 10
				}
			}
		},
		immutableBaseCommitOid: headOid(),
		operationVersion: WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_OPERATION_VERSION,
		schemaVersion: WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_REPORT_REQUEST_SCHEMA_VERSION,
		seed: {
			id: 'seed:adapter-unchanged',
			logicalPath: 'packages/csaa/src/contracts/arrow-command-census.ts',
			operation: 'EDIT',
			projectConfigPath: 'packages/csaa/tsconfig.json',
			schemaVersion: WORKING_SOURCE_EDIT_IMPACT_CANDIDATE_SEED_SCHEMA_VERSION,
			scope: 'WHOLE_SOURCE'
		},
		subjectProjectConfigPaths: ['packages/csaa/tsconfig.json']
	});
}

describe('working-source-edit impact-candidate command adapter', () => {
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

	it('keeps malformed JSON and malformed UTF-8 off stdout', () => {
		for (const input of ['{not json', Buffer.from([0xc3, 0x28])] as const) {
			const result = run(['--stdin'], input);
			expect(result.status).toBe(2);
			expect(result.stdout).toBe('');
			expect(JSON.parse(result.stderr)).toMatchObject({ error: 'request-input-invalid' });
		}
	});

	it('emits one terminal refusal envelope for an unchanged selected source', () => {
		const result = run(['--stdin'], unchangedSourceRequest());
		expect(result.status).toBe(2);
		expect(result.stdout.split('\n').filter(Boolean)).toHaveLength(1);
		expect(JSON.parse(result.stdout)).toMatchObject({
			outcome: 'unavailable',
			state: 'incompatible'
		});
		expect(result.stderr).not.toContain(REPOSITORY_ROOT);
		expect(result.stderr).not.toContain(REPOSITORY_ROOT.replaceAll('\\', '/'));
	});

	it('bounds request-file reads before parsing', () => {
		const root = mkdtempSync(join(tmpdir(), 'csaa-working-edit-command-'));
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

	it.runIf(process.platform !== 'win32')('refuses a request FIFO without blocking on open', () => {
		const root = mkdtempSync(join(tmpdir(), 'csaa-working-edit-command-fifo-'));
		const requestPath = join(root, 'request.pipe');
		try {
			const made = spawnSync('mkfifo', [requestPath], { encoding: 'utf8' });
			expect(made.status).toBe(0);
			const result = run(['--request', requestPath]);
			expect(result.error).toBeUndefined();
			expect(result.status).toBe(2);
			expect(result.stdout).toBe('');
			expect(JSON.parse(result.stderr)).toEqual({
				error: 'request-input-invalid',
				message: 'The request path must identify a regular non-symlink file.'
			});
		} finally {
			rmSync(root, { force: true, recursive: true });
		}
	});
});
