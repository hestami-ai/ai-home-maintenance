import { describe, expect, it } from 'vitest';

import {
	ARROW_COMMAND_CENSUS_ADAPTER_ID,
	ARROW_COMMAND_CENSUS_ARTIFACT_SET_SCHEMA_VERSION,
	ARROW_COMMAND_CENSUS_METHOD,
	ARROW_COMMAND_CENSUS_OPERATION_VERSION,
	ARROW_COMMAND_CENSUS_RAW_OUTPUT_SCHEMA_VERSION,
	ARROW_COMMAND_CENSUS_REQUEST_SCHEMA_VERSION,
	type ArrowCommandCensusArtifactSetBinding,
	type ArrowCommandCensusBudgets,
	type ArrowCommandCensusExecutorIdentity,
	type ArrowCommandCensusRawOutput,
	type ObserveArrowCommandCensusRequest
} from '../../contracts/arrow-command-census.js';
import {
	arrowCommandCensusArtifactSetContentDigest,
	arrowCommandCensusArtifactSetDigest,
	arrowCommandCensusArtifactSetId
} from './arrow-command-census-content.js';
import {
	ArrowCommandCensusNormalizationError,
	normalizeArrowCommandCensusObservation
} from './normalize-arrow-command-census.js';
import { validateArrowCommandCensusObservation } from './validate-arrow-command-census.js';

const SHA = 'a'.repeat(64);

const budgets: ArrowCommandCensusBudgets = {
	maxArtifacts: 100,
	maxBirthStates: 100,
	maxDeclaredArrowOccurrences: 100,
	maxDeclaredSites: 100,
	maxDiagnostics: 10,
	maxExecutorDurationMs: 10_000,
	maxExternalModuleBytes: 100_000_000,
	maxExternalModuleFiles: 10_000,
	maxMachines: 100,
	maxMapStates: 100,
	maxMaterializedBytes: 100_000_000,
	maxOutputStringCharacters: 100_000,
	maxRawArrayEntries: 1_000,
	maxRawJsonDepth: 20,
	maxStderrBytes: 10_000,
	maxStdoutBytes: 1_000_000
};

function artifactSet(): ArrowCommandCensusArtifactSetBinding {
	const artifacts = [
		{
			bytes: 1,
			canonicalPathKey: 'verif/arrow-command-census.ts',
			disposition: 'ANALYZED' as const,
			path: 'verif/arrow-command-census.ts',
			primaryClass: 'VERIFICATION' as const,
			reason: 'fixture',
			roles: ['ANALYSIS_INPUT', 'VERIFICATION'] as const,
			sha256: SHA,
			uses: ['EXECUTOR_SOURCE'] as const
		},
		{
			bytes: 1,
			canonicalPathKey: 'packages/rph-application/src/handlers/handler.ts',
			disposition: 'ANALYZED' as const,
			path: 'packages/rph-application/src/handlers/handler.ts',
			primaryClass: 'PRODUCTION_SOURCE' as const,
			reason: 'fixture',
			roles: ['ANALYSIS_INPUT', 'PRODUCTION'] as const,
			sha256: SHA,
			uses: ['HANDLER_SOURCE'] as const
		},
		{
			bytes: 1,
			canonicalPathKey: 'packages/rph-domain/src/step-command-spec.ts',
			disposition: 'ANALYZED' as const,
			path: 'packages/rph-domain/src/step-command-spec.ts',
			primaryClass: 'PRODUCTION_SOURCE' as const,
			reason: 'fixture',
			roles: ['ANALYSIS_INPUT', 'PRODUCTION'] as const,
			sha256: SHA,
			uses: ['COMMAND_DECLARATIONS', 'PACKAGE_SOURCE'] as const
		},
		{
			bytes: 1,
			canonicalPathKey: 'packages/rph-domain/src/pwu-lifecycle-command-spec.ts',
			disposition: 'ANALYZED' as const,
			path: 'packages/rph-domain/src/pwu-lifecycle-command-spec.ts',
			primaryClass: 'PRODUCTION_SOURCE' as const,
			reason: 'fixture',
			roles: ['ANALYSIS_INPUT', 'PRODUCTION'] as const,
			sha256: SHA,
			uses: ['COMMAND_DECLARATIONS', 'PACKAGE_SOURCE'] as const
		}
	].sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
	const artifactSetDigest = arrowCommandCensusArtifactSetDigest(artifacts);
	const id = arrowCommandCensusArtifactSetId({
		artifactSetDigest,
		method: ARROW_COMMAND_CENSUS_METHOD,
		schemaVersion: ARROW_COMMAND_CENSUS_ARTIFACT_SET_SCHEMA_VERSION,
		subjectId: SHA
	});
	const content = {
		artifactSetDigest,
		artifacts,
		coverage: {
			artifacts: 4,
			baselineArtifacts: 0,
			commandDeclarationArtifacts: 2,
			contractSchemaArtifacts: 0,
			environmentIdentityArtifacts: 0,
			executorSourceArtifacts: 1,
			executorTestArtifacts: 0,
			handlerSourceArtifacts: 1,
			packageManifestArtifacts: 0,
			packageSourceArtifacts: 2,
			reconciles: true,
			stateMachineDeclarationArtifacts: 0
		},
		id,
		method: ARROW_COMMAND_CENSUS_METHOD,
		schemaVersion: ARROW_COMMAND_CENSUS_ARTIFACT_SET_SCHEMA_VERSION,
		subjectId: SHA
	};
	return { ...content, contentDigest: arrowCommandCensusArtifactSetContentDigest(content) };
}

