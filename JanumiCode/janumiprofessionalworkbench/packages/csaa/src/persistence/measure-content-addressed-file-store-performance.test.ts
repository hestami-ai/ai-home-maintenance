import { describe, expect, it } from 'vitest';

import {
	CONTENT_ADDRESSED_STORE_PERFORMANCE_ASSESSMENT,
	CONTENT_ADDRESSED_STORE_PERFORMANCE_NONCLAIMS,
	contentAddressedStorePerformanceImplementationSourceDigest,
	measureContentAddressedStorePerformance,
	validateContentAddressedStorePerformanceEvidence
} from './measure-content-addressed-file-store-performance.js';

const IMPLEMENTATION_SOURCES = Object.freeze([
	Object.freeze({
		path: 'packages/csaa/src/persistence/content-addressed-file-store.ts',
		sha256: 'a'.repeat(64)
	}),
	Object.freeze({
		path: 'packages/csaa/src/persistence/measure-content-addressed-file-store-performance.ts',
		sha256: 'b'.repeat(64)
	}),
	Object.freeze({ path: 'scripts/csaa-content-store-performance.ts', sha256: 'c'.repeat(64) })
]);
const IMPLEMENTATION_SOURCE_DIGEST =
	contentAddressedStorePerformanceImplementationSourceDigest(IMPLEMENTATION_SOURCES);

const ENVIRONMENT = Object.freeze({
	architecture: 'fixture-arch',
	cpuModel: 'fixture-cpu',
	engine: 'node' as const,
	engineVersion: 'fixture-runtime',
	platform: 'fixture-platform'
});

function measuredEvidence() {
	return measureContentAddressedStorePerformance({
		configuration: { artifactCount: 12, computeRounds: 1_024, inputCount: 4, samples: 3 },
		environment: ENVIRONMENT,
		implementationSources: IMPLEMENTATION_SOURCES,
		now: () => '2026-08-25T00:00:00.000Z'
	});
}

