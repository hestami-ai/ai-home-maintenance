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
						failureMessages: [],
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
});