function executor(): ArrowCommandCensusExecutorIdentity {
	return {
		adapterId: ARROW_COMMAND_CENSUS_ADAPTER_ID,
		adapterVersion: ARROW_COMMAND_CENSUS_OPERATION_VERSION,
		executableBytes: 1,
		executableSha256: SHA,
		externalModules: [
			{
				bytes: 1,
				contentDigest: SHA,
				files: 1,
				name: 'typescript',
				version: '5.9.3'
			},
			{
				bytes: 1,
				contentDigest: SHA,
				files: 1,
				name: 'ulid',
				version: '2.4.0'
			},
			{
				bytes: 1,
				contentDigest: SHA,
				files: 1,
				name: 'zod',
				version: '4.4.3'
			}
		],
		retainedVerifierCanonicalPathKey: 'verif/arrow-command-census.ts',
		retainedVerifierSha256: SHA,
		runtime: 'bun',
		runtimeVersion: '1.3.14',
		worker: { bytes: 1, sha256: SHA }
	};
}

function request(set: ArrowCommandCensusArtifactSetBinding): ObserveArrowCommandCensusRequest {
	return {
		artifactSetId: set.id,
		budgets,
		operationVersion: ARROW_COMMAND_CENSUS_OPERATION_VERSION,
		schemaVersion: ARROW_COMMAND_CENSUS_REQUEST_SCHEMA_VERSION,
		subjectId: SHA
	};
}

function evidence(): ArrowCommandCensusRawOutput {
	return {
		baseline: {
			dead: ['Machine.status  C -> B'],
			orphans: ['Orphan.status'],
			total: 3,
			unanalysed: ['ExecutionStep.stepState'],
			uncovered: ['Machine.status  D -> E']
		},
		births: [{ machine: 'Machine.status', states: ['A'] }],
		census: {
			orphans: ['Orphan.status'],
			total: 3,
			uncovered: ['Machine.status  D -> E']
		},
		deadCovered: {
			dead: ['Machine.status  C -> B'],
			unanalysed: ['ExecutionStep.stepState']
		},
		declaredArrows: [
			{ from: 'A', machine: 'Machine.status', site: 'handler.ts:7', to: 'B' },
			{ from: 'C', machine: 'Machine.status', site: 'handler.ts:7', to: 'B' },
			{
				from: 'READY',
				machine: 'ExecutionStep.stepState',
				site: 'STEP_COMMAND_SPECS.StartExecutionStep',
				to: 'RUNNING'
			}
		],
		occupiable: [{ machine: 'Machine.status', states: ['A', 'B'] }],
		schemaVersion: ARROW_COMMAND_CENSUS_RAW_OUTPUT_SCHEMA_VERSION
	};
}

