import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { StaticSemanticSnapshot } from '../contracts/semantic.js';
import {
	createSemanticSnapshotComparisonFixture,
	type SemanticSnapshotComparisonFixture
} from './semantic-snapshot-comparison-fixture.test-support.js';
import {
	SEMANTIC_SNAPSHOT_COMPARISON_NONCLAIMS,
	SEMANTIC_SNAPSHOT_COMPARISON_OPERATION_VERSION,
	SEMANTIC_SNAPSHOT_COMPARISON_PROFILE,
	SEMANTIC_SNAPSHOT_COMPARISON_REQUEST_SCHEMA_VERSION,
	compareSemanticSnapshots,
	validateSemanticSnapshotComparisonOutcome,
	type SemanticSnapshotComparisonBudgets,
	type SemanticSnapshotComparisonOutcome,
	type SemanticSnapshotComparisonRequest
} from './semantic-snapshot-comparison.js';

const defaultBudgets: SemanticSnapshotComparisonBudgets = {
	maxDeltas: 10_000,
	maxFrontiers: 10_000,
	maxInputSources: 10_000,
	maxLineageCandidates: 100_000,
	maxResultBytes: 16 * 1024 * 1024
};

let fixture: SemanticSnapshotComparisonFixture;

beforeAll(() => {
	fixture = createSemanticSnapshotComparisonFixture();
});

afterAll(() => fixture.cleanup());

function request(
	before: StaticSemanticSnapshot = fixture.before,
	after: StaticSemanticSnapshot = fixture.after,
	overrides: Partial<SemanticSnapshotComparisonRequest> = {}
): SemanticSnapshotComparisonRequest {
	return {
		after: { semanticSnapshotId: after.id, subjectId: after.subjectId },
		before: { semanticSnapshotId: before.id, subjectId: before.subjectId },
		budgets: defaultBudgets,
		operationVersion: SEMANTIC_SNAPSHOT_COMPARISON_OPERATION_VERSION,
		profile: { ...SEMANTIC_SNAPSHOT_COMPARISON_PROFILE },
		schemaVersion: SEMANTIC_SNAPSHOT_COMPARISON_REQUEST_SCHEMA_VERSION,
		...overrides
	};
}

function available(outcome: SemanticSnapshotComparisonOutcome) {
	if (outcome.outcome === 'unavailable' || outcome.outcome === 'incomparable')
		throw new Error(JSON.stringify(outcome));
	return outcome;
}

function clone<T>(value: T): T {
	return structuredClone(value);
}

function subjects(before = fixture.beforeSubject, after = fixture.afterSubject) {
	return { after, before };
}

function expectUnavailable(candidate: unknown, code: string): void {
	expect(
		compareSemanticSnapshots(candidate, fixture.before, fixture.after, subjects())
	).toMatchObject({
		diagnostics: [{ code }],
		outcome: 'unavailable'
	});
}

