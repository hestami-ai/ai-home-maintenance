import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import {
	cleanupProviderFixtures,
	providerContext,
	providerFixture
} from '../runtime/provider-evidence.test-support.js';
import { importVitestJson, VITEST_JSON_PROVIDER_ID } from './import-vitest-json.js';

afterEach(cleanupProviderFixtures);

function output(filePath: string) {
	return {
		numFailedTestSuites: 0,
		numFailedTests: 0,
		numPassedTestSuites: 1,
		numPassedTests: 1,
		numPendingTestSuites: 0,
		numPendingTests: 0,
		numRuntimeErrorTestSuites: 0,
		numTotalTestSuites: 1,
		numTotalTests: 1,
		startTime: 1_772_000_000_000,
		success: true,
		testResults: [
			{
				assertionResults: [
					{
						ancestorTitles: ['fixture'],
						duration: 3,
						failureMessages: [] as string[],
						fullName: 'fixture works',
						location: { column: 1, line: 2 },
						status: 'passed',
						title: 'works'
					}
				],
				endTime: 1_772_000_000_003,
				message: '',
				name: filePath,
				startTime: 1_772_000_000_000,
				status: 'passed'
			}
		]
	};
}

describe('Vitest JSON evidence adapter', () => {
	it('normalizes a real-small JSON reporter result with exact test-population accounting', () => {
		const fixture = providerFixture();
		const result = importVitestJson(
			JSON.stringify(output(join(fixture.root, 'packages/demo/src/index.test.ts'))),
			providerContext(fixture.root, fixture.subject, VITEST_JSON_PROVIDER_ID)
		);
		expect(result).toMatchObject({
			coverage: { state: 'COMPLETE' },
			freshness: { state: 'CURRENT' },
			health: 'HEALTHY',
			usableForCurrentSubject: true
		});
		expect(result.observations[0]?.assertions[0]).toMatchObject({
			fullName: 'fixture works',
			state: 'PASSED'
		});
	});

	it('refuses counter mismatch and treats a zero-test report as partial rather than empty success', () => {
		const fixture = providerFixture();
		const context = providerContext(fixture.root, fixture.subject, VITEST_JSON_PROVIDER_ID);
		const mismatched = output(join(fixture.root, 'packages/demo/src/index.test.ts'));
		mismatched.numPassedTests = 2;
		expect(importVitestJson(JSON.stringify(mismatched), context).health).toBe('MALFORMED');
		const empty = {
			...output(join(fixture.root, 'packages/demo/src/index.test.ts')),
			numPassedTestSuites: 0,
			numPassedTests: 0,
			numTotalTestSuites: 0,
			numTotalTests: 0,
			testResults: []
		};
		expect(importVitestJson(JSON.stringify(empty), context)).toMatchObject({
			coverage: { state: 'PARTIAL' },
			health: 'PARTIAL',
			usableForCurrentSubject: false
		});
	});

	it('normalizes all assertion states and records optional reporter-payload redactions', () => {
		const fixture = providerFixture();
		const value = output(join(fixture.root, 'packages/demo/src/index.test.ts'));
		const assertion = value.testResults[0]!.assertionResults[0]!;
		value.testResults[0]!.assertionResults = [
			{ ...assertion, failureMessages: ['failure text'], status: 'failed', title: 'failed' },
			{ ...assertion, status: 'passed', title: 'passed' },
			{ ...assertion, status: 'todo', title: 'todo' },
			{ ...assertion, status: 'pending', title: 'pending' },
			{ ...assertion, status: 'skipped', title: 'skipped' },
			{ ...assertion, status: 'disabled', title: 'disabled' }
		];
		value.numFailedTestSuites = 1;
		value.numFailedTests = 1;
		value.numPassedTestSuites = 0;
		value.numPassedTests = 1;
		value.numPendingTests = 4;
		value.numTotalTests = 6;
		value.success = false;
		value.testResults[0]!.status = 'failed';
		Object.assign(value, { snapshot: { unchecked: 0 }, wasInterrupted: false });
		Object.assign(value.testResults[0]!, { coverage: {}, perfStats: {}, summary: '' });

		const result = importVitestJson(
			JSON.stringify(value),
			providerContext(fixture.root, fixture.subject, VITEST_JSON_PROVIDER_ID)
		);
		expect(result.health).toBe('HEALTHY');
		expect(result.observations[0]!.assertions.map((entry) => entry.state)).toEqual([
			'FAILED',
			'PASSED',
			'TODO',
			'SKIPPED',
			'SKIPPED',
			'SKIPPED'
		]);
		expect(result.redactions).toEqual(
			expect.arrayContaining([
				'VITEST_COVERAGE_PAYLOAD',
				'VITEST_PERFSTATS_PAYLOAD',
				'VITEST_SNAPSHOT_PAYLOAD',
				'VITEST_SUMMARY_PAYLOAD'
			])
		);
	});

	it('sorts file observations and rejects hostile file and assertion structure', () => {
		const fixture = providerFixture();
		const context = providerContext(fixture.root, fixture.subject, VITEST_JSON_PROVIDER_ID);
		const value = output(join(fixture.root, 'packages/demo/src/index.test.ts'));
		value.testResults.push({
			...value.testResults[0]!,
			name: join(fixture.root, 'packages/demo/src/index.ts')
		});
		value.numPassedTestSuites = 2;
		value.numPassedTests = 2;
		value.numTotalTestSuites = 2;
		value.numTotalTests = 2;
		expect(
			importVitestJson(JSON.stringify(value), context).observations.map((file) => file.path)
		).toEqual(['packages/demo/src/index.test.ts', 'packages/demo/src/index.ts']);

		const malformedValues: unknown[] = [];
		const outside = output(join(fixture.root, 'packages/demo/src/missing.test.ts'));
		malformedValues.push(outside);
		const duplicate = output(join(fixture.root, 'packages/demo/src/index.test.ts'));
		duplicate.testResults.push({ ...duplicate.testResults[0]! });
		malformedValues.push(duplicate);
		const unsupportedFileState = output(join(fixture.root, 'packages/demo/src/index.test.ts'));
		unsupportedFileState.testResults[0]!.status = 'unknown';
		malformedValues.push(unsupportedFileState);
		const reversedTime = output(join(fixture.root, 'packages/demo/src/index.test.ts'));
		reversedTime.testResults[0]!.endTime = reversedTime.testResults[0]!.startTime - 1;
		malformedValues.push(reversedTime);
		const unsupportedAssertionState = output(join(fixture.root, 'packages/demo/src/index.test.ts'));
		unsupportedAssertionState.testResults[0]!.assertionResults[0]!.status = 'unknown';
		malformedValues.push(unsupportedAssertionState);
		const invalidDuration = output(join(fixture.root, 'packages/demo/src/index.test.ts'));
		invalidDuration.testResults[0]!.assertionResults[0]!.duration = -1;
		malformedValues.push(invalidDuration);

		for (const malformed of malformedValues)
			expect(importVitestJson(JSON.stringify(malformed), context).health).toBe('MALFORMED');
	});

	it('rejects unsafe redacted text and incoherent run markers', () => {
		const fixture = providerFixture();
		const context = providerContext(fixture.root, fixture.subject, VITEST_JSON_PROVIDER_ID);
		const scalarText = output(join(fixture.root, 'packages/demo/src/index.test.ts'));
		scalarText.testResults[0]!.message = 'Valid scalar pair \ud83d\ude00';
		expect(importVitestJson(JSON.stringify(scalarText), context).health).toBe('HEALTHY');
		for (const invalidText of [0, '\u0000', '\ud800', '\udc00']) {
			const value = output(join(fixture.root, 'packages/demo/src/index.test.ts'));
			value.testResults[0]!.message = invalidText as string;
			expect(importVitestJson(JSON.stringify(value), context).health).toBe('MALFORMED');
		}
		for (const mutation of [
			(value: ReturnType<typeof output>) => Object.assign(value, { success: 'yes' }),
			(value: ReturnType<typeof output>) => Object.assign(value, { wasInterrupted: 'yes' }),
			(value: ReturnType<typeof output>) => Object.assign(value, { success: false }),
			(value: ReturnType<typeof output>) =>
				Object.assign(value, { success: true, wasInterrupted: true })
		]) {
			const value = output(join(fixture.root, 'packages/demo/src/index.test.ts'));
			mutation(value);
			expect(importVitestJson(JSON.stringify(value), context).health).toBe('MALFORMED');
		}
	});
});
