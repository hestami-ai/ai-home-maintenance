import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { canonicalSemanticJson } from '../semantic/canonical.js';
import {
	DWP_007_PERSISTENCE_SELECTION_CRITERIA,
	DWP_007_PERSISTENCE_SELECTION_EVIDENCE_SCHEMA_VERSION,
	DWP_007_PERSISTENCE_SELECTION_NONCLAIMS,
	DWP_007_PERSISTENCE_SELECTION_OPERATION_VERSION,
	DWP_007_PERSISTENCE_SELECTION_POLICY,
	dwp007PersistenceSelectionImplementationSourceDigest,
	type Dwp007PersistenceSelectionEvidence,
	type MeasureDwp007PersistenceSelectionOptions
} from './assess-dwp-007-persistence-selection.js';
import {
	runDwp007PersistenceSelectionCommand,
	runDwp007PersistenceSelectionMain,
	type Dwp007PersistenceSelectionCommandContext
} from './run-dwp-007-persistence-selection.js';

const temporaryRoots: string[] = [];
const IMPLEMENTATION_SOURCE_PATHS = Object.freeze([
	'bun.lock',
	'packages/csaa/package.json',
	'packages/csaa/src/persistence/assess-dwp-007-persistence-selection.ts',
	'packages/csaa/src/persistence/content-addressed-file-store.ts',
	'packages/csaa/src/persistence/run-dwp-007-persistence-selection.ts'
]);
const EVIDENCE_PATH = 'verif/csaa/dwp-007.persistence-selection.evidence.json';

function write(root: string, path: string, contents: string): void {
	const absolute = join(root, ...path.split('/'));
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, contents, 'utf8');
}

function repositoryFixture(): string {
	const root = mkdtempSync(join(tmpdir(), 'csaa-dwp-007-runner-'));
	temporaryRoots.push(root);
	write(root, 'bun.lock', 'fixture-lock\n');
	write(root, 'packages/csaa/package.json', '{"name":"@fixture/csaa","private":true}\n');
	write(
		root,
		'packages/csaa/src/persistence/assess-dwp-007-persistence-selection.ts',
		'export const assessment = true;\n'
	);
	write(
		root,
		'packages/csaa/src/persistence/content-addressed-file-store.ts',
		'export const store = true;\n'
	);
	write(
		root,
		'packages/csaa/src/persistence/run-dwp-007-persistence-selection.ts',
		'export const runner = true;\n'
	);
	write(root, 'node_modules/better-sqlite3/package.json', '{"version":"12.11.1"}\n');
	write(root, 'node_modules/better-sqlite3/lib/index.js', 'module.exports = {};\n');
	mkdirSync(resolve(root, 'verif/csaa'), { recursive: true });
	return root;
}

