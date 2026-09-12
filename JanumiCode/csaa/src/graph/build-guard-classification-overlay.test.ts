import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
	GUARD_CLASSIFICATION_OVERLAY_AUTHORITY_TRANSFER,
	GUARD_CLASSIFICATION_OVERLAY_BASELINE_CHANGE,
	GUARD_CLASSIFICATION_OVERLAY_FULL_JAN_CSAA_007_CONFORMANCE,
	GUARD_CLASSIFICATION_OVERLAY_FULL_JAN_CSAA_008_CONFORMANCE,
	GUARD_CLASSIFICATION_OVERLAY_GATE_EFFECT,
	GUARD_CLASSIFICATION_OVERLAY_GRAPH_AUTHORITY,
	GUARD_CLASSIFICATION_OVERLAY_ORACLE_CHANGE,
	GUARD_CLASSIFICATION_OVERLAY_REPLACEMENT_EQUIVALENCE,
	GUARD_CLASSIFICATION_OVERLAY_RUNTIME_ENFORCEMENT,
	GUARD_CLASSIFICATION_OVERLAY_RUNTIME_PERFORMABILITY,
	type GuardClassificationOverlayBuildInputs,
	type GuardClassificationOverlayDiagnosticCode,
	type GuardClassificationOverlaySnapshot
} from '../contracts/guard-classification-overlay.js';
import { buildGuardClassificationOverlay } from './build-guard-classification-overlay.js';
import { guardClassificationOverlayContentDigest } from './guard-classification-overlay-canonical.js';
import {
	createGuardClassificationOverlayPredecessorFixture,
	type GuardClassificationOverlayPredecessorFixture
} from './guard-classification-overlay-fixture.test-support.js';
import { validateGuardClassificationOverlay } from './validate-guard-classification-overlay.js';

let value: GuardClassificationOverlayPredecessorFixture;

beforeAll(() => {
	value = createGuardClassificationOverlayPredecessorFixture();
}, 120_000);

afterAll(() => {
	value.cleanup();
});

function build(inputs: GuardClassificationOverlayBuildInputs = value.inputs) {
	return buildGuardClassificationOverlay(inputs);
}

function overlay(): GuardClassificationOverlaySnapshot {
	const outcome = build();
	if (outcome.outcome !== 'partial')
		throw new Error(`Fixture overlay construction failed: ${JSON.stringify(outcome)}`);
	return outcome.overlay;
}

function redigested(
	base: GuardClassificationOverlaySnapshot,
	mutate: (draft: GuardClassificationOverlaySnapshot) => void
): GuardClassificationOverlaySnapshot {
	const draft = structuredClone(base) as GuardClassificationOverlaySnapshot;
	mutate(draft);
	(draft as { contentDigest: string }).contentDigest =
		guardClassificationOverlayContentDigest(draft);
	return draft;
}

function expectUnavailable(
	inputs: GuardClassificationOverlayBuildInputs | unknown,
	code?: GuardClassificationOverlayDiagnosticCode
): void {
	const outcome = buildGuardClassificationOverlay(inputs as GuardClassificationOverlayBuildInputs);
	expect(outcome.outcome).toBe('unavailable');
	if (code !== undefined)
		expect(outcome).toMatchObject({
			diagnostics: [expect.objectContaining({ code })]
		});
}

function expectInvalid(candidate: unknown, code = 'POPULATION_MISMATCH'): void {
	expect(validateGuardClassificationOverlay(candidate, value.inputs)).toMatchObject({
		issues: [expect.objectContaining({ code })],
		state: code === 'BUDGET_EXHAUSTED' ? 'BUDGET_EXHAUSTED' : 'INVALID'
	});
}

