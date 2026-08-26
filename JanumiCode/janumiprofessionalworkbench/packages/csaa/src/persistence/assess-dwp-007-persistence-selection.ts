import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';

import { canonicalSemanticJson, isUnicodeScalarString } from '../semantic/canonical.js';
import {
	ContentAddressedFileStore,
	ContentAddressedStoreBusyError,
	ContentAddressedStoreCancelledError,
	type ContentAddressedArtifactDefinition,
	type ContentAddressedInvalidationInput,
	type ContentAddressedPublishRequest
} from './content-addressed-file-store.js';

export const DWP_007_PERSISTENCE_SELECTION_EVIDENCE_SCHEMA_VERSION =
	'jan-csaa-dwp-007-persistence-selection-evidence/1.0.0' as const;
export const DWP_007_PERSISTENCE_SELECTION_OPERATION_VERSION =
	'jan-csaa-assess-dwp-007-persistence-selection/1.0.0' as const;
export const DWP_007_PERSISTENCE_SELECTION_SOURCE_SET_VERSION =
	'jan-csaa-dwp-007-persistence-selection-source-set/1.0.0' as const;

export const DWP_007_PERSISTENCE_SELECTION_CRITERIA = Object.freeze([
	'ACTIVE_BUN_WINDOWS_HOST_COMPATIBILITY',
	'ATOMIC_PUBLICATION_OR_TRANSACTION_ROLLBACK',
	'NO_MIXED_GENERATION_READER',
	'CONCURRENT_WRITER_EXCLUSION',
	'CANCELLATION_PRESERVES_CURRENT',
	'UNKNOWN_SCHEMA_FAILS_CLOSED_OR_REBUILDS',
	'REBUILDABLE_NONAUTHORITATIVE_CACHE',
	'IDENTITY_CHECKED_INCREMENTAL_REUSE',
	'MEASURED_STARTUP_WITHOUT_THRESHOLD'
] as const);

export const DWP_007_PERSISTENCE_SELECTION_POLICY = Object.freeze({
	candidateScope: 'BETTER_SQLITE3_VS_IMPLEMENTED_CONTENT_ADDRESSED_FILES' as const,
	eligibility: 'EVERY_REQUIRED_CRITERION_MUST_PASS' as const,
	performanceDecision: 'STARTUP_IS_RECORDED_WITHOUT_A_THRESHOLD_OR_SLO' as const,
	tieBreak: 'PREFER_THE_ALREADY_IMPLEMENTED_ELIGIBLE_STORE' as const
});

export const DWP_007_PERSISTENCE_SELECTION_NONCLAIMS = Object.freeze([
	'NO_PRODUCT_PERFORMANCE_THRESHOLD_OR_SLO',
	'BOUNDED_LOCAL_SPIKE_IS_NOT_CROSS_PLATFORM_QUALIFICATION',
	'SQLITE_BUILTIN_CONTROL_IS_NOT_A_SELECTED_OR_IMPLEMENTED_ADAPTER',
	'FILE_STORE_SELECTION_DOES_NOT_MAKE_CACHE_CONTENT_AUTHORITATIVE',
	'FILE_STORE_SELECTION_DOES_NOT_AUTHORIZE_PRODUCT_DATABASE_REUSE',
	'NO_RPH_PERSISTENCE_SCHEMA_OR_PORT_IS_IMPORTED',
	'NO_PROVIDER_QUALIFICATION_CLAIM',
	'ANALYSIS_AUTHORITY_NONE',
	'GATE_EFFECT_NONE'
] as const);

export interface Dwp007PersistenceSelectionImplementationSource {
	readonly path: string;
	readonly sha256: string;
}

export interface Dwp007PersistenceSelectionEnvironment {
	readonly architecture: string;
	readonly betterSqlite3Version: string;
	readonly bunVersion: string;
	readonly codingAgentHost: 'BUN_PROCESS_HOST';
	readonly nodeVersion: string;
	readonly platform: 'win32';
}

export interface Dwp007ProcessProbe {
	readonly completed: boolean;
	readonly exitCode: number | null;
	readonly outcome:
		| 'PASS'
		| 'FAIL_EXIT_NONZERO'
		| 'FAIL_NO_COMPLETION_RECORD'
		| 'FAIL_TIMED_OUT'
		| 'FAIL_UNPARSEABLE_COMPLETION_RECORD';
	readonly stderrSha256: string;
	readonly stdoutSha256: string;
}

export interface Dwp007ContentAddressedFileProbe {
	readonly baselineGenerationId: string;
	readonly cancellationPreservedGeneration: true;
	readonly cleanEquivalenceVerified: true;
	readonly concurrentReaderIsolation: true;
	readonly concurrentWriterExclusion: true;
	readonly exactReuse: true;
	readonly rebuildOnUnknownSchema: true;
	readonly reusedGenerationId: string;
	readonly startupMedianMs: number;
	readonly startupSamplesMs: readonly number[];
	readonly updatedGenerationId: string;
}

export interface Dwp007BetterSqlite3Probe {
	readonly bunBuiltInControl: Dwp007ProcessProbe;
	readonly bunBetterSqlite3: Dwp007ProcessProbe;
	readonly node: {
		readonly concurrentReaderIsolation: true;
		readonly migrationRollback: true;
		readonly nodeVersion: string;
		readonly startupMedianMs: number;
		readonly startupSamplesMs: readonly number[];
		readonly transactionRollback: true;
	};
}

