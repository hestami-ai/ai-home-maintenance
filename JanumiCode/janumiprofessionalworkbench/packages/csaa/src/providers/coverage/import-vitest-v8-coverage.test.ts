import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import {
	cleanupProviderFixtures,
	providerContext,
	providerFixture
} from '../runtime/provider-evidence.test-support.js';
import {
	importVitestV8Coverage,
	VITEST_V8_COVERAGE_INPUT_SCHEMA_VERSION,
	VITEST_V8_COVERAGE_PROVIDER_ID
} from './import-vitest-v8-coverage.js';

afterEach(cleanupProviderFixtures);

function coverage(sourceSha256: string) {
	return {
		includedSources: ['packages/demo/src/index.ts'],
		missingSources: [] as string[],
		schemaVersion: VITEST_V8_COVERAGE_INPUT_SCHEMA_VERSION,
		scripts: [
			{
				functions: [
					{
						functionName: 'value',
						isBlockCoverage: true,
						ranges: [{ count: 1, endOffset: 20, startOffset: 0 }]
					}
				],
				generatedPath: 'packages/demo/generated/index.js',
				sourceMap: {
					file: 'packages/demo/generated/index.js',
					mappings: 'AAAA',
					names: [],
					sourceRoot: '',
					sources: ['../src/index.ts'],
					version: 3
				},
				sourcePath: 'packages/demo/src/index.ts',
				sourceSha256
			}
		],
		uncoveredSources: [] as string[]
	};
}

describe('Vitest V8 coverage evidence adapter', () => {
	it('binds a real-small V8 range set through a validated source map to current subject bytes', () => {
		const fixture = providerFixture();
		const source = fixture.subject.artifacts.find(
			(artifact) => artifact.path === 'packages/demo/src/index.ts'
		)!;
		const result = importVitestV8Coverage(
			JSON.stringify(coverage(source.sha256)),
			providerContext(fixture.root, fixture.subject, VITEST_V8_COVERAGE_PROVIDER_ID)
		);
		expect(result).toMatchObject({
			coverage: { state: 'COMPLETE' },
			freshness: { state: 'CURRENT' },
			health: 'HEALTHY',
			usableForCurrentSubject: true
		});
		expect(result.observations[0]).toMatchObject({
			mappedSegmentCount: 1,
			sourcePath: 'packages/demo/src/index.ts',
			state: 'COVERED'
		});
	});

	it('refuses digest/map/path/vacuity mismatch and preserves an explicitly partial denominator', () => {
		const fixture = providerFixture();
		const source = fixture.subject.artifacts.find(
			(artifact) => artifact.path === 'packages/demo/src/index.ts'
		)!;
		const context = providerContext(fixture.root, fixture.subject, VITEST_V8_COVERAGE_PROVIDER_ID);
		expect(importVitestV8Coverage(JSON.stringify(coverage('a'.repeat(64))), context).health).toBe(
			'MALFORMED'
		);
		const badMap = coverage(source.sha256);
		badMap.scripts[0]!.sourceMap.sources = ['../../../../outside.ts'];
		expect(importVitestV8Coverage(JSON.stringify(badMap), context).health).toBe('MALFORMED');
		const badPath = coverage(source.sha256);
		badPath.scripts[0]!.generatedPath = '../outside.js';
		expect(importVitestV8Coverage(JSON.stringify(badPath), context).health).toBe('MALFORMED');
		const vacuous = coverage(source.sha256);
		vacuous.scripts[0]!.functions[0]!.ranges[0]!.count = 0;
		expect(importVitestV8Coverage(JSON.stringify(vacuous), context).health).toBe('MALFORMED');
		const duplicateRange = coverage(source.sha256);
		duplicateRange.scripts[0]!.functions[0]!.ranges.push({
			...duplicateRange.scripts[0]!.functions[0]!.ranges[0]!
		});
		expect(importVitestV8Coverage(JSON.stringify(duplicateRange), context).health).toBe(
			'MALFORMED'
		);
		const partial = coverage(source.sha256);
		partial.scripts = [];
		partial.missingSources = ['packages/demo/src/index.ts'];
		expect(importVitestV8Coverage(JSON.stringify(partial), context)).toMatchObject({
			coverage: { missingRegions: ['packages/demo/src/index.ts'], state: 'PARTIAL' },
			health: 'PARTIAL',
			usableForCurrentSubject: false
		});
	});

	it('retains a historically mapped report but refuses to call it current after source drift', () => {
		const fixture = providerFixture();
		const source = fixture.subject.artifacts.find(
			(artifact) => artifact.path === 'packages/demo/src/index.ts'
		)!;
		writeFileSync(
			join(fixture.root, 'packages/demo/src/index.ts'),
			'export const value = 2;\n',
			'utf8'
		);
		const result = importVitestV8Coverage(
			JSON.stringify(coverage(source.sha256)),
			providerContext(fixture.root, fixture.subject, VITEST_V8_COVERAGE_PROVIDER_ID)
		);
		expect(result).toMatchObject({
			freshness: { state: 'STALE' },
			health: 'HEALTHY',
			usableForCurrentSubject: false
		});
	});
});