describe('content-addressed store cold/warm performance evidence', () => {
	it('measures repeated exact reuse and validates its empirical non-authoritative record', () => {
		const evidence = measureContentAddressedStorePerformance({
			configuration: { artifactCount: 24, computeRounds: 1_024, inputCount: 8, samples: 3 },
			environment: ENVIRONMENT,
			implementationSources: IMPLEMENTATION_SOURCES,
			now: () => '2026-08-25T00:00:00.000Z'
		});
		expect(evidence).toMatchObject({
			analysisAuthority: 'NONE',
			assessment: CONTENT_ADDRESSED_STORE_PERFORMANCE_ASSESSMENT,
			gateEffect: 'NONE',
			implementationSourceDigest: IMPLEMENTATION_SOURCE_DIGEST,
			nonclaims: CONTENT_ADDRESSED_STORE_PERFORMANCE_NONCLAIMS
		});
		expect(evidence.measurement.observedWarmMedianLowerThanColdMedian).toBe(
			evidence.measurement.warmMedianMs < evidence.measurement.coldMedianMs
		);
		for (const sample of evidence.samples)
			expect(sample).toMatchObject({
				cold: { computedArtifacts: 24, reusedArtifacts: 0, reusedBytes: 0 },
				identicalArtifacts: true,
				warm: { computedArtifacts: 0, computedBytes: 0, reusedArtifacts: 24 }
			});
		expect(
			validateContentAddressedStorePerformanceEvidence(evidence, IMPLEMENTATION_SOURCE_DIGEST)
		).toEqual(evidence);
		expect(
			new Set(evidence.samples.map(({ artifactWitnessSha256 }) => artifactWitnessSha256)).size
		).toBe(1);
		expect(new Set(evidence.samples.map(({ generationId }) => generationId)).size).toBe(1);
	});

	it('rejects stale source identity and falsified reuse, population, or timing claims', () => {
		const evidence = measuredEvidence();
		expect(() =>
			validateContentAddressedStorePerformanceEvidence(evidence, 'b'.repeat(64))
		).toThrow(/stale/u);
		expect(() =>
			validateContentAddressedStorePerformanceEvidence({
				...evidence,
				samples: evidence.samples.map((sample, index) =>
					index === 0 ? { ...sample, warm: { ...sample.warm, computedArtifacts: 1 } } : sample
				)
			})
		).toThrow(/reuse accounting/u);
		expect(() =>
			validateContentAddressedStorePerformanceEvidence({
				...evidence,
				measurement: { ...evidence.measurement, warmMedianMs: evidence.measurement.coldMedianMs }
			})
		).toThrow(/median measurement/u);
		expect(() =>
			validateContentAddressedStorePerformanceEvidence({
				...evidence,
				implementationSources: evidence.implementationSources.map((source, index) =>
					index === 0 ? { ...source, sha256: 'd'.repeat(64) } : source
				)
			})
		).toThrow(/source identity/u);
		expect(() =>
			validateContentAddressedStorePerformanceEvidence({
				...evidence,
				samples: evidence.samples.map((sample, index) =>
					index === 0 ? { ...sample, artifactWitnessSha256: 'e'.repeat(64) } : sample
				)
			})
		).toThrow(/deterministic artifact population/u);
		const noObservedImprovement = {
			...evidence,
			measurement: {
				coldMedianMs: evidence.measurement.coldMedianMs,
				observedWarmMedianLowerThanColdMedian: false,
				warmMedianMs: evidence.measurement.coldMedianMs
			},
			samples: evidence.samples.map((sample) => ({
				...sample,
				warm: { ...sample.warm, elapsedMs: sample.cold.elapsedMs }
			}))
		};
		expect(
			validateContentAddressedStorePerformanceEvidence(noObservedImprovement).measurement
				.observedWarmMedianLowerThanColdMedian
		).toBe(false);
	});

	it('rejects incomplete workloads, noncanonical instants, and nested accessors without invoking them', () => {
		expect(() =>
			measureContentAddressedStorePerformance({
				configuration: { artifactCount: 2, computeRounds: 1, inputCount: 3, samples: 3 },
				environment: ENVIRONMENT,
				implementationSources: IMPLEMENTATION_SOURCES
			})
		).toThrow(/inputCount/u);
		expect(() =>
			measureContentAddressedStorePerformance({
				configuration: { artifactCount: 2, computeRounds: 1, inputCount: 1, samples: 2 },
				environment: ENVIRONMENT,
				implementationSources: IMPLEMENTATION_SOURCES
			})
		).toThrow(/samples/u);
		expect(() =>
			measureContentAddressedStorePerformance({
				configuration: { artifactCount: 2, computeRounds: 1, inputCount: 1, samples: 3 },
				environment: ENVIRONMENT,
				implementationSources: IMPLEMENTATION_SOURCES,
				now: () => '2026-08-25T00:00:00Z'
			})
		).toThrow(/canonical ISO/u);
		expect(() =>
			contentAddressedStorePerformanceImplementationSourceDigest([
				{ path: 'C:/absolute.ts', sha256: 'a'.repeat(64) }
			])
		).toThrow(/canonical relative path/u);
		const evidence = measuredEvidence();
		let invoked = false;
		const hostileWarm = Object.create(null) as Record<string, unknown>;
		for (const [key, value] of Object.entries(evidence.samples[0]!.warm)) {
			if (key === 'computedArtifacts') continue;
			Object.defineProperty(hostileWarm, key, {
				enumerable: true,
				value
			});
		}
		Object.defineProperty(hostileWarm, 'computedArtifacts', {
			enumerable: true,
			get: () => {
				invoked = true;
				return 0;
			}
		});
		expect(() =>
			validateContentAddressedStorePerformanceEvidence({
				...evidence,
				samples: [{ ...evidence.samples[0]!, warm: hostileWarm }, ...evidence.samples.slice(1)]
			})
		).toThrow(/data property/u);
		expect(invoked).toBe(false);
	});
});