export interface Dwp007PersistenceSelectionEvidence {
	readonly analysisAuthority: 'NONE';
	readonly candidates: {
		readonly contentAddressedFiles: {
			readonly backend: 'CONTENT_ADDRESSED_FILES';
			readonly controls: {
				readonly activeHostCompatibility: 'PASS_MEASURED_BUN_WINDOWS';
				readonly atomicPublicationOrRollback: 'PASS';
				readonly cancellationPreservesCurrent: 'PASS';
				readonly concurrentReaderIsolation: 'PASS';
				readonly concurrentWriterExclusion: 'PASS';
				readonly identityCheckedIncrementalReuse: 'PASS';
				readonly rebuildableNonAuthoritativeCache: 'PASS';
				readonly schemaEvolution: 'PASS_REBUILD_ON_UNKNOWN_SCHEMA';
			};
			readonly eligible: true;
			readonly implementationStatus: 'IMPLEMENTED_BEHIND_CSAA_STORE_CONTRACT';
			readonly probe: Dwp007ContentAddressedFileProbe;
		};
		readonly sqliteBetterSqlite3: {
			readonly backend: 'SQLITE_BETTER_SQLITE3';
			readonly controls: {
				readonly activeHostCompatibility: 'PASS_MEASURED_BUN_WINDOWS' | 'FAIL_MEASURED_BUN_WINDOWS';
				readonly atomicPublicationOrRollback: 'PASS_NODE_SPIKE';
				readonly cancellationPreservesCurrent: 'NOT_IMPLEMENTED_NO_CSAA_ADAPTER';
				readonly concurrentReaderIsolation: 'PASS_NODE_WAL_SPIKE';
				readonly concurrentWriterExclusion: 'PASS_NODE_TRANSACTION_SPIKE';
				readonly identityCheckedIncrementalReuse: 'NOT_IMPLEMENTED_NO_CSAA_ADAPTER';
				readonly rebuildableNonAuthoritativeCache: 'NOT_IMPLEMENTED_NO_CSAA_ADAPTER';
				readonly schemaEvolution: 'PASS_NODE_TRANSACTIONAL_MIGRATION_SPIKE';
			};
			readonly eligible: false;
			readonly implementationStatus: 'MEASURED_SPIKE_ONLY_NOT_A_CSAA_STORE';
			readonly probe: Dwp007BetterSqlite3Probe;
		};
	};
	readonly criteria: typeof DWP_007_PERSISTENCE_SELECTION_CRITERIA;
	readonly environment: Dwp007PersistenceSelectionEnvironment;
	readonly gateEffect: 'NONE';
	readonly implementationSourceDigest: string;
	readonly implementationSources: readonly Dwp007PersistenceSelectionImplementationSource[];
	readonly nonclaims: typeof DWP_007_PERSISTENCE_SELECTION_NONCLAIMS;
	readonly operationVersion: typeof DWP_007_PERSISTENCE_SELECTION_OPERATION_VERSION;
	readonly policy: typeof DWP_007_PERSISTENCE_SELECTION_POLICY;
	readonly recordedAt: string;
	readonly schemaVersion: typeof DWP_007_PERSISTENCE_SELECTION_EVIDENCE_SCHEMA_VERSION;
	readonly selection: {
		readonly acceptance: 'TECHNICAL_ACCEPTANCE_SATISFIED_WITHOUT_SLO';
		readonly reasons: readonly [
			'SELECTED_BACKEND_PASSES_EVERY_REQUIRED_CRITERION',
			'BETTER_SQLITE3_IS_NOT_A_BUN_WINDOWS_SAFE_IMPLEMENTED_CSAA_STORE',
			'BUN_SQLITE_BUILTIN_WOULD_REQUIRE_A_DIFFERENT_UNIMPLEMENTED_ADAPTER',
			'REUSING_THE_VALIDATED_FILE_STORE_AVOIDS_SEMANTIC_AND_MIGRATION_RISK'
		];
		readonly selectedBackend: 'CONTENT_ADDRESSED_FILES';
		readonly technicalReuseVerdict: 'SELECT_IMPLEMENTED_CONTENT_ADDRESSED_FILE_STORE';
	};
}

export interface MeasureDwp007PersistenceSelectionOptions {
	readonly betterSqlite3EntryPath: string;
	readonly betterSqlite3Version: string;
	readonly bunExecutable: string;
	readonly environment: Omit<
		Dwp007PersistenceSelectionEnvironment,
		'betterSqlite3Version' | 'nodeVersion'
	>;
	readonly implementationSources: readonly Dwp007PersistenceSelectionImplementationSource[];
	readonly nodeExecutable: string;
	readonly now?: () => string;
}

const SHA256 = /^[0-9a-f]{64}$/u;
const SOURCE_PATH = /^(?!\/)(?![A-Za-z]:)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\\)[\x20-\x7e]+$/u;
const CANONICAL_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const PROCESS_TIMEOUT_MS = 15_000;
const MAX_PROCESS_OUTPUT_BYTES = 64 * 1024;
const STARTUP_SAMPLE_COUNT = 3;

function sha256(value: string | Uint8Array): string {
	return createHash('sha256').update(value).digest('hex');
}

function roundedElapsed(startedAt: number): number {
	return Number((performance.now() - startedAt).toFixed(3));
}

function median(values: readonly number[]): number {
	const sorted = [...values].sort((left, right) => left - right);
	return sorted[Math.floor(sorted.length / 2)]!;
}

function digestText(value: string | Buffer | null): string {
	return sha256(value ?? '');
}

