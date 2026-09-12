import { performance } from 'node:perf_hooks';

import { describe, expect, it } from 'vitest';

import { validateGuardEnforcementLedgerArtifactSet } from './artifact-set.js';
import { validateGuardEnforcementLedgerObservation } from './validate-guard-enforcement-ledger.js';

describe('guard-enforcement-ledger observation validator hardening', () => {
	it('rejects a container in an artifact scalar slot before canonicalization', () => {
		const hostilePath = new Array(1_000_000).fill('x');
		const hostile = {
			artifacts: [
				{
					bytes: 1,
					canonicalPathKey: 'x',
					path: hostilePath,
					primaryClass: 'SOURCE',
					semanticRoles: [],
					sha256: '0'.repeat(64),
					uses: []
				}
			],
			canonicalProfile: 'x',
			contentDigest: 'x',
			coverage: {
				analyzerArtifacts: 0,
				analyzerDependencyArtifacts: 0,
				artifacts: 1,
				authorityTestArtifacts: 0,
				enforcementSiteArtifacts: 0,
				ledgerDataArtifacts: 0,
				packageSourceArtifacts: 0,
				reconciles: true,
				stateMachineDeclarationArtifacts: 0,
				totalBytes: 1
			},
			id: 'x',
			method: 'x',
			operationVersion: 'x',
			schemaVersion: 'x',
			subjectId: 'x'
		};
		const startedAt = performance.now();
		const result = validateGuardEnforcementLedgerArtifactSet(hostile, undefined, {
			maxIssues: 1,
			maxRecords: 1,
			maxStringCharacters: 1_000
		});
		const elapsedMs = performance.now() - startedAt;

		expect(result).toMatchObject({
			issues: [{ code: 'SHAPE_INVALID', path: '$.artifacts[0].path' }],
			state: 'INVALID'
		});
		expect(elapsedMs).toBeLessThan(250);
	});

	it('rejects an oversized array from its length before enumerating its entries', () => {
		const hostile = { artifactSet: new Array(1_000_000).fill('x') };
		const startedAt = performance.now();
		const result = validateGuardEnforcementLedgerObservation(hostile, undefined, {
			maxIssues: 1,
			maxRecords: 2,
			maxStringCharacters: 1
		});
		const elapsedMs = performance.now() - startedAt;

		expect(result).toMatchObject({
			issues: [{ code: 'SHAPE_INVALID' }],
			state: 'INVALID'
		});
		// The million entries are constructed before timing. This guard detects a
		// regression to own-key enumeration before the length budget is applied.
		expect(elapsedMs).toBeLessThan(250);
	});

	it('rejects a wide object in a scalar observation slot before enumerating it', () => {
		const hostileScalar = Object.fromEntries(
			Array.from({ length: 1_000_000 }, (_value, index) => [`key${index}`, 'x'])
		);
		const hostile = { subjectId: hostileScalar };
		const startedAt = performance.now();
		const result = validateGuardEnforcementLedgerObservation(hostile, undefined, {
			maxIssues: 1,
			maxRecords: 2,
			maxStringCharacters: 1
		});
		const elapsedMs = performance.now() - startedAt;

		expect(result).toMatchObject({
			issues: [{ code: 'SHAPE_INVALID' }],
			state: 'INVALID'
		});
		expect(elapsedMs).toBeLessThan(250);
	});
});