function evidenceFor(
	options: MeasureDwp007PersistenceSelectionOptions
): Dwp007PersistenceSelectionEvidence {
	const passProcess = Object.freeze({
		completed: true,
		exitCode: 0,
		outcome: 'PASS' as const,
		stderrSha256: 'c'.repeat(64),
		stdoutSha256: 'd'.repeat(64)
	});
	const failedProcess = Object.freeze({
		completed: false,
		exitCode: 0,
		outcome: 'FAIL_NO_COMPLETION_RECORD' as const,
		stderrSha256: 'e'.repeat(64),
		stdoutSha256: 'f'.repeat(64)
	});
	return Object.freeze({
		analysisAuthority: 'NONE',
		candidates: Object.freeze({
			contentAddressedFiles: Object.freeze({
				backend: 'CONTENT_ADDRESSED_FILES',
				controls: Object.freeze({
					activeHostCompatibility: 'PASS_MEASURED_BUN_WINDOWS',
					atomicPublicationOrRollback: 'PASS',
					cancellationPreservesCurrent: 'PASS',
					concurrentReaderIsolation: 'PASS',
					concurrentWriterExclusion: 'PASS',
					identityCheckedIncrementalReuse: 'PASS',
					rebuildableNonAuthoritativeCache: 'PASS',
					schemaEvolution: 'PASS_REBUILD_ON_UNKNOWN_SCHEMA'
				}),
				eligible: true,
				implementationStatus: 'IMPLEMENTED_BEHIND_CSAA_STORE_CONTRACT',
				probe: Object.freeze({
					baselineGenerationId: '1'.repeat(64),
					cancellationPreservedGeneration: true,
					cleanEquivalenceVerified: true,
					concurrentReaderIsolation: true,
					concurrentWriterExclusion: true,
					exactReuse: true,
					rebuildOnUnknownSchema: true,
					reusedGenerationId: '2'.repeat(64),
					startupMedianMs: 2,
					startupSamplesMs: Object.freeze([3, 1, 2]),
					updatedGenerationId: '2'.repeat(64)
				})
			}),
			sqliteBetterSqlite3: Object.freeze({
				backend: 'SQLITE_BETTER_SQLITE3',
				controls: Object.freeze({
					activeHostCompatibility: 'FAIL_MEASURED_BUN_WINDOWS',
					atomicPublicationOrRollback: 'PASS_NODE_SPIKE',
					cancellationPreservesCurrent: 'NOT_IMPLEMENTED_NO_CSAA_ADAPTER',
					concurrentReaderIsolation: 'PASS_NODE_WAL_SPIKE',
					concurrentWriterExclusion: 'PASS_NODE_TRANSACTION_SPIKE',
					identityCheckedIncrementalReuse: 'NOT_IMPLEMENTED_NO_CSAA_ADAPTER',
					rebuildableNonAuthoritativeCache: 'NOT_IMPLEMENTED_NO_CSAA_ADAPTER',
					schemaEvolution: 'PASS_NODE_TRANSACTIONAL_MIGRATION_SPIKE'
				}),
				eligible: false,
				implementationStatus: 'MEASURED_SPIKE_ONLY_NOT_A_CSAA_STORE',
				probe: Object.freeze({
					bunBetterSqlite3: failedProcess,
					bunBuiltInControl: passProcess,
					node: Object.freeze({
						concurrentReaderIsolation: true,
						migrationRollback: true,
						nodeVersion: process.version,
						startupMedianMs: 5,
						startupSamplesMs: Object.freeze([6, 4, 5]),
						transactionRollback: true
					})
				})
			})
		}),
		criteria: DWP_007_PERSISTENCE_SELECTION_CRITERIA,
		environment: Object.freeze({
			...options.environment,
			betterSqlite3Version: options.betterSqlite3Version,
			nodeVersion: process.version
		}),
		gateEffect: 'NONE',
		implementationSourceDigest: dwp007PersistenceSelectionImplementationSourceDigest(
			options.implementationSources
		),
		implementationSources: Object.freeze(
			options.implementationSources.map((source) => Object.freeze({ ...source }))
		),
		nonclaims: DWP_007_PERSISTENCE_SELECTION_NONCLAIMS,
		operationVersion: DWP_007_PERSISTENCE_SELECTION_OPERATION_VERSION,
		policy: DWP_007_PERSISTENCE_SELECTION_POLICY,
		recordedAt: '2026-08-25T00:00:00.000Z',
		schemaVersion: DWP_007_PERSISTENCE_SELECTION_EVIDENCE_SCHEMA_VERSION,
		selection: Object.freeze({
			acceptance: 'TECHNICAL_ACCEPTANCE_SATISFIED_WITHOUT_SLO',
			reasons: Object.freeze([
				'SELECTED_BACKEND_PASSES_EVERY_REQUIRED_CRITERION',
				'BETTER_SQLITE3_IS_NOT_A_BUN_WINDOWS_SAFE_IMPLEMENTED_CSAA_STORE',
				'BUN_SQLITE_BUILTIN_WOULD_REQUIRE_A_DIFFERENT_UNIMPLEMENTED_ADAPTER',
				'REUSING_THE_VALIDATED_FILE_STORE_AVOIDS_SEMANTIC_AND_MIGRATION_RISK'
			] as const),
			selectedBackend: 'CONTENT_ADDRESSED_FILES',
			technicalReuseVerdict: 'SELECT_IMPLEMENTED_CONTENT_ADDRESSED_FILE_STORE'
		})
	});
}