function processProbe(
	result: SpawnSyncReturns<string>,
	completionPredicate: (value: unknown) => boolean
): Dwp007ProcessProbe {
	const stdout = result.stdout ?? '';
	const stderr = result.stderr ?? '';
	if (
		Buffer.byteLength(stdout) > MAX_PROCESS_OUTPUT_BYTES ||
		Buffer.byteLength(stderr) > MAX_PROCESS_OUTPUT_BYTES
	)
		throw new Error('A persistence-selection child process exceeded its output ceiling.');
	let parsed: unknown;
	let parsedRecord = false;
	try {
		parsed = JSON.parse(stdout.trim()) as unknown;
		parsedRecord = true;
	} catch {
		parsed = undefined;
	}
	const timedOut =
		result.error !== undefined && 'code' in result.error && result.error.code === 'ETIMEDOUT';
	const completed = result.status === 0 && parsedRecord && completionPredicate(parsed);
	let outcome: Dwp007ProcessProbe['outcome'];
	if (completed) outcome = 'PASS';
	else if (timedOut) outcome = 'FAIL_TIMED_OUT';
	else if (result.status !== 0) outcome = 'FAIL_EXIT_NONZERO';
	else if (parsedRecord) outcome = 'FAIL_UNPARSEABLE_COMPLETION_RECORD';
	else outcome = 'FAIL_NO_COMPLETION_RECORD';
	return Object.freeze({
		completed,
		exitCode: result.status,
		outcome,
		stderrSha256: digestText(stderr),
		stdoutSha256: digestText(stdout)
	});
}

function spawnBounded(executable: string, script: string): SpawnSyncReturns<string> {
	return spawnSync(executable, ['-e', script], {
		encoding: 'utf8',
		maxBuffer: MAX_PROCESS_OUTPUT_BYTES,
		timeout: PROCESS_TIMEOUT_MS,
		windowsHide: true
	});
}

function bunBetterSqlite3Probe(
	bunExecutable: string,
	betterSqlite3EntryPath: string
): Dwp007ProcessProbe {
	const script = `const Database=require(${JSON.stringify(
		betterSqlite3EntryPath
	)});const db=new Database(':memory:');const row=db.prepare('select 1 as value').get();db.close();console.log(JSON.stringify({completed:true,value:row.value}));`;
	return processProbe(spawnBounded(bunExecutable, script), (value) => {
		if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
		return (
			(value as { readonly completed?: unknown }).completed === true &&
			(value as { readonly value?: unknown }).value === 1
		);
	});
}

function bunBuiltInSqliteProbe(bunExecutable: string): Dwp007ProcessProbe {
	const script =
		`import { Database } from 'bun:sqlite';` +
		`const db=new Database(':memory:');const row=db.query('select 1 as value').get();` +
		`db.close();console.log(JSON.stringify({completed:true,value:row.value}));`;
	return processProbe(spawnBounded(bunExecutable, script), (value) => {
		if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
		return (
			(value as { readonly completed?: unknown }).completed === true &&
			(value as { readonly value?: unknown }).value === 1
		);
	});
}