describe('normalizeArrowCommandCensusObservation', () => {
	it('preserves declared occurrence order and groups repeated sites deterministically', () => {
		const set = artifactSet();
		const result = normalizeArrowCommandCensusObservation({
			artifactSet: set,
			evidence: evidence(),
			executor: executor(),
			request: request(set)
		});

		expect(result.baselineMismatch).toBe(false);
		expect(result.observation.declaredSites).toHaveLength(2);
		expect(result.observation.declaredSites[0]?.arrowIds).toHaveLength(2);
		expect(result.observation.declaredArrows.map((arrow) => arrow.ordinalAtSite)).toEqual([
			0, 1, 0
		]);
		expect(result.observation.declaredSites[0]?.source).toEqual({
			line: 7,
			locator: 'handler.ts:7',
			path: 'packages/rph-application/src/handlers/handler.ts'
		});
		expect(result.observation.declaredSites[1]?.source.path).toBeNull();
		expect(result.observation.coverage).toMatchObject({
			coveredInScopeTopologyArrows: 2,
			declaredArrowOccurrences: 3,
			totalInScopeTopologyArrows: 3,
			uncoveredArrows: 1
		});
	});

	it('detects equal-count but different baseline populations', () => {
		const set = artifactSet();
		const raw = evidence();
		const changed = {
			...raw,
			baseline: { ...raw.baseline, uncovered: ['Machine.status  E -> D'] }
		};
		const result = normalizeArrowCommandCensusObservation({
			artifactSet: set,
			evidence: changed,
			executor: executor(),
			request: request(set)
		});
		expect(result.baselineMismatch).toBe(true);
		expect(result.observation.baselineComparison.uncoveredArrows).toEqual({
			actualCount: 1,
			baselineCount: 1,
			matches: false
		});
		expect(result.observation.epistemic.executionHealth).toBe('PARTIAL');
		expect(result.observation.coverage.reconciles).toBe(true);
	});

	it('rejects malformed retained arrow keys and impossible denominators', () => {
		const set = artifactSet();
		const raw = evidence();
		expect(() =>
			normalizeArrowCommandCensusObservation({
				artifactSet: set,
				evidence: {
					...raw,
					census: { ...raw.census, uncovered: ['not an arrow'] }
				},
				executor: executor(),
				request: request(set)
			})
		).toThrow(ArrowCommandCensusNormalizationError);
		expect(() =>
			normalizeArrowCommandCensusObservation({
				artifactSet: set,
				evidence: { ...raw, census: { ...raw.census, total: 0 } },
				executor: executor(),
				request: request(set)
			})
		).toThrow(/denominator/u);
	});

	it('fails closed when retained sub-populations or declaration provenance contradict', () => {
		const set = artifactSet();
		const cases: readonly ((value: Record<string, any>) => void)[] = [
			(value) => {
				value.declaredArrows[0].site = 'ghost.ts:7';
			},
			(value) => {
				value.census.uncovered = ['Machine.status  A -> B'];
			},
			(value) => {
				value.deadCovered.dead = ['Machine.status  Z -> B'];
			},
			(value) => {
				value.births[0].states = ['A', 'Z'];
			},
			(value) => {
				value.deadCovered.unanalysed = ['Other.status'];
			},
			(value) => {
				value.census.orphans = ['Machine.status'];
			},
			(value) => {
				value.census.uncovered = ['Z.status  A -> B', 'A.status  A -> B'];
				value.baseline.uncovered = ['Z.status  A -> B', 'A.status  A -> B'];
				value.census.total = 4;
				value.baseline.total = 4;
			},
			(value) => {
				value.births = [
					{ machine: 'Z.status', states: ['A'] },
					{ machine: 'A.status', states: ['A'] }
				];
			},
			(value) => {
				value.occupiable[0].states = ['B', 'A'];
			},
			(value) => {
				value.baseline.uncovered = [''];
			},
			(value) => {
				value.baseline.uncovered = ['Machine.status  A -> B -> C'];
			},
			(value) => {
				value.births.push({ machine: 'Other.status', states: ['A'] });
			},
			(value) => {
				value.occupiable[0].states.push('C');
			},
			(value) => {
				value.census.total = 5;
				value.baseline.total = 5;
			}
		];
		for (const mutate of cases) {
			const raw = structuredClone(evidence()) as unknown as Record<string, any>;
			mutate(raw);
			expect(() =>
				normalizeArrowCommandCensusObservation({
					artifactSet: set,
					evidence: raw as ArrowCommandCensusRawOutput,
					executor: executor(),
					request: request(set)
				})
			).toThrow(ArrowCommandCensusNormalizationError);
		}
	});

	it('is byte-deterministic for identical semantic inputs', () => {
		const set = artifactSet();
		const input = {
			artifactSet: set,
			evidence: evidence(),
			executor: executor(),
			request: request(set)
		};
		const first = normalizeArrowCommandCensusObservation(input).observation;
		const second = normalizeArrowCommandCensusObservation(input).observation;
		expect(second).toEqual(first);
		expect(second.contentDigest).toBe(first.contentDigest);
		expect(second.id).toBe(first.id);
		expect(second.rawOutput).toEqual(first.rawOutput);
		expect(JSON.stringify(second.executor)).not.toMatch(/[A-Za-z]:[\\/]/u);
	});

	it('rejects machine-specific locators and malformed executor identities', () => {
		const set = artifactSet();
		const cases: readonly ((value: Record<string, any>) => void)[] = [
			(value) => {
				value.executable = 'C:/bun.exe';
			},
			(value) => {
				value.worker.path = 'C:/worker.ts';
			},
			(value) => {
				value.externalModules[0].packageRoot = 'C:/node_modules/typescript';
			},
			(value) => {
				value.externalModules.reverse();
			},
			(value) => {
				value.executableBytes = 0;
			},
			(value) => {
				value.executableSha256 = 'not-a-digest';
			},
			(value) => {
				value.adapterId = 'unsupported';
			},
			(value) => {
				value.adapterVersion = 'unsupported';
			},
			(value) => {
				value.runtime = 'node';
			},
			(value) => {
				value.runtimeVersion = '';
			},
			(value) => {
				value.externalModules.pop();
			}
		];
		for (const mutate of cases) {
			const changed = structuredClone(executor()) as unknown as Record<string, any>;
			mutate(changed);
			expect(() =>
				normalizeArrowCommandCensusObservation({
					artifactSet: set,
					evidence: evidence(),
					executor: changed as ArrowCommandCensusExecutorIdentity,
					request: request(set)
				})
			).toThrow(ArrowCommandCensusNormalizationError);
		}
		const malformedRecords: unknown[] = [
			null,
			new Proxy(
				{},
				{
					getPrototypeOf() {
						throw new Error('hostile');
					}
				}
			),
			Object.setPrototypeOf(structuredClone(executor()), Date.prototype)
		];
		const accessor = structuredClone(executor()) as unknown as Record<string, any>;
		Object.defineProperty(accessor.worker, 'bytes', {
			enumerable: true,
			get: () => 1
		});
		malformedRecords.push(accessor);
		for (const malformed of malformedRecords)
			expect(() =>
				normalizeArrowCommandCensusObservation({
					artifactSet: set,
					evidence: evidence(),
					executor: malformed as ArrowCommandCensusExecutorIdentity,
					request: request(set)
				})
			).toThrow(ArrowCommandCensusNormalizationError);
	});

	it('rejects request binding and declaration-site contradictions', () => {
		const set = artifactSet();
		const requestCases: readonly ((value: Record<string, any>) => void)[] = [
			(value) => {
				value.subjectId = 'different';
			},
			(value) => {
				value.artifactSetId = 'different';
			},
			(value) => {
				value.operationVersion = 'unsupported';
			}
		];
		for (const mutate of requestCases) {
			const changed = structuredClone(request(set)) as unknown as Record<string, any>;
			mutate(changed);
			expect(() =>
				normalizeArrowCommandCensusObservation({
					artifactSet: set,
					evidence: evidence(),
					executor: executor(),
					request: changed as ObserveArrowCommandCensusRequest
				})
			).toThrow(ArrowCommandCensusNormalizationError);
		}
		const unknownSite = structuredClone(evidence()) as unknown as Record<string, any>;
		unknownSite.declaredArrows[0] = { ...unknownSite.declaredArrows[0]!, site: 'unknown' };
		expect(() =>
			normalizeArrowCommandCensusObservation({
				artifactSet: set,
				evidence: unknownSite as ArrowCommandCensusRawOutput,
				executor: executor(),
				request: request(set)
			})
		).toThrow(ArrowCommandCensusNormalizationError);
		const missingTableBinding = structuredClone(evidence()) as unknown as Record<string, any>;
		missingTableBinding.declaredArrows[0] = {
			...missingTableBinding.declaredArrows[0]!,
			site: 'PWU_LIFECYCLE_COMMAND_SPECS.Advance'
		};
		const setWithoutPwuBinding = structuredClone(set) as unknown as Record<string, any>;
		setWithoutPwuBinding.artifacts = setWithoutPwuBinding.artifacts.filter(
			(artifact: { readonly path: string }) =>
				artifact.path !== 'packages/rph-domain/src/pwu-lifecycle-command-spec.ts'
		);
		expect(() =>
			normalizeArrowCommandCensusObservation({
				artifactSet: setWithoutPwuBinding as ArrowCommandCensusArtifactSetBinding,
				evidence: missingTableBinding as ArrowCommandCensusRawOutput,
				executor: executor(),
				request: { ...request(set), artifactSetId: setWithoutPwuBinding.id }
			})
		).toThrow(ArrowCommandCensusNormalizationError);
	});

	it('validates the canonical projection and fails closed on mutations and hostile containers', () => {
		const set = artifactSet();
		const observation = normalizeArrowCommandCensusObservation({
			artifactSet: set,
			evidence: evidence(),
			executor: executor(),
			request: request(set)
		}).observation;
		expect(validateArrowCommandCensusObservation(observation)).toEqual({
			issues: [],
			state: 'VALID'
		});

		const changed = structuredClone(observation) as unknown as Record<string, any>;
		changed.coverage.declaredArrowOccurrences += 1;
		expect(validateArrowCommandCensusObservation(changed)).toEqual(
			expect.objectContaining({
				issues: [expect.objectContaining({ code: 'RECONCILIATION_MISMATCH' })],
				state: 'INVALID'
			})
		);

		const identity = structuredClone(observation) as unknown as Record<string, any>;
		identity.rawEvidence.census.total += 1;
		expect(validateArrowCommandCensusObservation(identity)).toEqual(
			expect.objectContaining({
				issues: [expect.objectContaining({ code: 'IDENTITY_MISMATCH' })],
				state: 'INVALID'
			})
		);
		expect(validateArrowCommandCensusObservation(new Proxy(observation, {})).state).toBe('INVALID');
		const subclassed = structuredClone(observation) as unknown as Record<string, any>;
		Object.setPrototypeOf(subclassed.rawEvidence.declaredArrows, class extends Array {}.prototype);
		expect(validateArrowCommandCensusObservation(subclassed).state).toBe('INVALID');
		const pathLeaking = structuredClone(observation) as unknown as Record<string, any>;
		pathLeaking.executor.worker.path = 'C:/worker.ts';
		expect(validateArrowCommandCensusObservation(pathLeaking)).toEqual(
			expect.objectContaining({
				issues: [expect.objectContaining({ code: 'RECONCILIATION_MISMATCH' })],
				state: 'INVALID'
			})
		);

		expect(validateArrowCommandCensusObservation(observation, undefined, {})).toEqual({
			issues: [],
			state: 'VALID'
		});
		expect(validateArrowCommandCensusObservation(observation, undefined, { maxIssues: 1 })).toEqual(
			{
				issues: [],
				state: 'VALID'
			}
		);
		for (const options of [
			null,
			[],
			{ extra: true },
			{ maxIssues: 0 },
			Object.setPrototypeOf({ maxIssues: 1 }, null)
		] as unknown[])
			expect(
				validateArrowCommandCensusObservation(observation, undefined, options as never).state
			).toBe('INVALID');
		const hostileOptions = new Proxy(
			{},
			{
				getPrototypeOf() {
					throw new Error('hostile');
				}
			}
		);
		expect(
			validateArrowCommandCensusObservation(observation, undefined, hostileOptions as never).state
		).toBe('INVALID');
		const accessorObservation = structuredClone(observation) as unknown as Record<string, any>;
		Object.defineProperty(accessorObservation.rawEvidence, 'census', {
			enumerable: true,
			get: () => observation.rawEvidence.census
		});
		expect(validateArrowCommandCensusObservation(accessorObservation).state).toBe('INVALID');
		const cyclic = structuredClone(observation) as unknown as Record<string, any>;
		cyclic.self = cyclic;
		expect(validateArrowCommandCensusObservation(cyclic).state).toBe('INVALID');
		const malformedArtifactSet = structuredClone(observation) as unknown as Record<string, any>;
		malformedArtifactSet.artifactSet.contentDigest = '0'.repeat(64);
		expect(validateArrowCommandCensusObservation(malformedArtifactSet)).toEqual(
			expect.objectContaining({
				issues: [expect.objectContaining({ code: 'CONTENT_DIGEST_MISMATCH' })],
				state: 'INVALID'
			})
		);
		const normalizationFailure = structuredClone(observation) as unknown as Record<string, any>;
		normalizationFailure.rawEvidence.census.uncovered = ['not an arrow'];
		expect(validateArrowCommandCensusObservation(normalizationFailure)).toEqual(
			expect.objectContaining({
				issues: [expect.objectContaining({ code: 'RECONCILIATION_MISMATCH' })],
				state: 'INVALID'
			})
		);
		const digestOnly = structuredClone(observation) as unknown as Record<string, any>;
		digestOnly.contentDigest = '0'.repeat(64);
		expect(validateArrowCommandCensusObservation(digestOnly)).toEqual(
			expect.objectContaining({
				issues: [expect.objectContaining({ code: 'CONTENT_DIGEST_MISMATCH' })],
				state: 'INVALID'
			})
		);
	});
});
