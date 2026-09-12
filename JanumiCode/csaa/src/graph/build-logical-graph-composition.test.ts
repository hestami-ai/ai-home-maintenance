import { afterEach, describe, expect, it } from 'vitest';

import {
	LOGICAL_GRAPH_COMPOSITION_AUTHORITY_TRANSFER,
	LOGICAL_GRAPH_COMPOSITION_CAPABILITY,
	LOGICAL_GRAPH_COMPOSITION_CAPABILITY_STATUS,
	LOGICAL_GRAPH_COMPOSITION_CURRENTNESS,
	LOGICAL_GRAPH_COMPOSITION_FRESHNESS,
	LOGICAL_GRAPH_COMPOSITION_FULL_JAN_CSAA_007_CONFORMANCE,
	LOGICAL_GRAPH_COMPOSITION_FULL_JAN_CSAA_008_CONFORMANCE,
	LOGICAL_GRAPH_COMPOSITION_FULL_JAN_CSAA_009_CONFORMANCE,
	LOGICAL_GRAPH_COMPOSITION_GATE_EFFECT,
	LOGICAL_GRAPH_COMPOSITION_GRAPH_AUTHORITY,
	LOGICAL_GRAPH_COMPOSITION_NONCLAIMS,
	type LogicalGraphCompositionDiagnosticCode,
	type LogicalGraphCompositionInputs,
	type LogicalGraphCompositionSnapshot,
	type LogicalGraphCompositionValidationIssueCode
} from '../contracts/logical-graph-composition.js';
import { isUnicodeScalarString } from '../semantic/canonical.js';
import { buildLogicalGraphComposition } from './build-logical-graph-composition.js';
import {
	createLogicalGraphCompositionFixture,
	type LogicalGraphCompositionFixture
} from './logical-graph-composition-fixture.test-support.js';
import { logicalGraphCompositionContentDigest } from './logical-graph-composition-canonical.js';
import { validateLogicalGraphComposition } from './validate-logical-graph-composition.js';

const cleanups: Array<() => void> = [];

