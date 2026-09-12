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

function parsedReport(filePath: string): Array<Record<string, unknown>> {
	return JSON.parse(report(filePath)) as Array<Record<string, unknown>>;
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

	it('normalizes error details, optional payloads, and deterministic file order', () => {
		const fixture = providerFixture();
		const context = providerContext(fixture.root, fixture.subject, ESLINT_JSON_PROVIDER_ID);
		const first = parsedReport(join(fixture.root, 'packages/demo/src/index.test.ts'))[0]!;
		const firstMessage = (first.messages as Array<Record<string, unknown>>)[0]!;
		Object.assign(firstMessage, {
			endColumn: 12,
			endLine: 1,
			fatal: true,
			fix: { range: [0, 1], text: '' },
			messageId: null,
			nodeType: null,
			ruleId: null,
			severity: 2,
			suggestions: []
		});
		Object.assign(first, {
			errorCount: 1,
			fatalErrorCount: 1,
			fixableErrorCount: 1,
			fixableWarningCount: 0,
			suppressedMessages: [],
			usedDeprecatedRules: [],
			warningCount: 0
		});
		const second = parsedReport(join(fixture.root, 'packages/demo/src/index.ts'))[0]!;
		const result = importEslintJson(JSON.stringify([first, second]), context);
		expect(result.health).toBe('HEALTHY');
		expect(result.observations.map((observation) => observation.path)).toEqual([
			'packages/demo/src/index.test.ts',
			'packages/demo/src/index.ts'
		]);
		expect(result.observations[0]!.messages[0]).toMatchObject({
			endColumn: 12,
			endLine: 1,
			fatal: true,
			messageId: null,
			nodeType: null,
			ruleId: null,
			severity: 2
		});
		expect(result.redactions).toEqual(
			expect.arrayContaining([
				'ESLINT_MESSAGE_TEXT_AND_FIX_PAYLOAD',
				'ESLINT_SOURCE_TEXT',
				'ESLINT_SUPPRESSED_MESSAGE_PAYLOAD'
			])
		);
	});

	it('refuses hostile text, invalid message fields, duplicate files, and counter overclaims', () => {
		const fixture = providerFixture();
		const context = providerContext(fixture.root, fixture.subject, ESLINT_JSON_PROVIDER_ID);
		const mutateMessage = (field: string, value: unknown): Array<Record<string, unknown>> => {
			const root = parsedReport(join(fixture.root, 'packages/demo/src/index.ts'));
			const message = (root[0]!.messages as Array<Record<string, unknown>>)[0]!;
			message[field] = value;
			return root;
		};
		for (const malformed of [
			mutateMessage('message', 0),
			mutateMessage('message', '\u0000'),
			mutateMessage('message', '\ud800'),
			mutateMessage('message', '\udc00'),
			mutateMessage('severity', 3),
			mutateMessage('fatal', 'yes'),
			mutateMessage('endLine', 0),
			mutateMessage('endColumn', 0)
		])
			expect(importEslintJson(JSON.stringify(malformed), context).health).toBe('MALFORMED');

		const reversed = mutateMessage('endLine', 1);
		Object.assign((reversed[0]!.messages as Array<Record<string, unknown>>)[0]!, { endColumn: 7 });
		expect(importEslintJson(JSON.stringify(reversed), context).health).toBe('MALFORMED');
		const outside = parsedReport(join(fixture.root, 'packages/demo/src/missing.ts'));
		expect(importEslintJson(JSON.stringify(outside), context).health).toBe('MALFORMED');
		const duplicate = parsedReport(join(fixture.root, 'packages/demo/src/index.ts'));
		duplicate.push({ ...duplicate[0]! });
		expect(importEslintJson(JSON.stringify(duplicate), context).health).toBe('MALFORMED');
		for (const field of ['fixableErrorCount', 'fixableWarningCount']) {
			const overclaim = parsedReport(join(fixture.root, 'packages/demo/src/index.ts'));
			overclaim[0]![field] = 2;
			expect(importEslintJson(JSON.stringify(overclaim), context).health).toBe('MALFORMED');
		}
		const scalarText = parsedReport(join(fixture.root, 'packages/demo/src/index.ts'));
		(scalarText[0]!.messages as Array<Record<string, unknown>>)[0]!.message =
			'Valid scalar pair \ud83d\ude00';
		expect(importEslintJson(JSON.stringify(scalarText), context).health).toBe('HEALTHY');
	});
});