function nodeBetterSqlite3Probe(
	nodeExecutable: string,
	betterSqlite3EntryPath: string
): Dwp007BetterSqlite3Probe['node'] {
	const root = mkdtempSync(join(tmpdir(), 'csaa-dwp-007-sqlite-'));
	try {
		const databasePath = join(root, 'candidate.sqlite');
		const script = `
const { performance } = require('node:perf_hooks');
const { rmSync } = require('node:fs');
const Database = require(${JSON.stringify(betterSqlite3EntryPath)});
const base = ${JSON.stringify(databasePath)};
const startupSamplesMs = [];
for (let index = 0; index < ${STARTUP_SAMPLE_COUNT}; index += 1) {
  const path = base + '-startup-' + index;
  const startedAt = performance.now();
  const startup = new Database(path);
  startup.pragma('journal_mode = WAL');
  startup.exec('CREATE TABLE cache_entry (id TEXT PRIMARY KEY, value TEXT NOT NULL)');
  startup.close();
  startupSamplesMs.push(Number((performance.now() - startedAt).toFixed(3)));
  for (const suffix of ['', '-wal', '-shm']) rmSync(path + suffix, { force: true });
}
const db = new Database(base);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(${JSON.stringify(
			"CREATE TABLE generation (id TEXT PRIMARY KEY); CREATE TABLE current_pointer (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), generation_id TEXT NOT NULL REFERENCES generation(id)); INSERT INTO generation(id) VALUES ('g0'); INSERT INTO current_pointer(singleton, generation_id) VALUES (1, 'g0'); CREATE TABLE migration_probe (id INTEGER PRIMARY KEY);"
		)});
let transactionThrew = false;
try {
  db.transaction(() => {
    db.prepare('INSERT INTO generation(id) VALUES (?)').run('g1');
    db.prepare('UPDATE current_pointer SET generation_id = ? WHERE singleton = 1').run('g1');
    throw new Error('rollback');
  })();
} catch { transactionThrew = true; }
const transactionRollback = transactionThrew && db.prepare('SELECT generation_id FROM current_pointer WHERE singleton = 1').pluck().get() === 'g0' && db.prepare('SELECT COUNT(*) FROM generation WHERE id = ?').pluck().get('g1') === 0;
db.pragma('user_version = 1');
let migrationThrew = false;
try {
  db.transaction(() => {
    db.exec('ALTER TABLE migration_probe ADD COLUMN added TEXT');
    db.pragma('user_version = 2');
    throw new Error('rollback');
  })();
} catch { migrationThrew = true; }
const migrationColumns = db.prepare('PRAGMA table_info(migration_probe)').all().map((row) => row.name);
const migrationRollback = migrationThrew && db.pragma('user_version', { simple: true }) === 1 && !migrationColumns.includes('added');
const reader = new Database(base, { readonly: true, fileMustExist: true });
reader.exec('BEGIN');
const before = reader.prepare('SELECT generation_id FROM current_pointer WHERE singleton = 1').pluck().get();
db.transaction(() => {
  db.prepare('INSERT INTO generation(id) VALUES (?)').run('g2');
  db.prepare('UPDATE current_pointer SET generation_id = ? WHERE singleton = 1').run('g2');
})();
const during = reader.prepare('SELECT generation_id FROM current_pointer WHERE singleton = 1').pluck().get();
reader.exec('COMMIT');
const after = reader.prepare('SELECT generation_id FROM current_pointer WHERE singleton = 1').pluck().get();
reader.close();
db.close();
const concurrentReaderIsolation = before === 'g0' && during === 'g0' && after === 'g2';
console.log(JSON.stringify({completed:true,concurrentReaderIsolation,migrationRollback,nodeVersion:process.version,startupSamplesMs,transactionRollback}));
`;
		const result = spawnBounded(nodeExecutable, script);
		if (result.status !== 0)
			throw new Error(
				`The Node better-sqlite3 functional probe failed (exit ${String(result.status)}, stderr ${digestText(result.stderr)}): ${(result.stderr ?? '').trim().slice(0, 2_048)}`
			);
		let parsed: unknown;
		try {
			parsed = JSON.parse((result.stdout ?? '').trim()) as unknown;
		} catch {
			throw new Error('The Node better-sqlite3 functional probe returned invalid JSON.');
		}
		if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed))
			throw new Error('The Node better-sqlite3 functional probe returned an invalid record.');
		const record = parsed as Record<string, unknown>;
		if (
			record.completed !== true ||
			record.concurrentReaderIsolation !== true ||
			record.migrationRollback !== true ||
			record.transactionRollback !== true ||
			typeof record.nodeVersion !== 'string' ||
			!Array.isArray(record.startupSamplesMs) ||
			record.startupSamplesMs.length !== STARTUP_SAMPLE_COUNT ||
			record.startupSamplesMs.some(
				(value) => typeof value !== 'number' || !Number.isFinite(value) || value < 0
			)
		)
			throw new Error('The Node better-sqlite3 functional probe did not satisfy its controls.');
		const startupSamplesMs = Object.freeze([...(record.startupSamplesMs as number[])]);
		return Object.freeze({
			concurrentReaderIsolation: true,
			migrationRollback: true,
			nodeVersion: record.nodeVersion,
			startupMedianMs: median(startupSamplesMs),
			startupSamplesMs,
			transactionRollback: true
		});
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
}

function digestInput(key: string, value: string): ContentAddressedInvalidationInput {
	return Object.freeze({ digest: sha256(value), key, kind: 'FILE_CONTENT' as const });
}

function artifact(value: string): ContentAddressedArtifactDefinition {
	return Object.freeze({
		artifactKind: 'DWP_007_SELECTION_PROBE',
		compute: () => value,
		dependencyKeys: Object.freeze(['file:selection-probe']),
		logicalKey: 'artifact:selection-probe',
		transformVersion: '1.0.0'
	});
}

function publishRequest(
	mode: 'CLEAN' | 'INCREMENTAL',
	expectedCurrentGenerationId: string | null,
	inputValue: string,
	outputValue: string,
	options?: { readonly signal?: AbortSignal; readonly verifyCleanEquivalence?: boolean }
): ContentAddressedPublishRequest {
	return Object.freeze({
		expectedCurrentGenerationId,
		invalidationInputs: Object.freeze([digestInput('file:selection-probe', inputValue)]),
		mode,
		outputs: Object.freeze([artifact(outputValue)]),
		signal: options?.signal,
		subjectId: 'subject:dwp-007-persistence-selection-probe',
		verifyCleanEquivalence: options?.verifyCleanEquivalence ?? false
	});
}

