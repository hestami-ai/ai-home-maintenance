import { afterEach, describe, expect, it } from 'vitest';
import type { DependencyCruiserObservation } from '../contracts/dependency-cruiser.js';
import { dependencyCruiserObservationContentDigest } from '../providers/dependency-cruiser/normalize-output.js';
import {
	DEPENDENCY_CRUISER_DIFFERENTIAL_OPERATION_VERSION,
	DEPENDENCY_CRUISER_DIFFERENTIAL_REQUEST_SCHEMA_VERSION,
	assessDependencyCruiserDifferential,
	type DependencyCruiserDifferentialAcceptanceRequest
} from './assess-dependency-cruiser-differential.js';
import {
	createStructuralWorkspaceDependencyFixture,
	createStructuralWorkspaceDependencyObservation,
	type StructuralWorkspaceDependencyFixture
} from './structural-workspace-dependency-fixture.test-support.js';

const fixtures: StructuralWorkspaceDependencyFixture[] = [];

function fixture(): StructuralWorkspaceDependencyFixture {
	const created = createStructuralWorkspaceDependencyFixture();
	fixtures.push(created);
	return created;
}

function request(
	expectedDifferentialDigest: string | null,
	expectedInputPaths: readonly string[] = ['apps', 'packages']
): DependencyCruiserDifferentialAcceptanceRequest {
	return {
		budgets: {
			comparison: {
				maxComparisonRecords: 1_000,
				maxDiagnostics: 100,
				maxRationaleCharacters: 10_000
			},
			maxResultBytes: 4_000_000
		},
		configPath: '.dependency-cruiser.cjs',
		expectedDifferentialDigest,
		expectedInputPaths,
		operationVersion: DEPENDENCY_CRUISER_DIFFERENTIAL_OPERATION_VERSION,
		schemaVersion: DEPENDENCY_CRUISER_DIFFERENTIAL_REQUEST_SCHEMA_VERSION
	};
}

function withLimitation(
	observation: DependencyCruiserObservation,
	code: string
): DependencyCruiserObservation {
	const limitations = [
		...observation.limitations.filter((limitation) => limitation.code !== code),
		{
			code,
			fields: ['fixture.optional'],
			reason: 'Synthetic normalized optional-metadata limitation fixture.'
		}
	].sort((left, right) => (left.code < right.code ? -1 : left.code > right.code ? 1 : 0));
	const candidate = {
		...observation,
		limitations
	} as unknown as DependencyCruiserObservation;
	return {
		...candidate,
		contentDigest: dependencyCruiserObservationContentDigest(candidate)
	};
}

afterEach(() => {
	for (const value of fixtures.splice(0)) value.cleanup();
});

