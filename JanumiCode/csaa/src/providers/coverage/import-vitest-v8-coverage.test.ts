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

	it('rejects malformed denominator, range, digest, and source-map boundaries', () => {
		const fixture = providerFixture();
		const source = fixture.subject.artifacts.find(
			(artifact) => artifact.path === 'packages/demo/src/index.ts'
		)!;
		const context = providerContext(fixture.root, fixture.subject, VITEST_V8_COVERAGE_PROVIDER_ID);
		const malformedCases: readonly [string, (value: ReturnType<typeof coverage>) => void][] = [
			[
				'duplicate denominator paths',
				(value) => value.includedSources.push('packages/demo/src/index.ts')
			],
			[
				'noncanonical denominator order',
				(value) => {
					value.includedSources = ['packages/demo/src/index.ts', 'package.json'];
				}
			],
			[
				'nonboolean block coverage marker',
				(value) => Object.assign(value.scripts[0]!.functions[0]!, { isBlockCoverage: 'yes' })
			],
			[
				'empty or reversed range',
				(value) => {
					value.scripts[0]!.functions[0]!.ranges[0]!.endOffset = 0;
				}
			],
			[
				'missing function root range',
				(value) => {
					value.scripts[0]!.functions[0]!.ranges = [];
				}
			],
			[
				'child range escaping the root',
				(value) => {
					value.scripts[0]!.functions[0]!.ranges.push({
						count: 1,
						endOffset: 21,
						startOffset: 1
					});
				}
			],
			[
				'unsupported schema',
				(value) => Object.assign(value, { schemaVersion: 'vitest-v8-coverage/0' })
			],
			[
				'empty denominator',
				(value) => {
					value.includedSources = [];
				}
			],
			[
				'denominator outside the subject',
				(value) => {
					value.includedSources = ['packages/demo/src/absent.ts'];
				}
			],
			[
				'classification outside the denominator',
				(value) => {
					value.missingSources = ['packages/demo/src/index.test.ts'];
				}
			],
			[
				'overlapping missing and uncovered populations',
				(value) => {
					value.includedSources = ['packages/demo/src/index.test.ts', 'packages/demo/src/index.ts'];
					value.missingSources = ['packages/demo/src/index.test.ts'];
					value.uncoveredSources = ['packages/demo/src/index.test.ts'];
				}
			],
			[
				'script outside the denominator',
				(value) => {
					value.includedSources = ['packages/demo/src/index.test.ts'];
				}
			],
			[
				'script classified twice',
				(value) => {
					value.uncoveredSources = ['packages/demo/src/index.ts'];
				}
			],
			[
				'invalid source digest',
				(value) => {
					value.scripts[0]!.sourceSha256 = 'not-a-digest';
				}
			],
			[
				'source-map generated-file mismatch',
				(value) => {
					value.scripts[0]!.sourceMap.file = 'packages/demo/generated/other.js';
				}
			],
			[
				'source-map source mismatch',
				(value) => {
					value.scripts[0]!.sourceMap.sources = ['../src/index.test.ts'];
				}
			],
			[
				'incompletely classified denominator',
				(value) => {
					value.includedSources = ['packages/demo/src/index.test.ts', 'packages/demo/src/index.ts'];
				}
			]
		];

		for (const [label, mutate] of malformedCases) {
			const value = coverage(source.sha256);
			mutate(value);
			expect(importVitestV8Coverage(JSON.stringify(value), context), label).toMatchObject({
				health: 'MALFORMED',
				usableForCurrentSubject: false
			});
		}
	});

	it('materializes and canonically orders explicit uncovered-source observations', () => {
		const fixture = providerFixture();
		const source = fixture.subject.artifacts.find(
			(artifact) => artifact.path === 'packages/demo/src/index.ts'
		)!;
		const value = coverage(source.sha256);
		value.includedSources = ['packages/demo/src/index.test.ts', 'packages/demo/src/index.ts'];
		value.uncoveredSources = ['packages/demo/src/index.test.ts'];

		const result = importVitestV8Coverage(
			JSON.stringify(value),
			providerContext(fixture.root, fixture.subject, VITEST_V8_COVERAGE_PROVIDER_ID)
		);
		expect(result).toMatchObject({
			coverage: { state: 'COMPLETE' },
			health: 'HEALTHY',
			usableForCurrentSubject: true
		});
		expect(
			result.observations.map((observation) => [observation.sourcePath, observation.state])
		).toEqual([
			['packages/demo/src/index.test.ts', 'UNCOVERED'],
			['packages/demo/src/index.ts', 'COVERED']
		]);
	});
});
