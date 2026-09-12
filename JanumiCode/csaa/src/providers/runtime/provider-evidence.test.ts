import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';
import { sha256 } from '../../inventory/canonical.js';
import {
	cleanupProviderFixtures,
	providerContext,
	providerFixture
} from './provider-evidence.test-support.js';
import {
	ENRICHED_PROVIDER_LIMITS,
	ProviderEvidenceInputError,
	correlateProviderClaims,
	denseArray,
	exactRecord,
	importProviderJson,
	isSha256,
	optionalRecord,
	parseBoundedProviderJson,
	providerArtifactPath,
	safeInteger,
	scalarString,
	type ProviderClaim,
	type ProviderImportContext,
	type ProviderRunInput
} from './provider-evidence.js';

afterEach(cleanupProviderFixtures);

function providerError(action: () => unknown): ProviderEvidenceInputError {
	try {
		action();
	} catch (error) {
		if (error instanceof ProviderEvidenceInputError) return error;
		throw error;
	}
	throw new Error('Expected provider evidence input to fail.');
}

function importFixture(
	context: ProviderImportContext,
	overrides: Partial<Parameters<typeof importProviderJson>[0]> = {}
) {
	return importProviderJson({
		adapterId: 'fixture-adapter',
		adapterVersion: '1.0.0',
		context,
		expectedProviderId: 'fixture-provider',
		normalize: () => ({ completedRegions: ['fixture'], missingRegions: [], observations: [] }),
		raw: '{}',
		supportedProviderVersions: ['1.0.0'],
		...overrides
	});
}

