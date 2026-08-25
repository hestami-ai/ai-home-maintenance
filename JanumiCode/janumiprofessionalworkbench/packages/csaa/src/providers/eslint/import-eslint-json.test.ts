import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import { sha256 } from '../../inventory/canonical.js';
import {
	cleanupProviderFixtures,
	providerContext,
	providerFixture
} from '../runtime/provider-evidence.test-support.js';
import { correlateProviderClaims, parseBoundedProviderJson } from '../runtime/provider-evidence.js';
import { ESLINT_JSON_PROVIDER_ID, importEslintJson } from './import-eslint-json.js';

afterEach(cleanupProviderFixtures);

function report(filePath: string): string {
	return JSON.stringify([
		{
			errorCount: 0,
			fatalErrorCount: 0,
			filePath,
			fixableErrorCount: 0,
			fixableWarningCount: 0,
			messages: [
				{
					column: 8,
					line: 1,
					message: 'Do not disclose token=canary-secret',
					messageId: 'rule-message',
					nodeType: 'Identifier',
					ruleId: 'fixture/no-value',
					severity: 1
				}
			],
			source: 'export const token = "canary-secret";\n',
			warningCount: 1
		}
	]);
}

describe('ESLint machine-output evidence adapter', () => {
	it('imports a real-small JSON formatter result while retaining only digests for sensitive text', () => {
		const fixture = providerFixture();
		const result = importEslintJson(
			report(join(fixture.root, 'packages/demo/src/index.ts')),
			providerContext(fixture.root, fixture.subject, ESLINT_JSON_PROVIDER_ID)
		);
		expect(result).toMatchObject({
			analysisAuthority: 'NONE',
			availability: 'PRESENT',
			freshness: { state: 'CURRENT' },
			gateEffect: 'NONE',
			health: 'HEALTHY',
			usableForCurrentSubject: true
		});
		expect(result.observations[0]).toMatchObject({
			path: 'packages/demo/src/index.ts',
			warningCount: 1
		});
		expect(result.redactions).toContain('ESLINT_MESSAGE_TEXT_AND_FIX_PAYLOAD');
		expect(JSON.stringify(result)).not.toContain('canary-secret');
	});

	it('preserves absence, staleness, partial output, crash, timeout, and provider conflict independently', () => {
		const fixture = providerFixture();
		const current = providerContext(fixture.root, fixture.subject, ESLINT_JSON_PROVIDER_ID);
		expect(importEslintJson(null, current)).toMatchObject({
			availability: 'ABSENT',
			health: 'FAILED',
			usableForCurrentSubject: false
		});
		expect(importEslintJson('[]', current)).toMatchObject({
			coverage: { state: 'PARTIAL' },
			health: 'PARTIAL'
		});
		expect(
			importEslintJson(
				report(join(fixture.root, 'packages/demo/src/index.ts')),
				providerContext(fixture.root, fixture.subject, ESLINT_JSON_PROVIDER_ID, {
					assessedAt: '2026-08-25T13:00:00.000Z',
					freshnessWindowMs: 1_000
				})
			)
		).toMatchObject({ freshness: { state: 'STALE' }, usableForCurrentSubject: false });
		expect(
			importEslintJson(
				report(join(fixture.root, 'packages/demo/src/index.ts')),
				providerContext(fixture.root, fixture.subject, ESLINT_JSON_PROVIDER_ID, {
					termination: { kind: 'CRASHED', signal: 'SIGABRT' }
				})
			)
		).toMatchObject({ health: 'CRASHED', observations: [] });
		expect(
			importEslintJson(
				report(join(fixture.root, 'packages/demo/src/index.ts')),
				providerContext(fixture.root, fixture.subject, ESLINT_JSON_PROVIDER_ID, {
					termination: { budgetMs: 1_000, kind: 'TIMED_OUT' }
				})
			)
		).toMatchObject({ health: 'TIMED_OUT', observations: [] });
		const conflict = importEslintJson(
			report(join(fixture.root, 'packages/demo/src/index.ts')),
			providerContext(fixture.root, fixture.subject, 'different-provider')
		);
		expect(conflict.conflicts.some((entry) => entry.code === 'PROVIDER_IDENTITY_MISMATCH')).toBe(
			true
		);
		expect(conflict.usableForCurrentSubject).toBe(false);
	});

	it('refuses malicious paths, duplicate JSON keys, invalid UTF-8, and incoherent counters', () => {
		const fixture = providerFixture();
		const context = providerContext(fixture.root, fixture.subject, ESLINT_JSON_PROVIDER_ID);
		expect(importEslintJson(report(join(fixture.root, '..', 'escape.ts')), context)).toMatchObject({
			health: 'MALFORMED',
			observations: []
		});
		expect(
			importEslintJson('[{"filePath":"a","filePath":"b"}]', context).diagnostics[0]?.code
		).toBe('JSON_DUPLICATE_KEY');
		expect(importEslintJson(Uint8Array.of(0xff, 0xfe), context).diagnostics[0]?.code).toBe(
			'JSON_ENCODING_INVALID'
		);
		const incoherent = JSON.parse(
			report(join(fixture.root, 'packages/demo/src/index.ts'))
		) as Array<Record<string, unknown>>;
		incoherent[0]!.warningCount = 0;
		expect(importEslintJson(JSON.stringify(incoherent), context).health).toBe('MALFORMED');
		expect(() => parseBoundedProviderJson('{"a":1,"a":2}')).toThrow('duplicate JSON key');
	});

	it('retains cross-provider disagreement instead of choosing a preferred claim', () => {
		const subjectId = 'subject-1';
		const correlation = correlateProviderClaims([
			{ factId: 'module-edge', providerId: 'typescript', subjectId, valueSha256: sha256('yes') },
			{
				factId: 'module-edge',
				providerId: 'dependency-cruiser',
				subjectId,
				valueSha256: sha256('no')
			}
		]);
		expect(correlation).toMatchObject({ state: 'CONFLICTING' });
		expect(correlation.conflicts[0]?.providerIds).toEqual(['dependency-cruiser', 'typescript']);
	});
});