describe('semantic snapshot comparison', () => {
	it('classifies the complete bounded source-delta vocabulary and preserves lineage uncertainty', () => {
		const outcome = available(
			compareSemanticSnapshots(request(), fixture.before, fixture.after, subjects())
		);
		expect(outcome.outcome).toBe('partial');
		expect(outcome.result.closure).toBe('OPEN');
		expect([...new Set(outcome.result.deltas.map((delta) => delta.kind))].sort()).toEqual([
			'ADDED',
			'CONFLICTING_LINEAGE',
			'MODIFIED',
			'MODIFIED_AND_RECLASSIFIED',
			'MOVED',
			'MOVED_AND_RENAMED',
			'RECLASSIFIED',
			'REMOVED',
			'RENAMED',
			'UNCHANGED'
		]);
		const inferred = outcome.result.deltas.filter((delta) =>
			['MOVED', 'MOVED_AND_RENAMED', 'RENAMED'].includes(delta.kind)
		);
		expect(inferred).toHaveLength(3);
		expect(inferred.every((delta) => delta.certainty === 'INFERRED')).toBe(true);
		expect(inferred.every((delta) => delta.beforeSources[0]?.provenanceId.length !== 0)).toBe(true);
		const conflict = outcome.result.deltas.find((delta) => delta.kind === 'CONFLICTING_LINEAGE');
		expect(conflict).toMatchObject({
			afterSources: [{}, {}],
			beforeSources: [{}, {}],
			certainty: 'CONFLICTING'
		});
		expect(outcome.result.frontiers).toEqual(
			expect.arrayContaining([expect.objectContaining({ kind: 'AMBIGUOUS_LINEAGE' })])
		);
		expect(outcome.result.changedObjects.unknown).toHaveLength(4);
		expect(outcome.result.nonclaims).toBe(SEMANTIC_SNAPSHOT_COMPARISON_NONCLAIMS);
		expect(outcome.result.nonclaims).toContain('NON_IMPACT_OR_SAFE_REMOVAL');
	});

	it('is byte-deterministic, deeply frozen, and detects stored outcome mutation', () => {
		const accepted = request();
		const first = compareSemanticSnapshots(accepted, fixture.before, fixture.after, subjects());
		const second = compareSemanticSnapshots(accepted, fixture.before, fixture.after, subjects());
		expect(second).toEqual(first);
		expect(Object.isFrozen(first)).toBe(true);
		if (first.outcome === 'unavailable' || first.outcome === 'incomparable')
			throw new Error('Expected result.');
		expect(Object.isFrozen(first.result.deltas)).toBe(true);
		expect(
			validateSemanticSnapshotComparisonOutcome(
				accepted,
				first,
				fixture.before,
				fixture.after,
				subjects()
			)
		).toEqual({
			issues: [],
			state: 'VALID'
		});
		const mutated = clone(first) as unknown as { result: { closure: string } };
		mutated.result.closure = 'CLOSED_FOR_SELECTED_SOURCE_POPULATIONS';
		expect(
			validateSemanticSnapshotComparisonOutcome(
				accepted,
				mutated,
				fixture.before,
				fixture.after,
				subjects()
			)
		).toMatchObject({ issues: [{ code: 'OUTCOME_MISMATCH' }], state: 'INVALID' });
		expect(
			validateSemanticSnapshotComparisonOutcome(
				accepted,
				new Proxy({}, {}),
				fixture.before,
				fixture.after,
				subjects()
			)
		).toMatchObject({ issues: [{ code: 'OUTCOME_INVALID' }], state: 'INVALID' });
	});

	it('returns a closed all-unchanged comparison for the same complete source population', () => {
		const outcome = available(
			compareSemanticSnapshots(
				request(fixture.before, fixture.before),
				fixture.before,
				fixture.before,
				subjects(fixture.beforeSubject, fixture.beforeSubject)
			)
		);
		expect(outcome.outcome).toBe('complete');
		expect(outcome.result.closure).toBe('CLOSED_FOR_SELECTED_SOURCE_POPULATIONS');
		expect(outcome.result.deltas.every((delta) => delta.kind === 'UNCHANGED')).toBe(true);
		expect(outcome.result.coverage.changedDeltas).toBe(0);
		expect(outcome.result.unknownChangeState).toBe('NONE_WITHIN_CLOSED_SOURCE_POPULATIONS');
	});

	it('makes incompatible semantic provider profiles explicit instead of fabricating deltas', () => {
		const after = clone(fixture.after) as unknown as {
			provider: { api: string; id: string; version: string };
		};
		after.provider.version = '6.0.0';
		expect(
			compareSemanticSnapshots(
				request(),
				fixture.before,
				after as unknown as StaticSemanticSnapshot,
				subjects()
			)
		).toMatchObject({
			diagnostics: [{ code: 'INCOMPARABLE_PROVIDER_PROFILE' }],
			outcome: 'incomparable'
		});
	});

	it('rejects identity drift and independently detects snapshot mutation', () => {
		expectUnavailable(
			request(fixture.before, fixture.after, {
				after: { semanticSnapshotId: fixture.after.id, subjectId: 'different-subject' }
			}),
			'IDENTITY_MISMATCH'
		);
		const after = clone(fixture.after) as unknown as {
			sources: Array<{ contentSha256: string }>;
		};
		after.sources[0]!.contentSha256 = 'f'.repeat(64);
		expect(
			compareSemanticSnapshots(
				request(),
				fixture.before,
				after as unknown as StaticSemanticSnapshot,
				subjects()
			)
		).toMatchObject({ diagnostics: [{ code: 'SNAPSHOT_INVALID' }], outcome: 'unavailable' });
	});

	it('enforces source, lineage, delta, and serialized-result budgets', () => {
		expectUnavailable(
			request(fixture.before, fixture.after, {
				budgets: {
					...defaultBudgets,
					maxInputSources: fixture.before.sources.length + fixture.after.sources.length - 1
				}
			}),
			'BUDGET_EXCEEDED'
		);
		expectUnavailable(
			request(fixture.before, fixture.after, {
				budgets: { ...defaultBudgets, maxLineageCandidates: 1 }
			}),
			'BUDGET_EXCEEDED'
		);
		expectUnavailable(
			request(fixture.before, fixture.after, {
				budgets: { ...defaultBudgets, maxDeltas: 1 }
			}),
			'BUDGET_EXCEEDED'
		);
		expectUnavailable(
			request(fixture.before, fixture.after, {
				budgets: { ...defaultBudgets, maxResultBytes: 1 }
			}),
			'RESULT_BUDGET_EXCEEDED'
		);
	});

	it('rejects open, hostile, accessor-bearing, and policy-drifted requests', () => {
		expectUnavailable({ ...request(), extra: true }, 'REQUEST_INVALID');
		expectUnavailable(
			{
				...request(),
				profile: { ...SEMANTIC_SNAPSHOT_COMPARISON_PROFILE, lineageInference: 'PATH_GUESS' }
			},
			'REQUEST_INVALID'
		);
		expectUnavailable(
			{ ...request(), budgets: { ...defaultBudgets, maxDeltas: 0 } },
			'REQUEST_INVALID'
		);
		const accessor = { ...request() } as Record<string, unknown>;
		Object.defineProperty(accessor, 'before', {
			enumerable: true,
			get: () => ({ semanticSnapshotId: fixture.before.id, subjectId: fixture.before.subjectId })
		});
		expectUnavailable(accessor, 'REQUEST_INVALID');
		expectUnavailable(new Proxy(request(), {}), 'REQUEST_INVALID');
	});
});