describe('shared enriched-provider evidence boundary', () => {
	it('validates bounded scalar, record, array, and hostile JSON grammar primitives', () => {
		expect(isSha256('a'.repeat(64))).toBe(true);
		expect(isSha256('A'.repeat(64))).toBe(false);
		expect(scalarString('value-\ud83d\ude00', 'value')).toBe('value-\ud83d\ude00');
		for (const candidate of ['', 'bad\nvalue', 'bad\ud800', 'bad\udc00', 'toolong'])
			expect(() => scalarString(candidate, 'value', candidate === 'toolong' ? 3 : 100)).toThrow(
				ProviderEvidenceInputError
			);
		expect(safeInteger(2, 'count', 1)).toBe(2);
		for (const candidate of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, '2'])
			expect(() => safeInteger(candidate, 'count')).toThrow(ProviderEvidenceInputError);

		expect(exactRecord({ a: 1 }, ['a'], 'record')).toEqual({ a: 1 });
		expect(optionalRecord({ a: 1, b: 2 }, ['a'], ['b'], 'record')).toEqual({ a: 1, b: 2 });
		for (const candidate of [null, [], { a: 1, b: 2 }, {}])
			expect(() => exactRecord(candidate, ['a'], 'record')).toThrow(ProviderEvidenceInputError);
		for (const candidate of [null, [], { b: 1 }, { a: 1, extra: 2 }])
			expect(() => optionalRecord(candidate, ['a'], ['b'], 'record')).toThrow(
				ProviderEvidenceInputError
			);
		expect(denseArray([1, 2], 'array')).toEqual([1, 2]);
		const sparse = new Array<unknown>(1);
		for (const candidate of [{}, sparse, [1, 2]])
			expect(() => denseArray(candidate, 'array', candidate === sparse ? 2 : 1)).toThrow(
				ProviderEvidenceInputError
			);

		expect(
			parseBoundedProviderJson(' { "array": [ {}, [], true, false, null, -1.2e+3, "x\\n" ] } ')
		).toEqual({ array: [{}, [], true, false, null, -1200, 'x\n'] });
		const jsonFailures: readonly [string | Uint8Array, string][] = [
			['"bad\ud800"', 'JSON_ENCODING_INVALID'],
			[Uint8Array.of(0xff), 'JSON_ENCODING_INVALID'],
			['"unterminated', 'JSON_INVALID'],
			['"bad\nstring"', 'JSON_INVALID'],
			['"\\x"', 'JSON_INVALID'],
			['[1 2]', 'JSON_INVALID'],
			['{1:2}', 'JSON_INVALID'],
			['{"a" 1}', 'JSON_INVALID'],
			['{"a":1 "b":2}', 'JSON_INVALID'],
			['{"a":1,"a":2}', 'JSON_DUPLICATE_KEY'],
			['truth', 'JSON_INVALID'],
			['true false', 'JSON_INVALID'],
			['1e400', 'JSON_NUMBER_INVALID'],
			[
				`${'['.repeat(ENRICHED_PROVIDER_LIMITS.maxDepth + 2)}0${']'.repeat(
					ENRICHED_PROVIDER_LIMITS.maxDepth + 2
				)}`,
				'JSON_BUDGET_EXCEEDED'
			],
			[`"${'x'.repeat(ENRICHED_PROVIDER_LIMITS.maxStringCharacters + 1)}"`, 'JSON_BUDGET_EXCEEDED']
		];
		for (const [candidate, code] of jsonFailures)
			expect(providerError(() => parseBoundedProviderJson(candidate)).code).toBe(code);
	});

	it('confines provider artifact paths to physical repository-relative locations', () => {
		const fixture = providerFixture();
		const file = join(fixture.root, 'packages/demo/src/index.ts');
		expect(providerArtifactPath('packages/demo/src/index.ts', fixture.root)).toBe(
			'packages/demo/src/index.ts'
		);
		expect(providerArtifactPath(file, fixture.root)).toBe('packages/demo/src/index.ts');
		expect(providerArtifactPath(pathToFileURL(file).href, fixture.root)).toBe(
			'packages/demo/src/index.ts'
		);
		expect(providerError(() => providerArtifactPath('file:%', fixture.root)).code).toBe(
			'PATH_INVALID'
		);
		expect(providerError(() => providerArtifactPath('../escape.ts', fixture.root)).code).toBe(
			'PATH_ESCAPE'
		);
		expect(providerError(() => providerArtifactPath(fixture.root, fixture.root)).code).toBe(
			'PATH_INVALID'
		);
		expect(
			providerError(() => providerArtifactPath('packages/demo/package.json/child.ts', fixture.root))
				.code
		).toBe('PATH_INVALID');
		expect(providerError(() => providerArtifactPath('child.ts', file)).code).toBe('PATH_ESCAPE');
	});

	it('correlates provider claims without erasing subject or value disagreements', () => {
		const claim = (overrides: Partial<ProviderClaim> = {}): ProviderClaim => ({
			factId: 'fact:one',
			providerId: 'provider:one',
			subjectId: 'subject:one',
			valueSha256: 'a'.repeat(64),
			...overrides
		});
		expect(correlateProviderClaims([])).toEqual({ conflicts: [], state: 'EMPTY' });
		expect(correlateProviderClaims([claim(), claim({ providerId: 'provider:two' })])).toEqual({
			conflicts: [],
			state: 'AGREEMENT'
		});
		expect(
			correlateProviderClaims([
				claim(),
				claim({ providerId: 'provider:two', valueSha256: 'b'.repeat(64) })
			])
		).toEqual({
			conflicts: [
				{
					factId: 'fact:one',
					providerIds: ['provider:one', 'provider:two'],
					valueSha256s: ['a'.repeat(64), 'b'.repeat(64)]
				}
			],
			state: 'CONFLICTING'
		});
		expect(() => correlateProviderClaims([claim(), claim({ subjectId: 'subject:two' })])).toThrow(
			/different subjects/u
		);
		expect(() => correlateProviderClaims(new Array<ProviderClaim>(10_001))).toThrow(
			/exceeds its limit/u
		);
	});

	it('retains terminal, absent, malformed, partial, conflicting, stale, and redacted run evidence', () => {
		const fixture = providerFixture();
		const base = providerContext(fixture.root, fixture.subject, 'fixture-provider');
		const terminationCases: readonly [ProviderRunInput['termination'], string][] = [
			[{ kind: 'CRASHED', signal: null }, 'CRASHED'],
			[{ budgetMs: 1, kind: 'TIMED_OUT' }, 'TIMED_OUT'],
			[{ exitCode: 2, kind: 'EXITED' }, 'FAILED']
		];
		for (const [termination, health] of terminationCases)
			expect(importFixture({ ...base, run: { ...base.run, termination } })).toMatchObject({
				health,
				usableForCurrentSubject: false
			});
		expect(importFixture(base, { raw: null })).toMatchObject({
			availability: 'ABSENT',
			health: 'FAILED',
			rawArtifact: null
		});
		expect(importFixture(base, { raw: '{' })).toMatchObject({ health: 'MALFORMED' });
		expect(importFixture(base, { raw: 'bad\ud800' })).toMatchObject({
			diagnostics: [{ code: 'JSON_ENCODING_INVALID' }],
			health: 'MALFORMED',
			rawArtifact: null
		});
		expect(
			importFixture(base, { raw: new Uint8Array(ENRICHED_PROVIDER_LIMITS.maxJsonBytes + 1) })
		).toMatchObject({
			diagnostics: [{ code: 'JSON_BUDGET_EXCEEDED' }],
			health: 'MALFORMED',
			rawArtifact: null
		});
		expect(
			importFixture(base, {
				normalize() {
					throw new Error('synthetic normalizer failure');
				}
			})
		).toMatchObject({ diagnostics: [{ code: 'NORMALIZATION_FAILED' }], health: 'MALFORMED' });
		expect(
			importFixture(
				{ ...base, run: { ...base.run, outputComplete: false } },
				{
					normalize: () => ({
						completedRegions: ['done'],
						missingRegions: ['missing'],
						observations: [],
						redactions: ['secret']
					})
				}
			)
		).toMatchObject({ coverage: { state: 'PARTIAL' }, health: 'PARTIAL' });
		expect(
			importFixture(base, {
				expectedProviderId: 'other-provider',
				supportedProviderVersions: ['2.0.0']
			})
		).toMatchObject({
			conflicts: [{ code: 'PROVIDER_IDENTITY_MISMATCH' }, { code: 'PROVIDER_VERSION_UNSUPPORTED' }],
			usableForCurrentSubject: false
		});
		expect(
			importFixture(
				providerContext(fixture.root, fixture.subject, 'fixture-provider', {
					assessedAt: '2026-08-25T12:02:00.000Z',
					freshnessWindowMs: 1
				})
			)
		).toMatchObject({ freshness: { state: 'STALE' } });
		const redacted = importFixture(
			providerContext(fixture.root, fixture.subject, 'fixture-provider', {
				command: ['provider', '--token', 'secret-value', fixture.root]
			})
		);
		expect(redacted.run.command).toEqual(['provider', '<redacted>', '<redacted>', '<repository>']);
	});

	it('rejects malformed run clocks, identities, termination records, and freshness budgets', () => {
		const fixture = providerFixture();
		const base = providerContext(fixture.root, fixture.subject, 'fixture-provider');
		const invalidContexts: readonly ProviderImportContext[] = [
			{ ...base, freshnessWindowMs: -1 },
			{ ...base, run: { ...base.run, outputComplete: 1 as never } },
			{ ...base, run: { ...base.run, startedAt: 'not-a-time' } },
			{ ...base, run: { ...base.run, endedAt: '2026-08-25T11:00:00.000Z' } },
			{ ...base, run: { ...base.run, environmentSha256: 'A'.repeat(64) } },
			{ ...base, run: { ...base.run, profile: 'bad profile' } },
			{ ...base, run: { ...base.run, termination: { exitCode: 1.5, kind: 'EXITED' } } },
			{ ...base, run: { ...base.run, termination: { kind: 'CRASHED', signal: 'bad signal' } } },
			{ ...base, run: { ...base.run, termination: { budgetMs: 0, kind: 'TIMED_OUT' } } }
		];
		for (const context of invalidContexts) expect(() => importFixture(context)).toThrow(TypeError);
	});

	it('rechecks live subject bytes after normalization and rejects a normalization-window race', () => {
		const fixture = providerFixture();
		const context = providerContext(fixture.root, fixture.subject, 'fixture-provider');
		const result = importProviderJson({
			adapterId: 'fixture-adapter',
			adapterVersion: '1.0.0',
			context,
			expectedProviderId: 'fixture-provider',
			normalize: () => {
				writeFileSync(
					join(fixture.root, 'packages/demo/src/index.ts'),
					'export const value = 2;\n',
					'utf8'
				);
				return { completedRegions: ['fixture'], missingRegions: [], observations: ['observed'] };
			},
			raw: '{}',
			supportedProviderVersions: ['1.0.0']
		});
		expect(result).toMatchObject({
			freshness: { state: 'STALE' },
			health: 'HEALTHY',
			usableForCurrentSubject: false
		});
	});

	it('retains subject-identity disagreement without normalizing it into staleness or agreement', () => {
		const fixture = providerFixture();
		const context = providerContext(fixture.root, fixture.subject, 'fixture-provider', {
			subjectManifestSha256: sha256('different-subject-manifest')
		});
		const result = importProviderJson({
			adapterId: 'fixture-adapter',
			adapterVersion: '1.0.0',
			context,
			expectedProviderId: 'fixture-provider',
			normalize: () => ({ completedRegions: ['fixture'], missingRegions: [], observations: [] }),
			raw: '{}',
			supportedProviderVersions: ['1.0.0']
		});
		expect(result).toMatchObject({
			conflicts: [{ code: 'SUBJECT_IDENTITY_MISMATCH' }],
			freshness: { state: 'UNKNOWN' },
			usableForCurrentSubject: false
		});
	});
});