describe('assessDependencyCruiserDifferential', () => {
	it('accepts an exact file-input perimeter contained by selected workspaces', () => {
		const value = fixture();
		const inputPaths = [
			'apps/demo/src/main.ts',
			'packages/a/src/a.ts',
			'packages/b/src/b.ts'
		] as const;
		const observation = createStructuralWorkspaceDependencyObservation(value, { inputPaths });
		const discovery = assessDependencyCruiserDifferential(
			request(null, inputPaths),
			value.frozenSubject,
			value.semanticSnapshot,
			value.graph,
			observation
		);
		expect(discovery).toMatchObject({
			diagnostics: [{ code: 'BASELINE_REQUIRED' }],
			evidence: {
				perimeterWitness: { expectedInputPaths: inputPaths, state: 'EXACT_INVOCATION_MATCH' }
			},
			outcome: 'rejected'
		});
	});

	it('requires review before accepting deterministic partial differential evidence', () => {
		const value = fixture();
		const observation = createStructuralWorkspaceDependencyObservation(value);
		const discovery = assessDependencyCruiserDifferential(
			request(null),
			value.frozenSubject,
			value.semanticSnapshot,
			value.graph,
			observation
		);
		expect(discovery).toMatchObject({
			diagnostics: [{ code: 'BASELINE_REQUIRED' }],
			evidence: { acceptanceState: 'BASELINE_REQUIRED' },
			outcome: 'rejected'
		});
		if (discovery.outcome !== 'rejected') throw new Error(JSON.stringify(discovery));

		const accepted = assessDependencyCruiserDifferential(
			request(discovery.evidence.differentialDigest),
			value.frozenSubject,
			value.semanticSnapshot,
			value.graph,
			observation
		);
		expect(accepted).toMatchObject({
			diagnostics: [],
			evidence: {
				acceptanceState: 'ACCEPTED_REVIEWED_PARTIAL_DIFFERENTIAL',
				authority: 'REVIEWED_DIFFERENTIAL_EVIDENCE_ONLY',
				coverage: {
					compilerEdges: 3,
					dependencyCruiserDependencies: 3,
					reconciles: true
				},
				gateEffect: 'NONE'
			},
			outcome: 'accepted'
		});
		if (accepted.outcome !== 'accepted') throw new Error(JSON.stringify(accepted));
		expect(accepted.evidence.nonclaims).toEqual(
			expect.arrayContaining([
				'CONTEXT_EQUIVALENCE',
				'G4_PASS',
				'OPTIONAL_DEPENDENCY_CRUISER_METADATA_INTERPRETATION',
				'PROVIDER_QUALIFICATION'
			])
		);
		expect(accepted.evidence.comparison.health).toBe('PARTIAL');
		expect(accepted.evidence.comparison.negativeCoverage.state).toBe('OPEN');
		expect(Object.isFrozen(accepted.evidence)).toBe(true);
	});

	it('derives the same semantic digest across invocation timestamps', () => {
		const value = fixture();
		const first = createStructuralWorkspaceDependencyObservation(value, {
			startedAt: '2026-08-25T12:00:00-04:00'
		});
		const second = createStructuralWorkspaceDependencyObservation(value, {
			startedAt: '2026-08-25T13:00:00-04:00'
		});
		const firstOutcome = assessDependencyCruiserDifferential(
			request(null),
			value.frozenSubject,
			value.semanticSnapshot,
			value.graph,
			first
		);
		const secondOutcome = assessDependencyCruiserDifferential(
			request(null),
			value.frozenSubject,
			value.semanticSnapshot,
			value.graph,
			second
		);
		if (firstOutcome.outcome !== 'rejected' || secondOutcome.outcome !== 'rejected')
			throw new Error('Expected two baseline-required outcomes.');
		expect(first.id).not.toBe(second.id);
		expect(firstOutcome.evidence.differentialDigest).toBe(
			secondOutcome.evidence.differentialDigest
		);
	});

	it('retains an expected provider disagreement without promoting it to conflict authority', () => {
		const value = fixture();
		const observation = createStructuralWorkspaceDependencyObservation(value, {
			firstTargetPath: 'apps/demo/src/main.ts'
		});
		const discovery = assessDependencyCruiserDifferential(
			request(null),
			value.frozenSubject,
			value.semanticSnapshot,
			value.graph,
			observation
		);
		if (discovery.outcome !== 'rejected') throw new Error(JSON.stringify(discovery));
		const accepted = assessDependencyCruiserDifferential(
			request(discovery.evidence.differentialDigest),
			value.frozenSubject,
			value.semanticSnapshot,
			value.graph,
			observation
		);
		expect(accepted.outcome).toBe('accepted');
		if (accepted.outcome !== 'accepted') throw new Error(JSON.stringify(accepted));
		expect(accepted.evidence.coverage.observedDifferenceRecords).toBeGreaterThan(0);
		expect(
			accepted.evidence.comparison.records.some(
				(record) => record.assessment === 'OBSERVED_DIFFERENCE'
			)
		).toBe(true);
		expect(accepted.evidence.nonclaims).toContain('PROVIDER_AUTHORITY');
	});

	it('rejects semantic differential drift against the reviewed digest', () => {
		const value = fixture();
		const baselineObservation = createStructuralWorkspaceDependencyObservation(value);
		const discovery = assessDependencyCruiserDifferential(
			request(null),
			value.frozenSubject,
			value.semanticSnapshot,
			value.graph,
			baselineObservation
		);
		if (discovery.outcome !== 'rejected') throw new Error(JSON.stringify(discovery));
		const changedObservation = createStructuralWorkspaceDependencyObservation(value, {
			firstTargetPath: 'apps/demo/src/main.ts'
		});
		const changed = assessDependencyCruiserDifferential(
			request(discovery.evidence.differentialDigest),
			value.frozenSubject,
			value.semanticSnapshot,
			value.graph,
			changedObservation
		);
		expect(changed).toMatchObject({
			diagnostics: [{ code: 'DIFFERENTIAL_DRIFT' }],
			evidence: { acceptanceState: 'DIFFERENTIAL_DRIFT' },
			outcome: 'rejected'
		});
	});

	it.each(['DEPENDENCY_OPTIONAL_FIELDS_NOT_INTERPRETED', 'MODULE_OPTIONAL_FIELDS_NOT_INTERPRETED'])(
		'retains relation-irrelevant normalized limitation %s in partial evidence',
		(code) => {
			const value = fixture();
			const observation = withLimitation(
				createStructuralWorkspaceDependencyObservation(value),
				code
			);
			const discovery = assessDependencyCruiserDifferential(
				request(null),
				value.frozenSubject,
				value.semanticSnapshot,
				value.graph,
				observation
			);
			expect(discovery).toMatchObject({
				diagnostics: [{ code: 'BASELINE_REQUIRED' }],
				evidence: {
					acceptanceState: 'BASELINE_REQUIRED',
					observation: { limitations: expect.arrayContaining([code]) }
				},
				outcome: 'rejected'
			});
			if (discovery.outcome !== 'rejected') throw new Error(JSON.stringify(discovery));
			const accepted = assessDependencyCruiserDifferential(
				request(discovery.evidence.differentialDigest),
				value.frozenSubject,
				value.semanticSnapshot,
				value.graph,
				observation
			);
			expect(accepted).toMatchObject({
				evidence: {
					acceptanceState: 'ACCEPTED_REVIEWED_PARTIAL_DIFFERENTIAL',
					nonclaims: expect.arrayContaining([
						'OPTIONAL_DEPENDENCY_CRUISER_METADATA_INTERPRETATION'
					]),
					observation: { limitations: expect.arrayContaining([code]) }
				},
				outcome: 'accepted'
			});
		}
	);

	it('fails closed on configuration, perimeter, and unsupported normalization drift', () => {
		const value = fixture();
		const configDrift = assessDependencyCruiserDifferential(
			request(null),
			value.frozenSubject,
			value.semanticSnapshot,
			value.graph,
			createStructuralWorkspaceDependencyObservation(value, { configSha256: 'f'.repeat(64) })
		);
		expect(configDrift).toMatchObject({
			diagnostics: [{ code: 'CONFIG_DRIFT' }],
			outcome: 'unavailable'
		});

		const perimeterDrift = assessDependencyCruiserDifferential(
			request(null),
			value.frozenSubject,
			value.semanticSnapshot,
			value.graph,
			createStructuralWorkspaceDependencyObservation(value, { inputPaths: ['packages'] })
		);
		expect(perimeterDrift).toMatchObject({
			diagnostics: [{ code: 'INPUT_PERIMETER_DRIFT' }],
			outcome: 'unavailable'
		});

		const unsupported = assessDependencyCruiserDifferential(
			request(null),
			value.frozenSubject,
			value.semanticSnapshot,
			value.graph,
			withLimitation(
				createStructuralWorkspaceDependencyObservation(value),
				'FOLDERS_NOT_INTERPRETED'
			)
		);
		expect(unsupported).toMatchObject({
			diagnostics: [{ code: 'UNSUPPORTED_OBSERVATION_SURFACE' }],
			outcome: 'unavailable'
		});

		const unknown = assessDependencyCruiserDifferential(
			request(null),
			value.frozenSubject,
			value.semanticSnapshot,
			value.graph,
			withLimitation(
				createStructuralWorkspaceDependencyObservation(value),
				'UNKNOWN_OPTIONAL_METADATA_NOT_INTERPRETED'
			)
		);
		expect(unknown).toMatchObject({
			diagnostics: [{ code: 'SOURCE_INVALID' }],
			outcome: 'unavailable'
		});
	});
});