export function measureContentAddressedFileCandidate(): Dwp007ContentAddressedFileProbe {
	const root = mkdtempSync(join(tmpdir(), 'csaa-dwp-007-files-'));
	try {
		const startupSamplesMs = Object.freeze(
			Array.from({ length: STARTUP_SAMPLE_COUNT }, (_, index) => {
				const startedAt = performance.now();
				new ContentAddressedFileStore(join(root, `startup-${index}`)).initialize();
				return roundedElapsed(startedAt);
			})
		);
		const storeRoot = join(root, 'candidate');
		let nestedWriterRefused = false;
		let updatedRequest: ContentAddressedPublishRequest | undefined;
		const store = new ContentAddressedFileStore(storeRoot, {
			fault(point) {
				if (point !== 'BEFORE_POINTER_SWAP' || updatedRequest === undefined || nestedWriterRefused)
					return;
				try {
					new ContentAddressedFileStore(storeRoot).publish(updatedRequest);
				} catch (error) {
					if (error instanceof ContentAddressedStoreBusyError) nestedWriterRefused = true;
					else throw error;
				}
			}
		});
		store.initialize();
		const baseline = store.publish(publishRequest('CLEAN', null, 'one', 'old'));
		const reader = store.openCurrentReadView();
		if (reader === null) throw new Error('The file-store reader probe could not pin the baseline.');
		updatedRequest = publishRequest('INCREMENTAL', baseline.generationId, 'two', 'new', {
			verifyCleanEquivalence: true
		});
		const updated = store.publish(updatedRequest);
		const pinnedText = new TextDecoder().decode(reader.readArtifact('artifact:selection-probe'));
		reader.close();
		const currentAfterUpdate = store.openCurrentReadView();
		if (currentAfterUpdate === null)
			throw new Error('The file-store reader probe could not open the updated generation.');
		const updatedText = new TextDecoder().decode(
			currentAfterUpdate.readArtifact('artifact:selection-probe')
		);
		currentAfterUpdate.close();
		const cancellation = new AbortController();
		const cancelledDefinition: ContentAddressedArtifactDefinition = Object.freeze({
			...artifact('cancelled'),
			compute: () => {
				cancellation.abort();
				return 'cancelled';
			}
		});
		let cancellationRefused = false;
		try {
			store.publish({
				...publishRequest('INCREMENTAL', updated.generationId, 'cancel', 'cancelled', {
					signal: cancellation.signal
				}),
				outputs: Object.freeze([cancelledDefinition])
			});
		} catch (error) {
			if (error instanceof ContentAddressedStoreCancelledError) cancellationRefused = true;
			else throw error;
		}
		const afterCancellation = store.openCurrentReadView();
		if (afterCancellation === null)
			throw new Error('The file-store cancellation probe lost the current generation.');
		const cancellationGeneration = afterCancellation.generationId;
		afterCancellation.close();
		updatedRequest = undefined;
		const reused = store.publish(
			publishRequest('INCREMENTAL', updated.generationId, 'two', 'new', {
				verifyCleanEquivalence: true
			})
		);

		const incompatibleRoot = join(root, 'incompatible');
		const incompatible = new ContentAddressedFileStore(incompatibleRoot);
		incompatible.initialize();
		incompatible.publish(publishRequest('CLEAN', null, 'one', 'old'));
		writeFileSync(
			join(incompatibleRoot, 'format.json'),
			canonicalSemanticJson({
				hashAlgorithm: 'SHA-256',
				schema: 'JAN-CSAA-CONTENT-ADDRESSED-FILE-STORE@2'
			})
		);
		const recovered = incompatible.initialize();
		if (
			pinnedText !== 'old' ||
			updatedText !== 'new' ||
			!nestedWriterRefused ||
			!cancellationRefused ||
			cancellationGeneration !== updated.generationId ||
			updated.cleanEquivalenceVerified !== true ||
			reused.generationId !== updated.generationId ||
			reused.computedArtifacts !== 0 ||
			reused.reusedArtifacts !== 1 ||
			recovered.rebuildRequired !== true ||
			recovered.reason !== 'UNKNOWN_FORMAT_VERSION' ||
			incompatible.openCurrentReadView() !== null
		)
			throw new Error('The content-addressed file candidate did not satisfy its controls.');
		return Object.freeze({
			baselineGenerationId: baseline.generationId,
			cancellationPreservedGeneration: true,
			cleanEquivalenceVerified: true,
			concurrentReaderIsolation: true,
			concurrentWriterExclusion: true,
			exactReuse: true,
			rebuildOnUnknownSchema: true,
			reusedGenerationId: reused.generationId,
			startupMedianMs: median(startupSamplesMs),
			startupSamplesMs,
			updatedGenerationId: updated.generationId
		});
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
}

export function dwp007PersistenceSelectionImplementationSourceDigest(
	sourcesValue: readonly Dwp007PersistenceSelectionImplementationSource[]
): string {
	if (!Array.isArray(sourcesValue) || sourcesValue.length === 0 || sourcesValue.length > 32)
		throw new TypeError('implementationSources must contain one through 32 entries.');
	const sources = sourcesValue.map((source, index) => {
		if (source === null || typeof source !== 'object' || Array.isArray(source))
			throw new TypeError(`implementationSources[${index}] must be a record.`);
		if (
			typeof source.path !== 'string' ||
			!SOURCE_PATH.test(source.path) ||
			typeof source.sha256 !== 'string' ||
			!SHA256.test(source.sha256)
		)
			throw new TypeError(`implementationSources[${index}] is invalid.`);
		return Object.freeze({ path: source.path, sha256: source.sha256 });
	});
	const sorted = [...sources].sort((left, right) => left.path.localeCompare(right.path, 'en'));
	if (sorted.some((source, index) => index > 0 && source.path === sorted[index - 1]!.path))
		throw new TypeError('implementationSources contains duplicate paths.');
	return sha256(
		canonicalSemanticJson({
			sourceSetVersion: DWP_007_PERSISTENCE_SELECTION_SOURCE_SET_VERSION,
			sources: sorted
		})
	);
}

function canonicalInstant(value: string): string {
	if (!CANONICAL_INSTANT.test(value) || Number.isNaN(Date.parse(value)))
		throw new TypeError('recordedAt must be a canonical millisecond ISO instant.');
	return value;
}

export function measureDwp007PersistenceSelection(
	options: MeasureDwp007PersistenceSelectionOptions
): Dwp007PersistenceSelectionEvidence {
	if (resolve(options.betterSqlite3EntryPath) !== options.betterSqlite3EntryPath)
		throw new TypeError('betterSqlite3EntryPath must be absolute and normalized.');
	for (const [label, value] of [
		['betterSqlite3Version', options.betterSqlite3Version],
		['bunExecutable', options.bunExecutable],
		['nodeExecutable', options.nodeExecutable],
		['architecture', options.environment.architecture],
		['bunVersion', options.environment.bunVersion]
	] as const) {
		if (value.length === 0 || value.length > 1_024 || !isUnicodeScalarString(value))
			throw new TypeError(`${label} must be bounded Unicode scalar text.`);
	}
	if (
		options.environment.platform !== 'win32' ||
		options.environment.codingAgentHost !== 'BUN_PROCESS_HOST'
	)
		throw new TypeError('DWP-007 selection measurement requires the active Bun/Windows host.');
	const recordedAt = canonicalInstant((options.now ?? (() => new Date().toISOString()))());
	const implementationSourceDigest = dwp007PersistenceSelectionImplementationSourceDigest(
		options.implementationSources
	);
	const fileProbe = measureContentAddressedFileCandidate();
	const nodeProbe = nodeBetterSqlite3Probe(options.nodeExecutable, options.betterSqlite3EntryPath);
	const bunBetterSqlite3 = bunBetterSqlite3Probe(
		options.bunExecutable,
		options.betterSqlite3EntryPath
	);
	const bunBuiltInControl = bunBuiltInSqliteProbe(options.bunExecutable);
	if (!bunBuiltInControl.completed)
		throw new Error('The Bun built-in SQLite control did not complete on the measured host.');
	const sqliteActiveHostCompatibility = bunBetterSqlite3.completed
		? ('PASS_MEASURED_BUN_WINDOWS' as const)
		: ('FAIL_MEASURED_BUN_WINDOWS' as const);
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
				probe: fileProbe
			}),
			sqliteBetterSqlite3: Object.freeze({
				backend: 'SQLITE_BETTER_SQLITE3',
				controls: Object.freeze({
					activeHostCompatibility: sqliteActiveHostCompatibility,
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
				probe: Object.freeze({ bunBetterSqlite3, bunBuiltInControl, node: nodeProbe })
			})
		}),
		criteria: DWP_007_PERSISTENCE_SELECTION_CRITERIA,
		environment: Object.freeze({
			...options.environment,
			betterSqlite3Version: options.betterSqlite3Version,
			nodeVersion: nodeProbe.nodeVersion
		}),
		gateEffect: 'NONE',
		implementationSourceDigest,
		implementationSources: Object.freeze(
			options.implementationSources.map((source) => Object.freeze({ ...source }))
		),
		nonclaims: DWP_007_PERSISTENCE_SELECTION_NONCLAIMS,
		operationVersion: DWP_007_PERSISTENCE_SELECTION_OPERATION_VERSION,
		policy: DWP_007_PERSISTENCE_SELECTION_POLICY,
		recordedAt,
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