describe('buildGuardClassificationOverlay', { timeout: 30_000 }, () => {
	it('builds the compiler-backed partial overlay with exact retained correlations and nonclaims', () => {
		const outcome = build();
		expect(outcome).toMatchObject({ diagnostics: [], outcome: 'partial' });
		if (outcome.outcome !== 'partial') throw new Error('Expected a partial overlay.');
		const { overlay: result } = outcome;
		expect(result.contentDigest).toBe(guardClassificationOverlayContentDigest(result));
		expect(validateGuardClassificationOverlay(result, value.inputs)).toEqual({
			issues: [],
			state: 'VALID'
		});

		expect(result.classifications).toHaveLength(1);
		expect(result.occurrences).toHaveLength(1);
		expect(result.occurrences[0]!.stateGraphEdgeIds).toHaveLength(2);
		expect(result.commandEvidenceLinks).toHaveLength(1);
		expect(result.anchorSites).toHaveLength(1);
		expect(result.handlerLinks).toHaveLength(1);
		expect(result.frontiers).toHaveLength(0);
		expect(typeof result.anchorSites[0]!.currentLine).toBe('number');
		expect(result.anchorSites[0]!.currentLine).not.toBe(999);
		expect(result.handlerLinks[0]).toMatchObject({
			attribution: 'EXACT',
			kind: 'EXACT_HANDLER_TARGET'
		});
		expect(result.handlerLinks[0]!.targetNodeIds).toHaveLength(1);
		expect(typeof result.handlerLinks[0]!.targetNodeIds[0]).toBe('string');
		expect(result.layers[0]!.handlerLinkIds).toEqual([result.handlerLinks[0]!.id]);
		expect(result.layers[1]!.handlerLinkIds).toEqual([]);
		const target = value.commandHandlerGraph.nodes.find(
			(node) => node.id === result.handlerLinks[0]!.targetNodeIds[0]
		);
		expect(target).toMatchObject({
			bodyKind: 'DIRECT_FUNCTION',
			kind: 'HANDLER_TARGET',
			nodeId: result.anchorSites[0]!.callableNodeId
		});
		expect(result.coverage).toMatchObject({
			anchorSites: 1,
			candidateFactoryHandlerLinks: 0,
			classifications: 1,
			commandEvidenceLinks: 1,
			commandEvidenceOccurrences: 1,
			directHandlerLinks: 1,
			expectedClassifications: 1,
			expectedCommandEvidenceLinks: 1,
			expectedOccurrences: 1,
			expectedStateEvidenceRefs: 2,
			frontiers: 0,
			helperFrontiers: 0,
			noCommandEvidenceFrontiers: 0,
			occurrences: 1,
			reconciles: true,
			stateEvidenceRefs: 2
		});
		expect(result).toMatchObject({
			authorityTransfer: GUARD_CLASSIFICATION_OVERLAY_AUTHORITY_TRANSFER,
			baselineChange: GUARD_CLASSIFICATION_OVERLAY_BASELINE_CHANGE,
			fullJanCsaa007Conformance: GUARD_CLASSIFICATION_OVERLAY_FULL_JAN_CSAA_007_CONFORMANCE,
			fullJanCsaa008Conformance: GUARD_CLASSIFICATION_OVERLAY_FULL_JAN_CSAA_008_CONFORMANCE,
			gateEffect: GUARD_CLASSIFICATION_OVERLAY_GATE_EFFECT,
			graphAuthority: GUARD_CLASSIFICATION_OVERLAY_GRAPH_AUTHORITY,
			health: 'PARTIAL',
			oracleChange: GUARD_CLASSIFICATION_OVERLAY_ORACLE_CHANGE,
			replacementEquivalence: GUARD_CLASSIFICATION_OVERLAY_REPLACEMENT_EQUIVALENCE,
			runtimeEnforcement: GUARD_CLASSIFICATION_OVERLAY_RUNTIME_ENFORCEMENT,
			runtimePerformability: GUARD_CLASSIFICATION_OVERLAY_RUNTIME_PERFORMABILITY
		});
	});

	it('is deterministic and keeps deferred hostile progress telemetry inert', async () => {
		const expected = build();
		expect(build()).toEqual(expected);

		const events: unknown[] = [];
		const observed = buildGuardClassificationOverlay(value.inputs, {
			onProgress: (event) => events.push(event)
		});
		expect(observed).toEqual(expected);
		expect(events).toHaveLength(0);
		await Promise.resolve();
		expect(events.length).toBeGreaterThan(20);

		const hostile = buildGuardClassificationOverlay(value.inputs, {
			onProgress: () => {
				throw new Error('hostile telemetry sink');
			}
		});
		expect(hostile).toEqual(expected);
		await Promise.resolve();
	});

	it('fails closed for stale request and predecessor identities', () => {
		for (const request of [
			{ ...value.request, subjectId: `stale-${value.request.subjectId}` },
			{
				...value.request,
				semanticSnapshotId:
					`${value.request.semanticSnapshotId}-stale` as typeof value.request.semanticSnapshotId
			},
			{
				...value.request,
				stateObservationId:
					`${value.request.stateObservationId}-stale` as typeof value.request.stateObservationId
			},
			{
				...value.request,
				stateGraphId: `${value.request.stateGraphId}-stale` as typeof value.request.stateGraphId
			},
			{
				...value.request,
				arrowObservationId:
					`${value.request.arrowObservationId}-stale` as typeof value.request.arrowObservationId
			},
			{
				...value.request,
				commandHandlerGraphId:
					`${value.request.commandHandlerGraphId}-stale` as typeof value.request.commandHandlerGraphId
			},
			{
				...value.request,
				guardObservationId:
					`${value.request.guardObservationId}-stale` as typeof value.request.guardObservationId
			}
		])
			expectUnavailable({ ...value.inputs, request }, 'INPUT_IDENTITY_MISMATCH');

		for (const inputs of [
			{
				...value.inputs,
				commandHandlerGraph: {
					...value.commandHandlerGraph,
					id: `${value.commandHandlerGraph.id}-stale` as typeof value.commandHandlerGraph.id
				}
			},
			{
				...value.inputs,
				stateGraph: {
					...value.stateGraph,
					id: `${value.stateGraph.id}-stale` as typeof value.stateGraph.id
				}
			},
			{
				...value.inputs,
				guardObservation: {
					...value.guardObservation,
					id: `${value.guardObservation.id}-stale` as typeof value.guardObservation.id
				}
			}
		] as GuardClassificationOverlayBuildInputs[])
			expectUnavailable(inputs);
	});

	it('rejects dropped or replaced output population, indexes, layers, coverage, digest, and authority', () => {
		const base = overlay();
		expectInvalid(
			redigested(base, (draft) => {
				(draft as unknown as { classifications: unknown[] }).classifications = [];
			})
		);
		expectInvalid(
			redigested(base, (draft) => {
				(draft.occurrences[0] as unknown as { guardText: string }).guardText = 'replaced guard';
			})
		);
		expectInvalid(
			redigested(base, (draft) => {
				(draft as unknown as { forwardIndex: unknown[] }).forwardIndex = [];
			})
		);
		expectInvalid(
			redigested(base, (draft) => {
				(draft.layers[0].classificationIds as unknown as string[]).splice(0);
			})
		);
		expectInvalid(
			redigested(base, (draft) => {
				(draft.coverage as { directHandlerLinks: number }).directHandlerLinks = 0;
			})
		);
		const corruptDigest = structuredClone(base) as GuardClassificationOverlaySnapshot;
		(corruptDigest as { contentDigest: string }).contentDigest = '0'.repeat(64);
		expectInvalid(corruptDigest);
		expectInvalid(
			redigested(base, (draft) => {
				(draft as unknown as { graphAuthority: string }).graphAuthority = 'CANDIDATE';
			})
		);
	});

	it('enforces exact one-below operation guards for consumed AST, source, and state evidence', () => {
		const base = overlay();
		const sourceBytes = value.subject.artifacts.find(
			(artifact) => artifact.path === base.anchorSites[0]!.path
		)!.bytes;
		for (const budgets of [
			{ ...value.request.budgets, maxAstNodes: value.snapshot.astNodes.length - 1 },
			{ ...value.request.budgets, maxSourceBytes: sourceBytes - 1 },
			{ ...value.request.budgets, maxStateEvidenceRefs: base.coverage.stateEvidenceRefs - 1 }
		])
			expectUnavailable(
				{ ...value.inputs, request: { ...value.request, budgets } },
				'BUDGET_EXCEEDED'
			);
	});

	it('fails closed for malformed inputs and validator candidates, inputs, and options', () => {
		for (const malformed of [
			null,
			[],
			{ ...value.inputs, unexpected: true },
			new Proxy(value.inputs, {}),
			{ ...value.inputs, request: { ...value.request, schemaVersion: 'wrong' } },
			{ ...value.inputs, request: { ...value.request, operationVersion: 'wrong' } },
			{
				...value.inputs,
				request: {
					...value.request,
					budgets: { ...value.request.budgets, maxAnchorSites: 0 }
				}
			}
		])
			expectUnavailable(malformed, 'REQUEST_INVALID');

		const base = overlay();
		expectInvalid(null);
		for (const candidate of [undefined, Symbol('hostile')])
			expectInvalid(candidate, 'SHAPE_INVALID');
		expectInvalid(new Proxy(base, {}), 'SHAPE_INVALID');
		expect(
			validateGuardClassificationOverlay(base, {
				...value.inputs,
				unexpected: true
			} as GuardClassificationOverlayBuildInputs)
		).toMatchObject({
			issues: [expect.objectContaining({ code: 'INPUT_INVALID' })],
			state: 'INVALID'
		});
		expect(validateGuardClassificationOverlay(base, value.inputs, { maxDepth: 0 })).toMatchObject({
			issues: [expect.objectContaining({ code: 'SHAPE_INVALID' })],
			state: 'INVALID'
		});
		expect(validateGuardClassificationOverlay(base, value.inputs, { maxDepth: 1 })).toMatchObject({
			issues: [expect.objectContaining({ code: 'BUDGET_EXHAUSTED' })],
			state: 'BUDGET_EXHAUSTED'
		});
		expect(
			validateGuardClassificationOverlay(base, value.inputs, {
				maxDepth: 1,
				maxInputRecords: 1,
				maxInputStringCharacters: 1,
				maxIssues: 1,
				maxRecords: 1,
				maxStringCharacters: 1,
				unexpected: 1
			} as never)
		).toMatchObject({
			issues: [expect.objectContaining({ code: 'SHAPE_INVALID' })],
			state: 'INVALID'
		});
	});
});
