import type { SpawnSyncReturns } from 'node:child_process';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const spawnSyncMock = vi.hoisted(() => vi.fn());

vi.mock('node:child_process', async (importOriginal) => {
	const original = await importOriginal<typeof import('node:child_process')>();
	return { ...original, spawnSync: spawnSyncMock };
});

import {
	dwp007PersistenceSelectionImplementationSourceDigest,
	measureDwp007PersistenceSelection,
	type MeasureDwp007PersistenceSelectionOptions,
	validateDwp007PersistenceSelectionEvidence
} from './assess-dwp-007-persistence-selection.js';

function result(
	stdout: string,
	status: number | null = 0,
	stderr = '',
	error?: Error
): SpawnSyncReturns<string> {
	return {
		...((error === undefined ? {} : { error }) as Pick<SpawnSyncReturns<string>, 'error'>),
		output: [null, stdout, stderr],
		pid: 1,
		signal: null,
		status,
		stderr,
		stdout
	};
}

const validNodeResult = () =>
	result(
		JSON.stringify({
			completed: true,
			concurrentReaderIsolation: true,
			migrationRollback: true,
			nodeVersion: process.version,
			startupSamplesMs: [3, 1, 2],
			transactionRollback: true
		})
	);
const validBunResult = () => result('{"completed":true,"value":1}\n');

let nodeResult: SpawnSyncReturns<string>;
let betterSqlite3Result: SpawnSyncReturns<string>;
let builtInResult: SpawnSyncReturns<string>;

function options(
	overrides: Partial<MeasureDwp007PersistenceSelectionOptions> = {}
): MeasureDwp007PersistenceSelectionOptions {
	return {
		betterSqlite3EntryPath: resolve('fixture/better-sqlite3/index.js'),
		betterSqlite3Version: '12.11.1',
		bunExecutable: 'fixture-bun',
		environment: {
			architecture: process.arch,
			bunVersion: '1.3.14',
			codingAgentHost: 'BUN_PROCESS_HOST',
			platform: 'win32'
		},
		implementationSources: [
			{ path: 'packages/csaa/source-a.ts', sha256: 'a'.repeat(64) },
			{ path: 'packages/csaa/source-b.ts', sha256: 'b'.repeat(64) }
		],
		nodeExecutable: 'fixture-node',
		now: () => '2026-08-25T00:00:00.000Z',
		...overrides
	};
}

beforeEach(() => {
	nodeResult = validNodeResult();
	betterSqlite3Result = result('', 1, 'native load failed');
	builtInResult = validBunResult();
	spawnSyncMock.mockReset();
	spawnSyncMock.mockImplementation((_executable: string, argumentsValue: readonly string[]) => {
		const script = argumentsValue[1] ?? '';
		if (script.includes('concurrentReaderIsolation')) return nodeResult;
		if (script.includes('bun:sqlite')) return builtInResult;
		return betterSqlite3Result;
	});
});