function plainRecord(value: unknown, label: string): Record<string, unknown> {
	if (value === null || typeof value !== 'object' || Array.isArray(value))
		throw new TypeError(`${label} must be a record.`);
	const prototype = Object.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null)
		throw new TypeError(`${label} must be a plain record.`);
	for (const key of Reflect.ownKeys(value)) {
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (
			typeof key !== 'string' ||
			descriptor === undefined ||
			!descriptor.enumerable ||
			!('value' in descriptor)
		)
			throw new TypeError(`${label} rejects non-data properties.`);
	}
	return value as Record<string, unknown>;
}

function exactKeys(record: Record<string, unknown>, keys: readonly string[], label: string): void {
	const actual = Object.keys(record).sort();
	const expected = [...keys].sort();
	if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index]))
		throw new TypeError(`${label} has an unsupported property set.`);
}

function exactJson(value: unknown, expected: unknown, label: string): void {
	if (canonicalSemanticJson(value) !== canonicalSemanticJson(expected))
		throw new TypeError(`${label} is invalid.`);
}

function finiteSamples(value: unknown, label: string): readonly number[] {
	if (!Array.isArray(value) || value.length !== STARTUP_SAMPLE_COUNT)
		throw new TypeError(`${label} must contain exactly ${STARTUP_SAMPLE_COUNT} samples.`);
	const samples = value.map((sample) => {
		if (typeof sample !== 'number' || !Number.isFinite(sample) || sample < 0)
			throw new TypeError(`${label} contains an invalid measurement.`);
		return sample;
	});
	return Object.freeze(samples);
}

function validateProcessProbe(value: unknown, label: string): Dwp007ProcessProbe {
	const record = plainRecord(value, label);
	exactKeys(record, ['completed', 'exitCode', 'outcome', 'stderrSha256', 'stdoutSha256'], label);
	if (
		typeof record.completed !== 'boolean' ||
		(record.exitCode !== null &&
			(!Number.isSafeInteger(record.exitCode) || (record.exitCode as number) < 0)) ||
		![
			'PASS',
			'FAIL_EXIT_NONZERO',
			'FAIL_NO_COMPLETION_RECORD',
			'FAIL_TIMED_OUT',
			'FAIL_UNPARSEABLE_COMPLETION_RECORD'
		].includes(record.outcome as string) ||
		typeof record.stderrSha256 !== 'string' ||
		!SHA256.test(record.stderrSha256) ||
		typeof record.stdoutSha256 !== 'string' ||
		!SHA256.test(record.stdoutSha256) ||
		record.completed !== (record.outcome === 'PASS')
	)
		throw new TypeError(`${label} is invalid.`);
	return Object.freeze({
		completed: record.completed,
		exitCode: record.exitCode as number | null,
		outcome: record.outcome as Dwp007ProcessProbe['outcome'],
		stderrSha256: record.stderrSha256,
		stdoutSha256: record.stdoutSha256
	});
}

