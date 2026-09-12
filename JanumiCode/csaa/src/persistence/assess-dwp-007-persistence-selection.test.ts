import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { canonicalSemanticJson } from '../semantic/canonical.js';
import {
	DWP_007_PERSISTENCE_SELECTION_CRITERIA,
	DWP_007_PERSISTENCE_SELECTION_EVIDENCE_SCHEMA_VERSION,
	DWP_007_PERSISTENCE_SELECTION_NONCLAIMS,
	DWP_007_PERSISTENCE_SELECTION_OPERATION_VERSION,
	DWP_007_PERSISTENCE_SELECTION_POLICY,
	dwp007PersistenceSelectionImplementationSourceDigest,
	measureContentAddressedFileCandidate,
	type Dwp007PersistenceSelectionEvidence,
	validateDwp007PersistenceSelectionEvidence
} from './assess-dwp-007-persistence-selection.js';

const SOURCES = Object.freeze([
	Object.freeze({
		path: 'packages/csaa/src/persistence/assess-dwp-007-persistence-selection.ts',
		sha256: 'a'.repeat(64)
	}),
	Object.freeze({
		path: 'packages/csaa/src/persistence/content-addressed-file-store.ts',
		sha256: 'b'.repeat(64)
	})
]);
const SOURCE_DIGEST = dwp007PersistenceSelectionImplementationSourceDigest(SOURCES);
const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const EVIDENCE_PATH = resolve(
	REPOSITORY_ROOT,
	'verif/csaa/dwp-007.persistence-selection.evidence.json'
);

function fixtureEvidence(): Dwp007PersistenceSelectionEvidence {
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
						nodeVersion: 'v24.11.1',
						startupMedianMs: 5,
						startupSamplesMs: Object.freeze([6, 4, 5]),
						transactionRollback: true
					})
				})
			})
		}),
		criteria: DWP_007_PERSISTENCE_SELECTION_CRITERIA,
		environment: Object.freeze({
			architecture: 'x64',
			betterSqlite3Version: '12.11.1',
			bunVersion: '1.3.14',
			codingAgentHost: 'BUN_PROCESS_HOST',
			nodeVersion: 'v24.11.1',
			platform: 'win32'
		}),
		gateEffect: 'NONE',
		implementationSourceDigest: SOURCE_DIGEST,
		implementationSources: SOURCES,
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

describe('DWP-007 persistence selection', () => {
	it('exercises file-store reader/writer concurrency, cancellation, rebuild, and exact reuse', () => {
		const probe = measureContentAddressedFileCandidate();
		expect(probe).toMatchObject({
			cancellationPreservedGeneration: true,
			cleanEquivalenceVerified: true,
			concurrentReaderIsolation: true,
			concurrentWriterExclusion: true,
			exactReuse: true,
			rebuildOnUnknownSchema: true,
			reusedGenerationId: probe.updatedGenerationId
		});
		expect(probe.baselineGenerationId).not.toBe(probe.updatedGenerationId);
		expect(probe.startupSamplesMs).toHaveLength(3);
	});

	it('admits the bounded no-SLO technical reuse verdict and checks source identity', () => {
		const evidence = fixtureEvidence();
		expect(validateDwp007PersistenceSelectionEvidence(evidence, SOURCE_DIGEST)).toEqual(evidence);
		expect(evidence.selection).toEqual({
			acceptance: 'TECHNICAL_ACCEPTANCE_SATISFIED_WITHOUT_SLO',
			reasons: expect.any(Array),
			selectedBackend: 'CONTENT_ADDRESSED_FILES',
			technicalReuseVerdict: 'SELECT_IMPLEMENTED_CONTENT_ADDRESSED_FILE_STORE'
		});
		expect(() => validateDwp007PersistenceSelectionEvidence(evidence, '9'.repeat(64))).toThrow(
			/source identity/u
		);
	});

	it('keeps the checked evidence canonical and bound to its implementation sources', () => {
		const text = readFileSync(EVIDENCE_PATH, 'utf8');
		const parsed = JSON.parse(text) as Dwp007PersistenceSelectionEvidence;
		const sources = parsed.implementationSources.map((source) => {
			const path = resolve(REPOSITORY_ROOT, source.path);
			const status = lstatSync(path);
			expect(status.isFile()).toBe(true);
			expect(status.isSymbolicLink()).toBe(false);
			return {
				path: source.path,
				sha256: createHash('sha256').update(readFileSync(path)).digest('hex')
			};
		});
		const sourceDigest = dwp007PersistenceSelectionImplementationSourceDigest(sources);
		const evidence = validateDwp007PersistenceSelectionEvidence(parsed, sourceDigest);
		expect(`${canonicalSemanticJson(evidence)}\n`).toBe(text);
	});

	it('rejects fabricated compatibility, timing, selection, and accessor claims', () => {
		const evidence = fixtureEvidence();
		expect(() =>
			validateDwp007PersistenceSelectionEvidence({
				...evidence,
				candidates: {
					...evidence.candidates,
					sqliteBetterSqlite3: {
						...evidence.candidates.sqliteBetterSqlite3,
						controls: {
							...evidence.candidates.sqliteBetterSqlite3.controls,
							activeHostCompatibility: 'PASS_MEASURED_BUN_WINDOWS'
						}
					}
				}
			})
		).toThrow(/disagrees/u);
		expect(() =>
			validateDwp007PersistenceSelectionEvidence({
				...evidence,
				candidates: {
					...evidence.candidates,
					contentAddressedFiles: {
						...evidence.candidates.contentAddressedFiles,
						probe: {
							...evidence.candidates.contentAddressedFiles.probe,
							startupMedianMs: 99
						}
					}
				}
			})
		).toThrow(/file probe/u);
		expect(() =>
			validateDwp007PersistenceSelectionEvidence({
				...evidence,
				selection: { ...evidence.selection, selectedBackend: 'SQLITE_BETTER_SQLITE3' }
			})
		).toThrow(/selection/u);
		let invoked = false;
		const hostile = Object.create(null) as Record<string, unknown>;
		for (const [key, value] of Object.entries(evidence)) {
			if (key === 'gateEffect') continue;
			Object.defineProperty(hostile, key, { enumerable: true, value });
		}
		Object.defineProperty(hostile, 'gateEffect', {
			enumerable: true,
			get() {
				invoked = true;
				return 'NONE';
			}
		});
		expect(() => validateDwp007PersistenceSelectionEvidence(hostile)).toThrow(/non-data/u);
		expect(invoked).toBe(false);
	});

	it('rejects noncanonical source paths and duplicate source identities', () => {
		expect(() =>
			dwp007PersistenceSelectionImplementationSourceDigest([
				{ path: '../escape.ts', sha256: 'a'.repeat(64) }
			])
		).toThrow(/invalid/u);
		expect(() =>
			dwp007PersistenceSelectionImplementationSourceDigest([
				{ path: 'same.ts', sha256: 'a'.repeat(64) },
				{ path: 'same.ts', sha256: 'b'.repeat(64) }
			])
		).toThrow(/duplicate/u);
	});
});