function context(
	root: string,
	argv: readonly string[],
	overrides: Partial<Dwp007PersistenceSelectionCommandContext> = {}
): Dwp007PersistenceSelectionCommandContext {
	return {
		architecture: process.arch,
		argv,
		bunExecutable: process.execPath,
		bunVersion: '1.3.14',
		measure: evidenceFor,
		nodeExecutable: process.execPath,
		platform: 'win32',
		repositoryRoot: root,
		...overrides
	};
}

function execute(contextValue: Dwp007PersistenceSelectionCommandContext): {
	readonly exitCodes: readonly number[];
	readonly stderr: string;
	readonly stdout: string;
} {
	const exitCodes: number[] = [];
	let stderr = '';
	let stdout = '';
	runDwp007PersistenceSelectionMain(contextValue, {
		setExitCode: (value) => exitCodes.push(value),
		stderr: (value) => {
			stderr += value;
		},
		stdout: (value) => {
			stdout += value;
		}
	});
	return { exitCodes, stderr, stdout };
}

afterEach(() => {
	for (const root of temporaryRoots.splice(0))
		rmSync(root, { force: true, maxRetries: 3, recursive: true, retryDelay: 50 });
});

describe('runDwp007PersistenceSelectionCommand', () => {
	it('writes, atomically replaces, and checks canonical source-bound evidence', () => {
		const root = repositoryFixture();
		let measurements = 0;
		const measure = (options: MeasureDwp007PersistenceSelectionOptions) => {
			measurements += 1;
			return evidenceFor(options);
		};
		const first = runDwp007PersistenceSelectionCommand(context(root, ['--write'], { measure }));
		expect(JSON.parse(first)).toMatchObject({
			evidencePath: EVIDENCE_PATH,
			selectedBackend: 'CONTENT_ADDRESSED_FILES',
			state: 'WRITTEN_TECHNICAL_SELECTION_EVIDENCE'
		});
		expect(measurements).toBe(1);
		const written = readFileSync(resolve(root, EVIDENCE_PATH), 'utf8');
		expect(`${canonicalSemanticJson(JSON.parse(written))}\n`).toBe(written);

		runDwp007PersistenceSelectionCommand(context(root, ['--write'], { measure }));
		expect(measurements).toBe(2);
		const checked = runDwp007PersistenceSelectionCommand(
			context(root, ['--check'], {
				measure: () => {
					throw new Error('check must not measure');
				}
			})
		);
		expect(JSON.parse(checked)).toMatchObject({
			implementationSourceDigest: JSON.parse(written).implementationSourceDigest,
			state: 'CANONICAL_AND_SOURCE_CURRENT'
		});
	});

	it('maps usage, runtime, and non-Error failures to exact command diagnostics', () => {
		const root = repositoryFixture();
		const usage = execute(context(root, []));
		expect(usage).toEqual({
			exitCodes: [2],
			stderr:
				'Usage: bun packages/csaa/src/persistence/run-dwp-007-persistence-selection.ts --write|--check\n',
			stdout: ''
		});
		expect(execute(context(root, ['--write'], { bunVersion: undefined }))).toMatchObject({
			exitCodes: [1],
			stderr: expect.stringContaining('Bun runtime on Windows')
		});
		expect(execute(context(root, ['--write'], { platform: 'linux' }))).toMatchObject({
			exitCodes: [1],
			stderr: expect.stringContaining('Bun runtime on Windows')
		});
		expect(
			execute(
				context(root, ['--write'], {
					measure: () => {
						throw 'non-Error measurement refusal';
					}
				})
			)
		).toEqual({
			exitCodes: [1],
			stderr: 'non-Error measurement refusal\n',
			stdout: ''
		});
	});

	it('refuses unsafe manifests, installed packages, entries, and implementation sources', () => {
		const cases: readonly {
			readonly expected: RegExp;
			readonly mutate: (root: string) => void;
		}[] = [
			{
				expected: /now declares better-sqlite3/u,
				mutate: (root) =>
					write(
						root,
						'packages/csaa/package.json',
						'{"dependencies":{"better-sqlite3":"12.11.1"}}\n'
					)
			},
			{
				expected: /not valid JSON/u,
				mutate: (root) => write(root, 'node_modules/better-sqlite3/package.json', '{')
			},
			{
				expected: /not a JSON object/u,
				mutate: (root) => write(root, 'node_modules/better-sqlite3/package.json', '[]\n')
			},
			{
				expected: /version is invalid/u,
				mutate: (root) =>
					write(root, 'node_modules/better-sqlite3/package.json', '{"version":""}\n')
			},
			{
				expected: /entry is not an ordinary file/u,
				mutate: (root) => {
					const path = resolve(root, 'node_modules/better-sqlite3/lib/index.js');
					rmSync(path);
					mkdirSync(path);
				}
			},
			{
				expected: /invalid or excessive byte length/u,
				mutate: (root) => write(root, IMPLEMENTATION_SOURCE_PATHS[0]!, '')
			}
		];
		for (const candidate of cases) {
			const root = repositoryFixture();
			candidate.mutate(root);
			const result = execute(context(root, ['--write']));
			expect(result.exitCodes).toEqual([1]);
			expect(result.stderr).toMatch(candidate.expected);
			expect(result.stdout).toBe('');
		}
	});

	it('refuses source movement and unsafe evidence replacement shapes', () => {
		const movingRoot = repositoryFixture();
		const moving = execute(
			context(movingRoot, ['--write'], {
				measure: (options) => {
					write(
						movingRoot,
						'packages/csaa/src/persistence/run-dwp-007-persistence-selection.ts',
						'export const runner = false;\n'
					);
					return evidenceFor(options);
				}
			})
		);
		expect(moving).toMatchObject({
			exitCodes: [1],
			stderr: expect.stringContaining('changed during DWP-007 selection measurement')
		});
		expect(() => readFileSync(resolve(movingRoot, EVIDENCE_PATH), 'utf8')).toThrow();

		const targetRoot = repositoryFixture();
		mkdirSync(resolve(targetRoot, EVIDENCE_PATH));
		expect(execute(context(targetRoot, ['--write']))).toMatchObject({
			exitCodes: [1],
			stderr: expect.stringContaining('not an ordinary file')
		});

		const parentRoot = repositoryFixture();
		rmSync(resolve(parentRoot, 'verif/csaa'), { recursive: true });
		write(parentRoot, 'verif/csaa', 'not-a-directory\n');
		expect(execute(context(parentRoot, ['--write']))).toMatchObject({
			exitCodes: [1],
			stderr: expect.stringContaining('parent is not an ordinary directory')
		});
	});

	it('refuses invalid, noncanonical, and environment-stale checked evidence', () => {
		const invalidRoot = repositoryFixture();
		write(invalidRoot, EVIDENCE_PATH, '{');
		expect(execute(context(invalidRoot, ['--check']))).toMatchObject({
			exitCodes: [1],
			stderr: expect.stringContaining('is not JSON')
		});

		const noncanonicalRoot = repositoryFixture();
		runDwp007PersistenceSelectionCommand(context(noncanonicalRoot, ['--write']));
		const parsed = JSON.parse(readFileSync(resolve(noncanonicalRoot, EVIDENCE_PATH), 'utf8'));
		write(noncanonicalRoot, EVIDENCE_PATH, `${JSON.stringify(parsed, null, 2)}\n`);
		expect(execute(context(noncanonicalRoot, ['--check']))).toMatchObject({
			exitCodes: [1],
			stderr: expect.stringContaining('not canonical JSON')
		});

		const staleRoot = repositoryFixture();
		runDwp007PersistenceSelectionCommand(context(staleRoot, ['--write']));
		const stale = JSON.parse(readFileSync(resolve(staleRoot, EVIDENCE_PATH), 'utf8')) as Record<
			string,
			unknown
		>;
		(stale.environment as Record<string, unknown>).architecture = 'stale-architecture';
		write(staleRoot, EVIDENCE_PATH, `${canonicalSemanticJson(stale)}\n`);
		expect(execute(context(staleRoot, ['--check']))).toMatchObject({
			exitCodes: [1],
			stderr: expect.stringContaining('environment is stale')
		});

		const nodeRoot = repositoryFixture();
		runDwp007PersistenceSelectionCommand(context(nodeRoot, ['--write']));
		expect(
			execute(context(nodeRoot, ['--check'], { nodeExecutable: 'missing-node-executable' }))
		).toMatchObject({
			exitCodes: [1],
			stderr: expect.stringContaining('Node runtime version could not be measured')
		});
	});
});