export function validateDwp007PersistenceSelectionEvidence(
	value: unknown,
	expectedImplementationSourceDigest?: string
): Dwp007PersistenceSelectionEvidence {
	const record = plainRecord(value, 'evidence');
	exactKeys(
		record,
		[
			'analysisAuthority',
			'candidates',
			'criteria',
			'environment',
			'gateEffect',
			'implementationSourceDigest',
			'implementationSources',
			'nonclaims',
			'operationVersion',
			'policy',
			'recordedAt',
			'schemaVersion',
			'selection'
		],
		'evidence'
	);
	if (
		record.schemaVersion !== DWP_007_PERSISTENCE_SELECTION_EVIDENCE_SCHEMA_VERSION ||
		record.operationVersion !== DWP_007_PERSISTENCE_SELECTION_OPERATION_VERSION ||
		record.analysisAuthority !== 'NONE' ||
		record.gateEffect !== 'NONE'
	)
		throw new TypeError('Evidence identity or authority is invalid.');
	exactJson(record.criteria, DWP_007_PERSISTENCE_SELECTION_CRITERIA, 'evidence.criteria');
	exactJson(record.policy, DWP_007_PERSISTENCE_SELECTION_POLICY, 'evidence.policy');
	exactJson(record.nonclaims, DWP_007_PERSISTENCE_SELECTION_NONCLAIMS, 'evidence.nonclaims');
	canonicalInstant(record.recordedAt as string);
	if (!Array.isArray(record.implementationSources))
		throw new TypeError('evidence.implementationSources must be an array.');
	const sources = record.implementationSources.map((source, index) => {
		const sourceRecord = plainRecord(source, `implementationSources[${index}]`);
		exactKeys(sourceRecord, ['path', 'sha256'], `implementationSources[${index}]`);
		return Object.freeze({
			path: sourceRecord.path as string,
			sha256: sourceRecord.sha256 as string
		});
	});
	const sourceDigest = dwp007PersistenceSelectionImplementationSourceDigest(sources);
	if (
		record.implementationSourceDigest !== sourceDigest ||
		(expectedImplementationSourceDigest !== undefined &&
			sourceDigest !== expectedImplementationSourceDigest)
	)
		throw new TypeError('Evidence implementation source identity is stale or invalid.');
	const environment = plainRecord(record.environment, 'evidence.environment');
	exactKeys(
		environment,
		[
			'architecture',
			'betterSqlite3Version',
			'bunVersion',
			'codingAgentHost',
			'nodeVersion',
			'platform'
		],
		'evidence.environment'
	);
	for (const key of [
		'architecture',
		'betterSqlite3Version',
		'bunVersion',
		'nodeVersion'
	] as const) {
		if (typeof environment[key] !== 'string' || (environment[key] as string).length === 0)
			throw new TypeError(`evidence.environment.${key} is invalid.`);
	}
	if (environment.codingAgentHost !== 'BUN_PROCESS_HOST' || environment.platform !== 'win32')
		throw new TypeError('Evidence environment is not the admitted Bun/Windows host.');
	const candidates = plainRecord(record.candidates, 'evidence.candidates');
	exactKeys(candidates, ['contentAddressedFiles', 'sqliteBetterSqlite3'], 'evidence.candidates');
	const files = plainRecord(candidates.contentAddressedFiles, 'contentAddressedFiles');
	exactKeys(
		files,
		['backend', 'controls', 'eligible', 'implementationStatus', 'probe'],
		'contentAddressedFiles'
	);
	exactJson(
		{
			backend: files.backend,
			controls: files.controls,
			eligible: files.eligible,
			implementationStatus: files.implementationStatus
		},
		{
			backend: 'CONTENT_ADDRESSED_FILES',
			controls: {
				activeHostCompatibility: 'PASS_MEASURED_BUN_WINDOWS',
				atomicPublicationOrRollback: 'PASS',
				cancellationPreservesCurrent: 'PASS',
				concurrentReaderIsolation: 'PASS',
				concurrentWriterExclusion: 'PASS',
				identityCheckedIncrementalReuse: 'PASS',
				rebuildableNonAuthoritativeCache: 'PASS',
				schemaEvolution: 'PASS_REBUILD_ON_UNKNOWN_SCHEMA'
			},
			eligible: true,
			implementationStatus: 'IMPLEMENTED_BEHIND_CSAA_STORE_CONTRACT'
		},
		'contentAddressedFiles admission'
	);
	const fileProbe = plainRecord(files.probe, 'contentAddressedFiles.probe');
	exactKeys(
		fileProbe,
		[
			'baselineGenerationId',
			'cancellationPreservedGeneration',
			'cleanEquivalenceVerified',
			'concurrentReaderIsolation',
			'concurrentWriterExclusion',
			'exactReuse',
			'rebuildOnUnknownSchema',
			'reusedGenerationId',
			'startupMedianMs',
			'startupSamplesMs',
			'updatedGenerationId'
		],
		'contentAddressedFiles.probe'
	);
	const fileSamples = finiteSamples(
		fileProbe.startupSamplesMs,
		'contentAddressedFiles.probe.startupSamplesMs'
	);
	if (
		!SHA256.test(fileProbe.baselineGenerationId as string) ||
		!SHA256.test(fileProbe.updatedGenerationId as string) ||
		fileProbe.reusedGenerationId !== fileProbe.updatedGenerationId ||
		fileProbe.startupMedianMs !== median(fileSamples) ||
		[
			fileProbe.cancellationPreservedGeneration,
			fileProbe.cleanEquivalenceVerified,
			fileProbe.concurrentReaderIsolation,
			fileProbe.concurrentWriterExclusion,
			fileProbe.exactReuse,
			fileProbe.rebuildOnUnknownSchema
		].some((result) => result !== true)
	)
		throw new TypeError('The content-addressed file probe is invalid.');
	const sqlite = plainRecord(candidates.sqliteBetterSqlite3, 'sqliteBetterSqlite3');
	exactKeys(
		sqlite,
		['backend', 'controls', 'eligible', 'implementationStatus', 'probe'],
		'sqliteBetterSqlite3'
	);
	if (
		sqlite.backend !== 'SQLITE_BETTER_SQLITE3' ||
		sqlite.eligible !== false ||
		sqlite.implementationStatus !== 'MEASURED_SPIKE_ONLY_NOT_A_CSAA_STORE'
	)
		throw new TypeError('The SQLite candidate admission is invalid.');
	const sqliteControls = plainRecord(sqlite.controls, 'sqliteBetterSqlite3.controls');
	exactKeys(
		sqliteControls,
		[
			'activeHostCompatibility',
			'atomicPublicationOrRollback',
			'cancellationPreservesCurrent',
			'concurrentReaderIsolation',
			'concurrentWriterExclusion',
			'identityCheckedIncrementalReuse',
			'rebuildableNonAuthoritativeCache',
			'schemaEvolution'
		],
		'sqliteBetterSqlite3.controls'
	);
	if (
		!['PASS_MEASURED_BUN_WINDOWS', 'FAIL_MEASURED_BUN_WINDOWS'].includes(
			sqliteControls.activeHostCompatibility as string
		) ||
		sqliteControls.atomicPublicationOrRollback !== 'PASS_NODE_SPIKE' ||
		sqliteControls.cancellationPreservesCurrent !== 'NOT_IMPLEMENTED_NO_CSAA_ADAPTER' ||
		sqliteControls.concurrentReaderIsolation !== 'PASS_NODE_WAL_SPIKE' ||
		sqliteControls.concurrentWriterExclusion !== 'PASS_NODE_TRANSACTION_SPIKE' ||
		sqliteControls.identityCheckedIncrementalReuse !== 'NOT_IMPLEMENTED_NO_CSAA_ADAPTER' ||
		sqliteControls.rebuildableNonAuthoritativeCache !== 'NOT_IMPLEMENTED_NO_CSAA_ADAPTER' ||
		sqliteControls.schemaEvolution !== 'PASS_NODE_TRANSACTIONAL_MIGRATION_SPIKE'
	)
		throw new TypeError('The SQLite candidate controls are invalid.');
	const sqliteProbe = plainRecord(sqlite.probe, 'sqliteBetterSqlite3.probe');
	exactKeys(
		sqliteProbe,
		['bunBetterSqlite3', 'bunBuiltInControl', 'node'],
		'sqliteBetterSqlite3.probe'
	);
	const bunBetter = validateProcessProbe(
		sqliteProbe.bunBetterSqlite3,
		'sqliteBetterSqlite3.probe.bunBetterSqlite3'
	);
	const bunBuiltIn = validateProcessProbe(
		sqliteProbe.bunBuiltInControl,
		'sqliteBetterSqlite3.probe.bunBuiltInControl'
	);
	if (!bunBuiltIn.completed) throw new TypeError('The Bun built-in SQLite control must pass.');
	if (
		(sqliteControls.activeHostCompatibility === 'PASS_MEASURED_BUN_WINDOWS') !==
		bunBetter.completed
	)
		throw new TypeError('SQLite active-host compatibility disagrees with its probe.');
	const node = plainRecord(sqliteProbe.node, 'sqliteBetterSqlite3.probe.node');
	exactKeys(
		node,
		[
			'concurrentReaderIsolation',
			'migrationRollback',
			'nodeVersion',
			'startupMedianMs',
			'startupSamplesMs',
			'transactionRollback'
		],
		'sqliteBetterSqlite3.probe.node'
	);
	const nodeSamples = finiteSamples(
		node.startupSamplesMs,
		'sqliteBetterSqlite3.probe.node.startupSamplesMs'
	);
	if (
		node.concurrentReaderIsolation !== true ||
		node.migrationRollback !== true ||
		node.transactionRollback !== true ||
		node.nodeVersion !== environment.nodeVersion ||
		node.startupMedianMs !== median(nodeSamples)
	)
		throw new TypeError('The Node SQLite probe is invalid.');
	exactJson(
		record.selection,
		{
			acceptance: 'TECHNICAL_ACCEPTANCE_SATISFIED_WITHOUT_SLO',
			reasons: [
				'SELECTED_BACKEND_PASSES_EVERY_REQUIRED_CRITERION',
				'BETTER_SQLITE3_IS_NOT_A_BUN_WINDOWS_SAFE_IMPLEMENTED_CSAA_STORE',
				'BUN_SQLITE_BUILTIN_WOULD_REQUIRE_A_DIFFERENT_UNIMPLEMENTED_ADAPTER',
				'REUSING_THE_VALIDATED_FILE_STORE_AVOIDS_SEMANTIC_AND_MIGRATION_RISK'
			],
			selectedBackend: 'CONTENT_ADDRESSED_FILES',
			technicalReuseVerdict: 'SELECT_IMPLEMENTED_CONTENT_ADDRESSED_FILE_STORE'
		},
		'evidence.selection'
	);
	return value as Dwp007PersistenceSelectionEvidence;
}