afterEach(() => {
	for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

function fixture(): LogicalGraphCompositionFixture {
	const value = createLogicalGraphCompositionFixture();
	cleanups.push(value.cleanup);
	return value;
}

function build(inputs: LogicalGraphCompositionInputs): LogicalGraphCompositionSnapshot {
	const outcome = buildLogicalGraphComposition(inputs);
	if (outcome.outcome !== 'partial')
		throw new Error(`Fixture composition failed: ${JSON.stringify(outcome)}`);
	return outcome.composition;
}

function expectUnavailable(inputs: unknown, code: LogicalGraphCompositionDiagnosticCode): void {
	expect(buildLogicalGraphComposition(inputs)).toMatchObject({
		diagnostics: expect.arrayContaining([expect.objectContaining({ code })]),
		outcome: 'unavailable'
	});
}

function expectInvalid(
	value: LogicalGraphCompositionFixture,
	composition: unknown,
	code: LogicalGraphCompositionValidationIssueCode
): void {
	expect(validateLogicalGraphComposition(composition, value.inputs)).toMatchObject({
		issues: expect.arrayContaining([expect.objectContaining({ code })]),
		state: 'INVALID'
	});
}

function redigested(
	composition: LogicalGraphCompositionSnapshot,
	mutate: (draft: LogicalGraphCompositionSnapshot) => void
): LogicalGraphCompositionSnapshot {
	const draft = structuredClone(composition) as LogicalGraphCompositionSnapshot;
	mutate(draft);
	(draft as { contentDigest: string }).contentDigest = logicalGraphCompositionContentDigest(draft);
	return draft;
}

function plainUsage(value: unknown): {
	readonly records: number;
	readonly stringCharacters: number;
} {
	type Work =
		| { readonly kind: 'LEAVE'; readonly value: object }
		| { readonly kind: 'VISIT'; readonly value: unknown };
	const pending: Work[] = [{ kind: 'VISIT', value }];
	const active = new WeakSet<object>();
	let records = 0;
	let stringCharacters = 0;
	while (pending.length > 0) {
		const item = pending.pop()!;
		if (item.kind === 'LEAVE') {
			active.delete(item.value);
			continue;
		}
		records += 1;
		if (typeof item.value === 'string') {
			if (!isUnicodeScalarString(item.value)) throw new Error('Test input is not scalar text.');
			stringCharacters += item.value.length;
			continue;
		}
		if (item.value === null || typeof item.value === 'boolean' || typeof item.value === 'number')
			continue;
		if (typeof item.value !== 'object' || active.has(item.value))
			throw new Error('Test input is not an acyclic plain-data tree.');
		active.add(item.value);
		pending.push({ kind: 'LEAVE', value: item.value });
		if (Array.isArray(item.value)) {
			for (const key of Reflect.ownKeys(item.value).reverse()) {
				if (key === 'length') continue;
				if (typeof key !== 'string' || !isUnicodeScalarString(key))
					throw new Error('Test input array key is not scalar text.');
				stringCharacters += key.length;
				const descriptor = Reflect.getOwnPropertyDescriptor(item.value, key);
				if (descriptor === undefined || !('value' in descriptor))
					throw new Error('Test input array is not inert data.');
				pending.push({ kind: 'VISIT', value: descriptor.value });
			}
		} else
			for (const key of Object.keys(item.value).reverse()) {
				if (!isUnicodeScalarString(key)) throw new Error('Test input key is not scalar text.');
				stringCharacters += key.length;
				pending.push({
					kind: 'VISIT',
					value: (item.value as Record<string, unknown>)[key]
				});
			}
	}
	return { records, stringCharacters };
}

function deeplyFrozen(value: unknown, seen = new WeakSet<object>()): boolean {
	if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return true;
	if (seen.has(value as object)) return true;
	seen.add(value as object);
	if (!Object.isFrozen(value)) return false;
	return Reflect.ownKeys(value).every((key) => {
		const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
		return (
			descriptor === undefined || !('value' in descriptor) || deeplyFrozen(descriptor.value, seen)
		);
	});
}

describe('buildLogicalGraphComposition', () => {
	it('composes two exact reference-only layers and passes independent validation', () => {
		const value = fixture();
		const outcome = buildLogicalGraphComposition(value.inputs);
		expect(outcome).toMatchObject({ diagnostics: [], outcome: 'partial' });
		if (outcome.outcome !== 'partial') throw new Error('Expected partial composition.');
		const { composition } = outcome;
		expect(composition).toMatchObject({
			authorityTransfer: LOGICAL_GRAPH_COMPOSITION_AUTHORITY_TRANSFER,
			capability: LOGICAL_GRAPH_COMPOSITION_CAPABILITY,
			capabilityStatus: LOGICAL_GRAPH_COMPOSITION_CAPABILITY_STATUS,
			closure: 'OPEN',
			compositionClosure: 'EXACT_FOR_SELECTED_VALIDATED_LAYERS_AND_MAPPING_RULE',
			conflicts: [],
			currentness: LOGICAL_GRAPH_COMPOSITION_CURRENTNESS,
			freshness: LOGICAL_GRAPH_COMPOSITION_FRESHNESS,
			fullJanCsaa007Conformance: LOGICAL_GRAPH_COMPOSITION_FULL_JAN_CSAA_007_CONFORMANCE,
			fullJanCsaa008Conformance: LOGICAL_GRAPH_COMPOSITION_FULL_JAN_CSAA_008_CONFORMANCE,
			fullJanCsaa009Conformance: LOGICAL_GRAPH_COMPOSITION_FULL_JAN_CSAA_009_CONFORMANCE,
			gateEffect: LOGICAL_GRAPH_COMPOSITION_GATE_EFFECT,
			graphAuthority: LOGICAL_GRAPH_COMPOSITION_GRAPH_AUTHORITY,
			health: 'PARTIAL',
			nonclaims: LOGICAL_GRAPH_COMPOSITION_NONCLAIMS,
			resultCompleteness: 'COMPLETE_FOR_DECLARED_TWO_LAYER_REFERENCE_COMPOSITION',
			truncation: { reason: null, state: 'NOT_TRUNCATED' },
			unmatchedSources: []
		});
		expect(composition.layers.map((layer) => [layer.ordinal, layer.role])).toEqual([
			[0, 'MODULE_DEPENDENCY'],
			[1, 'CALL']
		]);
		expect(composition.layers[0].sourceNodeIds).toEqual(
			value.moduleDependencyGraph.nodes.map((node) => node.id)
		);
		expect(composition.layers[1].sourceNodeIds).toEqual(
			value.callGraph.nodes.map((node) => node.id)
		);
		expect(composition.crossLinks).toHaveLength(value.snapshot.sources.length);
		expect(composition.crossLinks.map((link) => link.ordinal)).toEqual([0, 1]);
		expect(
			composition.crossLinks.every(
				(link) => link.relationKind === 'SAME_SEMANTIC_SOURCE_OCCURRENCE'
			)
		).toBe(true);
		expect(composition.coverage).toMatchObject({
			callEligibleSourceRegions: 2,
			callPopulationReconciles: true,
			conflictingSemanticSources: 0,
			crossLinks: 2,
			exactSemanticSourceIdCandidates: 2,
			linkedSemanticSources: 2,
			linkPopulationReconciles: true,
			moduleEligibleSourceNodes: 2,
			modulePopulationReconciles: true,
			sourceIdentityPopulationReconciles: true,
			unmatchedCallSources: 0,
			unmatchedModuleSources: 0
		});
		const invariantCoverage: readonly [true, true, true, true, 0, 0, 0] = [
			composition.coverage.callPopulationReconciles,
			composition.coverage.linkPopulationReconciles,
			composition.coverage.modulePopulationReconciles,
			composition.coverage.sourceIdentityPopulationReconciles,
			composition.coverage.conflictingSemanticSources,
			composition.coverage.unmatchedCallSources,
			composition.coverage.unmatchedModuleSources
		];
		expect(invariantCoverage).toEqual([true, true, true, true, 0, 0, 0]);
		expect(validateLogicalGraphComposition(composition, value.inputs)).toEqual({
			issues: [],
			state: 'VALID'
		});
		expect(deeplyFrozen(outcome)).toBe(true);
		expect(Object.isFrozen(value.callGraph.coverage)).toBe(false);
		expect(Object.isFrozen(value.moduleDependencyGraph.coverage)).toBe(false);
		expect(Object.isFrozen(value.callGraph.epistemic)).toBe(false);
		expect(Object.isFrozen(value.callGraph.limitations)).toBe(false);
		expect(Object.isFrozen(value.moduleDependencyGraph.limitations)).toBe(false);
		expect(composition.layers[0].sourceCoverage).not.toBe(value.moduleDependencyGraph.coverage);
		expect(composition.layers[1].sourceCoverage).not.toBe(value.callGraph.coverage);
		expect(composition.layers[1].sourceEpistemic).not.toBe(value.callGraph.epistemic);
		expect(composition.layers[0].sourceLimitations).not.toBe(
			value.moduleDependencyGraph.limitations
		);
		expect(composition.layers[1].sourceLimitations).not.toBe(value.callGraph.limitations);
		if (composition.layers[1].sourceLimitations.length > 0)
			expect(composition.layers[1].sourceLimitations[0]).not.toBe(value.callGraph.limitations[0]);
		expect(composition.sourceLayers).not.toBe(value.request.sourceLayers);
		expect(composition.sourceLayers[0]).not.toBe(value.request.sourceLayers[0]);
		expect(composition.sourceLayers[1]).not.toBe(value.request.sourceLayers[1]);
		expect(composition.layers[0].sourceGraph).not.toBe(value.request.sourceLayers[0]);
		expect(composition.layers[1].sourceGraph).not.toBe(value.request.sourceLayers[1]);
		expect(composition.layers[0].sourceNodeIds).not.toBe(value.moduleDependencyGraph.nodes);
		expect(composition.layers[1].sourceNodeIds).not.toBe(value.callGraph.nodes);
		expect(Object.getOwnPropertyDescriptor(value.callGraph.coverage, 'closure')?.writable).toBe(
			true
		);
	});

	it('is deterministic and emits deterministic deeply frozen telemetry out of band', async () => {
		const value = fixture();
		const events: unknown[] = [];
		const first = buildLogicalGraphComposition(value.inputs, {
			onProgress: (event) => events.push(event)
		});
		const second = buildLogicalGraphComposition(value.inputs, {
			onProgress: () => {
				throw new Error('observer failure');
			}
		});
		expect(first).toEqual(second);
		await Promise.resolve();
		expect(events.length).toBeGreaterThan(0);
		expect(events.every((event) => deeplyFrozen(event))).toBe(true);
		expect(events.map((event) => (event as { sequence: number }).sequence)).toEqual(
			events.map((_event, index) => index)
		);
		expect(
			events.map((event) => {
				const progress = event as { phase: string; state: string };
				return [progress.phase, progress.state];
			})
		).toEqual(
			[
				'REQUEST_BIND',
				'INPUT_IDENTITY_RECONCILE',
				'INPUT_BUDGET',
				'MODULE_DEPENDENCY_GRAPH_VALIDATE',
				'CALL_GRAPH_VALIDATE',
				'SOURCE_OCCURRENCE_JOIN',
				'POPULATION_RECONCILE',
				'MATERIALIZE',
				'SERIALIZE',
				'COMPOSITION_VALIDATE'
			].flatMap((phase) => [
				[phase, 'STARTED'],
				[phase, 'COMPLETED']
			])
		);
	});

	it('emits typed identity and layer-binding failure telemetry', async () => {
		const value = fixture();
		for (const [inputs, detailCode] of [
			[
				{
					...value.inputs,
					request: { ...value.request, subjectId: `stale-${value.request.subjectId}` }
				},
				'INPUT_IDENTITY_MISMATCH'
			],
			[
				{
					...value.inputs,
					request: {
						...value.request,
						sourceLayers: [
							{ ...value.request.sourceLayers[0], contentDigest: 'f'.repeat(64) },
							value.request.sourceLayers[1]
						]
					}
				},
				'LAYER_BINDING_INVALID'
			]
		] as const) {
			const events: unknown[] = [];
			expect(
				buildLogicalGraphComposition(inputs, { onProgress: (event) => events.push(event) })
			).toMatchObject({ outcome: 'unavailable' });
			await Promise.resolve();
			expect(events.at(-1)).toMatchObject({
				detailCode,
				phase: 'INPUT_IDENTITY_RECONCILE',
				state: 'FAILED'
			});
		}
	});

	it('accepts exact hostile-preflight thresholds and rejects either one below', () => {
		const value = fixture();
		const threshold = structuredClone(value.inputs);
		const initial = plainUsage(threshold);
		(
			threshold.request.budgets as {
				maxInputRecords: number;
				maxInputStringCharacters: number;
			}
		).maxInputRecords = initial.records;
		(
			threshold.request.budgets as {
				maxInputRecords: number;
				maxInputStringCharacters: number;
			}
		).maxInputStringCharacters = initial.stringCharacters;
		const exact = plainUsage(threshold);
		expect(exact).toEqual(initial);
		expect(buildLogicalGraphComposition(threshold).outcome).toBe('partial');
		expectUnavailable(
			{
				...threshold,
				request: {
					...threshold.request,
					budgets: { ...threshold.request.budgets, maxInputRecords: exact.records - 1 }
				}
			},
			'BUDGET_EXCEEDED'
		);
		expectUnavailable(
			{
				...threshold,
				request: {
					...threshold.request,
					budgets: {
						...threshold.request.budgets,
						maxInputStringCharacters: exact.stringCharacters - 1
					}
				}
			},
			'BUDGET_EXCEEDED'
		);
	});

	it('fails closed at meaningful composition operation guards', () => {
		const value = fixture();
		const composition = build(value.inputs);
		const outputRecords =
			1 + 2 + composition.inheritedLimitations.length + composition.crossLinks.length;
		expect(
			buildLogicalGraphComposition({
				...value.inputs,
				request: {
					...value.request,
					budgets: { ...value.request.budgets, maxOutputRecords: outputRecords }
				}
			}).outcome
		).toBe('partial');
		for (const [key, maximum] of [
			['maxModuleDependencyNodes', value.moduleDependencyGraph.nodes.length - 1],
			['maxModuleDependencyEdges', value.moduleDependencyGraph.edges.length - 1],
			['maxCallNodes', value.callGraph.nodes.length - 1],
			['maxCallEdges', value.callGraph.edges.length - 1],
			['maxEligibleSourceNodes', value.snapshot.sources.length * 2 - 1],
			['maxLinks', value.snapshot.sources.length - 1],
			['maxTraversalSteps', composition.coverage.chargedInputTraversalSteps - 1],
			['maxOutputRecords', outputRecords - 1]
		] as const)
			expectUnavailable(
				{
					...value.inputs,
					request: {
						...value.request,
						budgets: { ...value.request.budgets, [key]: maximum }
					}
				},
				'BUDGET_EXCEEDED'
			);
	});

	it('rejects proxies, sparse arrays, cycles, symbol keys, unsafe numbers, and negative zero', () => {
		const value = fixture();
		const hostile: unknown[] = [
			new Proxy(value.inputs, {}),
			{ ...value.inputs, request: { ...value.request, sourceLayers: new Array(2) } },
			{
				...value.inputs,
				request: { ...value.request, budgets: { ...value.request.budgets, maxLinks: -0 } }
			},
			{
				...value.inputs,
				request: {
					...value.request,
					budgets: { ...value.request.budgets, maxLinks: Number.MAX_SAFE_INTEGER + 1 }
				}
			},
			{
				...value.inputs,
				request: {
					...value.request,
					budgets: { ...value.request.budgets, maxConflictRecords: 1 }
				}
			},
			{
				...value.inputs,
				request: {
					...value.request,
					budgets: { ...value.request.budgets, maxUnmatchedRecords: 1 }
				}
			}
		];
		const cyclic = structuredClone(value.inputs);
		(cyclic.callGraph.nodes[0]!.sourceLocations as unknown as Array<unknown>).push(
			cyclic.callGraph.nodes[0]
		);
		hostile.push(cyclic);
		const symbolKey = structuredClone(value.inputs) as unknown as Record<PropertyKey, unknown>;
		symbolKey[Symbol('hostile')] = true;
		hostile.push(symbolKey);
		for (const input of hostile) expectUnavailable(input, 'REQUEST_INVALID');
	});

	it('does not invoke nested accessors while rejecting hostile input', () => {
		const value = fixture();
		const hostile = structuredClone(value.inputs);
		let getterCalls = 0;
		Object.defineProperty(hostile.semanticSnapshot.sources[0]!, 'logicalPath', {
			enumerable: true,
			get(): string {
				getterCalls += 1;
				throw new Error('getter invoked');
			}
		});
		expectUnavailable(hostile, 'REQUEST_INVALID');
		expect(getterCalls).toBe(0);
	});

	it('charges invalid record keys and array expandos before semantic shape handling', () => {
		const value = fixture();
		const baselineCharacters = plainUsage(value.inputs).stringCharacters;
		const invalidRecordKey = `${'x'.repeat(baselineCharacters + 1)}\ud800`;
		const recordHostile = structuredClone(value.inputs);
		(recordHostile.semanticSnapshot as unknown as Record<string, unknown>)[invalidRecordKey] = null;
		(
			recordHostile.request.budgets as {
				maxInputStringCharacters: number;
			}
		).maxInputStringCharacters = baselineCharacters;
		expectUnavailable(recordHostile, 'BUDGET_EXCEEDED');

		const arrayHostile = structuredClone(value.inputs);
		const arrayExpando = 'x'.repeat(baselineCharacters + 1);
		(arrayHostile.request.sourceLayers as unknown as Record<string, unknown>)[arrayExpando] = null;
		(
			arrayHostile.request.budgets as {
				maxInputStringCharacters: number;
			}
		).maxInputStringCharacters = baselineCharacters;
		expectUnavailable(arrayHostile, 'BUDGET_EXCEEDED');
	});

	it('rejects stale identities, reordered or stale source layers, and invalid predecessors', () => {
		const value = fixture();
		expectUnavailable(
			{
				...value.inputs,
				request: { ...value.request, subjectId: `stale-${value.request.subjectId}` }
			},
			'INPUT_IDENTITY_MISMATCH'
		);
		expectUnavailable(
			{
				...value.inputs,
				request: {
					...value.request,
					sourceLayers: [value.request.sourceLayers[1], value.request.sourceLayers[0]]
				}
			},
			'REQUEST_INVALID'
		);
		expectUnavailable(
			{
				...value.inputs,
				request: {
					...value.request,
					sourceLayers: [
						{ ...value.request.sourceLayers[0], contentDigest: 'f'.repeat(64) },
						value.request.sourceLayers[1]
					]
				}
			},
			'LAYER_BINDING_INVALID'
		);
		expectUnavailable(
			{
				...value.inputs,
				moduleDependencyGraph: { ...value.moduleDependencyGraph, contentDigest: 'f'.repeat(64) }
			},
			'LAYER_BINDING_INVALID'
		);
		expectUnavailable(
			{
				...value.inputs,
				callGraph: { ...value.callGraph, contentDigest: 'f'.repeat(64) }
			},
			'LAYER_BINDING_INVALID'
		);
		const invalidModule = {
			...value.moduleDependencyGraph,
			contentDigest: 'f'.repeat(64)
		};
		expectUnavailable(
			{
				...value.inputs,
				moduleDependencyGraph: invalidModule,
				request: {
					...value.request,
					sourceLayers: [
						{ ...value.request.sourceLayers[0], contentDigest: invalidModule.contentDigest },
						value.request.sourceLayers[1]
					]
				}
			},
			'MODULE_DEPENDENCY_GRAPH_INVALID'
		);
		const invalidCall = { ...value.callGraph, contentDigest: 'f'.repeat(64) };
		expectUnavailable(
			{
				...value.inputs,
				callGraph: invalidCall,
				request: {
					...value.request,
					sourceLayers: [
						value.request.sourceLayers[0],
						{ ...value.request.sourceLayers[1], contentDigest: invalidCall.contentDigest }
					]
				}
			},
			'CALL_GRAPH_INVALID'
		);
	});

	it('independently rejects re-digested cross-link, coverage, layer, and nonclaim corruption', () => {
		const value = fixture();
		const composition = build(value.inputs);
		expectInvalid(
			value,
			redigested(composition, (draft) => {
				(draft.crossLinks[0]!.sourceIdentity as { logicalPath: string }).logicalPath = 'wrong.ts';
			}),
			'POPULATION_MISMATCH'
		);
		expectInvalid(
			value,
			redigested(composition, (draft) => {
				(draft.coverage as { crossLinks: number }).crossLinks = 0;
			}),
			'POPULATION_MISMATCH'
		);
		expectInvalid(
			value,
			redigested(composition, (draft) => {
				(draft.layers[0].sourceNodeIds as unknown as string[]).splice(0, 1);
			}),
			'POPULATION_MISMATCH'
		);
		expectInvalid(
			value,
			redigested(composition, (draft) => {
				(draft.nonclaims as unknown as string[]).splice(0, 1);
			}),
			'POPULATION_MISMATCH'
		);
	});

	it('detects a stale content digest before accepting an otherwise unchanged output', () => {
		const value = fixture();
		const composition = structuredClone(build(value.inputs)) as LogicalGraphCompositionSnapshot;
		(composition as { contentDigest: string }).contentDigest = '0'.repeat(64);
		expectInvalid(value, composition, 'CONTENT_DIGEST_MISMATCH');
	});
});