describe('DWP-007 process-backed persistence selection measurement', () => {
	it('measures and validates both failed and successful Bun native-adapter dispositions', () => {
		const failed = measureDwp007PersistenceSelection(options());
		expect(failed.candidates.sqliteBetterSqlite3).toMatchObject({
			controls: { activeHostCompatibility: 'FAIL_MEASURED_BUN_WINDOWS' },
			probe: {
				bunBetterSqlite3: { completed: false, exitCode: 1, outcome: 'FAIL_EXIT_NONZERO' },
				node: { startupMedianMs: 2 }
			}
		});
		expect(
			validateDwp007PersistenceSelectionEvidence(
				failed,
				dwp007PersistenceSelectionImplementationSourceDigest(options().implementationSources)
			)
		).toEqual(failed);

		betterSqlite3Result = validBunResult();
		const passed = measureDwp007PersistenceSelection(options());
		expect(passed.candidates.sqliteBetterSqlite3).toMatchObject({
			controls: { activeHostCompatibility: 'PASS_MEASURED_BUN_WINDOWS' },
			probe: { bunBetterSqlite3: { completed: true, outcome: 'PASS' } }
		});
	});

	it('records every bounded child-process failure category', () => {
		const timeoutError = Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' });
		const cases: readonly {
			readonly expected: string;
			readonly value: SpawnSyncReturns<string>;
		}[] = [
			{ expected: 'FAIL_TIMED_OUT', value: result('', null, '', timeoutError) },
			{ expected: 'FAIL_EXIT_NONZERO', value: result('', 9, 'failed') },
			{
				expected: 'FAIL_UNPARSEABLE_COMPLETION_RECORD',
				value: result('{"completed":false,"value":1}\n')
			},
			{ expected: 'FAIL_NO_COMPLETION_RECORD', value: result('not-json') }
		];
		for (const candidate of cases) {
			betterSqlite3Result = candidate.value;
			const evidence = measureDwp007PersistenceSelection(options());
			expect(evidence.candidates.sqliteBetterSqlite3.probe.bunBetterSqlite3.outcome).toBe(
				candidate.expected
			);
		}

		betterSqlite3Result = result('x'.repeat(64 * 1024 + 1));
		expect(() => measureDwp007PersistenceSelection(options())).toThrow(/output ceiling/u);

		betterSqlite3Result = validBunResult();
		builtInResult = result('', 1, 'control failed');
		expect(() => measureDwp007PersistenceSelection(options())).toThrow(
			/Bun built-in SQLite control did not complete/u
		);
	});

	it('refuses every material Node probe failure mode', () => {
		const cases: readonly {
			readonly expected: RegExp;
			readonly value: SpawnSyncReturns<string>;
		}[] = [
			{ expected: /functional probe failed/u, value: result('', 7, 'node failed') },
			{ expected: /returned invalid JSON/u, value: result('not-json') },
			{ expected: /returned an invalid record/u, value: result('[]') },
			{
				expected: /did not satisfy its controls/u,
				value: result(
					JSON.stringify({
						completed: true,
						concurrentReaderIsolation: false,
						migrationRollback: true,
						nodeVersion: process.version,
						startupSamplesMs: [3, 1, 2],
						transactionRollback: true
					})
				)
			}
		];
		for (const candidate of cases) {
			nodeResult = candidate.value;
			expect(() => measureDwp007PersistenceSelection(options())).toThrow(candidate.expected);
		}
	});

	it('rejects malformed measurement options before running persistence probes', () => {
		const base = options();
		const cases: readonly {
			readonly expected: RegExp;
			readonly value: MeasureDwp007PersistenceSelectionOptions;
		}[] = [
			{
				expected: /absolute and normalized/u,
				value: options({ betterSqlite3EntryPath: 'relative/index.js' })
			},
			{ expected: /bounded Unicode scalar text/u, value: options({ bunExecutable: '' }) },
			{
				expected: /bounded Unicode scalar text/u,
				value: options({ betterSqlite3Version: '\ud800' })
			},
			{
				expected: /active Bun\/Windows host/u,
				value: options({ environment: { ...base.environment, platform: 'linux' as 'win32' } })
			},
			{
				expected: /active Bun\/Windows host/u,
				value: options({
					environment: {
						...base.environment,
						codingAgentHost: 'OTHER' as 'BUN_PROCESS_HOST'
					}
				})
			},
			{
				expected: /canonical millisecond ISO instant/u,
				value: options({ now: () => 'not-an-instant' })
			}
		];
		for (const candidate of cases) {
			expect(() => measureDwp007PersistenceSelection(candidate.value)).toThrow(candidate.expected);
		}
		expect(spawnSyncMock).not.toHaveBeenCalled();
	});

	it('rejects incoherent evidence at each persistence-selection trust boundary', () => {
		const evidence = measureDwp007PersistenceSelection(options());
		const record = (value: unknown): Record<string, unknown> => value as Record<string, unknown>;
		const mutate = (change: (candidate: Record<string, unknown>) => void): unknown => {
			const candidate = structuredClone(evidence) as unknown as Record<string, unknown>;
			change(candidate);
			return candidate;
		};
		const accessorEvidence = structuredClone(evidence) as unknown as Record<string, unknown>;
		Object.defineProperty(accessorEvidence, 'gateEffect', {
			enumerable: true,
			get: () => 'NONE'
		});
		const cases: readonly { readonly expected: RegExp; readonly value: unknown }[] = [
			{ expected: /must be a record/u, value: null },
			{ expected: /must be a plain record/u, value: new Date() },
			{ expected: /rejects non-data properties/u, value: accessorEvidence },
			{
				expected: /unsupported property set/u,
				value: mutate((candidate) => {
					candidate.unexpected = true;
				})
			},
			{
				expected: /identity or authority/u,
				value: mutate((candidate) => {
					candidate.analysisAuthority = 'SELF_AUTHORIZED';
				})
			},
			{
				expected: /criteria is invalid/u,
				value: mutate((candidate) => {
					candidate.criteria = [];
				})
			},
			{
				expected: /implementationSources must be an array/u,
				value: mutate((candidate) => {
					candidate.implementationSources = null;
				})
			},
			{
				expected: /source identity is stale or invalid/u,
				value: mutate((candidate) => {
					candidate.implementationSourceDigest = '0'.repeat(64);
				})
			},
			{
				expected: /environment.architecture is invalid/u,
				value: mutate((candidate) => {
					record(candidate.environment).architecture = '';
				})
			},
			{
				expected: /not the admitted Bun\/Windows host/u,
				value: mutate((candidate) => {
					record(candidate.environment).platform = 'linux';
				})
			},
			{
				expected: /must contain exactly 3 samples/u,
				value: mutate((candidate) => {
					const files = record(record(candidate.candidates).contentAddressedFiles);
					record(files.probe).startupSamplesMs = [];
				})
			},
			{
				expected: /contains an invalid measurement/u,
				value: mutate((candidate) => {
					const files = record(record(candidate.candidates).contentAddressedFiles);
					record(files.probe).startupSamplesMs = [1, Number.NaN, 3];
				})
			},
			{
				expected: /content-addressed file probe is invalid/u,
				value: mutate((candidate) => {
					const files = record(record(candidate.candidates).contentAddressedFiles);
					record(files.probe).baselineGenerationId = 'invalid';
				})
			},
			{
				expected: /SQLite candidate admission is invalid/u,
				value: mutate((candidate) => {
					const sqlite = record(record(candidate.candidates).sqliteBetterSqlite3);
					sqlite.backend = 'OTHER';
				})
			},
			{
				expected: /SQLite candidate controls are invalid/u,
				value: mutate((candidate) => {
					const sqlite = record(record(candidate.candidates).sqliteBetterSqlite3);
					record(sqlite.controls).schemaEvolution = 'UNCONTROLLED';
				})
			},
			{
				expected: /Bun built-in SQLite control must pass/u,
				value: mutate((candidate) => {
					const sqlite = record(record(candidate.candidates).sqliteBetterSqlite3);
					const probe = record(record(sqlite.probe).bunBuiltInControl);
					probe.completed = false;
					probe.exitCode = 1;
					probe.outcome = 'FAIL_EXIT_NONZERO';
				})
			},
			{
				expected: /active-host compatibility disagrees/u,
				value: mutate((candidate) => {
					const sqlite = record(record(candidate.candidates).sqliteBetterSqlite3);
					record(sqlite.controls).activeHostCompatibility = 'PASS_MEASURED_BUN_WINDOWS';
				})
			},
			{
				expected: /Node SQLite probe is invalid/u,
				value: mutate((candidate) => {
					const sqlite = record(record(candidate.candidates).sqliteBetterSqlite3);
					const node = record(record(sqlite.probe).node);
					node.concurrentReaderIsolation = false;
				})
			},
			{
				expected: /evidence.selection is invalid/u,
				value: mutate((candidate) => {
					record(candidate.selection).selectedBackend = 'SQLITE_BETTER_SQLITE3';
				})
			},
			{
				expected: /bunBetterSqlite3 is invalid/u,
				value: mutate((candidate) => {
					const sqlite = record(record(candidate.candidates).sqliteBetterSqlite3);
					const probe = record(record(sqlite.probe).bunBetterSqlite3);
					probe.completed = true;
				})
			}
		];
		for (const candidate of cases)
			expect(() => validateDwp007PersistenceSelectionEvidence(candidate.value)).toThrow(
				candidate.expected
			);

		expect(() => dwp007PersistenceSelectionImplementationSourceDigest([null as never])).toThrow(
			/must be a record/u
		);
	});
});
